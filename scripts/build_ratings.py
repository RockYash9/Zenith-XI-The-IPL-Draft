import pandas as pd
import numpy as np
import json
import os
from scipy.stats import beta

def generate_corrected_ultimate_ratings():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, '..', 'data', 'processed', 'cleaned_ball_by_ball.csv')
    
    # Dual Output Paths
    output_path = os.path.join(script_dir, '..', 'data', 'processed', 'player_ratings_advanced.json')
    client_output_path = os.path.join(script_dir, '..', 'client', 'public', 'data', 'player_ratings_advanced.json')
    
    print("Loading cleaned dataset...")
    df = pd.read_csv(input_path, low_memory=False)
    
    # ---------------------------------------------
    # 1. MATCH VOLUME & BASE AGGREGATIONS
    # ---------------------------------------------
    print("Aggregating Base Stats...")
    participants = pd.melt(df, id_vars=['match_id', 'season'], value_vars=['striker', 'non_striker', 'bowler'], value_name='player_name').dropna()
    matches_played = participants.groupby(['season', 'player_name'])['match_id'].nunique().reset_index(name='matches')

    # BATTING
    bat_balls = df[df['wides'] == 0].groupby(['season', 'striker']).size().reset_index(name='balls_faced')
    bat_runs = df.groupby(['season', 'striker'])['runs_off_bat'].sum().reset_index(name='runs')
    dismissals = df[(df['player_dismissed'] == df['striker']) & (~df['wicket_type'].isin(['retired hurt', 'None', 'Not Out']))]
    bat_outs = dismissals.groupby(['season', 'player_dismissed']).size().reset_index(name='times_out')
    
    bat_df = pd.merge(bat_runs, bat_balls, on=['season', 'striker'])
    bat_df = pd.merge(bat_df, bat_outs, left_on=['season', 'striker'], right_on=['season', 'player_dismissed'], how='left').fillna(0)
    bat_df.rename(columns={'striker': 'player_name'}, inplace=True)

    # BOWLING
    bowl_balls = df[df['wides'] == 0].groupby(['season', 'bowler']).size().reset_index(name='balls_bowled')
    df['total_runs_conceded'] = df['runs_off_bat'] + df['wides'] + df['noballs']
    bowl_runs = df.groupby(['season', 'bowler'])['total_runs_conceded'].sum().reset_index(name='runs_conceded')
    bowler_wickets = df[(df['is_wicket'] == 1) & (~df['wicket_type'].isin(['run out', 'retired hurt', 'retired out', 'obstructing the field']))]
    bowl_wicks = bowler_wickets.groupby(['season', 'bowler']).size().reset_index(name='wickets')
    
    bowl_df = pd.merge(bowl_balls, bowl_runs, on=['season', 'bowler'])
    bowl_df = pd.merge(bowl_df, bowl_wicks, on=['season', 'bowler'], how='left').fillna(0)
    bowl_df.rename(columns={'bowler': 'player_name'}, inplace=True)
    bowl_df['overs'] = bowl_df['balls_bowled'] / 6.0

    # MERGE & FILTER (Strict 30-ball volume floor)
    merged = pd.merge(bat_df, bowl_df, on=['season', 'player_name'], how='outer').fillna(0)
    merged = pd.merge(merged, matches_played, on=['season', 'player_name'], how='left').fillna(0)
    merged = merged[(merged['balls_faced'] >= 30) | (merged['balls_bowled'] >= 30)].copy()

    # ---------------------------------------------
    # 2. BAYESIAN SHRINKAGE 
    # ---------------------------------------------
    print("Applying Bayesian Shrinkage...")
    season_priors = merged.groupby('season').agg(
        l_runs=('runs', 'sum'), l_outs=('times_out', 'sum'), l_bf=('balls_faced', 'sum'),
        l_rc=('runs_conceded', 'sum'), l_wkts=('wickets', 'sum'), l_ovs=('overs', 'sum')
    ).reset_index()
    
    season_priors['l_bat_avg'] = season_priors['l_runs'] / season_priors['l_outs'].replace(0, 1)
    season_priors['l_bat_sr'] = (season_priors['l_runs'] / season_priors['l_bf'].replace(0, 1)) * 100
    season_priors['l_econ'] = season_priors['l_rc'] / season_priors['l_ovs'].replace(0, 1)
    season_priors['l_bowl_avg'] = season_priors['l_rc'] / season_priors['l_wkts'].replace(0, 1)
    merged = pd.merge(merged, season_priors, on='season', how='left')

    k_outs, k_bf, k_ovs, k_wkt = 4.0, 40.0, 15.0, 5.0
    
    merged['shrunk_avg'] = (merged['runs'] + k_outs * merged['l_bat_avg']) / (merged['times_out'] + k_outs)
    merged['shrunk_sr'] = (merged['runs'] * 100 + k_bf * merged['l_bat_sr']) / (merged['balls_faced'] + k_bf)
    merged['shrunk_econ'] = (merged['runs_conceded'] + k_ovs * merged['l_econ']) / (merged['overs'] + k_ovs)
    merged['shrunk_bowl_avg'] = (merged['runs_conceded'] + k_wkt * merged['l_bowl_avg']) / (merged['wickets'] + k_wkt)

    merged['raw_bat_avg'] = np.where(merged['times_out'] > 0, merged['runs'] / merged['times_out'], merged['runs'])
    merged['raw_bat_sr'] = np.where(merged['balls_faced'] > 0, (merged['runs'] / merged['balls_faced']) * 100, 0)
    merged['raw_econ'] = np.where(merged['overs'] > 0, merged['runs_conceded'] / merged['overs'], 0)
    merged['raw_bowl_avg'] = np.where(merged['wickets'] > 0, merged['runs_conceded'] / merged['wickets'], 0)

    # ---------------------------------------------
    # 3. Z-SCORE NORMALIZATION & EXPLICIT VOLUME SUB-SCORES
    # ---------------------------------------------
    print("Calculating Z-Scores and Volume Context...")
    bat_m = merged['balls_faced'] >= 30
    merged.loc[bat_m, 'z_avg'] = merged[bat_m].groupby('season')['shrunk_avg'].transform(lambda x: (x - x.mean()) / x.std())
    merged.loc[bat_m, 'z_sr'] = merged[bat_m].groupby('season')['shrunk_sr'].transform(lambda x: (x - x.mean()) / x.std())
    merged.loc[bat_m, 'z_runs'] = merged[bat_m].groupby('season')['runs'].transform(lambda x: (x - x.mean()) / x.std())
    
    # 45% Volume weighting implementation
    merged['BatScore'] = np.nan
    merged.loc[bat_m, 'BatScore'] = (
        (0.30 * merged.loc[bat_m, 'z_avg'].fillna(0)) + 
        (0.25 * merged.loc[bat_m, 'z_sr'].fillna(0)) + 
        (0.45 * merged.loc[bat_m, 'z_runs'].fillna(0))
    )

    bowl_m = merged['balls_bowled'] >= 30
    merged.loc[bowl_m, 'z_wkt'] = merged[bowl_m].groupby('season')['wickets'].transform(lambda x: (x - x.mean()) / x.std())
    merged.loc[bowl_m, 'z_econ'] = merged[bowl_m].groupby('season')['shrunk_econ'].transform(lambda x: (x - x.mean()) / x.std())
    merged.loc[bowl_m, 'z_bowl_avg'] = merged[bowl_m].groupby('season')['shrunk_bowl_avg'].transform(lambda x: (x - x.mean()) / x.std())
    
    merged['BowlScore'] = np.nan
    merged.loc[bowl_m, 'BowlScore'] = (
        (0.30 * -merged.loc[bowl_m, 'z_bowl_avg'].fillna(0)) + 
        (0.25 * -merged.loc[bowl_m, 'z_econ'].fillna(0)) + 
        (0.45 * merged.loc[bowl_m, 'z_wkt'].fillna(0))
    )

    # ---------------------------------------------
    # 4. BALANCED ROLE WEIGHTING & COVARIANCE BOOST
    # ---------------------------------------------
    k_role = 1.5
    total_inv = merged['balls_faced'] + (merged['balls_bowled'] * k_role)
    merged['w_bat'] = merged['balls_faced'] / total_inv
    merged['w_bowl'] = (merged['balls_bowled'] * k_role) / total_inv
    
    # Covariance Boost guarantees genuine all-rounders are protected
    cov_boost = np.minimum(merged['w_bat'], merged['w_bowl']) * 1.8 
    
    merged['OVR_input'] = (
        (merged['w_bat'] * merged['BatScore'].fillna(0)) + 
        (merged['w_bowl'] * merged['BowlScore'].fillna(0)) + 
        cov_boost
    )

    # ---------------------------------------------
    # 5. SKEW-NORMAL BETA CDF MAPPING
    # ---------------------------------------------
    print("Applying Skew-Normal Distribution Transform...")
    merged['emp_pct'] = merged['OVR_input'].rank(pct=True, method='average')
    safe_pct = np.clip(merged['emp_pct'], 0.001, 0.999)
    
    # Locked-in Beta(2.5, 5.0) parameters for strict 2.2% elite scarcity
    a, b = 2.5, 5.0
    merged['skew_score'] = beta.ppf(safe_pct, a, b)
    
    # Fixed theoretical stretch constant (0.839753)
    beta_max = beta.ppf(0.999, a, b)
    
    # Apply stretch and clip to 0-1 bounds, then scale to 60-90
    scaled_scores = np.clip(merged['skew_score'] / beta_max, 0, 1)
    merged['OVR'] = 60 + (30 * scaled_scores)
    merged['OVR'] = np.clip(merged['OVR'], 60, 90).round().astype(int)


    # ---------------------------------------------
    # 6. OVERSEAS TAGGING, ROLES & EXPORT
    # ---------------------------------------------
    OVERSEAS_PLAYERS = {
        "A Flintoff", "A Nortje", "A Symonds", "A Zampa", "AB McDonald", "AB de Villiers", 
        "AC Blizzard", "AC Gilchrist", "AC Thomas", "AC Voges", "AD Hales", "AD Mascarenhas", 
        "AD Mathews", "AD Russell", "AF Milne", "AJ Finch", "AJ Hosein", "AJ Tye", 
        "AK Markram", "AM Ghazanfar", "AS Joseph", "AU Rashid", "Azhar Mahmood", 
        "Azmatullah Omarzai", "B Geeves", "B Laughlin", "B Lee", "B Muzarabani", 
        "B Stanlake", "BA Stokes", "BAW Mendis", "BB McCullum", "BCJ Cutting", "BE Hendricks", 
        "BJ Haddin", "BJ Hodge", "BJ Rohrer", "BMAJ Mendis", "BR Dunk", "BW Hilfenhaus", 
        "C Bosch", "C Green", "C Munro", "C de Grandhomme", "CA Ingram", "CA Lynn", "CH Gayle", 
        "CH Morris", "CJ Anderson", "CJ Dala", "CJ Ferguson", "CJ Green", "CJ Jordan", "CJ McKay", 
        "CK Kapugedera", "CK Langeveldt", "CL White", "CR Brathwaite", "CRD Fernando", "D Arcy Short", 
        "D Wiese", "D du Preez", "DA Miller", "DA Warner", "DAJ Bracewell", "DE Bollinger", 
        "DJ Bravo", "DJ Harris", "DJ Hussey", "DJ Jacobs", "DJ Mitchell", "DJ Willey", 
        "DJG Sammy", "DJM Short", "DL Vettori", "DNT Zoysa", "DP Conway", "DP Nannes", 
        "DPMD Jayawardene", "DR Martyn", "DR Sams", "DR Smith", "DT Christian", "DW Steyn", 
        "E Lewis", "EJG Morgan", "Evin Lewis", "F Behardien", "F du Plessis", "FA Allen", 
        "FH Edwards", "Fazalhaq Farooqi", "G Coetzee", "GB Hogg", "GC Smith", "GC Viljoen", 
        "GD McGrath", "GD Phillips", "GH Worker", "GJ Bailey", "GJ Maxwell", "GR Napier", 
        "H Gurney", "H Klaasen", "HC Brook", "HH Gibbs", "HM Amla", "I Naveed", "I Udana", 
        "Imran Tahir", "J Botha", "J Charles", "J Little", "J Theron", "JA Morkel", "JA Richardson", 
        "JC Archer", "JC Buttler", "JD Ryder", "JDS Neesham", "JE Root", "JE Taylor", "JEC Franklin", 
        "JH Kallis", "JJ Roy", "JJ van der Wath", "JL Denly", "JL Pattinson", "JM Bairstow", "JM Kemp", 
        "JO Holder", "JP Behrendorff", "JP Duminy", "JP Faulkner", "JR Hazlewood", "JR Hopes", 
        "J Spencer", "JW Hastings", "K Rabada", "KA Pollard", "KAJ Roach", "KMA Paul", "KMDN Kulasekara", 
        "KP Pietersen", "KS Williamson", "KW Richardson", "K Santokie", "L Bosman", "L Ngidi", "L Wood", 
        "LA Carseldine", "LA Dawson", "LA Pomersbach", "LE Plunkett", "LH Ferguson", "LJ Wright", 
        "LMP Simmons", "LRPL Taylor", "LS Livingstone", "Litton Das", "M Jansen", "M Klinger", "M Morkel", 
        "M Muralitharan", "M Pathirana", "M Theekshana", "M de Lange", "MA Starc", "MA Wood", 
        "MC Henriques", "MD Shanaka", "MDKJ Perera", "MEK Hussey", "MF Maharoof", "MG Johnson", 
        "MG Neser", "MJ Clarke", "MJ Guptill", "MJ Lumb", "MJ McClenaghan", "MJ Santner", "MM Ali", 
        "MN Samuels", "MN van Wyk", "MP Stoinis", "MR Marsh", "MS Wade", "MW Short", "Mashrafe Mortaza", 
        "Misbah-ul-Haq", "Mohammad Ashraful", "Mohammad Asif", "Mohammad Hafeez", "Mohammad Nabi", 
        "Mujeeb Ur Rahman", "Mustafizur Rahman", "N Burger", "N Pooran", "NL McCullum", "NLTC Perera", 
        "NM Coulter-Nile", "NW Bracken", "Naveen-ul-Haq", "Noor Ahmad", "O McCoy", "OA Shah", "PBB Rajapaksa", 
        "PC Makgaka", "PD Collingwood", "PD Salt", "PJ Cummins", "PM Siddle", "PVD Chameera", "PWA Mulder", 
        "PWH de Silva", "Q de Kock", "R Gleeson", "R Powell", "R Rampaul", "R Ravindra", "R Shepherd", 
        "RD Rickelton", "RE Levi", "RE van der Merwe", "RJ Harris", "RJ Peterson", "RJW Topley", 
        "RN ten Doeschate", "RR Rossouw", "RS Bopara", "RT Ponting", "Rahmanullah Gurbaz", "Rashid Khan", 
        "S Badree", "S Lamichhane", "SA Abbott", "SB Styris", "SE Bond", "SE Marsh", "SE Rutherford", 
        "SJ Ervine", "SK Warne", "SL Malinga", "SM Curran", "SM Harwood", "SM Katich", "SM Pollock", 
        "SMSM Senanayake", "SO Hetmyer", "SP Fleming", "SP Narine", "SPD Smith", "SR Watson", "SS Cottrell", 
        "ST Jayasuriya", "SW Billings", "SW Tait", "Salman Butt", "Shahid Afridi", "Shakib Al Hasan", 
        "Shoaib Akhtar", "Shoaib Malik", "Sikandar Raza", "Sohail Tanvir", "T Banton", "T Henderson", 
        "T Stubbs", "T Thushara", "TA Boult", "TD Paine", "TG Southee", "TH David", "TK Curran", "TL Seifert", 
        "TM Dilshan", "TM Head", "TR Birt", "TS Mills", "Umar Gul", "WD Parnell", "WG Jacks", "WPUJC Vaas", 
        "Younis Khan", "Abdur Razzak", "A Dananjaya"
    }

    # Added Wicketkeeper override dictionary
    KNOWN_WICKETKEEPERS = [
        "MS Dhoni", "KD Karthik", "WP Saha", "RR Pant", "Q de Kock",
        "JC Buttler", "KL Rahul", "Ishan Kishan", "SV Samson", "JM Bairstow",
        "N Pooran", "H Klaasen", "PA Patel", "RV Uthappa", "NV Ojha",
        "AT Rayudu", "SW Billings", "KS Bharat", "Jitesh Sharma", "PD Salt",
        "BB McCullum", "AC Gilchrist", "KC Sangakkara", "Kamran Akmal",
        "Dhruv Jurel", "P Simran Singh", "Anuj Rawat", "MS Wade"
    ]

    teams_bat = df.groupby(['season', 'striker'])['batting_team'].first().reset_index().rename(columns={'striker': 'player_name', 'batting_team': 'team'})
    teams_bowl = df.groupby(['season', 'bowler'])['bowling_team'].first().reset_index().rename(columns={'bowler': 'player_name', 'bowling_team': 'team'})
    teams = pd.concat([teams_bat, teams_bowl]).drop_duplicates(subset=['season', 'player_name'], keep='first')
    merged = pd.merge(merged, teams, on=['season', 'player_name'], how='left')

    final_pool = []
    for _, row in merged.iterrows():
        # Role Assignment Logic with Wicketkeeper Override
        if row['player_name'] in KNOWN_WICKETKEEPERS: 
            role = 'Wicketkeeper'
        elif row['w_bat'] > 0.3 and row['w_bowl'] > 0.3: 
            role = 'All-Rounder'
        elif row['w_bowl'] > 0.6: 
            role = 'Bowler'
        else: 
            role = 'Batter'
            
        final_pool.append({
            "name": row['player_name'],
            "season": str(row['season']),
            "team": row['team'],
            "role": role,
            "ovr": int(row['OVR']),
            "matches": int(row['matches']),
            "is_overseas": row['player_name'] in OVERSEAS_PLAYERS,
            "stats": {
                "batting": {
                    "runs": int(row['runs']),
                    "balls_faced": int(row['balls_faced']),
                    "times_out": int(row['times_out']),
                    "avg": round(row['raw_bat_avg'], 2),
                    "sr": round(row['raw_bat_sr'], 2)
                },
                "bowling": {
                    "wickets": int(row['wickets']),
                    "overs": round(row['overs'], 1),
                    "runs_conceded": int(row['runs_conceded']),
                    "econ": round(row['raw_econ'], 2),
                    "avg": round(row['raw_bowl_avg'], 2)
                }
            }
        })
        
    # Dual Output Execution
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(final_pool, f, indent=4)
        
    os.makedirs(os.path.dirname(client_output_path), exist_ok=True)
    with open(client_output_path, 'w') as f:
        json.dump(final_pool, f, indent=4)
        
    print(f"✅ Success! Masterfile generated at {output_path}")
    print(f"✅ Success! Client file synced at {client_output_path}")

if __name__ == "__main__":
    generate_corrected_ultimate_ratings()
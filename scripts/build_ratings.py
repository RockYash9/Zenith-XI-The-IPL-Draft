import pandas as pd
import numpy as np
import json
import os

def generate_bayesian_ratings():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, '..', 'data', 'processed', 'cleaned_ball_by_ball.csv')
    output_path = os.path.join(script_dir, '..', 'data', 'processed', 'player_ratings_advanced.json')
    
    print("Loading cleaned dataset...")
    df = pd.read_csv(input_path, low_memory=False)
    
    # ---------------------------------------------
    # 0. MATCH VOLUME TRACKING
    # ---------------------------------------------
    print("Calculating Match Volumes...")
    participants = pd.melt(df, id_vars=['match_id', 'season'], 
                           value_vars=['striker', 'non_striker', 'bowler'], 
                           value_name='player_name').dropna()
    matches_played = participants.groupby(['season', 'player_name'])['match_id'].nunique().reset_index(name='matches')

    # ---------------------------------------------
    # 1. BATTING AGGREGATION
    # ---------------------------------------------
    print("Computing Bayesian Batting Metrics...")
    bat_balls = df[df['wides'] == 0].groupby(['season', 'striker']).size().reset_index(name='balls_faced')
    bat_runs = df.groupby(['season', 'striker'])['runs_off_bat'].sum().reset_index(name='runs')
    
    dismissals = df[(df['player_dismissed'] == df['striker']) & (~df['wicket_type'].isin(['retired hurt', 'None', 'Not Out']))]
    bat_outs = dismissals.groupby(['season', 'player_dismissed']).size().reset_index(name='times_out')
    
    bat_df = pd.merge(bat_runs, bat_balls, on=['season', 'striker'])
    bat_df = pd.merge(bat_df, bat_outs, left_on=['season', 'striker'], right_on=['season', 'player_dismissed'], how='left').fillna(0)
    bat_df.rename(columns={'striker': 'player_name'}, inplace=True)
    
    bat_df['bat_avg'] = np.where(bat_df['times_out'] > 0, bat_df['runs'] / bat_df['times_out'], bat_df['runs'])
    bat_df['bat_sr'] = np.where(bat_df['balls_faced'] > 0, (bat_df['runs'] / bat_df['balls_faced']) * 100, 0)
    
    m_bat = 60.0
    league_avg_bat = bat_df[bat_df['balls_faced'] > 120]['bat_avg'].mean()
    league_sr_bat = bat_df[bat_df['balls_faced'] > 120]['bat_sr'].mean()
    
    n_bat = bat_df['balls_faced']
    bat_df['adj_avg'] = (n_bat / (n_bat + m_bat)) * bat_df['bat_avg'] + (m_bat / (n_bat + m_bat)) * league_avg_bat
    bat_df['adj_sr'] = (n_bat / (n_bat + m_bat)) * bat_df['bat_sr'] + (m_bat / (n_bat + m_bat)) * league_sr_bat
    bat_df['bat_impact'] = (bat_df['adj_avg'] * 1.5) + (bat_df['adj_sr'] * 0.8)

    # ---------------------------------------------
    # 2. BOWLING AGGREGATION
    # ---------------------------------------------
    print("Computing Bayesian Bowling Metrics...")
    bowl_balls = df[df['wides'] == 0].groupby(['season', 'bowler']).size().reset_index(name='balls_bowled')
    df['total_runs_conceded'] = df['runs_off_bat'] + df['wides'] + df['noballs']
    bowl_runs = df.groupby(['season', 'bowler'])['total_runs_conceded'].sum().reset_index(name='runs_conceded')
    
    bowler_wickets = df[(df['is_wicket'] == 1) & (~df['wicket_type'].isin(['run out', 'retired hurt', 'retired out', 'obstructing the field']))]
    bowl_wicks = bowler_wickets.groupby(['season', 'bowler']).size().reset_index(name='wickets')
    
    bowl_df = pd.merge(bowl_balls, bowl_runs, on=['season', 'bowler'])
    bowl_df = pd.merge(bowl_df, bowl_wicks, on=['season', 'bowler'], how='left').fillna(0)
    bowl_df.rename(columns={'bowler': 'player_name'}, inplace=True)
    
    bowl_df['overs'] = bowl_df['balls_bowled'] / 6.0
    bowl_df['econ'] = np.where(bowl_df['overs'] > 0, bowl_df['runs_conceded'] / bowl_df['overs'], 0)
    bowl_df['bowl_avg'] = np.where(bowl_df['wickets'] > 0, bowl_df['runs_conceded'] / bowl_df['wickets'], 0)
    bowl_df['bowl_sr'] = np.where(bowl_df['wickets'] > 0, bowl_df['balls_bowled'] / bowl_df['wickets'], 0)
    
    bowl_df['raw_econ'] = np.where(bowl_df['overs'] >= 2.0, bowl_df['econ'], 12.0)
    
    m_bowl = 120.0 
    league_econ = bowl_df[bowl_df['balls_bowled'] > 120]['raw_econ'].mean()
    league_wkts = bowl_df[bowl_df['balls_bowled'] > 120]['wickets'].mean()
    
    n_bowl = bowl_df['balls_bowled']
    bowl_df['adj_econ'] = (n_bowl / (n_bowl + m_bowl)) * bowl_df['raw_econ'] + (m_bowl / (n_bowl + m_bowl)) * league_econ
    bowl_df['adj_wkts'] = (n_bowl / (n_bowl + m_bowl)) * bowl_df['wickets'] + (m_bowl / (n_bowl + m_bowl)) * league_wkts
    
    eco_score = np.maximum(0, 125 - (bowl_df['adj_econ'] * 10))
    wkt_score = bowl_df['adj_wkts'] * 3.5
    bowl_df['bowl_impact'] = eco_score + wkt_score

    # ---------------------------------------------
    # 3. MERGE & PERCENTILE NORMALIZATION
    # ---------------------------------------------
    print("Applying Filters & 60-90 Percentile Normalization...")
    merged = pd.merge(bat_df, bowl_df, on=['season', 'player_name'], how='outer').fillna(0)
    merged = pd.merge(merged, matches_played, on=['season', 'player_name'], how='left').fillna(0)
    
    teams_bat = df.groupby(['season', 'striker'])['batting_team'].first().reset_index().rename(columns={'striker': 'player_name', 'batting_team': 'team'})
    teams_bowl = df.groupby(['season', 'bowler'])['bowling_team'].first().reset_index().rename(columns={'bowler': 'player_name', 'bowling_team': 'team'})
    teams = pd.concat([teams_bat, teams_bowl]).drop_duplicates(subset=['season', 'player_name'], keep='first')
    merged = pd.merge(merged, teams, on=['season', 'player_name'], how='left')
    
    merged = merged[(merged['balls_faced'] >= 30) | (merged['balls_bowled'] >= 30)].copy()

    merged['B_score'] = 60 + (merged['bat_impact'].rank(pct=True) * 30)
    merged['Bo_score'] = 60 + (merged['bowl_impact'].rank(pct=True) * 30)
    
    k = 1.5 
    total_involvement = merged['balls_faced'] + (merged['balls_bowled'] * k)
    merged['w_bat'] = merged['balls_faced'] / total_involvement
    merged['w_bowl'] = (merged['balls_bowled'] * k) / total_involvement
    
    merged['OVR'] = (merged['w_bat'] * merged['B_score']) + (merged['w_bowl'] * merged['Bo_score'])
    merged['OVR'] = np.clip(merged['OVR'], 60, 90).round().astype(int)

    # ---------------------------------------------
    # 4. EXPORT TO RESTRUCTURED JSON
    # ---------------------------------------------
    final_pool = []
    for _, row in merged.iterrows():
        if row['w_bat'] > 0.3 and row['w_bowl'] > 0.3: role = 'All-Rounder'
        elif row['w_bowl'] > 0.6: role = 'Bowler'
        else: role = 'Batter'
            
        final_pool.append({
            "name": row['player_name'],
            "season": str(row['season']),
            "team": row['team'],
            "role": role,
            "ovr": int(row['OVR']),
            "matches": int(row['matches']),
            "stats": {
                "batting": {
                    "runs": int(row['runs']),
                    "balls_faced": int(row['balls_faced']),
                    "times_out": int(row['times_out']),
                    "avg": round(row['bat_avg'], 2),
                    "sr": round(row['bat_sr'], 2)
                },
                "bowling": {
                    "wickets": int(row['wickets']),
                    "overs": round(row['overs'], 1),
                    "runs_conceded": int(row['runs_conceded']),
                    "econ": round(row['econ'], 2),
                    "avg": round(row['bowl_avg'], 2),
                    "sr": round(row['bowl_sr'], 2)
                }
            }
        })
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(final_pool, f, indent=4)
        
    print(f"✅ Success! Cleaned, restructured JSON saved to {output_path}")

if __name__ == "__main__":
    generate_bayesian_ratings()
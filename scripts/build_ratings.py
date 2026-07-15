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
    # 1. BATTING AGGREGATION & BAYESIAN SHRINKAGE
    # ---------------------------------------------
    print("Computing Bayesian Batting Metrics...")
    bat_balls = df[df['wides'] == 0].groupby(['season', 'striker']).size().reset_index(name='balls_faced')
    bat_runs = df.groupby(['season', 'striker'])['runs_off_bat'].sum().reset_index(name='total_runs')
    
    dismissals = df[(df['player_dismissed'] == df['striker']) & (~df['wicket_type'].isin(['retired hurt', 'None', 'Not Out']))]
    bat_outs = dismissals.groupby(['season', 'player_dismissed']).size().reset_index(name='times_out')
    
    bat_df = pd.merge(bat_runs, bat_balls, on=['season', 'striker'])
    bat_df = pd.merge(bat_df, bat_outs, left_on=['season', 'striker'], right_on=['season', 'player_dismissed'], how='left').fillna(0)
    bat_df.rename(columns={'striker': 'player_name'}, inplace=True)
    
    # Raw Metrics
    bat_df['raw_avg'] = np.where(bat_df['times_out'] > 0, bat_df['total_runs'] / bat_df['times_out'], bat_df['total_runs'])
    bat_df['raw_sr'] = np.where(bat_df['balls_faced'] > 0, (bat_df['total_runs'] / bat_df['balls_faced']) * 100, 0)
    
    # Bayesian Shrinkage Parameters
    m_bat = 60.0 # Prior weight (approx 10 overs faced)
    league_avg_bat = bat_df[bat_df['balls_faced'] > 120]['raw_avg'].mean()
    league_sr_bat = bat_df[bat_df['balls_faced'] > 120]['raw_sr'].mean()
    
    # Apply Shrinkage Estimator
    n_bat = bat_df['balls_faced']
    bat_df['adj_avg'] = (n_bat / (n_bat + m_bat)) * bat_df['raw_avg'] + (m_bat / (n_bat + m_bat)) * league_avg_bat
    bat_df['adj_sr'] = (n_bat / (n_bat + m_bat)) * bat_df['raw_sr'] + (m_bat / (n_bat + m_bat)) * league_sr_bat
    
    # Batting Impact
    bat_df['bat_impact'] = (bat_df['adj_avg'] * 1.5) + (bat_df['adj_sr'] * 0.8)

    # ---------------------------------------------
    # 2. BOWLING AGGREGATION & BAYESIAN SHRINKAGE
    # ---------------------------------------------
    print("Computing Bayesian Bowling Metrics...")
    bowl_balls = df[df['wides'] == 0].groupby(['season', 'bowler']).size().reset_index(name='balls_bowled')
    df['runs_conceded'] = df['runs_off_bat'] + df['wides'] + df['noballs']
    bowl_runs = df.groupby(['season', 'bowler'])['runs_conceded'].sum().reset_index(name='runs_given')
    
    bowler_wickets = df[(df['is_wicket'] == 1) & (~df['wicket_type'].isin(['run out', 'retired hurt', 'retired out', 'obstructing the field']))]
    bowl_wicks = bowler_wickets.groupby(['season', 'bowler']).size().reset_index(name='wickets')
    
    bowl_df = pd.merge(bowl_balls, bowl_runs, on=['season', 'bowler'])
    bowl_df = pd.merge(bowl_df, bowl_wicks, on=['season', 'bowler'], how='left').fillna(0)
    bowl_df.rename(columns={'bowler': 'player_name'}, inplace=True)
    
    bowl_df['overs'] = bowl_df['balls_bowled'] / 6.0
    bowl_df['raw_econ'] = np.where(bowl_df['overs'] > 0, bowl_df['runs_given'] / bowl_df['overs'], 12.0)
    
    # Bayesian Shrinkage Parameters
    m_bowl = 120.0 # Prior weight (approx 20 overs bowled)
    league_econ = bowl_df[bowl_df['balls_bowled'] > 120]['raw_econ'].mean()
    league_wkts = bowl_df[bowl_df['balls_bowled'] > 120]['wickets'].mean()
    
    # Apply Shrinkage
    n_bowl = bowl_df['balls_bowled']
    bowl_df['adj_econ'] = (n_bowl / (n_bowl + m_bowl)) * bowl_df['raw_econ'] + (m_bowl / (n_bowl + m_bowl)) * league_econ
    bowl_df['adj_wkts'] = (n_bowl / (n_bowl + m_bowl)) * bowl_df['wickets'] + (m_bowl / (n_bowl + m_bowl)) * league_wkts
    
    # Bowling Impact (Reversing economy so lower is better)
    eco_score = np.maximum(0, 125 - (bowl_df['adj_econ'] * 10))
    wkt_score = bowl_df['adj_wkts'] * 3.5
    bowl_df['bowl_impact'] = eco_score + wkt_score

    # ---------------------------------------------
    # 3. MERGE, DYNAMIC ROLE WEIGHTING, & PERCENTILE SCALING
    # ---------------------------------------------
    print("Applying Percentile Normalization (60-90 Scale) and Dynamic Role Weights...")
    merged = pd.merge(bat_df, bowl_df, on=['season', 'player_name'], how='outer').fillna(0)
    
    # Extract Team Name
    teams_bat = df.groupby(['season', 'striker'])['batting_team'].first().reset_index().rename(columns={'striker': 'player_name', 'batting_team': 'team'})
    teams_bowl = df.groupby(['season', 'bowler'])['bowling_team'].first().reset_index().rename(columns={'bowler': 'player_name', 'bowling_team': 'team'})
    teams = pd.concat([teams_bat, teams_bowl]).drop_duplicates(subset=['season', 'player_name'], keep='first')
    merged = pd.merge(merged, teams, on=['season', 'player_name'], how='left')
    
    # Filter absolute non-participants
    merged = merged[(merged['balls_faced'] > 0) | (merged['balls_bowled'] > 0)].copy()

    # Percentile Normalization: Maps the 0.0 - 1.0 percentile rank strictly to a 60 - 90 scale
    merged['B_score'] = 60 + (merged['bat_impact'].rank(pct=True) * 30)
    merged['Bo_score'] = 60 + (merged['bowl_impact'].rank(pct=True) * 30)
    
    # Dynamic Role Weighting
    k = 1.5 # Scaling constant for bowling frequency
    total_involvement = merged['balls_faced'] + (merged['balls_bowled'] * k)
    
    merged['w_bat'] = merged['balls_faced'] / total_involvement
    merged['w_bowl'] = (merged['balls_bowled'] * k) / total_involvement
    
    # Final OVR Calculation
    merged['OVR'] = (merged['w_bat'] * merged['B_score']) + (merged['w_bowl'] * merged['Bo_score'])
    
    # Ensure OVR remains inside the 60-90 bounds
    merged['OVR'] = np.clip(merged['OVR'], 60, 90).round().astype(int)

    final_pool = []
    for _, row in merged.iterrows():
        # Clean up roles for UI presentation based on weights
        if row['w_bat'] > 0.3 and row['w_bowl'] > 0.3: role = 'All-Rounder'
        elif row['w_bowl'] > 0.6: role = 'Bowler'
        else: role = 'Batter'
            
        final_pool.append({
            "name": row['player_name'],
            "season": str(row['season']),
            "team": row['team'],
            "role": role,
            "ovr": int(row['OVR']),
            "stats": {
                "runs": int(row['total_runs']),
                "avg": round(row['raw_avg'], 2),
                "sr": round(row['raw_sr'], 2),
                "wickets": int(row['wickets']),
                "econ": round(row['raw_econ'], 2)
            }
        })
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(final_pool, f, indent=4)
        
    print(f"✅ Success! Percentile-ranked, Bayesian JSON (60-90 Scale) saved to {output_path}")

if __name__ == "__main__":
    generate_bayesian_ratings()
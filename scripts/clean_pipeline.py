import pandas as pd
import numpy as np
import os

def clean_ipl_data():
    # Get the absolute path of the directory where clean_pipeline.py lives
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Dynamically build paths relative to this script's location
    input_path = os.path.join(script_dir, '..', 'data', 'raw', 'all_matches.csv')
    output_path = os.path.join(script_dir, '..', 'data', 'processed', 'cleaned_ball_by_ball.csv')
    
    
    
    print(f"Loading raw dataset from {input_path}...")
    try:
        df = pd.read_csv(input_path, low_memory=False)
    except FileNotFoundError:
        print(f"Error: Could not find {input_path}. Please check your directory structure.")
        return

    # --- 1. Entity Resolution: Teams ---
    print("Standardizing franchise names...")
    team_mapping = {
        'Delhi Daredevils': 'Delhi Capitals',
        'Kings XI Punjab': 'Punjab Kings',
        'Deccan Chargers': 'Sunrisers Hyderabad', # Merging historical Hyderabad franchises
        'Royal Challengers Bangalore': 'Royal Challengers Bengaluru',
        'Pune Warriors': 'Pune Warriors India',
        'Rising Pune Supergiant': 'Rising Pune Supergiants' # Fixing singular/plural typo
    }
    df['batting_team'] = df['batting_team'].replace(team_mapping)
    df['bowling_team'] = df['bowling_team'].replace(team_mapping)

    # --- 2. Entity Resolution: Venues ---
    print("Standardizing stadium names...")
    venue_mapping = {
        'Arun Jaitley Stadium, Delhi': 'Arun Jaitley Stadium',
        'Feroz Shah Kotla': 'Arun Jaitley Stadium',
        'Brabourne Stadium, Mumbai': 'Brabourne Stadium',
        'Dr DY Patil Sports Academy, Mumbai': 'Dr DY Patil Sports Academy',
        'Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium, Visakhapatnam': 'Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium',
        'Eden Gardens, Kolkata': 'Eden Gardens',
        'Himachal Pradesh Cricket Association Stadium, Dharamsala': 'Himachal Pradesh Cricket Association Stadium',
        'M Chinnaswamy Stadium, Bengaluru': 'M Chinnaswamy Stadium',
        'M.Chinnaswamy Stadium': 'M Chinnaswamy Stadium',
        'MA Chidambaram Stadium, Chepauk': 'MA Chidambaram Stadium',
        'MA Chidambaram Stadium, Chepauk, Chennai': 'MA Chidambaram Stadium',
        'Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur': 'Maharaja Yadavindra Singh International Cricket Stadium',
        'Maharaja Yadavindra Singh International Cricket Stadium, New Chandigarh': 'Maharaja Yadavindra Singh International Cricket Stadium',
        'Maharashtra Cricket Association Stadium, Pune': 'Maharashtra Cricket Association Stadium',
        'Subrata Roy Sahara Stadium': 'Maharashtra Cricket Association Stadium',
        'Sardar Patel Stadium, Motera': 'Narendra Modi Stadium',
        'Narendra Modi Stadium, Ahmedabad': 'Narendra Modi Stadium',
        'Punjab Cricket Association IS Bindra Stadium, Mohali': 'Punjab Cricket Association Stadium',
        'Punjab Cricket Association IS Bindra Stadium, Mohali, Chandigarh': 'Punjab Cricket Association Stadium',
        'Punjab Cricket Association IS Bindra Stadium': 'Punjab Cricket Association Stadium',
        'Punjab Cricket Association Stadium, Mohali': 'Punjab Cricket Association Stadium',
        'Rajiv Gandhi International Stadium, Uppal': 'Rajiv Gandhi International Stadium',
        'Rajiv Gandhi International Stadium, Uppal, Hyderabad': 'Rajiv Gandhi International Stadium',
        'Sawai Mansingh Stadium, Jaipur': 'Sawai Mansingh Stadium',
        'Shaheed Veer Narayan Singh International Stadium, Raipur': 'Shaheed Veer Narayan Singh International Stadium',
        'Wankhede Stadium, Mumbai': 'Wankhede Stadium',
        'Zayed Cricket Stadium, Abu Dhabi': 'Sheikh Zayed Stadium'
    }
    df['venue'] = df['venue'].replace(venue_mapping)

    # --- 3. Handling Nulls ---
    print("Cleaning missing values...")
    df['wicket_type'] = df['wicket_type'].fillna('Not Out')
    df['player_dismissed'] = df['player_dismissed'].fillna('None')

    extras_cols = ['wides', 'noballs', 'byes', 'legbyes', 'penalty']
    for col in extras_cols:
        if col in df.columns:
            df[col] = df[col].fillna(0)

    # --- 4. Feature Engineering ---
    print("Engineering simulation triggers...")
    
    # Extract the integer over number
    df['over'] = np.floor(df['ball']).astype(int)

    # Categorize phase of play
    def determine_phase(over):
        if over < 6: return 'Powerplay'
        elif over < 15: return 'Middle'
        else: return 'Death'
        
    df['phase_of_play'] = df['over'].apply(determine_phase)

    # Binary flags for the math engine
    df['is_wicket'] = np.where(df['wicket_type'] != 'Not Out', 1, 0)
    df['is_boundary'] = np.where(df['runs_off_bat'].isin([4, 6]), 1, 0)
    df['is_dot_ball'] = np.where(
        (df['runs_off_bat'] == 0) & (df['wides'] == 0) & (df['noballs'] == 0), 1, 0
    )

    # --- 5. Export ---
    # Ensure the processed directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"✅ Pipeline successful! Data saved to {output_path}")

if __name__ == "__main__":
    clean_ipl_data()
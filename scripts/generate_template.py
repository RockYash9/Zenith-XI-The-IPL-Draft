import pandas as pd
import json
import os

def generate_tagging_template():
    # Setup paths relative to the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, '..', 'data', 'processed', 'player_ratings_advanced.json')
    output_path = os.path.join(script_dir, '..', 'data', 'processed', 'manual_overseas_tagging.csv')
    
    print("Loading player database...")
    try:
        with open(input_path, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find {input_path}")
        return
        
    # Convert JSON to a Pandas DataFrame
    df = pd.DataFrame(data)
    
    # Extract only the necessary columns
    template_df = df[['season', 'team', 'name']].copy()
    
    # Add the blank column for manual entry
    template_df['Overseas (Y/N)'] = ""
    
    # Sort exactly as requested: Season -> Team -> Player Name
    template_df.sort_values(by=['season', 'team', 'name'], inplace=True)
    
    # Export to CSV
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    template_df.to_csv(output_path, index=False)
    
    print(f"✅ Template generated successfully!")
    print(f"File saved to: {output_path}")
    print(f"Total rows ready for manual tagging: {len(template_df)}")

if __name__ == "__main__":
    generate_tagging_template()
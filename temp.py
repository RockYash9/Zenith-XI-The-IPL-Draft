import pandas as pd

print("Loading full dataset to extract unique entities...")
# We load the whole file this time to ensure we catch every historical name
df = pd.read_csv('data/raw/all_matches.csv', low_memory=False)

print("\n--- Unique Franchises ---")
teams = sorted(df['batting_team'].dropna().unique().tolist())
for team in teams:
    print(f"- {team}")

print("\n--- Unique Venues ---")
venues = sorted(df['venue'].dropna().unique().tolist())
for venue in venues:
    print(f"- {venue}")
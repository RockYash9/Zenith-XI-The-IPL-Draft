import json
import os
import pandas as pd

def enrich_overseas_data():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, '..', 'data', 'processed', 'player_ratings_advanced.json')
    
    print("Loading player ratings...")
    try:
        with open(file_path, 'r') as f:
            players = json.load(f)
    except FileNotFoundError:
        print("Error: Could not find player_ratings_advanced.json")
        return

    # The Exhaustive Dictionary of all 240 unique overseas players in this dataset
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

    print("Tagging players...")
    overseas_count = 0
    indian_count = 0

    # Inject the tag into the main game JSON database
    for player in players:
        if player['name'] in OVERSEAS_PLAYERS:
            player['is_overseas'] = True
            overseas_count += 1
        else:
            player['is_overseas'] = False
            indian_count += 1

    with open(file_path, 'w') as f:
        json.dump(players, f, indent=4)
        
    print(f"✅ Success!")
    print(f"Tagged {overseas_count} Overseas player seasons and {indian_count} Indian player seasons.")

if __name__ == "__main__":
    enrich_overseas_data()
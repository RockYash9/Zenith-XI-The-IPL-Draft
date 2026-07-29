<div align="center">

# Zenith XI: The IPL Draft Simulator

[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38Bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Python](https://img.shields.io/badge/Data%20Pipeline-Python-3776AB?style=for-the-badge&logo=python)](https://www.python.org/)

<p>An elite IPL drafting and tournament simulation game powered by advanced probabilistic modeling, Bayesian normalization, and a real-time T20 match engine.</p>
</div>

---

## Overview

**Zenith XI** is a high-performance web-based cricket strategy and simulation application. Players act as franchise architects, drafting an ultimate playing XI by spinning archives of real historical IPL squads spanning from 2008 to 2026. Once the squad is locked, your custom XI competes in a full 20-match double round-robin 2026 IPL season against 10 CPU franchises, followed by the rigorous Page Playoff system.

---

## Key Features

*   **Archives Roulette Spin:** Dynamic easing-out deceleration animation drawing real historical team-season combinations.
*   **Intelligent Role-Mapping & Slot Assignment:** Automated player classification (Openers, Middle Order, Wicketkeepers, All-Rounders, Pace/Spin Bowlers) with strict squad constraints (max 4 overseas players, duplicate prevention).
*   **Match-by-Match Simulation Hub:** Control your Zenith XI fixture schedule round-by-round while CPU vs CPU matches auto-simulate seamlessly in the background.
*   **Real-Time Points Table:** Live standings update instantly after every match with cumulative Net Run Rate (NRR) tracking and head-to-head tie-breakers.
*   **Interactive Page Playoffs:** Match-by-match postseason simulation (Qualifier 1, Eliminator, Qualifier 2, and Grand Final).
*   **Comprehensive Tournament Summary:** Detailed post-season breakdown featuring league position, squad rating, Orange/Purple caps (team and league-wide), and final franchise grade.

---

## Tech Stack

*   **Frontend:** React (Vite), JavaScript (ES6+), Tailwind CSS
*   **Icons & UI Assets:** Lucide React, Custom CSS custom-scrollbar styling
*   **Data Science & Analytics Pipeline:** Python (Pandas, NumPy) for historical ball-by-ball processing

---

## Architecture & Mathematical Modeling

Zenith XI moves away from simplistic win-probability lookup tables by utilizing a robust **Probabilistic Score-Generation Engine** grounded in statistical distribution theory.

### 1. Data Normalization & Ratings Pipeline
Historical ball-by-ball IPL match data (2008–2026) is processed using **Bayesian shrinkage** and **Beta distribution mapping** to normalize player performances across different eras, strike rates, and economy benchmarks into cohesive Overall Ratings ($\text{OVR}$) and role classifications.

### 2. Team Power Indices
Before each match, the engine evaluates both XIs to construct comparative power indices:
*   **Batting Index:** Weighted average OVR of batting positions 1–7, with top-order positions weighted heavier since they face a higher proportion of deliveries:

$$\text{BattingIndex} = \frac{\sum_{i=1}^{7} w_i \cdot \text{OVR}_i}{\sum_{i=1}^{7} w_i}$$

*   **Bowling Index:** Arithmetic mean OVR of specialist bowlers (slots 8–11).
*   **Team OVR:** Overall arithmetic mean across all 11 drafted players.

### 3. Probabilistic Score Generation (T20 Engine)
To replicate cricket's inherent volatility—where a superior team can experience an upset on an off-day—innings scores are generated using a **Gaussian Normal Distribution with Variance** via the Box-Muller transform:

$$\text{ExpectedScore}_A = \text{ParScore} + \alpha \cdot (\text{BattingIndex}_A - \text{BowlingIndex}_B)$$

$$\text{ActualScore}_A = \text{clip}\left(\mathcal{N}(\text{ExpectedScore}_A, \, \sigma \cdot \text{ExpectedScore}_A), \, 60, \, 260\right)$$

*   **Par Score:** $165$ (League standard T20 baseline)
*   **Alpha ($\alpha$):** $0.9$ (Runs per OVR-point gap)
*   **Sigma ($\sigma$):** $0.19$ (Gaussian standard deviation coefficient)
*   **Hard Clamping:** Scores are strictly bounded between $60$ and $260$ runs to prevent mathematical anomalies.

### 4. Cumulative Net Run Rate (NRR)
To avoid averaging bugs, NRR is computed cumulatively across the entire season from raw aggregate totals rather than per-match ratios:

$$\text{NRR} = \left( \frac{\sum \text{Runs Scored}}{\sum \text{Overs Faced}} \right) - \left( \frac{\sum \text{Runs Conceded}}{\sum \text{Overs Bowled}} \right)$$

---

## Project Structure

```text
Zenith-XI-The-IPL-Draft/
├── client/
│   ├── public/
│   │   └── data/
│   │       └── player_ratings_advanced.json  # Processed player database
│   ├── src/
│   │   ├── App.jsx                           # Core game logic, roulette, and simulation hub
│   │   ├── main.jsx                          # React mount entry
│   │   └── index.css                         # Tailwind CSS configurations
│   ├── package.json
│   └── vite.config.js
└── README.md

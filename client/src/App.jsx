import React, { useState, useEffect } from 'react';
import { Dices, Plane, Users, ChevronRight, Ban, CheckCircle2, Trophy, Play, RotateCcw, Shield, FastForward } from 'lucide-react';

const INITIAL_LINEUP = [
  { id: 1, label: "Opener", type: "BAT", player: null },
  { id: 2, label: "Opener", type: "BAT", player: null },
  { id: 3, label: "No. 3", type: "BAT", player: null },
  { id: 4, label: "Middle Order", type: "BAT", player: null },
  { id: 5, label: "Middle Order", type: "BAT", player: null },
  { id: 6, label: "Wicketkeeper", type: "WK", player: null },
  { id: 7, label: "All-Rounder", type: "AR", player: null },
  { id: 8, label: "All-Rounder", type: "FLEX_BOWL", player: null },
  { id: 9, label: "Pace/Spin", type: "BOWL", player: null },
  { id: 10, label: "Pace/Spin", type: "BOWL", player: null },
  { id: 11, label: "Bowler", type: "BOWL", player: null },
];

const KNOWN_WICKETKEEPERS = [
  "MS Dhoni", "KD Karthik", "WP Saha", "RR Pant", "Q de Kock",
  "JC Buttler", "KL Rahul", "Ishan Kishan", "SV Samson", "JM Bairstow",
  "N Pooran", "H Klaasen", "PA Patel", "RV Uthappa", "NV Ojha",
  "AT Rayudu", "SW Billings", "KS Bharat", "Jitesh Sharma", "PD Salt"
];

const CPU_FRANCHISES = [
  { name: "Mumbai Indians", batIndex: 82, bowlIndex: 80, ovr: 81 },
  { name: "Chennai Super Kings", batIndex: 80, bowlIndex: 82, ovr: 81 },
  { name: "Royal Challengers Bengaluru", batIndex: 84, bowlIndex: 77, ovr: 80 },
  { name: "Kolkata Knight Riders", batIndex: 81, bowlIndex: 81, ovr: 81 },
  { name: "Delhi Capitals", batIndex: 79, bowlIndex: 78, ovr: 78 },
  { name: "Sunrisers Hyderabad", batIndex: 85, bowlIndex: 75, ovr: 80 },
  { name: "Punjab Kings", batIndex: 78, bowlIndex: 78, ovr: 78 },
  { name: "Rajasthan Royals", batIndex: 81, bowlIndex: 80, ovr: 80 },
  { name: "Lucknow Super Giants", batIndex: 80, bowlIndex: 79, ovr: 79 },
  { name: "Gujarat Titans", batIndex: 79, bowlIndex: 82, ovr: 80 },
];

function App() {
  const [allPlayers, setAllPlayers] = useState([]);
  const [teamSeasons, setTeamSeasons] = useState([]);
  
  const [lineup, setLineup] = useState(INITIAL_LINEUP);
  const [spunContext, setSpunContext] = useState(null);
  const [currentRoster, setCurrentRoster] = useState([]);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [rollingDisplay, setRollingDisplay] = useState({ team: "---", season: "----" });

  // Simulation States
  const [viewMode, setViewMode] = useState('draft'); // 'draft', 'sim_hub'
  const [simulationState, setSimulationState] = useState(null);
  const [isAutoSimulating, setIsAutoSimulating] = useState(false);

  useEffect(() => {
    fetch('/data/player_ratings_advanced.json')
      .then(response => response.json())
      .then(data => {
        setAllPlayers(data);
        const combos = new Set();
        const uniqueTeamSeasons = [];
        data.forEach(player => {
          const comboKey = `${player.team}|${player.season}`;
          if (!combos.has(comboKey)) {
            combos.add(comboKey);
            uniqueTeamSeasons.push({ team: player.team, season: player.season });
          }
        });
        setTeamSeasons(uniqueTeamSeasons);
      })
      .catch(error => console.error("Error loading database:", error));
  }, []);

  const findAvailableSlot = (player) => {
    const pRole = (player.role || "").toLowerCase();
    const isBat = pRole.includes('bat');
    const isBowl = pRole.includes('bowl');
    const isAR = pRole.includes('all');
    const isWK = pRole.includes('wicket') || pRole.includes('wk') || KNOWN_WICKETKEEPERS.includes(player.name);

    if (isWK) {
        const wkSlot = lineup.findIndex(s => s.type === "WK" && !s.player);
        if (wkSlot !== -1) return wkSlot;
    }
    if (isAR) {
        const arSlot = lineup.findIndex(s => s.type === "AR" && !s.player);
        if (arSlot !== -1) return arSlot;
        const flexSlot = lineup.findIndex(s => s.type === "FLEX_BOWL" && !s.player);
        if (flexSlot !== -1) return flexSlot;
    }
    if (isBowl) {
        const bowlSlot = lineup.findIndex(s => s.type === "BOWL" && !s.player);
        if (bowlSlot !== -1) return bowlSlot;
        const flexSlot = lineup.findIndex(s => s.type === "FLEX_BOWL" && !s.player);
        if (flexSlot !== -1) return flexSlot;
    }
    if (isBat || isWK || isAR) {
        const batSlot = lineup.findIndex(s => s.type === "BAT" && !s.player);
        if (batSlot !== -1) return batSlot;
    }
    if (isBat) {
        const emergencyWkSlot = lineup.findIndex(s => s.type === "WK" && !s.player);
        if (emergencyWkSlot !== -1) return emergencyWkSlot;
    }
    return -1; 
  };

  const getDraftStatus = (player) => {
    const currentOverseas = lineup.filter(s => s.player?.is_overseas).length;
    if (player.is_overseas && currentOverseas >= 4) return { canDraft: false, reason: "Max 4 Overseas" };
    const isDuplicate = lineup.some(s => s.player?.name === player.name);
    if (isDuplicate) return { canDraft: false, reason: "In Squad" };
    const slotIndex = findAvailableSlot(player);
    if (slotIndex === -1) return { canDraft: false, reason: "No Slot" };
    return { canDraft: true, slotIndex, reason: "" };
  };

  const handleDraftPlayer = (player) => {
    const status = getDraftStatus(player);
    if (!status.canDraft) return;

    const newLineup = [...lineup];
    newLineup[status.slotIndex].player = player;
    setLineup(newLineup);
    
    setCurrentRoster([]);
    setSpunContext(null);
    setRollingDisplay({ team: "---", season: "----" });
  };

  const handleSpin = () => {
    if (teamSeasons.length === 0 || isSpinning) return;
    
    setIsSpinning(true);
    setCurrentRoster([]);
    setSpunContext(null);

    let currentDelay = 40; 
    let maxDelay = 350;    
    let steps = 0;
    const maxSteps = 18;   

    const rollStep = () => {
      const randomCombo = teamSeasons[Math.floor(Math.random() * teamSeasons.length)];
      setRollingDisplay(randomCombo);
      steps++;

      if (steps < maxSteps) {
        currentDelay = Math.min(maxDelay, currentDelay * 1.14);
        setTimeout(rollStep, currentDelay);
      } else {
        const finalCombo = teamSeasons[Math.floor(Math.random() * teamSeasons.length)];
        setRollingDisplay(finalCombo);
        setSpunContext(finalCombo);
        
        const roster = allPlayers.filter(p => p.team === finalCombo.team && p.season === finalCombo.season);
        setCurrentRoster(roster.sort((a, b) => b.ovr - a.ovr));
        setIsSpinning(false);
      }
    };

    rollStep();
  };

  // ---------------------------------------------------------
  // SIMULATION ENGINE
  // ---------------------------------------------------------
  const calculateUserTeamIndices = () => {
    const batWeights = [0.22, 0.18, 0.15, 0.13, 0.12, 0.10, 0.10];
    let batSum = 0;
    let batWeightTotal = 0;
    for (let i = 0; i < 7; i++) {
      if (lineup[i] && lineup[i].player) {
        batSum += lineup[i].player.ovr * batWeights[i];
        batWeightTotal += batWeights[i];
      }
    }
    const batIndex = batWeightTotal > 0 ? batSum / batWeightTotal : 75;

    let bowlSum = 0;
    let bowlCount = 0;
    for (let i = 7; i < 11; i++) {
      if (lineup[i] && lineup[i].player) {
        bowlSum += lineup[i].player.ovr;
        bowlCount++;
      }
    }
    const bowlIndex = bowlCount > 0 ? bowlSum / bowlCount : 75;
    const ovr = Math.round(lineup.reduce((acc, s) => acc + (s.player ? s.player.ovr : 75), 0) / 11);

    return { name: "Zenith XI", batIndex, bowlIndex, ovr };
  };

  const gaussianRandom = (mean, stdev) => {
    let u = 1 - Math.random();
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdev;
  };

  const simulateMatch = (teamA, teamB) => {
    const alpha = 0.9;
    const sigma = 0.19;
    const parScore = 165;

    const expA = parScore + alpha * (teamA.batIndex - teamB.bowlIndex);
    let scoreA = Math.round(gaussianRandom(expA, sigma * expA));
    scoreA = Math.max(60, Math.min(260, scoreA));

    const target = scoreA + 1;
    const expB = parScore + alpha * (teamB.batIndex - teamA.bowlIndex);
    let scoreB = Math.round(gaussianRandom(expB, sigma * expB));
    scoreB = Math.max(60, Math.min(260, scoreB));

    let winner, loser, marginText;
    let oversA = 20;
    let oversB = 20;

    if (scoreB === scoreA) {
      const tieBreakerRoll = gaussianRandom(0, 5);
      if (tieBreakerRoll >= 0) {
        scoreB += 1;
      } else {
        scoreA += 1;
      }
    }

    if (scoreB >= target) {
      winner = teamB;
      loser = teamA;
      let estOvers = 20 * (target / Math.max(target, scoreB));
      oversB = Math.max(5.0, Math.min(20.0, Number(estOvers.toFixed(1))));
      marginText = `${teamB.name} won by ${10 - Math.floor(Math.random() * 3)} wickets`;
    } else {
      winner = teamA;
      loser = teamB;
      const runMargin = target - 1 - scoreB;
      marginText = `${teamA.name} won by ${runMargin} runs`;
    }

    return {
      teamA: teamA.name,
      teamB: teamB.name,
      scoreA,
      scoreB,
      oversA: 20,
      oversB: winner === teamB ? oversB : 20,
      winner: winner.name,
      marginText
    };
  };

  const generateSchedule = (allTeams) => {
    let fixtures = [];
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < allTeams.length; i++) {
        for (let j = i + 1; j < allTeams.length; j++) {
          const t1 = round === 0 ? allTeams[i] : allTeams[j];
          const t2 = round === 0 ? allTeams[j] : allTeams[i];
          const isUserMatch = t1.name === "Zenith XI" || t2.name === "Zenith XI";
          fixtures.push({
            id: fixtures.length + 1,
            teamA: t1,
            teamB: t2,
            isUserMatch,
            played: false,
            result: null
          });
        }
      }
    }
    return fixtures;
  };

  const startSimulation = () => {
    const userTeam = calculateUserTeamIndices();
    const allTeams = [userTeam, ...CPU_FRANCHISES];
    const schedule = generateSchedule(allTeams);

    const standings = {};
    allTeams.forEach(t => {
      standings[t.name] = {
        name: t.name,
        played: 0,
        won: 0,
        lost: 0,
        points: 0,
        runsFor: 0,
        oversFaced: 0,
        runsAgainst: 0,
        oversBowled: 0,
        headToHead: {}
      };
    });

    setSimulationState({
      teams: allTeams,
      schedule,
      standings,
      playoffStage: 'league', 
      playoffMatches: []
    });
    setViewMode('sim_hub');
    setIsAutoSimulating(true);
  };

  const updateStandingsWithResult = (standings, res) => {
    const stA = standings[res.teamA];
    const stB = standings[res.teamB];

    stA.played += 1;
    stB.played += 1;

    stA.runsFor += res.scoreA;
    stA.oversFaced += res.oversA;
    stA.runsAgainst += res.scoreB;
    stA.oversBowled += res.oversB;

    stB.runsFor += res.scoreB;
    stB.oversFaced += res.oversB;
    stB.runsAgainst += res.scoreA;
    stB.oversBowled += res.oversA;

    if (res.winner === res.teamA) {
      stA.won += 1;
      stA.points += 2;
      stB.lost += 1;
      stA.headToHead[res.teamB] = (stA.headToHead[res.teamB] || 0) + 1;
    } else {
      stB.won += 1;
      stB.points += 2;
      stA.lost += 1;
      stB.headToHead[res.teamA] = (stB.headToHead[res.teamA] || 0) + 1;
    }
  };

  // Automated Match Stepper
  useEffect(() => {
    if (!simulationState || !isAutoSimulating || simulationState.playoffStage !== 'league') return;

    let { schedule, standings, teams } = simulationState;
    const nextUserMatchIndex = schedule.findIndex(f => f.isUserMatch && !f.played);

    if (nextUserMatchIndex === -1) {
      setIsAutoSimulating(false);
      const updatedSchedule = [...schedule];
      const updatedStandings = JSON.parse(JSON.stringify(standings));
      updatedSchedule.forEach(fixture => {
        if (!fixture.played) {
          const teamObjA = teams.find(t => t.name === fixture.teamA.name);
          const teamObjB = teams.find(t => t.name === fixture.teamB.name);
          const res = simulateMatch(teamObjA, teamObjB);
          fixture.played = true;
          fixture.result = res;
          updateStandingsWithResult(updatedStandings, res);
        }
      });
      const playoffMatches = setupPlayoffs(updatedStandings, teams);
      setSimulationState({
        ...simulationState,
        schedule: updatedSchedule,
        standings: updatedStandings,
        playoffStage: 'playoffs',
        playoffMatches
      });
      return;
    }

    const timer = setTimeout(() => {
      const updatedSchedule = [...schedule];
      const updatedStandings = JSON.parse(JSON.stringify(standings));

      for (let i = 0; i <= nextUserMatchIndex; i++) {
        const fixture = updatedSchedule[i];
        if (!fixture.played) {
          const teamObjA = teams.find(t => t.name === fixture.teamA.name);
          const teamObjB = teams.find(t => t.name === fixture.teamB.name);
          const res = simulateMatch(teamObjA, teamObjB);
          fixture.played = true;
          fixture.result = res;
          updateStandingsWithResult(updatedStandings, res);
        }
      }

      setSimulationState({
        ...simulationState,
        schedule: updatedSchedule,
        standings: updatedStandings
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [simulationState, isAutoSimulating]);

  const skipToResult = () => {
    if (!simulationState || simulationState.playoffStage !== 'league') return;
    setIsAutoSimulating(false);

    let { schedule, standings, teams } = simulationState;
    const updatedSchedule = [...schedule];
    const updatedStandings = JSON.parse(JSON.stringify(standings));

    updatedSchedule.forEach(fixture => {
      if (!fixture.played) {
        const teamObjA = teams.find(t => t.name === fixture.teamA.name);
        const teamObjB = teams.find(t => t.name === fixture.teamB.name);
        const res = simulateMatch(teamObjA, teamObjB);
        fixture.played = true;
        fixture.result = res;
        updateStandingsWithResult(updatedStandings, res);
      }
    });

    const playoffMatches = setupPlayoffs(updatedStandings, teams);
    setSimulationState({
      ...simulationState,
      schedule: updatedSchedule,
      standings: updatedStandings,
      playoffStage: 'playoffs',
      playoffMatches
    });
  };

  const getSortedStandings = (standingsObj) => {
    const list = Object.values(standingsObj).map(st => {
      const nrrFor = st.oversFaced > 0 ? st.runsFor / st.oversFaced : 0;
      const nrrAgainst = st.oversBowled > 0 ? st.runsAgainst / st.oversBowled : 0;
      const nrr = Number((nrrFor - nrrAgainst).toFixed(3));
      return { ...st, nrr };
    });

    return list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.nrr !== a.nrr) return b.nrr - a.nrr;
      const aWinsAgainstB = a.headToHead[b.name] || 0;
      const bWinsAgainstA = b.headToHead[a.name] || 0;
      if (aWinsAgainstB !== bWinsAgainstA) return bWinsAgainstA - aWinsAgainstB;
      return a.name.localeCompare(b.name);
    });
  };

  const setupPlayoffs = (standingsObj, teams) => {
    const sorted = getSortedStandings(standingsObj);
    const t1 = teams.find(t => t.name === sorted[0].name);
    const t2 = teams.find(t => t.name === sorted[1].name);
    const t3 = teams.find(t => t.name === sorted[2].name);
    const t4 = teams.find(t => t.name === sorted[3].name);

    return [
      { id: 'q1', name: 'Qualifier 1 (1st vs 2nd)', teamA: t1, teamB: t2, played: false, result: null },
      { id: 'elim', name: 'Eliminator (3rd vs 4th)', teamA: t3, teamB: t4, played: false, result: null },
      { id: 'q2', name: 'Qualifier 2 (Loser Q1 vs Winner Elim)', teamA: null, teamB: null, played: false, result: null },
      { id: 'final', name: 'Grand Final', teamA: null, teamB: null, played: false, result: null }
    ];
  };

  const teamsObj = (name, teamsList) => teamsList.find(t => t.name === name);

  const simulatePlayoffs = () => {
    let matches = [...simulationState.playoffMatches];
    
    matches[0].played = true;
    matches[0].result = simulateMatch(matches[0].teamA, matches[0].teamB);
    matches[1].played = true;
    matches[1].result = simulateMatch(matches[1].teamA, matches[1].teamB);

    const q1Loser = matches[0].result.winner === matches[0].teamA.name ? matches[0].teamB : matches[0].teamA;
    const elimWinner = teamsObj(matches[1].result.winner, simulationState.teams);
    matches[2].teamA = q1Loser;
    matches[2].teamB = elimWinner;
    matches[2].played = true;
    matches[2].result = simulateMatch(q1Loser, elimWinner);

    const q1Winner = teamsObj(matches[0].result.winner, simulationState.teams);
    const q2Winner = teamsObj(matches[2].result.winner, simulationState.teams);
    matches[3].teamA = q1Winner;
    matches[3].teamB = q2Winner;
    matches[3].played = true;
    matches[3].result = simulateMatch(q1Winner, q2Winner);

    setSimulationState({
      ...simulationState,
      playoffMatches: matches,
      playoffStage: 'completed'
    });
  };

  const draftedPlayersCount = lineup.filter(s => s.player !== null).length;
  const overseasCount = lineup.filter(s => s.player?.is_overseas).length;
  const isDraftComplete = draftedPlayersCount === 11;

  if (viewMode === 'sim_hub' && simulationState) {
    const sortedStandings = getSortedStandings(simulationState.standings);
    const userFixtures = simulationState.schedule.filter(f => f.isUserMatch);
    const playedUserMatches = userFixtures.filter(f => f.played);
    const userWins = playedUserMatches.filter(f => f.result.winner === "Zenith XI").length;
    const userLosses = playedUserMatches.length - userWins;
    const userPoints = userWins * 2;
    const leagueFinished = simulationState.playoffStage !== 'league';

    return (
      <div className="min-h-screen bg-[#07090E] text-slate-200 font-sans flex flex-col items-center py-10 px-4 selection:bg-red-500/30">
        <div className="w-full max-w-6xl flex flex-col gap-6">
          
          {/* Header */}
          <header className="flex justify-between items-end border-b-2 border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">
                ZENITH<span className="text-red-500">XI</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mt-0.5">Build The Ultimate IPL XI</p>
            </div>
            {!leagueFinished && (
              <button 
                onClick={skipToResult}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs uppercase px-4 py-2 rounded-lg border border-slate-700 transition-all flex items-center gap-1.5 shadow-md"
              >
                <FastForward size={14} /> Skip to Result →
              </button>
            )}
          </header>

          {/* Season Record Header Card */}
          <div className="bg-[#0F131D] border border-slate-800/80 rounded-2xl p-6 text-center shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
            <p className="text-[10px] font-black tracking-widest uppercase text-slate-500 mb-1">Season in Progress</p>
            <h2 className="text-4xl font-black text-white font-mono tracking-wider mb-2">
              {userWins}-{userLosses}-0
            </h2>
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest">
              W - L - T · {userPoints} PTS
            </p>
          </div>

          {/* SIDE-BY-SIDE TWO COLUMN LAYOUT: Fixtures Log (Left) & Real-Time Points Table (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* Left Column: Zenith XI Fixture Log */}
            <div className="bg-[#0F131D] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl flex flex-col">
              <div className="p-4 border-b border-slate-800 bg-[#131825] flex justify-between items-center">
                <h2 className="text-sm font-black uppercase tracking-tight text-white">Zenith XI Fixture Log</h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{playedUserMatches.length} / 20 Played</span>
              </div>
              <div className="flex flex-col max-h-[500px] overflow-y-auto custom-scrollbar">
                {userFixtures.map((f, idx) => {
                  const isPlayed = f.played;
                  const isUserWin = isPlayed && f.result.winner === "Zenith XI";
                  const opponentName = f.teamA.name === "Zenith XI" ? f.teamB.name : f.teamA.name;
                  const scoreDisplay = f.result ? (f.result.teamA === "Zenith XI" ? `${f.result.scoreA} / ${f.result.scoreB}` : `${f.result.scoreB} / ${f.result.scoreA}`) : "--- / ---";

                  return (
                    <div key={idx} className={`flex items-center justify-between p-3.5 border-b border-slate-800/50 transition-colors ${isPlayed ? 'bg-[#0F131D]' : 'bg-[#07090E]/60 opacity-40'}`}>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-black text-slate-500 w-4">#{idx + 1}</span>
                        <span className="font-bold text-xs text-white truncate max-w-[130px]">vs {opponentName}</span>
                      </div>

                      <div className="font-mono text-xs font-bold text-slate-400">
                        {isPlayed ? scoreDisplay : "Pending"}
                      </div>

                      <div>
                        {isPlayed ? (
                          <span className={`px-2.5 py-0.5 rounded font-black text-[10px] uppercase tracking-wider ${isUserWin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                            {isUserWin ? 'W' : 'L'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-medium italic">Upcoming</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Real-Time Points Table */}
            <div className="bg-[#0F131D] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl flex flex-col">
              <div className="p-4 border-b border-slate-800 bg-[#131825] flex justify-between items-center">
                <h2 className="text-sm font-black uppercase tracking-tight text-white">Live Points Table</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Real-Time</span>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-[#07090E] sticky top-0 z-10">
                      <th className="p-3">Pos</th>
                      <th className="p-3">Team</th>
                      <th className="p-3 text-center">P</th>
                      <th className="p-3 text-center">W</th>
                      <th className="p-3 text-center">L</th>
                      <th className="p-3 text-center">NRR</th>
                      <th className="p-3 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStandings.map((team, idx) => {
                      const isUser = team.name === "Zenith XI";
                      return (
                        <tr key={team.name} className={`border-b border-slate-800/40 text-xs font-bold ${isUser ? 'bg-red-500/15 text-white font-black border-l-4 border-l-red-500' : 'text-slate-300'} hover:bg-[#131825] transition-colors`}>
                          <td className="p-3 font-black text-slate-500">{idx + 1}</td>
                          <td className="p-3 flex items-center gap-1.5 truncate max-w-[130px]">
                            <span className="truncate">{team.name}</span>
                            {isUser && <span className="text-[8px] bg-red-500 text-white font-black px-1 py-0.5 rounded uppercase">You</span>}
                          </td>
                          <td className="p-3 text-center">{team.played}</td>
                          <td className="p-3 text-center">{team.won}</td>
                          <td className="p-3 text-center">{team.lost}</td>
                          <td className={`p-3 text-center font-mono text-[11px] ${team.nrr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{team.nrr >= 0 ? `+${team.nrr}` : team.nrr}</td>
                          <td className="p-3 text-right font-black text-white">{team.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Playoff Trigger */}
          {leagueFinished && simulationState.playoffStage === 'playoffs' && (
            <div className="bg-[#0F131D] border border-red-500/30 rounded-2xl p-6 text-center shadow-xl flex flex-col items-center gap-4">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">League Concluded</h2>
              <p className="text-xs text-slate-400 font-medium">Click below to simulate all 4 playoff matches simultaneously.</p>
              <button 
                onClick={simulatePlayoffs}
                className="bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase px-8 py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] flex items-center gap-2"
              >
                <Trophy size={16} /> Simulate Playoffs (All 4 Matches)
              </button>
            </div>
          )}

          {/* Completed Playoffs Display */}
          {simulationState.playoffStage === 'completed' && (
            <div className="bg-[#0F131D] border border-red-500/30 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Trophy size={20} className="text-red-500" /> IPL 2026 Playoffs Result
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {simulationState.playoffMatches.map((m) => (
                  <div key={m.id} className="bg-[#07090E] border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-400">{m.name}</span>
                      <div className="flex justify-between items-center mt-2 text-sm font-bold">
                        <span className={m.result?.winner === m.teamA?.name ? 'text-white font-black' : 'text-slate-400'}>{m.teamA ? m.teamA.name : 'TBD'}</span>
                        <span className="text-xs text-slate-600 font-mono">VS</span>
                        <span className={m.result?.winner === m.teamB?.name ? 'text-white font-black' : 'text-slate-400'}>{m.teamB ? m.teamB.name : 'TBD'}</span>
                      </div>
                      {m.played && (
                        <p className="text-xs text-emerald-400 font-bold mt-2 text-center bg-emerald-500/10 py-1 rounded border border-emerald-500/20">{m.result.marginText}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-200 font-sans flex flex-col items-center py-10 px-4 selection:bg-red-500/30">
      
      <div className="w-full max-w-3xl flex flex-col gap-8">
        
        {/* Header Section */}
        <header className="flex justify-between items-end border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">
              ZENITH<span className="text-red-500">XI</span>
            </h1>
            <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mt-1">Build The Ultimate IPL XI</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-500 tracking-widest uppercase">Round</p>
            <p className="text-2xl font-black text-red-500">{draftedPlayersCount < 11 ? draftedPlayersCount + 1 : 11} <span className="text-slate-600">/ 11</span></p>
          </div>
        </header>

        {/* Spin Module Card */}
        {!isDraftComplete ? (
          <div className="bg-[#0F131D] border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60"></div>
            
            <div className="flex gap-4 mb-6">
              <div className="flex-grow bg-[#07090E] border border-slate-800/90 rounded-xl p-4 flex flex-col items-center justify-center shadow-inner">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Franchise</span>
                <span className="text-xl md:text-2xl font-black text-white text-center uppercase tracking-tight h-8 flex items-center">
                  {rollingDisplay.team}
                </span>
              </div>
              <div className="w-1/3 bg-[#07090E] border border-slate-800/90 rounded-xl p-4 flex flex-col items-center justify-center shadow-inner">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Season</span>
                <span className="text-xl md:text-2xl font-black text-red-400 font-mono h-8 flex items-center">
                  {rollingDisplay.season}
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleSpin}
              disabled={isSpinning || teamSeasons.length === 0}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xl uppercase py-5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(225,29,72,0.25)] border border-red-400/20"
            >
              {isSpinning ? "Rolling Archives..." : "Spin Archives"}
            </button>
            <p className="text-center text-xs text-slate-500 mt-4 font-medium">Spin to draw a franchise & season, then draft one player.</p>
          </div>
        ) : (
          <div className="bg-[#0F131D] border border-red-500/30 rounded-2xl p-8 shadow-[0_0_35px_rgba(239,68,68,0.1)] text-center flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <CheckCircle2 size={32} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight">Squad Locked</h2>
              <p className="text-slate-400 mt-2 font-medium">Your Zenith XI is ready. Proceed to the 2026 tournament simulation.</p>
            </div>
            <button 
              onClick={startSimulation}
              className="bg-red-600 hover:bg-red-500 text-white font-black text-lg px-8 py-4 rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(239,68,68,0.3)] flex items-center gap-2 mx-auto"
            >
              Start 2026 Simulation <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Dynamic Draft Roster */}
        {spunContext && !isSpinning && !isDraftComplete && (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-end px-2 mb-2">
              <h3 className="font-black text-lg uppercase tracking-tight text-white">{spunContext.team} '{spunContext.season.slice(-2)}</h3>
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Pick one player</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {currentRoster.map((player, idx) => {
                const status = getDraftStatus(player);
                const isLocked = !status.canDraft;
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => !isLocked && handleDraftPlayer(player)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isLocked 
                        ? 'bg-[#07090E]/50 border-slate-800/50 opacity-40 cursor-not-allowed' 
                        : 'bg-[#131A2B] border-slate-700/80 hover:border-red-500/60 hover:bg-[#182136] cursor-pointer shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#07090E] border border-slate-700 rounded-lg flex items-center justify-center">
                        <span className={`font-black text-lg ${
                          player.ovr >= 85 ? 'text-yellow-400' : 
                          player.ovr >= 75 ? 'text-slate-200' : 'text-orange-400'
                        }`}>
                          {player.ovr}
                        </span>
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="font-bold text-base text-white flex items-center gap-2">
                          {player.name}
                          {player.is_overseas && <Plane size={12} className="text-red-400" />}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{player.role}</span>
                      </div>
                    </div>

                    {isLocked ? (
                      <div className="bg-[#07090E] px-3 py-1 rounded-md border border-slate-800 flex items-center gap-1.5">
                        <Ban size={12} className="text-red-500" />
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{status.reason}</span>
                      </div>
                    ) : (
                      <div className="bg-[#07090E] px-3.5 py-1 rounded-md border border-red-500/30 hover:border-red-500 transition-colors">
                        <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">Draft</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Clean Lineup List */}
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl mt-4">
          
          <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#131825]">
            <h2 className="text-xl font-black uppercase tracking-tight text-white">Your XI</h2>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-widest ${overseasCount === 4 ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-[#07090E] border-slate-700 text-slate-400"}`}>
              <Plane size={12} />
              OVERSEAS <span className={overseasCount === 4 ? "text-red-400" : "text-white"}>{overseasCount}/4</span>
            </div>
          </div>
          
          <div className="flex flex-col">
            {lineup.map((slot, index) => (
              <div key={slot.id} className={`flex items-center p-4 hover:bg-[#131825] transition-colors ${index !== lineup.length - 1 ? 'border-b border-slate-800/40' : ''}`}>
                
                <div className="w-10 flex-shrink-0">
                  <span className="font-black text-slate-600">{slot.id}</span>
                </div>
                <div className="w-32 flex-shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">{slot.label}</span>
                </div>

                <div className="flex-grow flex items-center justify-between">
                  {slot.player ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">{slot.player.name}</span>
                        {slot.player.is_overseas && <Plane size={12} className="text-red-400" />}
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-extrabold text-slate-400 tracking-wider">
                          {slot.player.team} {slot.player.season.slice(-2)}
                        </span>

                        <span className={`font-black text-sm px-2.5 py-0.5 rounded bg-[#07090E] border border-slate-700 ${
                          slot.player.ovr >= 85 ? 'text-yellow-400' : 
                          slot.player.ovr >= 75 ? 'text-slate-200' : 'text-orange-400'
                        }`}>
                          {slot.player.ovr}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="font-medium text-sm text-slate-600 italic">
                      {isSpinning && !isDraftComplete ? "Spinning..." : "Open"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
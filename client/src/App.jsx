import React, { useState, useEffect } from 'react';
import { Dices, Plane, Users, ChevronRight, Ban, CheckCircle2 } from 'lucide-react';

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

function App() {
  const [allPlayers, setAllPlayers] = useState([]);
  const [teamSeasons, setTeamSeasons] = useState([]);
  
  const [lineup, setLineup] = useState(INITIAL_LINEUP);
  const [spunContext, setSpunContext] = useState(null);
  const [currentRoster, setCurrentRoster] = useState([]);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [rollingDisplay, setRollingDisplay] = useState({ team: "---", season: "----" });

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
    if (teamSeasons.length === 0) return;
    
    setIsSpinning(true);
    setCurrentRoster([]);
    setSpunContext(null);
    
    let rollInterval = setInterval(() => {
      const randomCombo = teamSeasons[Math.floor(Math.random() * teamSeasons.length)];
      setRollingDisplay(randomCombo);
    }, 60);

    setTimeout(() => {
      clearInterval(rollInterval);
      const finalCombo = teamSeasons[Math.floor(Math.random() * teamSeasons.length)];
      
      setRollingDisplay(finalCombo);
      setSpunContext(finalCombo);
      
      const roster = allPlayers.filter(p => p.team === finalCombo.team && p.season === finalCombo.season);
      setCurrentRoster(roster.sort((a, b) => b.ovr - a.ovr));
      setIsSpinning(false);
    }, 1500);
  };

  const draftedPlayersCount = lineup.filter(s => s.player !== null).length;
  const overseasCount = lineup.filter(s => s.player?.is_overseas).length;
  const isDraftComplete = draftedPlayersCount === 11;

  return (
    <div className="min-h-screen bg-[#060B14] text-slate-200 font-sans flex flex-col items-center py-10 px-4 selection:bg-lime-500/30">
      
      <div className="w-full max-w-3xl flex flex-col gap-8">
        
        {/* Header Section */}
        <header className="flex justify-between items-end border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">
              ZENITH<span className="text-lime-500">XI</span>
            </h1>
            <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mt-1">Build The Ultimate IPL XI</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-500 tracking-widest uppercase">Round</p>
            <p className="text-2xl font-black text-lime-500">{draftedPlayersCount < 11 ? draftedPlayersCount + 1 : 11} <span className="text-slate-600">/ 11</span></p>
          </div>
        </header>

        {/* Spin Module Card */}
        {!isDraftComplete ? (
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex gap-4 mb-6">
              <div className="flex-grow bg-[#060B14] border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Franchise</span>
                <span className="text-xl md:text-2xl font-black text-white text-center uppercase tracking-tight h-8 flex items-center">
                  {rollingDisplay.team}
                </span>
              </div>
              <div className="w-1/3 bg-[#060B14] border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Season</span>
                <span className="text-xl md:text-2xl font-black text-white font-mono h-8 flex items-center">
                  {rollingDisplay.season}
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleSpin}
              disabled={isSpinning || teamSeasons.length === 0}
              className="w-full bg-lime-500 hover:bg-lime-400 text-[#060B14] font-black text-xl uppercase py-5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:bg-slate-700 disabled:text-slate-500 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(132,204,22,0.2)]"
            >
              {isSpinning ? "Spinning..." : "Spin Archives"}
            </button>
            <p className="text-center text-xs text-slate-500 mt-4 font-medium">Spin to draw a franchise & season, then draft one player.</p>
          </div>
        ) : (
          <div className="bg-[#0F172A] border border-lime-500/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(132,204,22,0.1)] text-center flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-lime-500/10 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} className="text-lime-500" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight">Squad Locked</h2>
              <p className="text-slate-400 mt-2 font-medium">Your Zenith XI is ready. Proceed to the tournament simulation.</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-500 text-white font-black text-lg px-8 py-4 rounded-xl transition-all hover:scale-105 shadow-lg flex items-center gap-2">
              Start 2026 Simulation <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Dynamic Draft Roster (Only visible after spin) */}
        {spunContext && !isSpinning && !isDraftComplete && (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-end px-2 mb-2">
              <h3 className="font-black text-lg uppercase tracking-tight text-white">{spunContext.team} '{spunContext.season.slice(-2)}</h3>
              <span className="text-xs font-bold text-slate-500 uppercase">Pick one player</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {currentRoster.map((player, idx) => {
                const status = getDraftStatus(player);
                const isLocked = !status.canDraft;
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => !isLocked && handleDraftPlayer(player)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isLocked 
                        ? 'bg-[#060B14]/50 border-slate-800/50 opacity-40 cursor-not-allowed' 
                        : 'bg-[#18233E] border-slate-700 hover:border-lime-500/50 hover:bg-[#1E2B4D] cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Crisp OVR Box */}
                      <div className="w-10 h-10 bg-[#060B14] border border-slate-700 rounded-lg flex items-center justify-center">
                        <span className={`font-black text-lg ${
                          player.ovr >= 85 ? 'text-yellow-400' : 
                          player.ovr >= 75 ? 'text-slate-200' : 'text-orange-400'
                        }`}>
                          {player.ovr}
                        </span>
                      </div>
                      
                      {/* Name & Role */}
                      <div className="flex flex-col">
                        <span className="font-bold text-base text-white flex items-center gap-2">
                          {player.name}
                          {player.is_overseas && <Plane size={12} className="text-blue-400" />}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{player.role}</span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    {isLocked ? (
                      <div className="bg-[#060B14] px-3 py-1 rounded-md border border-slate-800 flex items-center gap-1.5">
                        <Ban size={12} className="text-red-500" />
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{status.reason}</span>
                      </div>
                    ) : (
                      <div className="bg-[#060B14] px-3 py-1 rounded-md border border-slate-700">
                        <span className="text-[10px] font-bold uppercase text-lime-500 tracking-wider">Draft</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Clean Lineup List */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-xl mt-4">
          
          <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#141E33]">
            <h2 className="text-xl font-black uppercase tracking-tight text-white">Your XI</h2>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-widest ${overseasCount === 4 ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-[#060B14] border-slate-700 text-slate-400"}`}>
              <Plane size={12} />
              OVERSEAS <span className={overseasCount === 4 ? "text-red-400" : "text-white"}>{overseasCount}/4</span>
            </div>
          </div>
          
          <div className="flex flex-col">
            {lineup.map((slot, index) => (
              <div key={slot.id} className={`flex items-center p-4 hover:bg-[#141E33] transition-colors ${index !== lineup.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
                
                {/* Fixed Width Slot Info */}
                <div className="w-10 flex-shrink-0">
                  <span className="font-black text-slate-600">{slot.id}</span>
                </div>
                <div className="w-32 flex-shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{slot.label}</span>
                </div>

                {/* Player Data */}
                <div className="flex-grow flex items-center justify-between">
                  {slot.player ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">{slot.player.name}</span>
                        {slot.player.is_overseas && <Plane size={12} className="text-blue-400" />}
                      </div>
                      <span className={`font-black text-sm px-2 py-0.5 rounded bg-[#060B14] border border-slate-700 ${
                        slot.player.ovr >= 85 ? 'text-yellow-400' : 
                        slot.player.ovr >= 75 ? 'text-slate-200' : 'text-orange-400'
                      }`}>
                        {slot.player.ovr}
                      </span>
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
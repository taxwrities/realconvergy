import {useState,useMemo,useEffect} from 'react';
import PhraseFinder from './PhraseFinder.jsx';
import GameFilterStrip,{filterByGame} from './GameFilter.jsx';
import {useApp} from '../state/store.jsx';
import {ALL_CIPHERS,cl} from '../engine/gematria.js';

/* Search page (§8, Tony 2026-07-22): promoted from a bottom sheet to a
   dedicated full-viewport destination — same navigation pattern as the MLB
   full-sheet player card. It owns the screen (the shell stays mounted but
   hidden); a synthetic history entry wires the mobile / browser back button
   and back-swipe to return to the Board, and every dismiss routes through
   history.back() so no orphan entries are left behind. Body scroll is locked
   while the page is open. Section headers + per-input labels (Tony 2026-07-24):
   the Phrase Variation Finder sits on top, then the slate-wide Universal search
   (number / word / "jesuit"), each roster row naming the player's game + team. */
export default function SearchSheet({onClose}){
  const {search,ciphers,colorFor}=useApp();
  const [q,setQ]=useState('');
  const res=search(q);
  /* page-level game filter (Tony 2026-07-24) — a single gameLabel (or null =
     ALL) shared by the universal-search surfaces and the PhraseFinder below, so
     narrowing to one game on any strip narrows them all. Local UI state. */
  const [gameFilter,setGameFilter]=useState(null);
  /* game-bearing rows for the active query — the strip counts + narrows only the
     player rows; the number header / table (loaded-map) hits carry no game. */
  const gameRows=useMemo(()=>{
    if(res?.kind==='number')return[...(res.rosterHits||[]),...(res.nameHits||[])];
    if(res?.kind==='jesuit')return res.players||[];
    if(res?.kind==='word')return[...(res.occ||[]),...(res.nameMatches||[])];
    return[];
  },[res]);
  useEffect(()=>{
    window.history.pushState({search:1},'');
    const onPop=()=>onClose();
    const esc=e=>{if(e.key==='Escape')window.history.back()};
    window.addEventListener('popstate',onPop);
    window.addEventListener('keydown',esc);
    const prevOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{
      window.removeEventListener('popstate',onPop);
      window.removeEventListener('keydown',esc);
      document.body.style.overflow=prevOverflow;
    };
  },[]); // eslint-disable-line react-hooks/exhaustive-deps
  const dismiss=()=>window.history.back();
  const where=h=><span className="muted" style={{fontSize:11}}> · {h.team} · {h.gameLabel}</span>;
  return(
    <>
      <div className="search-scrim" onClick={dismiss}/>
      <div className="search-page">
        <div className="search-topbar">
          <button className="search-back" onClick={dismiss} aria-label="Back to Board">
            <span className="chev">‹</span>Board
          </button>
          <span className="search-topname">Search &amp; Finder</span>
        </div>
        <div className="search-scroll">
      <PhraseFinder gameFilter={gameFilter} setGameFilter={setGameFilter}/>
      <div className="finder-sep">universal search</div>
      <div className="ph-lbl">number or word</div>
      <div className="sheet-row">
        <input type="text" autoFocus placeholder="number, word, or “jesuit”…" value={q}
          onChange={e=>setQ(e.target.value)}/>
      </div>
      {res?.kind==='number'&&(
        <div className="id-card">
          <div className="num" style={{color:colorFor(res.n,res.tableHits.map(h=>h.cat))||undefined}}>{res.n}</div>
          <div className="mono muted" style={{fontSize:12,margin:'4px 0 8px'}}>
            {res.prime?`prime #${res.primeIdx}`:res.compIdx>0?`composite #${res.compIdx}`:''}
            {res.nthP?` · ${res.n}th prime = ${res.nthP}`:''}
            {res.tFam?' · T-FAMILY':''} · chain {res.chain} ({res.chain}, {res.chain+9}, {res.chain+18}…)
          </div>
          {res.tableHits.map((h,i)=>(<div key={i} className="occ">{h.src} <span className="muted">({h.cat})</span></div>))}
          <GameFilterStrip rows={gameRows} value={gameFilter} onChange={setGameFilter}/>
          {filterByGame(res.rosterHits,gameFilter).map((h,i)=>(
            <div key={'r'+i} className="occ v-green cvg-glow">
              {h.who} — {h.rung.scope} {h.rung.stat} sits {h.rung.cur}, {h.rung.off===1?'next':'+'+h.rung.off} = {res.n}{where(h)}
            </div>
          ))}
          {filterByGame(res.nameHits,gameFilter).map((h,i)=>(
            <div key={'n'+i} className="occ v-green cvg-glow">
              {h.who} — name {h.part} ({cl(h.cipher)}) = {res.n}{h.legal?' · legal':''}{where(h)}
            </div>
          ))}
          {!res.tableHits.length&&!res.rosterHits.length&&!res.nameHits.length&&<div className="occ muted">no live occurrences today</div>}
          {!!gameRows.length&&gameFilter&&!filterByGame(gameRows,gameFilter).length&&<div className="occ muted">no player rows in {gameFilter} — clear the game filter to see all</div>}
        </div>
      )}
      {res?.kind==='jesuit'&&(
        <div className="id-card">
          <div className="mono muted" style={{fontSize:11.5,marginBottom:4}}>
            {res.players.length} Jesuit-educated player{res.players.length===1?'':'s'} across the slate
          </div>
          <GameFilterStrip rows={res.players} value={gameFilter} onChange={setGameFilter}/>
          {filterByGame(res.players,gameFilter).map((h,i)=>(
            <div key={i} className="occ v-green" style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
              <b>{h.who}</b><span className="muted">{h.team}</span>
              <span className="badge gold">JESUIT</span>
              <span className="muted">{h.school}</span>
              <span className="muted" style={{fontSize:11}}>· {h.gameLabel}</span>
            </div>
          ))}
          {!res.players.length&&<div className="occ muted">no Jesuit-educated players on today's slate</div>}
          {!!res.players.length&&gameFilter&&!filterByGame(res.players,gameFilter).length&&<div className="occ muted">no Jesuit-educated players in {gameFilter} — clear the game filter to see all</div>}
        </div>
      )}
      {res?.kind==='word'&&(
        <div className="id-card">
          <div style={{fontWeight:800,marginBottom:6}}>{res.word}</div>
          <div className="name-run">
            {ALL_CIPHERS.filter(c=>ciphers[c]).map(c=>(
              <span key={c}><span className="muted">{cl(c)}</span> <b>{res.values[c]}</b></span>
            ))}
          </div>
          <GameFilterStrip rows={gameRows} value={gameFilter} onChange={setGameFilter}/>
          {filterByGame(res.occ,gameFilter).map((o,i)=>(
            <div key={i} className="occ v-green cvg-glow">
              {o.who} — {o.rung.scope} {o.rung.stat} next = {o.rung.n} ({cl(o.cipher)}){where(o)}
            </div>
          ))}
          {filterByGame(res.nameMatches,gameFilter).map((o,i)=>(
            <div key={'nm'+i} className="occ v-green cvg-glow">
              {o.who} — name {o.part} = {o.n} ({cl(o.cipher)}){where(o)}
            </div>
          ))}
          {!res.occ.length&&!res.nameMatches.length&&<div className="occ muted">no name or stat matches on the slate</div>}
          {!!gameRows.length&&gameFilter&&!filterByGame(gameRows,gameFilter).length&&<div className="occ muted">no rows in {gameFilter} — clear the game filter to see all</div>}
        </div>
      )}
        </div>
      </div>
    </>
  );
}

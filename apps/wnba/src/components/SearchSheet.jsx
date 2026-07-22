import {useState,useEffect} from 'react';
import PhraseFinder from './PhraseFinder.jsx';
import {useApp} from '../state/store.jsx';
import {ALL_CIPHERS,cl} from '../engine/gematria.js';

/* Search page (§8, Tony 2026-07-22): promoted from a bottom sheet to a
   dedicated full-viewport destination — same navigation pattern as the MLB
   full-sheet player card. It owns the screen (the shell stays mounted but
   hidden); a synthetic history entry wires the mobile / browser back button
   and back-swipe to return to the Board, and every dismiss routes through
   history.back() so no orphan entries are left behind. Body scroll is locked
   while the page is open. All finder functionality is unchanged — the Phrase
   Variation Finder sits on top, universal number/word search below. */
export default function SearchSheet({onClose}){
  const {search,ciphers,colorFor}=useApp();
  const [q,setQ]=useState('');
  const res=search(q);
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
      <PhraseFinder/>
      <div className="finder-sep">universal search</div>
      <div className="sheet-row">
        <input type="text" autoFocus placeholder="number or word…" value={q}
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
          {res.rosterHits.map((h,i)=>(
            <div key={'r'+i} className="occ v-green">
              {h.who} — {h.rung.scope} {h.rung.stat} sits {h.rung.cur}, {h.rung.off===1?'next':'+'+h.rung.off} = {res.n}
            </div>
          ))}
          {!res.tableHits.length&&!res.rosterHits.length&&<div className="occ muted">no live occurrences today</div>}
        </div>
      )}
      {res?.kind==='jesuit'&&(
        <div className="id-card">
          <div className="mono muted" style={{fontSize:11.5,marginBottom:4}}>
            {res.players.length} Jesuit-educated player{res.players.length===1?'':'s'} across the slate
          </div>
          {res.players.map((h,i)=>(
            <div key={i} className="occ v-green" style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
              <b>{h.who}</b><span className="muted">{h.team}</span>
              <span className="badge gold">JESUIT</span>
              <span className="muted">{h.school}</span>
              <span className="muted" style={{fontSize:11}}>· {h.gameLabel}</span>
            </div>
          ))}
          {!res.players.length&&<div className="occ muted">no Jesuit-educated players on today's slate</div>}
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
          {res.occ.map((o,i)=>(
            <div key={i} className="occ v-green">
              {o.who} — {o.rung.scope} {o.rung.stat} next = {o.rung.n} ({cl(o.cipher)})
            </div>
          ))}
        </div>
      )}
        </div>
      </div>
    </>
  );
}

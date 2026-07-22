import {useState,useMemo,useEffect,useRef} from 'react';
import PhraseFinder from './PhraseFinder.jsx';
import {useApp,INSTITUTIONAL,DAY_CLOCKS} from '../state/store.jsx';
import {ALL_CIPHERS,cl} from '../engine/gematria.js';
import {dateFigures} from '../engine/clocks.js';

/* Search page (§8, Tony 2026-07-22): promoted from a bottom sheet to a
   dedicated full-viewport destination — same navigation pattern as the
   full-sheet player card. It owns the screen (the shell stays mounted but
   hidden); a synthetic history entry wires the mobile / browser back button
   and back-swipe to return to the Board, and every dismiss routes through
   history.back() so no orphan entries are left behind. Body scroll is locked
   while the page is open. All finder functionality is unchanged — Day-of-Life /
   Career-Day finder, phrase-variation finder, then universal search. */
export default function SearchSheet({onClose}){
  /* while a full-sheet is open ON TOP of the search page, this page stays mounted
     (display:none) — but its popstate listener is still live. A back-press meant
     for the full-sheet must NOT also unwind Search; the full-sheet's own handler
     owns that pop. Guard on the live focusedPlayerId via a ref so the closure
     always reads the current value. */
  const {focusedPlayerId}=useApp();
  const focusedRef=useRef(focusedPlayerId);
  focusedRef.current=focusedPlayerId;
  useEffect(()=>{
    window.history.pushState({search:1},'');
    const onPop=()=>{if(focusedRef.current==null)onClose()};
    const esc=e=>{if(e.key==='Escape'&&focusedRef.current==null)window.history.back()};
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
          <DayFinder/>
          <PhraseFinder/>
          <div className="finder-sep">universal search</div>
          <UniversalSearch/>
        </div>
      </div>
    </>
  );
}

/* ---- Day-of-Life / Career-Day finder ----
   targets (single or comma-list) × ± tolerance × clock toggles, swept across
   every player in every loaded game. Quick-fill from today's DN spine or the
   institutional table runs immediately at the current tolerance. */
function DayFinder(){
  const {findDays,date,focusPlayer}=useApp();
  const [raw,setRaw]=useState('');
  const [tol,setTol]=useState(3);
  const [on,setOn]=useState(()=>Object.fromEntries(DAY_CLOCKS.map(c=>[c.key,true])));
  const targets=useMemo(()=>[...new Set(
    raw.split(/[,\s]+/).map(x=>parseInt(x,10)).filter(n=>n>0)
  )],[raw]);
  /* at least one clock must stay on — flipping the last off re-arms it */
  const toggle=key=>setOn(o=>{
    const next={...o,[key]:!o[key]};
    return DAY_CLOCKS.some(c=>next[c.key])?next:o;
  });
  const quickFill=nums=>setRaw(nums.join(', '));
  const spine=useMemo(()=>dateFigures(date).map(f=>f.n),[date]);
  const results=useMemo(
    ()=>targets.length?findDays({targets,tol,on}):[],
    [targets,tol,on,findDays]);
  return(
    <div className="finder">
      <div className="sheet-row" style={{flexWrap:'wrap',gap:6,marginBottom:8}}>
        <button className="btn acc" onClick={()=>quickFill(spine)}>Today's DN spine</button>
        <button className="btn acc" onClick={()=>quickFill(INSTITUTIONAL)}>Institutional table</button>
      </div>
      <div className="sheet-row">
        <input type="text" autoFocus placeholder="target number(s) — e.g. 67 or 67, 47, 22"
          value={raw} onChange={e=>setRaw(e.target.value)}/>
      </div>
      <div className="sheet-row" style={{gap:6,alignItems:'center'}}>
        <span className="muted" style={{fontSize:12}}>±</span>
        <input type="number" min="0" max="10" style={{width:56}} value={tol}
          onChange={e=>setTol(Math.max(0,Math.min(10,Math.floor(+e.target.value||0))))}/>
        <span className="muted" style={{fontSize:12}}>tolerance</span>
      </div>
      <div className="sheet-row" style={{gap:6,flexWrap:'wrap',marginBottom:8}}>
        {DAY_CLOCKS.map(c=>(
          <button key={c.key} className={`chip${on[c.key]?' on':''}`} onClick={()=>toggle(c.key)}>
            {c.label}
          </button>
        ))}
      </div>
      {targets.length>0&&(
        <div className="id-card" style={{marginTop:6}}>
          <div className="mono muted" style={{fontSize:11.5,marginBottom:4}}>
            targets {targets.join(', ')} · ±{tol} · {results.length} match{results.length===1?'':'es'} across the slate
          </div>
          {results.map((r,i)=>(
            <div key={i} className="finder-row">
              <div className="fr-top">
                <b>{r.name}</b>
                <span className="muted"> {r.team}</span>
                <span className={`badge ${r.kind==='birth'?'cyan':'purple'}`} style={{marginLeft:6}}>
                  {r.clockLabel}
                </span>
                {r.onSpine&&<span className="badge gold">DN</span>}
                {r.onInst&&<span className="badge green">INST</span>}
                <button className="pf-open" title={`Open ${r.name}'s full sheet`}
                  aria-label={`Open ${r.name}'s full sheet`}
                  onClick={()=>focusPlayer({id:r.id,pk:r.pk,side:r.side,from:'search'})}>↗</button>
              </div>
              <div className="fr-bot mono">
                <b className="v-green">{r.value.toLocaleString()}</b>
                <span className="muted"> — target {r.target}, {r.off>0?'+':''}{r.off}</span>
                <span className="muted"> · {r.gameLabel}</span>
              </div>
            </div>
          ))}
          {!results.length&&<div className="occ muted">no player within ±{tol} of {targets.length>1?'those targets':'that target'} today</div>}
        </div>
      )}
    </div>
  );
}

/* ---- universal search (§8): number → identity card; word → cipher values ---- */
function UniversalSearch(){
  const {search,ciphers,colorFor,focusPlayer}=useApp();
  const [q,setQ]=useState('');
  const [off,setOff]=useState(0);
  const isNum=/^\d+$/.test(q.trim());
  const res=search(q,off);
  return(
    <>
      <div className="sheet-row">
        <input type="text" placeholder="number or word…" value={q}
          onChange={e=>setQ(e.target.value)}/>
      </div>
      {isNum&&(
        <div className="sheet-row" style={{gap:6,alignItems:'center'}}>
          <span className="muted" style={{fontSize:12}}>day-of-life / career-day within</span>
          <input type="number" min="0" style={{width:60}} value={off}
            onChange={e=>setOff(Math.max(0,Math.floor(+e.target.value||0)))}/>
          <span className="muted" style={{fontSize:12}}>± days</span>
        </div>
      )}
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
            <div key={'r'+i} className="occ v-green cvg-glow" style={{display:'flex',alignItems:'center',gap:6}}>
              <span>
                {h.kind==='day'
                  ?<>{h.who} — {h.label}{h.delta?` (${h.delta>0?'+':''}${h.delta})`:''}</>
                  :<>{h.who} — {h.rung.scope} {h.rung.stat} sits {h.rung.cur}, {h.rung.off===1?'next':'+'+h.rung.off} = {res.n}</>}
              </span>
              {h.id!=null&&<button className="pf-open" title={`Open ${h.who}'s full sheet`}
                aria-label={`Open ${h.who}'s full sheet`}
                onClick={()=>focusPlayer({id:h.id,pk:h.pk,side:h.side,from:'search'})}>↗</button>}
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
              <button className="pf-open" title={`Open ${h.who}'s full sheet`}
                aria-label={`Open ${h.who}'s full sheet`}
                onClick={()=>focusPlayer({id:h.id,pk:h.pk,side:h.side,from:'search'})}>↗</button>
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
            <div key={i} className="occ v-green cvg-glow">
              {o.who} — {o.rung.scope} {o.rung.stat} next = {o.rung.n} ({cl(o.cipher)})
            </div>
          ))}
        </div>
      )}
    </>
  );
}

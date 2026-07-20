import {useState} from 'react';
import Sheet from './Sheet.jsx';
import {useApp} from '../state/store.jsx';
import {ALL_CIPHERS,cl} from '../engine/gematria.js';

/* Universal search (§8): number → identity card + live occurrences;
   word → cipher values + occurrences. */
export default function SearchSheet({onClose}){
  const {search,ciphers,colorFor}=useApp();
  const [q,setQ]=useState('');
  const [off,setOff]=useState(0);
  const isNum=/^\d+$/.test(q.trim());
  const res=search(q,off);
  return(
    <Sheet title="Search" onClose={onClose}>
      <div className="sheet-row">
        <input type="text" autoFocus placeholder="number or word…" value={q}
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
            <div key={'r'+i} className="occ v-green">
              {h.kind==='bday'||h.kind==='debut'
                ?<>{h.who} — {h.label}{h.delta?` (${h.delta>0?'+':''}${h.delta})`:''}</>
                :<>{h.who} — {h.rung.scope} {h.rung.stat} sits {h.rung.cur}, {h.rung.off===1?'next':'+'+h.rung.off} = {res.n}</>}
            </div>
          ))}
          {!res.tableHits.length&&!res.rosterHits.length&&<div className="occ muted">no live occurrences today</div>}
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
    </Sheet>
  );
}

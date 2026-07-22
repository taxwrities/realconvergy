import {useState,useMemo,useEffect} from 'react';
import {useApp,INSTITUTIONAL} from '../state/store.jsx';
import {ALL_CIPHERS,cl} from '../engine/gematria.js';
import {dateFigures} from '../engine/clocks.js';
import {crossRefsForNumber,numerologyText,statRungText,opponentText} from '../engine/numerology.js';

/* Phrase Variation Finder (Tony 2026-07-22) — sweeps <name part> + <outcome
   word> across every enabled cipher for every player on the slate, reporting
   the ones whose value lands on the target number(s) ± tolerance. Standard Zach
   convention: the phrase is the name part concatenated with the outcome word
   (e.g. SABRINA POINTS) — the cipher engine strips spaces, so the space is
   cosmetic only. Outcome words are kept SINGULAR (POINTS is already plural by
   convention; REBOUND/ASSIST/STEAL/BLOCK/TURNOVER singular), and the shot words
   use the short forms Zach computes (THREE / TWO / FREE THROW), not
   "THREE POINTER". */
const DEFAULT_WORDS=['POINTS','REBOUND','ASSIST','STEAL','BLOCK','TURNOVER',
  'THREE','TWO','FREE THROW','SCORE','MADE'];
const NAME_PARTS=[['first','First'],['last','Last'],['full','Full']];
/* how many matched phrases to show inline on the collapsed row before "+N more" */
const PHRASE_CAP=4;

export default function PhraseFinder(){
  const {findPhrases,ciphers,date,dn}=useApp();
  const [open,setOpen]=useState(false);
  const [words,setWords]=useState(()=>DEFAULT_WORDS.map(w=>({w,on:true})));
  const [custom,setCustom]=useState('');
  const [parts,setParts]=useState({first:true,last:true,full:true});
  const [cix,setCix]=useState(()=>Object.fromEntries(ALL_CIPHERS.map(c=>[c,!!ciphers[c]])));
  const [raw,setRaw]=useState('');
  const [tol,setTol]=useState(0);

  /* debounce the target field so typing stays smooth */
  const [debRaw,setDebRaw]=useState('');
  useEffect(()=>{const id=setTimeout(()=>setDebRaw(raw),150);return()=>clearTimeout(id)},[raw]);

  const targets=useMemo(()=>[...new Set(
    debRaw.split(/[,\s]+/).map(x=>parseInt(x,10)).filter(n=>n>0)
  )],[debRaw]);
  const selWords=useMemo(()=>words.filter(x=>x.on).map(x=>x.w),[words]);
  const selParts=useMemo(()=>NAME_PARTS.map(([k])=>k).filter(k=>parts[k]),[parts]);
  const selCix=useMemo(()=>ALL_CIPHERS.filter(c=>cix[c]),[cix]);

  const hits=useMemo(()=>
    (open&&targets.length&&selWords.length&&selParts.length&&selCix.length)
      ?findPhrases({words:selWords,parts:selParts,cipherKeys:selCix,targets,tol})
      :[],
    [open,targets,selWords,selParts,selCix,tol,findPhrases]);

  const groups=useMemo(()=>{
    const m=new Map();
    hits.forEach(h=>{
      const g=m.get(h.id)||{id:h.id,name:h.name,team:h.team,gameLabel:h.gameLabel,rows:[]};
      g.rows.push(h);m.set(h.id,g);
    });
    return[...m.values()].sort((a,b)=>b.rows.length-a.rows.length||a.name.localeCompare(b.name));
  },[hits]);

  const spine5=useMemo(()=>dateFigures(date).slice(0,5).map(f=>f.n),[date]);
  const fill=nums=>setRaw([...new Set(nums.filter(n=>n>0))].join(', '));
  const toggleWord=w=>setWords(ws=>ws.map(x=>x.w===w?{...x,on:!x.on}:x));
  const setAllWords=on=>setWords(ws=>ws.map(x=>({...x,on})));
  const toggleCix=c=>setCix(o=>{const n={...o,[c]:!o[c]};return Object.values(n).some(Boolean)?n:o});
  /* all → every cipher on; none → keep the first on (findPhrases needs ≥1) */
  const allCix=on=>setCix(Object.fromEntries(ALL_CIPHERS.map((c,i)=>[c,on?true:i===0])));
  const togglePart=k=>setParts(o=>{const n={...o,[k]:!o[k]};return NAME_PARTS.some(([p])=>n[p])?n:o});
  const addCustom=()=>{
    const w=custom.trim().toUpperCase();
    if(w){setWords(ws=>ws.some(x=>x.w===w)?ws:[...ws,{w,on:true}]);setCustom('')}
  };

  return(
    <div className="finder">
      <button className="phrase-head" onClick={()=>setOpen(o=>!o)}>
        <span>phrase variation finder</span>
        <span className="ph-chev">{open?'▾':'▸'}</span>
      </button>
      {open&&(
        <div className="phrase-body">
          {/* outcome words */}
          <div className="ph-lbl">
            outcome words
            <span className="ph-allnone">
              <button className="ph-mini" onClick={()=>setAllWords(true)}>all</button>
              <button className="ph-mini" onClick={()=>setAllWords(false)}>none</button>
            </span>
          </div>
          <div className="sheet-row" style={{gap:6,flexWrap:'wrap'}}>
            {words.map(x=>(
              <button key={x.w} className={`chip${x.on?' on':''}`} onClick={()=>toggleWord(x.w)}>{x.w}</button>
            ))}
          </div>
          <div className="sheet-row" style={{gap:6}}>
            <input type="text" placeholder="add custom word…" value={custom}
              onChange={e=>setCustom(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')addCustom()}}/>
            <button className="btn acc" onClick={addCustom}>add</button>
          </div>

          {/* name parts */}
          <div className="ph-lbl">name part</div>
          <div className="sheet-row" style={{gap:6,flexWrap:'wrap'}}>
            {NAME_PARTS.map(([k,lbl])=>(
              <button key={k} className={`chip${parts[k]?' on':''}`} onClick={()=>togglePart(k)}>{lbl}</button>
            ))}
          </div>

          {/* ciphers */}
          <div className="ph-lbl">
            ciphers
            <span className="ph-allnone">
              <button className="ph-mini" onClick={()=>allCix(true)}>all</button>
              <button className="ph-mini" onClick={()=>allCix(false)}>none</button>
            </span>
          </div>
          <div className="sheet-row" style={{gap:6,flexWrap:'wrap'}}>
            {ALL_CIPHERS.map(c=>(
              <button key={c} className={`chip${cix[c]?' on':''}`} onClick={()=>toggleCix(c)}>{cl(c)}</button>
            ))}
          </div>

          {/* targets + quick fills */}
          <div className="ph-lbl">target number(s)</div>
          <div className="sheet-row" style={{flexWrap:'wrap',gap:6,marginBottom:8}}>
            <button className="btn acc" onClick={()=>fill(spine5)}>Today's DN spine</button>
            <button className="btn acc" onClick={()=>fill([dn.doy,dn.left])}>Day of Year / Days Left</button>
            <button className="btn acc" onClick={()=>fill(INSTITUTIONAL)}>Institutional table</button>
          </div>
          <div className="sheet-row">
            <input type="text" placeholder="target(s) — e.g. 162 or 162, 47, 78"
              value={raw} onChange={e=>setRaw(e.target.value)}/>
          </div>
          <div className="sheet-row" style={{gap:6,alignItems:'center'}}>
            <span className="muted" style={{fontSize:12}}>±</span>
            <input type="number" min="0" max="5" style={{width:56}} value={tol}
              onChange={e=>setTol(Math.max(0,Math.min(5,Math.floor(+e.target.value||0))))}/>
            <span className="muted" style={{fontSize:12}}>tolerance (0 = exact)</span>
          </div>

          {/* results — one scannable summary row per player (ResultRow, below).
             The phrase-hit list + PLAYER/RUNGS/OPP cross-refs are computed but
             hidden by default; the ▸ caret expands them in place. */}
          {targets.length>0&&(
            <div className="id-card" style={{marginTop:6}}>
              <div className="mono muted" style={{fontSize:11.5,marginBottom:4}}>
                targets {targets.join(', ')} · ±{tol} · {hits.length} hit{hits.length===1?'':'s'} across {groups.length} player{groups.length===1?'':'s'}
              </div>
              {groups.map(g=>(
                <ResultRow key={g.id} g={g} tol={tol}/>
              ))}
              {!hits.length&&(
                <div className="occ muted">No hits. Try more ciphers, more variations, or bumping tolerance to 1–2.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* one result group → a single scannable row (Tony 2026-07-22). Collapsed by
   default: player · team · game, then the matched phrases inline as
   "PHRASE (Cipher=value)" (first PHRASE_CAP, then "+N more"), with a ▸ caret.
   The PLAYER/RUNGS/OPP cross-ref pile stays hidden — it's still computed but
   only renders on caret-expand. */
function ResultRow({g,tol}){
  const [exp,setExp]=useState(false);
  const shown=g.rows.slice(0,PHRASE_CAP), extra=g.rows.length-shown.length;
  /* cascade = a RUNGS/OPP cross-ref lands on the same target as a phrase hit →
     stronger glow. Computed once here and reused by the expanded PlayerXref. */
  const xref=useMemo(()=>collectXref(g.rows[0],g.rows.map(r=>r.target)),[g]);
  const strong=xref.rungs.length>0||xref.opp.length>0;
  return(
    <div className={`finder-row${strong?' glow-strong':''}`}>
      <div className="fr-top">
        <b>{g.name}</b>
        <span className="muted"> {g.team}</span>
        <span className="muted" style={{fontSize:11}}> · {g.gameLabel}</span>
        <span className="pf-phrases mono">
          {' · '}
          {shown.map((r,i)=>(
            <span key={i}>{i>0?', ':''}{r.phrase} <span className="muted">({cl(r.cipher)}={r.value})</span></span>
          ))}
          {extra>0&&<span className="muted"> · +{extra} more</span>}
        </span>
        <button className="pf-caret" aria-expanded={exp}
          aria-label={exp?'Hide hit detail':'Show hit detail'}
          onClick={()=>setExp(e=>!e)}>{exp?'▾':'▸'}</button>
      </div>
      {exp&&(<>
        {g.rows.map((r,i)=>(
          <div key={i} className="fr-bot mono" style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
            <span>{r.phrase}</span>
            <span className="muted">· {cl(r.cipher)} =</span>
            <b className="v-green">{r.value}</b>
            <span className="muted">· target {r.target}{tol>0?` (${r.off>0?'+':''}${r.off})`:''}</span>
            {r.onSpine&&<span className="badge gold">DN</span>}
            {r.onInst&&<span className="badge green">INST</span>}
          </div>
        ))}
        <PlayerXref xref={xref}/>
      </>)}
    </div>
  );
}

/* collect the PLAYER/RUNGS/OPP convergences that ride with this player against
   the target(s) they landed on — PLAYER (own life-clock / jersey), RUNGS (a
   tracked career/season stat whose next milestone is the target), OPP
   (opponent-team gematria). Raw equality = strong; a shared digit-root = soft.
   Deduped per group. Same crossRefsForNumber() helper the full-sheet WHY panel
   uses; drives the row's glow strength and the expanded PlayerXref. */
function collectXref(row,targets){
  const tgts=[...new Set(targets)].filter(n=>n>0);
  const player=[],rungs=[],opp=[];
  if(!row||!tgts.length)return{player,rungs,opp};
  const sN=new Set(),sR=new Set(),sO=new Set();
  tgts.forEach(tg=>{
    const cr=crossRefsForNumber(row,tg);
    cr.numerology.items.forEach(it=>{
      if(!(it.rawMatch||it.softMatch))return;
      const k=`${it.key}|${tg}`;if(sN.has(k))return;sN.add(k);
      player.push({strong:it.rawMatch,text:numerologyText(it,tg,cr.numerology.targetDr)});
    });
    cr.statRungs.items.forEach(it=>{
      const k=`${it.scope}|${it.label}|${tg}`;if(sR.has(k))return;sR.add(k);
      rungs.push({strong:it.rawMatch,text:statRungText(it)});
    });
    cr.opponent.items.forEach(it=>{
      const k=`${it.name}|${it.value}|${tg}`;if(sO.has(k))return;sO.add(k);
      opp.push({strong:it.rawMatch,text:opponentText(it,tg)});
    });
  });
  return{player,rungs,opp};
}

/* expanded cross-ref block — one line per group, comma-separated. Takes the
   pre-collected xref from ResultRow (also drives the glow). Renders nothing when
   every group is empty so the expanded row stays tight. */
function PlayerXref({xref}){
  const {player,rungs,opp}=xref;
  if(!player.length&&!rungs.length&&!opp.length)return null;
  return(
    <div className="fr-xref mono">
      <XGroup lbl="player" rows={player}/>
      <XGroup lbl="rungs" rows={rungs}/>
      <XGroup lbl="opp" rows={opp}/>
    </div>
  );
}

/* one cross-ref group line — small label + comma-separated hits. Renders
   nothing when the group is empty. */
function XGroup({lbl,rows}){
  if(!rows.length)return null;
  return(
    <div className="xref-line">
      <span className="xref-lbl">{lbl}</span>
      {rows.map((m,k)=>(
        <span key={k} className={m.strong?'xref-strong':'xref-soft'}>{k>0?', ':' '}{m.text}</span>
      ))}
    </div>
  );
}

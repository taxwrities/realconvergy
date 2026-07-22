import {useState,useMemo,useEffect} from 'react';
import {useApp,INSTITUTIONAL} from '../state/store.jsx';
import {ALL_CIPHERS,cl} from '../engine/gematria.js';
import {dateFigures} from '../engine/clocks.js';
import {playerNumerologyMatches} from '../engine/numerology.js';

/* Phrase Variation Finder (Tony 2026-07-22) — sibling to the Day-of-Life
   finder. Sweeps <name part> + <outcome word> across every enabled cipher for
   every batter on the slate, reporting the ones whose value lands on the
   target number(s) ± tolerance. Standard Zach convention: the phrase is the
   name part concatenated with the outcome word (e.g. AARON HOMERUN) — the
   cipher engine strips spaces, so the space is cosmetic only. Outcome words are
   kept SINGULAR (HIT/RUN/RBI), the form Zach computes against. */
const DEFAULT_WORDS=['SINGLE','DOUBLE','TRIPLE','HOMERUN','HR','STRIKEOUT','STRIKE OUT',
  'WALK','STOLEN BASE','HIT','RUN','RBI'];
const NAME_PARTS=[['first','First'],['middle','Middle'],['last','Last'],['full','Full']];

export default function PhraseFinder(){
  const {findPhrases,ciphers,date,dn}=useApp();
  const [open,setOpen]=useState(false);
  const [words,setWords]=useState(()=>DEFAULT_WORDS.map(w=>({w,on:true})));
  const [custom,setCustom]=useState('');
  const [parts,setParts]=useState({first:true,middle:true,last:true,full:true});
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

          {/* results — PlayerXref (defined below) hangs the numerology
             cross-ref block under each hit group */}
          {targets.length>0&&(
            <div className="id-card" style={{marginTop:6}}>
              <div className="mono muted" style={{fontSize:11.5,marginBottom:4}}>
                targets {targets.join(', ')} · ±{tol} · {hits.length} hit{hits.length===1?'':'s'} across {groups.length} player{groups.length===1?'':'s'}
              </div>
              {groups.map(g=>(
                <div key={g.id} className="finder-row">
                  <div className="fr-top">
                    <b>{g.name}</b>
                    <span className="muted"> {g.team}</span>
                    <span className="badge blue" style={{marginLeft:6}}>{g.rows.length}</span>
                    <span className="muted" style={{fontSize:11}}> · {g.gameLabel}</span>
                  </div>
                  {g.rows.map((r,i)=>(
                    <div key={i} className="fr-bot mono" style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                      <span>{r.phrase}</span>
                      {r.legal&&<span className="badge blue" title="legal/government name variant">LEGAL</span>}
                      <span className="muted">· {cl(r.cipher)} =</span>
                      <b className="v-green">{r.value}</b>
                      <span className="muted">· target {r.target}{tol>0?` (${r.off>0?'+':''}${r.off})`:''}</span>
                      {r.onSpine&&<span className="badge gold">DN</span>}
                      {r.onInst&&<span className="badge green">INST</span>}
                    </div>
                  ))}
                  <PlayerXref pn={g.rows[0].pn} targets={g.rows.map(r=>r.target)}/>
                </div>
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

/* player-numerology cross-ref block (Tony 2026-07-22): under each hit group,
   echo the player's own life-clock readings + jersey against the target(s)
   this player landed on. Raw equality = strong (gold); a shared digit-root is
   the softer bonus (dim gold, italic). Renders nothing when nothing lines up
   so the finder stays uncluttered. */
function PlayerXref({pn,targets}){
  const tgts=[...new Set(targets)].filter(n=>n>0);
  if(!pn||!tgts.length)return null;
  const base=playerNumerologyMatches(pn,tgts[0]);
  if(!base.items.length)return null;
  const strong=new Set(),soft=new Set(),lines=[];
  tgts.forEach(tg=>{
    const m=playerNumerologyMatches(pn,tg);
    m.items.forEach(it=>{
      if(it.rawMatch){strong.add(it.key);
        lines.push({strong:true,text:`${it.key} ${it.value.toLocaleString()} = target ${tg}`});}
      else if(it.softMatch){soft.add(it.key);
        lines.push({strong:false,text:`${it.key} dr ${it.dr} = target ${tg} dr ${m.targetDr}`});}
    });
  });
  if(!lines.length)return null;   // no cross-refs match → show nothing
  return(
    <div className="fr-xref mono">
      <div className="xref-line">
        <span className="xref-lbl">player:</span>
        {base.items.map((it,k)=>(
          <span key={k} className={strong.has(it.key)?'xref-strong':soft.has(it.key)?'xref-soft':'xref-mut'}>
            {k>0?' · ':' '}{it.key} {it.value.toLocaleString()} (dr {it.dr})
          </span>
        ))}
      </div>
      <div className="xref-line">
        <span className="xref-lbl">matches:</span>
        {lines.map((ml,k)=>(
          <span key={k} className={ml.strong?'xref-strong':'xref-soft'}>{k>0?' · ':' '}{ml.text}</span>
        ))}
      </div>
    </div>
  );
}

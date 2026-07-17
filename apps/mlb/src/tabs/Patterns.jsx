import {useState,useEffect} from 'react';
import {useApp} from '../state/store.jsx';
import {COUNTERS,SCOPES,MODS,SOURCES,summarizeCondition,isDateDependent,
  describePattern,patternNeedsDeep,patternMissingTemplate} from '../engine/patterns.js';
import {LANES} from '../data/defaults.js';

/* Patterns tab — LAYOUT-SPEC §5: library + condition-sentence editor
   with live preview against the currently selected batter. */
export default function PatternsTab({goBoard}){
  const {pendingPattern,setPendingPattern}=useApp();
  const [editing,setEditing]=useState(null); // pattern object being edited
  /* recipe-drawer handoff (PATTERN-RECIPES §8): a "Save as pattern" on the
     Board lands here pre-filled — the editor stays the source of truth */
  useEffect(()=>{
    if(pendingPattern){setEditing(pendingPattern);setPendingPattern(null)}
  },[pendingPattern,setPendingPattern]);
  return editing
    ?<Editor pattern={editing} onDone={()=>setEditing(null)}/>
    :<Library onEdit={setEditing} goBoard={goBoard}/>;
}

function Library({onEdit,goBoard}){
  const {patterns,setPatterns,patternCounts,patternHitsAll,setGamePk,setSide,setBatterId}=useApp();
  const [hitsOpen,setHitsOpen]=useState(null); // pattern id with the full hit list expanded
  /* tap a name → land on that batter's card on the Board */
  const jump=h=>{setGamePk(h.pk);setSide(h.side);setBatterId(h.id);goBoard&&goBoard()};
  const blank=()=>({id:'pat-'+Date.now(),name:'New pattern',lane:'HR',enabled:true,
    conditions:[{counter:'rung:HR',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true}]});
  return(
    <div>
      {patterns.map(pt=>(
        <div key={pt.id} className="panel" style={{cursor:'pointer'}} onClick={()=>onEdit(structuredClone(pt))}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <b style={{fontSize:14}}>{pt.name}</b>
            <span className="badge gold">{pt.lane}</span>
            {pt.example&&<span className="badge cyan">EXAMPLE</span>}
            {isDateDependent(pt)&&<span className="badge purple">⟡ FORECAST</span>}
            {pt.autoPromote&&<span className="badge green">AUTO-PROMOTE</span>}
            {patternNeedsDeep(pt)&&(
              <span className="badge blue"
                title="uses vs-team / vs-league / month / day-of-week / game-log data — 0 hits until you tap DEEP on the game">
                needs DEEP
              </span>
            )}
            <span style={{marginLeft:'auto'}} className="mono v-green">
              {patternCounts[pt.id]||0} hits today
            </span>
            <button className="chip" style={{padding:'3px 10px'}}
              onClick={e=>{e.stopPropagation();
                setPatterns(patterns.map(x=>x.id===pt.id?{...x,enabled:!x.enabled}:x))}}>
              {pt.enabled?'ON':'off'}
            </button>
          </div>
          <div className="pat-summary">{describePattern(pt)}</div>
          {(patternHitsAll.legs[pt.id]?.some(n=>n>0))&&!(patternHitsAll.hits[pt.id]?.length)&&(
            <div className="hint" title="how many slate batters pass each condition individually — a 0-hit day usually means the legs fire separately but never together">
              per-leg passes today:{' '}
              {patternHitsAll.legs[pt.id].map((n,i)=>(
                <span key={i}>{i>0&&' · '}<b className={pt.conditions[i]?.hard?'v-gold':''}>{n}</b></span>
              ))}
              {' '}(gold = hard)
            </div>
          )}
          {(patternHitsAll.hits[pt.id]?.length>0)&&(()=>{
            const hits=patternHitsAll.hits[pt.id];
            const open=hitsOpen===pt.id;
            const shown=open?hits:hits.slice(0,4);
            return(
              <div className="pat-name-row" style={{marginTop:6}} onClick={e=>e.stopPropagation()}>
                {shown.map(h=>(
                  <button key={`${h.pk}-${h.side}-${h.id}`} className="pat-who" onClick={()=>jump(h)}>
                    {h.name}<span className="muted"> {h.abbr}</span>
                  </button>
                ))}
                {hits.length>4&&(
                  <button className="pat-more" onClick={()=>setHitsOpen(open?null:pt.id)}>
                    {open?'less':`+${hits.length-4} more`}
                  </button>
                )}
              </div>
            );
          })()}
          {patternMissingTemplate(pt)&&(
            <div className="pat-warn">⚠ needs a phrase template picked (make one in Vocab, pick it in the editor) before that leg can fire</div>
          )}
          {pt.example&&<div className="pat-example">{pt.example}</div>}
          <details className="pat-tech" onClick={e=>e.stopPropagation()}>
            <summary>technical rule</summary>
            <div>{pt.conditions.map(summarizeCondition).join('  AND  ')}</div>
          </details>
        </div>
      ))}
      <button className="chip on" onClick={()=>onEdit(blank())}>+ new pattern</button>
    </div>
  );
}

function Editor({pattern,onDone}){
  const {patterns,setPatterns,previewPattern,templates}=useApp();
  const [pt,setPt]=useState(pattern);
  const preview=previewPattern(pt);
  const upCond=(i,patch)=>setPt({...pt,conditions:pt.conditions.map((c,j)=>j===i?{...c,...patch}:c)});
  const sel={background:'#101319',border:'1px solid #2a303c',borderRadius:7,color:'#e8eaf0',
    padding:'6px 7px',fontSize:12,maxWidth:150};
  const save=()=>{
    const exists=patterns.some(x=>x.id===pt.id);
    setPatterns(exists?patterns.map(x=>x.id===pt.id?pt:x):[...patterns,pt]);
    onDone();
  };
  return(
    <div>
      <div className="panel">
        <div className="sheet-row">
          <input type="text" value={pt.name} onChange={e=>setPt({...pt,name:e.target.value})}
            style={{...sel,flex:1,maxWidth:'none',fontWeight:700}}/>
          <select style={sel} value={pt.lane} onChange={e=>setPt({...pt,lane:e.target.value})}>
            {LANES.map(L=><option key={L}>{L}</option>)}
          </select>
        </div>
        {pt.conditions.map((c,i)=>{
          const d=preview?.res.details[i];
          const rung=c.counter.startsWith('rung');
          return(
            <div key={i} className="panel" style={{background:'#101319',marginBottom:8}}>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
                <select style={sel} value={c.lmod} onChange={e=>upCond(i,{lmod:e.target.value})}>
                  {MODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <select style={sel} value={c.counter} onChange={e=>upCond(i,{counter:e.target.value})}>
                  {COUNTERS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
                {rung&&<>
                  <select style={sel} value={c.counterArg?.off||1}
                    onChange={e=>upCond(i,{counterArg:{off:+e.target.value}})}>
                    {[1,2,3,4,5].map(k=><option key={k} value={k}>+1..{k}</option>)}
                  </select>
                  <select style={sel} value={c.scope} onChange={e=>upCond(i,{scope:e.target.value})}>
                    {SCOPES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </>}
                <span className="muted">=</span>
                <select style={sel} value={c.rmod} onChange={e=>upCond(i,{rmod:e.target.value})}>
                  {MODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <select style={sel} value={c.source} onChange={e=>{const s=e.target.value;
                  upCond(i,{source:s,sourceArg:s==='numberWord'||s==='counterRef'?{counter:'rung:HR',scope:'season',off:1}:''})}}>
                  {SOURCES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {c.source==='word'&&<input type="text" style={{...sel,width:110}} placeholder="word…"
                  value={typeof c.sourceArg==='string'?c.sourceArg:''} onChange={e=>upCond(i,{sourceArg:e.target.value})}/>}
                {(c.source==='numberWord'||c.source==='counterRef')&&(()=>{
                  const a=c.sourceArg?.counter?c.sourceArg:{counter:'rung:HR',scope:'season',off:1};
                  return(<>
                    <select style={sel} value={a.counter} onChange={e=>upCond(i,{sourceArg:{...a,counter:e.target.value}})}>
                      {COUNTERS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                    <select style={sel} value={a.scope} onChange={e=>upCond(i,{sourceArg:{...a,scope:e.target.value}})}>
                      {SCOPES.map(s=><option key={s}>{s}</option>)}
                    </select>
                    <select style={sel} value={a.off||1} onChange={e=>upCond(i,{sourceArg:{...a,off:+e.target.value}})}>
                      {[1,2,3,4,5].map(k=><option key={k} value={k}>+1..{k}</option>)}
                    </select>
                  </>);
                })()}
                {c.source==='template'&&(
                  <select style={sel} value={c.sourceArg} onChange={e=>upCond(i,{sourceArg:e.target.value})}>
                    <option value="">template…</option>
                    {templates.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                )}
                <button className="chip" style={{padding:'4px 10px'}}
                  onClick={()=>upCond(i,{hard:!c.hard})}>{c.hard?'hard':'soft'}</button>
                <button className="chip gray" style={{padding:'4px 8px'}}
                  onClick={()=>setPt({...pt,conditions:pt.conditions.filter((_,j)=>j!==i)})}>×</button>
              </div>
              {(()=>{
                const ch=COUNTERS.find(x=>x.id===c.counter)?.hint;
                const sh=SOURCES.find(x=>x.id===c.source)?.hint;
                return(ch||sh)?<div className="hint">{[ch,sh].filter(Boolean).join('  ·  ')}</div>:null;
              })()}
              {d&&(
                <div style={{marginTop:6,fontSize:11.5,fontFamily:'var(--cvg-mono)'}}
                  className={d.pass?'v-green':'muted'}>
                  {d.pass
                    ?d.matches.slice(0,3).map((m,k)=><div key={k}>✓ {m.left} = {m.right}{m.chain?' (chain)':''}</div>)
                    :d.noData?'· no data for this scope (deep fetch the game?)':'· no match on previewed batter'}
                </div>
              )}
            </div>
          );
        })}
        <div className="sheet-row">
          <button className="chip" onClick={()=>setPt({...pt,conditions:[...pt.conditions,
            {counter:'rung:HR',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true}]})}>
            + condition</button>
          <button className="chip on" onClick={save}>Save pattern</button>
          <button className="chip gray" onClick={onDone}>Cancel</button>
          {patterns.some(x=>x.id===pt.id)&&!pt.seed&&(
            <button className="chip" style={{borderColor:'var(--cvg-red)',color:'var(--cvg-red)'}}
              onClick={()=>{setPatterns(patterns.filter(x=>x.id!==pt.id));onDone()}}>delete</button>
          )}
        </div>
        {preview&&(
          <div className="muted" style={{fontSize:11.5,marginTop:6}}>
            live preview vs <b style={{color:'#e8eaf0'}}>{preview.who}</b> —
            <span className={preview.res.match?'v-green':'muted'}>
              {' '}{preview.res.hardPass}/{preview.res.hardTotal} hard ✓
              {preview.res.softTotal?` +${preview.res.softPass} soft`:''}
              {preview.res.match?' — MATCH':''}
            </span>
          </div>
        )}
        {isDateDependent(pt)&&(
          <div className="muted" style={{fontSize:11,marginTop:4}}>
            ⟡ date-dependent — this pattern feeds the Forecast engine
          </div>
        )}
      </div>
    </div>
  );
}

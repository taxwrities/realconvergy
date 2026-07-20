import {useState,useMemo} from 'react';
import {useApp} from '../state/store.jsx';
import {COUNTERS,SCOPES,MODS,SOURCES,NAME_PARTS,NAME_CIPHERS,summarizeCondition,isDateDependent,
  describePattern,patternNeedsDeep,patternMissingTemplate} from '../engine/patterns.js';
import {parsePost} from '../engine/parse.js';
import {draftsToPattern} from '../engine/recipe.js';
import {LANES,LANE_STAT} from '../data/defaults.js';
import Sheet from '../components/Sheet.jsx';

/* the referenced-counter default for numberWord/counterRef sources — points
   is the WNBA marquee counting stat (the baseball build defaults to HR). */
const REF_DEFAULT={counter:'rung:PTS',scope:'season',off:1};

/* Patterns tab — LAYOUT-SPEC §5: library + condition-sentence editor
   with live preview against the currently selected player. */
export default function PatternsTab(){
  const [editing,setEditing]=useState(null); // pattern object being edited
  return editing
    ?<Editor pattern={editing} onDone={()=>setEditing(null)}/>
    :<Library onEdit={setEditing}/>;
}

function Library({onEdit}){
  const {patterns,setPatterns,patternCounts}=useApp();
  const [postOpen,setPostOpen]=useState(false); // paste-a-post parser sheet (Phase 3)
  const blank=()=>({id:'pat-'+Date.now(),name:'New pattern',lane:'FB',enabled:true,
    conditions:[{counter:'rung:FG',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true}]});
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
                title="uses vs-team data — 0 hits until you tap ⚡ DEEP on the game">
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
          {patternMissingTemplate(pt)&&(
            <div className="pat-warn">⚠ needs a phrase template picked (make one in Vocab, pick it in the editor) before that leg can fire</div>
          )}
          {pt.example&&<div className="pat-example">{pt.example}</div>}
          <details className="pat-tech" onClick={e=>e.stopPropagation()}>
            <summary>technical rule</summary>
            <div>{pt.conditions.map(summarizeCondition).join(pt.operator==='OR'?'  OR  ':'  AND  ')}</div>
          </details>
        </div>
      ))}
      <div className="rail" style={{overflowX:'visible',flexWrap:'wrap'}}>
        <button className="chip on" onClick={()=>onEdit(blank())}>+ new pattern</button>
        <button className="chip gold" onClick={()=>setPostOpen(true)}>⌁ from post text</button>
      </div>
      {postOpen&&<PostSheet onEdit={onEdit} onClose={()=>setPostOpen(false)}/>}
    </div>
  );
}

/* paste-a-post parser sheet (PATTERN-RECIPES Phase 3). The parser joins
   the post's explicit number equalities; whatever it can't place is
   shown as leftovers so nothing disappears silently. "Open in editor"
   hands over a pre-filled pattern — the editor stays the source of truth. */
function PostSheet({onEdit,onClose}){
  const {slate}=useApp();
  const [text,setText]=useState('');
  const teams=useMemo(()=>{
    const t=new Set();
    slate?.games.forEach(g=>[g.home,g.away].forEach(x=>
      [x.name,x.teamName,x.locationName].filter(Boolean).forEach(n=>t.add(n))));
    return[...t];
  },[slate]);
  const parsed=useMemo(()=>parsePost(text,{teams}),[text,teams]);
  return(
    <Sheet title="Recipe from post text" onClose={onClose}>
      <textarea className="post-ta" rows={5} autoFocus
        placeholder="paste the blog line… (the parser reads its explicit equalities: Liberty=57, New York(101)-26p, 83=23rd prime, 63-44c)"
        value={text} onChange={e=>setText(e.target.value)}/>
      {parsed.drafts.map((d,i)=>(
        <div key={i} className="parse-row">
          <span className={`badge ${d.cond.hard?'gold':'green'}`}>{d.cond.hard?'hard':'soft'}</span>
          <span className="lbl">{d.label}</span>
        </div>
      ))}
      {parsed.leftovers.length>0&&(
        <div className="hint">couldn't place: {parsed.leftovers.join('  ·  ')}</div>
      )}
      {text.trim()&&!parsed.drafts.length&&(
        <div className="hint">no recognizable legs yet — paste lines that carry their number equalities</div>
      )}
      <div className="sheet-row" style={{marginTop:10}}>
        <button className="chip on" disabled={!parsed.drafts.length}
          onClick={()=>{onEdit(draftsToPattern(parsed.drafts,LANE_STAT,'Post recipe'));onClose()}}>
          Open in editor{parsed.drafts.length?` (${parsed.drafts.length})`:''}
        </button>
        <button className="chip gray" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

function Editor({pattern,onDone}){
  const {patterns,setPatterns,previewPattern,templates,slate,ciphers}=useApp();
  const enabledCiphers=NAME_CIPHERS.filter(c=>ciphers[c]);
  const [pt,setPt]=useState(pattern);
  /* preview player pick (PATTERN-RECIPES §9) — '' = the board selection */
  const [previewId,setPreviewId]=useState('');
  const preview=previewPattern(pt,previewId===''?undefined:+previewId);
  const seen=new Set();
  const previewOpts=(slate?.games||[]).flatMap(g=>['away','home'].flatMap(s=>
    g[s+'Ids'].map(id=>({id,name:slate.people[id]?.fullName,abbr:g[s].abbrev||g[s].teamName}))
  )).filter(o=>o.name&&!seen.has(o.id)&&seen.add(o.id));
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
        {pt.conditions.filter(c=>c.hard).length>1&&(
          <div className="sheet-row" style={{alignItems:'center',gap:8,marginTop:2}}>
            <span className="muted" style={{fontSize:11.5}}>hard legs combine with</span>
            <div style={{display:'inline-flex',border:'1px solid #2a303c',borderRadius:7,overflow:'hidden'}}>
              {['AND','OR'].map(op=>{
                const on=(pt.operator||'AND')===op;
                return(
                  <button key={op} className="chip" style={{border:'none',borderRadius:0,padding:'4px 12px',
                    background:on?(op==='OR'?'var(--cvg-gold,#c9a227)':'#2a3550'):'transparent',
                    color:on?'#0b0e14':'#8b93a7',fontWeight:on?700:500}}
                    onClick={()=>setPt({...pt,operator:op})}>{op}</button>
                );
              })}
            </div>
            <span className="muted" style={{fontSize:11}}>
              {(pt.operator||'AND')==='OR'?'fires if ANY hard leg matches':'fires only if EVERY hard leg matches'}
            </span>
          </div>
        )}
        {pt.conditions.map((c,i)=>{
          const d=preview?.res.details[i];
          const rung=c.counter.startsWith('rung');
          const bool=c.counter==='jesuit'; // standalone boolean — no source side
          return(
            <div key={i} className="panel" style={{background:'#101319',marginBottom:8}}>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
                {!bool&&(
                <select style={sel} value={c.lmod} onChange={e=>upCond(i,{lmod:e.target.value})}>
                  {MODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                </select>)}
                <select style={sel} value={c.counter} onChange={e=>upCond(i,{counter:e.target.value})}>
                  {COUNTERS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
                {bool&&<span className="muted" style={{fontSize:11.5}}>— true when the player attended an AJCU Jesuit school</span>}
                {c.counter==='nameCipher'&&(()=>{
                  const part=c.counterArg?.part||'full';
                  const arr=c.counterArg?.ciphers;
                  /* undefined → default all enabled (every chip on); legacy singular
                     `cipher` → 1-list; [] → none. Toggling materializes an explicit
                     array, canonicalizing a full-enabled set back to undefined. */
                  const cur=Array.isArray(arr)?arr:c.counterArg?.cipher?[c.counterArg.cipher]:enabledCiphers;
                  const allOn=cur.length===enabledCiphers.length&&enabledCiphers.every(x=>cur.includes(x));
                  const setSel=next=>{
                    const full=next.length===enabledCiphers.length&&enabledCiphers.every(x=>next.includes(x));
                    upCond(i,{counterArg:{...c.counterArg,part,cipher:undefined,ciphers:full?undefined:next}});
                  };
                  return(<>
                    <select style={sel} value={part}
                      onChange={e=>upCond(i,{counterArg:{...c.counterArg,part:e.target.value}})}>
                      {NAME_PARTS.map(x=><option key={x} value={x}>{x} name</option>)}
                    </select>
                    <span style={{display:'inline-flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                      {enabledCiphers.map(cp=>(
                        <button key={cp} type="button" style={{padding:'3px 8px',fontSize:11}}
                          className={`chip${cur.includes(cp)?' on':''}`}
                          onClick={()=>setSel(cur.includes(cp)?cur.filter(x=>x!==cp):[...cur,cp])}>{cp}</button>
                      ))}
                      <button type="button" className="chip gray" style={{padding:'3px 8px',fontSize:11}}
                        onClick={()=>setSel(allOn?[]:enabledCiphers)}>{allOn?'none':'all'}</button>
                    </span>
                  </>);
                })()}
                {rung&&<>
                  <select style={sel} value={c.counterArg?.off||1}
                    onChange={e=>upCond(i,{counterArg:{off:+e.target.value}})}>
                    {[1,2,3,4,5].map(k=><option key={k} value={k}>+1..{k}</option>)}
                  </select>
                  <select style={sel} value={c.scope} onChange={e=>upCond(i,{scope:e.target.value})}>
                    {SCOPES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </>}
                {!bool&&<>
                <span className="muted">=</span>
                <select style={sel} value={c.rmod} onChange={e=>upCond(i,{rmod:e.target.value})}>
                  {MODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <select style={sel} value={c.source} onChange={e=>{const s=e.target.value;
                  upCond(i,{source:s,sourceArg:s==='numberWord'||s==='counterRef'?{...REF_DEFAULT}:''})}}>
                  {SOURCES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {c.source==='word'&&<input type="text" style={{...sel,width:110}} placeholder="word…"
                  value={typeof c.sourceArg==='string'?c.sourceArg:''} onChange={e=>upCond(i,{sourceArg:e.target.value})}/>}
                {c.source==='customNumber'&&<input type="number" inputMode="numeric" style={{...sel,width:80}} placeholder="#"
                  value={c.sourceArg??''} onChange={e=>upCond(i,{sourceArg:e.target.value})}/>}
                {(c.source==='numberWord'||c.source==='counterRef')&&(()=>{
                  const a=c.sourceArg?.counter?c.sourceArg:REF_DEFAULT;
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
                </>}
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
                    :d.noData?'· no data for this scope (deep fetch the game?)':'· no match on previewed player'}
                </div>
              )}
            </div>
          );
        })}
        <div className="sheet-row">
          <button className="chip" onClick={()=>setPt({...pt,conditions:[...pt.conditions,
            {counter:'rung:FG',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true}]})}>
            + condition</button>
          <button className="chip on" onClick={save}>Save pattern</button>
          <button className="chip gray" onClick={onDone}>Cancel</button>
          {patterns.some(x=>x.id===pt.id)&&!pt.seed&&(
            <button className="chip" style={{borderColor:'var(--cvg-red)',color:'var(--cvg-red)'}}
              onClick={()=>{setPatterns(patterns.filter(x=>x.id!==pt.id));onDone()}}>delete</button>
          )}
        </div>
        {(preview||previewOpts.length>0)&&(
          <div className="muted" style={{fontSize:11.5,marginTop:6,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            live preview vs
            <select style={{...sel,maxWidth:190,padding:'4px 6px'}} value={previewId}
              onChange={e=>setPreviewId(e.target.value)}>
              <option value="">board selection</option>
              {previewOpts.map(o=><option key={o.id} value={o.id}>{o.name} ({o.abbr})</option>)}
            </select>
            {preview?(
              <>
                <b style={{color:'#e8eaf0'}}>{preview.who}</b> —
                <span className={preview.res.match?'v-green':'muted'}>
                  {' '}{preview.res.hardPass}/{preview.res.hardTotal} hard ✓
                  {preview.res.softTotal?` +${preview.res.softPass} soft`:''}
                  {preview.res.match?' — MATCH':''}
                </span>
              </>
            ):<span>— no player to preview</span>}
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

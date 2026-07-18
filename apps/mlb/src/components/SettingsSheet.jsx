import {useRef,useState} from 'react';
import Sheet from './Sheet.jsx';
import {useApp} from '../state/store.jsx';

/* Settings (§3): color rules (ordered, first match wins, drag→arrows),
   sport profile (future), config export/import. */
export default function SettingsSheet({onClose}){
  const {colorRules,setColorRules,profile,exportConfig,importConfig,refresh,exportDayLog}=useApp();
  const fileRef=useRef(null);
  const move=(i,d)=>{
    const next=[...colorRules];
    const j=i+d;
    if(j<0||j>=next.length)return;
    [next[i],next[j]]=[next[j],next[i]];
    setColorRules(next);
  };
  const onImport=async e=>{
    const f=e.target.files?.[0];
    if(!f)return;
    try{importConfig(await f.text());location.reload()}
    catch(err){alert('Import failed: '+err.message)}
  };
  return(
    <Sheet title="Settings" onClose={onClose}>
      <div className="panel" style={{background:'#101319'}}>
        <h3>Sport profile</h3>
        <div className="chip on" style={{cursor:'default'}}>{profile.toUpperCase()}</div>
        <span className="muted" style={{fontSize:11,marginLeft:8}}>active — ciphers & vocab scoped to this profile</span>
      </div>
      <div className="panel" style={{background:'#101319'}}>
        <h3>Color rules — first match wins</h3>
        {colorRules.map((r,i)=>(
          <div key={i} className="rule-row">
            <span className="swatch" style={{background:r.color}}/>
            <span style={{flex:1}}>{r.label||`${r.target.type}: ${r.target.value}`}</span>
            <button className="btn" onClick={()=>move(i,-1)}>↑</button>
            <button className="btn" onClick={()=>move(i,1)}>↓</button>
            <button className="btn" onClick={()=>setColorRules(colorRules.filter((_,j)=>j!==i))}>×</button>
          </div>
        ))}
        <AddRule onAdd={r=>setColorRules([...colorRules,r])}/>
      </div>
      <div className="panel" style={{background:'#101319'}}>
        <h3>Config</h3>
        <div className="sheet-row">
          <button className="btn" onClick={exportConfig}>Export config.json</button>
          <button className="btn" onClick={()=>fileRef.current?.click()}>Import…</button>
          <button className="btn" onClick={refresh}>↻ Reload slate</button>
          <input ref={fileRef} type="file" accept=".json" style={{display:'none'}} onChange={onImport}/>
        </div>
        <div className="sheet-row">
          <button className="btn" onClick={exportDayLog}>Export day log (.json + .md)</button>
          <span className="muted" style={{fontSize:10.5}}>drop into the repo's data/ and logs/</span>
        </div>
      </div>
      <MovePatterns/>
    </Sheet>
  );
}

/* Move patterns between devices (Tony 2026-07-17): localStorage doesn't sync
   phone↔desktop, so Copy dumps your patterns as a text blob you paste into a
   note / text-to-self, and Paste merges a blob in. Merge is BY ID — patterns
   unique to this device are kept; same-id patterns are updated in place. */
const BLOB_SCHEMA='cvg-patterns/v1';

function MovePatterns(){
  const {patterns,setPatterns}=useApp();
  const [mode,setMode]=useState(null); // 'copy' | 'paste' | null
  const [text,setText]=useState('');
  const [msg,setMsg]=useState('');
  const taRef=useRef(null);

  const openCopy=()=>{
    setText(JSON.stringify({schema:BLOB_SCHEMA,patterns}));
    setMsg(`${patterns.length} pattern${patterns.length===1?'':'s'} — copy this whole box`);
    setMode('copy');
  };
  const openPaste=()=>{setText('');setMsg('paste a copied blob, then Merge');setMode('paste');};
  const close=()=>{setMode(null);setText('');setMsg('');};

  const copyClip=async()=>{
    try{await navigator.clipboard.writeText(text);setMsg('Copied to clipboard ✓');}
    catch{taRef.current?.select();setMsg('Clipboard blocked — select-all + copy manually');}
  };

  const merge=()=>{
    let incoming;
    try{
      const parsed=JSON.parse(text.trim());
      incoming=Array.isArray(parsed)?parsed:parsed?.patterns;
    }catch{setMsg('✕ not valid pattern text');return;}
    if(!Array.isArray(incoming)||!incoming.length){setMsg('✕ no patterns found in that text');return;}
    const bad=incoming.find(p=>!p||typeof p.id!=='string'||!Array.isArray(p.conditions));
    if(bad){setMsg('✕ that text has a malformed pattern — nothing changed');return;}
    const byId=new Map(patterns.map(p=>[p.id,p]));
    let added=0,updated=0;
    incoming.forEach(p=>{byId.has(p.id)?updated++:added++;byId.set(p.id,p);});
    setPatterns([...byId.values()]);
    setMsg(`✓ merged — ${added} added, ${updated} updated`);
  };

  return(
    <div className="panel" style={{background:'#101319'}}>
      <h3>Move patterns between devices</h3>
      <div className="sheet-row">
        <button className="btn" onClick={mode==='copy'?close:openCopy}>Copy patterns</button>
        <button className="btn" onClick={mode==='paste'?close:openPaste}>Paste patterns…</button>
      </div>
      <span className="muted" style={{fontSize:10.5}}>
        phone and desktop store patterns separately — copy the text on one, paste it on the other
      </span>
      {mode&&(
        <div style={{marginTop:8}}>
          <textarea ref={taRef} className="post-ta" rows={4}
            readOnly={mode==='copy'} value={text}
            onChange={e=>setText(e.target.value)}
            onFocus={e=>mode==='copy'&&e.target.select()}
            placeholder={mode==='paste'?'paste the copied pattern text here…':''}/>
          <div className="sheet-row" style={{marginTop:6}}>
            {mode==='copy'
              ?<button className="btn acc" onClick={copyClip}>Copy to clipboard</button>
              :<button className="btn acc" onClick={merge}>Merge into this device</button>}
            <button className="btn" onClick={close}>Done</button>
            {msg&&<span className="muted" style={{fontSize:11}}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function AddRule({onAdd}){
  const add=type=>{
    if(type==='number'){
      const v=prompt('Exact number:');
      if(!v||!+v)return;
      const color=prompt('Color (hex):','#ffb02e')||'#ffb02e';
      onAdd({target:{type:'number',value:+v},color,label:`number ${v}`});
    }else if(type==='prefix'){
      const v=prompt('Word prefix (e.g. JESUIT):');
      if(!v)return;
      const color=prompt('Color (hex):','#ffb02e')||'#ffb02e';
      onAdd({target:{type:'prefix',value:v.toUpperCase()},color,label:`${v.toUpperCase()}*`});
    }
  };
  return(
    <div className="sheet-row" style={{marginTop:8}}>
      <button className="btn" onClick={()=>add('number')}>+ number rule</button>
      <button className="btn" onClick={()=>add('prefix')}>+ prefix rule</button>
    </div>
  );
}

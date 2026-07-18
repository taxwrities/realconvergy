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
   phone↔desktop, so Copy emits a transfer CODE you paste into a note /
   text-to-self, and Paste merges it in. Merge is BY ID — patterns unique to
   this device are kept; same-id patterns are updated in place.

   The code is base64 (btoa over UTF-8), NOT raw JSON, on purpose: phone
   keyboards with "smart punctuation" rewrite JSON's straight quotes to curly
   ones in transit, and curly quotes aren't valid JSON — the #1 paste failure.
   base64 is quote-free, so autocorrect can't touch it. Paste still accepts
   plain JSON and even auto-straightens curly-quoted JSON as a rescue path. */
const BLOB_SCHEMA='cvg-patterns/v1';

/* UTF-8-safe base64 (examples carry curly quotes → non-Latin1) */
const b64encode=s=>btoa(unescape(encodeURIComponent(s)));
const b64decode=s=>decodeURIComponent(escape(atob(s)));

/* text → patterns[] | null. Tries, in order: base64 transfer code, plain
   JSON, then smart-quote-straightened JSON (last-resort rescue). */
function readBlob(raw){
  const t=(raw||'').trim();
  if(!t)return null;
  const tryJson=s=>{try{const o=JSON.parse(s);return Array.isArray(o)?o:o?.patterns}catch{return undefined}};
  // 1) base64 transfer code (quote-free — the format Copy emits)
  if(/^[A-Za-z0-9+/=\s]+$/.test(t)&&!t.includes('{')){
    try{const got=tryJson(b64decode(t.replace(/\s+/g,'')));if(Array.isArray(got))return got;}catch{/* not our code */}
  }
  // 2) plain JSON (delimiters survived intact)
  let got=tryJson(t);
  if(Array.isArray(got))return got;
  // 3) curly-quote-mangled JSON — straighten quotes/apostrophes and retry
  got=tryJson(t.replace(/[“”]/g,'"').replace(/[‘’]/g,"'"));
  return Array.isArray(got)?got:null;
}

function MovePatterns(){
  const {patterns,setPatterns}=useApp();
  const [mode,setMode]=useState(null); // 'copy' | 'paste' | null
  const [text,setText]=useState('');
  const [msg,setMsg]=useState('');
  const taRef=useRef(null);

  const openCopy=()=>{
    setText(b64encode(JSON.stringify({schema:BLOB_SCHEMA,patterns})));
    setMsg(`${patterns.length} pattern${patterns.length===1?'':'s'} — copy this whole code`);
    setMode('copy');
  };
  const openPaste=()=>{setText('');setMsg('paste a copied code, then Merge');setMode('paste');};
  const close=()=>{setMode(null);setText('');setMsg('');};

  const copyClip=async()=>{
    try{await navigator.clipboard.writeText(text);setMsg('Copied to clipboard ✓');}
    catch{taRef.current?.select();setMsg('Clipboard blocked — select-all + copy manually');}
  };

  const merge=()=>{
    const incoming=readBlob(text);
    if(!incoming||!incoming.length){setMsg('✕ couldn’t read that — re-copy on the source device (use “Copy to clipboard”) and paste the whole code');return;}
    const bad=incoming.find(p=>!p||typeof p.id!=='string'||!Array.isArray(p.conditions));
    if(bad){setMsg('✕ that code has a malformed pattern — nothing changed');return;}
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
        phone and desktop store patterns separately — copy the code on one, paste it on the other
      </span>
      {mode&&(
        <div style={{marginTop:8}}>
          <textarea ref={taRef} className="post-ta" rows={4}
            readOnly={mode==='copy'} value={text}
            onChange={e=>setText(e.target.value)}
            onFocus={e=>mode==='copy'&&e.target.select()}
            placeholder={mode==='paste'?'paste the copied transfer code here…':''}/>
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

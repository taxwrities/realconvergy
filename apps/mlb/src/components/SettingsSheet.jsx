import {useRef} from 'react';
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
        <span className="muted" style={{fontSize:11,marginLeft:8}}>WNBA profile ships later — schema ready</span>
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
    </Sheet>
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

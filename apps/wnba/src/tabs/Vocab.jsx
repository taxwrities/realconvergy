import {useState} from 'react';
import {useApp} from '../state/store.jsx';
import {calcAll,ALL_CIPHERS,cl,checksum} from '../engine/gematria.js';
import {OUTCOME_WORDS} from '../data/defaults.js';

/* Vocab tab — LAYOUT-SPEC §7: cipher toggles per profile, core table
   editor (checksum-gated saves), phrase system (templates + literals). */
export default function VocabTab(){
  return(
    <div>
      <CipherToggles/>
      <CoreTable/>
      <Phrases/>
    </div>
  );
}

function CipherToggles(){
  const {ciphers,setCiphers,profile}=useApp();
  const toggle=c=>{
    const next={...ciphers,[c]:!ciphers[c]};
    if(Object.values(next).some(Boolean))setCiphers(next);
  };
  return(
    <div className="panel">
      <h3>Ciphers — {profile.toUpperCase()} profile (recomputes everything)</h3>
      <div className="rail">
        {ALL_CIPHERS.map(c=>(
          <button key={c} className={`chip${ciphers[c]?' on':''}`} onClick={()=>toggle(c)}>
            {ciphers[c]?cl(c):<span className="strike">{cl(c)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function CoreTable(){
  const {vocab,saveVocab,ciphers}=useApp();
  const [newWord,setNewWord]=useState('');
  const [msg,setMsg]=useState('');
  const enabled=ALL_CIPHERS.filter(c=>ciphers[c]);
  const commit=next=>{
    const r=saveVocab(next);
    setMsg(r.ok?`✓ saved — checksum OK (JESUIT ORDER 144/54/153/72/529)`:r.msg);
  };
  const add=()=>{
    const w=newWord.trim().toUpperCase();
    if(!w||vocab.some(v=>v.word===w))return;
    commit([...vocab,{word:w,enabled:true,source:'manual',values:calcAll(w)}]);
    setNewWord('');
  };
  return(
    <div className="panel">
      <h3>Core table — WNBA scope only (no MLB vocab, cross-sport lock)</h3>
      <div style={{overflowX:'auto'}}>
        <table className="vtable">
          <thead>
            <tr><th>word</th>{enabled.map(c=><th key={c}>{c}</th>)}<th/><th/></tr>
          </thead>
          <tbody>
            {vocab.map((v,i)=>(
              <tr key={v.word} className={v.enabled?'':'off'}>
                <td className="w">{v.word}</td>
                {enabled.map(c=><td key={c}>{v.values[c]}</td>)}
                <td>
                  <button className="btn" style={{padding:'2px 8px',fontSize:10}}
                    onClick={()=>commit(vocab.map((x,j)=>j===i?{...x,enabled:!x.enabled}:x))}>
                    {v.enabled?'on':'off'}
                  </button>
                </td>
                <td>
                  {v.source!=='core'&&(
                    <button className="btn" style={{padding:'2px 8px',fontSize:10}}
                      onClick={()=>commit(vocab.filter((_,j)=>j!==i))}>×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sheet-row" style={{marginTop:10}}>
        <input type="text" placeholder="add word…" value={newWord}
          style={{background:'#101319',border:'1px solid #2a303c',borderRadius:8,color:'#e8eaf0',
            padding:'8px 10px',flex:1,fontFamily:'var(--cvg-mono)',fontSize:13}}
          onChange={e=>setNewWord(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&add()}/>
        <button className="btn acc" style={{background:'#101319',border:'1px solid var(--cvg-purple)',
          color:'var(--cvg-purple)',borderRadius:8,padding:'8px 12px',cursor:'pointer'}} onClick={add}>+ add</button>
      </div>
      {msg&&<div className={msg.startsWith('✓')?'v-green':'v-red'} style={{fontSize:11.5,marginTop:6}}>{msg}</div>}
      <div className="muted" style={{fontSize:11,marginTop:6}}>
        boot checksum: {checksum().ok?'OK':'FAILED'} · benchmark before deleting rows — toggle off first
      </div>
    </div>
  );
}

function Phrases(){
  const {phrases,setPhrases,addPhrase,templates,setTemplates,ciphers}=useApp();
  const [txt,setTxt]=useState('');
  const [tok,setTok]=useState('{batter full}');
  const [word,setWord]=useState('HOME RUN');
  const TOKENS=['{batter full}','{batter last}','{batter first}','{opp pitcher}','{team}','{opp team}','{stadium}','{theme figure}','{day of week}'];
  const enabled=ALL_CIPHERS.filter(c=>ciphers[c]);
  return(
    <div className="panel">
      <h3>Phrases — templates (global) + literals</h3>
      <div className="sheet-row">
        <select value={tok} onChange={e=>setTok(e.target.value)}
          style={{background:'#101319',border:'1px solid #2a303c',borderRadius:8,color:'#e8eaf0',padding:'8px'}}>
          {TOKENS.map(t=><option key={t}>{t}</option>)}
        </select>
        <select value={word} onChange={e=>setWord(e.target.value)}
          style={{background:'#101319',border:'1px solid #2a303c',borderRadius:8,color:'#e8eaf0',padding:'8px'}}>
          {OUTCOME_WORDS.map(w=><option key={w.word}>{w.word}</option>)}
        </select>
        <button className="btn acc" style={{background:'#101319',border:'1px solid var(--cvg-purple)',
          color:'var(--cvg-purple)',borderRadius:8,padding:'8px 12px',cursor:'pointer'}}
          onClick={()=>{
            const id=`${tok}+${word}`;
            if(!templates.some(t=>t.id===id))
              setTemplates([...templates,{id,tokens:[tok],word,label:`${tok} + ${word}`}]);
          }}>+ template</button>
      </div>
      {templates.map(t=>(
        <div key={t.id} className="occ">
          <span className="v-purple">{t.label}</span>
          <span className="muted" style={{fontSize:11}}> — resolves per entity at scan time (pattern source, Phase 2)</span>
          <button className="btn" style={{marginLeft:8,padding:'1px 7px',fontSize:10}}
            onClick={()=>setTemplates(templates.filter(x=>x.id!==t.id))}>×</button>
        </div>
      ))}
      <div className="sheet-row" style={{marginTop:10}}>
        <input type="text" placeholder="literal phrase…" value={txt}
          style={{background:'#101319',border:'1px solid #2a303c',borderRadius:8,color:'#e8eaf0',
            padding:'8px 10px',flex:1,fontFamily:'var(--cvg-mono)',fontSize:13}}
          onChange={e=>setTxt(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&txt.trim()){addPhrase(txt);setTxt('')}}}/>
      </div>
      {phrases.map((p,i)=>(
        <div key={i} className="occ mono" style={{fontSize:12}}>
          "{p.text}" · {enabled.map(c=>`${c} ${p.values[c]}`).join(' · ')}
          <button className="btn" style={{marginLeft:8,padding:'1px 7px',fontSize:10}}
            onClick={()=>setPhrases(phrases.filter((_,j)=>j!==i))}>×</button>
        </div>
      ))}
    </div>
  );
}

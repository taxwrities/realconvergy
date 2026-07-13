import {useState} from 'react';
import Sheet from './Sheet.jsx';
import {useApp} from '../state/store.jsx';
import {calcAll,ALL_CIPHERS} from '../engine/gematria.js';

/* Quick-add (§8): four actions, live board re-score, persisted for the day.
   Today's themes list a graduation flow into the registry (§10.4). */
export default function QuickAddSheet({onClose}){
  const {addTheme,addThread,addPhrase,addLabel,board,ciphers,dayState,graduateTheme,game}=useApp();
  const [theme,setTheme]=useState('');
  const [num,setNum]=useState('');
  const [word,setWord]=useState('');
  const [labelWho,setLabelWho]=useState('');
  const [labelTxt,setLabelTxt]=useState('');
  const roster=[...board.away,...board.home];
  const preview=theme.trim()?calcAll(theme):null;
  return(
    <Sheet title="Quick add" onClose={onClose}>
      <div className="sheet-row">
        <input type="text" placeholder="theme figure (name) → today's rail" value={theme}
          onChange={e=>setTheme(e.target.value)}/>
        <button className="btn acc" onClick={()=>{if(theme.trim()){addTheme(theme);setTheme('')}}}>+ theme</button>
      </div>
      {preview&&(
        <div className="name-run" style={{marginBottom:10}}>
          {ALL_CIPHERS.filter(c=>ciphers[c]).map(c=>(
            <span key={c} className="v-purple"><span className="muted">{c}</span> <b>{preview[c]}</b></span>
          ))}
        </div>
      )}
      <div className="sheet-row">
        <input type="number" placeholder="number → today's thread" value={num}
          onChange={e=>setNum(e.target.value)}/>
        <button className="btn acc" onClick={()=>{if(+num>0){addThread(num);setNum('')}}}>+ thread</button>
      </div>
      <div className="sheet-row">
        <input type="text" placeholder="phrase / word → vocab" value={word}
          onChange={e=>setWord(e.target.value)}/>
        <button className="btn acc" onClick={()=>{if(word.trim()){addPhrase(word);setWord('')}}}>+ phrase</button>
      </div>
      <div className="sheet-row">
        <select value={labelWho} onChange={e=>setLabelWho(e.target.value)}
          style={{background:'#101319',border:'1px solid #2a303c',borderRadius:8,color:'#e8eaf0',padding:'9px 8px',flex:1}}>
          <option value="">player…</option>
          {roster.map(r=><option key={r.id} value={r.id}>{r.ev.p.fullName}</option>)}
        </select>
        <input type="text" placeholder="label (WILDCARD…)" value={labelTxt} style={{flex:1}}
          onChange={e=>setLabelTxt(e.target.value)}/>
        <button className="btn acc" onClick={()=>{
          if(labelWho&&labelTxt.trim()){addLabel(labelWho,labelTxt.trim().toUpperCase());setLabelTxt('')}
        }}>+ label</button>
      </div>
      {dayState.adhocThemes.length>0&&(
        <div className="panel" style={{background:'#101319',marginTop:4}}>
          <h3>Today's themes — graduate keepers to the registry</h3>
          {dayState.adhocThemes.map(t=>(
            <div key={t.name} className="sheet-row" style={{marginBottom:6}}>
              <span className="v-purple" style={{flex:1,fontWeight:600}}>{t.name}</span>
              <button className="btn" onClick={()=>graduateTheme(t.name,
                game?[game.home.teamName,game.away.teamName]:[])}>
                → registry{game?` (${game.away.abbrev||game.away.teamName}/${game.home.abbrev||game.home.teamName})`:''}
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

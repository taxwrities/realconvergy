import {useState} from 'react';
import {useApp} from './state/store.jsx';
import BoardTab from './tabs/Board.jsx';
import PatternsTab from './tabs/Patterns.jsx';
import ForecastTab from './tabs/Forecast.jsx';
import VocabTab from './tabs/Vocab.jsx';
import SearchSheet from './components/SearchSheet.jsx';
import QuickAddSheet from './components/QuickAddSheet.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';

const TABS=[
  {id:'board',label:'Board',ico:'▦'},
  {id:'patterns',label:'Patterns',ico:'⌘'},
  {id:'forecast',label:'Forecast',ico:'⟡'},
  {id:'vocab',label:'Vocab',ico:'Ꮙ'},
];

export default function App(){
  const {boot,date,error}=useApp();
  /* tab state lives here so switches preserve each tab's internal state (§3) —
     all four stay mounted; CSS hides the inactive ones */
  const [tab,setTab]=useState('board');
  const [sheet,setSheet]=useState(null); // 'search' | 'quickadd' | 'settings'

  return(
    <div className="shell">
      <header className="shell-header">
        <div>
          <div className="shell-title">CON<em>VERGENCE</em></div>
          <div className="shell-sub">{date} · WNBA</div>
        </div>
        <div className="shell-actions">
          <button className="icon-btn" aria-label="Search" onClick={()=>setSheet('search')}>⌕</button>
          <button className="icon-btn" aria-label="Quick add" onClick={()=>setSheet('quickadd')}>＋</button>
          <button className="icon-btn" aria-label="Settings" onClick={()=>setSheet('settings')}>⚙</button>
        </div>
      </header>

      <main className="shell-main">
        {!boot.ok&&(
          <div className="err-banner">
            ENGINE CHECKSUM FAILED — JESUIT ORDER returned {JSON.stringify(boot.got)}.
            Values are not trustworthy; do not use this board.
          </div>
        )}
        {error&&<div className="err-banner">{error}</div>}
        <div style={{display:tab==='board'?'block':'none'}}><BoardTab/></div>
        <div style={{display:tab==='patterns'?'block':'none'}}><PatternsTab/></div>
        <div style={{display:tab==='forecast'?'block':'none'}}><ForecastTab/></div>
        <div style={{display:tab==='vocab'?'block':'none'}}><VocabTab/></div>
      </main>

      <nav className="tabbar">
        {TABS.map(t=>(
          <button key={t.id} className={tab===t.id?'on':''} onClick={()=>setTab(t.id)}>
            <span className="ico">{t.ico}</span>{t.label}
          </button>
        ))}
      </nav>

      {sheet==='search'&&<SearchSheet onClose={()=>setSheet(null)}/>}
      {sheet==='quickadd'&&<QuickAddSheet onClose={()=>setSheet(null)}/>}
      {sheet==='settings'&&<SettingsSheet onClose={()=>setSheet(null)}/>}
    </div>
  );
}

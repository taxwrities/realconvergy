import {useState} from 'react';
import {useApp} from './state/store.jsx';
import BoardTab from './tabs/Board.jsx';
import PatternsTab from './tabs/Patterns.jsx';
import ForecastTab from './tabs/Forecast.jsx';
import SplitsTab from './tabs/Splits.jsx';
import VocabTab from './tabs/Vocab.jsx';
import SearchSheet from './components/SearchSheet.jsx';
import QuickAddSheet from './components/QuickAddSheet.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';

/* stroke icons for the tab dock — inline so they tint via currentColor */
const svg=(paths)=>(
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
);
const TABS=[
  {id:'board',label:'Board',ico:svg(<><rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/></>)},
  {id:'patterns',label:'Patterns',ico:svg(<><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 15l9 5 9-5"/></>)},
  {id:'forecast',label:'Forecast',ico:svg(<path d="M12 3c.7 4.6 3.4 7.3 8 8-4.6.7-7.3 3.4-8 8-.7-4.6-3.4-7.3-8-8 4.6-.7 7.3-3.4 8-8z"/>)},
  {id:'splits',label:'Splits',ico:svg(<><path d="M4 20V10M10 20V4M16 20v-7M22 20h-20"/></>)},
  {id:'vocab',label:'Vocab',ico:svg(<><path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/></>)},
];

export default function App(){
  const {boot,date,error,searchOpen,setSearchOpen}=useApp();
  /* tab state lives here so switches preserve each tab's internal state (§3) —
     all four stay mounted; CSS hides the inactive ones */
  const [tab,setTab]=useState('board');
  const [sheet,setSheet]=useState(null); // 'quickadd' | 'settings'

  return(
    <>
    {/* the shell stays MOUNTED but hidden while the Search page owns the
       viewport, so every tab keeps its state and the page renders on top. */}
    <div className="shell" style={searchOpen?{display:'none'}:undefined}>
      <header className="shell-header">
        <div>
          <div className="shell-title">CON<em>VERGENCE</em></div>
          <div className="shell-sub">{date}<span className="lg-pill">WNBA</span></div>
        </div>
        <div className="shell-actions">
          {/* header actions share the tabbar's hand-drawn 1.8-stroke svg() voice —
              no OS-rendered dingbats next to the line-icon set */}
          <button className="icon-btn" aria-label="Search" onClick={()=>setSearchOpen(true)}>{svg(<><circle cx="11" cy="11" r="6.5"/><path d="m20.5 20.5-4.2-4.2"/></>)}</button>
          <button className="icon-btn" aria-label="Quick add" onClick={()=>setSheet('quickadd')}>{svg(<path d="M12 5v14M5 12h14"/>)}</button>
          <button className="icon-btn" aria-label="Settings" onClick={()=>setSheet('settings')}>{svg(<><circle cx="12" cy="12" r="3.1"/><path d="M12 2.7v2.5M12 18.8v2.5M2.7 12h2.5M18.8 12h2.5M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"/></>)}</button>
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
        <div style={{display:tab==='patterns'?'block':'none'}}><PatternsTab goBoard={()=>setTab('board')}/></div>
        <div style={{display:tab==='forecast'?'block':'none'}}><ForecastTab/></div>
        {/* `active` (not mount) drives the lazy index fetch — every tab stays mounted */}
        <div style={{display:tab==='splits'?'block':'none'}}><SplitsTab active={tab==='splits'}/></div>
        <div style={{display:tab==='vocab'?'block':'none'}}><VocabTab/></div>
      </main>

      <nav className="tabbar">
        {TABS.map(t=>(
          <button key={t.id} className={tab===t.id?'on':''} onClick={()=>setTab(t.id)}>
            <span className="ico">{t.ico}</span>{t.label}
          </button>
        ))}
      </nav>

      {sheet==='quickadd'&&<QuickAddSheet onClose={()=>setSheet(null)}/>}
      {sheet==='settings'&&<SettingsSheet onClose={()=>setSheet(null)}/>}
    </div>
    {searchOpen&&<SearchSheet onClose={()=>setSearchOpen(false)}/>}
    </>
  );
}

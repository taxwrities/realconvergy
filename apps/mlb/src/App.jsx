import {useState,useEffect} from 'react';
import {useApp} from './state/store.jsx';
import BoardTab from './tabs/Board.jsx';
import PatternsTab from './tabs/Patterns.jsx';
import ForecastTab from './tabs/Forecast.jsx';
import VocabTab from './tabs/Vocab.jsx';
import SearchSheet from './components/SearchSheet.jsx';
import QuickAddSheet from './components/QuickAddSheet.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';
import PlayerCardFullSheet from './components/PlayerCardFullSheet.jsx';

/* stroke icons for the tab dock — inline so they tint via currentColor */
const svg=(paths)=>(
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
);
const TABS=[
  {id:'board',label:'Board',ico:svg(<><rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/></>)},
  {id:'patterns',label:'Patterns',ico:svg(<><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 15l9 5 9-5"/></>)},
  {id:'forecast',label:'Forecast',ico:svg(<path d="M12 3c.7 4.6 3.4 7.3 8 8-4.6.7-7.3 3.4-8 8-.7-4.6-3.4-7.3-8-8 4.6-.7 7.3-3.4 8-8z"/>)},
  {id:'vocab',label:'Vocab',ico:svg(<><path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/></>)},
];

export default function App(){
  const {boot,date,error,board,focusedPlayerId,setFocusedPlayerId,searchOpen,setSearchOpen}=useApp();
  /* tab state lives here so switches preserve each tab's internal state (§3) —
     all four stay mounted; CSS hides the inactive ones */
  const [tab,setTab]=useState('board');
  const [sheet,setSheet]=useState(null); // 'search' | 'quickadd' | 'settings'

  /* full-sheet player page (Tony 2026-07-22): a dedicated destination that owns
     the viewport. The shell below stays MOUNTED (display:none) so every tab keeps
     its state — the page just renders on top and the shell isn't visible. */
  const focusedRow=focusedPlayerId!=null
    ?(board.away?.find(r=>r.id===focusedPlayerId)||board.home?.find(r=>r.id===focusedPlayerId)||null)
    :null;
  /* stale focus (slate/date changed out from under us) → fall back to the Board */
  useEffect(()=>{if(focusedPlayerId!=null&&!focusedRow)setFocusedPlayerId(null)},
    [focusedPlayerId,focusedRow,setFocusedPlayerId]);

  /* the shell stays MOUNTED but hidden whenever a full-viewport page (the
     Search page or a focused player's full sheet) owns the screen — so every
     tab keeps its state and the page just renders on top. */
  const shellHidden=focusedRow||searchOpen;

  return(
    <>
    <div className="shell" style={shellHidden?{display:'none'}:undefined}>
      <header className="shell-header">
        <div>
          <div className="shell-title">CON<em>VERGENCE</em></div>
          <div className="shell-sub">{date}<span className="lg-pill">MLB</span></div>
        </div>
        <div className="shell-actions">
          <button className="icon-btn" aria-label="Search" onClick={()=>setSearchOpen(true)}>⌕</button>
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
        <div style={{display:tab==='board'?'block':'none'}}><BoardTab goPatterns={()=>setTab('patterns')}/></div>
        <div style={{display:tab==='patterns'?'block':'none'}}><PatternsTab goBoard={()=>setTab('board')}/></div>
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

      {sheet==='quickadd'&&<QuickAddSheet onClose={()=>setSheet(null)}/>}
      {sheet==='settings'&&<SettingsSheet onClose={()=>setSheet(null)}/>}
    </div>
    {/* Search page stays MOUNTED (display:none) when a full-sheet opens over it
        from a search result — so returning restores its filters / results /
        scroll exactly. Same display:none trick as the board shell above. */}
    {searchOpen&&(
      <div style={focusedRow?{display:'none'}:undefined}>
        <SearchSheet onClose={()=>setSearchOpen(false)}/>
      </div>
    )}
    {focusedRow&&<PlayerCardFullSheet row={focusedRow} onClose={()=>setFocusedPlayerId(null)}/>}
    </>
  );
}

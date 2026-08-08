import {useState,useEffect,useMemo,useRef} from 'react';
import {useApp} from '../state/store.jsx';
import {daysBetween} from '../engine/clocks.js';
import {loadIndex,loadPlayer,bucketRows,computeSplits,qualifyingGames,
  QUERY_STATS,TABLE_STATS,FLAG_STATS} from '../data/splits.js';

/* ================================================================
   Splits tab — career game logs + precomputed splits for the 262
   players active in 2025/26 (README-wnba-splits.md).

   RAW STATS ONLY. No gematria, no scoring, no lane/pattern logic —
   Tony judges match value himself. This tab reads its own static
   JSON and touches nothing the Board owns.

   Date handling goes through the app's existing path: `date` and
   `dn.dayName` come from the store (todayISO + dateNumerology), and
   day spans use clocks.daysBetween. No second date implementation.
================================================================ */

const VIEWS=[
  {id:'weekday',   label:'Weekday',  kind:'weekday'},
  {id:'month',     label:'Month',    kind:'month'},
  {id:'opponent',  label:'Opponent', kind:'opponent'},
  {id:'homeaway',  label:'H/A',      kind:'homeaway'},
  {id:'seasontype',label:'Reg/Pst',  kind:'seasontype'},
  {id:'query',     label:'Query'},
];
const ROW_LABEL={H:'Home',A:'Away',REG:'Regular season',PST:'Playoffs'};
const STAT_LABEL={pts:'PTS',reb:'REB',ast:'AST',stl:'STL',blk:'BLK',
  '3pm':'3PM','3pa':'3PA',fgm:'FGM',fga:'FGA',ftm:'FTM',fta:'FTA',to:'TO',min:'MIN',
  fb:'FB',fp:'FP'};
/* long forms for the flag stats — "FB" is fine as a column head, but the Query
   headline and empty state need to say what it actually means */
const STAT_LONG={fb:'first basket',fp:'first point'};

export default function SplitsTab({active}){
  const {date,dn,settings,setSettings}=useApp();
  /* global include-playoffs toggle (Tony 2026-08-08) — the SAME setting the
     Board's Refine chip flips; here it re-buckets every split table from the
     shipped log and widens the Query sweep. Default off = bbref regular. */
  const incPost=!!settings.includePlayoffs;
  const togglePost=()=>setSettings({...settings,includePlayoffs:!incPost});
  const [index,setIndex]=useState(null);
  const [err,setErr]=useState('');
  const [q,setQ]=useState('');
  const [sel,setSel]=useState(null);        // selected player name
  const [player,setPlayer]=useState(null);
  const [busy,setBusy]=useState('');
  const [view,setView]=useState('weekday');
  /* Query state lives here, not in QueryView: switching sub-views unmounts the
     child, and App's convention is that switching preserves a tab's state. */
  const [stat,setStat]=useState('pts');
  const [thr,setThr]=useState('20');
  const [ran,setRan]=useState(null);        // {stat, threshold} — committed on Run

  /* index.json on first open of the tab — App keeps every tab mounted, so
     `active` (not mount) is what "tab open" means here. */
  useEffect(()=>{
    if(!active||index)return;
    setErr('');
    loadIndex().then(setIndex).catch(e=>setErr('Could not load the splits index: '+e.message));
  },[active,index]);

  const names=useMemo(()=>index?Object.keys(index).sort((a,b)=>a.localeCompare(b)):[],[index]);
  const matches=useMemo(()=>{
    const s=q.trim().toLowerCase();
    if(!s)return[];
    return names.filter(n=>n.toLowerCase().includes(s)).slice(0,12);
  },[q,names]);

  const pick=name=>{
    const meta=index[name];
    if(!meta)return;
    setSel(name);setQ('');setPlayer(null);setErr('');setRan(null);setBusy('Loading '+name+'…');
    loadPlayer(meta.id)
      .then(p=>{setPlayer(p);setBusy('')})
      .catch(e=>{setBusy('');setErr('Could not load '+name+': '+e.message)});
  };

  return(
    <div>
      <div className="panel">
        <h3>Career splits · {index?`${names.length} players`:'loading index…'}</h3>
        <div className="sp-search">
          <input type="text" value={q} placeholder="Search player…"
            onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&matches.length)pick(matches[0])}}/>
          {sel&&<button className="btn" onClick={()=>{setSel(null);setPlayer(null);setQ('')}}>clear</button>}
        </div>
        {matches.length>0&&(
          <div className="sp-typeahead">
            {matches.map(n=>(
              <button key={n} className="sp-hit" onClick={()=>pick(n)}>
                <span className="sp-hit-nm">{n}</span>
                <span className="sp-hit-meta">{index[n].team} {index[n].pos} · {index[n].games} G</span>
              </button>
            ))}
          </div>
        )}
        {err&&<div className="err-banner" style={{marginTop:8}}>{err}</div>}
        {!sel&&!busy&&!err&&<div className="muted" style={{marginTop:8,fontSize:12.5}}>
          Career game logs 2003-present. Splits by weekday, month, opponent, home/away
          and season type, plus a threshold query with days-since spans.
        </div>}
      </div>

      {busy&&!player&&<SplitsSkeleton/>}
      {player&&(
        <div className="sp-in" key={player.athlete_id}>
          <PlayerHead p={player}/>
          <div className="rail">
            {VIEWS.map(v=>(
              <button key={v.id} className={`chip${view===v.id?' on':''}`}
                onClick={()=>setView(v.id)}>{v.label}</button>
            ))}
            <button className={`chip gold${incPost?' on':''}`}
              title="Include playoff games in the split tables and the Query sweep"
              onClick={togglePost}>+ Playoffs</button>
          </div>
          {view==='query'
            ?<QueryView player={player} today={date} incPost={incPost}
               stat={stat} setStat={setStat} thr={thr} setThr={setThr}
               ran={ran} setRan={setRan}/>
            :<SplitTable player={player} kind={VIEWS.find(v=>v.id===view).kind}
               todayName={dn?.dayName} incPost={incPost}/>}
        </div>
      )}
    </div>
  );
}

/* identity card (redesign 2026-08-08): name block left, career-games stat
   right — the games count is the head's one number, so it reads as a stat,
   not a metadata afterthought. */
function PlayerHead({p}){
  return(
    <div className="panel sp-head">
      <div className="sp-head-main">
        <div className="sp-head-nm">{p.name}</div>
        <div className="sp-head-meta">{p.team} {p.pos}</div>
        <div className="sp-head-span">{p.first_game} → {p.last_game}</div>
      </div>
      <div className="sp-head-stats">
        <div className="sp-head-g">
          <div className="sp-head-g-n">{p.games}</div>
          <div className="sp-head-g-l">career games</div>
        </div>
        {p.fb!=null&&(
          <div className="sp-head-g">
            <div className="sp-head-g-n v-gold">{p.fb}</div>
            <div className="sp-head-g-l">first baskets</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* skeleton mirroring the loaded layout (head card → view rail → table) so the
   player switch doesn't flash a bare text line */
function SplitsSkeleton(){
  return(
    <div className="sp-skel" aria-hidden="true">
      <div className="panel"><div className="sk sk-nm"/><div className="sk sk-meta"/></div>
      <div className="sk-rail">
        {Array.from({length:6},(_,i)=><div key={i} className="sk sk-chip"/>)}
      </div>
      <div className="panel">
        <div className="sk sk-row"/><div className="sk sk-row"/>
        <div className="sk sk-row"/><div className="sk sk-row"/>
      </div>
    </div>
  );
}

/* One splits bucket as a table. Sums are season-long totals; avg is sum/g.
   Only PTS carries an average column — the table is already 8 wide and the
   tab is mobile-first, so the rest stay totals (spec). */
function SplitTable({player,kind,todayName,incPost}){
  /* buckets recompute from the shipped log per the toggle (Tony 2026-08-08) —
     the precomputed splits in the JSON are the bbref-regular default only */
  const splits=useMemo(()=>computeSplits(player,incPost),[player,incPost]);
  const rows=bucketRows(splits,kind);
  if(!rows.length)return <div className="panel muted">No {kind} splits for this player.</div>;
  const avg=(n,g)=>g>0?(n/g).toFixed(1):'-';
  return(
    <div className="panel">
      <h3>{kind==='homeaway'?'Home / Away':kind==='seasontype'?'Regular / Postseason':kind}
        {/* scope tag: which game class feeds this table (Reg/Pst always both) */}
        {kind!=='seasontype'&&<span className="sp-today-tag"> · {incPost?'incl. playoffs':'regular season'}</span>}
        {kind==='weekday'&&todayName&&<span className="sp-today-tag"> · today is {todayName}</span>}</h3>
      <div className="sp-scroll">
        <table className="vtable sp-table">
          <thead>
            <tr>
              <th>{kind==='opponent'?'OPP':kind==='weekday'?'DAY':''}</th>
              <th>G</th><th>PTS</th><th>AVG</th>
              {TABLE_STATS.filter(s=>s!=='pts').map(s=><th key={s}>{STAT_LABEL[s]}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>{
              const isToday=kind==='weekday'&&r.key===todayName;
              return(
                <tr key={r.key} className={isToday?'sp-today':undefined}>
                  <td className="w">{ROW_LABEL[r.key]||r.key}</td>
                  <td>{r.g??'-'}</td>
                  <td>{r.pts??'-'}</td>
                  <td className="sp-avg">{avg(r.pts,r.g)}</td>
                  {TABLE_STATS.filter(s=>s!=='pts').map(s=><td key={s}>{r[s]??'-'}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {kind==='opponent'&&<div className="muted sp-foot">
        Opponent codes come straight from the source logs. Connecticut shows under
        both CON and CONN. All-Star and exhibition games are excluded everywhere.
      </div>}
    </div>
  );
}

/* QUERY — "last N+ STAT" with the days-since span as the headline number. */
function QueryView({player,today,incPost,stat,setStat,thr,setThr,ran,setRan}){
  const [copied,setCopied]=useState(false);
  const copyTimer=useRef(null);
  useEffect(()=>()=>{if(copyTimer.current)clearTimeout(copyTimer.current)},[]);

  /* fb/fp are yes-no per game: the threshold is meaningless, so it locks to 1
     and the copy switches from "N+ of a stat" to "games they got it" */
  const isFlag=FLAG_STATS.has(stat);
  const run=()=>{
    if(isFlag){setRan({stat,threshold:1});return}
    const n=parseInt(thr,10);
    if(!Number.isFinite(n))return;
    setRan({stat,threshold:n});
  };
  /* label for whatever the committed query was (not the current dropdown) */
  const ranFlag=ran&&FLAG_STATS.has(ran.stat);
  const ranLabel=ran?(ranFlag?STAT_LONG[ran.stat]:`${ran.threshold}+ ${STAT_LABEL[ran.stat]}`):'';

  const games=useMemo(()=>{
    if(!ran)return null;
    const raw=qualifyingGames(player,ran.stat,ran.threshold,incPost);
    /* .map() would drop the played/rate properties the helper attaches */
    const out=raw.map(g=>({...g,daysAgo:daysBetween(g.date,today)}));
    out.played=raw.played;out.rate=raw.rate;
    return out;
  },[ran,player,today,incPost]);

  const copy=n=>{
    try{
      navigator.clipboard?.writeText(String(n));
      setCopied(true);
      if(copyTimer.current)clearTimeout(copyTimer.current);
      copyTimer.current=setTimeout(()=>setCopied(false),1400);
    }catch{/* clipboard blocked — the number is still on screen */}
  };

  const last=games&&games[0];
  return(
    <>
      <div className="panel">
        <h3>Query: {isFlag?'first basket / first point':'last N+ of a stat'}
          <span className="sp-today-tag"> · {incPost?'incl. playoffs':'regular season'}</span></h3>
        <div className="sp-query-row">
          <select value={stat} onChange={e=>setStat(e.target.value)} className="sp-select">
            {QUERY_STATS.map(s=><option key={s} value={s}>{STAT_LONG[s]||STAT_LABEL[s]}</option>)}
          </select>
          {!isFlag&&(
            <input type="number" inputMode="numeric" value={thr} min="0"
              onChange={e=>setThr(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')run()}} className="sp-thr"/>
          )}
          <button className="btn acc" onClick={run}>Run</button>
        </div>
        {isFlag&&<div className="muted" style={{marginTop:7,fontSize:11.5}}>
          {stat==='fb'
            ?'First made field goal of the game. Free throws are skipped, matching the sportsbook convention.'
            :'First points of the game, free throws included.'}
        </div>}
      </div>

      {games&&(games.length===0
        ?<div className="panel muted">
           No {incPost?'':'regular-season '}game with {ranLabel}.{incPost?'':' (+ Playoffs widens the sweep.)'}
         </div>
        :<>
          <div className="panel sp-last">
            <h3>Last {ranLabel}</h3>
            <div className="sp-last-line mono">
              {last.date} {last.ha==='H'?'vs':'@'} {last.opp}
              {!ranFlag&&<span className="sp-last-val"> ({last.value})</span>}
              {ranFlag&&<span className="sp-last-val"> ({last.pts} pts)</span>}
              {last.st===3&&<span className="badge purple" style={{marginLeft:6}}>PST</span>}
            </div>
            <button className="sp-days" onClick={()=>copy(last.daysAgo)}
              title="tap to copy the number">
              <span className="sp-days-n">{last.daysAgo}</span>
              <span className="sp-days-l">{copied?'copied':'days ago'}</span>
            </button>
            <div className="sp-count mono">
              {games.length} career game{games.length===1?'':'s'} with {ranLabel}
              {ranFlag&&games.rate!=null&&<> · {games.rate}% of {games.played} played</>}
            </div>
          </div>

          <div className="panel">
            <h3>All qualifying games · newest first</h3>
            <div className="sp-scroll sp-list">
              <table className="vtable sp-table">
                <thead><tr><th>DATE</th><th>OPP</th><th>{ranFlag?'PTS':STAT_LABEL[ran.stat]}</th><th>DAYS AGO</th></tr></thead>
                <tbody>
                  {games.map((g,i)=>(
                    <tr key={g.date+'|'+i}>
                      <td>{g.date}{g.st===3&&<span className="badge purple" style={{marginLeft:5}}>PST</span>}</td>
                      <td className="w">{g.ha==='H'?'vs':'@'} {g.opp}</td>
                      <td>{ranFlag?g.pts:g.value}</td>
                      <td className="sp-avg">{g.daysAgo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>)}
    </>
  );
}

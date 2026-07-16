import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useApp} from '../state/store.jsx';
import {LANES,DEFAULT_LANES_ON} from '../data/defaults.js';
import {daysBetween} from '../engine/clocks.js';
import {cl} from '../engine/gematria.js';
import {classifyRungs} from '../engine/rungs.js';

/* Board tab — LAYOUT-SPEC §4, zones top to bottom. */
export default function BoardTab(){
  const {loading}=useApp();
  return(
    <div>
      <DateStrip/>
      <RefineBox/>
      {loading&&<div className="warn-banner">{loading}</div>}
      <NoGames/>
      <GameRail/>
      <ContextRail/>
      <TeamToggle/>
      <BatterZone/>
      <MatchupPanel/>
    </div>
  );
}

/* zone 1 — date strip */
function DateStrip(){
  const {date,dn,seasonInfo,game}=useApp();
  const seasonDay=seasonInfo?daysBetween(seasonInfo.start,date)+1:null;
  return(
    <div className="date-strip">
      <div className="panel">
        <h3>Season</h3>
        <div className="big">{seasonDay?`Day ${seasonDay}`:'—'}</div>
        {game&&<div className="muted mono" style={{fontSize:11,marginTop:4}}>
          game #{game.gameNumber.away}/{game.gameNumber.home}</div>}
      </div>
      <div className="panel">
        <h3>{date} · {dn.dayName} · {dn.ruler} · DOY {dn.doy} · {dn.left} left</h3>
        <div className="dn-vals">
          {Object.entries(dn.vals).slice(0,10).map(([n,l])=>(
            <span key={n} title={l}><b className="v-cyan">{n}</b></span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* zone 2 — refine box: collapsible, sticky, lane chips (HR+TB default ON) */
function RefineBox(){
  const {settings,setSettings}=useApp();
  const collapsed=settings.refineCollapsed;
  const on=new Set(settings.lanesOn);
  const toggle=L=>{
    const next=new Set(on);
    if(next.has(L))next.delete(L);else next.add(L);
    setSettings({...settings,lanesOn:next.size?[...next]:DEFAULT_LANES_ON});
  };
  return(
    <div className="refine">
      <div className="refine-box">
        <div className="refine-head" onClick={()=>setSettings({...settings,refineCollapsed:!collapsed})}>
          <b>Refine</b>
          <span className="sum">· {settings.lanesOn.join(' + ')} lanes</span>
          <span className="car">{collapsed?'▾':'▴'}</span>
        </div>
        {!collapsed&&(
          <div className="rail" style={{marginTop:8}}>
            {LANES.map(L=>(
              <button key={L} className={`chip${on.has(L)?' on':''}`} onClick={()=>toggle(L)}>{L}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NoGames(){
  const {slate,loading}=useApp();
  if(loading||!slate||slate.games.length)return null;
  return <div className="panel muted">No MLB games on this date (All-Star break / off-day). The board wakes up with the next slate.</div>;
}

/* zone 3 — game chips, one active, "▾ N more" expands */
function GameRail(){
  const {slate,gamePk,setGamePk,setBatterId,setContextFilter}=useApp();
  const [expanded,setExpanded]=useState(false);
  if(!slate?.games.length)return null;
  const shown=expanded?slate.games:slate.games.slice(0,4);
  const pick=pk=>{setGamePk(pk);setBatterId(null);setContextFilter(null)};
  return(
    <div className="rail">
      {shown.map(g=>(
        <button key={g.pk} className={`chip${g.pk===gamePk?' on':''}`} onClick={()=>pick(g.pk)}>
          {g.away.abbrev||g.away.teamName} @ {g.home.abbrev||g.home.teamName}
          {g.status==='Live'&&<span className="v-red">●</span>}
          {g.status==='Final'&&<span className="muted">F</span>}
        </button>
      ))}
      {slate.games.length>4&&(
        <button className="chip gray" onClick={()=>setExpanded(!expanded)}>
          {expanded?'▴ less':`▾ ${slate.games.length-4} more`}
        </button>
      )}
    </div>
  );
}

/* zone 4 — context rail: theme (purple) / thread+H2H (blue) / date (gray),
   hit counts, tap to filter batter list to carriers */
function ContextRail(){
  const {contextChips,contextFilter,setContextFilter}=useApp();
  if(!contextChips.length)return null;
  const cls={theme:'purple',thread:'blue',h2h:'blue',date:'gray'};
  return(
    <div className="rail">
      {contextChips.map((c,i)=>(
        <button key={i}
          className={`chip ${cls[c.kind]||'gray'}${c.cnt>0?' active-hit':''}${contextFilter===c.n?' on':''}`}
          onClick={()=>setContextFilter(contextFilter===c.n?null:c.n)}>
          {c.label} <span className="n">{c.n}</span>
          {c.cnt>0&&<span className="cnt">{c.cnt}</span>}
        </button>
      ))}
    </div>
  );
}

/* zone 5 — team toggle */
function TeamToggle(){
  const {game,side,setSide,setBatterId,deepFetch,deepBusy}=useApp();
  if(!game)return null;
  return(
    <div className="team-toggle">
      {['away','home'].map(s=>(
        <button key={s} className={`chip${side===s?' on':''}`}
          onClick={()=>{setSide(s);setBatterId(null)}}>
          {game[s].teamName}{game.projected?' · proj':''}
        </button>
      ))}
      <button className="chip gold" style={{flex:'0 0 auto'}} disabled={game.deepDone||deepBusy}
        onClick={deepFetch} title="vs-team / vs-league / month / day-of-week splits for this game">
        ⚡{game.deepDone?' ✓':deepBusy?' …':' DEEP'}
      </button>
    </div>
  );
}

/* zones 6+7 — batter list (sticky left) + batter card */
function BatterZone(){
  const {board,side,batterId,setBatterId,contextFilter,dayState}=useApp();
  const rows=board[side]||[];
  const filtered=contextFilter==null?rows
    :rows.filter(r=>r.ev.rungs.some(g=>g.n===contextFilter&&g.hits.length));
  const sel=rows.find(r=>r.id===batterId)||filtered[0]||rows[0];
  if(!rows.length)return <div className="panel muted">No lineup yet — roster projection loads with the slate.</div>;
  return(
    <div className="batter-zone">
      <div className="batter-list">
        {rows.map(r=>{
          const dim=contextFilter!=null&&!filtered.includes(r);
          const labels=dayState.labels[r.id]||[];
          return(
            <button key={r.id} className={`batter-row${sel?.id===r.id?' on':''}${dim?' skip':''}`}
              onClick={()=>setBatterId(r.id)}>
              <span className="nm"><span className="ord">{r.order}</span>{r.ev.p.fullName}</span>
              <span className="badges">
                {r.patternHits.map(({pattern})=>(
                  <span key={pattern.id} className="badge gold" title={pattern.name}>{pattern.lane}</span>
                ))}
                {Object.entries(r.ev.lanes).filter(([L,v])=>v&&!r.patternHits.some(x=>x.pattern.lane===L))
                  .map(([L])=><span key={L} className="badge green">{L}</span>)}
                {r.forecast&&(
                  <span className={`badge purple${r.maturing?' mat':''}`}
                    title={`${r.forecast.pattern} · ${r.forecast.hard}✓`}>
                    ⟡ {r.forecast.date.slice(5).replace('-','/')}
                  </span>
                )}
                {r.ev.threadHit&&<span className="badge blue">THR</span>}
                {labels.map((l,i)=><span key={i} className="badge purple">{l}</span>)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="card-col">
        {sel&&<BatterCard row={sel}/>}
        {sel&&<TotalsPanel row={sel}/>}
      </div>
    </div>
  );
}

function BatterCard({row}){
  const {colorFor}=useApp();
  const ev=row.ev;
  const p=ev.p;
  const hitRungs=ev.rungs.filter(r=>r.hits.length>0);
  /* TB rungs headline; BB never buried; full ladders surfaced (§4.7) */
  const order={TB:0,HR:1,BB:2,H:3,'2B':4,'3B':5,SO:6,AB:7,PA:8};
  hitRungs.sort((a,b)=>(order[a.stat]??9)-(order[b.stat]??9)||b.hits.length-a.hits.length||a.off-b.off);
  return(
    <div className="bcard">
      <div className="who">
        <span className="nm">{p.fullName}</span>
        {p.jersey&&<span className={`jer${ev.jerseyHits.length?' hit':''}`}>#{p.jersey}</span>}
        <span className="muted" style={{fontSize:11}}>{p.position}</span>
      </div>
      {ev.bday&&(
        <div className="bday-line">
          {ev.bday.since}d since bday · {ev.bday.until}d until · age {ev.bday.years} · day {ev.bday.totalDays} of life
        </div>
      )}
      {row.patternHits.length>0&&(
        <div className="badges" style={{marginBottom:8}}>
          {row.patternHits.map(({pattern,res})=>(
            <span key={pattern.id} className="badge gold">
              {pattern.name} {res.hardPass}✓{res.softPass?` +${res.softPass} soft`:''}
            </span>
          ))}
        </div>
      )}
      {row.forecast&&(
        <div className="call-line" style={{borderLeftColor:'var(--cvg-purple)',marginBottom:6}}>
          <span className="tag" style={{color:'var(--cvg-purple)'}}>⟡ FORECAST</span>
          {row.forecast.date.slice(5).replace('-','/')} · {row.forecast.pattern} ·
          <b className="mono v-purple"> {row.forecast.hard}✓ hard{row.forecast.soft?` +${row.forecast.soft} soft`:''}</b>
          <div className="muted" style={{fontSize:11,marginTop:3}}>
            {row.forecast.evidence?.slice(0,2).join(' · ')}
          </div>
        </div>
      )}
      {ev.primary&&(
        <div className="call-line">
          <span className="tag">PRIMARY</span>
          {ev.primary.scope} {ev.primary.stat} → <b className="mono">{ev.primary.n}</b>
          <span className="muted"> (sits {ev.primary.cur}{ev.primary.off>1?`, needs +${ev.primary.off}`:''})</span>
          <div className="muted" style={{fontSize:11.5,marginTop:3}}>
            {ev.primary.hits.map(h=>h.src).join(' · ')}
          </div>
        </div>
      )}
      {ev.alt&&(
        <div className="call-line alt">
          <span className="tag">ALT</span>
          {ev.alt.scope} {ev.alt.stat} → <b className="mono">{ev.alt.n}</b>
          <span className="muted"> (sits {ev.alt.cur}{ev.alt.off>1?`, needs +${ev.alt.off}`:''})</span>
        </div>
      )}
      <div className="rung-rows">
        {hitRungs.slice(0,14).map((r,i)=>{
          const color=colorFor(r.n,r.hits.map(h=>h.cat));
          const greenlight=r.stat==='AB'||r.stat==='PA';
          return(
            <div key={i} className="rung hit">
              <span className="st">{r.scope} {r.stat}{greenlight?' ✓':''}</span>
              <RungNum stat={r.stat} value={r.cur} style={color?{color}:{color:'var(--cvg-green)'}}>{r.n}</RungNum>
              <span className="muted">({r.cur}{r.off>1?` +${r.off}`:' +1'})</span>
              <span className="why">{r.hits.slice(0,2).map(h=>h.src).join(' · ')}{r.hits.length>2?` +${r.hits.length-2}`:''}</span>
            </div>
          );
        })}
        {!hitRungs.length&&<div className="muted" style={{fontSize:12}}>no loaded rungs — light/skip</div>}
      </div>
      <div className="mono" style={{fontSize:11.5}}>
        <span className="muted">thread </span>
        {ev.threadHit?<b className="v-blue">Y</b>:<span className="muted">N</span>}
      </div>
    </div>
  );
}

/* ---- clickable numbers → "next rungs" popover (Tony 2026-07) ----
   Any counting total is a RungNum; tapping it opens the ladder of value+N
   checked against the loaded spine (date/thread/theme/core), colored with
   the same rules the rest of the board uses. Institutional = the rung hits
   an enabled Core-vocab word (editable in Vocab, Tony decision #3). */
function RungNum({stat,value,children,className='',style}){
  const [anchor,setAnchor]=useState(null);
  const open=e=>{const r=e.currentTarget.getBoundingClientRect();setAnchor({x:r.left,y:r.bottom,top:r.top})};
  return(
    <>
      <button type="button" className={`rungnum ${className}`} style={style} onClick={open}>{children}</button>
      {anchor&&<RungPopup stat={stat} value={+value} anchor={anchor} onClose={()=>setAnchor(null)}/>}
    </>
  );
}

function RungPopup({stat,value,anchor,onClose}){
  const {loaded,colorFor}=useApp();
  const ladder=classifyRungs(stat,value,{loaded});
  /* clamp to viewport; flip above the number if it would run off the bottom */
  const W=248,vw=window.innerWidth,vh=window.innerHeight;
  const left=Math.max(8,Math.min(anchor.x,vw-W-8));
  const below=anchor.y+6, wantAbove=below>vh-220;
  const style=wantAbove
    ?{left,bottom:Math.max(8,vh-anchor.top+6),width:W}
    :{left,top:below,width:W};
  return createPortal(
    <>
      <div className="rung-pop-scrim" onClick={onClose}/>
      <div className="rung-pop" style={style} onClick={e=>e.stopPropagation()}>
        <div className="rung-pop-head">
          <b className="mono">{stat} {value}</b>
          <span className="muted">→ next rungs</span>
          <button className="rung-pop-x" onClick={onClose}>✕</button>
        </div>
        <div className="rung-pop-body">
          {ladder.map(r=>{
            const color=colorFor(r.n,r.cats)
              ||(r.institutional?'var(--cvg-gold)':(r.hit?'var(--cvg-green)':null));
            const tags=[];
            if(r.isDate)tags.push(['DN','var(--cvg-cyan)']);
            if(r.isThread)tags.push(['THR','var(--cvg-blue)']);
            if(r.institutional)tags.push(['CORE','var(--cvg-gold)']);
            const srcs=r.hits.map(h=>h.src).filter(Boolean);
            return(
              <div key={r.off} className={`rung-pop-row${r.hit?' hit':''}`}>
                <b className="mono val" style={color?{color}:undefined}>{r.n}</b>
                <span className="muted mono off">+{r.off}</span>
                <span className="tags">
                  {tags.map(([t,c])=><span key={t} className="ptag" style={{color:c}}>{t}</span>)}
                </span>
                <span className="why muted">{srcs.slice(0,2).join(' · ')}{srcs.length>2?` +${srcs.length-2}`:''}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
}

/* Baseball-Reference-style batter totals — COUNTING STATS ONLY (Tony: no
   BA/OBP/SLG/OPS rate columns, no pitcher pitching table). Career + Season
   read straight off the hydrated stat objects; every cell is a RungNum. */
const TOTALS_COLS=[
  {k:'gamesPlayed',h:'G'},{k:'plateAppearances',h:'PA'},{k:'atBats',h:'AB'},
  {k:'runs',h:'R'},{k:'hits',h:'H'},{k:'1B',h:'1B'},{k:'doubles',h:'2B'},
  {k:'triples',h:'3B'},{k:'homeRuns',h:'HR'},{k:'XBH',h:'XBH'},{k:'rbi',h:'RBI'},
  {k:'totalBases',h:'TB'},{k:'baseOnBalls',h:'BB'},{k:'strikeOuts',h:'SO'},
  {k:'stolenBases',h:'SB'},{k:'caughtStealing',h:'CS'},{k:'groundIntoDoublePlay',h:'GDP'},
  {k:'hitByPitch',h:'HBP'},{k:'sacBunts',h:'SH'},{k:'sacFlies',h:'SF'},
  {k:'intentionalWalks',h:'IBB'},
];

function TotalsCell({col,line}){
  const v=line[col.k];
  if(v==null)return <td className="muted">–</td>;
  return <td className="mono num"><RungNum stat={col.h} value={v}>{v}</RungNum></td>;
}

function TotalsTable({player}){
  const rows=[];
  if(player?.career)rows.push({scope:'Career',line:player.career});
  if(player?.season)rows.push({scope:'Season',line:player.season});
  if(!rows.length)return <div className="muted" style={{fontSize:12}}>no totals loaded yet</div>;
  return(
    <div className="totals-wrap">
      <table className="totals">
        <thead>
          <tr><th className="pl">Scope</th>{TOTALS_COLS.map(c=><th key={c.h}>{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i}>
              <td className="pl">{r.scope}</td>
              {TOTALS_COLS.map(c=><TotalsCell key={c.h} col={c} line={r.line}/>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* card column, under the card: the selected batter's bbref counting line.
   Batter only — a pitcher's batting line is meaningless post-DH. */
function TotalsPanel({row}){
  const p=row.ev.p;
  if(!p.career&&!p.season)return null;
  return(
    <div className="panel">
      <h3>Totals — {p.fullName}</h3>
      <TotalsTable player={p}/>
    </div>
  );
}

/* zone 8 — matchup panel (flex slot v1 default): pitcher + CROSS + staircases */
function MatchupPanel(){
  const {matchup,ciphers}=useApp();
  if(!matchup)return null;
  const {sp,spRun,spBday,cross,stair,vsHand}=matchup;
  return(
    <div className="panel" style={{marginTop:10}}>
      <h3>Matchup — opposing pitcher</h3>
      {sp?(
        <>
          <div style={{fontWeight:800,fontSize:14}}>{sp.fullName}
            {sp.jersey&&<span className="muted mono" style={{fontSize:11}}> #{sp.jersey}</span>}
          </div>
          {spBday&&(
            <div className="bday-line" style={{marginTop:3}}>
              {spBday.since}d since bday · {spBday.until}d until (SP age excluded — house rule)
            </div>
          )}
          <div className="name-run">
            {spRun.filter(x=>!x.legal).slice(0,16).map((x,i)=>(
              <span key={i}><span className="muted">{cl(x.cipher).slice(0,4)}</span> <b>{x.n}</b></span>
            ))}
          </div>
        </>
      ):<div className="muted" style={{fontSize:12}}>probable not posted</div>}
      {vsHand&&(
        <div className="mono muted" style={{fontSize:11.5,marginTop:8}}>
          selected batter venue split: {vsHand.homeRuns??'–'} HR · {vsHand.hits??'–'} H · {vsHand.totalBases??'–'} TB
        </div>
      )}
      {cross.map((c,i)=>(
        <div key={i} className="cross-row"><b className="v-green mono">{c.n}</b> — {c.text}</div>
      ))}
      {stair.length>0&&(
        <>
          <h3 style={{marginTop:12}}>Team staircases</h3>
          {stair.map((s,i)=>(
            <div key={i} className="cross-row" style={{borderLeftColor:'var(--cvg-blue)'}}>
              team {s.k} sits <b className="mono">{s.cur}</b> → <b className="v-blue mono">{s.n}</b>
              <span className="muted"> (+{s.need}) · {s.why}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

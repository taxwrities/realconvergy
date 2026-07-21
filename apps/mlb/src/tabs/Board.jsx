import {useState,useRef,useCallback,Fragment} from 'react';
import {createPortal} from 'react-dom';
import {useApp} from '../state/store.jsx';
import {LANES,LANE_STAT,DEFAULT_LANES_ON,T_FAMILY} from '../data/defaults.js';
import {draftFromRung,draftFromCross,draftsToPattern} from '../engine/recipe.js';
import {daysBetween,dateFigures} from '../engine/clocks.js';
import {isProjected} from '../data/lineups.js';
import {cl} from '../engine/gematria.js';
import {classifyRungs} from '../engine/rungs.js';
import {isPrime,primeIndex,compositeIndex,nthPrime,nthComposite,chainBase,chainMembers} from '../engine/numbers.js';

/* Desktop horizontal scroll: a callback ref that turns vertical wheel into
   horizontal scroll on overflowing rails/tables (mouse users have no h-track).
   Yields to the page once the strip is scrolled to its end. */
function useHScroll(){
  const cleanup=useRef(null);
  return useCallback(node=>{
    if(cleanup.current){cleanup.current();cleanup.current=null;}
    if(!node)return;
    const onWheel=e=>{
      if(node.scrollWidth<=node.clientWidth)return;
      if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
      const atStart=node.scrollLeft<=0;
      const atEnd=node.scrollLeft+node.clientWidth>=node.scrollWidth-1;
      if((e.deltaY<0&&atStart)||(e.deltaY>0&&atEnd))return;
      node.scrollLeft+=e.deltaY;e.preventDefault();
    };
    node.addEventListener('wheel',onWheel,{passive:false});
    cleanup.current=()=>node.removeEventListener('wheel',onWheel);
  },[]);
}

/* Board tab — LAYOUT-SPEC §4, zones top to bottom. */
export default function BoardTab({goPatterns}){
  const {loading}=useApp();
  return(
    <div>
      <DateStrip/>
      <RefineBox/>
      {loading&&<div className="warn-banner">{loading}</div>}
      <FreshnessBanner/>
      <NoGames/>
      <GameRail/>
      <ContextRail/>
      <TeamToggle/>
      <BatterZone/>
      <MatchupPanel/>
      <RecipeDrawer goPatterns={goPatterns}/>
    </div>
  );
}

/* sticky recipe drawer (PATTERN-RECIPES §8) — collects the ⊕ drafts.
   Only a collector: "Save as pattern" hands the draft to the Patterns
   editor pre-filled and clears the drawer. */
function RecipeDrawer({goPatterns}){
  const {recipeDraft,removeDraft,toggleDraftHard,clearDrafts,setPendingPattern}=useApp();
  if(!recipeDraft.length)return null;
  const saveAs=()=>{
    setPendingPattern(draftsToPattern(recipeDraft,LANE_STAT));
    clearDrafts();
    goPatterns&&goPatterns();
  };
  return(
    <div className="recipe-drawer">
      <div className="recipe-head">
        <b>Recipe draft</b>
        <span className="muted">{recipeDraft.length} condition{recipeDraft.length>1?'s':''}</span>
        <button className="chip on" onClick={saveAs}>Save as pattern →</button>
        <button className="chip gray" onClick={clearDrafts}>clear</button>
      </div>
      <div className="recipe-chips">
        {recipeDraft.map(d=>(
          <span key={d.id} className="recipe-chip">
            <span className="lbl">{d.label}</span>
            <button className={`hs${d.cond.hard?' hard':''}`} title="hard gates the match; soft only upgrades it"
              onClick={()=>toggleDraftHard(d.id)}>{d.cond.hard?'hard':'soft'}</button>
            <button className="x" onClick={()=>removeDraft(d.id)}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

/* cached-slate freshness + manual refresh (§ persist, Tony 2026-07) */
function FreshnessBanner(){
  const {slate,loading,slateSavedAt,refresh}=useApp();
  if(loading||!slate||!slateSavedAt)return null;
  const t=new Date(slateSavedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  return(
    <div className="warn-banner fresh" onClick={refresh} role="button" tabIndex={0}
      onKeyDown={e=>{if(e.key==='Enter')refresh()}}>
      slate cached from {t} · tap to refresh ↻
    </div>
  );
}

/* zone 1 — date strip */
function DateStrip(){
  const {date,setDate,today,dn,seasonInfo,game,h2h}=useApp();
  const seasonDay=seasonInfo?daysBetween(seasonInfo.start,date)+1:null;
  return(
    <div className="date-strip">
      <div className="panel">
        <h3>Season</h3>
        <div className="big">{seasonDay?<>Day <FactNum value={seasonDay}>{seasonDay}</FactNum></>:'—'}</div>
        {game&&<div className="muted mono" style={{fontSize:11,marginTop:4}}>
          game #<FactNum value={game.gameNumber.away}>{game.gameNumber.away}</FactNum>
          /<FactNum value={game.gameNumber.home}>{game.gameNumber.home}</FactNum>
          {h2h&&<> · H2H #<FactNum value={h2h.gameNo}>{h2h.gameNo}</FactNum>
            {' '}({game.away.abbrev} <FactNum value={h2h.awayWins}>{h2h.awayWins}</FactNum>
            –<FactNum value={h2h.homeWins}>{h2h.homeWins}</FactNum> {game.home.abbrev})</>}</div>}
      </div>
      <div className="panel">
        <h3>
          <input type="date" className="date-pick" value={date}
            onChange={e=>{if(e.target.value)setDate(e.target.value)}}/>
          {date!==today&&(
            <button className="date-today" onClick={()=>setDate(today)} title="back to today">today ↺</button>
          )}
          {' '}· {dn.dayName} · {dn.ruler} · DOY {dn.doy} · {dn.left} left
        </h3>
        <div className="dn-vals">
          {dateFigures(date).map((f,i)=>(
            <b key={i} className={f.top?'v-gold':'v-cyan'} title={f.calc}>
              <FactNum value={f.n}>{f.n}</FactNum>
            </b>
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
  const hRail=useHScroll();
  if(!slate?.games.length)return null;
  const shown=expanded?slate.games:slate.games.slice(0,4);
  const pick=pk=>{setGamePk(pk);setBatterId(null);setContextFilter(null)};
  return(
    <div className="rail" ref={hRail}>
      {shown.map(g=>(
        <button key={g.pk} className={`gchip${g.pk===gamePk?' on':''}`} onClick={()=>pick(g.pk)}>
          <span className="gc-meta">
            {g.status==='Live'?<span className="live">● LIVE</span>:g.status==='Final'?'FINAL':'TODAY'}
          </span>
          <span className="gc-team">{g.away.abbrev||g.away.teamName}</span>
          <span className="gc-team"><span className="at">@</span>{g.home.abbrev||g.home.teamName}</span>
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
  const hRail=useHScroll();
  if(!contextChips.length)return null;
  const cls={theme:'purple',thread:'blue',h2h:'blue',date:'gray'};
  return(
    <div className="rail" ref={hRail}>
      {contextChips.map((c,i)=>(
        <button key={i}
          className={`chip ${cls[c.kind]||'gray'}${c.cnt>0?' active-hit':''}${contextFilter===c.n?' on':''}`}
          onClick={()=>setContextFilter(contextFilter===c.n?null:c.n)}>
          {c.label} <span className="n"><FactNum value={c.n}>{c.n}</FactNum></span>
          {c.cnt>0&&<span className="cnt">{c.cnt}</span>}
        </button>
      ))}
    </div>
  );
}

/* zone 5 — team toggle */
function TeamToggle(){
  const {game,side,setSide,setBatterId,deepFetch,deepBusy,checkLineups,lineupBusy}=useApp();
  if(!game)return null;
  const anyProj=isProjected(game,'away')||isProjected(game,'home');
  return(
    <div className="team-toggle">
      <div className="seg">
        {['away','home'].map(s=>(
          <button key={s} className={side===s?'on':''}
            onClick={()=>{setSide(s);setBatterId(null)}}>
            {game[s].teamName}{isProjected(game,s)?' · proj':''}
          </button>
        ))}
      </div>
      <button className="chip gold" style={{flex:'0 0 auto'}} disabled={game.deepDone||deepBusy}
        onClick={deepFetch} title="vs-team / vs-league / month / day-of-week splits for this game">
        ⚡{game.deepDone?' ✓':deepBusy?' …':' DEEP'}
      </button>
      {anyProj&&(
        <button className="chip blue" style={{flex:'0 0 auto'}} disabled={lineupBusy}
          onClick={checkLineups} title="check for confirmed lineups (one cheap call) — starters replace the projected roster">
          lineups{lineupBusy?' …':' ↺'}
        </button>
      )}
    </div>
  );
}

/* zones 6+7 — batter list (sticky left) + batter card */
function BatterZone(){
  const {board,side,batterId,setBatterId,contextFilter,patternFilter,dayState}=useApp();
  const rows=board[side]||[];
  const inFilter=r=>{
    if(contextFilter!=null&&!r.ev.rungs.some(g=>g.n===contextFilter&&g.hits.length))return false;
    if(patternFilter!=null&&!r.patternHits.some(x=>x.pattern.id===patternFilter))return false;
    return true;
  };
  const filtered=rows.filter(inFilter);
  const sel=rows.find(r=>r.id===batterId)||filtered[0]||rows[0];
  if(!rows.length)return <div className="panel muted">No lineup yet — roster projection loads with the slate.</div>;
  return(
    <div className="batter-zone">
      <div className="batter-list">
        {rows.map(r=>{
          const dim=(contextFilter!=null||patternFilter!=null)&&!filtered.includes(r);
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
                {r.ev.dateNameHits.length>0&&(
                  <span className="badge cyan"
                    title={r.ev.dateNameHits.map(h=>`${h.label} ${h.cipher} ${h.n} = ${h.calc}`).join(' · ')}>
                    ◈ {[...new Set(r.ev.dateNameHits.map(h=>h.n))].join('/')}
                  </span>
                )}
                {r.ev.dayMatches?.length>0&&(
                  <span className="badge cyan"
                    title={r.ev.dayMatches.map(m=>`${m.label} ${m.n.toLocaleString()} = ${m.calc}`).join(' · ')}>
                    ◷ {r.ev.dayMatches.map(m=>m.kind==='life'?'life':'career').join('/')}
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
        <PatternHitsPanel/>
        {sel&&<TotalsPanel row={sel}/>}
      </div>
    </div>
  );
}

/* pattern-hits — surfaces the Patterns tab's live matches on the board.
   Pills filter the batter list (dim non-hitters); names tap through to the
   matching batter's card. Game-scoped (both sides); hidden when no hits. */
function PatternHitsPanel(){
  const {board,game,patterns,patternFilter,setPatternFilter,patternCounts,setSide,setBatterId}=useApp();
  const [expanded,setExpanded]=useState(null); // pattern id whose full name-list is open
  if(!game)return null;
  const abbrev={away:game.away.abbrev||game.away.teamName,home:game.home.abbrev||game.home.teamName};
  const groups=patterns.filter(pt=>pt.enabled).map(pt=>{
    const hits=[];
    ['away','home'].forEach(s=>(board[s]||[]).forEach(r=>{
      if(r.patternHits.some(x=>x.pattern.id===pt.id))
        hits.push({id:r.id,side:s,name:r.ev.p.fullName,abbr:abbrev[s]});
    }));
    return{pt,hits};
  }).filter(g=>g.hits.length>0);
  if(!groups.length)return null;
  const jump=h=>{setSide(h.side);setBatterId(h.id)};
  return(
    <div className="panel pattern-hits">
      <h3>Pattern hits — this game</h3>
      <div className="rail" style={{flexWrap:'wrap',overflowX:'visible'}}>
        {groups.map(({pt,hits})=>(
          <button key={pt.id}
            className={`chip gold${patternFilter===pt.id?' on':''}`}
            onClick={()=>setPatternFilter(patternFilter===pt.id?null:pt.id)}>
            {pt.name} <span className="n">{hits.length}</span>
            {patternCounts[pt.id]>hits.length&&<span className="cnt">{patternCounts[pt.id]} slate</span>}
          </button>
        ))}
      </div>
      <div className="pat-names">
        {groups.map(({pt,hits})=>{
          const open=expanded===pt.id;
          const shown=open?hits:hits.slice(0,4);
          return(
            <div key={pt.id} className={`pat-name-row${patternFilter===pt.id?' on':''}`}>
              <span className="pat-lbl">{pt.name}</span>
              {shown.map(h=>(
                <button key={h.id} className="pat-who" onClick={()=>jump(h)}>
                  {h.name}<span className="muted"> {h.abbr}</span>
                </button>
              ))}
              {hits.length>4&&(
                <button className="pat-more" onClick={()=>setExpanded(open?null:pt.id)}>
                  {open?'less':`+${hits.length-4} more`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* entering-stats line: every tracked counting stat as a career/season pair.
   PA + AB lead and are green-lit (the green-light signals, never the bet —
   §2 house rule) so they're never missing from the card at a glance. Each
   number is a RungNum → tap for its next-rungs ladder. (Tony 2026-07-17) */
const ENTER_STATS=[
  ['PA','plateAppearances'],['AB','atBats'],['H','hits'],['1B','1B'],
  ['2B','doubles'],['3B','triples'],['HR','homeRuns'],['XBH','XBH'],
  ['RBI','rbi'],['TB','totalBases'],['BB','baseOnBalls'],['SO','strikeOuts'],
];

function BatterCard({row}){
  const {colorFor,contextFilter,patternFilter,addDraft,gameTotals,refreshGameTotals}=useApp();
  const ev=row.ev;
  const p=ev.p;
  const today=gameTotals[row.id]; // today-only box line (top-of-card game total)
  const hitRungs=ev.rungs.filter(r=>r.hits.length>0);
  /* TB rungs headline; BB never buried; full ladders surfaced (§4.7) */
  const order={TB:0,HR:1,'1B':2,XBH:3,RBI:4,BB:5,H:6,'2B':7,'3B':8,SO:9,AB:10,PA:11};
  hitRungs.sort((a,b)=>(order[a.stat]??12)-(order[b.stat]??12)||b.hits.length-a.hits.length||a.off-b.off);
  /* active pattern tile: the numbers this pattern actually matched on this card,
     so the tile gets the same sort-first + ring + badge treatment as a chip. */
  const patHit=patternFilter!=null?row.patternHits.find(x=>x.pattern.id===patternFilter):null;
  const patNums=new Set(patHit?patHit.res.details.flatMap(d=>d.matches.map(m=>m.n)):[]);
  if(patNums.size)
    hitRungs.sort((a,b)=>(patNums.has(b.n)?1:0)-(patNums.has(a.n)?1:0));
  /* active context chip: rungs landing on that number sort first + ring (§feedback).
     Last sort wins the top slot — a tapped chip is the more specific intent. */
  if(contextFilter!=null)
    hitRungs.sort((a,b)=>(b.n===contextFilter?1:0)-(a.n===contextFilter?1:0));
  return(
    <div className="bcard">
      <div className="who">
        <span className="nm">{p.fullName}</span>
        {p.jersey&&<span className={`jer${ev.jerseyHits.length?' hit':''}`}>#<FactNum value={p.jersey}>{p.jersey}</FactNum></span>}
        <span className="muted" style={{fontSize:11}}>{p.position}</span>
      </div>
      {p.school&&(
        <div style={{fontSize:11,margin:'1px 0 3px',display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
          <span className="muted">{p.school}</span>
          {p.jesuit&&<span className="badge gold">JESUIT</span>}
        </div>
      )}
      {ev.bday&&(
        <div className="bday-line">
          <FactNum value={ev.bday.since}>{ev.bday.since}</FactNum>d since bday
          {' · '}<FactNum value={ev.bday.until}>{ev.bday.until}</FactNum>d until
          {' · '}age <FactNum value={ev.bday.years}>{ev.bday.years}</FactNum>
          {' · '}day <FactNum value={ev.bday.totalDays}>{ev.bday.totalDays}</FactNum> of life
          {' · '}week <FactNum value={ev.bday.weeks}>{ev.bday.weeks}</FactNum>
        </div>
      )}
      {ev.debut&&(
        <div className="bday-line">
          debut {p.debutDate}
          {' · '}career day <FactNum value={ev.debut.totalDays}>{ev.debut.totalDays}</FactNum>
          {' · '}week <FactNum value={ev.debut.weeks}>{ev.debut.weeks}</FactNum>
          {' · '}month <FactNum value={ev.debut.months}>{ev.debut.months}</FactNum>
          {' · '}<FactNum value={ev.debut.years}>{ev.debut.years}</FactNum>y
          {' · '}<FactNum value={ev.debut.since}>{ev.debut.since}</FactNum>d since anniv
          {' · '}<FactNum value={ev.debut.until}>{ev.debut.until}</FactNum>d until
        </div>
      )}
      {(p.career||p.season)&&(
        <div className="ent-stats">
          {ENTER_STATS.map(([lbl,key])=>{
            const c=p.career?.[key],s=p.season?.[key];
            if(c==null&&s==null)return null;
            const green=lbl==='PA'||lbl==='AB';
            return(
              <span key={lbl} className={`ent${green?' green':''}`}>
                <span className="el">{lbl}</span>
                {c!=null?<RungNum stat={lbl} value={c}>{c}</RungNum>:<span className="muted">–</span>}
                <span className="sl">/</span>
                {s!=null?<RungNum stat={lbl} value={s}>{s}</RungNum>:<span className="muted">–</span>}
              </span>
            );
          })}
          <span className="ent-key muted">career/season</span>
        </div>
      )}
      {today&&(
        <div className="ent-stats today-line">
          <span className="ent">
            <span className="el" style={{color:'var(--cvg-gold)'}}>TODAY</span>
            <button type="button" className="today-refresh" title="refresh today's line"
              onClick={refreshGameTotals}>↻</button>
          </span>
          <span className="ent">
            <RungNum stat="H" value={today.hits}>{today.hits}</RungNum>
            <span className="sl">-</span>
            <RungNum stat="AB" value={today.atBats}>{today.atBats}</RungNum></span>
          {[['HR','homeRuns'],['RBI','rbi'],['R','runs'],['TB','totalBases'],
            ['BB','baseOnBalls'],['SO','strikeOuts']].map(([lbl,key])=>today[key]>0&&(
            <span key={lbl} className="ent">
              <span className="el">{lbl}</span>
              <RungNum stat={lbl} value={today[key]}>{today[key]}</RungNum>
            </span>
          ))}
          {today.summary&&<span className="ent-key muted">{today.summary}</span>}
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
      {ev.dateNameHits.length>0&&(
        <div className="call-line" style={{borderLeftColor:'var(--cvg-cyan)',marginBottom:6}}>
          <span className="tag" style={{color:'var(--cvg-cyan)'}}>NAME = DATE</span>
          {ev.dateNameHits.map((h,i)=>(
            <span key={i} className="mono">
              {i>0&&' · '}{h.label} {h.cipher} <FactNum value={h.n}><b className={h.top?'v-gold':'v-cyan'}>{h.n}</b></FactNum>
            </span>
          ))}
        </div>
      )}
      {ev.dayMatches?.length>0&&(
        <div className="call-line" style={{borderLeftColor:'var(--cvg-cyan)',marginBottom:6}}>
          <span className="tag" style={{color:'var(--cvg-cyan)'}}>DAY = DATE</span>
          {ev.dayMatches.map((m,i)=>(
            <span key={i} className="mono">
              {i>0&&' · '}{m.label} = <FactNum value={m.n}><b className={m.top?'v-gold':'v-cyan'}>{m.n.toLocaleString()}</b></FactNum> {m.top?'(top DN)':'(DN)'}
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
          <button className="draft-add" title="add to recipe draft"
            onClick={()=>addDraft(draftFromRung(ev.primary))}>⊕</button>
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
          <button className="draft-add" title="add to recipe draft"
            onClick={()=>addDraft(draftFromRung(ev.alt))}>⊕</button>
          <span className="tag">ALT</span>
          {ev.alt.scope} {ev.alt.stat} → <b className="mono">{ev.alt.n}</b>
          <span className="muted"> (sits {ev.alt.cur}{ev.alt.off>1?`, needs +${ev.alt.off}`:''})</span>
        </div>
      )}
      <div className="rung-rows">
        {hitRungs.slice(0,14).map((r,i)=>{
          const color=colorFor(r.n,r.hits.map(h=>h.cat));
          const greenlight=r.stat==='AB'||r.stat==='PA';
          const flt=contextFilter!=null&&r.n===contextFilter;
          const pflt=patNums.has(r.n);
          return(
            <div key={i} className={`rung hit${flt?' flt':''}${pflt&&!flt?' pflt':''}`}>
              <span className="st">{r.scope} {r.stat}{greenlight?' ✓':''}</span>
              <RungNum stat={r.stat} value={r.cur} style={color?{color}:{color:'var(--cvg-green)'}}>{r.n}</RungNum>
              <span className="muted">({r.cur}{r.off>1?` +${r.off}`:' +1'})</span>
              {flt&&<span className="badge blue">◈ CHIP</span>}
              {pflt&&!flt&&<span className="badge gold">◈ {patHit.pattern.name}</span>}
              <span className="why">{r.hits.slice(0,2).map(h=>h.src).join(' · ')}{r.hits.length>2?` +${r.hits.length-2}`:''}</span>
              <button className="draft-add" title="add to recipe draft"
                onClick={()=>addDraft(draftFromRung(r))}>⊕</button>
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
  /* .active = this number's menu is open → feedback on which stat you tapped */
  return(
    <>
      <button type="button" className={`rungnum ${className}${anchor?' active':''}`} style={style} onClick={open}>{children}</button>
      {anchor&&<RungPopup stat={stat} value={+value} anchor={anchor} onClose={()=>setAnchor(null)}/>}
    </>
  );
}

function RungPopup({stat,value,anchor,onClose}){
  const {loaded,colorFor}=useApp();
  const [sel,setSel]=useState(null); // clicked rung → highlighted for feedback
  /* highlighted rungs (DN/thread/core/any loaded hit) pinned to the top,
     ascending offset among themselves; non-hits follow (Tony 2026-07). */
  const ladder=[...classifyRungs(stat,value,{loaded})]
    .sort((a,b)=>(b.hit-a.hit)||(a.off-b.off));
  const firstColdIdx=ladder.findIndex(r=>!r.hit);
  const hasSplit=firstColdIdx>0&&firstColdIdx<ladder.length;
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
          {ladder.map((r,i)=>{
            const color=colorFor(r.n,r.cats)
              ||(r.institutional?'var(--cvg-gold)':(r.hit?'var(--cvg-green)':null));
            const tags=[];
            if(r.isDate)tags.push(['DN','var(--cvg-cyan)']);
            if(r.isThread)tags.push(['THR','var(--cvg-blue)']);
            if(r.institutional)tags.push(['CORE','var(--cvg-gold)']);
            const srcs=r.hits.map(h=>h.src).filter(Boolean);
            return(
              <Fragment key={r.off}>
                {hasSplit&&i===firstColdIdx&&<div className="rung-pop-div"/>}
                <div
                  className={`rung-pop-row${r.hit?' hit':''}${sel===r.off?' sel':''}`}
                  onClick={()=>setSel(sel===r.off?null:r.off)}>
                  <b className="mono val" style={color?{color}:undefined}>{r.n}</b>
                  <span className="muted mono off">+{r.off}</span>
                  <span className="tags">
                    {tags.map(([t,c])=><span key={t} className="ptag" style={{color:c}}>{t}</span>)}
                  </span>
                  <span className="why muted">{srcs.slice(0,2).join(' · ')}{srcs.length>2?` +${srcs.length-2}`:''}</span>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ---- number-identity popover (Tony 2026-07): the bday / day-of-life
   counters already feed rung matching invisibly — now they're inspectable.
   Shows prime/composite + index, the number AS an index (nth prime /
   composite), 9s chain, T-family, and spine hits (with prime-index bridge). */
function FactNum({value,children,className='',style}){
  const [anchor,setAnchor]=useState(null);
  /* span (not button) so it can live INSIDE chip buttons; stopPropagation
     keeps the chip's own filter toggle from firing on a number tap */
  const open=e=>{
    e.stopPropagation();
    const r=e.currentTarget.getBoundingClientRect();
    setAnchor({x:r.left,y:r.bottom,top:r.top});
  };
  return(
    <>
      <span role="button" tabIndex={0} className={`rungnum ${className}${anchor?' active':''}`} style={style}
        onClick={open} onKeyDown={e=>{if(e.key==='Enter')open(e)}}>{children}</span>
      {anchor&&<NumPopup n={+value} anchor={anchor} onClose={()=>setAnchor(null)}/>}
    </>
  );
}

const ord=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
const CAT_TAG={core:'CORE',date:'DN',thread:'THR',theme:'THEME',h2h:'H2H',
  context:'CTX',phrase:'PHR',name:'NAME',bday:'BDAY',jersey:'JER'};

function NumPopup({n,anchor,onClose}){
  const {loaded,colorFor}=useApp();
  const W=248,vw=window.innerWidth,vh=window.innerHeight;
  const left=Math.max(8,Math.min(anchor.x,vw-W-8));
  const below=anchor.y+6,wantAbove=below>vh-260;
  const style=wantAbove
    ?{left,bottom:Math.max(8,vh-anchor.top+6),width:W}
    :{left,top:below,width:W};
  const prime=isPrime(n),pIdx=primeIndex(n),cIdx=compositeIndex(n);
  const hits=loaded.get(n)||[];
  const headColor=colorFor(n,hits.map(h=>h.cat))||(hits.length?'var(--cvg-green)':null);
  const bridge=prime?(loaded.get(pIdx)||[]):[];
  const tFam=T_FAMILY.includes(n)||(prime&&T_FAMILY.includes(pIdx));
  return createPortal(
    <>
      <div className="rung-pop-scrim" onClick={onClose}/>
      <div className="rung-pop" style={style} onClick={e=>e.stopPropagation()}>
        <div className="rung-pop-head">
          <b className="mono" style={headColor?{color:headColor}:undefined}>{n}</b>
          <span className="muted">number facts</span>
          <button className="rung-pop-x" onClick={onClose}>✕</button>
        </div>
        <div className="rung-pop-body">
          <div className="fact-row">
            {prime
              ?<><b className="v-gold mono">prime</b><span className="muted">— the {ord(pIdx)} prime</span></>
              :cIdx>0
                ?<><b className="mono">composite</b><span className="muted">— the {ord(cIdx)} composite</span></>
                :<span className="muted">neither prime nor composite</span>}
          </div>
          {n<=250&&nthPrime(n)>0&&(
            <div className="fact-row"><span className="muted">as index:</span>
              <b className="mono">{ord(n)} prime = {nthPrime(n)}</b></div>
          )}
          {n<=250&&nthComposite(n)>0&&(
            <div className="fact-row"><span className="muted"></span>
              <b className="mono">{ord(n)} composite = {nthComposite(n)}</b></div>
          )}
          <div className="fact-row"><span className="muted">chain:</span>
            <b className="mono">{chainBase(n)}</b>
            <span className="muted mono">({chainMembers(n,5).join(', ')}…)</span></div>
          {tFam&&<div className="fact-row"><b className="v-gold">T-family</b></div>}
          {hits.slice(0,6).map((h,i)=>(
            <div key={i} className="fact-row hit">
              <span className="ptag" style={{color:colorFor(n,[h.cat])||'var(--cvg-green)'}}>{CAT_TAG[h.cat]||(h.cat||'HIT').toUpperCase().slice(0,5)}</span>
              <span className="why muted">{h.src}</span>
            </div>
          ))}
          {hits.length>6&&<div className="fact-row muted" style={{fontSize:10}}>+{hits.length-6} more hits</div>}
          {prime&&bridge.slice(0,3).map((h,i)=>(
            <div key={'b'+i} className="fact-row hit">
              <span className="ptag" style={{color:'var(--cvg-cyan)'}}>≙{pIdx}</span>
              <span className="why muted">as prime #{pIdx} → {h.src}</span>
            </div>
          ))}
          {!hits.length&&!(prime&&bridge.length)&&(
            <div className="fact-row muted" style={{fontSize:11}}>no spine hits today</div>
          )}
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
  const hWrap=useHScroll();
  const rows=[];
  if(player?.career)rows.push({scope:'Career',line:player.career});
  if(player?.season)rows.push({scope:'Season',line:player.season});
  /* SPLITS rows (Tony 2026-07): same columns as career/season. Handedness +
     venue ride along on the slate fetch (season scope = current form); Last N
     and the situational splits arrive with ⚡ DEEP. Only rows with data show. */
  const S=player?.split||{},D=player?.deep||{};
  const split=(scope,line)=>{if(line)rows.push({scope,line,split:true})};
  split('vs LHP',S['season-vsL']);
  split('vs RHP',S['season-vsR']);
  split('Home',S['season-home']);
  split('Away',S['season-away']);
  if(D.lastN)[7,15,30].forEach(n=>split('Last '+n,D.lastN[n]));
  if(D.month)split(D.monthTag||'Month',D.month);
  if(D.dow)split(D.dowTag||'Day',D.dow);
  if(D.vsOpp)split('vs '+(D.oppTag||'Opp'),D.vsOpp);
  if(!rows.length)return <div className="muted" style={{fontSize:12}}>no totals loaded yet</div>;
  return(
    <div className="totals-wrap" ref={hWrap}>
      <table className="totals">
        <thead>
          <tr><th className="pl">Scope</th>{TOTALS_COLS.map(c=><th key={c.h}>{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} className={r.split?'split':''}>
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
  const {matchup,ciphers,addDraft}=useApp();
  if(!matchup)return null;
  const {sp,spRun,spBday,cross,stair,vsHand}=matchup;
  return(
    <div className="panel" style={{marginTop:10}}>
      <h3>Matchup — opposing pitcher</h3>
      {sp?(
        <>
          <div style={{fontWeight:800,fontSize:14}}>{sp.fullName}
            {sp.jersey&&<span className="muted mono" style={{fontSize:11}}> #<FactNum value={sp.jersey}>{sp.jersey}</FactNum></span>}
          </div>
          {spBday&&(
            <div className="bday-line" style={{marginTop:3}}>
              <FactNum value={spBday.since}>{spBday.since}</FactNum>d since bday
              {' · '}<FactNum value={spBday.until}>{spBday.until}</FactNum>d until (SP age excluded — house rule)
            </div>
          )}
          <div className="name-run">
            {spRun.filter(x=>!x.legal).slice(0,16).map((x,i)=>(
              <span key={i}><span className="muted">{cl(x.cipher).slice(0,4)}</span> <b><FactNum value={x.n}>{x.n}</FactNum></b></span>
            ))}
          </div>
        </>
      ):<div className="muted" style={{fontSize:12}}>probable not posted</div>}
      {vsHand&&(
        <div className="mono muted" style={{fontSize:11.5,marginTop:8}}>
          selected batter venue split:{' '}
          {vsHand.homeRuns!=null?<FactNum value={vsHand.homeRuns}>{vsHand.homeRuns}</FactNum>:'–'} HR ·{' '}
          {vsHand.hits!=null?<FactNum value={vsHand.hits}>{vsHand.hits}</FactNum>:'–'} H ·{' '}
          {vsHand.totalBases!=null?<FactNum value={vsHand.totalBases}>{vsHand.totalBases}</FactNum>:'–'} TB
        </div>
      )}
      {cross.map((c,i)=>{
        const d=draftFromCross(c);
        return(
          <div key={i} className="cross-row">
            {d&&<button className="draft-add" title="add to recipe draft" onClick={()=>addDraft(d)}>⊕</button>}
            <b className="v-green mono">{c.n}</b> — {c.text}
          </div>
        );
      })}
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

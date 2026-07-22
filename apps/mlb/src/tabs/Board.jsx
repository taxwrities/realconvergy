import {useState,useRef,useCallback,useEffect} from 'react';
import {createPortal} from 'react-dom';
import {useApp} from '../state/store.jsx';
import {LANES,LANE_STAT,DEFAULT_LANES_ON,T_FAMILY} from '../data/defaults.js';
import {draftFromCross,draftsToPattern} from '../engine/recipe.js';
import {daysBetween,dateFigures} from '../engine/clocks.js';
import {isProjected} from '../data/lineups.js';
import {cl} from '../engine/gematria.js';
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
      <MatchupPanel/>
      <PatternHitsPanel/>
      <BatterZone/>
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

/* zone 6 — the roster (single scrollable list). Each row shows the batter's
   name + jersey + quick convergence badges; the WHOLE row taps through to the
   dedicated full-sheet page (pitcher / team / totals / all convergences live
   there now). No inline preview — the two-column split retired 2026-07-22. */
function BatterZone(){
  const {board,side,batterId,setBatterId,focusPlayer,contextFilter,patternFilter,dayState}=useApp();
  const rows=board[side]||[];
  /* keep a leadoff batter selected for the current side so the Matchup header
     (which reads the selected batter's venue split) is populated on load —
     the roster rows themselves navigate to the full-sheet, not this state. */
  useEffect(()=>{
    if(rows.length&&!rows.some(r=>r.id===batterId))setBatterId(rows[0].id);
  },[side,rows,batterId,setBatterId]);
  const inFilter=r=>{
    if(contextFilter!=null&&!r.ev.rungs.some(g=>g.n===contextFilter&&g.hits.length))return false;
    if(patternFilter!=null&&!r.patternHits.some(x=>x.pattern.id===patternFilter))return false;
    return true;
  };
  const filtered=rows.filter(inFilter);
  if(!rows.length)return <div className="panel muted">No lineup yet — roster projection loads with the slate.</div>;
  return(
    <div className="roster-list">
      {rows.map(r=>{
        const dim=(contextFilter!=null||patternFilter!=null)&&!filtered.includes(r);
        const labels=dayState.labels[r.id]||[];
        const p=r.ev.p;
        return(
          <button key={r.id} className={`batter-row${dim?' skip':''}`}
            onClick={()=>focusPlayer({id:r.id,side,from:'board'})}
            title="open full sheet">
            <span className="rrow">
              <span className="nm"><span className="ord">{r.order}</span>{p.fullName}
                {p.jersey&&<span className="jer">#{p.jersey}</span>}</span>
              <span className="go">›</span>
            </span>
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
  );
}

/* pattern-hits — surfaces the Patterns tab's live matches on the board.
   Pills filter the batter list (dim non-hitters); names tap through to the
   matching batter's card. Game-scoped (both sides); hidden when no hits. */
function PatternHitsPanel(){
  const {board,game,patterns,patternFilter,setPatternFilter,patternCounts,focusPlayer}=useApp();
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
  const jump=h=>focusPlayer({id:h.id,side:h.side,from:'board'});
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

/* zone 7 — matchup header (pitcher + CROSS + team staircases). Sits above the
   roster as the always-visible game context; the opposing pitcher's name stays
   on the header row, the gematria detail + team staircases collapse so the
   scannable list stays high on the page (Tony 2026-07-22). Per-batter splits
   and the full pitcher grid live on each player's full-sheet. */
function MatchupPanel(){
  const {matchup,addDraft}=useApp();
  const [open,setOpen]=useState(false);
  if(!matchup)return null;
  const {sp,spRun,spBday,cross,stair,vsHand,bat}=matchup;
  const summ=[stair.length&&`${stair.length} staircase${stair.length>1?'s':''}`,
    cross.length&&`${cross.length} cross`].filter(Boolean).join(' · ');
  return(
    <div className="panel matchup-panel" style={{marginTop:10}}>
      <div className="matchup-head" onClick={()=>setOpen(o=>!o)} role="button" tabIndex={0}
        onKeyDown={e=>{if(e.key==='Enter')setOpen(o=>!o)}}>
        <h3 style={{margin:0}}>Matchup — {sp?sp.fullName:'opposing pitcher'}
          {sp?.jersey&&<span className="muted mono" style={{fontSize:11}}> #{sp.jersey}</span>}</h3>
        {summ&&<span className="muted" style={{marginLeft:'auto',fontSize:11}}>{summ}</span>}
        <span className="car">{open?'▴':'▾'}</span>
      </div>
      {open&&<>
      {sp?(
        <>
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
          {bat?.ev.p.fullName||'batter'} venue split:{' '}
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
      </>}
    </div>
  );
}

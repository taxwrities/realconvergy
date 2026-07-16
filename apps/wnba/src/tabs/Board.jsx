import {useState,useRef,useCallback} from 'react';
import {createPortal} from 'react-dom';
import {useApp} from '../state/store.jsx';
import {LANES,DEFAULT_LANES_ON,T_FAMILY} from '../data/defaults.js';
import {daysBetween,dateFigures} from '../engine/clocks.js';
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

/* Board tab — LAYOUT-SPEC §4 zones, WNBA rules (WNBA-REDESIGN-SPEC §2/§3). */
export default function BoardTab(){
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
      <PlayerZone/>
      <MatchupPanel/>
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

function DateStrip(){
  const {date,dn,seasonInfo,game,h2h}=useApp();
  const seasonDay=seasonInfo?daysBetween(seasonInfo.start,date)+1:null;
  const hscroll=useHScroll();
  return(
    <div className="date-strip">
      <div className="panel">
        <h3>Season</h3>
        <div className="big">{seasonDay?<>Day <FactNum value={seasonDay}>{seasonDay}</FactNum></>:'—'}</div>
        {game&&<div className="muted mono" style={{fontSize:11,marginTop:4}}>
          season game #{game.gameNumber.away!=null?<FactNum value={game.gameNumber.away}>{game.gameNumber.away}</FactNum>:'–'}
          /{game.gameNumber.home!=null?<FactNum value={game.gameNumber.home}>{game.gameNumber.home}</FactNum>:'–'}
          {h2h&&<> · H2H #<FactNum value={h2h.gameNo}>{h2h.gameNo}</FactNum></>}</div>}
      </div>
      <div className="panel">
        <h3>{date} · {dn.dayName} · {dn.ruler} · DOY {dn.doy} · {dn.left} left</h3>
        <div className="dn-vals" ref={hscroll}>
          {dateFigures(date).map((f,i)=>(
            <span key={i} className="dn-fig" title={f.calc}>
              <b className={f.top?'v-gold':'v-cyan'}>
                <FactNum value={f.n}>{f.n}</FactNum>
              </b>
              <em className="dn-calc">{f.calc}</em>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  return <div className="panel muted">No WNBA games on this date (All-Star break / off-day). The board wakes up with the next slate.</div>;
}

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
        <button key={g.pk} className={`chip${g.pk===gamePk?' on':''}`} onClick={()=>pick(g.pk)}>
          {g.away.abbrev} @ {g.home.abbrev}
          {g.status==='Final'&&<span className="muted">F</span>}
          {g.startET&&g.status!=='Final'&&<span className="muted" style={{fontSize:10}}> {g.startET}</span>}
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

/* context rail: theme purple · thread/H2H blue · date gray. H2H game # chip
   shows the franchise-lineage badge on tap-and-hold (title). */
function ContextRail(){
  const {contextChips,contextFilter,setContextFilter}=useApp();
  const hRail=useHScroll();
  if(!contextChips.length)return null;
  const cls={theme:'purple',thread:'blue',h2h:'blue',date:'gray'};
  return(
    <div className="rail" ref={hRail}>
      {contextChips.map((c,i)=>(
        <button key={i}
          title={c.lineage||undefined}
          className={`chip ${cls[c.kind]||'gray'}${c.cnt>0?' active-hit':''}${contextFilter===c.n?' on':''}`}
          onClick={()=>setContextFilter(contextFilter===c.n?null:c.n)}>
          {c.label} <span className="n"><FactNum value={c.n}>{c.n}</FactNum></span>
          {c.lineage&&<span style={{fontSize:9,opacity:.8}}> ⛓</span>}
          {c.cnt>0&&<span className="cnt">{c.cnt}</span>}
        </button>
      ))}
    </div>
  );
}

function TeamToggle(){
  const {game,side,setSide,setBatterId,deepFetch,deepBusy}=useApp();
  if(!game)return null;
  return(
    <div className="team-toggle">
      {['away','home'].map(s=>(
        <button key={s} className={`chip${side===s?' on':''}`}
          onClick={()=>{setSide(s);setBatterId(null)}}>
          {game[s].teamName}{s==='home'?' 🏠':''}{game.projected?' · proj':''}
        </button>
      ))}
      <button className="chip gold" style={{flex:'0 0 auto'}} disabled={game.deepDone||deepBusy}
        onClick={deepFetch} title="vs-opponent split from this season's meetings">
        ⚡{game.deepDone?' ✓':deepBusy?' …':' DEEP'}
      </button>
    </div>
  );
}

/* player list (sticky left, starters first) + player card + pattern-hits panel */
function PlayerZone(){
  const {board,side,batterId,setBatterId,contextFilter,patternFilter,dayState}=useApp();
  const rows=board[side]||[];
  const inFilter=r=>{
    if(contextFilter!=null&&!r.ev.rungs.some(g=>g.n===contextFilter&&g.hits.length))return false;
    if(patternFilter!=null&&!r.patternHits.some(x=>x.pattern.id===patternFilter))return false;
    return true;
  };
  const filtered=rows.filter(inFilter);
  const sel=rows.find(r=>r.id===batterId)||filtered[0]||rows[0];
  if(!rows.length)return <div className="panel muted">No roster yet — it loads with the slate.</div>;
  return(
    <div className="batter-zone">
      <div className="batter-list">
        {rows.map(r=>{
          const dim=(contextFilter!=null||patternFilter!=null)&&!filtered.includes(r);
          const labels=dayState.labels[r.id]||[];
          return(
            <button key={r.id} className={`batter-row${sel?.id===r.id?' on':''}${dim?' skip':''}`}
              onClick={()=>setBatterId(r.id)}>
              <span className="nm"><span className="ord">{r.starter?'⭐':r.order}</span>{r.ev.p.fullName}</span>
              <span className="badges">
                {r.ev.kat&&<span className="badge gold" title={`KAT rule: ${r.ev.katHits.map(k=>`${k.word} ${k.cipher} ${k.n}`).join(' · ')}`}>KAT</span>}
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
        {sel&&<PlayerCard row={sel}/>}
        <PatternHitsPanel/>
      </div>
    </div>
  );
}

/* pattern-hits — surfaces the Patterns tab's live matches on the board.
   Pills filter the player list (dim non-hitters); names tap through to the
   matching player's card. Game-scoped (both sides); hidden when no hits. */
function PatternHitsPanel(){
  const {board,game,patterns,patternFilter,setPatternFilter,patternCounts,side,setSide,setBatterId}=useApp();
  const [expanded,setExpanded]=useState(null); // pattern id whose full name-list is open
  if(!game)return null;
  const abbrev={away:game.away.abbrev,home:game.home.abbrev};
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

function PlayerCard({row}){
  const {colorFor,contextFilter}=useApp();
  const ev=row.ev;
  const p=ev.p;
  const hitRungs=ev.rungs.filter(r=>r.hits.length>0);
  /* FG rungs headline for the FB lane; PTS next; full ladders surfaced */
  const order={FG:0,PTS:1,'3PM':2,REB:3,AST:4,FT:5,PRA:6,GP:7};
  hitRungs.sort((a,b)=>(order[a.stat]??9)-(order[b.stat]??9)||b.hits.length-a.hits.length||a.off-b.off);
  /* active context chip: rungs landing on that number sort first + ring (§feedback) */
  if(contextFilter!=null)
    hitRungs.sort((a,b)=>(b.n===contextFilter?1:0)-(a.n===contextFilter?1:0));
  const fb=ev.fbCheck;
  return(
    <div className="bcard">
      <div className="who">
        <span className="nm">{p.fullName}</span>
        {p.jersey&&<span className={`jer${ev.jerseyHits.length?' hit':''}`}>#<FactNum value={p.jersey}>{p.jersey}</FactNum></span>}
        <span className="muted" style={{fontSize:11}}>{p.position}{p.starter?' · ⭐ starter':''}</span>
      </div>
      {ev.bday&&(
        <div className="bday-line">
          <FactNum value={ev.bday.since}>{ev.bday.since}</FactNum>d since bday
          {' · '}<FactNum value={ev.bday.until}>{ev.bday.until}</FactNum>d until
          {' · '}age <FactNum value={ev.bday.years}>{ev.bday.years}</FactNum>
          {' · '}day <FactNum value={ev.bday.totalDays}>{ev.bday.totalDays}</FactNum> of life
          {' · '}week <FactNum value={ev.bday.weeks}>{ev.bday.weeks}</FactNum>
        </div>
      )}
      {/* cFG+1 / arena check renders FIRST on the card (§2 house rule) */}
      {(fb.career||fb.season)&&(
        <div className="call-line" style={{borderLeftColor:'var(--cvg-gold)',marginBottom:6}}>
          <span className="tag" style={{color:'var(--cvg-gold)'}}>FB CHECK</span>
          {fb.career&&<> cFG+1 → <b className="mono">{fb.career.n}</b>
            {fb.career.arena&&<b className="v-gold"> ◉ ARENA</b>}
            {fb.career.hits.length>0&&!fb.career.arena&&<span className="muted"> ({fb.career.hits.length} hit{fb.career.hits.length>1?'s':''})</span>}</>}
          {fb.season&&<> · sFG+1 → <b className="mono">{fb.season.n}</b>
            {fb.season.arena&&<b className="v-gold"> ◉ ARENA</b>}
            {fb.season.hits.length>0&&!fb.season.arena&&<span className="muted"> ({fb.season.hits.length})</span>}</>}
          {!fb.career?.hits.length&&!fb.season?.hits.length&&<span className="muted"> — no landings</span>}
        </div>
      )}
      {ev.kat&&(
        <div className="badges" style={{marginBottom:8}}>
          <span className="badge gold">KAT · {ev.katHits.map(k=>`${k.word.split(' ')[0]} ${k.cipher} ${k.n}`).join(' · ')}</span>
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
          {ev.primary.hits.some(h=>h.team===p._side)&&<span className="badge gold" style={{marginLeft:6}}>TEAM LOCK</span>}
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
          const greenlight=r.stat==='GP';
          const flt=contextFilter!=null&&r.n===contextFilter;
          return(
            <div key={i} className={`rung hit${flt?' flt':''}`}>
              <span className="st">{r.scope} {r.stat}{greenlight?' ✓':''}</span>
              <RungNum stat={r.stat} value={r.cur} style={color?{color}:{color:'var(--cvg-green)'}}>{r.n}</RungNum>
              <span className="muted">({r.cur}{r.off>1?` +${r.off}`:' +1'})</span>
              {flt&&<span className="badge blue">◈ CHIP</span>}
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
   checked against the loaded spine (date/thread/theme/core) + institutional
   table, colored with the same rules the rest of the board uses. */
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
            if(r.institutional)tags.push(['TBL','var(--cvg-gold)']);
            const srcs=r.hits.map(h=>h.src).filter(Boolean);
            return(
              <div key={r.off}
                className={`rung-pop-row${r.hit?' hit':''}${sel===r.off?' sel':''}`}
                onClick={()=>setSel(sel===r.off?null:r.off)}>
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

/* Basketball-Reference-style totals table — pure data, neutral text, no heat.
   Percentages/GS are not clickable; every counting cell is a RungNum. */
const TOTALS_COLS=[
  {k:'GP',h:'G',stat:'GP'},{h:'GS',na:true},{k:'MIN',h:'MIN',stat:'MIN'},
  {k:'FG',h:'FG',stat:'FG'},{k:'FGA',h:'FGA',stat:'FG'},{pct:['FG','FGA'],h:'FG%'},
  {k:'3PM',h:'3P',stat:'3PM'},{k:'FG3A',h:'3PA',stat:'3PM'},{pct:['3PM','FG3A'],h:'3P%'},
  {k:'2PM',h:'2P',stat:'2PM'},{k:'2PA',h:'2PA',stat:'2PM'},{pct:['2PM','2PA'],h:'2P%'},
  {k:'FT',h:'FT',stat:'FT'},{k:'FTA',h:'FTA',stat:'FT'},{pct:['FT','FTA'],h:'FT%'},
  {k:'ORB',h:'ORB',stat:'ORB'},{k:'DRB',h:'DRB',stat:'DRB'},{k:'TRB',h:'TRB',stat:'TRB'},
  {k:'AST',h:'AST',stat:'AST'},{k:'STL',h:'STL',stat:'STL'},{k:'BLK',h:'BLK',stat:'BLK'},
  {k:'TOV',h:'TOV',stat:'TOV'},{k:'PF',h:'PF',stat:'PF'},{k:'PTS',h:'PTS',stat:'PTS'},
];
const fmtPct=x=>x>=1?'1.000':'.'+Math.round(x*1000).toString().padStart(3,'0');

function TotalsCell({col,line}){
  if(col.na)return <td className="muted">–</td>;
  if(col.pct){
    const [a,b]=col.pct,av=line[a],bv=line[b];
    return bv?<td className="mono pct">{fmtPct((av||0)/bv)}</td>:<td className="muted">–</td>;
  }
  const v=line[col.k];
  if(v==null)return <td className="muted">–</td>;
  return <td className="mono num"><RungNum stat={col.stat} value={v}>{v}</RungNum></td>;
}

function TotalsTable({players}){
  const hWrap=useHScroll();
  const rows=[];
  players.filter(Boolean).forEach(p=>{
    if(p.career)rows.push({who:p.fullName,scope:'Career',line:p.career});
    if(p.season)rows.push({who:p.fullName,scope:'Season',line:p.season});
  });
  if(!rows.length)return <div className="muted" style={{fontSize:12}}>no totals loaded yet</div>;
  return(
    <div className="totals-wrap" ref={hWrap}>
      <table className="totals">
        <thead>
          <tr><th className="pl">Player</th>{TOTALS_COLS.map(c=><th key={c.h}>{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i}>
              <td className="pl">{r.who} <span className="muted">{r.scope}</span></td>
              {TOTALS_COLS.map(c=><TotalsCell key={c.h} col={c} line={r.line}/>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* bottom panel: the selected player's full totals table (bbref-style) + venue
   / vs-opponent splits + team staircases. The opposing center was dropped per
   Tony (2026-07) — zero reason to surface it here. */
function MatchupPanel(){
  const {matchup}=useApp();
  if(!matchup)return null;
  const {stair,vsHand,vsOpp,oppTag,bat}=matchup;
  const player=bat?.ev?.p;
  return(
    <div className="panel" style={{marginTop:10}}>
      <h3>Totals — {player?player.fullName:'selected player'}</h3>
      {/* Basketball-Reference-style totals — tap any number for its rung ladder */}
      <TotalsTable players={[player]}/>
      {vsHand&&(
        <div className="mono muted" style={{fontSize:11.5,marginTop:8}}>
          selected player venue split: {vsHand.FG??'–'} FG · {vsHand.PTS??'–'} PTS · {vsHand.REB??'–'} REB
        </div>
      )}
      {vsOpp&&(
        <div className="mono muted" style={{fontSize:11.5}}>
          vs {oppTag} this season: {vsOpp.FG??'–'} FG · {vsOpp.PTS??'–'} PTS in {vsOpp.gamesPlayed} game{vsOpp.gamesPlayed>1?'s':''}
        </div>
      )}
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

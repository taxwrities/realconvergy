/* ================================================================
   store — app state context: profile prefs (auto-saved to cvg.*),
   slate data, selections, and the Phase-1 scoring engine
   (loaded-value map + batter/pitcher evaluation + CROSS rows).
   House rules: gematria sort primary; stats annotate, never re-rank;
   AB/PA rungs are green-light signals, never the bet.
================================================================ */
import {createContext,useContext,useEffect,useMemo,useState,useCallback} from 'react';
import {calcAll,ALL_CIPHERS,CIPHER_DEFAULTS,checksum,nameRun} from '../engine/gematria.js';
import {isPrime,primeIndex,compositeIndex,nthPrime,chainBase} from '../engine/numbers.js';
import {clockFrom,dateNumerology,dateFigures,daysBetween,todayISO} from '../engine/clocks.js';
import {CORE_WORDS_MLB,OUTCOME_WORDS,STATS,STAT_DEPTH,LANES,LANE_STAT,
  DEFAULT_LANES_ON,T_FAMILY,DEFAULT_COLOR_RULES,DEFAULT_SETTINGS} from '../data/defaults.js';
import {load,save,loadDay,saveDay,exportConfig,importConfig,loadSlateCache,saveSlateCache} from '../data/storage.js';
import {fetchSlate,fetchSeasonInfo,fetchLineups,deepFetchGame,h2hFor} from '../data/mlb.js';
import {applyLineups} from '../data/lineups.js';
import {evalPattern,isDateDependent,SEED_PATTERNS} from '../engine/patterns.js';
import {fetchScheduleRange,runForecast,gradeForecast,addDays} from '../engine/forecast.js';
import {dateNumerology as dnFor} from '../engine/clocks.js';

const Ctx=createContext(null);
export const useApp=()=>useContext(Ctx);

/* institutional day-count table (Tony 2026-07-20) — the recurring
   day-of-life / career-day figures worth a quick-fill in the finder. */
export const INSTITUTIONAL=[42,48,51,54,56,59,63,65,72,75,78,79,83,96,139,147];

/* the six searchable clock readings per player (Tony 2026-07-20) — birth &
   debut, each as total days + days since last anniv + days to next anniv.
   src picks which clockFrom() the field reads; label names the row/toggle. */
export const DAY_CLOCKS=[
  {key:'lifeTotal',   src:'birth', field:'totalDays', label:'day of life'},
  {key:'bdaySince',   src:'birth', field:'since',     label:'days since bday'},
  {key:'bdayUntil',   src:'birth', field:'until',     label:'days until bday'},
  {key:'careerTotal', src:'debut', field:'totalDays', label:'career day'},
  {key:'debutSince',  src:'debut', field:'since',     label:'days since debut anniv'},
  {key:'debutUntil',  src:'debut', field:'until',     label:'days until debut anniv'},
];

const seedVocab=()=>CORE_WORDS_MLB.map(word=>({word,enabled:true,source:'core',values:calcAll(word)}));

export function AppStateProvider({children}){
  /* ---------- persisted prefs (auto-save on change, §3) ---------- */
  const [profile]=useState(()=>load('cvg.profile','mlb'));
  const [ciphers,setCiphers]=useState(()=>load(`cvg.ciphers.${profile}`,CIPHER_DEFAULTS[profile]||CIPHER_DEFAULTS.mlb));
  const [vocab,setVocab]=useState(()=>load(`cvg.vocab.${profile}`,null)||seedVocab());
  const [phrases,setPhrases]=useState(()=>load('cvg.phrases',[]));
  const [templates,setTemplates]=useState(()=>load('cvg.templates',[]));
  const [colorRules,setColorRules]=useState(()=>load('cvg.colorRules',DEFAULT_COLOR_RULES));
  const [registry,setRegistry]=useState(()=>load('cvg.registry',[]));
  const [settings,setSettings]=useState(()=>({...DEFAULT_SETTINGS,...load('cvg.settings',{})}));
  const [patterns,setPatterns]=useState(()=>{
    const saved=load('cvg.patterns',null);
    if(!saved)return SEED_PATTERNS;
    /* merge: seeds added in later releases reach existing storage, and
       code-owned seed METADATA (example quote) refreshes in place — never
       enabled/conditions, which the user may have edited */
    const byId=new Map(SEED_PATTERNS.map(s=>[s.id,s]));
    const merged=saved.map(p=>{
      const seed=p.seed&&byId.get(p.id);
      return seed&&seed.example!==p.example?{...p,example:seed.example}:p;
    });
    const have=new Set(saved.map(p=>p.id));
    const missing=SEED_PATTERNS.filter(s=>!have.has(s.id));
    return missing.length?[...merged,...missing]:merged;
  });
  const [forecasts,setForecasts]=useState(()=>load('cvg.forecasts',[]));
  /* tap-to-recipe drawer (PATTERN-RECIPES §8): draft conditions collected
     off board evidence rows; survives a reload like every other pref.
     pendingPattern is the drawer → Patterns-editor handoff (transient). */
  const [recipeDraft,setRecipeDraft]=useState(()=>load('cvg.recipeDraft',[]));
  const [pendingPattern,setPendingPattern]=useState(null);
  /* board date — defaults to today, settable from the DateStrip picker so
     tomorrow's slate (schedule + probables + roster projections) is viewable.
     dayState/slate are stamped with the date they belong to (_date) so the
     save effects can't write day A's data under day B's key mid-switch. */
  const today=todayISO();
  const [date,setDate]=useState(today);
  const [dayState,setDayState]=useState(()=>({...loadDay(date),_date:date}));

  useEffect(()=>{save('cvg.profile',profile)},[profile]);
  useEffect(()=>{save(`cvg.ciphers.${profile}`,ciphers)},[ciphers,profile]);
  useEffect(()=>{save(`cvg.vocab.${profile}`,vocab)},[vocab,profile]);
  useEffect(()=>{save('cvg.phrases',phrases)},[phrases]);
  useEffect(()=>{save('cvg.templates',templates)},[templates]);
  useEffect(()=>{save('cvg.colorRules',colorRules)},[colorRules]);
  useEffect(()=>{save('cvg.registry',registry)},[registry]);
  useEffect(()=>{save('cvg.settings',settings)},[settings]);
  useEffect(()=>{save('cvg.patterns',patterns)},[patterns]);
  useEffect(()=>{save('cvg.forecasts',forecasts)},[forecasts]);
  useEffect(()=>{save('cvg.recipeDraft',recipeDraft)},[recipeDraft]);
  useEffect(()=>{if(dayState._date===date)saveDay(date,dayState)},[date,dayState]);
  useEffect(()=>{setDayState({...loadDay(date),_date:date})},[date]);

  /* boot checksum (§2) */
  const boot=useMemo(()=>checksum(),[]);

  /* ---------- slate (hydrate from cache for instant reopen) ---------- */
  const cachedSlate=useMemo(()=>loadSlateCache(date),[date]);
  const [slate,setSlate]=useState(()=>cachedSlate?{...cachedSlate.slate,_date:date}:null); // {games, people, teamStats}
  const [seasonInfo,setSeasonInfo]=useState(()=>cachedSlate?.seasonInfo||null);
  const [slateSavedAt,setSlateSavedAt]=useState(()=>cachedSlate?.savedAt||null);
  const [loading,setLoading]=useState('');
  const [error,setError]=useState('');
  const [gamePk,setGamePk]=useState(()=>cachedSlate?.slate?.games?.[0]?.pk??null);
  const [side,setSide]=useState('away');
  const [batterId,setBatterId]=useState(null);
  const [contextFilter,setContextFilter]=useState(null); // chip value filtering batter list
  const [patternFilter,setPatternFilter]=useState(null); // pattern id filtering batter list

  const refresh=useCallback(async()=>{
    setError('');setLoading('Loading slate…');
    try{
      const [s,si]=await Promise.all([
        fetchSlate(date,setLoading),
        fetchSeasonInfo(date.slice(0,4)).catch(()=>null),
      ]);
      /* preserve same-day DEEP work across a full reload: carry p.deep onto
         matching new people, and game.deepDone by pk — the latter only when
         every current lineup id has splits (or has no stats to split), so a
         call-up can't leave ⚡ DEEP disabled with a starter missing data.
         Same date ⇒ same opponents ⇒ carried vsOpp/month/dow can't be stale. */
      setSlate(prev=>{
        if(prev&&prev._date===date){
          Object.values(s.people).forEach(p=>{
            const old=prev.people?.[p.id];
            if(old?.deep)p.deep=old.deep;
          });
          s.games.forEach(g=>{
            const og=prev.games?.find(x=>x.pk===g.pk);
            if(og?.deepDone&&[...g.homeIds,...g.awayIds].every(id=>{
              const p=s.people[id];
              return!p||p.deep||(!p.career&&!p.season);
            }))g.deepDone=true;
          });
        }
        return{...s,_date:date};
      });
      setSeasonInfo(si);setSlateSavedAt(Date.now());
      /* functional update — validate the pk against the NEW slate's games so a
         date switch can't leave a stale pk from the old day selected */
      setGamePk(pk=>s.games.some(g=>g.pk===pk)?pk:(s.games[0]?.pk??null));
      setLoading('');
    }catch(e){setError('Slate load failed: '+e.message);setLoading('')}
  },[date]);
  /* manual-refresh policy: fetch on boot only when there's no cache for today;
     a valid cache is trusted until the user taps refresh (banner / ↻). */
  /* date switch: hydrate that date's cache or clear for auto-load */
  useEffect(()=>{
    const c=loadSlateCache(date);
    setSlate(c?{...c.slate,_date:date}:null);
    setSeasonInfo(c?.seasonInfo||null);
    setSlateSavedAt(c?.savedAt||null);
    setGamePk(c?.slate?.games?.[0]?.pk??null);
    setBatterId(null);setContextFilter(null);setPatternFilter(null);setError('');
  },[date]);
  /* auto-load whenever the current date has no slate (mount + date switch);
     error gates retries, loading gates re-entry */
  useEffect(()=>{if(!slate&&!loading&&!error)refresh()},[slate,loading,error,refresh]);
  /* write-through: persist every slate change (fetch + ⚡ deep mutation) */
  useEffect(()=>{if(slate&&slate._date===date)saveSlateCache(date,slate,seasonInfo)},[slate,seasonInfo,date]);

  /* ---------- derived: enabled cipher values helper ---------- */
  const vals=useCallback(s=>{
    const v=calcAll(s);
    return ALL_CIPHERS.filter(c=>ciphers[c]).map(c=>({cipher:c,n:v[c]})).filter(x=>x.n>0);
  },[ciphers]);

  const dn=useMemo(()=>dateNumerology(date,ciphers),[date,ciphers]);

  const game=useMemo(()=>slate?.games.find(g=>g.pk===gamePk)||null,[slate,gamePk]);
  const h2h=useMemo(()=>game?h2hFor(game,date):null,[game,date]);

  /* ---------- loaded-value map for the active game ----------
     number → [{src, cat}]; cat drives color rules + chip typing. */
  const loaded=useMemo(()=>{
    const m=new Map();
    const add=(n,src,cat)=>{
      n=+n;if(!n||n<=0)return;
      const a=m.get(n)||[];a.push({src,cat});m.set(n,a);
    };
    vocab.filter(w=>w.enabled).forEach(w=>{
      ALL_CIPHERS.filter(c=>ciphers[c]).forEach(c=>{const n=w.values[c];if(n)add(n,`${w.word} ${c}`,'core')});
    });
    Object.entries(dn.vals).forEach(([n,l])=>add(n,l,'date'));
    Object.entries(dn.rulerVals).forEach(([n,l])=>add(n,l,'date'));
    dayState.adhocThread.forEach(n=>add(n,'thread','thread'));
    [...registry,...dayState.adhocThemes].forEach(t=>{
      ALL_CIPHERS.filter(c=>ciphers[c]).forEach(c=>{const n=t.values?.[c];if(n)add(n,`${t.name} ${c}`,'theme')});
    });
    phrases.forEach(p=>{
      ALL_CIPHERS.filter(c=>ciphers[c]).forEach(c=>{const n=p.values?.[c];if(n)add(n,`"${p.text}" ${c}`,'phrase')});
    });
    if(game){
      [game.home,game.away].forEach(t=>{
        [t.name,t.teamName,t.locationName].filter(Boolean).forEach(nm=>{
          vals(nm).forEach(({cipher,n})=>add(n,`${nm} ${cipher}`,'context'));
        });
      });
      if(game.venue)vals(game.venue).forEach(({cipher,n})=>add(n,`${game.venue} ${cipher}`,'context'));
      add(game.gameNumber.home,`${game.home.teamName} game #${game.gameNumber.home}`,'context');
      add(game.gameNumber.away,`${game.away.teamName} game #${game.gameNumber.away}`,'context');
      if(h2h){
        add(h2h.gameNo,`H2H meeting #${h2h.gameNo}`,'h2h');
        add(h2h.awayWins,`${game.away.abbrev} series wins`,'h2h');
        add(h2h.homeWins,`${game.home.abbrev} series wins`,'h2h');
        if(h2h.ties)add(h2h.ties,'all-time series ties','h2h');
        if(h2h.daysSinceLast)add(h2h.daysSinceLast,'days since last meeting','h2h');
        if(h2h.daysSinceFirst)add(h2h.daysSinceFirst,'days since first-ever meeting','h2h');
      }
    }
    return m;
  },[vocab,ciphers,dn,dayState,registry,phrases,game,h2h,vals]);

  /* ---------- pattern-engine source sets + ctx builder ---------- */
  const patternSources=useMemo(()=>{
    const core=[],theme=[];
    vocab.filter(w=>w.enabled).forEach(w=>{
      ALL_CIPHERS.filter(c=>ciphers[c]).forEach(c=>{const n=w.values[c];if(n)core.push({n,label:`${w.word} ${c}`})});
    });
    [...registry,...dayState.adhocThemes].forEach(t=>{
      ALL_CIPHERS.filter(c=>ciphers[c]).forEach(c=>{const n=t.values?.[c];if(n)theme.push({n,label:`${t.name} ${c}`})});
    });
    const dateThread=[
      ...Object.entries(dn.vals).map(([n,l])=>({n:+n,label:l})),
      ...dayState.adhocThread.map(n=>({n,label:'thread'})),
    ];
    const loadedAll=[...loaded.entries()].map(([n,hits])=>({n,label:hits[0].src}));
    return{core,theme,dateThread,loadedAll};
  },[vocab,ciphers,registry,dayState,dn,loaded]);

  const buildPatternCtx=useCallback(({p,side,g,dnUse,gameNumber,dateThread,loadedAll})=>{
    const teamName=g?(side==='home'?g.home.teamName:g.away.teamName):'';
    const oppTeamName=g?(side==='home'?g.away.teamName:g.home.teamName):'';
    /* all name variants for the team/oppTeam sources — nickname alone misses
       full-name values ("Mets"=57 but "New York Mets"=168); same variant set
       the loaded map indexes. */
    const nameVariants=t=>t?[...new Set([t.name,t.teamName,t.locationName].filter(Boolean))]:[];
    const teamNames=g?nameVariants(side==='home'?g.home:g.away):[];
    const oppTeamNames=g?nameVariants(side==='home'?g.away:g.home):[];
    const spId=g?(side==='home'?g.awaySP:g.homeSP):null;
    const sp=spId?slate?.people[spId]:null;
    const ctxDate=dnUse===dn?date:dnUse._date;
    const bday=p.birthDate?clockFrom(p.birthDate,ctxDate):null;
    const spClock=sp?.birthDate?clockFrom(sp.birthDate,ctxDate):null;
    return{
      ciphers,templates,dn:dnUse,date:ctxDate,
      gameNumber:gameNumber??(g?g.gameNumber[side]:null),
      teamStats:g?slate?.teamStats[side==='home'?g.home.id:g.away.id]:null,
      teamName,oppTeamName,teamNames,oppTeamNames,stadium:g?.venue||'',
      oppPitcherName:sp?.fullName||'',oppPitcherVals:sp?nameRun(sp.fullName,ciphers):[],
      oppPitcherClock:spClock?[
        {n:spClock.since,label:`${spClock.since}d after SP bday`},
        {n:spClock.until,label:`${spClock.until}d to SP bday`},
        {n:spClock.years,label:`SP age ${spClock.years}`},
        {n:spClock.years+1,label:`SP turns ${spClock.years+1}`},
      ].filter(x=>x.n>0):[],
      themeNames:[...registry,...dayState.adhocThemes].map(t=>t.name),
      sources:{core:patternSources.core,theme:patternSources.theme,
        dateThread:dateThread||patternSources.dateThread,
        loadedAll:loadedAll||patternSources.loadedAll},
      batter:{p,side,nameVals:nameRun(p.fullName,ciphers),
        ageFigures:bday?[
          {n:bday.years,label:`age ${bday.years}`},{n:bday.years+1,label:`turns ${bday.years+1}`},
          {n:bday.since,label:`${bday.since}d since bday`},{n:bday.until,label:`${bday.until}d to bday`},
          {n:bday.totalDays,label:`day ${bday.totalDays} alive`},{n:bday.weeks,label:`week ${bday.weeks}`},
        ].filter(x=>x.n>0):[]},
    };
  },[ciphers,templates,slate,dn,date,registry,dayState,patternSources]);

  /* ---------- batter evaluation ---------- */
  const evalBatter=useCallback(p=>{
    if(!p)return null;
    const run=nameRun(p.fullName,ciphers);
    if(p.legalName)run.push(...nameRun(p.legalName,ciphers).map(x=>({...x,legal:true})));
    const nameNums=new Set(run.map(x=>x.n));
    /* name = date figure (Tony 2026-07-16: A.J. Ewing 69 Ord / 33 Red hit both
       top figures). Precise dateFigures set only — the wide dn map would light
       half the roster. */
    const figMap=new Map(dateFigures(date).map(f=>[f.n,f]));
    const dateNameHits=run.filter(x=>figMap.has(x.n))
      .map(x=>({...x,calc:figMap.get(x.n).calc,top:!!figMap.get(x.n).top}));
    const bday=p.birthDate?clockFrom(p.birthDate,date):null;
    const bdayNums=bday?[
      {n:bday.since,label:`${bday.since}d after bday`},
      {n:bday.until,label:`${bday.until}d to bday`},
      {n:bday.years,label:`age ${bday.years}`},
      {n:bday.years+1,label:`turns ${bday.years+1}`},
      {n:bday.totalDays,label:`day ${bday.totalDays} of life`},
      {n:bday.weeks,label:`week ${bday.weeks}`},
    ].filter(x=>x.n>0):[];
    const bdaySet=new Set(bdayNums.map(x=>x.n));
    /* career debut clock — same treatment as the birthday (Tony 2026-07-16) */
    const debut=p.debutDate?clockFrom(p.debutDate,date):null;
    const debutNums=debut?[
      {n:debut.since,label:`${debut.since}d after debut anniv`},
      {n:debut.until,label:`${debut.until}d to debut anniv`},
      {n:debut.years,label:`${debut.years}y since debut`},
      {n:debut.totalDays,label:`career day ${debut.totalDays}`},
      {n:debut.weeks,label:`career week ${debut.weeks}`},
      {n:debut.months,label:`career month ${debut.months}`},
    ].filter(x=>x.n>0):[];
    const debutSet=new Set(debutNums.map(x=>x.n));
    /* day-of-life / career-day landing ON a locked date figure — the natural
       cross-reference Tony asked for (2026-07-20). Precise dateFigures only,
       same as the name=date hits above; the wide dn map would light half the
       roster (totalDays is thousands, so a hit here is rare and meaningful). */
    const dayMatches=[];
    if(bday&&figMap.has(bday.totalDays)){
      const f=figMap.get(bday.totalDays);
      dayMatches.push({kind:'life',n:bday.totalDays,label:'day-of-life',calc:f.calc,top:!!f.top});
    }
    if(debut&&figMap.has(debut.totalDays)){
      const f=figMap.get(debut.totalDays);
      dayMatches.push({kind:'career',n:debut.totalDays,label:'career-day',calc:f.calc,top:!!f.top});
    }
    const hitsFor=n=>{
      const out=[...(loaded.get(n)||[])];
      if(nameNums.has(n))run.filter(x=>x.n===n).forEach(x=>out.push({src:`${x.label} ${x.cipher}`,cat:'name'}));
      if(bdaySet.has(n))bdayNums.filter(x=>x.n===n).forEach(x=>out.push({src:x.label,cat:'bday'}));
      if(debutSet.has(n))debutNums.filter(x=>x.n===n).forEach(x=>out.push({src:x.label,cat:'debut'}));
      if(p.jersey===n)out.push({src:`#${p.jersey} jersey`,cat:'jersey'});
      if(isPrime(n)){
        const pi=primeIndex(n);
        (loaded.get(pi)||[]).forEach(h=>out.push({src:`${n}=${pi}th prime → ${h.src}`,cat:h.cat,bridge:true}));
      }
      return out;
    };
    const rungs=[];
    STATS.forEach(([lbl,key])=>{
      const depth=STAT_DEPTH[lbl]||1;
      [['career',p.career],['season',p.season]].forEach(([scope,obj])=>{
        if(!obj||obj[key]==null)return;
        for(let k=1;k<=depth;k++){
          const n=+obj[key]+k;
          const hits=hitsFor(n);
          rungs.push({stat:lbl,scope,n,cur:+obj[key],off:k,hits});
        }
      });
      // venue-side splits (home batter → home split), HR emphasis like scanner
      const loc=p._side==='home'?'home':'away';
      ['career','season'].forEach(scope=>{
        const s=p.split?.[scope+'-'+loc];
        if(s&&s[key]!=null&&(lbl==='HR'||lbl==='TB')){
          for(let k=1;k<=(STAT_DEPTH[lbl]||1);k++){
            const n=+s[key]+k;
            rungs.push({stat:lbl,scope:`${scope}·${loc}`,n,cur:+s[key],off:k,hits:hitsFor(n)});
          }
        }
      });
    });
    const jerseyHits=p.jersey?(loaded.get(p.jersey)||[]).concat(
      (p.jersey===dn.M||p.jersey===dn.DD)?[{src:`${dn.M}/${dn.DD} date`,cat:'date'}]:[]):[];
    const threadHit=rungs.some(r=>r.hits.some(h=>h.cat==='thread'));
    /* lane badges: outcome lanes with a live rung hit; AB/PA excluded from
       badges (green-light only, shown in card) */
    const lanes={};
    LANES.forEach(L=>{
      const st=LANE_STAT[L];
      lanes[L]=rungs.some(r=>r.stat===st&&r.hits.length>0);
    });
    /* PRIMARY/ALT call lines from refine lanes only, ranked by distinct
       evidence count then closeness (off) — gematria first, stats annotate */
    const laneStats=new Set(settings.lanesOn.map(L=>LANE_STAT[L]));
    const candidates=rungs
      .filter(r=>laneStats.has(r.stat)&&r.hits.length>0)
      .sort((a,b)=>b.hits.length-a.hits.length||a.off-b.off);
    return{p,run,bday,bdayNums,debut,debutNums,dayMatches,rungs,jerseyHits,threadHit,lanes,dateNameHits,
      jesuit:!!p.jesuit,school:p.school||null,
      primary:candidates[0]||null,alt:candidates[1]||null,nameNums};
  },[ciphers,date,loaded,dn,settings.lanesOn]);

  /* ---------- board: evaluated lineup for active game/side ---------- */
  const board=useMemo(()=>{
    if(!slate||!game)return{away:[],home:[]};
    const daily=patterns.filter(pt=>pt.enabled&&!isDateDependent(pt));
    const out={};
    ['away','home'].forEach(s=>{
      out[s]=game[s+'Ids'].map((id,i)=>{
        const p=slate.people[id];
        if(!p)return null;
        const ctx=buildPatternCtx({p:{...p,_side:s},side:s,g:game,dnUse:dn});
        const patternHits=daily.map(pt=>({pattern:pt,res:evalPattern(pt,ctx)}))
          .filter(x=>x.res.match);
        const upcoming=forecasts.filter(f=>f.playerId===id&&f.date>=date)
          .sort((a,b)=>a.date<b.date?-1:1);
        return{order:i+1,ev:evalBatter({...p,_side:s}),id,patternHits,
          forecast:upcoming[0]||null,maturing:upcoming.find(f=>f.date===date)||null};
      }).filter(Boolean);
    });
    return out;
  },[slate,game,evalBatter,patterns,forecasts,date,dn,buildPatternCtx]);

  /* per-batter pattern preview for the editor (live, §5). overrideId
     (PATTERN-RECIPES §9) previews any slate batter — building from a blog
     line means the target usually isn't the board selection. */
  const previewPattern=useCallback((pattern,overrideId)=>{
    if(!slate)return null;
    const id=overrideId??(batterId||board[side]?.[0]?.id);
    const g=overrideId!=null
      ?slate.games.find(x=>x.homeIds.includes(overrideId)||x.awayIds.includes(overrideId))
      :game;
    const p=id!=null?slate.people[id]:null;
    if(!p||!g)return null;
    const s=g.homeIds.includes(id)?'home':'away';
    const ctx=buildPatternCtx({p:{...p,_side:s},side:s,g,dnUse:dn});
    return{who:p.fullName,res:evalPattern(pattern,ctx)};
  },[slate,game,batterId,board,side,buildPatternCtx,dn]);

  /* pattern hit counts across today's whole slate ("N hits today") */
  /* slate-wide pattern hits WITH identities (who/where), so the Patterns tab
     can name the hitters instead of a bare count (Tony 2026-07-16). Date-
     dependent patterns are included — they evaluate fine against today's dn;
     excluding them made their cards read '0 hits today' while hitting. */
  const patternHitsAll=useMemo(()=>{
    if(!slate)return{hits:{},legs:{}};
    const hits={},legs={};
    const enabled=patterns.filter(pt=>pt.enabled);
    if(enabled.length)slate.games.forEach(g=>{
      ['away','home'].forEach(s=>{
        g[s+'Ids'].forEach(id=>{
          const p=slate.people[id];
          if(!p||(!p.career&&!p.season))return;
          const ctx=buildPatternCtx({p:{...p,_side:s},side:s,g,dnUse:dn});
          enabled.forEach(pt=>{
            const res=evalPattern(pt,ctx);
            /* per-leg pass counts — so a 0-hit card can explain how close the
               slate is (e.g. 20 pass leg 1, 16 pass leg 2, nobody both) */
            const L=legs[pt.id]=legs[pt.id]||pt.conditions.map(()=>0);
            res.details.forEach((d,i)=>{if(d.pass)L[i]++});
            if(res.match)
              (hits[pt.id]=hits[pt.id]||[]).push({id,side:s,pk:g.pk,
                name:p.fullName,abbr:g[s].abbrev||g[s].teamName});
          });
        });
      });
    });
    return{hits,legs};
  },[slate,patterns,buildPatternCtx,dn]);
  const patternCounts=useMemo(
    ()=>Object.fromEntries(Object.entries(patternHitsAll.hits).map(([k,v])=>[k,v.length])),
    [patternHitsAll]);

  /* deep splits for the active game (vsTeam / league / month / day-of-week) */
  const [deepBusy,setDeepBusy]=useState(false);
  /* cheap lineup recheck: ONE schedule call; confirmed starters replace a
     projected side's roster in place (drop the non-starters — Tony
     2026-07-16). A same-day call-up not in the hydrated people falls back
     to the full refresh. */
  const [lineupBusy,setLineupBusy]=useState(false);
  const checkLineups=useCallback(async()=>{
    if(!slate||lineupBusy)return;
    setLineupBusy(true);
    try{
      const raw=await fetchLineups(date);
      const{changed,needsFull}=applyLineups(slate.games,raw,slate.people);
      if(needsFull)await refresh();
      else if(changed){
        setSlate({...slate,_date:date}); // games mutated in place; new ref re-derives + persists
        setBatterId(b=>b!=null&&!slate.games.some(g=>g.homeIds.includes(b)||g.awayIds.includes(b))?null:b);
      }
    }catch(e){setError('Lineup check failed: '+e.message)}
    setLineupBusy(false);
  },[slate,date,lineupBusy,refresh]);

  const deepFetch=useCallback(async()=>{
    if(!slate||!game||game.deepDone||deepBusy)return;
    setDeepBusy(true);
    try{
      await deepFetchGame(game,slate.people,date,()=>{});
      setSlate({...slate}); // people mutated in place; new ref re-derives
    }catch(e){setError('Deep fetch failed: '+e.message)}
    setDeepBusy(false);
  },[slate,game,date,deepBusy]);

  /* ---------- forecast engine (§6): generate + freeze + grade ---------- */
  const [forecastBusy,setForecastBusy]=useState('');
  const generateForecasts=useCallback(async()=>{
    if(!slate?.games.length)return;
    setForecastBusy('Fetching schedule window…');
    try{
      const days=settings.forecastDays||10;
      const scheduleByTeam=await fetchScheduleRange(addDays(date,1),addDays(date,days));
      const roster=[];
      slate.games.forEach(g=>{
        ['away','home'].forEach(s=>{
          g[s+'Ids'].forEach(id=>{
            const p=slate.people[id];
            if(p&&(p.career||p.season))roster.push({p,teamId:g[s].id,teamName:g[s].teamName,side:s,g});
          });
        });
      });
      setForecastBusy(`Walking ${days} days × ${roster.length} batters…`);
      const cards=runForecast({patterns,roster,fromDate:date,days,scheduleByTeam,
        ctxFactory:(row,s,projected)=>{
          const dnD=dnFor(s.date,ciphers);dnD._date=s.date;
          let deep=row.p.deep;
          if(deep?.dowAll){
            const dw=new Date(s.date+'T12:00:00').getDay()+1;
            deep={...deep,dow:deep.dowAll[dw]||null,
              dowTag:['','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dw]};
          }
          const dateThread=[
            ...Object.entries(dnD.vals).map(([n,l])=>({n:+n,label:l})),
            ...dayState.adhocThread.map(n=>({n,label:'thread'})),
          ];
          return buildPatternCtx({
            p:{...row.p,season:projected.season,career:projected.career,deep,_side:s.side},
            side:s.side,g:null,dnUse:dnD,gameNumber:s.gameNumber,
            dateThread,loadedAll:[...patternSources.core,...patternSources.theme,...dateThread],
          });
        }});
      /* frozen-card discipline: keep already-frozen past/graded cards, replace the future set */
      setForecasts(f=>[...f.filter(x=>x.date<=date),...cards]);
      setForecastBusy('');
    }catch(e){setForecastBusy('');setError('Forecast failed: '+e.message)}
  },[slate,patterns,settings.forecastDays,date,ciphers,dayState,buildPatternCtx,patternSources]);

  const grade=useCallback(async card=>{
    const g=await gradeForecast(card,date.slice(0,4));
    setForecasts(fs=>fs.map(f=>f.id===card.id?{...f,grade:g}:f));
    return g;
  },[date]);

  /* registry graduation (§10.4): adhoc theme → cvg.registry with team tags */
  const graduateTheme=useCallback((name,teams)=>{
    const t=dayState.adhocThemes.find(x=>x.name===name);
    if(!t||registry.some(r=>r.name===name))return;
    setRegistry(r=>[...r,{name:t.name,teams:teams||[],values:t.values}]);
    setDayState(s=>({...s,adhocThemes:s.adhocThemes.filter(x=>x.name!==name)}));
  },[dayState,registry]);

  /* card-logging (§10.4): freeze-scan day log → data/YYYY-MM-DD.json + logs/…md */
  const exportDayLog=useCallback(()=>{
    if(!slate)return;
    const daily=patterns.filter(pt=>pt.enabled&&!isDateDependent(pt));
    const gamesOut=slate.games.map(g=>({
      pk:g.pk,label:`${g.away.teamName} @ ${g.home.teamName}`,status:g.status,
      frozen:g.status==='Preview',projected:g.projected,
      batters:['away','home'].flatMap(s=>g[s+'Ids'].map(id=>{
        const p=slate.people[id];
        if(!p||(!p.career&&!p.season))return null;
        const ev=evalBatter({...p,_side:s});
        const ctx=buildPatternCtx({p:{...p,_side:s},side:s,g,dnUse:dn});
        const pats=daily.filter(pt=>evalPattern(pt,ctx).match).map(pt=>pt.name);
        return{name:p.fullName,team:g[s].teamName,side:s,jersey:p.jersey,
          primary:ev.primary?{col:`${ev.primary.scope} ${ev.primary.stat}`,n:ev.primary.n,sits:ev.primary.cur,
            evidence:ev.primary.hits.map(h=>h.src)}:null,
          alt:ev.alt?{col:`${ev.alt.scope} ${ev.alt.stat}`,n:ev.alt.n,sits:ev.alt.cur}:null,
          lanes:Object.entries(ev.lanes).filter(([,v])=>v).map(([L])=>L),
          patterns:pats,thread:ev.threadHit};
      }).filter(Boolean)),
    }));
    const payload={schema:'cvg-day-log/v1',date,exportedAt:new Date().toISOString(),
      lanesOn:settings.lanesOn,thread:dayState.adhocThread,
      themes:[...dayState.adhocThemes.map(t=>t.name),...registry.map(t=>t.name)],
      forecastsMaturing:forecasts.filter(f=>f.date===date),games:gamesOut};
    const dl=(name,text,type)=>{
      const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();
      URL.revokeObjectURL(a.href);
    };
    dl(`${date}.json`,JSON.stringify(payload,null,1),'application/json');
    const md=[`# Board log — ${date}`,''];
    gamesOut.forEach(g=>{
      md.push(`## ${g.label}${g.frozen?'':' ⚠ NOT FROZEN'}`);
      g.batters.filter(b=>b.primary||b.patterns.length).forEach(b=>{
        md.push(`- **${b.name}** (${b.team})${b.primary?` — ${b.primary.col} → ${b.primary.n} (sits ${b.primary.sits})`:''}${b.patterns.length?` · patterns: ${b.patterns.join(', ')}`:''}${b.thread?' · THREAD':''}`);
      });
      md.push('');
    });
    dl(`${date}.md`,md.join('\n'),'text/markdown');
  },[slate,patterns,evalBatter,buildPatternCtx,dn,date,settings.lanesOn,dayState,registry,forecasts]);

  /* ---------- context rail chips with hit counts ---------- */
  const contextChips=useMemo(()=>{
    if(!game)return[];
    const chips=[];
    const roster=[...board.away,...board.home];
    const countHits=n=>roster.filter(r=>r.ev.rungs.some(g=>g.n===n&&g.hits.length)).length;
    [...dayState.adhocThemes,...registry.filter(t=>!t.teams||t.teams.includes(game.home.teamName)||t.teams.includes(game.away.teamName))]
      .forEach(t=>{
        ALL_CIPHERS.filter(c=>ciphers[c]).forEach(c=>{
          const n=t.values?.[c];
          if(n)chips.push({kind:'theme',label:t.name,n,cnt:countHits(n)});
        });
      });
    dayState.adhocThread.forEach(n=>chips.push({kind:'thread',label:'thread',n,cnt:countHits(n)}));
    if(h2h){
      chips.push({kind:'h2h',label:'H2H game #',n:h2h.gameNo,cnt:countHits(h2h.gameNo),
        lineage:h2h.lineageNote.length?h2h.lineageNote.join(' · '):null});
      chips.push({kind:'h2h',label:`${game.away.abbrev} W`,n:h2h.awayWins,cnt:countHits(h2h.awayWins)});
      chips.push({kind:'h2h',label:`${game.home.abbrev} W`,n:h2h.homeWins,cnt:countHits(h2h.homeWins)});
      if(h2h.ties)chips.push({kind:'h2h',label:'series ties',n:h2h.ties,cnt:countHits(h2h.ties)});
      if(h2h.daysSinceLast!=null)chips.push({kind:'h2h',label:'days since last',n:h2h.daysSinceLast,cnt:countHits(h2h.daysSinceLast)});
      if(h2h.daysSinceFirst!=null)chips.push({kind:'h2h',label:'days since first',n:h2h.daysSinceFirst,cnt:countHits(h2h.daysSinceFirst)});
    }
    chips.push({kind:'date',label:'DOY',n:dn.doy,cnt:countHits(dn.doy)});
    chips.push({kind:'date',label:`${dn.M}/${dn.DD}`,n:+(''+dn.M+dn.DD),cnt:countHits(+(''+dn.M+dn.DD))});
    chips.push({kind:'date',label:'days left',n:dn.left,cnt:countHits(dn.left)});
    return chips;
  },[game,board,dayState,registry,ciphers,dn,h2h]);

  /* ---------- matchup: pitcher + CROSS rows + team staircases ---------- */
  const matchup=useMemo(()=>{
    if(!slate||!game||!batterId)return null;
    const bat=[...board.away,...board.home].find(r=>r.id===batterId);
    if(!bat)return null;
    const batSide=board.away.some(r=>r.id===batterId)?'away':'home';
    const spId=batSide==='away'?game.homeSP:game.awaySP;
    const sp=spId?slate.people[spId]:null;
    const cross=[];
    if(sp){
      const spRun=nameRun(sp.fullName,ciphers);
      const batNums=new Set([...bat.ev.nameNums,...bat.ev.rungs.filter(r=>r.off===1).map(r=>r.n)]);
      spRun.forEach(x=>{
        if(batNums.has(x.n)){
          /* carry the anchoring rung so the recipe drawer can express the
             row as a condition (name-vs-name rows stay text-only) */
          const rungHits=bat.ev.rungs.filter(r=>r.off===1&&r.n===x.n);
          const why=rungHits.map(r=>`${r.scope} ${r.stat}→${r.n}`);
          cross.push({n:x.n,rung:rungHits[0]||null,
            text:`${sp.lastName} ${x.cipher} ${x.n} = ${why.length?why.join(' + '):'batter name value'}`});
        }
        if(x.n===game.gameNumber.home||x.n===game.gameNumber.away)
          cross.push({n:x.n,gameNo:true,text:`${sp.lastName} ${x.cipher} ${x.n} = team game #${x.n}`});
      });
    }
    // team staircases: next R/AB/PA/TB that land on loaded or batter milestone values
    const stair=[];
    const teamId=batSide==='away'?game.away.id:game.home.id;
    const ts=slate.teamStats[teamId];
    if(ts){
      const batNext=new Set(bat.ev.rungs.filter(r=>r.off===1).map(r=>r.n));
      ['R','AB','PA','TB'].forEach(k=>{
        if(ts[k]==null)return;
        for(let add=1;add<=(k==='R'?10:45);add++){
          const n=ts[k]+add;
          const hit=loaded.get(n)||[];
          if(hit.length||batNext.has(n)){
            stair.push({k,n,cur:ts[k],need:add,
              why:hit.length?hit[0].src:'batter milestone '+n});
            break;
          }
        }
      });
    }
    const spBday=sp?.birthDate?clockFrom(sp.birthDate,date):null;
    return{sp,spRun:sp?nameRun(sp.fullName,ciphers):[],spBday,cross,stair,bat,
      vsHand:bat.ev.p.split?.[batSide==='away'?'season-away':'season-home']||null};
  },[slate,game,batterId,board,ciphers,loaded,date]);

  /* ---------- color rules resolver (§8: first match wins) ---------- */
  const colorFor=useCallback((n,cats=[])=>{
    for(const r of colorRules){
      const t=r.target;
      if(t.type==='number'&&+t.value===n)return r.color;
      if(t.type==='family'&&t.value==='T'&&(T_FAMILY.includes(n)||(isPrime(n)&&T_FAMILY.includes(primeIndex(n)))))return r.color;
      if(t.type==='category'&&cats.includes(t.value==='date'?'date':t.value))return r.color;
      if(t.type==='prefix'&&cats.some(c=>typeof c==='string'&&c.startsWith(t.value)))return r.color;
    }
    return null;
  },[colorRules]);

  /* ---------- recipe-drawer actions (PATTERN-RECIPES §8) ---------- */
  const addDraft=useCallback(d=>{
    if(d)setRecipeDraft(ds=>[...ds,{id:`d${Date.now()}-${ds.length}`,...d}]);
  },[]);
  const removeDraft=useCallback(id=>{
    setRecipeDraft(ds=>ds.filter(x=>x.id!==id));
  },[]);
  const toggleDraftHard=useCallback(id=>{
    setRecipeDraft(ds=>ds.map(x=>x.id===id?{...x,cond:{...x.cond,hard:!x.cond.hard}}:x));
  },[]);
  const clearDrafts=useCallback(()=>setRecipeDraft([]),[]);

  /* ---------- quick-add actions (§8, all persist for the day) ---------- */
  const addTheme=useCallback(name=>{
    const t={name:name.trim(),values:calcAll(name)};
    if(!t.name)return;
    const dupe=nm=>nm.toLowerCase()===t.name.toLowerCase();
    if(registry.some(r=>dupe(r.name)))return;
    setDayState(s=>s.adhocThemes.some(x=>dupe(x.name))?s:{...s,adhocThemes:[...s.adhocThemes,t]});
  },[registry]);
  const removeTheme=useCallback(name=>{
    setDayState(s=>({...s,adhocThemes:s.adhocThemes.filter(x=>x.name!==name)}));
  },[]);
  const removeRegistryTheme=useCallback(name=>{
    setRegistry(r=>r.filter(x=>x.name!==name));
  },[]);
  const addThread=useCallback(n=>{
    n=+n;if(n>0)setDayState(s=>({...s,adhocThread:[...new Set([...s.adhocThread,n])]}));
  },[]);
  const addLabel=useCallback((playerId,label)=>{
    setDayState(s=>({...s,labels:{...s.labels,[playerId]:[...(s.labels[playerId]||[]),label]}}));
  },[]);
  /* vocab save gated on checksum (§2/§7) */
  const saveVocab=useCallback(next=>{
    const c=checksum();
    if(!c.ok)return{ok:false,msg:`Checksum FAILED (JESUIT ORDER ${JSON.stringify(c.got)}) — save refused`};
    setVocab(next);
    return{ok:true};
  },[]);
  const addPhrase=useCallback(text=>{
    const t=text.trim().toUpperCase();
    if(t)setPhrases(ps=>[...ps,{text:t,values:calcAll(t),source:'manual'}]);
  },[]);

  /* ---------- universal search (§8: bottom-up method as UI) ---------- */
  const search=useCallback((q,off=0)=>{
    q=q.trim();
    if(!q)return null;
    const roster=slate&&game?[...board.away,...board.home]:[];
    /* "jesuit" → every Jesuit-educated player on today's whole slate (§8 info
       branch), not just the active game. Tony 2026-07-20. */
    if(/^jesuit$/i.test(q)){
      const seen=new Set(),players=[];
      slate?.games.forEach(g=>['away','home'].forEach(s=>g[s+'Ids'].forEach(id=>{
        const p=slate.people[id];
        if(!p||!p.jesuit||seen.has(id))return;
        seen.add(id);
        players.push({id,pk:g.pk,side:s,who:p.fullName,school:p.school,
          team:g[s].abbrev||g[s].teamName,
          gameLabel:`${g.away.abbrev||g.away.teamName} @ ${g.home.abbrev||g.home.teamName}`});
      })));
      players.sort((a,b)=>(a.school||'').localeCompare(b.school||'')||a.who.localeCompare(b.who));
      return{kind:'jesuit',players};
    }
    if(/^\d+$/.test(q)){
      const n=+q;
      off=Math.max(0,Math.floor(+off||0));
      /* stat-total rungs landing on n (the original behavior) */
      const rungHits=roster.flatMap(r=>r.ev.rungs.filter(g=>g.n===n)
        .map(g=>({kind:'rung',who:r.ev.p.fullName,rung:g})));
      /* day-of-life / career-day hits (within ±off) — the birth/debut clocks
         already feed rung scoring; this makes them directly searchable. Tony
         2026-07-20. */
      const dayHits=roster.flatMap(r=>{
        const ev=r.ev,out=[];
        const chk=(clock,field,mk)=>{
          if(!clock)return;
          const val=clock[field];
          if(!(val>0))return;
          const d=val-n;
          if(Math.abs(d)<=off)out.push({kind:'day',who:ev.p.fullName,n:val,delta:d,label:mk(val)});
        };
        chk(ev.bday,'totalDays',v=>`day ${v.toLocaleString()} of life`);
        chk(ev.bday,'since',v=>`${v} days since bday`);
        chk(ev.bday,'until',v=>`${v} days until bday`);
        chk(ev.debut,'totalDays',v=>`career day ${v.toLocaleString()}`);
        chk(ev.debut,'since',v=>`${v} days since debut anniv`);
        chk(ev.debut,'until',v=>`${v} days until debut anniv`);
        return out;
      }).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));
      return{kind:'number',n,off,
        prime:isPrime(n),primeIdx:primeIndex(n),compIdx:compositeIndex(n),nthP:n<=250?nthPrime(n):0,
        tFam:T_FAMILY.includes(n),chain:chainBase(n),
        tableHits:(loaded.get(n)||[]),
        rosterHits:[...rungHits,...dayHits],
      };
    }
    const v=calcAll(q);
    return{kind:'word',word:q.toUpperCase(),values:v,
      occ:ALL_CIPHERS.filter(c=>ciphers[c]).flatMap(c=>{
        const n=v[c];
        return roster.flatMap(r=>r.ev.rungs.filter(g=>g.n===n&&g.off===1).map(g=>({who:r.ev.p.fullName,cipher:c,rung:g})));
      })};
  },[slate,game,board,loaded,ciphers]);

  /* ---------- Day-of-Life / Career-Day finder (Tony 2026-07-20) ----------
     the ±N slate-wide query: sweep every player in every loaded game, match
     each enabled clock reading (six: birth/debut × total/since/until) against
     target number(s) within tol. Rows carry DN-spine / institutional badges +
     are sorted by |offset|. `on` is a {clockKey→bool} map (default all on). */
  const findDays=useCallback(({targets,tol=3,on})=>{
    if(!slate?.games?.length||!targets?.length)return[];
    const t=Math.max(0,Math.min(10,Math.floor(+tol||0)));
    const spine=new Set(dateFigures(date).map(f=>f.n));
    const inst=new Set(INSTITUTIONAL);
    const active=DAY_CLOCKS.filter(c=>!on||on[c.key]);
    const out=[];
    slate.games.forEach(g=>{
      const gameLabel=`${g.away.abbrev||g.away.teamName} @ ${g.home.abbrev||g.home.teamName}`;
      ['away','home'].forEach(s=>{
        g[s+'Ids'].forEach(id=>{
          const p=slate.people[id];
          if(!p)return;
          const bday=p.birthDate?clockFrom(p.birthDate,date):null;
          const debut=p.debutDate?clockFrom(p.debutDate,date):null;
          active.forEach(c=>{
            const clk=c.src==='birth'?bday:debut;
            if(!clk)return;
            const value=clk[c.field];
            if(!(value>0))return;
            targets.forEach(target=>{
              const off=value-target;
              if(Math.abs(off)<=t)
                out.push({id,pk:g.pk,side:s,name:p.fullName,
                  team:g[s].abbrev||g[s].teamName,gameLabel,
                  kind:c.src,clockLabel:c.label,value,target,off,
                  onSpine:spine.has(value),onInst:inst.has(value)});
            });
          });
        });
      });
    });
    return out.sort((a,b)=>Math.abs(a.off)-Math.abs(b.off)||a.value-b.value);
  },[slate,date]);

  const value={
    boot,profile,ciphers,setCiphers,vocab,setVocab,saveVocab,phrases,setPhrases,addPhrase,
    templates,setTemplates,colorRules,setColorRules,registry,setRegistry,
    settings,setSettings,date,setDate,today,dayState,setDayState,dn,seasonInfo,
    slate,loading,error,refresh,slateSavedAt,game,gamePk,setGamePk,side,setSide,
    batterId,setBatterId,contextFilter,setContextFilter,patternFilter,setPatternFilter,
    board,contextChips,matchup,loaded,colorFor,evalBatter,h2h,
    addTheme,removeTheme,removeRegistryTheme,addThread,addLabel,search,findDays,exportConfig,importConfig,
    patterns,setPatterns,previewPattern,patternCounts,patternHitsAll,
    recipeDraft,addDraft,removeDraft,toggleDraftHard,clearDrafts,pendingPattern,setPendingPattern,
    deepFetch,deepBusy,checkLineups,lineupBusy,
    forecasts,generateForecasts,forecastBusy,grade,
    graduateTheme,exportDayLog,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

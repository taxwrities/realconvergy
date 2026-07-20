/* ================================================================
   store — WNBA app state (WNBA-REDESIGN-SPEC §2). Same architecture
   as apps/mlb: profile prefs on cvg.* keys, slate, loaded-value map,
   player evaluation, CROSS rows. WNBA rules enforced here:
   - profile 'wnba' (Chaldean + Satanic default ON, own cipher store)
   - sport-scoped vocab (basketball/Masonic only — no MLB values)
   - First Basket lane: cFG+1/arena check first, column team lock
     outranks arena/date, KAT rule badge, away-encodes-home default
   - starters first (inferred top-5 min; manual labels override)
   - H2H context chips from data/wnba-h2h.json + live top-up
================================================================ */
import {createContext,useContext,useEffect,useMemo,useState,useCallback} from 'react';
import {calcAll,ALL_CIPHERS,CIPHER_DEFAULTS,checksum,nameRun} from '../engine/gematria.js';
import {isPrime,primeIndex,compositeIndex,nthPrime,chainBase} from '../engine/numbers.js';
import {clockFrom,dateNumerology,todayISO} from '../engine/clocks.js';
import {CORE_WORDS_WNBA,STATS,STAT_DEPTH,LANES,LANE_STAT,
  DEFAULT_LANES_ON,T_FAMILY,DEFAULT_COLOR_RULES,DEFAULT_SETTINGS} from '../data/defaults.js';
import {load,save,loadDay,saveDay,exportConfig,importConfig,loadSlateCache,saveSlateCache} from '../data/storage.js';
import {fetchSlate,fetchSeasonInfo,deepFetchGame,h2hFor,fetchGameTotals} from '../data/wnba.js';
import {evalPattern,isDateDependent,SEED_PATTERNS} from '../engine/patterns.js';
import {fetchScheduleRange,runForecast,gradeForecast,addDays} from '../engine/forecast.js';
import {dateNumerology as dnFor} from '../engine/clocks.js';

const Ctx=createContext(null);
export const useApp=()=>useContext(Ctx);

/* KAT Rule words (§2): name encoding these across ≥2 ciphers = premium FB lean */
const KAT_WORDS=['BASKETBALL','WNBA','NBA','WOMENS BASKETBALL','FIRST BASKET'];

const seedVocab=()=>CORE_WORDS_WNBA.map(w=>({word:w.word,enabled:w.enabled!==false,
  source:'core',...(w.seasonal?{seasonal:w.seasonal}:{}),values:calcAll(w.word)}));

export function AppStateProvider({children}){
  /* ---------- persisted prefs ---------- */
  const [profile]=useState(()=>load('cvg.profile','wnba'));
  const [ciphers,setCiphers]=useState(()=>load(`cvg.ciphers.${profile}`,CIPHER_DEFAULTS[profile]||CIPHER_DEFAULTS.wnba));
  const [vocab,setVocab]=useState(()=>load(`cvg.vocab.${profile}`,null)||seedVocab());
  const [phrases,setPhrases]=useState(()=>load('cvg.phrases',[]));
  const [templates,setTemplates]=useState(()=>load('cvg.templates',[]));
  const [colorRules,setColorRules]=useState(()=>load('cvg.colorRules',DEFAULT_COLOR_RULES));
  const [registry,setRegistry]=useState(()=>load('cvg.registry',[]));
  const [settings,setSettings]=useState(()=>({...DEFAULT_SETTINGS,...load('cvg.settings',{})}));
  const [patterns,setPatterns]=useState(()=>load('cvg.patterns',null)||SEED_PATTERNS);
  const [forecasts,setForecasts]=useState(()=>load('cvg.forecasts',[]));
  const date=todayISO();
  const [dayState,setDayState]=useState(()=>loadDay(date));

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
  useEffect(()=>{saveDay(date,dayState)},[date,dayState]);

  const boot=useMemo(()=>checksum(),[]);

  /* ---------- slate (hydrate from cache for instant reopen) ---------- */
  const cachedSlate=useMemo(()=>loadSlateCache(date),[date]);
  const [slate,setSlate]=useState(()=>cachedSlate?.slate||null);
  const [seasonInfo,setSeasonInfo]=useState(()=>cachedSlate?.seasonInfo||null);
  const [slateSavedAt,setSlateSavedAt]=useState(()=>cachedSlate?.savedAt||null);
  const [loading,setLoading]=useState('');
  const [error,setError]=useState('');
  const [gamePk,setGamePk]=useState(()=>cachedSlate?.slate?.games?.[0]?.pk??null);
  /* away-encodes-home (§2): first bucket typically HOME side — default there */
  const [side,setSide]=useState('home');
  const [batterId,setBatterId]=useState(null);
  const [contextFilter,setContextFilter]=useState(null);
  const [patternFilter,setPatternFilter]=useState(null); // pattern id → dim non-hitters
  const [gameTotals,setGameTotals]=useState({}); // playerId → today's box line (top-of-card)

  const refresh=useCallback(async()=>{
    setError('');setLoading('Loading slate…');
    try{
      const [s,si]=await Promise.all([
        fetchSlate(date,setLoading),
        fetchSeasonInfo(date.slice(0,4)).catch(()=>null),
      ]);
      setSlate(s);setSeasonInfo(si);setSlateSavedAt(Date.now());
      if(s.games.length&&gamePk==null)setGamePk(s.games[0].pk);
      setLoading('');
    }catch(e){setError('Slate load failed: '+e.message);setLoading('')}
  },[date,gamePk]);
  /* manual-refresh policy: fetch on boot only when there's no cache for today;
     a valid cache is trusted until the user taps refresh (banner / ↻). */
  useEffect(()=>{if(!cachedSlate)refresh()},[]); // eslint-disable-line react-hooks/exhaustive-deps
  /* write-through: persist every slate change (fetch + ⚡ deep mutation) */
  useEffect(()=>{if(slate)saveSlateCache(date,slate,seasonInfo)},[slate,seasonInfo,date]);

  const vals=useCallback(s=>{
    const v=calcAll(s);
    return ALL_CIPHERS.filter(c=>ciphers[c]).map(c=>({cipher:c,n:v[c]})).filter(x=>x.n>0);
  },[ciphers]);

  const dn=useMemo(()=>dateNumerology(date,ciphers),[date,ciphers]);
  const game=useMemo(()=>slate?.games.find(g=>g.pk===gamePk)||null,[slate,gamePk]);
  const h2h=useMemo(()=>game?h2hFor(game,date):null,[game,date]);

  /* running game total (top-of-card, Tony 2026-07): today's box line for the
     selected game. MANUAL refresh only — NO polling interval. Loaded once when
     a game opens and re-pulled on every manual slate refresh (slateSavedAt
     bumps only on refresh()); an empty result (game not started) hides the
     row. The card's ↻ icon calls refreshGameTotals for a today-only refresh. */
  const refreshGameTotals=useCallback(async()=>{
    if(!gamePk){setGameTotals({});return}
    try{const t=await fetchGameTotals(gamePk);setGameTotals(t)}catch{/* keep prior line */}
  },[gamePk]);
  useEffect(()=>{
    let alive=true;
    if(!gamePk){setGameTotals({});return}
    fetchGameTotals(gamePk).then(t=>{if(alive)setGameTotals(t)}).catch(()=>{});
    return()=>{alive=false};
  },[gamePk,slateSavedAt]);

  /* ---------- loaded-value map ----------
     entries {src, cat, team?, arena?} — team/arena feed the FB lane's
     column-team-lock and cFG+1/arena priority rules. */
  const loaded=useMemo(()=>{
    const m=new Map();
    const add=(n,src,cat,meta)=>{
      n=+n;if(!n||n<=0)return;
      const a=m.get(n)||[];a.push({src,cat,...(meta||{})});m.set(n,a);
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
      [['home',game.home],['away',game.away]].forEach(([sideKey,t])=>{
        [t.name,t.teamName,t.locationName].filter(Boolean).forEach(nm=>{
          vals(nm).forEach(({cipher,n})=>add(n,`${nm} ${cipher}`,'context',{team:sideKey}));
        });
        /* MLB city-bridge lane routes to HOME-team players only (§2) */
        if(sideKey==='home'&&t.mlbName)
          vals(t.mlbName).forEach(({cipher,n})=>add(n,`⇄ ${t.mlbName} ${cipher}`,'context',{team:'home',bridge:true}));
      });
      if(game.venue)vals(game.venue).forEach(({cipher,n})=>add(n,`${game.venue} ${cipher}`,'context',{arena:true}));
      ['home','away'].forEach(s=>{
        if(game.gameNumber[s])add(game.gameNumber[s],`${game[s].teamName} season game #${game.gameNumber[s]}`,'context');
      });
      if(h2h){
        add(h2h.gameNo,`H2H meeting #${h2h.gameNo}`,'h2h');
        add(h2h.awayWins,`${game.away.abbrev} series wins`,'h2h');
        add(h2h.homeWins,`${game.home.abbrev} series wins`,'h2h');
        if(h2h.daysSinceLast)add(h2h.daysSinceLast,'days since last meeting','h2h');
        if(h2h.daysSinceFirst)add(h2h.daysSinceFirst,'days since first-ever meeting','h2h');
        if(h2h.playoffs.games)add(h2h.playoffs.games,'playoff meetings','h2h');
      }
    }
    return m;
  },[vocab,ciphers,dn,dayState,registry,phrases,game,h2h,vals]);

  /* ---------- pattern-engine sources + ctx ---------- */
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
    const ownT=g?(side==='home'?g.home:g.away):null;
    const oppT=g?(side==='home'?g.away:g.home):null;
    const teamName=ownT?.teamName||'';
    const oppTeamName=oppT?.teamName||'';
    /* every name variant (nickname/full/city) so a recipe can say either
       "Liberty=57" or "New York Liberty=168" (mirrors the loaded map). */
    const nameVariants=t=>t?[...new Set([t.name,t.teamName,t.locationName].filter(Boolean))]:[];
    /* "SP" slot = opposing team's likely first-possession finisher (starting C) */
    const cId=g?(side==='home'?g.awaySP:g.homeSP):null;
    const c=cId?slate?.people[cId]:null;
    const ctxDate=dnUse===dn?date:dnUse._date;
    const bday=p.birthDate?clockFrom(p.birthDate,ctxDate):null;
    /* opposing starting center's birthday clock — the WNBA analog of the
       opposing pitcher's clock in the recipe grammar (oppCenterClock counter) */
    const cBday=c?.birthDate?clockFrom(c.birthDate,ctxDate):null;
    const oppCenterClock=cBday?[
      {n:cBday.since,label:`${cBday.since}d after C bday`},{n:cBday.until,label:`${cBday.until}d to C bday`},
      {n:cBday.years,label:`C age ${cBday.years}`},{n:cBday.years+1,label:`C turns ${cBday.years+1}`},
    ].filter(x=>x.n>0):[];
    return{
      ciphers,templates,dn:dnUse,date:ctxDate,
      gameNumber:gameNumber??(g?g.gameNumber[side]:null),
      h2hGameNo:g&&h2h?h2h.gameNo:null,
      teamStats:g?slate?.teamStats[side==='home'?g.home.id:g.away.id]:null,
      teamName,oppTeamName,teamNames:nameVariants(ownT),oppTeamNames:nameVariants(oppT),
      stadium:g?.venue||'',oppCenterClock,
      oppPitcherName:c?.fullName||'',oppPitcherVals:c?nameRun(c.fullName,ciphers):[],
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
  },[ciphers,templates,slate,dn,date,registry,dayState,patternSources,h2h]);

  /* ---------- player evaluation ---------- */
  const evalBatter=useCallback(p=>{
    if(!p)return null;
    const run=nameRun(p.fullName,ciphers);
    const nameNums=new Set(run.map(x=>x.n));
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
    const hitsFor=n=>{
      const out=[...(loaded.get(n)||[])];
      if(nameNums.has(n))run.filter(x=>x.n===n).forEach(x=>out.push({src:`${x.label} ${x.cipher}`,cat:'name'}));
      if(bdaySet.has(n))bdayNums.filter(x=>x.n===n).forEach(x=>out.push({src:x.label,cat:'bday'}));
      if(p.jersey===n)out.push({src:`#${p.jersey} jersey`,cat:'jersey'});
      if(isPrime(n)){
        const pi=primeIndex(n);
        (loaded.get(pi)||[]).forEach(h=>out.push({src:`${n}=${pi}th prime → ${h.src}`,cat:h.cat,bridge:true,team:h.team,arena:h.arena}));
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
          rungs.push({stat:lbl,scope,n,cur:+obj[key],off:k,hits:hitsFor(n)});
        }
      });
      /* venue splits — FG/PTS emphasis for the FB lane */
      const loc=p._side==='home'?'home':'away';
      const s=p.split?.['season-'+loc];
      if(s&&s[key]!=null&&(lbl==='FG'||lbl==='PTS')){
        for(let k=1;k<=(STAT_DEPTH[lbl]||1);k++){
          const n=+s[key]+k;
          rungs.push({stat:lbl,scope:`season·${loc}`,n,cur:+s[key],off:k,hits:hitsFor(n)});
        }
      }
    });
    const jerseyHits=p.jersey?(loaded.get(p.jersey)||[]).concat(
      (p.jersey===dn.M||p.jersey===dn.DD)?[{src:`${dn.M}/${dn.DD} date`,cat:'date'}]:[]):[];
    const threadHit=rungs.some(r=>r.hits.some(h=>h.cat==='thread'));
    /* KAT Rule (§2): name encodes BASKETBALL/WNBA values across ≥2 ciphers */
    const katVals=new Map(); // value → word
    vocab.filter(w=>w.enabled&&KAT_WORDS.includes(w.word)).forEach(w=>{
      ALL_CIPHERS.filter(c=>ciphers[c]).forEach(c=>{if(w.values[c])katVals.set(w.values[c],w.word)});
    });
    const katHits=run.filter(x=>katVals.has(x.n))
      .map(x=>({cipher:x.cipher,n:x.n,word:katVals.get(x.n)}));
    const kat=new Set(katHits.map(x=>x.cipher)).size>=2;
    /* lane badges */
    const lanes={};
    LANES.forEach(L=>{
      const st=LANE_STAT[L];
      lanes[L]=rungs.some(r=>r.stat===st&&r.hits.length>0);
    });
    /* FB check (§2): cFG+1 / arena runs first — surfaced at card top */
    const fgC1=rungs.find(r=>r.stat==='FG'&&r.scope==='career'&&r.off===1);
    const fgS1=rungs.find(r=>r.stat==='FG'&&r.scope==='season'&&r.off===1);
    const fbCheck={
      career:fgC1?{n:fgC1.n,cur:fgC1.cur,hits:fgC1.hits,arena:fgC1.hits.some(h=>h.arena)}:null,
      season:fgS1?{n:fgS1.n,cur:fgS1.cur,hits:fgS1.hits,arena:fgS1.hits.some(h=>h.arena)}:null,
    };
    /* PRIMARY/ALT: gematria first. FB column lock — stat+1 landing on OWN
       team name outranks arena, which outranks generic date/core (§2). */
    const laneStats=new Set(settings.lanesOn.map(L=>LANE_STAT[L]));
    const rank=r=>{
      const teamLock=r.hits.some(h=>h.team&&h.team===p._side)?2:0;
      const arena=r.hits.some(h=>h.arena)?1:0;
      return teamLock*100+arena*50+r.hits.length;
    };
    const candidates=rungs
      .filter(r=>laneStats.has(r.stat)&&r.hits.length>0)
      .sort((a,b)=>rank(b)-rank(a)||a.off-b.off);
    return{p,run,bday,bdayNums,rungs,jerseyHits,threadHit,lanes,kat,katHits,fbCheck,
      jesuit:!!p.jesuit,school:p.school||null,
      primary:candidates[0]||null,alt:candidates[1]||null,nameNums};
  },[ciphers,date,loaded,dn,settings.lanesOn,vocab]);

  /* ---------- board: starters first (already ordered by the pipeline) ---------- */
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
        return{order:i+1,ev:evalBatter({...p,_side:s}),id,patternHits,starter:p.starter,
          forecast:upcoming[0]||null,maturing:upcoming.find(f=>f.date===date)||null};
      }).filter(Boolean);
    });
    return out;
  },[slate,game,evalBatter,patterns,forecasts,date,dn,buildPatternCtx]);

  const previewPattern=useCallback((pattern,forceId)=>{
    if(!slate||!game)return null;
    const id=forceId??(batterId||board[side]?.[0]?.id);
    const p=id?slate.people[id]:null;
    if(!p)return null;
    /* the picked preview batter (PATTERN-RECIPES §9) may live in another
       game on the slate — resolve their game/side, not just the open one */
    let g=game,s=game.homeIds.includes(id)?'home':game.awayIds.includes(id)?'away':null;
    if(!s){g=slate.games.find(x=>x.homeIds.includes(id)||x.awayIds.includes(id))||game;
      s=g.homeIds.includes(id)?'home':'away';}
    const ctx=buildPatternCtx({p:{...p,_side:s},side:s,g,dnUse:dn});
    return{who:p.fullName,res:evalPattern(pattern,ctx)};
  },[slate,game,batterId,board,side,buildPatternCtx,dn]);

  const patternCounts=useMemo(()=>{
    if(!slate)return{};
    const counts={};
    const daily=patterns.filter(pt=>pt.enabled&&!isDateDependent(pt));
    slate.games.forEach(g=>{
      ['away','home'].forEach(s=>{
        g[s+'Ids'].forEach(id=>{
          const p=slate.people[id];
          if(!p||(!p.career&&!p.season))return;
          const ctx=buildPatternCtx({p:{...p,_side:s},side:s,g,dnUse:dn});
          daily.forEach(pt=>{
            if(evalPattern(pt,ctx).match)counts[pt.id]=(counts[pt.id]||0)+1;
          });
        });
      });
    });
    return counts;
  },[slate,patterns,buildPatternCtx,dn]);

  /* deep (⚡): vs-opponent split from this season's meetings */
  const [deepBusy,setDeepBusy]=useState(false);
  const deepFetch=useCallback(async()=>{
    if(!slate||!game||game.deepDone||deepBusy)return;
    setDeepBusy(true);
    try{
      await deepFetchGame(game,slate.people,date,()=>{});
      setSlate({...slate});
    }catch(e){setError('Deep fetch failed: '+e.message)}
    setDeepBusy(false);
  },[slate,game,date,deepBusy]);

  /* ---------- forecast ---------- */
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
      setForecastBusy(`Walking ${days} days × ${roster.length} players…`);
      const cards=runForecast({patterns,roster,fromDate:date,days,scheduleByTeam,
        ctxFactory:(row,s,projected)=>{
          const dnD=dnFor(s.date,ciphers);dnD._date=s.date;
          const dateThread=[
            ...Object.entries(dnD.vals).map(([n,l])=>({n:+n,label:l})),
            ...dayState.adhocThread.map(n=>({n,label:'thread'})),
          ];
          return buildPatternCtx({
            p:{...row.p,season:projected.season,career:projected.career,_side:s.side},
            side:s.side,g:null,dnUse:dnD,gameNumber:s.gameNumber,
            dateThread,loadedAll:[...patternSources.core,...patternSources.theme,...dateThread],
          });
        }});
      setForecasts(f=>[...f.filter(x=>x.date<=date),...cards]);
      setForecastBusy('');
    }catch(e){setForecastBusy('');setError('Forecast failed: '+e.message)}
  },[slate,patterns,settings.forecastDays,date,ciphers,dayState,buildPatternCtx,patternSources]);

  const grade=useCallback(async card=>{
    const g=await gradeForecast(card,date.slice(0,4));
    setForecasts(fs=>fs.map(f=>f.id===card.id?{...f,grade:g}:f));
    return g;
  },[date]);

  const graduateTheme=useCallback((name,teams)=>{
    const t=dayState.adhocThemes.find(x=>x.name===name);
    if(!t||registry.some(r=>r.name===name))return;
    setRegistry(r=>[...r,{name:t.name,teams:teams||[],values:t.values}]);
    setDayState(s=>({...s,adhocThemes:s.adhocThemes.filter(x=>x.name!==name)}));
  },[dayState,registry]);

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
        return{name:p.fullName,team:g[s].teamName,side:s,jersey:p.jersey,starter:p.starter,kat:ev.kat,
          primary:ev.primary?{col:`${ev.primary.scope} ${ev.primary.stat}`,n:ev.primary.n,sits:ev.primary.cur,
            evidence:ev.primary.hits.map(h=>h.src)}:null,
          alt:ev.alt?{col:`${ev.alt.scope} ${ev.alt.stat}`,n:ev.alt.n,sits:ev.alt.cur}:null,
          lanes:Object.entries(ev.lanes).filter(([,v])=>v).map(([L])=>L),
          patterns:pats,thread:ev.threadHit};
      }).filter(Boolean)),
    }));
    const payload={schema:'cvg-day-log/v1',sport:'wnba',date,exportedAt:new Date().toISOString(),
      lanesOn:settings.lanesOn,thread:dayState.adhocThread,
      themes:[...dayState.adhocThemes.map(t=>t.name),...registry.map(t=>t.name)],
      forecastsMaturing:forecasts.filter(f=>f.date===date),games:gamesOut};
    const dl=(name,text,type)=>{
      const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();
      URL.revokeObjectURL(a.href);
    };
    dl(`${date}.json`,JSON.stringify(payload,null,1),'application/json');
    const md=[`# WNBA board log — ${date}`,''];
    gamesOut.forEach(g=>{
      md.push(`## ${g.label}${g.frozen?'':' ⚠ NOT FROZEN'}`);
      g.batters.filter(b=>b.primary||b.patterns.length).forEach(b=>{
        md.push(`- **${b.name}** (${b.team})${b.starter?' ⭐':''}${b.kat?' · KAT':''}${b.primary?` — ${b.primary.col} → ${b.primary.n} (sits ${b.primary.sits})`:''}${b.patterns.length?` · patterns: ${b.patterns.join(', ')}`:''}${b.thread?' · THREAD':''}`);
      });
      md.push('');
    });
    dl(`${date}.md`,md.join('\n'),'text/markdown');
  },[slate,patterns,evalBatter,buildPatternCtx,dn,date,settings.lanesOn,dayState,registry,forecasts]);

  /* ---------- context rail: theme purple · thread/H2H blue · date gray ---------- */
  const contextChips=useMemo(()=>{
    if(!game)return[];
    const chips=[];
    const roster=[...board.away,...board.home];
    const countHits=n=>roster.filter(r=>r.ev.rungs.some(g=>g.n===n&&g.hits.length)).length;
    [...dayState.adhocThemes,...registry.filter(t=>!t.teams||!t.teams.length||t.teams.includes(game.home.teamName)||t.teams.includes(game.away.teamName))]
      .forEach(t=>{
        ALL_CIPHERS.filter(c=>ciphers[c]).forEach(c=>{
          const n=t.values?.[c];
          if(n)chips.push({kind:'theme',label:t.name,n,cnt:countHits(n)});
        });
      });
    dayState.adhocThread.forEach(n=>chips.push({kind:'thread',label:'thread',n,cnt:countHits(n)}));
    /* H2H chips (§3): headline duration number = all-time meeting # */
    if(h2h){
      chips.push({kind:'h2h',label:'H2H game #',n:h2h.gameNo,cnt:countHits(h2h.gameNo),
        lineage:h2h.lineageNote.length?h2h.lineageNote.join(' · '):null});
      chips.push({kind:'h2h',label:`${game.away.abbrev} W`,n:h2h.awayWins,cnt:countHits(h2h.awayWins)});
      chips.push({kind:'h2h',label:`${game.home.abbrev} W`,n:h2h.homeWins,cnt:countHits(h2h.homeWins)});
      if(h2h.daysSinceLast!=null)chips.push({kind:'h2h',label:'days since last',n:h2h.daysSinceLast,cnt:countHits(h2h.daysSinceLast)});
      if(h2h.daysSinceFirst!=null)chips.push({kind:'h2h',label:'days since first',n:h2h.daysSinceFirst,cnt:countHits(h2h.daysSinceFirst)});
      if(h2h.playoffs.games)chips.push({kind:'h2h',label:'playoff meetings',n:h2h.playoffs.games,cnt:countHits(h2h.playoffs.games)});
    }
    chips.push({kind:'date',label:'DOY',n:dn.doy,cnt:countHits(dn.doy)});
    chips.push({kind:'date',label:`${dn.M}/${dn.DD}`,n:+(''+dn.M+dn.DD),cnt:countHits(+(''+dn.M+dn.DD))});
    chips.push({kind:'date',label:'days left',n:dn.left,cnt:countHits(dn.left)});
    return chips;
  },[game,board,dayState,registry,ciphers,dn,h2h]);

  /* ---------- matchup: opposing center + CROSS + team staircases ---------- */
  const matchup=useMemo(()=>{
    if(!slate||!game||!batterId)return null;
    const bat=[...board.away,...board.home].find(r=>r.id===batterId);
    if(!bat)return null;
    const batSide=board.away.some(r=>r.id===batterId)?'away':'home';
    const cId=batSide==='away'?game.homeSP:game.awaySP;
    const c=cId?slate.people[cId]:null;
    const cross=[];
    if(c){
      const cRun=nameRun(c.fullName,ciphers);
      const batNums=new Set([...bat.ev.nameNums,...bat.ev.rungs.filter(r=>r.off===1).map(r=>r.n)]);
      cRun.forEach(x=>{
        if(batNums.has(x.n)){
          const why=bat.ev.rungs.filter(r=>r.off===1&&r.n===x.n).map(r=>`${r.scope} ${r.stat}→${r.n}`);
          cross.push({n:x.n,text:`${c.lastName} ${x.cipher} ${x.n} = ${why.length?why.join(' + '):'player name value'}`});
        }
        if(h2h&&x.n===h2h.gameNo)
          cross.push({n:x.n,text:`${c.lastName} ${x.cipher} ${x.n} = H2H meeting #${x.n}`});
      });
    }
    const stair=[];
    const teamId=batSide==='away'?game.away.id:game.home.id;
    const ts=slate.teamStats[teamId];
    if(ts){
      const batNext=new Set(bat.ev.rungs.filter(r=>r.off===1).map(r=>r.n));
      ['PTS','FG','REB','AST'].forEach(k=>{
        if(ts[k]==null)return;
        for(let add=1;add<=(k==='PTS'?110:45);add++){
          const n=ts[k]+add;
          const hit=loaded.get(n)||[];
          if(hit.length||batNext.has(n)){
            stair.push({k,n,cur:ts[k],need:add,
              why:hit.length?hit[0].src:'player milestone '+n});
            break;
          }
        }
      });
    }
    const cBday=c?.birthDate?clockFrom(c.birthDate,date):null;
    return{sp:c,spRun:c?nameRun(c.fullName,ciphers):[],spBday:cBday,cross,stair,bat,
      vsHand:bat.ev.p.split?.[batSide==='away'?'season-away':'season-home']||null,
      vsOpp:bat.ev.p.deep?.vsOpp||null,oppTag:bat.ev.p.deep?.oppTag||null};
  },[slate,game,batterId,board,ciphers,loaded,date,h2h]);

  /* ---------- color rules ---------- */
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

  /* ---------- quick-add ---------- */
  const addTheme=useCallback(name=>{
    const t={name:name.trim(),values:calcAll(name)};
    if(t.name)setDayState(s=>({...s,adhocThemes:[...s.adhocThemes,t]}));
  },[]);
  const addThread=useCallback(n=>{
    n=+n;if(n>0)setDayState(s=>({...s,adhocThread:[...new Set([...s.adhocThread,n])]}));
  },[]);
  const addLabel=useCallback((playerId,label)=>{
    setDayState(s=>({...s,labels:{...s.labels,[playerId]:[...(s.labels[playerId]||[]),label]}}));
  },[]);
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

  /* ---------- universal search ---------- */
  const search=useCallback(q=>{
    q=q.trim();
    if(!q)return null;
    const roster=slate&&game?[...board.away,...board.home]:[];
    /* "jesuit" → every Jesuit-educated player on today's whole slate (§8 info
       branch), not just the active game. WNBA is college-heavy. Tony 2026-07-20. */
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
      return{kind:'number',n,
        prime:isPrime(n),primeIdx:primeIndex(n),compIdx:compositeIndex(n),nthP:n<=250?nthPrime(n):0,
        tFam:T_FAMILY.includes(n),chain:chainBase(n),
        tableHits:(loaded.get(n)||[]),
        rosterHits:roster.flatMap(r=>r.ev.rungs.filter(g=>g.n===n).map(g=>({who:r.ev.p.fullName,rung:g}))),
      };
    }
    const v=calcAll(q);
    return{kind:'word',word:q.toUpperCase(),values:v,
      occ:ALL_CIPHERS.filter(c=>ciphers[c]).flatMap(c=>{
        const n=v[c];
        return roster.flatMap(r=>r.ev.rungs.filter(g=>g.n===n&&g.off===1).map(g=>({who:r.ev.p.fullName,cipher:c,rung:g})));
      })};
  },[slate,game,board,loaded,ciphers]);

  const value={
    boot,profile,ciphers,setCiphers,vocab,setVocab,saveVocab,phrases,setPhrases,addPhrase,
    templates,setTemplates,colorRules,setColorRules,registry,setRegistry,
    settings,setSettings,date,dayState,setDayState,dn,seasonInfo,
    slate,loading,error,refresh,slateSavedAt,game,gamePk,setGamePk,side,setSide,gameTotals,refreshGameTotals,
    batterId,setBatterId,contextFilter,setContextFilter,patternFilter,setPatternFilter,
    board,contextChips,matchup,loaded,colorFor,evalBatter,h2h,
    addTheme,addThread,addLabel,search,exportConfig,importConfig,
    patterns,setPatterns,previewPattern,patternCounts,
    deepFetch,deepBusy,
    forecasts,generateForecasts,forecastBusy,grade,
    graduateTheme,exportDayLog,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

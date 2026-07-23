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
import {calcAll,ALL_CIPHERS,CIPHER_DEFAULTS,checksum,nameRun,letters} from '../engine/gematria.js';
import {isPrime,primeIndex,compositeIndex,nthPrime,chainBase} from '../engine/numbers.js';
import {clockFrom,dateNumerology,dateFigures,todayISO} from '../engine/clocks.js';
import {CORE_WORDS_WNBA,STATS,STAT_DEPTH,LANES,LANE_STAT,
  DEFAULT_LANES_ON,T_FAMILY,DEFAULT_COLOR_RULES,DEFAULT_SETTINGS} from '../data/defaults.js';
import {load,save,loadDay,saveDay,exportConfig,importConfig,loadSlateCache,saveSlateCache} from '../data/storage.js';
import {fetchSlate,fetchSeasonInfo,deepFetchGame,h2hFor,fetchGameTotals} from '../data/wnba.js';
import {evalPattern,isDateDependent,SEED_PATTERNS} from '../engine/patterns.js';
import {fetchScheduleRange,runForecast,gradeForecast,addDays} from '../engine/forecast.js';
import {dateNumerology as dnFor} from '../engine/clocks.js';

const Ctx=createContext(null);
export const useApp=()=>useContext(Ctx);

/* institutional day-count / recurring figure table (mirrors apps/mlb) — the
   Phrase-finder quick-fill + the "lands on the table" badge source. */
export const INSTITUTIONAL=[42,48,51,54,56,59,63,65,72,75,78,79,83,96,139,147];

/* KAT Rule words (§2): name encoding these across ≥2 ciphers = premium FB lean */
const KAT_WORDS=['BASKETBALL','WNBA','NBA','WOMENS BASKETBALL','FIRST BASKET'];

const seedVocab=()=>CORE_WORDS_WNBA.map(w=>({word:w.word,enabled:w.enabled!==false,
  source:'core',...(w.seasonal?{seasonal:w.seasonal}:{}),values:calcAll(w.word)}));

/* Backfill precomputed values for vocab persisted before a cipher existed
   (e.g. RevSat). Without this, older localStorage words lack the RevSat key
   and its column renders blank even though the engine computes it. */
const hydrateVocab=list=>list.map(w=>
  (w.values&&ALL_CIPHERS.every(c=>c in w.values))?w:{...w,values:calcAll(w.word)});

export function AppStateProvider({children}){
  /* ---------- persisted prefs ---------- */
  const [profile]=useState(()=>load('cvg.profile','wnba'));
  const [ciphers,setCiphers]=useState(()=>load(`cvg.ciphers.${profile}`,CIPHER_DEFAULTS[profile]||CIPHER_DEFAULTS.wnba));
  const [vocab,setVocab]=useState(()=>{const st=load(`cvg.vocab.${profile}`,null);return st?hydrateVocab(st):seedVocab();});
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
  /* searchOpen — app-level nav state for the Search page (Tony 2026-07-22: a
     dedicated full-viewport destination, not a bottom sheet). false = on the
     Board; true = the Search page owns the screen. Reset on date switch. */
  const [searchOpen,setSearchOpen]=useState(false);
  useEffect(()=>{setSearchOpen(false)},[date]);
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
    /* date-dependent patterns evaluate fine against today's dn — excluding
       them hid their hits from the Board cards (Tony 2026-07-20) */
    const daily=patterns.filter(pt=>pt.enabled);
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

  /* slate-wide pattern hits WITH identities (who/where), so the Patterns tab
     can name the hitters instead of a bare count (Tony 2026-07-20). Date-
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

  /* ---------- Phrase Variation Finder (Tony 2026-07-22) ----------
     the name×outcome×cipher sweep: for every player in every loaded game, every
     enabled name-part (first/last/full), every selected outcome word and every
     selected cipher, form "<namePart> <word>" and test its value against the
     target number(s) within tol. The cipher engine strips non-letters, so
     "SABRINA POINTS" == "SABRINAPOINTS" — the standard Zach concatenation needs
     no separate space/no-space variant, and letter-identical words collapse to
     one row via the seen-key. Rows carry DN-spine / institutional badges. words
     are strings; parts/cipherKeys are key arrays. */
  const findPhrases=useCallback(({words,parts,cipherKeys,targets,tol=0,oppTeam=false})=>{
    if(!slate?.games?.length||!words?.length||!parts?.length||!cipherKeys?.length)return[];
    /* per-player target toggle (Tony 2026-07-23): a run needs at least one target
       source — the typed list OR the opponent-team ciphers. WNBA wires only the
       opponent-team variant (no "opposing pitcher" analogue). */
    if(!(targets?.length||oppTeam))return[];
    const t=Math.max(0,Math.min(5,Math.floor(+tol||0)));
    const spine=new Set(dateFigures(date).map(f=>f.n));
    const inst=new Set(INSTITUTIONAL);
    const cix=cipherKeys.filter(c=>ALL_CIPHERS.includes(c));
    const cleanWords=[...new Set(words.map(w=>String(w).trim().toUpperCase()).filter(Boolean))];
    const cache=new Map();
    const valsOf=s=>{let v=cache.get(s);if(!v){v=calcAll(s);cache.set(s,v)}return v};
    const seen=new Set();
    const out=[];
    slate.games.forEach(g=>{
      const gameLabel=`${g.away.abbrev||g.away.teamName} @ ${g.home.abbrev||g.home.teamName}`;
      /* opponent-team gematria (Tony 2026-07-22): the OTHER side's own cipher
         grid (nickname / city / full name × the swept ciphers) rides with each
         hit so the finder can flag "facing <team> (79) = target". Built once
         per side, deduped by name|value. */
      const oppValsFor={};
      ['away','home'].forEach(s=>{
        const opp=g[s==='away'?'home':'away'];
        const dd=new Set(),ov=[];
        [...new Set([opp?.name,opp?.teamName,opp?.locationName].filter(Boolean))].forEach(tn=>{
          const cv=calcAll(tn);
          cix.forEach(c=>{const n=cv[c];if(!(n>0))return;const k=`${tn}|${n}`;
            if(dd.has(k))return;dd.add(k);ov.push({name:tn,cipher:c,n})});
        });
        oppValsFor[s]=ov;
      });
      /* per-player effective targets (Tony 2026-07-23): typed list (shared) +
         the Opponent-team toggle's PER-SIDE targets (the batter's own game's
         opposing team ciphers). Keyed by number, sources merged → one chip,
         multi-source glow. Deduped by number within a side. */
      const srcKey=x=>`${x.kind}|${x.tag||''}|${x.cipher||''}`;
      const typedList=(targets||[]).filter(n=>n>0);
      const effFor={};
      ['away','home'].forEach(s=>{
        const m=new Map();
        const addT=(n,src)=>{if(!(n>0))return;let e=m.get(n);
          if(!e){e={n,sources:[]};m.set(n,e)}
          const kk=srcKey(src);if(!e.sources.some(x=>srcKey(x)===kk))e.sources.push(src)};
        typedList.forEach(n=>addT(n,{kind:'typed'}));
        if(oppTeam)oppValsFor[s].forEach(o=>addT(o.n,{kind:'oppTeam',tag:o.name,cipher:o.cipher}));
        effFor[s]=[...m.values()];
      });
      ['away','home'].forEach(s=>{
        g[s+'Ids'].forEach(id=>{
          const p=slate.people[id];
          if(!p)return;
          const nm=(p.fullName||'').trim();
          if(!nm)return;
          /* player-numerology cross-refs (Tony 2026-07-22): the player's own
             life-clock readings + jersey travel with each hit so the finder can
             flag day-of-life / age / etc. that echo the target (raw or dr). */
          const pbday=p.birthDate?clockFrom(p.birthDate,date):null;
          const pn={totalDays:pbday?.totalDays??null,since:pbday?.since??null,
            until:pbday?.until??null,years:pbday?.years??null,jersey:p.jersey??null};
          /* stat-rung cross-refs (Tony 2026-07-22): entering career + season
             counting totals travel too, so the finder can flag "career PTS sits
             X → next is Y = target" (next-milestone convergence). */
          const sr={career:p.career||null,season:p.season||null};
          const toks=nm.split(/\s+/);
          const first=toks[0]||'',last=toks.slice(1).join(' ');
          const np=[];
          if(parts.includes('first')&&first)np.push({key:'first',str:first});
          if(parts.includes('last')&&last)np.push({key:'last',str:last});
          if(parts.includes('full')&&nm)np.push({key:'full',str:nm});
          np.forEach(part=>{
            cleanWords.forEach(word=>{
              const phrase=`${part.str} ${word}`;
              const v=valsOf(phrase);
              cix.forEach(c=>{
                const value=v[c];
                if(!(value>0))return;
                effFor[s].forEach(et=>{
                  const off=value-et.n;
                  if(Math.abs(off)>t)return;
                  const k=`${id}|${part.key}|${letters(phrase).join('')}|${c}|${et.n}`;
                  if(seen.has(k))return;
                  seen.add(k);
                  out.push({id,pk:g.pk,side:s,name:p.fullName,
                    team:g[s].abbrev||g[s].teamName,gameLabel,
                    namePart:part.key,word,phrase:`${part.str.toUpperCase()} ${word}`,
                    cipher:c,value,target:et.n,off,sources:et.sources,pn,sr,opp:oppValsFor[s],
                    onSpine:spine.has(value),onInst:inst.has(value)});
                });
              });
            });
          });
        });
      });
    });
    return out;
  },[slate,date]);

  const value={
    boot,profile,ciphers,setCiphers,vocab,setVocab,saveVocab,phrases,setPhrases,addPhrase,
    templates,setTemplates,colorRules,setColorRules,registry,setRegistry,
    settings,setSettings,date,dayState,setDayState,dn,seasonInfo,
    slate,loading,error,refresh,slateSavedAt,game,gamePk,setGamePk,side,setSide,gameTotals,refreshGameTotals,
    batterId,setBatterId,searchOpen,setSearchOpen,contextFilter,setContextFilter,patternFilter,setPatternFilter,
    board,contextChips,matchup,loaded,colorFor,evalBatter,h2h,
    addTheme,addThread,addLabel,search,findPhrases,exportConfig,importConfig,
    patterns,setPatterns,previewPattern,patternCounts,patternHitsAll,
    deepFetch,deepBusy,
    forecasts,generateForecasts,forecastBusy,grade,
    graduateTheme,exportDayLog,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

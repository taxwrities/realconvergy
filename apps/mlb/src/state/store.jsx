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
import {clockFrom,dateNumerology,daysBetween,todayISO} from '../engine/clocks.js';
import {CORE_WORDS_MLB,OUTCOME_WORDS,STATS,STAT_DEPTH,LANES,LANE_STAT,
  DEFAULT_LANES_ON,T_FAMILY,DEFAULT_COLOR_RULES,DEFAULT_SETTINGS} from '../data/defaults.js';
import {load,save,loadDay,saveDay,exportConfig,importConfig,loadSlateCache,saveSlateCache} from '../data/storage.js';
import {fetchSlate,fetchSeasonInfo,deepFetchGame,h2hFor} from '../data/mlb.js';
import {evalPattern,isDateDependent,SEED_PATTERNS} from '../engine/patterns.js';
import {fetchScheduleRange,runForecast,gradeForecast,addDays} from '../engine/forecast.js';
import {dateNumerology as dnFor} from '../engine/clocks.js';

const Ctx=createContext(null);
export const useApp=()=>useContext(Ctx);

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
    /* one-time merge: seeds added in later releases reach existing storage */
    const have=new Set(saved.map(p=>p.id));
    const missing=SEED_PATTERNS.filter(s=>!have.has(s.id));
    return missing.length?[...saved,...missing]:saved;
  });
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

  /* boot checksum (§2) */
  const boot=useMemo(()=>checksum(),[]);

  /* ---------- slate (hydrate from cache for instant reopen) ---------- */
  const cachedSlate=useMemo(()=>loadSlateCache(date),[date]);
  const [slate,setSlate]=useState(()=>cachedSlate?.slate||null); // {games, people, teamStats}
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
    return{p,run,bday,bdayNums,rungs,jerseyHits,threadHit,lanes,
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

  /* per-batter pattern preview for the editor (live, §5) */
  const previewPattern=useCallback(pattern=>{
    if(!slate||!game)return null;
    const id=batterId||board[side]?.[0]?.id;
    const p=id?slate.people[id]:null;
    if(!p)return null;
    const s=game.homeIds.includes(id)?'home':'away';
    const ctx=buildPatternCtx({p:{...p,_side:s},side:s,g:game,dnUse:dn});
    return{who:p.fullName,res:evalPattern(pattern,ctx)};
  },[slate,game,batterId,board,side,buildPatternCtx,dn]);

  /* pattern hit counts across today's whole slate ("N hits today") */
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

  /* deep splits for the active game (vsTeam / league / month / day-of-week) */
  const [deepBusy,setDeepBusy]=useState(false);
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
          const why=bat.ev.rungs.filter(r=>r.off===1&&r.n===x.n).map(r=>`${r.scope} ${r.stat}→${r.n}`);
          cross.push({n:x.n,text:`${sp.lastName} ${x.cipher} ${x.n} = ${why.length?why.join(' + '):'batter name value'}`});
        }
        if(x.n===game.gameNumber.home||x.n===game.gameNumber.away)
          cross.push({n:x.n,text:`${sp.lastName} ${x.cipher} ${x.n} = team game #${x.n}`});
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
  const search=useCallback(q=>{
    q=q.trim();
    if(!q)return null;
    const roster=slate&&game?[...board.away,...board.home]:[];
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
    slate,loading,error,refresh,slateSavedAt,game,gamePk,setGamePk,side,setSide,
    batterId,setBatterId,contextFilter,setContextFilter,patternFilter,setPatternFilter,
    board,contextChips,matchup,loaded,colorFor,evalBatter,h2h,
    addTheme,removeTheme,removeRegistryTheme,addThread,addLabel,search,exportConfig,importConfig,
    patterns,setPatterns,previewPattern,patternCounts,
    deepFetch,deepBusy,
    forecasts,generateForecasts,forecastBusy,grade,
    graduateTheme,exportDayLog,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

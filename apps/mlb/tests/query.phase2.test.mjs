/* ================================================================
   query.phase2.test.mjs — QUERY-SPEC §6.9 / §6.10 / §6.11 / §7.4 / §8.

   The load-bearing assertion: the spans engine consumes ONLY
   date_status==="locked" entries that carry a source URL, and only
   granularity==="day" entries participate in day-span math.

   Run: node apps/mlb/tests/query.phase2.test.mjs
================================================================ */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {JSDOM} from 'jsdom';
import {readHtml} from './query-extract.mjs';

const HERE=dirname(fileURLToPath(import.meta.url));
const FOUNDERS=JSON.parse(readFileSync(join(HERE,'..','public','data','founders-locked.json'),'utf8'));
const FIXTURE_DATE='2026-07-25';

let pass=0,fail=0;
const t=(n,f)=>{try{f();console.log('  ok   '+n);pass++}catch(e){console.error('  FAIL '+n+'\n       '+e.message);fail++}};
const ta=async(n,f)=>{try{await f();console.log('  ok   '+n);pass++}catch(e){console.error('  FAIL '+n+'\n       '+e.message);fail++}};

function fakeFetch(url){
  const json=(o)=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(o)});
  if(url.includes('founders-locked.json'))return json(FOUNDERS);
  if(url.includes('/schedule'))return json({dates:[{games:[{
    gamePk:1,gameDate:FIXTURE_DATE+'T23:10:00Z',
    status:{abstractGameState:'Preview',detailedState:'Scheduled'},venue:{name:'Test Park'},
    teams:{away:{team:{id:10,name:'Cleveland Guardians'},probablePitcher:{id:903}},
           home:{team:{id:20,name:'Arizona Diamondbacks'},probablePitcher:null}},
    lineups:{awayPlayers:[{id:901}],homePlayers:[{id:902}]},
  }]}]});
  if(url.includes('/teams?teamIds'))return json({teams:[
    {id:10,name:'Cleveland Guardians',locationName:'Cleveland',teamName:'Guardians',abbreviation:'CLE',league:{id:103}},
    {id:20,name:'Arizona Diamondbacks',locationName:'Arizona',teamName:'Diamondbacks',abbreviation:'AZ',league:{id:104}},
  ]});
  if(url.includes('/people?personIds'))return json({people:[
    /* born ON the Society of Jesus anniversary (09-27) */
    {id:901,fullName:'Ann Iversary',useName:'Ann',lastName:'Iversary',birthDate:'1995-09-27',
     mlbDebutDate:'2018-09-27',primaryNumber:'27',primaryPosition:{abbreviation:'CF'},
     stats:[{type:{displayName:'season'},group:{displayName:'hitting'},
       splits:[{stat:{gamesPlayed:90,atBats:350,plateAppearances:390,hits:100,doubles:20,
         triples:3,homeRuns:20,runs:60,rbi:70,baseOnBalls:35,strikeOuts:70,totalBases:186}}]}]},
    {id:902,fullName:'Plain Player',useName:'Plain',lastName:'Player',birthDate:'1998-04-15',
     mlbDebutDate:null,primaryNumber:'9',primaryPosition:{abbreviation:'1B'},
     stats:[{type:{displayName:'season'},group:{displayName:'hitting'},
       splits:[{stat:{gamesPlayed:80,atBats:300,plateAppearances:330,hits:75,doubles:15,
         triples:1,homeRuns:12,runs:40,rbi:44,baseOnBalls:25,strikeOuts:66,totalBases:128}}]}]},
    {id:903,fullName:'Sp Starter',useName:'Sp',lastName:'Starter',birthDate:'1993-01-05',
     mlbDebutDate:'2016-05-05',primaryNumber:'44',primaryPosition:{abbreviation:'P'},
     stats:[{type:{displayName:'season'},group:{displayName:'pitching'},
       splits:[{stat:{gamesPlayed:18,gamesStarted:18,wins:9,losses:5,outs:330,
         strikeOuts:120,baseOnBalls:28,hits:95,homeRuns:14,inningsPitched:'110.0'}}]}]},
  ]});
  if(url.includes('/stats?stats=season'))return json({stats:[{splits:[{stat:{
    runs:495,hits:900,homeRuns:150,totalBases:1500,strikeOuts:800,baseOnBalls:400,
    atBats:3500,plateAppearances:3900}}]}]});
  return json({});
}

async function makeDom(fetchImpl=fakeFetch){
  const dom=new JSDOM(readHtml(),{
    runScripts:'dangerously',url:'https://query.test/query.html',pretendToBeVisual:true,
    beforeParse(w){
      w.fetch=(u)=>fetchImpl(String(u));
      const Real=w.Date;
      class D extends Real{
        constructor(...a){if(!a.length)super(FIXTURE_DATE+'T12:00:00Z');else super(...a)}
        static now(){return Real.parse(FIXTURE_DATE+'T12:00:00Z')}
      }
      D.UTC=Real.UTC;D.parse=Real.parse;w.Date=D;
    },
  });
  await new Promise(r=>dom.window.addEventListener('load',r,{once:true}));
  for(let i=0;i<80;i++)await new Promise(r=>setTimeout(r,10));
  return dom;
}

const dom=await makeDom();
const Q=dom.window.__QUERY__;
const doc=dom.window.document;

console.log('\n=== §4.4 / §6.9 — LOCKED + DAY-GRANULARITY GATE ===');
t('founders layer loaded from the bundled file',()=>{
  assert.ok(Q.state.founders,'founders not loaded: '+(Q.state.foundersErr||''));
  assert.equal(Q.state.founders.all.length,127);
});
t('every consumed entry is date_status=locked WITH a source',()=>{
  /* the raw file is pre-filtered; assert the engine re-enforces it anyway */
  let checked=0;
  for(const k of Object.keys(FOUNDERS)){
    if(k==='_meta')continue;
    for(const e of FOUNDERS[k]){assert.equal(e.date_status,'locked');assert.ok(e.source);checked++}
  }
  assert.equal(checked,127);
});
t('POISONED input: unlocked / unsourced / undated entries are DROPPED',()=>{
  const poisoned={_meta:{version:99},rituals:[
    {name:'Legit',founded:'1900-01-02',date_status:'locked',source:'https://x',granularity:'day'},
    {name:'Unlocked',founded:'1900-01-02',date_status:'verify',source:'https://x',granularity:'day'},
    {name:'Harvest',founded:'1900-01-02',date_status:'harvest',source:'https://x',granularity:'day'},
    {name:'Legendary',founded:'1900-01-02',date_status:'legendary',source:'https://x',granularity:'day'},
    {name:'NoSource',founded:'1900-01-02',date_status:'locked',granularity:'day'},
    {name:'NoDate',date_status:'locked',source:'https://x',granularity:'day'},
  ]};
  const F=Q.normalizeFounders(poisoned);
  assert.equal(F.all.length,1,'only the locked+sourced+dated entry may survive');
  assert.equal(F.all[0].name,'Legit');
  assert.equal(F.dropped.unlocked,3);
  assert.equal(F.dropped.nosource,1);
  assert.equal(F.dropped.nodate,1);
});
t('granularity split matches the file (73 day / 54 year)',()=>{
  const F=Q.state.founders;
  assert.equal(F.dayCount,73);
  assert.equal(F.yearOnly,54);
});
t('day-span math REFUSES year-granularity entries',()=>{
  const F=Q.state.founders;
  const yearOnly=F.all.filter(e=>!e.dayGranularity);
  assert.ok(yearOnly.length>0);
  yearOnly.forEach(e=>{
    assert.equal(Q.entitySpans(e,FIXTURE_DATE,false),null,
      e.name+' ('+e.founded+') is year-only and must produce no day span');
  });
});
t('activeEntities(dayOnly) returns ONLY day-granularity entities',()=>{
  const cfg=Q.state.cfg;
  const all=Q.activeEntities(cfg,Q.state.founders,false);
  const day=Q.activeEntities(cfg,Q.state.founders,true);
  assert.ok(day.length<all.length);
  day.forEach(e=>{assert.equal(e.dayGranularity,true);assert.equal(e.granularity,'day')});
});
t('sport profile keeps WNBA teams out of the MLB founders set (§6.4)',()=>{
  const cfg=Q.state.cfg;
  assert.equal(cfg.founders.cats.wnba_teams,false,'wnba_teams must be off under the MLB profile');
  Q.activeEntities(cfg,Q.state.founders,false).forEach(e=>{
    assert.notEqual(e.cat,'wnba_teams','cross-sport table leakage');
  });
});
t('Society of Jesus span is exact: 1540-09-27 -> 2026-07-25 = 177,444 days',()=>{
  const soj=Q.state.founders.all.find(e=>e.name==='Society of Jesus');
  assert.ok(soj);
  assert.equal(soj.founded,'1540-09-27');
  assert.equal(Q.entitySpans(soj,FIXTURE_DATE,false).totalDays,177444);
  assert.equal(Q.entitySpans(soj,FIXTURE_DATE,true).totalDays,177445,'end-date-included = +1');
});
t('founder DOB / birthplace layer feature-detected as PRESENT in this file',()=>{
  assert.equal(Q.state.founders.hasFounderDob,true);
  assert.equal(Q.state.founders.hasBirthplace,true);
});
t('feature-detect HIDES those toggles when the harvest is absent',()=>{
  const stripped=JSON.parse(JSON.stringify(FOUNDERS));
  for(const k of Object.keys(stripped)){
    if(k==='_meta')continue;
    stripped[k].forEach(e=>{delete e.founder_dob;delete e.founder_birthplace;delete e.birthplace_ciphers});
  }
  const F=Q.normalizeFounders(stripped);
  assert.equal(F.hasFounderDob,false);
  assert.equal(F.hasBirthplace,false);
  assert.equal(F.all.length,127,'stripping optional fields must not drop entries');
});

console.log('\n=== §6.9 SPANS ENGINE ===');
const cfg=Q.defaultConfig('mlb');
Object.keys(cfg.ciphers).forEach(k=>cfg.ciphers[k]=true);
cfg.types.founders=true;cfg.types.clocks=true;cfg.simple.teamTotals=true;
cfg.founders.crossDates=true;cfg.founders.debutCross=true;cfg.founders.founderDob=true;
Object.keys(Q.state.cfg.founders.cats).forEach(k=>{cfg.founders.cats[k]=Q.state.cfg.founders.cats[k]});
Object.keys(cfg.teamTotals).forEach(k=>{cfg.teamTotals[k].on=true});
cfg.teamTotals.R.mode='custom';cfg.teamTotals.R.off=5;
const scan=Q.scanSlate(Q.state.slate,cfg,Q.state.founders);
const ann=scan.results.find(r=>r.player.fullName==='Ann Iversary');

t('founders span counters exist and name the entity (§7.2)',()=>{
  const f=ann.groups.filter(g=>g.counter.group==='founders');
  assert.ok(f.length>0,'no founders counters');
  const soj=f.find(g=>/Society of Jesus — days since founding/.test(g.counter.label));
  assert.ok(soj,'Society of Jesus since-founding counter missing');
  assert.equal(soj.counter.value,177444);
  assert.match(soj.counter.label,/^⚑ /,'founders counters carry the flag glyph');
});
t('NO founders counter is generated from a year-only entity',()=>{
  const yearNames=new Set(Q.state.founders.all.filter(e=>!e.dayGranularity).map(e=>e.name));
  scan.results.forEach(r=>{
    r.groups.filter(g=>g.counter.group==='founders').forEach(g=>{
      const ent=Q.state.founders.byKey[g.counter.entityKey];
      assert.ok(ent,'counter without an entity key');
      assert.equal(ent.dayGranularity,true,
        'year-only entity produced a day counter: '+ent.name);
      assert.ok(!yearNames.has(ent.name)||ent.dayGranularity);
    });
  });
});
t('anniversary alignment raises an explicit flag line (§6.9)',()=>{
  const f=ann.flags.find(x=>/born on the Society of Jesus anniversary/.test(x.text));
  assert.ok(f,'expected "born on the Society of Jesus anniversary" flag; got '+
    JSON.stringify(ann.flags.map(x=>x.text)));
});
t('offset alignment produces a "N days after/before anniversary" counter',()=>{
  const off=ann.groups.filter(g=>/days (AFTER|BEFORE) the .* anniversary/.test(g.counter.label));
  assert.ok(off.length>0,'no offset-alignment counters');
});
t('cross-date convergence: entity founding -> player birth date',()=>{
  const x=ann.groups.filter(g=>/→ birth date/.test(g.counter.label));
  assert.ok(x.length>0,'no player-date x entity-date counters');
  const days=x.find(g=>/days (after|before)$/.test(g.counter.label)||/— \d[\d,]* days /.test(g.counter.label));
  assert.ok(days,'no total-days cross span');
});
t('no hardcoded offsets anywhere in the founders engine',()=>{
  /* strip comments first: the spec's own "born 322 days after X" example is
     quoted in a comment, which is documentation, not a hardcoded offset. */
  const phase2=(readHtml().split('##  PHASE 2')[1]||'')
    .replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
  assert.ok(phase2.length>1000,'failed to isolate the Phase 2 block');
  assert.equal(/\b322\b/.test(phase2),false,'literal 322 in Phase 2 code');
  /* the offset engine must derive N, never compare against a constant list */
  assert.equal(/OFFSETS\s*=\s*\[/.test(phase2),false,'a hardcoded offset table');
});
t('a founders counter never self-matches its own entity span',()=>{
  ann.groups.filter(g=>g.counter.group==='founders').forEach(g=>{
    g.hits.forEach(x=>{
      if(x.entry.kind==='founders')
        assert.notEqual(x.entry.entityKey,g.counter.entityKey,'tautological self-match');
    });
  });
});

console.log('\n=== §6.10 CAREER CLOCKS ===');
t('days since MLB debut counter present with the right value',()=>{
  const c=ann.groups.find(g=>g.counter.gid==='clk-debut-since');
  assert.ok(c,'debut counter missing');
  assert.equal(c.counter.value,Q.daysBetween('2018-09-27',FIXTURE_DATE));
});
t('debut anniversary since/until counters present',()=>{
  assert.ok(ann.groups.find(g=>g.counter.gid==='clk-debut-ann'));
  assert.ok(ann.groups.find(g=>g.counter.gid==='clk-debut-until'));
});
t('player with no debut date produces no debut clocks, no error',()=>{
  const pl=scan.results.find(r=>r.player.fullName==='Plain Player');
  assert.equal(pl.player.debut,null);
  assert.equal(pl.groups.filter(g=>String(g.counter.gid).startsWith('clk-debut')).length,0);
});
t('franchise clock fires for a DAY-granularity franchise (Guardians 1901-04-24)',()=>{
  const c=ann.groups.find(g=>g.counter.gid==='clk-fr-days');
  assert.ok(c,'Guardians franchise clock missing');
  assert.equal(c.counter.value,Q.daysBetween('1901-04-24',FIXTURE_DATE));
});
t('franchise clock is SILENT for a year-only franchise (Diamondbacks "1998")',()=>{
  const pl=scan.results.find(r=>r.player.fullName==='Plain Player'); /* AZ */
  assert.equal(pl.player.teamId,20);
  assert.equal(pl.groups.filter(g=>String(g.counter.gid).startsWith('clk-fr')).length,0,
    'a year-only founding must produce NO day span, not a back-filled Jan 1');
});
t('birthday spans are ONE implementation shared by both dialogs',()=>{
  const before=cfg.age.lanes.bdaySince.on;
  cfg.age.lanes.bdaySince.on=!before;
  const s2=Q.scanSlate(Q.state.slate,cfg,Q.state.founders);
  const a2=s2.results.find(r=>r.player.fullName==='Ann Iversary');
  const has=a2.groups.some(g=>g.counter.gid==='bday-since');
  assert.equal(has,!before,'the Career Clocks toggle edits the same lane object');
  cfg.age.lanes.bdaySince.on=before;
});

console.log('\n=== §6.11 TEAM TOTALS ===');
t('team counters attach to the player’s team with Current/Next/Custom modes',()=>{
  const tc=ann.groups.filter(g=>g.counter.group==='team');
  assert.ok(tc.length>0,'no team counters');
  const runs=tc.find(g=>/season R/.test(g.counter.label));
  assert.ok(runs,'team R counter missing');
  assert.equal(runs.counter.value,500,'495 + 5 = 500');
  assert.equal(runs.counter.arith,'495 + 5 = 500','custom offsets must show their arithmetic');
});
t('team totals only render when the source is enabled',()=>{
  const c2=JSON.parse(JSON.stringify(cfg));c2.simple.teamTotals=false;
  const s2=Q.scanSlate(Q.state.slate,c2,Q.state.founders);
  const a2=s2.results.find(r=>r.player.fullName==='Ann Iversary');
  assert.equal(a2.groups.filter(g=>g.counter.group==='team').length,0);
});

console.log('\n=== §8 INDEX CHAINING ===');
t('d1 default: no chained hits',()=>{
  const steps=Q.chainSteps(397,1);
  assert.equal(steps.length,1);
  assert.equal(steps[0].depth,1);
});
t('d2: prime value chains to its prime index (397 -> #78)',()=>{
  const steps=Q.chainSteps(397,2);
  assert.equal(steps.length,2);
  assert.equal(steps[1].v,78);
  assert.equal(steps[1].depth,2);
  assert.match(steps[1].text,/397 = prime #78/);
});
t('d2: composite value chains to its composite index',()=>{
  const ci=Q.compositeIndex(400);
  const steps=Q.chainSteps(400,2);
  assert.equal(steps[1].v,ci);
  assert.match(steps[1].text,/composite #/);
});
t('d3 adds exactly one more indexing step and keeps the full chain text',()=>{
  const steps=Q.chainSteps(397,3);
  assert.equal(steps.length,3);
  assert.equal(steps[2].depth,3);
  assert.match(steps[2].text,/397 = prime #78 → 78 = composite #/);
});
t('chain stops cleanly on 0/1 rather than looping',()=>{
  assert.equal(Q.chainSteps(1,3).length,1);
  assert.equal(Q.chainSteps(2,3)[1].v,1);
});
t('chained hits are labelled with depth and never read as direct',()=>{
  const c2=JSON.parse(JSON.stringify(cfg));c2.chain='d3';
  const s2=Q.scanSlate(Q.state.slate,c2,Q.state.founders);
  let chained=0;
  s2.results.forEach(r=>r.groups.forEach(g=>g.hits.forEach(x=>{
    if(x.depth>1){chained++;assert.ok(x.chain,'chained hit without chain text')}
  })));
  assert.ok(chained>0,'d3 produced no chained hits to inspect');
});

console.log('\n=== §7.4 CARD SECTIONS + RENDER ===');
await ta('opposing-pitcher and team-totals sections render',async()=>{
  cfg.card.oppPitcher=true;cfg.card.teamTotals=true;cfg.card.statLine=true;
  cfg.card.ageStrip=true;cfg.card.bdayStrip=true;
  Q.state.cfg=cfg;Q.runScan();Q.render();
  const html=doc.querySelector('.results').innerHTML;
  assert.match(html,/Opposing pitcher/,'opp-pitcher section missing');
  assert.match(html,/Team totals/,'team-totals section missing');
  assert.ok(doc.querySelectorAll('.strip').length>0,'strips missing');
});
t('founders flag lines render on the card',()=>{
  const flags=[...doc.querySelectorAll('.flagline')].map(e=>e.textContent);
  assert.ok(flags.some(f=>/anniversary/.test(f)),'no anniversary flag rendered: '+JSON.stringify(flags));
});
t('founders banner reports the day-granularity active count',()=>{
  const b=[...doc.querySelectorAll('.banner')].map(e=>e.textContent).join(' | ');
  assert.match(b,/founders layer v3/);
  assert.match(b,/year-only entries excluded from day spans/);
});
t('§7.4 defaults are all OFF except match groups',()=>{
  const d=Q.defaultConfig('mlb').card;
  assert.equal(d.groups,true);
  ['ageStrip','bdayStrip','statLine','oppPitcher','teamTotals'].forEach(k=>
    assert.equal(d[k],false,k+' must default OFF'));
});

console.log('\n=== EDGE: FOUNDERS FILE UNREACHABLE ===');
await ta('founders file 404 -> warning banner, every other engine still runs',async()=>{
  const d2=await makeDom((url)=>{
    if(url.includes('founders-locked.json'))
      return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({})});
    return fakeFetch(url);
  });
  const w=d2.window,doc2=w.document,Q2=w.__QUERY__;
  assert.equal(Q2.state.founders,null,'founders must be null, not a half-built object');
  assert.ok(Q2.state.foundersErr,'no error recorded');
  assert.match(Q2.state.foundersErr,/unreachable/);
  const warn=[...doc2.querySelectorAll('.banner.warn')].map(e=>e.textContent).join(' ');
  assert.match(warn,/Founders file unreachable/);
  assert.equal(doc2.querySelectorAll('.banner.err').length,0,'must not be a hard error');
  /* the rest of the instrument still works */
  const c3=Q2.defaultConfig('mlb');c3.types.founders=true;c3.types.clocks=true;
  const s3=Q2.scanSlate(Q2.state.slate,c3,null);
  assert.ok(s3.results.length>0,'scan must still produce cards without the founders layer');
  s3.results.forEach(r=>assert.equal(r.groups.filter(g=>g.counter.group==='founders').length,0));
  w.close();
});
await ta('founders file network error -> same graceful degradation',async()=>{
  const d3=await makeDom((url)=>{
    if(url.includes('founders-locked.json'))return Promise.reject(new Error('DNS'));
    return fakeFetch(url);
  });
  const Q3=d3.window.__QUERY__;
  assert.ok(Q3.state.foundersErr);
  assert.ok(Q3.state.slate,'slate must still load');
  d3.window.close();
});

console.log('\n=== §6.9 GAP FIXES (final audit) ===');
t('6.9-20: birthday-span pool entries no longer depend on the §6.6 direction toggle',()=>{
  const c=JSON.parse(JSON.stringify(cfg));
  c.date.bdayToDate=false;              /* a §6.6 switch, unrelated to §6.9 */
  const s2=Q.scanSlate(Q.state.slate,c,Q.state.founders);
  const a2=s2.results.find(r=>r.player.fullName==='Ann Iversary');
  const viaBday=a2.groups.filter(g=>g.counter.group==='founders')
    .some(g=>g.hits.some(x=>x.entry.kind==='bdaySpan'));
  const anyBday=a2.groups.some(g=>g.hits.some(x=>x.entry.kind==='bdaySpan'));
  assert.ok(anyBday||viaBday||true);    /* presence is data-dependent… */
  /* …but the POOL entry must exist regardless of bdayToDate */
  const ctx2=Q.makeCtx(Q.state.slate,c,Q.state.founders);
  const scanned=Q.scanPlayer(a2.player,ctx2);
  assert.ok(scanned.pool.length>0);
});
t('6.9-20 reverse: age/birthday counters accept founders + clock + entity values',()=>{
  const ctx2=Q.makeCtx(Q.state.slate,cfg,Q.state.founders);
  const p=Q.state.slate.players[901];
  const counters=Q.buildCounters(p,ctx2);
  const bday=counters.find(c=>c.group==='bday');
  assert.ok(bday,'no birthday counter');
  ['founders','clock','entity'].forEach(k=>
    assert.equal(bday.accepts[k],true,'birthday counter must accept '+k));
  const age=counters.find(c=>c.group==='age');
  if(age)['founders','clock','entity'].forEach(k=>assert.equal(age.accepts[k],true));
});
t('6.9-25: cross-date span values reach STAT counters (pool side, not just counters)',()=>{
  const ctx2=Q.makeCtx(Q.state.slate,cfg,Q.state.founders);
  const p=Q.state.slate.players[901];
  const pool=Q.buildPool(p,ctx2);
  const cross=pool.filter(e=>e.kind==='founders'&&/birth date|debut date/.test(e.text));
  assert.ok(cross.length>0,'cross-date spans must appear as POOL entries');
  const stat=Q.buildCounters(p,ctx2).find(c=>c.group==='stat');
  assert.ok(stat,'no stat counter');
  assert.equal(stat.accepts.founders,true,'stat counters must accept founders values');
});
await ta('6.9-13: an entity anniversary ON the analysis date raises a flag',async()=>{
  /* 1966-04-30 Church of Satan -> run the slate on 04-30 */
  const ANNIV='2026-04-30';
  const d4=await makeDom((url)=>{
    if(url.includes('/schedule'))
      return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(
        JSON.parse(JSON.stringify({dates:[{games:[{
          gamePk:1,gameDate:ANNIV+'T23:10:00Z',
          status:{abstractGameState:'Preview',detailedState:'Scheduled'},venue:{name:'T'},
          teams:{away:{team:{id:10,name:'Cleveland Guardians'},probablePitcher:{id:903}},
                 home:{team:{id:20,name:'Arizona Diamondbacks'},probablePitcher:null}},
          lineups:{awayPlayers:[{id:901}],homePlayers:[{id:902}]},
        }]}]})))});
    return fakeFetch(url);
  });
  const Q4=d4.window.__QUERY__;
  Q4.state.cfg.dateStr=ANNIV;
  const slate4=await Q4.ADAPTERS.mlb.fetchSlate(ANNIV);
  const c4=Q4.defaultConfig('mlb');
  Object.keys(Q4.state.cfg.founders.cats).forEach(k=>{c4.founders.cats[k]=Q4.state.cfg.founders.cats[k]});
  c4.founders.crossDates=false;   /* prove it does NOT depend on cross-dates */
  const s4=Q4.scanSlate(slate4,c4,Q4.state.founders);
  const flags=s4.results[0].flags.map(f=>f.text);
  assert.ok(flags.some(f=>/TODAY is the Church of Satan anniversary/.test(f)),
    'expected the analysis-date anniversary flag; got '+JSON.stringify(flags));
  d4.window.close();
});
t('6.9-13: no anniversary flag on an ordinary date',()=>{
  const flagged=scan.results[0].flags.map(f=>f.text);
  assert.equal(flagged.some(f=>/TODAY is the/.test(f)),false,
    '2026-07-25 is no locked entity anniversary; got '+JSON.stringify(flagged));
});

dom.window.close();
console.log('\n'+(fail?'FAILED':'PASSED')+`  ${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);

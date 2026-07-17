/* Engine regression locks — run: npm test
   Same locked values as the convergence-scanner suite + the §2 boot
   checksum. If any fails, fix the engine, never the expected value. */
import {calcAll,checksum,nameRun} from '../src/engine/gematria.js';
import {isPrime,primeIndex,nthPrime,nthComposite,chainBase} from '../src/engine/numbers.js';
import {clockFrom,dateNumerology} from '../src/engine/clocks.js';

let pass=0,fail=0;
const eq=(label,got,want)=>{
  if(got===want){pass++;return}
  fail++;console.error(`FAIL ${label}: got ${got}, want ${want}`);
};

/* §2 checksum lock */
const c0=checksum();
eq('checksum ok',c0.ok,true);

/* cipher locks */
let v=calcAll('Wednesday');
eq('Wednesday Ord',v.Ord,100);eq('Wednesday Red',v.Red,37);eq('Wednesday Rev',v.Rev,143);eq('Wednesday RR',v.RR,44);
v=calcAll('Mercury');
eq('Mercury Ord',v.Ord,103);eq('Mercury Red',v.Red,40);eq('Mercury Rev',v.Rev,86);eq('Mercury RR',v.RR,41);
v=calcAll('Jesuit Order');
eq('Jesuit Ord',v.Ord,144);eq('Jesuit Red',v.Red,54);eq('Jesuit Rev',v.Rev,153);
eq('Jesuit RR',v.RR,72);eq('Jesuit Sat',v.Sat,529);eq('Jesuit Latin',v.Latin,1223);
eq('Society of Jesus Latin',calcAll('Society of Jesus').Latin,1698);
eq('Freemason Latin',calcAll('Freemason').Latin,307);
eq('Baltimore Orioles Jewish',calcAll('Baltimore Orioles').Latin,601);
eq('George Chal',calcAll('George').Chal,25);
eq('Giants Red',calcAll('Giants').Red,25);
eq('San Francisco Red',calcAll('San Francisco').Red,50);
eq('Homerun RR',calcAll('Homerun').RR,32);
eq('Homerun Rev',calcAll('Homerun').Rev,95);
eq('Rangers Red',calcAll('Rangers').Red,37);
eq('Luis Garcia Jr Homer Ord',calcAll('Luis Garcia Jr Homer').Ord,187);
eq('Astros Chal',calcAll('Astros').Chal,20);

/* number theory */
eq('nthPrime(12)',nthPrime(12),37);
eq('nthPrime(8)',nthPrime(8),19);
eq('nthComposite(8)',nthComposite(8),15);
eq('primeIndex(61)',primeIndex(61),18);
eq('isPrime(2)',isPrime(2),true);
eq('chainBase(6)',chainBase(6),6);
eq('chainBase(15)',chainBase(15),6);
eq('chainBase(9)',chainBase(9),9);

/* clocks vs Date Decoder */
let c=clockFrom('1999-04-07','2026-07-09');
eq('PNC years',c.years,27);eq('PNC since',c.since,93);eq('PNC months',c.months,327);
eq('PNC weeks',c.weeks,1422);eq('PNC totalDays',c.totalDays,9955);
c=clockFrom('1958-04-15','2026-07-09');
eq('Giants years',c.years,68);eq('Giants since',c.since,85);eq('Giants totalDays',c.totalDays,24922);
c=clockFrom('1850-09-09','2026-07-09');
eq('CA years',c.years,175);eq('CA since',c.since,303);eq('CA totalDays',c.totalDays,64221);
c=clockFrom('1948-11-12','2026-07-08');
eq('b.1948 since',c.since,238);eq('b.1948 until',c.until,127);

/* date numerology carries both concats + ruler */
const dn=dateNumerology('2026-07-08');
eq('7/8 concat 78',!!dn.vals[78],true);
eq('7/8 concat 87',!!dn.vals[87],true);
eq('7/8 ruler',dn.ruler,'Mercury');
/* date-digit figures in the WIDE set (Baty "#7 on the 16th (7)") */
const dn716=dateNumerology('2026-07-16');
eq('7/16: day digit 7 present',dn716.vals[7].includes('day digit'),true);
eq('7/16: month # 7 merged in',dn716.vals[7].includes('month #'),true);
eq('7/16: year 26 present',dn716.vals[26].includes('year 26'),true);

/* name run respects enabled ciphers */
const run=nameRun('Aaron Judge',{Ord:true,Red:false,Rev:false,RR:false,Sat:false,Chal:false,Sept:false,Latin:false});
eq('nameRun ciphers gated',run.every(x=>x.cipher==='Ord'),true);
eq('nameRun has full+first+last',new Set(run.map(x=>x.label)).size,3);

/* ---- pattern grammar engine (Phase 2, §5) ---- */
import {evalCondition,evalPattern,isDateDependent,SEED_PATTERNS} from '../src/engine/patterns.js';
import {projectStats,addDays} from '../src/engine/forecast.js';

const CIPHERS_ON={Ord:true,Red:true,Rev:true,RR:true,Sat:true,Chal:true,Sept:false,Latin:true};
const mkCtx=over=>({
  ciphers:CIPHERS_ON,templates:[],themeNames:[],
  dn:dateNumerology('2026-07-08'),
  gameNumber:95,teamStats:{R:516,AB:3373,PA:3821,TB:1437},
  teamName:'Pirates',oppTeamName:'Braves',stadium:'PNC Park',
  oppPitcherName:'',oppPitcherVals:[],
  sources:{core:[],theme:[],loadedAll:[],
    dateThread:Object.entries(dateNumerology('2026-07-08').vals).map(([n,l])=>({n:+n,label:l}))},
  batter:{p:{id:1,fullName:'Luis Garcia',lastName:'Garcia',
    season:{homeRuns:77,totalBases:150,plateAppearances:360,gamesPlayed:90,hits:88,atBats:330,strikeOuts:60,baseOnBalls:25,doubles:19,triples:2},
    career:{homeRuns:120}},side:'home',nameVals:[],ageFigures:[]},
  ...over});

/* season HR sits 77 → 78 = the 7/8 date concat (dateThread) */
let r=evalCondition({counter:'rung:HR',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'dateThread',sourceArg:'',hard:true},mkCtx());
eq('grammar: HR+1=78 hits date',r.pass,true);
eq('grammar: match n is 78',r.matches[0].n,78);

/* prime-index modifier: 60+1=61 → prime #18 = "R" Ord 18 */
r=evalCondition({counter:'rung:HR',counterArg:{off:1},scope:'season',lmod:'primeIdx',rmod:'',source:'word',sourceArg:'R',hard:true},
  mkCtx({batter:{p:{id:2,fullName:'X Y',lastName:'Y',season:{homeRuns:60}},side:'home',nameVals:[],ageFigures:[]}}));
eq('grammar: primeIdx bridge 61→18=R Ord',r.pass,true);

/* chain-to: 78 chains to 6 = "F" Ord 6 */
r=evalCondition({counter:'rung:HR',counterArg:{off:1},scope:'season',lmod:'chain',rmod:'',source:'word',sourceArg:'F',hard:true},mkCtx());
eq('grammar: chain-to 78~6',r.pass,true);

/* team game # counter */
r=evalCondition({counter:'teamGame',scope:'season',lmod:'',rmod:'',source:'word',sourceArg:'Homerun',hard:true},mkCtx());
eq('grammar: game #95 = Homerun Rev 95',r.pass,true);

/* team staircase counter: next TB values 1438..1447 vs word? use dn instead —
   staircase +N window resolves values */
r=evalCondition({counter:'stair:TB',scope:'season',lmod:'',rmod:'',source:'dateThread',sourceArg:'',hard:true},mkCtx());
eq('grammar: stair emits candidates',r.leftCount,10);

/* soft never blocks; hard gates */
const pat={id:'t',name:'t',lane:'HR',enabled:true,conditions:[
  {counter:'rung:HR',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'dateThread',sourceArg:'',hard:true},
  {counter:'rung:3B',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'word',sourceArg:'ZZZZZ',hard:false},
]};
let pr=evalPattern(pat,mkCtx());
eq('pattern: hard pass + soft fail still matches',pr.match,true);
eq('pattern: hardPass 1/1',pr.hardPass,1);

/* seeds: shapes + date-dependence */
eq('seeds: 6 shipped',SEED_PATTERNS.length,6);
eq('seeds: Stott example ships disabled',SEED_PATTERNS[4].enabled,false);
eq('seeds: Baty example ships disabled',SEED_PATTERNS[5].enabled,false);
eq('seeds: HR Convergence not date-dependent',isDateDependent(SEED_PATTERNS[0]),false);
eq('date-dependence detected',isDateDependent({conditions:[{counter:'dn'}]}),true);
eq('dow counter date-dependent',isDateDependent({conditions:[{counter:'dow'}]}),true);

/* forecast helpers */
eq('addDays',addDays('2026-07-13',1),'2026-07-14');
const proj=projectStats({season:{homeRuns:10,gamesPlayed:50,hits:100,totalBases:200,atBats:300,plateAppearances:330,strikeOuts:50,baseOnBalls:30,doubles:20,triples:2},career:{homeRuns:100,hits:500}},5);
eq('project: hits 100→110 over 5g',proj.season.hits,110);
eq('project: career advances by accrual',proj.career.hits,510);

/* ---- rungs: 1B/XBH derivation + ladder generation + hit matching (Tony 2026-07) ---- */
import {deriveStats,rungOffsets,classifyRungs} from '../src/engine/rungs.js';

/* (a) 1B = H − 2B − 3B − HR, XBH = 2B + 3B + HR (locked identities) */
let ds=deriveStats({hits:150,doubles:30,triples:3,homeRuns:25});
eq('deriveStats 1B 150-30-3-25=92',ds['1B'],92);
eq('deriveStats XBH 30+3+25=58',ds.XBH,58);
ds=deriveStats({hits:6,doubles:null,triples:null,homeRuns:null});
eq('deriveStats null extras → 1B=H',ds['1B'],6);
eq('deriveStats null extras → XBH=0',ds.XBH,0);
eq('deriveStats no hits field untouched',deriveStats({era:'3.21'})['1B'],undefined);
eq('deriveStats null-safe',deriveStats(null),null);

/* (b) rung ranges are sensible per stat/magnitude */
const oHR=rungOffsets('HR',431);
eq('HR tight ticks 1..8',oHR.slice(0,8).join(','),'1,2,3,4,5,6,7,8');
const o1B=rungOffsets('1B',1500);
eq('1B keeps the tight window at scale',o1B.includes(7)&&o1B.includes(8),true);
const oH=rungOffsets('H',2500);
eq('H thousands-scale +25/50/100/250',
  oH.includes(25)&&oH.includes(50)&&oH.includes(100)&&oH.includes(250),true);
const oPA=rungOffsets('PA',12000);
eq('PA +50/100/250/500',
  oPA.includes(50)&&oPA.includes(100)&&oPA.includes(250)&&oPA.includes(500),true);
const oSO=rungOffsets('SO',400);
eq('SO extends past the tight window (8 & 10)',oSO.includes(8)&&oSO.includes(10),true);
eq('offsets sorted ascending',oPA.every((n,i,a)=>i===0||a[i-1]<n),true);

/* (c) DN / thread / core(institutional) matching flags the right rungs */
const loadedRung=new Map();
loadedRung.set(145,[{src:'DOY 145',cat:'date'}]);
loadedRung.set(143,[{src:'thread',cat:'thread'}]);
loadedRung.set(144,[{src:'JESUIT ORDER Ord',cat:'core'}]);
const cls=classifyRungs('HR',140,{loaded:loadedRung});
const atOff=off=>cls.find(r=>r.off===off);
eq('rung +4 → 144 core word = institutional',atOff(4).institutional,true);
eq('rung +4 counts as hit',atOff(4).hit,true);
eq('rung +5 → 145 flagged as DN',atOff(5).isDate,true);
eq('rung +3 → 143 flagged as thread',atOff(3).isThread,true);
eq('rung +1 → 141 is not a hit',atOff(1).hit,false);
eq('rung +5 not institutional (date only)',atOff(5).institutional,false);

/* (d) projection carries the new lanes */
const projNew=projectStats({season:{gamesPlayed:50,rbi:60,'1B':80,XBH:40},career:{rbi:600,'1B':800,XBH:400}},5);
eq('project: RBI 60→66 over 5g',projNew.season.rbi,66);
eq('project: 1B 80→88',projNew.season['1B'],88);
eq('project: career XBH advances',projNew.career.XBH,404);

/* ---- slate cache validity (instant rehydrate guard) ---- */
import {isSlateCacheValid} from '../src/data/storage.js';
{
  const today='2026-07-16';
  const good={schema:'cvg-slateCache/v1',date:today,savedAt:1,slate:{},seasonInfo:null};
  eq('slateCache: valid today entry accepted',isSlateCacheValid(good,today),true);
  eq('slateCache: yesterday rejected',isSlateCacheValid({...good,date:'2026-07-15'},today),false);
  eq('slateCache: wrong schema rejected',isSlateCacheValid({...good,schema:'x'},today),false);
  eq('slateCache: null rejected',isSlateCacheValid(null,today),false);
}

/* ---- numberToWords (PATTERN-RECIPES §1) — Zach convention: no hyphens, no AND ---- */
import {numberToWords} from '../src/engine/numbers.js';
eq('words 0',numberToWords(0),'ZERO');
eq('words 8',numberToWords(8),'EIGHT');
eq('words 13',numberToWords(13),'THIRTEEN');
eq('words 31',numberToWords(31),'THIRTY ONE');
eq('words 40',numberToWords(40),'FORTY');
eq('words 57',numberToWords(57),'FIFTY SEVEN');
eq('words 100',numberToWords(100),'ONE HUNDRED');
eq('words 168',numberToWords(168),'ONE HUNDRED SIXTY EIGHT');
eq('words 197',numberToWords(197),'ONE HUNDRED NINETY SEVEN');
eq('words 1000',numberToWords(1000),'ONE THOUSAND');
eq('words 2026',numberToWords(2026),'TWO THOUSAND TWENTY SIX');
eq('words out of range',numberToWords(10000),'');
/* the Stott lock: season HR count 8, spelled, hits the career-home rung */
eq('EIGHT Red = 31',calcAll('EIGHT').Red,31);

/* ---- numberWord source (PATTERN-RECIPES §2): counter-reference, spelled ---- */
import {summarizeCondition} from '../src/engine/patterns.js';
{
  /* Stott leg 2: career-home HR sits 30 → 31; season HR sits 7 → 8 → EIGHT = 31 Red */
  const cond={counter:'rung:HR',counterArg:{off:1},scope:'venue',lmod:'',rmod:'',
    source:'numberWord',sourceArg:{counter:'rung:HR',scope:'season',off:1},hard:true};
  const ctx=mkCtx({batter:{p:{id:3,fullName:'Bryson Stott',lastName:'Stott',
    season:{homeRuns:7},career:{homeRuns:56},split:{'career-home':{homeRuns:30}}},
    side:'home',nameVals:[],ageFigures:[]}});
  const r=evalCondition(cond,ctx);
  eq('numberWord: career-home HR 31 = EIGHT Red 31',r.pass,true);
  eq('numberWord: match n',r.matches[0].n,31);
  eq('numberWord: label carries the spelled word',r.matches[0].right.includes('EIGHT Red'),true);
  eq('numberWord: label carries the referenced counter',r.matches[0].right.includes('season HR 7+1'),true);
  eq('numberWord: summarize handles object arg',summarizeCondition(cond).includes('spell'),true);
  /* empty/missing reference resolves empty, never throws */
  const r2=evalCondition({...cond,sourceArg:''},ctx);
  eq('numberWord: no ref → no match',r2.pass,false);
}

/* ---- oppPitcherClock counter (§4): Stott leg 2b — 31d after SP bday ---- */
{
  const ctx=mkCtx({oppPitcherClock:[{n:31,label:'31d after SP bday'},{n:29,label:'SP age 29'}]});
  const r=evalCondition({counter:'oppPitcherClock',scope:'season',lmod:'',rmod:'',
    source:'word',sourceArg:'Eight',hard:true},ctx); // EIGHT Red 31
  eq('oppPitcherClock: 31d after SP bday = EIGHT Red 31',r.pass,true);
  eq('oppPitcherClock: date-dependent → feeds Forecast',
    isDateDependent({conditions:[{counter:'oppPitcherClock'}]}),true);
}

/* ---- sinceLast counter (§5): Stott leg 3 in full ---- */
{
  /* 23 days after his last HR; Bryson Stott Homerun = 83 Red; 83 = 23rd prime */
  const ctx=mkCtx({
    date:'2026-07-16',
    templates:[{id:'tpl-hr',tokens:['{batter full}'],word:'HOMERUN',label:'{batter full} + HOMERUN'}],
    batter:{p:{id:4,fullName:'Bryson Stott',lastName:'Stott',
      season:{homeRuns:7},deep:{lastEvent:{HR:'2026-06-23'}}},
      side:'home',nameVals:[],ageFigures:[]}});
  const r=evalCondition({counter:'sinceLast:HR',scope:'season',lmod:'',rmod:'primeIdx',
    source:'template',sourceArg:'tpl-hr',hard:true},ctx);
  eq('sinceLast: 23d since HR = prime# of Stott Homerun 83',r.pass,true);
  eq('sinceLast: match n is 23',r.matches[0].n,23);
  eq('sinceLast: date-dependent → feeds Forecast',
    isDateDependent({conditions:[{counter:'sinceLast:HR'}]}),true);
  /* no deep data → resolves empty, flagged noData, never throws */
  const r2=evalCondition({counter:'sinceLast:HR',scope:'season',lmod:'',rmod:'',
    source:'word',sourceArg:'X',hard:true},mkCtx({date:'2026-07-16'}));
  eq('sinceLast: no deep data → noData',r2.noData,true);
}

/* ---- dateFig counter (§6): precise 5-formula set, unlike wide dn ---- */
import {resolveCounter} from '../src/engine/patterns.js';
{
  const ctx=mkCtx({date:'2026-07-16'});
  const ns=resolveCounter({counter:'dateFig',scope:'season'},ctx).map(x=>x.n);
  eq('dateFig: exactly 7 values',ns.length,7);
  eq('dateFig: set for 2026-07-16',ns.join(','),'69,33,24,49,22,197,168');
  /* Stott leg 1b: 168 days left = New York Mets 168 */
  const r=evalCondition({counter:'dateFig',scope:'season',lmod:'',rmod:'',source:'oppTeam',sourceArg:'',hard:true},
    mkCtx({date:'2026-07-16',oppTeamNames:['Mets','New York Mets']}));
  eq('dateFig: 168 left = New York Mets 168',r.matches.some(m=>m.n===168),true);
  eq('dateFig: date-dependent',isDateDependent({conditions:[{counter:'dateFig'}]}),true);
}

/* ---- oppTeam/team sources resolve all name variants (§3) ---- */
import {resolveSource} from '../src/engine/patterns.js';
{
  const ctx=mkCtx({oppTeamName:'Mets',oppTeamNames:['Mets','New York Mets','New York']});
  const ns=new Set(resolveSource({source:'oppTeam'},ctx).map(x=>x.n));
  eq('oppTeam variants: Mets=57 present',ns.has(57),true);
  eq('oppTeam variants: New York Mets=168 present',ns.has(168),true);
  /* fallback: single-string ctx (older shape) still resolves */
  const ns2=new Set(resolveSource({source:'oppTeam'},mkCtx({oppTeamName:'Mets'})).map(x=>x.n));
  eq('oppTeam fallback: nickname-only still works',ns2.has(57),true);
  eq('oppTeam fallback: no phantom 168',ns2.has(168),false);
}

/* ---- PATTERN-RECIPES §7: the Bryson Stott post, end-to-end ----
   Every leg of the 2026-07-16 blog line as one recipe. Synthetic batter
   mirrors the real setup: 56 career HR, 30 career-home HR, 7 season HR,
   last HR 23 days back, opp = Mets, SP birthday 31 days back. */
{
  const recipe={id:'stott',name:'MILESTONE SPELL',lane:'HR',enabled:true,conditions:[
    /* leg 1: 57th career HR · Mets=57 */
    {counter:'rung:HR',counterArg:{off:1},scope:'career',lmod:'',rmod:'',source:'oppTeam',sourceArg:'',hard:true},
    /* leg 2: 31st career HR at home · season count spells EIGHT=31 */
    {counter:'rung:HR',counterArg:{off:1},scope:'venue',lmod:'',rmod:'',source:'numberWord',sourceArg:{counter:'rung:HR',scope:'season',off:1},hard:true},
    /* leg 1b: 168 days left · New York Mets=168 */
    {counter:'dateFig',scope:'season',lmod:'',rmod:'',source:'oppTeam',sourceArg:'',hard:false},
    /* leg 2b: 31 days after the pitcher's birthday · same 31 */
    {counter:'oppPitcherClock',scope:'season',lmod:'',rmod:'',source:'numberWord',sourceArg:{counter:'rung:HR',scope:'season',off:1},hard:false},
    /* leg 3: 23 days since last HR · Bryson Stott Homerun=83=23rd prime */
    {counter:'sinceLast:HR',scope:'season',lmod:'',rmod:'primeIdx',source:'template',sourceArg:'tpl-hr',hard:false},
  ]};
  const ctx=mkCtx({
    date:'2026-07-16',dn:dateNumerology('2026-07-16'),
    oppTeamName:'Mets',oppTeamNames:['Mets','New York Mets','New York'],
    oppPitcherClock:[{n:31,label:'31d after SP bday'}],
    templates:[{id:'tpl-hr',tokens:['{batter full}'],word:'HOMERUN',label:'{batter full} + HOMERUN'}],
    batter:{p:{id:5,fullName:'Bryson Stott',lastName:'Stott',
      season:{homeRuns:7},career:{homeRuns:56},split:{'career-home':{homeRuns:30}},
      deep:{lastEvent:{HR:'2026-06-23'}}},
      side:'home',nameVals:[],ageFigures:[]}});
  const res=evalPattern(recipe,ctx);
  eq('Stott: MATCH',res.match,true);
  eq('Stott: 2/2 hard',res.hardPass,2);
  eq('Stott: 3/3 soft',res.softPass,3);
  eq('Stott leg 1: 57 = Mets',res.details[0].matches.some(m=>m.n===57),true);
  eq('Stott leg 2: 31 = EIGHT',res.details[1].matches.some(m=>m.n===31),true);
  eq('Stott leg 1b: 168 = New York Mets',res.details[2].matches.some(m=>m.n===168),true);
  eq('Stott leg 2b: SP bday 31 = EIGHT',res.details[3].matches.some(m=>m.n===31),true);
  eq('Stott leg 3: 23 = prime# of 83',res.details[4].matches.some(m=>m.n===23),true);
  eq('Stott: recipe is date-dependent → Forecast',isDateDependent(recipe),true);
}

/* ---- PATTERN-RECIPES §8: the Brett Baty line, end-to-end ----
   'Brett Baty (58) #7 on the 16th (7) 58th July game, next hr 7. Next hr vs
   NL is 26, can happen in Philadelphia(101)-26p. Can hr in 35th h2h vs PHI
   on 7/16(23), 35-23c in 44th Thursday(35) game, 63d since his last. 63-44c'
   Fixtures verified: Brett Baty 58 RR · Philadelphia 101 Ord = 26th prime ·
   35 = 23rd composite (23 = 7+16) · 63 = 44th composite. */
{
  const recipe=structuredClone(SEED_PATTERNS.find(p=>p.id==='seed-composite-web'));
  recipe.enabled=true;
  const batyName=nameRun('Brett Baty',CIPHERS_ON);
  const ctx=mkCtx({
    date:'2026-07-16',dn:dateNumerology('2026-07-16'),
    oppTeamName:'Phillies',oppTeamNames:['Phillies','Philadelphia Phillies','Philadelphia'],
    sources:{core:[],theme:[],loadedAll:[],
      dateThread:Object.entries(dateNumerology('2026-07-16').vals).map(([n,l])=>({n:+n,label:l}))},
    batter:{p:{id:6,fullName:'Brett Baty',lastName:'Baty',jersey:7,
      season:{homeRuns:6,gamesPlayed:80},
      deep:{month:{gamesPlayed:57},vsOpp:{gamesPlayed:34},dow:{gamesPlayed:43},
        leagueCareer:{homeRuns:25},lastEvent:{HR:'2026-05-14'}}},
      side:'away',nameVals:batyName,ageFigures:[]}});
  const res=evalPattern(recipe,ctx);
  eq('Baty: MATCH',res.match,true);
  eq('Baty: 2/2 hard',res.hardPass,2);
  eq('Baty: 3/3 soft',res.softPass,3);
  eq('Baty leg A: next HR 7 = #7 jersey',res.details[0].matches.some(m=>m.n===7),true);
  eq('Baty leg A2: 58th July game = Brett Baty RR 58',res.details[1].matches.some(m=>m.n===58),true);
  eq('Baty leg B: vs-NL HR 26 = prime# of Philadelphia 101',res.details[2].matches.some(m=>m.n===26),true);
  eq('Baty leg C: comp# of 35th game vs PHI = 23 = 7+16',res.details[3].matches.some(m=>m.n===23),true);
  eq('Baty leg D: 44th Thursday game = comp# of 63d since HR',res.details[4].matches.some(m=>m.n===44),true);
  /* G stays out of the rung:* wildcard — NAME LOCK semantics must not shift */
  const wild=evalCondition({counter:'rung:*',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'word',sourceArg:'ZZZ',hard:true},ctx);
  eq('rung:* excludes G',wild.leftCount,ctx.batter.p.season.homeRuns!=null?1:0); // only HR present in season
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);

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
  gameNumber:22,h2hGameNo:95,teamStats:{PTS:2036,FG:742,REB:872,AST:456},
  teamName:'Sun',oppTeamName:'Lynx',stadium:'Mohegan Sun Arena',
  oppPitcherName:'',oppPitcherVals:[],
  sources:{core:[],theme:[],loadedAll:[],
    dateThread:Object.entries(dateNumerology('2026-07-08').vals).map(([n,l])=>({n:+n,label:l}))},
  batter:{p:{id:1,fullName:'Leila Lacan',lastName:'Lacan',
    season:{PTS:77,FG:56,REB:40,AST:31,'3PM':11,FT:20,PRA:148,GP:14,gamesPlayed:14},
    career:{PTS:225,FG:150}},side:'home',nameVals:[],ageFigures:[]},
  ...over});

/* season PTS sits 77 → 78 = the 7/8 date concat (dateThread) */
let r=evalCondition({counter:'rung:PTS',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'dateThread',sourceArg:'',hard:true},mkCtx());
eq('grammar: PTS+1=78 hits date',r.pass,true);
eq('grammar: match n is 78',r.matches[0].n,78);

/* prime-index modifier: 60+1=61 → prime #18 = "R" Ord 18 */
r=evalCondition({counter:'rung:PTS',counterArg:{off:1},scope:'season',lmod:'primeIdx',rmod:'',source:'word',sourceArg:'R',hard:true},
  mkCtx({batter:{p:{id:2,fullName:'X Y',lastName:'Y',season:{PTS:60}},side:'home',nameVals:[],ageFigures:[]}}));
eq('grammar: primeIdx bridge 61→18=R Ord',r.pass,true);

/* chain-to: 78 chains to 6 = "F" Ord 6 */
r=evalCondition({counter:'rung:PTS',counterArg:{off:1},scope:'season',lmod:'chain',rmod:'',source:'word',sourceArg:'F',hard:true},mkCtx());
eq('grammar: chain-to 78~6',r.pass,true);

/* franchise H2H game # counter (teamGame → h2hGameNo; seasonGame → gameNumber) */
r=evalCondition({counter:'teamGame',scope:'season',lmod:'',rmod:'',source:'word',sourceArg:'Homerun',hard:true},mkCtx());
eq('grammar: H2H #95 = word Rev 95',r.pass,true);
r=evalCondition({counter:'seasonGame',scope:'season',lmod:'',rmod:'',source:'word',sourceArg:'V',hard:true},mkCtx());
eq('grammar: season game #22 = V Ord 22',r.pass,true);

/* team staircase counter emits a +1..+10 window */
r=evalCondition({counter:'stair:PTS',scope:'season',lmod:'',rmod:'',source:'dateThread',sourceArg:'',hard:true},mkCtx());
eq('grammar: stair emits candidates',r.leftCount,10);

/* venue scope reads the season-home split */
r=evalCondition({counter:'rung:FG',counterArg:{off:1},scope:'venue',lmod:'',rmod:'',source:'dateThread',sourceArg:'',hard:true},
  mkCtx({batter:{p:{id:3,fullName:'A B',lastName:'B',split:{'season-home':{FG:77}}},side:'home',nameVals:[],ageFigures:[]}}));
eq('grammar: venue FG+1=78 hits date',r.pass,true);

/* soft never blocks; hard gates */
const pat={id:'t',name:'t',lane:'PTS',enabled:true,conditions:[
  {counter:'rung:PTS',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'dateThread',sourceArg:'',hard:true},
  {counter:'rung:3PM',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'word',sourceArg:'ZZZZZ',hard:false},
]};
let pr=evalPattern(pat,mkCtx());
eq('pattern: hard pass + soft fail still matches',pr.match,true);
eq('pattern: hardPass 1/1',pr.hardPass,1);

/* seeds: shapes + date-dependence */
eq('seeds: 5 shipped',SEED_PATTERNS.length,5);
eq('seeds: FB Convergence not date-dependent',isDateDependent(SEED_PATTERNS[0]),false);
eq('seeds: FB Convergence lane',SEED_PATTERNS[0].lane,'FB');
eq('date-dependence detected',isDateDependent({conditions:[{counter:'dn'}]}),true);
eq('dow counter date-dependent',isDateDependent({conditions:[{counter:'dow'}]}),true);

/* forecast helpers */
eq('addDays',addDays('2026-07-13',1),'2026-07-14');
const proj=projectStats({season:{PTS:100,gamesPlayed:50,GP:50,FG:40,REB:30,AST:20,'3PM':10,FT:15,PRA:150},career:{PTS:500,FG:200}},5);
eq('project: PTS 100→110 over 5g',proj.season.PTS,110);
eq('project: career advances by accrual',proj.career.PTS,510);

/* ---- rungs: 2PM box math + ladder generation + hit matching (Tony 2026-07) ---- */
import {twoPM,rungOffsets,classifyRungs} from '../src/engine/rungs.js';

/* (a) 2PM = FGM − FG3M */
eq('twoPM 56-11=45',twoPM(56,11),45);
eq('twoPM null fg3m → fgm',twoPM(6,null),6);
eq('twoPM 0/0',twoPM(0,0),0);

/* (b) rung ranges are sensible per stat/magnitude */
const o3=rungOffsets('3PM',193);
eq('3PM tight ticks 1..8',o3.slice(0,8).join(','),'1,2,3,4,5,6,7,8');
eq('3PM includes +7',o3.includes(7),true);
eq('3PM includes +8',o3.includes(8),true);
const oPts=rungOffsets('PTS',5000);
eq('PTS jump +10',oPts.includes(10),true);
eq('PTS jump +25',oPts.includes(25),true);
eq('PTS jump +30',oPts.includes(30),true);
const oMin=rungOffsets('MIN',12000);
eq('MIN thousands-scale +50/100/250/500',
  oMin.includes(50)&&oMin.includes(100)&&oMin.includes(250)&&oMin.includes(500),true);
const oReb=rungOffsets('REB',400);
eq('REB extends past the tight window (8 & 10)',oReb.includes(8)&&oReb.includes(10),true);
eq('offsets sorted ascending',oPts.every((n,i,a)=>i===0||a[i-1]<n),true);

/* (c) DN / thread / institutional matching flags the right rungs */
const loadedRung=new Map();
loadedRung.set(145,[{src:'DOY 145',cat:'date'}]);
loadedRung.set(143,[{src:'thread',cat:'thread'}]);
const cls=classifyRungs('3PM',140,{loaded:loadedRung}); // 140+7=147 ∈ institutional table
const atOff=off=>cls.find(r=>r.off===off);
eq('rung +7 → 147 hits institutional table',atOff(7).institutional,true);
eq('rung +7 counts as hit',atOff(7).hit,true);
eq('rung +5 → 145 flagged as DN',atOff(5).isDate,true);
eq('rung +3 → 143 flagged as thread',atOff(3).isThread,true);
eq('rung +1 → 141 is not a hit',atOff(1).hit,false);

/* ---- gamefilter: bbref Regular-Season parity (verified vs Gabby Williams /
   Azura Stevens career rows, 2026-07-15) ---- */
import {CUP_FINAL_DATES,excludedIdsFrom,keepStatRow} from '../src/data/gamefilter.js';

const etD=iso=>String(iso).slice(0,10); // fixture dates already ET-days
const gRows=[
  {id:1,date:'2025-06-10',postseason:false}, // regular
  {id:2,date:'2025-09-17',postseason:true},  // playoff
  {id:3,date:'2025-07-01',postseason:false}, // Cup FINAL 2025 (IND-MIN)
  {id:4,date:'2022-07-26',postseason:false}, // Cup FINAL 2022 (LV-CHI)
];
const excl=excludedIdsFrom(gRows,etD);
eq('filter: regular game kept',excl.has(1),false);
eq('filter: playoff excluded',excl.has(2),true);
eq('filter: 2025 cup final excluded',excl.has(3),true);
eq('filter: 2022 cup final excluded',excl.has(4),true);
eq('filter: 6 cup finals on record',CUP_FINAL_DATES.size,6);
eq('filter: 2026 cup final on record',CUP_FINAL_DATES.has('2026-06-30'),true);

const REAL=new Set([9,6]); // SEA, CHI
eq('filter: real-team regular row kept',
  keepStatRow({team:{id:9},game:{id:1}},REAL,excl),true);
eq('filter: all-star row dropped (TEAM CLARK id 24)',
  keepStatRow({team:{id:24},game:{id:99}},REAL,excl),false);
eq('filter: playoff row dropped',
  keepStatRow({team:{id:9},game:{id:2}},REAL,excl),false);
eq('filter: cup-final row dropped',
  keepStatRow({team:{id:6},game:{id:4}},REAL,excl),false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);

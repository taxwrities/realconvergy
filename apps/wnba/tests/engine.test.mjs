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
eq('seeds: 4 shipped',SEED_PATTERNS.length,4);
eq('seeds: HR Convergence not date-dependent',isDateDependent(SEED_PATTERNS[0]),false);
eq('date-dependence detected',isDateDependent({conditions:[{counter:'dn'}]}),true);
eq('dow counter date-dependent',isDateDependent({conditions:[{counter:'dow'}]}),true);

/* forecast helpers */
eq('addDays',addDays('2026-07-13',1),'2026-07-14');
const proj=projectStats({season:{homeRuns:10,gamesPlayed:50,hits:100,totalBases:200,atBats:300,plateAppearances:330,strikeOuts:50,baseOnBalls:30,doubles:20,triples:2},career:{homeRuns:100,hits:500}},5);
eq('project: hits 100→110 over 5g',proj.season.hits,110);
eq('project: career advances by accrual',proj.career.hits,510);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);

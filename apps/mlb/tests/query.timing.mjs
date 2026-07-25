/* ================================================================
   query.timing.mjs — QUERY-SPEC §4.1 target: full-slate scan re-render
   under 1s. Fetches the REAL statsapi slate for a date (default today)
   through the page's own adapter inside jsdom, then times the scan with
   a deliberately HEAVY query (everything switched on).

   Usage: node apps/mlb/tests/query.timing.mjs [YYYY-MM-DD]
================================================================ */
import {JSDOM} from 'jsdom';
import {readHtml} from './query-extract.mjs';

const DATE=process.argv[2]||new Date().toISOString().slice(0,10);

const dom=new JSDOM(readHtml(),{
  runScripts:'dangerously',url:'https://query.test/query.html',pretendToBeVisual:true,
  beforeParse(w){w.fetch=(...a)=>fetch(...a)},   /* real network */
});
await new Promise(r=>dom.window.addEventListener('load',r,{once:true}));
const Q=dom.window.__QUERY__;

console.log('fetching real slate for '+DATE+' …');
const t0=Date.now();
const slate=await Q.ADAPTERS.mlb.fetchSlate(DATE,m=>{if(m)process.stdout.write('\r  '+m.padEnd(40))});
const fetchMs=Date.now()-t0;
console.log('\rslate fetched in '+(fetchMs/1000).toFixed(1)+'s'.padEnd(40));
console.log('  games   : '+slate.games.length);
console.log('  players : '+Object.keys(slate.players).length);
console.log('  teams   : '+Object.keys(slate.teams).length);
const noLineup=slate.games.filter(g=>!g.lineupPosted.away&&!g.lineupPosted.home).length;
console.log('  games without posted lineups: '+noLineup+' (active roster used)');
const noDob=Object.values(slate.players).filter(p=>!p.dob).length;
console.log('  players without DOB: '+noDob);

/* --- HEAVY query: every Phase-1 engine on, every cipher, every stat --- */
function heavyCfg(){
  const c=Q.defaultConfig('mlb');
  Object.keys(c.ciphers).forEach(k=>c.ciphers[k]=true);
  Object.keys(c.types).forEach(k=>c.types[k]=true);
  Object.keys(c.simple).forEach(k=>c.simple[k]=true);
  Object.keys(c.stat.bat).forEach(k=>{c.stat.bat[k].on=true});
  Object.keys(c.stat.pit).forEach(k=>{c.stat.pit[k].on=true});
  Object.keys(c.teamTotals).forEach(k=>{c.teamTotals[k].on=true});
  c.stat.raw='12 33 47 56 74 93 118 144 201';
  c.custom.phrases=['Kobe Bryant Dies In Helicopter Crash In California',
    'Jesuit Order','Total Eclipse','Sacrifice','Home Run','Triple Play'];
  c.custom.compose=[{field:'pFirst',word:'triples'},{field:'pLast',word:'homers'},
    {field:'oMascot',word:'lose'}];
  return c;
}

const runs=[];
function time(label,cfg,founders){
  /* warm */ Q.scanSlate(slate,cfg,founders);
  const samples=[];
  for(let i=0;i<5;i++){
    const a=performance.now();
    const r=Q.scanSlate(slate,cfg,founders);
    samples.push(performance.now()-a);
    if(i===0){
      const cards=r.results.filter(x=>x.count>0).length;
      const matches=r.results.reduce((a2,x)=>a2+x.count,0);
      console.log('\n'+label);
      console.log('  cards with >=1 match : '+cards+' / '+r.results.length);
      console.log('  total matches        : '+matches.toLocaleString());
    }
  }
  samples.sort((a,b)=>a-b);
  const med=samples[2],max=samples[4];
  console.log('  scan median          : '+med.toFixed(1)+'ms');
  console.log('  scan worst of 5      : '+max.toFixed(1)+'ms');
  console.log('  §4.1 target <1000ms  : '+(max<1000?'PASS':'FAIL'));
  runs.push({label,med,max});
  return max<1000;
}

let ok=true;
const base=Q.defaultConfig('mlb');
ok=time('DEFAULT query (neutral defaults)',base)&&ok;
const heavy=heavyCfg();
ok=time('HEAVY query (everything on, d1)',heavy)&&ok;
const d2=heavyCfg();d2.chain='d2';
ok=time('HEAVY query + index chaining d2',d2)&&ok;
const d3=heavyCfg();d3.chain='d3';
ok=time('HEAVY query + index chaining d3',d3)&&ok;

/* ---- Phase 2 engines: founders spans, career clocks, team totals ---- */
import {readFileSync as rf} from 'node:fs';
import {fileURLToPath as fu} from 'node:url';
import {dirname as dn,join as jn} from 'node:path';
const HERE=dn(fu(import.meta.url));
let founders=null;
try{
  const raw=JSON.parse(rf(jn(HERE,'..','public','data','founders-locked.json'),'utf8'));
  Q.applyFounders(raw,false);
  founders=Q.state.founders;
  console.log('\nfounders layer: '+founders.all.length+' locked+sourced, '+
    founders.dayCount+' day-granularity, '+founders.yearOnly+' year-only (excluded)');
}catch(e){console.log('\nfounders layer unavailable: '+e.message)}

if(founders){
  const withCats=(c)=>{
    Object.keys(Q.state.cfg.founders.cats).forEach(k=>{c.founders.cats[k]=Q.state.cfg.founders.cats[k]});
    founders.all.forEach(e=>{c.founders.entities[e.key]=true});
    return c;
  };
  const f1=withCats(heavyCfg());
  ok=time('HEAVY + founders spans + clocks + team totals (d1)',f1,founders)&&ok;
  const f2=withCats(heavyCfg());f2.chain='d2';f2.founders.gematria=true;
  ok=time('HEAVY + Phase 2 + founders gematria (d2)',f2,founders)&&ok;
  const f3=withCats(heavyCfg());f3.chain='d3';f3.founders.gematria=true;
  f3.founders.crossDates=true;f3.founders.debutCross=true;f3.founders.founderDob=true;
  ok=time('MAXIMUM: everything + cross-dates + d3',f3,founders)&&ok;
}

console.log('\n'+(ok?'PASS':'FAIL')+' — slowest scan '+
  Math.max(...runs.map(r=>r.max)).toFixed(1)+'ms across '+runs.length+' configurations');
dom.window.close();
process.exit(ok?0:1);

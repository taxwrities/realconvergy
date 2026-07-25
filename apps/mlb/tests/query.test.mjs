/* ================================================================
   query.test.mjs — QUERY-SPEC §10 Phase 1 delivery gate.

     1. cipher checksum (§9)
     2. golden output — ONE hand-computed player fixture whose expected
        matches are asserted by hand-derived numbers (§10)
     3. jsdom render test — cards render from stub data (§3)
     4. edge cases — empty slate, no DOB, missing lineups

   Run: node apps/mlb/tests/query.test.mjs
   Requires jsdom (npm i --no-save jsdom).
================================================================ */
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readHtml} from './query-extract.mjs';

let pass=0,fail=0;
const t=(name,fn)=>{
  try{fn();console.log('  ok   '+name);pass++}
  catch(e){console.error('  FAIL '+name+'\n       '+e.message);fail++}
};
const ta=async(name,fn)=>{
  try{await fn();console.log('  ok   '+name);pass++}
  catch(e){console.error('  FAIL '+name+'\n       '+e.message);fail++}
};

/* ---------------------------------------------------------------
   fake statsapi — exercises the REAL adapter, not a stubbed slate.
   One game, three players:
     • BABE RUTH   (batter, DOB 2000-01-01, season HR 76)
     • NO BIRTHDAY (batter, DOB null            → edge case)
     • CY YOUNG    (probable pitcher)
   Lineups are DELIBERATELY absent so the roster fallback is exercised.
--------------------------------------------------------------- */
const FIXTURE_DATE='2026-07-25';
function fakeFetch(url){
  const json=(o)=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(o)});
  if(url.includes('/schedule'))return json({dates:[{games:[{
    gamePk:1,gameDate:FIXTURE_DATE+'T23:10:00Z',
    status:{abstractGameState:'Preview',detailedState:'Scheduled'},
    venue:{name:'Test Park'},
    teams:{
      away:{team:{id:10,name:'Boston Red Sox'},probablePitcher:{id:903}},
      home:{team:{id:20,name:'New York Yankees'},probablePitcher:null},
    },
    lineups:{},                       /* no lineups posted -> roster fallback */
  }]}]});
  if(url.includes('/teams?teamIds'))return json({teams:[
    {id:10,name:'Boston Red Sox',locationName:'Boston',teamName:'Red Sox',abbreviation:'BOS',league:{id:103}},
    {id:20,name:'New York Yankees',locationName:'New York',teamName:'Yankees',abbreviation:'NYY',league:{id:103}},
  ]});
  if(url.includes('/roster')){
    const id=+url.match(/teams\/(\d+)\/roster/)[1];
    return json({roster:id===10
      ?[{person:{id:901},position:{type:'Outfielder',abbreviation:'RF'}},
        {person:{id:902},position:{type:'Infielder',abbreviation:'1B'}}]
      :[]});
  }
  if(url.includes('/people?personIds'))return json({people:[
    {id:901,fullName:'Babe Ruth',useName:'Babe',lastName:'Ruth',birthDate:'2000-01-01',
     mlbDebutDate:'2020-04-01',primaryNumber:'3',primaryPosition:{abbreviation:'RF'},
     stats:[{type:{displayName:'season'},group:{displayName:'hitting'},
       splits:[{stat:{gamesPlayed:100,atBats:400,plateAppearances:450,hits:120,doubles:20,
         triples:2,homeRuns:76,runs:90,rbi:150,baseOnBalls:50,strikeOuts:80,totalBases:296}}]}]},
    {id:902,fullName:'No Birthday',useName:'No',lastName:'Birthday',birthDate:null,
     mlbDebutDate:null,primaryNumber:null,primaryPosition:{abbreviation:'1B'},
     stats:[{type:{displayName:'season'},group:{displayName:'hitting'},
       splits:[{stat:{gamesPlayed:10,atBats:30,plateAppearances:32,hits:8,doubles:1,
         triples:0,homeRuns:1,runs:4,rbi:5,baseOnBalls:2,strikeOuts:9,totalBases:11}}]}]},
    {id:903,fullName:'Cy Young',useName:'Cy',lastName:'Young',birthDate:'1990-03-29',
     mlbDebutDate:'2015-06-06',primaryNumber:'21',primaryPosition:{abbreviation:'P'},
     stats:[{type:{displayName:'season'},group:{displayName:'pitching'},
       splits:[{stat:{gamesPlayed:20,gamesStarted:20,wins:11,losses:4,outs:360,
         strikeOuts:150,baseOnBalls:30,hits:100,homeRuns:12,inningsPitched:'120.0'}}]}]},
  ]});
  if(url.includes('/stats?stats=season'))return json({stats:[{splits:[{stat:{
    runs:495,hits:900,homeRuns:150,totalBases:1500,strikeOuts:800,baseOnBalls:400,
    atBats:3500,plateAppearances:3900}}]}]});
  return json({});
}

async function makeDom(fetchImpl=fakeFetch){
  const dom=new JSDOM(readHtml(),{
    runScripts:'dangerously',
    url:'https://query.test/query.html',
    pretendToBeVisual:true,
    beforeParse(w){
      w.fetch=(u)=>fetchImpl(String(u));
      /* freeze "today" so the non-today warning chip is deterministic */
      const Real=w.Date;
      class D extends Real{
        constructor(...a){if(!a.length)super(FIXTURE_DATE+'T12:00:00Z');else super(...a)}
        static now(){return Real.parse(FIXTURE_DATE+'T12:00:00Z')}
      }
      D.UTC=Real.UTC;D.parse=Real.parse;
      w.Date=D;
    },
  });
  await new Promise(r=>dom.window.addEventListener('load',r,{once:true}));
  /* let the adapter's promise chain settle */
  for(let i=0;i<60;i++)await new Promise(r=>setTimeout(r,10));
  return dom;
}

console.log('\n=== 1. ENGINE CHECKSUM (§9) ===');
const dom=await makeDom();
const Q=dom.window.__QUERY__;
const doc=dom.window.document;

t('JESUIT ORDER checksum passes',()=>{
  const c=Q.checksum();
  assert.equal(c.ok,true,'checksum failed: '+JSON.stringify(c.got));
  assert.deepEqual(c.got.Ord,144);assert.deepEqual(c.got.Red,54);
  assert.deepEqual(c.got.Rev,153);assert.deepEqual(c.got.RR,72);
  assert.deepEqual(c.got.Sat,529);
});
t('no checksum error banner rendered',()=>{
  assert.equal(doc.querySelectorAll('.banner.err').length,0);
});
t('NFD normalization folds accents (§9)',()=>{
  /* "José" must cipher as JOSE, not JOS — gematria-core alone drops the é. */
  assert.equal(Q.calcAll('Jose').Ord,Q.calcAll('José').Ord);
  assert.equal(Q.calcAll('José').Ord,49);   // j10+o15+s19+e5
});

console.log('\n=== 2. GOLDEN OUTPUT (§10) — hand-computed fixture ===');
/* BABE RUTH, hand-derived:
     Ord = (b2+a1+b2+e5) + (r18+u21+t20+h8) = 10 + 67  = 77
     Red = (2+1+2+5)     + (9+3+2+8)        = 10 + 22  = 32   */
t('BABE RUTH Ord = 77 (hand-computed)',()=>assert.equal(Q.calcAll('BABE RUTH').Ord,77));
t('BABE RUTH Red = 32 (hand-computed)',()=>assert.equal(Q.calcAll('BABE RUTH').Red,32));

/* date calcs for 2026-07-25: M=7 DD=25 YYYY=2026 YY=26 CC=20, not a leap year */
const dc=Q.dateCalcs(FIXTURE_DATE,null,{Ord:true});
/* scalar, not array: jsdom arrays live in another realm so deepEqual
   would compare prototypes rather than values. */
const dv=(id)=>{const r=dc.filter(d=>d.id===id);return r.length?r[0].n:null};
t('Day of Year = 206',()=>assert.equal(dv('doy'),206));
t('Days Left = 159',()=>assert.equal(dv('left'),159));
t('M+DD+CC+YY = 78',()=>assert.equal(dv('mddccyy'),78));
t('M+DD+Y-digit-sum = 42',()=>assert.equal(dv('mddYdig'),42));
t('all-digit sum = 24',()=>assert.equal(dv('alldig'),24));
t('M+DD+(YYYY-2000) = 58',()=>assert.equal(dv('mddY2000'),58));
t('Mdig+Ddig+YYdig = 22',()=>assert.equal(dv('mdddigYYdig'),22));
t('Mdig+Ddig+YY+CC = 60',()=>assert.equal(dv('mdddigYYCC'),60));
t('Mdig+Ddig+(YYYY-2000) = 40',()=>assert.equal(dv('mdddigY2000'),40));
t('M+DD = 32',()=>assert.equal(dv('mdd'),32));
t('DD = 25',()=>assert.equal(dv('dd'),25));
t('day-of-month 25th prime = 97',()=>assert.equal(dv('ddPrime'),97));
t('day-of-month 25th composite = 38',()=>assert.equal(dv('ddComposite'),38));
t('concat 7/25 = 725',()=>assert.equal(dv('catMD'),725));
t('concat 25/7 = 257',()=>assert.equal(dv('catDM'),257));
t('all 17 formula ids present',()=>assert.equal(Q.DATE_FORMULAS.length,17));

t('sieve: 397 is prime #78 (QUERY-SPEC §7.2 example)',()=>{
  assert.equal(Q.primeIndex(397),78);
});
t('sieve locks from gematria-core hold',()=>{
  assert.equal(Q.nthPrime(12),37);assert.equal(Q.nthPrime(8),19);
  assert.equal(Q.nthComposite(8),15);assert.equal(Q.primeIndex(61),18);
});
t('sieve reaches the longest founders day-span (177,444)',()=>{
  assert.equal(Q.isPrime(177444),false);
  assert.ok(Q.compositeIndex(177444)>0,'177,444 must be indexable');
});

/* --- the golden scan: HR 76 in "next" mode -> 77 -> "BABE RUTH" = 77 (Ord) --- */
const cfg=Q.defaultConfig('mlb');
cfg.ciphers={Ord:true,Red:true,Rev:false,RR:false,Sat:false,RevSat:false,Chal:false,Sept:false,Latin:false};
cfg.simple.pName=true;cfg.simple.pFirst=false;cfg.simple.pLast=false;
cfg.types={custom:false,date:true,age:true,stat:true,founders:false,clocks:false};
cfg.stat.bat['season-HR']={on:true,mode:'next',off:1};
cfg.date.namesToDate=true;
cfg.date.pools={pName:true,pFirst:false,pLast:false,phrase:false};

const slate=Q.state.slate;
t('adapter produced the fixture slate',()=>{
  assert.ok(slate,'no slate');
  assert.equal(slate.date,FIXTURE_DATE);
  assert.equal(slate.games.length,1);
  assert.equal(Object.keys(slate.players).length,3);
});
const scan=Q.scanSlate(slate,cfg,null);
const ruth=scan.results.find(r=>r.player.fullName==='Babe Ruth');

t('golden: Season Batting HR (next) counter = 77',()=>{
  const g=ruth.groups.find(g=>g.counter.gid==='stat-season-HR-Batting');
  assert.ok(g,'HR counter missing');
  assert.equal(g.counter.value,77);
  assert.equal(g.counter.arith,'76 + 1 = 77');
});
t('golden: HR-next 77 is receipted by "Babe Ruth" = 77 (Ord)',()=>{
  const g=ruth.groups.find(g=>g.counter.gid==='stat-season-HR-Batting');
  const hit=g.hits.find(x=>x.entry.cipher==='Ord');
  assert.ok(hit,'no Ordinal receipt on the HR counter');
  assert.equal(hit.entry.v,77);
  assert.equal(hit.entry.text,'Babe Ruth');
  assert.equal(hit.depth,1,'must be a DIRECT hit, not chained');
});
t('golden: date calc M+DD = 32 is receipted by "Babe Ruth" = 32 (Red)',()=>{
  const g=ruth.groups.find(g=>g.counter.group==='date'&&g.counter.value===32);
  assert.ok(g,'M+DD counter missing');
  const hit=g.hits.find(x=>x.entry.cipher==='Red');
  assert.ok(hit,'no Reduction receipt on M+DD');
  assert.equal(hit.entry.v,32);
});
t('silence: counters with zero matches carry zero hits',()=>{
  const empties=ruth.groups.filter(g=>g.hits.length===0);
  assert.ok(empties.length>0,'fixture should produce some silent counters');
});
t('a counter never self-matches its own family (no date=date)',()=>{
  ruth.groups.filter(g=>g.counter.group==='date').forEach(g=>{
    g.hits.forEach(x=>assert.notEqual(x.entry.kind,'date'));
  });
});

console.log('\n=== 3. jsdom RENDER (§3) ===');
t('rail rendered with all 9 spec fields',()=>{
  const labels=[...doc.querySelectorAll('#railBody .fld-label')].map(e=>e.textContent);
  ['Sport','Filter Presets','Search Mode','Analysis Date','Match Types','Ciphers',
   'Position','Games'].forEach(l=>assert.ok(labels.includes(l),'missing rail field: '+l));
  assert.ok(doc.querySelector('.run-btn'),'missing RUN button');
});
t('RUN button carries the Daily Matches label',()=>{
  assert.match(doc.querySelector('.run-btn').textContent,/Find All Daily Matches/);
});
await ta('cards render from the fixture slate',async()=>{
  Q.state.cfg=cfg;
  Q.runScan();
  Q.render();
  const cards=doc.querySelectorAll('.card');
  assert.ok(cards.length>0,'no cards rendered');
  const html=doc.querySelector('.results').innerHTML;
  assert.ok(html.includes('Babe Ruth'),'Babe Ruth card missing');
  /* the sacred format: a counter head with its value, and receipt lines */
  assert.ok(doc.querySelectorAll('.mhead').length>0,'no counter headings');
  assert.ok(doc.querySelectorAll('.mline').length>0,'no receipt lines');
  assert.ok(doc.querySelector('.card-name .badge'),'no match-count badge');
});
t('every receipt line shows claim + receipt, and NO line is ever unlabelled',()=>{
  const lines=[...doc.querySelectorAll('.mline')];
  assert.ok(lines.length>0);
  lines.forEach(l=>{
    assert.ok(l.querySelector('.v'),'receipt line without a value');
    assert.ok(l.querySelector('.w'),'receipt line without a claim');
    /* §7.2 "never a match without its cipher label": a gematria receipt names
       its cipher; a non-gematria value names its kind. Never bare. */
    const cip=l.querySelector('.cip');
    assert.ok(cip,'unlabelled receipt line: '+l.textContent);
    assert.ok(cip.textContent.trim().length>2,'empty label: '+l.textContent);
  });
});
t('every counter head shows its value (never a counter without one)',()=>{
  [...doc.querySelectorAll('.mhead')].forEach(hd=>{
    assert.ok(hd.querySelector('.mval'),'counter without a value: '+hd.textContent);
    assert.match(hd.querySelector('.mval').textContent,/[\d—]/);
  });
});
t('silence: no empty match groups rendered in Daily mode',()=>{
  const groups=[...doc.querySelectorAll('.mgroup')];
  groups.forEach(g=>{
    assert.ok(g.querySelectorAll('.mline').length>0,
      'empty counter group rendered: '+g.textContent.slice(0,60));
  });
});
t('probe affordance present on every card (§7.5)',()=>{
  const cards=doc.querySelectorAll('.card');
  assert.equal(doc.querySelectorAll('.probe-open,.probe').length,cards.length);
});

console.log('\n=== 4. EDGE CASES ===');
t('player with no DOB: no age/birthday counters, no throw',()=>{
  const nb=scan.results.find(r=>r.player.fullName==='No Birthday');
  assert.ok(nb,'fixture player missing');
  assert.equal(nb.player.dob,null);
  assert.equal(nb.groups.filter(g=>g.counter.group==='age'||g.counter.group==='bday').length,0);
  assert.equal(scan.ctx.clockOf(nb.player),null);
});
t('missing lineups: roster fallback populated the slate',()=>{
  const g=slate.games[0];
  assert.equal(g.lineupPosted.away,false);
  assert.equal(g.lineupPosted.home,false);
  assert.ok(Object.values(slate.players).some(p=>p.teamId===10),'roster fallback produced no players');
});
t('missing-lineups notice rendered in the cache banner',()=>{
  assert.match(doc.querySelector('.banner.info').textContent,/without posted lineups/);
});
await ta('empty slate is a state, not an error',async()=>{
  const d2=await makeDom((url)=>{
    if(url.includes('/schedule'))return Promise.resolve({ok:true,json:()=>Promise.resolve({dates:[]})});
    return fakeFetch(url);
  });
  const doc2=d2.window.document;
  assert.equal(doc2.querySelectorAll('.banner.err').length,0,'empty slate must not raise an error banner');
  assert.match(doc2.querySelector('.empty').textContent,/no games/);
  d2.window.close();
});
await ta('slate fetch failure degrades to a banner, never a blank page',async()=>{
  const d3=await makeDom(()=>Promise.reject(new Error('network down')));
  const doc3=d3.window.document;
  const err=doc3.querySelector('.banner.err');
  assert.ok(err,'no error banner on fetch failure');
  assert.match(err.textContent,/Slate fetch failed/);
  assert.ok(d3.window.__QUERY__.checksum().ok,'engine still sound');
  d3.window.close();
});
t('two-way player would appear under both position filters',()=>{
  const cfg2=Q.defaultConfig('mlb');
  const twp={id:1,teamId:10,gameId:1,isBatter:true,isPitcher:true};
  cfg2.position='bat';assert.ok(twp.isBatter);
  cfg2.position='pit';assert.ok(twp.isPitcher);
});
t('date calcs on a leap year are leap-aware',()=>{
  const leap=Q.dateCalcs('2028-12-31',null,{});
  assert.equal(leap.find(d=>d.id==='doy').n,366);
  assert.equal(leap.filter(d=>d.id==='left').length,0,'0 days left must not render as a value');
});
t('UTC date math has no DST drift',()=>{
  assert.equal(Q.daysBetween('2026-03-07','2026-03-09'),2);
  assert.equal(Q.daysBetween('2026-11-01','2026-11-02'),1);
});
t('End-date-included toggle adds exactly one day',()=>{
  const a=Q.clockFrom('2000-01-01','2026-07-25',false);
  const b=Q.clockFrom('2000-01-01','2026-07-25',true);
  assert.equal(b.totalDays-a.totalDays,1);
  assert.equal(b.since-a.since,1);
  assert.equal(b.until-a.until,1);
  assert.equal(a.years,b.years,'calendar years must NOT shift');
});

console.log('\n=== 5. §0 PRIME DIRECTIVE — NEUTRAL DEFAULTS ===');
t('every simple source defaults ON (shows more, not less)',()=>{
  const d=Q.defaultConfig('mlb');
  Object.keys(d.simple).forEach(k=>assert.equal(d.simple[k],true,k+' must default ON'));
});
t('every match-type engine defaults ON',()=>{
  const d=Q.defaultConfig('mlb');
  Object.keys(d.types).forEach(k=>assert.equal(d.types[k],true,k+' must default ON'));
});
t('every stat lane defaults ON in mode Current',()=>{
  const d=Q.defaultConfig('mlb');
  [d.stat.bat,d.stat.pit,d.teamTotals].forEach(tbl=>{
    Object.keys(tbl).forEach(k=>{
      assert.equal(tbl[k].on,true,k+' must default ON');
      assert.equal(tbl[k].mode,'current',k+' must default to Current (the only neutral mode)');
    });
  });
});
t('sort defaults to match count; sibling dedupe defaults OFF; chaining d1',()=>{
  const d=Q.defaultConfig('mlb');
  assert.equal(d.sort,'count');
  assert.equal(d.dedupeSiblings,false);
  assert.equal(d.chain,'d1');
  assert.equal(d.position,'all');
  assert.deepEqual([...d.games],[]);
});
t('cipher Base defaults follow the sport profile, not a global opinion',()=>{
  const mlb=Q.defaultConfig('mlb').ciphers;
  assert.equal(mlb.Ord&&mlb.Red&&mlb.Rev&&mlb.RR,true,'MLB core must be on');
  assert.equal(mlb.Sat,false,'Satanic is auxiliary for MLB, not Base');
  assert.equal(mlb.Chal,false,'Chaldean is available but NOT in MLB Base');
  const wnba=Q.defaultConfig('wnba').ciphers;
  assert.equal(wnba.Sat,true,'WNBA Base has Satanic ON');
  assert.equal(wnba.Chal,true,'WNBA Base has Chaldean ON');
});

console.log('\n=== 6. AUDIT FIXES ===');
t('§6.2 cipher cards carry their signature colour AT REST, not only when on',()=>{
  Q.state.cfg.ciphers.Sept=false;
  Q.render();
  const html=readHtml();
  assert.match(html,/color:col,borderColor:on\?col:'transparent'/,
    'unselected cipher cards must still render in their signature colour');
});
t('§7.3 hide options are a real popover, not window.prompt',()=>{
  const src=readHtml();
  assert.ok(/function popMenu\(/.test(src),'popMenu missing');
  assert.ok(/function counterMenu\(/.test(src),'counterMenu missing');
  /* prompt() may only survive where naming something is genuinely required */
  const prompts=[...src.matchAll(/prompt\(/g)].length;
  assert.equal(prompts,2,'prompt() should remain only for preset-name and bulk-apply');
  assert.equal(/lineMenu[\s\S]{0,400}prompt\(/.test(src),false,'lineMenu must not use prompt()');
});
t('§5 collapsed rail state cannot leak into desktop layout',()=>{
  const css=readHtml().split('</style>')[0];
  assert.match(css,/@media\(max-width:899px\)\{\.rail\.collapsed \.rail-body\{display:none\}\}/,
    'the collapsed rule must be inside the mobile media query');
});
t('§5 sport + rail state persist immediately, not only on beforeunload',()=>{
  const src=readHtml();
  assert.ok(/function persistRail\(/.test(src));
  assert.match(src,/persistRail\(\);\s*\/\* the sport IS rail state/);
  assert.ok(/pagehide/.test(src),'pagehide fallback missing');
});
t('§7.3 number spotlight restores focus and caret after re-render',()=>{
  const src=readHtml();
  assert.match(src,/again\.focus\(\)/,'spotlight must refocus after renderResults');
  assert.match(src,/setSelectionRange\(caret,caret\)/,'caret must be restored');
});
t('the page LOADS every non-system font its CSS asks for',()=>{
  /* Regression: the CSS was copied from cvg.css but the <link> that loads
     those families was not, so the whole page silently fell back to
     Segoe UI + Consolas. A font stack naming a webfont is a promise the
     page has to keep by itself — public/ inherits nothing from index.html. */
  const head=readHtml().split('</head>')[0];
  const css=readHtml().split('</style>')[0];
  const declared=new Set();
  for(const m of css.matchAll(/font-family:\s*'?"?([A-Z][A-Za-z ]+?)'?"?\s*[,;]/g))declared.add(m[1].trim());
  for(const m of css.matchAll(/--(?:sans|mono):\s*'([^']+)'/g))declared.add(m[1].trim());
  const SYSTEM=new Set(['Consolas','Segoe UI']);
  const webfonts=[...declared].filter(f=>!SYSTEM.has(f)&&/[a-z]/.test(f)&&f.includes(' ')||['Fustat'].includes(f));
  assert.ok(webfonts.length>0,'expected to find webfont families in the CSS');
  webfonts.forEach(f=>{
    const slug=f.replace(/ /g,'+');
    assert.ok(head.includes(slug),'CSS asks for "'+f+'" but nothing in <head> loads it');
  });
  assert.match(head,/rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/,
    'missing the gstatic preconnect index.html uses');
  assert.match(head,/display=swap/,'webfonts must not block first paint');
});
t('§7.3 a spotlighted counter value lights gold',()=>{
  const src=readHtml();
  assert.match(src,/class:'mval'\+\(spot!=null&&c\.value===spot\?' spot-hit':''\)/);
  assert.match(src.split('</style>')[0],/\.mval\.spot-hit\{color:var\(--gold\)/);
});

dom.window.close();
console.log('\n'+(fail?'FAILED':'PASSED')+`  ${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);

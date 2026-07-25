/* ================================================================
   query.fix1.test.mjs — QUERY-FIX-1.md §5 verification gate.

     1. HOOK CORRECTNESS — the Robinson test: on an SD @ MIA fixture,
        Jackie Robinson (tribute figure, no date hook, no routing
        intersection) contributes ZERO. Padres/Marlins team entities and
        CA/FL state entities DO contribute. Robinson appears when the
        fixture date is his birthday.
     2. SPLITS — scope resolution (home/away/venue), degradation.
     3. PROVENANCE — every rendered receipt line matches a
        provenance-bearing template; zero bare receipts.
     4. FILTER SHEET — toggling updates the rendered grid.
     5. EDGE CASES — no birth state · founder without DOB · splits
        unavailable.

   Run: node apps/mlb/tests/query.fix1.test.mjs
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

/* ---------------- SD @ MIA fixture (FIX-1 §5) ----------------
   135 San Diego Padres (CA) at 146 Miami Marlins (FL), loanDepot park.
   901 Cali Kid    — SD, born Linden, CA   → hooks California for his card
   902 Florida Man — MIA, born Tampa, FL   → hooks Florida for his card
   903 Oshu Osada  — SD, born Japan        → NO birth state (edge case)
   904 Sp Starter  — MIA probable pitcher
   Cali Kid carries season+career h/a batting splits (splits tests). */
function mkFetch(opts={}){
  const date=opts.date||FIXTURE_DATE;
  const noSplits=!!opts.noSplits;
  return function fakeFetch(url){
    const json=(o)=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(o)});
    if(url.includes('founders-locked.json'))return json(FOUNDERS);
    if(url.includes('/schedule'))return json({dates:[{games:[{
      gamePk:1,gameDate:date+'T23:10:00Z',
      status:{abstractGameState:'Preview',detailedState:'Scheduled'},
      venue:{name:'loanDepot park',location:{city:'Miami',state:'Florida',stateAbbrev:'FL'}},
      teams:{away:{team:{id:135,name:'San Diego Padres'},probablePitcher:null},
             home:{team:{id:146,name:'Miami Marlins'},probablePitcher:{id:904}}},
      lineups:{awayPlayers:[{id:901},{id:903}],homePlayers:[{id:902}]},
    }]}]});
    if(url.includes('/teams?teamIds'))return json({teams:[
      {id:135,name:'San Diego Padres',locationName:'San Diego',teamName:'Padres',abbreviation:'SD',
       league:{id:104},venue:{location:{city:'San Diego',state:'California',stateAbbrev:'CA'}}},
      {id:146,name:'Miami Marlins',locationName:'Miami',teamName:'Marlins',abbreviation:'MIA',
       league:{id:104},venue:{location:{city:'Miami',state:'Florida',stateAbbrev:'FL'}}},
    ]});
    if(url.includes('/people?personIds')){
      const splitsFor=(h,a)=>noSplits?[]:[
        {type:{displayName:'statSplits'},group:{displayName:'hitting'},splits:[
          {season:'2026',split:{code:'h',description:'Home Games'},stat:h},
          {season:'2026',split:{code:'a',description:'Away Games'},stat:a}]},
        {type:{displayName:'careerStatSplits'},group:{displayName:'hitting'},splits:[
          /* live-verified quirk: career rows arrive DUPLICATED */
          {split:{code:'h'},stat:{gamesPlayed:300,hits:321,homeRuns:40,atBats:1100}},
          {split:{code:'a'},stat:{gamesPlayed:310,hits:280,homeRuns:35,atBats:1150}},
          {split:{code:'h'},stat:{gamesPlayed:300,hits:321,homeRuns:40,atBats:1100}},
          {split:{code:'a'},stat:{gamesPlayed:310,hits:280,homeRuns:35,atBats:1150}}]},
      ];
      return json({people:[
        {id:901,fullName:'Cali Kid',useName:'Cali',lastName:'Kid',birthDate:'1995-05-05',
         birthCity:'Linden',birthStateProvince:'CA',birthCountry:'USA',
         mlbDebutDate:'2018-04-01',primaryNumber:'7',primaryPosition:{abbreviation:'RF'},
         stats:[{type:{displayName:'season'},group:{displayName:'hitting'},
           splits:[{stat:{gamesPlayed:90,atBats:350,plateAppearances:390,hits:51,doubles:20,
             triples:3,homeRuns:20,runs:60,rbi:70,baseOnBalls:35,strikeOuts:70,totalBases:140}}]}]
           .concat(splitsFor({gamesPlayed:44,hits:21,homeRuns:12,atBats:160,strikeOuts:31},
                             {gamesPlayed:46,hits:30,homeRuns:8,atBats:190,strikeOuts:39}))},
        {id:902,fullName:'Florida Man',useName:'Florida',lastName:'Man',birthDate:'1997-06-06',
         birthCity:'Tampa',birthStateProvince:'FL',birthCountry:'USA',
         mlbDebutDate:null,primaryNumber:'9',primaryPosition:{abbreviation:'1B'},
         stats:[{type:{displayName:'season'},group:{displayName:'hitting'},
           splits:[{stat:{gamesPlayed:80,atBats:300,plateAppearances:330,hits:75,doubles:15,
             triples:1,homeRuns:12,runs:40,rbi:44,baseOnBalls:25,strikeOuts:66,totalBases:128}}]}]},
        {id:903,fullName:'Oshu Osada',useName:'Oshu',lastName:'Osada',birthDate:'1994-03-03',
         birthCity:'Oshu',birthCountry:'Japan',           /* NO birthStateProvince */
         mlbDebutDate:'2020-07-01',primaryNumber:'11',primaryPosition:{abbreviation:'CF'},
         stats:[{type:{displayName:'season'},group:{displayName:'hitting'},
           splits:[{stat:{gamesPlayed:70,atBats:260,plateAppearances:280,hits:64,doubles:12,
             triples:2,homeRuns:9,runs:33,rbi:30,baseOnBalls:18,strikeOuts:55,totalBases:98}}]}]},
        {id:904,fullName:'Sp Starter',useName:'Sp',lastName:'Starter',birthDate:'1993-01-05',
         birthCity:'Iowa City',birthStateProvince:'IA',birthCountry:'USA',
         mlbDebutDate:'2016-05-05',primaryNumber:'44',primaryPosition:{abbreviation:'P'},
         stats:[{type:{displayName:'season'},group:{displayName:'pitching'},
           splits:[{stat:{gamesPlayed:18,gamesStarted:18,wins:9,losses:5,outs:330,
             strikeOuts:120,baseOnBalls:28,hits:95,homeRuns:14,inningsPitched:'110.0'}}]}]},
      ]});
    }
    if(url.includes('/stats?stats=season'))return json({stats:[{splits:[{stat:{
      runs:495,hits:900,homeRuns:150,totalBases:1500,strikeOuts:800,baseOnBalls:400,
      atBats:3500,plateAppearances:3900}}]}]});
    return json({});
  };
}

async function makeDom(fetchImpl){
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

const dom=await makeDom(mkFetch());
const Q=dom.window.__QUERY__;
const doc=dom.window.document;
const KEY={robinson:'tribute_figures:Jackie Robinson',padres:'mlb_teams:San Diego Padres',
  marlins:'mlb_teams:Miami Marlins',ca:'states:California',fl:'states:Florida',ga:'states:Georgia'};

/* the fixture query: defaults + founders gematria so year-only team entities
   have something to contribute when hooked. */
function fixCfg(){
  const c=Q.defaultConfig('mlb');
  Object.keys(Q.state.cfg.founders.cats).forEach(k=>{c.founders.cats[k]=Q.state.cfg.founders.cats[k]});
  Q.state.founders.all.forEach(e=>{c.founders.entities[e.key]=true});
  c.founders.gematria=true;
  return c;
}

console.log('\n=== 1. HOOK CORRECTNESS — the Robinson test (FIX-1 §5) ===');
const cfg=fixCfg();
const scan=Q.scanSlate(Q.state.slate,cfg,Q.state.founders);
const hooked=Q.hookedForSlate(scan.ctx);

t('fixture is SD @ MIA with the founders layer loaded',()=>{
  assert.equal(Q.state.slate.games.length,1);
  assert.equal(Q.state.slate.games[0].venueState,'Florida');
  assert.equal(Q.state.founders.all.length,127);
});
t('Jackie Robinson is NOT hooked (no date hook, no routing intersection)',()=>{
  assert.equal(hooked[KEY.robinson],undefined,
    'Robinson hooked via: '+JSON.stringify(hooked[KEY.robinson]));
});
t('Robinson contributes ZERO matches — pool, counters, flags all empty',()=>{
  scan.results.forEach(r=>{
    r.pool.forEach(e=>{
      assert.notEqual(e.entityKey,KEY.robinson,
        'Robinson pool entry on '+r.player.fullName+': '+e.text);
    });
    r.groups.forEach(g=>assert.notEqual(g.counter.entityKey,KEY.robinson,
      'Robinson counter on '+r.player.fullName));
    r.flags.forEach(f=>assert.equal(/Robinson/.test(f.text),false));
  });
});
t('Padres + Marlins team entities ARE routing-hooked (the teams playing)',()=>{
  assert.ok(hooked[KEY.padres],'Padres not hooked');
  assert.ok(hooked[KEY.marlins],'Marlins not hooked');
  assert.equal(hooked[KEY.padres][0].type,'routing');
});
t('Padres/Marlins contribute gematria pool entries on the game’s cards',()=>{
  const cali=scan.results.find(r=>r.player.fullName==='Cali Kid');
  const keys=new Set(cali.pool.filter(e=>e.entityKey).map(e=>e.entityKey));
  assert.ok(keys.has(KEY.padres),'no Padres pool entries');
  assert.ok(keys.has(KEY.marlins),'no Marlins pool entries');
});
t('California + Florida state entities ARE hooked; Georgia is NOT',()=>{
  assert.ok(hooked[KEY.ca],'California not hooked');
  assert.ok(hooked[KEY.fl],'Florida not hooked');
  assert.equal(hooked[KEY.ga],undefined,'Georgia hooked with no GA tie');
});
t('CA/FL contribute span counters on the game’s cards',()=>{
  const cali=scan.results.find(r=>r.player.fullName==='Cali Kid');
  const ents=cali.groups.filter(g=>g.counter.group==='founders').map(g=>g.counter.entityKey);
  assert.ok(ents.indexOf(KEY.ca)>=0,'no California counter');
  assert.ok(ents.indexOf(KEY.fl)>=0,'no Florida counter');
});
t('birth-state hook is per-CARD: California via birth state only on Cali Kid',()=>{
  const ph901=Q.playerHooks(scan.ctx,Q.state.slate.players[901]);
  assert.ok(ph901[KEY.ca],'Cali Kid missing the birth-state hook');
  assert.match(ph901[KEY.ca][0].why,/birth state/);
  const ph902=Q.playerHooks(scan.ctx,Q.state.slate.players[902]);
  assert.equal((ph902[KEY.ca]||[]).some(h=>/birth state/.test(h.why)),false);
});
t('every hooked entity carries a hook type and reason',()=>{
  Object.keys(hooked).forEach(k=>{
    hooked[k].forEach(h2=>{
      assert.ok(['date','routing','manual'].indexOf(h2.type)>=0);
      assert.ok(h2.why&&h2.why.length>2,'hook without a reason on '+k);
    });
  });
});
await ta('Robinson APPEARS when the date is his birthday (01-31)',async()=>{
  const d2=await makeDom(mkFetch({date:'2027-01-31'}));
  const Q2=d2.window.__QUERY__;
  Q2.state.cfg.dateStr='2027-01-31';
  const slate2=await Q2.ADAPTERS.mlb.fetchSlate('2027-01-31');
  const c2=fixCfg.call(null);   /* fresh defaults against Q2 */
  const cc=Q2.defaultConfig('mlb');
  Object.keys(Q2.state.cfg.founders.cats).forEach(k=>{cc.founders.cats[k]=Q2.state.cfg.founders.cats[k]});
  Q2.state.founders.all.forEach(e=>{cc.founders.entities[e.key]=true});
  cc.founders.gematria=true;
  const s2=Q2.scanSlate(slate2,cc,Q2.state.founders);
  const hooked2=Q2.hookedForSlate(s2.ctx);
  assert.ok(hooked2[KEY.robinson],'Robinson not hooked on his anniversary');
  assert.equal(hooked2[KEY.robinson][0].type,'date');
  const anyRob=s2.results.some(r=>
    r.groups.some(g=>g.counter.entityKey===KEY.robinson)||
    r.pool.some(e=>e.entityKey===KEY.robinson));
  assert.ok(anyRob,'hooked Robinson still contributed nothing');
  d2.window.close();
});
t('manual hook admits an arbitrary entity slate-wide',()=>{
  const c3=fixCfg();
  c3.founders.manual['rituals:Society of Jesus']=true;
  const s3=Q.scanSlate(Q.state.slate,c3,Q.state.founders);
  const h3=Q.hookedForSlate(s3.ctx);
  assert.ok(h3['rituals:Society of Jesus']);
  assert.equal(h3['rituals:Society of Jesus'][0].type,'manual');
});
t('widen-scope hooks a whole category; default is OFF',()=>{
  /* cross-realm object: assert emptiness by key count, not deepEqual */
  assert.equal(Object.keys(Q.defaultConfig('mlb').founders.widen).length,0);
  const c4=fixCfg();
  c4.founders.widen.tribute_figures=true;
  const s4=Q.scanSlate(Q.state.slate,c4,Q.state.founders);
  const h4=Q.hookedForSlate(s4.ctx);
  assert.ok(h4[KEY.robinson],'widen tribute_figures must hook Robinson');
});
t('theme activation: naming an entity in a custom phrase hooks it',()=>{
  const c5=fixCfg();
  c5.custom.phrases=['Jackie Robinson Tribute Night'];
  const s5=Q.scanSlate(Q.state.slate,c5,Q.state.founders);
  const h5=Q.hookedForSlate(s5.ctx);
  assert.ok(h5[KEY.robinson],'phrase mention must hook Robinson');
  assert.match(h5[KEY.robinson][0].why,/theme/);
});

console.log('\n=== 2. SPLITS (FIX-1 §3) ===');
t('slate carries verified h/a splits, career dupes absorbed',()=>{
  const p=Q.state.slate.players[901];
  assert.equal(p.batting.seasonSplits.home.H,21);
  assert.equal(p.batting.seasonSplits.away.H,30);
  assert.equal(p.batting.careerSplits.home.H,321);
  assert.equal(p.batting.careerSplits.away.H,280);
});
t('scope=home resolves the home split; receipts name the scope',()=>{
  const c=fixCfg();
  c.stat.bat['season-H']={on:true,mode:'next',off:1,scope:'home'};
  const s=Q.scanSlate(Q.state.slate,c,Q.state.founders);
  const cali=s.results.find(r=>r.player.fullName==='Cali Kid');
  const g=cali.groups.find(g2=>/Season Batting H \(home\)/.test(g2.counter.label));
  assert.ok(g,'no home-scoped H counter');
  assert.equal(g.counter.value,22,'21 + 1 = 22');
  assert.equal(g.counter.splitScope,'home');
});
t('scope=venue auto-resolves from the player’s side (Cali Kid is AWAY)',()=>{
  const c=fixCfg();
  c.stat.bat['season-H']={on:true,mode:'current',off:1,scope:'venue'};
  const s=Q.scanSlate(Q.state.slate,c,Q.state.founders);
  const cali=s.results.find(r=>r.player.fullName==='Cali Kid');
  const g=cali.groups.find(g2=>/venue/.test(g2.counter.label));
  assert.ok(g,'no venue-scoped counter');
  assert.match(g.counter.label,/venue·away/);
  assert.equal(g.counter.value,30,'away H = 30');
});
t('a player with no splits contributes nothing on a split scope — no error',()=>{
  const c=fixCfg();
  c.stat.bat['season-H']={on:true,mode:'current',off:1,scope:'home'};
  const s=Q.scanSlate(Q.state.slate,c,Q.state.founders);
  const fm=s.results.find(r=>r.player.fullName==='Florida Man');
  assert.equal(fm.groups.filter(g=>/\(home\)/.test(g.counter.label)).length,0);
});
t('overall scope is untouched by the splits layer',()=>{
  const c=fixCfg();
  c.stat.bat['season-H']={on:true,mode:'current',off:1,scope:'overall'};
  const s=Q.scanSlate(Q.state.slate,c,Q.state.founders);
  const cali=s.results.find(r=>r.player.fullName==='Cali Kid');
  const g=cali.groups.find(g2=>g2.counter.gid==='stat-season-H-Batting');
  assert.ok(g);assert.equal(g.counter.value,51);
});

console.log('\n=== 3. PROVENANCE (FIX-1 §4) ===');
await ta('every rendered receipt line is provenance-bearing — zero bare receipts',async()=>{
  const c=fixCfg();
  c.founders.gematria=true;
  Q.state.cfg=c;Q.runScan();Q.render();
  /* let the chunked renderer finish */
  for(let i=0;i<160;i++){
    if(!doc.getElementById('renderNote'))break;
    await new Promise(r=>setTimeout(r,15));
  }
  const lines=[...doc.querySelectorAll('.mline')];
  assert.ok(lines.length>0,'no lines rendered');
  const selfNames=new Set();
  Object.values(Q.state.slate.players).forEach(p=>{
    [p.fullName,p.firstName,p.lastName].forEach(x=>x&&selfNames.add(x));
  });
  Object.values(Q.state.slate.teams).forEach(t2=>{
    [t2.fullName,t2.city,t2.nickname].forEach(x=>x&&selfNames.add(x));
  });
  let entityLines=0;
  lines.forEach(l=>{
    const word=(l.querySelector('.w')||{textContent:''}).textContent.replace(/^"|"$/g,'');
    const prov=l.querySelector('.prov');
    const bare=!prov&&!selfNames.has(word);
    assert.equal(bare,false,'bare receipt: '+l.textContent.slice(0,90));
    if(prov&&/⚑/.test(prov.textContent)){
      entityLines++;
      assert.match(prov.textContent,/⚑ .+ — (name|founder|city|nickname|birthplace|span)/,
        'entity line missing field chain: '+prov.textContent);
      assert.match(prov.textContent,/hooked: /,'entity line missing hook: '+prov.textContent);
    }
  });
  assert.ok(entityLines>0,'fixture produced no founders-pool lines to check');
});
t('chained hits keep provenance AFTER the chain notation',()=>{
  const src=readHtml();
  const iChain=src.indexOf("kids.push(h('span',{class:'chain'");
  const iProv=src.indexOf('var pv=provSuffix(e);');
  assert.ok(iChain>0&&iProv>iChain,'provenance suffix must append after the chain span');
});

console.log('\n=== 4. FILTER SHEET (FIX-1 §2) ===');
t('tap-to-hide is gone; the line tap opens the context popover',()=>{
  const src=readHtml();
  assert.equal(/function lineMenu\(/.test(src),false,'lineMenu must be retired');
  assert.ok(/function provPopover\(/.test(src));
  assert.match(src,/onclick:function\(ev\)\{provPopover\(ev,e,counter\)\}/);
});
t('results header has the Filters button; spotlight + sort remain',()=>{
  assert.ok(doc.querySelector('.filters-btn'),'no Filters button');
  assert.ok(doc.querySelector('.spot'),'spotlight removed');
  assert.ok([...doc.querySelectorAll('option')].some(o=>/match count/.test(o.textContent)),'sort removed');
});
await ta('toggling a cipher in the sheet updates the grid live',async()=>{
  Q.state.sheetOpen=true;Q.renderSheet();
  assert.ok(doc.querySelector('.sheet'),'sheet did not open');
  const before=[...doc.querySelectorAll('.mline')].length;
  const chipEls=[...doc.querySelectorAll('.sheet .chips .chip')];
  const ordChip=chipEls.find(c=>c.textContent==='Ordinal');
  assert.ok(ordChip,'no Ordinal chip');
  ordChip.click();
  for(let i=0;i<160;i++){
    if(!doc.getElementById('renderNote'))break;
    await new Promise(r=>setTimeout(r,15));
  }
  const after=[...doc.querySelectorAll('.mline')].length;
  assert.notEqual(after,before,'grid did not change when Ordinal toggled');
  assert.ok(doc.querySelector('.sheet'),'sheet must stay open across the recompute');
  const ordChip2=[...doc.querySelectorAll('.sheet .chips .chip')].find(c=>c.textContent==='Ordinal');
  ordChip2.click();  /* restore */
});
await ta('hiding a counter family removes those groups from cards',async()=>{
  const famChip=[...doc.querySelectorAll('.sheet .chips .chip')].find(c=>c.textContent==='Date calcs');
  assert.ok(famChip,'no Date calcs family chip');
  famChip.click();
  for(let i=0;i<160;i++){
    if(!doc.getElementById('renderNote'))break;
    await new Promise(r=>setTimeout(r,15));
  }
  assert.equal(doc.querySelectorAll('.results .g-date').length,0,'date groups still rendered');
  const famChip2=[...doc.querySelectorAll('.sheet .chips .chip')].find(c=>c.textContent==='Date calcs');
  famChip2.click();
});
t('word mute + un-mute round-trips through working state',()=>{
  Q.muteWord('Marlins');
  assert.ok(Q.state.work.hiddenWords.indexOf('Marlins')>=0);
  const shown=[...doc.querySelectorAll('.mline .w')].map(e=>e.textContent);
  assert.equal(shown.some(w=>w==='"Marlins"'||w==='Marlins'),false,'muted word still rendered');
  Q.state.work.hiddenWords.length=0;
});
t('Done closes; sheet state is captured by presets (config keys exist)',()=>{
  Q.state.sheetOpen=false;Q.renderSheet();
  assert.equal(doc.querySelector('.sheet'),null);
  const c=Q.defaultConfig('mlb');
  assert.ok('manual' in c.founders&&'widen' in c.founders,'sheet knobs must live in preset-captured config');
});

console.log('\n=== 5. EDGE CASES (FIX-1 §5) ===');
t('player with no birth state: no state hook, no error',()=>{
  const ph=Q.playerHooks(scan.ctx,Q.state.slate.players[903]);
  assert.equal(Object.keys(ph).some(k=>/birth state/.test((ph[k][0]||{}).why||'')),false);
  assert.equal(Q.state.slate.players[903].birthState,null);
});
t('entity with a founder but no harvested DOB: no founder-birthday hook path',()=>{
  const noDob=Q.state.founders.all.find(e=>e.founder&&!e.founderDob);
  if(!noDob)return; /* registry may be fully harvested; nothing to assert */
  const hk=Q.hookCtxOf(scan.ctx);
  (hk.slate[noDob.key]||[]).forEach(h2=>
    assert.equal(/birthday/.test(h2.why),false,'birthday hook without a DOB'));
});
await ta('splits fetch failure: Overall works, scopes contribute nothing, zero errors',async()=>{
  const d3=await makeDom(mkFetch({noSplits:true}));
  const Q3=d3.window.__QUERY__;
  const p=Q3.state.slate.players[901];
  assert.equal(p.batting.seasonSplits,undefined);
  const c=Q3.defaultConfig('mlb');
  c.stat.bat['season-H']={on:true,mode:'current',off:1,scope:'home'};
  c.stat.bat['season-HR']={on:true,mode:'current',off:1,scope:'overall'};
  const s3=Q3.scanSlate(Q3.state.slate,c,Q3.state.founders);
  const cali=s3.results.find(r=>r.player.fullName==='Cali Kid');
  assert.equal(cali.groups.filter(g=>/\(home\)/.test(g.counter.label)).length,0);
  assert.ok(cali.groups.find(g=>g.counter.gid==='stat-season-HR-Batting'),'overall lane broken');
  assert.equal(d3.window.document.querySelectorAll('.banner.err').length,0);
  d3.window.close();
});

dom.window.close();
console.log('\n'+(fail?'FAILED':'PASSED')+`  ${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);

/* ================================================================
   patterns — condition grammar engine (LAYOUT-SPEC §5). Pure.
   A pattern = name + ordered conditions ANDed. Each condition:
     [counter scope lmod?] = [rmod? source]   (hard | soft)
   Soft conditions never block a match; they upgrade it.
================================================================ */
import {calcAll,ALL_CIPHERS} from './gematria.js';
import {primeIndex,compositeIndex,chainBase,numberToWords,isPrime} from './numbers.js';
import {daysBetween,dateFigures} from './clocks.js';

export const COUNTERS=[
  {id:'rung:HR',label:'HR rung'},{id:'rung:TB',label:'TB rung'},{id:'rung:SO',label:'K rung'},
  {id:'rung:H',label:'H rung'},{id:'rung:1B',label:'1B rung'},{id:'rung:XBH',label:'XBH rung'},
  {id:'rung:RBI',label:'RBI rung'},{id:'rung:BB',label:'BB rung'},{id:'rung:2B',label:'2B rung'},
  {id:'rung:3B',label:'3B rung'},{id:'rung:AB',label:'AB rung'},{id:'rung:PA',label:'PA rung'},
  {id:'rung:SB',label:'SB (steals) rung'},{id:'rung:R',label:'R (runs) rung'},
  {id:'rung:G',label:'G (games) rung',hint:'games played — month/day-of-week scopes emit BOTH season + career counts (DEEP)'},
  {id:'rung:*',label:'any stat rung'},
  {id:'teamGame',label:'team game #'},{id:'seasonGame',label:'season game #'},
  {id:'stair:R',label:'team next R',hint:'team total, next +1..+10'},{id:'stair:AB',label:'team next AB'},
  {id:'stair:PA',label:'team next PA'},{id:'stair:TB',label:'team next TB'},
  {id:'doy',label:'DOY'},
  {id:'dateFig',label:'date figures (5 formulas + DOY + left)',hint:'the precise 7-figure set from the date row'},
  {id:'dn',label:'date numerology (wide)',hint:'the full ~20-value date map — matches a LOT; prefer date figures'},
  {id:'dow',label:'day-of-week value',hint:"today's day name run through the ciphers"},
  {id:'age',label:'batter age figures',hint:'age, turns, days since/to bday, day-of-life, week'},
  {id:'nameCipher',label:'name cipher',hint:'the batter’s own name (full/first/last) run through one chosen cipher — e.g. full name Ord = 139'},
  /* player-info counters — emit a raw player attribute as the counter value,
     compared to any source (custom #, DN spine, phrase, other counter…). */
  {id:'jerseyNum',label:'Jersey #',hint:'the batter’s jersey number as a raw integer'},
  {id:'jerseyPrime',label:'Jersey is prime',hint:'the jersey number, but only when it is prime (otherwise the leg misses)'},
  {id:'jerseyComposite',label:'Jersey is composite',hint:'the jersey number, but only when it is composite (otherwise the leg misses)'},
  {id:'dayOfLife',label:'Day of life',hint:'the batter’s total days alive (bday.totalDays)'},
  {id:'bdaySince',label:'Days after birthday',hint:'days since the batter’s last birthday'},
  {id:'bdayUntil',label:'Days until birthday',hint:'days until the batter’s next birthday'},
  {id:'ageYears',label:'Age (years)',hint:'the batter’s age in whole years'},
  {id:'jesuit',label:'Jesuit educated',hint:'boolean — passes when the batter attended an AJCU Jesuit school (no source needed)'},
  {id:'oppPitcherClock',label:'opp SP birthday clock',hint:"opposing probable pitcher's birthday clock: days after/to, age, turns"},
  {id:'sinceLast:HR',label:'days since last HR',hint:'needs DEEP (game log)'},
  {id:'sinceLast:H',label:'days since last hit',hint:'needs DEEP (game log)'},
  {id:'sinceLast:2B',label:'days since last 2B',hint:'needs DEEP (game log)'},
  {id:'sinceLast:3B',label:'days since last 3B',hint:'needs DEEP (game log)'},
  {id:'sinceLast:XBH',label:'days since last XBH',hint:'needs DEEP (game log)'},
  {id:'sinceLast:RBI',label:'days since last RBI',hint:'needs DEEP (game log)'},
  {id:'sinceLast:SO',label:'days since last K',hint:'needs DEEP (game log)'},
];
export const SCOPES=['season','career','both','vsTeam','vsDivision','vsLeague','venue','month','dow'];
export const MODS=[{id:'',label:'—'},{id:'primeIdx',label:'prime # of'},{id:'compIdx',label:'composite # of'},{id:'chain',label:'chain-to'}];
export const SOURCES=[
  {id:'core',label:'core table',hint:'enabled Core-vocab words (Vocab tab)'},
  {id:'dateThread',label:'date/thread numbers',hint:'wide date map + quick-add thread numbers'},
  {id:'theme',label:'theme figure',hint:'registry + today’s quick-add themes'},
  {id:'ownName',label:'own name',hint:'batter full/first/last name gematria'},
  {id:'template',label:'phrase template',hint:'a {token}+word phrase from Vocab — must be picked'},
  {id:'oppPitcher',label:'opp pitcher name'},
  {id:'oppTeam',label:'opponent team',hint:'all name variants: nickname, full, city'},
  {id:'team',label:'team',hint:'all name variants: nickname, full, city'},
  {id:'stadium',label:'stadium'},
  {id:'word',label:'free word',hint:'type any word — ciphered live'},
  {id:'customNumber',label:'custom number',hint:'type any number — fires if the counter lands on it'},
  {id:'loaded',label:'any loaded value',hint:'everything on the board — the widest net'},
  {id:'numberWord',label:'spelled counter',hint:'spell another counter’s value (8→EIGHT), then run ciphers'},
  {id:'counterRef',label:'other counter',hint:'compare directly to another counter’s value — no spelling'},
  {id:'jersey',label:'jersey #',hint:'the batter’s jersey number'},
];
/* nameCipher sub-args (counter side): which part of the batter's name and
   which single cipher to run it through. Exposed to the Patterns editor. */
export const NAME_PARTS=['full','first','last'];
export const NAME_CIPHERS=ALL_CIPHERS;

const STAT_KEY={HR:'homeRuns',TB:'totalBases',SO:'strikeOuts',H:'hits','1B':'1B',XBH:'XBH',
  RBI:'rbi',BB:'baseOnBalls','2B':'doubles','3B':'triples',AB:'atBats',PA:'plateAppearances',
  G:'gamesPlayed',SB:'stolenBases',R:'runs'};
/* G/SB/R stay out of the rung:* wildcard — NAME LOCK et al predate them and
   their hit counts must not shift under an engine addition (SB/R added
   2026-07-23; select them explicitly via rung:SB / rung:R). */
const WILDCARD_EXCLUDE=new Set(['G','SB','R']);
const WILDCARD_STATS=Object.keys(STAT_KEY).filter(s=>!WILDCARD_EXCLUDE.has(s));
export const DATE_COUNTERS=new Set(['doy','dateFig','dn','dow','teamGame','seasonGame','age','oppPitcherClock',
  /* birthday/age figures recompute each day → forecast-eligible. Jersey # is
     static, so jerseyNum/jerseyPrime/jerseyComposite stay out. */
  'dayOfLife','bdaySince','bdayUntil','ageYears']);

export const isDateDependent=pattern=>pattern.conditions.some(c=>DATE_COUNTERS.has(c.counter)||c.counter?.startsWith('sinceLast'));

const enabledVals=(s,ciphers)=>{
  const v=calcAll(s);
  return ALL_CIPHERS.filter(c=>ciphers[c]).map(c=>({n:v[c],label:`${s} ${c}`})).filter(x=>x.n>0);
};

/* customNumber source → the set of numbers the leg matches ANY of. `numbers`
   (number[]) is the canonical store; the legacy singular `sourceArg` (a number
   or numeric string like 139 / "139") parses to [n], so patterns saved before
   the multi-value change keep working. Tokens are trimmed, non-numeric ones
   dropped, values kept >0 and deduped; an empty field yields [] (a no-op leg). */
export const customNumbers=cond=>{
  const raw=Array.isArray(cond.numbers)?cond.numbers
    :cond.sourceArg==null?[]:String(cond.sourceArg).split(',');
  const out=[];
  for(const t of raw){
    const n=typeof t==='number'?t:Number(String(t).trim());
    if(Number.isFinite(n)&&n>0&&!out.includes(n))out.push(n);
  }
  return out;
};

/* counter side → candidate values [{n,label}] */
export function resolveCounter(cond,ctx){
  const [kind,stat]=cond.counter.split(':');
  const offMax=cond.counterArg?.off||1;
  const out=[];
  if(kind==='rung'){
    const stats=stat==='*'?WILDCARD_STATS:[stat];
    stats.forEach(S=>{
      const key=STAT_KEY[S];
      const bases=[];
      const p=ctx.batter.p;
      if(cond.scope==='both'){
        /* career + season BOTH — leg fires if either rung (at the offset) lands.
           Tony's "TB rung · both · +3" recipe. */
        if(p.season?.[key]!=null)bases.push({v:+p.season[key],tag:'season'});
        if(p.career?.[key]!=null)bases.push({v:+p.career[key],tag:'career'});
      }
      else if(cond.scope==='season'&&p.season?.[key]!=null)bases.push({v:+p.season[key],tag:'season'});
      else if(cond.scope==='career'&&p.career?.[key]!=null)bases.push({v:+p.career[key],tag:'career'});
      else if(cond.scope==='venue'){
        const s=p.split?.[`season-${ctx.batter.side}`],c=p.split?.[`career-${ctx.batter.side}`];
        if(s?.[key]!=null)bases.push({v:+s[key],tag:`season·${ctx.batter.side}`});
        if(c?.[key]!=null)bases.push({v:+c[key],tag:`career·${ctx.batter.side}`});
      }else if(cond.scope==='vsTeam'&&p.deep?.vsOpp?.[key]!=null)bases.push({v:+p.deep.vsOpp[key],tag:`vs ${p.deep.oppTag}`});
      else if(cond.scope==='vsLeague'){
        if(p.deep?.leagueCareer?.[key]!=null)bases.push({v:+p.deep.leagueCareer[key],tag:`career vs ${p.deep.leagueTag}`});
        if(p.deep?.leagueSeason?.[key]!=null)bases.push({v:+p.deep.leagueSeason[key],tag:`season vs ${p.deep.leagueTag}`});
      }else if(cond.scope==='month'){
        /* two bases like venue: season split + career sitCode split
           ("58th career July game" — Baty). */
        if(p.deep?.month?.[key]!=null)bases.push({v:+p.deep.month[key],tag:p.deep.monthTag});
        if(p.deep?.monthCareer?.[key]!=null)bases.push({v:+p.deep.monthCareer[key],tag:p.deep.monthCareerTag});
      }else if(cond.scope==='dow'){
        if(p.deep?.dow?.[key]!=null)bases.push({v:+p.deep.dow[key],tag:p.deep.dowTag});
        if(p.deep?.dowCareer?.[key]!=null)bases.push({v:+p.deep.dowCareer[key],tag:p.deep.dowCareerTag});
      }else if(!cond.scope||cond.scope==='season'){/* handled above */}
      /* offset: a fixed rung shift (e.g. TB+3 → base+3, exact). 0 (default)
         falls back to the +1..offMax "next N milestones" window — so every
         pattern saved before this addition is byte-for-byte unchanged. */
      const offset=cond.counterArg?.offset||0;
      bases.forEach(b=>{
        if(offset)out.push({n:b.v+offset,label:`${b.tag} ${S} ${b.v}${offset>0?'+':''}${offset}`});
        else for(let k=1;k<=offMax;k++)out.push({n:b.v+k,label:`${b.tag} ${S} ${b.v}+${k}`});
      });
    });
  }else if(kind==='teamGame'||kind==='seasonGame'){
    if(ctx.gameNumber)out.push({n:ctx.gameNumber,label:`game #${ctx.gameNumber}`});
  }else if(kind==='stair'){
    const base=ctx.teamStats?.[stat];
    if(base!=null)for(let k=1;k<=10;k++)out.push({n:base+k,label:`team ${stat} ${base}+${k}`});
  }else if(kind==='doy'){
    out.push({n:ctx.dn.doy,label:`DOY ${ctx.dn.doy}`});
  }else if(kind==='dateFig'){
    /* the 5 standard formulas + DOY + Days Left — precise, unlike 'dn' */
    if(ctx.date)dateFigures(ctx.date).forEach(f=>out.push({n:f.n,label:f.calc}));
  }else if(kind==='dn'){
    Object.entries(ctx.dn.vals).forEach(([n,l])=>out.push({n:+n,label:l}));
  }else if(kind==='dow'){
    enabledVals(ctx.dn.dayName,ctx.ciphers).forEach(x=>out.push(x));
  }else if(kind==='age'){
    (ctx.batter.ageFigures||[]).forEach(x=>out.push({n:x.n,label:x.label}));
  }else if(kind==='oppPitcherClock'){
    (ctx.oppPitcherClock||[]).forEach(x=>out.push({n:x.n,label:x.label}));
  }else if(kind==='nameCipher'){
    /* the batter's own name (full/first/last) run through ANY of the selected
       ciphers — each cipher value is emitted as its own candidate, so the leg
       fires if the source matches in any one of them. Comparable against any
       source (custom #, DN spine, phrase…). e.g. "full name Ord = 139" is
       [nameCipher full Ord] = [customNumber 139]. ciphers defaults to all
       enabled; the legacy singular `cipher` sub-arg is still honored. */
    const p=ctx.batter.p;
    const parts=(p.fullName||'').trim().split(/\s+/);
    const first=p.firstName||parts[0]||'';
    const last=p.lastName||parts.slice(1).join(' ')||'';
    const part=cond.counterArg?.part||'full';
    const str=part==='first'?first:part==='last'?last:(p.fullName||'');
    const arr=cond.counterArg?.ciphers;
    const sel=Array.isArray(arr)?arr
      :cond.counterArg?.cipher?[cond.counterArg.cipher]
      :ALL_CIPHERS.filter(c=>ctx.ciphers?.[c]);
    const vals=calcAll(str);
    sel.forEach(cipher=>{const n=vals[cipher];
      if(n>0)out.push({n,label:`${part} name ${cipher} ${n} (${str})`})});
  }else if(kind==='jerseyNum'){
    /* player-info: raw jersey number, compared to any source. */
    const j=+ctx.batter.p.jersey;
    if(j>0)out.push({n:j,label:`#${j} jersey`});
  }else if(kind==='jerseyPrime'){
    /* the jersey number, gated on primality — misses (no candidate) if not. */
    const j=+ctx.batter.p.jersey;
    if(j>0&&isPrime(j))out.push({n:j,label:`#${j} jersey (prime)`});
  }else if(kind==='jerseyComposite'){
    /* mirror of jerseyPrime — 4 is the smallest composite; 1 is neither. */
    const j=+ctx.batter.p.jersey;
    if(j>=4&&!isPrime(j))out.push({n:j,label:`#${j} jersey (composite)`});
  }else if(kind==='dayOfLife'){
    const b=ctx.batter.bday;
    if(b?.totalDays>0)out.push({n:b.totalDays,label:`day ${b.totalDays} of life`});
  }else if(kind==='bdaySince'){
    const b=ctx.batter.bday;
    if(b&&b.since>0)out.push({n:b.since,label:`${b.since}d after bday`});
  }else if(kind==='bdayUntil'){
    const b=ctx.batter.bday;
    if(b&&b.until>0)out.push({n:b.until,label:`${b.until}d to bday`});
  }else if(kind==='ageYears'){
    const b=ctx.batter.bday;
    /* bday.years is precomputed; derive from totalDays if an older ctx lacks it. */
    const y=b?.years??(b?Math.floor(b.totalDays/365.25):0);
    if(y>0)out.push({n:y,label:`age ${y}`});
  }else if(kind==='sinceLast'){
    /* needs the DEEP tier (p.deep.lastEvent from the gameLog pull) */
    const d=ctx.batter.p.deep?.lastEvent?.[stat];
    if(d&&ctx.date){
      const n=daysBetween(d,ctx.date);
      if(n>0)out.push({n,label:`${n}d since last ${stat}`});
    }
  }
  return out;
}

/* source side → value set [{n,label}] */
export function resolveSource(cond,ctx){
  const src=cond.source;
  if(src==='core')return ctx.sources.core;
  if(src==='dateThread')return ctx.sources.dateThread;
  if(src==='theme')return ctx.sources.theme;
  if(src==='loaded')return ctx.sources.loadedAll;
  if(src==='ownName')return ctx.batter.nameVals;
  if(src==='oppPitcher')return ctx.oppPitcherVals||[];
  /* all name variants (nickname/full/city) when the ctx provides them;
     single-string fallback keeps older ctx shapes working */
  if(src==='oppTeam')return(ctx.oppTeamNames?.length?ctx.oppTeamNames:[ctx.oppTeamName]).filter(Boolean).flatMap(nm=>enabledVals(nm,ctx.ciphers));
  if(src==='team')return(ctx.teamNames?.length?ctx.teamNames:[ctx.teamName]).filter(Boolean).flatMap(nm=>enabledVals(nm,ctx.ciphers));
  if(src==='stadium')return enabledVals(ctx.stadium||'',ctx.ciphers);
  if(src==='word')return typeof cond.sourceArg==='string'&&cond.sourceArg?enabledVals(cond.sourceArg,ctx.ciphers):[];
  if(src==='customNumber'){
    /* a comma-separated LIST Tony types — the leg fires when any counter value
       (stat rung, cipher, day-of-life/career figure, clock…) equals ANY of them. */
    return customNumbers(cond).map(n=>({n,label:`#${n} (typed)`}));
  }
  if(src==='numberWord'||src==='counterRef'){
    /* counter reference on the source side (PATTERN-RECIPES §2/§8): resolve the
       referenced counter, then either SPELL each candidate and run the ciphers
       (numberWord — the Zach convention, season HR next 8 → "EIGHT" → 31 Red)
       or pass the raw values through (counterRef — counter-vs-counter links
       like 44th Thursday game = comp# of days-since-last-HR). rmod applies
       after, so 'comp# of other counter' works. */
    const a=cond.sourceArg&&typeof cond.sourceArg==='object'?cond.sourceArg:null;
    if(!a?.counter)return[];
    const ref=resolveCounter({counter:a.counter,scope:a.scope||'season',counterArg:{off:a.off||1}},ctx);
    if(src==='counterRef')return ref;
    return ref.flatMap(x=>{
      const w=numberToWords(x.n);
      return w?enabledVals(w,ctx.ciphers).map(v=>({n:v.n,label:`${v.label} ${v.n} (${x.label})`})):[];
    });
  }
  if(src==='jersey'){
    const j=+ctx.batter.p.jersey;
    return j>0?[{n:j,label:`#${j} jersey`}]:[];
  }
  if(src==='template'){
    const t=(ctx.templates||[]).find(x=>x.id===cond.sourceArg);
    if(!t)return[];
    const tok=t.tokens[0];
    const ent={'{batter full}':ctx.batter.p.fullName,'{batter last}':ctx.batter.p.lastName,
      '{batter first}':ctx.batter.p.fullName.split(' ')[0],'{opp pitcher}':ctx.oppPitcherName,
      '{team}':ctx.teamName,'{opp team}':ctx.oppTeamName,'{stadium}':ctx.stadium,
      '{day of week}':ctx.dn.dayName,'{theme figure}':null}[tok];
    if(tok==='{theme figure}')
      return (ctx.themeNames||[]).flatMap(nm=>enabledVals(`${nm} ${t.word}`,ctx.ciphers));
    return ent?enabledVals(`${ent} ${t.word}`,ctx.ciphers):[];
  }
  return[];
}

const applyMod=(x,mod)=>{
  if(!mod||mod==='chain')return x;
  if(mod==='primeIdx'){const i=primeIndex(x.n);return i>0?{n:i,label:`prime# of ${x.n} (${x.label})`}:null}
  if(mod==='compIdx'){const i=compositeIndex(x.n);return i>0?{n:i,label:`comp# of ${x.n} (${x.label})`}:null}
  return x;
};

export function evalCondition(cond,ctx){
  /* boolean criterion — passes on a player attribute, no source side.
     Jesuit-educated (AJCU school); the "match" carries the school for evidence. */
  if(cond.counter==='jesuit'){
    const p=ctx.batter.p,pass=!!p.jesuit;
    return{pass,noData:false,leftCount:pass?1:0,rightCount:0,
      matches:pass?[{n:1,left:'Jesuit-educated',right:p.school||'AJCU school'}]:[]};
  }
  const left=resolveCounter(cond,ctx).map(x=>applyMod(x,cond.lmod)).filter(Boolean);
  const right=resolveSource(cond,ctx).map(x=>applyMod(x,cond.rmod)).filter(Boolean);
  const chain=cond.lmod==='chain'||cond.rmod==='chain';
  const matches=[];
  const noData=left.length===0;
  for(const l of left){
    for(const r of right){
      if(chain?chainBase(l.n)===chainBase(r.n):l.n===r.n){
        matches.push({n:l.n,left:l.label,right:r.label,chain});
        if(matches.length>=6)break;
      }
    }
    if(matches.length>=6)break;
  }
  return{pass:matches.length>0,matches,noData,leftCount:left.length,rightCount:right.length};
}

export function evalPattern(pattern,ctx){
  const details=pattern.conditions.map(c=>({cond:c,...evalCondition(c,ctx)}));
  const hard=details.filter(d=>d.cond.hard);
  const soft=details.filter(d=>!d.cond.hard);
  const hardPass=hard.filter(d=>d.pass).length;
  const softPass=soft.filter(d=>d.pass).length;
  /* soft conditions don't block (§5). operator toggles how the hard legs
     combine: AND (default) needs every hard leg; OR needs any one. */
  const match=hard.length>0&&(pattern.operator==='OR'?hardPass>=1:hardPass===hard.length);
  return{match,hardPass,hardTotal:hard.length,softPass,softTotal:soft.length,details};
}

/* seed patterns (§5) — ship pre-loaded */
export const SEED_PATTERNS=[
  {id:'seed-hr-convergence',name:'HR Convergence',lane:'HR',enabled:true,seed:true,conditions:[
    {counter:'rung:HR',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true},
    {counter:'rung:TB',counterArg:{off:4},scope:'season',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true},
    {counter:'rung:PA',counterArg:{off:5},scope:'season',lmod:'',rmod:'',source:'loaded',sourceArg:'',hard:true},
  ]},
  {id:'seed-multi-k',name:'Multi-K stack',lane:'K',enabled:false,seed:true,conditions:[
    {counter:'rung:SO',counterArg:{off:3},scope:'season',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true},
  ]},
  {id:'seed-name-lock',name:'NAME LOCK',lane:'HR',enabled:true,seed:true,conditions:[
    {counter:'rung:*',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'ownName',sourceArg:'',hard:true},
  ]},
  {id:'seed-double-core-chain',name:'Double-Core-Chain',lane:'HR',enabled:true,seed:true,autoPromote:true,conditions:[
    {counter:'rung:*',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true},
    {counter:'rung:*',counterArg:{off:1},scope:'season',lmod:'primeIdx',rmod:'',source:'core',sourceArg:'',hard:true},
  ]},
  /* Worked example of the PATTERN-RECIPES vocabulary — the Bryson Stott post
     (2026-07-16), shipped DISABLED as living documentation: open it in the
     editor to see numberWord / dateFig / oppPitcherClock / sinceLast in use.
     The sinceLast leg needs a '{batter full} + HOMERUN' phrase template
     (Vocab tab) picked as its source before it can fire. */
  {id:'seed-milestone-spell',name:'MILESTONE SPELL (Stott ex.)',lane:'HR',enabled:false,seed:true,
   example:'“Looking for 57th career HR, with 168 days left in the year. Mets=57 & New York Mets=168 … 31st career HR at home and Homerun Eight=31 … 31 days after the Pitcher\'s birthday … 83=23rd prime.” — Stott, 2026-07-16',
   conditions:[
    {counter:'rung:HR',counterArg:{off:1},scope:'career',lmod:'',rmod:'',source:'oppTeam',sourceArg:'',hard:true},
    {counter:'rung:HR',counterArg:{off:1},scope:'venue',lmod:'',rmod:'',source:'numberWord',sourceArg:{counter:'rung:HR',scope:'season',off:1},hard:true},
    {counter:'dateFig',scope:'season',lmod:'',rmod:'',source:'oppTeam',sourceArg:'',hard:false},
    {counter:'oppPitcherClock',scope:'season',lmod:'',rmod:'',source:'numberWord',sourceArg:{counter:'rung:HR',scope:'season',off:1},hard:false},
    {counter:'sinceLast:HR',scope:'season',lmod:'',rmod:'primeIdx',source:'template',sourceArg:'',hard:false},
  ]},
  /* Second worked example — the Brett Baty line (2026-07-16), DISABLED. The
     games-played web: next HR = jersey, Nth month-game = own name, vs-league
     HR = prime# of city, vs-team game count = comp# → date, day-of-week game
     count = comp# of days-since-last-HR. Needs the DEEP tier for the
     month/vsTeam/dow G counts and sinceLast. */
  {id:'seed-composite-web',name:'COMPOSITE WEB (Baty ex.)',lane:'HR',enabled:false,seed:true,
   example:'“Brett Baty (58) #7 on the 16th (7) 58th July game, next hr 7. Next hr vs NL is 26, can happen in Philadelphia(101)-26p. Can hr in 35th h2h vs PHI on 7/16(23), 35-23c in 44th Thursday(35) game, 63d since his last. 63-44c” — 2026-07-16',
   conditions:[
    {counter:'rung:HR',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'jersey',sourceArg:'',hard:true},
    {counter:'rung:G',counterArg:{off:1},scope:'month',lmod:'',rmod:'',source:'ownName',sourceArg:'',hard:true},
    {counter:'rung:HR',counterArg:{off:1},scope:'vsLeague',lmod:'',rmod:'primeIdx',source:'oppTeam',sourceArg:'',hard:false},
    {counter:'rung:G',counterArg:{off:1},scope:'vsTeam',lmod:'compIdx',rmod:'',source:'dateThread',sourceArg:'',hard:false},
    {counter:'rung:G',counterArg:{off:1},scope:'dow',lmod:'',rmod:'compIdx',source:'counterRef',sourceArg:{counter:'sinceLast:HR',scope:'season',off:1},hard:false},
  ]},
];

/* ---- plain-English pattern summaries (Patterns-tab readability) ----
   Generated from the condition structure — never hand-written metadata,
   so they can't rot when a condition is edited and they cover
   user-created patterns too. */
/* normalize the nameCipher counter's cipher selection for describe/summary:
   null → defaults to all enabled ("any cipher"); [] → none; legacy singular
   `cipher` becomes a 1-element list. */
const nameCipherList=arg=>Array.isArray(arg?.ciphers)?arg.ciphers
  :arg?.cipher?[arg.cipher]:null;
const counterPhrase=(counter,scope,off,arg)=>{
  const [kind,stat]=counter.split(':');
  const win=off>1?` (within +${off})`:'';
  if(kind==='rung'){
    const offset=arg?.offset||0;
    const at=offset?` at ${offset>0?'+':''}${offset}`:win;
    const scopeTxt=scope==='both'?'career-or-season':(scope||'season');
    if(stat==='*')return offset?`any ${scopeTxt} stat milestone${at}`:`any next stat milestone${win}`;
    const statName=stat==='G'?'games-played count':stat==='SO'?'K':stat==='SB'?'stolen base':stat==='R'?'run':stat;
    return offset?`the ${scopeTxt} ${statName}${at}`:`the next ${scopeTxt} ${statName}${win}`;
  }
  if(kind==='nameCipher'){
    const list=nameCipherList(arg);
    const cips=!list?'any cipher':list.length===0?'no cipher'
      :list.length>=ALL_CIPHERS.length?'any cipher'
      :`the ${list.join('/')} cipher${list.length>1?'s':''}`;
    return`the batter's ${arg?.part||'full'} name in ${cips}`;
  }
  if(kind==='jerseyNum')return"the batter's jersey number";
  if(kind==='jerseyPrime')return"the batter's jersey number (when prime)";
  if(kind==='jerseyComposite')return"the batter's jersey number (when composite)";
  if(kind==='dayOfLife')return"the batter's day of life";
  if(kind==='bdaySince')return'days after the birthday';
  if(kind==='bdayUntil')return'days until the birthday';
  if(kind==='ageYears')return'age in years';
  if(kind==='teamGame'||kind==='seasonGame')return"the team's game number";
  if(kind==='stair')return`the team's next ${stat} landings`;
  if(kind==='doy')return'the day of year';
  if(kind==='dateFig')return'a date figure (5 formulas + DOY + days left)';
  if(kind==='dn')return'any wide date-numerology value';
  if(kind==='dow')return"the day-of-week's gematria";
  if(kind==='age')return'a batter birthday/age figure';
  if(kind==='oppPitcherClock')return"the opposing pitcher's birthday clock";
  if(kind==='sinceLast')return`days since the batter's last ${stat==='SO'?'K':stat}`;
  return counter;
};
const modWrap=(phrase,mod)=>mod==='primeIdx'?`the prime-index of ${phrase}`
  :mod==='compIdx'?`the composite-index of ${phrase}`:phrase;
const sourcePhrase=c=>{
  const a=c.sourceArg;
  switch(c.source){
    case'core':return'a loaded core-table value';
    case'dateThread':return'a date/thread number';
    case'theme':return'a theme figure';
    case'ownName':return"the batter's own name gematria";
    case'template':return a?'a phrase-template value':'a phrase-template value (template not picked yet)';
    case'oppPitcher':return"the opposing pitcher's name gematria";
    case'oppTeam':return"the opponent's name gematria";
    case'team':return'the own-team name gematria';
    case'stadium':return'the stadium gematria';
    case'word':return typeof a==='string'&&a?`"${a}" gematria`:'a free word (not set)';
    case'customNumber':{const ns=customNumbers(c);
      return ns.length===0?'a custom number (not set)'
        :ns.length===1?`the number ${ns[0]}`:`any of {${ns.join(', ')}}`;}
    case'loaded':return'any loaded value';
    case'numberWord':return a?.counter
      ?`the spelled-out word for ${counterPhrase(a.counter,a.scope,a.off||1,a)}, run through the ciphers`
      :'a spelled counter (not set)';
    case'counterRef':return a?.counter
      ?counterPhrase(a.counter,a.scope,a.off||1,a)
      :'another counter (not set)';
    case'jersey':return"the batter's jersey number";
    default:return c.source;
  }
};
export const describeCondition=c=>{
  if(c.counter==='jesuit')return'the batter is Jesuit-educated (AJCU school)';
  const chain=c.lmod==='chain'||c.rmod==='chain';
  const left=modWrap(counterPhrase(c.counter,c.scope,c.counterArg?.off||1,c.counterArg),c.lmod);
  const right=modWrap(sourcePhrase(c),c.rmod);
  return`${left} ${chain?'chains (9s) with':'lands on'} ${right}`;
};
export const describePattern=p=>{
  const hard=p.conditions.filter(c=>c.hard),soft=p.conditions.filter(c=>!c.hard);
  const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  const join=p.operator==='OR'?', OR ':', AND ';
  const head=hard.length?`Flags batters where ${hard.map(describeCondition).join(join)}`
    :'No hard conditions — never matches on its own';
  const tail=soft.length?` Bonus signals: ${soft.map(describeCondition).join('; ')}.`:'';
  return cap(head)+'.'+tail;
};
/* card-level warnings, derived (not stored) */
const DEEP_SCOPES=new Set(['vsTeam','vsLeague','month','dow']);
export const patternNeedsDeep=p=>p.conditions.some(c=>
  c.counter?.startsWith('sinceLast')||DEEP_SCOPES.has(c.scope)
  ||((c.source==='numberWord'||c.source==='counterRef')&&
     (c.sourceArg?.counter?.startsWith('sinceLast')||DEEP_SCOPES.has(c.sourceArg?.scope))));
export const patternMissingTemplate=p=>p.conditions.some(c=>c.source==='template'&&!c.sourceArg);

export const summarizeCondition=c=>{
  if(c.counter==='jesuit')return`Jesuit educated (${c.hard?'hard':'soft'})`;
  if(c.counter==='nameCipher'){
    const src=SOURCES.find(s=>s.id===c.source)?.label||c.source;
    const rm=c.rmod?MODS.find(m=>m.id===c.rmod).label+' ':'';
    const cn=customNumbers(c);
    const arg=c.source==='customNumber'?(cn.length?` · ${cn.join(', ')}`:'')
      :typeof c.sourceArg==='string'&&c.sourceArg?` "${c.sourceArg}"`:'';
    const list=nameCipherList(c.counterArg);
    const cips=!list||list.length>=ALL_CIPHERS.length?'any':list.length===0?'none':list.join('/');
    return`nameCipher(${c.counterArg?.part||'full'}, ${cips}) = ${rm}${src}${arg} (${c.hard?'hard':'soft'})`;
  }
  const cnt=COUNTERS.find(x=>x.id===c.counter)?.label||c.counter;
  const offset=c.counterArg?.offset||0;
  const off=offset?`${offset>0?'+':''}${offset}`:(c.counterArg?.off>1?`+1..${c.counterArg.off}`:'+1');
  const lm=c.lmod?MODS.find(m=>m.id===c.lmod).label+' ':'';
  const rm=c.rmod?MODS.find(m=>m.id===c.rmod).label+' ':'';
  const src=SOURCES.find(s=>s.id===c.source)?.label||c.source;
  const cn=customNumbers(c);
  const arg=(c.source==='numberWord'||c.source==='counterRef')&&c.sourceArg?.counter
    ?` [${c.source==='numberWord'?'spell ':''}${COUNTERS.find(x=>x.id===c.sourceArg.counter)?.label||c.sourceArg.counter} · ${c.sourceArg.scope||'season'}]`
    :c.source==='customNumber'?(cn.length?` · ${cn.join(', ')}`:'')
    :typeof c.sourceArg==='string'&&c.sourceArg?` "${c.sourceArg}"`:'';
  const rung=c.counter.startsWith('rung');
  return`${lm}${cnt}${rung?` ${off} (${c.scope})`:''} = ${rm}${src}${arg} (${c.hard?'hard':'soft'})`;
};

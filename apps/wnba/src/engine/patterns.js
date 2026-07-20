/* ================================================================
   patterns — condition grammar engine, WNBA counters (spec §2/§5).
   Grammar identical to apps/mlb (shared-code item); only the counter
   set, stat keys, scopes, and seed patterns differ.
     [counter scope lmod?] = [rmod? source]   (hard | soft)

   Recipe vocabulary ported from apps/mlb (PATTERN-RECIPES Phase 1/3),
   basketball-adapted: numberWord/counterRef/jersey sources, all-name-
   variant opponent/team, precise date figures, and the opposing
   center's birthday clock. WNBA has no per-player game-log deep tier,
   so the baseball 'sinceLast:*' counters are intentionally dropped.
================================================================ */
import {calcAll,ALL_CIPHERS} from './gematria.js';
import {primeIndex,compositeIndex,chainBase,numberToWords} from './numbers.js';
import {dateFigures} from './clocks.js';

export const COUNTERS=[
  {id:'rung:FG',label:'FG rung'},{id:'rung:PTS',label:'PTS rung'},
  {id:'rung:REB',label:'REB rung'},{id:'rung:AST',label:'AST rung'},
  {id:'rung:3PM',label:'3PM rung'},{id:'rung:2PM',label:'2PM rung'},
  {id:'rung:FT',label:'FT rung'},{id:'rung:PRA',label:'PRA rung'},
  {id:'rung:GP',label:'GP (games) rung',hint:'games played'},
  {id:'rung:*',label:'any stat rung'},
  {id:'teamGame',label:'franchise H2H game #'},{id:'seasonGame',label:'season game #'},
  {id:'stair:PTS',label:'team next PTS',hint:'team total, next +1..+10'},{id:'stair:FG',label:'team next FG'},
  {id:'stair:REB',label:'team next REB'},{id:'stair:AST',label:'team next AST'},
  {id:'doy',label:'DOY'},
  {id:'dateFig',label:'date figures (5 formulas + DOY + left)',hint:'the precise 7-figure set from the date row'},
  {id:'dn',label:'date numerology (wide)',hint:'the full ~20-value date map — matches a LOT; prefer date figures'},
  {id:'dow',label:'day-of-week value',hint:"today's day name run through the ciphers"},
  {id:'age',label:'player age figures',hint:'age, turns, days since/to bday, day-of-life, week'},
  {id:'nameCipher',label:'name cipher',hint:'the player’s own name (full/first/last) run through one chosen cipher — e.g. full name Ord = 139'},
  {id:'jesuit',label:'Jesuit educated',hint:'boolean — passes when the player attended an AJCU Jesuit school (no source needed)'},
  {id:'oppCenterClock',label:'opp center birthday clock',hint:"opposing starting center's birthday clock: days after/to, age, turns"},
];
/* vsTeam resolves from the ⚡ deep fetch (this season's meetings);
   career-vs-team is not resolvable from BDL — scope reports no-data. */
export const SCOPES=['season','career','vsTeam','venue','month','dow'];
export const MODS=[{id:'',label:'—'},{id:'primeIdx',label:'prime # of'},{id:'compIdx',label:'composite # of'},{id:'chain',label:'chain-to'}];
export const SOURCES=[
  {id:'core',label:'core table',hint:'enabled Core-vocab words (Vocab tab)'},
  {id:'dateThread',label:'date/thread numbers',hint:'wide date map + quick-add thread numbers'},
  {id:'theme',label:'theme figure',hint:'registry + today’s quick-add themes'},
  {id:'ownName',label:'own name',hint:'player full/first/last name gematria'},
  {id:'template',label:'phrase template',hint:'a {token}+word phrase from Vocab — must be picked'},
  {id:'oppPitcher',label:'opposing center name'},
  {id:'oppTeam',label:'opponent team',hint:'all name variants: nickname, full, city'},
  {id:'team',label:'team',hint:'all name variants: nickname, full, city'},
  {id:'stadium',label:'arena'},
  {id:'word',label:'free word',hint:'type any word — ciphered live'},
  {id:'customNumber',label:'custom number',hint:'type any number — fires if the counter lands on it'},
  {id:'loaded',label:'any loaded value',hint:'everything on the board — the widest net'},
  {id:'numberWord',label:'spelled counter',hint:'spell another counter’s value (8→EIGHT), then run ciphers'},
  {id:'counterRef',label:'other counter',hint:'compare directly to another counter’s value — no spelling'},
  {id:'jersey',label:'jersey #',hint:'the player’s jersey number'},
];
/* nameCipher sub-args (counter side): which part of the player's name and
   which single cipher to run it through. Exposed to the Patterns editor. */
export const NAME_PARTS=['full','first','last'];
export const NAME_CIPHERS=ALL_CIPHERS;

const STAT_KEY={FG:'FG',PTS:'PTS',REB:'REB',AST:'AST','3PM':'3PM','2PM':'2PM',FT:'FT',PRA:'PRA',GP:'GP'};
export const DATE_COUNTERS=new Set(['doy','dateFig','dn','dow','teamGame','seasonGame','age','oppCenterClock']);

export const isDateDependent=pattern=>pattern.conditions.some(c=>DATE_COUNTERS.has(c.counter));

const enabledVals=(s,ciphers)=>{
  const v=calcAll(s);
  return ALL_CIPHERS.filter(c=>ciphers[c]).map(c=>({n:v[c],label:`${s} ${c}`})).filter(x=>x.n>0);
};

/* counter side → candidate values [{n,label}] */
export function resolveCounter(cond,ctx){
  const [kind,stat]=cond.counter.split(':');
  const offMax=cond.counterArg?.off||1;
  const out=[];
  if(kind==='rung'){
    const stats=stat==='*'?Object.keys(STAT_KEY):[stat];
    stats.forEach(S=>{
      const key=STAT_KEY[S];
      const bases=[];
      const p=ctx.batter.p;
      if(cond.scope==='season'&&p.season?.[key]!=null)bases.push({v:+p.season[key],tag:'season'});
      else if(cond.scope==='career'&&p.career?.[key]!=null)bases.push({v:+p.career[key],tag:'career'});
      else if(cond.scope==='venue'){
        const s=p.split?.[`season-${ctx.batter.side}`];
        if(s?.[key]!=null)bases.push({v:+s[key],tag:`season·${ctx.batter.side}`});
      }else if(cond.scope==='vsTeam'&&p.deep?.vsOpp?.[key]!=null)bases.push({v:+p.deep.vsOpp[key],tag:`vs ${p.deep.oppTag}`});
      else if(cond.scope==='month'&&p.deep?.month?.[key]!=null)bases.push({v:+p.deep.month[key],tag:p.deep.monthTag});
      else if(cond.scope==='dow'&&p.deep?.dow?.[key]!=null)bases.push({v:+p.deep.dow[key],tag:p.deep.dowTag});
      bases.forEach(b=>{
        for(let k=1;k<=offMax;k++)out.push({n:b.v+k,label:`${b.tag} ${S} ${b.v}+${k}`});
      });
    });
  }else if(kind==='teamGame'){
    if(ctx.h2hGameNo)out.push({n:ctx.h2hGameNo,label:`H2H meeting #${ctx.h2hGameNo}`});
  }else if(kind==='seasonGame'){
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
  }else if(kind==='oppCenterClock'){
    (ctx.oppCenterClock||[]).forEach(x=>out.push({n:x.n,label:x.label}));
  }else if(kind==='nameCipher'){
    /* the player's own name (full/first/last) through one chosen cipher — a
       single number, comparable against any source (custom #, DN spine, phrase…).
       e.g. "full name Ord = 139" is [nameCipher full Ord] = [customNumber 139]. */
    const p=ctx.batter.p;
    const parts=(p.fullName||'').trim().split(/\s+/);
    const first=p.firstName||parts[0]||'';
    const last=p.lastName||parts.slice(1).join(' ')||'';
    const part=cond.counterArg?.part||'full';
    const cipher=cond.counterArg?.cipher||'Ord';
    const str=part==='first'?first:part==='last'?last:(p.fullName||'');
    const n=calcAll(str)[cipher];
    if(n>0)out.push({n,label:`${part} name ${cipher} ${n} (${str})`});
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
    /* an arbitrary number Tony types — the leg fires when any counter value
       (stat rung, cipher, day-of-life/career figure, clock…) equals it. */
    const n=+cond.sourceArg;
    return Number.isFinite(n)&&n>0?[{n,label:`#${n} (typed)`}]:[];
  }
  if(src==='numberWord'||src==='counterRef'){
    /* counter reference on the source side (PATTERN-RECIPES §2/§8): resolve the
       referenced counter, then either SPELL each candidate and run the ciphers
       (numberWord — the Zach convention, next-PTS 8 → "EIGHT" → 31 Red) or pass
       the raw values through (counterRef — counter-vs-counter links). rmod
       applies after, so 'comp# of other counter' works. */
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
    /* WNBA token names; the {batter…}/{opp pitcher}/{stadium} aliases keep
       templates saved before the rename resolving (cvg.templates persists). */
    const ent={
      '{player full}':ctx.batter.p.fullName,'{batter full}':ctx.batter.p.fullName,
      '{player last}':ctx.batter.p.lastName,'{batter last}':ctx.batter.p.lastName,
      '{player first}':ctx.batter.p.fullName.split(' ')[0],'{batter first}':ctx.batter.p.fullName.split(' ')[0],
      '{opp center}':ctx.oppPitcherName,'{opp pitcher}':ctx.oppPitcherName,
      '{team}':ctx.teamName,'{opp team}':ctx.oppTeamName,
      '{arena}':ctx.stadium,'{stadium}':ctx.stadium,
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
  /* operator toggles how the hard legs combine: AND (default) needs every
     hard leg; OR needs any one. Soft conditions never block. */
  const match=hard.length>0&&(pattern.operator==='OR'?hardPass>=1:hardPass===hard.length);
  return{match,hardPass,hardTotal:hard.length,softPass,softTotal:soft.length,details};
}

/* seed patterns — WNBA First-Basket flavored (§2) */
export const SEED_PATTERNS=[
  /* the flagship: career FG+1 = core, with season FG+1 = arena as the upgrade —
     the "cFG+1 / arena check runs first" card rule in pattern form */
  {id:'seed-fb-convergence',name:'FB Convergence',lane:'FB',enabled:true,seed:true,conditions:[
    {counter:'rung:FG',counterArg:{off:1},scope:'career',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true},
    {counter:'rung:FG',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'stadium',sourceArg:'',hard:false},
  ]},
  /* column-specific team lock: stat+1 landing on OWN team name */
  {id:'seed-team-lock',name:'TEAM LOCK',lane:'FB',enabled:true,seed:true,conditions:[
    {counter:'rung:*',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'team',sourceArg:'',hard:true},
  ]},
  {id:'seed-name-lock',name:'NAME LOCK',lane:'FB',enabled:true,seed:true,conditions:[
    {counter:'rung:*',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'ownName',sourceArg:'',hard:true},
  ]},
  {id:'seed-double-core-chain',name:'Double-Core-Chain',lane:'PTS',enabled:true,seed:true,autoPromote:true,conditions:[
    {counter:'rung:*',counterArg:{off:1},scope:'season',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true},
    {counter:'rung:*',counterArg:{off:1},scope:'season',lmod:'primeIdx',rmod:'',source:'core',sourceArg:'',hard:true},
  ]},
  {id:'seed-pra-landing',name:'PRA Landing',lane:'PRA',enabled:false,seed:true,conditions:[
    {counter:'rung:PRA',counterArg:{off:5},scope:'season',lmod:'',rmod:'',source:'core',sourceArg:'',hard:true},
  ]},
  /* Worked example of the recipe vocabulary, shipped DISABLED as living
     documentation: open it in the editor to see numberWord / dateFig /
     oppCenterClock in play. Structure mirrors the MLB "MILESTONE SPELL":
     the milestone (career FG+1 on the opponent) plus the spelled next-basket
     landing on an arena/date figure and the opposing center's birthday clock. */
  {id:'seed-milestone-spell',name:'MILESTONE SPELL (ex.)',lane:'FB',enabled:false,seed:true,
   example:'Illustrative recipe — career FG+1 on the opponent, the spelled season-FG-next run through the ciphers landing on the arena, plus a date figure and the opposing center’s birthday clock. Open in the editor to see numberWord / dateFig / oppCenterClock in use.',
   conditions:[
    {counter:'rung:FG',counterArg:{off:1},scope:'career',lmod:'',rmod:'',source:'oppTeam',sourceArg:'',hard:true},
    {counter:'rung:FG',counterArg:{off:1},scope:'venue',lmod:'',rmod:'',source:'numberWord',sourceArg:{counter:'rung:FG',scope:'season',off:1},hard:true},
    {counter:'dateFig',scope:'season',lmod:'',rmod:'',source:'oppTeam',sourceArg:'',hard:false},
    {counter:'oppCenterClock',scope:'season',lmod:'',rmod:'',source:'numberWord',sourceArg:{counter:'rung:PTS',scope:'season',off:1},hard:false},
  ]},
];

/* ---- plain-English pattern summaries (Patterns-tab readability) ----
   Generated from the condition structure — never hand-written metadata,
   so they can't rot when a condition is edited and they cover
   user-created patterns too. */
const counterPhrase=(counter,scope,off,arg)=>{
  const [kind,stat]=counter.split(':');
  const win=off>1?` (within +${off})`:'';
  if(kind==='rung')return stat==='*'?`any next stat milestone${win}`
    :`the next ${scope||'season'} ${stat==='GP'?'games-played count':stat}${win}`;
  if(kind==='nameCipher')return`the player's ${arg?.part||'full'} name in the ${arg?.cipher||'Ord'} cipher`;
  if(kind==='teamGame')return'the franchise H2H game number';
  if(kind==='seasonGame')return "the team's season game number";
  if(kind==='stair')return`the team's next ${stat} landings`;
  if(kind==='doy')return'the day of year';
  if(kind==='dateFig')return'a date figure (5 formulas + DOY + days left)';
  if(kind==='dn')return'any wide date-numerology value';
  if(kind==='dow')return "the day-of-week's gematria";
  if(kind==='age')return 'a player birthday/age figure';
  if(kind==='oppCenterClock')return "the opposing center's birthday clock";
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
    case'ownName':return "the player's own name gematria";
    case'template':return a?'a phrase-template value':'a phrase-template value (template not picked yet)';
    case'oppPitcher':return "the opposing center's name gematria";
    case'oppTeam':return "the opponent's name gematria";
    case'team':return'the own-team name gematria';
    case'stadium':return'the arena gematria';
    case'word':return typeof a==='string'&&a?`"${a}" gematria`:'a free word (not set)';
    case'customNumber':return a!==''&&a!=null?`the number ${a}`:'a custom number (not set)';
    case'loaded':return'any loaded value';
    case'numberWord':return a?.counter
      ?`the spelled-out word for ${counterPhrase(a.counter,a.scope,a.off||1,a)}, run through the ciphers`
      :'a spelled counter (not set)';
    case'counterRef':return a?.counter
      ?counterPhrase(a.counter,a.scope,a.off||1,a)
      :'another counter (not set)';
    case'jersey':return "the player's jersey number";
    default:return c.source;
  }
};
export const describeCondition=c=>{
  if(c.counter==='jesuit')return'the player is Jesuit-educated (AJCU school)';
  const chain=c.lmod==='chain'||c.rmod==='chain';
  const left=modWrap(counterPhrase(c.counter,c.scope,c.counterArg?.off||1,c.counterArg),c.lmod);
  const right=modWrap(sourcePhrase(c),c.rmod);
  return`${left} ${chain?'chains (9s) with':'lands on'} ${right}`;
};
export const describePattern=p=>{
  const hard=p.conditions.filter(c=>c.hard),soft=p.conditions.filter(c=>!c.hard);
  const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  const join=p.operator==='OR'?', OR ':', AND ';
  const head=hard.length?`Flags players where ${hard.map(describeCondition).join(join)}`
    :'No hard conditions — never matches on its own';
  const tail=soft.length?` Bonus signals: ${soft.map(describeCondition).join('; ')}.`:'';
  return cap(head)+'.'+tail;
};
/* card-level warnings, derived (not stored). WNBA's only deep-backed scope
   is vsTeam (this season's meetings from the ⚡ fetch). */
const DEEP_SCOPES=new Set(['vsTeam']);
export const patternNeedsDeep=p=>p.conditions.some(c=>
  DEEP_SCOPES.has(c.scope)
  ||((c.source==='numberWord'||c.source==='counterRef')&&DEEP_SCOPES.has(c.sourceArg?.scope)));
export const patternMissingTemplate=p=>p.conditions.some(c=>c.source==='template'&&!c.sourceArg);

export const summarizeCondition=c=>{
  if(c.counter==='jesuit')return`Jesuit educated (${c.hard?'hard':'soft'})`;
  if(c.counter==='nameCipher'){
    const src=SOURCES.find(s=>s.id===c.source)?.label||c.source;
    const rm=c.rmod?MODS.find(m=>m.id===c.rmod).label+' ':'';
    const arg=c.source==='customNumber'&&c.sourceArg!==''&&c.sourceArg!=null?` ${c.sourceArg}`
      :typeof c.sourceArg==='string'&&c.sourceArg?` "${c.sourceArg}"`:'';
    return`nameCipher(${c.counterArg?.part||'full'}, ${c.counterArg?.cipher||'Ord'}) = ${rm}${src}${arg} (${c.hard?'hard':'soft'})`;
  }
  const cnt=COUNTERS.find(x=>x.id===c.counter)?.label||c.counter;
  const off=c.counterArg?.off>1?`+1..${c.counterArg.off}`:'+1';
  const lm=c.lmod?MODS.find(m=>m.id===c.lmod).label+' ':'';
  const rm=c.rmod?MODS.find(m=>m.id===c.rmod).label+' ':'';
  const src=SOURCES.find(s=>s.id===c.source)?.label||c.source;
  const arg=(c.source==='numberWord'||c.source==='counterRef')&&c.sourceArg?.counter
    ?` [${c.source==='numberWord'?'spell ':''}${COUNTERS.find(x=>x.id===c.sourceArg.counter)?.label||c.sourceArg.counter} · ${c.sourceArg.scope||'season'}]`
    :c.source==='customNumber'&&c.sourceArg!==''&&c.sourceArg!=null?` ${c.sourceArg}`
    :typeof c.sourceArg==='string'&&c.sourceArg?` "${c.sourceArg}"`:'';
  const rung=c.counter.startsWith('rung');
  return`${lm}${cnt}${rung?` ${off} (${c.scope})`:''} = ${rm}${src}${arg} (${c.hard?'hard':'soft'})`;
};

/* ================================================================
   patterns — condition grammar engine (LAYOUT-SPEC §5). Pure.
   A pattern = name + ordered conditions ANDed. Each condition:
     [counter scope lmod?] = [rmod? source]   (hard | soft)
   Soft conditions never block a match; they upgrade it.
================================================================ */
import {calcAll,ALL_CIPHERS} from './gematria.js';
import {primeIndex,compositeIndex,chainBase,numberToWords} from './numbers.js';

export const COUNTERS=[
  {id:'rung:HR',label:'HR rung'},{id:'rung:TB',label:'TB rung'},{id:'rung:SO',label:'K rung'},
  {id:'rung:H',label:'H rung'},{id:'rung:1B',label:'1B rung'},{id:'rung:XBH',label:'XBH rung'},
  {id:'rung:RBI',label:'RBI rung'},{id:'rung:BB',label:'BB rung'},{id:'rung:2B',label:'2B rung'},
  {id:'rung:3B',label:'3B rung'},{id:'rung:AB',label:'AB rung'},{id:'rung:PA',label:'PA rung'},
  {id:'rung:*',label:'any stat rung'},
  {id:'teamGame',label:'team game #'},{id:'seasonGame',label:'season game #'},
  {id:'stair:R',label:'team next R'},{id:'stair:AB',label:'team next AB'},
  {id:'stair:PA',label:'team next PA'},{id:'stair:TB',label:'team next TB'},
  {id:'doy',label:'DOY'},{id:'dn',label:'date numerology'},{id:'dow',label:'day-of-week value'},
  {id:'age',label:'batter age figures'},
];
export const SCOPES=['season','career','vsTeam','vsDivision','vsLeague','venue','month','dow'];
export const MODS=[{id:'',label:'—'},{id:'primeIdx',label:'prime # of'},{id:'compIdx',label:'composite # of'},{id:'chain',label:'chain-to'}];
export const SOURCES=[
  {id:'core',label:'core table'},{id:'dateThread',label:'date/thread numbers'},
  {id:'theme',label:'theme figure'},{id:'ownName',label:'own name'},
  {id:'template',label:'phrase template'},{id:'oppPitcher',label:'opp pitcher name'},
  {id:'oppTeam',label:'opponent team'},{id:'team',label:'team'},{id:'stadium',label:'stadium'},
  {id:'word',label:'free word'},{id:'loaded',label:'any loaded value'},
  {id:'numberWord',label:'spelled counter'},
];

const STAT_KEY={HR:'homeRuns',TB:'totalBases',SO:'strikeOuts',H:'hits','1B':'1B',XBH:'XBH',
  RBI:'rbi',BB:'baseOnBalls','2B':'doubles','3B':'triples',AB:'atBats',PA:'plateAppearances'};
export const DATE_COUNTERS=new Set(['doy','dn','dow','teamGame','seasonGame','age']);

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
        const s=p.split?.[`season-${ctx.batter.side}`],c=p.split?.[`career-${ctx.batter.side}`];
        if(s?.[key]!=null)bases.push({v:+s[key],tag:`season·${ctx.batter.side}`});
        if(c?.[key]!=null)bases.push({v:+c[key],tag:`career·${ctx.batter.side}`});
      }else if(cond.scope==='vsTeam'&&p.deep?.vsOpp?.[key]!=null)bases.push({v:+p.deep.vsOpp[key],tag:`vs ${p.deep.oppTag}`});
      else if(cond.scope==='vsLeague'){
        if(p.deep?.leagueCareer?.[key]!=null)bases.push({v:+p.deep.leagueCareer[key],tag:`career vs ${p.deep.leagueTag}`});
        if(p.deep?.leagueSeason?.[key]!=null)bases.push({v:+p.deep.leagueSeason[key],tag:`season vs ${p.deep.leagueTag}`});
      }else if(cond.scope==='month'&&p.deep?.month?.[key]!=null)bases.push({v:+p.deep.month[key],tag:p.deep.monthTag});
      else if(cond.scope==='dow'&&p.deep?.dow?.[key]!=null)bases.push({v:+p.deep.dow[key],tag:p.deep.dowTag});
      else if(!cond.scope||cond.scope==='season'){/* handled above */}
      bases.forEach(b=>{
        for(let k=1;k<=offMax;k++)out.push({n:b.v+k,label:`${b.tag} ${S} ${b.v}+${k}`});
      });
    });
  }else if(kind==='teamGame'||kind==='seasonGame'){
    if(ctx.gameNumber)out.push({n:ctx.gameNumber,label:`game #${ctx.gameNumber}`});
  }else if(kind==='stair'){
    const base=ctx.teamStats?.[stat];
    if(base!=null)for(let k=1;k<=10;k++)out.push({n:base+k,label:`team ${stat} ${base}+${k}`});
  }else if(kind==='doy'){
    out.push({n:ctx.dn.doy,label:`DOY ${ctx.dn.doy}`});
  }else if(kind==='dn'){
    Object.entries(ctx.dn.vals).forEach(([n,l])=>out.push({n:+n,label:l}));
  }else if(kind==='dow'){
    enabledVals(ctx.dn.dayName,ctx.ciphers).forEach(x=>out.push(x));
  }else if(kind==='age'){
    (ctx.batter.ageFigures||[]).forEach(x=>out.push({n:x.n,label:x.label}));
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
  if(src==='numberWord'){
    /* counter reference on the source side (PATTERN-RECIPES §2): resolve the
       referenced counter, SPELL each candidate value, run the ciphers. The
       Zach convention — season HR next 8 → "EIGHT" → 31 Red. */
    const a=cond.sourceArg&&typeof cond.sourceArg==='object'?cond.sourceArg:null;
    if(!a?.counter)return[];
    const ref=resolveCounter({counter:a.counter,scope:a.scope||'season',counterArg:{off:a.off||1}},ctx);
    return ref.flatMap(x=>{
      const w=numberToWords(x.n);
      return w?enabledVals(w,ctx.ciphers).map(v=>({n:v.n,label:`${v.label} ${v.n} (${x.label})`})):[];
    });
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
  /* soft conditions don't block (§5) */
  const match=hard.length>0&&hardPass===hard.length;
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
];

export const summarizeCondition=c=>{
  const cnt=COUNTERS.find(x=>x.id===c.counter)?.label||c.counter;
  const off=c.counterArg?.off>1?`+1..${c.counterArg.off}`:'+1';
  const lm=c.lmod?MODS.find(m=>m.id===c.lmod).label+' ':'';
  const rm=c.rmod?MODS.find(m=>m.id===c.rmod).label+' ':'';
  const src=SOURCES.find(s=>s.id===c.source)?.label||c.source;
  const arg=c.source==='numberWord'&&c.sourceArg?.counter
    ?` [spell ${COUNTERS.find(x=>x.id===c.sourceArg.counter)?.label||c.sourceArg.counter} · ${c.sourceArg.scope||'season'}]`
    :typeof c.sourceArg==='string'&&c.sourceArg?` "${c.sourceArg}"`:'';
  const rung=c.counter.startsWith('rung');
  return`${lm}${cnt}${rung?` ${off} (${c.scope})`:''} = ${rm}${src}${arg} (${c.hard?'hard':'soft'})`;
};

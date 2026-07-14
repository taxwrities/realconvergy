/* ================================================================
   patterns — condition grammar engine, WNBA counters (spec §2/§5).
   Grammar identical to apps/mlb (shared-code item); only the counter
   set, stat keys, scopes, and seed patterns differ.
     [counter scope lmod?] = [rmod? source]   (hard | soft)
================================================================ */
import {calcAll,ALL_CIPHERS} from './gematria.js';
import {primeIndex,compositeIndex,chainBase} from './numbers.js';

export const COUNTERS=[
  {id:'rung:FG',label:'FG rung'},{id:'rung:PTS',label:'PTS rung'},
  {id:'rung:REB',label:'REB rung'},{id:'rung:AST',label:'AST rung'},
  {id:'rung:3PM',label:'3PM rung'},{id:'rung:FT',label:'FT rung'},
  {id:'rung:PRA',label:'PRA rung'},{id:'rung:GP',label:'GP rung'},
  {id:'rung:*',label:'any stat rung'},
  {id:'teamGame',label:'franchise H2H game #'},{id:'seasonGame',label:'season game #'},
  {id:'stair:PTS',label:'team next PTS'},{id:'stair:FG',label:'team next FG'},
  {id:'stair:REB',label:'team next REB'},{id:'stair:AST',label:'team next AST'},
  {id:'doy',label:'DOY'},{id:'dn',label:'date numerology'},{id:'dow',label:'day-of-week value'},
  {id:'age',label:'player age figures'},
];
/* vsTeam resolves from the ⚡ deep fetch (this season's meetings);
   career-vs-team is not resolvable from BDL — scope reports no-data. */
export const SCOPES=['season','career','vsTeam','venue','month','dow'];
export const MODS=[{id:'',label:'—'},{id:'primeIdx',label:'prime # of'},{id:'compIdx',label:'composite # of'},{id:'chain',label:'chain-to'}];
export const SOURCES=[
  {id:'core',label:'core table'},{id:'dateThread',label:'date/thread numbers'},
  {id:'theme',label:'theme figure'},{id:'ownName',label:'own name'},
  {id:'template',label:'phrase template'},{id:'oppPitcher',label:'opposing center name'},
  {id:'oppTeam',label:'opponent team'},{id:'team',label:'team'},{id:'stadium',label:'arena'},
  {id:'word',label:'free word'},{id:'loaded',label:'any loaded value'},
];

const STAT_KEY={FG:'FG',PTS:'PTS',REB:'REB',AST:'AST','3PM':'3PM',FT:'FT',PRA:'PRA',GP:'GP'};
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
  if(src==='oppTeam')return enabledVals(ctx.oppTeamName||'',ctx.ciphers);
  if(src==='team')return enabledVals(ctx.teamName||'',ctx.ciphers);
  if(src==='stadium')return enabledVals(ctx.stadium||'',ctx.ciphers);
  if(src==='word')return cond.sourceArg?enabledVals(cond.sourceArg,ctx.ciphers):[];
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
  const match=hard.length>0&&hardPass===hard.length;
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
];

export const summarizeCondition=c=>{
  const cnt=COUNTERS.find(x=>x.id===c.counter)?.label||c.counter;
  const off=c.counterArg?.off>1?`+1..${c.counterArg.off}`:'+1';
  const lm=c.lmod?MODS.find(m=>m.id===c.lmod).label+' ':'';
  const rm=c.rmod?MODS.find(m=>m.id===c.rmod).label+' ':'';
  const src=SOURCES.find(s=>s.id===c.source)?.label||c.source;
  const arg=c.sourceArg?` "${c.sourceArg}"`:'';
  const rung=c.counter.startsWith('rung');
  return`${lm}${cnt}${rung?` ${off} (${c.scope})`:''} = ${rm}${src}${arg} (${c.hard?'hard':'soft'})`;
};

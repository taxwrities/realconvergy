/* ================================================================
   founders — auxiliary founding-date convergence layer.

   Reads ONLY data/decoder-exports/founders-locked.json — the locked,
   sourced, pre-filtered dataset the founders-historian harvest emits
   (date_status==="locked" + source URL, each tagged day|year). Never
   reads data/founders.json or any live/unverified source.

   Spec: specs/founders-historian.md. This layer is NARRATIVE ONLY —
   same status as the Satanic cipher ruling. It never gates the skip
   logic, scoring, patterns, cascade, or glow. Purely additive.

   Every computed span is checked against 322 (Skull & Bones anchor,
   the most-used ritual) and carries a prime-index cross-ref in the
   same tier as the store's existing prime/composite bridges.
================================================================ */
import LOCKED from '../../../../data/decoder-exports/founders-locked.json';
import {clockFrom} from './clocks.js';
import {isPrime,primeIndex,nthPrime} from './numbers.js';

export const FOUNDERS=LOCKED;

/* Skull & Bones anchor — always checked against every computed span. */
export const ANCHOR_322=322;

/* MLB scope (spec Scope Guardrails): mlb_teams + the shared ritual /
   institutional / founder / geographic layers. wnba_teams is intentionally
   excluded — never cross sport team tables. */
export const MLB_FOUNDER_CATEGORIES=[
  'mlb_teams','rituals','secret_societies','institutional',
  'sports_founders','tribute_figures','states',
];

/* normalize an entity / team name for matching: strip accents + punctuation,
   lowercase, collapse whitespace (same spirit as jesuit.normSchool). */
export function normName(s){
  return (s||'')
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase()
    .replace(/[.'’`]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

/* span figures for a founding date. Day-granularity (YYYY-MM-DD) gets the
   full leap-aware clock (totalDays / since-anniv / until-anniv / years).
   Year-granularity (YYYY) yields years only — day spans stay null, honoring
   the harvest rule that year entries are excluded from day-span probes. */
export function foundingSpan(record,today){
  if(!record||!record.founded)return null;
  const gran=record.granularity||
    (/^\d{4}-\d{2}-\d{2}$/.test(record.founded)?'day':'year');
  if(gran==='day'){
    const c=clockFrom(record.founded,today);
    if(!c)return null;
    return{granularity:'day',totalDays:c.totalDays,since:c.since,until:c.until,years:c.years};
  }
  const oy=parseInt(String(record.founded).slice(0,4),10);
  const ty=parseInt(String(today).slice(0,4),10);
  if(!Number.isFinite(oy)||!Number.isFinite(ty)||ty<oy)return null;
  return{granularity:'year',totalDays:null,since:null,until:null,years:ty-oy};
}

/* prime-index cross-ref for a single number — same tier as the store's
   existing prime/composite bridges: prime → its prime index; composite →
   nthPrime(n) (the number read as an index). */
export function founderCrossRef(n){
  if(!(n>0))return null;
  return isPrime(n)
    ?{n,prime:true,primeIndex:primeIndex(n)}
    :{n,prime:false,nthPrime:nthPrime(n)};
}

/* the span readings tested for convergence, with human labels. */
const SPAN_FIELDS=[
  {key:'totalDays',label:'days since founding'},
  {key:'since',    label:'days since anniversary'},
  {key:'until',    label:'days until anniversary'},
  {key:'years',    label:'years since founding'},
];

/* founderConvergences — decorate one locked record for `today`.
   activeSet: a Set<number> of the day's live numbers (date-numerology
   figures + the store's loaded active-set + 322). Returns:
     {record, span, hits322, hits:[...]}
   hits322 flags any computed value (or its prime-index bridge) landing on
   322 exactly. Each hit is {field,label,n,on,kind,xref} where kind is
   'direct' (n itself is live), 'anchor322' (n===322), or 'bridge' (the
   prime-index cross-ref of n is live / 322). Never mutates the record. */
export function founderConvergences(record,today,activeSet){
  const span=foundingSpan(record,today);
  if(!span)return{record,span:null,hits322:false,hits:[]};
  const has=n=>activeSet instanceof Set&&activeSet.has(n);
  const hits=[];
  let hits322=false;
  SPAN_FIELDS.forEach(({key,label})=>{
    const n=span[key];
    if(!(n>0))return;
    const xref=founderCrossRef(n);
    if(n===ANCHOR_322){hits322=true;hits.push({field:key,label,n,on:ANCHOR_322,kind:'anchor322',xref});}
    else if(has(n))hits.push({field:key,label,n,on:n,kind:'direct',xref});
    /* prime-index bridge: prime → primeIndex, composite → nthPrime(n) */
    const bridge=xref?(xref.prime?xref.primeIndex:xref.nthPrime):0;
    if(bridge>0){
      if(bridge===ANCHOR_322){hits322=true;hits.push({field:key,label,n,on:bridge,kind:'bridge',xref});}
      else if(has(bridge))hits.push({field:key,label,n,on:bridge,kind:'bridge',xref});
    }
  });
  return{record,span,hits322,hits};
}

/* founderHitLines — human-readable pieces for ONE decorated hit, shared by the
   Board badge popover and the full-sheet FOUNDER section so both read identically.
   Expects the store to have attached `where` (the resolved target: DN spine row /
   loaded active number / 322 anchor — see store.founderHits). Returns:
     {value, where, calc, xref}
   value  — the span reading  ("33 years since founding")
   where  — where it landed    ("33 matches DN Row 3" | "prime(33) = 137 matches …")
   calc   — the target's spine formula, when the target is a DN row (else null)
   xref   — the prime-index cross-ref line ("33 = composite · prime(33) = 137"). */
export function founderHitLines(hit){
  if(!hit)return null;
  const {n,label,kind,on,xref,where}=hit;
  const value=`${n.toLocaleString()} ${label}`;
  const tgt=where?.label||`active number ${on}`;
  let whereText,calc=null;
  if(kind==='anchor322'){
    whereText=`${n} = 322 · Skull & Bones anchor`;
  }else if(kind==='bridge'){
    const bridge=xref?(xref.prime?xref.primeIndex:xref.nthPrime):on;
    whereText=(xref&&xref.prime)
      ?`prime #${bridge} matches ${tgt}`
      :`prime(${n}) = ${bridge} matches ${tgt}`;
    calc=where?.calc||null;
  }else{
    whereText=`${on} matches ${tgt}`;
    calc=where?.calc||null;
  }
  const xrefLine=xref
    ?(xref.prime
      ?`${n} = prime · position #${xref.primeIndex}`
      :`${n} = composite · prime(${n}) = ${xref.nthPrime}`)
    :null;
  return{value,where:whereText,calc,xref:xrefLine};
}

/* find the mlb_teams founder record whose name matches a full team name
   (e.g. game.home.name === "Arizona Diamondbacks"). null when absent. */
export function findTeamFounder(teamFullName){
  const key=normName(teamFullName);
  if(!key)return null;
  return(LOCKED.mlb_teams||[]).find(t=>normName(t.name)===key)||null;
}

/* Board-badge feed: the batter's team founding convergences for the day.
   Returns the decorated record when the team is in the locked set AND has at
   least one convergence (direct / bridge / 322); otherwise null. Auxiliary —
   never gates anything. */
export function teamFounderHits(teamFullName,today,activeSet){
  const rec=findTeamFounder(teamFullName);
  if(!rec)return null;
  const res=founderConvergences(rec,today,activeSet);
  return(res.hits.length||res.hits322)?res:null;
}

/* full MLB-scope probe: every in-scope locked entity decorated with its
   convergences for `today`. Exposed for the decoder feed / inspection; the
   Board badge itself uses teamFounderHits only. */
export function probeFounders(today,activeSet){
  const out=[];
  MLB_FOUNDER_CATEGORIES.forEach(cat=>{
    (LOCKED[cat]||[]).forEach(rec=>{
      out.push({category:cat,...founderConvergences(rec,today,activeSet)});
    });
  });
  return out;
}

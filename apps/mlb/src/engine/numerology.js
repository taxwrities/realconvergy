/* ================================================================
   numerology — player / stat-rung / opponent cross-refs (Tony 2026-07-22).
   Shared by the Phrase Variation Finder result rows and the full-sheet
   card's WHY panel: given a player (life-clock + jersey), their tracked
   counting stats, their opponent team, and a target number, report every
   number that already lines up with that target. A raw equality is the
   strong signal; a shared digit-root is the softer bonus signal.

   crossRefsForNumber() is the single entry point both surfaces call so the
   two stay identical. Three convergence families, mirroring Tony's example
   (opp Rays = 79, Springer HR = 79, his next career HR is his 79th):
     • PLAYER — life-clock readings + jersey  (playerNumerologyMatches)
     • RUNGS  — next milestones per career/season stat (statRungMatches)
     • OPP    — opponent-team gematria         (opponentMatches)
================================================================ */

import {STATS} from '../data/defaults.js';

/* single-digit reduction: sum digits until <=9. 0 (or non-positive) → 0. */
export const digitRoot=n=>{n=Math.abs(Math.floor(+n||0));return n>0?1+((n-1)%9):0;};

/* dateRootSet(vals) — the day's date-root set (Tony 2026-07-23). Pass the five
   date-numerology values (dateFigures(date).slice(0,5).map(f=>f.n)): M+DD+YY+cent,
   M+DD+digitsum(YYYY), digitsum(M)+digitsum(DD)+digitsum(YYYY), M+DD+YY,
   digitsum(M)+digitsum(DD)+digitsum(YY). Returns the Set of their digit roots.
   A digit-root SOFT match only fires when the shared root is a member of this
   set — restricting the soft-glow net to roots the day itself is emphasizing.
   (e.g. 2026-07-23 → values 76,40,22,56,20 → roots {4,4,4,2,2} → set {2,4}.) */
export const dateRootSet=vals=>new Set((vals||[]).map(digitRoot).filter(r=>r>0));

/* softHit(dr, targetDr, dateRoots) — the gated soft-match test shared by every
   matcher below. Both sides must reduce to the same root AND (when a dateRoots
   Set is supplied) that root must be date-relevant. No Set → permissive
   fallback (old behavior) so callers that don't yet thread the day's roots keep
   working. */
const softHit=(dr,targetDr,dateRoots)=>
  dr===targetDr&&(!(dateRoots instanceof Set)||dateRoots.has(targetDr));

/* the five player readings we cross-reference, in display order. Pass a
   flat fields object: {totalDays, since, until, years, jersey}. */
const XKEYS=[
  ['day of life','totalDays'],
  ['days after bday','since'],
  ['days until bday','until'],
  ['age','years'],
  ['jersey #','jersey'],
];

/* playerNumerologyMatches(fields, target, dateRoots)
   fields: {totalDays, since, until, years, jersey} — any may be null/absent.
   target: the hit's target number (or a spotlighted number).
   dateRoots: today's date-root Set (from dateRootSet) gating soft matches.
   Returns {targetDr, items:[{key,value,dr,rawMatch,softMatch}], any}.
   • rawMatch  — value === target        (strong / gold)
   • softMatch — digitRoot(value) === digitRoot(target) === a day date-root, and
                 not a rawMatch                        (soft / dim gold bonus). */
export function playerNumerologyMatches(fields,target,dateRoots){
  const t=Math.floor(+target||0);
  const targetDr=digitRoot(t);
  const items=[];
  XKEYS.forEach(([key,field])=>{
    const value=fields?.[field];
    if(value==null||!(value>0))return;
    const dr=digitRoot(value);
    const rawMatch=t>0&&value===t;
    const softMatch=t>0&&!rawMatch&&softHit(dr,targetDr,dateRoots);
    items.push({key,value,dr,rawMatch,softMatch});
  });
  return{targetDr,items,any:items.some(i=>i.rawMatch||i.softMatch)};
}

/* statRungMatches(stats, target, N)
   stats: {career, season} — each a stat object keyed the way the app
   ingests it (or null). Reuses the app's STATS config so the tracked set
   is exactly what the rung ladder + pattern engine use (MLB: HR/H/1B/…;
   WNBA: PTS/REB/AST/…). For each stat the next N milestones are
   current+1 … current+N; the NEAREST one that hits the target (raw) or
   its digit-root (soft) is reported. N kept small (default 10) so the
   block stays compact. This closes Tony's "next career HR is his 79th"
   loop when the opponent / phrase also lands on 79.
   dateRoots: today's date-root Set (from dateRootSet) gating soft matches.
   Returns {targetDr, items:[{scope,label,base,off,n,dr,rawMatch,softMatch}], any}. */
export function statRungMatches(stats,target,dateRoots,N=10){
  const t=Math.floor(+target||0);
  const targetDr=digitRoot(t);
  const items=[];
  if(t>0&&stats){
    [['career',stats.career],['season',stats.season]].forEach(([scope,src])=>{
      if(!src)return;
      STATS.forEach(([label,key])=>{
        const cur=src[key];
        if(cur==null||!(cur>=0))return;
        const base=Math.floor(+cur);
        for(let off=1;off<=N;off++){
          const n=base+off;
          const rawMatch=n===t;
          const softMatch=!rawMatch&&softHit(digitRoot(n),targetDr,dateRoots);
          if(rawMatch||softMatch){
            items.push({scope,label,base,off,n,dr:digitRoot(n),rawMatch,softMatch});
            break;   // nearest landing per stat/scope only
          }
        }
      });
    });
  }
  return{targetDr,items,any:items.length>0};
}

/* opponentMatches(oppVals, target)
   oppVals: precomputed opponent-team cipher values [{name,cipher,n}] —
   the team's nickname / city / full name run through the enabled ciphers
   (mirrors the player name-cipher grid), built in the store so this stays
   pure. Flags which land on the target (raw) or share its digit-root
   (soft); deduped to one row per name+value so a value hit by several
   ciphers shows once.
   dateRoots: today's date-root Set (from dateRootSet) gating soft matches.
   Returns {targetDr, items:[{name,cipher,value,dr,rawMatch,softMatch}], any}. */
export function opponentMatches(oppVals,target,dateRoots){
  const t=Math.floor(+target||0);
  const targetDr=digitRoot(t);
  const items=[];
  if(t>0&&Array.isArray(oppVals)){
    const seen=new Set();
    oppVals.forEach(({name,cipher,n})=>{
      if(!(n>0))return;
      const rawMatch=n===t;
      const softMatch=!rawMatch&&softHit(digitRoot(n),targetDr,dateRoots);
      if(!(rawMatch||softMatch))return;
      const k=`${name}|${n}`;
      if(seen.has(k))return;seen.add(k);
      items.push({name,cipher,value:n,dr:digitRoot(n),rawMatch,softMatch});
    });
  }
  return{targetDr,items,any:items.length>0};
}

/* crossRefsForNumber(inputs, target, dateRoots) — the one entry point both
   surfaces call so the Phrase Finder rows and the full-sheet WHY panel stay in
   sync.
   inputs: {pn, sr, opp}
     pn  — flat life-clock/jersey fields   → playerNumerologyMatches
     sr  — {career, season} stat objects   → statRungMatches
     opp — precomputed opponent [{name,cipher,n}] → opponentMatches
   dateRoots: today's date-root Set (dateRootSet) threaded to every matcher so a
   digit-root soft match only fires on a day-relevant root. Any input may be
   absent → that group comes back empty. */
export function crossRefsForNumber(inputs,target,dateRoots){
  const {pn,sr,opp}=inputs||{};
  return{
    numerology:playerNumerologyMatches(pn||{},target,dateRoots),
    statRungs:statRungMatches(sr,target,dateRoots),
    opponent:opponentMatches(opp,target,dateRoots),
  };
}

/* ---- display-string builders — kept beside the matchers so both surfaces
   render a cross-ref identically. Each takes an item + the target it
   landed on. ---- */
export const numerologyText=(it,target,targetDr)=>
  it.rawMatch
    ?`${it.key} ${it.value.toLocaleString()} = target ${target}`
    :`${it.key} dr ${it.dr} = target ${target} dr ${targetDr}`;

export const statRungText=it=>{
  const step=it.off===1?`next is ${it.n}`:`+${it.off} is ${it.n}`;
  const tail=it.rawMatch?`= target`:`= target dr ${it.dr}`;
  return `${it.scope} ${it.label} sits ${it.base.toLocaleString()} → ${step} ${tail}`;
};

export const opponentText=(it,target)=>
  it.rawMatch
    ?`facing ${it.name} (${it.value}) = target ${target}`
    :`facing ${it.name} (${it.value}) dr ${it.dr} = target dr ${digitRoot(target)}`;

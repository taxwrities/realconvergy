/* ================================================================
   numerology — player-numerology cross-refs (Tony 2026-07-22).
   Shared by the Phrase Variation Finder result rows and the full-sheet
   card's WHY panel: given a player's life-clock readings + jersey and a
   target number, report which of the player's own numbers line up with
   that target. A raw equality is the strong signal; a shared digit-root
   is the softer bonus signal.
================================================================ */

/* single-digit reduction: sum digits until <=9. 0 (or non-positive) → 0. */
export const digitRoot=n=>{n=Math.abs(Math.floor(+n||0));return n>0?1+((n-1)%9):0;};

/* the five player readings we cross-reference, in display order. Pass a
   flat fields object: {totalDays, since, until, years, jersey}. */
const XKEYS=[
  ['day of life','totalDays'],
  ['days after bday','since'],
  ['days until bday','until'],
  ['age','years'],
  ['jersey #','jersey'],
];

/* playerNumerologyMatches(fields, target)
   fields: {totalDays, since, until, years, jersey} — any may be null/absent.
   target: the hit's target number (or a spotlighted number).
   Returns {targetDr, items:[{key,value,dr,rawMatch,softMatch}], any}.
   • rawMatch  — value === target        (strong / gold)
   • softMatch — digitRoot(value) === digitRoot(target), and not a rawMatch
                 (soft / dim gold bonus). */
export function playerNumerologyMatches(fields,target){
  const t=Math.floor(+target||0);
  const targetDr=digitRoot(t);
  const items=[];
  XKEYS.forEach(([key,field])=>{
    const value=fields?.[field];
    if(value==null||!(value>0))return;
    const dr=digitRoot(value);
    const rawMatch=t>0&&value===t;
    const softMatch=t>0&&!rawMatch&&dr===targetDr;
    items.push({key,value,dr,rawMatch,softMatch});
  });
  return{targetDr,items,any:items.some(i=>i.rawMatch||i.softMatch)};
}

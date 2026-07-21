/* ================================================================
   rungs — box-score helpers + the "next rungs" ladder that powers
   the clickable-number popups (WNBA-REDESIGN-SPEC §2, Tony 2026-07).
   Pure + testable: no React, no fetch, no store coupling.
================================================================ */

/* 2-point makes = all FG makes minus 3-point makes. Nulls → 0. */
export const twoPM=(fgm,fg3m)=>(+fgm||0)-(+fg3m||0);

/* Institutional table — fixed convergence numbers checked in every popup
   (Tony's list). Kept alongside the app's live date/thread/theme spine, which
   flows through the loaded map; this is the always-on baseline set. */
export const INSTITUTIONAL_TABLE=[42,48,51,54,56,59,63,65,72,75,78,79,83,96,139,147];

/* rungOffsets(stat,value) → dense positive offsets 1..N to probe as value+N.
   Tony 2026-07 (no-skip): every integer offset in range, no gaps — the old
   [1..8,10,25,50,100,250] ladder jumped and hid landing spots. N scales with
   magnitude so a thousands-scale career total (PTS/MIN) reaches ~+250 while a
   tight lane (3PM/BLK/STL) stays short, but the sequence in between is solid.
   N = clamp(round(v·0.075), 10, 250); stat kept for signature compat. */
export function rungOffsets(stat,value){
  const v=Math.max(0,Math.floor(+value||0));
  const N=Math.min(250,Math.max(10,Math.round(v*0.075)));
  const offs=[];
  for(let k=1;k<=N;k++)offs.push(k);
  return offs;
}

/* classifyRungs — build the ladder and flag each rung against the loaded
   value map (date/thread/theme/core/h2h etc.) and the institutional table.
   `loaded` may be a Map (store) or a plain object keyed by number (tests). */
export function classifyRungs(stat,value,{loaded,thread=[]}={}){
  const get=n=>{
    if(!loaded)return[];
    if(typeof loaded.get==='function')return loaded.get(n)||[];
    return loaded[n]||[];
  };
  return rungOffsets(stat,value).map(off=>{
    const n=(+value||0)+off;
    const hits=get(n);
    const cats=new Set(hits.map(h=>h.cat));
    const institutional=INSTITUTIONAL_TABLE.includes(n);
    const isThread=cats.has('thread')||thread.includes(n);
    const isDate=cats.has('date');
    return{off,n,hits,cats:[...cats],institutional,isThread,isDate,
      hit:hits.length>0||institutional};
  });
}

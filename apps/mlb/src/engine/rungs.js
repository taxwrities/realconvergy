/* ================================================================
   rungs — box-score helpers + the "next rungs" ladder that powers
   the clickable-number popups (MLB parity of WNBA rungs, Tony 2026-07).
   Pure + testable: no React, no fetch, no store coupling.

   MLB divergence from WNBA: NO frozen INSTITUTIONAL_TABLE — a rung is
   institutional when it lands on an enabled Core-table word (cat:'core'
   in the loaded map), so the set stays editable in the Vocab tab.
================================================================ */

/* Derived counting stats, injected at ingest (mirrors WNBA's twoPM):
   1B = H − 2B − 3B − HR, XBH = 2B + 3B + HR. Mutates + returns the
   stat object; skips objects with no hits field (pitching lines). */
export function deriveStats(stat){
  if(!stat||stat.hits==null)return stat;
  const h=+stat.hits||0,d=+stat.doubles||0,t=+stat.triples||0,hr=+stat.homeRuns||0;
  stat['1B']=h-d-t-hr;
  stat.XBH=d+t+hr;
  return stat;
}

/* rungOffsets(stat,value) → dense positive offsets 1..N to probe as value+N.
   Tony 2026-07 (no-skip, mirrors WNBA): every integer offset in range, no
   gaps — the old [1..8,10,25,50,100,250] ladder jumped and hid landing spots.
   N scales with magnitude so a thousands-scale career total (H/TB/AB/PA)
   reaches ~+250 while a tight lane (HR/2B/3B) stays short, but the sequence
   in between is solid. N = clamp(round(v·0.075), 10, 250); stat kept for
   signature compat. */
export function rungOffsets(stat,value){
  const v=Math.max(0,Math.floor(+value||0));
  const N=Math.min(250,Math.max(10,Math.round(v*0.075)));
  const offs=[];
  for(let k=1;k<=N;k++)offs.push(k);
  return offs;
}

/* classifyRungs — build the ladder and flag each rung against the loaded
   value map (date/thread/theme/core/h2h etc.). Institutional = the rung
   hits an enabled core-vocab word (editable set, Tony decision #3).
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
    const institutional=cats.has('core');
    const isThread=cats.has('thread')||thread.includes(n);
    const isDate=cats.has('date');
    return{off,n,hits,cats:[...cats],institutional,isThread,isDate,
      hit:hits.length>0};
  });
}

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

/* Small counting lanes get the tight tick window regardless of size. */
const TIGHT_STATS=new Set(['HR','2B','3B','1B','XBH','CS','SB']);

/* rungOffsets(stat,value) → sorted positive offsets N to probe as value+N.
   Judgment per Tony (same shape as WNBA): single-tick stats get a tight
   +1..+8 window; thousands-scale career totals (H, TB, AB, PA, SO, RBI,
   BB) surface +25/50/100/250 instead of a wall of +1s. Small ticks are
   always kept — a large total can still land on a meaningful small step. */
export function rungOffsets(stat,value){
  const v=Math.max(0,Math.floor(+value||0));
  const offs=new Set();
  /* tight tick window — a touch wider for the small counting lanes */
  const tick=TIGHT_STATS.has(stat)?8:(v>=2000?5:8);
  for(let k=1;k<=tick;k++)offs.add(k);
  /* magnitude ladder — step size scales with the number */
  let steps=[];
  if(v>=8000)steps=[50,100,250,500];
  else if(v>=2000)steps=[25,50,100,250];
  else if(v>=800)steps=[10,25,50,100];
  else if(v>=300)steps=[10,15,20,25];
  else if(v>=80)steps=[10,15,20];
  steps.forEach(x=>offs.add(x));
  return[...offs].sort((a,b)=>a-b);
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

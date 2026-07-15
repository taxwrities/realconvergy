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

/* rungOffsets(stat,value) → sorted positive offsets N to probe as value+N.
   Judgment per Tony: single-tick stats (3s, 2s) get a tight +1..+8 window;
   bigger jumps get added by magnitude so thousands-scale totals (career MIN,
   PTS) surface +50/+100/+250/+500 instead of a wall of +1s. Small ticks are
   always kept — a large total can still land on a meaningful small step. */
export function rungOffsets(stat,value){
  const v=Math.max(0,Math.floor(+value||0));
  const offs=new Set();
  /* tight tick window — a touch wider for the small counting lanes */
  const tick=(stat==='3PM'||stat==='2PM')?8:(v>=2000?5:8);
  for(let k=1;k<=tick;k++)offs.add(k);
  /* PTS: Tony wants the bigger jumps surfaced regardless of magnitude */
  if(stat==='PTS')[10,25,30].forEach(x=>offs.add(x));
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

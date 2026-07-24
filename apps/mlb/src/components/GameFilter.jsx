import {useMemo} from 'react';

/* Game filter chip strip (Tony 2026-07-24) — sits above a search result surface
   and narrows the visible rows to a single game on the slate. Every result row
   already carries a `gameLabel` ("NYY @ BOS", the same abbreviation convention
   the game carousel uses), so the label doubles as the filter key. ALL (default)
   clears the filter; each game chip carries its own match count and is mutually
   exclusive with ALL and with the other game chips — clicking the active chip
   toggles back to ALL. A game with zero rows never gets a chip (0-hit games are
   hidden, not dimmed), and the whole strip hides when <2 games have rows: a
   single-game surface has nothing to narrow. */

/* group result rows by gameLabel, preserving first-appearance order — the store
   iterates games in slate/carousel order, so insertion order matches the rail. */
export function gameGroups(rows){
  const m=new Map();
  (rows||[]).forEach(r=>{
    const g=r?.gameLabel;
    if(!g)return;
    m.set(g,(m.get(g)||0)+1);
  });
  return[...m.entries()].map(([label,count])=>({label,count}));
}

/* apply the active filter to a row list — null passes everything through. */
export function filterByGame(rows,filter){
  if(!filter)return rows||[];
  return(rows||[]).filter(r=>r?.gameLabel===filter);
}

export default function GameFilterStrip({rows,value,onChange}){
  const groups=useMemo(()=>gameGroups(rows),[rows]);
  if(groups.length<2)return null; // nothing to narrow
  return(
    <div className="rail game-filter" role="tablist" aria-label="Filter results by game">
      <button className={`chip${value==null?' on':''}`} role="tab" aria-selected={value==null}
        onClick={()=>onChange(null)}>ALL</button>
      {groups.map(g=>(
        <button key={g.label} className={`chip${value===g.label?' on':''}`}
          role="tab" aria-selected={value===g.label}
          onClick={()=>onChange(value===g.label?null:g.label)}>
          {g.label}<span className="gf-count"> · {g.count}</span>
        </button>
      ))}
    </div>
  );
}

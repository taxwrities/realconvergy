/* ================================================================
   lineups — pure projected-roster → confirmed-lineup transition.
   Zero imports on purpose: data/mlb.js can't be loaded by the node
   test runner (extensionless JSON import), so the logic the tests
   must lock lives here and mlb.js/store/Board consume it.
================================================================ */

/* Per-side projected check with old-cache normalization: slates cached
   before per-side flags carry only the legacy game-level boolean. */
export const isProjected=(g,side)=>g.proj?!!g.proj[side]:!!g.projected;

/* applyLineups(games, rawSchedGames, people) — for each side still
   projected whose lineup has posted (≥9 players) and whose starters are
   all already hydrated (starters ⊂ active roster, barring same-day
   call-ups): replace the side's ids (batting order restored) and clear
   its flag. Unknown id → needsFull (caller does a full slate refresh).
   Mutates the game objects in place (house pattern — deepFetch does the
   same; caller re-renders via setSlate({...slate})). */
export function applyLineups(games,rawSchedGames,people){
  let changed=false,needsFull=false;
  const rawByPk=new Map((rawSchedGames||[]).map(r=>[r.gamePk,r]));
  for(const g of (games||[])){
    const raw=rawByPk.get(g.pk);
    if(!raw)continue;
    /* lazily migrate the legacy boolean — treating both sides of an old
       "projected" game as projected is self-healing: a side that was
       actually confirmed gets its identical lineup back and clears. */
    if(!g.proj)g.proj={home:!!g.projected,away:!!g.projected};
    for(const side of['home','away']){
      if(!isProjected(g,side))continue;
      const ids=(raw.lineups?.[side+'Players']||[]).map(x=>x.id);
      if(ids.length<9)continue;
      if(!ids.every(id=>people[id])){needsFull=true;continue}
      g[side+'Ids']=ids;
      g.proj[side]=false;
      changed=true;
    }
    g.projected=g.proj.home||g.proj.away;
  }
  return{changed,needsFull};
}

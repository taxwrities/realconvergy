/* ================================================================
   gamefilter — keep player-stat log rows bbref's "Regular Season"
   Totals tab would count. Verified vs basketball-reference career
   rows (Gabby Williams, Azura Stevens, 2026-07-15): BDL game logs
   additionally contain
     1. playoff games        → games endpoint rows carry postseason:true
     2. Commissioner's Cup FINALS (regular Cup games count; the final
        does not) → flagged postseason:false, only the date knows
     3. All-Star games       → synthetic teams (TEAM CLARK id 24 etc.)
   Filtering all three makes summed totals match bbref exactly.
   Pure module (no fetch/imports) so the test suite can lock it.
================================================================ */

/* Commissioner's Cup final dates (ET). Extend each season — the final is a
   single standalone game, so a date match is unambiguous. */
export const CUP_FINAL_DATES=new Set([
  '2021-08-12', // SEA 79-57 CON
  '2022-07-26', // LV 93-83 CHI
  '2023-08-15', // NY 82-63 LV
  '2024-06-25', // MIN 94-89 NY
  '2025-07-01', // IND 74-59 MIN
  '2026-06-30', // NY 93-85 LV (bdl game 24896, verified standalone + postseason:false)
]);

/* games rows → Set of game ids bbref excludes (playoffs + cup finals).
   etDate converts the row's UTC timestamp to an ET yyyy-mm-dd. */
export function excludedIdsFrom(gameRows,etDate){
  const out=new Set();
  (gameRows||[]).forEach(g=>{
    if(g.postseason)out.add(g.id);
    else if(CUP_FINAL_DATES.has(etDate(g.date)))out.add(g.id);
  });
  return out;
}

/* games rows → {post, cup} id sets, SEPARATELY (Tony 2026-08-08: playoffs are
   a real-games class the user can toggle INTO stat totals; Cup finals and
   All-Star are exhibition and stay excluded unconditionally). excludedIdsFrom
   above (= post ∪ cup) remains the bbref-regular default. */
export function classifyIdsFrom(gameRows,etDate){
  const post=new Set(),cup=new Set();
  (gameRows||[]).forEach(g=>{
    if(g.postseason)post.add(g.id);
    else if(CUP_FINAL_DATES.has(etDate(g.date)))cup.add(g.id);
  });
  return{post,cup};
}

/* keep a player_stats row? realTeamIds = the 15 franchise bdl ids
   (drops All-Star rows), excluded = playoff/cup-final game ids. */
export function keepStatRow(s,realTeamIds,excluded){
  if(!s||!s.game)return false;
  if(s.team&&realTeamIds&&!realTeamIds.has(s.team.id))return false;
  if(excluded&&excluded.has(s.game.id))return false;
  return true;
}

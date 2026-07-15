/* ================================================================
   defaults — WNBA profile seed vocab (basketball/Masonic ONLY —
   cross-sport lock: MLB values are banned here and vice versa),
   outcome words, stat config, lanes, T-family, color rules.
   WNBA-REDESIGN-SPEC §2.
================================================================ */

/* Core table seed. Rows may carry enabled:false + a seasonal tag —
   PLAY IN re-enables each April (vocab is data, not comments). */
export const CORE_WORDS_WNBA=[
  {word:'JESUIT ORDER'},
  {word:'SOCIETY OF JESUS'},
  {word:'FREEMASON'},
  {word:'FREEMASONRY'},
  {word:'SCOTTISH RITE'},
  {word:'BASKETBALL'},
  {word:'WNBA'},
  {word:'NBA'},
  {word:'WOMENS BASKETBALL'},
  {word:'FIRST BASKET'},
  {word:'PLAY IN',enabled:false,seasonal:'april-playin'},
];

/* Outcome vocabulary — stat-tagged. */
export const OUTCOME_WORDS=[
  {word:'FIRST BASKET',stats:['FG','PTS']},
  {word:'BASKET',stats:['FG','PTS']},
  {word:'FIELD GOAL',stats:['FG','PTS']},
  {word:'THREE POINTER',stats:['3PM','PTS']},
  {word:'THREE',stats:['3PM']},
  {word:'FREE THROW',stats:['FT','PTS']},
  {word:'POINTS',stats:['PTS']},
  {word:'REBOUND',stats:['REB']},
  {word:'ASSIST',stats:['AST']},
  {word:'DOUBLE DOUBLE',stats:['PTS','REB','AST']},
  {word:'BASKETBALL',stats:null},
  {word:'WNBA',stats:null},
];

/* Tracked player stats — season AND career entering totals, staircases on
   all (WNBA counters per spec: FG PTS REB AST 3PM FT GP + PRA composite). */
export const STATS=[
  ['FG','FG'],['PTS','PTS'],['REB','REB'],['AST','AST'],
  ['3PM','3PM'],['2PM','2PM'],['FT','FT'],['PRA','PRA'],['GP','GP'],
];
export const STAT_DEPTH={FG:3,PTS:5,REB:2,AST:2,'3PM':1,'2PM':2,FT:2,PRA:5,GP:1};

/* Refine-box lanes (§2): First Basket is the flagship, default ON.
   2PM sits alongside 3PM = interior (2-point) makes. */
export const LANES=['FB','PTS','REB','AST','3PM','2PM','PRA'];
export const LANE_STAT={FB:'FG',PTS:'PTS',REB:'REB',AST:'AST','3PM':'3PM','2PM':'2PM',PRA:'PRA'};
export const DEFAULT_LANES_ON=['FB'];

export const T_FAMILY=[40,43,57,58,59,62,191,69,84,177,201,1336];

/* Default color rules — ordered, first match wins. */
export const DEFAULT_COLOR_RULES=[
  {target:{type:'family',value:'T'},color:'#ffb02e',label:'T-family'},
  {target:{type:'category',value:'thread'},color:'#46a6ff',label:'Active thread'},
  {target:{type:'category',value:'h2h'},color:'#46a6ff',label:'H2H values'},
  {target:{type:'category',value:'date'},color:'#46d0ff',label:"Today's date numbers"},
  {target:{type:'category',value:'theme'},color:'#d046ff',label:'Theme values'},
];

export const DEFAULT_SETTINGS={
  lanesOn:DEFAULT_LANES_ON,
  refineCollapsed:true,
  forecastDays:10,
};

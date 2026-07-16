/* ================================================================
   defaults — seed vocab (MLB profile: baseball/Masonic ONLY, house
   rule), outcome words, stat config, T-family, default color rules.
================================================================ */

/* Core table seed: words, values computed by the engine at load.
   MLB scope — never basketball vocab (§2 house rules). */
export const CORE_WORDS_MLB=[
  'JESUIT ORDER','SOCIETY OF JESUS','FREEMASON','FREEMASONRY','SCOTTISH RITE',
  'BASEBALL','MLB','MAJOR LEAGUE BASEBALL',
];

/* Outcome vocabulary — stat-tagged like the scanner's VOCAB_STAT. */
export const OUTCOME_WORDS=[
  {word:'HOME RUN',stats:['HR','TB','RBI']},
  {word:'HOMERUN',stats:['HR','TB','RBI']},
  {word:'HOMER',stats:['HR','TB','RBI']},
  {word:'GRAND SLAM',stats:['HR','RBI']},
  {word:'STRIKEOUT',stats:['SO']},
  {word:'WALK',stats:['BB']},
  {word:'SINGLE',stats:['H','TB']},
  {word:'HIT',stats:['H','TB']},
  {word:'DOUBLE',stats:['2B','H','TB']},
  {word:'TRIPLE',stats:['3B','H','TB']},
  {word:'TOTAL BASES',stats:['TB']},
  {word:'RBI',stats:['RBI']},
  {word:'RUN BATTED IN',stats:['RBI']},
  {word:'BASEBALL',stats:null},
  {word:'MLB',stats:null},
];

/* Tracked batter stats (§2): season AND career, staircases on all.
   AB/PA are green-light signals, never the bet.
   1B/XBH are derived at ingest (engine/rungs.js deriveStats):
   1B = H−2B−3B−HR, XBH = 2B+3B+HR. Counting stats only (Tony). */
export const STATS=[
  ['SO','strikeOuts'],['H','hits'],['HR','homeRuns'],['2B','doubles'],['3B','triples'],
  ['1B','1B'],['XBH','XBH'],['RBI','rbi'],
  ['BB','baseOnBalls'],['TB','totalBases'],['AB','atBats'],['PA','plateAppearances'],
];
export const STAT_DEPTH={TB:4,RBI:4,AB:5,PA:5,H:3,SO:3,'1B':3,HR:2,XBH:2,BB:2,'2B':2,'3B':1};
/* Refine-box lanes (§4.2). Default ON: HR + TB + 1B (Tony 2026-07-15);
   XBH ships as a chip but stays OFF until tapped. */
export const LANES=['HR','TB','1B','XBH','RBI','K','H','BB','2B','3B'];
export const LANE_STAT={HR:'HR',TB:'TB','1B':'1B',XBH:'XBH',RBI:'RBI',K:'SO',H:'H',BB:'BB','2B':'2B','3B':'3B'};
export const DEFAULT_LANES_ON=['HR','TB','1B'];

export const T_FAMILY=[40,43,57,58,59,62,191,69,84,177,201,1336];

/* Default color rules (§8) — ordered, first match wins. */
export const DEFAULT_COLOR_RULES=[
  {target:{type:'family',value:'T'},color:'#ffb02e',label:'T-family'},
  {target:{type:'category',value:'thread'},color:'#46a6ff',label:'Active thread'},
  {target:{type:'category',value:'date'},color:'#46d0ff',label:"Today's date numbers"},
  {target:{type:'category',value:'theme'},color:'#d046ff',label:'Theme values'},
];

export const DEFAULT_SETTINGS={
  lanesOn:DEFAULT_LANES_ON,
  refineCollapsed:true,
  forecastDays:10,
};

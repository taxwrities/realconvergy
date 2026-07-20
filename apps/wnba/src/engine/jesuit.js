/* ================================================================
   jesuit — AJCU (Association of Jesuit Colleges and Universities)
   member schools + a normalizing matcher. Feeds the JESUIT badge on
   the player card, ev.jesuit, the "Jesuit educated" pattern criterion,
   and the "jesuit" search branch. US canonical list (28 universities).
   WNBA is college-heavy, so this lights up a lot of the slate.

   Matching is EXACT against a normalized alias set (full + common short
   forms a data feed emits). Ambiguous abbreviations are deliberately
   NOT matched — USF is San Francisco (Jesuit) OR South Florida (not);
   BC, SLU, LU, etc. could all mean something else — so we never match a
   bare abbreviation. Bare "Loyola" IS safe: every US Loyola is Jesuit.
================================================================ */

export const JESUIT_SCHOOLS=[
  'Boston College','College of the Holy Cross','Canisius College',
  'Creighton University','Fairfield University','Fordham University',
  'Georgetown University','Gonzaga University','John Carroll University',
  'Le Moyne College','Loyola Marymount University','Loyola University Chicago',
  'Loyola University Maryland','Loyola University New Orleans','Marquette University',
  'Regis University','Rockhurst University',"Saint Joseph's University",
  'Saint Louis University',"Saint Peter's University",'Santa Clara University',
  'Seattle University','Spring Hill College','University of Detroit Mercy',
  'University of San Francisco','University of Scranton','Wheeling University',
  'Xavier University',
];

/* normalize: strip accents, lowercase, "St." → "saint", drop punctuation,
   collapse whitespace. */
export function normSchool(s){
  return (s||'')
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase()
    .replace(/[.'’`]/g,'')
    .replace(/&/g,' and ')
    .replace(/[-–—/]/g,' ')
    .replace(/\bst\b/g,'saint')
    .replace(/\buniv\b/g,'university')
    .replace(/\s+/g,' ')
    .trim();
}

/* normalized alias set: canonical names PLUS the common short forms a feed
   emits ("Gonzaga", "Georgetown", "Saint Joseph's", "Detroit Mercy"). Every
   entry here is unambiguously Jesuit; abbreviations are intentionally absent. */
const ALIASES=[
  ...JESUIT_SCHOOLS,
  'Holy Cross','Canisius','Creighton','Fairfield','Fordham','Georgetown',
  'Gonzaga','John Carroll','Le Moyne','LeMoyne',
  'Loyola Marymount','Loyola Chicago','Loyola-Chicago','Loyola (IL)','Loyola University (IL)',
  'Loyola Maryland','Loyola (MD)','Loyola New Orleans','Loyola',
  'Marquette','Regis','Rockhurst',
  "Saint Joseph's","St. Joseph's","Saint Joseph's (PA)",
  'Saint Louis',"Saint Peter's",'Santa Clara','Seattle U','Spring Hill',
  'Detroit Mercy','San Francisco','Scranton','Wheeling','Wheeling Jesuit','Xavier',
];
const NORM_SET=new Set(ALIASES.map(normSchool));

/* true if the school string names an AJCU Jesuit institution. */
export function isJesuit(school){
  if(!school)return false;
  const n=normSchool(school);
  if(!n||n==='--')return false;
  return NORM_SET.has(n);
}

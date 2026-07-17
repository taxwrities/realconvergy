/* ================================================================
   recipe — board evidence → draft pattern conditions
   (PATTERN-RECIPES §8: reverse the authoring flow). Pure.
   The tap-to-recipe drawer collects these; the Patterns editor
   stays the source of truth — every inferred field is editable.
================================================================ */

/* hit category → grammar source. date/bday evidence lives on the COUNTER
   side of the grammar (dateFig / age), so it rides the counterRef source;
   thread + h2h numbers pool in dateThread; anything unmappable falls back
   to 'loaded' (the widest net). */
export function inferSource(cat){
  switch(cat){
    case 'core':return{source:'core',sourceArg:''};
    case 'theme':return{source:'theme',sourceArg:''};
    case 'name':return{source:'ownName',sourceArg:''};
    case 'jersey':return{source:'jersey',sourceArg:''};
    case 'date':return{source:'counterRef',sourceArg:{counter:'dateFig',scope:'season',off:1}};
    case 'bday':return{source:'counterRef',sourceArg:{counter:'age',scope:'season',off:1}};
    case 'thread':
    case 'h2h':return{source:'dateThread',sourceArg:''};
    default:return{source:'loaded',sourceArg:''};
  }
}

/* board scope tags → grammar scopes: 'career·home'/'season·away' are the
   venue splits; everything else is season or career. */
const mapScope=s=>s?.includes('·')?'venue':s==='career'?'career':'season';

/* rung row / PRIMARY / ALT → draft condition. Source guessed from the
   first hit whose cat maps beyond the 'loaded' fallback — a specific
   guess beats the widest net whenever any evidence supports one. */
export function draftFromRung(r){
  const hits=r.hits||[];
  const picked=hits.map(h=>({h,s:inferSource(h.cat)})).find(x=>x.s.source!=='loaded')
    ||{h:hits[0],s:inferSource(hits[0]?.cat)};
  return{
    label:`${r.scope} ${r.stat} → ${r.n}${picked.h?` · ${picked.h.cat||'loaded'}`:''}`,
    cond:{counter:`rung:${r.stat}`,counterArg:{off:r.off||1},scope:mapScope(r.scope),
      lmod:'',rmod:'',...picked.s,hard:true},
  };
}

/* matchup CROSS row → draft. Only rows anchored on a milestone rung or the
   team game # are expressible (name-value = name-value has no counter) —
   the rest return null and get no ⊕ affordance. */
export function draftFromCross(c){
  if(c.rung)return{
    label:`${c.rung.scope} ${c.rung.stat} → ${c.n} = opp SP name`,
    cond:{counter:`rung:${c.rung.stat}`,counterArg:{off:c.rung.off||1},scope:mapScope(c.rung.scope),
      lmod:'',rmod:'',source:'oppPitcher',sourceArg:'',hard:true},
  };
  if(c.gameNo)return{
    label:`team game #${c.n} = opp SP name`,
    cond:{counter:'teamGame',scope:'season',lmod:'',rmod:'',source:'oppPitcher',sourceArg:'',hard:true},
  };
  return null;
}

/* drafts → a pattern object ready for the editor. Lane guessed from the
   first rung draft's stat when it maps to a refine lane. */
export function draftsToPattern(drafts,laneStat){
  const statLane=Object.fromEntries(Object.entries(laneStat).map(([L,s])=>[s,L]));
  const first=drafts.map(d=>d.cond.counter).find(c=>c.startsWith('rung:'));
  return{id:'pat-'+Date.now(),name:'Board recipe',lane:(first&&statLane[first.slice(5)])||'HR',
    enabled:true,conditions:drafts.map(d=>d.cond)};
}

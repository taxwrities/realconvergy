/* ================================================================
   storage — cvg.* localStorage keys (LAYOUT-SPEC §9), auto-save,
   single config.json export/import of all user state.
================================================================ */
const KEYS=['cvg.profile','cvg.templates','cvg.phrases','cvg.patterns','cvg.colorRules',
  'cvg.registry','cvg.settings'];
const PROFILE_KEYS=p=>[`cvg.ciphers.${p}`,`cvg.vocab.${p}`];

export function load(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    return raw==null?fallback:JSON.parse(raw);
  }catch{return fallback}
}

export function save(key,value){
  try{localStorage.setItem(key,JSON.stringify(value))}catch{/* storage full/blocked */}
}

export function loadDay(date){return load(`cvg.dayState.${date}`,{adhocThemes:[],adhocThread:[],labels:{}})}
export function saveDay(date,state){save(`cvg.dayState.${date}`,state)}

/* ---- slate cache: instant rehydrate on reopen (heavy statsapi hydrate:
   career + venue splits for ~50 batters + both probables + team totals) ----
   single latest-only key; everything the board renders survives JSON
   round-trip (people/teamStats are plain objects). */
const SLATE_KEY='cvg.slateCache';
const SLATE_SCHEMA='cvg-slateCache/v1';

/* pure — testable: a cache entry is usable iff schema+date match today */
export function isSlateCacheValid(entry,date){
  return !!entry&&entry.schema===SLATE_SCHEMA&&entry.date===date;
}

export function saveSlateCache(date,slate,seasonInfo){
  try{
    const json=JSON.stringify({schema:SLATE_SCHEMA,date,savedAt:Date.now(),slate,seasonInfo});
    if(json.length>4_000_000){localStorage.removeItem(SLATE_KEY);return} // quota guard
    localStorage.setItem(SLATE_KEY,json);
  }catch{try{localStorage.removeItem(SLATE_KEY)}catch{/* ignore */}} // run cache-less
}

export function loadSlateCache(date){
  const entry=load(SLATE_KEY,null);
  return isSlateCacheValid(entry,date)?entry:null;
}

/* Export everything cvg.* as one config.json (§3 persistence). */
export function exportConfig(){
  const out={schema:'cvg-config/v1',exportedAt:new Date().toISOString(),data:{}};
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith('cvg.')&&k!==SLATE_KEY){ // transient slate cache is not config
      try{out.data[k]=JSON.parse(localStorage.getItem(k))}catch{/* skip corrupt */}
    }
  }
  const blob=new Blob([JSON.stringify(out,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='config.json';a.click();
  URL.revokeObjectURL(a.href);
}

export function importConfig(json){
  const cfg=typeof json==='string'?JSON.parse(json):json;
  if(cfg.schema!=='cvg-config/v1'||!cfg.data)throw new Error('Not a cvg config.json');
  for(const[k,v]of Object.entries(cfg.data))if(k.startsWith('cvg.'))save(k,v);
}

export const STORAGE_KEYS={KEYS,PROFILE_KEYS};

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

/* Export everything cvg.* as one config.json (§3 persistence). */
export function exportConfig(){
  const out={schema:'cvg-config/v1',exportedAt:new Date().toISOString(),data:{}};
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith('cvg.')){
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

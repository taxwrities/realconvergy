/* ================================================================
   gematria-core — shared cipher engine (LAYOUT-SPEC §2 dedup item;
   ported from convergence-scanner, values regression-locked).
   DO NOT ALTER VALUES. Checksum gates every vocab save.
================================================================ */
export const CHALDEAN={a:1,b:2,c:3,d:4,e:5,f:8,g:3,h:5,i:1,j:1,k:2,l:3,m:4,n:5,o:7,p:8,q:1,r:2,s:3,t:4,u:6,v:6,w:6,x:5,y:1,z:7};
export const SEPTENARY={a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:6,i:5,j:4,k:3,l:2,m:1,n:1,o:2,p:3,q:4,r:5,s:6,t:7,u:6,v:5,w:4,x:3,y:2,z:1};
export const LATIN={a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,k:10,l:20,m:30,n:40,o:50,p:60,q:70,r:80,s:90,t:100,u:200,v:700,x:300,y:400,z:500,j:600,w:900};
export const red1=v=>{while(v>9)v=String(v).split('').reduce((a,d)=>a+ +d,0);return v};
export const letters=s=>s.toLowerCase().split('').filter(c=>c>='a'&&c<='z');

export function calcAll(s){
  const L=letters(s);
  const ord=L.reduce((a,c)=>a+(c.charCodeAt(0)-96),0);
  return{Ord:ord,
    Red:L.reduce((a,c)=>a+red1(c.charCodeAt(0)-96),0),
    Rev:L.reduce((a,c)=>a+(27-(c.charCodeAt(0)-96)),0),
    RR:L.reduce((a,c)=>a+red1(27-(c.charCodeAt(0)-96)),0),
    Sat:ord+35*L.length,
    Chal:L.reduce((a,c)=>a+CHALDEAN[c],0),
    Sept:L.reduce((a,c)=>a+SEPTENARY[c],0),
    Latin:L.reduce((a,c)=>a+LATIN[c],0)};
}

export const CIPHER_LABEL={Ord:'Ordinal',Red:'Reduction',Rev:'Rev Ordinal',RR:'Rev Reduction',
  Sat:'Satanic',Chal:'Chaldean',Sept:'Septenary',Latin:'Jewish'};
export const cl=c=>CIPHER_LABEL[c]||c;
export const ALL_CIPHERS=['Ord','Red','Rev','RR','Sat','Chal','Sept','Latin'];

/* Cipher defaults per sport profile (§7): MLB may run Chaldean OFF;
   WNBA runs Chaldean + Satanic ON. Stored per profile in cvg.ciphers.{profile}. */
export const CIPHER_DEFAULTS={
  mlb:{Ord:true,Red:true,Rev:true,RR:true,Sat:true,Chal:true,Sept:false,Latin:true},
  wnba:{Ord:true,Red:true,Rev:true,RR:true,Sat:true,Chal:true,Sept:false,Latin:true},
};

/* Verification checksum (§2): runs on boot and on any vocab save.
   Refuse to save vocab edits if this fails. */
export function checksum(){
  const v=calcAll('JESUIT ORDER');
  const ok=v.Ord===144&&v.Red===54&&v.Rev===153&&v.RR===72&&v.Sat===529;
  return{ok,got:v,want:{Ord:144,Red:54,Rev:153,RR:72,Sat:529}};
}

/* 12-value name run: full name + first/last across enabled ciphers. */
export function nameRun(fullName,enabled){
  const parts=fullName.trim().split(/\s+/);
  const first=parts[0]||'';
  const last=parts.slice(1).join(' ');
  const out=[];
  const add=(label,str)=>{
    if(!str)return;
    const v=calcAll(str);
    for(const c of ALL_CIPHERS)if(enabled[c])out.push({label,cipher:c,n:v[c]});
  };
  add(fullName,fullName);
  if(last&&last!==fullName){add(first,first);add(last,last)}
  return out.filter(x=>x.n>0);
}

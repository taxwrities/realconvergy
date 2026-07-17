/* ================================================================
   clocks — calendar-exact, leap-aware date math + date numerology.
   Ported from convergence-scanner (Date Decoder regression-locked).
================================================================ */
import {calcAll,ALL_CIPHERS} from './gematria.js';
import {nthPrime} from './numbers.js';

export const RULERS={Sunday:'Sun',Monday:'Moon',Tuesday:'Mars',Wednesday:'Mercury',
  Thursday:'Jupiter',Friday:'Venus',Saturday:'Saturn'};

export function clockFrom(originStr,dstr){
  const o=new Date(originStr+'T12:00:00'),d=new Date(dstr+'T12:00:00');
  if(d<o)return null;
  let years=d.getFullYear()-o.getFullYear();
  let annThis=new Date(d.getFullYear(),o.getMonth(),o.getDate(),12);
  if(annThis>d){years--;annThis=new Date(d.getFullYear()-1,o.getMonth(),o.getDate(),12)}
  const annNext=new Date(annThis.getFullYear()+1,o.getMonth(),o.getDate(),12);
  const since=Math.round((d-annThis)/864e5);
  const until=Math.round((annNext-d)/864e5);
  const totalDays=Math.round((d-o)/864e5);
  let months=(d.getFullYear()-o.getFullYear())*12+(d.getMonth()-o.getMonth());
  if(d.getDate()<o.getDate())months--;
  return{years,since,until,totalDays,weeks:Math.floor(totalDays/7),months};
}

export function daysBetween(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5)}

export function todayISO(){
  const d=new Date();
  return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* The DateStrip's headline date figures — a fixed, date-driven set shown
   left-to-right. figs[0] (M+DD+YY+cent) is the top number and renders gold.
   calc is kept as a hover title only; the row itself is numbers-only. */
export function dateFigures(dstr){
  const d=new Date(dstr+'T12:00:00');
  const M=d.getMonth()+1,DD=d.getDate(),YYYY=d.getFullYear(),YY=YYYY%100,cent=Math.floor(YYYY/100);
  const digs=n=>String(n).split('').join('+');            // 14 -> "1+4", 2026 -> "2+0+2+6"
  const dig=n=>String(n).split('').reduce((a,x)=>a+ +x,0);
  const doy=Math.round((d-new Date(YYYY,0,1))/864e5)+1;
  const leap=(YYYY%4===0&&(YYYY%100!==0||YYYY%400===0));
  const left=(leap?366:365)-doy;
  return[
    {n:M+DD+YY+cent,             calc:`(${M}) + (${DD}) + (${cent}) + (${YY})`, top:true},
    {n:M+DD+dig(YYYY),           calc:`(${M}) + (${DD}) + ${digs(YYYY)}`},
    {n:dig(M)+dig(DD)+dig(YYYY), calc:`${digs(M)} + ${digs(DD)} + ${digs(YYYY)}`},
    {n:M+DD+YY,                  calc:`(${M}) + (${DD}) + (${YY})`},
    {n:dig(M)+dig(DD)+dig(YY),   calc:`${digs(M)} + ${digs(DD)} + ${digs(YY)}`},
    {n:doy,                      calc:'Day of Year'},
    {n:left,                     calc:'Days Left'},
  ];
}

export function dateNumerology(dstr,enabled){
  const d=new Date(dstr+'T12:00:00');
  const M=d.getMonth()+1,DD=d.getDate(),YYYY=d.getFullYear(),YY=YYYY%100,cent=Math.floor(YYYY/100);
  const dig=n=>String(n).split('').reduce((a,x)=>a+ +x,0);
  const doy=Math.round((d-new Date(YYYY,0,1))/864e5)+1;
  const leap=(YYYY%4===0&&(YYYY%100!==0||YYYY%400===0));
  const left=(leap?366:365)-doy;
  const dayName=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
  const vals={};
  const put=(n,l)=>{if(n>0)vals[n]=vals[n]?vals[n]+' / '+l:l};
  put(M+DD+YY+cent,'M+DD+YY+cent');put(M+DD+dig(YYYY),'M+DD+Ydig');put(dig(M)+dig(DD)+dig(YYYY),'all-digit');
  put(M+DD+(YYYY-2000),'M+DD+Y-2000');put(dig(M)+dig(DD)+dig(YY),'Mdig+Ddig+YYdig');
  put(doy,'day of year');put(left,'days left');put(M+DD,'M+DD');
  put(dig(M)+dig(DD)+YY+cent,'Mdig+Ddig+YY+cent');put(dig(M)+dig(DD)+(YYYY-2000),'Mdig+Ddig+Y-2000');
  put(DD,'day #');put(nthPrime(DD),'day prime');
  /* date-digit figures (Tony 2026-07-16, Baty "#7 on the 16th (7)"): month #,
     digit reductions, and the two-digit year join the WIDE set — deliberately
     dn, not dateFigures, which stays the locked 7. */
  put(M,'month #');put(dig(M),'month digit');put(dig(DD),'day digit');put(YY,'year '+YY);
  put(+(''+M+DD),`date ${M}/${DD}`);put(+(''+DD+M),`date ${DD}\\${M}`);
  const dg=calcAll(dayName);
  for(const c of ALL_CIPHERS)if(!enabled||enabled[c])put(dg[c],dayName+' '+c);
  const ruler=RULERS[dayName];
  const rg=calcAll(ruler);
  const rulerVals={};
  for(const c of ALL_CIPHERS)if(!enabled||enabled[c])if(rg[c]>0)rulerVals[rg[c]]=(rulerVals[rg[c]]?rulerVals[rg[c]]+' / ':'')+ruler+' '+c;
  return{vals,rulerVals,dayName,ruler,M,DD,doy,left};
}

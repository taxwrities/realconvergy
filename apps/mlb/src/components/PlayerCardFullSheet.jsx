import {useState,useMemo,useEffect} from 'react';
import {useApp,INSTITUTIONAL} from '../state/store.jsx';
import {calcAll,ALL_CIPHERS} from '../engine/gematria.js';
import {isPrime,primeIndex} from '../engine/numbers.js';
import {dateFigures} from '../engine/clocks.js';
import {crossRefsForNumber,numerologyText,statRungText,opponentText,dateRootSet} from '../engine/numerology.js';
import {draftFromCross} from '../engine/recipe.js';
import {CORE_WORDS_MLB} from '../data/defaults.js';

/* ================================================================
   PlayerCardFullSheet — Tony's locked full-sheet player card (v2).
   Design ref: player-card-fullsheet-v2.html (repo root). Pinned
   ACTIVE / TEST / cascade stack over a scrolling sheet, with the
   three-layer filter (ALL / lens / spotlight) + WHY bottom sheet.

   Data rules honored here:
   • ACTIVE set comes from the store's dayField (single slate source);
     BIO is the per-player exception, filled from this batter's own
     life-clock readings that land on the day spine.
   • Every cipher value is computed live by the engine (calcAll) across
     the ciphers enabled in Settings — never hardcoded.
   • Cascade increments the full stat family off the CAREER line and
     re-runs each value through the same active-number check.
================================================================ */

/* mockup's 6-column grid generalized to every enabled cipher (data
   contract #2). Mockup order first, engine extras appended. */
const CIPHER_COL=[
  ['Ord','ORD'],['Red','RED'],['Rev','RVO'],['RR','RVR'],['Chal','CHL'],['Sat','SAT'],
  ['RevSat','RSAT'],['Sept','SEP'],['Latin','JEW'],
];

const SK={G:'gamesPlayed',PA:'plateAppearances',AB:'atBats',R:'runs',H:'hits','1B':'1B','2B':'doubles',
  '3B':'triples',HR:'homeRuns',XBH:'XBH',RBI:'rbi',TB:'totalBases',
  BB:'baseOnBalls',SO:'strikeOuts',SB:'stolenBases'};
/* G leads the STATS block: career games is the running total Tony reads first
   (Tony 2026-07-23). R (runs scored) sits with the top-of-order counters after
   AB; SB (stolen bases) rides at the tail beside the discipline lanes — both
   added 2026-07-23, every other lane unchanged. */
const STAT_ROWS=['G','PA','AB','R','H','1B','2B','3B','HR','XBH','RBI','TB','BB','SO','SB'];

/* each outcome increments its full stat family (spec §4); base = career line.
   SB is the lone non-plate-appearance outcome (Tony 2026-07-23): a stolen base
   advances ONLY the SB lane — no AB, no PA, no hit family. R (runs scored) is a
   byproduct of any outcome rather than a discrete plate result, so it stays a
   STATS-block row and is intentionally NOT a TEST chip. */
const CASCADE={
  'H':[['H',1],['AB',1],['PA',1]],   // any hit, type-agnostic: no 1B/2B/3B/HR/XBH/RBI/TB advance
  '1B':[['H',1],['1B',1],['TB',1],['AB',1],['PA',1]],
  '2B':[['H',1],['2B',1],['XBH',1],['TB',2],['AB',1],['PA',1]],
  '3B':[['H',1],['3B',1],['XBH',1],['TB',3],['AB',1],['PA',1]],
  'HR':[['H',1],['HR',1],['XBH',1],['RBI',1],['TB',4],['AB',1],['PA',1]],
  'BB':[['BB',1],['PA',1]],
  'SO':[['SO',1],['AB',1],['PA',1]],
  'SB':[['SB',1]],                   // stolen base: SB only — not a plate appearance
};
const OUTCOMES=['none','H','1B','2B','3B','HR','BB','SO','SB'];

/* next-1 rung glow gate (Tony 2026-07-23): on a single plate appearance only ONE
   outcome fires, so those next-rung milestones are mutually exclusive — lighting
   every tracked stat's +1 floods the eye with hits that can't all happen. The
   sheet's next-1 xhit glow is restricted to the stats CONSISTENT with the state:
     • TEST = '—' (none) → only the stats that advance on EVERY event: AB & PA
       (PA always; AB on every non-walk/HBP/SF).
     • a specific TEST outcome → the stat family that outcome advances.
   R has no TEST chip (byproduct stat) but is mapped for completeness. This gates
   only the SHEET glow classes — the WHY panel still lists every projection. */
const NEXT1_STATS={
  none:['AB','PA'],
  H:['H','AB','PA'],
  '1B':['H','1B','TB','AB','PA'],
  '2B':['H','2B','XBH','TB','AB','PA'],
  '3B':['H','3B','XBH','TB','AB','PA'],
  HR:['H','HR','XBH','RBI','TB','AB','PA'],
  BB:['BB','PA'],
  SO:['SO','AB','PA'],
  SB:['SB'],
  R:['R'],
};
const SPLIT_COLS=[['gamesPlayed','G'],['plateAppearances','PA'],['atBats','AB'],['runs','R'],['hits','H']];
const GROUP_ORDER=[['threads','THREADS'],['date','DATE'],['team','TEAM'],['bio','BIO'],['tfam','T-FAM']];
const handLabel=h=>h==='R'?'RHP':h==='L'?'LHP':h==='S'?'SHP':'';

/* ---- number-property helpers (WHY panel enrichment) ----
   Prime/composite via the engine sieve; factorization by trial division
   (WHY numbers are small — sheet values, stat lines, life-clock readings).
   digital root uses the mod-9 shortcut. */
const digitSum=n=>String(Math.abs(n)).split('').reduce((a,d)=>a+ +d,0);
const digitalRoot=n=>n>0?1+((n-1)%9):0;
const primeFactors=n=>{
  const f=[];let x=Math.abs(n);
  for(let d=2;d*d<=x;d++)while(x%d===0){f.push(d);x/=d;}
  if(x>1)f.push(x);
  return f;
};

/* institutional table → labels: which Core-table word (in which cipher) lands
   on each frozen table value. The table itself is the fixed INSTITUTIONAL list;
   labels are a convenience so a match prints "= FREEMASON RR" not just a flag. */
const INST_SET=new Set(INSTITUTIONAL);
const INST_LABELS=(()=>{
  const m=new Map();
  CORE_WORDS_MLB.forEach(w=>{
    const v=calcAll(w);
    ALL_CIPHERS.forEach(c=>{
      const n=v[c];
      if(INST_SET.has(n)){
        const label=`${w} ${c}`;
        if(!m.has(n))m.set(n,[]);
        if(!m.get(n).includes(label))m.get(n).push(label);
      }
    });
  });
  return m;
})();

export default function PlayerCardFullSheet({row,onClose}){
  const {dayField,matchup,ciphers,game,side,dayState,addThread,addDraft,dn,date,focusReturn}=useApp();
  const [outcome,setOutcome]=useState('3B');
  const [lens,setLens]=useState(null);       // category key | null
  const [spot,setSpot]=useState(null);       // spotlighted number | null
  const [spotOrigin,setSpotOrigin]=useState(null); // origin of the spotlighted cell (projection cells only)
  const [showAllXref,setShowAllXref]=useState(false); // convergence-bullet cap toggle

  /* dedicated-page navigation (Tony 2026-07-22): push one history entry on
     entry so the mobile / browser back button (and back-swipe) returns to the
     Board via popstate. Every dismiss path routes through history.back() so the
     synthetic entry is always popped — no orphan entries left behind. Also lock
     body scroll while the page owns the viewport. */
  useEffect(()=>{
    window.history.pushState({pcfs:1},'');
    const onPop=()=>onClose();
    const esc=e=>{if(e.key==='Escape')window.history.back()};
    window.addEventListener('popstate',onPop);
    window.addEventListener('keydown',esc);
    const prevOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{
      window.removeEventListener('popstate',onPop);
      window.removeEventListener('keydown',esc);
      document.body.style.overflow=prevOverflow;
    };
  },[]); // eslint-disable-line react-hooks/exhaustive-deps
  const dismiss=()=>window.history.back();

  const ev=row.ev,p=ev.p;
  const cols=useMemo(()=>CIPHER_COL.filter(([k])=>ciphers[k]),[ciphers]);
  const sp=matchup?.sp||null;                // opposing probable pitcher
  const spHand=sp?.pitchHand||null;

  const myTeam=game?game[side]:null;
  const oppTeam=game?game[side==='away'?'home':'away']:null;
  const abbr=t=>t?(t.abbrev||t.teamName||''):'';

  /* opponent-team cipher grid (Tony 2026-07-22): nickname / city / full name
     × the enabled ciphers, deduped by name|value — feeds the WHY panel's OPP
     cross-ref the same way the Phrase Finder's store-side oppVals do. */
  const oppVals=useMemo(()=>{
    if(!oppTeam)return[];
    const dd=new Set(),ov=[];
    [...new Set([oppTeam.name,oppTeam.teamName,oppTeam.locationName].filter(Boolean))].forEach(tn=>{
      const cv=calcAll(tn);
      ALL_CIPHERS.filter(c=>ciphers[c]).forEach(c=>{const n=cv[c];if(!(n>0))return;
        const k=`${tn}|${n}`;if(dd.has(k))return;dd.add(k);ov.push({name:tn,cipher:c,n})});
    });
    return ov;
  },[oppTeam,ciphers]);

  /* today's date-root set (Tony 2026-07-23): digit roots of the five
     date-numerology values (dateFigures rows 1–5). Threaded into every
     crossRefsForNumber call so a digit-root SOFT match only fires on a root the
     day itself is emphasizing — an 8-reducing stat no longer soft-glows unless 8
     is one of today's date roots. */
  const dateRoots=useMemo(
    ()=>dateRootSet((date?dateFigures(date):[]).slice(0,5).map(f=>f.n)),[date]);

  /* shared cross-ref inputs (hoisted so the sheet glow + WHY panel + externalConv
     all read the same career/season lines and outcome-consistent rung gate). */
  const srf=useMemo(()=>({career:p.career||null,season:p.season||null}),[p]);
  const allowRung=useMemo(()=>new Set(NEXT1_STATS[outcome]||NEXT1_STATS.none),[outcome]);

  /* ---- life-clock readings (each tappable + promotable) ---- */
  const bday=ev.bday,debut=ev.debut;
  const bioReadings=[];
  const bio=(label,value)=>{if(value!=null&&value>0)bioReadings.push({label,value})};
  if(bday){bio('age',bday.years);bio('since bday',bday.since);bio('until bday',bday.until);
    bio('day of life',bday.totalDays);bio('week of life',bday.weeks);}
  if(debut){bio('career day',debut.totalDays);bio('career wk',debut.weeks);
    bio('career mo',debut.months);bio('since anniv',debut.since);bio('until anniv',debut.until);}
  bio('jersey',p.jersey);

  /* ---- ACTIVE set: store dayField → per-card activeMap ----
     primary category by priority threads>date>team; BIO overrides for this
     player's active life readings; T-family is a cross-cutting mirror. */
  const {activeMap,tfamSet}=useMemo(()=>{
    const m=new Map();
    ['threads','date','team'].forEach(cat=>{
      Object.entries(dayField[cat]?.nums||{}).forEach(([n,reason])=>{
        if(!m.has(+n))m.set(+n,{reason,cat});
      });
    });
    const tf=new Set(Object.keys(dayField.tfam?.nums||{}).map(Number));
    bioReadings.forEach(({label,value})=>{
      if(m.has(value)){
        const o=m.get(value);
        m.set(value,{reason:`${label} = ${o.reason}`,cat:'bio'});
      }
    });
    return{activeMap:m,tfamSet:tf};
  },[dayField,p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isActive=n=>activeMap.has(n);

  /* ---- sheet model + cell collection (for hit2 counts + WHY locations) ---- */
  const model=useMemo(()=>{
    const cells=[];                                  // {n, section, item}
    const collect=(n,section,item)=>{if(n>0)cells.push({n:+n,section,item})};

    bioReadings.forEach(b=>collect(b.value,'BIRTH / LIFE',b.label));

    const gridFor=(title,defs)=>{
      const rows=defs.filter(d=>d.str&&d.str.trim()).map(d=>{
        const v=calcAll(d.str);
        const vals=cols.map(([k,h])=>({header:h,n:v[k]}));
        vals.forEach(x=>collect(x.n,title,`${d.label} · ${x.header}`));
        return{label:d.label,vals};
      });
      return{title,rows};
    };
    const nm=(full)=>{const parts=(full||'').trim().split(/\s+/);return{first:parts[0]||'',last:parts.slice(1).join(' ')};};
    const pn=nm(p.fullName);
    const nameGrid=gridFor('NAME',[
      {label:pn.first.toUpperCase(),str:pn.first},
      {label:(p.lastName||pn.last).toUpperCase(),str:p.lastName||pn.last},
      {label:(p.fullName||'').toUpperCase(),str:p.fullName},
    ]);
    const teamGrid=myTeam?gridFor(`TEAM — ${abbr(myTeam)}`,[
      {label:(myTeam.teamName||'').toUpperCase(),str:myTeam.teamName},
      {label:(myTeam.locationName||'').toUpperCase(),str:myTeam.locationName},
      {label:(myTeam.name||'').toUpperCase(),str:myTeam.name},
    ]):null;
    const oppGrid=oppTeam?gridFor(`OPPONENT — ${abbr(oppTeam)}`,[
      {label:(oppTeam.teamName||'').toUpperCase(),str:oppTeam.teamName},
      {label:(oppTeam.locationName||'').toUpperCase(),str:oppTeam.locationName},
      {label:(oppTeam.name||'').toUpperCase(),str:oppTeam.name},
    ]):null;
    let pitcherGrid=null;
    if(sp){
      const spn=nm(sp.fullName);
      pitcherGrid=gridFor(`OPP PITCHER — ${(spn.first[0]||'').toUpperCase()}. ${(sp.lastName||spn.last).toUpperCase()}${spHand?` · ${handLabel(spHand)}`:''}`,[
        {label:spn.first.toUpperCase(),str:spn.first},
        {label:(sp.lastName||spn.last).toUpperCase(),str:sp.lastName||spn.last},
        {label:(sp.fullName||'').toUpperCase(),str:sp.fullName},
      ]);
    }

    const car=p.career,ssn=p.season;
    const statsRows=STAT_ROWS.map(st=>{
      const k=SK[st];
      const c=car?.[k],s=ssn?.[k];
      const base=c!=null?c:(s!=null?s:null);
      const next=base!=null?base+1:null;
      if(c!=null)collect(c,'STATS',`${st} career`);
      if(s!=null)collect(s,'STATS',`${st} season`);
      if(next!=null)collect(next,'STATS',`${st} +1`);
      return{stat:st,car:c,ssn:s,next};
    });

    const SPd=p.split||{};
    const splitDefs=[
      {label:'LHP',key:'season-vsL',hand:'L'},
      {label:'RHP',key:'season-vsR',hand:'R'},
      {label:'Home',key:'season-home'},
      {label:'Away',key:'season-away'},
    ];
    const splitRows=splitDefs.map(d=>{
      const line=SPd[d.key]||null;
      const vals=SPLIT_COLS.map(([k,h])=>{
        const v=line?line[k]:null;
        if(v!=null)collect(v,'SPLITS',`${d.label} · ${h}`);
        return v!=null?v:null;
      });
      const tonight=!!(d.hand&&spHand&&d.hand===spHand);
      const offhand=!!(d.hand&&spHand&&d.hand!==spHand);
      return{label:d.label,vals,tonight,offhand};
    });
    const splitTitle=`SPLITS — vs ${sp?(sp.lastName||'pitcher'):'pitcher'}${spHand?` (${handLabel(spHand)})`:''}`;

    /* career G by split (Tony 2026-07-23): Home / Away from the slate's
       careerStatSplits (always present); vs AL / vs NL from the DEEP league pull
       (leagueALCareer / leagueNLCareer — null until ⚡DEEP runs, and null for a
       league a rookie hasn't faced → renders as —). The vs-AL/vs-NL row matching
       TODAY's opponent league is highlighted gold + ● — same tonight treatment as
       the pitcher-hand row above. */
    const oppLeagueTag=p.deep?.leagueTag||null;   // 'AL' | 'NL' — tonight's opp
    const careerSplitDefs=[
      {label:'Home',line:SPd['career-home']},
      {label:'Away',line:SPd['career-away']},
      {label:'vs AL',line:p.deep?.leagueALCareer,league:'AL'},
      {label:'vs NL',line:p.deep?.leagueNLCareer,league:'NL'},
    ];
    const careerSplitRows=careerSplitDefs.map(d=>{
      const line=d.line||null;
      const vals=SPLIT_COLS.map(([k,h])=>{
        const v=line?line[k]:null;
        if(v!=null)collect(v,'CAREER SPLITS',`${d.label} · ${h}`);
        return v!=null?v:null;
      });
      const tonight=!!(d.league&&oppLeagueTag&&d.league===oppLeagueTag);
      return{label:d.label,vals,tonight};
    });

    return{cells,nameGrid,teamGrid,oppGrid,pitcherGrid,statsRows,splitRows,splitTitle,
      careerSplitRows,oppLeagueTag};
  },[p,cols,myTeam,oppTeam,sp,spHand]); // eslint-disable-line react-hooks/exhaustive-deps

  /* cascade depends on the selected outcome; its values glow too */
  const cascade=useMemo(()=>{
    if(outcome==='none'||!CASCADE[outcome])return[];
    const base=p.career||p.season||{};
    const scope=p.career?'career':'season';
    return CASCADE[outcome].map(([st,d])=>{
      const b=base[SK[st]];
      return b==null?null:{stat:st,n:b+d,origin:{stat:st,scope,offset:d}};
    }).filter(Boolean);
  },[outcome,p]);

  /* occurrence counts across the whole sheet + the pinned cascade (bar
     excluded). Counted over EVERY number, not just the active set (Tony
     2026-07-22): a value that lands 2+ places on the sheet is a convergence
     whether or not it sits in today's spine, so the red multi-occurrence glow
     must be able to see it. */
  const counts=useMemo(()=>{
    const c=new Map();
    const bump=n=>c.set(n,(c.get(n)||0)+1);
    model.cells.forEach(x=>bump(x.n));
    cascade.forEach(x=>bump(x.n));
    return c;
  },[model,cascade]);

  /* opp-echo convergence set — numbers that land on an opponent-team cipher AND
     also appear at least once on the sheet OUTSIDE the opponent grid (a lone
     opp-cipher echo with no other convergence is noise). Number-keyed: applies
     to every cell showing that value.
     The next-1 stat-rung glow is NOT here anymore (Tony 2026-07-23): a rung cell
     matching its own next rung is tautological. That trigger moved to the
     cell-aware `externalConv` below, which excludes the cell's own advancement
     and only lights when the projected value cross-references something external.
     Feeds the dim additive glow (xhit) for single-occurrence convergences;
     3+ occurrences already go red via `counts`. */
  const xrefSet=useMemo(()=>{
    const s=new Set();
    /* occurrences away from the opponent grid — used to qualify opp echoes.
       cascade values are never part of the opp grid, so they count too. */
    const nonOppCount=new Map();
    const bumpNonOpp=n=>nonOppCount.set(n,(nonOppCount.get(n)||0)+1);
    model.cells.forEach(x=>{if(!x.section.startsWith('OPPONENT'))bumpNonOpp(x.n);});
    cascade.forEach(x=>bumpNonOpp(x.n));
    const distinct=new Set([...model.cells.map(x=>x.n),...cascade.map(x=>x.n)]);
    distinct.forEach(n=>{
      const cr=crossRefsForNumber({sr:srf,opp:oppVals},n,dateRoots);
      const oppEcho=cr.opponent.items.some(i=>i.rawMatch)&&(nonOppCount.get(n)||0)>0;
      if(oppEcho)s.add(n);
    });
    return s;
  },[model,cascade,oppVals,srf,dateRoots]);

  /* raw cipher footprint (Tony 2026-07-23): every value printed in the NAME /
     TEAM / OPPONENT / OPP PITCHER cipher grids. A projected stat/cascade value
     that lands on one of these is a genuine cross-reference (criterion 2). */
  const cipherVals=useMemo(()=>{
    const s=new Set();
    [model.nameGrid,model.teamGrid,model.oppGrid,model.pitcherGrid].forEach(g=>{
      g?.rows.forEach(r=>r.vals.forEach(v=>{if(v.n>0)s.add(v.n);}));
    });
    return s;
  },[model]);
  /* phrase-template footprint: the CONVERGENCES / TEAM STAIRCASE values sourced
     from the store matchup (criterion 3). */
  const phraseVals=useMemo(()=>{
    const s=new Set();
    (matchup?.cross||[]).forEach(c=>{if(c.n>0)s.add(c.n);});
    (matchup?.stair||[]).forEach(x=>{if(x.n>0)s.add(x.n);});
    return s;
  },[matchup]);

  /* prime-factor convergence pool (Tony 2026-07-23): the "relevant numbers" a
     value's factorization is tested against — active-set numbers + raw cipher
     values on the sheet. relevantPrimeFactors is every prime factor of that pool
     so a PRIME value can check whether it divides one of them. */
  const relevantVals=useMemo(()=>{
    const s=new Set(cipherVals);
    activeMap.forEach((_v,n)=>s.add(n));
    return s;
  },[cipherVals,activeMap]);
  const relevantPrimeFactors=useMemo(()=>{
    const s=new Set();
    relevantVals.forEach(n=>{if(n>=2)primeFactors(n).forEach(pf=>s.add(pf));});
    return s;
  },[relevantVals]);

  /* externalConv(n,origin) — the non-tautological glow test for a projected stat
     rung / cascade cell (Tony 2026-07-23). A projection lights ONLY when its
     value ALSO converges with something OUTSIDE its own advancement:
       1 active-set number                3 phrase-template value
       2 name/team/opp/pitcher cipher     4 opponent-team cipher (raw)
       5 digit root ∈ today's date-roots
     plus a DIFFERENT stat's next-1 rung — `origin` drops the asking cell's own
     lane inside statRungMatches so a rung matching itself no longer counts.
     6 prime-factor cross-reference (Tony 2026-07-23):
         composite n (≥4) → a prime factor is active / a cipher raw / date-root-relevant
         prime n          → n is itself a prime factor of an active or cipher-raw value
       the trivial 1×n factorization never counts. */
  const externalConv=(n,origin)=>{
    if(!(n>0))return false;
    if(isActive(n))return true;
    if(cipherVals.has(n))return true;
    if(phraseVals.has(n))return true;
    if(dateRoots.has(digitalRoot(n)))return true;
    const cr=crossRefsForNumber({sr:srf,opp:oppVals},n,dateRoots,origin);
    if(cr.opponent.items.some(i=>i.rawMatch))return true;
    if(cr.statRungs.items.some(i=>i.rawMatch&&i.off===1&&allowRung.has(i.label)))return true;
    if(n>=4&&!isPrime(n))
      return primeFactors(n).some(pf=>relevantVals.has(pf)||dateRoots.has(digitalRoot(pf)));
    if(isPrime(n))return relevantPrimeFactors.has(n);
    return false;
  };

  /* ---- bar groups derived from the (re-categorized) activeMap ---- */
  const barGroups=GROUP_ORDER.map(([cat,label])=>{
    const nums=cat==='tfam'
      ? [...tfamSet].filter(n=>activeMap.has(n))
      : [...activeMap.entries()].filter(([,v])=>v.cat===cat).map(([n])=>n);
    return{cat,label,nums:[...new Set(nums)].sort((a,b)=>a-b)};
  }).filter(g=>g.nums.length);

  /* named convergence bullets — the same opp-SP-name × batter cross rows and
     team staircases the Board card shows, now ported onto the full-sheet
     (Tony 2026-07-22). Sourced from the store's `matchup` (already keyed to
     this player: focusPlayer points batterId here before opening). Ranked so
     the hard-rung rows (career TB→444 / season PA→208) lead, then the team
     game # rows, then plain name-value echoes. Capped so the block can't
     dominate the sheet; overflow behind a +N more toggle. */
  const XREF_CAP=10;
  const xrefRows=useMemo(()=>{
    const cross=matchup?.cross||[];
    const rank=c=>c.rung?0:c.gameNo?1:2;
    return[...cross].map((c,i)=>({c,i})).sort((a,b)=>rank(a.c)-rank(b.c)||a.i-b.i).map(x=>x.c);
  },[matchup]);
  const teamStair=matchup?.stair||[];
  const shownXref=showAllXref?xrefRows:xrefRows.slice(0,XREF_CAP);

  /* ---- filter helpers ---- */
  const lensMatch=n=>lens? (lens==='tfam'?tfamSet.has(n):activeMap.get(n)?.cat===lens) : false;
  /* glow layering (additive, Tony 2026-07-22, take 2 — thresholds tightened so
     the cascade only lights what matters):
       • 3+ occurrences anywhere on the sheet → red (hit2), active or not (twice
         is common cipher coincidence; three-plus is a real convergence).
         Active AND multi-occurrence is the strongest — gold-ringed (strong).
       • active (in today's spine) → gold (hit).
       • not active but a narrowed cross-ref convergence (next-1 stat rung, or
         an opp cipher that also echoes elsewhere) → dim gold (xhit). */
  const cls=(n,origin)=>{
    let c='';
    const occ=counts.get(n)||0;
    const active=isActive(n);
    if(occ>=3)c+=active?' hit2 strong':' hit2';
    else if(active)c+=' hit';
    else if(xrefSet.has(n)||(origin&&externalConv(n,origin)))c+=' xhit';
    if(lens&&lensMatch(n))c+=' lensmatch';
    if(spot===n)c+=' spot-match';
    return c;
  };
  const toggleSpot=(n,origin=null)=>{const off=spot===n;setSpot(off?null:n);setSpotOrigin(off?null:origin);};
  const toggleLens=cat=>{setSpot(null);setLens(l=>l===cat?null:cat);};
  const goAll=()=>{setLens(null);setSpot(null);};

  const rootCls=`pcfs${lens?' lensed':''}${spot!=null?' spotlight':''}`;

  /* clickable number cell (spotlight on tap). Plain render fn, not a
     component, so leaf spans diff in place instead of remounting each render. */
  const numCell=(n,key,nx=false,origin=null)=>(
    <span key={key} data-n={n} className={`${nx?'nx':''}${cls(n,origin)}`}
      onClick={e=>{e.stopPropagation();toggleSpot(n,origin);}}>{n}</span>
  );

  const promoted=new Set(dayState.adhocThread);

  /* ---- WHY panel content for the spotlighted number ---- */
  const why=useMemo(()=>{
    if(spot==null)return null;
    const a=activeMap.get(spot);
    const locs=[];
    const seen=new Set();
    [...model.cells,...cascade.map(c=>({n:c.n,section:'CASCADE',item:`${c.stat} → projected`}))]
      .forEach(x=>{if(x.n===spot){const key=x.section+'|'+x.item;if(!seen.has(key)){seen.add(key);locs.push(x);}}});

    /* ---- number properties (shown regardless of active state) ---- */
    let classify;
    if(spot===1)classify='one (unit)';
    else if(isPrime(spot))classify=`PRIME · prime #${primeIndex(spot)}`;
    else if(spot>=4)classify=`COMPOSITE · factors ${primeFactors(spot).join(' × ')}`;
    else classify='—';
    const inst=INST_SET.has(spot)?(INST_LABELS.get(spot)||['INSTITUTIONAL TABLE']):[];

    /* ---- cross-refs against today's date spine + numerology, even when the
       spotlighted number is "owned" by another active category ---- */
    const spine=[];
    (date?dateFigures(date):[]).forEach((f,i)=>{if(f.n===spot)spine.push(`DN spine row ${i+1} · ${f.calc}`);});
    if(dn?.vals?.[spot])spine.push(`date-numerology · ${dn.vals[spot]}`);
    if(dn?.rulerVals?.[spot])spine.push(`ruling planet · ${dn.rulerVals[spot]}`);

    /* ---- cross-refs (Tony 2026-07-22): does this batter's own life-clock /
       jersey (PLAYER), a tracked career/season stat's next milestone (RUNGS),
       or the opponent team's gematria (OPP) echo the tapped number? Raw
       equality is the strong signal; a shared digit-root is the soft bonus.
       Same crossRefsForNumber() helper the Phrase Finder rows use. Prebuilt
       into ready-to-render groups so the panel markup stays flat. ---- */
    const cr=crossRefsForNumber({
      pn:{totalDays:bday?.totalDays??null,since:bday?.since??null,until:bday?.until??null,
        years:bday?.years??null,jersey:p.jersey??null},
      sr:srf,
      opp:oppVals,
    },spot,dateRoots,spotOrigin);
    const xrefGroups=[
      ['PLAYER',cr.numerology,it=>numerologyText(it,spot,cr.numerology.targetDr)],
      ['RUNGS',cr.statRungs,it=>statRungText(it)],
      ['OPP',cr.opponent,it=>opponentText(it,spot)],
    ].map(([lbl,grp,fmt])=>{
      const rows=grp.items.filter(it=>it.rawMatch||it.softMatch)
        .map(it=>({strong:it.rawMatch,text:fmt(it)}));
      return rows.length?{lbl,rows}:null;
    }).filter(Boolean);

    return{n:spot,
      reason:a?`Active (${a.cat.toUpperCase()}): ${a.reason}`:null,
      props:{classify,inst,ds:digitSum(spot),dr:digitalRoot(spot),spine},
      xrefGroups,locs};
  },[spot,spotOrigin,activeMap,model,cascade,dn,date,bday,p,oppVals,dateRoots,srf]);

  const Grid=g=>g&&(
    <div className="grp" key={g.title}>
      <div className="grplabel">{g.title}<span className="grpcount"/></div>
      <div className="chead"><span className="w"/><div className="cvals">
        {cols.map(([,h])=><span key={h}>{h}</span>)}
      </div></div>
      {g.rows.map((r,i)=>(
        <div className="crow" key={i}>
          <span className="w">{r.label}</span>
          <div className="cvals">{r.vals.map((v,j)=>numCell(v.n,j))}</div>
        </div>
      ))}
    </div>
  );

  return(
    <>
      <div className="pcfs-scrim" onClick={dismiss}/>
      <div className={rootCls} onClick={()=>{if(spot!=null)setSpot(null);}}>

        {/* ---------- pinned stack ---------- */}
        <div className="pin" onClick={e=>e.stopPropagation()}>
          <div className="pcfs-topbar">
            <button className="pcfs-back" onClick={dismiss}
              aria-label={focusReturn==='search'?'Back to Search':'Back to Board'}>
              <span className="chev">‹</span>{focusReturn==='search'?'Search':'Board'}
            </button>
            <span className="pcfs-topname">{p.fullName}</span>
          </div>
          <div className="activebar">
            <button className={`ab-all${!lens&&spot==null?' on':''}`} onClick={goAll}>ALL</button>
            {barGroups.map(g=>(
              <div key={g.cat} className={`lensgrp${lens===g.cat?' lens-on':''}`}>
                <button className="lensname" onClick={()=>toggleLens(g.cat)}>{g.label}</button>
                <div className="lensnums">
                  {g.nums.map(n=>(
                    <button key={n} className={`ab-num${spot===n?' spot':''}`}
                      onClick={()=>toggleSpot(n)}>{n}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="testbar">
            <span className="tlabel">TEST</span>
            {OUTCOMES.map(o=>(
              <button key={o} className={`ochip${outcome===o?' sel':''}`}
                onClick={()=>setOutcome(o)}>{o==='none'?'—':o}</button>
            ))}
          </div>
          <div className="cascpin">
            <div className="casc">
              {cascade.length?cascade.map((c,i)=>(
                <button key={i} className={`cv${cls(c.n,c.origin)}`} data-n={c.n}
                  onClick={e=>{e.stopPropagation();toggleSpot(c.n,c.origin);}}>
                  <span className="n">{c.n}</span><span className="k">{c.stat}</span>
                </button>
              )):<span className="casc-empty">no outcome selected</span>}
            </div>
          </div>
        </div>

        {/* ---------- scrolling sheet ---------- */}
        <div className="scroll">
          <div className="header">
            <div className="pname">{p.fullName}</div>
            <div className="pmeta">
              {p.jersey&&<>#{p.jersey} · </>}{p.position&&<>{p.position} · </>}
              {abbr(myTeam)} vs {abbr(oppTeam)}
              {p.school&&<> · {p.school}</>}{p.jesuit&&<> <span className="j">JESUIT</span></>}
              {p.batSide&&<> · bats {p.batSide}</>}
            </div>
            {sp&&(
              <div className="pmeta" style={{marginTop:5}}>
                vs <b>{sp.fullName}</b>{spHand&&<> <span className="j">{handLabel(spHand)}</span></>}
                {oppTeam&&<> · {abbr(oppTeam)} starter</>}
              </div>
            )}
            {(row.patternHits.length>0||ev.dateNameHits.length>0||ev.dayMatches?.length>0||ev.threadHit)&&(
              <div className="badges">
                {row.patternHits.map(({pattern,res})=>(
                  <span key={pattern.id} className="pcbadge">{pattern.name} {res.hardPass}✓</span>
                ))}
                {ev.dateNameHits.length>0&&<span className="pcbadge teal">NAME=DATE</span>}
                {ev.dayMatches?.length>0&&<span className="pcbadge teal">DAY=DATE</span>}
                {ev.threadHit&&<span className="pcbadge">THREAD</span>}
              </div>
            )}
          </div>

          <div className="grp">
            <div className="grplabel">BIRTH / LIFE CLOCK<span className="grpcount"/></div>
            <div className="bignums">
              {bioReadings.map((b,i)=>(
                <div className={`bn${cls(b.value)}`} data-n={b.value} key={i}
                  onClick={e=>{e.stopPropagation();toggleSpot(b.value);}}>
                  <span className="n">{b.value.toLocaleString()}</span>
                  <div className="k">{b.label}</div>
                  <button className={`promote${promoted.has(b.value)?' on':''}`}
                    title="promote to thread candidate"
                    onClick={e=>{e.stopPropagation();addThread(b.value);}}>+</button>
                </div>
              ))}
            </div>
          </div>

          {Grid(model.nameGrid)}
          {Grid(model.teamGrid)}
          {Grid(model.oppGrid)}
          {Grid(model.pitcherGrid)}

          {(xrefRows.length>0||teamStair.length>0)&&(
            <div className="grp">
              <div className="grplabel">CONVERGENCES{sp?` — vs ${sp.lastName}`:''}
                <span className="grpcount">{xrefRows.length||''}</span></div>
              <div className="xrefs">
                {shownXref.map((c,i)=>{
                  const d=draftFromCross(c);
                  return(
                    <div className={`xref-row${cls(c.n)}`} data-n={c.n} key={i}
                      onClick={e=>{e.stopPropagation();toggleSpot(c.n);}}>
                      <b className="xn">{c.n}</b>
                      <span className="xtext">— {c.text}</span>
                      {d&&<button className="xpromote" title="add to recipe draft"
                        onClick={e=>{e.stopPropagation();addDraft(d);}}>+</button>}
                    </div>
                  );
                })}
                {xrefRows.length>XREF_CAP&&(
                  <button className="xref-more"
                    onClick={e=>{e.stopPropagation();setShowAllXref(v=>!v);}}>
                    {showAllXref?'less':`+${xrefRows.length-XREF_CAP} more`}
                  </button>
                )}
              </div>
              {teamStair.length>0&&(
                <>
                  <div className="grplabel xstair-label">TEAM STAIRCASES<span className="grpcount"/></div>
                  <div className="xrefs">
                    {teamStair.map((s,i)=>(
                      <div className={`xref-row stair${cls(s.n)}`} data-n={s.n} key={i}
                        onClick={e=>{e.stopPropagation();toggleSpot(s.n);}}>
                        <span className="xtext">team {s.k} sits <b className="xcur">{s.cur}</b> → <b className="xn">{s.n}</b>
                          <span className="xdim"> (+{s.need}) · {s.why}</span></span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grp">
            <div className="grplabel">STATS — career · season · next<span className="grpcount"/></div>
            <div className="shead"><span className="w"/><div className="sv">
              <span>CAR</span><span>SSN</span><span>+1→</span></div></div>
            {model.statsRows.map((r,i)=>(
              <div className="srow" key={i}>
                <span className="w">{r.stat}</span>
                <div className="sv">
                  {r.car!=null?numCell(r.car,'c'):<span className="dash">–</span>}
                  {r.ssn!=null?numCell(r.ssn,'s'):<span className="dash">–</span>}
                  {r.next!=null?numCell(r.next,'n',true,{stat:r.stat,scope:r.car!=null?'career':'season',offset:1}):<span className="dash nx">–</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="grp">
            <div className="grplabel">{model.splitTitle}<span className="grpcount"/></div>
            <div className="shead"><span className="w"/><div className="sv">
              {SPLIT_COLS.map(([,h])=><span key={h}>{h}</span>)}</div></div>
            {model.splitRows.map((r,i)=>(
              <div className={`srow${r.tonight?' tonight':''}${r.offhand?' offhand':''}`} key={i}>
                <span className="w">{r.label}</span>
                <div className="sv">
                  {r.vals.map((v,j)=>v!=null?numCell(v,j):<span key={j} className="dash">–</span>)}
                </div>
              </div>
            ))}
          </div>

          <div className="grp">
            <div className="grplabel">CAREER — by split{model.oppLeagueTag?` · vs ${model.oppLeagueTag} tonight`:''}<span className="grpcount"/></div>
            <div className="shead"><span className="w"/><div className="sv">
              {SPLIT_COLS.map(([,h])=><span key={h}>{h}</span>)}</div></div>
            {model.careerSplitRows.map((r,i)=>(
              <div className={`srow${r.tonight?' tonight':''}`} key={i}>
                <span className="w">{r.label}</span>
                <div className="sv">
                  {r.vals.map((v,j)=>v!=null?numCell(v,j):<span key={j} className="dash">–</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- WHY bottom sheet ---------- */}
        <div className={`why${why?' show':''}`} onClick={e=>e.stopPropagation()}>
          <button className="why-close" onClick={()=>setSpot(null)}>✕</button>
          <div className="why-num">{why?why.n:'—'}</div>
          {why?.reason&&<div className="why-reason">{why.reason}</div>}
          {why&&(
            <div className="why-props">
              <div className="why-prop"><span className="wp-k">TYPE</span>
                <span className="wp-v">{why.props.classify}</span></div>
              {why.props.inst.length>0&&(
                <div className="why-prop"><span className="wp-k">TABLE</span>
                  <span className="wp-v gold">{why.props.inst.map(l=>`= ${l}`).join('   ')}</span></div>
              )}
              <div className="why-prop"><span className="wp-k">DIGITS</span>
                <span className="wp-v">digit sum {why.props.ds} · digital root {why.props.dr}</span></div>
              {why.props.spine.length>0&&(
                <div className="why-prop"><span className="wp-k">SPINE</span>
                  <span className="wp-v teal">{why.props.spine.join('   ')}</span></div>
              )}
              {why.xrefGroups?.map(g=>(
                <div className="why-prop" key={g.lbl}><span className="wp-k">{g.lbl}</span>
                  <span className="wp-v">
                    {g.rows.map((r,i)=>(
                      <span key={i} className={r.strong?'xref-strong':'xref-soft'}>
                        {i>0?'   ':''}{r.text}
                      </span>
                    ))}
                  </span></div>
              ))}
            </div>
          )}
          <div className="why-locs">
            {why&&(
              <>
                <div className="why-loc" style={{color:'var(--faint)'}}>
                  {why.locs.length} place{why.locs.length===1?'':'s'} on this sheet
                </div>
                {why.locs.map((l,i)=>(
                  <div className="why-loc" key={i}><b>{l.section}</b>{l.item?` — ${l.item}`:''}</div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

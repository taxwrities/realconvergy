/* ================================================================
   Decode Chat — context bundle assembler (DECODE-CHAT.md blocks 1-7).
   Everything the model may cite is computed HERE (or upstream in the
   store/engine) and serialized to text — the model never does cipher
   math. Block order is cache order: static first (1h), daily next,
   per-game last. Exactly 4 cache breakpoints (API max).
================================================================ */
import {INSTRUCTIONS} from './instructions.js';
import PATTERNS from '../../../../data/hubbard/patterns.json' with {type:'json'};
import {calcAll} from '../engine/gematria.js';
import {primeIndex,compositeIndex} from '../engine/numbers.js';
import {daysBetween,dateFigures} from '../engine/clocks.js';

const RAW='https://raw.githubusercontent.com/taxwrities/realconvergy/main';
const VOCAB_CAP=300; // top entries by mentions (spec block 2)

async function rawFetch(path){
  try{
    const ctl=new AbortController();
    const t=setTimeout(()=>ctl.abort(),5000);
    const r=await fetch(`${RAW}/${path}`,{signal:ctl.signal});
    clearTimeout(t);
    return r.ok?await r.text():null;
  }catch{return null}
}

/* ---------- block 2: hubbard vocab (static import, bundled) ---------- */
function vocabBlock(){
  const rows=[];
  for(const [n,entries] of Object.entries(PATTERNS.numbers||{}))
    for(const e of entries)
      rows.push({n:+n,phrase:e.phrase,ciphers:e.ciphers.join('/'),m:e.mentions||1});
  rows.sort((a,b)=>b.m-a.m);
  const top=rows.slice(0,VOCAB_CAP);
  const byN=new Map();
  for(const r of top){
    if(!byN.has(r.n))byN.set(r.n,[]);
    byN.get(r.n).push(`${r.phrase}(${r.ciphers}×${r.m})`);
  }
  const lines=[...byN.entries()].sort((a,b)=>a[0]-b[0])
    .map(([n,ps])=>`${n} = ${ps.join(', ')}`);
  return `HUBBARD VOCAB (top ${top.length} sourced phrase↔number entries; conventions: spans exclusive unless marked inclusive, mirror pairs read both ways, prime/composite depth chains only when the bundle carries the index):\n${lines.join('\n')}`;
}

/* ---------- ciphers: 4 core + prime/composite index (blocks 5) ---------- */
const CORE=['Ord','Red','Rev','RR'];
function idxTag(n){
  const p=primeIndex(n);if(p>0)return`[${n}=p#${p}]`;
  const c=compositeIndex(n);if(c>0)return`[${n}=c#${c}]`;
  return'';
}
function cipherLine(label,s){
  if(!s)return null;
  const v=calcAll(s);
  return `${label} "${s}": `+CORE.map(c=>`${c}=${v[c]}${idxTag(v[c])}`).join(' ');
}

/* ---------- spans (block 6) ---------- */
function spanLine(p,date){
  const parts=[];
  if(p.birthDate){
    parts.push(`life ${daysBetween(p.birthDate,date)}d`);
    const [,m,d]=p.birthDate.split('-');
    const y=+date.slice(0,4);
    let last=`${y}-${m}-${d}`;
    if(last>date)last=`${y-1}-${m}-${d}`;
    const next=last===`${y}-${m}-${d}`?`${y+1}-${m}-${d}`:`${y}-${m}-${d}`;
    parts.push(`bday +${daysBetween(last,date)}d / -${daysBetween(date,next)}d`);
  }
  if(p.debutDate)parts.push(`career ${daysBetween(p.debutDate,date)}d`);
  return parts.join(', ');
}

/* ---------- stats (block 4) ---------- */
const STATK=[['PA','plateAppearances'],['AB','atBats'],['H','hits'],['TB','totalBases'],
  ['1B','1B'],['2B','doubles'],['3B','triples'],['HR','homeRuns'],['RBI','rbi'],
  ['R','runs'],['BB','baseOnBalls'],['SB','stolenBases'],['SO','strikeOuts']];
function statLine(st){
  if(!st)return null;
  const out=STATK.map(([k,src])=>st[src]!=null?`${k} ${st[src]}`:null).filter(Boolean);
  return out.length?out.join(', '):null;
}

function playerBlock(p,date){
  if(!p)return null;
  const head=[
    p.fullName,
    p.position?`(${p.position}${p.jersey!=null?` #${p.jersey}`:''}${p.batSide?`, bats ${p.batSide}`:''})`:'',
    p.birthDate?`b.${p.birthDate}`:'',p.debutDate?`debut ${p.debutDate}`:'',
    p.school?`school: ${p.school}${p.jesuit?' [JESUIT]':''}`:'',
    p.birthCity?`from ${p.birthCity}${p.birthStateProvince?', '+p.birthStateProvince:''}`:'',
  ].filter(Boolean).join(' ');
  const lines=[head];
  const sp=spanLine(p,date);if(sp)lines.push(`  spans: ${sp}`);
  const cf=cipherLine('  full',p.fullName);if(cf)lines.push(cf);
  if(p.lastName&&p.lastName!==p.fullName){const cl2=cipherLine('  last',p.lastName);if(cl2)lines.push(cl2)}
  if(p.legalFirstName){const lg=cipherLine('  legal-first',p.legalFirstName);if(lg)lines.push(lg)}
  const se=statLine(p.season);if(se)lines.push(`  season: ${se}`);
  const ca=statLine(p.career);if(ca)lines.push(`  career: ${ca}`);
  return lines.join('\n');
}

/* ---------- Tier-3 rungs sheet (LAYER-SCANNER-V2 change 5) ----------
   The machine sheet for THIS game: every batter, every counter incl. SO,
   depth + provenance tags, pitcher K/out/W/L ladders. No top-N trim — the
   Neto rule. Zero-hit batters are named so the model knows they were scanned
   (denominator honesty), not silently absent. */
function rungsSection(rungs,away,home){
  if(!rungs)return null;
  const gm=(rungs.games||[]).find(g=>g.matchup===`${away} @ ${home}`);
  if(!gm)return null;
  const fh=h=>(h||[]).slice(0,2).map(x=>`[d${x.depth}] ${x.prov}`).join(' ; ');
  const lines=[],quiet=[];
  for(const pl of gm.players||[]){
    const bits=[];
    for(const pj of pl.projections||[])
      bits.push(`${pj.scope} ${pj.stat} ${pj.base}->${pj.target} (${pj.class}) ${fh(pj.hits)}`);
    for(const ex of pl.exclusive||[])
      bits.push(`EXACT-FIT ${ex.outcome}: ${ex.scope} TB ${ex.base}->${ex.target} ${fh(ex.hits)}`);
    for(const f of (pl.nameFlags||[]).filter(f=>f.depth<=2))
      bits.push(`NAME ${f.part} ${f.cipher}=${f.n} [d${f.depth}] ${f.prov} (decoration, never a leg)`);
    for(const pk of pl.parked||[])bits.push(`PARKED ${pk} (decoration)`);
    for(const m of pl.markedMan||[])bits.push(`MARKED MAN ${m}`);
    for(const l of pl.pitcherLadder||[])
      bits.push(`PITCH ${l.scope} ${l.stat} ${l.base}->${l.target} ${fh(l.hits)}`);
    if(bits.length)lines.push(`${pl.name} (${pl.team||'?'}):\n  ${bits.join('\n  ')}`);
    else quiet.push(pl.name);
  }
  if(quiet.length)lines.push(`Scanned, no rung hits: ${quiet.join(', ')}`);
  return lines.length?lines.join('\n'):null;
}

/* ---------- board section extraction (block 7 + prior ledger) ---------- */
function boardSection(text,away,home){
  if(!text)return null;
  const marker=`## ${away} @ ${home}`;
  const i=text.indexOf(marker);
  if(i<0)return null;
  const j=text.indexOf('\n## ',i+marker.length);
  return text.slice(i,j<0?undefined:j).trim();
}
function boardHeader(text){
  if(!text)return null;
  const cut=text.indexOf('\n## ');
  return(cut<0?text:text.slice(0,cut)).trim();
}

const prevISO=date=>{
  const d=new Date(date+'T12:00:00');d.setDate(d.getDate()-1);
  return d.toISOString().slice(0,10);
};

/* ================================================================ */
export async function buildBundle({game,people,dn,date,contextChips}){
  const away=game.away.abbrev,home=game.home.abbrev;

  /* block 3: daily theme — Zach file + app day field */
  const themeRaw=await rawFetch(`data/themes/board-theme-${date}.json`);
  let themeTxt='(no board-theme file for this date)';
  if(themeRaw){
    try{
      const t=JSON.parse(themeRaw);
      themeTxt=`Zach numbers: ${(t.numbers||[]).join(', ')}${t.notes?`\nNotes: ${t.notes}`:''}`;
      /* entity threads (specs/entity-threads.md): curated field members — the
         model cites the thread label as provenance, e.g. "124 [Oppenheimer ←
         Hiroshima 81st]". Expired threads are already dropped by the scanner;
         listed here as authored so the labels are quotable. */
      const ths=(t.entity_threads||[]).filter(th=>!th.expiry||date<=th.expiry);
      if(ths.length){
        themeTxt+='\nENTITY THREADS (curated, field members; cite label as provenance):';
        for(const th of ths){
          const prov=th.provenance||{};
          const vals=(th.values||[]).map(v=>{
            const k=Object.keys(prov).find(k=>k.split('/').map(s=>s.trim()).includes(String(v)));
            return k?`${v} (${prov[k]})`:String(v);
          }).join(', ');
          themeTxt+=`\n- ${th.label} [hook: ${th.hook||'?'}${th.expiry?`, expires ${th.expiry}`:''}]: ${vals}`;
        }
      }
    }catch{/* leave placeholder */}
  }
  const figures=dateFigures(date).map(f=>`${f.n} (${f.calc})${f.top?' [top]':''}`).join('  ');
  const chips=(contextChips||[]).map(c=>`${c.n} ${c.label} [${c.kind}]`).join('; ');
  const themeBlock=`DAY FIELD — ${date}${dn?.dayName?` (${dn.dayName}${dn.ruler?`/${dn.ruler}`:''})`:''}
Date numerology: ${figures}
THEME (daily): ${themeTxt}
Active day chips (app-computed): ${chips||'none loaded'}`;

  /* blocks 4-7: per-game */
  const ids=[...new Set([...(game.awayIds||[]),...(game.homeIds||[]),game.awaySP,game.homeSP].filter(Boolean))];
  const roster=side=>((side==='away'?game.awayIds:game.homeIds)||[])
    .map(id=>playerBlock(people[id],date)).filter(Boolean).join('\n');
  const sps=[['AWAY SP',game.awaySP],['HOME SP',game.homeSP]]
    .map(([lbl,id])=>id&&people[id]?`${lbl}:\n${playerBlock(people[id],date)}`:null)
    .filter(Boolean).join('\n');

  const teamCiphers=[game.away,game.home].flatMap(t=>
    [cipherLine('team',t.name),cipherLine('short',t.teamName),cipherLine('city',t.locationName)])
    .filter(Boolean).join('\n');
  const venueCipher=game.venue?cipherLine('venue',game.venue):null;

  const [board,prior,rungsRaw]=await Promise.all([
    rawFetch(`data/boards/${date}-themed.txt`).then(t=>t||rawFetch(`data/boards/${date}.txt`)),
    rawFetch(`data/boards/${prevISO(date)}-themed.txt`).then(t=>t||rawFetch(`data/boards/${prevISO(date)}.txt`)),
    rawFetch(`data/boards/${date}-rungs.json`),
  ]);
  let rungsTxt=null;
  if(rungsRaw){
    try{rungsTxt=rungsSection(JSON.parse(rungsRaw),away,home)}catch{/* board txt still covers */}
  }
  const sect=boardSection(board,away,home);
  const priorAway=prior?[...prior.matchAll(/\n## [^\n]+/g)].map(m=>m[0].trim())
    .filter(h=>h.includes(away)||h.includes(home))
    .map(h=>{const[a,b]=h.replace('## ','').split(' @ ');return boardSection(prior,a,b)})
    .filter(Boolean).join('\n\n'):null;

  const gameBlock=`GAME — ${away} @ ${home}${game.venue?` · ${game.venue}`:''} · ${date} · game #${game.gameNumber?.away||'?'}/${game.gameNumber?.home||'?'}
Records: ${away} ${game.record?.away?`${game.record.away.wins}-${game.record.away.losses}`:'?'} · ${home} ${game.record?.home?`${game.record.home.wins}-${game.record.home.losses}`:'?'}

TEAM/VENUE CIPHERS:
${teamCiphers}${venueCipher?`\n${venueCipher}`:''}

PROBABLES:
${sps||'(no probables)'}

${away} LINEUP:
${roster('away')||'(no lineup)'}

${home} LINEUP:
${roster('home')||'(no lineup)'}

TIER-3 RUNG SHEET — this game (${date}, machine sheet, gospel [board]):
${rungsTxt||'(no rungs.json published for this date — fall back to the board text below)'}

LANDINGS BOARD — this game (${date}):
${sect||'(no board section for this game — say so if asked)'}
${board?`\nBOARD FIELD KEY:\n${boardHeader(board)}`:''}
${priorAway?`\nPRIOR DAY (${prevISO(date)}) — same teams, staircase continuity:\n${priorAway}`:''}`;

  const systemBlocks=[
    {text:INSTRUCTIONS,cache:'1h'},
    {text:vocabBlock(),cache:'1h'},
    {text:themeBlock,cache:'5m'},
    {text:gameBlock,cache:'5m'},
  ];
  return{
    systemBlocks,
    serialized:systemBlocks.map(b=>b.text).join('\n\n————————\n\n'),
    playerCount:ids.length,
  };
}

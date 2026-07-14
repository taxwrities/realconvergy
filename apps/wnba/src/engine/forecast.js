/* ================================================================
   forecast — the Landings method over the BDL WNBA schedule.
   Walk upcoming games per player for date-dependent patterns at
   floored per-game-rate accrual; emit cards where ≥2 hard converge.
   Frozen-card discipline: conditions freeze at generation.
================================================================ */
import {evalPattern,isDateDependent,summarizeCondition} from './patterns.js';

const PROXY='/.netlify/functions/bdl';
const etDate=iso=>new Date(iso).toLocaleDateString('en-CA',{timeZone:'America/New_York'});

async function bdl(params){
  const qs=new URLSearchParams(params.entries?params:Object.entries(params).flatMap(([k,v])=>Array.isArray(v)?v.map(x=>[k,x]):[[k,v]]));
  const r=await fetch(`${PROXY}?${qs}`);
  if(!r.ok)throw new Error(`${r.status} schedule range`);
  return r.json();
}

/* schedule window: one games call covering every date in the range. */
export async function fetchScheduleRange(startDate,endDate){
  const dates=[];
  for(let d=startDate;d<=endDate;d=addDays(d,1))dates.push(d);
  let out=[],cursor=null,guard=0;
  do{
    const qs=new URLSearchParams({path:'games',per_page:100});
    dates.forEach(x=>qs.append('dates[]',x));
    if(cursor!=null)qs.append('cursor',cursor);
    const r=await fetch(`${PROXY}?${qs}`);
    if(!r.ok)throw new Error(`${r.status} schedule range`);
    const j=await r.json();
    out=out.concat(j.data||[]);
    cursor=j.meta&&j.meta.next_cursor;
  }while(cursor!=null&&++guard<20);
  const byTeam={};
  out.forEach(g=>{
    const d=etDate(g.date);
    [['home',g.home_team,g.visitor_team],['away',g.visitor_team,g.home_team]].forEach(([side,t,opp])=>{
      if(!t)return;
      (byTeam[t.id]=byTeam[t.id]||[]).push({date:d,side,opp:(opp&&(opp.full_name||opp.name))||'',gameNumber:null});
    });
  });
  Object.values(byTeam).forEach(a=>a.sort((x,y)=>x.date<y.date?-1:1));
  return byTeam;
}

/* realistic accrual: per-game season rates, floored — a floor, never a promise */
const KEYS=['FG','PTS','REB','AST','3PM','FT','PRA'];
export function projectStats(p,gamesAhead){
  const g=+(p.season?.gamesPlayed||0);
  if(!g||!gamesAhead)return{season:p.season,career:p.career};
  const proj=obj=>{
    if(!obj)return obj;
    const out={...obj};
    for(const k of KEYS)if(obj[k]!=null)out[k]=+obj[k]+Math.floor((+obj[k]/g)*gamesAhead);
    if(out.gamesPlayed!=null)out.gamesPlayed=+obj.gamesPlayed+gamesAhead;
    if(out.GP!=null)out.GP=+obj.GP+gamesAhead;
    return out;
  };
  const seasonProj=proj(p.season);
  const career={...p.career};
  if(p.career)for(const k of Object.keys(career))
    if(p.season?.[k]!=null&&seasonProj?.[k]!=null&&typeof career[k]==='number')
      career[k]=+p.career[k]+(+seasonProj[k]-+p.season[k]);
  return{season:seasonProj,career};
}

export function addDays(dstr,n){
  const d=new Date(dstr+'T12:00:00');
  d.setDate(d.getDate()+n);
  return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* the walk. ctxFactory(playerRow, sched, projected) → engine ctx */
export function runForecast({patterns,roster,fromDate,days,scheduleByTeam,ctxFactory}){
  const datePatterns=patterns.filter(p=>p.enabled&&isDateDependent(p));
  const cards=[];
  roster.forEach(row=>{
    const sched=(scheduleByTeam[row.teamId]||[]).filter(s=>s.date>fromDate&&s.date<=addDays(fromDate,days));
    datePatterns.forEach(pat=>{
      const window=[];
      sched.forEach((s,idx)=>{
        const projected=projectStats(row.p,idx+1);
        const ctx=ctxFactory(row,s,projected);
        const res=evalPattern(pat,ctx);
        window.push({date:s.date,hard:res.hardPass,soft:res.softPass,match:res.match,res});
      });
      window.forEach((w,i)=>{
        if(w.match&&w.hard>=2){
          cards.push({
            id:`${pat.id}|${row.p.id}|${w.date}`,
            pattern:pat.name,patternId:pat.id,lane:pat.lane,
            player:row.p.fullName,playerId:row.p.id,team:row.teamName,
            date:w.date,hard:w.hard,soft:w.soft,
            summary:pat.conditions.map(summarizeCondition).join(' AND '),
            evidence:w.res.details.filter(d=>d.pass).flatMap(d=>d.matches.slice(0,2).map(m=>`${m.left} = ${m.right}`)),
            window:window.slice(Math.max(0,i-2),i+3).map(x=>({date:x.date,count:x.hard+x.soft})),
            frozenAt:new Date().toISOString(),
          });
        }
      });
    });
  });
  return cards.sort((a,b)=>a.date<b.date?-1:1);
}

/* grading vs frozen card via the game log on that date.
   FB lane grades as "made a field goal" — a floor proxy; true first-basket
   grading needs play-by-play, which BDL does not expose. */
export async function gradeForecast(card,season){
  const qs=new URLSearchParams({path:'player_stats',per_page:100});
  qs.append('player_ids[]',card.playerId);
  qs.append('seasons[]',season);
  const r=await fetch(`${PROXY}?${qs}`);
  if(!r.ok)throw new Error(`${r.status} gameLog`);
  const d=await r.json();
  const logs=d.data||[];
  const dayLog=logs.find(s=>s.game&&etDate(s.game.date)===card.date);
  if(!dayLog)return{graded:true,result:'NO GAME',detail:'no game log entry that date'};
  const key={FB:'fgm',PTS:'pts',REB:'reb',AST:'ast','3PM':'fg3m',FT:'ftm'}[card.lane]||'fgm';
  const got=card.lane==='PRA'?(+(dayLog.pts||0)+ +(dayLog.reb||0)+ +(dayLog.ast||0)):+(dayLog[key]||0);
  return{graded:true,result:got>0?'HIT':'MISS',
    detail:`${card.lane}: ${got} on ${card.date}${card.lane==='FB'?' (FG-made proxy — pbp not available)':''}`};
}

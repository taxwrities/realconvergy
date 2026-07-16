/* ================================================================
   forecast — the Landings method (LAYOUT-SPEC §6). Walk the upcoming
   schedule per batter for date-dependent patterns; resolve each
   date's counters at realistic accrual; emit cards where ≥2 hard
   conditions converge. Frozen-card discipline: conditions freeze
   when generated; grading compares against the frozen card.
================================================================ */
import {evalPattern,isDateDependent,summarizeCondition} from './patterns.js';
import {deriveStats} from './rungs.js';

const API='https://statsapi.mlb.com/api/v1';

/* team schedule window: one call covers the whole slate's teams */
export async function fetchScheduleRange(startDate,endDate){
  const r=await fetch(`${API}/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}`);
  if(!r.ok)throw new Error(r.status+' schedule range');
  const d=await r.json();
  const byTeam={};
  (d.dates||[]).forEach(day=>{
    day.games.forEach(g=>{
      [['home',g.teams.home],['away',g.teams.away]].forEach(([side,t])=>{
        const id=t.team.id;
        (byTeam[id]=byTeam[id]||[]).push({date:day.date,side,
          opp:(side==='home'?g.teams.away:g.teams.home).team.name,
          gameNumber:(t.leagueRecord?.wins||0)+(t.leagueRecord?.losses||0)+1});
      });
    });
  });
  return byTeam;
}

/* realistic accrual: per-game season rates, floored — a projection is a
   floor for staircase landings, never a promise */
export function projectStats(p,gamesAhead){
  const g=+(p.season?.gamesPlayed||0);
  if(!g||!gamesAhead)return{season:p.season,career:p.career};
  const proj=obj=>{
    if(!obj)return obj;
    const out={...obj};
    for(const k of['strikeOuts','hits','homeRuns','doubles','triples','1B','XBH','rbi','baseOnBalls','totalBases','atBats','plateAppearances'])
      if(obj[k]!=null)out[k]=+obj[k]+Math.floor((+obj[k]/g)*gamesAhead);
    return out;
  };
  const seasonProj=proj(p.season);
  // career advances by the same projected accrual
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

/* the walk. ctxFactory(batterRow, dateISO, sched, projected) → engine ctx */
export function runForecast({patterns,roster,fromDate,days,scheduleByTeam,ctxFactory}){
  const datePatterns=patterns.filter(p=>p.enabled&&isDateDependent(p));
  const cards=[];
  roster.forEach(row=>{
    const teamId=row.teamId;
    const sched=(scheduleByTeam[teamId]||[]).filter(s=>s.date>fromDate&&s.date<=addDays(fromDate,days));
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

/* grading vs frozen card: did the lane stat actually land that day?
   Uses the season gameLog (splits carry date + stat). */
export async function gradeForecast(card,season){
  const r=await fetch(`${API}/people/${card.playerId}/stats?stats=gameLog&group=hitting&season=${season}`);
  if(!r.ok)throw new Error(r.status+' gameLog');
  const d=await r.json();
  const logs=d.stats?.[0]?.splits||[];
  const dayLog=logs.find(s=>s.date===card.date);
  if(!dayLog)return{graded:true,result:'NO GAME',detail:'no game log entry that date'};
  const key={HR:'homeRuns',TB:'totalBases',K:'strikeOuts',H:'hits','1B':'1B',XBH:'XBH',RBI:'rbi',
    BB:'baseOnBalls','2B':'doubles','3B':'triples'}[card.lane]||'homeRuns';
  const got=+(deriveStats(dayLog.stat)?.[key]||0);
  return{graded:true,result:got>0?'HIT':'MISS',detail:`${card.lane}: ${got} on ${card.date}`};
}

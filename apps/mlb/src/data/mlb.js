/* ================================================================
   mlb — MLB Stats API pipeline (no auth; CORS is open client-side).
   Hydrate syntax live-verified 2026-07-09 in the scanner build:
   careerStatSplits/statSplits + sitCodes=[h,a] return venue splits.
   House rule: API totals exclude the current day (entering counts).
================================================================ */
const API='https://statsapi.mlb.com/api/v1';

async function jget(url){
  const r=await fetch(url);
  if(!r.ok)throw new Error(`${r.status} ${url}`);
  return r.json();
}

/* Season meta → "Day N of MLB season". */
export async function fetchSeasonInfo(season){
  const d=await jget(`${API}/seasons?sportId=1&season=${season}`);
  const s=d.seasons?.[0];
  return s?{start:s.regularSeasonStartDate,end:s.regularSeasonEndDate}:null;
}

/* Full slate: schedule + teams + lineups (roster fallback) + people. */
export async function fetchSlate(dstr,onProgress){
  const prog=onProgress||(()=>{});
  const season=dstr.slice(0,4);
  prog('Schedule…');
  const sched=await jget(`${API}/schedule?sportId=1&date=${dstr}&hydrate=probablePitcher,lineups,venue`);
  const rawGames=sched.dates?.[0]?.games||[];
  if(!rawGames.length)return{games:[],people:{},teamStats:{}};
  const games=rawGames.map(g=>({
    pk:g.gamePk,
    home:{id:g.teams.home.team.id,name:g.teams.home.team.name},
    away:{id:g.teams.away.team.id,name:g.teams.away.team.name},
    venue:g.venue?.name,
    status:g.status?.abstractGameState||'',
    gameNumber:{home:(g.teams.home.leagueRecord?.wins||0)+(g.teams.home.leagueRecord?.losses||0)+1,
      away:(g.teams.away.leagueRecord?.wins||0)+(g.teams.away.leagueRecord?.losses||0)+1},
    record:{home:g.teams.home.leagueRecord||null,away:g.teams.away.leagueRecord||null},
    homeSP:g.teams.home.probablePitcher?.id||null,
    awaySP:g.teams.away.probablePitcher?.id||null,
    homeIds:(g.lineups?.homePlayers||[]).map(x=>x.id),
    awayIds:(g.lineups?.awayPlayers||[]).map(x=>x.id),
    projected:false,
  }));
  prog('Teams…');
  const teamIds=[...new Set(games.flatMap(g=>[g.home.id,g.away.id]))];
  const tdata=await jget(`${API}/teams?teamIds=${teamIds.join(',')}&sportId=1`);
  const tmap={};
  tdata.teams.forEach(t=>{tmap[t.id]={teamName:t.teamName,locationName:t.locationName,
    abbrev:t.abbreviation||'',league:t.league?.id||null,venueName:t.venue?.name||''}});
  games.forEach(g=>{Object.assign(g.home,tmap[g.home.id]||{});Object.assign(g.away,tmap[g.away.id]||{})});
  // lineup fallback → active roster position players (keep TWP), tag projected
  for(const g of games){
    for(const side of['home','away']){
      if(!g[side+'Ids'].length){
        prog(`Roster ${g[side].teamName}…`);
        const r=await jget(`${API}/teams/${g[side].id}/roster?rosterType=active`);
        g[side+'Ids']=r.roster
          .filter(x=>x.position.type!=='Pitcher'||x.position.abbreviation==='TWP')
          .map(x=>x.person.id);
        g.projected=true;
      }
    }
  }
  // bulk people: batters + probable pitchers (career, season, venue splits)
  const batterIds=[...new Set(games.flatMap(g=>[...g.homeIds,...g.awayIds]))];
  const spIds=[...new Set(games.flatMap(g=>[g.homeSP,g.awaySP]).filter(Boolean))];
  const allIds=[...new Set([...batterIds,...spIds])];
  const people={};
  for(let i=0;i<allIds.length;i+=50){
    prog(`Players ${Math.min(i+50,allIds.length)}/${allIds.length}…`);
    const chunk=allIds.slice(i,i+50);
    const d=await jget(`${API}/people?personIds=${chunk.join(',')}&season=${season}&hydrate=stats(group=[hitting],type=[career,season,careerStatSplits,statSplits],sitCodes=[h,a],season=${season})`);
    d.people.forEach(pp=>{
      const rec={id:pp.id,fullName:pp.fullName,birthDate:pp.birthDate,
        lastName:pp.lastName||pp.fullName.split(' ').slice(-1)[0],
        jersey:pp.primaryNumber?+pp.primaryNumber:null,
        legalName:pp.fullFMLName&&pp.fullFMLName!==pp.fullName?pp.fullFMLName:null,
        position:pp.primaryPosition?.abbreviation||'',split:{}};
      (pp.stats||[]).forEach(st=>{
        const tn=st.type.displayName;
        if(tn==='career'){const s=st.splits?.[0]?.stat;if(s)rec.career=s}
        else if(tn==='season'){const s=st.splits?.[0]?.stat;if(s)rec.season=s}
        else if(tn==='careerStatSplits'||tn==='statSplits'){
          (st.splits||[]).forEach(sp=>{
            const side=sp.split?.code;if(side!=='h'&&side!=='a')return;
            rec.split[(tn==='careerStatSplits'?'career':'season')+'-'+(side==='h'?'home':'away')]=sp.stat;
          });
        }
      });
      people[pp.id]=rec;
    });
  }
  // team season hitting totals → team staircases (next R/AB/PA/TB)
  prog('Team totals…');
  const teamStats={};
  await Promise.all(teamIds.map(async id=>{
    try{
      const d=await jget(`${API}/teams/${id}/stats?stats=season&group=hitting&season=${season}`);
      const s=d.stats?.[0]?.splits?.[0]?.stat;
      if(s)teamStats[id]={R:s.runs,AB:s.atBats,PA:s.plateAppearances,TB:s.totalBases,H:s.hits,HR:s.homeRuns};
    }catch{/* staircases just absent for this team */}
  }));
  prog('');
  return{games,people,teamStats};
}

/* ================================================================
   Deep fetch (per game, on demand — never slate-wide, house rule).
   All endpoints live-verified: vsTeamTotal (no season = career),
   byMonth + byDayOfWeek (current season), sitCodes val/vnl (league).
   Mutates people[id].deep and returns count enriched.
================================================================ */
const MONTH_NAMES=['','January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_NAMES=['','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export async function deepFetchGame(game,people,dstr,onProgress){
  const prog=onProgress||(()=>{});
  const season=dstr.slice(0,4),gameMonth=+dstr.slice(5,7);
  const dow=new Date(dstr+'T12:00:00').getDay()+1; // statsapi dayOfWeek is 1=Sunday
  const ids=[...game.homeIds,...game.awayIds].filter(id=>{const p=people[id];return p&&(p.career||p.season)});
  // one bulk call for league splits (both sitCodes; pick per side)
  for(let i=0;i<ids.length;i+=50){
    const chunk=ids.slice(i,i+50);
    prog(`Deep: league splits ${Math.min(i+50,ids.length)}/${ids.length}…`);
    const d=await jget(`${API}/people?personIds=${chunk.join(',')}&season=${season}&hydrate=stats(group=[hitting],type=[careerStatSplits,statSplits],sitCodes=[val,vnl],season=${season})`);
    d.people.forEach(pp=>{
      const p=people[pp.id];if(!p)return;
      const isHome=game.homeIds.includes(pp.id);
      const opp=isHome?game.away:game.home;
      const sit=opp.league===103?'val':opp.league===104?'vnl':null;
      if(!sit)return;
      const deep=p.deep=p.deep||{};
      deep.leagueTag=sit==='val'?'AL':'NL';
      (pp.stats||[]).forEach(st=>{
        (st.splits||[]).forEach(sp=>{
          if(sp.split?.code!==sit)return;
          if(st.type.displayName==='careerStatSplits')deep.leagueCareer=sp.stat;
          else if(st.type.displayName==='statSplits')deep.leagueSeason=sp.stat;
        });
      });
    });
  }
  // per player: career vs opponent + this month + day-of-week table
  let done=0;
  for(const id of ids){
    const p=people[id];
    const isHome=game.homeIds.includes(id);
    const opp=isHome?game.away:game.home;
    prog(`Deep: vs-team/month/dow ${++done}/${ids.length}…`);
    try{
      const r=await jget(`${API}/people/${id}/stats?stats=vsTeamTotal,byMonth,byDayOfWeek&group=hitting&opposingTeamId=${opp.id}`);
      const deep=p.deep=p.deep||{};
      (r.stats||[]).forEach(st=>{
        const tn=st.type.displayName;
        if(tn==='vsTeamTotal'){
          const s=st.splits?.[0]?.stat;
          if(s){deep.vsOpp=s;deep.oppTag=opp.abbrev||opp.teamName}
        }else if(tn==='byMonth'){
          const sp=(st.splits||[]).find(x=>+x.month===gameMonth&&String(x.season)===season);
          if(sp){deep.month=sp.stat;deep.monthTag=MONTH_NAMES[gameMonth]}
        }else if(tn==='byDayOfWeek'){
          deep.dowAll={};
          (st.splits||[]).forEach(x=>{if(x.dayOfWeek!=null)deep.dowAll[+x.dayOfWeek]=x.stat});
          if(deep.dowAll[dow]){deep.dow=deep.dowAll[dow];deep.dowTag=DOW_NAMES[dow]}
        }
      });
    }catch{/* degrade per player */}
  }
  game.deepDone=true;
  prog('');
  return done;
}

/* ================================================================
   mlb — MLB Stats API pipeline (no auth; CORS is open client-side).
   Hydrate syntax live-verified 2026-07-09 in the scanner build:
   careerStatSplits/statSplits + sitCodes=[h,a] return venue splits.
   House rule: API totals exclude the current day (entering counts).
================================================================ */
import {deriveStats} from '../engine/rungs.js';
import {lineageFor} from './teams.js';
import {isJesuit} from '../engine/jesuit.js';
import H2H from '../../../../data/mlb-h2h.json';

const API='https://statsapi.mlb.com/api/v1';

async function jget(url){
  const r=await fetch(url);
  if(!r.ok)throw new Error(`${r.status} ${url}`);
  return r.json();
}

/* ---------------- carousel / list sort (Tony 2026-07-22) ----------------
   One source of truth for game order everywhere the slate is rendered:
   in-progress first, then upcoming, then finished at the bottom. Edge cases
   per spec: Delayed/Suspended count as in-progress (still worth attention);
   Postponed counts as finished (bottom). Uses the same status fields the app
   already reads from statsapi — abstractGameState (g.status) + detailedState. */
export function gameBucket(g){
  const a=(g.status||'').toLowerCase();          // abstractGameState
  const d=(g.detailedState||'').toLowerCase();   // finer detailedState
  // finished — final / game over / completed early / postponed → bottom
  if(a==='final'||d.includes('final')||d.includes('game over')
     ||d.includes('completed early')||d.includes('postponed'))return 2;
  // in progress — live / warmup / delayed / suspended → top
  if(a==='live'||d.includes('in progress')||d.includes('warmup')
     ||d.includes('delayed')||d.includes('suspended'))return 0;
  // upcoming — preview / scheduled / pre-game
  return 1;
}
/* Stable sort: bucket first, then first-pitch time (gameDate ISO string sorts
   chronologically). In-progress + upcoming ascending; finished descending so
   the most recently started game reads first among the dimmed tail. */
export function sortGames(games){
  return games.slice().sort((a,b)=>{
    const ba=gameBucket(a),bb=gameBucket(b);
    if(ba!==bb)return ba-bb;
    const ta=a.gameDate||'',tb=b.gameDate||'';
    if(ta===tb)return 0;
    return ba===2?(ta<tb?1:-1):(ta<tb?-1:1);
  });
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
    detailedState:g.status?.detailedState||'',
    gameDate:g.gameDate||null, // first-pitch ISO — carousel/list sort key
    gameNumber:{home:(g.teams.home.leagueRecord?.wins||0)+(g.teams.home.leagueRecord?.losses||0)+1,
      away:(g.teams.away.leagueRecord?.wins||0)+(g.teams.away.leagueRecord?.losses||0)+1},
    record:{home:g.teams.home.leagueRecord||null,away:g.teams.away.leagueRecord||null},
    homeSP:g.teams.home.probablePitcher?.id||null,
    awaySP:g.teams.away.probablePitcher?.id||null,
    homeIds:(g.lineups?.homePlayers||[]).map(x=>x.id),
    awayIds:(g.lineups?.awayPlayers||[]).map(x=>x.id),
    proj:{home:false,away:false},
    projected:false,
  }));
  prog('Teams…');
  const teamIds=[...new Set(games.flatMap(g=>[g.home.id,g.away.id]))];
  const tdata=await jget(`${API}/teams?teamIds=${teamIds.join(',')}&sportId=1`);
  const tmap={};
  tdata.teams.forEach(t=>{tmap[t.id]={teamName:t.teamName,locationName:t.locationName,
    abbrev:t.abbreviation||'',league:t.league?.id||null,venueName:t.venue?.name||''}});
  games.forEach(g=>{
    Object.assign(g.home,tmap[g.home.id]||{});Object.assign(g.away,tmap[g.away.id]||{});
    g.home.lineage=lineageFor(g.home.id);g.away.lineage=lineageFor(g.away.id);
  });
  // per-pair current-season series → H2H live top-up past the static file
  prog('H2H series…');
  await Promise.all(games.map(async g=>{
    try{
      const d=await jget(`${API}/schedule?sportId=1&season=${season}&teamId=${g.home.id}&opponentId=${g.away.id}&gameTypes=R&fields=dates,date,games,gamePk,officialDate,gameType,status,abstractGameState,teams,home,away,team,id,score`);
      const seen=new Set(),series=[];
      (d.dates||[]).forEach(day=>(day.games||[]).forEach(x=>{
        if(x.status?.abstractGameState!=='Final')return;
        const hs=x.teams?.home?.score,as=x.teams?.away?.score;
        if(hs==null||as==null||seen.has(x.gamePk))return; // scoreless dupes = postponed originals
        seen.add(x.gamePk);
        series.push({date:x.officialDate||day.date,tie:hs===as,
          winner:hs===as?null:(hs>as?x.teams.home.team.id:x.teams.away.team.id)});
      }));
      g.seasonSeries=series;
    }catch{/* H2H top-up just absent for this game */}
  }));
  // lineup fallback → active roster position players (keep TWP), tag projected
  for(const g of games){
    for(const side of['home','away']){
      if(!g[side+'Ids'].length){
        prog(`Roster ${g[side].teamName}…`);
        const r=await jget(`${API}/teams/${g[side].id}/roster?rosterType=active`);
        g[side+'Ids']=r.roster
          .filter(x=>x.position.type!=='Pitcher'||x.position.abbreviation==='TWP')
          .map(x=>x.person.id);
        g.proj[side]=true;
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
    const d=await jget(`${API}/people?personIds=${chunk.join(',')}&season=${season}&hydrate=education,stats(group=[hitting],type=[career,season,careerStatSplits,statSplits],sitCodes=[h,a,vl,vr],season=${season})`);
    d.people.forEach(pp=>{
      const school=pp.education?.colleges?.[0]?.name||null; // first college; Jesuit flag off it
      /* Preferred vs legal names (live-verified 2026-07-22): statsapi carries the
         display name in fullName/useName ("Ben") and the government first name in
         firstName ("Benjamin"); useLastName is the display last, lastName the
         legal last. The Phrase Finder sweeps BOTH so BENJAMIN HOMERUN lands even
         when the roster only shows "Ben". legal* is null when it matches display. */
      const prefFirst=pp.useName||pp.fullName.split(' ')[0]||'';
      const legalFirst=pp.firstName||prefFirst;
      const prefLast=pp.useLastName||pp.lastName||pp.fullName.split(' ').slice(-1)[0]||'';
      const legalLast=pp.lastName||prefLast;
      const rec={id:pp.id,fullName:pp.fullName,birthDate:pp.birthDate,debutDate:pp.mlbDebutDate||null,
        lastName:pp.lastName||pp.fullName.split(' ').slice(-1)[0],
        firstName:prefFirst,
        legalFirstName:legalFirst&&legalFirst!==prefFirst?legalFirst:null,
        legalLastName:legalLast&&legalLast!==prefLast?legalLast:null,
        middleName:pp.middleName||null,
        jersey:pp.primaryNumber?+pp.primaryNumber:null,
        legalName:pp.fullFMLName&&pp.fullFMLName!==pp.fullName?pp.fullFMLName:null,
        school,jesuit:isJesuit(school),
        /* handedness — standard person fields, no extra hydrate. Bat side feeds
           the full-sheet header ("bats L/R"); a pitcher's throw hand feeds the
           opposing-pitcher line + the SPLITS row highlight (Tony full-sheet v2). */
        batSide:pp.batSide?.code||null,pitchHand:pp.pitchHand?.code||null,
        position:pp.primaryPosition?.abbreviation||'',split:{}};
      (pp.stats||[]).forEach(st=>{
        const tn=st.type.displayName;
        if(tn==='career'){const s=st.splits?.[0]?.stat;if(s)rec.career=deriveStats(s)}
        else if(tn==='season'){const s=st.splits?.[0]?.stat;if(s)rec.season=deriveStats(s)}
        else if(tn==='careerStatSplits'||tn==='statSplits'){
          /* venue (h/a) + handedness (vl/vr) splits — same shape as career,
             keyed scope-loc so the totals table can add SPLITS rows and the
             batter eval can read venue-side rungs (Tony 2026-07). */
          const scope=tn==='careerStatSplits'?'career':'season';
          const CODE={h:'home',a:'away',vl:'vsL',vr:'vsR'};
          (st.splits||[]).forEach(sp=>{
            const loc=CODE[sp.split?.code];if(!loc)return;
            rec.split[scope+'-'+loc]=deriveStats(sp.stat);
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
  // finished games sink to the bottom, in-progress float up — one source of
  // truth so every consumer of slate.games inherits the order (Tony 2026-07-22)
  return{games:sortGames(games),people,teamStats};
}

/* ---------------- H2H (MLB-PARITY.md §8, ported from Tony's Date Decoder) ----------------
   Static all-time franchise record (data/mlb-h2h.json, statsapi crawl
   1901→file cutoff, verified vs the decoder's NYM|PHI export) + live
   current-season top-up from the slate's own per-pair series. Entering
   counts: today's game is excluded (house rule). */
export function h2hFor(game,dstr){
  const la=game.away.lineage,lh=game.home.lineage;
  if(!la||!lh)return null;
  const key=[la,lh].sort().join('|');
  const st=H2H.pairs[key]?.regularSeason||{games:0,wins:{},ties:0,firstMeeting:null,lastMeeting:null};
  // top-up: completed meetings after the file cutoff, before today
  const cur=(game.seasonSeries||[]).filter(x=>x.date>=H2H.meta.through&&x.date<dstr);
  let curAway=0,curHome=0,curTies=0,firstCur=null,lastCur=null;
  cur.forEach(x=>{
    if(x.tie)curTies++;
    else if(x.winner===game.home.id)curHome++;
    else curAway++;
    if(!lastCur||x.date>lastCur)lastCur=x.date;
    if(!firstCur||x.date<firstCur)firstCur=x.date;
  });
  const games=st.games+cur.length;
  const awayWins=(st.wins[la]||0)+curAway;
  const homeWins=(st.wins[lh]||0)+curHome;
  const ties=(st.ties||0)+curTies;
  const first=st.firstMeeting||firstCur;
  const last=lastCur||st.lastMeeting;
  const day=d=>Math.round((new Date(dstr+'T12:00:00')-new Date(d+'T12:00:00'))/864e5);
  const lineageNote=[la,lh].map(l=>{
    const e=Object.values(H2H.lineage).find(x=>x.id===l);
    return e&&e.identities&&e.identities.length>1?`${l}: ${e.identities.join(' → ')}`:null;
  }).filter(Boolean);
  return{key,gameNo:games+1,games,awayWins,homeWins,ties,
    firstMeeting:first,lastMeeting:last,
    daysSinceLast:last?day(last):null,daysSinceFirst:first?day(first):null,
    lineageNote};
}

/* One cheap lineup recheck: the schedule call alone (no roster/people
   hydration). Feed the result to applyLineups (data/lineups.js). */
export async function fetchLineups(dstr){
  const d=await jget(`${API}/schedule?sportId=1&date=${dstr}&hydrate=lineups`);
  return d.dates?.[0]?.games||[];
}

/* ---------------- running game total (top-of-card, Tony 2026-07) ----------------
   today's per-batter box line for the selected game. One boxscore call; the
   ENTERING totals still exclude today (house rule) — this is the separate
   today-only line that reads alongside them. Poll ~45s while Live in the store.
   Only batters who've come to the plate are returned (row hidden pre-game). */
export async function fetchGameTotals(gamePk){
  const d=await jget(`${API}/game/${gamePk}/boxscore`);
  const out={};
  ['away','home'].forEach(sd=>{
    const t=d.teams?.[sd];if(!t)return;
    Object.values(t.players||{}).forEach(pl=>{
      const b=pl.stats?.batting,id=pl.person?.id;
      if(!b||id==null)return;
      if((+b.plateAppearances||0)===0&&(+b.atBats||0)===0&&(+b.baseOnBalls||0)===0)return;
      out[id]={plateAppearances:+b.plateAppearances||0,atBats:+b.atBats||0,runs:+b.runs||0,
        hits:+b.hits||0,doubles:+b.doubles||0,triples:+b.triples||0,homeRuns:+b.homeRuns||0,
        rbi:+b.rbi||0,totalBases:+b.totalBases||0,baseOnBalls:+b.baseOnBalls||0,
        strikeOuts:+b.strikeOuts||0,stolenBases:+b.stolenBases||0,summary:b.summary||''};
    });
  });
  return out;
}

/* Last-N form from a season game-log payload (already fetched in deepFetchGame).
   Sum the most recent N games' counting fields, then derive 1B/XBH — same shape
   as career/season so the totals table adds them as SPLITS rows. */
const LASTN_FIELDS=['plateAppearances','atBats','runs','hits','doubles','triples',
  'homeRuns','rbi','totalBases','baseOnBalls','strikeOuts','stolenBases',
  'caughtStealing','groundIntoDoublePlay','hitByPitch','sacBunts','sacFlies','intentionalWalks'];
function lastNFromLog(gl){
  const splits=((gl.stats?.[0]?.splits)||[]).filter(x=>x.date)
    .slice().sort((a,b)=>a.date<b.date?1:-1); // most-recent first
  const out={};
  [7,15,30].forEach(N=>{
    const games=splits.slice(0,N);
    if(!games.length)return;
    const sum={gamesPlayed:games.length};
    LASTN_FIELDS.forEach(f=>sum[f]=0);
    games.forEach(g=>{const s=g.stat||{};LASTN_FIELDS.forEach(f=>sum[f]+=+s[f]||0)});
    out[N]=deriveStats(sum);
  });
  return out;
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
  /* career month/weekday come as sitCodes on the SAME bulk call as the league
     splits (live-verified 2026-07-16: careerStatSplits sitCodes=7 → Baty
     career-July G=58, dth → career-Thursday G=44 — exact reference-count
     matches). Month code = plain month number; weekday codes dsu..dsa. */
  const dowCode=['dsu','dmo','dtu','dwe','dth','dfr','dsa'][dow-1];
  const monthCode=String(gameMonth);
  const ids=[...game.homeIds,...game.awayIds].filter(id=>{const p=people[id];return p&&(p.career||p.season)});
  // one bulk call for league + career-month + career-weekday splits
  for(let i=0;i<ids.length;i+=50){
    const chunk=ids.slice(i,i+50);
    prog(`Deep: league/career splits ${Math.min(i+50,ids.length)}/${ids.length}…`);
    const d=await jget(`${API}/people?personIds=${chunk.join(',')}&season=${season}&hydrate=stats(group=[hitting],type=[careerStatSplits,statSplits],sitCodes=[val,vnl,${monthCode},${dowCode}],season=${season})`);
    d.people.forEach(pp=>{
      const p=people[pp.id];if(!p)return;
      const isHome=game.homeIds.includes(pp.id);
      const opp=isHome?game.away:game.home;
      const sit=opp.league===103?'val':opp.league===104?'vnl':null;
      const deep=p.deep=p.deep||{};
      if(sit)deep.leagueTag=sit==='val'?'AL':'NL';
      (pp.stats||[]).forEach(st=>{
        const career=st.type.displayName==='careerStatSplits';
        if(!career&&st.type.displayName!=='statSplits')return;
        (st.splits||[]).forEach(sp=>{
          const code=sp.split?.code;
          if(code==='val'||code==='vnl'){
            /* store BOTH league splits (val=AL, vnl=NL) regardless of tonight's
               opponent, so the full-sheet can show career G vs AL and vs NL side
               by side (Tony 2026-07-23). The opp-league convenience keys
               (leagueCareer/leagueSeason/leagueTag) are still set below for the
               batter-eval pattern bases in patterns.js. */
            const stat=deriveStats(sp.stat),lg=code==='val'?'AL':'NL';
            if(career)deep['league'+lg+'Career']=stat;else deep['league'+lg+'Season']=stat;
            if(sit&&code===sit){
              if(career)deep.leagueCareer=stat;else deep.leagueSeason=stat;
            }
          }else if(code===monthCode&&career){
            deep.monthCareer=deriveStats(sp.stat);
            deep.monthCareerTag=`career·${MONTH_NAMES[gameMonth]}`;
          }else if(code===dowCode&&career){
            deep.dowCareer=deriveStats(sp.stat);
            deep.dowCareerTag=`career·${DOW_NAMES[dow]}`;
          }
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
          if(s){deep.vsOpp=deriveStats(s);deep.oppTag=opp.abbrev||opp.teamName}
        }else if(tn==='byMonth'){
          const sp=(st.splits||[]).find(x=>+x.month===gameMonth&&String(x.season)===season);
          if(sp){deep.month=deriveStats(sp.stat);deep.monthTag=MONTH_NAMES[gameMonth]}
        }else if(tn==='byDayOfWeek'){
          deep.dowAll={};
          (st.splits||[]).forEach(x=>{if(x.dayOfWeek!=null)deep.dowAll[+x.dayOfWeek]=deriveStats(x.stat)});
          if(deep.dowAll[dow]){deep.dow=deep.dowAll[dow];deep.dowTag=DOW_NAMES[dow]}
        }
      });
    }catch{/* degrade per player */}
    // last-event dates for the sinceLast:* counters (PATTERN-RECIPES §5):
    // one gameLog pull per batter, latest date each lane ticked. Own try —
    // a gameLog failure must not cost the splits above.
    try{
      const scanLog=(gl,ev)=>((gl.stats?.[0]?.splits)||[]).forEach(x=>{
        if(!x.date)return;
        const s=deriveStats({...x.stat});
        [['HR','homeRuns'],['H','hits'],['2B','doubles'],['3B','triples'],
         ['XBH','XBH'],['RBI','rbi'],['SO','strikeOuts']].forEach(([k,f])=>{
          if(+s[f]>0&&(!ev[k]||x.date>ev[k]))ev[k]=x.date;
        });
      });
      const ev={};
      const seasonLog=await jget(`${API}/people/${id}/stats?stats=gameLog&group=hitting&season=${season}`);
      scanLog(seasonLog,ev);
      /* cross-season fallback: no HR yet THIS season → the sinceLast:HR
         counter would be blind, so scan last season's log once (fills any
         other missing lanes for free). Gated on HR only — rarer lanes (3B)
         being empty is normal and not worth a call per bench player. */
      if(!ev.HR&&p.debutDate&&+p.debutDate.slice(0,4)<+season){
        scanLog(await jget(`${API}/people/${id}/stats?stats=gameLog&group=hitting&season=${+season-1}`),ev);
      }
      const deep=(p.deep=p.deep||{});
      deep.lastEvent=ev;
      // Last 7/15/30 from the same season log (no extra call) → totals SPLITS rows
      deep.lastN=lastNFromLog(seasonLog);
    }catch{/* degrade per player */}
  }
  game.deepDone=true;
  prog('');
  return done;
}

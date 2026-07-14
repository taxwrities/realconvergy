/* ================================================================
   wnba — balldontlie /wnba/v1 pipeline via the same-origin bdl proxy
   (raw key in Netlify env, no Bearer). WNBA-REDESIGN-SPEC §2.
   Verified facts (wnbatool, 2026-07):
   - /player_season_stats is per-game AVERAGES and unreliable for the
     CURRENT season (missing AND stale rows) → season/career totals are
     summed from /player_stats game logs (exact integers).
   - game-log rows carry game:{id,date,season} ONLY → opponent/home-away
     context comes from per-team season game lists.
   - no starter flag; box order is NOT starters-first → starters inferred
     as top-5 minutes in the last completed game (+ manual overrides).
   - no birthdate field → data/birthdays.json (build-time import).
================================================================ */
import BIRTHDAYS from '../../../../data/birthdays.json';

const PROXY='/.netlify/functions/bdl';

const DOB=new Map();
(BIRTHDAYS.players||[]).forEach(p=>{if(p.dob)DOB.set(norm(p.name),p.dob)});
function norm(s){return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[.'’]/g,'').replace(/-/g,' ').replace(/\s+/g,' ').trim()}

async function bdl(path,params){
  const qs=new URLSearchParams({path});
  for(const[k,v]of Object.entries(params||{})){if(Array.isArray(v))v.forEach(x=>qs.append(k,x));else qs.append(k,v)}
  const r=await fetch(`${PROXY}?${qs}`);
  const j=await r.json().catch(()=>({error:'bad json'}));
  if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);
  return j;
}
async function pull(path,params){
  let out=[],cursor=null,guard=0;
  do{
    const p=cursor?{...params,cursor}:params;
    const r=await bdl(path,p);
    out=out.concat(r.data||[]);
    cursor=r.meta&&r.meta.next_cursor;
  }while(cursor&&++guard<80);
  return out;
}
export const parseMin=m=>{if(m==null)return 0;m=String(m).trim();if(!m||m==='0'||m==='00')return 0;if(m.includes(':')){const[a,b]=m.split(':').map(x=>parseInt(x,10)||0);return a+b/60}const n=parseInt(m,10);return isNaN(n)?0:n};

/* WNBA team table (bdl ids verified live; arena + MLB city-bridge names). */
export const WNBA_TEAMS=[
  {abbr:'ATL',bdl:4, name:'Atlanta Dream',city:'Atlanta',nick:'Dream',arena:'Gateway Center Arena',mlbName:'Atlanta Braves',lineage:'ATL'},
  {abbr:'CHI',bdl:6, name:'Chicago Sky',city:'Chicago',nick:'Sky',arena:'Wintrust Arena',mlbName:'Chicago Cubs',lineage:'CHI'},
  {abbr:'CON',bdl:2, name:'Connecticut Sun',city:'Connecticut',nick:'Sun',arena:'Mohegan Sun Arena',mlbName:'Boston Red Sox',lineage:'CON'},
  {abbr:'DAL',bdl:11,name:'Dallas Wings',city:'Dallas',nick:'Wings',arena:'College Park Center',mlbName:'Texas Rangers',lineage:'DAL'},
  {abbr:'GSV',bdl:13,name:'Golden State Valkyries',city:'Golden State',nick:'Valkyries',arena:'Chase Center',mlbName:'San Francisco Giants',lineage:'GSV'},
  {abbr:'IND',bdl:3, name:'Indiana Fever',city:'Indiana',nick:'Fever',arena:'Gainbridge Fieldhouse',mlbName:'Cincinnati Reds',lineage:'IND'},
  {abbr:'LV', bdl:8, name:'Las Vegas Aces',city:'Las Vegas',nick:'Aces',arena:'Michelob ULTRA Arena',mlbName:'Athletics',lineage:'LVA'},
  {abbr:'LA', bdl:12,name:'Los Angeles Sparks',city:'Los Angeles',nick:'Sparks',arena:'Crypto.com Arena',mlbName:'Los Angeles Dodgers',lineage:'LAS'},
  {abbr:'MIN',bdl:7, name:'Minnesota Lynx',city:'Minnesota',nick:'Lynx',arena:'Target Center',mlbName:'Minnesota Twins',lineage:'MIN'},
  {abbr:'NY', bdl:1, name:'New York Liberty',city:'New York',nick:'Liberty',arena:'Barclays Center',mlbName:'New York Yankees',lineage:'NYL'},
  {abbr:'PHX',bdl:10,name:'Phoenix Mercury',city:'Phoenix',nick:'Mercury',arena:'PHX Arena',mlbName:'Arizona Diamondbacks',lineage:'PHO'},
  {abbr:'POR',bdl:31,name:'Portland Fire',city:'Portland',nick:'Fire',arena:'Moda Center',mlbName:'',lineage:'POR'},
  {abbr:'SEA',bdl:9, name:'Seattle Storm',city:'Seattle',nick:'Storm',arena:'Climate Pledge Arena',mlbName:'Seattle Mariners',lineage:'SEA'},
  {abbr:'TOR',bdl:30,name:'Toronto Tempo',city:'Toronto',nick:'Tempo',arena:'Coca-Cola Coliseum',mlbName:'Toronto Blue Jays',lineage:'TOR'},
  {abbr:'WAS',bdl:5, name:'Washington Mystics',city:'Washington',nick:'Mystics',arena:'CareFirst Arena',mlbName:'Washington Nationals',lineage:'WAS'},
];
const TEAM_BY_BDL=Object.fromEntries(WNBA_TEAMS.map(t=>[t.bdl,t]));
const BDL_ABBR_FIX={GS:'GSV',WSH:'WAS'};
function teamMeta(t){
  if(!t)return{id:null,name:'',teamName:'',locationName:'',abbrev:'',arena:'',lineage:null,mlbName:''};
  const m=TEAM_BY_BDL[t.id];
  return{id:t.id,name:m?m.name:(t.full_name||''),teamName:m?m.nick:(t.name||''),
    locationName:m?m.city:(t.city||''),abbrev:m?m.abbr:(BDL_ABBR_FIX[t.abbreviation]||t.abbreviation||''),
    arena:m?m.arena:'',lineage:m?m.lineage:null,mlbName:m?m.mlbName:''};
}

const etDate=iso=>new Date(iso).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
const etTime=iso=>new Date(iso).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});
const isoAddDays=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};

/* map summed log totals → the stat keys the engine reads (WNBA counters). */
function statLine(t){
  return{gamesPlayed:t.gp,GP:t.gp,PTS:t.pts,FG:t.fgm,'3PM':t.fg3m,FT:t.ftm,REB:t.reb,AST:t.ast,
    PRA:(t.pts||0)+(t.reb||0)+(t.ast||0)};
}
const zero=()=>({gp:0,pts:0,fgm:0,fg3m:0,ftm:0,reb:0,ast:0});
function addRow(a,s){
  const played=parseMin(s.min)>0||((s.pts||s.fgm||s.fga||s.reb||s.ast||s.fta)>0);
  if(played)a.gp+=1;
  a.pts+=s.pts||0;a.fgm+=s.fgm||0;a.fg3m+=s.fg3m||0;a.ftm+=s.ftm||0;a.reb+=s.reb||0;a.ast+=s.ast||0;
}

/* pull game logs for ids; returns {acc, rows} (rows kept for splits/starters). */
async function logTotals(ids,season){
  const acc={};ids.forEach(id=>acc[id]=zero());
  let rows=[];
  const params={per_page:100};if(season!=null)params['seasons[]']=[season];
  for(let i=0;i<ids.length;i+=25){
    const chunk=await pull('player_stats',{...params,'player_ids[]':ids.slice(i,i+25)});
    rows=rows.concat(chunk);
  }
  rows.forEach(s=>{const a=acc[s.player&&s.player.id];if(a)addRow(a,s)});
  return{acc,rows};
}

export async function fetchSeasonInfo(season){
  /* only feeds the "Day N of season" tile — league opener approximated from
     the earliest game in the slate teams' season lists at fetchSlate time */
  return{start:`${season}-05-01`,end:`${season}-09-15`,approx:true};
}

/* Full slate. Output shape mirrors apps/mlb: {games, people, teamStats}. */
export async function fetchSlate(dstr,onProgress){
  const prog=onProgress||(()=>{});
  const season=+dstr.slice(0,4);
  prog('Games…');
  let raw=[];
  try{raw=await pull('games',{'dates[]':[dstr,isoAddDays(dstr,1)],per_page:100})}catch(e){}
  const today=raw.filter(g=>etDate(g.date)===dstr);
  if(!today.length)return{games:[],people:{},teamStats:{}};
  const games=today.map(g=>{
    const home=teamMeta(g.home_team),away=teamMeta(g.visitor_team);
    return{pk:g.id,home,away,venue:home.arena,
      status:String(g.status).toLowerCase()==='post'?'Final':'Preview',
      startET:g.date?etTime(g.date):'',
      gameNumber:{home:null,away:null},homeIds:[],awayIds:[],projected:false,
      seasonGames:{},   // teamId → that team's season game rows (H2H top-up, splits, starters)
    };
  });

  const people={};
  for(const g of games){
    // rosters
    prog(`Rosters ${g.away.abbrev} @ ${g.home.abbrev}…`);
    let players=[];try{players=await pull('players/active',{'team_ids[]':[g.home.id,g.away.id],per_page:100})}catch(e){}
    g.homeIds=players.filter(p=>p.team&&p.team.id===g.home.id).map(p=>p.id);
    g.awayIds=players.filter(p=>p.team&&p.team.id===g.away.id).map(p=>p.id);
    if(!g.homeIds.length||!g.awayIds.length)g.projected=true;
    players.forEach(p=>{
      if(people[p.id])return;
      const nm=`${p.first_name} ${p.last_name}`;
      people[p.id]={id:p.id,fullName:nm,lastName:p.last_name,
        birthDate:DOB.get(norm(nm))||null,
        jersey:p.jersey_number?(parseInt(p.jersey_number,10)||null):null,
        position:p.position||'',split:{},starter:false,teamId:p.team.id};
    });
    // per-team season games: game # + home/away map + last completed + H2H live top-up
    for(const side of['home','away']){
      const tid=g[side].id;
      prog(`Season games ${g[side].abbrev}…`);
      try{
        const rows=await pull('games',{'seasons[]':[season],'team_ids[]':[tid],per_page:100});
        g.seasonGames[tid]=rows;
        const done=rows.filter(x=>String(x.status).toLowerCase()==='post');
        g.gameNumber[side]=done.length+1;
      }catch(e){g.seasonGames[tid]=[]}
    }
  }

  // season + career totals from game logs
  const ids=Object.keys(people).map(Number);
  prog(`Season totals (${ids.length})…`);
  const {acc:sea,rows:seaRows}=await logTotals(ids,season);
  prog('Career totals…');
  let car={};try{car=(await logTotals(ids,null)).acc}catch(e){}
  ids.forEach(id=>{
    const p=people[id];
    p.season=sea[id]&&sea[id].gp?statLine(sea[id]):null;
    p.career=car[id]&&car[id].gp?statLine(car[id]):null;
  });

  // home/away venue splits + starters, from season rows + each game's home id
  const homeIdByGame={};
  games.forEach(g=>Object.values(g.seasonGames).flat().forEach(x=>{homeIdByGame[x.id]=x.home_team&&x.home_team.id}));
  const splitAcc={};
  seaRows.forEach(s=>{
    const pid=s.player&&s.player.id,gid=s.game&&s.game.id;
    if(!pid||!people[pid]||homeIdByGame[gid]===undefined)return;
    const loc=homeIdByGame[gid]===people[pid].teamId?'home':'away';
    const k=pid+'|'+loc;
    addRow(splitAcc[k]=splitAcc[k]||zero(),s);
  });
  Object.entries(splitAcc).forEach(([k,a])=>{
    const[pid,loc]=k.split('|');
    if(a.gp)people[pid].split['season-'+loc]=statLine(a);
  });
  // starters: top-5 minutes in the team's last completed game (inferred; manual overrides win in-store)
  games.forEach(g=>{
    ['home','away'].forEach(side=>{
      const tid=g[side].id;
      const done=(g.seasonGames[tid]||[]).filter(x=>String(x.status).toLowerCase()==='post')
        .sort((a,b)=>new Date(b.date)-new Date(a.date));
      const lastId=done[0]&&done[0].id;
      if(!lastId)return;
      const box=seaRows.filter(s=>s.game&&s.game.id===lastId&&s.player&&g[side+'Ids'].includes(s.player.id));
      const top=box.map(s=>({id:s.player.id,m:parseMin(s.min)})).filter(x=>x.m>0)
        .sort((a,b)=>b.m-a.m).slice(0,5);
      top.forEach(x=>{if(people[x.id])people[x.id].starter=true});
    });
    // order lineups: starters first (minutes desc), then rotation by minutes
    const mins={};
    seaRows.forEach(s=>{const pid=s.player&&s.player.id;if(pid!=null)mins[pid]=(mins[pid]||0)+parseMin(s.min)});
    ['homeIds','awayIds'].forEach(k=>{
      g[k]=g[k].slice().sort((a,b)=>{
        const sa=people[a].starter?1:0,sb=people[b].starter?1:0;
        if(sb!==sa)return sb-sa;
        return(mins[b]||0)-(mins[a]||0);
      });
    });
    // opposing "center" slot (MLB SP field reused): starting C, else F-C/F, else top rebounder
    ['home','away'].forEach(side=>{
      const idsS=g[side+'Ids'];
      const starters=idsS.filter(id=>people[id].starter);
      const pool=starters.length?starters:idsS.slice(0,5);
      const pick=pool.find(id=>/C/.test(people[id].position||''))
        ||pool.slice().sort((a,b)=>((people[b].season&&people[b].season.REB)||0)-((people[a].season&&people[a].season.REB)||0))[0]
        ||null;
      g[side+'SP']=pick; // "SP" slot = that team's likely first-possession finisher / paint presence
    });
  });

  // team season totals → staircases (next PTS/FG/REB/AST landings)
  const teamStats={};
  games.forEach(g=>{['home','away'].forEach(side=>{
    const agg={PTS:0,FG:0,REB:0,AST:0,'3PM':0,FT:0};
    g[side+'Ids'].forEach(id=>{const s=people[id].season;if(!s)return;
      agg.PTS+=s.PTS||0;agg.FG+=s.FG||0;agg.REB+=s.REB||0;agg.AST+=s.AST||0;agg['3PM']+=s['3PM']||0;agg.FT+=s.FT||0});
    teamStats[g[side].id]=agg;
  })});
  prog('');
  return{games,people,teamStats};
}

/* Deep fetch (⚡, per game): vs-opponent SEASON split from this season's
   meetings — one player_stats call over the meeting game ids. Career-vs-team
   is not resolvable from BDL without a full log crawl; scope reports no-data. */
export async function deepFetchGame(game,people,dstr,onProgress){
  const prog=onProgress||(()=>{});
  prog('Deep: season meetings…');
  const meet=(game.seasonGames[game.home.id]||[]).filter(x=>{
    const a=x.home_team&&x.home_team.id,b=x.visitor_team&&x.visitor_team.id;
    return(a===game.home.id&&b===game.away.id)||(a===game.away.id&&b===game.home.id);
  }).filter(x=>String(x.status).toLowerCase()==='post').map(x=>x.id);
  if(meet.length){
    const rows=await pull('player_stats',{'game_ids[]':meet,per_page:100});
    const acc={};
    rows.forEach(s=>{const pid=s.player&&s.player.id;if(!pid||!people[pid])return;addRow(acc[pid]=acc[pid]||zero(),s)});
    Object.entries(acc).forEach(([pid,a])=>{
      if(!a.gp)return;
      const p=people[pid];
      const isHome=game.homeIds.includes(+pid);
      p.deep=p.deep||{};
      p.deep.vsOpp=statLine(a);
      p.deep.oppTag=(isHome?game.away:game.home).abbrev;
    });
  }
  game.deepDone=true;prog('');
  return meet.length;
}

/* ---------------- H2H (WNBA-REDESIGN-SPEC §3/§4) ---------------- */
import H2H from '../../../../data/wnba-h2h.json';

/* static franchise record + live current-season top-up from the slate's own
   season game lists (no extra network). */
export function h2hFor(game,dstr){
  const la=game.away.lineage,lh=game.home.lineage;
  if(!la||!lh)return null;
  const key=[la,lh].sort().join('|');
  const st=H2H.pairs[key]||{regularSeason:{games:0,wins:{},firstMeeting:null,lastMeeting:null},playoffs:{games:0,wins:{},firstMeeting:null,lastMeeting:null}};
  // live top-up: completed current-season meetings (static file stops at 2025)
  const cur=(game.seasonGames[game.home.id]||[]).filter(x=>{
    const a=x.home_team&&x.home_team.id,b=x.visitor_team&&x.visitor_team.id;
    return((a===game.home.id&&b===game.away.id)||(a===game.away.id&&b===game.home.id))
      &&String(x.status).toLowerCase()==='post';
  });
  let curAway=0,curHome=0,lastCur=null,firstCur=null;
  cur.forEach(x=>{
    const homeWon=(x.home_score||0)>(x.away_score||0);
    const homeIsSlateHome=x.home_team.id===game.home.id;
    if(homeWon?homeIsSlateHome:!homeIsSlateHome)curHome++;else curAway++;
    const d=String(x.date).slice(0,10);
    if(!lastCur||d>lastCur)lastCur=d;
    if(!firstCur||d<firstCur)firstCur=d;
  });
  const reg=st.regularSeason;
  const games=reg.games+cur.length;
  const awayWins=(reg.wins[la]||0)+curAway;
  const homeWins=(reg.wins[lh]||0)+curHome;
  const first=reg.firstMeeting||firstCur;
  const last=lastCur||reg.lastMeeting;
  const day=d=>Math.round((new Date(dstr+'T12:00:00')-new Date(d+'T12:00:00'))/864e5);
  const lin=H2H.lineage;
  const lineageNote=[la,lh].map(l=>{
    const e=Object.values(lin).find(x=>x.id===l);
    return e&&e.identities&&e.identities.length>1?`${l}: ${e.identities.join(' → ')}`:null;
  }).filter(Boolean);
  return{key,gameNo:games+1,games,awayWins,homeWins,
    playoffs:{games:st.playoffs.games,awayWins:st.playoffs.wins[la]||0,homeWins:st.playoffs.wins[lh]||0},
    firstMeeting:first,lastMeeting:last,
    daysSinceLast:last?day(last):null,daysSinceFirst:first?day(first):null,
    lineageNote};
}

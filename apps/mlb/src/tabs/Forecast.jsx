import {useState} from 'react';
import {useApp} from '../state/store.jsx';

/* Forecast tab — LAYOUT-SPEC §6: the Landings method as a screen.
   Cards freeze on generation; grading compares against the frozen card. */
export default function ForecastTab(){
  const {forecasts,generateForecasts,forecastBusy,settings,setSettings,date,grade}=useApp();
  const upcoming=forecasts.filter(f=>f.date>=date);
  const past=forecasts.filter(f=>f.date<date);
  const maturing=upcoming.filter(f=>f.date===date);
  return(
    <div>
      <div className="panel">
        <div className="sheet-row" style={{marginBottom:0}}>
          <button className="chip on" onClick={generateForecasts} disabled={!!forecastBusy}>
            {forecastBusy||'⟡ Generate forecasts'}
          </button>
          <select value={settings.forecastDays||10}
            onChange={e=>setSettings({...settings,forecastDays:+e.target.value})}
            style={{background:'#101319',border:'1px solid #2a303c',borderRadius:8,color:'#e8eaf0',padding:'7px'}}>
            {[5,7,10,14].map(d=><option key={d} value={d}>{d} days</option>)}
          </select>
          <span className="muted" style={{fontSize:11}}>
            conditions freeze on generation — no retrofitting
          </span>
        </div>
      </div>
      {maturing.length>0&&(
        <div className="warn-banner">⟡ {maturing.length} forecast{maturing.length>1?'s':''} maturing TODAY — pinned below and badged on the Board.</div>
      )}
      {!upcoming.length&&!forecastBusy&&(
        <div className="stub" style={{padding:'30px 20px'}}>
          No forecast cards yet. Date-dependent patterns (DOY, date numerology,
          day-of-week, game #, age figures) are walked {settings.forecastDays||10} days ahead.
        </div>
      )}
      {upcoming.map(f=><Card key={f.id} f={f} today={date}/>)}
      {past.length>0&&(
        <>
          <h3 style={{fontSize:10.5,letterSpacing:1.2,textTransform:'uppercase',color:'#8a90a0',margin:'14px 0 8px'}}>
            Past — frozen cards (grade vs actual)
          </h3>
          {past.map(f=><Card key={f.id} f={f} today={date} onGrade={grade}/>)}
        </>
      )}
    </div>
  );
}

function Card({f,today,onGrade}){
  const [busy,setBusy]=useState(false);
  const mat=f.date===today;
  return(
    <div className="panel" style={mat?{borderColor:'var(--cvg-purple)'}:{}}>
      <div style={{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
        <b style={{fontSize:14}}>{f.player}</b>
        <span className="badge gold">{f.lane}</span>
        <span className="muted" style={{fontSize:11.5}}>{f.team}</span>
        <span className="mono v-purple" style={{marginLeft:'auto',fontWeight:800}}>
          ⟡ {f.date.slice(5).replace('-','/')}{mat?' · TODAY':''}
        </span>
      </div>
      <div className="mono" style={{fontSize:12,margin:'5px 0'}}>
        <span className="v-green">{f.hard}✓ hard</span>
        {f.soft>0&&<span className="v-blue"> +{f.soft} soft</span>}
        <span className="muted"> · {f.pattern}</span>
      </div>
      {f.evidence?.slice(0,4).map((e,i)=>(
        <div key={i} className="mono muted" style={{fontSize:11.5}}>· {e}</div>
      ))}
      <div className="rail" style={{marginTop:7}}>
        {f.window.map(w=>(
          <span key={w.date} className={`chip gray${w.date===f.date?' on':''}`}
            style={{padding:'3px 9px',fontSize:11,cursor:'default'}}>
            {w.date.slice(5).replace('-','/')} <b className="mono">{w.count}✓</b>
          </span>
        ))}
      </div>
      {onGrade&&!f.grade&&(
        <button className="chip" style={{marginTop:7}} disabled={busy}
          onClick={async()=>{setBusy(true);try{await onGrade(f)}finally{setBusy(false)}}}>
          {busy?'grading…':'Grade vs actual'}
        </button>
      )}
      {f.grade&&(
        <div className={`mono ${f.grade.result==='HIT'?'v-green':f.grade.result==='MISS'?'v-red':'muted'}`}
          style={{fontSize:12.5,marginTop:7,fontWeight:800}}>
          {f.grade.result} — {f.grade.detail}
        </div>
      )}
      <div className="muted" style={{fontSize:10,marginTop:5}}>frozen {f.frozenAt.slice(0,16).replace('T',' ')}</div>
    </div>
  );
}

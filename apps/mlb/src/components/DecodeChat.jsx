import {useState,useEffect,useRef,useMemo} from 'react';
import {useApp} from '../state/store.jsx';
import Sheet from './Sheet.jsx';
import {buildBundle} from '../decode/bundle.js';

/* ================================================================
   Decode Chat (DECODE-CHAT.md) — per-game AI decode panel.
   The app computes (bundle.js), the model interprets. Additive only:
   this file owns the launcher chip + the sheet; Board.jsx just
   renders <DecodeLauncher/>. All API traffic goes through the
   Netlify function proxy (/.netlify/functions/decode) — no key here.
================================================================ */

const TURN_CAP=30;               // hard session cap (spec)
const ENDPOINT='/.netlify/functions/decode';

export function DecodeLauncher(){
  const {game}=useApp();
  const [open,setOpen]=useState(false);
  if(!game)return null;
  return(
    <>
      <div className="decode-launch">
        <button className="chip purple" onClick={()=>setOpen(true)}>
          ◈ Decode {game.away.abbrev} @ {game.home.abbrev}
        </button>
      </div>
      {open&&<DecodeChat onClose={()=>setOpen(false)}/>}
    </>
  );
}

export default function DecodeChat({onClose}){
  const {game,slate,dn,date,contextChips}=useApp();
  const [msgs,setMsgs]=useState([]);       // {role:'user'|'assistant', text, deep?}
  const [input,setInput]=useState('');
  const [deep,setDeep]=useState(false);    // "Deep Decode" — user-initiated only
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState(null);
  const [bundle,setBundle]=useState(null);
  const bodyRef=useRef(null);

  const gamePk=game?.pk;
  /* bundle assembled once per game/date open; no ambient calls — chat only
     fires on user send (spec: no auto calls) */
  useEffect(()=>{
    let dead=false;
    setBundle(null);
    if(!game||!slate)return;
    buildBundle({game,people:slate.people,dn,date,contextChips})
      .then(b=>{if(!dead)setBundle(b)})
      .catch(e=>{if(!dead)setErr(`bundle failed: ${e.message}`)});
    return()=>{dead=true};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[gamePk,date]);

  useEffect(()=>{bodyRef.current?.scrollTo(0,bodyRef.current.scrollHeight)},[msgs,busy]);

  const turns=msgs.filter(m=>m.role==='user').length;
  const capped=turns>=TURN_CAP;

  const send=async()=>{
    const q=input.trim();
    if(!q||busy||capped||!bundle)return;
    setErr(null);setInput('');
    const next=[...msgs,{role:'user',text:q}];
    setMsgs(next);setBusy(true);
    try{
      const r=await fetch(ENDPOINT,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          mode:deep?'deep':'standard',
          app:'mlb',
          system:bundle.systemBlocks,
          messages:next.map(m=>({role:m.role,content:m.text})),
        }),
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||`proxy ${r.status}`);
      setMsgs(m=>[...m,{role:'assistant',text:d.text,deep}]);
    }catch(e){
      setErr(e.message);
      setMsgs(m=>m.slice(0,-1));   // roll back the unanswered turn
      setInput(q);
    }finally{setBusy(false)}
  };

  const transcript=useMemo(()=>()=>{
    const head=`# Decode — ${date} ${game.away.abbrev} @ ${game.home.abbrev}\n\n`;
    const body=msgs.map(m=>`**${m.role==='user'?'Tony':m.deep?'Deep Decode':'Decode'}:** ${m.text}`).join('\n\n');
    const blob=new Blob([head+body+'\n'],{type:'text/markdown'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`${date}-${game.pk}.md`;   // data/decode-logs/{date}-{gamePk}.md
    a.click();
    URL.revokeObjectURL(a.href);
  },[msgs,date,game]);

  const copyContext=()=>{
    if(bundle)navigator.clipboard?.writeText(bundle.serialized).catch(()=>{});
  };

  if(!game)return null;
  return(
    <Sheet title={`◈ Decode — ${game.away.abbrev} @ ${game.home.abbrev}`} onClose={onClose}>
      <div className="decode-bar">
        <button className={`chip ${deep?'purple on':'gray'}`} title="routes to the deepest model — slower, costlier, user-initiated only"
          onClick={()=>setDeep(!deep)}>{deep?'◈ Deep Decode ON':'Deep Decode'}</button>
        <span className="muted mono decode-turns">{turns}/{TURN_CAP}</span>
        <button className="chip gray" onClick={copyContext} disabled={!bundle} title="copy the full context bundle (paste into any chat)">copy context</button>
        <button className="chip gray" onClick={()=>transcript()} disabled={!msgs.length}>save .md</button>
        <button className="chip gray" onClick={()=>setMsgs([])} disabled={!msgs.length}>new session</button>
      </div>
      {!bundle&&!err&&<div className="warn-banner">assembling context bundle…</div>}
      {bundle&&!msgs.length&&
        <div className="muted decode-hint">
          Bundle ready — {bundle.playerCount} players, board {bundle.serialized.includes('LANDINGS BOARD —')?'attached':'missing'}.
          Ask for a pregame read, paste plays for live grading, or paste the box score postgame.
        </div>}
      <div className="decode-msgs" ref={bodyRef}>
        {msgs.map((m,i)=>(
          <div key={i} className={`decode-msg ${m.role}`}>
            {m.role==='assistant'&&<span className="decode-who">{m.deep?'DEEP':'DECODE'}</span>}
            <div className="decode-text">{m.text}</div>
          </div>
        ))}
        {busy&&<div className="decode-msg assistant"><span className="decode-who">{deep?'DEEP':'DECODE'}</span><div className="decode-text muted">reading the field…</div></div>}
      </div>
      {err&&<div className="warn-banner">{err}</div>}
      {capped&&<div className="warn-banner">30-turn session cap reached — save the transcript and start a new session.</div>}
      <div className="decode-input">
        <textarea rows={2} value={input} placeholder={capped?'session capped':'pregame read / paste plays / postgame ledger…'}
          disabled={capped||busy||!bundle}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/>
        <button className="chip on" onClick={send} disabled={capped||busy||!bundle||!input.trim()}>send</button>
      </div>
    </Sheet>
  );
}

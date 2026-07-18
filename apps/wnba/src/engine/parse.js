/* ================================================================
   parse — Zach-post text → draft pattern conditions
   (PATTERN-RECIPES Phase 3). Pure. Basketball-adapted from apps/mlb.

   The trick that makes this tractable: the posts always state their
   number equalities explicitly ("Liberty=57", "Basketball Eight=31",
   "83=23rd prime"). So instead of parsing prose, extract three flat
   lists — COUNTERS (number-anchored counter mentions), CLAIMS (value
   assertions), LINKS (prime/composite index bridges, validated against
   the sieve) — and JOIN them on number equality. Anything that doesn't
   pair is returned as a leftover so the author sees what the parser
   couldn't place. The editor stays the source of truth.

   WNBA note: no per-player game-log deep tier, so there is no
   "days since his last…" (sinceLast) counter, and no leagues, so no
   "vs NL/AL" scan. The opposing pitcher's clock becomes the opposing
   starting center's clock.
================================================================ */
import {primeIndex,compositeIndex} from './numbers.js';

const NUMBER_WORDS=new Set(['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT',
  'NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN',
  'EIGHTEEN','NINETEEN','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY',
  'NINETY','HUNDRED','THOUSAND']);
const MONTHS='January|February|March|April|May|June|July|August|September|October|November|December';
const DAYS='Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday';
const STAT_RE='(?:points?|pts?|rebounds?|reb|boards?|assists?|ast|dimes?|three\\s?pointers?|threes?|treys?|3pm|free\\s?throws?|fts?|field\\s?goals?|fgs?|first\\s?baskets?|baskets?|buckets?)';
const statOf=s=>{
  s=(s||'').toLowerCase().replace(/\s+/g,' ');
  if(/^(rebound|reb|board)s?$/.test(s))return'REB';
  if(/^(assist|ast|dime)s?$/.test(s))return'AST';
  if(/^(three\s?pointer|three|trey|3pm)s?$/.test(s))return'3PM';
  if(/^(free\s?throw|ft)s?$/.test(s))return'FT';
  if(/^(field\s?goal|fg|first\s?basket|basket|bucket)s?$/.test(s))return'FG';
  if(/^(point|pt)s?$/.test(s))return'PTS';
  return'PTS';
};

/* soft-by-default for DEEP-scoped and games counters: non-DEEP outcome
   rungs are the milestone being called (gate), everything else is the
   timing/context web around it (upgrade). */
const DEEP_SCOPES=new Set(['vsTeam','month','dow']);
const isHard=c=>c.counter.startsWith('rung:')&&c.counter!=='rung:GP'&&!DEEP_SCOPES.has(c.scope);

export function parsePost(text,ctx={}){
  text=String(text||'');
  const teams=new Set((ctx.teams||[]).map(t=>t.toLowerCase()));

  /* ---- pass 1: counters (span-consumed so specific beats generic) ---- */
  const counters=[]; // {n, counter, scope, frag}
  const taken=[];
  const free=(a,b)=>!taken.some(([x,y])=>a<y&&b>x);
  const scan=(re,fn)=>{
    for(const m of text.matchAll(re)){
      const a=m.index,b=a+m[0].length;
      if(!free(a,b))continue;
      const c=fn(m);
      if(c){taken.push([a,b]);counters.push({...c,frag:m[0].trim()})}
    }
  };
  // "57th career PTS" / "31st season FG at home"
  scan(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(career|season)\\s+(${STAT_RE})\\b(\\s+at\\s+(?:home|away))?`,'gi'),
    m=>({n:+m[1],counter:`rung:${statOf(m[3])}`,scope:m[4]?'venue':m[2].toLowerCase()}));
  // "58th July game" (month split — needs DEEP; resolves empty without it)
  scan(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(?:career\\s+)?(?:${MONTHS})(?:\\s*\\(\\d+\\))?\\s+game`,'gi'),
    m=>({n:+m[1],counter:'rung:GP',scope:'month'}));
  // "44th Thursday(35) game"
  scan(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(?:career\\s+)?(?:${DAYS})(?:\\s*\\(\\d+\\))?\\s+game`,'gi'),
    m=>({n:+m[1],counter:'rung:GP',scope:'dow'}));
  // "35th h2h vs NY" / "12th game vs the Liberty"
  scan(/(\d+)(?:st|nd|rd|th)\s+(?:h2h|meeting|game)s?\s+(?:game\s+)?(?:vs\.?|versus|against)\s/gi,
    m=>({n:+m[1],counter:'rung:GP',scope:'vsTeam'}));
  // "next basket 7" / "next PTS is 7"
  scan(new RegExp(`next\\s+(${STAT_RE})\\s+(?:is\\s+)?(\\d+)`,'gi'),
    m=>({n:+m[2],counter:`rung:${statOf(m[1])}`,scope:'season'}));
  // "168 days left (in the year)"
  scan(/(\d+)\s+days?\s+left/gi,m=>({n:+m[1],counter:'dateFig',scope:'season'}));
  // "31 days after the center's birthday"
  scan(/(\d+)\s+days?\s+(?:after|before|to|until|since)\s+(?:the\s+)?(?:center|c)'?s?\s+(?:birthday|bday)/gi,
    m=>({n:+m[1],counter:'oppCenterClock',scope:'season'}));
  // "game #95"
  scan(/game\s+#(\d+)/gi,m=>({n:+m[1],counter:'teamGame',scope:'season'}));

  /* ---- pass 2: value claims ---- */
  const claims=[]; // {n, source, sourceArg, prio, frag}
  const classify=(t,atStart)=>{
    if(atStart)return{source:'ownName',sourceArg:'',prio:5};
    if(t.toUpperCase().split(/\s+/).some(w=>NUMBER_WORDS.has(w)))
      /* a spelled number in the phrase = the numberWord convention:
         the spelled season-PTS-next run through the ciphers */
      return{source:'numberWord',sourceArg:{counter:'rung:PTS',scope:'season',off:1},prio:4};
    if(teams.has(t.toLowerCase()))return{source:'oppTeam',sourceArg:'',prio:3};
    return{source:'word',sourceArg:t,prio:2};
  };
  // "Liberty=57" / "Basketball Eight=31" — capitalized run before '=' (case-sensitive)
  for(const m of text.matchAll(/((?:[A-Z][\w'’.]*\s+)*[A-Z][\w'’.]*)\s*=\s*(\d+)\b/g))
    claims.push({n:+m[2],frag:m[0].trim(),...classify(m[1].trim(),false)});
  // "New York(101)" / leading "Sabrina Ionescu (58)" → own name
  for(const m of text.matchAll(/((?:[A-Z][\w'’.]*\s+)*[A-Z][\w'’.]*)\s*\((\d+)\)/g))
    claims.push({n:+m[2],frag:m[0].trim(),...classify(m[1].trim(),m.index===0)});
  // "#7"
  for(const m of text.matchAll(/#(\d+)\b/g))
    claims.push({n:+m[1],frag:m[0],source:'jersey',sourceArg:'',prio:6});
  // "on 7/16(23)" / "on the 16th (7)" — wide date-map values
  for(const m of text.matchAll(/\d{1,2}\/\d{1,2}\s*\((\d+)\)/g))
    claims.push({n:+m[1],frag:m[0],source:'dateThread',sourceArg:'',prio:1});
  for(const m of text.matchAll(/the\s+\d{1,2}(?:st|nd|rd|th)\s*\((\d+)\)/gi))
    claims.push({n:+m[1],frag:m[0],source:'dateThread',sourceArg:'',prio:1});

  /* ---- pass 3: index links, sieve-validated (idx(a) must equal b) ---- */
  const links=[]; // {a, b, mod, frag}
  for(const m of text.matchAll(/(\d+)\s*=\s*(\d+)(?:st|nd|rd|th)\s+(prime|composite)/gi)){
    const mod=m[3].toLowerCase()==='prime'?'primeIdx':'compIdx';
    const idx=mod==='primeIdx'?primeIndex(+m[1]):compositeIndex(+m[1]);
    if(idx===+m[2])links.push({a:+m[1],b:+m[2],mod,frag:m[0].trim()});
  }
  for(const m of text.matchAll(/(\d+)\)?\s*-\s*(\d+)\s*(p|c)\b/gi)){
    const mod=m[3].toLowerCase()==='p'?'primeIdx':'compIdx';
    const idx=mod==='primeIdx'?primeIndex(+m[1]):compositeIndex(+m[1]);
    if(idx===+m[2])links.push({a:+m[1],b:+m[2],mod,frag:m[0].trim()});
  }

  /* ---- join on number equality ---- */
  const usedC=new Set(),usedCl=new Set();
  const joins=[]; // {order, cond, label}
  const mk=(ci,patch,label)=>{
    const c=counters[ci];
    usedC.add(ci);
    joins.push({order:ci,label,cond:{counter:c.counter,counterArg:{off:1},scope:c.scope,
      lmod:'',rmod:'',source:'loaded',sourceArg:'',hard:isHard(c),...patch}});
  };
  // links first — an index bridge is more specific than a plain equality
  links.forEach(L=>{
    const modTag=L.mod==='primeIdx'?'prime#':'comp#';
    const bC=counters.findIndex((c,i)=>!usedC.has(i)&&c.n===L.b);
    const aC=counters.findIndex((c,i)=>!usedC.has(i)&&c.n===L.a);
    const aCl=claims.reduce((best,cl,i)=>cl.n===L.a&&(best<0||cl.prio>claims[best].prio)?i:best,-1);
    const bCl=claims.reduce((best,cl,i)=>cl.n===L.b&&(best<0||cl.prio>claims[best].prio)?i:best,-1);
    if(bC>=0&&aC>=0&&aC!==bC){        // counter = mod of other counter → counterRef
      const a=counters[aC];usedC.add(aC);
      mk(bC,{rmod:L.mod,source:'counterRef',sourceArg:{counter:a.counter,scope:a.scope,off:1}},
        `${counters[bC].frag} = ${modTag} of ${a.frag}`);
    }else if(bC>=0&&aCl>=0){          // counter = mod of claim value
      const cl=claims[aCl];usedCl.add(aCl);
      mk(bC,{rmod:L.mod,source:cl.source,sourceArg:cl.sourceArg},
        `${counters[bC].frag} = ${modTag} of ${cl.frag}`);
    }else if(aC>=0&&bCl>=0){          // mod of counter = claim value
      const cl=claims[bCl];usedCl.add(bCl);
      mk(aC,{lmod:L.mod,source:cl.source,sourceArg:cl.sourceArg},
        `${modTag} of ${counters[aC].frag} = ${cl.frag}`);
    }
  });
  // direct joins — highest-priority claim with the same number wins
  counters.forEach((c,i)=>{
    if(usedC.has(i))return;
    const cl=claims.reduce((best,x,j)=>x.n===c.n&&(best<0||x.prio>claims[best].prio)?j:best,-1);
    if(cl<0)return;
    usedCl.add(cl);
    mk(i,{source:claims[cl].source,sourceArg:claims[cl].sourceArg},
      `${c.frag} = ${claims[cl].frag}`);
  });

  joins.sort((x,y)=>x.order-y.order);
  const leftovers=[
    ...counters.filter((_,i)=>!usedC.has(i)).map(c=>`counter: ${c.frag}`),
    ...claims.filter((_,i)=>!usedCl.has(i)).map(cl=>`claim: ${cl.frag}`),
  ];
  return{drafts:joins.map(({label,cond})=>({label,cond})),leftovers};
}

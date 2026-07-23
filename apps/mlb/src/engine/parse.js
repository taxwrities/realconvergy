/* ================================================================
   parse — Zach-post text → draft pattern conditions
   (PATTERN-RECIPES Phase 3). Pure.

   The trick that makes this tractable: the posts always state their
   number equalities explicitly ("Mets=57", "Philadelphia(101)-26p",
   "83=23rd prime"). So instead of parsing prose, extract three flat
   lists — COUNTERS (number-anchored counter mentions), CLAIMS (value
   assertions), LINKS (prime/composite index bridges, validated against
   the sieve) — and JOIN them on number equality. Anything that doesn't
   pair is returned as a leftover so the author sees what the parser
   couldn't place. The editor stays the source of truth.
================================================================ */
import {primeIndex,compositeIndex,chainBase} from './numbers.js';

const NUMBER_WORDS=new Set(['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT',
  'NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN',
  'EIGHTEEN','NINETEEN','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY',
  'NINETY','HUNDRED','THOUSAND']);
const MONTHS='January|February|March|April|May|June|July|August|September|October|November|December';
const DAYS='Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday';
const STAT_RE='(?:home\\s?runs?|homeruns?|homers?|hrs?|hits?|strikeouts?|total\\s?bases|tbs?|rbis?|walks?|doubles?|triples?|singles?|ks?|stolen\\s?bases?|steals?|sbs?|runs?)';
const statOf=s=>{
  s=(s||'').toLowerCase().replace(/\s+/g,' ');
  if(/^(k|strikeout)s?$/.test(s))return'SO';
  if(/^hits?$/.test(s))return'H';
  if(/^walks?$/.test(s))return'BB';
  if(/^doubles?$/.test(s))return'2B';
  if(/^triples?$/.test(s))return'3B';
  if(/^singles?$/.test(s))return'1B';
  if(/^rbis?$/.test(s))return'RBI';
  if(/^(tb|total bases)s?$/.test(s))return'TB';
  if(/^(sb|stolen bases?|steals?)$/.test(s))return'SB';
  if(/^runs?$/.test(s))return'R';
  return'HR';
};

/* soft-by-default for DEEP-scoped and timing counters: non-DEEP outcome
   rungs are the milestone being called (gate), everything else is the
   timing/context web around it (upgrade). Matches how the two worked
   seed examples split hard/soft on their milestone legs. */
const DEEP_SCOPES=new Set(['vsTeam','vsLeague','month','dow']);
const isHard=c=>c.counter.startsWith('rung:')&&c.counter!=='rung:G'&&!DEEP_SCOPES.has(c.scope);

export function parsePost(text,ctx={}){
  text=String(text||'');
  const teams=new Set((ctx.teams||[]).map(t=>t.toLowerCase()));
  const dateNums=new Set(ctx.dateNums||[]); // today's precise figures (dateFigures)

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
  // "2 RBI from 61 (this season)" — milestone stated with its gap window
  scan(new RegExp(`(\\d+)\\s+(${STAT_RE})\\s+(?:away\\s+)?from\\s+(\\d+)\\b(\\s+this\\s+career)?`,'gi'),
    m=>({n:+m[3],counter:`rung:${statOf(m[2])}`,scope:m[4]?'career':'season',
      off:Math.min(5,Math.max(1,+m[1]))}));
  // "17th Home HR (vs Mets)" — venue-split count, stat after the venue word
  scan(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(?:career\\s+|season\\s+)?(?:home|away|road)\\s+(${STAT_RE})\\b`,'gi'),
    m=>({n:+m[1],counter:`rung:${statOf(m[2])}`,scope:'venue'}));
  // "26th career HR vs (the) Mets" — vs-team split count (career-vs-team IS
  // the engine's vsTeam scope: vsTeamTotal)
  scan(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(?:career\\s+|season\\s+)?(${STAT_RE})\\s+(?:vs\\.?|versus|against)\\s`,'gi'),
    m=>({n:+m[1],counter:`rung:${statOf(m[2])}`,scope:'vsTeam'}));
  // "57th career HR" / "31st career HR at home"
  scan(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(career|season)\\s+(${STAT_RE})\\b(\\s+at\\s+(?:home|away))?`,'gi'),
    m=>({n:+m[1],counter:`rung:${statOf(m[3])}`,scope:m[4]?'venue':m[2].toLowerCase()}));
  // "33rd HR of (the) season/year" — stat-first ordering
  scan(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(${STAT_RE})\\s+of\\s+(?:the\\s+)?(?:season|year)`,'gi'),
    m=>({n:+m[1],counter:`rung:${statOf(m[2])}`,scope:'season'}));
  // "95th game of (the) season" — team game number
  scan(/(\d+)(?:st|nd|rd|th)\s+game\s+of\s+(?:the\s+)?(?:season|year)/gi,
    m=>({n:+m[1],counter:'teamGame',scope:'season'}));
  // "58th July game" (career or season month split — engine emits both bases)
  scan(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(?:career\\s+)?(?:${MONTHS})(?:\\s*\\(\\d+\\))?\\s+game`,'gi'),
    m=>({n:+m[1],counter:'rung:G',scope:'month'}));
  // "44th Thursday(35) game"
  scan(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(?:career\\s+)?(?:${DAYS})(?:\\s*\\(\\d+\\))?\\s+game`,'gi'),
    m=>({n:+m[1],counter:'rung:G',scope:'dow'}));
  // "35th h2h vs PHI" / "12th game vs the Mets"
  scan(/(\d+)(?:st|nd|rd|th)\s+(?:h2h|meeting|game)s?\s+(?:game\s+)?(?:vs\.?|versus|against)\s/gi,
    m=>({n:+m[1],counter:'rung:G',scope:'vsTeam'}));
  // "next hr vs NL is 26"
  scan(new RegExp(`next\\s+(${STAT_RE})\\s+vs\\.?\\s+(?:the\\s+)?(?:NL|AL|National League|American League)\\s+is\\s+(\\d+)`,'gi'),
    m=>({n:+m[2],counter:`rung:${statOf(m[1])}`,scope:'vsLeague'}));
  // "next hr 7" / "next hr is 7"
  scan(new RegExp(`next\\s+(${STAT_RE})\\s+(?:is\\s+)?(\\d+)`,'gi'),
    m=>({n:+m[2],counter:`rung:${statOf(m[1])}`,scope:'season'}));
  // "168 days left (in the year)"
  scan(/(\d+)\s+days?\s+left/gi,m=>({n:+m[1],counter:'dateFig',scope:'season'}));
  // "31 days after the Pitcher's birthday"
  scan(/(\d+)\s+days?\s+(?:after|before|to|until|since)\s+(?:the\s+)?pitcher'?s?\s+(?:birthday|bday)/gi,
    m=>({n:+m[1],counter:'oppPitcherClock',scope:'season'}));
  // "23 days after his last HR" / "63d since his last"
  scan(new RegExp(`(\\d+)\\s*d(?:ays?)?\\s+(?:after|since)\\s+his\\s+last(?:\\s+(${STAT_RE}))?`,'gi'),
    m=>({n:+m[1],counter:`sinceLast:${statOf(m[2])}`,scope:'season'}));
  // "game #95"
  scan(/game\s+#(\d+)/gi,m=>({n:+m[1],counter:'teamGame',scope:'season'}));

  /* ---- pass 2: value claims (span-consumed like counters, so the
     specific notations eat their text before the bare form runs) ---- */
  const claims=[]; // {n, source, sourceArg, prio, frag}
  const ctaken=[];
  const cfree=(a,b)=>!ctaken.some(([x,y])=>a<y&&b>x);
  const cscan=(re,fn)=>{
    for(const m of text.matchAll(re)){
      const a=m.index,b=a+m[0].length;
      if(!cfree(a,b))continue;
      const c=fn(m);
      if(c){ctaken.push([a,b]);claims.push({...c,frag:m[0].trim()})}
    }
  };
  const classify=(t,atStart)=>{
    if(atStart)return{source:'ownName',sourceArg:'',prio:5};
    if(t.toUpperCase().split(/\s+/).some(w=>NUMBER_WORDS.has(w)))
      /* a spelled number in the phrase = the numberWord convention:
         the spelled season-stat-next run through the ciphers */
      return{source:'numberWord',sourceArg:{counter:'rung:HR',scope:'season',off:1},prio:4};
    if(teams.has(t.toLowerCase()))return{source:'oppTeam',sourceArg:'',prio:3};
    return{source:'word',sourceArg:t,prio:2};
  };
  // "Mets=57" / "Homerun Eight=31" — capitalized run before '=' (case-sensitive)
  cscan(/((?:[A-Z][\w'’.]*\s+)*[A-Z][\w'’.]*)\s*=\s*(\d+)\b/g,
    m=>({n:+m[2],...classify(m[1].trim(),false)}));
  // "Philadelphia(101)" / leading "Brett Baty (58)" → own name
  cscan(/((?:[A-Z][\w'’.]*\s+)*[A-Z][\w'’.]*)\s*\((\d+)\)/g,
    m=>({n:+m[2],...classify(m[1].trim(),m.index===0)}));
  // "#7"
  cscan(/#(\d+)\b/g,m=>({n:+m[1],source:'jersey',sourceArg:'',prio:6}));
  // "on 7/16(23)" / "on the 16th (7)" — wide date-map values
  cscan(/\d{1,2}\/\d{1,2}\s*\((\d+)\)/g,m=>({n:+m[1],source:'dateThread',sourceArg:'',prio:1}));
  cscan(/the\s+\d{1,2}(?:st|nd|rd|th)\s*\((\d+)\)/gi,m=>({n:+m[1],source:'dateThread',sourceArg:'',prio:1}));
  // "TOP DN 26" / "DN 26" — an asserted date-numerology figure
  cscan(/\b(?:top\s+)?DN\s*[:=]?\s*(\d+)\b/gi,m=>({n:+m[1],source:'dateThread',sourceArg:'',prio:4}));
  // bare "New York 33" — capitalized run + plain number, NO '='/parens.
  // Ordinal numbers are counters, not claims (blocks "Kyle Schwarber 33rd").
  // Same-line only ([ \t], never \n) and barred from counter spans, so a
  // line-ending name can't steal the next line's leading number. Runs last:
  // every specific notation above has already eaten its span.
  cscan(/((?:[A-Z][\w'’.]*[ \t]+)*[A-Z][\w'’.]*)[ \t]+(\d+)\b(?!\s*(?:st|nd|rd|th|\/))/g,
    m=>free(m.index,m.index+m[0].length)?{n:+m[2],...classify(m[1].trim(),m.index===0)}:null);

  /* ---- pass 3: index links, sieve-validated (idx(a) must equal b) ---- */
  const links=[]; // {a, b, mod, frag}
  const pushLink=(a,b,mod,frag)=>{
    const idx=mod==='primeIdx'?primeIndex(a):compositeIndex(a);
    if(idx===b)links.push({a,b,mod,frag:frag.trim()});
  };
  for(const m of text.matchAll(/(\d+)\s*=\s*(\d+)(?:st|nd|rd|th)\s+(prime|composite)/gi))
    pushLink(+m[1],+m[2],m[3].toLowerCase()==='prime'?'primeIdx':'compIdx',m[0]);
  for(const m of text.matchAll(/(\d+)\)?\s*-\s*(\d+)\s*(p|c)\b/gi))
    pushLink(+m[1],+m[2],m[3].toLowerCase()==='p'?'primeIdx':'compIdx',m[0]);
  // reversed statement: "18th prime 61" / "23rd prime is 83"
  for(const m of text.matchAll(/(\d+)(?:st|nd|rd|th)\s+(prime|composite)\s+(?:is\s+)?(\d+)\b/gi))
    pushLink(+m[3],+m[1],m[2].toLowerCase()==='prime'?'primeIdx':'compIdx',m[0]);
  // chain reduction: "17>8DN" — 17 and 8 share a 9s chain, 8 is a date figure
  const chains=[]; // {a, b, frag}
  for(const m of text.matchAll(/(\d+)\s*>\s*(\d+)\s*DN\b/gi))
    if(chainBase(+m[1])===chainBase(+m[2]))chains.push({a:+m[1],b:+m[2],frag:m[0].trim()});

  /* ---- join on number equality ---- */
  const usedC=new Set(),usedCl=new Set(),usedL=new Set(),usedCh=new Set();
  const joins=[]; // {order, cond, label}
  const mk=(ci,patch,label)=>{
    const c=counters[ci];
    usedC.add(ci);
    joins.push({order:ci,label,cond:{counter:c.counter,counterArg:{off:c.off||1},scope:c.scope,
      lmod:'',rmod:'',source:'loaded',sourceArg:'',hard:isHard(c),...patch}});
  };
  // links first — an index bridge is more specific than a plain equality
  links.forEach((L,li)=>{
    const modTag=L.mod==='primeIdx'?'prime#':'comp#';
    const bC=counters.findIndex((c,i)=>!usedC.has(i)&&c.n===L.b);
    const aC=counters.findIndex((c,i)=>!usedC.has(i)&&c.n===L.a);
    const aCl=claims.reduce((best,cl,i)=>cl.n===L.a&&(best<0||cl.prio>claims[best].prio)?i:best,-1);
    const bCl=claims.reduce((best,cl,i)=>cl.n===L.b&&(best<0||cl.prio>claims[best].prio)?i:best,-1);
    if(bC>=0&&aC>=0&&aC!==bC){        // counter = mod of other counter → counterRef
      const a=counters[aC];usedC.add(aC);usedL.add(li);
      mk(bC,{rmod:L.mod,source:'counterRef',sourceArg:{counter:a.counter,scope:a.scope,off:a.off||1}},
        `${counters[bC].frag} = ${modTag} of ${a.frag}`);
    }else if(bC>=0&&aCl>=0){          // counter = mod of claim value
      const cl=claims[aCl];usedCl.add(aCl);usedL.add(li);
      mk(bC,{rmod:L.mod,source:cl.source,sourceArg:cl.sourceArg},
        `${counters[bC].frag} = ${modTag} of ${cl.frag}`);
    }else if(aC>=0&&bCl>=0){          // mod of counter = claim value
      const cl=claims[bCl];usedCl.add(bCl);usedL.add(li);
      mk(aC,{lmod:L.mod,source:cl.source,sourceArg:cl.sourceArg},
        `${modTag} of ${counters[aC].frag} = ${cl.frag}`);
    }else if(aC>=0){                  // "18th prime 61": the index side has no
      // explicit partner — a date figure if it is one, else the loaded net
      const isDN=dateNums.has(L.b);usedL.add(li);
      mk(aC,{lmod:L.mod,source:isDN?'dateThread':'loaded'},
        `${modTag} of ${counters[aC].frag} = ${L.b}${isDN?' (DN)':''}`);
    }
  });
  // chain joins — "17>8DN" anchored to a counter sitting on 17
  chains.forEach((Ch,ci)=>{
    const aC=counters.findIndex((c,i)=>!usedC.has(i)&&c.n===Ch.a);
    if(aC<0)return;
    usedCh.add(ci);
    mk(aC,{rmod:'chain',source:'dateThread'},
      `${counters[aC].frag} chains (9s) to ${Ch.b} (DN)`);
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
  // date-figure joins — a counter landing exactly on one of today's precise
  // figures is its own decode line ("95th game of season" on a 95 day)
  counters.forEach((c,i)=>{
    if(usedC.has(i)||!dateNums.has(c.n))return;
    mk(i,{source:'dateThread'},`${c.frag} = DN ${c.n}`);
  });

  joins.sort((x,y)=>x.order-y.order);
  const leftovers=[
    ...counters.filter((_,i)=>!usedC.has(i)).map(c=>`counter: ${c.frag}`),
    ...claims.filter((_,i)=>!usedCl.has(i)).map(cl=>`claim: ${cl.frag}`),
    ...links.filter((_,i)=>!usedL.has(i)).map(L=>`link: ${L.frag}`),
    ...chains.filter((_,i)=>!usedCh.has(i)).map(Ch=>`link: ${Ch.frag}`),
  ];
  return{drafts:joins.map(({label,cond})=>({label,cond})),leftovers};
}

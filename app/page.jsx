'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function normCity(c=''){return c.replace(/bangalore/gi,'Bengaluru');}
function isBengaluru(c=''){const l=c.toLowerCase();return l.includes('bengaluru')||l.includes('bangalore');}

const TOP_CITIES=['Bengaluru','Mumbai','Delhi','Hyderabad','Pune','Chennai','Kolkata','Ahmedabad','Gurgaon','Noida'];
const ALL_CITIES=['Bengaluru','Mumbai','Delhi','Hyderabad','Pune','Chennai','Kolkata','Ahmedabad','Gurgaon','Noida',
  'Jaipur','Surat','Lucknow','Nagpur','Indore','Thane','Bhopal','Visakhapatnam','Patna','Vadodara',
  'Ghaziabad','Ludhiana','Agra','Nashik','Faridabad','Meerut','Rajkot','Varanasi','Chandigarh',
  'Guwahati','Thiruvananthapuram','Mysuru','Kochi','Coimbatore','Madurai','Mangaluru','Navi Mumbai','Ranchi','Jodhpur'];

const SEC=[{n:'About You',q:4},{n:'Goal & Tracking',q:3},{n:'Your Approach',q:5},{n:'What Matters',q:6},{n:'Wrapping Up',q:2}];
const TOTAL_MAIN=SEC.reduce((s,x)=>s+x.q,0);

// q1: name is now single-choice style (so req:true works cleanly with "Prefer not to say")
// q3: gender also has "Prefer not to say" — both req:true
// q10 removed (redundant rating question)
// q34 added — willingness to pay (critical business validation)
const STEPS=[
  {id:'q1', sec:0,qi:1,type:'name',  req:true, title:`What's your name?`,next:'q2'},
  {id:'q2', sec:0,qi:2,type:'single',req:true, title:'How old are you?',opts:['Under 25','25–34','35–44','45+','Prefer not to say'],next:'q3'},
  {id:'q3', sec:0,qi:3,type:'single',req:true, title:`What's your gender?`,opts:['Male','Female','Prefer not to say'],next:'q4'},
  {id:'q4', sec:0,qi:4,type:'city',  req:true, title:'Which city or area are you in?',next:'q5'},

  {id:'q5', sec:1,qi:1,type:'single',req:true, title:'Which best describes your fitness journey?',
   opts:['Just starting out','Been at it a while','Very experienced','Not working out right now'],next:'q6'},
  {id:'q6', sec:1,qi:2,type:'single',req:true, title:'Do you have a specific fitness goal right now?',
   opts:['Lose weight / fat','Gain muscle','Stay the same','No specific goal'],next:'q7'},
  {id:'q7', sec:1,qi:3,type:'single',req:true, title:'Which best describes your current routine?',
   opts:['Gym and diet, both together','Only gym, not really watching my diet','Only diet, not really working out','Neither right now'],next:'q9'},

  {id:'q9', sec:2,qi:1,type:'single',req:true, title:'What are you currently doing about your diet?',
   opts:['Following a structured paid plan','Trying on my own with a structured plan','Trying on my own without a structured plan','Not doing anything specific',`I used to, but I've stopped`],next:'q11'},
  {id:'q11',sec:2,qi:2,type:'single',req:true, title:'Who usually handles your food day to day?',
   opts:['I cook for myself','Family cooks','We have a cook','My meal plan provides it','I order in most days','A mix of these'],
   branch:(a)=>({'Following a structured paid plan':'q12','Trying on my own with a structured plan':'q15',
     'Trying on my own without a structured plan':'q20','Not doing anything specific':'q23',
     "I used to, but I've stopped":'q26'}[a.q9])},

  // Branch A — Paid plan (qi 3,4,5)
  {id:'q12',sec:2,qi:3,type:'single',req:true,title:'What kind of paid plan is it?',
   opts:['Dietician or nutritionist','Meal delivery subscription (EatFit, Curefoods, Eat Club…)','Fitness app or coach','Other'],next:'q13'},
  {id:'q13',sec:2,qi:4,type:'single',req:true,title:'Are you still using it right now?',
   opts:['Yes, currently using it',`No, I've stopped`,"I've paused it for now"],next:'q14'},
  {id:'q14',sec:2,qi:5,type:'single',req:true,title:'If you could change one thing about it, what would it be?',
   opts:['Make it cheaper','Add more variety','Make it more flexible',"Nothing — I'm happy with it"],next:'q31'},

  // Branch B — Own structured (qi 3,4,5)
  {id:'q15',sec:2,qi:3,type:'single',req:true,title:'Where does your meal plan or structure come from?',
   opts:['I researched and designed it myself','A friend, trainer, or influencer gave me guidelines','A free plan I found online','A mix of sources'],next:'q16'},
  {id:'q16',sec:2,qi:4,type:'single',req:true,title:'Which part takes the most time or effort?',
   opts:['Deciding what to eat','Buying groceries','Cooking','Logging what I eat',"None of these — it's easy"],next:'q17'},
  {id:'q17',sec:2,qi:5,type:'single',req:true,title:`How confident are you that what you're eating actually matches your goal?`,
   opts:["Very confident","Somewhat — I'm estimating a lot","Not very confident","I don't really check"],next:'q31'},

  // Branch C — No structure (qi 3,4,5)
  {id:'q20',sec:2,qi:3,type:'single',req:true,title:'What does "eating healthy" mean to you day to day?',
   opts:['Cutting certain foods','Watching portions','General balance, no strict rules','Just eating less overall'],next:'q21'},
  {id:'q21',sec:2,qi:4,type:'single',req:true,title:`Do you ever wonder if what you're doing is actually working?`,
   opts:['Often','Sometimes','Rarely',"I'm not really tracking progress"],next:'q22'},
  {id:'q22',sec:2,qi:5,type:'single',req:true,title:`What's stopped you from adding more structure?`,
   opts:['Too much effort',"Don't know how","Haven't felt the need to","Tried before and didn't like it"],next:'q31'},

  // Branch D — Not doing anything (qi 3,4,5)
  {id:'q23',sec:2,qi:3,type:'single',req:true,title:`Is this something you're thinking about starting soon?`,
   opts:['Yes, actively considering it','Maybe eventually','Not really a priority right now'],next:'q24'},
  {id:'q24',sec:2,qi:4,type:'single',req:true,title:'What feels like the biggest barrier to starting?',
   opts:['Cost','Not knowing where to start','Time or effort','Motivation'],next:'q25'},
  {id:'q25',sec:2,qi:5,type:'single',req:true,title:'If you did start, would you want to do it yourself or have help?',
   opts:['Do it myself with some guidance','Want it mostly handled for me','Not sure yet'],next:'q31'},

  // Branch E — Used to, stopped (qi 3,4,5)
  {id:'q26',sec:2,qi:3,type:'single',req:true,title:'What approach did you follow before you stopped?',
   opts:['A paid plan','My own structured tracking','A casual effort with no strict structure'],next:'q27'},
  {id:'q27',sec:2,qi:4,type:'single',req:true,title:'What led you to stop?',
   opts:['Life got busy','Lost motivation or got bored','Too expensive','Too much effort',"Didn't see results",'Other'],next:'q28'},
  {id:'q28',sec:2,qi:5,type:'single',req:true,title:'What would need to be different for you to try again?',
   opts:['Lower cost','Less effort required','More flexibility','Better results',`I'm not interested in trying again`],next:'q31'},

  // Section 3 — What Matters (4 questions now, including WTP)
  {id:'q31',sec:3,qi:1,type:'multi', req:true, hint:'Select all that apply.',
   title:'Which of these matters most to you about the food you eat day to day?',
   opts:['Taste','Cost','Time and effort','Getting the right nutrition for my goal','Variety','Flexibility'],next:'q32'},
  {id:'q32',sec:3,qi:2,type:'single',req:true,title:'What kind of help with your diet would suit you best?',
   opts:['Fully done for me — minimal decisions on my part','Guided — with some choices left to me','Just occasional support or reminders',"I don't think I need help right now"],next:'q33'},
  {id:'q33',sec:3,qi:3,type:'single',req:true,title:'If someone could handle one part of your food routine, what would it be?',
   opts:['Deciding what to eat','Preparing or cooking','Keeping track of what I eat','Shopping for ingredients','Nothing — I prefer doing it myself'],next:'q34'},
  {id:'q34',sec:3,qi:4,type:'single',req:true,
   title:'How much would you be okay spending per day on food that fits your fitness goal?',
   opts:['Under ₹200','₹200–350','₹350–500','₹500–700','₹700 or more'],next:'q35a'},
  {id:'q35a',sec:3,qi:5,type:'single',req:true,
   title:'How do you usually find out about food options that fit your goals?',
   opts:['Social media or influencers','Friends or word of mouth','I research myself','I just eat what is convenient','I don\'t look for specific options'],next:'q35b'},
  {id:'q35b',sec:3,qi:6,type:'single',req:true,
   title:'How often do you currently order food in?',
   opts:['Daily','4–5 times a week','2–3 times a week','Once a week or less','Rarely or never'],next:'q36'},

  // Section 4 — Wrapping Up
  {id:'q36',    sec:4,qi:1,type:'text',   req:false,long:true,title:`Anything else you'd like to share?`,
   branch:(a)=>isBengaluru(a.q4)?'q38':'contact'},
  {id:'contact',sec:4,qi:2,type:'contact',req:false,
   title:'Want us to reach out if we build something?',
   hint:'Totally optional. We never sell your details or send unsolicited messages.',
   next:'END'},

  // Section 5 — Pilot
  {id:'q38',sec:5,qi:0,type:'single',req:true,
   title:'Would you be interested in joining an early pilot in Bangalore?',
   opts:['Yes, definitely','Maybe — depends on the details','Not right now'],
   branch:(a)=>{if(a.q38==='Not right now')return 'done';return isBengaluru(a.q4)?'pilot':'done';}},
  {id:'pilot',sec:5,qi:0,type:'pilot',req:true,title:'A couple more details',next:'disc'},
  {id:'disc', sec:5,qi:0,type:'disc', req:true, title:'One last thing',next:'END'},
  {id:'done', sec:5,qi:0,type:'done', req:false,title:'',next:'END'},
];

const SM=Object.fromEntries(STEPS.map(s=>[s.id,s]));
function resolveNext(id,a){const s=SM[id];if(!s)return 'END';if(s.branch)return s.branch(a);return s.next||'END';}
function isAnswered(id,a){
  const s=SM[id];if(!s||!s.req)return true;
  const v=a[id];
  if(s.type==='multi')return Array.isArray(v)&&v.length>0;
  if(s.type==='pilot'){const p=a.pilot||{};return Boolean(p.locality?.trim())&&Boolean(p.whatsapp?.trim()||p.email?.trim());}
  if(s.type==='disc')return Boolean(a.disclaimerAck);
  if(s.type==='name')return Boolean(v&&String(v).trim());
  if(s.type==='city')return Boolean(v&&String(v).trim());
  return Boolean(v&&String(v).trim());
}

// ─── Style tokens ─────────────────────────────────────────────────────────────
const inp='w-full border-2 border-gray-200 px-4 py-3.5 text-sm text-gray-900 outline-none focus:border-gray-900 transition-colors placeholder:text-gray-400 bg-white';
const lbl='block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5';
const MN={fontFamily:'Manrope,sans-serif'};
const FR={fontFamily:'Fraunces,Georgia,serif'};
const section=(children)=>(
  <div className="bg-gray-50 border border-gray-200 px-4 py-5 space-y-5">{children}</div>
);

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({req}){
  const base={display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',fontSize:10,fontWeight:700,letterSpacing:'.06em',...MN,whiteSpace:'nowrap'};
  return req
    ?<span style={{...base,background:'#111',color:'#fff'}}><span style={{width:5,height:5,background:'#fff',display:'inline-block',flexShrink:0}}/>Required</span>
    :<span style={{...base,background:'#f3f3f3',color:'#666',border:'1px solid #ddd'}}>Optional</span>;
}

// ─── Option button ────────────────────────────────────────────────────────────
function Opt({label,idx,selected,onClick}){
  return(
    <button type="button" onClick={onClick} style={MN}
      className={`w-full flex items-center gap-3 px-4 py-3.5 border-2 text-sm font-semibold text-left transition-colors duration-100 active:opacity-80
        ${selected?'bg-gray-900 border-gray-900 text-white':'bg-white border-gray-200 text-gray-800 hover:border-gray-500 hover:bg-gray-50'}`}>
      <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center text-[11px] font-bold border-2 transition-colors duration-100
        ${selected?'border-white text-white bg-transparent':'border-gray-900 bg-gray-900 text-white'}`}>
        {ALPHA[idx]}
      </span>
      <span className="flex-1 leading-snug">{label}</span>
      {selected&&<svg className="flex-shrink-0 opacity-60" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
    </button>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({pct}){
  return(
    <div className="flex-1 flex items-center gap-2.5">
      <div className="flex-1 overflow-hidden" style={{height:4,background:'#e5e5e5'}}>
        <div style={{width:`${pct}%`,height:'100%',background:'#111',transition:'width 400ms ease'}}/>
      </div>
      <span style={{fontSize:11,color:'#999',...MN,minWidth:28,textAlign:'right',flexShrink:0}}>{pct}%</span>
    </div>
  );
}

// ─── CircleProgress — fills black as survey progresses, party at 100% ────────
function CircleProgress({pct}){
  const r=18,c=2*Math.PI*r,filled=(pct/100)*c;
  const done=pct>=100;
  return(
    <div style={{position:'relative',width:44,height:44,flexShrink:0}}>
      <svg width="44" height="44" viewBox="0 0 44 44" style={{transform:'rotate(-90deg)'}}>
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e5e5" strokeWidth="3"/>
        <circle cx="22" cy="22" r={r} fill="none" stroke="#111" strokeWidth="3"
          strokeDasharray={`${filled} ${c}`} strokeLinecap="butt"
          style={{transition:'stroke-dasharray 400ms ease'}}/>
      </svg>
      <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:done?16:10,fontWeight:800,color:'#111',...MN}}>
        {done?'🎉':`${pct}%`}
      </span>
    </div>
  );
}
function NavBtn({label,onClick,active,side}){
  const isNext=label==='Next'||label==='Finish';
  return(
    <button type="button" onClick={active?onClick:undefined} style={{...MN,width:'100%',height:'100%'}}
      className={`flex items-center justify-center gap-1.5 px-4 py-3 border-0 text-sm font-bold transition-colors select-none
        ${active?isNext?'bg-gray-900 text-white hover:bg-black cursor-pointer':'bg-white text-gray-800 hover:bg-gray-50 cursor-pointer':'bg-white text-gray-300 cursor-default'}`}>
      {side==='left'&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>}
      {label}
      {side==='right'&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>}
    </button>
  );
}

// ─── CityInput — top 10 quick chips + typeahead ───────────────────────────────
function CityInput({value,onChange,onSelect}){
  const[q,setQ]=useState(value||'');
  const[open,setOpen]=useState(false);
  useEffect(()=>{setQ(value||'');},[value]);
  const filtered=ALL_CITIES.filter(c=>c.toLowerCase().includes(q.toLowerCase())&&q.length>0&&c.toLowerCase()!==q.toLowerCase()).slice(0,6);
  function pick(city){
    setQ(city);
    onChange(city);      // update parent answers.q4
    setOpen(false);
    setTimeout(()=>onSelect(city),300); // pass city so caller can advance with correct value
  }
  return(
    <div>
      <div className="mb-3">
        <p style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#aaa',...MN,marginBottom:8}}>Popular cities</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {TOP_CITIES.map(city=>(
            <button key={city} type="button" onClick={()=>pick(city)} style={MN}
              className={`px-3 py-2.5 border-2 text-sm font-semibold text-left transition-colors
                ${value===city?'bg-gray-900 text-white border-gray-900':'bg-white border-gray-200 text-gray-700 hover:border-gray-500'}`}>
              {value===city&&<span className="mr-1.5 opacity-70">✓</span>}{city}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <input type="text" value={q}
          onChange={e=>{setQ(e.target.value);onChange(e.target.value);setOpen(true);}}
          onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),160)}
          placeholder="Or type any city…" style={MN} className={inp}/>
        {open&&filtered.length>0&&(
          <div className="absolute z-20 w-full bg-white border-2 border-gray-200 shadow-xl overflow-hidden" style={{borderTop:'none'}}>
            {filtered.map(city=>(
              <button key={city} type="button" onMouseDown={()=>pick(city)} style={MN}
                className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                {city}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NameInput — text field + "Prefer not to say" escape hatch ───────────────
function NameInput({value,onChange,onAdvance}){
  const PREFER='Prefer not to say';
  const isPrefer=value===PREFER;
  return(
    <div className="space-y-3">
      <input type="text" value={isPrefer?'':value||''}
        onChange={e=>onChange(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter'&&value?.trim()&&!isPrefer)onAdvance();}}
        placeholder="Type your name…" style={MN} className={inp}/>
      <button type="button" onClick={()=>{
        if(isPrefer){onChange('');}
        else{onChange(PREFER);setTimeout(()=>onAdvance(),300);}
      }} style={MN}
        className={`w-full flex items-center gap-3 px-4 py-3 border-2 text-sm font-semibold text-left transition-colors
          ${isPrefer?'bg-gray-900 border-gray-900 text-white':'bg-white border-gray-200 text-gray-700 hover:border-gray-500'}`}>
        <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center text-[11px] font-bold border-2
          ${isPrefer?'border-white text-white bg-transparent':'border-gray-900 bg-gray-900 text-white'}`}>—</span>
        Prefer not to say
      </button>
    </div>
  );
}

// ─── ContactFields ────────────────────────────────────────────────────────────
const CFIELDS=[{k:'name',l:'Name',p:'e.g. Kipper',t:'text'},{k:'instagram',l:'Instagram handle',p:'@yourhandle',t:'text'},
  {k:'whatsapp',l:'WhatsApp number',p:'+91 98765 43210',t:'tel'},{k:'email',l:'Email address',p:'you@example.com',t:'email'}];
function ContactFields({value={},onChange,prefillName=''}){
  const[d,setD]=useState(()=>({name:prefillName,instagram:'',whatsapp:'',email:'',...value}));
  function upd(k,v){const n={...d,[k]:v};setD(n);onChange(n);}
  return(
    <div className="space-y-4">
      {CFIELDS.map(({k,l,p,t})=>(
        <div key={k}>
          <label className={lbl} style={MN}>{l} <span className="normal-case font-normal text-gray-400">(optional)</span></label>
          <input value={d[k]||''} onChange={e=>upd(k,e.target.value)} placeholder={p} type={t} style={MN} className={inp}/>
        </div>
      ))}
    </div>
  );
}

// ─── PilotFields ─────────────────────────────────────────────────────────────
const WT=['Under 50 kg','50–65 kg','65–80 kg','80–95 kg','95 kg+'];
const HT=['Under 150 cm','150–160 cm','160–170 cm','170–180 cm','180 cm+'];
const ACTS=['Sedentary (little or no exercise)','Light (1–3 days/week)','Moderate (3–5 days/week)','Very active (6–7 days/week)'];
const SCHED=['Student','Desk job, fixed hours','Shift work','Flexible / freelance'];
function validatePhone(v){return !v||v.replace(/\D/g,'').length>=10;}
function validateEmail(v){return !v||v.includes('@');}

function PilotFields({value={},onChange,contact={}}){
  const[d,setD]=useState(()=>({
    name:contact.name||'',whatsapp:contact.whatsapp||'',email:contact.email||'',
    locality:'',weight:'',weightCustom:'',height:'',heightCustom:'',activity:'',schedule:'',...value,
  }));
  const[err,setErr]=useState({});
  function updMany(patches){const n={...d,...patches};setD(n);onChange(n);}
  function upd(k,v){updMany({[k]:v});if(err[k])setErr(e=>({...e,[k]:''}));}
  function blur(k){
    if(k==='whatsapp'&&d.whatsapp&&!validatePhone(d.whatsapp))setErr(e=>({...e,whatsapp:'Enter a valid 10-digit mobile number'}));
    if(k==='email'&&d.email&&!validateEmail(d.email))setErr(e=>({...e,email:'Enter a valid email address'}));
  }
  // chip: matches main survey Opt style but compact, for grids
  const chip=(sel)=>`border-2 text-xs font-semibold text-center transition-colors cursor-pointer py-2.5 px-1 ${sel?'bg-gray-900 text-white border-gray-900':'bg-white text-gray-700 border-gray-200 hover:border-gray-500'}`;
  // row btn: full-width, matches main Opt style exactly
  const rowBtn=(sel)=>`w-full flex items-center gap-3 px-4 py-3.5 border-2 text-sm font-semibold text-left transition-colors ${sel?'bg-gray-900 border-gray-900 text-white':'bg-white border-gray-200 text-gray-800 hover:border-gray-500 hover:bg-gray-50'}`;
  return(
    <div className="space-y-3">
      {/* Banner */}
      <div className="bg-gray-900 text-white px-4 py-4">
        <p className="font-bold text-sm mb-1" style={FR}>You're on the early list</p>
        <p className="text-gray-300 text-xs leading-relaxed" style={MN}>A few more details help us reach you at the right time. Everything is optional except your locality and one contact method.</p>
      </div>

      {/* Contact — own grey card */}
      <div className="bg-gray-50 border border-gray-200 px-4 py-4 space-y-4">
        <p className={lbl} style={MN}>Contact — WhatsApp or email required <span className="text-red-500">*</span></p>
        <div>
          <label className={lbl} style={MN}>Name <span className="normal-case font-normal text-gray-400">(optional)</span></label>
          <input value={d.name||''} onChange={e=>upd('name',e.target.value)} placeholder="Your name" type="text" style={MN} className={inp}/>
        </div>
        <div>
          <label className={lbl} style={MN}>WhatsApp number <span className="text-red-500">*</span></label>
          <input value={d.whatsapp||''} onChange={e=>upd('whatsapp',e.target.value)} onBlur={()=>blur('whatsapp')} placeholder="+91 98765 43210" type="tel" style={MN} className={inp+(err.whatsapp?' border-red-400':'')}/>
          {err.whatsapp&&<p className="text-xs text-red-500 mt-1" style={MN}>{err.whatsapp}</p>}
        </div>
        <div>
          <label className={lbl} style={MN}>Email address <span className="text-red-500">*</span></label>
          <input value={d.email||''} onChange={e=>upd('email',e.target.value)} onBlur={()=>blur('email')} placeholder="you@example.com" type="email" style={MN} className={inp+(err.email?' border-red-400':'')}/>
          {err.email&&<p className="text-xs text-red-500 mt-1" style={MN}>{err.email}</p>}
        </div>
      </div>

      {/* Locality — own grey card */}
      <div className="bg-gray-50 border border-gray-200 px-4 py-4">
        <label className={lbl} style={MN}>Area / locality in Bengaluru <span className="text-red-500">*</span></label>
        <input value={d.locality} onChange={e=>upd('locality',e.target.value)} placeholder="e.g. Indiranagar, HSR Layout, Koramangala" style={MN} className={inp}/>
        <p className="text-xs text-gray-400 mt-1.5" style={MN}>Helps us check if we can reach your area.</p>
      </div>

      {/* Work schedule — own grey card */}
      <div className="bg-gray-50 border border-gray-200 px-4 py-4">
        <label className={lbl} style={MN}>Work schedule <span className="normal-case font-normal text-gray-400">(optional)</span></label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {SCHED.map(o=><button key={o} type="button" onClick={()=>upd('schedule',o)} style={MN} className={chip(d.schedule===o)+' text-left px-3 py-3 leading-tight'}>{o}</button>)}
        </div>
      </div>

      {/* Weight — own grey card */}
      <div className="bg-gray-50 border border-gray-200 px-4 py-4">
        <label className={lbl} style={MN}>Approximate weight <span className="normal-case font-normal text-gray-400">(optional)</span></label>
        <div className="grid grid-cols-3 gap-1.5 mt-1 mb-2">
          {WT.map(o=>(
            <button key={o} type="button" style={MN} onClick={()=>updMany({weight:o,weightCustom:''})} className={chip(d.weight===o&&!d.weightCustom)}>{o}</button>
          ))}
        </div>
        <input value={d.weightCustom||''} onChange={e=>updMany({weightCustom:e.target.value,weight:''})} placeholder="Or type exact, e.g. 72 kg" style={MN} className={inp}/>
      </div>

      {/* Height — own grey card */}
      <div className="bg-gray-50 border border-gray-200 px-4 py-4">
        <label className={lbl} style={MN}>Approximate height <span className="normal-case font-normal text-gray-400">(optional)</span></label>
        <div className="grid grid-cols-3 gap-1.5 mt-1 mb-2">
          {HT.map(o=>(
            <button key={o} type="button" style={MN} onClick={()=>updMany({height:o,heightCustom:''})} className={chip(d.height===o&&!d.heightCustom)}>{o}</button>
          ))}
        </div>
        <input value={d.heightCustom||''} onChange={e=>updMany({heightCustom:e.target.value,height:''})} placeholder="Or type exact, e.g. 175 cm" style={MN} className={inp}/>
      </div>

      {/* Activity — own grey card, full-width row buttons matching main Opt style */}
      <div className="bg-gray-50 border border-gray-200 px-4 py-4">
        <label className={lbl} style={MN}>Activity level <span className="normal-case font-normal text-gray-400">(optional)</span></label>
        <div className="space-y-2 mt-1">
          {ACTS.map(o=>(
            <button key={o} type="button" onClick={()=>upd('activity',o)} style={MN} className={rowBtn(d.activity===o)}>
              <span className={`flex-shrink-0 w-5 h-5 flex items-center justify-center border-2 transition-colors ${d.activity===o?'border-white bg-transparent':'border-gray-900 bg-gray-900'}`}>
                {d.activity===o&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </span>
              <span className="flex-1 leading-snug">{o}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DisclaimerBlock ──────────────────────────────────────────────────────────
function DisclaimerBlock({onAck,acked}){
  const[scrolled,setScrolled]=useState(false);
  return(
    <div>
      <div onScroll={e=>{const el=e.currentTarget;if(el.scrollHeight-el.scrollTop-el.clientHeight<20)setScrolled(true);}}
        className="border-2 border-gray-200 p-5 max-h-56 overflow-y-auto text-sm text-gray-600 leading-relaxed space-y-3 mb-4" style={MN}>
        <p className="font-bold text-gray-900">Bangalore Pilot Programme — Participant Disclaimer</p>
        <p>By expressing interest in the e8n8 Bangalore pilot, you acknowledge the following:</p>
        <p><strong>1. Nature of the pilot.</strong> Early-stage pilot. Menus, portions, prices and delivery areas may change without notice.</p>
        <p><strong>2. Data use.</strong> Information will be used solely for pilot planning and will not be shared with third parties.</p>
        <p><strong>3. No guarantee of participation.</strong> Interest does not guarantee a place. We will reach out separately based on area and availability.</p>
        <p><strong>4. Health disclaimer.</strong> e8n8 is a food delivery convenience service and does not provide medical or dietary advice.</p>
        <p><strong>5. Contact.</strong> By providing contact details you agree to receive pilot-related communications. Opt out by replying STOP.</p>
        <p className="text-gray-400 text-xs">Last updated {new Date().getFullYear()}</p>
      </div>
      {!scrolled&&<p className="text-center text-xs text-gray-400 mb-4 animate-pulse" style={MN}>↓ Scroll to read in full</p>}
      {scrolled&&!acked&&<button type="button" onClick={onAck} style={MN} className="w-full py-4 border-2 border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-500 transition-colors">I acknowledge and agree</button>}
      {acked&&<div className="py-3 bg-gray-50 text-center text-sm font-bold text-gray-600 border-2 border-gray-200" style={MN}>✓ Acknowledged</div>}
    </div>
  );
}

// ─── Thank you screens — same design language as LandingPage ─────────────────
function ThankyouGeneral(){
  return(
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4 sm:px-7">
        <p style={{fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#aaa',...MN,marginBottom:16}}>Food & Fitness · Survey Complete</p>

        <h1 style={{...FR,fontSize:'clamp(1.4rem,5vw,1.9rem)',fontWeight:700,color:'#111',lineHeight:1.3,marginBottom:14}}>
          That's everything. We really appreciate it.
        </h1>

        <p style={{...MN,fontSize:14,color:'#555',lineHeight:1.75,marginBottom:24}}>
          Taking a few minutes to share honestly means a lot. Your answers go directly into understanding real people — not a spreadsheet that nobody reads.
        </p>

        <div className="border-2 border-gray-200 p-4 mb-6" style={{background:'#fafafa'}}>
          <p style={{...MN,fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#aaa',marginBottom:14}}>What happens next</p>
          <div className="flex items-start gap-3 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <div>
              <p style={{...MN,fontSize:13,fontWeight:700,color:'#222',margin:0}}>Your responses are safe with us</p>
              <p style={{...MN,fontSize:12,color:'#888',margin:0}}>Seen only by the e8n8 team. Never sold or shared.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <p style={{...MN,fontSize:13,fontWeight:700,color:'#222',margin:0}}>No unsolicited messages</p>
              <p style={{...MN,fontSize:12,color:'#888',margin:0}}>We only reach out if you left your contact details and we have something genuinely relevant to share.</p>
            </div>
          </div>
        </div>

        <p style={{...MN,fontSize:12,color:'#bbb',lineHeight:1.6}}>
          You can close this tab. Thank you again.
        </p>
      </div>
    </div>
  );
}

function ThankyouBengaluru(){
  return(
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4 sm:px-7">
        <p style={{fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#aaa',...MN,marginBottom:16}}>Bangalore Pilot · Early List</p>

        <h1 style={{...FR,fontSize:'clamp(1.4rem,5vw,1.9rem)',fontWeight:700,color:'#111',lineHeight:1.3,marginBottom:14}}>
          You're on the early list. Thank you.
        </h1>

        <p style={{...MN,fontSize:14,color:'#555',lineHeight:1.75,marginBottom:24}}>
          We genuinely appreciate you taking the time. When the Bangalore pilot is ready, we'll reach out personally — not through a bulk campaign.
        </p>

        <div className="border-2 border-gray-200 p-4 mb-6" style={{background:'#fafafa'}}>
          <p style={{...MN,fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#aaa',marginBottom:14}}>What to expect</p>
          <div className="flex items-start gap-3 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 12 19.79 19.79 0 0 1 1.21 3.5 2 2 0 0 1 3.18 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>
            <div>
              <p style={{...MN,fontSize:13,fontWeight:700,color:'#222',margin:0}}>A personal message on WhatsApp or email</p>
              <p style={{...MN,fontSize:12,color:'#888',margin:0}}>Only when we have something concrete to share — no spam.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <div>
              <p style={{...MN,fontSize:13,fontWeight:700,color:'#222',margin:0}}>Small group, not a public launch</p>
              <p style={{...MN,fontSize:12,color:'#888',margin:0}}>Your details stay with us and are never sold or shared.</p>
            </div>
          </div>
        </div>

        <p style={{...MN,fontSize:12,color:'#bbb',lineHeight:1.6}}>
          You can close this tab. We'll be in touch.
        </p>
      </div>
    </div>
  );
}

// ─── Landing page ─────────────────────────────────────────────────────────────
function LandingPage({onStart}){
  return(
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
        {/* Eyebrow */}
        <p style={{fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#aaa',...MN,marginBottom:16}}>Food & Fitness · Quick Survey</p>

        {/* Headline — vague, no product reveal */}
        <h1 style={{...FR,fontSize:'clamp(1.4rem,5vw,1.9rem)',fontWeight:700,color:'#111',lineHeight:1.3,marginBottom:14}}>
          A few honest questions about food and fitness.
        </h1>

        <p style={{...MN,fontSize:14,color:'#555',lineHeight:1.75,marginBottom:24}}>
          We're doing early research to understand how people approach eating, fitness goals, and diet routines. No selling, no agenda — just listening.
        </p>

        {/* What to expect */}
        <div className="border-2 border-gray-200 p-4 mb-6" style={{background:'#fafafa'}}>
          <p style={{...MN,fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#aaa',marginBottom:14}}>What to expect</p>

          {/* Clock icon */}
          <div className="flex items-start gap-3 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>
              <p style={{...MN,fontSize:13,fontWeight:700,color:'#222',margin:0}}>About 3–5 minutes</p>
              <p style={{...MN,fontSize:12,color:'#888',margin:0}}>Skip any question you prefer not to answer</p>
            </div>
          </div>

          {/* Lock icon */}
          <div className="flex items-start gap-3 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><rect x="3" y="11" width="18" height="11"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div>
              <p style={{...MN,fontSize:13,fontWeight:700,color:'#222',margin:0}}>Completely anonymous</p>
              <p style={{...MN,fontSize:12,color:'#888',margin:0}}>Unless you choose to share contact details at the end</p>
            </div>
          </div>

          {/* Location pin icon */}
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <div>
              <p style={{...MN,fontSize:13,fontWeight:700,color:'#222',margin:0}}>Based in Bangalore?</p>
              <p style={{...MN,fontSize:12,color:'#888',margin:0}}>There may be something early and exclusive for you at the end</p>
            </div>
          </div>
        </div>

        <p style={{...MN,fontSize:12,color:'#bbb',lineHeight:1.6}}>
          There are no right answers. The more honest you are, the more useful this is.
        </p>
      </div>

      {/* Start button */}
      <div className="border-t-2 border-gray-200 px-5 py-4 sm:px-7">
        <button type="button" onClick={onStart} style={MN}
          className="w-full py-4 bg-gray-900 text-white border-2 border-gray-900 text-sm font-bold hover:bg-black transition-colors">
          Start — takes 3–5 min →
        </button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function SurveyPage(){
  const[started,     setStarted]     =useState(false);
  const[answers,     setAnswers]     =useState({});
  const[history,     setHistory]     =useState([]);
  const[currentId,   setCurrentId]   =useState('q1');
  const[isSubmitted, setIsSubmitted] =useState(false);
  const[submitting,  setSubmitting]  =useState(false);
  const[submitErr,   setSubmitErr]   =useState(null);
  const[transitioning,setTransitioning]=useState(false);
  const[fillW,       setFillW]       =useState(0);
  const fillTick=useRef(null);

  const step=SM[currentId];
  const answered=isAnswered(currentId,answers);
  const sec=step?.sec??0;
  const secInfo=SEC[sec];
  const qi=step?.qi||0;
  const showMeta=qi>0&&sec<5&&!['contact','pilot','disc','done'].includes(step?.type);

  const dotsAnswered=history.filter(id=>SM[id]?.qi>0&&SM[id]?.sec<5).length;
  const pct=isSubmitted?100:Math.min(99,Math.round((dotsAnswered/TOTAL_MAIN)*100));

  // ALL navigation is via footer buttons only — no card-body buttons
  const needsBtn=false;
  // contact only appears for non-Bengaluru users now — always Finish
  const rightIsFinish=['pilot','disc','done','contact'].includes(step?.type);
  const rightIsNext=step?.type==='multi';
  const rightLabel=rightIsFinish?'Finish':rightIsNext?'Next':'Skip';
  const rightActive=rightIsFinish?answered&&!transitioning
    :rightIsNext?answered&&!transitioning
    :!step?.req&&!transitioning&&(step?.type==='single'||step?.type==='text'||step?.type==='city'||step?.type==='name');

  const nextAfterThis=resolveNext(currentId,answers);
  const cardBtnLabel=submitting?'Saving…':nextAfterThis==='END'?'Finish':'Next →';

  function startFill(){if(fillTick.current)clearInterval(fillTick.current);setFillW(20);fillTick.current=setInterval(()=>setFillW(w=>{if(w>=100){clearInterval(fillTick.current);return 100;}return w+3;}),18);}
  function resetFill(){if(fillTick.current)clearInterval(fillTick.current);setFillW(0);}
  useEffect(()=>()=>{if(fillTick.current)clearInterval(fillTick.current);},[]);

  const advance=useCallback((ans)=>{
    resetFill();
    const next=resolveNext(currentId,ans);
    if(!next||next==='END'){doSubmit(ans);return;}
    setHistory(h=>[...h,currentId]);
    setCurrentId(next);
    setTransitioning(false);
  },[currentId]);

  const goNext=useCallback((skip=false)=>{
    if(transitioning)return;
    if(!skip&&!answered)return;
    setTransitioning(true);
    advance(answers);
  },[answers,answered,advance,transitioning]);

  const goBack=useCallback(()=>{
    if(!history.length||transitioning)return;
    resetFill();setTransitioning(false);
    setHistory(h=>{const n=[...h];const prev=n.pop();setCurrentId(prev);return n;});
  },[history,transitioning]);

  const handleSingle=useCallback((val)=>{
    if(transitioning)return;
    setTransitioning(true);
    const upd={...answers,[currentId]:val};
    setAnswers(upd);
    setTimeout(()=>advance(upd),300);
  },[answers,currentId,advance,transitioning]);

  async function doSubmit(a){
    setSubmitting(true);setSubmitErr(null);
    try{
      const rawCity=a.q4||'';const city=normCity(rawCity);
      const contact=a.contact||{};const pilot=a.pilot||{};
      const finalName=pilot.name||contact.name||(a.q1==='Prefer not to say'?null:a.q1)||null;
      const finalWA=pilot.whatsapp||contact.whatsapp||null;
      const finalEmail=pilot.email||contact.email||null;
      await supabase.from('responses').insert([{
        name:finalName,age:a.q2||null,gender:a.q3||null,city,
        fitness_journey:a.q5||null,goal:a.q6||null,routine:a.q7||null,
        diet_approach:a.q9||null,who_cooks:a.q11||null,
        plan_type:a.q12||null,still_using:a.q13||null,plan_change:a.q14||null,
        plan_source:a.q15||null,time_effort_part:a.q16||null,tracking_confidence:a.q17||null,
        healthy_meaning:a.q20||null,progress_doubt:a.q21||null,structure_barrier:a.q22||null,
        starting_soon:a.q23||null,start_barrier:a.q24||null,help_preference:a.q25||null,
        old_approach_type:a.q26||null,stop_reason:a.q27||null,restart_condition:a.q28||null,
        food_priorities:Array.isArray(a.q31)?a.q31.join(', '):null,
        help_type:a.q32||null,delegate_task:a.q33||null,
        willingness_to_pay:a.q34||null,
        food_discovery:a.q35a||null,
        order_frequency:a.q35b||null,
        open_feedback:a.q36||null,
        contact_instagram:contact.instagram||null,contact_whatsapp:finalWA,contact_email:finalEmail,
        pilot_interest:a.q38||null,pilot_locality:pilot.locality||null,
        pilot_weight:pilot.weightCustom||pilot.weight||null,
        pilot_height:pilot.heightCustom||pilot.height||null,
        pilot_activity:pilot.activity||null,pilot_work_schedule:pilot.schedule||null,
        is_bengaluru:isBengaluru(rawCity),disclaimer_ack:Boolean(a.disclaimerAck),
        submitted_at:new Date().toISOString(),
      }]);
      setIsSubmitted(true);
    }catch(e){setSubmitErr('Something went wrong. Please try again.');setTransitioning(false);}
    finally{setSubmitting(false);}
  }

  const joinedPilot=answers.q38&&answers.q38!=='Not right now'&&isBengaluru(answers.q4);

  if(isSubmitted){
    return(
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <SiteHeader/>
        <main className="flex-1 flex flex-col items-center px-3 pt-4 pb-3 sm:px-4 sm:pt-6">
          <div className="w-full max-w-xl bg-white border-2 border-gray-200 flex flex-col"
            style={{height:'calc(100vh - 110px)',maxHeight:700,minHeight:460}}>
            {joinedPilot?<ThankyouBengaluru/>:<ThankyouGeneral/>}
          </div>
        </main>
        <SiteFooter/>
      </div>
    );
  }

  return(
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader/>
      <main className="flex-1 flex flex-col items-center px-3 pt-4 pb-3 sm:px-4 sm:pt-6">
        <div className="w-full max-w-xl bg-white border-2 border-gray-200 flex flex-col"
          style={{height:'calc(100vh - 110px)',maxHeight:700,minHeight:460}}>

          {/* Landing page — before questions start */}
          {!started&&<LandingPage onStart={()=>setStarted(true)}/>}

          {/* Survey */}
          {started&&(
            <>
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-3 sm:px-6 sm:pt-6">

                {/* Header */}
                {step?.type!=='done'&&(
                  <div className="mb-5">
                    {/* Section pill left · circle progress right — same row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="inline-flex items-center gap-1.5 border border-gray-300 bg-gray-50 px-2.5 py-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 flex-shrink-0"/>
                        <span style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#888',...MN}}>
                          {sec<5?`${secInfo?.n} · ${sec+1} of 5`:'Bangalore Pilot'}
                        </span>
                      </div>
                      <CircleProgress pct={pct}/>
                    </div>

                    {/* Q number | vertical divider | title + badge */}
                    <div className="flex items-start">
                      {showMeta&&(
                        <>
                          <span style={{...MN,fontSize:12,fontWeight:800,color:'#c0c0c0',lineHeight:'1.5rem',flexShrink:0,paddingTop:3,minWidth:36}}>Q{qi}/{secInfo?.q}</span>
                          <span style={{width:1,background:'#e0e0e0',alignSelf:'stretch',marginRight:10,flexShrink:0}}/>
                        </>
                      )}
                      <div className="flex-1 flex items-start justify-between gap-2 min-w-0">
                        <h2 style={{...FR,fontSize:'clamp(1rem,3.5vw,1.15rem)',fontWeight:600,color:'#111',lineHeight:1.4,margin:0,flex:1}}>
                          {step?.title}
                        </h2>
                        {step?.type!=='disc'&&step?.type!=='done'&&(
                          <div style={{flexShrink:0,marginTop:2}}><Badge req={step?.req}/></div>
                        )}
                      </div>
                    </div>
                    {step?.hint&&<p className="text-sm text-gray-400 mt-2" style={MN}>{step.hint}</p>}
                  </div>
                )}

                {/* Inputs */}
                <div className="mb-5">
                  {step?.type==='name'&&(
                    <NameInput value={answers.q1||''} onChange={val=>setAnswers(a=>({...a,q1:val}))} onAdvance={()=>goNext(true)}/>
                  )}
                  {step?.type==='single'&&(
                    <div className="space-y-2">
                      {step.opts?.map((o,i)=><Opt key={o} label={o} idx={i} selected={answers[currentId]===o} onClick={()=>handleSingle(o)}/>)}
                    </div>
                  )}
                  {step?.type==='multi'&&(
                    <div className="space-y-2">
                      {step.opts?.map((o,i)=>{
                        const sel=Array.isArray(answers[currentId])&&answers[currentId].includes(o);
                        return<Opt key={o} label={o} idx={i} selected={sel} onClick={()=>{
                          const cur=Array.isArray(answers[currentId])?[...answers[currentId]]:[];
                          const idx=cur.indexOf(o);
                          const upd=idx>-1?cur.filter(v=>v!==o):[...cur,o];
                          setAnswers(a=>({...a,[currentId]:upd}));
                          upd.length>0?startFill():resetFill();
                        }}/>;
                      })}
                    </div>
                  )}
                  {step?.type==='text'&&(step.long
                    ?<textarea value={answers[currentId]||''} rows={4} style={MN} onChange={e=>{setAnswers(a=>({...a,[currentId]:e.target.value}));e.target.value.trim()?startFill():resetFill();}} placeholder="Totally optional — write anything or skip" className={inp+' resize-none'}/>
                    :<input type="text" value={answers[currentId]||''} style={MN} onChange={e=>{setAnswers(a=>({...a,[currentId]:e.target.value}));e.target.value.trim()?startFill():resetFill();}} onKeyDown={e=>{if(e.key==='Enter'&&!transitioning)goNext(true);}} placeholder="Type your answer" className={inp}/>
                  )}
                  {step?.type==='city'&&<CityInput value={answers.q4||''} onChange={val=>{setAnswers(a=>({...a,q4:val}));}} onSelect={(city)=>{const upd={...answers,q4:city};setAnswers(upd);if(!transitioning){setTransitioning(true);advance(upd);}}}/>}
                  {step?.type==='contact'&&<ContactFields value={answers.contact} onChange={val=>setAnswers(a=>({...a,contact:val}))} prefillName={answers.q1==='Prefer not to say'?'':answers.q1||''}/>}
                  {step?.type==='pilot'&&<PilotFields value={answers.pilot} onChange={val=>setAnswers(a=>({...a,pilot:val}))} contact={{name:answers.q1==='Prefer not to say'?'':answers.q1||'',...(answers.contact||{})}}/>}
                  {step?.type==='disc'&&<DisclaimerBlock acked={Boolean(answers.disclaimerAck)} onAck={()=>setAnswers(a=>({...a,disclaimerAck:true}))}/>}
                  {step?.type==='done'&&<ThankyouGeneral/>}
                </div>

                {submitErr&&<p className="text-xs text-red-500 text-center mb-3" style={MN}>{submitErr}</p>}
              </div>

              {/* Footer nav — two equal buttons, divider between */}
              <div className="border-t-2 border-gray-200 flex flex-shrink-0" style={{minHeight:52}}>
                <div className="flex-1 border-r-2 border-gray-200">
                  {history.length===0
                    ?<NavBtn label="Next" onClick={()=>goNext()} active={answered&&!transitioning} side="right"/>
                    :<NavBtn label="Back" onClick={goBack} active={!transitioning} side="left"/>
                  }
                </div>
                <div className="flex-1">
                  <NavBtn label={rightLabel} onClick={rightIsFinish||rightIsNext?()=>goNext():()=>goNext(true)} active={rightActive} side="right"/>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter/>
    </div>
  );
}

function SiteHeader(){
  return(
    <header className="sticky top-0 z-10 bg-white border-b-2 border-gray-200 px-4 py-3">
      <div className="max-w-xl mx-auto flex items-center gap-2.5">
        <div className="w-7 h-7 bg-gray-900 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[10px] font-bold" style={MN}>e8</span>
        </div>
        <span className="font-bold text-gray-900 text-sm" style={MN}>e8n8</span>
      </div>
    </header>
  );
}
// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({title,onClose,children}){
  useEffect(()=>{
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow='';};
  },[]);
  return(
    <div style={{position:'fixed',inset:0,zIndex:50,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0'}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:'100%',maxWidth:560,background:'#fff',border:'2px solid #e5e7eb',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
        {/* Modal header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'2px solid #e5e7eb',flexShrink:0}}>
          <span style={{...MN,fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#888'}}>{title}</span>
          <button type="button" onClick={onClose} style={{...MN,background:'none',border:'2px solid #e5e7eb',width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:16,color:'#555',fontWeight:700}}>✕</button>
        </div>
        {/* Modal body */}
        <div style={{overflowY:'auto',padding:'20px',flex:1,...MN,fontSize:13,color:'#444',lineHeight:1.75}}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Privacy Policy content ───────────────────────────────────────────────────
function PrivacyContent(){
  return(
    <div className="space-y-5">
      <p style={{...FR,fontSize:16,fontWeight:700,color:'#111'}}>Privacy Policy</p>
      <p style={{color:'#666',fontSize:12}}>Last updated {new Date().getFullYear()}</p>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>1. What we collect</p>
        <p>We collect only what you choose to share in this survey — your responses to questions about your fitness routine, food habits, and diet approach. If you voluntarily provide your name, WhatsApp number, or email address, we collect that too. We do not collect any data beyond what you actively submit.</p>
      </div>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>2. How we use your data</p>
        <p>Your responses are used purely for internal research to understand how people approach food and fitness goals. This helps us understand real needs before building anything. We do not use your data to run ads, create profiles, or make automated decisions about you.</p>
      </div>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>3. We will never sell your data</p>
        <p>Your information is not shared with, sold to, or transferred to any third party — ever. It stays with the e8n8 team and is used only for the purpose described above.</p>
      </div>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>4. If you share contact details</p>
        <p>If you choose to leave your WhatsApp or email, we may reach out to say thank you or share relevant updates if we build something worth sharing. We will not spam you, add you to bulk mailing lists, or contact you about anything unrelated. You can opt out at any time by replying STOP or asking us to delete your details.</p>
      </div>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>5. Storage</p>
        <p>Responses are stored securely using Supabase, a trusted cloud database provider. Access is restricted to authorised members of the e8n8 team only.</p>
      </div>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>6. Your rights</p>
        <p>You can request deletion of your data at any time by contacting us. Since the survey is anonymous by default, if you did not leave contact details, there is nothing to delete — your response cannot be linked back to you.</p>
      </div>

      <p style={{color:'#bbb',fontSize:11,marginTop:12}}>Questions? Reach us at hello@e8n8.in</p>
    </div>
  );
}

// ─── Disclaimer content ───────────────────────────────────────────────────────
function DisclaimerContent(){
  return(
    <div className="space-y-5">
      <p style={{...FR,fontSize:16,fontWeight:700,color:'#111'}}>Disclaimer</p>
      <p style={{color:'#666',fontSize:12}}>Last updated {new Date().getFullYear()}</p>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>1. Purpose of this survey</p>
        <p>This survey is for research and learning purposes only. We are trying to understand how real people approach food, fitness, and diet — before we build anything. Nothing here is a product pitch, sales process, or subscription sign-up.</p>
      </div>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>2. No commitment on either side</p>
        <p>Completing this survey does not commit you to anything, and does not obligate us to contact you or build anything specific. If you express interest in the Bangalore pilot, we will reach out when and if it is ready — there is no guarantee of timeline or inclusion.</p>
      </div>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>3. Not medical or dietary advice</p>
        <p>Nothing in this survey or in any future communications from e8n8 constitutes medical, nutritional, or clinical advice. We are not dieticians, doctors, or licensed health professionals. Please consult a qualified professional before making significant changes to your diet.</p>
      </div>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>4. Accuracy of information</p>
        <p>Calorie counts, nutrition estimates, and any figures mentioned in connection with e8n8 are based on standard reference data and best-effort calculations. They should not be relied upon for medical or therapeutic decision-making.</p>
      </div>

      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>5. Early stage</p>
        <p>e8n8 is in an early research phase. Any details about a potential product — including pricing, menus, delivery areas, or availability — are illustrative only and subject to change without notice.</p>
      </div>

      <p style={{color:'#bbb',fontSize:11,marginTop:12}}>Questions? Reach us at hello@e8n8.in</p>
    </div>
  );
}

// ─── SiteFooter ───────────────────────────────────────────────────────────────
function SiteFooter(){
  const[modal,setModal]=useState(null);
  return(
    <>
      {modal==='privacy'&&<Modal title="Privacy Policy" onClose={()=>setModal(null)}><PrivacyContent/></Modal>}
      {modal==='disclaimer'&&<Modal title="Disclaimer" onClose={()=>setModal(null)}><DisclaimerContent/></Modal>}
      <footer className="border-t-2 border-gray-200 px-5 py-3 bg-white">
        <div className="max-w-xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-900 flex items-center justify-center">
              <span className="text-white text-[8px] font-bold" style={MN}>e8</span>
            </div>
            <span className="text-xs text-gray-400" style={MN}>© e8n8. All Rights Reserved.</span>
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={()=>setModal('privacy')} className="text-xs text-gray-400 hover:text-gray-700 underline" style={MN}>Privacy Policy</button>
            <button type="button" onClick={()=>setModal('disclaimer')} className="text-xs text-gray-400 hover:text-gray-700 underline" style={MN}>Disclaimer</button>
          </div>
        </div>
      </footer>
    </>
  );
}

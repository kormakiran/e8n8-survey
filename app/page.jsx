'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function normCity(c=''){return c.replace(/bangalore/gi,'Bengaluru');}
function isBengaluru(c=''){const l=c.toLowerCase();return l.includes('bengaluru')||l.includes('bangalore');}

const TOP_CITIES=['Bengaluru','Mumbai','Delhi','Hyderabad','Pune','Chennai','Kolkata','Ahmedabad','Gurgaon','Noida'];
const ALL_CITIES=[
  'Agartala','Agra','Ahmedabad','Aizawl','Ajmer','Akola','Aligarh','Allahabad','Alwar','Ambala',
  'Amravati','Amritsar','Anand','Anantapur','Asansol','Aurangabad','Bangalore','Bareilly','Belgaum','Bengaluru','Bhavnagar',
  'Bhilai','Bhiwandi','Bhiwani','Bhopal','Bhubaneswar','Bikaner','Bilaspur','Bokaro','Chandigarh','Chennai',
  'Coimbatore','Cuttack','Dahod','Darbhanga','Davanagere','Dehradun','Delhi','Dhanbad','Dharwad','Dibrugarh',
  'Durgapur','Erode','Faridabad','Firozabad','Gandhinagar','Ghaziabad','Gorakhpur','Gulbarga','Guntur','Gurgaon',
  'Guwahati','Gwalior','Hapur','Haridwar','Hubli','Hyderabad','Imphal','Indore','Itanagar','Jabalpur',
  'Jaipur','Jalandhar','Jalgaon','Jammu','Jamnagar','Jamshedpur','Jhansi','Jodhpur','Kakinada','Kalyan',
  'Kanpur','Karnal','Kochi','Kohima','Kolhapur','Kolkata','Kota','Kottayam','Kozhikode','Kumbakonam',
  'Kurnool','Lucknow','Ludhiana','Madurai','Malegaon','Mangaluru','Meerut','Moradabad','Mumbai','Muzaffarpur',
  'Mysuru','Nagpur','Nashik','Navi Mumbai','Nellore','Noida','Panaji','Patna','Pimpri-Chinchwad','Pondicherry',
  'Pune','Raipur','Rajkot','Rajahmundry','Ranchi','Rourkela','Saharanpur','Salem','Sangli','Shillong',
  'Shimla','Siliguri','Solapur','Srinagar','Surat','Thane','Thiruvananthapuram','Tiruchirappalli','Tirunelveli',
  'Tirupati','Tiruppur','Ujjain','Vadodara','Varanasi','Vellore','Vijayawada','Visakhapatnam','Warangal','Yamunanagar',
];

// Section definitions — qi counts only required questions per section
const SEC=[{n:'About You',q:5},{n:'Goal & Tracking',q:3},{n:'Your Approach',q:4},{n:'What Matters',q:6},{n:'Wrapping Up',q:1}];
// Average branch path ≈ 17 steps — use this as denominator so progress hits 100%
const PROGRESS_DENOM=17;

const OTHER_A='Something else — tell us what';
const OTHER_B='Something else — describe it';
const OTHER_C='Something else — tell me more';
const OTHER_E='Another reason — what was it?';
const OTHER_OPTS_LIST=[OTHER_A,OTHER_B,OTHER_C,OTHER_E,'Something else'];

const STEPS=[
  // ── Section 0 — About You (5) ─────────────────────────────────────────────
  {id:'q1', sec:0,qi:1,type:'name',  req:true, title:`What's your name?`,next:'q2'},
  {id:'q2', sec:0,qi:2,type:'single',req:true, title:'How old are you?',
   opts:['Under 25','25–34','35–44','45+','Prefer not to say'],next:'q3'},
  {id:'q3', sec:0,qi:3,type:'single',req:false,title:`What's your gender?`,
   opts:['Male','Female','Non-binary','Prefer not to say'],next:'q4'},
  {id:'q4', sec:0,qi:4,type:'city',  req:true, title:'Which city or area are you in?',next:'q4b'},
  {id:'q4b',sec:0,qi:5,type:'single',req:true,
   title:'Which best describes your diet?',
   opts:['Vegetarian','Non-vegetarian','Vegan','Jain','No specific restrictions'],next:'q5'},

  // ── Section 1 — Goal & Tracking (3 required + QNL optional) ──────────────
  {id:'q5', sec:1,qi:1,type:'single',req:true,
   title:'Which best describes your fitness journey right now?',
   opts:['Just starting out','Been at it a while','Very consistent and experienced','Not really working out right now'],next:'q6'},
  {id:'q6', sec:1,qi:2,type:'single',req:true,
   title:'What is your fitness goal right now?',
   opts:['Lose weight or body fat','Gain muscle','Improve stamina or fitness','Stay at my current weight','No specific goal right now'],next:'q7'},
  {id:'q7', sec:1,qi:3,type:'single',req:true,
   title:'Which best describes your current routine?',
   opts:['Gym and diet, both together','Only gym — not really watching my diet','Only diet — not really working out','Neither right now'],next:'qnl'},
  // Fix 3: QNL always shows qi so it gets a number
  {id:'qnl',sec:1,qi:4,type:'single',req:false,
   title:'How familiar are you with concepts like calorie deficit, protein targets, or macros?',
   opts:['I track them actively and know my numbers',"I understand them but don't follow them strictly","I've heard of them but don't really know how they work",'Not familiar at all'],next:'q9'},

  // ── Section 2 — Your Approach ─────────────────────────────────────────────
  {id:'q9', sec:2,qi:1,type:'single',req:true,
   title:'What are you currently doing about your diet?',
   opts:['Following a structured paid plan','Trying on my own with a structured plan','Trying on my own without any structure','Not doing anything specific',"I used to, but I've stopped"],
   branch:(a)=>a.q9==='Following a structured paid plan'?'q12':'q11'},

  {id:'q11',sec:2,qi:2,type:'single',req:true,
   title:'Who usually handles your food day to day?',
   opts:['I cook for myself','Family cooks','We have a cook','My meal plan provides it','I order in most days','A mix of these'],
   branch:(a)=>({'Trying on my own with a structured plan':'q15',
     'Trying on my own without any structure':'q20','Not doing anything specific':'q23',
     "I used to, but I've stopped":'q26'}[a.q9])||'q31'},

  // Branch A — Paid plan
  {id:'q12',sec:2,qi:3,type:'single-other',req:true,
   title:'What kind of paid plan is it?',
   opts:['Dietician or nutritionist','Meal delivery service (EatFit, Curefoods, Eat Club…)','Fitness app or online coach',OTHER_A],next:'q14'},
  {id:'q14',sec:2,qi:4,type:'multi-other',req:true,hint:'Select all that apply.',
   title:'If you could change things about it, what would you change?',
   opts:['Make it cheaper','Improve the food quality','Add more variety','Make it more flexible','Nothing — I am happy with it','Something else'],next:'qtrk'},
  // Part 2 Q1: Tracking habits — Branch A only
  {id:'qtrk',sec:2,qi:0,type:'single',req:false,
   title:'How would you describe your current diet and tracking habits?',
   opts:['I track strictly year-round as a lifestyle','I only track strictly during specific time-bound goals (like a 12-week cut)','I just keep a loose mental tally of my macros'],next:'q31'},

  // Branch B — Own structured
  {id:'q15',sec:2,qi:3,type:'single-other',req:true,
   title:'Where does your meal plan or structure come from?',
   opts:['I researched and designed it myself','A friend, trainer, or influencer gave me guidelines','A free plan I found online','A mix of sources',OTHER_B],next:'q16'},
  {id:'q16',sec:2,qi:4,type:'multi-other',req:true,hint:'Select all that apply.',
   title:'Which parts take the most time or effort?',
   opts:['Deciding what to eat','Buying groceries','Cooking or meal prep','Logging what I eat','Staying consistent',"None — it's easy",'Something else'],next:'q17'},
  {id:'q17',sec:2,qi:5,type:'single',req:true,
   title:`How confident are you that what you're eating actually matches your goal?`,
   opts:['Very confident',"Somewhat — I'm estimating a lot",'Not very confident',"I don't really track it"],next:'qtrk_b'},
  // Part 2 Q1: Tracking habits — Branch B
  {id:'qtrk_b',sec:2,qi:0,type:'single',req:false,
   title:'How would you describe your current diet and tracking habits?',
   opts:['I track strictly year-round as a lifestyle','I only track strictly during specific time-bound goals (like a 12-week cut)','I just keep a loose mental tally of my macros'],next:'qrep'},
  // Part 2 Q2: Meal repetition — Branch B only
  {id:'qrep',sec:2,qi:0,type:'single',req:false,
   title:'How often do you end up eating the exact same meals just because it\'s easier to track or prep?',
   opts:['Almost every day — I eat the same things on repeat','A few times a week','Rarely — I need variety','Not applicable — I don\'t prep or track'],next:'qb5'},
  {id:'qb5',sec:2,qi:0,type:'single',req:false,
   title:'How long have you been following this structure?',
   opts:['Less than a month','1–3 months','3–6 months','More than 6 months'],next:'q31'},

  // Branch C — No structure
  {id:'q20',sec:2,qi:3,type:'single-other',req:true,
   title:'What does eating healthy mean to you day to day?',
   opts:['Eating home-cooked food','Cutting out certain foods','Watching portions','General balance with no strict rules','Just eating a little less overall',OTHER_C],next:'q21'},
  {id:'q21',sec:2,qi:4,type:'single',req:true,
   title:`Do you ever wonder if what you're doing is actually working?`,
   opts:['Yes, often','Sometimes','Rarely',"I'm not really tracking anything"],next:'q22'},
  {id:'q22',sec:2,qi:5,type:'multi-other',req:true,hint:'Select all that apply.',
   title:`What's stopped you from being more structured about your diet?`,
   opts:['Too much effort',"Don't know where to start",'Eating with family makes it hard',"Haven't felt the need to","Tried before and it didn't work for me",'Something else'],next:'qc5'},
  {id:'qc5',sec:2,qi:0,type:'single',req:false,
   title:'What first made you start paying attention to what you eat?',
   opts:['Started going to the gym',"Doctor's advice or a health scare","Saw someone else's results",'Gained or lost weight noticeably','Just decided it was time'],next:'q31'},

  // Branch D — Not doing anything
  {id:'q23',sec:2,qi:3,type:'single',req:true,
   title:`Is this something you're thinking about starting?`,
   opts:['Yes, actively thinking about it','Maybe eventually','Not really a priority right now'],next:'q24'},
  {id:'q24',sec:2,qi:4,type:'multi-other',req:true,hint:'Select all that apply.',
   title:'What feels like the biggest barrier to starting?',
   opts:['Cost','Not knowing where to start','Not sure what actually works for me','Time or effort required','Lack of motivation','Something else'],next:'q25'},
  {id:'q25',sec:2,qi:5,type:'single',req:true,
   title:'If you did start, would you want to figure it out yourself or have it handled for you?',
   opts:['Figure it out myself with some guidance','Want it mostly handled for me','Not sure yet'],next:'qd5'},
  {id:'qd5',sec:2,qi:0,type:'single',req:false,
   title:'What would actually make you start this week?',
   opts:['If someone told me exactly what to eat','If it was affordable and easy to access','If I saw proof it actually works','Honestly nothing right now — not the right time'],next:'q31'},

  // Branch E — Used to, stopped
  {id:'q26',sec:2,qi:3,type:'single',req:true,
   title:'What approach did you follow before?',
   opts:['A paid plan or dietician','My own structured tracking','A casual effort with no strict structure'],next:'q27'},
  {id:'q27',sec:2,qi:4,type:'multi-other',req:true,
   title:'What led you to stop?',
   opts:['Life got busy','Lost motivation or got bored','Too expensive','Too much effort to maintain',"Didn't see results",OTHER_E],next:'q28'},
  {id:'q28',sec:2,qi:5,type:'multi-other',req:true,hint:'Select all that apply.',
   title:'What would need to be different for you to try again?',
   opts:['Lower cost','Less effort on my end','More flexibility','Seeing actual results','Someone to keep me accountable',"I'm not looking to try again",'Something else'],next:'qe6'},
  {id:'qe6',sec:2,qi:0,type:'single',req:false,
   title:'Are you actively looking for something to restart with, or just open if the right thing came along?',
   opts:['Actively looking for something right now','Open if the right thing came along','Not really thinking about it right now'],next:'q31'},

  // ── Section 3 — What Matters (6 questions) ───────────────────────────────
  {id:'q31',sec:3,qi:1,type:'multi-other',req:true,hint:'Select all that apply.',
   title:'Which of these matters most to you about the food you eat day to day?',
   opts:['Taste','Cost','Time and effort to get it','Knowing my calories or macros','Getting the right nutrition for my goal','Variety','Portion size','Something else'],next:'q32'},
  {id:'q32',sec:3,qi:2,type:'single-other',req:true,
   title:'What kind of support with your diet would suit you best?',
   opts:['Fully handled for me — I just eat it','Guided — with some choices left to me','Occasional reminders or nudges',"I don't think I need support right now",OTHER_C],next:'q33'},
  {id:'q33',sec:3,qi:3,type:'multi-other',req:false,hint:'Select all that apply.',
   title:'If someone could take over parts of your food routine, what would help most?',
   opts:['Deciding what to eat','Cooking or preparing it','Tracking what I eat','Shopping for groceries','Nothing — I prefer doing it myself','Something else'],next:'q34'},
  {id:'q34',sec:3,qi:4,type:'single',req:true,
   title:'How much would you be okay spending per day on food that fits your fitness goal?',
   opts:['Under ₹200','₹200–350','₹350–500','₹500–700','₹700 or more'],
   branch:(a)=>a.q9==='Following a structured paid plan'?'qdeal':'qhd'},
  {id:'qhd',sec:3,qi:5,type:'single',req:false,
   title:'Have you ever ordered food specifically because it was marketed as healthy or good for your goals?',
   opts:['Yes, and it worked well for me',"Yes, but it didn't stick","No, but I'd be open to trying","No, I prefer cooking or making my own choices"],next:'q35a'},
  {id:'q35a',sec:3,qi:6,type:'multi-other',req:false,hint:'Select all that apply.',
   title:'How do you usually discover food options that match your goals?',
   opts:['Social media or influencers','Friends or word of mouth','I research and look it up myself','I ask my trainer or coach',"I don't look — I eat whatever is available",'Something else'],next:'qdeal'},
  // Part 2 Q3: Flexibility / dealbreaker — universal, all paths converge here
  {id:'qdeal',sec:3,qi:6,type:'single',req:false,
   title:'If you have ever avoided or canceled a healthy meal delivery service, what was the primary dealbreaker?',
   opts:['Too rigid — I need flexibility for eating out, weekends, or travel','Menu got boring fast','Macro mismatch — didn\'t fit my exact calorie or protein needs','Too expensive to sustain long-term','N/A — I\'ve never considered a meal delivery service'],next:'q36d'},

  // ── Section 4 — Wrapping Up (1 question) ─────────────────────────────────
  {id:'q36d',sec:4,qi:1,type:'text',req:false,long:true,
   title:'What is the single biggest problem with how you eat right now?',
   hint:'Optional but very useful — be as specific as you like.',
   branch:(a)=>isBengaluru(a.q4)?'q38':'contact'},

  // ── Pilot gate ────────────────────────────────────────────────────────────
  {id:'contact',sec:4,qi:0,type:'contact',req:false,
   title:'Want us to reach out if we build something?',
   hint:'Totally optional. We never sell your details or send unsolicited messages.',
   next:'END'},
  {id:'q38',sec:5,qi:0,type:'single',req:true,
   title:'Would you be open to joining an early pilot in Bangalore?',
   opts:['Yes, definitely','Maybe — tell me more when it is ready','Not right now'],
   branch:(a)=>{if(a.q38==='Not right now')return 'END';return 'pilot';}},
  {id:'pilot',sec:5,qi:0,type:'pilot',req:true,title:'A couple more details',next:'END'},
];

const SM=Object.fromEntries(STEPS.map(s=>[s.id,s]));
// Fix 6: always safe fallback — branch result || next || END
function resolveNext(id,a){
  const s=SM[id];
  if(!s)return 'END';
  if(s.branch){const r=s.branch(a);return r||s.next||'END';}
  return s.next||'END';
}
const OTHER_OPTS=OTHER_OPTS_LIST;
function isAnswered(id,a){
  const s=SM[id];if(!s||!s.req)return true;
  const v=a[id];
  if(s.type==='multi'||s.type==='multi-other')return Array.isArray(v)&&v.length>0;
  if(s.type==='single-other'){
    if(!v)return false;
    if(OTHER_OPTS.includes(v))return Boolean(a[id+'_other']?.trim());
    return true;
  }
  if(s.type==='pilot'){
    const p=a.pilot||{};
    const hasLocality=Boolean(p.locality?.trim());
    const waVal=p.whatsapp||'';
    const waStripped=waVal.replace(/^\+?91/,'').replace(/[\s\-]/g,'').replace(/\D/g,'');
    const hasWA=Boolean(waVal.trim())&&waStripped.length===10;
    const hasEmail=Boolean(p.email?.trim())&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim());
    return hasLocality&&(hasWA||hasEmail);
  }
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
    ?<span style={{...base,background:'#dcfce7',color:'#166534',border:'1px solid #bbf7d0'}}><span style={{width:5,height:5,background:'#16a34a',display:'inline-block',flexShrink:0,borderRadius:'50%'}}/>Required</span>
    :<span style={{...base,background:'#dbeafe',color:'#1e40af',border:'1px solid #bfdbfe'}}>Optional</span>;
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

// ─── SingleOther — single select with inline text field for "Something else" ──
function SingleOther({step,value,otherValue,onChange,onOtherChange,onAdvance}){
  const isOtherOpt=(o)=>OTHER_OPTS.includes(o);
  const otherSelected=isOtherOpt(value);
  return(
    <div className="space-y-2">
      {step.opts?.map((o,i)=>{
        const isOther=isOtherOpt(o);
        const sel=value===o;
        return(
          <div key={o}>
            <Opt label={isOther?o.replace(' — ','\n— '):o} idx={i} selected={sel} onClick={()=>{
              if(isOther){
                // selecting Other — clear any previous regular answer, show text field
                onChange(o);
                onOtherChange('');
              } else {
                // selecting regular — clear other text, auto-advance
                onChange(o);
                onOtherChange('');
                setTimeout(()=>onAdvance(),300);
              }
            }}/>
            {sel&&isOther&&(
              <input autoFocus type="text" value={otherValue||''}
                onChange={e=>onOtherChange(e.target.value)}
                onFocus={e=>setTimeout(()=>e.target.scrollIntoView({behavior:'smooth',block:'nearest'}),300)}
                placeholder="Please specify…" style={MN} className={inp+' mt-2'}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MultiOther — multi select with inline text field for "Something else" ────
function MultiOther({step,value=[],otherValue,onChange,onOtherChange}){
  const isOtherOpt=(o)=>OTHER_OPTS.includes(o);
  const sel=(o)=>Array.isArray(value)&&value.includes(o);
  function toggle(o){
    const cur=Array.isArray(value)?[...value]:[];
    const idx=cur.indexOf(o);
    const next=idx>-1?cur.filter(v=>v!==o):[...cur,o];
    onChange(next);
    // clear other text if Other is being deselected
    if(idx>-1&&isOtherOpt(o))onOtherChange('');
  }
  return(
    <div className="space-y-2">
      {step.opts?.map((o,i)=>{
        const isOther=isOtherOpt(o);
        return(
          <div key={o}>
            <Opt label={o} idx={i} selected={sel(o)} onClick={()=>toggle(o)}/>
            {sel(o)&&isOther&&(
              <input autoFocus type="text" value={otherValue||''}
                onChange={e=>onOtherChange(e.target.value)}
                onFocus={e=>setTimeout(()=>e.target.scrollIntoView({behavior:'smooth',block:'nearest'}),300)}
                placeholder="Please specify…" style={MN} className={inp+' mt-2'}/>
            )}
          </div>
        );
      })}
    </div>
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

// ─── CircleProgress ───────────────────────────────────────────────────────────
function CircleProgress({pct}){
  const r=18,c=2*Math.PI*r,filled=(pct/100)*c;
  const done=pct>=100;
  return(
    <div style={{position:'relative',width:44,height:44,flexShrink:0}}>
      <svg width="44" height="44" viewBox="0 0 44 44" style={{transform:'rotate(-90deg)'}}>
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e5e5" strokeWidth="3"/>
        <circle cx="22" cy="22" r={r} fill={done?'#111':'none'} stroke="#111" strokeWidth="3"
          strokeDasharray={`${filled} ${c}`} strokeLinecap="butt"
          style={{transition:'stroke-dasharray 400ms ease'}}/>
      </svg>
      {!done&&<span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:10,fontWeight:800,color:'#111',...MN}}>
        {pct}%
      </span>}
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

// ─── CityInput — top 10 quick chips + typeahead for 150+ cities + any free text ─
function CityInput({value,onChange,onSelect}){
  const[q,setQ]=useState(value||'');
  const[open,setOpen]=useState(false);
  useEffect(()=>{setQ(value||'');},[value]);
  const filtered=ALL_CITIES.filter(c=>c.toLowerCase().includes(q.toLowerCase())&&q.length>0&&c.toLowerCase()!==q.toLowerCase()).slice(0,6);
  // If typed text doesn't match anything in the list, show it as a "use this" option
  const showFreeText=q.length>1&&!ALL_CITIES.some(c=>c.toLowerCase()===q.toLowerCase())&&filtered.length===0;
  function pick(city){
    setQ(city);
    onChange(city);
    setOpen(false);
    setTimeout(()=>onSelect(city),300);
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
          placeholder="Type your city…" style={MN} className={inp}/>
        {open&&(filtered.length>0||showFreeText)&&(
          <div className="absolute z-20 w-full bg-white border-2 border-gray-200 shadow-xl overflow-hidden" style={{borderTop:'none'}}>
            {filtered.map(city=>(
              <button key={city} type="button" onMouseDown={()=>pick(city)} style={MN}
                className="w-full px-4 py-3 text-sm font-semibold text-left text-gray-800 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                {city}
              </button>
            ))}
            {showFreeText&&(
              <button type="button" onMouseDown={()=>pick(q)} style={MN}
                className="w-full px-4 py-3 text-sm font-semibold text-left text-gray-800 hover:bg-gray-50 flex items-center gap-2">
                <span className="text-gray-400 text-xs">Use</span> {q}
              </button>
            )}
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
const ACTS=['Sedentary (little or no exercise)','Light (1–3 days/week)','Moderate (3–5 days/week)','Very active (6–7 days/week)'];
const SCHED=['Student','Desk job, fixed hours','Shift work','Flexible / freelance'];
function validatePhone(v){
  if(!v)return true;
  // Strip +91 or 91 prefix, then spaces/dashes
  const stripped=v.replace(/^\+?91/,'').replace(/[\s\-]/g,'');
  const digits=stripped.replace(/\D/g,'');
  return digits.length===10;
}
function validateEmail(v){return !v||(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));}

function PilotFields({value={},onChange,contact={}}){
  const[d,setD]=useState(()=>({
    name:contact.name||'',whatsapp:contact.whatsapp||'',email:contact.email||'',
    locality:'',weight:'',height:'',activity:'',schedule:'',...value,
  }));
  const[touched,setTouched]=useState({});
  function upd(k,v){const n={...d,[k]:v};setD(n);onChange(n);}
  function touch(k){setTouched(t=>({...t,[k]:true}));}

  // Fix 8: dynamic required indicators
  const waRequired=!d.email?.trim();
  const emRequired=!d.whatsapp?.trim();
  const waOk=validatePhone(d.whatsapp);
  const emOk=validateEmail(d.email);
  const hasContact=(d.whatsapp&&waOk)||(d.email&&emOk);
  const hasLocality=Boolean(d.locality?.trim());

  const waErr=touched.whatsapp&&d.whatsapp&&!waOk;
  const emErr=touched.email&&d.email&&!emOk;
  // Show "need contact" error only if user touched both fields and neither is valid
  const contactErr=touched.whatsapp&&touched.email&&!hasContact;

  const sel='w-full border-2 border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:border-gray-900 transition-colors bg-white appearance-none';
  const field=(label,req,children)=>(
    <div>
      <label className={lbl} style={MN}>{label}{req&&<span className="text-red-500 ml-1">*</span>}{!req&&<span className="normal-case font-normal text-gray-400 ml-1">(opt)</span>}</label>
      {children}
    </div>
  );
  return(
    <div className="space-y-3">
      {/* Banner */}
      <div className="bg-gray-900 text-white px-4 py-3">
        <p className="font-bold text-sm" style={FR}>You're on the early list</p>
        <p className="text-gray-300 text-xs leading-relaxed mt-0.5" style={MN}>Locality + WhatsApp or email required. Everything else is optional.</p>
      </div>

      {/* 2-column grid form */}
      <div className="bg-gray-50 border border-gray-200 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">

          {field('Name',false,
            <input value={d.name||''} onChange={e=>upd('name',e.target.value)} placeholder="Your name" type="text" style={MN} className={inp}/>
          )}
          {field('Area in Bengaluru',true,
            <input value={d.locality} onChange={e=>upd('locality',e.target.value)} onBlur={()=>touch('locality')} placeholder="e.g. HSR, Koramangala" style={MN}
              className={inp+(touched.locality&&!hasLocality?' border-red-400':'')}/>
          )}

          {field('WhatsApp',waRequired,
            <div>
              <input value={d.whatsapp||''} onChange={e=>upd('whatsapp',e.target.value)} onBlur={()=>touch('whatsapp')} placeholder="+91 98765 43210" type="tel" style={MN}
                className={inp+(waErr?' border-red-400':'')}/>
              {waErr&&<p className="text-xs text-red-500 mt-1" style={MN}>Enter a valid 10-digit number (+91 or without)</p>}
            </div>
          )}
          {field('Email',emRequired,
            <div>
              <input value={d.email||''} onChange={e=>upd('email',e.target.value)} onBlur={()=>touch('email')} placeholder="you@example.com" type="email" style={MN}
                className={inp+(emErr?' border-red-400':'')}/>
              {emErr&&<p className="text-xs text-red-500 mt-1" style={MN}>Enter a valid email address</p>}
            </div>
          )}

          {field('Height',false,
            <input value={d.height||''} onChange={e=>upd('height',e.target.value)} placeholder="e.g. 5 ft 8 in" type="text" style={MN} className={inp}/>
          )}
          {field('Weight',false,
            <input value={d.weight||''} onChange={e=>upd('weight',e.target.value)} placeholder="e.g. 72 kg" type="text" inputMode="decimal" style={MN} className={inp}/>
          )}

          {field('Work schedule',false,
            <div className="relative">
              <select value={d.schedule||''} onChange={e=>upd('schedule',e.target.value)} style={MN} className={sel}>
                <option value="">Select…</option>
                {SCHED.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
              <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'#888',fontSize:10}}>▼</span>
            </div>
          )}
          {field('Activity level',false,
            <div className="relative">
              <select value={d.activity||''} onChange={e=>upd('activity',e.target.value)} style={MN} className={sel}>
                <option value="">Select…</option>
                {ACTS.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
              <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'#888',fontSize:10}}>▼</span>
            </div>
          )}

        </div>
        {contactErr&&<p className="text-xs text-red-500 mt-3" style={MN}>Please enter a valid WhatsApp number or email address so we can reach you.</p>}
        <p className="text-xs text-gray-400 mt-3" style={MN}>WhatsApp or email required so we can reach you. We never share your details.</p>
      </div>
    </div>
  );
}
// ─── DisclaimerBlock ──────────────────────────────────────────────────────────
function DisclaimerBlock({onAck,acked}){
  return(
    <div>
      <div className="border-2 border-gray-200 p-4 mb-3" style={{background:'#fafafa'}}>
        <p className="font-bold text-gray-900 text-sm mb-3" style={MN}>Before you finish — a few things</p>
        <div className="space-y-2.5">
          {[
            'This is an early-stage pilot. Details may change.',
            'Your data is used only for pilot planning — never shared.',
            'Expressing interest does not guarantee a spot.',
            'e8n8 is not a medical or dietary service.',
            'We will reach out personally — no bulk messages.',
          ].map((pt,i)=>(
            <div key={i} className="flex items-start gap-2.5">
              <span style={{...MN,fontSize:11,fontWeight:800,color:'#bbb',flexShrink:0,marginTop:1}}>{i+1}.</span>
              <p style={{...MN,fontSize:12,color:'#555',lineHeight:1.6,margin:0}}>{pt}</p>
            </div>
          ))}
        </div>
      </div>
      {!acked&&<button type="button" onClick={onAck} style={MN}
        className="w-full py-4 border-2 border-gray-900 bg-gray-900 text-white text-sm font-bold hover:bg-black transition-colors">
        I understand and agree
      </button>}
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

        {/* Share nudge */}
        <div className="mt-6 border-2 border-gray-200 p-4" style={{background:'#fafafa'}}>
          <p style={{...MN,fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#aaa',marginBottom:10}}>Know someone who'd find this useful?</p>
          <p style={{...MN,fontSize:13,color:'#555',marginBottom:12,lineHeight:1.6}}>If you know someone into fitness or trying to eat better, sharing this takes 5 seconds.</p>
          <a href={`https://wa.me/?text=${encodeURIComponent("Hey! take this quick survey on food and fitness habits — honest, no selling involved. Takes 3–5 mins: https://e8n8-survey.vercel.app")}`}
            target="_blank" rel="noopener noreferrer" style={MN}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white text-sm font-bold hover:bg-black transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.86L0 24l6.335-1.658A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.52-5.166-1.427l-.371-.22-3.844 1.006 1.03-3.747-.241-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            Share on WhatsApp
          </a>
        </div>
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
          You're on the early list.
        </h1>

        <p style={{...MN,fontSize:14,color:'#555',lineHeight:1.75,marginBottom:24}}>
          We genuinely appreciate you taking the time. When the Bangalore pilot is ready, we'll reach out personally — not through a bulk message.
        </p>

        {/* What to expect */}
        <div className="border-2 border-gray-200 p-4 mb-5" style={{background:'#fafafa'}}>
          <p style={{...MN,fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#aaa',marginBottom:14}}>What to expect</p>
          <div className="flex items-start gap-3 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 12 19.79 19.79 0 0 1 1.21 3.5 2 2 0 0 1 3.18 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>
            <div>
              <p style={{...MN,fontSize:13,fontWeight:700,color:'#222',margin:0}}>A personal message — no bulk campaign</p>
              <p style={{...MN,fontSize:12,color:'#888',margin:0}}>Only when we have something concrete to share.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <div>
              <p style={{...MN,fontSize:13,fontWeight:700,color:'#222',margin:0}}>Small group, not a public launch</p>
              <p style={{...MN,fontSize:12,color:'#888',margin:0}}>Your details stay with us and are never sold or shared.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><rect x="3" y="11" width="18" height="11"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div>
              <p style={{...MN,fontSize:13,fontWeight:700,color:'#222',margin:0}}>This is an early-stage pilot</p>
              <p style={{...MN,fontSize:12,color:'#888',margin:0}}>Details may change. Expressing interest does not guarantee a spot.</p>
            </div>
          </div>
        </div>

        <p style={{...MN,fontSize:12,color:'#bbb',lineHeight:1.6,marginBottom:20}}>
          You can close this tab. We'll be in touch.
        </p>

        {/* Share nudge */}
        <div className="border-2 border-gray-200 p-4" style={{background:'#fafafa'}}>
          <p style={{...MN,fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#aaa',marginBottom:10}}>Know someone in Bangalore who'd want in?</p>
          <p style={{...MN,fontSize:13,color:'#555',marginBottom:12,lineHeight:1.6}}>Share this with anyone who takes fitness and food seriously.</p>
          <a href={`https://wa.me/?text=${encodeURIComponent("Hey! take this quick survey on food and fitness habits — honest, no selling involved. Takes 3–5 mins: https://e8n8-survey.vercel.app")}`}
            target="_blank" rel="noopener noreferrer" style={MN}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white text-sm font-bold hover:bg-black transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.86L0 24l6.335-1.658A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.52-5.166-1.427l-.371-.22-3.844 1.006 1.03-3.747-.241-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            Share on WhatsApp
          </a>
        </div>
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

  // ── Fix 1+3: Dynamic Q numbering ─────────────────────────────────────────
  // Walk the actual path the user is on (history + current) within current section
  // to compute qNum/qTotal dynamically — no hardcoded qi or SEC.q
  const sectionPath=useMemo(()=>{
    // Collect all steps the user has seen in this section so far
    const seen=[...history,currentId].filter(id=>{
      const s=SM[id];
      return s&&s.sec===sec&&!['contact','pilot','disc','done'].includes(s.type);
    });
    // Project forward from currentId to find remaining required steps in this section
    const future=[];
    let next=resolveNext(currentId,answers);
    for(let i=0;i<20;i++){
      const s=SM[next];
      if(!s||s.sec!==sec||next==='END'||['contact','pilot','disc','done'].includes(s.type))break;
      future.push(next);
      next=s.next||'END';
      if(!s.next)break;
    }
    // Deduplicate
    const all=[...new Set([...seen,...future])];
    return all;
  },[currentId,history,sec,answers]);

  const qNum=sectionPath.indexOf(currentId)+1;
  const qTotal=sectionPath.length;
  const showMeta=sec<5&&qNum>0&&!['contact','pilot','disc','done'].includes(step?.type);

  // ── Fix 4: Dynamic progress based on user's actual path ──────────────────
  const totalPathLen=useMemo(()=>{
    // Simulate full path from q1 with current answers to find total steps
    const path=[];
    let id='q1';
    for(let i=0;i<60;i++){
      path.push(id);
      const s=SM[id];
      if(!s)break;
      const next=resolveNext(id,answers);
      if(!next||next==='END'||next==='pilot'||path.includes(next))break;
      id=next;
    }
    return Math.max(path.length,1);
  },[answers]);

  const inPilot=sec>=5;
  const pct=isSubmitted?100:inPilot?100:Math.min(99,Math.round((history.length/totalPathLen)*100));

  // ── Fix 2: Q38 "Not right now" — no auto-advance, just change button ─────
  const isQ38No=currentId==='q38'&&answers.q38==='Not right now';

  const rightIsFinish=['pilot','done','contact'].includes(step?.type)||isQ38No;
  const otherIsSelected=step?.type==='single-other'&&OTHER_OPTS.includes(answers[currentId]);
  const rightIsNext=step?.type==='multi'||step?.type==='multi-other'||otherIsSelected;
  const isReq=Boolean(step?.req);
  const rightLabel=rightIsFinish?'Finish':rightIsNext?'Next':answered?'Next':isReq?'Next':'Skip →';
  const rightActive=rightIsFinish?(answered&&!transitioning)||isQ38No
    :rightIsNext?answered&&!transitioning
    :isReq?(answered&&!transitioning)
    :!transitioning;
  const leftActive=history.length>0&&!transitioning;

  const nextAfterThis=resolveNext(currentId,answers);
  const cardBtnLabel=submitting?'Saving…':nextAfterThis==='END'?'Finish':'Next →';

  function startFill(){if(fillTick.current)clearInterval(fillTick.current);setFillW(20);fillTick.current=setInterval(()=>setFillW(w=>{if(w>=100){clearInterval(fillTick.current);return 100;}return w+3;}),18);}
  function resetFill(){if(fillTick.current)clearInterval(fillTick.current);setFillW(0);}
  useEffect(()=>()=>{if(fillTick.current)clearInterval(fillTick.current);},[]);

  const sessionId=useRef(null);
  const sourceRef=useRef(null);
  useEffect(()=>{
    // Generate fresh session ID on every page load
    sessionId.current=typeof crypto!=='undefined'?crypto.randomUUID():'sess-'+Date.now();
    // Capture ?src= URL param for channel tracking
    const params=new URLSearchParams(window.location.search);
    const src=params.get('src');
    if(src)sourceRef.current=src;
  },[]);

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
    const upd={...answers,[currentId]:val};
    setAnswers(upd);
    // Fix 2: Q38 "Not right now" — don't auto-advance, let user click Finish
    if(currentId==='q38'&&val==='Not right now')return;
    setTransitioning(true);
    setTimeout(()=>advance(upd),300);
  },[answers,currentId,advance,transitioning]);

  async function doSubmit(a){
    setSubmitting(true);setSubmitErr(null);
    try{
      const rawCity=a.q4||'';const city=normCity(rawCity);
      const contact=a.contact||{};const pilot=a.pilot||{};
      // Fix 9: "Prefer not to say" saves as null
      const finalName=pilot.name||contact.name||(a.q1==='Prefer not to say'?null:a.q1)||null;
      const finalWA=pilot.whatsapp||contact.whatsapp||null;
      const finalEmail=pilot.email||contact.email||null;
      const oo=(key)=>{const v=a[key];return OTHER_OPTS.includes(v)?(a[key+'_other']||v):v||null;};
      const arr=(key)=>Array.isArray(a[key])?a[key].join(', '):null;
      const arrOther=(key)=>{
        if(!Array.isArray(a[key]))return null;
        return a[key].map(v=>OTHER_OPTS.includes(v)?(a[key+'_other']||v):v).join(', ');
      };
      const {error}=await supabase.from('responses').insert([{
        session_id:sessionId.current,
        source:sourceRef.current,
        last_question_seen:'completed',
        name:finalName,age:a.q2||null,gender:a.q3||null,city,
        is_bengaluru:isBengaluru(rawCity),
        dietary_restrictions:a.q4b||null,
        goal:a.q6||null,routine:a.q7||null,nutrition_literacy:a.qnl||null,
        diet_approach:a.q9||null,
        plan_type:oo('q12'),plan_change:arrOther('q14'),
        tracking_habits:a.qtrk||null,
        plan_source:oo('q15'),time_effort_part:arrOther('q16'),
        tracking_confidence:a.q17||null,tracking_habits_b:a.qtrk_b||null,
        meal_repetition:a.qrep||null,plan_duration:a.qb5||null,
        healthy_meaning:oo('q20'),progress_doubt:a.q21||null,
        structure_barrier:arrOther('q22'),diet_trigger:a.qc5||null,
        starting_soon:a.q23||null,start_barrier:arrOther('q24'),
        help_preference:a.q25||null,start_trigger:a.qd5||null,
        old_approach_type:a.q26||null,stop_reason:arrOther('q27'),
        restart_condition:arrOther('q28'),restart_intent:a.qe6||null,
        food_priorities:arrOther('q31'),help_type:oo('q32'),
        delegate_task:arrOther('q33'),willingness_to_pay:a.q34||null,
        healthy_delivery_tried:a.qhd||null,food_discovery:arrOther('q35a'),
        dealbreaker:a.qdeal||null,
        biggest_pain:a.q36d||null,
        contact_instagram:contact.instagram||null,
        contact_whatsapp:finalWA,contact_email:finalEmail,
        pilot_interest:a.q38||null,pilot_locality:pilot.locality||null,
        pilot_weight:pilot.weight||null,pilot_height:pilot.height||null,
        pilot_activity:pilot.activity||null,pilot_work_schedule:pilot.schedule||null,
        disclaimer_ack:false,
        submitted_at:new Date().toISOString(),
      }]);
      if(error){
        console.error('Supabase insert error:',JSON.stringify(error));
        setSubmitErr('Something went wrong saving your response. Please try again.');
        setTransitioning(false);
        return;
      }
      setIsSubmitted(true);
    }catch(e){
      console.error('doSubmit error:',e);
      setSubmitErr('Something went wrong. Please try again.');
      setTransitioning(false);
    }finally{setSubmitting(false);}
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
                      {sec<5?(()=>{
                        const PILLS=[
                          {bg:'#fff7ed',border:'#fed7aa',dot:'#ea580c',text:'#9a3412'}, // About You — orange
                          {bg:'#fdf4ff',border:'#e9d5ff',dot:'#a855f7',text:'#7e22ce'}, // Goal & Tracking — purple
                          {bg:'#fff1f2',border:'#fecdd3',dot:'#e11d48',text:'#9f1239'}, // Your Approach — rose
                          {bg:'#fefce8',border:'#fde68a',dot:'#ca8a04',text:'#713f12'}, // What Matters — amber
                          {bg:'#fdf2f8',border:'#f0abfc',dot:'#c026d3',text:'#86198f'}, // Wrapping Up — fuchsia
                        ];
                        const p=PILLS[sec]||PILLS[0];
                        return(
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1" style={{background:p.bg,border:`1px solid ${p.border}`}}>
                            <span style={{width:6,height:6,borderRadius:'50%',background:p.dot,flexShrink:0}}/>
                            <span style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:p.text,...MN}}>
                              {secInfo?.n} · {sec+1} of 5
                            </span>
                          </div>
                        );
                      })():(
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1" style={{background:'#fff1f2',border:'1px solid #fecdd3'}}>
                          <span style={{width:6,height:6,borderRadius:'50%',background:'#e11d48',flexShrink:0}}/>
                          <span style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#9f1239',...MN}}>
                            Bangalore Pilot
                          </span>
                        </div>
                      )}
                      {sec<5&&<CircleProgress pct={pct}/>}
                    </div>

                    {/* Q number | vertical divider | title + badge */}
                    <div className="flex items-start">
                      {showMeta&&(
                        <>
                          <span style={{...MN,fontSize:12,fontWeight:800,color:'#c0c0c0',lineHeight:'1.5rem',flexShrink:0,paddingTop:3,minWidth:44}}>Q{qNum}/{qTotal}</span>
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
                  {step?.type==='single-other'&&(
                    <SingleOther step={step} value={answers[currentId]||''} otherValue={answers[currentId+'_other']||''}
                      onChange={val=>setAnswers(a=>({...a,[currentId]:val}))}
                      onOtherChange={val=>setAnswers(a=>({...a,[currentId+'_other']:val}))}
                      onAdvance={()=>{setTransitioning(true);advance(answers);}}/>
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
                  {step?.type==='multi-other'&&(
                    <MultiOther step={step} value={answers[currentId]||[]} otherValue={answers[currentId+'_other']||''}
                      onChange={val=>{setAnswers(a=>({...a,[currentId]:val}));val.length>0?startFill():resetFill();}}
                      onOtherChange={val=>setAnswers(a=>({...a,[currentId+'_other']:val}))}/>
                  )}
                  {step?.type==='text'&&(step.long
                    ?<div>
                      <textarea value={answers[currentId]||''} rows={4} style={MN}
                        onChange={e=>{setAnswers(a=>({...a,[currentId]:e.target.value}));e.target.value.trim()?startFill():resetFill();}}
                        onFocus={e=>setTimeout(()=>e.target.scrollIntoView({behavior:'smooth',block:'nearest'}),300)}
                        placeholder={step.req?"Write your answer here…":"Totally optional — write anything or skip"}
                        className={inp+' resize-none'}/>
                      {step.req&&<p style={{...MN,fontSize:11,color:'#bbb',textAlign:'right',marginTop:4}}>{(answers[currentId]||'').length} chars</p>}
                    </div>
                    :<input type="text" value={answers[currentId]||''} style={MN}
                        onChange={e=>{setAnswers(a=>({...a,[currentId]:e.target.value}));e.target.value.trim()?startFill():resetFill();}}
                        onKeyDown={e=>{if(e.key==='Enter'&&!transitioning)goNext(true);}}
                        onFocus={e=>setTimeout(()=>e.target.scrollIntoView({behavior:'smooth',block:'nearest'}),300)}
                        placeholder="Type your answer" className={inp}/>
                  )}
                  {step?.type==='city'&&<CityInput value={answers.q4||''} onChange={val=>{setAnswers(a=>({...a,q4:val}));}} onSelect={(city)=>{const upd={...answers,q4:city};setAnswers(upd);if(!transitioning){setTransitioning(true);advance(upd);}}}/>}
                  {step?.type==='contact'&&<ContactFields value={answers.contact} onChange={val=>setAnswers(a=>({...a,contact:val}))} prefillName={answers.q1==='Prefer not to say'?'':answers.q1||''}/>}
                  {step?.type==='pilot'&&<PilotFields value={answers.pilot} onChange={val=>setAnswers(a=>({...a,pilot:val}))} contact={{name:answers.q1==='Prefer not to say'?'':answers.q1||'',...(answers.contact||{})}}/>}
                  {step?.type==='done'&&<ThankyouGeneral/>}
                </div>

                {submitErr&&<p className="text-xs text-red-500 text-center mb-3" style={MN}>{submitErr}</p>}
              </div>

              {/* Footer nav */}
              <div className="border-t-2 border-gray-200 flex flex-shrink-0" style={{minHeight:52}}>
                <div className="flex-1 border-r-2 border-gray-200">
                  {history.length>0
                    ?<NavBtn label="Back" onClick={goBack} active={leftActive} side="left"/>
                    :<NavBtn label="Back" onClick={()=>setStarted(false)} active={!transitioning} side="left"/>
                  }
                </div>
                <div className="flex-1">
                  <NavBtn label={rightLabel} onClick={()=>{
                    if(rightIsFinish||rightIsNext){goNext();}
                    else if(answered){goNext();}
                    else{goNext(true);}
                  }} active={rightActive} side="right"/>
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

function AboutContent(){
  return(
    <div className="space-y-5">
      <p style={{...FR,fontSize:16,fontWeight:700,color:'#111'}}>About This Survey</p>
      <p style={{color:'#666',fontSize:12}}>e8n8 Research Initiative</p>
      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>Who we are</p>
        <p>We are a small team doing early-stage research into how people in India approach food, fitness, and everyday diet decisions. We are not a brand, not a service, and not selling anything — yet.</p>
      </div>
      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>Why this survey exists</p>
        <p>Before building anything, we want to understand real behaviour and real frustrations — from real people. This survey is the first step in that process. Your answers shape what we explore next.</p>
      </div>
      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>What we do with your answers</p>
        <p>Responses are used purely for internal research. We look for patterns, not individuals. We do not share, sell, or use your data for advertising of any kind.</p>
      </div>
      <div>
        <p style={{fontWeight:700,color:'#111',marginBottom:6}}>The Bangalore pilot</p>
        <p>We are exploring whether there is a real need for something specific to the Bangalore market. If you are based there and express interest, we may reach out when we have something concrete — personally, not through a bulk campaign.</p>
      </div>
      <p style={{color:'#bbb',fontSize:11,marginTop:12}}>Questions? Reach us at hello@e8n8.in</p>
    </div>
  );
}

function SiteHeader(){
  const[modal,setModal]=useState(null);
  return(
    <>
      {modal==='about'&&<Modal title="About" onClose={()=>setModal(null)}><AboutContent/></Modal>}
      <header className="sticky top-0 z-10 bg-white border-b-2 border-gray-200 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gray-900 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold" style={MN}>e8</span>
            </div>
            <span className="font-bold text-gray-900 text-sm" style={MN}>e8n8</span>
          </div>
          <button type="button" onClick={()=>setModal('about')}
            className="text-xs text-gray-400 hover:text-gray-700 underline" style={MN}>About</button>
        </div>
      </header>
    </>
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

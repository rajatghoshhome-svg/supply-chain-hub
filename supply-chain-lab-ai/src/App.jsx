import { useState } from "react";

// ─── PALETTE: DEEP NAVY ───────────────────────────────────────────────────────
const C = {
  navy:       "#1B3A6B",
  navyDark:   "#122849",
  navyMid:    "#2952A3",
  navyWash:   "#EBF1FA",
  navyBorder: "#C8D8EE",
  white:      "#FFFFFF",
  cream:      "#F8F6F1",
  ink:        "#141210",
  inkMid:     "#46443F",
  inkLight:   "#858278",
  inkGhost:   "#C0BDB6",
  border:     "#E4E1DA",
  gold:       "#C9A84C",
  goldLight:  "#F5EDD4",
};

const FORMSPREE_ID = "mpqoqaab";
const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior:"smooth" });

const LOGOS = [
  { name:"University of Oklahoma", domain:"ou.edu" },
  { name:"ExxonMobil",             domain:"corporate.exxonmobil.com" },
  { name:"3M",                     domain:"3m.com" },
  { name:"Mars",                   domain:"mars.com" },
  { name:"o9 Solutions",           domain:"o9solutions.com" },
];

const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Lora:ital,wght@0,500;0,600;1,500&family=JetBrains+Mono:wght@400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;}
    body{background:${C.white};color:${C.ink};font-family:'Inter',sans-serif;}

    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    .r1{animation:fadeUp 0.6s 0.05s ease both}
    .r2{animation:fadeUp 0.6s 0.18s ease both}
    .r3{animation:fadeUp 0.6s 0.3s ease both}
    .r4{animation:fadeUp 0.6s 0.42s ease both}

    /* Primary CTA — navy fill */
    .btn-p{background:${C.navy};color:#fff;border:none;border-radius:7px;font-family:'Inter',sans-serif;font-size:15px;font-weight:500;cursor:pointer;padding:13px 28px;transition:background 0.18s;}
    .btn-p:hover{background:${C.navyDark};}
    .btn-p:disabled{opacity:0.38;cursor:default;}

    /* Ghost on light bg */
    .btn-g{background:transparent;color:${C.inkMid};border:1.5px solid ${C.border};border-radius:7px;font-family:'Inter',sans-serif;font-size:15px;font-weight:400;cursor:pointer;padding:13px 28px;transition:all 0.18s;}
    .btn-g:hover{border-color:${C.navy};color:${C.navy};}

    /* Ghost on dark bg */
    .btn-gd{background:transparent;color:rgba(255,255,255,0.82);border:1.5px solid rgba(255,255,255,0.28);border-radius:7px;font-family:'Inter',sans-serif;font-size:15px;font-weight:400;cursor:pointer;padding:13px 28px;transition:all 0.18s;}
    .btn-gd:hover{border-color:rgba(255,255,255,0.6);color:#fff;}

    /* White fill on dark bg */
    .btn-w{background:#fff;color:${C.navy};border:none;border-radius:7px;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;cursor:pointer;padding:13px 28px;transition:opacity 0.18s;}
    .btn-w:hover{opacity:0.88;}

    .field{width:100%;background:${C.white};border:1.5px solid ${C.border};border-radius:7px;padding:12px 15px;font-family:'Inter',sans-serif;font-size:14px;color:${C.ink};outline:none;transition:border-color 0.15s;-webkit-appearance:none;}
    .field:focus{border-color:${C.navy};}
    .field::placeholder{color:${C.inkGhost};}
    textarea.field{resize:vertical;min-height:100px;}

    /* Hero background pattern */
    .hero-pattern{
      position:absolute;inset:0;
      background-image:radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
      background-size:28px 28px;
      pointer-events:none;
    }

    /* Content containers: full-width backgrounds, capped content column */
    .wrap,.nav-inner,.hero-inner,.footer-inner{
      max-width:1100px;
      margin-left:auto;
      margin-right:auto;
      padding-left:48px;
      padding-right:48px;
    }

    @media(max-width:768px){
      .stats-grid{flex-direction:column !important;gap:28px !important;}
      .stats-divider{display:none !important;}
      .focus-header{flex-direction:column !important;align-items:flex-start !important;gap:12px !important;}
      .process-grid{grid-template-columns:1fr !important;}
    }

    @media(max-width:620px){
      .wrap,.nav-inner,.hero-inner,.footer-inner{max-width:100% !important;padding-left:20px !important;padding-right:20px !important;}
      .footer-inner{flex-direction:column !important;gap:10px !important;align-items:flex-start !important;}
      .hero-btns{flex-direction:column !important;}
      .hero-btns button{width:100% !important;}
      .form-row{flex-direction:column !important;}
      .svc-note{flex-direction:column !important;gap:10px !important;}
      .svc-note button{width:100% !important;margin:0 !important;}
      .logo-strip{gap:20px !important;justify-content:flex-start !important;}
      .hero-brand{margin-bottom:32px !important;}
      .hero-brand-mark{width:64px !important;height:64px !important;}
      .stats-stat{padding:0 !important;}
      .card-body{padding:18px 20px !important;}
      .card-head{padding:18px 20px !important;}
      .proof-quote{font-size:18px !important;}
      .footer-email{display:none !important;}
    }
  `}</style>
);

// ─── LOGO MARK ───────────────────────────────────────────────────────────────
function LogoMark({ size=38, onDark=false }) {
  const bg = onDark ? "rgba(255,255,255,0.12)" : C.navy;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="11" fill={bg}/>
      <line x1="13" y1="14.5" x2="18.5" y2="18.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.4"/>
      <line x1="21.5" y1="21.5" x2="27" y2="25.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.4"/>
      <circle cx="11.5" cy="13" r="3" fill="white" opacity="0.5"/>
      <circle cx="20" cy="20" r="5.2" fill="white"/>
      <circle cx="20" cy="20" r="8.5" stroke="white" strokeWidth="1" fill="none" opacity="0.15"/>
      <circle cx="28.5" cy="27" r="3" fill="white" opacity="0.5"/>
      {/* Gold accent — the AI spark */}
      <circle cx="28.5" cy="11.5" r="2.8" fill={C.gold}/>
    </svg>
  );
}

function WordMark({ dark=false }) {
  const text = dark ? "#FFFFFF" : C.ink;
  const sub  = dark ? "rgba(255,255,255,0.45)" : C.inkLight;
  return (
    <div>
      <div style={{fontFamily:"Inter",fontWeight:600,fontSize:14.5,color:text,letterSpacing:-0.3,lineHeight:1.1}}>Supply Chain Lab AI</div>
      <div style={{fontFamily:"JetBrains Mono",fontSize:7.5,color:sub,letterSpacing:1.8,marginTop:2.5,textTransform:"uppercase"}}>supplychainlab.ai</div>
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,height:56,background:C.navy,borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
      <div className="nav-inner" style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
          <LogoMark size={34} onDark/>
          <WordMark dark/>
        </div>
        <button className="btn-w" style={{padding:"8px 20px",fontSize:13}} onClick={()=>scrollTo("contact")}>Book a call</button>
      </div>
    </nav>
  );
}

function Wrap({ id, bg, children, pt=80, pb=80, border=true }) {
  return (
    <section id={id} style={{background:bg||C.white,padding:`${pt}px 0 ${pb}px`,borderTop:border?`1px solid ${C.border}`:"none"}}>
      <div className="wrap" style={{width:"100%"}}>{children}</div>
    </section>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{background:C.navy,borderBottom:`4px solid ${C.gold}`,position:"relative",overflow:"hidden"}}>
      {/* Dot grid background pattern */}
      <div className="hero-pattern"/>

      <div className="hero-inner" style={{padding:"128px 0 80px",position:"relative",textAlign:"center"}}>

        {/* Large brand mark — hero identity anchor */}
        <div className="r1 hero-brand" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:18,marginBottom:36}}>
          <svg className="hero-brand-mark" width="88" height="88" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="11" fill="rgba(255,255,255,0.10)"/>
            <line x1="13" y1="14.5" x2="18.5" y2="18.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.4"/>
            <line x1="21.5" y1="21.5" x2="27" y2="25.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.4"/>
            <circle cx="11.5" cy="13" r="3" fill="white" opacity="0.5"/>
            <circle cx="20" cy="20" r="5.2" fill="white"/>
            <circle cx="20" cy="20" r="8.5" stroke="white" strokeWidth="1" fill="none" opacity="0.18"/>
            <circle cx="28.5" cy="27" r="3" fill="white" opacity="0.5"/>
            <circle cx="28.5" cy="11.5" r="2.8" fill={C.gold}/>
          </svg>
          <div>
            <div style={{fontFamily:"Lora",fontWeight:500,fontSize:22,color:"#FFFFFF",letterSpacing:-0.4,lineHeight:1.1}}>Supply Chain Lab AI</div>
            <div style={{fontFamily:"JetBrains Mono",fontSize:9,color:`${C.gold}`,letterSpacing:2.2,marginTop:5,textTransform:"uppercase",opacity:0.85}}>supplychainlab.ai</div>
          </div>
        </div>

        {/* Eyebrow chip */}
        <div className="r2" style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 14px",marginBottom:24}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:C.gold}}/>
          <span style={{fontFamily:"JetBrains Mono",fontSize:10,color:"rgba(255,255,255,0.6)",letterSpacing:1.5,textTransform:"uppercase"}}>Supply Chain × AI</span>
        </div>

        <h1 className="r3" style={{fontFamily:"Lora",fontWeight:500,fontSize:"clamp(34px,5.5vw,60px)",color:"#FFFFFF",lineHeight:1.1,letterSpacing:-1.2,marginBottom:28}}>
          AI that works for<br/>
          <span style={{fontStyle:"italic",color:"rgba(255,255,255,0.6)"}}>your supply chain.</span>
        </h1>

        <p className="r4" style={{fontSize:17,color:"rgba(255,255,255,0.58)",lineHeight:1.8,marginBottom:40,fontWeight:300}}>
          We help supply chain teams learn AI, apply it to real problems, and build tools that create measurable results.
        </p>

        <div className="r4 hero-btns" style={{display:"flex",gap:12,marginBottom:48,justifyContent:"center"}}>
          <button className="btn-w" onClick={()=>scrollTo("services")}>What we do</button>
          <button className="btn-gd" onClick={()=>scrollTo("contact")}>Book a free call</button>
        </div>

        {/* Experience strip — fixed: each logo paired with its own fallback */}
        <div className="r4" style={{paddingTop:32,borderTop:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{fontFamily:"JetBrains Mono",fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:2.5,textTransform:"uppercase",marginBottom:20}}>Experience</div>
          <div className="logo-strip" style={{display:"flex",flexWrap:"wrap",gap:40,alignItems:"center",justifyContent:"center"}}>
            {LOGOS.map(l=>(
              <div key={l.domain} title={l.name} style={{display:"inline-flex",alignItems:"center"}}>
                <img
                  src={`https://logo.clearbit.com/${l.domain}`}
                  alt={l.name}
                  style={{height:28,width:"auto",maxWidth:120,filter:"brightness(0) invert(1)",opacity:0.55,objectFit:"contain",transition:"opacity 0.2s",cursor:"default"}}
                  onMouseEnter={e=>e.target.style.opacity="0.9"}
                  onMouseLeave={e=>e.target.style.opacity="0.55"}
                  onError={e=>{
                    if(!e.target.dataset.fb){
                      e.target.dataset.fb="1";
                      e.target.src=`https://www.google.com/s2/favicons?domain=${l.domain}&sz=256`;
                      e.target.style.filter="none";
                      e.target.style.width="28px";
                      e.target.style.height="28px";
                      e.target.style.borderRadius="6px";
                    } else {
                      e.target.style.display="none";
                      e.target.nextSibling.style.display="inline-flex";
                    }
                  }}
                />
                <span style={{
                  display:"none",
                  alignItems:"center",
                  background:"rgba(255,255,255,0.07)",
                  border:"1px solid rgba(255,255,255,0.13)",
                  borderRadius:5,
                  padding:"4px 10px",
                  fontSize:11,
                  fontWeight:500,
                  color:"rgba(255,255,255,0.5)",
                  letterSpacing:0.3,
                  whiteSpace:"nowrap",
                }}>
                  {l.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function Stats() {
  const stats = [
    { value:"15+", label:"Years of Supply Chain Experience" },
    { value:"3",   label:"Fortune 500 Engagements" },
    { value:"100+",label:"Supply Chain Professionals Trained" },
    { value:"2",   label:"Service Lines, Zero Fluff" },
  ];
  return (
    <section style={{background:C.navyDark,padding:"52px 0",borderTop:"none",borderBottom:`1px solid rgba(255,255,255,0.08)`}}>
      <div className="wrap" style={{width:"100%"}}>
        <div className="stats-grid" style={{display:"flex",alignItems:"stretch",justifyContent:"space-between",gap:0}}>
          {stats.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"stretch",flex:1}}>
              <div className="stats-stat" style={{flex:1,padding:"0 20px",textAlign:"center"}}>
                <div style={{fontFamily:"Lora",fontWeight:600,fontSize:44,color:C.gold,letterSpacing:-1.5,lineHeight:1}}>
                  {s.value}
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.42)",letterSpacing:0.2,marginTop:10,lineHeight:1.5}}>
                  {s.label}
                </div>
              </div>
              {i < stats.length - 1 && (
                <div className="stats-divider" style={{width:1,background:"rgba(255,255,255,0.08)",flexShrink:0,alignSelf:"stretch"}}/>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SERVICES ─────────────────────────────────────────────────────────────────
function Services() {
  const svcs = [
    {
      title:"Educational Workshops",
      desc:"Hands-on sessions where your team builds working AI tools. On-site or remote. No coding background required.",
      price:"Starting at $5,000",
    },
    {
      title:"Supply Chain Consulting",
      desc:"Operating model design, org structure, and digital transformation roadmap — from assessment to a clear path forward.",
      price:"Starting at $5,000",
    },
  ];
  return (
    <Wrap id="services" bg={C.white} border={false}>
      <h2 style={{fontFamily:"Lora",fontWeight:500,fontSize:34,color:C.ink,letterSpacing:-0.7,lineHeight:1.15,marginBottom:44,textAlign:"center"}}>
        Where we focus
      </h2>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {svcs.map((s,i)=>(
          <div key={i} style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div className="card-head" style={{background: i===0 ? C.navy : C.navyDark, padding:"22px 28px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontFamily:"Lora",fontWeight:500,fontSize:20,color:"#FFFFFF",letterSpacing:-0.2}}>{s.title}</div>
              <div style={{width:8,height:8,borderRadius:"50%",background:C.gold,flexShrink:0}}/>
            </div>
            <div className="card-body" style={{background:C.white,padding:"22px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
              <div style={{fontSize:14,color:C.inkLight,lineHeight:1.7,flex:1,minWidth:200}}>{s.desc}</div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:13,color:C.inkLight}}>{s.price}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="svc-note" style={{marginTop:14,padding:"16px 22px",background:C.navyWash,border:`1px solid ${C.navyBorder}`,borderRadius:9,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:14,color:C.navy}}>Not sure which fits? Start with a free call.</span>
        <button className="btn-g" style={{fontSize:13,padding:"8px 18px",marginLeft:20,whiteSpace:"nowrap",borderColor:C.navyBorder,color:C.navy}} onClick={()=>scrollTo("contact")}>Book a call</button>
      </div>
    </Wrap>
  );
}

// ─── PROCESS ─────────────────────────────────────────────────────────────────
function Process() {
  const steps = [
    { n:"1", title:"Discover", desc:"We learn your supply chain, your team, and what's not working." },
    { n:"2", title:"Design",   desc:"We scope a workshop or engagement built around your specific context." },
    { n:"3", title:"Deliver",  desc:"Every engagement ends with a tool, a roadmap, or a skill your team owns." },
  ];
  return (
    <Wrap id="process" bg={C.navyWash}>
      <h2 style={{fontFamily:"Lora",fontWeight:500,fontSize:34,color:C.ink,letterSpacing:-0.7,lineHeight:1.15,marginBottom:44,textAlign:"center"}}>
        Simple by design
      </h2>
      <div className="process-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        {steps.map((s,i)=>(
          <div key={i} style={{background:C.white,border:`1px solid ${C.navyBorder}`,borderRadius:12,padding:"32px 28px",textAlign:"center"}}>
            <div style={{fontFamily:"Lora",fontWeight:600,fontSize:40,color:C.navy,lineHeight:1,marginBottom:16,opacity:0.25}}>{s.n}</div>
            <div style={{fontFamily:"Inter",fontWeight:600,fontSize:16,color:C.ink,marginBottom:8}}>{s.title}</div>
            <div style={{fontSize:14,color:C.inkLight,lineHeight:1.7}}>{s.desc}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:24,textAlign:"center"}}>
        <button className="btn-p" onClick={()=>scrollTo("contact")}>Book a free call</button>
      </div>
    </Wrap>
  );
}

// ─── WHO ──────────────────────────────────────────────────────────────────────
function Who() {
  const groups = [
    { title:"Supply Chain & Operations Teams", desc:"Companies applying AI to demand sensing, inventory, and network design." },
    { title:"Supply Chain Professionals",       desc:"Practitioners who want to learn AI by doing — no coding required." },
    { title:"Universities & Programs",          desc:"Graduate programs bringing AI curriculum into the classroom." },
  ];
  return (
    <Wrap id="who" bg={C.white}>
      <h2 style={{fontFamily:"Lora",fontWeight:500,fontSize:34,color:C.ink,letterSpacing:-0.7,lineHeight:1.15,marginBottom:44,textAlign:"center"}}>
        Built for everyone in supply chain
      </h2>
      <div className="process-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        {groups.map((g,i)=>(
          <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"32px 28px",textAlign:"center"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.navy,opacity:0.5+(i*0.2),margin:"0 auto 16px"}}/>
            <div style={{fontFamily:"Inter",fontWeight:600,fontSize:15,color:C.ink,marginBottom:8}}>{g.title}</div>
            <div style={{fontSize:14,color:C.inkLight,lineHeight:1.7}}>{g.desc}</div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

// ─── TESTIMONIAL ─────────────────────────────────────────────────────────────
function Proof() {
  return (
    <section style={{background:C.navy,padding:"72px 0",borderTop:`4px solid ${C.gold}`}}>
      <div className="wrap" style={{width:"100%"}}>
        <div style={{width:32,height:3,background:C.gold,borderRadius:2,marginBottom:28,marginLeft:"auto",marginRight:"auto"}}/>
        <blockquote className="proof-quote" style={{fontFamily:"Lora",fontStyle:"italic",fontSize:22,color:"#FFFFFF",lineHeight:1.6,letterSpacing:-0.2,marginBottom:28,}}>
          "Raj brought supply chain expertise and AI capability into the same room. Our team left with tools they actually used."
        </blockquote>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontFamily:"Lora",fontSize:13,color:"rgba(255,255,255,0.7)",fontWeight:600}}>S</span>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:500,color:"rgba(255,255,255,0.85)"}}>Supply Chain Director</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.45)"}}>Consumer Goods Company</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── GOLD DIVIDER BAND ────────────────────────────────────────────────────────
function GoldBand() {
  return (
    <section style={{background:C.gold,padding:"36px 0"}}>
      <div className="wrap" style={{width:"100%"}}>
        <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:20}}>
          <div style={{fontFamily:"Lora",fontStyle:"italic",fontSize:20,color:C.navyDark,fontWeight:500,letterSpacing:-0.2,lineHeight:1.4}}>
            "The right AI strategy doesn't replace your supply chain team — it makes them irreplaceable."
          </div>
          <button className="btn-p" style={{background:C.navyDark,flexShrink:0}} onClick={()=>scrollTo("contact")}>
            Let's talk
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── FOCUS AREAS ─────────────────────────────────────────────────────────────
function FocusAreas() {
  const areas = [
    {
      title:"Building with AI",
      icon:(
        <svg width={32} height={32} viewBox="0 0 36 36" fill="none">
          <circle cx={18} cy={18} r={17} stroke="rgba(255,255,255,0.25)" strokeWidth={1} fill="none" strokeDasharray="3,3"/>
          <circle cx={18} cy={18} r={4.5} fill="white"/>
          <circle cx={18} cy={18} r={8.5} stroke="rgba(255,255,255,0.2)" strokeWidth={1} fill="none"/>
          <circle cx={18} cy={7}  r={2.2} fill="white" opacity={0.45}/>
          <circle cx={28} cy={13} r={2.2} fill="white" opacity={0.6}/>
          <circle cx={28} cy={23} r={2.2} fill="white" opacity={0.75}/>
          <line x1={18} y1={13.5} x2={18} y2={9.2}  stroke="rgba(255,255,255,0.3)" strokeWidth={1}/>
          <line x1={21.5} y1={15} x2={25.8} y2={13.2} stroke="rgba(255,255,255,0.4)" strokeWidth={1}/>
          <line x1={21.5} y1={21} x2={25.8} y2={22.8} stroke="rgba(255,255,255,0.5)" strokeWidth={1}/>
        </svg>
      ),
      rows:[
        { level:"Individual",  label:"Use Cases",                  desc:"Demand forecasting, inventory analysis, report generation — AI applied to daily tasks.",     op:0.5  },
        { level:"Agent",       label:"AI That Analyzes & Decides", desc:"A single agent that monitors your network, surfaces risk, and recommends actions.",         op:0.75 },
        { level:"Multi-Agent", label:"Automated Workflows",        desc:"Multiple agents coordinating across planning, supply, and commercial — the future of S&OP.", op:1    },
      ],
    },
    {
      title:"Future of Work & Digital Transformation",
      icon:(
        <svg width={32} height={32} viewBox="0 0 36 36" fill="none">
          <rect x={2} y={9} width={32} height={21} rx={4} stroke="rgba(255,255,255,0.3)" strokeWidth={1} fill="none"/>
          <line x1={2} y1={16} x2={34} y2={16} stroke="rgba(255,255,255,0.15)" strokeWidth={1}/>
          <rect x={5}  y={12} width={5} height={3} rx={1} fill="white" opacity={0.3}/>
          <rect x={13} y={12} width={7} height={3} rx={1} fill="white" opacity={0.5}/>
          <rect x={23} y={12} width={8} height={3} rx={1} fill="white" opacity={0.75}/>
          <rect x={5}  y={19} width={8}  height={2.5} rx={1} fill="white" opacity={0.25}/>
          <rect x={17} y={19} width={14} height={2.5} rx={1} fill="white" opacity={0.5}/>
          <rect x={5}  y={24} width={4}  height={2.5} rx={1} fill="white" opacity={0.2}/>
          <rect x={12} y={24} width={9}  height={2.5} rx={1} fill="white" opacity={0.4}/>
          <rect x={24} y={24} width={7}  height={2.5} rx={1} fill="white" opacity={0.65}/>
          <circle cx={18} cy={5} r={2.2} fill="white" opacity={0.55}/>
          <line x1={18} y1={7.2} x2={18} y2={9} stroke="rgba(255,255,255,0.3)" strokeWidth={1}/>
        </svg>
      ),
      rows:[
        { level:"Assess",  label:"Where You Stand Today",     desc:"Understand your operating model and where AI can create the most value.",                      op:0.5  },
        { level:"Roadmap", label:"Your Path Forward",         desc:"A prioritized plan for how your supply chain evolves — roles, tools, ways of working.",         op:0.75 },
        { level:"Coach",   label:"Build Internal Capability", desc:"We teach your team to evaluate and work alongside AI — so you're never dependent on any vendor.", op:1    },
      ],
    },
  ];

  return (
    <Wrap id="focus" bg={C.cream}>
      <h2 style={{fontFamily:"Lora",fontWeight:500,fontSize:34,color:C.ink,letterSpacing:-0.7,lineHeight:1.15,marginBottom:44,textAlign:"center"}}>
        Two areas where we go deep
      </h2>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {areas.map((a,ai)=>(
          <div key={ai} style={{border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
            <div className="focus-header card-head" style={{background: ai===0 ? C.navy : C.navyDark, padding:"22px 28px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontFamily:"Lora",fontWeight:500,fontSize:20,color:"#FFFFFF",letterSpacing:-0.2}}>{a.title}</div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                {a.icon}
                <div style={{width:8,height:8,borderRadius:"50%",background:C.gold}}/>
              </div>
            </div>
            {a.rows.map((row,ri,rarr)=>(
              <div key={ri} className="card-body" style={{padding:"24px 28px",borderBottom:ri<rarr.length-1?`1px solid ${C.border}`:"none",background:C.white,textAlign:"center"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:6}}>
                  <span style={{fontFamily:"JetBrains Mono",fontSize:9,color:C.navy,letterSpacing:1.4,textTransform:"uppercase",opacity:row.op}}>{row.level}</span>
                  <span style={{fontFamily:"Inter",fontWeight:600,fontSize:14,color:C.ink}}>{row.label}</span>
                </div>
                <div style={{fontSize:13.5,color:C.inkLight,lineHeight:1.7}}>{row.desc}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Wrap>
  );
}

// ─── CONTACT ──────────────────────────────────────────────────────────────────
function Contact() {
  const [form,setForm]=useState({name:"",email:"",company:"",type:"",message:""});
  const [status,setStatus]=useState("idle");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const send=async()=>{
    if(!form.name||!form.email)return;
    setStatus("sending");
    try{
      const r=await fetch(`https://formspree.io/f/${FORMSPREE_ID}`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({...form,_replyto:form.email,_subject:`Inquiry from ${form.name} — Supply Chain Lab AI`}),
      });
      setStatus(r.ok?"sent":"error");
    }catch{setStatus("error");}
  };

  return (
    <Wrap id="contact" bg={C.navyWash} pb={96}>
      <h2 style={{fontFamily:"Lora",fontWeight:500,fontSize:34,color:C.ink,letterSpacing:-0.7,lineHeight:1.15,marginBottom:12,textAlign:"center"}}>
        Let's talk.
      </h2>
      <p style={{fontSize:15,color:C.inkMid,lineHeight:1.8,fontWeight:300,marginBottom:40,textAlign:"center"}}>
        Tell us what you're working on. We respond within one business day. The first call is free.
      </p>

      {status==="sent"?(
        <div style={{background:C.white,border:`1px solid ${C.navyBorder}`,borderRadius:12,padding:"48px 40px",textAlign:"center"}}>
          <div style={{width:32,height:3,background:C.gold,borderRadius:2,margin:"0 auto 20px"}}/>
          <div style={{fontFamily:"Lora",fontSize:22,fontWeight:500,color:C.ink,marginBottom:8}}>We'll be in touch.</div>
          <p style={{fontSize:14,color:C.inkLight}}>Usually within one business day.</p>
        </div>
      ):(
        <div style={{background:C.white,border:`1px solid ${C.navyBorder}`,borderRadius:12,padding:"32px 36px",boxShadow:"0 2px 20px rgba(27,58,107,0.07)"}}>
          <div style={{display:"flex",flexDirection:"column",gap:13}}>
            <div className="form-row" style={{display:"flex",gap:13}}>
              {[["name","Name","text"],["email","Work email","email"]].map(([k,l,t])=>(
                <div key={k} style={{flex:1}}>
                  <label style={{fontFamily:"JetBrains Mono",fontSize:9,color:C.inkLight,letterSpacing:1.2,textTransform:"uppercase",display:"block",marginBottom:6}}>{l}</label>
                  <input className="field" value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={l} type={t}/>
                </div>
              ))}
            </div>
            <div className="form-row" style={{display:"flex",gap:13}}>
              <div style={{flex:1}}>
                <label style={{fontFamily:"JetBrains Mono",fontSize:9,color:C.inkLight,letterSpacing:1.2,textTransform:"uppercase",display:"block",marginBottom:6}}>Company</label>
                <input className="field" value={form.company} onChange={e=>set("company",e.target.value)} placeholder="Optional"/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontFamily:"JetBrains Mono",fontSize:9,color:C.inkLight,letterSpacing:1.2,textTransform:"uppercase",display:"block",marginBottom:6}}>Interested in</label>
                <select className="field" value={form.type} onChange={e=>set("type",e.target.value)} style={{cursor:"pointer"}}>
                  <option value="">Select one</option>
                  <option value="workshop">Educational Workshop</option>
                  <option value="consulting">Supply Chain Consulting</option>
                  <option value="university">University Partnership</option>
                  <option value="both">Both</option>
                  <option value="unsure">Not sure yet</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{fontFamily:"JetBrains Mono",fontSize:9,color:C.inkLight,letterSpacing:1.2,textTransform:"uppercase",display:"block",marginBottom:6}}>Message</label>
              <textarea className="field" value={form.message} onChange={e=>set("message",e.target.value)} placeholder="Tell us what you're working on…"/>
            </div>
            {status==="error"&&(
              <div style={{fontSize:13,color:"#9B2C2C",background:"#FFF5F5",border:"1px solid #FED7D7",borderRadius:6,padding:"9px 13px"}}>
                Something went wrong. Email raj_ghosh@supplychainlab.ai directly.
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:4}}>
              <span style={{fontSize:13,color:C.inkLight}}>First call is always free.</span>
              <button className="btn-p" onClick={send} disabled={!form.name||!form.email||status==="sending"} style={{padding:"11px 28px"}}>
                {status==="sending"?"Sending…":"Send message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Wrap>
  );
}

// ─── FOOTER ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{background:C.navyDark,borderTop:`1px solid rgba(255,255,255,0.08)`}}>
      <div className="footer-inner" style={{padding:"24px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
          <LogoMark size={30} onDark/>
          <div style={{fontFamily:"Inter",fontWeight:600,fontSize:13.5,color:"rgba(255,255,255,0.8)",letterSpacing:-0.2}}>Supply Chain Lab AI</div>
        </div>
        <div className="footer-email" style={{fontFamily:"JetBrains Mono",fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:0.8}}>raj_ghosh@supplychainlab.ai</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.25)"}}>© 2025 Supply Chain Lab AI LLC</div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <Styles/>
      <Nav/>
      <Hero/>
      <Stats/>
      <Services/>
      <Process/>
      <Who/>
      <Proof/>
      <GoldBand/>
      <FocusAreas/>
      <Contact/>
      <Footer/>
    </>
  );
}

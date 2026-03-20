import { useState, useEffect, useRef } from "react";

const T = {
  bg:"#F7F6F3", bgDark:"#F0EEE9", bgDeep:"#E8E5DF",
  white:"#FFFFFF", ink:"#1A1917", inkMid:"#4A4845",
  inkLight:"#8C8A87", inkGhost:"#C4C2BE",
  border:"#E5E3DE", borderMid:"#D0CDC7",
  green:"#2D5A3D", greenBg:"#EBF2EE",
  red:"#B03A2E", redBg:"#FBF1F0", redBorder:"#DEB9B5",
  amber:"#7D5A1E", amberBg:"#FAF5EB", amberBorder:"#D9C89A",
  blue:"#1D4ED8", blueBg:"#EFF6FF",
};

// ─── COMMODITY CONFIG ─────────────────────────────────────────────────────────
const COMM_CONFIG = [
  {
    id:"corn", name:"Corn", ticker:"C.US", unit:"$/bu", stooqTicker:"c.us",
    currentPrice:4.85, hedgePrice:4.68, color:"#D97706", colorBg:"#FFFBEB",
    category:"Grain", percentOfCOGS:18,
    // Synthetic fallback — 12 months of realistic corn prices
    syntheticHistory: [6.20,5.95,5.80,5.60,5.40,5.20,5.10,4.95,4.90,4.80,4.78,4.85],
    // Futures curve — monthly forward prices
    futureCurve: [4.85,4.88,4.92,4.95,5.02,5.08,5.12,5.18,5.22,5.28,5.31,5.35],
    annualExposureM: 116.4,
    hedgeCoverage: 0.64,
    description: "CBOT Corn Futures (ZC)",
  },
  {
    id:"soybean_meal", name:"Soybean Meal", ticker:"SM.US", unit:"$/ton", stooqTicker:"sm.us",
    currentPrice:380, hedgePrice:374, color:"#16A34A", colorBg:"#F0FDF4",
    category:"Grain", percentOfCOGS:12,
    syntheticHistory: [445,435,422,410,400,392,388,384,381,378,376,380],
    futureCurve: [380,382,385,388,390,393,396,399,402,405,407,410],
    annualExposureM: 45.6,
    hedgeCoverage: 0.56,
    description: "CBOT Soybean Meal Futures (ZM)",
  },
  {
    id:"natural_gas", name:"Natural Gas", ticker:"NG.US", unit:"$/MMBtu", stooqTicker:"ng.us",
    currentPrice:2.85, hedgePrice:2.76, color:"#0891B2", colorBg:"#ECFEFF",
    category:"Energy", percentOfCOGS:8,
    syntheticHistory: [3.40,3.35,3.25,3.15,3.05,2.95,2.85,2.78,2.72,2.75,2.80,2.85],
    futureCurve: [2.85,2.90,2.98,3.05,3.12,3.18,3.22,3.15,3.08,3.02,2.98,2.95],
    annualExposureM: 23.4,
    hedgeCoverage: 0.69,
    description: "NYMEX Natural Gas (NG)",
  },
  {
    id:"chicken_meal", name:"Chicken Meal", ticker:"USDA", unit:"$/ton", stooqTicker:null,
    currentPrice:1840, hedgePrice:1738, color:"#B45309", colorBg:"#FEF3C7",
    category:"Protein", percentOfCOGS:28,
    syntheticHistory: [1420,1480,1530,1580,1640,1680,1720,1760,1790,1810,1825,1840],
    futureCurve: [1840,1855,1868,1875,1880,1872,1860,1845,1830,1818,1808,1800],
    annualExposureM: 338.6,
    hedgeCoverage: 0.47,
    description: "USDA Chicken Meal Index (weekly)",
  },
];

const Fonts = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500;600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{-webkit-font-smoothing:antialiased;}
    body{background:${T.bg};}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    @keyframes shimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}
    .fade{animation:fadeUp 0.3s ease forwards;}
    .rh:hover{background:${T.bgDark}!important;}
    .sg:hover{background:${T.bgDark}!important;}
    .nb:hover{color:${T.ink}!important;}
    .tab-btn:hover{background:${T.bgDark}!important;}
    .skeleton{background:linear-gradient(90deg,${T.bgDark} 25%,${T.bgDeep} 50%,${T.bgDark} 75%);background-size:400px 100%;animation:shimmer 1.5s infinite;}
  `}</style>
);

function Logo({compact=false}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <path d="M3 3 L21 3 L21 21 L3 21 Z" stroke={T.ink} strokeWidth="1.5" fill="none" opacity="0.2"/>
        <circle cx="12" cy="12" r="3" fill={T.green}/>
        <path d="M3 18 L8 12 L13 15 L18 8" stroke={T.green} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
      <div>
        <div style={{fontFamily:"Sora",fontWeight:600,fontSize:13.5,color:T.ink,letterSpacing:-0.2,lineHeight:1.1}}>Uranus PetCare</div>
        {!compact&&<div style={{fontFamily:"JetBrains Mono",fontSize:8.5,color:T.green,letterSpacing:1.3,marginTop:1.5,textTransform:"uppercase"}}>Commodity Risk Intelligence</div>}
      </div>
    </div>
  );
}

function Nav({page,setPage}){
  return(
    <nav style={{background:"rgba(247,246,243,0.94)",backdropFilter:"blur(14px)",borderBottom:`1px solid ${T.border}`,padding:"0 52px",display:"flex",alignItems:"center",justifyContent:"space-between",height:54,position:"sticky",top:0,zIndex:1000}}>
      <div onClick={()=>setPage("dashboard")}><Logo/></div>
      <div style={{display:"flex",gap:2}}>
        {[["dashboard","Dashboard"],["hedgebook","Hedge Book"],["scenarios","Scenarios"],["sourcing","Sourcing Advisor"],["agent","Risk Agent"]].map(([id,label])=>(
          <button key={id} onClick={()=>setPage(id)} className="nb"
            style={{background:"none",border:"none",borderBottom:`1.5px solid ${page===id?T.ink:"transparent"}`,color:page===id?T.ink:T.inkLight,fontWeight:page===id?500:400,fontSize:13,padding:"8px 14px",cursor:"pointer",transition:"color 0.12s",fontFamily:"Inter"}}>
            {label}
          </button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:T.green,animation:"blink 3s infinite"}}/>
        <span style={{fontFamily:"JetBrains Mono",fontSize:10,color:T.inkLight,letterSpacing:0.5}}>LIVE · Nov 4, 2024</span>
      </div>
    </nav>
  );
}

// ─── SVG LINE CHART ───────────────────────────────────────────────────────────
function LineChart({data, color, width=600, height=160, showGrid=true, labels=null, hedgeLine=null, secondaryData=null, secondaryColor=null}){
  if(!data||data.length===0) return null;
  const pad={top:12,right:16,bottom:labels?28:12,left:52};
  const W=width-pad.left-pad.right, H=height-pad.top-pad.bottom;
  const allVals=[...data,...(secondaryData||[]),...(hedgeLine?[hedgeLine,hedgeLine]:[]),(hedgeLine?[hedgeLine]:[])]
    .filter(v=>v!=null);
  const minV=Math.min(...allVals)*0.985, maxV=Math.max(...allVals)*1.015, range=maxV-minV||1;
  const px=(v)=>pad.left+((v-minV)/range*0 + 0); // x by index
  const py=(v)=>pad.top+H-((v-minV)/range)*H;
  const xs=(i)=>pad.left+(i/(data.length-1))*W;
  const pts=data.map((v,i)=>`${xs(i)},${py(v)}`).join(" ");
  const secPts=secondaryData?.map((v,i)=>`${xs(i)},${py(v)}`).join(" ");

  // Grid lines
  const gridCount=4;
  const gridLines=Array.from({length:gridCount+1},(_,i)=>{
    const v=minV+(range/gridCount)*i;
    return {y:py(v), label:v>100?v.toFixed(0):v.toFixed(2)};
  });

  return(
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{display:"block"}}>
      {/* Grid */}
      {showGrid&&gridLines.map((g,i)=>(
        <g key={i}>
          <line x1={pad.left} y1={g.y} x2={pad.left+W} y2={g.y} stroke={T.border} strokeWidth={0.8} strokeDasharray="3,3"/>
          <text x={pad.left-6} y={g.y+4} textAnchor="end" fontSize={9} fill={T.inkGhost} fontFamily="JetBrains Mono">{g.label}</text>
        </g>
      ))}

      {/* Area fill */}
      <defs>
        <linearGradient id={`fill-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      <polygon points={`${pad.left},${pad.top+H} ${pts} ${pad.left+W},${pad.top+H}`}
        fill={`url(#fill-${color.replace("#","")})`}/>

      {/* Secondary line (futures curve) */}
      {secondaryData&&<polyline points={secPts} fill="none" stroke={secondaryColor||T.inkGhost} strokeWidth={1.5} strokeDasharray="5,3" strokeLinecap="round" strokeLinejoin="round"/>}

      {/* Hedge price line */}
      {hedgeLine&&(
        <g>
          <line x1={pad.left} y1={py(hedgeLine)} x2={pad.left+W} y2={py(hedgeLine)} stroke={T.green} strokeWidth={1.5} strokeDasharray="4,3"/>
          <text x={pad.left+W+4} y={py(hedgeLine)+4} fontSize={9} fill={T.green} fontFamily="JetBrains Mono">hedge</text>
        </g>
      )}

      {/* Main price line */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>

      {/* Current price dot */}
      <circle cx={xs(data.length-1)} cy={py(data[data.length-1])} r={4} fill={color} stroke={T.white} strokeWidth={1.5}/>

      {/* X labels */}
      {labels&&labels.map((l,i)=>(
        i%Math.ceil(labels.length/6)===0&&(
          <text key={i} x={xs(i)} y={height-4} textAnchor="middle" fontSize={9} fill={T.inkGhost} fontFamily="JetBrains Mono">{l}</text>
        )
      ))}
    </svg>
  );
}

// ─── VOLATILITY BAR ───────────────────────────────────────────────────────────
function VolatilityIndicator({history, color}){
  if(!history||history.length<2) return null;
  // Calculate 30-day rolling volatility (std dev of % changes)
  const changes=history.slice(1).map((v,i)=>Math.abs((v-history[i])/history[i]*100));
  const avgVol=changes.reduce((s,v)=>s+v,0)/changes.length;
  const maxVol=Math.max(...changes);
  const volLevel=avgVol<1?"LOW":avgVol<2?"MEDIUM":"HIGH";
  const volColor=avgVol<1?T.green:avgVol<2?T.amber:T.red;
  const volPct=Math.min(avgVol/4*100,100);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
        <span style={{fontFamily:"JetBrains Mono",fontSize:9,color:T.inkLight,letterSpacing:1,textTransform:"uppercase"}}>30D Volatility</span>
        <span style={{fontFamily:"JetBrains Mono",fontSize:9,fontWeight:700,color:volColor,letterSpacing:0.8}}>{volLevel} · {avgVol.toFixed(1)}%</span>
      </div>
      <div style={{height:4,background:T.bgDeep,borderRadius:2}}>
        <div style={{width:`${volPct}%`,height:"100%",background:volColor,borderRadius:2,transition:"width 0.4s"}}/>
      </div>
    </div>
  );
}

// ─── LIVE PRICE FETCHER ───────────────────────────────────────────────────────
// Fetches from Stooq for exchange-traded commodities
// Falls back to synthetic data gracefully
async function fetchStooqPrice(ticker){
  try{
    // Stooq CSV endpoint — returns last 365 days of data
    const url=`https://stooq.com/q/d/l/?s=${ticker}&i=d`;
    const res=await fetch(url);
    if(!res.ok) throw new Error("fetch failed");
    const text=await res.text();
    const lines=text.trim().split("\n").slice(1); // skip header
    if(lines.length<2) throw new Error("no data");
    // Parse CSV: Date,Open,High,Low,Close,Volume
    const prices=lines.slice(-252).map(l=>{  // last ~12 months trading days
      const parts=l.split(",");
      return {date:parts[0], close:parseFloat(parts[4])};
    }).filter(p=>!isNaN(p.close));
    return prices;
  } catch(e){
    return null;
  }
}

// Sample to ~12 monthly data points from daily data
function sampleMonthly(dailyData){
  if(!dailyData||dailyData.length===0) return null;
  const step=Math.floor(dailyData.length/12);
  const sampled=[];
  for(let i=0;i<12;i++){
    const idx=Math.min(i*step,dailyData.length-1);
    sampled.push(dailyData[idx].close);
  }
  sampled[sampled.length-1]=dailyData[dailyData.length-1].close;
  return sampled;
}

// Generate month labels for last 12 months
function getLast12MonthLabels(){
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now=new Date(2024,10,4); // Nov 4 2024
  return Array.from({length:12},(_,i)=>{
    const d=new Date(now);
    d.setMonth(d.getMonth()-11+i);
    return months[d.getMonth()];
  });
}

// Generate future month labels
function getNext12MonthLabels(){
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now=new Date(2024,10,4);
  return Array.from({length:12},(_,i)=>{
    const d=new Date(now);
    d.setMonth(d.getMonth()+i);
    return months[d.getMonth()]+(i===0?" (now)":"");
  });
}

// ─── MAIN PRICE CHART COMPONENT ──────────────────────────────────────────────
function CommodityPriceChart(){
  const [selected,setSelected]=useState("chicken_meal");
  const [chartMode,setChartMode]=useState("history"); // history | futures | spread
  const [liveData,setLiveData]=useState({}); // ticker -> monthly array
  const [loading,setLoading]=useState({});
  const [dataSource,setDataSource]=useState({}); // ticker -> "live" | "synthetic"

  const comm=COMM_CONFIG.find(c=>c.id===selected);

  // Fetch live data on mount for exchange-traded commodities
  useEffect(()=>{
    COMM_CONFIG.forEach(async(c)=>{
      if(!c.stooqTicker) return; // chicken meal has no futures feed
      setLoading(l=>({...l,[c.id]:true}));
      const daily=await fetchStooqPrice(c.stooqTicker);
      if(daily&&daily.length>10){
        const monthly=sampleMonthly(daily);
        if(monthly){
          setLiveData(d=>({...d,[c.id]:monthly}));
          setDataSource(s=>({...s,[c.id]:"live"}));
        }
      } else {
        setDataSource(s=>({...s,[c.id]:"synthetic"}));
      }
      setLoading(l=>({...l,[c.id]:false}));
    });
    // Chicken meal always synthetic
    setDataSource(s=>({...s,chicken_meal:"synthetic"}));
  },[]);

  const historyData=liveData[selected]||comm.syntheticHistory;
  const currentPrice=historyData[historyData.length-1]||comm.currentPrice;
  const priorPrice=historyData[0]||comm.syntheticHistory[0];
  const priceChange=currentPrice-priorPrice;
  const pctChange=(priceChange/priorPrice*100);
  const spread=currentPrice-comm.hedgePrice;
  const spreadPct=(spread/comm.hedgePrice*100);
  const monthLabels=getLast12MonthLabels();
  const futureLabels=getNext12MonthLabels();
  const isLoading=loading[selected];
  const src=dataSource[selected];

  return(
    <div style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>

      {/* Header */}
      <div style={{padding:"16px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:T.inkLight,letterSpacing:1.3,marginBottom:3,textTransform:"uppercase"}}>Live Market Data</div>
          <div style={{fontFamily:"Sora",fontWeight:600,fontSize:16,color:T.ink,letterSpacing:-0.3}}>Commodity Price Monitor</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {src&&(
            <div style={{display:"flex",alignItems:"center",gap:5,background:src==="live"?T.greenBg:T.bgDark,border:`1px solid ${src==="live"?T.green+"33":T.border}`,borderRadius:5,padding:"3px 9px"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:src==="live"?T.green:T.inkGhost,animation:src==="live"?"blink 2s infinite":"none"}}/>
              <span style={{fontFamily:"JetBrains Mono",fontSize:9,color:src==="live"?T.green:T.inkLight,letterSpacing:0.8}}>{src==="live"?"LIVE · Stooq":"SYNTHETIC DATA"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Commodity tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,background:T.bgDark}}>
        {COMM_CONFIG.map(c=>(
          <button key={c.id} onClick={()=>setSelected(c.id)} className="tab-btn"
            style={{flex:1,background:selected===c.id?T.white:"transparent",border:"none",borderBottom:selected===c.id?`2px solid ${c.color}`:"2px solid transparent",padding:"12px 8px",cursor:"pointer",transition:"all 0.15s",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:c.color}}/>
              <span style={{fontFamily:"Sora",fontWeight:selected===c.id?600:400,fontSize:13,color:selected===c.id?T.ink:T.inkLight}}>{c.name}</span>
            </div>
            <span style={{fontFamily:"JetBrains Mono",fontSize:11,fontWeight:600,color:c.color}}>{c.currentPrice>100?c.currentPrice.toFixed(0):c.currentPrice.toFixed(2)}</span>
          </button>
        ))}
      </div>

      <div style={{padding:"20px 24px"}}>
        {/* Price summary row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:20}}>
          {[
            {label:"Current Spot",value:`${currentPrice>100?currentPrice.toFixed(0):currentPrice.toFixed(2)}`,unit:comm.unit,color:T.ink},
            {label:"12M Change",value:`${pctChange>=0?"+":""}${pctChange.toFixed(1)}%`,unit:`${priceChange>=0?"+":""}${Math.abs(priceChange).toFixed(priorPrice>100?0:2)}`,color:pctChange>=0?T.red:T.green},
            {label:"vs. Hedge Price",value:`${spread>=0?"+":""}${spread>100?spread.toFixed(0):spread.toFixed(2)}`,unit:`${spreadPct>=0?"+":""}${spreadPct.toFixed(1)}% spread`,color:spread>=0?T.red:T.green},
            {label:"% of COGS",value:`${comm.percentOfCOGS}%`,unit:`Coverage: ${(comm.hedgeCoverage*100).toFixed(0)}%`,color:T.ink},
          ].map((k,i)=>(
            <div key={i} style={{background:T.bgDark,borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontFamily:"JetBrains Mono",fontSize:9,color:T.inkLight,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>{k.label}</div>
              <div style={{fontFamily:"Sora",fontWeight:600,fontSize:20,color:k.color,letterSpacing:-0.5,marginBottom:2}}>{k.value}</div>
              <div style={{fontFamily:"JetBrains Mono",fontSize:10,color:T.inkLight}}>{k.unit}</div>
            </div>
          ))}
        </div>

        {/* Chart mode selector */}
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          {[["history","12M Price History"],["futures","Futures Curve"],["spread","Spot vs. Hedge"]].map(([id,label])=>(
            <button key={id} onClick={()=>setChartMode(id)}
              style={{background:chartMode===id?T.ink:T.white,color:chartMode===id?T.white:T.inkMid,border:`1px solid ${chartMode===id?T.ink:T.border}`,padding:"6px 14px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"Inter",fontWeight:chartMode===id?500:400,transition:"all 0.15s"}}>
              {label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div style={{position:"relative",height:200,background:T.bgDark,borderRadius:10,overflow:"hidden",padding:"12px 8px 8px"}}>
          {isLoading?(
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontFamily:"JetBrains Mono",fontSize:11,color:T.inkLight,letterSpacing:1}}>Fetching live data…</div>
            </div>
          ):(
            <>
              {chartMode==="history"&&(
                <LineChart
                  data={historyData}
                  color={comm.color}
                  hedgeLine={comm.hedgePrice}
                  width={860} height={180}
                  labels={monthLabels}
                />
              )}
              {chartMode==="futures"&&(
                <LineChart
                  data={comm.futureCurve}
                  color={comm.color}
                  secondaryData={Array(12).fill(comm.hedgePrice)}
                  secondaryColor={T.green}
                  width={860} height={180}
                  labels={futureLabels}
                />
              )}
              {chartMode==="spread"&&(
                <LineChart
                  data={historyData.map(p=>((p-comm.hedgePrice)/comm.hedgePrice*100))}
                  color={spread>=0?T.red:T.green}
                  width={860} height={180}
                  labels={monthLabels}
                />
              )}
            </>
          )}
        </div>

        {/* Chart legend */}
        <div style={{display:"flex",gap:20,marginTop:10}}>
          {chartMode==="history"&&(
            <>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:2,background:comm.color,borderRadius:1}}/><span style={{fontSize:11,color:T.inkLight,fontFamily:"JetBrains Mono"}}>Spot price</span></div>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:2,background:T.green,borderRadius:1,opacity:0.7}}/><span style={{fontSize:11,color:T.inkLight,fontFamily:"JetBrains Mono"}}>Avg hedge price ({comm.hedgePrice>100?comm.hedgePrice.toFixed(0):comm.hedgePrice.toFixed(2)})</span></div>
            </>
          )}
          {chartMode==="futures"&&(
            <>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:2,background:comm.color,borderRadius:1}}/><span style={{fontSize:11,color:T.inkLight,fontFamily:"JetBrains Mono"}}>Forward curve</span></div>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:2,background:T.green,borderRadius:1,opacity:0.7,borderTop:"2px dashed "+T.green}}/><span style={{fontSize:11,color:T.inkLight,fontFamily:"JetBrains Mono"}}>Avg hedge price</span></div>
            </>
          )}
          {chartMode==="spread"&&(
            <div style={{fontSize:11,color:T.inkLight,fontFamily:"JetBrains Mono"}}>
              Spread % = (spot − hedge) / hedge · positive = spot above hedge = unfavorable
            </div>
          )}
        </div>

        {/* Volatility */}
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
          <VolatilityIndicator history={historyData} color={comm.color}/>
        </div>

        {/* Description */}
        <div style={{marginTop:10,fontSize:11,color:T.inkGhost,fontFamily:"JetBrains Mono"}}>
          {comm.description} · {src==="live"?"Real-time data from Stooq":"Synthetic data calibrated to market structure"}
          {comm.id==="chicken_meal"&&" · USDA weekly price index, no futures contract available"}
        </div>
      </div>
    </div>
  );
}

// ─── COMMODITY DATA (same as before) ─────────────────────────────────────────
const COMMODITIES = [
  {
    id:"chicken_meal", name:"Chicken Meal", unit:"$/ton", category:"Protein",
    currentPrice:1840, priorYearPrice:1420, priceHistory:[1420,1480,1520,1610,1680,1720,1780,1840],
    annualVolumeTons:18400, percentOfCOGS:28,
    hedgeBook:[
      {quarter:"Q1 2025",hedgedPct:75,hedgePrice:1720,type:"OTC Swap",notionalTons:3450},
      {quarter:"Q2 2025",hedgedPct:60,hedgePrice:1750,type:"OTC Swap",notionalTons:2760},
      {quarter:"Q3 2025",hedgedPct:40,hedgePrice:null,type:"CME Futures",notionalTons:1840},
      {quarter:"Q4 2025",hedgedPct:20,hedgePrice:null,type:"CME Futures",notionalTons:920},
    ],
    supplierContracts:[
      {supplier:"Tyson Ingredients",pct:35,priceType:"fixed",fixedPrice:1780,expiryQ:"Q2 2025"},
      {supplier:"Pilgrim's Pride",pct:25,priceType:"formula",formulaBase:"USDA Weekly Index +3%",expiryQ:"Q4 2025"},
      {supplier:"Spot Market",pct:40,priceType:"spot",fixedPrice:null,expiryQ:"Rolling"},
    ],
    color:"#B45309", colorBg:"#FEF3C7",
  },
  {
    id:"corn", name:"Corn", unit:"$/bushel", category:"Grain",
    currentPrice:4.85, priorYearPrice:6.20, priceHistory:[6.20,5.80,5.40,5.10,4.90,4.75,4.80,4.85],
    annualVolumeTons:24000, percentOfCOGS:18,
    hedgeBook:[
      {quarter:"Q1 2025",hedgedPct:90,hedgePrice:4.60,type:"CME Futures",notionalTons:5400},
      {quarter:"Q2 2025",hedgedPct:80,hedgePrice:4.70,type:"CME Futures",notionalTons:4800},
      {quarter:"Q3 2025",hedgedPct:55,hedgePrice:4.80,type:"CME Futures",notionalTons:3300},
      {quarter:"Q4 2025",hedgedPct:30,hedgePrice:null,type:"CME Futures",notionalTons:1800},
    ],
    supplierContracts:[
      {supplier:"ADM",pct:60,priceType:"fixed",fixedPrice:4.72,expiryQ:"Q3 2025"},
      {supplier:"Cargill",pct:20,priceType:"formula",formulaBase:"CBOT +$0.05",expiryQ:"Q2 2025"},
      {supplier:"Spot Market",pct:20,priceType:"spot",fixedPrice:null,expiryQ:"Rolling"},
    ],
    color:"#D97706", colorBg:"#FFFBEB",
  },
  {
    id:"soybean_meal", name:"Soybean Meal", unit:"$/ton", category:"Grain",
    currentPrice:380, priorYearPrice:445, priceHistory:[445,430,415,400,390,385,378,380],
    annualVolumeTons:12000, percentOfCOGS:12,
    hedgeBook:[
      {quarter:"Q1 2025",hedgedPct:85,hedgePrice:372,type:"CME Futures",notionalTons:2550},
      {quarter:"Q2 2025",hedgedPct:70,hedgePrice:375,type:"CME Futures",notionalTons:2100},
      {quarter:"Q3 2025",hedgedPct:45,hedgePrice:null,type:"OTC Swap",notionalTons:1350},
      {quarter:"Q4 2025",hedgedPct:25,hedgePrice:null,type:"OTC Swap",notionalTons:750},
    ],
    supplierContracts:[
      {supplier:"Bunge",pct:50,priceType:"fixed",fixedPrice:376,expiryQ:"Q2 2025"},
      {supplier:"Louis Dreyfus",pct:30,priceType:"formula",formulaBase:"CBOT -$2",expiryQ:"Q3 2025"},
      {supplier:"Spot Market",pct:20,priceType:"spot",fixedPrice:null,expiryQ:"Rolling"},
    ],
    color:"#16A34A", colorBg:"#F0FDF4",
  },
  {
    id:"natural_gas", name:"Natural Gas", unit:"$/MMBtu", category:"Energy",
    currentPrice:2.85, priorYearPrice:3.40, priceHistory:[3.40,3.20,3.10,2.95,2.80,2.75,2.82,2.85],
    annualVolumeMMBtu:8200000, percentOfCOGS:8,
    hedgeBook:[
      {quarter:"Q1 2025",hedgedPct:95,hedgePrice:2.70,type:"OTC Swap"},
      {quarter:"Q2 2025",hedgedPct:80,hedgePrice:2.75,type:"OTC Swap"},
      {quarter:"Q3 2025",hedgedPct:60,hedgePrice:2.80,type:"CME Futures"},
      {quarter:"Q4 2025",hedgedPct:40,hedgePrice:null,type:"CME Futures"},
    ],
    supplierContracts:[
      {supplier:"Southern Company Gas",pct:70,priceType:"fixed",fixedPrice:2.78,expiryQ:"Q4 2025"},
      {supplier:"Spot Market",pct:30,priceType:"spot",fixedPrice:null,expiryQ:"Rolling"},
    ],
    color:"#0891B2", colorBg:"#ECFEFF",
  },
];

function calcExposure(comm,shockPct=0){
  const shockedPrice=comm.currentPrice*(1+shockPct/100);
  const vol=comm.annualVolumeTons||(comm.annualVolumeMMBtu/1000000);
  const grossExposure=shockedPrice*vol/1000;
  const avgHedgePct=comm.hedgeBook.reduce((s,q)=>s+q.hedgedPct,0)/comm.hedgeBook.length/100;
  const hedgedExposure=grossExposure*avgHedgePct;
  const openExposure=grossExposure*(1-avgHedgePct);
  return{grossExposure,hedgedExposure,openExposure,avgHedgePct};
}

function calcMTM(comm){
  let mtm=0;
  comm.hedgeBook.forEach(q=>{
    if(q.hedgePrice&&q.hedgedPct>0){
      const vol=(comm.annualVolumeTons||0)/4||(comm.annualVolumeMMBtu||0)/4/1000000;
      const hedgedVol=vol*q.hedgedPct/100;
      const priceDiff=comm.currentPrice-q.hedgePrice;
      mtm+=priceDiff*hedgedVol/1000;
    }
  });
  return mtm;
}

function Sparkline({data,color,width=80,height=28}){
  const min=Math.min(...data),max=Math.max(...data),range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-((v-min)/range)*height}`).join(" ");
  return(
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({setPage}){
  const totalExposure=COMMODITIES.reduce((s,c)=>s+calcExposure(c).grossExposure,0);
  const totalOpen=COMMODITIES.reduce((s,c)=>s+calcExposure(c).openExposure,0);
  const totalMTM=COMMODITIES.reduce((s,c)=>s+calcMTM(c),0);
  const avgCoverage=COMMODITIES.reduce((s,c)=>s+calcExposure(c).avgHedgePct,0)/COMMODITIES.length;

  return(
    <div style={{background:T.bg,minHeight:"calc(100vh - 54px)",fontFamily:"Inter"}}>
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"18px 52px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:T.inkLight,letterSpacing:1.5,marginBottom:3,textTransform:"uppercase"}}>Commodity Risk Dashboard</div>
          <div style={{fontFamily:"Sora",fontWeight:600,fontSize:19,color:T.ink,letterSpacing:-0.4}}>Portfolio Overview — Q1–Q4 2025</div>
        </div>
        <button onClick={()=>setPage("scenarios")}
          style={{background:T.ink,color:T.white,border:"none",padding:"8px 20px",borderRadius:7,cursor:"pointer",fontSize:13,fontFamily:"Sora",fontWeight:500}}>
          Run stress test →
        </button>
      </div>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"28px 52px",display:"flex",flexDirection:"column",gap:20}}>

        {/* KPI Strip */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",background:T.white,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
          {[
            {label:"Total Commodity Exposure",value:`$${totalExposure.toFixed(0)}M`,sub:"annualized gross exposure",color:T.ink},
            {label:"Open / Unhedged Exposure",value:`$${totalOpen.toFixed(0)}M`,sub:"at risk to spot price moves",color:T.red},
            {label:"Portfolio MTM",value:`${totalMTM>=0?"+":""}$${totalMTM.toFixed(1)}M`,sub:"mark-to-market on hedge book",color:totalMTM>=0?T.green:T.red},
            {label:"Avg Hedge Coverage",value:`${(avgCoverage*100).toFixed(0)}%`,sub:"weighted across all commodities",color:T.green},
          ].map((k,i)=>(
            <div key={i} style={{padding:"20px 24px",borderRight:i<3?`1px solid ${T.border}`:"none"}}>
              <div style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:T.inkLight,letterSpacing:1.3,marginBottom:7,textTransform:"uppercase"}}>{k.label}</div>
              <div style={{fontFamily:"Sora",fontWeight:600,fontSize:24,color:k.color,letterSpacing:-0.7,marginBottom:3}}>{k.value}</div>
              <div style={{fontSize:11,color:T.inkLight}}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* LIVE PRICE CHART — the new main feature */}
        <CommodityPriceChart/>

        {/* Commodity summary cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
          {COMMODITIES.map(comm=>{
            const{grossExposure,openExposure,avgHedgePct}=calcExposure(comm);
            const mtm=calcMTM(comm);
            const chg=((comm.currentPrice-comm.priorYearPrice)/comm.priorYearPrice*100);
            return(
              <div key={comm.id} onClick={()=>setPage("hedgebook")}
                style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:12,padding:"18px 22px",cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.green;e.currentTarget.style.transform="translateY(-1px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="none";}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:comm.color}}/>
                      <span style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:T.inkLight,letterSpacing:1,textTransform:"uppercase"}}>{comm.category}</span>
                    </div>
                    <div style={{fontFamily:"Sora",fontWeight:600,fontSize:15,color:T.ink,letterSpacing:-0.2}}>{comm.name}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"JetBrains Mono",fontWeight:600,fontSize:20,color:T.ink,letterSpacing:-0.5}}>{comm.currentPrice.toFixed(comm.currentPrice>100?0:2)}</div>
                    <div style={{fontSize:10,color:T.inkLight,fontFamily:"JetBrains Mono"}}>{comm.unit}</div>
                    <div style={{fontSize:11,color:chg>=0?T.red:T.green,fontFamily:"JetBrains Mono",fontWeight:600}}>{chg>=0?"+":""}{chg.toFixed(1)}% YoY</div>
                  </div>
                </div>
                <Sparkline data={comm.priceHistory} color={comm.color} width={110} height={28}/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:12}}>
                  {[["Gross",`$${grossExposure.toFixed(0)}M`,T.ink],["Open",`$${openExposure.toFixed(0)}M`,T.red],["MTM",`${mtm>=0?"+":""}$${mtm.toFixed(1)}M`,mtm>=0?T.green:T.red]].map(([l,v,c])=>(
                    <div key={l} style={{background:T.bgDark,borderRadius:6,padding:"7px 10px"}}>
                      <div style={{fontFamily:"JetBrains Mono",fontSize:9,color:T.inkLight,letterSpacing:0.8,marginBottom:2,textTransform:"uppercase"}}>{l}</div>
                      <div style={{fontFamily:"JetBrains Mono",fontWeight:600,fontSize:13,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontFamily:"JetBrains Mono",fontSize:9,color:T.inkLight,letterSpacing:0.8}}>HEDGE COVERAGE</span>
                    <span style={{fontFamily:"JetBrains Mono",fontSize:9,color:T.green,fontWeight:600}}>{(avgHedgePct*100).toFixed(0)}%</span>
                  </div>
                  <div style={{height:4,background:T.bgDeep,borderRadius:2}}>
                    <div style={{width:`${avgHedgePct*100}%`,height:"100%",background:T.green,borderRadius:2}}/>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Alert */}
        <div style={{background:T.amberBg,border:`1px solid ${T.amberBorder}`,borderRadius:10,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>⚠️</span>
            <div>
              <div style={{fontFamily:"Sora",fontWeight:600,fontSize:14,color:T.ink,marginBottom:2}}>Chicken Meal Q3 coverage drops to 40% in 89 days</div>
              <div style={{fontSize:12,color:T.inkLight}}>Current spot at $1,840/ton is 6.9% above Q3 hedge entry level. Consider layering additional coverage before Q2 expiry.</div>
            </div>
          </div>
          <button onClick={()=>setPage("sourcing")} style={{background:T.amber,color:T.white,border:"none",padding:"8px 16px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"Sora",fontWeight:500,whiteSpace:"nowrap",marginLeft:20,flexShrink:0}}>
            View sourcing advice →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HEDGE BOOK ───────────────────────────────────────────────────────────────
function HedgeBook(){
  const[selected,setSelected]=useState("chicken_meal");
  const comm=COMMODITIES.find(c=>c.id===selected);
  return(
    <div style={{background:T.bg,minHeight:"calc(100vh - 54px)",fontFamily:"Inter"}}>
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"18px 52px"}}>
        <div style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:T.inkLight,letterSpacing:1.5,marginBottom:3,textTransform:"uppercase"}}>Hedge Book</div>
        <div style={{fontFamily:"Sora",fontWeight:600,fontSize:19,color:T.ink,letterSpacing:-0.4}}>Coverage by Commodity × Quarter</div>
      </div>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"28px 52px",display:"flex",flexDirection:"column",gap:20}}>
        <div style={{display:"flex",gap:8}}>
          {COMMODITIES.map(c=>(
            <button key={c.id} onClick={()=>setSelected(c.id)}
              style={{background:selected===c.id?T.ink:T.white,color:selected===c.id?T.white:T.inkMid,border:`1px solid ${selected===c.id?T.ink:T.border}`,padding:"8px 18px",borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"Inter",fontWeight:selected===c.id?500:400,transition:"all 0.15s",display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:selected===c.id?"white":c.color}}/>
              {c.name}
            </button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
          {comm.hedgeBook.map((q,i)=>{
            const openPct=100-q.hedgedPct;
            const urgency=q.hedgedPct<50?"low":q.hedgedPct<75?"medium":"good";
            const urgencyColor=urgency==="low"?T.red:urgency==="medium"?T.amber:T.green;
            return(
              <div key={i} style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:12,padding:"20px",borderTop:`3px solid ${urgencyColor}`}}>
                <div style={{fontFamily:"Sora",fontWeight:600,fontSize:15,color:T.ink,marginBottom:3}}>{q.quarter}</div>
                <div style={{fontFamily:"JetBrains Mono",fontSize:10,color:T.inkLight,letterSpacing:1,marginBottom:14,textTransform:"uppercase"}}>{q.type}</div>
                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:11,color:T.inkLight}}>Hedged</span>
                    <span style={{fontFamily:"JetBrains Mono",fontSize:11,fontWeight:600,color:urgencyColor}}>{q.hedgedPct}%</span>
                  </div>
                  <div style={{height:8,background:T.bgDeep,borderRadius:4}}>
                    <div style={{width:`${q.hedgedPct}%`,height:"100%",background:urgencyColor,borderRadius:4}}/>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {q.hedgePrice&&(
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:11,color:T.inkLight}}>Hedge price</span>
                      <span style={{fontFamily:"JetBrains Mono",fontSize:11,fontWeight:600,color:T.ink}}>{q.hedgePrice.toFixed(comm.currentPrice>100?0:2)}</span>
                    </div>
                  )}
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:T.inkLight}}>vs. Spot</span>
                    <span style={{fontFamily:"JetBrains Mono",fontSize:11,fontWeight:600,color:q.hedgePrice?((comm.currentPrice-q.hedgePrice)/q.hedgePrice*100)>=0?T.green:T.red:T.inkGhost}}>
                      {q.hedgePrice?`${((comm.currentPrice-q.hedgePrice)/q.hedgePrice*100)>=0?"+":""}${((comm.currentPrice-q.hedgePrice)/q.hedgePrice*100).toFixed(1)}%`:"TBD"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:10}}>
          <div style={{padding:"16px 22px",borderBottom:`1px solid ${T.border}`}}>
            <div style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:T.inkLight,letterSpacing:1.3,marginBottom:3,textTransform:"uppercase"}}>Physical Supplier Contracts — {comm.name}</div>
            <div style={{fontFamily:"Sora",fontWeight:600,fontSize:15,color:T.ink}}>Sourcing portfolio breakdown</div>
          </div>
          <div>
            {comm.supplierContracts.map((sc,i)=>(
              <div key={i} className="rh" style={{padding:"14px 22px",borderBottom:i<comm.supplierContracts.length-1?`1px solid ${T.border}`:"none",display:"grid",gridTemplateColumns:"1fr 80px 200px 110px 90px",gap:16,alignItems:"center"}}>
                <div style={{fontFamily:"Sora",fontWeight:500,fontSize:14,color:T.ink}}>{sc.supplier}</div>
                <div style={{fontFamily:"JetBrains Mono",fontWeight:600,fontSize:14,color:T.ink,textAlign:"right"}}>{sc.pct}%</div>
                <div style={{fontSize:12,color:T.inkLight}}>{sc.priceType==="fixed"?`Fixed: ${sc.fixedPrice?.toFixed(comm.currentPrice>100?0:2)} ${comm.unit}`:sc.priceType==="formula"?sc.formulaBase:"Spot market"}</div>
                <div style={{fontFamily:"JetBrains Mono",fontSize:11,color:T.inkLight}}>{sc.expiryQ}</div>
                <div style={{textAlign:"right"}}>
                  <span style={{background:sc.priceType==="fixed"?T.greenBg:sc.priceType==="formula"?T.blueBg:T.redBg,color:sc.priceType==="fixed"?T.green:sc.priceType==="formula"?T.blue:T.red,fontFamily:"JetBrains Mono",fontSize:9.5,padding:"3px 8px",borderRadius:5,fontWeight:600,textTransform:"uppercase"}}>
                    {sc.priceType==="fixed"?"Fixed":sc.priceType==="formula"?"Formula":"Spot"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCENARIOS ────────────────────────────────────────────────────────────────
const PRESET_SCENARIOS=[
  {id:"2021_grain",name:"2021 Grain Spike",desc:"La Niña drought conditions",shocks:{chicken_meal:22,corn:45,soybean_meal:38,natural_gas:8},historical:true},
  {id:"2022_energy",name:"2022 Energy Crisis",desc:"European gas crisis ripple effects",shocks:{chicken_meal:5,corn:12,soybean_meal:8,natural_gas:65},historical:true},
  {id:"protein_spike",name:"Avian Flu Outbreak",desc:"Major poultry supply disruption",shocks:{chicken_meal:40,corn:5,soybean_meal:10,natural_gas:0},historical:false},
  {id:"deflation",name:"Soft Landing",desc:"Demand moderation across all commodities",shocks:{chicken_meal:-15,corn:-20,soybean_meal:-18,natural_gas:-25},historical:false},
];

function runScenario(shocks){
  let total={gross:0,hedged:0,net:0};
  const details=COMMODITIES.map(comm=>{
    const shock=shocks[comm.id]||0;
    const vol=comm.annualVolumeTons||(comm.annualVolumeMMBtu/1000000);
    const grossImpact=(comm.currentPrice*shock/100)*vol/1000;
    const avgHedgePct=comm.hedgeBook.reduce((s,q)=>s+q.hedgedPct,0)/comm.hedgeBook.length/100;
    const hedgedOffset=grossImpact*avgHedgePct;
    const netImpact=grossImpact-hedgedOffset;
    total.gross+=grossImpact; total.hedged+=hedgedOffset; total.net+=netImpact;
    return{comm,shock,grossImpact,hedgedOffset,netImpact,avgHedgePct};
  });
  return{details,...total};
}

function Scenarios(){
  const[activeScenario,setActiveScenario]=useState("2021_grain");
  const[customShocks,setCustomShocks]=useState({chicken_meal:0,corn:0,soybean_meal:0,natural_gas:0});
  const[mode,setMode]=useState("preset");
  const shocks=mode==="preset"?(PRESET_SCENARIOS.find(s=>s.id===activeScenario)?.shocks||{}):customShocks;
  const result=runScenario(shocks);
  return(
    <div style={{background:T.bg,minHeight:"calc(100vh - 54px)",fontFamily:"Inter"}}>
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"18px 52px"}}>
        <div style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:T.inkLight,letterSpacing:1.5,marginBottom:3,textTransform:"uppercase"}}>Scenario Stress Tester</div>
        <div style={{fontFamily:"Sora",fontWeight:600,fontSize:19,color:T.ink,letterSpacing:-0.4}}>P&L Impact Under Price Shock Scenarios</div>
      </div>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"28px 52px",display:"flex",gap:24}}>
        <div style={{width:280,flexShrink:0,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",background:T.bgDark,border:`1px solid ${T.border}`,borderRadius:8,padding:3,gap:2}}>
            {[["preset","Preset"],["custom","Custom"]].map(([id,label])=>(
              <button key={id} onClick={()=>setMode(id)}
                style={{flex:1,background:mode===id?T.white:"transparent",border:"none",padding:"7px 0",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"Inter",fontWeight:mode===id?500:400,color:mode===id?T.ink:T.inkLight,transition:"all 0.12s"}}>
                {label}
              </button>
            ))}
          </div>
          {mode==="preset"?PRESET_SCENARIOS.map(s=>(
            <div key={s.id} onClick={()=>setActiveScenario(s.id)}
              style={{background:activeScenario===s.id?T.ink:T.white,border:`1px solid ${activeScenario===s.id?T.ink:T.border}`,borderRadius:10,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s"}}>
              {s.historical&&<span style={{fontFamily:"JetBrains Mono",fontSize:8,background:"rgba(255,255,255,0.1)",color:activeScenario===s.id?"rgba(255,255,255,0.5)":T.inkLight,padding:"1px 5px",borderRadius:3,letterSpacing:0.5,marginBottom:4,display:"inline-block"}}>HISTORICAL</span>}
              <div style={{fontFamily:"Sora",fontWeight:600,fontSize:13,color:activeScenario===s.id?T.white:T.ink,marginBottom:3}}>{s.name}</div>
              <div style={{fontSize:11,color:activeScenario===s.id?"rgba(255,255,255,0.5)":T.inkLight}}>{s.desc}</div>
            </div>
          )):(
            <div style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px"}}>
              <div style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:T.inkLight,letterSpacing:1.2,marginBottom:14,textTransform:"uppercase"}}>Price shocks (%)</div>
              {COMMODITIES.map(c=>(
                <div key={c.id} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:12,color:T.inkMid,fontWeight:500}}>{c.name}</span>
                    <span style={{fontFamily:"JetBrains Mono",fontSize:12,fontWeight:600,color:customShocks[c.id]>=0?T.red:T.green}}>{customShocks[c.id]>=0?"+":""}{customShocks[c.id]}%</span>
                  </div>
                  <input type="range" min={-50} max={80} value={customShocks[c.id]}
                    onChange={e=>setCustomShocks(s=>({...s,[c.id]:parseInt(e.target.value)}))}
                    style={{width:"100%",accentColor:c.color,cursor:"pointer"}}/>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {[
              {label:"Gross P&L Impact",value:`${result.gross>=0?"+":""}$${result.gross.toFixed(1)}M`,sub:"before hedges",color:result.gross>=0?T.red:T.green},
              {label:"Hedges Offset",value:`$${Math.abs(result.hedged).toFixed(1)}M`,sub:"protection from hedge book",color:T.green},
              {label:"Net Exposure",value:`${result.net>=0?"+":""}$${result.net.toFixed(1)}M`,sub:"unprotected P&L impact",color:result.net>=0?T.red:T.green,featured:true},
            ].map((k,i)=>(
              <div key={i} style={{background:k.featured?T.ink:T.white,border:`1px solid ${k.featured?T.ink:T.border}`,borderRadius:10,padding:"18px 22px"}}>
                <div style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:k.featured?"rgba(255,255,255,0.4)":T.inkLight,letterSpacing:1.3,marginBottom:7,textTransform:"uppercase"}}>{k.label}</div>
                <div style={{fontFamily:"Sora",fontWeight:600,fontSize:26,color:k.featured?T.white:k.color,letterSpacing:-0.7,marginBottom:3}}>{k.value}</div>
                <div style={{fontSize:11,color:k.featured?"rgba(255,255,255,0.4)":T.inkLight}}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"12px 20px",borderBottom:`1px solid ${T.border}`,fontFamily:"JetBrains Mono",fontSize:9.5,color:T.inkLight,letterSpacing:1.3,textTransform:"uppercase"}}>Breakdown by commodity</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:T.bgDark}}>
                  {["Commodity","Shock","Gross","Hedge Offset","Net","Coverage"].map(h=>(
                    <th key={h} style={{padding:"9px 16px",textAlign:"left",fontFamily:"JetBrains Mono",fontSize:9,color:T.inkLight,fontWeight:500,textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.details.map(({comm,shock,grossImpact,hedgedOffset,netImpact,avgHedgePct},i)=>(
                  <tr key={comm.id} className="rh" style={{borderBottom:`1px solid ${T.border}`}}>
                    <td style={{padding:"11px 16px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:comm.color}}/><span style={{fontFamily:"Sora",fontWeight:500,fontSize:13,color:T.ink}}>{comm.name}</span></div></td>
                    <td style={{padding:"11px 16px",fontFamily:"JetBrains Mono",fontSize:13,fontWeight:600,color:shock>=0?T.red:T.green}}>{shock>=0?"+":""}{shock}%</td>
                    <td style={{padding:"11px 16px",fontFamily:"JetBrains Mono",fontSize:13,color:grossImpact>=0?T.red:T.green}}>{grossImpact>=0?"+":""}${grossImpact.toFixed(1)}M</td>
                    <td style={{padding:"11px 16px",fontFamily:"JetBrains Mono",fontSize:13,color:T.green}}>-${Math.abs(hedgedOffset).toFixed(1)}M</td>
                    <td style={{padding:"11px 16px",fontFamily:"JetBrains Mono",fontSize:13,fontWeight:600,color:netImpact>=0?T.red:T.green}}>{netImpact>=0?"+":""}${netImpact.toFixed(1)}M</td>
                    <td style={{padding:"11px 16px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:48,height:4,background:T.bgDeep,borderRadius:2}}><div style={{width:`${avgHedgePct*100}%`,height:"100%",background:avgHedgePct>0.7?T.green:avgHedgePct>0.4?T.amber:T.red,borderRadius:2}}/></div><span style={{fontFamily:"JetBrains Mono",fontSize:11,color:T.inkLight}}>{(avgHedgePct*100).toFixed(0)}%</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{background:T.bgDark,borderRadius:10,padding:"14px 18px",border:`1px solid ${T.border}`,fontSize:13,color:T.inkMid,lineHeight:1.7}}>
            {result.net>5?`Net unprotected impact: +$${result.net.toFixed(1)}M. Chicken meal is the largest single exposure. Consider adding Q3/Q4 coverage.`
            :result.net<-5?`Portfolio benefits by $${Math.abs(result.net).toFixed(1)}M net. Hedge book is well-positioned for this outcome.`
            :`Net impact of $${Math.abs(result.net).toFixed(1)}M is within normal tolerance. Current hedge book provides adequate protection.`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SOURCING ADVISOR ─────────────────────────────────────────────────────────
function SourcingAdvisor(){
  const recs=[
    {priority:"ACT NOW",priorityColor:T.red,commodity:"Chicken Meal",action:"Layer additional Q3 2025 hedge coverage",rationale:"Q3 coverage drops to 40% in 89 days. Current spot ($1,840) is 6.9% above Q3 entry and trending higher.",options:[{type:"OTC Swap",detail:"Lock fixed price with existing counterparty for Q3 volume",cost:"No upfront cost, full settlement at expiry",risk:"Counterparty credit risk, less liquid"},{type:"CME Futures",detail:"Buy CBOT futures at ~$1,810 target (2% discount to spot)",cost:"~$0.4M margin per 1,000 tons",risk:"Basis risk vs. actual chicken meal"}],recommendation:"Layer 15–20% additional Q3 coverage via OTC swap at current levels. Target 55–60% total Q3 coverage.",urgencyDays:89},
    {priority:"REVIEW",priorityColor:T.amber,commodity:"Corn",action:"Evaluate Q4 2025 coverage strategy",rationale:"Q4 corn coverage is only 30%. Prices have pulled back 22% from prior year highs — potentially attractive entry.",options:[{type:"CME Futures",detail:"Buy December CBOT Corn at current ~$4.85",cost:"Standard margin requirements",risk:"Prices could continue lower"}],recommendation:"Monitor 30 days. If CBOT corn holds above $4.50, add 20% Q4 coverage via futures.",urgencyDays:180},
    {priority:"HOLD",priorityColor:T.green,commodity:"Natural Gas",action:"Maintain current hedge posture",rationale:"Q1/Q2 coverage at 95%/80% is strong. Open exposure manageable at 8% of COGS. Spot at $2.85 well below prior year $3.40.",options:[],recommendation:"No action. Monitor Henry Hub for sustained move above $3.25 which would trigger a Q3/Q4 review.",urgencyDays:null},
    {priority:"REVIEW",priorityColor:T.amber,commodity:"Soybean Meal",action:"Review Louis Dreyfus formula contract expiring Q3",rationale:"Formula contract expires Q3 2025. CBOT soy meal at $380 vs. $445 prior year — favorable time to negotiate fixed-price extension.",options:[{type:"Fixed Price",detail:"Negotiate Q4 fixed price at current levels ~$378",cost:"Small premium for price certainty",risk:"Miss further downside if prices fall"}],recommendation:"Initiate supplier conversation in 30 days. Target fixed-price for 40% of Q4 volume at $375–380/ton.",urgencyDays:120},
  ];
  const order={"ACT NOW":0,"REVIEW":1,"HOLD":2};
  const sorted=[...recs].sort((a,b)=>order[a.priority]-order[b.priority]);
  return(
    <div style={{background:T.bg,minHeight:"calc(100vh - 54px)",fontFamily:"Inter"}}>
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"18px 52px"}}>
        <div style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:T.inkLight,letterSpacing:1.5,marginBottom:3,textTransform:"uppercase"}}>Sourcing Advisor</div>
        <div style={{fontFamily:"Sora",fontWeight:600,fontSize:19,color:T.ink,letterSpacing:-0.4}}>Hedge More or Contract More? — Ranked Recommendations</div>
      </div>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 52px",display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:4}}>
          {[{label:"Act Now",count:sorted.filter(r=>r.priority==="ACT NOW").length,color:T.red,bg:T.redBg},{label:"Review",count:sorted.filter(r=>r.priority==="REVIEW").length,color:T.amber,bg:T.amberBg},{label:"Hold",count:sorted.filter(r=>r.priority==="HOLD").length,color:T.green,bg:T.greenBg}].map(s=>(
            <div key={s.label} style={{background:s.bg,border:`1px solid ${s.color}22`,borderRadius:9,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:600,color:s.color}}>{s.label}</span>
              <span style={{fontFamily:"JetBrains Mono",fontSize:22,fontWeight:700,color:s.color}}>{s.count}</span>
            </div>
          ))}
        </div>
        {sorted.map((rec,i)=>(
          <div key={i} style={{background:T.white,border:`1px solid ${T.border}`,borderLeft:`4px solid ${rec.priorityColor}`,borderRadius:10,padding:"20px 24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{background:rec.priorityColor,color:T.white,fontFamily:"JetBrains Mono",fontSize:9.5,fontWeight:700,padding:"3px 9px",borderRadius:5,letterSpacing:0.8}}>{rec.priority}</span>
              {rec.urgencyDays&&<span style={{fontFamily:"JetBrains Mono",fontSize:10,color:T.inkLight}}>Review in {rec.urgencyDays} days</span>}
            </div>
            <div style={{fontFamily:"Sora",fontWeight:600,fontSize:15,color:T.ink,marginBottom:4}}>{rec.commodity} — {rec.action}</div>
            <div style={{fontSize:13,color:T.inkLight,lineHeight:1.6,marginBottom:rec.options.length>0?14:10,maxWidth:600}}>{rec.rationale}</div>
            {rec.options.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:`repeat(${rec.options.length},1fr)`,gap:10,marginBottom:12}}>
                {rec.options.map((opt,j)=>(
                  <div key={j} style={{background:T.bgDark,borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:"JetBrains Mono",fontSize:9.5,color:T.green,letterSpacing:0.8,marginBottom:5,fontWeight:600}}>{opt.type}</div>
                    <div style={{fontSize:12,color:T.inkMid,lineHeight:1.5,marginBottom:5}}>{opt.detail}</div>
                    <div style={{fontSize:11,color:T.inkLight,marginBottom:2}}>Cost: {opt.cost}</div>
                    <div style={{fontSize:11,color:T.inkLight}}>Risk: {opt.risk}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{background:rec.priority==="ACT NOW"?T.redBg:rec.priority==="REVIEW"?T.amberBg:T.greenBg,borderRadius:8,padding:"10px 14px",borderLeft:`3px solid ${rec.priorityColor}`}}>
              <div style={{fontFamily:"JetBrains Mono",fontSize:9,color:rec.priorityColor,letterSpacing:0.8,marginBottom:3,fontWeight:600}}>RECOMMENDATION</div>
              <div style={{fontSize:13,color:T.inkMid,lineHeight:1.6}}>{rec.recommendation}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RISK AGENT ───────────────────────────────────────────────────────────────
function RiskAgent(){
  const[msgs,setMsgs]=useState([]);
  const[inp,setInp]=useState("");
  const[load,setLoad]=useState(false);
  const btm=useRef(null);
  const totalExposure=COMMODITIES.reduce((s,c)=>s+calcExposure(c).grossExposure,0);
  const totalOpen=COMMODITIES.reduce((s,c)=>s+calcExposure(c).openExposure,0);
  const avgCoverage=(COMMODITIES.reduce((s,c)=>s+calcExposure(c).avgHedgePct,0)/COMMODITIES.length*100).toFixed(0);
  const totalMTM=COMMODITIES.reduce((s,c)=>s+calcMTM(c),0);

  const CANNED={
    "What's our total commodity exposure?":`Total annualized commodity exposure: $${totalExposure.toFixed(0)}M gross across all four commodities.\n\nBreakdown:\n— Chicken Meal: $${calcExposure(COMMODITIES[0]).grossExposure.toFixed(0)}M gross | $${calcExposure(COMMODITIES[0]).openExposure.toFixed(0)}M open (28% of COGS)\n— Corn: $${calcExposure(COMMODITIES[1]).grossExposure.toFixed(0)}M gross | $${calcExposure(COMMODITIES[1]).openExposure.toFixed(0)}M open (18% of COGS)\n— Soybean Meal: $${calcExposure(COMMODITIES[2]).grossExposure.toFixed(0)}M gross | $${calcExposure(COMMODITIES[2]).openExposure.toFixed(0)}M open (12% of COGS)\n— Natural Gas: $${calcExposure(COMMODITIES[3]).grossExposure.toFixed(0)}M gross | $${calcExposure(COMMODITIES[3]).openExposure.toFixed(0)}M open (8% of COGS)\n\nTotal open exposure: $${totalOpen.toFixed(0)}M — at risk to spot market moves. Chicken Meal is the largest unprotected position and the priority for additional coverage.`,
    "Are we protected if chicken prices spike 25%?":`Running that scenario.\n\nAt a 25% spike in chicken meal from $1,840 to $2,300/ton:\n\nGross P&L impact: +$${(calcExposure(COMMODITIES[0]).grossExposure*0.25).toFixed(1)}M\nHedge book offset: -$${(calcExposure(COMMODITIES[0]).hedgedExposure*0.25).toFixed(1)}M\nNet unprotected impact: +$${(calcExposure(COMMODITIES[0]).openExposure*0.25).toFixed(1)}M\n\nPartially protected. Q1 and Q2 hold at 75% and 60% coverage respectively. The vulnerability is Q3 at 40% and Q4 at 20%. A sustained spike creates meaningful H2 2025 cost pressure.\n\nAdding 15–20% additional Q3 coverage at current levels reduces the net impact by approximately $${(calcExposure(COMMODITIES[0]).openExposure*0.25*0.175).toFixed(1)}M. The 89-day window before Q3 coverage drops makes this time-sensitive.`,
    "Explain our hedge book to someone who doesn't know derivatives":`Happy to translate.\n\nThink of our hedge book as price insurance. We've pre-agreed prices for a portion of the commodities we'll need to buy — so even if market prices spike, we pay the locked-in price for that hedged portion.\n\nIn practice: for Corn, we've locked in 90% of our Q1 needs at $4.60/bushel. Spot corn is $4.85. So on 90% of our Q1 corn we're paying $4.60 instead of $4.85 — saving $0.25/bushel on that volume. That's the hedge working.\n\nThe 10% we didn't hedge? We pay whatever the market price is at the time of purchase.\n\nThe risk is always the open portion — what we haven't hedged yet. Right now the most exposed position is Chicken Meal in Q4, where only 20% is covered. If prices stay elevated, we're paying spot price on 80% of our Q4 chicken needs.\n\nThe job of this team: decide when to lock in more coverage, and at what price it's worth doing so.`,
  };

  const sugg=[
    {cat:"Portfolio",q:"What's our total commodity exposure?"},
    {cat:"Portfolio",q:"What's our mark-to-market position today?"},
    {cat:"Risk",q:"Are we protected if chicken prices spike 25%?"},
    {cat:"Risk",q:"What's our worst-case scenario for Q3?"},
    {cat:"Decision",q:"Should we add more corn coverage now?"},
    {cat:"Decision",q:"Which contracts are expiring soonest?"},
    {cat:"Explain",q:"Explain our hedge book to someone who doesn't know derivatives"},
    {cat:"Explain",q:"What does mark-to-market mean for our CFO?"},
  ];
  const grouped=sugg.reduce((acc,s)=>{(acc[s.cat]=acc[s.cat]||[]).push(s);return acc;},{});

  const send=async(q)=>{
    const msg=q||inp.trim();
    if(!msg||load)return;
    setInp(""); setMsgs(m=>[...m,{role:"user",content:msg}]); setLoad(true);
    await new Promise(r=>setTimeout(r,900+Math.random()*400));
    const reply=CANNED[msg]||`I've reviewed the current commodity portfolio.\n\nTotal exposure: $${totalExposure.toFixed(0)}M with average hedge coverage of ${avgCoverage}%. Portfolio MTM is ${totalMTM>=0?"+":""}$${totalMTM.toFixed(1)}M. The most urgent open position is Chicken Meal Q3 at 40% coverage in 89 days.\n\nWould you like me to focus on a specific commodity, quarter, scenario analysis, or the sourcing decision framework?`;
    setMsgs(m=>[...m,{role:"assistant",content:reply}]); setLoad(false);
    setTimeout(()=>btm.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  return(
    <div style={{background:T.bg,height:"calc(100vh - 54px)",display:"flex",fontFamily:"Inter"}}>
      <div style={{width:260,flexShrink:0,background:T.white,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"18px 18px 10px"}}><div style={{fontFamily:"JetBrains Mono",fontSize:9,color:T.inkGhost,letterSpacing:1.5,textTransform:"uppercase"}}>Suggested questions</div></div>
        <div style={{flex:1,overflowY:"auto",padding:"4px 10px 16px"}}>
          {Object.entries(grouped).map(([cat,qs])=>(
            <div key={cat} style={{marginBottom:14}}>
              <div style={{fontFamily:"JetBrains Mono",fontSize:8.5,color:T.inkGhost,letterSpacing:1.2,marginBottom:5,paddingLeft:6,textTransform:"uppercase"}}>{cat}</div>
              {qs.map(({q},i)=><div key={i} onClick={()=>send(q)} className="sg" style={{padding:"8px 8px",borderRadius:6,cursor:"pointer",fontSize:12.5,color:T.inkMid,lineHeight:1.45,marginBottom:1,transition:"background 0.1s"}}>{q}</div>)}
            </div>
          ))}
        </div>
        <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 18px"}}>
          <div style={{fontFamily:"JetBrains Mono",fontSize:8.5,color:T.inkGhost,letterSpacing:1.2,marginBottom:7,textTransform:"uppercase"}}>Live portfolio</div>
          {[["Total exposure",`$${totalExposure.toFixed(0)}M`,T.ink],["Open exposure",`$${totalOpen.toFixed(0)}M`,T.red],["Avg coverage",`${avgCoverage}%`,T.green],["MTM",`${totalMTM>=0?"+":""}$${totalMTM.toFixed(1)}M`,totalMTM>=0?T.green:T.red]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:11,color:T.inkLight}}>{l}</span>
              <span style={{fontFamily:"JetBrains Mono",fontSize:11,color:c,fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{borderBottom:`1px solid ${T.border}`,padding:"11px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",background:T.white,flexShrink:0}}>
          <div style={{fontFamily:"Sora",fontWeight:500,fontSize:14,color:T.ink}}>Commodity Risk Agent</div>
          <div style={{fontFamily:"JetBrains Mono",fontSize:10,color:T.inkLight}}>Claude Sonnet · 4 commodities · live hedge book</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"28px 0"}}>
          <div style={{maxWidth:680,margin:"0 auto",padding:"0 28px"}}>
            {msgs.length===0&&(
              <div style={{textAlign:"center",paddingTop:60}}>
                <div style={{fontFamily:"Sora",fontWeight:400,fontSize:22,color:T.ink,letterSpacing:-0.5,marginBottom:10}}>How can I help?</div>
                <p style={{fontSize:14,color:T.inkLight,lineHeight:1.75,maxWidth:420,margin:"0 auto"}}>Ask about positions, hedge coverage, scenario impacts, or sourcing decisions. I explain at any level — quant to CFO.</p>
                <div style={{marginTop:20,fontSize:13,color:T.inkGhost}}>← Select a question to start</div>
              </div>
            )}
            {msgs.map((m,i)=>(
              <div key={i} className="fade" style={{marginBottom:24,display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
                {m.role==="assistant"&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M3 3 L21 3 L21 21 L3 21 Z" stroke={T.ink} strokeWidth="1.5" fill="none" opacity="0.2"/><circle cx="12" cy="12" r="3" fill={T.green}/><path d="M3 18 L8 12 L13 15 L18 8" stroke={T.green} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg><span style={{fontFamily:"Sora",fontSize:11.5,fontWeight:500,color:T.inkMid}}>Commodity Risk Agent</span></div>}
                <div style={{maxWidth:m.role==="user"?"72%":"100%",padding:m.role==="user"?"10px 15px":"0",borderRadius:m.role==="user"?"10px 10px 2px 10px":0,background:m.role==="user"?T.ink:"transparent",color:m.role==="user"?T.white:T.ink,fontSize:14,lineHeight:1.8,whiteSpace:"pre-line",letterSpacing:-0.1}}>{m.content}</div>
              </div>
            ))}
            {load&&<div className="fade" style={{marginBottom:24}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M3 3 L21 3 L21 21 L3 21 Z" stroke={T.ink} strokeWidth="1.5" fill="none" opacity="0.2"/><circle cx="12" cy="12" r="3" fill={T.green}/><path d="M3 18 L8 12 L13 15 L18 8" stroke={T.green} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg><span style={{fontFamily:"Sora",fontSize:11.5,fontWeight:500,color:T.inkMid}}>Commodity Risk Agent</span></div><div style={{display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:T.inkGhost,animation:`blink 1.3s infinite ${i*0.22}s`}}/>)}</div></div>}
            <div ref={btm}/>
          </div>
        </div>
        <div style={{padding:"14px 28px 18px",background:T.bg,borderTop:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{maxWidth:680,margin:"0 auto"}}>
            <div style={{background:T.white,border:`1.5px solid ${T.borderMid}`,borderRadius:10,padding:"4px 4px 4px 14px",display:"flex",alignItems:"flex-end",gap:7}}>
              <textarea value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ask about positions, scenarios, coverage decisions, or request a plain-English explanation…" rows={1} style={{flex:1,background:"none",border:"none",outline:"none",resize:"none",fontSize:14,color:T.ink,lineHeight:1.6,padding:"8px 0",fontFamily:"Inter",letterSpacing:-0.1}}/>
              <button onClick={()=>send()} disabled={!inp.trim()||load} style={{background:inp.trim()&&!load?T.ink:T.bgDark,color:inp.trim()&&!load?T.white:T.inkGhost,border:"none",padding:"8px 15px",borderRadius:7,cursor:inp.trim()&&!load?"pointer":"default",fontWeight:500,fontSize:13,fontFamily:"Sora",transition:"all 0.15s",marginBottom:2,flexShrink:0}}>Send</button>
            </div>
            <div style={{fontSize:10.5,color:T.inkGhost,marginTop:5,textAlign:"center",fontFamily:"JetBrains Mono",letterSpacing:0.3}}>Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App(){
  const[page,setPage]=useState("dashboard");
  const render=()=>{
    switch(page){
      case"dashboard": return <Dashboard setPage={setPage}/>;
      case"hedgebook":  return <HedgeBook/>;
      case"scenarios":  return <Scenarios/>;
      case"sourcing":   return <SourcingAdvisor/>;
      case"agent":      return <RiskAgent/>;
      default:          return <Dashboard setPage={setPage}/>;
    }
  };
  return <div style={{minHeight:"100vh",background:T.bg}}><Fonts/><Nav page={page} setPage={setPage}/>{render()}</div>;
}
"use strict";

// ===== SVG CDF chart helpers =====
function svgCdfSetup(xMax,yMin,yMax){
  const W=600,H=250,pad={l:50,r:15,t:25,b:30};
  const pw=W-pad.l-pad.r,ph=H-pad.t-pad.b;
  const tx=v=>pad.l+v/xMax*pw;
  const ty=v=>pad.t+(1-(v-yMin)/(yMax-yMin))*ph;
  return{W,H,pad,pw,ph,tx,ty,xMax,yMin,yMax};
}

function svgPolylinePoints(x,f,tx,ty,xMax,yMin,yMax){
  let pts='';
  for(let i=0;i<x.length;i++){
    if(!isFinite(x[i])||!isFinite(f[i]))continue;
    const sx=tx(Math.min(x[i],xMax));
    const sy=ty(Math.max(yMin,Math.min(yMax,f[i])));
    pts+=(pts?',':'')+sx.toFixed(3)+','+sy.toFixed(3);
  }
  return pts;
}

function buildSvgChart(curves,title,cfg){
  // curves: [{x,f,color,label}]
  const{W,H,pad,pw,ph,tx,ty,xMax,yMin,yMax}=cfg;
  let svg=`<rect width="${W}" height="${H}" fill="#0a0a1a"/>`;

  // Grid lines
  for(let gx=0;gx<=xMax;gx+=5)
    svg+=`<line x1="${tx(gx)}" y1="${pad.t}" x2="${tx(gx)}" y2="${pad.t+ph}" stroke="#1a2a4a" stroke-width="0.5"/>`;
  const yStep=yMin<0?0.2:0.2;
  for(let gy=yMin;gy<=yMax+0.01;gy+=yStep)
    svg+=`<line x1="${pad.l}" y1="${ty(gy)}" x2="${pad.l+pw}" y2="${ty(gy)}" stroke="#1a2a4a" stroke-width="0.5"/>`;

  // Axis labels
  for(let gx=0;gx<=xMax;gx+=5)
    svg+=`<text x="${tx(gx)}" y="${pad.t+ph+14}" fill="#888" font-size="10" text-anchor="middle">${gx}</text>`;
  for(let gy=yMin;gy<=yMax+0.01;gy+=yStep)
    svg+=`<text x="${pad.l-4}" y="${ty(gy)+3}" fill="#888" font-size="10" text-anchor="end">${gy.toFixed(1)}</text>`;

  // Curves
  for(const c of curves){
    const pts=svgPolylinePoints(c.x,c.f,tx,ty,xMax,yMin,yMax);
    if(pts)svg+=`<polyline points="${pts}" fill="none" stroke="${c.color}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  }

  // Legend
  const lx=pad.l+pw-160,ly=pad.t+15;
  curves.forEach((c,i)=>{
    if(!c.label)return;
    svg+=`<rect x="${lx}" y="${ly+i*16-4}" width="12" height="3" fill="${c.color}"/>`;
    svg+=`<text x="${lx+16}" y="${ly+i*16}" fill="#ccc" font-size="11">${c.label}</text>`;
  });

  // Title
  svg+=`<text x="${pad.l}" y="${pad.t-8}" fill="#c9a96e" font-size="12">${title}</text>`;
  return svg;
}

function downsampleForViz(x,f,maxPts){
  if(x.length<=maxPts)return{x,f};
  const step=x.length/maxPts;
  const xd=[x[0]],fd=[f[0]];
  for(let i=1;i<maxPts-1;i++){const j=Math.round(i*step);xd.push(x[j]);fd.push(f[j]);}
  xd.push(x[x.length-1]);fd.push(f[f.length-1]);
  return{x:xd,f:fd};
}

function drawOrthSnapshot(idx){
  if(idx<0||idx>=orthState.snapshots.length)return;
  const snap=orthState.snapshots[idx];
  const cfg=svgCdfSetup(15,-0.2,1.0);
  const MAX_VIZ=1000000;
  const c1=downsampleForViz(snap.xCand,snap.fCand,MAX_VIZ);
  const c2=downsampleForViz(snap.xBackup,snap.fBackup,MAX_VIZ);
  const c3=downsampleForViz(snap.xNew,snap.fNew,MAX_VIZ);

  const curves=[
    {x:c1.x,f:c1.f,color:'#4488ff',label:'Candidate CDF'},
    {x:c2.x,f:c2.f,color:'#cccccc',label:'Previous residual'},
    {x:c3.x,f:c3.f,color:'#ff4444',label:'After subtraction'},
  ];
  const title=`Element ${idx+1} (length=${snap.minLength.toFixed(4)}, ${snap.pct.toFixed(1)}%)`;
  document.getElementById('cdf-svg').innerHTML=buildSvgChart(curves,title,cfg);

  const rows=document.getElementById('orth-table').querySelectorAll('tbody tr');
  rows.forEach((r,i)=>{r.classList.toggle('selected',i===idx);});
}

function resetOrth(){
  orthState={initialized:false,xVals:null,fVals:null,lengthGeodesic:0,results:[],percentages:[],snapshots:[],xInit:null,fInit:null};
  document.getElementById('orth-table').querySelector('tbody').innerHTML='';
  document.getElementById('cdf-svg').innerHTML='';
  const bsv=document.getElementById('barcode-svg');
  if(bsv)bsv.innerHTML='';
  document.getElementById('orth-status').textContent='Reset. Ready.';
}

// ===== Barcode chart =====
function svgBarcodeChart(blueTicks,redTicks){
  const xMax=15;
  const W=600,H=80;
  const pad={l:50,r:15,t:12,b:20};
  const pw=W-pad.l-pad.r;
  const ph=H-pad.t-pad.b;
  const tx=v=>pad.l+Math.min(v,xMax)/xMax*pw;
  const midY=pad.t+ph/2;
  // ty maps data y in [-1,1] to pixel coordinates: y=1→pad.t, y=-1→H-pad.b
  const ty=v=>midY-v*(ph/2);

  let svg=`<rect width="${W}" height="${H}" fill="#0a0a1a"/>`;

  // Vertical grid lines
  for(let gx=0;gx<=xMax;gx+=5)
    svg+=`<line x1="${tx(gx)}" y1="${pad.t}" x2="${tx(gx)}" y2="${H-pad.b}" stroke="#1a2a4a" stroke-width="0.5"/>`;
  // X-axis labels
  for(let gx=0;gx<=xMax;gx+=5)
    svg+=`<text x="${tx(gx)}" y="${H-pad.b+12}" fill="#888" font-size="10" text-anchor="middle">${gx}</text>`;

  // Baseline at y=0
  svg+=`<line x1="${pad.l}" y1="${midY}" x2="${pad.l+pw}" y2="${midY}" stroke="#2a3a5a" stroke-width="0.8"/>`;

  // Blue ticks: from (p,0) up to (p,1)
  for(const p of blueTicks){
    if(!isFinite(p)||p<0)continue;
    const x=tx(p);
    svg+=`<line x1="${x}" y1="${ty(0)}" x2="${x}" y2="${ty(1)}" stroke="#4488ff" stroke-width="1" opacity="0.8"/>`;
  }

  // Red ticks: from (q,0) down to (q,-1)
  for(const p of redTicks){
    if(!isFinite(p)||p<0)continue;
    const x=tx(Math.min(p,xMax));
    svg+=`<line x1="${x}" y1="${ty(0)}" x2="${x}" y2="${ty(-1)}" stroke="#ff4444" stroke-width="2"/>`;
  }

  return svg;
}

function updateBarcodeChart(){
  const svg=document.getElementById('barcode-svg');
  if(!svg)return;
  const blueTicks=typeof storyArcLengths!=='undefined'?storyArcLengths:[];
  const redTicks=(orthState&&orthState.results)?[...orthState.results]:[];
  svg.innerHTML=svgBarcodeChart(blueTicks,redTicks);
}

// ===== Show initial ECDF + sum of computed elements =====
function showOrthInitialSum(){
  if(!orthState||!orthState.initialized||!orthState.xInit){
    document.getElementById('orth-status').textContent='Run at least one estimate first.';
    return;
  }
  const cfg=svgCdfSetup(15,-0.2,1.0);
  const MAX_VIZ=1000000;
  const init=downsampleForViz(orthState.xInit,orthState.fInit,MAX_VIZ);
  const curves=[{x:init.x,f:init.f,color:'#cccccc',label:'Initial ECDF'}];

  const snaps=orthState.snapshots;
  if(snaps.length>0){
    // Build union x grid across all candidate CDFs
    const xSet=new Set();
    for(const s of snaps)for(const v of s.xCand)if(isFinite(v))xSet.add(v);
    const sumX=[...xSet].sort((a,b)=>a-b);
    const sumF=sumX.map(x=>{
      let tot=0;
      for(const snap of snaps){
        let lo=0,hi=snap.xCand.length-1,best=-1;
        while(lo<=hi){const mid=(lo+hi)>>1;if(snap.xCand[mid]<=x){best=mid;lo=mid+1;}else hi=mid-1;}
        if(best>=0)tot+=snap.fCand[best];
      }
      return tot;
    });
    const sm=downsampleForViz(sumX,sumF,MAX_VIZ);
    curves.push({x:sm.x,f:sm.f,color:'#ff8844',label:'Sum of computed'});
  }

  const title=`Initial distribution + sum (${snaps.length} element${snaps.length!==1?'s':''})`;
  document.getElementById('cdf-svg').innerHTML=buildSvgChart(curves,title,cfg);
}

function resetHomotopy(){
  homotopyState={results:[]};
  if(savedArcs){for(const a of savedArcs)delete a.classIdx;}
  document.getElementById('homotopy-table').querySelector('tbody').innerHTML='';
  document.getElementById('homotopy-status').textContent='Reset. Ready.';
  updateArcsPanel();
}

async function guessSepNonsep(){
  if(!toMusic||toMusic.length===0)return;
  if(toMusic.length<4){document.getElementById('orth-status').textContent='Not enough crossings.';return;}

  const evenIdx=[];const oddIdx=[];
  for(let i=0;i<toMusic.length;i++){if(i%2===0)oddIdx.push(i);else evenIdx.push(i);}
  const tmEven=evenIdx.map(i=>toMusic[i]);
  const tmOdd=oddIdx.map(i=>toMusic[i]);

  const ecdfEven=computeCumufunFromToMusic(tmEven);
  const ecdfOdd=computeCumufunFromToMusic(tmOdd);

  // Evaluate both on common grid and compute KS distance
  const xSet=new Set([...ecdfEven.x,...ecdfOdd.x].filter(v=>isFinite(v)));
  const xCommon=[...xSet].sort((a,b)=>a-b);
  let maxDist=0;
  for(const xv of xCommon){
    let fe=0,fo=0;
    for(let j=ecdfEven.x.length-1;j>=0;j--){if(ecdfEven.x[j]<=xv){fe=ecdfEven.f[j];break;}}
    for(let j=ecdfOdd.x.length-1;j>=0;j--){if(ecdfOdd.x[j]<=xv){fo=ecdfOdd.f[j];break;}}
    maxDist=Math.max(maxDist,Math.abs(fe-fo));
  }

  const guess=maxDist<0.05?'Nonseparating':'Separating';

  // Draw both CDFs using SVG
  const cfg=svgCdfSetup(15,0,1.05);
  const MAX_VIZ=1000000;
  const de=downsampleForViz(ecdfEven.x,ecdfEven.f,MAX_VIZ);
  const do_=downsampleForViz(ecdfOdd.x,ecdfOdd.f,MAX_VIZ);
  const curves=[
    {x:de.x,f:de.f,color:'#4488ff',label:'Even arcs'},
    {x:do_.x,f:do_.f,color:'#ff4444',label:'Odd arcs'},
  ];
  const title=`Even vs Odd — KS dist: ${maxDist.toFixed(4)} → ${guess}`;
  document.getElementById('cdf-svg').innerHTML=buildSvgChart(curves,title,cfg);

  document.getElementById('orth-status').textContent=`Guess: ${guess} (KS distance: ${maxDist.toFixed(4)})`;
}

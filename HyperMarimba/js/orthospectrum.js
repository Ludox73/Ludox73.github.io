"use strict";

// ===== Shared helpers =====
function myEcdf(data){
  const sorted=[...data].sort((a,b)=>a-b);
  const n=sorted.length;
  const x=[sorted[0],...sorted];
  const f=[0,...sorted.map((_,i)=>(i+1)/n)];
  return{x,f};
}

function computeCumufunFromToMusic(tm){
  const values=tm.map(r=>r[0]);
  return myEcdf(values);
}

// ===== Monte Carlo Orthospectrum =====
let orthState={initialized:false,xVals:null,fVals:null,lengthGeodesic:0,results:[],percentages:[],snapshots:[]};

function guessLengthGeodesicFromToMusic(tm,chiSigma){
  const totalTime=tm.reduce((s,r)=>s+r[0],0);
  const numIntersections=tm.length;
  return -numIntersections*Math.PI*Math.PI*chiSigma/totalTime;
}

function precomputeSamples(lengthGeodesic,nSamples){
  const widthX=4*lengthGeodesic;
  const samples=new Array(nSamples);
  for(let i=0;i<nSamples;i++){
    const y0=-widthX/2+widthX*Math.random();
    const u=Math.random();
    const theta=Math.asin(2*u-1);
    const y=Math.tanh(y0/2);
    const point1=[0,y];
    const gc1=geodesicCircumferenceFromPtv(point1,[Math.cos(theta),Math.sin(theta)]);
    samples[i]={point1,gc1Center:gc1.center,gc1Radius:gc1.radius};
  }
  return{samples,widthX,lengthGeodesic};
}

function evaluateSamplesAtDistance(precomp,distance){
  const{samples,widthX,lengthGeodesic}=precomp;
  const n=samples.length;
  const point2=[Math.tanh(distance/2),0];
  const gc2=geodesicCircumferenceFromPtv(point2,[0,1]);
  const gc2c=gc2.center,gc2r=gc2.radius;

  const vals=[];
  let finiteCount=0;
  for(let i=0;i<n;i++){
    const s=samples[i];
    const pts=findIntersectionCircles(s.gc1Center,s.gc1Radius,gc2c,gc2r);
    let d=Infinity;
    if(pts){
      for(let h=0;h<pts.length;h++){
        const p=pts[h];
        if(p[0]*p[0]+p[1]*p[1]<1){d=distanceTwoPoints(s.point1,p);break;}
      }
    }
    if(isFinite(d)){vals.push(d);finiteCount++;}
  }

  const AL=widthX*Math.PI;
  const AB=finiteCount/n*AL;
  const numInfToAdd=Math.max(0,Math.round((lengthGeodesic*2*Math.PI/AB)*finiteCount)-finiteCount);
  const totalN=finiteCount+numInfToAdd;

  const sorted=vals.sort((a,b)=>a-b);
  if(sorted.length===0)return{x:[0],f:[0]};
  const x=[sorted[0],...sorted];
  const f=x.map((_,i)=>i/totalN);
  return{x,f};
}

function interpPrevBsearch(xs,fs,xq){
  const result=new Float64Array(xq.length);
  for(let i=0;i<xq.length;i++){
    let lo=0,hi=xs.length-1,best=-1;
    while(lo<=hi){const mid=(lo+hi)>>1;if(xs[mid]<=xq[i]){best=mid;lo=mid+1;}else hi=mid-1;}
    result[i]=best>=0?fs[best]:0;
  }
  return result;
}

function uniqueLast(x,f){
  const xu=[],fu=[];
  for(let i=0;i<x.length;i++){
    if(i===x.length-1||x[i]!==x[i+1]){xu.push(x[i]);fu.push(f[i]);}
  }
  return{x:xu,f:fu};
}

function subtractCumufuns(x1,f1,x2,f2){
  const x1c=[],f1c=[],x2c=[],f2c=[];
  for(let i=0;i<x1.length;i++)if(isFinite(x1[i])&&isFinite(f1[i])){x1c.push(x1[i]);f1c.push(f1[i]);}
  for(let i=0;i<x2.length;i++)if(isFinite(x2[i])&&isFinite(f2[i])){x2c.push(x2[i]);f2c.push(f2[i]);}
  if(x1c.length===0||x2c.length===0)return{x:[0],f:[0]};
  const u1=uniqueLast(x1c,f1c);
  const u2=uniqueLast(x2c,f2c);
  const xSet=new Set([...u1.x,...u2.x]);
  const xCommon=[...xSet].sort((a,b)=>a-b);
  const f1i=interpPrevBsearch(u1.x,u1.f,xCommon);
  const f2i=interpPrevBsearch(u2.x,u2.f,xCommon);
  const fOut=new Array(xCommon.length);
  for(let i=0;i<xCommon.length;i++)fOut[i]=f2i[i]-f1i[i];
  return{x:xCommon,f:fOut};
}

function guessMinimumLength(xVals,fVals,lengthGeodesic,nSamples){
  const xFinite=xVals.filter((_,i)=>isFinite(xVals[i])&&isFinite(fVals[i]));
  const fFinite=fVals.filter((_,i)=>isFinite(xVals[i])&&isFinite(fVals[i]));
  if(xFinite.length===0)return 0;

  let sLow=xFinite[0];
  let sHigh=xFinite[0];
  for(let i=0;i<fFinite.length;i++){if(fFinite[i]>0.2){sHigh=xFinite[i];break;}}
  if(sHigh<=sLow)sHigh=xFinite[xFinite.length-1];
  if(sLow>=sHigh)return sLow;

  const xEmpU=[],fEmpU=[];
  for(let i=0;i<xFinite.length;i++){
    if(i===xFinite.length-1||xFinite[i]!==xFinite[i+1]){xEmpU.push(xFinite[i]);fEmpU.push(fFinite[i]);}
  }

  const precomp=precomputeSamples(lengthGeodesic,nSamples);

  for(let iter=0;iter<15;iter++){
    const sMid=(sLow+sHigh)/2;
    const cand=evaluateSamplesAtDistance(precomp,sMid);
    let fits=true;
    for(let i=0;i<cand.x.length;i++){
      let lo=0,hi=xEmpU.length-1,fEmp=0;
      while(lo<=hi){const mid=(lo+hi)>>1;if(xEmpU[mid]<=cand.x[i]){fEmp=fEmpU[mid];lo=mid+1;}else hi=mid-1;}
      if(0.8*cand.f[i]>fEmp+0.0001){fits=false;break;}
    }
    if(fits)sHigh=sMid;else sLow=sMid;
  }
  return{minLength:(sLow+sHigh)/2,precomp};
}

async function computeNextOrthElement(){
  if(!toMusic||toMusic.length===0)return;
  const nSamples=parseInt(document.getElementById('orth-samples').value);
  const chiSigma=-2;

  if(!orthState.initialized){
    orthState.lengthGeodesic=guessLengthGeodesicFromToMusic(toMusic,chiSigma);
    const ecdf=computeCumufunFromToMusic(toMusic);
    orthState.xVals=ecdf.x;orthState.fVals=ecdf.f;
    orthState.xInit=[...ecdf.x];orthState.fInit=[...ecdf.f];
    orthState.results=[];orthState.percentages=[];orthState.snapshots=[];
    orthState.initialized=true;
    document.getElementById('orth-table').querySelector('tbody').innerHTML='';
  }

  document.getElementById('btn-orth').disabled=true;
  document.getElementById('orth-status').textContent='Computing next element...';
  await new Promise(r=>setTimeout(r,10));

  try{
    const xBackup=[...orthState.xVals],fBackup=[...orthState.fVals];

    const guess=guessMinimumLength(orthState.xVals,orthState.fVals,orthState.lengthGeodesic,nSamples);
    const minLength=guess.minLength;

    const cand=evaluateSamplesAtDistance(guess.precomp,minLength);

    if(cand.x[cand.x.length-1]<orthState.xVals[orthState.xVals.length-1])
      cand.x[cand.x.length-1]=orthState.xVals[orthState.xVals.length-1];
    else
      orthState.xVals[orthState.xVals.length-1]=cand.x[cand.x.length-1];

    const fCandSub=cand.f.map(v=>2*v);
    const pct=cand.f[cand.f.length-1]*200;

    const sub=subtractCumufuns(cand.x,fCandSub,orthState.xVals,orthState.fVals);
    orthState.xVals=sub.x;orthState.fVals=sub.f;
    orthState.results.push(minLength);
    orthState.percentages.push(pct);

    orthState.snapshots.push({
      xCand:[...cand.x],fCand:[...fCandSub],
      xBackup,fBackup,
      xNew:[...sub.x],fNew:[...sub.f],
      minLength,pct
    });

    const tbody=document.getElementById('orth-table').querySelector('tbody');
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${orthState.results.length}</td><td>${minLength.toFixed(6)}</td><td>${pct.toFixed(1)}</td>`;
    const snapIdx=orthState.snapshots.length-1;
    tr.addEventListener('click',()=>drawOrthSnapshot(snapIdx));
    tbody.appendChild(tr);

    drawOrthSnapshot(orthState.snapshots.length-1);
    updateBarcodeChart();

    document.getElementById('orth-status').textContent=
      `Element ${orthState.results.length}: ${minLength.toFixed(6)} (${pct.toFixed(1)}%)`;

  }catch(e){
    document.getElementById('orth-status').textContent='Error: '+e.message;
  }
  document.getElementById('btn-orth').disabled=false;
}

// ===== Homotopy-based Orthospectrum from Arcs =====
let homotopyState={results:[]};

// Build a map from (hex*6+side) → boundary ID.
// Each (hex,side) on a decomposition curve gets its own unique ID (so different
// sides of the same curve are distinguished). Simple-paired internal sides share
// an ID with their partner (they form the same internal edge).
function buildBoundaryMap(gluing){
  const map=new Map();
  let nextId=0;
  // Decomposition curves: each (hex,side) gets a distinct ID
  for(const cc of gluing.curveCombinations){
    for(const[h,s] of cc){
      map.set(h*6+s,nextId);
      nextId++;
    }
  }
  // Internal boundaries (simple pairings between hexes)
  for(let h=0;h<4;h++){
    for(let s=0;s<6;s++){
      const key=h*6+s;
      if(map.has(key))continue;
      const p=gluing.pairings[h][s];
      if(!p||p.type!=='simple')continue;
      const partnerKey=p.tgtHex*6+p.tgtSide;
      if(map.has(partnerKey)){
        map.set(key,map.get(partnerKey));
      }else{
        map.set(key,nextId);
        nextId++;
      }
    }
  }
  return map;
}

// Each crossing is [exitHex, exitSide, entryHex, entrySide].
// Map it to a single canonical integer: the unordered pair {exit, entry} encoded as
// min*100+max (hex*6+side gives values 0-23, so no collision).
// This is symmetric: same ID whether traversed forward or backward.
function crossingId(eh,es,nh,ns){
  const a=eh*6+es, b=nh*6+ns;
  return Math.min(a,b)*100+Math.max(a,b);
}

function reduceHomotopyWord(crossings){
  const ids=[];
  for(const c of crossings){
    const[eh,es,nh,ns]=c;
    if(isNaN(eh)||isNaN(nh))continue; // skip incomplete first crossing
    ids.push(crossingId(eh,es,nh,ns));
  }
  return ids;
}

function homotopyKey(crossings){
  const fwd=reduceHomotopyWord(crossings);
  const rev=[...fwd].reverse();
  // Canonicalize: treat an arc and its reverse as the same class
  for(let i=0;i<fwd.length;i++){
    if(fwd[i]<rev[i])return fwd.join(',');
    if(fwd[i]>rev[i])return rev.join(',');
  }
  return fwd.join(',');
}

function computeHomotopyOrthospectrum(){
  if(!savedArcs||savedArcs.length===0||!arcGeoContext){
    document.getElementById('homotopy-status').textContent='No saved arcs. Run geodesic first.';
    return;
  }

  // Group arcs by homotopy class
  const groups=new Map();
  let skipped=0;
  for(let ai=0;ai<savedArcs.length;ai++){
    const arc=savedArcs[ai];
    if(!arc.crossings||arc.crossings.length===0){skipped++;continue;}
    const key=homotopyKey(arc.crossings);
    if(!groups.has(key)){
      const seqStr=arc.crossings.map(([eh,es,nh,ns])=>isNaN(eh)?`(${nh+1},${ns+1})`:`(${eh+1},${es+1})→(${nh+1},${ns+1})`).join(' ');
      groups.set(key,{totalLen:0,count:0,minLen:Infinity,maxLen:0,arcIndices:[],seqStr});
    }
    const g=groups.get(key);
    g.totalLen+=arc.length;
    g.count++;
    if(arc.length<g.minLen)g.minLen=arc.length;
    if(arc.length>g.maxLen)g.maxLen=arc.length;
    g.arcIndices.push(ai);
  }

  // Build results sorted by average length
  const results=[];
  for(const[key,g] of groups){
    results.push({
      key,
      avgLength:g.totalLen/g.count,
      count:g.count,
      minLength:g.minLen,
      maxLength:g.maxLen,
      arcIndices:g.arcIndices,
      seqStr:g.seqStr,
    });
  }
  results.sort((a,b)=>a.minLength-b.minLength);
  homotopyState.results=results;

  // Assign class index to each saved arc
  for(let ci=0;ci<results.length;ci++){
    for(const ai of results[ci].arcIndices){
      savedArcs[ai].classIdx=ci+1;
    }
  }

  // Update table
  const tbody=document.getElementById('homotopy-table').querySelector('tbody');
  tbody.innerHTML='';
  for(let i=0;i<results.length;i++){
    const r=results[i];
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i+1}</td><td>${r.minLength.toFixed(6)}</td><td>${r.count}</td><td style="font-size:0.8em;color:#555">${r.seqStr}</td>`;
    tr.title=`avg=${r.avgLength.toFixed(6)} max=${r.maxLength.toFixed(6)} word=${r.key}`;
    tbody.appendChild(tr);
  }

  document.getElementById('homotopy-status').textContent=
    `${results.length} unique homotopy classes from ${savedArcs.length} arcs`+
    (skipped>0?` (${skipped} skipped, no crossings)`:'');

  // Refresh arcs table to show class indices
  updateArcsPanel();
}

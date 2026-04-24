"use strict";

// ===== Main computation =====
let stopRequested=false;
let toMusic=null;
let pointsDistribution=null; // [{pos, angle, travelTime}]
let savedArcs=null; // [{px,py,tx,ty,toAvoid,polyIdx,length,initAngle,finalAngle,crossings}]
let arcGeoContext=null; // {circles,gluing,polytopes,twists} for redrawing
let running=false;

// Exponential slider: 0-100 maps to 1000 - 1,000,000,000
function maxlenFromSlider(v){return Math.round(1000*Math.pow(10,v/100*4));}
function maxlenFmt(v){
  const n=maxlenFromSlider(v);
  if(n>=1e9)return(n/1e9).toFixed(1)+'B';
  if(n>=1e6)return(n/1e6).toFixed(1)+'M';
  if(n>=1e3)return(n/1e3).toFixed(1)+'k';
  return n.toString();
}

function getParams(){
  const ids=['l1','l2','l3','speed'];
  const vals={};
  for(const id of ids)vals[id]=parseFloat(document.getElementById(id).value);
  // Convert twist percentages (0–100) to radians (0–2π)
  vals.t1=parseFloat(document.getElementById('t1').value)/100*2*Math.PI;
  vals.t2=parseFloat(document.getElementById('t2').value)/100*2*Math.PI;
  vals.t3=parseFloat(document.getElementById('t3').value)/100*2*Math.PI;
  vals.maxlen=maxlenFromSlider(parseFloat(document.getElementById('maxlen').value));
  return vals;
}

async function startComputation(){
  if(running)return;
  running=true;
  stopRequested=false;
  toMusic=null;
  pointsDistribution=null;
  savedArcs=null;arcGeoContext=null;
  document.getElementById('btn-run').disabled=true;
  document.getElementById('btn-stop').disabled=false;
  document.getElementById('btn-play').disabled=true;
  document.getElementById('btn-dist').disabled=true;
  document.getElementById('arcs-panel').style.display='none';
  document.getElementById('progress').style.width='0%';
  document.getElementById('status').textContent='Building surface...';
  document.getElementById('stats').textContent='';

  const p=getParams();
  const lengths=[p.l1,p.l2,p.l3];
  const twists=[p.t1,p.t2,p.t3];
  const maxLen=p.maxlen;
  const drawSpeed=p.speed;

  const gluingType=document.getElementById('gluing-type').value;
  const gluing=gluingType==='nonseparating'?createGluingNonseparatingS2():createGluingSeparatingS2();
  const polytopes=buildPolytopes(gluing,lengths);
  const circles=buildCircles(polytopes);

  const canvases=[0,1,2,3].map(i=>document.getElementById('c'+i));
  drawHexagons(canvases,polytopes,gluing);

  // Initial condition: barycenter of hex 0, random angle
  let bx=0,by=0;
  for(let k=0;k<6;k++){bx+=polytopes[0][k][0];by+=polytopes[0][k][1];}
  bx/=6;by/=6;
  // Perturb away from origin to avoid degenerate geodesic circle computation
  if(Math.abs(bx)<1e-6&&Math.abs(by)<1e-6){bx+=1e-4;by+=1e-4;}
  const p1=[bx,by];
  const np2=bx*bx+by*by;
  const a=Math.random()*2*Math.PI;
  const tgScale=20*(2/(1-np2))**(-2);
  let curPoint=p1;
  let curTgVec=[tgScale*Math.sin(a),tgScale*Math.cos(a)];
  let polyIdx=0;
  let toAvoid=6; // out of range, no side to avoid initially

  // Warmup phase
  document.getElementById('status').textContent='Warming up (1000 units)...';
  let warmupAccum=0;
  const warmupTarget=1000;
  let stepCount=0;

  while(warmupAccum<warmupTarget){
    if(stopRequested)break;
    const inter=firstIntersection(curPoint,curTgVec,circles[polyIdx],toAvoid);
    if(!inter){document.getElementById('status').textContent='Error: no intersection found';running=false;return;}
    const dtp=distanceTwoPoints(curPoint,inter.point);
    warmupAccum+=dtp;
    const pr=applyPairing(inter.point,inter.tgVec,polyIdx,inter.side,gluing,twists,polytopes);
    curPoint=pr.point;curTgVec=pr.tgVec;polyIdx=pr.polyIdx;toAvoid=pr.toAvoid;
    stepCount++;
    if(stepCount%500===0){
      document.getElementById('progress').style.width=Math.min(100,warmupAccum/warmupTarget*100)+'%';
      await new Promise(r=>setTimeout(r,0));
    }
  }

  if(stopRequested){finish();return;}

  const fastMode=document.getElementById('fast-mode').checked;

  // Main geodesic computation
  document.getElementById('status').textContent=fastMode?'Computing (fast mode)...':'Running geodesic...';
  let travelledDist=0;
  let travelledSinceLast=0;
  let firstCycle=true;
  const toMusicLocal=[];
  const distLocal=[]; // distribution data: [pos, angle, travelTime]
  // Apply curve active checkboxes: disabled curves get impossible match
  const curveCombinations=gluing.curveCombinations.map((cc,i)=>{
    const checked=document.getElementById('curve'+(i+1)+'-active').checked;
    return checked?cc:[[-1,-1]];
  });

  // Precompute curve 1 length (hyperbolic distance along side 0 of hex 0 and hex 1)
  const curveLen1=2*distanceTwoPoints(polytopes[0][0],polytopes[0][1]);

  // Collect distribution point for curve-1 crossing (side 0 of any hex)
  function collectDist(){
    if(toAvoid!==0)return;
    // Compute position along curve 1 and crossing angle
    let pos;
    const hv=[curPoint[0]-circles[polyIdx][0].center[0],curPoint[1]-circles[polyIdx][0].center[1]];
    const vca=[-hv[1],hv[0]];
    let angle;
    if(polyIdx===0){
      pos=distanceTwoPoints(curPoint,polytopes[0][0]);
      angle=angleCW2D(vca,curTgVec);
    }else if(polyIdx===1){
      pos=curveLen1/2+distanceTwoPoints(curPoint,polytopes[1][1]);
      angle=angleCW2D(curTgVec,vca)-Math.PI;
    }else if(polyIdx===2){
      pos=(twists[0]/(2*Math.PI)*curveLen1+distanceTwoPoints(curPoint,polytopes[2][0]))%curveLen1;
      if(pos<0)pos+=curveLen1;
      angle=-angleCW2D(vca,curTgVec);
    }else if(polyIdx===3){
      pos=(twists[0]/(2*Math.PI)*curveLen1+curveLen1/2+distanceTwoPoints(curPoint,polytopes[3][1]))%curveLen1;
      if(pos<0)pos+=curveLen1;
      angle=-(angleCW2D(curTgVec,vca)-Math.PI);
    }else return;
    distLocal.push([pos,angle,0]);
  }

  // Arc saving state
  const arcSaveMax=parseInt(document.getElementById('arc-save-max').value)||5000;
  const arcSaveLMin=parseFloat(document.getElementById('arc-save-lmin').value)||0;
  const arcSaveLMax=parseFloat(document.getElementById('arc-save-lmax').value)||Infinity;
  const arcSaveIAMin=parseFloat(document.getElementById('arc-save-iamin').value)||0;
  const arcSaveIAMax=parseFloat(document.getElementById('arc-save-iamax').value)||Math.PI;
  const arcSaveFAMin=parseFloat(document.getElementById('arc-save-famin').value)||0;
  const arcSaveFAMax=parseFloat(document.getElementById('arc-save-famax').value)||Math.PI;
  const arcsLocal=[];
  let arcInitPt=null,arcInitTg=null,arcInitToAvoid=NaN,arcInitPoly=NaN,arcInitAngle=NaN;
  let arcCrossings=[];
  let lastExitHex=NaN,lastExitSide=NaN;

  function computeAngleAtSide(pt,tgv,hexIdx,side){
    // Angle between curve tangent and geodesic direction, mod pi → [0,π]
    const hv=[pt[0]-circles[hexIdx][side].center[0],pt[1]-circles[hexIdx][side].center[1]];
    const vca=[-hv[1],hv[0]]; // perpendicular = curve tangent direction
    const raw=angleCW2D(vca,tgv);
    return raw%Math.PI;
  }

  // Track arc start at each curve crossing
  function trackArcStart(){
    if(arcInitPt!==null)return; // already tracking an arc, don't overwrite
    let isCurve=-1;
    for(let c=0;c<3;c++){
      if(isRow([polyIdx,toAvoid],curveCombinations[c])){isCurve=c;break;}
    }
    if(isCurve<0)return;
    arcInitPt=[...curPoint];arcInitTg=[...curTgVec];
    arcInitToAvoid=toAvoid;arcInitPoly=polyIdx;
    arcInitAngle=computeAngleAtSide(curPoint,curTgVec,polyIdx,toAvoid);
    arcCrossings=[[lastExitHex,lastExitSide,polyIdx,toAvoid]];
  }

  // Try to save arc at end crossing
  function trackArcEnd(interPoint,interTgVec,interHex,interSide,arcLen){
    if(arcInitPt===null)return;
    if(arcsLocal.length>=arcSaveMax){arcInitPt=null;arcCrossings=[];return;}
    const fa=computeAngleAtSide(interPoint,interTgVec,interHex,interSide);
    if(arcLen>=arcSaveLMin&&arcLen<arcSaveLMax&&
       arcInitAngle>=arcSaveIAMin&&arcInitAngle<=arcSaveIAMax&&
       fa>=arcSaveFAMin&&fa<=arcSaveFAMax){
      arcsLocal.push({px:arcInitPt[0],py:arcInitPt[1],tx:arcInitTg[0],ty:arcInitTg[1],
        toAvoid:arcInitToAvoid,polyIdx:arcInitPoly,length:arcLen,initAngle:arcInitAngle,finalAngle:fa,
        crossings:[...arcCrossings]});
    }
    arcInitPt=null;arcInitTg=null;arcInitToAvoid=NaN;arcInitPoly=NaN;arcInitAngle=NaN;
    arcCrossings=[];
  }

  stepCount=0;

  if(fastMode){
    // ===== FAST MODE: no drawing, no animation =====
    while(travelledDist<maxLen){
      if(stopRequested)break;
      collectDist();
      trackArcStart();
      const inter=firstIntersection(curPoint,curTgVec,circles[polyIdx],toAvoid);
      if(!inter)break;
      const dtp=distanceTwoPoints(curPoint,inter.point);
      travelledDist+=dtp;
      travelledSinceLast+=dtp;
      const pr=applyPairing(inter.point,inter.tgVec,polyIdx,inter.side,gluing,twists,polytopes);
      if(arcInitPt!==null)arcCrossings.push([polyIdx,inter.side,pr.polyIdx,pr.toAvoid]);
      let intersectsCurve=-1;
      for(let c=0;c<3;c++){
        if(isRow([polyIdx,inter.side],curveCombinations[c])){intersectsCurve=c;break;}
      }
      if(intersectsCurve>=0){
        if(!firstCycle){
          toMusicLocal.push([travelledSinceLast,intersectsCurve+1]);
          if(distLocal.length>0&&distLocal[distLocal.length-1][2]===0)
            distLocal[distLocal.length-1][2]=travelledSinceLast;
        }
        trackArcEnd(inter.point,inter.tgVec,polyIdx,inter.side,travelledSinceLast);
        travelledSinceLast=0;firstCycle=false;
      }
      lastExitHex=polyIdx;lastExitSide=inter.side;
      curPoint=pr.point;curTgVec=pr.tgVec;polyIdx=pr.polyIdx;toAvoid=pr.toAvoid;
      stepCount++;
      if(stepCount%2000===0){
        const pct=Math.min(100,travelledDist/maxLen*100);
        document.getElementById('progress').style.width=pct+'%';
        document.getElementById('status').textContent=`Computing... ${Math.floor(pct)}% (${toMusicLocal.length} crossings)`;
        await new Promise(r=>setTimeout(r,0));
      }
    }
  } else {
    // ===== VISUAL MODE: animated drawing =====
    // History of recent arcs for greying
    const recentArcs=[];
    const GREY_AFTER=2;

    const baseImages=[];
    for(let h=0;h<4;h++){
      const ctx=canvases[h].getContext('2d');
      baseImages.push(ctx.getImageData(0,0,canvases[h].width,canvases[h].height));
    }

    function drawCurrentArcs(skipLast){
      for(let h=0;h<4;h++){
        canvases[h].getContext('2d').putImageData(baseImages[h],0,0);
      }
      const drawCount=skipLast?recentArcs.length-1:recentArcs.length;
      for(let i=0;i<drawCount;i++){
        const arc=recentArcs[i];
        const canvas=canvases[arc.hexIdx];
        const ctx=canvas.getContext('2d');
        const w=canvas.width,ht=canvas.height;
        const cxC=w/2,cyC=ht/2,sc=w/2.3;
        const age=recentArcs.length-1-i;
        if(age>=GREY_AFTER){
          drawGeodesicSegment(ctx,cxC,cyC,sc,arc.sp,arc.ep,'rgba(160,160,160,1.0)',0.8);
        }else{
          drawGeodesicSegment(ctx,cxC,cyC,sc,arc.sp,arc.ep,'rgba(255,80,80,0.85)',1.5);
        }
      }
      const keep=GREY_AFTER+2;
      if(recentArcs.length>keep){
        for(let i=0;i<recentArcs.length-keep;i++){
          const arc=recentArcs[i];
          const canvas=canvases[arc.hexIdx];
          const ctx=canvas.getContext('2d');
          const w=canvas.width,ht=canvas.height;
          const cxC=w/2,cyC=ht/2,sc=w/2.3;
          drawGeodesicSegment(ctx,cxC,cyC,sc,arc.sp,arc.ep,'rgba(160,160,160,1.0)',0.8);
        }
        for(let h=0;h<4;h++){
          const ctx=canvases[h].getContext('2d');
          baseImages[h]=ctx.getImageData(0,0,canvases[h].width,canvases[h].height);
        }
        recentArcs.splice(0,recentArcs.length-keep);
      }
    }

    if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    const liveNotes=[440.00,554.37,659.25].map(f=>createMarimbaNote(f,1.5));
    function playNoteNow(curveIdx){
      try{const src=audioCtx.createBufferSource();src.buffer=liveNotes[curveIdx];src.connect(audioCtx.destination);src.start();}catch(e){}
    }

    const NUM_CHUNKS=7;

    while(travelledDist<maxLen){
      if(stopRequested)break;
      collectDist();
      trackArcStart();
      const inter=firstIntersection(curPoint,curTgVec,circles[polyIdx],toAvoid);
      if(!inter)break;
      const dtp=distanceTwoPoints(curPoint,inter.point);
      const arcSp=[...curPoint],arcEp=[...inter.point];
      const arcHex=polyIdx;
      travelledDist+=dtp;
      travelledSinceLast+=dtp;
      const pr=applyPairing(inter.point,inter.tgVec,polyIdx,inter.side,gluing,twists,polytopes);
      if(arcInitPt!==null)arcCrossings.push([polyIdx,inter.side,pr.polyIdx,pr.toAvoid]);
      let intersectsCurve=-1;
      for(let c=0;c<3;c++){
        if(isRow([polyIdx,inter.side],curveCombinations[c])){intersectsCurve=c;break;}
      }
      if(intersectsCurve>=0){
        if(!firstCycle){
          toMusicLocal.push([travelledSinceLast,intersectsCurve+1]);
          if(distLocal.length>0&&distLocal[distLocal.length-1][2]===0)
            distLocal[distLocal.length-1][2]=travelledSinceLast;
        }
        trackArcEnd(inter.point,inter.tgVec,polyIdx,inter.side,travelledSinceLast);
        travelledSinceLast=0;firstCycle=false;
      }
      lastExitHex=polyIdx;lastExitSide=inter.side;
      curPoint=pr.point;curTgVec=pr.tgVec;polyIdx=pr.polyIdx;toAvoid=pr.toAvoid;
      stepCount++;

      recentArcs.push({hexIdx:arcHex,sp:arcSp,ep:arcEp});
      drawCurrentArcs(true);

      const canvas=canvases[arcHex];
      const ctx=canvas.getContext('2d');
      const w=canvas.width,ht=canvas.height;
      const cxC=w/2,cyC=ht/2,sc=w/2.3;
      const chunkPauseMs=Math.max(2,(dtp/drawSpeed)*143);
      for(let ch=0;ch<NUM_CHUNKS;ch++){
        if(stopRequested)break;
        const f0=ch/NUM_CHUNKS;
        const f1=(ch+1)/NUM_CHUNKS;
        drawGeodesicSegmentPartial(ctx,cxC,cyC,sc,arcSp,arcEp,'rgba(255,80,80,0.85)',1.5,f0,f1);
        await new Promise(r=>setTimeout(r,chunkPauseMs));
      }
      if(intersectsCurve>=0)playNoteNow(intersectsCurve);
      const pct=Math.min(100,travelledDist/maxLen*100);
      document.getElementById('progress').style.width=pct+'%';
      document.getElementById('status').textContent=`Running... ${Math.floor(pct)}% (${toMusicLocal.length} crossings)`;
    }
  }

  toMusic=toMusicLocal;
  // Remove last dist point if travel time was never filled
  const distFiltered=distLocal.filter(d=>d[2]>0);
  pointsDistribution=distFiltered;
  savedArcs=arcsLocal;
  arcGeoContext={circles,gluing,polytopes,twists};
  document.getElementById('progress').style.width='100%';
  document.getElementById('status').textContent=`Done. ${toMusic.length} intersections recorded.`;
  document.getElementById('stats').innerHTML=`Crossings: ${toMusic.length}<br>Curve 1: ${toMusic.filter(x=>x[1]===1).length}<br>Curve 2: ${toMusic.filter(x=>x[1]===2).length}<br>Curve 3: ${toMusic.filter(x=>x[1]===3).length}`;
  document.getElementById('btn-dist').disabled=!pointsDistribution||pointsDistribution.length===0;
  updateArcsPanel();

  finish();
}

function finish(){
  running=false;
  document.getElementById('btn-run').disabled=false;
  document.getElementById('btn-stop').disabled=true;
  const hasData=toMusic&&toMusic.length>0;
  const hasArcs=savedArcs&&savedArcs.length>0;
  document.getElementById('btn-play').disabled=!hasData;
  document.getElementById('btn-orth').disabled=!hasData;
  document.getElementById('btn-guess-sep').disabled=!hasData;
  document.getElementById('btn-homotopy').disabled=!hasArcs;
  if(hasData){document.getElementById('orth-status').textContent='Ready. Click "Estimate Next Element".';}
  if(hasArcs){document.getElementById('homotopy-status').textContent='Ready. Click "Compute Orthospectrum".';}
}

function stopComputation(){
  stopRequested=true;
}

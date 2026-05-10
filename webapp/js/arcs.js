"use strict";

// ===== Saved Arcs =====
function setArcFilterPerp(){
  document.getElementById('arc-save-iamin').value='1.54';
  document.getElementById('arc-save-iamax').value='1.60';
  document.getElementById('arc-save-famin').value='1.54';
  document.getElementById('arc-save-famax').value='1.60';
  document.getElementById('arc-draw-iamin').value='1.54';
  document.getElementById('arc-draw-iamax').value='1.60';
  document.getElementById('arc-draw-famin').value='1.54';
  document.getElementById('arc-draw-famax').value='1.60';
}

let arcsSortKey='idx',arcsSortAsc=true;
let arcsSortedIndices=null; // maps display row → savedArcs index
let arcsFilterActive=false;

function sortArcsTable(key){
  if(arcsSortKey===key)arcsSortAsc=!arcsSortAsc;
  else{arcsSortKey=key;arcsSortAsc=true;}
  updateArcsPanel();
}

function getArcTableFilter(){
  const lMin=parseFloat(document.getElementById('arc-draw-lmin').value)||0;
  const lMax=parseFloat(document.getElementById('arc-draw-lmax').value);
  if(isNaN(lMax))return{lMin,lMax:Infinity,iaMin:0,iaMax:Math.PI,faMin:0,faMax:Math.PI};
  const iaMin=parseFloat(document.getElementById('arc-draw-iamin').value)||0;
  const iaMax=parseFloat(document.getElementById('arc-draw-iamax').value)||Math.PI;
  const faMin=parseFloat(document.getElementById('arc-draw-famin').value)||0;
  const faMax=parseFloat(document.getElementById('arc-draw-famax').value)||Math.PI;
  return{lMin,lMax,iaMin,iaMax,faMin,faMax};
}

function filterArcsTable(){
  arcsFilterActive=true;
  updateArcsPanel();
}

function resetArcsFilter(){
  arcsFilterActive=false;
  updateArcsPanel();
}

function drawFilteredArcsOnMain(){
  if(!savedArcs||!arcGeoContext||!arcsSortedIndices)return;
  const canvases=[0,1,2,3].map(i=>document.getElementById('c'+i));
  drawHexagons(canvases,arcGeoContext.polytopes,arcGeoContext.gluing);
  const max=50;let drawn=0;
  for(let row=0;row<arcsSortedIndices.length&&drawn<max;row++){
    const k=arcsSortedIndices[row];
    const col=ARC_COLORS[drawn%ARC_COLORS.length];
    drawArcOnCanvases(k,canvases,col,2.0);
    drawn++;
  }
  document.getElementById('arcs-status').textContent=`${drawn} arcs drawn on main view.`;
}

function updateArcsPanel(){
  if(!savedArcs||savedArcs.length===0){
    document.getElementById('arcs-panel').style.display='none';return;
  }
  document.getElementById('arcs-panel').style.display='';

  // Build filtered + sorted index array
  let indices=[...Array(savedArcs.length).keys()];
  if(arcsFilterActive){
    const f=getArcTableFilter();
    indices=indices.filter(i=>{
      const a=savedArcs[i];
      return a.length>=f.lMin&&a.length<f.lMax&&
        a.initAngle>=f.iaMin&&a.initAngle<=f.iaMax&&
        a.finalAngle>=f.faMin&&a.finalAngle<=f.faMax;
    });
  }

  // One per class filter: keep only the shortest arc per homotopy class
  const onePerClass=document.getElementById('arcs-one-per-class').checked;
  if(onePerClass){
    const seenClasses=new Set();
    // Sort by length first to pick shortest
    const byLen=[...indices].sort((a,b)=>savedArcs[a].length-savedArcs[b].length);
    const kept=[];
    for(const i of byLen){
      const cls=savedArcs[i].classIdx;
      if(cls===undefined){kept.push(i);continue;} // no class assigned yet, keep
      if(!seenClasses.has(cls)){seenClasses.add(cls);kept.push(i);}
    }
    indices=kept;
  }

  const key=arcsSortKey;
  indices.sort((a,b)=>{
    let va,vb;
    if(key==='idx'){va=a;vb=b;}
    else if(key==='classIdx'){va=savedArcs[a].classIdx||0;vb=savedArcs[b].classIdx||0;}
    else{va=savedArcs[a][key];vb=savedArcs[b][key];}
    return arcsSortAsc?va-vb:vb-va;
  });
  arcsSortedIndices=indices;

  const tbody=document.getElementById('arcs-table').querySelector('tbody');
  tbody.innerHTML='';
  for(let row=0;row<indices.length;row++){
    const i=indices[row];
    const a=savedArcs[i];
    const cls=a.classIdx!==undefined?a.classIdx:'–';
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i+1}</td><td>${a.length.toFixed(4)}</td><td>${a.initAngle.toFixed(3)}</td><td>${a.finalAngle.toFixed(3)}</td><td>${a.polyIdx+1}</td><td>${cls}</td>`;
    const arcIdx=i;
    tr.addEventListener('click',()=>drawArcOnMini(arcIdx,row));
    tbody.appendChild(tr);
  }
  let filterMsg='';
  if(arcsFilterActive)filterMsg+=` (filtered)`;
  if(onePerClass)filterMsg+=` (one per class)`;
  const shownCount=indices.length;
  document.getElementById('arcs-status').textContent=`${shownCount} of ${savedArcs.length} arcs shown${filterMsg}. Sorted by ${key} ${arcsSortAsc?'↑':'↓'}`;

  // Clear mini canvases
  clearMiniCanvases();
}

const ARC_COLORS=['#0073bd','#d95319','#77ac30','#7e2f8e','#edb120','#4dbeee'];

function clearMiniCanvases(){
  if(!arcGeoContext)return;
  const miniC=[0,1,2,3].map(i=>document.getElementById('arc-c'+i));
  drawHexagons(miniC,arcGeoContext.polytopes,arcGeoContext.gluing);
}

function drawArcOnCanvases(arcIdx,canvases,col,lw){
  if(!savedArcs||!arcGeoContext)return;
  const ctx0=arcGeoContext;
  const arc=savedArcs[arcIdx];
  let pt=[arc.px,arc.py],tv=[arc.tx,arc.ty];
  let pi=arc.polyIdx,ta=arc.toAvoid;
  let accum=0;const limit=arc.length-1e-12;let steps=0;
  while(accum<limit&&steps<10000){
    const inter=firstIntersection(pt,tv,ctx0.circles[pi],ta);
    if(!inter)break;
    const dtp=distanceTwoPoints(pt,inter.point);
    const canvas=canvases[pi];
    const c2d=canvas.getContext('2d');
    const w=canvas.width,ht=canvas.height;
    drawGeodesicSegment(c2d,w/2,ht/2,w/2.3,pt,inter.point,col,lw);
    accum+=dtp;
    const pr=applyPairing(inter.point,inter.tgVec,pi,inter.side,ctx0.gluing,ctx0.twists,ctx0.polytopes);
    pt=pr.point;tv=pr.tgVec;pi=pr.polyIdx;ta=pr.toAvoid;
    steps++;
  }
}

function drawArcOnMini(arcIdx,rowIdx){
  if(!arcGeoContext)return;
  const miniC=[0,1,2,3].map(i=>document.getElementById('arc-c'+i));
  drawHexagons(miniC,arcGeoContext.polytopes,arcGeoContext.gluing);
  drawArcOnCanvases(arcIdx,miniC,'#ff4444',2.0);

  // Highlight row
  const rows=document.getElementById('arcs-table').querySelectorAll('tbody tr');
  rows.forEach((r,i)=>r.classList.toggle('selected',i===rowIdx));

  const a=savedArcs[arcIdx];
  document.getElementById('arcs-status').textContent=
    `Arc ${arcIdx+1}: length=${a.length.toFixed(4)}, init∠=${a.initAngle.toFixed(3)}, final∠=${a.finalAngle.toFixed(3)}, hex=${a.polyIdx+1}`;
}

function drawSavedArcs(singleStart,singleEnd){
  if(!savedArcs||!arcGeoContext)return;
  const ctx0=arcGeoContext;
  const canvases=[0,1,2,3].map(i=>document.getElementById('c'+i));

  // Redraw hexagons as base
  drawHexagons(canvases,ctx0.polytopes,ctx0.gluing);

  // Apply draw filters
  const lMin=parseFloat(document.getElementById('arc-draw-lmin').value)||0;
  const lMax=parseFloat(document.getElementById('arc-draw-lmax').value)||Infinity;
  const iaMin=parseFloat(document.getElementById('arc-draw-iamin').value)||0;
  const iaMax=parseFloat(document.getElementById('arc-draw-iamax').value)||Math.PI;
  const faMin=parseFloat(document.getElementById('arc-draw-famin').value)||0;
  const faMax=parseFloat(document.getElementById('arc-draw-famax').value)||Math.PI;
  const maxDraw=parseInt(document.getElementById('arc-draw-max').value)||50;

  let drawn=0;
  const startIdx=singleStart!==undefined?singleStart:0;
  const endIdx=singleEnd!==undefined?singleEnd:savedArcs.length-1;

  // Highlight selected row
  const rows=document.getElementById('arcs-table').querySelectorAll('tbody tr');
  rows.forEach((r,i)=>r.classList.toggle('selected',singleStart!==undefined&&i===singleStart));

  for(let k=startIdx;k<=endIdx;k++){
    if(drawn>=maxDraw)break;
    const arc=savedArcs[k];
    if(arc.length<lMin||arc.length>=lMax)continue;
    if(arc.initAngle<iaMin||arc.initAngle>iaMax)continue;
    if(arc.finalAngle<faMin||arc.finalAngle>faMax)continue;

    const col=ARC_COLORS[drawn%ARC_COLORS.length];
    drawArcOnCanvases(k,canvases,col,2.0);
    drawn++;
  }
  document.getElementById('arcs-status').textContent=singleStart!==undefined?
    `Arc ${singleStart+1}: length=${savedArcs[singleStart].length.toFixed(4)}`:`${drawn} arcs drawn.`;
}

function clearDrawnArcs(){
  if(!arcGeoContext)return;
  const canvases=[0,1,2,3].map(i=>document.getElementById('c'+i));
  drawHexagons(canvases,arcGeoContext.polytopes,arcGeoContext.gluing);
  document.getElementById('arcs-status').textContent='Cleared.';
  document.getElementById('arcs-table').querySelectorAll('tbody tr').forEach(r=>r.classList.remove('selected'));
}

// ===== Mini canvas zoom/pan =====
(function(){
  const el=document.getElementById('arc-mini-container');
  let scale=1,tx=0,ty=0,dragging=false,sx=0,sy=0,stx=0,sty=0;
  function apply(){el.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;}
  el.addEventListener('wheel',e=>{
    e.preventDefault();
    const rect=el.getBoundingClientRect();
    const mx=e.clientX-rect.left-rect.width/2;
    const my=e.clientY-rect.top-rect.height/2;
    const oldS=scale;
    scale*=e.deltaY<0?1.15:1/1.15;
    scale=Math.max(0.5,Math.min(10,scale));
    const ratio=scale/oldS;
    tx=mx-(mx-tx)*ratio;
    ty=my-(my-ty)*ratio;
    apply();
  },{passive:false});
  el.addEventListener('mousedown',e=>{dragging=true;sx=e.clientX;sy=e.clientY;stx=tx;sty=ty;e.preventDefault();});
  window.addEventListener('mousemove',e=>{if(!dragging)return;tx=stx+e.clientX-sx;ty=sty+e.clientY-sy;apply();});
  window.addEventListener('mouseup',()=>{dragging=false;});
  el.addEventListener('dblclick',()=>{scale=1;tx=0;ty=0;apply();});
})();

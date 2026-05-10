"use strict";

// ===== Drawing =====
// Styles: [color, dashed, lineWidth] — indices 0-5 dashed, 6-8 solid (matching MATLAB)
const STYLE_DEFS=[
  {color:'#e44',dashed:true,lw:2.5},   // 0: Red
  {color:'#4a4',dashed:true,lw:2.5},   // 1: Green
  {color:'#44e',dashed:true,lw:2.5},   // 2: Blue
  {color:'#d4d',dashed:true,lw:2.5},   // 3: Magenta
  {color:'#0cc',dashed:true,lw:2.5},   // 4: Cyan
  {color:'#fa0',dashed:true,lw:2.5},   // 5: Orange
  {color:'#806',dashed:false,lw:3.0},  // 6: Purple
  {color:'#333',dashed:false,lw:3.0},  // 7: Dark Grey
  {color:'#964',dashed:false,lw:3.0},  // 8: Brown
];

function drawHexagons(canvases,polytopes,gluing){
  for(let h=0;h<4;h++){
    const canvas=canvases[h];
    const ctx=canvas.getContext('2d');
    const w=canvas.width,ht=canvas.height;
    ctx.clearRect(0,0,w,ht);

    const cx=w/2,cy=ht/2,sc=w/2.3;

    // Draw disk
    ctx.beginPath();
    ctx.arc(cx,cy,sc,0,2*Math.PI);
    ctx.strokeStyle='#555';
    ctx.lineWidth=1.5;
    ctx.stroke();

    // Draw hexagon sides
    for(let s=0;s<6;s++){
      const s2=(s+1)%6;
      const sp=polytopes[h][s],ep=polytopes[h][s2];
      const gc=geodesicCircumferenceFromSegment(sp,ep);
      const sty=STYLE_DEFS[gluing.styleLookup[h][s]];
      drawArc(ctx,cx,cy,sc,sp,ep,gc,sty.color,sty.lw,sty.dashed);
    }

    // Label
    ctx.fillStyle='#888';
    ctx.font='12px sans-serif';
    ctx.fillText('Hex '+(h+1),6,14);
  }
}

function drawArc(ctx,cx,cy,sc,sp,ep,gc,color,lineWidth,dashed){
  const c=gc.center,r=gc.radius;
  let a1=Math.atan2(sp[1]-c[1],sp[0]-c[0]);
  let a2=Math.atan2(ep[1]-c[1],ep[0]-c[0]);
  if(Math.abs(a1-a2)>Math.PI){
    if(a2>a1)a2-=2*Math.PI;else a1-=2*Math.PI;
  }

  ctx.beginPath();
  if(dashed)ctx.setLineDash([6,4]);else ctx.setLineDash([]);
  ctx.strokeStyle=color;
  ctx.lineWidth=lineWidth;

  const nPts=100;
  for(let i=0;i<=nPts;i++){
    const t=a1+(a2-a1)*i/nPts;
    const x=cx+(c[0]+r*Math.cos(t))*sc;
    const y=cy-(c[1]+r*Math.sin(t))*sc;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGeodesicSegment(ctx,cx,cy,sc,sp,ep,color,lineWidth){
  const gc=geodesicCircumferenceFromSegment(sp,ep);
  drawArc(ctx,cx,cy,sc,sp,ep,gc,color,lineWidth,false);
}

// Draw a fraction of a geodesic arc: from fractStart to fractEnd in [0,1]
function drawGeodesicSegmentPartial(ctx,cx,cy,sc,sp,ep,color,lineWidth,fractStart,fractEnd){
  const gc=geodesicCircumferenceFromSegment(sp,ep);
  const c=gc.center,r=gc.radius;
  let a1=Math.atan2(sp[1]-c[1],sp[0]-c[0]);
  let a2=Math.atan2(ep[1]-c[1],ep[0]-c[0]);
  if(Math.abs(a1-a2)>Math.PI){
    if(a2>a1)a2-=2*Math.PI;else a1-=2*Math.PI;
  }
  const angStart=a1+(a2-a1)*fractStart;
  const angEnd=a1+(a2-a1)*fractEnd;

  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.strokeStyle=color;
  ctx.lineWidth=lineWidth;
  const nPts=Math.max(10,Math.round(100*(fractEnd-fractStart)));
  for(let i=0;i<=nPts;i++){
    const t=angStart+(angEnd-angStart)*i/nPts;
    const x=cx+(c[0]+r*Math.cos(t))*sc;
    const y=cy-(c[1]+r*Math.sin(t))*sc;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.stroke();
}

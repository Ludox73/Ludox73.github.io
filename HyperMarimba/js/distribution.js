"use strict";

// ===== Distribution scatter plot (canvas-based for performance) =====
function drawDistribution(){
  if(!pointsDistribution||pointsDistribution.length===0)return;
  const maxPts=parseInt(document.getElementById('dist-max-pts').value)||100000;
  const D=pointsDistribution.length>maxPts?pointsDistribution.slice(0,maxPts):pointsDistribution;
  const canvas=document.getElementById('dist-canvas');
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;
  const pad={l:70,r:80,t:40,b:50};
  const pw=W-pad.l-pad.r,ph=H-pad.t-pad.b;

  const xMax=Math.max(...D.map(d=>d[0]));
  const yMin=-Math.PI,yMax=Math.PI;
  const tx=v=>pad.l+v/xMax*pw;
  const ty=v=>pad.t+(1-(v-yMin)/(yMax-yMin))*ph;

  // Log color scale
  const times=D.map(d=>d[2]).filter(t=>t>0);
  const logMin=Math.log10(Math.min(...times));
  const logMax=Math.log10(Math.max(...times));

  function rgbFromLog(t){
    if(t<=0)return[34,34,34];
    const frac=Math.max(0,Math.min(1,(Math.log10(t)-logMin)/(logMax-logMin||1)));
    return[
      Math.round(255*Math.min(1,Math.max(0,1.5*frac-0.5))),
      Math.round(255*Math.min(1,Math.max(0,frac<0.5?2*frac:1))),
      Math.round(255*Math.max(0,1-1.5*frac))
    ];
  }

  // Background
  ctx.fillStyle='#0a0a1a';ctx.fillRect(0,0,W,H);

  // Grid lines
  ctx.strokeStyle='#1a2a4a';ctx.lineWidth=1;
  const xStep=Math.pow(10,Math.floor(Math.log10(xMax)))/2;
  for(let gx=xStep;gx<=xMax;gx+=xStep){
    ctx.beginPath();ctx.moveTo(tx(gx),pad.t);ctx.lineTo(tx(gx),pad.t+ph);ctx.stroke();
  }
  for(let gy=-3;gy<=3;gy++){
    if(gy<yMin||gy>yMax)continue;
    ctx.beginPath();ctx.moveTo(pad.l,ty(gy));ctx.lineTo(pad.l+pw,ty(gy));ctx.stroke();
  }

  // Scatter points via ImageData for maximum speed
  const imgData=ctx.getImageData(0,0,W,H);
  const px=imgData.data;
  for(let i=0;i<D.length;i++){
    const d=D[i];
    const sx=Math.round(tx(d[0]));
    const sy=Math.round(ty(d[1]));
    if(sx<pad.l||sx>=pad.l+pw||sy<pad.t||sy>=pad.t+ph)continue;
    const rgb=rgbFromLog(d[2]);
    // Draw a 2x2 pixel dot
    for(let dy=-1;dy<=1;dy++){
      for(let dx=-1;dx<=1;dx++){
        const px2=sx+dx,py2=sy+dy;
        if(px2>=0&&px2<W&&py2>=0&&py2<H){
          const off=(py2*W+px2)*4;
          px[off]=rgb[0];px[off+1]=rgb[1];px[off+2]=rgb[2];px[off+3]=255;
        }
      }
    }
  }
  ctx.putImageData(imgData,0,0);

  // Axis labels (drawn after scatter so they're on top)
  ctx.fillStyle='#888';ctx.font='16px sans-serif';ctx.textAlign='center';
  for(let gx=0;gx<=xMax;gx+=xStep){
    ctx.fillText(gx.toFixed(1),tx(gx),pad.t+ph+22);
  }
  ctx.textAlign='right';
  for(let gy=-3;gy<=3;gy++){
    if(gy<yMin||gy>yMax)continue;
    ctx.fillText(gy.toFixed(1),pad.l-6,ty(gy)+5);
  }

  // Colorbar
  const cbX=W-pad.r+16,cbW=18,cbH=ph;
  for(let i=0;i<cbH;i++){
    const frac=1-i/cbH;
    const t=Math.pow(10,logMin+(logMax-logMin)*frac);
    const rgb=rgbFromLog(t);
    ctx.fillStyle=`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    ctx.fillRect(cbX,pad.t+i,cbW,1);
  }
  ctx.strokeStyle='#555';ctx.lineWidth=1;ctx.strokeRect(cbX,pad.t,cbW,cbH);
  ctx.fillStyle='#888';ctx.font='14px sans-serif';ctx.textAlign='left';
  const nLabels=5;
  for(let i=0;i<=nLabels;i++){
    const frac=1-i/nLabels;
    const val=Math.pow(10,logMin+(logMax-logMin)*frac);
    ctx.fillText(val.toFixed(1),cbX+cbW+4,pad.t+i/nLabels*cbH+5);
  }

  // Title and axis labels
  ctx.fillStyle='#c9a96e';ctx.font='18px sans-serif';ctx.textAlign='left';
  ctx.fillText(`Intersection Distribution (${D.length} points)`,pad.l,pad.t-14);
  ctx.fillStyle='#888';ctx.font='16px sans-serif';ctx.textAlign='center';
  ctx.fillText('Position on curve 1',pad.l+pw/2,H-8);
  ctx.save();ctx.translate(16,pad.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText('Angle',0,0);ctx.restore();

  const distPanel=document.getElementById('dist-panel');
  if(distPanel)distPanel.style.display='';
  const capped=pointsDistribution.length>D.length?` (${pointsDistribution.length} total, showing first ${D.length})`:'';
  document.getElementById('dist-status').textContent=`${D.length} points plotted${capped}. Color = travel time (log scale).`;
  drawThetaDistribution(D);
}

function drawThetaDistribution(D){
  const canvas=document.getElementById('dist-theta-canvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;
  const pad={l:60,r:70,t:40,b:50};
  const pw=W-pad.l-pad.r,ph=H-pad.t-pad.b;

  const tMin=-Math.PI,tMax=Math.PI;
  const nBins=80;
  const binW=(tMax-tMin)/nBins;

  // Build histogram
  const counts=new Array(nBins).fill(0);
  const n=D.length;
  for(let i=0;i<n;i++){
    const b=Math.floor((D[i][1]-tMin)/binW);
    if(b>=0&&b<nBins)counts[b]++;
  }

  // CDF from cumulative histogram (at bin edges)
  const cumsum=new Array(nBins+1).fill(0);
  for(let i=0;i<nBins;i++)cumsum[i+1]=cumsum[i]+counts[i];
  const cdfXpts=Array.from({length:nBins+1},(_,i)=>tMin+i*binW);
  const cdfFpts=cumsum.map(c=>c/n);

  // PDF density
  const density=counts.map(c=>c/(n*binW));
  const pdfMax=Math.max(...density,1e-10);

  const tx=v=>pad.l+(v-tMin)/(tMax-tMin)*pw;
  const tyCdf=v=>pad.t+(1-v)*ph;
  const tyPdf=v=>pad.t+(1-v/pdfMax)*ph;

  // Background
  ctx.fillStyle='#0a0a1a';ctx.fillRect(0,0,W,H);

  // Grid lines
  ctx.strokeStyle='#1a2a4a';ctx.lineWidth=1;
  for(const gx of[-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI]){
    ctx.beginPath();ctx.moveTo(tx(gx),pad.t);ctx.lineTo(tx(gx),pad.t+ph);ctx.stroke();
  }
  for(let gy=0;gy<=1.01;gy+=0.2){
    ctx.beginPath();ctx.moveTo(pad.l,tyCdf(gy));ctx.lineTo(pad.l+pw,tyCdf(gy));ctx.stroke();
  }

  // PDF: filled bars + polyline
  ctx.fillStyle='rgba(255,136,68,0.2)';
  for(let i=0;i<nBins;i++){
    const x0=tx(tMin+i*binW),x1=tx(tMin+(i+1)*binW);
    const y0=tyPdf(density[i]);
    ctx.fillRect(x0,y0,x1-x0,pad.t+ph-y0);
  }
  ctx.strokeStyle='#ff8844';ctx.lineWidth=2;
  ctx.beginPath();
  for(let i=0;i<nBins;i++){
    const x=tx(tMin+(i+0.5)*binW),y=tyPdf(density[i]);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.stroke();

  // CDF: step function
  ctx.strokeStyle='#4488ff';ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(tx(tMin),tyCdf(0));
  for(let i=0;i<=nBins;i++){
    const x=tx(cdfXpts[i]),y=tyCdf(cdfFpts[i]);
    ctx.lineTo(x,y);
    if(i<nBins)ctx.lineTo(tx(cdfXpts[i+1]),y);
  }
  ctx.stroke();

  // X-axis labels
  ctx.fillStyle='#888';ctx.font='14px sans-serif';ctx.textAlign='center';
  for(const[v,lbl] of[[-Math.PI,'-π'],[-Math.PI/2,'-π/2'],[0,'0'],[Math.PI/2,'π/2'],[Math.PI,'π']])
    ctx.fillText(lbl,tx(v),pad.t+ph+20);

  // Left axis (CDF)
  ctx.textAlign='right';ctx.fillStyle='#4488ff';
  for(let gy=0;gy<=1.01;gy+=0.2)ctx.fillText(gy.toFixed(1),pad.l-6,tyCdf(gy)+5);

  // Right axis (PDF)
  ctx.textAlign='left';ctx.fillStyle='#ff8844';
  for(let i=0;i<=5;i++){
    const v=i/5*pdfMax;
    ctx.fillText(v.toFixed(2),pad.l+pw+6,tyPdf(v)+5);
  }

  // Axis titles
  ctx.fillStyle='#c9a96e';ctx.font='15px sans-serif';ctx.textAlign='left';
  ctx.fillText(`Angle θ distribution  (${n} points)`,pad.l,pad.t-14);
  ctx.fillStyle='#888';ctx.font='13px sans-serif';ctx.textAlign='center';
  ctx.fillText('θ',pad.l+pw/2,H-8);
  ctx.save();ctx.fillStyle='#4488ff';ctx.translate(14,pad.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText('CDF',0,0);ctx.restore();
  ctx.save();ctx.fillStyle='#ff8844';ctx.translate(W-14,pad.t+ph/2);ctx.rotate(Math.PI/2);ctx.fillText('density',0,0);ctx.restore();

  // Legend
  ctx.fillStyle='#4488ff';ctx.fillRect(pad.l,pad.t+8,18,3);
  ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillStyle='#4488ff';ctx.fillText('CDF',pad.l+22,pad.t+13);
  ctx.fillStyle='#ff8844';ctx.fillRect(pad.l+65,pad.t+8,18,3);
  ctx.fillStyle='#ff8844';ctx.fillText('PDF',pad.l+87,pad.t+13);
}

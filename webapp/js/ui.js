"use strict";

// ===== UI wiring =====
const sliderConfigs={
  l1:{display:'v-l1',fmt:v=>v.toFixed(2)},
  l2:{display:'v-l2',fmt:v=>v.toFixed(2)},
  l3:{display:'v-l3',fmt:v=>v.toFixed(2)},
  t1:{display:'v-t1',fmt:v=>Math.round(v)+'%'},
  t2:{display:'v-t2',fmt:v=>Math.round(v)+'%'},
  t3:{display:'v-t3',fmt:v=>Math.round(v)+'%'},
  maxlen:{display:'v-maxlen',fmt:v=>maxlenFmt(v)},
  speed:{display:'v-speed',fmt:v=>v.toFixed(1)},
  audiospeed:{display:'v-audiospeed',fmt:v=>v.toFixed(1)},
  maxdur:{display:'v-maxdur',fmt:v=>Math.round(v).toString()},
};
for(const[id,cfg] of Object.entries(sliderConfigs)){
  const el=document.getElementById(id);
  el.addEventListener('input',()=>{
    document.getElementById(cfg.display).textContent=cfg.fmt(parseFloat(el.value));
  });
}

// SVG zoom (scroll) and pan (drag) — reusable for any SVG
function setupSvgZoomPan(svgEl){
  const vbAttr=svgEl.getAttribute('viewBox').split(' ').map(Number);
  let vb={x:vbAttr[0],y:vbAttr[1],w:vbAttr[2],h:vbAttr[3]};
  const orig={...vb};
  const obs=new MutationObserver(()=>{vb={...orig};svgEl.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);});
  obs.observe(svgEl,{childList:true});
  function sp(e){const r=svgEl.getBoundingClientRect();return{sx:vb.x+(e.clientX-r.left)/r.width*vb.w,sy:vb.y+(e.clientY-r.top)/r.height*vb.h};}
  svgEl.addEventListener('wheel',e=>{
    e.preventDefault();const p=sp(e);const s=e.deltaY>0?1.15:1/1.15;
    vb.x=p.sx-(p.sx-vb.x)*s;vb.y=p.sy-(p.sy-vb.y)*s;vb.w*=s;vb.h*=s;
    svgEl.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  },{passive:false});
  let drag=false,ds={x:0,y:0},vs={x:0,y:0};
  svgEl.addEventListener('mousedown',e=>{drag=true;ds={x:e.clientX,y:e.clientY};vs={x:vb.x,y:vb.y};svgEl.style.cursor='grabbing';});
  window.addEventListener('mousemove',e=>{if(!drag)return;const r=svgEl.getBoundingClientRect();vb.x=vs.x-(e.clientX-ds.x)/r.width*vb.w;vb.y=vs.y-(e.clientY-ds.y)/r.height*vb.h;svgEl.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);});
  window.addEventListener('mouseup',()=>{if(drag){drag=false;svgEl.style.cursor='';}});
  svgEl.addEventListener('dblclick',()=>{vb={...orig};svgEl.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);});
}
setupSvgZoomPan(document.getElementById('cdf-svg'));

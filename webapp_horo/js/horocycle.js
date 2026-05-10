"use strict";

// ============================================================
// Horocyclic flow on a genus-2 hyperbolic surface.
//
// State: (curPoint, curXi, travelDir)
//   curPoint  — current point in the Poincaré disk
//   curXi     — ideal point ξ ∈ S¹ of the current horocycle (tracked explicitly)
//   travelDir — interior travel direction on the horocycle: +1 = CCW, -1 = CW
//
// After each boundary crossing:
//   1. Apply applyPairing (geodesic.js) to get the new point & tangent.
//   2. Apply the pairing isometry M to curXi:  ξ₁ = M(ξ).
//   3. For orientation-reversing (non-coherent) pairings, additionally apply the
//      boundary reflection: ξ₂ = C⁻¹(isoR(C(ξ₁))), where C is the Cayley map
//      and isoR is the reflection across the target-side geodesic.
//   4. Flip travelDir for orientation-reversing pairings (orientation reversal
//      swaps the interior direction of the horocyclic flow).
// ============================================================

// ─── Boundary-reflection helper ──────────────────────────────────────────────

// Apply the orientation-reversing boundary reflection to ξ ∈ S¹.
// p1, p2 are the Poincaré-disk vertices of the target hexagon side.
// This mirrors the non-coherent branch of applyPairing (geodesic.js).
function applyXiReflection(xi, p1, p2) {
  // Step 1: Cayley map S¹ → ℝ:  η = i·(1+ξ)/(1−ξ)  (real for ξ ∈ S¹)
  const denom = csub([1, 0], xi);
  if (Math.abs(denom[0]) < 1e-10 && Math.abs(denom[1]) < 1e-10) return xi; // ξ ≈ 1
  const eta_c = cdiv(cmul([0, 1], cadd([1, 0], xi)), denom);
  const eta1 = eta_c[0]; // imaginary part ≈ 0 for ξ ∈ S¹

  // Step 2: Build the boundary-geodesic reflection matrix (same as applyPairing)
  const z1 = poincareToUpperHalf([p1[0], p1[1]]);
  const z2 = poincareToUpperHalf([p2[0], p2[1]]);
  const x1 = z1[0], y1 = z1[1], x2 = z2[0], y2 = z2[1];
  const c_uh = (x1*x1+y1*y1-x2*x2-y2*y2) / (2*(x1-x2));
  const r_uh = Math.sqrt((x1-c_uh)**2 + y1*y1);
  const Mreal = [[1, -(c_uh-r_uh)], [1, -(c_uh+r_uh)]];
  const J     = [[-1, 0], [0, 1]];
  const isoR  = mat2mul(mat2inv(Mreal), mat2mul(J, Mreal));

  // Step 3: Apply isoR to η₁ as a real Möbius map
  const d = isoR[1][0]*eta1 + isoR[1][1];
  if (Math.abs(d) < 1e-12) return xi;
  const eta2 = (isoR[0][0]*eta1 + isoR[0][1]) / d;

  // Step 4: Inverse Cayley  ℝ → S¹:  ξ = (η−i)/(η+i)
  const xi2 = cdiv(csub([eta2, 0], [0, 1]), cadd([eta2, 0], [0, 1]));
  const n = Math.sqrt(xi2[0]*xi2[0] + xi2[1]*xi2[1]);
  if (n < 1e-12) return [1, 0];
  return [xi2[0]/n, xi2[1]/n];
}

// Apply the full pairing isometry to ξ.
//   pairing   — result of pairingFromGluing (has .iso.poincare, .outHex, .outSide)
//   isNC      — true if the pairing is orientation-reversing
//   polytopes — all hexagon vertex arrays
function updateXi(xi, pairing, isNC, polytopes) {
  // Orientation-preserving part: ξ₁ = M(ξ) as a Möbius map
  const xi1 = matApply(pairing.iso.poincare, xi);
  const n1 = Math.sqrt(xi1[0]*xi1[0] + xi1[1]*xi1[1]);
  const xi1n = n1 < 1e-12 ? [1, 0] : [xi1[0]/n1, xi1[1]/n1];

  if (!isNC) return xi1n;

  // Orientation-reversing part: boundary reflection
  const s  = pairing.outSide;
  const p1 = polytopes[pairing.outHex][s];
  const p2 = polytopes[pairing.outHex][(s+1) % 6];
  return applyXiReflection(xi1n, p1, p2);
}

// ─── Horocyclic arc length ────────────────────────────────────────────────────

// Hyperbolic arc length along the horocycle (with ideal point xi) from p to q.
//
// Derivation (Poincaré disk → upper half-plane):
//   A horocycle with ideal point ξ ∈ S¹ and Euclidean radius r has center (1-r)ξ.
//   Under the Cayley map the horocycle maps to a horizontal line at height c = (1-r)/r.
//   The horizontal UHP coordinate of a disk point w on the horocycle is
//       t(w) = −Im(w·ξ̄) / [r·(1 − w⊙ξ)]
//   and arc length dL = |dt|/c.  Combining:
//       L = |f(p) − f(q)| / (1−r)
//   where f(w) = Im(w·ξ̄)/(1 − w⊙ξ)  and  1−r = (1−|p|²)/(2(1−p⊙ξ)).
//
// Note: distanceTwoPoints gives the geodesic (chord) distance — always shorter.
function horocycleArcLength(p, q, xi) {
  const dot_p  = p[0]*xi[0] + p[1]*xi[1];   // p⊙ξ
  const dot_q  = q[0]*xi[0] + q[1]*xi[1];   // q⊙ξ
  const cross_p = p[1]*xi[0] - p[0]*xi[1];  // Im(p·ξ̄)
  const cross_q = q[1]*xi[0] - q[0]*xi[1];  // Im(q·ξ̄)
  const d_p = 1 - dot_p, d_q = 1 - dot_q;
  if (Math.abs(d_p) < 1e-14 || Math.abs(d_q) < 1e-14) return 0;
  const f_p = cross_p / d_p;
  const f_q = cross_q / d_q;
  const one_minus_r = (1 - p[0]*p[0] - p[1]*p[1]) / (2*d_p);
  if (one_minus_r < 1e-14) return 0;
  return Math.abs(f_p - f_q) / one_minus_r;
}

// ─── Arc-constraint helper ────────────────────────────────────────────────────

// True if p (on circle centred at c) lies on the SHORTER arc from v1 to v2.
// Geodesic arcs in the Poincaré disk always span < π, so the shorter arc
// is always the correct hexagon side.
function isOnArc(p, v1, v2, c) {
  const θp  = Math.atan2(p[1] -c[1], p[0] -c[0]);
  const θv1 = Math.atan2(v1[1]-c[1], v1[0]-c[0]);
  const θv2 = Math.atan2(v2[1]-c[1], v2[0]-c[0]);
  let d12 = θv2 - θv1;
  while (d12 <= -Math.PI) d12 += 2*Math.PI;
  while (d12 >   Math.PI) d12 -= 2*Math.PI;
  let dp = θp - θv1;
  while (dp <= -Math.PI) dp += 2*Math.PI;
  while (dp >   Math.PI) dp -= 2*Math.PI;
  const eps = 1e-6;
  return d12 >= 0 ? (dp >= -eps && dp <= d12+eps)
                  : (dp <=  eps && dp >= d12-eps);
}

// ─── Core horocycle geometry ──────────────────────────────────────────────────

// Horocycle (Euclidean centre, radius) through p with ideal point ξ.
function horocycleFromPtXi(p, xi) {
  const dot = p[0]*xi[0] + p[1]*xi[1];
  const p2  = p[0]*p[0]  + p[1]*p[1];
  const den = 2*(1 - dot);
  if (Math.abs(den) < 1e-12) return { center: xi.slice(), radius: 1e-8 };
  const r = (p2 + 1 - 2*dot) / den;
  return { center: [(1-r)*xi[0], (1-r)*xi[1]], radius: Math.abs(r) };
}

// Compute ξ from a tangent vector (used only for the initial state).
// Convention: 90° CCW rotation of t gives the geodesic direction toward ξ.
function xiFromTangent(p, t) {
  const geoDir = [-t[1], t[0]];
  const tn = Math.sqrt(geoDir[0]**2 + geoDir[1]**2);
  if (tn < 1e-12) return [1, 0];
  const gc = geodesicCircumferenceFromPtv(p, geoDir);
  if (!isFinite(gc.radius) || gc.radius > 1e8) return [geoDir[0]/tn, geoDir[1]/tn];
  const c = gc.center, cm2 = c[0]**2 + c[1]**2;
  if (cm2 <= 1+1e-10) { const cm=Math.sqrt(Math.max(cm2,1e-14)); return [c[0]/cm,c[1]/cm]; }
  const cm=Math.sqrt(cm2), h=Math.sqrt(1-1/cm2), perp=[-c[1]/cm,c[0]/cm];
  const xi1=[c[0]/cm2+h*perp[0],c[1]/cm2+h*perp[1]];
  const xi2=[c[0]/cm2-h*perp[0],c[1]/cm2-h*perp[1]];
  const det=(p[0]-c[0])*geoDir[1]-(p[1]-c[1])*geoDir[0];
  const goCW=det<=0;
  const a1=angleCW2D([p[0]-c[0],p[1]-c[1]],[xi1[0]-c[0],xi1[1]-c[1]],goCW);
  const a2=angleCW2D([p[0]-c[0],p[1]-c[1]],[xi2[0]-c[0],xi2[1]-c[1]],goCW);
  return a1<a2 ? xi1 : xi2;
}

// Find the first intersection of the horocycle (given by explicit ξ) with hexagon arcs.
//   p, xi   — current point and ideal point (horocycle computed from these)
//   dir     — interior travel direction: +1 = CCW around the horocycle, -1 = CW.
//             Tracked as explicit state; flipped on orientation-reversing (NC) pairings.
//   circles — geodesic circles bounding the current hexagon
//   verts   — the 6 vertices of the current hexagon (polytopes[polyIdx])
//   toAvoid — side index to skip (we just came from there)
function horocycleFirstIntersection(p, xi, dir, circles, verts, toAvoid) {
  const horo = horocycleFromPtXi(p, xi);
  const cx = horo.center[0], cy = horo.center[1], r = horo.radius;
  if (r < 1e-10) return null;

  const goCW = dir < 0;

  // Collect all candidate intersection points that lie on actual hexagon arcs.
  // NOTE: unlike geodesics, horocycles CAN cross the same side twice, so we
  // do NOT skip toAvoid.  Instead we filter out points too close to the
  // starting point (the entry point sits on the toAvoid arc at angle ≈ 0).
  const intPoints = [];
  for (let s = 0; s < circles.length; s++) {
    const pts = findIntersectionCircles([cx, cy], r, circles[s].center, circles[s].radius);
    if (!pts) continue;
    const v1 = verts[s], v2 = verts[(s+1) % 6];
    for (const pt of [pts[0], pts[1]]) {
      // Skip if essentially the same as the starting point
      const dx = pt[0]-p[0], dy = pt[1]-p[1];
      if (dx*dx + dy*dy < 1e-12) continue;
      if (isOnArc(pt, v1, v2, circles[s].center)) intPoints.push({ pt, side: s });
    }
  }

  let minAng = Infinity, bestIdx = -1;
  for (let i = 0; i < intPoints.length; i++) {
    const ang = angleCW2D([p[0]-cx, p[1]-cy],
                          [intPoints[i].pt[0]-cx, intPoints[i].pt[1]-cy], goCW);
    if (ang > 1e-10 && ang < minAng) { minAng = ang; bestIdx = i; }
  }
  if (bestIdx < 0) return null;

  const arrPt   = intPoints[bestIdx].pt;
  const arrSide = intPoints[bestIdx].side;

  // Tangent at arrival in travel direction
  const rx = arrPt[0]-cx, ry = arrPt[1]-cy;
  const tv_x = dir > 0 ? -ry :  ry;
  const tv_y = dir > 0 ?  rx : -rx;
  const np2 = arrPt[0]*arrPt[0] + arrPt[1]*arrPt[1];
  const tvn = Math.sqrt(tv_x*tv_x + tv_y*tv_y);
  if (tvn < 1e-12) return null;
  const scale = (2*(1-np2))**2;

  return {
    point:      arrPt,
    tgVec:      [tv_x/tvn*scale, tv_y/tvn*scale],
    side:       arrSide,
    horoCenter: [cx, cy],
    horoRadius:  r,
    dir
  };
}

function rescaleHoroTg(p, t) {
  const np2 = p[0]*p[0] + p[1]*p[1], scale = (2*(1-np2))**2;
  const tn = Math.sqrt(t[0]*t[0] + t[1]*t[1]);
  return tn < 1e-14 ? [scale, 0] : [t[0]/tn*scale, t[1]/tn*scale];
}

// Compute initial travel direction (+1 CCW, -1 CW) from the sign of the dot
// product of t with the CCW tangent to the horocycle at p.
function initTravelDir(p, xi, t) {
  const h = horocycleFromPtXi(p, xi);
  const tccw_x = -(p[1]-h.center[1]), tccw_y = p[0]-h.center[0];
  return (tccw_x*t[0] + tccw_y*t[1]) >= 0 ? 1 : -1;
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

function drawHoroArc(ctx, cxC, cyC, sc, sp, ep, hCenter, hRadius, goClockwise, color, lw) {
  const [cx, cy] = hCenter, r = hRadius;
  if (r < 1e-8) return;
  const a1 = Math.atan2(sp[1]-cy, sp[0]-cx);
  let diff = Math.atan2(ep[1]-cy, ep[0]-cx) - a1;
  if (goClockwise) { while (diff >= 0) diff -= 2*Math.PI; }
  else             { while (diff <= 0) diff += 2*Math.PI; }
  ctx.beginPath(); ctx.setLineDash([]); ctx.strokeStyle = color; ctx.lineWidth = lw;
  for (let i = 0; i <= 60; i++) {
    const θ = a1 + diff*i/60;
    const x = cxC + (cx + r*Math.cos(θ))*sc, y = cyC - (cy + r*Math.sin(θ))*sc;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawHoroArcPartial(ctx, cxC, cyC, sc, sp, ep, hCenter, hRadius, goClockwise, color, lw, f0, f1) {
  const [cx, cy] = hCenter, r = hRadius;
  if (r < 1e-8) return;
  const a1 = Math.atan2(sp[1]-cy, sp[0]-cx);
  let diff = Math.atan2(ep[1]-cy, ep[0]-cx) - a1;
  if (goClockwise) { while (diff >= 0) diff -= 2*Math.PI; }
  else             { while (diff <= 0) diff += 2*Math.PI; }
  const a0s = a1+diff*f0, a1s = a1+diff*f1, n = Math.max(8, Math.round(60*(f1-f0)));
  ctx.beginPath(); ctx.setLineDash([]); ctx.strokeStyle = color; ctx.lineWidth = lw;
  for (let i = 0; i <= n; i++) {
    const θ = a0s + (a1s-a0s)*i/n;
    const x = cxC + (cx + r*Math.cos(θ))*sc, y = cyC - (cy + r*Math.sin(θ))*sc;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ─── State ───────────────────────────────────────────────────────────────────
let horoStopRequested = false, horoRunning = false, horoToMusic = null;
// Set by startHoroComputation; read by horostory.js for distribution drawing.
let horoDistData   = null;   // [{pt, xi, time, hex, side}] — curve-1 crossings only
let horoGluingG    = null;   // gluing object (curveCombinations, etc.)
let horoPolytopesG = null;   // polytope vertex arrays

// ─── Main computation ─────────────────────────────────────────────────────────
async function startHoroComputation() {
  if (horoRunning) return;
  horoRunning = true; horoStopRequested = false; horoToMusic = null;

  const btnRun=document.getElementById('horo-btn-run'), btnStop=document.getElementById('horo-btn-stop');
  const btnPlay=document.getElementById('horo-btn-play');
  const progressEl=document.getElementById('horo-progress-fill'), statusEl=document.getElementById('horo-status');
  btnRun.disabled=true; btnStop.disabled=false;
  if (btnPlay) btnPlay.disabled=true;
  progressEl.style.width='0%'; statusEl.textContent='Building surface...';

  const l1=parseFloat(document.getElementById('horo-l1').value);
  const l2=parseFloat(document.getElementById('horo-l2').value);
  const l3=parseFloat(document.getElementById('horo-l3').value);
  const t1=parseFloat(document.getElementById('horo-t1').value)/100*2*Math.PI;
  const t2=parseFloat(document.getElementById('horo-t2').value)/100*2*Math.PI;
  const t3=parseFloat(document.getElementById('horo-t3').value)/100*2*Math.PI;
  const maxCrossings=parseInt(document.getElementById('horo-maxcrossings').value)||3000;
  const drawSpeed=parseFloat(document.getElementById('horo-speed').value);
  const fastMode=document.getElementById('horo-fast-mode').checked;

  const gluingType=document.getElementById('horo-gluing-type').value;
  const gluing = gluingType==='nonseparating' ? createGluingNonseparatingS2() : createGluingSeparatingS2();
  const polytopes=buildPolytopes(gluing,[l1,l2,l3]);
  const circles=buildCircles(polytopes);
  const twists=[t1,t2,t3];

  // Expose for horostory.js distribution drawing
  horoGluingG    = gluing;
  horoPolytopesG = polytopes;
  horoDistData   = [];

  const canvases=[0,1,2,3].map(i=>document.getElementById('horo-c'+i));
  drawHexagons(canvases,polytopes,gluing);

  // Initial state
  let bx=0, by=0;
  for (let k=0;k<6;k++){bx+=polytopes[0][k][0];by+=polytopes[0][k][1];}
  bx/=6; by/=6;
  if (Math.abs(bx)<1e-6&&Math.abs(by)<1e-6){bx+=1e-4;by+=1e-4;}

  const a0=Math.random()*2*Math.PI;
  const np2_0=bx*bx+by*by, sc0=5*(1-np2_0)**2;
  let curPoint=[bx,by];
  let curXi=xiFromTangent(curPoint,[sc0*Math.cos(a0),-sc0*Math.sin(a0)]);
  // travelDir: +1 = CCW around horocycle (interior direction), -1 = CW.
  let travelDir=initTravelDir(curPoint,curXi,[sc0*Math.cos(a0),-sc0*Math.sin(a0)]);
  let polyIdx=0, toAvoid=6;

  // Warmup
  statusEl.textContent='Warming up...';
  for (let w=0;w<500;w++) {
    if (horoStopRequested) break;
    const inter=horocycleFirstIntersection(curPoint,curXi,travelDir,circles[polyIdx],polytopes[polyIdx],toAvoid);
    if (!inter) {
      // Reset to a random direction
      const a2=Math.random()*2*Math.PI;
      const t2=[Math.cos(a2),-Math.sin(a2)];
      curXi=xiFromTangent(curPoint,t2);
      travelDir=initTravelDir(curPoint,curXi,t2);
      continue;
    }
    const pairing=pairingFromGluing(gluing,polyIdx,inter.side,twists,inter.point,polytopes);
    const pr=applyPairing(inter.point,inter.tgVec,polyIdx,inter.side,gluing,twists,polytopes);
    const isNC=isRow([polyIdx,pr.polyIdx],gluing.noncoherentPairs);
    curXi   =updateXi(curXi,pairing,isNC,polytopes);
    curPoint=pr.point;
    if (isNC) travelDir=-travelDir;  // orientation-reversing pairing flips travel direction
    polyIdx =pr.polyIdx; toAvoid=pr.toAvoid;
    if (w%100===0){progressEl.style.width=(w/5)+'%'; await new Promise(r=>setTimeout(r,0));}
  }
  if (horoStopRequested){horoFinish();return;}

  const curveCombinations=gluing.curveCombinations.map((cc,i)=>{
    const ids=['horo-curve1','horo-curve2','horo-curve3'];
    return document.getElementById(ids[i]).checked?cc:[[-1,-1]];
  });

  const toMusicLocal=[];
  let crossingsCount=0, travelledSinceLast=0, firstCycle=true, stepCount=0;
  statusEl.textContent=fastMode?'Computing (fast mode)...':'Running horocyclic flow...';

  // Colours for curve-crossing dots on hexagon canvases
  const CROSS_DOT_COLORS=['rgba(200,100,60,0.9)','rgba(170,50,140,0.9)','rgba(140,140,140,0.9)'];
  function drawCrossDots(dotList){
    for (const d of dotList){
      const cv=canvases[d.hexIdx],ctx=cv.getContext('2d');
      const w=cv.width,ht=cv.height,cxC=w/2,cyC=ht/2,sc=w/2.3;
      const px=cxC+d.pt[0]*sc, py=cyC-d.pt[1]*sc;
      ctx.beginPath(); ctx.arc(px,py,3.5,0,2*Math.PI);
      ctx.fillStyle=CROSS_DOT_COLORS[d.curve]; ctx.fill();
    }
  }

  if (fastMode) {
    const crossDots=[];
    let nullCount=0;
    while (crossingsCount<maxCrossings) {
      if (horoStopRequested) break;
      const inter=horocycleFirstIntersection(curPoint,curXi,travelDir,circles[polyIdx],polytopes[polyIdx],toAvoid);
      if (!inter) {
        // Numerical drift: reset ξ to a random direction and retry.
        const a2=Math.random()*2*Math.PI;
        const t2=[Math.cos(a2),-Math.sin(a2)];
        curXi=xiFromTangent(curPoint,t2);
        travelDir=initTravelDir(curPoint,curXi,t2);
        nullCount++;
        if (nullCount>50) break;   // give up after too many consecutive failures
        continue;
      }
      nullCount=0;
      travelledSinceLast+=horocycleArcLength(curPoint,inter.point,curXi);
      const pairing=pairingFromGluing(gluing,polyIdx,inter.side,twists,inter.point,polytopes);
      const pr=applyPairing(inter.point,inter.tgVec,polyIdx,inter.side,gluing,twists,polytopes);
      const isNC=isRow([polyIdx,pr.polyIdx],gluing.noncoherentPairs);
      let isCurve=-1;
      for (let c=0;c<3;c++) if(isRow([polyIdx,inter.side],curveCombinations[c])){isCurve=c;break;}
      if (isCurve>=0){
        if (!firstCycle){
          toMusicLocal.push([travelledSinceLast,isCurve+1]);crossingsCount++;
          crossDots.push({hexIdx:polyIdx,pt:[...inter.point],curve:isCurve});
          if (isCurve===0)
            horoDistData.push({pt:[...inter.point],xi:[...curXi],time:travelledSinceLast,hex:polyIdx,side:inter.side,dir:travelDir});
        }
        travelledSinceLast=0; firstCycle=false;
      }
      curXi   =updateXi(curXi,pairing,isNC,polytopes);
      curPoint=pr.point;
      if (isNC) travelDir=-travelDir;
      polyIdx =pr.polyIdx; toAvoid=pr.toAvoid; stepCount++;
      if (stepCount%1000===0){
        progressEl.style.width=Math.min(100,crossingsCount/maxCrossings*100)+'%';
        statusEl.textContent=`Computing... ${crossingsCount}/${maxCrossings} crossings`;
        await new Promise(r=>setTimeout(r,0));
      }
    }
    // Draw all crossing dots on the hexagon canvases
    drawCrossDots(crossDots);
  } else {
    const recentArcs=[], GREY_AFTER=3, baseImages=[], crossDots=[];
    for (let h=0;h<4;h++){
      const ctx=canvases[h].getContext('2d');
      baseImages.push(ctx.getImageData(0,0,canvases[h].width,canvases[h].height));
    }
    function redrawArcs(){
      for (let h=0;h<4;h++) canvases[h].getContext('2d').putImageData(baseImages[h],0,0);
      for (let i=0;i<recentArcs.length;i++){
        const arc=recentArcs[i], cv=canvases[arc.hexIdx], ctx=cv.getContext('2d');
        const w=cv.width,ht=cv.height,cxC=w/2,cyC=ht/2,sc=w/2.3;
        const age=recentArcs.length-1-i;
        const col=age>=GREY_AFTER?'rgba(110,155,195,0.65)':'rgba(55,175,255,0.9)';
        const lw =age>=GREY_AFTER?0.7:1.8;
        drawHoroArc(ctx,cxC,cyC,sc,arc.sp,arc.ep,arc.hc,arc.hr,arc.goCW,col,lw);
      }
      // Draw crossing dots on top of arcs
      drawCrossDots(crossDots);
      const keep=GREY_AFTER+2;
      if (recentArcs.length>keep){
        for (let i=0;i<recentArcs.length-keep;i++){
          const arc=recentArcs[i],cv=canvases[arc.hexIdx],ctx=cv.getContext('2d');
          const w=cv.width,ht=cv.height;
          drawHoroArc(ctx,w/2,ht/2,w/2.3,arc.sp,arc.ep,arc.hc,arc.hr,arc.goCW,'rgba(110,155,195,0.65)',0.7);
        }
        // Composite dots into baseImages so they survive future restores
        drawCrossDots(crossDots);
        for (let h=0;h<4;h++){const ctx=canvases[h].getContext('2d');baseImages[h]=ctx.getImageData(0,0,canvases[h].width,canvases[h].height);}
        recentArcs.splice(0,recentArcs.length-keep);
      }
    }
    if (!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    const liveNotes=[440.00,554.37,659.25].map(f=>createMarimbaNote(f,1.5));
    function playNote(idx){try{const s=audioCtx.createBufferSource();s.buffer=liveNotes[idx];s.connect(audioCtx.destination);s.start();}catch(e){}}

    const NUM_CHUNKS=6;
    let nullCount2=0;
    while (crossingsCount<maxCrossings){
      if (horoStopRequested) break;
      const inter=horocycleFirstIntersection(curPoint,curXi,travelDir,circles[polyIdx],polytopes[polyIdx],toAvoid);
      if (!inter) {
        const a2=Math.random()*2*Math.PI;
        const t2=[Math.cos(a2),-Math.sin(a2)];
        curXi=xiFromTangent(curPoint,t2);
        travelDir=initTravelDir(curPoint,curXi,t2);
        nullCount2++;
        if (nullCount2>50) break;
        continue;
      }
      nullCount2=0;
      const arcSp=[...curPoint],arcEp=[...inter.point];
      const arcHex=polyIdx,arcHC=inter.horoCenter,arcHR=inter.horoRadius,arcGoCW=inter.dir<0;
      travelledSinceLast+=horocycleArcLength(curPoint,inter.point,curXi);
      const pairing=pairingFromGluing(gluing,polyIdx,inter.side,twists,inter.point,polytopes);
      const pr=applyPairing(inter.point,inter.tgVec,polyIdx,inter.side,gluing,twists,polytopes);
      const isNC=isRow([polyIdx,pr.polyIdx],gluing.noncoherentPairs);
      let isCurve=-1;
      for (let c=0;c<3;c++) if(isRow([polyIdx,inter.side],curveCombinations[c])){isCurve=c;break;}
      if (isCurve>=0){
        if (!firstCycle){
          toMusicLocal.push([travelledSinceLast,isCurve+1]);crossingsCount++;
          crossDots.push({hexIdx:arcHex,pt:[...arcEp],curve:isCurve});
          if (isCurve===0)
            horoDistData.push({pt:[...inter.point],xi:[...curXi],time:travelledSinceLast,hex:arcHex,side:inter.side,dir:travelDir});
        }
        travelledSinceLast=0; firstCycle=false;
      }
      curXi   =updateXi(curXi,pairing,isNC,polytopes);
      curPoint=pr.point;
      if (isNC) travelDir=-travelDir;
      polyIdx =pr.polyIdx; toAvoid=pr.toAvoid; stepCount++;

      // Animate the arc chunk-by-chunk FIRST, then push to recentArcs.
      // (Pushing before animation caused the full arc to appear instantly.)
      const cv=canvases[arcHex],ctx=cv.getContext('2d');
      const w=cv.width,ht=cv.height,cxC=w/2,cyC=ht/2,sc=w/2.3;
      const chunkMs=Math.max(1,(distanceTwoPoints(arcSp,arcEp)/drawSpeed)*100);
      for (let ch=0;ch<NUM_CHUNKS;ch++){
        if (horoStopRequested) break;
        drawHoroArcPartial(ctx,cxC,cyC,sc,arcSp,arcEp,arcHC,arcHR,arcGoCW,'rgba(55,175,255,0.9)',1.8,ch/NUM_CHUNKS,(ch+1)/NUM_CHUNKS);
        await new Promise(r=>setTimeout(r,chunkMs));
      }
      recentArcs.push({hexIdx:arcHex,sp:arcSp,ep:arcEp,hc:arcHC,hr:arcHR,goCW:arcGoCW});
      redrawArcs();
      if (isCurve>=0) playNote(isCurve);
      progressEl.style.width=Math.min(100,crossingsCount/maxCrossings*100)+'%';
      statusEl.textContent=`Running... ${crossingsCount}/${maxCrossings} crossings`;
    }
  }

  horoToMusic=toMusicLocal;
  progressEl.style.width='100%';
  statusEl.textContent=`Done. ${horoToMusic.length} crossings recorded.`;
  horoFinish();
}

function horoFinish(){
  horoRunning=false;
  document.getElementById('horo-btn-run').disabled=false;
  document.getElementById('horo-btn-stop').disabled=true;
  const btnPlay=document.getElementById('horo-btn-play');
  if (btnPlay) btnPlay.disabled=!(horoToMusic&&horoToMusic.length>0);
}
function stopHoroComputation(){horoStopRequested=true;}

// ─── Audio playback ───────────────────────────────────────────────────────────
let horoAudioPlaying=false, horoAudioStopReq=false;
async function playHoroAudio(){
  if (!horoToMusic||horoToMusic.length===0) return;
  if (!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  horoAudioPlaying=true; horoAudioStopReq=false;
  document.getElementById('horo-btn-play').disabled=true;
  document.getElementById('horo-btn-stop-audio').disabled=false;
  const speedMul=parseFloat(document.getElementById('horo-audiospeed').value);
  const notes=[440.00,554.37,659.25].map(f=>createMarimbaNote(f,1.5));
  let elapsed=0;
  for (let i=0;i<horoToMusic.length;i++){
    if (horoAudioStopReq) break;
    const dt=horoToMusic[i][0]/speedMul; elapsed+=dt;
    if (elapsed>180) break;
    await new Promise(r=>setTimeout(r,dt*1000));
    if (horoAudioStopReq) break;
    const src=audioCtx.createBufferSource(); src.buffer=notes[horoToMusic[i][1]-1];
    src.connect(audioCtx.destination); src.start();
  }
  horoAudioPlaying=false;
  document.getElementById('horo-btn-play').disabled=false;
  document.getElementById('horo-btn-stop-audio').disabled=true;
}
function stopHoroAudio(){horoAudioStopReq=true;}

"use strict";

// ===== Complex number helpers =====
function cadd(a,b){return[a[0]+b[0],a[1]+b[1]]}
function csub(a,b){return[a[0]-b[0],a[1]-b[1]]}
function cmul(a,b){return[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]]}
function cdiv(a,b){const d=b[0]*b[0]+b[1]*b[1];return[(a[0]*b[0]+a[1]*b[1])/d,(a[1]*b[0]-a[0]*b[1])/d]}
function cconj(a){return[a[0],-a[1]]}
function cabs(a){return Math.sqrt(a[0]*a[0]+a[1]*a[1])}
function cscale(s,a){return[s*a[0],s*a[1]]}

// 2x2 complex matrix operations
function matMul(A,B){
  return[[cmul(A[0][0],B[0][0]).map((v,i)=>v+cmul(A[0][1],B[1][0])[i]),
          cmul(A[0][0],B[0][1]).map((v,i)=>v+cmul(A[0][1],B[1][1])[i])],
         [cmul(A[1][0],B[0][0]).map((v,i)=>v+cmul(A[1][1],B[1][0])[i]),
          cmul(A[1][0],B[0][1]).map((v,i)=>v+cmul(A[1][1],B[1][1])[i])]]}
function matApply(M,z){return cdiv(cadd(cmul(M[0][0],z),M[0][1]),cadd(cmul(M[1][0],z),M[1][1]))}
function matDet(M){return csub(cmul(M[0][0],M[1][1]),cmul(M[0][1],M[1][0]))}
function matInv(M){const d=matDet(M);return[[cdiv(M[1][1],d),cdiv(cscale(-1,M[0][1]),d)],[cdiv(cscale(-1,M[1][0]),d),cdiv(M[0][0],d)]]}

// ===== Hyperbolic geometry =====
function distanceTwoPoints(p1,p2){
  const dx=p1[0]-p2[0],dy=p1[1]-p2[1];
  const n1=p1[0]*p1[0]+p1[1]*p1[1],n2=p2[0]*p2[0]+p2[1]*p2[1];
  const delta=2*(dx*dx+dy*dy)/((1-n1)*(1-n2));
  // Numerically stable: acosh(1+x) = 2*asinh(sqrt(x/2)), avoids 1+delta rounding to 1
  return 2*Math.asinh(Math.sqrt(delta/2));
}

function angleCW2D(v1,v2,goingClockwise=true){
  const dp=v1[0]*v2[0]+v1[1]*v2[1];
  const det2=v1[0]*v2[1]-v1[1]*v2[0];
  if(goingClockwise)return 2*Math.PI-((Math.atan2(det2,dp)%(2*Math.PI)+2*Math.PI)%(2*Math.PI));
  return((Math.atan2(det2,dp)%(2*Math.PI)+2*Math.PI)%(2*Math.PI));
}

function geodesicCircumferenceFromSegment(sp,ep){
  const mx=(sp[0]+ep[0])/2,my=(sp[1]+ep[1])/2;
  const dx=ep[0]-sp[0],dy=ep[1]-sp[1];
  const segLen=Math.sqrt(dx*dx+dy*dy);
  const ux=dx/segLen,uy=dy/segLen;
  const px=-uy,py=ux;
  const nm2=mx*mx+my*my;
  const num=segLen*segLen/4-nm2+1;
  const denom=2*(mx*px+my*py);
  const ned=num/denom;
  const cx=mx+px*ned,cy=my+py*ned;
  const cn2=(mx+px*ned)**2+(my+py*ned)**2;
  const r=Math.sqrt(cn2-1);
  return{center:[cx,cy],radius:r};
}

function geodesicCircumferenceFromPtv(point,tgVec){
  const norm2=Math.sqrt(tgVec[0]*tgVec[0]+tgVec[1]*tgVec[1]);
  const ux=tgVec[0]/norm2,uy=tgVec[1]/norm2;
  const px=-uy,py=ux;
  const mx=point[0],my=point[1];
  const nm2=mx*mx+my*my;
  const num=-nm2+1;
  const denom=2*(mx*px+my*py);
  const ned=num/denom;
  const cx=mx+px*ned,cy=my+py*ned;
  const cn2=(mx+px*ned)**2+(my+py*ned)**2;
  const r=Math.sqrt(Math.max(0,cn2-1));
  return{center:[cx,cy],radius:r};
}

function findIntersectionCircles(c1,r1,c2,r2){
  const dx=c2[0]-c1[0],dy=c2[1]-c1[1];
  const d=Math.sqrt(dx*dx+dy*dy);
  if(d>r1+r2+1e-12||d<Math.abs(r1-r2)-1e-12)return null;
  const a=(r1*r1-r2*r2+d*d)/(2*d);
  const h2=r1*r1-a*a;
  const h=Math.sqrt(Math.max(0,h2));
  const mx=c1[0]+a/d*dx,my=c1[1]+a/d*dy;
  const hx=h/d*(c2[1]-c1[1]),hy=h/d*(c1[0]-c2[0]);
  return[[mx+hx,my+hy],[mx-hx,my-hy]];
}

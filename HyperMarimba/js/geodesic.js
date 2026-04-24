"use strict";

// ===== Core geodesic step =====
function findLineCircleIntersections(p,d,cc,rc){
  // Intersect line p+t*d with circle (cc,rc). Returns array of [point, t] or null.
  const fx=p[0]-cc[0],fy=p[1]-cc[1];
  const a=d[0]*d[0]+d[1]*d[1];
  const b=2*(fx*d[0]+fy*d[1]);
  const c=fx*fx+fy*fy-rc*rc;
  let disc=b*b-4*a*c;
  if(disc<0)return null;
  disc=Math.sqrt(disc);
  const t1=(-b-disc)/(2*a),t2=(-b+disc)/(2*a);
  return[[p[0]+t1*d[0],p[1]+t1*d[1]],t1,[p[0]+t2*d[0],p[1]+t2*d[1]],t2];
}

function firstIntersection(point,tgVec,circles,toAvoid){
  const gc=geodesicCircumferenceFromPtv(point,tgVec);
  const c1=gc.center,r1=gc.radius;

  // Detect degenerate case: geodesic is nearly a straight line (point near origin)
  const isLine=!isFinite(r1)||r1>1e8;

  const intPoints=[];

  if(isLine){
    // Use line-circle intersection: geodesic ≈ straight line through point in direction tgVec
    const tn=Math.sqrt(tgVec[0]*tgVec[0]+tgVec[1]*tgVec[1]);
    const dir=[tgVec[0]/tn,tgVec[1]/tn];
    for(let s=0;s<circles.length;s++){
      if(s===toAvoid)continue;
      const res=findLineCircleIntersections(point,dir,circles[s].center,circles[s].radius);
      if(res){
        intPoints.push({pt:res[0],side:s,t:res[1]});
        intPoints.push({pt:res[2],side:s,t:res[3]});
      }
    }
    // Pick closest intersection in forward direction (t>0) inside disk
    let minT=Infinity,bestIdx=-1;
    for(let i=0;i<intPoints.length;i++){
      const ip=intPoints[i].pt;
      if(ip[0]*ip[0]+ip[1]*ip[1]>1+1e-8)continue;
      if(intPoints[i].t>1e-10&&intPoints[i].t<minT){minT=intPoints[i].t;bestIdx=i;}
    }
    if(bestIdx<0)return null;
    const arrPt=intPoints[bestIdx].pt;
    const arrSide=intPoints[bestIdx].side;
    // For a straight-line geodesic, tangent at arrival ≈ same direction, scaled to hyperbolic metric
    const np2=arrPt[0]*arrPt[0]+arrPt[1]*arrPt[1];
    const scale=(2*(1-np2))**2;
    const tv=[dir[0]*scale,dir[1]*scale];
    return{point:arrPt,tgVec:tv,side:arrSide};
  }

  for(let s=0;s<circles.length;s++){
    if(s===toAvoid)continue;
    const pts=findIntersectionCircles(c1,r1,circles[s].center,circles[s].radius);
    if(pts){
      intPoints.push({pt:pts[0],side:s});
      intPoints.push({pt:pts[1],side:s});
    }
  }

  const det=((point[0]-c1[0])*tgVec[1]-(point[1]-c1[1])*tgVec[0]);
  const goClockwise=det<=0;

  let minAng=Infinity,bestIdx=-1;
  for(let i=0;i<intPoints.length;i++){
    const ip=intPoints[i].pt;
    if(ip[0]*ip[0]+ip[1]*ip[1]>1+1e-8)continue;
    const ang=angleCW2D([point[0]-c1[0],point[1]-c1[1]],[ip[0]-c1[0],ip[1]-c1[1]],goClockwise);
    if(ang>0&&ang<minAng){minAng=ang;bestIdx=i;}
  }

  if(bestIdx<0)return null;
  const arrPt=intPoints[bestIdx].pt;
  const arrSide=intPoints[bestIdx].side;

  // Compute tangent at arrival
  const ray=[arrPt[0]-c1[0],arrPt[1]-c1[1]];
  let tv;
  if(!goClockwise)tv=[-ray[1],ray[0]];
  else tv=[ray[1],-ray[0]];
  const tn=Math.sqrt(tv[0]*tv[0]+tv[1]*tv[1]);
  const np2=arrPt[0]*arrPt[0]+arrPt[1]*arrPt[1];
  const scale=(2*(1-np2))**2;
  tv=[tv[0]/tn*scale,tv[1]/tn*scale];

  return{point:arrPt,tgVec:tv,side:arrSide};
}

function isRow(row,matrix){
  for(const r of matrix)if(r[0]===row[0]&&r[1]===row[1])return true;
  return false;
}

function computeIsometryWithTwistedParameter(point,p1,p2,q1,q2,q3,q4,twistedParam){
  const lenSide=distanceTwoPoints(p1,p2);
  const translationAmount=2*lenSide*(twistedParam/(2*Math.PI));
  const dp1=distanceTwoPoints(point,p1);

  if(dp1+(translationAmount-2*lenSide)>0){
    return{iso:isometryH2TwoPointsWithTranslationPoincare(p1,p2,q1,q2,translationAmount-2*lenSide),overshoot:2};
  }else if(dp1+(translationAmount-lenSide)>0){
    return{iso:isometryH2TwoPointsWithTranslationPoincare(p1,p2,q3,q4,translationAmount-lenSide),overshoot:1};
  }else{
    return{iso:isometryH2TwoPointsWithTranslationPoincare(p1,p2,q1,q2,translationAmount),overshoot:0};
  }
}

function pairingFromGluing(gluing,inHex,inSide,twistedParams,intersectionPoint,polytopes){
  const p=gluing.pairings[inHex][inSide];
  if(p.type==='simple'){
    const iso=isometryH2TwoPointsPoincare(
      polytopes[inHex][p.srcVtx[0]],polytopes[inHex][p.srcVtx[1]],
      polytopes[p.tgtHex][p.tgtVtx[0]],polytopes[p.tgtHex][p.tgtVtx[1]]);
    return{outHex:p.tgtHex,outSide:p.tgtSide,iso:iso};
  }else{
    let t=twistedParams[p.twistParamIndex];
    if(p.twistSign===-1)t=2*Math.PI-t;
    const r=computeIsometryWithTwistedParameter(intersectionPoint,
      polytopes[inHex][p.srcVtx[0]],polytopes[inHex][p.srcVtx[1]],
      polytopes[p.primaryTgtHex][p.primaryVtx[0]],polytopes[p.primaryTgtHex][p.primaryVtx[1]],
      polytopes[p.secondaryTgtHex][p.secondaryVtx[0]],polytopes[p.secondaryTgtHex][p.secondaryVtx[1]],
      t);
    if(r.overshoot===0||r.overshoot===2)
      return{outHex:p.primaryTgtHex,outSide:p.primaryTgtSide,iso:r.iso};
    else
      return{outHex:p.secondaryTgtHex,outSide:p.secondaryTgtSide,iso:r.iso};
  }
}

function applyPairing(intersPoint,intersTgVec,poly,side,gluing,twistedParams,polytopes){
  const pr=pairingFromGluing(gluing,poly,side,twistedParams,intersPoint,polytopes);
  let result=applyPoincarePointAndVector(pr.iso.poincare,intersPoint,intersTgVec);
  let newPoint=result.point,newTvec=result.tgVec;

  if(isRow([poly,pr.outHex],gluing.noncoherentPairs)){
    const toAvoidSide=pr.outSide;
    const index2=(toAvoidSide+1)%6;
    const p1=polytopes[pr.outHex][toAvoidSide];
    const p2=polytopes[pr.outHex][index2];

    const z1p=[p1[0],p1[1]],z2p=[p2[0],p2[1]];
    const z1=poincareToUpperHalf(z1p),z2=poincareToUpperHalf(z2p);
    const x1=z1[0],y1=z1[1],x2=z2[0],y2=z2[1];
    const c_uh=(x1*x1+y1*y1-x2*x2-y2*y2)/(2*(x1-x2));
    const r_uh=Math.sqrt((x1-c_uh)**2+y1*y1);

    // M = [1, -(c-r); 1, -(c+r)]
    const Mreal=[[1,-(c_uh-r_uh)],[1,-(c_uh+r_uh)]];
    // J = [-1,0;0,1]
    const J=[[-1,0],[0,1]];
    // inv(M)*J*M
    const Minv=mat2inv(Mreal);
    const JM=mat2mul(J,Mreal);
    const isoR=mat2mul(Minv,JM);
    const isoRc=isoR.map(r=>r.map(v=>[v,0]));

    // Convert newPoint to upper half
    const np1c=[newPoint[0],newPoint[1]];
    const ntv1c=[newTvec[0],newTvec[1]];
    const np1uh=poincareToUpperHalf(np1c);
    // d(poincare->uh)/dz = 2i/(1-z)^2
    const denom_uh=csub([1,0],np1c);
    const deriv=cdiv([0,2],cmul(denom_uh,denom_uh));
    const ntv1uh=cmul(deriv,ntv1c);

    const orResult=applyUpperHalfPointAndVectorOrientationReversing(isoRc,np1uh,ntv1uh);

    // Convert back to Poincare
    // z_poinc = (z_uh - i)/(z_uh + i)
    const backNp=cdiv(csub(orResult.point,[0,1]),cadd(orResult.point,[0,1]));
    const denomBack=cadd(orResult.point,[0,1]);
    const backNtv=cmul(cdiv([0,2],cmul(denomBack,denomBack)),orResult.tgVec);

    newTvec=[backNtv[0],backNtv[1]];
    // Keep the isometry output point (invariant under orientation reversal)
  }

  return{point:newPoint,tgVec:newTvec,polyIdx:pr.outHex,toAvoid:pr.outSide};
}

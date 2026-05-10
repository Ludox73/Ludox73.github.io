"use strict";

// ===== Hexagon construction =====
function applyUpperHalfMatrix(M,z){
  // M is 2x2 real matrix, z is complex [re,im]
  return cdiv(cadd(cscale(M[0][0],z),[M[0][1],0]),cadd(cscale(M[1][0],z),[M[1][1],0]));
}

function rectangularHexagonCentered(l1,l3,l5){
  const cl1=Math.cosh(l1),sl1=Math.sinh(l1),cl3=Math.cosh(l3),sl3=Math.sinh(l3);
  const cl5=Math.cosh(l5),sl5=Math.sinh(l5);
  const l2=Math.acosh((cl1*cl3+cl5)/(sl1*sl3));
  const l4=Math.acosh((cl3*cl5+cl1)/(sl3*sl5));
  const l6=Math.acosh((cl5*cl1+cl3)/(sl5*sl1));
  const allSides=[l1,l2,l3,l4,l5,l6];

  // Build vertices in upper half plane
  const s22=Math.SQRT1_2;
  const Matrices=new Array(6);
  const V=new Array(6);
  V[0]=[0,1]; // i
  Matrices[0]=[[1,0],[0,1]];

  for(let k=1;k<6;k++){
    const eP=Math.exp(allSides[k-1]/2),eN=Math.exp(-allSides[k-1]/2);
    // M = rot45 * diag(eP,eN)
    const M_loc=[[s22*eP,s22*eN],[-s22*eP,s22*eN]];
    // Matrices[k] = inv(M_loc) * Matrices[k-1]
    const detM=s22*eP*s22*eN-s22*eN*(-s22*eP);
    const invM=[[s22*eN/detM,-s22*eN/detM],[s22*eP/detM,s22*eP/detM]];
    Matrices[k]=mat2mul(invM,Matrices[k-1]);
    // V[k] = apply(inv(Matrices[k-1])*M_loc, i)
    const invPrev=mat2inv(Matrices[k-1]);
    const combo=mat2mul(invPrev,M_loc);
    V[k]=applyUpperHalfMatrix(combo,[0,1]);
  }

  // Apply correction matrix and convert to Poincare
  const corrM=[[1.25,0.5],[0,1/1.25]];
  const poincareVerts=[];
  const complexPoincare=[];
  for(let k=0;k<6;k++){
    const aus=applyUpperHalfMatrix(corrM,V[k]);
    // (aus - i)/(aus + i)
    const p=cdiv(csub(aus,[0,1]),cadd(aus,[0,1]));
    poincareVerts.push([p[0],p[1]]);
    complexPoincare.push(p);
  }

  // Compute barycenter (Euclidean mean as approximation for visualization)
  let bx=0,by=0;
  for(let k=0;k<6;k++){bx+=poincareVerts[k][0];by+=poincareVerts[k][1];}
  bx/=6;by/=6;
  const bary=[bx,by];

  // Move barycenter to origin via Mobius
  const result=[];
  for(let k=0;k<6;k++){
    const z=complexPoincare[k];
    const bc=[bary[0],bary[1]];
    // (z - bc) / (1 - conj(bc)*z)
    const num=csub(z,bc);
    const den=csub([1,0],cmul(cconj(bc),z));
    const w=cdiv(num,den);
    result.push([w[0],w[1]]);
  }
  return{vertices:result,allSides:allSides};
}

// 2x2 real matrix helpers
function mat2mul(A,B){return[[A[0][0]*B[0][0]+A[0][1]*B[1][0],A[0][0]*B[0][1]+A[0][1]*B[1][1]],[A[1][0]*B[0][0]+A[1][1]*B[1][0],A[1][0]*B[0][1]+A[1][1]*B[1][1]]];}
function mat2inv(M){const d=M[0][0]*M[1][1]-M[0][1]*M[1][0];return[[M[1][1]/d,-M[0][1]/d],[-M[1][0]/d,M[0][0]/d]];}

// ===== Isometry computation =====
function isometryH2TwoPointsUpperHalf(p1,p2,q1,q2){
  // Build 4x4 real linear system A*[a,b,c,d]=0
  const P=[p1,p2],Q=[q1,q2];
  const A=[];
  for(let j=0;j<2;j++){
    const pj=P[j],qj=Q[j];
    const qp=cmul(qj,pj);
    A.push([pj[0],1,-qp[0],-qj[0]]);
    A.push([pj[1],0,-qp[1],-qj[1]]);
  }
  // Find null space of 4x4 matrix (1D)
  const v=nullSpace4x4(A);
  let a=v[0],b=v[1],c=v[2],d=v[3];
  let det=a*d-b*c;
  if(det<0){a=-a;b=-b;c=-c;d=-d;det=-det;}
  const s=1/Math.sqrt(det);
  return[[a*s,b*s],[c*s,d*s]];
}

function nullSpace4x4(A){
  // Gaussian elimination with pivoting to find null space of 4x4 matrix
  const M=A.map(r=>[...r]);
  const n=4;
  const pivotCols=[];
  let row=0;
  for(let col=0;col<n&&row<4;col++){
    let maxVal=0,maxRow=row;
    for(let r=row;r<4;r++){if(Math.abs(M[r][col])>maxVal){maxVal=Math.abs(M[r][col]);maxRow=r;}}
    if(maxVal<1e-10)continue;
    [M[row],M[maxRow]]=[M[maxRow],M[row]];
    const piv=M[row][col];
    for(let c=0;c<n;c++)M[row][c]/=piv;
    for(let r=0;r<4;r++){
      if(r===row)continue;
      const f=M[r][col];
      for(let c=0;c<n;c++)M[r][c]-=f*M[row][c];
    }
    pivotCols.push(col);
    row++;
  }
  // Find free column
  const free=[];
  for(let c=0;c<n;c++)if(!pivotCols.includes(c))free.push(c);
  if(free.length===0)return[0,0,0,1]; // fallback
  const fc=free[0];
  const result=[0,0,0,0];
  result[fc]=1;
  for(let i=0;i<pivotCols.length;i++){
    result[pivotCols[i]]=-M[i][fc];
  }
  return result;
}

function poincareToCplx(p){return[p[0],p[1]];}
function poincareToUpperHalf(z){
  // z_uh = i*(1+z)/(1-z)
  return cdiv(cmul([0,1],cadd([1,0],z)),csub([1,0],z));
}

function isometryH2TwoPointsPoincare(p1,p2,q1,q2){
  const z1=poincareToUpperHalf(poincareToCplx(p1));
  const z2=poincareToUpperHalf(poincareToCplx(p2));
  const w1=poincareToUpperHalf(poincareToCplx(q1));
  const w2=poincareToUpperHalf(poincareToCplx(q2));
  const LM=isometryH2TwoPointsUpperHalf(z1,z2,w1,w2);
  // poinc_M = [1,-i;1,i]*LM*[i,i;-1,1]
  const T1=[[[1,0],[0,-1]],[[1,0],[0,1]]];
  const T2=[[[0,1],[0,1]],[[-1,0],[1,0]]];
  const LMc=LM.map(r=>r.map(v=>[v,0]));
  const poincM=matMul(matMul(T1,LMc),T2);
  return{poincare:poincM,upperHalf:LMc};
}

function isometryH2TwoPointsWithTranslationPoincare(p1,p2,q1,q2,translationAmount){
  const z1=poincareToUpperHalf(poincareToCplx(p1));
  const z2=poincareToUpperHalf(poincareToCplx(p2));
  const w1=poincareToUpperHalf(poincareToCplx(q1));
  const w2=poincareToUpperHalf(poincareToCplx(q2));
  const L1M=isometryH2TwoPointsUpperHalf(z1,z2,w1,w2);
  const lenSide=distanceTwoPoints(p1,p2);
  const TM=isometryH2TwoPointsUpperHalf(z1,z2,[0,1],[0,Math.exp(lenSide)]);
  const transM=[[Math.exp(translationAmount/2),0],[0,Math.exp(-translationAmount/2)]];
  // LM = L1M * inv(TM) * transM * TM
  const TMd=TM[0][0]*TM[1][1]-TM[0][1]*TM[1][0];
  const TMi=[[TM[1][1]/TMd,-TM[0][1]/TMd],[-TM[1][0]/TMd,TM[0][0]/TMd]];
  const step1=mat2mul(TMi,transM);
  const step2=mat2mul(step1,TM);
  const LM=mat2mul(L1M,step2);

  const T1=[[[1,0],[0,-1]],[[1,0],[0,1]]];
  const T2=[[[0,1],[0,1]],[[-1,0],[1,0]]];
  const LMc=LM.map(r=>r.map(v=>[v,0]));
  const poincM=matMul(matMul(T1,LMc),T2);
  return{poincare:poincM,upperHalf:LMc};
}

function applyPoincarePointAndVector(M,point,tgVec){
  const z=[point[0],point[1]],v=[tgVec[0],tgVec[1]];
  const denom=cadd(cmul(M[1][0],z),M[1][1]);
  const newZ=cdiv(cadd(cmul(M[0][0],z),M[0][1]),denom);
  const det=csub(cmul(M[0][0],M[1][1]),cmul(M[0][1],M[1][0]));
  const newV=cmul(cdiv(det,cmul(denom,denom)),v);
  return{point:[newZ[0],newZ[1]],tgVec:[newV[0],newV[1]]};
}

function applyUpperHalfPointAndVectorOrientationReversing(M,point,tgVec){
  const z=[point[0],point[1]],v=[tgVec[0],tgVec[1]];
  const zc=cconj(z);
  const denom=cadd(cmul(M[1][0],zc),M[1][1]);
  const newZ=cdiv(cadd(cmul(M[0][0],zc),M[0][1]),denom);
  const det=csub(cmul(M[0][0],M[1][1]),cmul(M[0][1],M[1][0]));
  const newV=cmul(cdiv(det,cmul(denom,denom)),cconj(v));
  return{point:[newZ[0],newZ[1]],tgVec:[newV[0],newV[1]]};
}

// ===== Gluing structure =====
function createGluingSeparatingS2(){
  const g={};
  g.hexCurveIndices=[[0,1,1],[0,1,1],[0,2,2],[0,2,2]]; // 0-indexed curve indices
  g.noncoherentPairs=[[0,1],[0,3],[1,0],[1,2],[2,1],[2,3],[3,0],[3,2]];
  g.curveCombinations=[
    [[0,0],[1,0],[2,0],[3,0]],      // curve 1
    [[0,2],[0,4],[1,2],[1,4]],      // curve 2
    [[2,2],[2,4],[3,2],[3,4]]       // curve 3
  ];

  // Build pairings (0-indexed hex and side)
  g.pairings=new Array(4);
  for(let i=0;i<4;i++)g.pairings[i]=new Array(6);

  // Simple pairings (sides 1,3,5 in 0-indexed)
  g.pairings[0][1]={type:'simple',tgtHex:1,tgtSide:1,srcVtx:[1,2],tgtVtx:[1,2]};
  g.pairings[0][3]={type:'simple',tgtHex:1,tgtSide:3,srcVtx:[3,4],tgtVtx:[3,4]};
  g.pairings[0][5]={type:'simple',tgtHex:1,tgtSide:5,srcVtx:[5,0],tgtVtx:[5,0]};
  g.pairings[1][1]={type:'simple',tgtHex:0,tgtSide:1,srcVtx:[1,2],tgtVtx:[1,2]};
  g.pairings[1][3]={type:'simple',tgtHex:0,tgtSide:3,srcVtx:[3,4],tgtVtx:[3,4]};
  g.pairings[1][5]={type:'simple',tgtHex:0,tgtSide:5,srcVtx:[5,0],tgtVtx:[5,0]};
  g.pairings[2][1]={type:'simple',tgtHex:3,tgtSide:1,srcVtx:[1,2],tgtVtx:[1,2]};
  g.pairings[2][3]={type:'simple',tgtHex:3,tgtSide:3,srcVtx:[3,4],tgtVtx:[3,4]};
  g.pairings[2][5]={type:'simple',tgtHex:3,tgtSide:5,srcVtx:[5,0],tgtVtx:[5,0]};
  g.pairings[3][1]={type:'simple',tgtHex:2,tgtSide:1,srcVtx:[1,2],tgtVtx:[1,2]};
  g.pairings[3][3]={type:'simple',tgtHex:2,tgtSide:3,srcVtx:[3,4],tgtVtx:[3,4]};
  g.pairings[3][5]={type:'simple',tgtHex:2,tgtSide:5,srcVtx:[5,0],tgtVtx:[5,0]};

  // Twisted pairings (sides 0,2,4 in 0-indexed)
  g.pairings[0][0]={type:'twisted',primaryTgtHex:2,primaryTgtSide:0,secondaryTgtHex:3,secondaryTgtSide:0,
    srcVtx:[0,1],primaryVtx:[1,0],secondaryVtx:[0,1],twistParamIndex:0,twistSign:1};
  g.pairings[0][2]={type:'twisted',primaryTgtHex:0,primaryTgtSide:4,secondaryTgtHex:1,secondaryTgtSide:4,
    srcVtx:[2,3],primaryVtx:[5,4],secondaryVtx:[4,5],twistParamIndex:1,twistSign:1};
  g.pairings[0][4]={type:'twisted',primaryTgtHex:0,primaryTgtSide:2,secondaryTgtHex:1,secondaryTgtSide:2,
    srcVtx:[4,5],primaryVtx:[3,2],secondaryVtx:[2,3],twistParamIndex:1,twistSign:1};

  g.pairings[1][0]={type:'twisted',primaryTgtHex:3,primaryTgtSide:0,secondaryTgtHex:2,secondaryTgtSide:0,
    srcVtx:[0,1],primaryVtx:[1,0],secondaryVtx:[0,1],twistParamIndex:0,twistSign:-1};
  g.pairings[1][2]={type:'twisted',primaryTgtHex:1,primaryTgtSide:4,secondaryTgtHex:0,secondaryTgtSide:4,
    srcVtx:[2,3],primaryVtx:[5,4],secondaryVtx:[4,5],twistParamIndex:1,twistSign:-1};
  g.pairings[1][4]={type:'twisted',primaryTgtHex:1,primaryTgtSide:2,secondaryTgtHex:0,secondaryTgtSide:2,
    srcVtx:[4,5],primaryVtx:[3,2],secondaryVtx:[2,3],twistParamIndex:1,twistSign:-1};

  g.pairings[2][0]={type:'twisted',primaryTgtHex:0,primaryTgtSide:0,secondaryTgtHex:1,secondaryTgtSide:0,
    srcVtx:[0,1],primaryVtx:[1,0],secondaryVtx:[0,1],twistParamIndex:0,twistSign:1};
  g.pairings[2][2]={type:'twisted',primaryTgtHex:2,primaryTgtSide:4,secondaryTgtHex:3,secondaryTgtSide:4,
    srcVtx:[2,3],primaryVtx:[5,4],secondaryVtx:[4,5],twistParamIndex:2,twistSign:1};
  g.pairings[2][4]={type:'twisted',primaryTgtHex:2,primaryTgtSide:2,secondaryTgtHex:3,secondaryTgtSide:2,
    srcVtx:[4,5],primaryVtx:[3,2],secondaryVtx:[2,3],twistParamIndex:2,twistSign:1};

  g.pairings[3][0]={type:'twisted',primaryTgtHex:1,primaryTgtSide:0,secondaryTgtHex:0,secondaryTgtSide:0,
    srcVtx:[0,1],primaryVtx:[1,0],secondaryVtx:[0,1],twistParamIndex:0,twistSign:-1};
  g.pairings[3][2]={type:'twisted',primaryTgtHex:3,primaryTgtSide:4,secondaryTgtHex:2,secondaryTgtSide:4,
    srcVtx:[2,3],primaryVtx:[5,4],secondaryVtx:[4,5],twistParamIndex:2,twistSign:-1};
  g.pairings[3][4]={type:'twisted',primaryTgtHex:3,primaryTgtSide:2,secondaryTgtHex:2,secondaryTgtSide:2,
    srcVtx:[4,5],primaryVtx:[3,2],secondaryVtx:[2,3],twistParamIndex:2,twistSign:-1};

  // Style lookup
  g.styleLookup=[
    [8,1,6,2,6,0],[8,1,6,2,6,0],
    [8,5,7,4,7,3],[8,5,7,4,7,3]
  ]; // 0-indexed style indices
  return g;
}

function createGluingNonseparatingS2(){
  const g={};
  g.hexCurveIndices=[[0,2,1],[0,2,1],[0,2,1],[0,2,1]]; // L1→side0, L3→side2, L2→side4
  g.noncoherentPairs=[[0,1],[0,2],[1,0],[1,3],[2,0],[2,3],[3,1],[3,2]];
  g.curveCombinations=[
    [[0,0],[1,0],[2,0],[3,0]],  // curve 1 (brown) — side 0 of all hexes, length L1
    [[0,4],[1,4],[2,4],[3,4]],  // curve 2 (purple) — side 4 of all hexes, length L2
    [[0,2],[1,2],[2,2],[3,2]]   // curve 3 (grey)   — side 2 of all hexes, length L3
  ];

  g.pairings=new Array(4);
  for(let i=0;i<4;i++)g.pairings[i]=new Array(6);

  // Simple pairings (sides 1,3,5 — 0-indexed): hex 0↔1, hex 2↔3
  g.pairings[0][1]={type:'simple',tgtHex:1,tgtSide:1,srcVtx:[1,2],tgtVtx:[1,2]};
  g.pairings[0][3]={type:'simple',tgtHex:1,tgtSide:3,srcVtx:[3,4],tgtVtx:[3,4]};
  g.pairings[0][5]={type:'simple',tgtHex:1,tgtSide:5,srcVtx:[5,0],tgtVtx:[5,0]};
  g.pairings[1][1]={type:'simple',tgtHex:0,tgtSide:1,srcVtx:[1,2],tgtVtx:[1,2]};
  g.pairings[1][3]={type:'simple',tgtHex:0,tgtSide:3,srcVtx:[3,4],tgtVtx:[3,4]};
  g.pairings[1][5]={type:'simple',tgtHex:0,tgtSide:5,srcVtx:[5,0],tgtVtx:[5,0]};
  g.pairings[2][1]={type:'simple',tgtHex:3,tgtSide:1,srcVtx:[1,2],tgtVtx:[1,2]};
  g.pairings[2][3]={type:'simple',tgtHex:3,tgtSide:3,srcVtx:[3,4],tgtVtx:[3,4]};
  g.pairings[2][5]={type:'simple',tgtHex:3,tgtSide:5,srcVtx:[5,0],tgtVtx:[5,0]};
  g.pairings[3][1]={type:'simple',tgtHex:2,tgtSide:1,srcVtx:[1,2],tgtVtx:[1,2]};
  g.pairings[3][3]={type:'simple',tgtHex:2,tgtSide:3,srcVtx:[3,4],tgtVtx:[3,4]};
  g.pairings[3][5]={type:'simple',tgtHex:2,tgtSide:5,srcVtx:[5,0],tgtVtx:[5,0]};

  // Twisted pairings (sides 0,2,4 — 0-indexed): all cross between {0,1} and {2,3}
  // Hex 0
  g.pairings[0][0]={type:'twisted',primaryTgtHex:2,primaryTgtSide:0,secondaryTgtHex:3,secondaryTgtSide:0,
    srcVtx:[0,1],primaryVtx:[0,1],secondaryVtx:[1,0],twistParamIndex:0,twistSign:1};
  g.pairings[0][2]={type:'twisted',primaryTgtHex:2,primaryTgtSide:2,secondaryTgtHex:3,secondaryTgtSide:2,
    srcVtx:[2,3],primaryVtx:[2,3],secondaryVtx:[3,2],twistParamIndex:2,twistSign:1};
  g.pairings[0][4]={type:'twisted',primaryTgtHex:2,primaryTgtSide:4,secondaryTgtHex:3,secondaryTgtSide:4,
    srcVtx:[4,5],primaryVtx:[4,5],secondaryVtx:[5,4],twistParamIndex:1,twistSign:1};
  // Hex 1
  g.pairings[1][0]={type:'twisted',primaryTgtHex:3,primaryTgtSide:0,secondaryTgtHex:2,secondaryTgtSide:0,
    srcVtx:[0,1],primaryVtx:[0,1],secondaryVtx:[1,0],twistParamIndex:0,twistSign:-1};
  g.pairings[1][2]={type:'twisted',primaryTgtHex:3,primaryTgtSide:2,secondaryTgtHex:2,secondaryTgtSide:2,
    srcVtx:[2,3],primaryVtx:[2,3],secondaryVtx:[3,2],twistParamIndex:2,twistSign:-1};
  g.pairings[1][4]={type:'twisted',primaryTgtHex:3,primaryTgtSide:4,secondaryTgtHex:2,secondaryTgtSide:4,
    srcVtx:[4,5],primaryVtx:[4,5],secondaryVtx:[5,4],twistParamIndex:1,twistSign:-1};
  // Hex 2
  g.pairings[2][0]={type:'twisted',primaryTgtHex:0,primaryTgtSide:0,secondaryTgtHex:1,secondaryTgtSide:0,
    srcVtx:[0,1],primaryVtx:[0,1],secondaryVtx:[1,0],twistParamIndex:0,twistSign:-1};
  g.pairings[2][2]={type:'twisted',primaryTgtHex:0,primaryTgtSide:2,secondaryTgtHex:1,secondaryTgtSide:2,
    srcVtx:[2,3],primaryVtx:[2,3],secondaryVtx:[3,2],twistParamIndex:2,twistSign:-1};
  g.pairings[2][4]={type:'twisted',primaryTgtHex:0,primaryTgtSide:4,secondaryTgtHex:1,secondaryTgtSide:4,
    srcVtx:[4,5],primaryVtx:[4,5],secondaryVtx:[5,4],twistParamIndex:1,twistSign:-1};
  // Hex 3
  g.pairings[3][0]={type:'twisted',primaryTgtHex:1,primaryTgtSide:0,secondaryTgtHex:0,secondaryTgtSide:0,
    srcVtx:[0,1],primaryVtx:[0,1],secondaryVtx:[1,0],twistParamIndex:0,twistSign:1};
  g.pairings[3][2]={type:'twisted',primaryTgtHex:1,primaryTgtSide:2,secondaryTgtHex:0,secondaryTgtSide:2,
    srcVtx:[2,3],primaryVtx:[2,3],secondaryVtx:[3,2],twistParamIndex:2,twistSign:1};
  g.pairings[3][4]={type:'twisted',primaryTgtHex:1,primaryTgtSide:4,secondaryTgtHex:0,secondaryTgtSide:4,
    srcVtx:[4,5],primaryVtx:[4,5],secondaryVtx:[5,4],twistParamIndex:1,twistSign:1};

  // Style lookup (0-indexed, from MATLAB 1-indexed: 9→8, 3→2, 8→7, 1→0, 7→6, 2→1, 6→5, 4→3, 5→4)
  g.styleLookup=[
    [8,2,7,0,6,1],[8,2,7,0,6,1],
    [8,5,7,3,6,4],[8,5,7,3,6,4]
  ];
  return g;
}

function buildPolytopes(gluing,lengths){
  const polytopes=[];
  for(let i=0;i<4;i++){
    const idx=gluing.hexCurveIndices[i];
    const h=rectangularHexagonCentered(lengths[idx[0]]/2,lengths[idx[1]]/2,lengths[idx[2]]/2);
    polytopes.push(h.vertices);
  }
  return polytopes;
}

function buildCircles(polytopes){
  const circles=[];
  for(let i=0;i<polytopes.length;i++){
    const coll=[];
    for(let s=0;s<6;s++){
      const s2=(s+1)%6;
      const gc=geodesicCircumferenceFromSegment(polytopes[i][s],polytopes[i][s2]);
      coll.push(gc);
    }
    circles.push(coll);
  }
  return circles;
}

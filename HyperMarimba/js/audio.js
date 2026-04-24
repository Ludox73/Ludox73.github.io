"use strict";

// ===== Audio =====
let audioCtx=null;
let audioPlaying=false;
let audioStopRequested=false;

function createMarimbaNote(freq,duration){
  if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  const sr=audioCtx.sampleRate;
  const len=Math.ceil(sr*duration);
  const buffer=audioCtx.createBuffer(1,len,sr);
  const data=buffer.getChannelData(0);
  const attackSamples=Math.round(0.005*sr);

  for(let i=0;i<len;i++){
    const t=i/sr;
    let val=1.0*Math.sin(2*Math.PI*freq*t)*Math.exp(-5*t);
    val+=0.4*Math.sin(2*Math.PI*freq*4.01*t)*Math.exp(-15*t);
    val+=0.15*Math.sin(2*Math.PI*freq*10*t)*Math.exp(-50*t);
    val+=0.1*(Math.random()*2-1)*Math.exp(-100*t);
    if(i<attackSamples)val*=i/attackSamples;
    data[i]=val;
  }
  // Normalize
  let mx=0;
  for(let i=0;i<len;i++)if(Math.abs(data[i])>mx)mx=Math.abs(data[i]);
  if(mx>0)for(let i=0;i<len;i++)data[i]/=mx;
  return buffer;
}

async function playAudio(){
  if(!toMusic||toMusic.length===0)return;
  if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  audioPlaying=true;
  audioStopRequested=false;
  document.getElementById('btn-play').disabled=true;
  document.getElementById('btn-stop-audio').disabled=false;

  const frequencies=[440.00,554.37,659.25];
  const speedMul=parseFloat(document.getElementById('audiospeed').value);
  const maxDur=parseFloat(document.getElementById('maxdur').value);

  // Pre-generate note buffers
  const notes=frequencies.map(f=>createMarimbaNote(f,1.5));

  let elapsed=0;
  for(let i=0;i<toMusic.length;i++){
    if(audioStopRequested)break;
    const dt=toMusic[i][0]/speedMul;
    elapsed+=dt;
    if(elapsed>maxDur)break;

    await new Promise(r=>setTimeout(r,dt*1000));
    if(audioStopRequested)break;

    const noteIdx=toMusic[i][1]-1;
    const src=audioCtx.createBufferSource();
    src.buffer=notes[noteIdx];
    src.connect(audioCtx.destination);
    src.start();

    document.getElementById('audio-info').textContent=`Note ${i+1}/${toMusic.length} — ${elapsed.toFixed(1)}s`;
    if(window.drawMainPartiture)window.drawMainPartiture(i);
  }

  audioPlaying=false;
  document.getElementById('btn-play').disabled=false;
  document.getElementById('btn-stop-audio').disabled=true;
  document.getElementById('audio-info').textContent='Playback finished.';
  if(window.drawMainPartiture)window.drawMainPartiture(-1);
}

function stopAudio(){
  audioStopRequested=true;
}

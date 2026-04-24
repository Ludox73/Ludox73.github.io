"use strict";
// motifs.js — Motif frequency scanning utilities
//
// A music record is an Array of [distanceSinceLast, curveIndex] pairs,
// where distanceSinceLast is a positive hyperbolic length and curveIndex ∈ {1,2,3}.
//
// 2-motif: consecutive pair of notes (k-1, k) where music[k][0] ∈ [a, a+eps]
// 3-motif: consecutive triple (k-2, k-1, k) where
//          d12 = music[k-1][0] ∈ [a, a+eps]  AND  d12+d23 ∈ [a+b, a+b+eps]

// ---------------------------------------------------------------------------
// motifMinInterval(music)
//   Returns the minimum inter-note interval (note[0]) in the music array.
// ---------------------------------------------------------------------------
function motifMinInterval(music) {
  let min = Infinity;
  for (const note of music) if (note[0] < min) min = note[0];
  return min === Infinity ? 0 : min;
}

// ---------------------------------------------------------------------------
// scanMotif2(music, a, eps, nSamples=500)
//   Returns { count, totalDist, freq, samples: [{t, freq}] }
//   Scans for 2-motifs and records running frequency at ~nSamples evenly-
//   spaced geodesic-length checkpoints.
// ---------------------------------------------------------------------------
function scanMotif2(music, a, eps, nSamples = 500, note1 = 0, note2 = 0) {
  if (!music || music.length < 2) return { count: 0, totalDist: 0, freq: 0, samples: [] };
  const totalDist = music.reduce((s, n) => s + n[0], 0);
  if (totalDist === 0) return { count: 0, totalDist: 0, freq: 0, samples: [] };

  const sampleStep = totalDist / nSamples;
  let cumDist = 0, count = 0, nextSample = sampleStep;
  const samples = [];

  for (let k = 1; k < music.length; k++) {
    cumDist += music[k][0];
    const d = music[k][0];
    if (d >= a && d <= a + eps &&
        (note1 === 0 || music[k - 1][1] === note1) &&
        (note2 === 0 || music[k][1] === note2)) count++;
    while (nextSample <= cumDist && nextSample <= totalDist + 1e-12) {
      samples.push({ t: nextSample, freq: count / nextSample });
      nextSample += sampleStep;
    }
  }
  // Always append a final point at the actual end
  if (samples.length === 0 || samples[samples.length - 1].t < totalDist - 1e-12) {
    samples.push({ t: totalDist, freq: count / totalDist });
  }
  return { count, totalDist, freq: count / totalDist, samples };
}

// ---------------------------------------------------------------------------
// scanMotif3(music, a, b, eps, nSamples=500)
//   Returns { count, totalDist, freq, samples: [{t, freq}] }
// ---------------------------------------------------------------------------
function scanMotif3(music, a, b, eps, nSamples = 500, note1 = 0, note2 = 0, note3 = 0) {
  if (!music || music.length < 3) return { count: 0, totalDist: 0, freq: 0, samples: [] };
  const totalDist = music.reduce((s, n) => s + n[0], 0);
  if (totalDist === 0) return { count: 0, totalDist: 0, freq: 0, samples: [] };

  const sampleStep = totalDist / nSamples;
  let cumDist = 0, count = 0, nextSample = sampleStep;
  const samples = [];

  for (let k = 2; k < music.length; k++) {
    cumDist += music[k][0];
    const d12 = music[k - 1][0], d23 = music[k][0];
    if (d12 >= a && d12 <= a + eps && d12 + d23 >= a + b && d12 + d23 <= a + b + eps &&
        (note1 === 0 || music[k - 2][1] === note1) &&
        (note2 === 0 || music[k - 1][1] === note2) &&
        (note3 === 0 || music[k][1] === note3)) count++;
    while (nextSample <= cumDist && nextSample <= totalDist + 1e-12) {
      samples.push({ t: nextSample, freq: count / nextSample });
      nextSample += sampleStep;
    }
  }
  if (samples.length === 0 || samples[samples.length - 1].t < totalDist - 1e-12) {
    samples.push({ t: totalDist, freq: count / totalDist });
  }
  return { count, totalDist, freq: count / totalDist, samples };
}

// ---------------------------------------------------------------------------
// drawMotifFreqGraph(canvasId, seriesList)
//   seriesList: [{ samples: [{t, freq}], color: '#rrggbb' }, ...]
//   Draws a frequency-over-geodesic-length graph on the named canvas.
//   Visual style matches the iso3 freq graph (dark background, monospace labels).
// ---------------------------------------------------------------------------
function drawMotifFreqGraph(canvasId, seriesList) {
  const cv = document.getElementById(canvasId);
  if (!cv || !seriesList || seriesList.length === 0) return;
  const W = cv.width, H = cv.height;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);

  const PAD_L = 72, PAD_R = 12, PAD_T = 12, PAD_B = 32;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  // Collect all samples to find axis ranges
  const allSamples = seriesList.flatMap(s => s.samples);
  if (allSamples.length === 0) return;
  const tMax = Math.max(...allSamples.map(s => s.t));
  const allFreqs = allSamples.map(s => s.freq).filter(v => v > 0);
  const yMax = allFreqs.length > 0 ? Math.max(...allFreqs) * 1.15 : 1;
  const yMin = 0;

  function toX(t) { return PAD_L + (t / tMax) * plotW; }
  function toY(v) { return PAD_T + plotH - ((v - yMin) / (yMax - yMin)) * plotH; }

  // Horizontal grid lines + Y tick labels
  ctx.strokeStyle = '#1e2e4a';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#778899';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const v = yMax * i / yTicks;
    const y = toY(v);
    ctx.beginPath();
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(PAD_L + plotW, y);
    ctx.stroke();
    ctx.fillText(v.toExponential(2), PAD_L - 4, y + 3);
  }

  // Vertical grid lines + X tick labels
  ctx.textAlign = 'center';
  const xStep = Math.pow(10, Math.floor(Math.log10(tMax / 5)));
  for (let t = 0; t <= tMax + xStep * 0.5; t += xStep) {
    if (t > tMax + 1e-6) break;
    const x = toX(Math.min(t, tMax));
    ctx.beginPath();
    ctx.moveTo(x, PAD_T);
    ctx.lineTo(x, PAD_T + plotH);
    ctx.stroke();
    const label = t >= 1000 ? (t / 1000).toFixed(0) + 'k' : t.toFixed(0);
    ctx.fillStyle = '#778899';
    ctx.fillText(label, x, PAD_T + plotH + 14);
  }

  // Axes
  ctx.strokeStyle = '#4466aa';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD_L, PAD_T);
  ctx.lineTo(PAD_L, PAD_T + plotH);
  ctx.lineTo(PAD_L + plotW, PAD_T + plotH);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = '#a0b8d0';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('hyperbolic length', PAD_L + plotW / 2, H - 4);
  ctx.save();
  ctx.translate(12, PAD_T + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('frequency', 0, 0);
  ctx.restore();

  // Draw each series
  for (const series of seriesList) {
    if (!series.samples || series.samples.length < 2) continue;
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    series.samples.forEach((s, i) => {
      const x = toX(s.t), y = toY(s.freq);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

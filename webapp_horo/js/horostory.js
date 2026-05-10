"use strict";

// ============================================================
// horostory.js — Score player, motif analysis, and surface
// comparison features for the horocyclic flow webapp.
// ============================================================

// ─── Partiture drawing ───────────────────────────────────────────────────────

/**
 * drawHoroPartiture(music, canvasId, windowStart, currentIdx, maxTime)
 *
 * Draws a visual score: each note is a vertical coloured line at its
 * cumulative-time x-position within the window. A white vertical line
 * marks the playhead at currentIdx. Canvas is 900×55 logical pixels.
 *
 * @param {Array}  music       — [[distanceSinceLast, curveIndex], ...]
 * @param {string} canvasId
 * @param {number} windowStart — cumulative time at the left edge of the view
 * @param {number} currentIdx  — index of the current note (playhead)
 * @param {number} maxTime     — time window width (horizontal span)
 */
function drawHoroPartiture(music, canvasId, windowStart, currentIdx, maxTime) {
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const W = cv.width, H = cv.height;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);

  if (!music || music.length === 0) return;

  const NOTE_COLORS = ['#cc6644', '#886688', '#668866'];
  const windowEnd = windowStart + maxTime;

  // Build cumulative times
  let cum = 0;
  for (let i = 0; i < music.length; i++) {
    cum += music[i][0];
    if (cum < windowStart - 1e-9) continue;
    if (cum > windowEnd + 1e-9) break;
    const x = Math.round((cum - windowStart) / maxTime * W);
    const ci = music[i][1] - 1;
    ctx.strokeStyle = NOTE_COLORS[Math.max(0, Math.min(2, ci))];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Playhead
  if (currentIdx >= 0 && currentIdx < music.length) {
    let playheadCum = 0;
    for (let i = 0; i <= currentIdx; i++) playheadCum += music[i][0];
    const px = Math.round((playheadCum - windowStart) / maxTime * W);
    if (px >= 0 && px <= W) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
    }
  }
}

// ─── HoroMelodyPlayer ────────────────────────────────────────────────────────

class HoroMelodyPlayer {
  /**
   * @param {object} opts
   * @param {string} opts.playBtnId
   * @param {string} opts.pauseBtnId
   * @param {string} opts.seekId
   * @param {string} opts.infoId
   * @param {string} opts.canvasId
   * @param {string} opts.speedId
   * @param {string} opts.maxTimeId
   */
  constructor({ playBtnId, pauseBtnId, seekId, infoId, canvasId, speedId, maxTimeId }) {
    this.playBtnId  = playBtnId;
    this.pauseBtnId = pauseBtnId;
    this.seekId     = seekId;
    this.infoId     = infoId;
    this.canvasId   = canvasId;
    this.speedId    = speedId;
    this.maxTimeId  = maxTimeId;

    this.music    = null;
    this.noteIdx  = 0;
    this.playing  = false;
    this._stopReq = false;
    this._notes   = null; // pre-generated AudioBuffer array

    // Attach seek listener
    const seekEl = document.getElementById(this.seekId);
    if (seekEl) seekEl.addEventListener('input', () => this.seek(parseInt(seekEl.value)));

    this._updateUI();
  }

  setMusic(music) {
    this.music   = music;
    this.noteIdx = 0;
    this._notes  = null;
    const seekEl = document.getElementById(this.seekId);
    if (seekEl) {
      seekEl.min   = '0';
      seekEl.max   = String(Math.max(0, (music ? music.length - 1 : 0)));
      seekEl.value = '0';
    }
    this._updateUI();
  }

  async play() {
    if (this.playing || !this.music || this.music.length === 0) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (!this._notes) {
      this._notes = [440.00, 554.37, 659.25].map(f => createMarimbaNote(f, 1.5));
    }
    this.playing  = true;
    this._stopReq = false;
    this._updateUI();

    for (let i = this.noteIdx; i < this.music.length; i++) {
      if (this._stopReq) break;
      this.noteIdx = i;

      const speedEl = document.getElementById(this.speedId);
      const speed   = speedEl ? parseFloat(speedEl.value) || 10 : 10;
      const dt      = this.music[i][0] / speed;

      await new Promise(r => setTimeout(r, dt * 1000));
      if (this._stopReq) break;

      // Play note
      try {
        const src = audioCtx.createBufferSource();
        src.buffer = this._notes[this.music[i][1] - 1];
        src.connect(audioCtx.destination);
        src.start();
      } catch (e) { /* ignore */ }

      this._updateUI();
    }

    if (!this._stopReq) {
      // Reached the end
      this.noteIdx = this.music.length - 1;
    }
    this.playing = false;
    this._updateUI();
  }

  pause() {
    this._stopReq = true;
    this.playing  = false;
    this._updateUI();
  }

  seek(val) {
    const idx = parseInt(val);
    if (!this.music || isNaN(idx)) return;
    this.noteIdx = Math.max(0, Math.min(this.music.length - 1, idx));
    const seekEl = document.getElementById(this.seekId);
    if (seekEl) seekEl.value = String(this.noteIdx);
    this._updateUI();
  }

  _updateUI() {
    const hasMusic = !!(this.music && this.music.length > 0);

    const playBtn  = document.getElementById(this.playBtnId);
    const pauseBtn = document.getElementById(this.pauseBtnId);
    const seekEl   = document.getElementById(this.seekId);
    const infoEl   = document.getElementById(this.infoId);

    if (playBtn)  playBtn.disabled  = !hasMusic || this.playing;
    if (pauseBtn) pauseBtn.disabled = !this.playing;
    if (seekEl)   seekEl.disabled   = !hasMusic;

    if (infoEl) {
      if (!hasMusic) {
        infoEl.textContent = '—';
      } else {
        const maxTimeEl = document.getElementById(this.maxTimeId);
        const maxTime   = maxTimeEl ? parseFloat(maxTimeEl.value) || 300 : 300;
        infoEl.textContent = `Note ${this.noteIdx + 1} / ${this.music.length}`;
      }
    }

    // Redraw partiture
    if (hasMusic) {
      const maxTimeEl = document.getElementById(this.maxTimeId);
      const maxTime   = maxTimeEl ? parseFloat(maxTimeEl.value) || 300 : 300;

      // Compute cumulative time at current note
      let cumAtNote = 0;
      for (let i = 0; i <= this.noteIdx && i < this.music.length; i++) {
        cumAtNote += this.music[i][0];
      }
      // Centre the window on the playhead
      const windowStart = Math.max(0, cumAtNote - maxTime * 0.5);
      drawHoroPartiture(this.music, this.canvasId, windowStart, this.noteIdx, maxTime);
    } else {
      drawHoroPartiture(null, this.canvasId, 0, -1, 300);
    }
  }
}

// ─── Main player instance ─────────────────────────────────────────────────────

let mainPlayer;

document.addEventListener('DOMContentLoaded', () => {
  mainPlayer = new HoroMelodyPlayer({
    playBtnId:  'horo-btn-play2',
    pauseBtnId: 'horo-btn-pause',
    seekId:     'horo-seek',
    infoId:     'horo-info',
    canvasId:   'horo-partiture',
    speedId:    'horo-audiospeed2',
    maxTimeId:  'horo-maxtime',
  });
});

// ─── Hook into horoFinish ────────────────────────────────────────────────────

const _origHoroFinish = horoFinish;
horoFinish = function () {
  _origHoroFinish();
  if (horoToMusic && horoToMusic.length > 0) {
    document.getElementById('horo-score-panel').style.display = '';
    mainPlayer.setMusic(horoToMusic);

    const minInt = motifMinInterval(horoToMusic);
    const el2 = document.getElementById('smotif2-min');
    const el3 = document.getElementById('smotif3-min');
    if (el2) el2.textContent = minInt.toFixed(4);
    if (el3) el3.textContent = minInt.toFixed(4);

    // Enable orthospectrum button and reset state so new data is used
    const btnOrth = document.getElementById('btn-orth');
    if (btnOrth) btnOrth.disabled = false;
    if (typeof orthState !== 'undefined') {
      orthState = {initialized:false,xVals:null,fVals:null,lengthGeodesic:0,
                   results:[],percentages:[],snapshots:[],xInit:null,fInit:null};
      const tbody = document.getElementById('orth-table');
      if (tbody) tbody.querySelector('tbody').innerHTML = '';
      const barcSvg = document.getElementById('barcode-svg');
      if (barcSvg) barcSvg.innerHTML = '';
      const orthStatus = document.getElementById('orth-status');
      if (orthStatus) orthStatus.textContent = 'Ready. Click "Estimate Next Element".';
    }

    // Draw initial ECDF of inter-note gaps on the CDF panel
    drawHoroInitialCdf();

    // Draw curve-1 intersection distribution
    drawHoroCurve1Distribution();
  }
};

// ─── Motif functions ─────────────────────────────────────────────────────────

function runHoroMotif2() {
  if (!horoToMusic || horoToMusic.length === 0) {
    const s = document.getElementById('smotif2-status');
    if (s) s.textContent = 'Run horocyclic flow first.';
    return;
  }
  const a    = parseFloat(document.getElementById('smotif2-a').value)   || 0;
  const eps  = parseFloat(document.getElementById('smotif2-eps').value) || 0.1;
  const note1 = parseInt(document.getElementById('smotif2-n1').value)   || 0;
  const note2 = parseInt(document.getElementById('smotif2-n2').value)   || 0;

  const result = scanMotif2(horoToMusic, a, eps, 500, note1, note2);

  const statusEl  = document.getElementById('smotif2-status');
  const resultsEl = document.getElementById('smotif2-results');
  const wrapEl    = document.getElementById('smotif2-plot-wrap');

  if (statusEl)  statusEl.textContent  = `Count: ${result.count}  |  Freq: ${result.freq.toExponential(3)}  |  Total dist: ${result.totalDist.toFixed(2)}`;
  if (resultsEl) resultsEl.style.display = '';
  if (wrapEl)    wrapEl.style.display   = '';

  drawMotifFreqGraph('smotif2-canvas', [{ samples: result.samples, color: '#c9a96e' }]);
}

function runHoroMotif3() {
  if (!horoToMusic || horoToMusic.length === 0) {
    const s = document.getElementById('smotif3-status');
    if (s) s.textContent = 'Run horocyclic flow first.';
    return;
  }
  const a     = parseFloat(document.getElementById('smotif3-a').value)   || 0;
  const b     = parseFloat(document.getElementById('smotif3-b').value)   || 0;
  const eps   = parseFloat(document.getElementById('smotif3-eps').value) || 0.1;
  const note1 = parseInt(document.getElementById('smotif3-n1').value)    || 0;
  const note2 = parseInt(document.getElementById('smotif3-n2').value)    || 0;
  const note3 = parseInt(document.getElementById('smotif3-n3').value)    || 0;

  const result = scanMotif3(horoToMusic, a, b, eps, 500, note1, note2, note3);

  const statusEl  = document.getElementById('smotif3-status');
  const resultsEl = document.getElementById('smotif3-results');
  const wrapEl    = document.getElementById('smotif3-plot-wrap');

  if (statusEl)  statusEl.textContent  = `Count: ${result.count}  |  Freq: ${result.freq.toExponential(3)}  |  Total dist: ${result.totalDist.toFixed(2)}`;
  if (resultsEl) resultsEl.style.display = '';
  if (wrapEl)    wrapEl.style.display   = '';

  drawMotifFreqGraph('smotif3-canvas', [{ samples: result.samples, color: '#7fc0e8' }]);
}

// ─── Compare Two Surfaces ─────────────────────────────────────────────────────

let cmpHoroMusicA = null, cmpHoroMusicB = null;
let cmpPlayerA, cmpPlayerB;

document.addEventListener('DOMContentLoaded', () => {
  cmpPlayerA = new HoroMelodyPlayer({
    playBtnId:  'cmp-btn-play-a',
    pauseBtnId: 'cmp-btn-pause-a',
    seekId:     'cmp-seek-a',
    infoId:     'cmp-info-a',
    canvasId:   'cmp-partiture-a',
    speedId:    'cmp-speed',
    maxTimeId:  'cmp-maxtime',
  });
  cmpPlayerB = new HoroMelodyPlayer({
    playBtnId:  'cmp-btn-play-b',
    pauseBtnId: 'cmp-btn-pause-b',
    seekId:     'cmp-seek-b',
    infoId:     'cmp-info-b',
    canvasId:   'cmp-partiture-b',
    speedId:    'cmp-speed',
    maxTimeId:  'cmp-maxtime',
  });
});

/**
 * _readSurfaceParams(id)  — reads HTML inputs for surface 'a' or 'b'.
 * Returns { gluing, l1, l2, l3, t1, t2, t3, activeCurves }
 */
function _readSurfaceParams(id) {
  const gluingType = document.getElementById(`cmp-${id}-gluing`).value;
  const gluing     = gluingType === 'nonseparating'
                     ? createGluingNonseparatingS2()
                     : createGluingSeparatingS2();
  const l1 = parseFloat(document.getElementById(`cmp-${id}-l1`).value) || 2;
  const l2 = parseFloat(document.getElementById(`cmp-${id}-l2`).value) || 3;
  const l3 = parseFloat(document.getElementById(`cmp-${id}-l3`).value) || 4;
  const t1 = parseFloat(document.getElementById(`cmp-${id}-t1`).value) / 100 * 2 * Math.PI;
  const t2 = parseFloat(document.getElementById(`cmp-${id}-t2`).value) / 100 * 2 * Math.PI;
  const t3 = parseFloat(document.getElementById(`cmp-${id}-t3`).value) / 100 * 2 * Math.PI;
  const curve1 = document.getElementById(`cmp-${id}-curve1`).checked;
  const curve2 = document.getElementById(`cmp-${id}-curve2`).checked;
  const curve3 = document.getElementById(`cmp-${id}-curve3`).checked;
  return { gluing, l1, l2, l3, t1, t2, t3, activeCurves: [curve1, curve2, curve3] };
}

async function runHoroCompare(id) {
  const statusEl = document.getElementById(`cmp-status-${id}`);
  if (statusEl) statusEl.textContent = 'Building surface...';

  const { gluing, l1, l2, l3, t1, t2, t3, activeCurves } = _readSurfaceParams(id);

  const polytopes = buildPolytopes(gluing, [l1, l2, l3]);
  const circles   = buildCircles(polytopes);
  const twists    = [t1, t2, t3];

  // Initial point: barycenter of hex 0
  let bx = 0, by = 0;
  for (let k = 0; k < 6; k++) { bx += polytopes[0][k][0]; by += polytopes[0][k][1]; }
  bx /= 6; by /= 6;
  if (Math.abs(bx) < 1e-6 && Math.abs(by) < 1e-6) { bx += 1e-4; by += 1e-4; }

  const a0  = Math.random() * 2 * Math.PI;
  const sc0 = 5 * (1 - (bx * bx + by * by)) ** 2;

  let curPoint  = [bx, by];
  let curXi     = xiFromTangent(curPoint, [sc0 * Math.cos(a0), -sc0 * Math.sin(a0)]);

  function _initTravelDir(p, xi, t) {
    const h = horocycleFromPtXi(p, xi);
    const tccw_x = -(p[1] - h.center[1]), tccw_y = p[0] - h.center[0];
    return (tccw_x * t[0] + tccw_y * t[1]) >= 0 ? 1 : -1;
  }

  let travelDir = _initTravelDir(curPoint, curXi, [sc0 * Math.cos(a0), -sc0 * Math.sin(a0)]);
  let polyIdx   = 0, toAvoid = 6;

  // Warmup 300 steps
  if (statusEl) statusEl.textContent = 'Warming up...';
  for (let w = 0; w < 300; w++) {
    const inter = horocycleFirstIntersection(curPoint, curXi, travelDir, circles[polyIdx], polytopes[polyIdx], toAvoid);
    if (!inter) {
      const a2 = Math.random() * 2 * Math.PI;
      const t2 = [Math.cos(a2), -Math.sin(a2)];
      curXi = xiFromTangent(curPoint, t2);
      travelDir = _initTravelDir(curPoint, curXi, t2);
      continue;
    }
    const pairing = pairingFromGluing(gluing, polyIdx, inter.side, twists, inter.point, polytopes);
    const pr      = applyPairing(inter.point, inter.tgVec, polyIdx, inter.side, gluing, twists, polytopes);
    const isNC    = isRow([polyIdx, pr.polyIdx], gluing.noncoherentPairs);
    curXi     = updateXi(curXi, pairing, isNC, polytopes);
    curPoint  = pr.point;
    if (isNC) travelDir = -travelDir;
    polyIdx   = pr.polyIdx; toAvoid = pr.toAvoid;
    if (w % 100 === 0) await new Promise(r => setTimeout(r, 0));
  }

  // Active curve combinations (filtered by checkboxes)
  const activeCurveCombinations = gluing.curveCombinations.map((cc, i) =>
    activeCurves[i] ? cc : [[-1, -1]]
  );

  // Main loop — up to 3000 crossings
  const music = [];
  let firstCycle = true, sinceLast = 0, crossings = 0, step = 0;
  if (statusEl) statusEl.textContent = 'Computing...';

  while (crossings < 3000) {
    const inter = horocycleFirstIntersection(curPoint, curXi, travelDir, circles[polyIdx], polytopes[polyIdx], toAvoid);
    if (!inter) break;

    sinceLast += horocycleArcLength(curPoint, inter.point, curXi);
    const pairing = pairingFromGluing(gluing, polyIdx, inter.side, twists, inter.point, polytopes);
    const pr      = applyPairing(inter.point, inter.tgVec, polyIdx, inter.side, gluing, twists, polytopes);
    const isNC    = isRow([polyIdx, pr.polyIdx], gluing.noncoherentPairs);

    let curve = -1;
    for (let c = 0; c < 3; c++) {
      if (activeCurveCombinations[c] && isRow([polyIdx, inter.side], activeCurveCombinations[c])) {
        curve = c; break;
      }
    }
    if (curve >= 0) {
      if (!firstCycle) { music.push([sinceLast, curve + 1]); crossings++; }
      sinceLast = 0; firstCycle = false;
    }

    curXi    = updateXi(curXi, pairing, isNC, polytopes);
    curPoint = pr.point;
    if (isNC) travelDir = -travelDir;
    polyIdx  = pr.polyIdx; toAvoid = pr.toAvoid;
    step++;

    // Yield every 500 steps
    if (step % 500 === 0) {
      if (statusEl) statusEl.textContent = `Computing... ${crossings}/3000`;
      await new Promise(r => setTimeout(r, 0));
    }
  }

  if (statusEl) statusEl.textContent = `Done. ${music.length} crossings.`;

  if (id === 'a') {
    cmpHoroMusicA = music;
    cmpPlayerA.setMusic(music);
  } else {
    cmpHoroMusicB = music;
    cmpPlayerB.setMusic(music);
  }
}

function runCmpMotifAnalysis() {
  const modeEl = document.querySelector('input[name="cmp2-mode"]:checked');
  const mode   = modeEl ? parseInt(modeEl.value) : 2;

  const resultsEl = document.getElementById('cmp2-results');
  const wrapEl    = document.getElementById('cmp2-plot-wrap');

  const a   = parseFloat(document.getElementById('cmp2-a').value)   || 0;
  const eps = parseFloat(document.getElementById('cmp2-eps').value) || 0.1;
  const n1  = parseInt(document.getElementById('cmp2-n1').value)    || 0;
  const n2  = parseInt(document.getElementById('cmp2-n2').value)    || 0;

  let seriesA, seriesB, labelA, labelB;

  if (mode === 2) {
    seriesA = cmpHoroMusicA ? scanMotif2(cmpHoroMusicA, a, eps, 500, n1, n2) : null;
    seriesB = cmpHoroMusicB ? scanMotif2(cmpHoroMusicB, a, eps, 500, n1, n2) : null;
  } else {
    const b  = parseFloat(document.getElementById('cmp2-b').value) || 0;
    const n3 = parseInt(document.getElementById('cmp2-n3').value)  || 0;
    seriesA  = cmpHoroMusicA ? scanMotif3(cmpHoroMusicA, a, b, eps, 500, n1, n2, n3) : null;
    seriesB  = cmpHoroMusicB ? scanMotif3(cmpHoroMusicB, a, b, eps, 500, n1, n2, n3) : null;
  }

  const rows = [];
  if (seriesA) rows.push(`Surface A: count=${seriesA.count}, freq=${seriesA.freq.toExponential(3)}, total dist=${seriesA.totalDist.toFixed(2)}`);
  else         rows.push('Surface A: no data');
  if (seriesB) rows.push(`Surface B: count=${seriesB.count}, freq=${seriesB.freq.toExponential(3)}, total dist=${seriesB.totalDist.toFixed(2)}`);
  else         rows.push('Surface B: no data');

  if (resultsEl) {
    resultsEl.textContent  = rows.join('\n');
    resultsEl.style.display = '';
  }
  if (wrapEl) wrapEl.style.display = '';

  const graphSeries = [];
  if (seriesA && seriesA.samples.length > 1) graphSeries.push({ samples: seriesA.samples, color: '#c9a96e' });
  if (seriesB && seriesB.samples.length > 1) graphSeries.push({ samples: seriesB.samples, color: '#7fc0e8' });
  if (graphSeries.length > 0) drawMotifFreqGraph('cmp2-canvas', graphSeries);
}

// ─── CDF of inter-note gaps ───────────────────────────────────────────────────

/**
 * Draw the ECDF of inter-note gap lengths on the #cdf-svg element.
 * Called automatically after the horocyclic flow finishes.
 */
function drawHoroInitialCdf() {
  const svgEl = document.getElementById('cdf-svg');
  if (!svgEl || !horoToMusic || horoToMusic.length === 0) return;
  const ecdf = computeCumufunFromToMusic(horoToMusic);
  const cfg  = svgCdfSetup(Math.min(30, ecdf.x[ecdf.x.length-1] * 1.05), 0, 1.05);
  const MAX  = 500000;
  const ds   = downsampleForViz(ecdf.x, ecdf.f, MAX);
  svgEl.innerHTML = buildSvgChart(
    [{x: ds.x, f: ds.f, color: '#c9a96e', label: 'ECDF of gap lengths'}],
    `Inter-note gap distribution  (n = ${horoToMusic.length} crossings)`,
    cfg
  );
}

// ─── Curve-1 intersection distribution ───────────────────────────────────────

/**
 * Compute the hyperbolic arc length along curve 1 from its "canonical start"
 * to the crossing point.
 *
 * Key insight: hex 0 and hex 1 share identical vertices (glued on odd sides
 * via identity maps), and similarly hex 2 and hex 3.  So side 0 of hex 0
 * and side 0 of hex 1 are the **same** geodesic on the surface, crossed from
 * opposite sides by the horocycle.  We must collapse these pairs so that
 * crossings from both sides land at the same x-position in the scatter plot.
 */
function curve1Position(pt, hex, side, gluing, polytopes) {
  const cc = gluing.curveCombinations[0];

  // Canonical representative: odd hex → previous even hex (1→0, 3→2).
  const canonHex = (hex % 2 === 1) ? hex - 1 : hex;

  // Build unique segment list, skipping the duplicate (odd-hex) entries.
  let offset = 0;
  for (const [h, s] of cc) {
    if (h % 2 === 1) continue;                 // skip odd-hex duplicates
    const v1  = polytopes[h][s];
    const v2  = polytopes[h][(s + 1) % 6];
    const len = distanceTwoPoints(v1, v2);
    if (h === canonHex && s === side) {
      // Use canonical hex vertices (identical to odd-hex vertices)
      return offset + distanceTwoPoints(pt, v1);
    }
    offset += len;
  }
  return offset;
}

/**
 * Compute the intrinsic crossing angle between the horocycle and the geodesic
 * at an intersection point on curve 1.
 *
 * Raw atan2(ξ) is in global Poincaré-disk coordinates; different hexagon sides
 * sit at different orientations in the disk, creating a visible discontinuity at
 * segment boundaries.  Instead we compute the signed angle from the geodesic
 * tangent to the horocycle tangent at the crossing point.  The Poincaré disk is
 * conformal, so this Euclidean angle equals the hyperbolic one — it is a
 * Möbius-invariant quantity, continuous across gluings.
 *
 *   pt        — crossing point in Poincaré disk
 *   xi        — ideal point ξ ∈ S¹ of the horocycle
 *   travelDir — +1 (CCW) or -1 (CW) interior travel direction
 *   hex, side — hexagon index and side index of the crossing
 *   polytopes — vertex arrays
 */
function crossingAngle(pt, xi, travelDir, hex, side, polytopes) {
  // ── Horocycle tangent at pt ────────────────────────────────────────────────
  const horo = horocycleFromPtXi(pt, xi);
  const hrx = pt[0] - horo.center[0], hry = pt[1] - horo.center[1];
  const htx = travelDir > 0 ? -hry :  hry;   // CCW: 90° left of radius
  const hty = travelDir > 0 ?  hrx : -hrx;

  // ── Geodesic tangent at pt (oriented v_s → v_{s+1}) ───────────────────────
  const h  = (hex % 2 === 1) ? hex - 1 : hex;
  const v1 = polytopes[h][side], v2 = polytopes[h][(side + 1) % 6];
  const gc = geodesicCircumferenceFromSegment(v1, v2);
  const grx = pt[0] - gc.center[0], gry = pt[1] - gc.center[1];
  // Two perpendicular candidates: (-gry,grx) and (gry,-grx).
  // Pick the one consistent with v1 → v2 arc direction.
  const dv = [(v2[0] - gc.center[0]), (v2[1] - gc.center[1])];
  const dp = [grx, gry];
  const cross_vp = dp[0]*dv[1] - dp[1]*dv[0];
  const gtx = cross_vp > 0 ? -gry :  gry;
  const gty = cross_vp > 0 ?  grx : -grx;

  // ── Signed angle (geodesic tangent → horocycle tangent) ────────────────────
  return Math.atan2(htx*gty - hty*gtx, htx*gtx + hty*gty);
}

/**
 * Draw the Curve-1 intersection distribution scatter plot and 1-D histograms.
 * Uses horoDistData (set during flow computation) and horoGluingG / horoPolytopesG.
 */
function drawHoroCurve1Distribution() {
  const canvas = document.getElementById('horo-dist-canvas');
  if (!canvas || !horoDistData || horoDistData.length === 0) return;
  if (!horoGluingG || !horoPolytopesG) return;

  const D = horoDistData;

  // Compute positions along curve 1 and intrinsic crossing angles.
  // Odd hexes (1, 3) cross the geodesic from the opposite side of even hexes
  // (0, 2).  The NC pairing flips both ξ and travelDir, which conspire to keep
  // the raw crossing angle in the same half-plane.  To distinguish the two
  // sides on the surface we flip travelDir for odd hexes, undoing the NC
  // compensation so that crossings from opposite sides get opposite signs.
  const pts = D.map(d => {
    const effectiveDir = (d.hex % 2 === 1) ? -d.dir : d.dir;
    return {
      pos:  curve1Position(d.pt, d.hex, d.side, horoGluingG, horoPolytopesG),
      xiA:  crossingAngle(d.pt, d.xi, effectiveDir, d.hex, d.side, horoPolytopesG),
      time: d.time,
    };
  });

  // Convert position (arc length) to angle in [0, 2π]
  const posMax = Math.max(...pts.map(p => p.pos));
  if (posMax > 0) for (const p of pts) p.pos = 2 * Math.PI * p.pos / posMax;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = {l: 70, r: 80, t: 36, b: 50};
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

  const tx = v => pad.l + (v / (2 * Math.PI)) * pw;
  const ty = v => pad.t + (1 - (v + Math.PI) / (2 * Math.PI)) * ph;

  // Log-scale colour for time
  const times = pts.map(p => p.time).filter(t => t > 0);
  const logMin = times.length ? Math.log10(Math.min(...times)) : 0;
  const logMax = times.length ? Math.log10(Math.max(...times)) : 1;
  function rgbFromLog(t) {
    if (t <= 0) return [34, 34, 34];
    const frac = Math.max(0, Math.min(1, (Math.log10(t) - logMin) / (logMax - logMin || 1)));
    return [
      Math.round(255 * Math.min(1, Math.max(0, 1.5*frac - 0.5))),
      Math.round(255 * Math.min(1, Math.max(0, frac < 0.5 ? 2*frac : 1))),
      Math.round(255 * Math.max(0, 1 - 1.5*frac)),
    ];
  }

  // Background + grid
  ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1a2a4a'; ctx.lineWidth = 1;
  for (const gx of [0, Math.PI/2, Math.PI, 3*Math.PI/2, 2*Math.PI]) {
    ctx.beginPath(); ctx.moveTo(tx(gx), pad.t); ctx.lineTo(tx(gx), pad.t+ph); ctx.stroke();
  }
  for (const gy of [-Math.PI, -Math.PI/2, 0, Math.PI/2, Math.PI]) {
    ctx.beginPath(); ctx.moveTo(pad.l, ty(gy)); ctx.lineTo(pad.l+pw, ty(gy)); ctx.stroke();
  }

  // Scatter via ImageData for speed
  const img = ctx.getImageData(0, 0, W, H);
  const px  = img.data;
  for (const p of pts) {
    const sx = Math.round(tx(p.pos));
    const sy = Math.round(ty(p.xiA));
    if (sx < pad.l || sx >= pad.l+pw || sy < pad.t || sy >= pad.t+ph) continue;
    const c = rgbFromLog(p.time);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const px2 = sx+dx, py2 = sy+dy;
      if (px2 >= 0 && px2 < W && py2 >= 0 && py2 < H) {
        const off = (py2*W + px2)*4;
        px[off] = c[0]; px[off+1] = c[1]; px[off+2] = c[2]; px[off+3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  // Axis labels
  ctx.fillStyle = '#888'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
  for (const [gx, lbl] of [[0,'0'], [Math.PI/2,'π/2'], [Math.PI,'π'], [3*Math.PI/2,'3π/2'], [2*Math.PI,'2π']]) {
    ctx.fillText(lbl, tx(gx), pad.t + ph + 20);
  }
  ctx.textAlign = 'right';
  for (const [gy, lbl] of [[-Math.PI,'−π'], [-Math.PI/2,'−π/2'], [0,'0'], [Math.PI/2,'π/2'], [Math.PI,'π']]) {
    ctx.fillText(lbl, pad.l - 4, ty(gy) + 4);
  }

  // Colorbar on right side
  const cbX = W - pad.r + 16, cbW = 18, cbH = ph;
  for (let i = 0; i < cbH; i++) {
    const frac = 1 - i / cbH;
    const t = Math.pow(10, logMin + (logMax - logMin) * frac);
    const c = rgbFromLog(t);
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fillRect(cbX, pad.t + i, cbW, 1);
  }
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.strokeRect(cbX, pad.t, cbW, cbH);
  ctx.fillStyle = '#888'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
  const nCbLabels = 5;
  for (let i = 0; i <= nCbLabels; i++) {
    const frac = 1 - i / nCbLabels;
    const val = Math.pow(10, logMin + (logMax - logMin) * frac);
    ctx.fillText(val.toFixed(1), cbX + cbW + 4, pad.t + i / nCbLabels * cbH + 5);
  }

  // Title and axis labels
  ctx.fillStyle = '#c9a96e'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Curve-1 crossings  (${D.length} points)`, pad.l, pad.t - 12);
  ctx.fillStyle = '#888'; ctx.textAlign = 'center';
  ctx.fillText('Angle along curve 1', pad.l + pw/2, H - 8);
  ctx.save(); ctx.translate(16, pad.t + ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('Crossing angle', 0, 0); ctx.restore();

  // Update status
  const statusEl = document.getElementById('horo-dist-status');
  if (statusEl) statusEl.textContent = `${D.length} crossings plotted. Color = travel time (log scale).`;

  // Crossing-angle PDF + CDF chart
  drawCrossingAngleDistribution(pts);
}

function drawCrossingAngleDistribution(pts) {
  const cv = document.getElementById('horo-dist-hist');
  if (!cv || pts.length === 0) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const pad = {l: 60, r: 70, t: 40, b: 50};
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

  const tMin = -Math.PI, tMax = Math.PI;
  const nBins = 100;
  const binW = (tMax - tMin) / nBins;
  const n = pts.length;

  // Build histogram of crossing angles
  const counts = new Array(nBins).fill(0);
  for (const p of pts) {
    const b = Math.floor((p.xiA - tMin) / binW);
    if (b >= 0 && b < nBins) counts[b]++;
  }

  // CDF from cumulative histogram (at bin edges)
  const cumsum = new Array(nBins + 1).fill(0);
  for (let i = 0; i < nBins; i++) cumsum[i + 1] = cumsum[i] + counts[i];
  const cdfXpts = Array.from({length: nBins + 1}, (_, i) => tMin + i * binW);
  const cdfFpts = cumsum.map(c => c / n);

  // PDF density
  const density = counts.map(c => c / (n * binW));
  const pdfMax = Math.max(...density, 1e-10);

  const tx = v => pad.l + (v - tMin) / (tMax - tMin) * pw;
  const tyCdf = v => pad.t + (1 - v) * ph;
  const tyPdf = v => pad.t + (1 - v / pdfMax) * ph;

  // Background
  ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = '#1a2a4a'; ctx.lineWidth = 1;
  for (const gx of [-Math.PI, -Math.PI/2, 0, Math.PI/2, Math.PI]) {
    ctx.beginPath(); ctx.moveTo(tx(gx), pad.t); ctx.lineTo(tx(gx), pad.t + ph); ctx.stroke();
  }
  for (let gy = 0; gy <= 1.01; gy += 0.2) {
    ctx.beginPath(); ctx.moveTo(pad.l, tyCdf(gy)); ctx.lineTo(pad.l + pw, tyCdf(gy)); ctx.stroke();
  }

  // PDF: filled bars + polyline
  ctx.fillStyle = 'rgba(255,136,68,0.2)';
  for (let i = 0; i < nBins; i++) {
    const x0 = tx(tMin + i * binW), x1 = tx(tMin + (i + 1) * binW);
    const y0 = tyPdf(density[i]);
    ctx.fillRect(x0, y0, x1 - x0, pad.t + ph - y0);
  }
  ctx.strokeStyle = '#ff8844'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < nBins; i++) {
    const x = tx(tMin + (i + 0.5) * binW), y = tyPdf(density[i]);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // CDF: step function
  ctx.strokeStyle = '#4488ff'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx(tMin), tyCdf(0));
  for (let i = 0; i <= nBins; i++) {
    const x = tx(cdfXpts[i]), y = tyCdf(cdfFpts[i]);
    ctx.lineTo(x, y);
    if (i < nBins) ctx.lineTo(tx(cdfXpts[i + 1]), y);
  }
  ctx.stroke();

  // X-axis labels
  ctx.fillStyle = '#888'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
  for (const [v, lbl] of [[-Math.PI, '−π'], [-Math.PI/2, '−π/2'], [0, '0'], [Math.PI/2, 'π/2'], [Math.PI, 'π']])
    ctx.fillText(lbl, tx(v), pad.t + ph + 20);

  // Left axis (CDF)
  ctx.textAlign = 'right'; ctx.fillStyle = '#4488ff';
  for (let gy = 0; gy <= 1.01; gy += 0.2) ctx.fillText(gy.toFixed(1), pad.l - 6, tyCdf(gy) + 5);

  // Right axis (PDF)
  ctx.textAlign = 'left'; ctx.fillStyle = '#ff8844';
  for (let i = 0; i <= 5; i++) {
    const v = i / 5 * pdfMax;
    ctx.fillText(v.toFixed(2), pad.l + pw + 6, tyPdf(v) + 5);
  }

  // Axis titles
  ctx.fillStyle = '#c9a96e'; ctx.font = '15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Crossing angle distribution  (${n} points)`, pad.l, pad.t - 14);
  ctx.fillStyle = '#888'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Crossing angle', pad.l + pw/2, H - 8);
  ctx.save(); ctx.fillStyle = '#4488ff'; ctx.translate(14, pad.t + ph/2); ctx.rotate(-Math.PI/2); ctx.fillText('CDF', 0, 0); ctx.restore();
  ctx.save(); ctx.fillStyle = '#ff8844'; ctx.translate(W - 14, pad.t + ph/2); ctx.rotate(Math.PI/2); ctx.fillText('density', 0, 0); ctx.restore();

  // Legend
  ctx.fillStyle = '#4488ff'; ctx.fillRect(pad.l, pad.t + 8, 18, 3);
  ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#4488ff'; ctx.fillText('CDF', pad.l + 22, pad.t + 13);
  ctx.fillStyle = '#ff8844'; ctx.fillRect(pad.l + 65, pad.t + 8, 18, 3);
  ctx.fillStyle = '#ff8844'; ctx.fillText('PDF', pad.l + 87, pad.t + 13);
}

// ─── Orthospectrum wrapper ────────────────────────────────────────────────────

/**
 * Wrapper around computeNextOrthElement() from orthospectrum.js.
 * Sets the global `toMusic` to the horocyclic flow music data so that the
 * existing orthospectrum routines work without modification.
 */
function horoComputeNextOrthElement() {
  if (!horoToMusic || horoToMusic.length === 0) {
    const s = document.getElementById('orth-status');
    if (s) s.textContent = 'Run horocyclic flow first.';
    return;
  }
  // The orthospectrum routines in orthospectrum.js read from the global `toMusic`.
  window.toMusic = horoToMusic;
  computeNextOrthElement();
}

function horoShowOrthInitialSum() {
  window.toMusic = horoToMusic || [];
  showOrthInitialSum();
}

// ─── Collapsible sub-panel toggle ────────────────────────────────────────────

function toggleSubPanel(headerId) {
  const header = document.getElementById(headerId);
  if (!header) return;
  const body = header.nextElementSibling;
  if (!body || !body.classList.contains('iso-sub-body')) return;
  // body.style.display starts as '' (CSS sets display:none via stylesheet rule,
  // not inline). Check for explicitly set 'block' to determine open state.
  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? '' : 'block';
  header.classList.toggle('iso-sub-open', !isOpen);
}

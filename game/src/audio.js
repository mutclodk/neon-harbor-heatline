/**
 * NEON HARBOR: HEATLINE procedural audio engine.
 * Pure Web Audio API using oscillators and gain nodes only.
 */

export function createAudio() {
  let ctx = null;
  let masterGain = null;
  let muted = false;

  // Engine synthesizer
  let engineOsc = null;
  let engineGain = null;
  let engineActive = false;

  // Siren synthesizer
  let sirenOsc = null;
  let sirenGain = null;
  let sirenActive = false;
  let sirenTimer = null;
  let sirenHigh = false;

  function initCtx() {
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      ctx = new AudioContextClass();
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(muted ? 0 : 0.6, ctx.currentTime);
      masterGain.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  function unlock() {
    initCtx();
  }

  function setMuted(val) {
    muted = !!val;
    if (!ctx || !masterGain) return;
    masterGain.gain.setValueAtTime(muted ? 0 : 0.6, ctx.currentTime);
  }

  function ensureEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.setValueAtTime(0, ctx.currentTime);
    engineOsc.frequency.setValueAtTime(55, ctx.currentTime);
    engineOsc.connect(engineGain);
    engineGain.connect(masterGain);
    try {
      engineOsc.start();
    } catch {}
  }

  function setEngine(level, driving) {
    if (!ctx || muted) return;
    if (!driving || level <= 0.01) {
      if (engineGain) {
        engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      }
      engineActive = false;
      return;
    }
    ensureEngine();
    if (!engineOsc || !engineGain) return;
    engineActive = true;
    const clampedLevel = Math.max(0, Math.min(1, level));
    const targetFreq = 48 + clampedLevel * 140;
    const targetGain = 0.05 + clampedLevel * 0.12;
    engineOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.05);
    engineGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05);
  }

  function ensureSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenGain = ctx.createGain();
    sirenGain.gain.setValueAtTime(0, ctx.currentTime);
    sirenOsc.frequency.setValueAtTime(650, ctx.currentTime);
    sirenOsc.connect(sirenGain);
    sirenGain.connect(masterGain);
    try {
      sirenOsc.start();
    } catch {}
  }

  function setSiren(active, stars = 1) {
    if (!ctx) return;
    if (!active || stars <= 0 || muted) {
      if (sirenGain) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
      sirenActive = false;
      if (sirenTimer) {
        clearInterval(sirenTimer);
        sirenTimer = null;
      }
      return;
    }

    ensureSiren();
    if (!sirenOsc || !sirenGain) return;

    if (!sirenActive) {
      sirenActive = true;
      sirenGain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.05);
      const intervalMs = Math.max(160, 420 - stars * 50);
      sirenTimer = setInterval(() => {
        if (!ctx || !sirenOsc || !sirenActive || muted) return;
        sirenHigh = !sirenHigh;
        const freq = sirenHigh ? 820 : 620;
        sirenOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.04);
      }, intervalMs);
    }
  }

  function blip(name) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(masterGain);

    if (name === 'collect' || name === 'checkpoint') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.14);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (name === 'cash') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.06);
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (name === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.08);
      osc.frequency.setValueAtTime(659.25, now + 0.16);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (name === 'fail' || name === 'bust') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.28);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.31);
    } else {
      // click or fallback
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  return {
    unlock,
    setEngine,
    setSiren,
    blip,
    setMuted
  };
}

// Synthesized WebAudio sound engine: dynamic vehicle engine, police siren, gunshots, tire skids, and synthwave radio.
// Pure procedural audio - zero external audio files.

export function createAudioSystem() {
  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;

  let engineOsc = null;
  let engineFilter = null;
  let engineGain = null;

  let sirenOsc = null;
  let sirenLfo = null;
  let sirenGain = null;

  let isRadioPlaying = false;
  let radioInterval = null;

  function init() {
    if (ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      ctx = new AudioContext();

      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.7, ctx.currentTime);
      masterGain.connect(ctx.destination);

      sfxGain = ctx.createGain();
      sfxGain.gain.setValueAtTime(0.85, ctx.currentTime);
      sfxGain.connect(masterGain);

      musicGain = ctx.createGain();
      musicGain.gain.setValueAtTime(0.45, ctx.currentTime);
      musicGain.connect(masterGain);

      setupEngineSynth();
      setupSirenSynth();
    } catch {
      // Audio not permitted or headless
    }
  }

  function setupEngineSynth() {
    if (!ctx) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.setValueAtTime(55, ctx.currentTime);

    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.setValueAtTime(220, ctx.currentTime);

    engineGain = ctx.createGain();
    engineGain.gain.setValueAtTime(0, ctx.currentTime);

    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(sfxGain);

    engineOsc.start();
  }

  function setupSirenSynth() {
    if (!ctx) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sawtooth';
    sirenOsc.frequency.setValueAtTime(750, ctx.currentTime);

    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'sine';
    sirenLfo.frequency.setValueAtTime(0.8, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(220, ctx.currentTime);
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);

    sirenGain = ctx.createGain();
    sirenGain.gain.setValueAtTime(0, ctx.currentTime);

    sirenOsc.connect(sirenGain);
    sirenGain.connect(sfxGain);

    sirenOsc.start();
    sirenLfo.start();
  }

  function updateEngine(speed, maxSpeed, isDriving) {
    if (!ctx || !engineGain) return;
    if (ctx.state === 'suspended') ctx.resume();

    if (!isDriving) {
      engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      return;
    }

    const ratio = Math.min(1.0, Math.abs(speed) / (maxSpeed || 35));
    const targetFreq = 45 + ratio * 160;
    const targetCutoff = 180 + ratio * 600;

    engineOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.08);
    engineFilter.frequency.setTargetAtTime(targetCutoff, ctx.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(0.22, ctx.currentTime, 0.05);
  }

  function updateSiren(hasActiveChase) {
    if (!ctx || !sirenGain) return;
    if (hasActiveChase) {
      sirenGain.gain.setTargetAtTime(0.25, ctx.currentTime, 0.2);
    } else {
      sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    }
  }

  function playGunshot() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;
    // Noise burst
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.14);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    noise.start(t);
  }

  function playImpact(impulse = 10) {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);

    const gain = ctx.createGain();
    const vol = Math.min(0.9, impulse * 0.05);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(t);
    osc.stop(t + 0.26);
  }

  function playTireScreech() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, t);
    filter.Q.setValueAtTime(4.0, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    noise.start(t);
  }

  function playCashChime() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;
    const notes = [659.25, 830.61, 987.77]; // E5, G#5, B5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.06 + 0.3);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.32);
    });
  }

  function playMissionFanfare() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.12);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.5);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.55);
    });
  }

  function startSynthwaveRadio() {
    if (!ctx || isRadioPlaying) return;
    isRadioPlaying = true;

    // 80s Coastal Synthwave 4-chord pad progression: F#m7 -> Dmaj7 -> Bm7 -> C#m7
    const chords = [
      [185.0, 220.0, 277.18, 329.63], // F#m7
      [146.83, 220.0, 277.18, 369.99], // Dmaj7
      [123.47, 185.0, 220.0, 293.66], // Bm7
      [138.59, 207.65, 246.94, 329.63], // C#m7
    ];
    let step = 0;

    radioInterval = setInterval(() => {
      if (!ctx || !isRadioPlaying) return;
      const t = ctx.currentTime;
      const currentChord = chords[step % chords.length];
      step++;

      currentChord.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.005, t + 2.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);

        osc.start(t);
        osc.stop(t + 2.9);
      });
    }, 2800);
  }

  function stopSynthwaveRadio() {
    isRadioPlaying = false;
    if (radioInterval) {
      clearInterval(radioInterval);
      radioInterval = null;
    }
  }

  return {
    init,
    updateEngine,
    updateSiren,
    playGunshot,
    playImpact,
    playTireScreech,
    playCashChime,
    playMissionFanfare,
    startSynthwaveRadio,
    stopSynthwaveRadio,
  };
}

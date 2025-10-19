// libs/gunshot.js
let audioCtx = null;
let sampleBuffer = null;
let loadingPromise = null;

/**
 * Ensure an AudioContext exists.
 * Returns the cached context.
 */
export async function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Load and decode a sample into memory.
 * Returns the decoded AudioBuffer or throws on failure.
 * Calling loadGunshot multiple times will reuse an ongoing fetch/decode.
 */
export async function loadGunshot(url = "/gunshot.wav") {
  if (sampleBuffer) return sampleBuffer;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ctx = await initAudio();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const arr = await res.arrayBuffer();

    // decodeAudioData returns a Promise in modern browsers
    const decoded = await ctx.decodeAudioData(arr);
    sampleBuffer = decoded;
    loadingPromise = null;
    return sampleBuffer;
  })();

  return loadingPromise;
}

/**
 * Play the gunshot sound.
 * If the sample is loaded it plays the buffer; otherwise synthesizes a short shot.
 * Safe to call repeatedly; function returns immediately (play is async internally).
 */
export function playGunshot({ volume = 0.9 } = {}) {
  try {
    if (!audioCtx)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;

    if (sampleBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = sampleBuffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      src.connect(gain).connect(ctx.destination);
      src.start();
      return;
    }

    // Fallback synth — quick noise + thump (keeps same behavior as before)
    const now = ctx.currentTime;
    const duration = 0.22;

    // noise burst
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, 2);
      data[i] = (Math.random() * 2 - 1) * env * 0.6;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    // low thump
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + duration);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.8 * volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(noiseGain).connect(ctx.destination);
    osc.connect(oscGain).connect(ctx.destination);
    noise.start(now);
    osc.start(now);
    noise.stop(now + duration);
    osc.stop(now + duration);
  } catch (err) {
    if (typeof console !== "undefined" && console.debug)
      console.debug("playGunshot error", err);
  }
}

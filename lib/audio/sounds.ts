// Procedural card-table sounds, synthesized with the Web Audio API.
//
// Design constraints (deliberate, don't "improve" them away):
//   * Every sound is built ONLY from filtered noise bursts — no oscillators.
//     Pure tones are what makes UI audio feel electronic; band-limited noise
//     reads as paper, felt, and card stock.
//   * A master lowpass ceiling at ~3.8 kHz keeps harsh high frequencies out,
//     and the master gain is low — these are quiet, subtle sounds.
//   * Every burst gets random playback-rate/gain/filter jitter plus a random
//     read offset into the shared noise buffer, so no two plays are ever
//     bit-identical — like real cards.
//
// The engine is a safe no-op wherever Web Audio is unavailable (SSR, jsdom
// tests, ancient browsers). The AudioContext is created lazily on the first
// play, which always happens inside a user gesture (click/drag), satisfying
// autoplay policies; we still try resume() in case the context got suspended.

export type SoundKind =
  | "place"
  | "flick"
  | "shuffle"
  | "undo"
  | "pickup"
  | "win";

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
}

let engine: Engine | null | undefined;

/** Minimum spacing between same-kind triggers so double-fired events don't
 *  smear. Tracked per kind: a win fan must not be swallowed just because the
 *  final auto-complete place landed a few milliseconds earlier. */
const MIN_GAP_MS = 25;
const lastPlayAt = new Map<SoundKind, number>();

const MASTER_GAIN = 0.22;
const CEILING_HZ = 3800;

function getEngine(): Engine | null {
  if (engine !== undefined) {
    if (engine && engine.ctx.state === "suspended") {
      void engine.ctx.resume().catch(() => undefined);
    }
    return engine;
  }
  if (typeof window === "undefined") {
    // SSR: stay undefined so a later client call can still initialize.
    return null;
  }
  const AC =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) {
    engine = null;
    return null;
  }
  try {
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    const ceiling = ctx.createBiquadFilter();
    ceiling.type = "lowpass";
    ceiling.frequency.value = CEILING_HZ;
    master.connect(ceiling);
    ceiling.connect(ctx.destination);

    // One second of shared white noise; bursts read random slices of it.
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    engine = { ctx, master, noise };
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
    return engine;
  } catch {
    engine = null;
    return null;
  }
}

/** Random value in [base − spread, base + spread]. */
function jitter(base: number, spread: number): number {
  return base + (Math.random() * 2 - 1) * spread;
}

interface BurstOpts {
  /** Start time offset from "now", in seconds. */
  at: number;
  /** Envelope length in seconds (attack + decay). */
  dur: number;
  /** Peak envelope gain (pre-master). */
  gain: number;
  type: BiquadFilterType;
  freq: number;
  q?: number;
  /** Attack time in seconds; defaults to a near-instant 4 ms. */
  attack?: number;
}

function burst(e: Engine, base: number, o: BurstOpts): void {
  const t = base + o.at;
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  // ±12% speed variation shifts the noise coloration slightly per play.
  src.playbackRate.value = jitter(1, 0.12);

  const filter = e.ctx.createBiquadFilter();
  filter.type = o.type;
  filter.frequency.value = jitter(o.freq, o.freq * 0.1);
  filter.Q.value = o.q ?? 0.9;

  const g = e.ctx.createGain();
  const attack = o.attack ?? 0.004;
  const peak = Math.max(0.0002, o.gain * jitter(1, 0.18));
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

  src.connect(filter);
  filter.connect(g);
  g.connect(e.master);

  const offset = Math.random() * (e.noise.duration - o.dur - 0.1);
  src.start(t, Math.max(0, offset), o.dur + 0.05);
  src.stop(t + o.dur + 0.1);
}

/* ---------- Recipes ---------- */

/** Card laid on the table: a dull contact tap under a short felt slide. */
function place(e: Engine, now: number, v: number): void {
  burst(e, now, {
    at: 0,
    dur: 0.07,
    gain: 0.4 * v,
    type: "bandpass",
    freq: 1300,
    q: 0.8,
    attack: 0.006,
  });
  burst(e, now, {
    at: 0.014,
    dur: 0.025,
    gain: 0.9 * v,
    type: "lowpass",
    freq: 620,
  });
}

/** Card flicked over / drawn from the stock: a crisp but muted snap. */
function flick(e: Engine, now: number, v: number): void {
  burst(e, now, {
    at: 0,
    dur: 0.03,
    gain: 0.7 * v,
    type: "bandpass",
    freq: 1700,
    q: 1.1,
    attack: 0.003,
  });
  burst(e, now, {
    at: 0.006,
    dur: 0.014,
    gain: 0.55 * v,
    type: "lowpass",
    freq: 850,
  });
}

/** Riffle: a short run of uneven flicks, fading out. */
function shuffle(e: Engine, now: number, v: number): void {
  let at = 0;
  const count = 6;
  for (let i = 0; i < count; i++) {
    const fade = 1 - (i / count) * 0.55;
    burst(e, now, {
      at,
      dur: 0.028,
      gain: 0.55 * fade * v,
      type: "bandpass",
      freq: jitter(1550, 350),
      q: 1.0,
      attack: 0.003,
    });
    at += jitter(0.033, 0.011);
  }
}

/** Card slid back off the pile: soft friction, gentle onset. */
function undo(e: Engine, now: number, v: number): void {
  burst(e, now, {
    at: 0,
    dur: 0.08,
    gain: 0.45 * v,
    type: "bandpass",
    freq: 950,
    q: 0.7,
    attack: 0.025,
  });
}

/** Card lifted off the felt: barely-there friction. */
function pickup(e: Engine, now: number, v: number): void {
  burst(e, now, {
    at: 0,
    dur: 0.05,
    gain: 0.35 * v,
    type: "bandpass",
    freq: 1050,
    q: 0.7,
    attack: 0.008,
  });
}

/** Win: a fan of cards riffled shut — accelerating flicks, then a settle. */
function win(e: Engine, now: number, v: number): void {
  let at = 0;
  const count = 12;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    burst(e, now, {
      at,
      dur: 0.026,
      gain: (0.5 - t * 0.22) * v,
      type: "bandpass",
      freq: jitter(1250, 300),
      q: 1.0,
      attack: 0.003,
    });
    // Gaps shrink from ~60ms to ~24ms — the fan snapping closed.
    at += 0.06 - t * 0.036;
  }
  burst(e, now, {
    at: at + 0.03,
    dur: 0.03,
    gain: 0.8 * v,
    type: "lowpass",
    freq: 600,
  });
}

const RECIPES: Record<
  SoundKind,
  (e: Engine, now: number, volume: number) => void
> = {
  place,
  flick,
  shuffle,
  undo,
  pickup,
  win,
};

/**
 * Play a sound. `volume` scales the recipe's internal gains (0..1) — the
 * auto-complete cascade uses it to sit further back than manual moves.
 * Silently does nothing when Web Audio is unavailable.
 */
export function playSound(kind: SoundKind, volume = 1): void {
  const e = getEngine();
  if (!e) return;
  const nowMs = performance.now();
  if (nowMs - (lastPlayAt.get(kind) ?? 0) < MIN_GAP_MS) return;
  lastPlayAt.set(kind, nowMs);
  RECIPES[kind](e, e.ctx.currentTime, volume);
}

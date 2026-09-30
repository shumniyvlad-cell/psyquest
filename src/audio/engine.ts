// Аудио-движок: генеративная музыка + звуки. Всё синтезируется Tone.js на лету.
import * as Tone from 'tone'
import { THEMES, type Rate, type ThemeDef, type ThemeId } from './themes'

export type { ThemeId } from './themes'

// ---------- Теория: аккорды ----------

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  dim: [0, 3, 6],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
}

function parseChord(sym: string): { root: number; iv: number[] } {
  const m = sym.match(/^([A-G](?:#|b)?)(.*)$/)
  if (!m) return { root: 0, iv: QUALITY[''] }
  return { root: NOTE_INDEX[m[1]] ?? 0, iv: QUALITY[m[2]] ?? QUALITY[''] }
}

const noteName = (midi: number) => Tone.Frequency(midi, 'midi').toNote()

function voice(root: number, iv: number[], octave: number, lo: number, hi: number): string[] {
  const base = 12 * (octave + 1) + root
  const set = new Set<number>()
  for (const i of iv) {
    let n = base + i
    while (n > hi) n -= 12
    while (n < lo) n += 12
    set.add(n)
  }
  return [...set].sort((a, b) => a - b).map(noteName)
}

const RATE_STEPS: Record<Rate, number> = { '4n': 4, '8n': 2, '16n': 1 }

const DRUMS: Record<string, { k?: string; s?: string; h?: string; soft?: boolean }> = {
  none: {},
  heartbeat: { k: 'x..x............', soft: true },
  soft: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.', soft: true },
  lofi: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', soft: true },
  battle: { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
  march: { k: 'x.......x.......', s: '....x..x....x.xx', h: 'x...x...x...x...' },
  dance: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
}

function hash(n: number) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

// ---------- Сборка темы ----------

interface ThemeHandle {
  start(at: number): void
  fade(to: number, sec: number): void
  dispose(): void
}

type Disposable = { dispose(): unknown }

function buildTheme(def: ThemeDef, dest: Tone.InputNode, offline: boolean): ThemeHandle {
  const nodes: Disposable[] = []
  const keep = <T extends Disposable>(n: T): T => {
    nodes.push(n)
    return n
  }

  const bus = keep(new Tone.Gain(0))
  bus.connect(dest)
  const wet = def.reverb ?? 0.3
  const verb = offline
    ? keep(new Tone.Freeverb({ roomSize: 0.8, dampening: 2800, wet }))
    : keep(new Tone.Reverb({ decay: def.reverbDecay ?? 4.5, preDelay: 0.02, wet }))
  verb.connect(bus)
  const tone = keep(new Tone.Filter(def.lpf ?? 14000, 'lowpass'))
  tone.connect(verb)
  let input: Tone.ToneAudioNode = tone
  if (def.delay) {
    const d = keep(new Tone.FeedbackDelay('8n.', 0.3))
    d.wet.value = def.delay
    d.connect(tone)
    input = d
  }

  const bars = def.chords.map(parseChord)
  const sixteenth = 60 / def.bpm / 4
  const loopSteps = 16 * bars.length

  // --- пэд ---
  let pad: Tone.PolySynth | null = null
  let padHits = [0]
  const padChords = bars.map(({ root, iv }) => voice(root, iv, def.padOctave ?? 3, 50, 71))
  if (def.pad) {
    let padOut: Tone.InputNode = input
    if (def.pad === 'warm' || def.pad === 'dark') {
      const f = keep(new Tone.Filter(def.pad === 'dark' ? 900 : 1500, 'lowpass'))
      f.connect(input)
      padOut = f
    }
    if (def.pad === 'warm') {
      pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
        envelope: { attack: 1.1, decay: 0.6, sustain: 0.75, release: 2.4 },
        volume: -27,
      })
    } else if (def.pad === 'glass') {
      pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fattriangle', count: 2, spread: 14 },
        envelope: { attack: 0.9, decay: 0.4, sustain: 0.7, release: 2.8 },
        volume: -21,
      })
    } else if (def.pad === 'dark') {
      pad = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        envelope: { attack: 1.6, decay: 0.4, sustain: 0.8, release: 3 },
        volume: -17,
      })
    } else {
      pad = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 1.6,
        envelope: { attack: 0.005, decay: 1.4, sustain: 0.25, release: 1.4 },
        modulationEnvelope: { attack: 0.005, decay: 0.6, sustain: 0.1, release: 0.6 },
        volume: -16,
      })
      padHits = [0, 10]
    }
    pad.maxPolyphony = 10
    pad.connect(padOut)
    keep(pad)
  }

  // --- арпеджио ---
  let arp: Tone.PolySynth | null = null
  let arpSeqs: string[][] = []
  const arpEvery = def.arp ? RATE_STEPS[def.arp.rate] : 4
  if (def.arp) {
    const a = def.arp
    if (a.style === 'bell') {
      arp = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 10,
        envelope: { attack: 0.001, decay: 1.1, sustain: 0, release: 1 },
        modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 },
      })
    } else if (a.style === 'pluck') {
      arp = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.003, decay: 0.28, sustain: 0, release: 0.25 },
      })
    } else if (a.style === 'marimba') {
      arp = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.3 },
      })
    } else {
      arp = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sawtooth' },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        filterEnvelope: { attack: 0.001, decay: 0.14, sustain: 0.1, release: 0.2, baseFrequency: 280, octaves: 3.2 },
        envelope: { attack: 0.002, decay: 0.18, sustain: 0.05, release: 0.12 },
      })
    }
    arp.volume.value = a.volume ?? -22
    arp.maxPolyphony = 8
    arp.connect(input)
    keep(arp)
    arpSeqs = bars.map(({ root, iv }) => {
      const base = 12 * (a.octave + 1) + root
      const tones = iv.slice(0, 4).map((i) => base + (i % 12))
      const ext = [...tones, ...tones.map((t) => t + 12)]
      let seq: number[]
      switch (a.pattern) {
        case 'down':
          seq = [...ext].reverse()
          break
        case 'updown':
          seq = [...ext, ...ext.slice(1, -1).reverse()]
          break
        case 'broken':
          seq = [ext[0], ext[2], ext[1], ext[3] ?? ext[0] + 12, ext[2], ext[1]]
          break
        default:
          seq = ext
      }
      return seq.map(noteName)
    })
  }

  // --- бас ---
  let bass: Tone.MonoSynth | null = null
  if (def.bass) {
    bass =
      def.bass.style === 'sub'
        ? new Tone.MonoSynth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.25, sustain: 0.8, release: 0.35 },
            filter: { type: 'lowpass', Q: 0.5 },
            filterEnvelope: { baseFrequency: 180, octaves: 1.5, attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 },
            volume: -12,
          })
        : new Tone.MonoSynth({
            oscillator: { type: 'square' },
            envelope: { attack: 0.005, decay: 0.18, sustain: 0.35, release: 0.14 },
            filter: { type: 'lowpass', Q: 1.5 },
            filterEnvelope: { baseFrequency: 120, octaves: 2.6, attack: 0.002, decay: 0.15, sustain: 0.2, release: 0.2 },
            volume: -21,
          })
    bass.connect(bus)
    keep(bass)
  }
  const bassRoot = (root: number) => (root > 7 ? 24 + root : 36 + root)

  // --- ударные ---
  const kit = DRUMS[def.drums ?? 'none']
  let kick: Tone.MembraneSynth | null = null
  let snare: Tone.NoiseSynth | null = null
  let hat: Tone.NoiseSynth | null = null
  if (kit.k) {
    kick = keep(
      new Tone.MembraneSynth({
        pitchDecay: 0.045,
        octaves: 5,
        envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 },
        volume: def.drums === 'heartbeat' ? -15 : kit.soft ? -13 : -9,
      }),
    )
    kick.connect(bus)
  }
  if (kit.s) {
    const hp = keep(new Tone.Filter(kit.soft ? 1400 : 1800, 'highpass'))
    const lp = keep(new Tone.Filter(kit.soft ? 4200 : 9000, 'lowpass'))
    hp.connect(lp)
    lp.connect(tone)
    snare = keep(
      new Tone.NoiseSynth({
        noise: { type: kit.soft ? 'pink' : 'white' },
        envelope: { attack: 0.001, decay: kit.soft ? 0.12 : 0.16, sustain: 0 },
        volume: kit.soft ? -26 : -22,
      }),
    )
    snare.connect(hp)
  }
  if (kit.h) {
    const hp = keep(new Tone.Filter(7600, 'highpass'))
    hp.connect(bus)
    hat = keep(
      new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
        volume: def.drums === 'battle' ? -36 : -33,
      }),
    )
    hat.connect(hp)
  }

  // --- мелодия ---
  let mel: Tone.Synth | Tone.FMSynth | Tone.MonoSynth | null = null
  const melEvery = def.melody ? RATE_STEPS[def.melody.rate] : 4
  if (def.melody) {
    if (def.melody.style === 'flute') {
      const vib = keep(new Tone.Vibrato(5, 0.08))
      vib.connect(input)
      mel = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.06, decay: 0.2, sustain: 0.65, release: 0.6 },
        volume: -16,
      })
      mel.connect(vib)
    } else if (def.melody.style === 'bell') {
      mel = new Tone.FMSynth({
        harmonicity: 3.01,
        modulationIndex: 8,
        envelope: { attack: 0.001, decay: 1.4, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
        volume: -20,
      })
      mel.connect(input)
    } else {
      mel = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { Q: 1, type: 'lowpass' },
        filterEnvelope: { baseFrequency: 600, octaves: 2.5, attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3 },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
        portamento: 0.02,
        volume: -24,
      })
      mel.connect(input)
    }
    keep(mel)
  }

  // --- винил ---
  let crackle: Tone.Noise | null = null
  if (def.crackle) {
    crackle = keep(new Tone.Noise('pink'))
    const f = keep(new Tone.Filter({ frequency: 2400, type: 'bandpass', Q: 0.8 }))
    const v = keep(new Tone.Volume(-38))
    crackle.chain(f, v, bus)
  }

  const vel = () => 0.72 + Math.random() * 0.28

  const tick = (step: number, t: number) => {
    const s = step % 16
    const bi = Math.floor(step / 16) % bars.length
    const tt = def.swing && step % 2 === 1 ? t + def.swing * sixteenth * 0.66 : t

    if (pad && padHits.includes(s)) {
      const dur = def.pad === 'keys' ? (s === 0 ? 10 : 6) * sixteenth : 16 * sixteenth * 0.97
      pad.triggerAttackRelease(padChords[bi], dur, tt, 0.8)
    }
    if (arp && step % arpEvery === 0) {
      const seq = arpSeqs[bi]
      const idx = def.arp?.pattern === 'random' ? Math.floor(hash(step) * seq.length) : (s / arpEvery) % seq.length
      arp.triggerAttackRelease(seq[idx], arpEvery * sixteenth * 0.9, tt, vel() * 0.85)
    }
    if (bass && def.bass) {
      const r = bassRoot(bars[bi].root)
      const p = def.bass.pattern
      if (p === 'root' && (s === 0 || s === 8)) bass.triggerAttackRelease(noteName(r), 7 * sixteenth, tt, 0.9)
      else if (p === 'pulse' && s % 4 === 0) bass.triggerAttackRelease(noteName(r), 3 * sixteenth, tt, vel())
      else if (p === 'eighths' && s % 2 === 0) bass.triggerAttackRelease(noteName(r), sixteenth * 1.4, tt, vel())
      else if (p === 'offbeat' && s % 4 === 2) bass.triggerAttackRelease(noteName(r), sixteenth * 1.6, tt, vel())
      else if (p === 'walk' && s % 4 === 0) {
        const walk = [0, 7, 12, 7][s / 4]
        bass.triggerAttackRelease(noteName(r + walk), 3.2 * sixteenth, tt, vel())
      }
    }
    if (kick && kit.k?.[s] === 'x') kick.triggerAttackRelease(def.drums === 'heartbeat' ? 'A0' : 'C1', '8n', tt, vel())
    if (snare && kit.s?.[s] === 'x') snare.triggerAttackRelease(0.14, tt, vel())
    if (hat && kit.h?.[s] === 'x') hat.triggerAttackRelease(0.03, tt, vel() * (s % 4 === 2 ? 1 : 0.6))

    if (mel && def.melody && step % melEvery === 0) {
      const loop = Math.floor(step / loopSteps)
      if (loop % 3 !== 0) {
        const notes = def.melody.notes
        const mi = Math.floor(step / melEvery) % notes.length
        const n = notes[mi]
        if (n) {
          let hold = 1
          while (hold < 4 && notes[(mi + hold) % notes.length] === null) hold++
          mel.triggerAttackRelease(n, hold * melEvery * sixteenth * 0.92, tt, vel())
        }
      }
    }
  }

  let step = 0
  const clock = keep(
    new Tone.Clock((time) => {
      tick(step, time)
      step++
    }, def.bpm / 15),
  )

  return {
    start(at: number) {
      clock.start(at)
      crackle?.start(at)
    },
    fade(to: number, sec: number) {
      const now = Tone.now()
      bus.gain.cancelAndHoldAtTime(now)
      bus.gain.linearRampToValueAtTime(to, now + sec)
    },
    dispose() {
      try {
        clock.stop()
      } catch {
        /* уже остановлен */
      }
      for (const n of nodes.reverse()) {
        try {
          n.dispose()
        } catch {
          /* узел уже освобождён */
        }
      }
    },
  }
}

// ---------- Мастер-шина ----------

let ready = false
let musicVol: Tone.Volume | null = null
let duck: Tone.Gain | null = null
let sfxVol: Tone.Volume | null = null
let levels = { music: 0.6, sfx: 0.8 }
let current: { id: ThemeId; h: ThemeHandle } | null = null
let wanted: ThemeId | null = null
let duckTimer: ReturnType<typeof setTimeout> | null = null

const db = (v: number) => (v <= 0.001 ? -Infinity : Tone.gainToDb(v))

export const isAudioReady = () => ready

/** Вызывать строго из обработчика клика/тапа — браузеры блокируют звук без жеста. */
export async function unlockAudio() {
  if (ready) return
  await Tone.start()
  Tone.getContext().lookAhead = 0.05
  musicVol = new Tone.Volume(db(levels.music)).toDestination()
  duck = new Tone.Gain(1).connect(musicVol)
  sfxVol = new Tone.Volume(db(levels.sfx)).toDestination()
  ready = true
  document.addEventListener('visibilitychange', () => {
    Tone.getDestination().mute = document.hidden
  })
  if (wanted) {
    const w = wanted
    wanted = null
    playTheme(w)
  }
}

export function setVolumes(music: number, sfxLevel: number) {
  levels = { music, sfx: sfxLevel }
  if (!ready || !musicVol || !sfxVol) return
  musicVol.volume.rampTo(db(music), 0.15)
  sfxVol.volume.value = db(sfxLevel)
}

export function playTheme(id: ThemeId) {
  if (!ready || !duck) {
    wanted = id
    return
  }
  if (current?.id === id) return
  const prev = current
  const h = buildTheme(THEMES[id], duck, false)
  current = { id, h }
  h.start(Tone.now() + 0.08)
  h.fade(1, prev ? 1.4 : 2.2)
  if (prev) {
    prev.h.fade(0, 0.9)
    setTimeout(() => prev.h.dispose(), 1300)
  }
}

export function stopMusic(sec = 1) {
  if (!current) return
  const prev = current
  current = null
  prev.h.fade(0, sec)
  setTimeout(() => prev.h.dispose(), sec * 1000 + 300)
}

export const currentTheme = () => current?.id ?? wanted

export function duckMusic(level = 0.3, holdSec = 1.5) {
  if (!ready || !duck) return
  const now = Tone.now()
  duck.gain.cancelAndHoldAtTime(now)
  duck.gain.linearRampToValueAtTime(level, now + 0.08)
  if (duckTimer) clearTimeout(duckTimer)
  duckTimer = setTimeout(() => {
    if (!duck) return
    const t = Tone.now()
    duck.gain.cancelAndHoldAtTime(t)
    duck.gain.linearRampToValueAtTime(1, t + 0.9)
  }, holdSec * 1000)
}

// ---------- Звуки ----------

export type SfxName =
  | 'click'
  | 'select'
  | 'type'
  | 'coin'
  | 'xp'
  | 'hit'
  | 'crit'
  | 'hurt'
  | 'forge'
  | 'whoosh'
  | 'unlock'
  | 'error'
  | 'step'
  | 'magic'
  | 'page'
  | 'heal'
  | 'open'
  | 'close'
  | 'lock'
  | 'success'
  | 'drop'

interface FxKit {
  tri: Tone.PolySynth
  blip: Tone.Synth
  bell: Tone.PolySynth
  noise: Tone.NoiseSynth
  kick: Tone.MembraneSynth
  metal: Tone.MetalSynth
  brass: Tone.PolySynth
}

let fx: FxKit | null = null

function ensureFx(): FxKit | null {
  if (fx) return fx
  if (!sfxVol) return null
  const out = sfxVol
  const tri = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.08 },
    volume: -11,
  }).connect(out)
  tri.maxPolyphony = 12
  const blip = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
    volume: -31,
  }).connect(out)
  const bell = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 9,
    envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.8 },
    modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 },
    volume: -15,
  }).connect(out)
  bell.maxPolyphony = 12
  const lp = new Tone.Filter(2200, 'lowpass').connect(out)
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    volume: -15,
  }).connect(lp)
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
    volume: -9,
  }).connect(out)
  const metal = new Tone.MetalSynth({
    harmonicity: 5.1,
    modulationIndex: 24,
    resonance: 3200,
    octaves: 1.2,
    envelope: { attack: 0.001, decay: 0.5, release: 0.2 },
    volume: -20,
  }).connect(out)
  const brassLp = new Tone.Filter(2400, 'lowpass').connect(out)
  const brass = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 15 },
    envelope: { attack: 0.03, decay: 0.3, sustain: 0.6, release: 0.6 },
    volume: -21,
  }).connect(brassLp)
  brass.maxPolyphony = 12
  fx = { tri, blip, bell, noise, kick, metal, brass }
  return fx
}

const lastPlayed: Partial<Record<SfxName, number>> = {}

export function sfx(name: SfxName) {
  if (!ready || levels.sfx <= 0.001) return
  const nowMs = performance.now()
  const gap = name === 'type' ? 40 : 28
  const prev = lastPlayed[name]
  if (prev !== undefined && nowMs - prev < gap) return
  lastPlayed[name] = nowMs
  const f = ensureFx()
  if (!f) return
  const t = Tone.now()
  try {
    switch (name) {
      case 'click':
        f.tri.triggerAttackRelease('E6', 0.03, t, 0.32)
        break
      case 'select':
        f.tri.triggerAttackRelease('A5', 0.05, t, 0.4)
        f.tri.triggerAttackRelease('E6', 0.06, t + 0.05, 0.3)
        break
      case 'type':
        f.blip.triggerAttackRelease(['A5', 'B5', 'C#6', 'E6'][Math.floor(Math.random() * 4)], 0.012, t, 0.6)
        break
      case 'coin':
        f.tri.triggerAttackRelease('B5', 0.06, t, 0.5)
        f.tri.triggerAttackRelease('E6', 0.18, t + 0.07, 0.5)
        break
      case 'xp':
        ;['C6', 'E6', 'G6', 'C7'].forEach((n, i) => f.bell.triggerAttackRelease(n, 0.2, t + i * 0.045, 0.32))
        break
      case 'hit':
        f.noise.triggerAttackRelease(0.08, t, 0.9)
        f.kick.triggerAttackRelease('G2', 0.1, t, 0.8)
        break
      case 'crit':
        f.noise.triggerAttackRelease(0.1, t, 1)
        f.kick.triggerAttackRelease('E2', 0.12, t, 1)
        f.bell.triggerAttackRelease(['C6', 'G6'], 0.5, t + 0.03, 0.5)
        break
      case 'hurt':
        f.kick.triggerAttackRelease('C2', 0.25, t, 1)
        f.noise.triggerAttackRelease(0.15, t, 0.45)
        break
      case 'forge':
        f.metal.triggerAttackRelease('C4', 0.3, t, 0.9)
        f.kick.triggerAttackRelease('A1', 0.15, t, 0.7)
        break
      case 'whoosh': {
        if (!sfxVol) break
        const n = new Tone.Noise('pink')
        const flt = new Tone.Filter(300, 'bandpass')
        const g = new Tone.Gain(0)
        n.chain(flt, g, sfxVol)
        n.start(t)
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.45, t + 0.12)
        g.gain.linearRampToValueAtTime(0, t + 0.45)
        flt.frequency.setValueAtTime(300, t)
        flt.frequency.exponentialRampToValueAtTime(4000, t + 0.4)
        n.stop(t + 0.5)
        setTimeout(() => {
          n.dispose()
          flt.dispose()
          g.dispose()
        }, 900)
        break
      }
      case 'unlock':
        ;['C5', 'E5', 'G5', 'C6'].forEach((n, i) => f.bell.triggerAttackRelease(n, 0.8, t + i * 0.07, 0.4))
        break
      case 'error':
        f.tri.triggerAttackRelease('E3', 0.09, t, 0.8)
        f.tri.triggerAttackRelease('C3', 0.14, t + 0.1, 0.8)
        break
      case 'step':
        f.noise.triggerAttackRelease(0.03, t, 0.22)
        break
      case 'magic':
        for (let i = 0; i < 5; i++) {
          const n = ['E6', 'G6', 'B6', 'D7', 'A6'][Math.floor(Math.random() * 5)]
          f.bell.triggerAttackRelease(n, 0.3, t + i * 0.06, 0.22)
        }
        break
      case 'page':
        f.noise.triggerAttackRelease(0.06, t, 0.32)
        break
      case 'heal':
        ;['C5', 'E5', 'G5', 'B5'].forEach((n, i) => f.tri.triggerAttackRelease(n, 0.12, t + i * 0.05, 0.4))
        break
      case 'open':
        f.tri.triggerAttackRelease('C5', 0.06, t, 0.35)
        f.tri.triggerAttackRelease('G5', 0.08, t + 0.06, 0.3)
        break
      case 'close':
        f.tri.triggerAttackRelease('G5', 0.06, t, 0.3)
        f.tri.triggerAttackRelease('C5', 0.08, t + 0.06, 0.3)
        break
      case 'lock':
        f.metal.triggerAttackRelease('G3', 0.12, t, 0.5)
        f.tri.triggerAttackRelease('D3', 0.2, t + 0.02, 0.6)
        break
      case 'success':
        f.tri.triggerAttackRelease(['C6', 'E6', 'G6'], 0.3, t, 0.35)
        break
      case 'drop':
        f.kick.triggerAttackRelease('E2', 0.12, t, 0.5)
        break
    }
  } catch {
    /* звук — не критично */
  }
}

export type StingerName = 'victory' | 'levelup' | 'unlock' | 'defeat' | 'ship' | 'quest'

export function stinger(kind: StingerName) {
  if (!ready) return
  const f = ensureFx()
  if (!f) return
  const t = Tone.now() + 0.03
  try {
    switch (kind) {
      case 'victory': {
        duckMusic(0.25, 2.6)
        const seq: [string[], number, number][] = [
          [['C4', 'E4', 'G4'], 0, 0.14],
          [['C4', 'E4', 'G4'], 0.18, 0.14],
          [['C4', 'E4', 'G4'], 0.36, 0.14],
          [['C4', 'F4', 'A4'], 0.54, 0.32],
          [['D4', 'G4', 'B4'], 0.9, 0.32],
          [['E4', 'G4', 'C5'], 1.26, 1.3],
        ]
        for (const [notes, at, d] of seq) f.brass.triggerAttackRelease(notes, d, t + at, 0.7)
        ;['G5', 'C6', 'E6', 'G6'].forEach((n, i) => f.bell.triggerAttackRelease(n, 0.6, t + 1.26 + i * 0.06, 0.3))
        break
      }
      case 'levelup':
        duckMusic(0.3, 1.8)
        ;['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => f.bell.triggerAttackRelease(n, 0.5, t + i * 0.07, 0.4))
        f.brass.triggerAttackRelease(['C4', 'G4', 'C5', 'E5'], 1.1, t + 0.45, 0.55)
        break
      case 'unlock':
        duckMusic(0.35, 1.4)
        sfx('unlock')
        break
      case 'defeat':
        duckMusic(0.25, 2.2)
        f.brass.triggerAttackRelease(['A3', 'C4', 'E4'], 0.5, t, 0.6)
        f.brass.triggerAttackRelease(['F3', 'A3', 'D4'], 0.5, t + 0.55, 0.6)
        f.brass.triggerAttackRelease(['E3', 'G#3', 'B3'], 1.2, t + 1.1, 0.6)
        break
      case 'ship':
        duckMusic(0.35, 2)
        f.brass.triggerAttackRelease(['D3', 'A3'], 1.5, t, 0.7)
        f.bell.triggerAttackRelease(['D6', 'F#6', 'A6'], 1.2, t + 0.6, 0.3)
        break
      case 'quest':
        duckMusic(0.4, 1.2)
        ;['G5', 'C6', 'E6'].forEach((n, i) => f.bell.triggerAttackRelease(n, 0.5, t + i * 0.08, 0.38))
        f.tri.triggerAttackRelease(['C6', 'G6'], 0.5, t + 0.26, 0.3)
        break
    }
  } catch {
    /* звук — не критично */
  }
}

// ---------- Офлайн-рендер (музыка для роликов) ----------

/** Рендерит тему в AudioBuffer заданной длины с плавным затуханием в конце. */
export async function renderThemeToBuffer(id: ThemeId, seconds: number): Promise<AudioBuffer> {
  const len = Math.max(3, seconds)
  const buffer = await Tone.Offline(() => {
    const out = new Tone.Gain(0.95).toDestination()
    out.gain.setValueAtTime(0.95, Math.max(0, len - 1.8))
    out.gain.linearRampToValueAtTime(0, len - 0.05)
    const h = buildTheme(THEMES[id], out, true)
    h.fade(1, 0.05)
    h.start(0)
  }, len)
  const raw = buffer.get()
  if (!raw) throw new Error('Не удалось отрендерить трек')
  return raw
}

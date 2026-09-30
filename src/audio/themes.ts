// Музыкальные темы Психеи. Всё синтезируется в браузере (Tone.js) — никаких файлов и авторских прав.

export type ThemeId =
  | 'title'
  | 'map'
  | 'doubt'
  | 'forest'
  | 'forge'
  | 'tower'
  | 'studio'
  | 'launch'
  | 'arena'
  | 'lighthouse'
  | 'battle'
  | 'boss'
  | 'ending'

export type PadStyle = 'warm' | 'glass' | 'dark' | 'keys'
export type ArpStyle = 'pluck' | 'bell' | 'saw' | 'marimba'
export type ArpPattern = 'up' | 'down' | 'updown' | 'broken' | 'random'
export type BassStyle = 'sub' | 'pulse'
export type BassPattern = 'root' | 'pulse' | 'eighths' | 'offbeat' | 'walk'
export type DrumKit = 'none' | 'heartbeat' | 'soft' | 'lofi' | 'battle' | 'march' | 'dance'
export type Rate = '4n' | '8n' | '16n'

export interface ThemeDef {
  title: string
  bpm: number
  swing?: number
  chords: string[]
  padOctave?: number
  pad?: PadStyle | null
  arp?: { style: ArpStyle; pattern: ArpPattern; rate: Rate; octave: number; volume?: number } | null
  bass?: { style: BassStyle; pattern: BassPattern } | null
  drums?: DrumKit
  melody?: { notes: (string | null)[]; rate: Rate; style: 'flute' | 'bell' | 'lead' } | null
  reverb?: number
  reverbDecay?: number
  delay?: number
  lpf?: number
  crackle?: boolean
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  title: {
    title: 'Ночь над Психеей',
    bpm: 68,
    chords: ['Dm9', 'Bbmaj7', 'Fmaj7', 'Csus2'],
    pad: 'glass',
    arp: { style: 'bell', pattern: 'up', rate: '8n', octave: 5, volume: -24 },
    drums: 'none',
    melody: {
      rate: '4n',
      style: 'flute',
      notes: ['A4', null, 'D5', 'E5', 'F5', null, 'E5', 'D5', 'C5', null, 'A4', null, 'G4', 'A4', null, null],
    },
    reverb: 0.5,
    reverbDecay: 7,
  },
  map: {
    title: 'Дорога к Маяку',
    bpm: 92,
    chords: ['G', 'D', 'Em', 'Cadd9'],
    pad: 'warm',
    arp: { style: 'pluck', pattern: 'updown', rate: '8n', octave: 4, volume: -20 },
    bass: { style: 'sub', pattern: 'pulse' },
    drums: 'soft',
    melody: {
      rate: '8n',
      style: 'bell',
      notes: [
        'D5', null, 'B4', null, 'G4', null, 'A4', 'B4', 'A4', null, 'F#4', null, 'D4', null, null, null,
        'E4', null, 'G4', null, 'B4', null, 'A4', 'G4', 'E4', null, 'G4', null, null, null, null, null,
      ],
    },
    reverb: 0.34,
  },
  doubt: {
    title: 'Долина Сомнений',
    bpm: 72,
    chords: ['Am', 'Fmaj7', 'Dm7', 'E'],
    pad: 'dark',
    arp: { style: 'marimba', pattern: 'random', rate: '8n', octave: 4, volume: -22 },
    bass: { style: 'sub', pattern: 'root' },
    drums: 'heartbeat',
    reverb: 0.5,
    reverbDecay: 6,
    lpf: 5000,
  },
  forest: {
    title: 'Лес Смыслов',
    bpm: 84,
    chords: ['Em', 'Cmaj7', 'Am7', 'Bsus4'],
    pad: 'glass',
    arp: { style: 'pluck', pattern: 'broken', rate: '16n', octave: 4, volume: -25 },
    bass: { style: 'sub', pattern: 'root' },
    drums: 'soft',
    melody: {
      rate: '8n',
      style: 'flute',
      notes: [
        'B4', null, null, 'E5', null, 'D5', null, 'B4', null, null, 'A4', null, 'G4', null, null, null,
        'G4', null, 'A4', null, 'B4', null, null, 'D5', null, 'B4', null, 'A4', null, null, null, null,
      ],
    },
    reverb: 0.42,
  },
  forge: {
    title: 'Кузница Продукта',
    bpm: 104,
    chords: ['Dm', 'Dm', 'Bb', 'C'],
    pad: 'warm',
    arp: { style: 'saw', pattern: 'up', rate: '16n', octave: 3, volume: -26 },
    bass: { style: 'pulse', pattern: 'eighths' },
    drums: 'march',
    reverb: 0.28,
    lpf: 7000,
  },
  tower: {
    title: 'Башня Ботов',
    bpm: 110,
    chords: ['F#m', 'D', 'A', 'E'],
    pad: 'glass',
    arp: { style: 'saw', pattern: 'up', rate: '16n', octave: 4, volume: -24 },
    bass: { style: 'pulse', pattern: 'offbeat' },
    drums: 'dance',
    delay: 0.18,
    reverb: 0.3,
  },
  studio: {
    title: 'Студия Эха (lo-fi)',
    bpm: 82,
    swing: 0.55,
    chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
    pad: 'keys',
    bass: { style: 'sub', pattern: 'walk' },
    drums: 'lofi',
    melody: {
      rate: '8n',
      style: 'bell',
      notes: [
        'A5', null, null, null, 'G5', null, 'E5', null, null, null, null, null, null, null, null, null,
        'F5', null, null, null, 'E5', null, 'C5', null, null, null, null, null, null, null, null, null,
      ],
    },
    reverb: 0.26,
    lpf: 5200,
    crackle: true,
  },
  launch: {
    title: 'Площадь Запуска',
    bpm: 116,
    chords: ['C', 'G', 'Am', 'F'],
    pad: 'warm',
    arp: { style: 'pluck', pattern: 'up', rate: '16n', octave: 4, volume: -24 },
    bass: { style: 'pulse', pattern: 'eighths' },
    drums: 'dance',
    melody: {
      rate: '8n',
      style: 'lead',
      notes: [
        'E5', null, 'G5', null, 'C6', null, 'B5', 'G5', 'D5', null, 'G5', null, 'B5', null, 'A5', 'G5',
        'C5', null, 'E5', null, 'A5', null, 'G5', 'E5', 'F5', null, 'A5', null, 'C6', null, 'B5', null,
      ],
    },
    reverb: 0.3,
  },
  arena: {
    title: 'Арена Продаж',
    bpm: 124,
    chords: ['Cm', 'Ab', 'Eb', 'Bb'],
    pad: 'warm',
    arp: { style: 'saw', pattern: 'updown', rate: '16n', octave: 4, volume: -25 },
    bass: { style: 'pulse', pattern: 'eighths' },
    drums: 'battle',
    reverb: 0.28,
  },
  lighthouse: {
    title: 'Маяк',
    bpm: 76,
    chords: ['D', 'Bm', 'G', 'A'],
    pad: 'warm',
    arp: { style: 'bell', pattern: 'updown', rate: '8n', octave: 5, volume: -24 },
    bass: { style: 'sub', pattern: 'root' },
    drums: 'none',
    melody: {
      rate: '4n',
      style: 'flute',
      notes: ['F#5', null, 'E5', 'D5', 'D5', null, 'B4', 'A4', 'B4', null, 'D5', null, 'E5', null, null, null],
    },
    reverb: 0.5,
    reverbDecay: 6,
  },
  battle: {
    title: 'Битва с тенью',
    bpm: 132,
    chords: ['Dm', 'Bb', 'Gm', 'A'],
    pad: 'dark',
    arp: { style: 'saw', pattern: 'up', rate: '16n', octave: 4, volume: -23 },
    bass: { style: 'pulse', pattern: 'eighths' },
    drums: 'battle',
    reverb: 0.25,
  },
  boss: {
    title: 'Демон Выгорания',
    bpm: 70,
    chords: ['Cm', 'Db', 'Cm', 'Bdim'],
    pad: 'dark',
    arp: { style: 'bell', pattern: 'random', rate: '8n', octave: 5, volume: -26 },
    bass: { style: 'sub', pattern: 'root' },
    drums: 'heartbeat',
    reverb: 0.55,
    reverbDecay: 8,
    lpf: 4200,
  },
  ending: {
    title: 'Свет, который нашли',
    bpm: 80,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'],
    pad: 'warm',
    arp: { style: 'pluck', pattern: 'updown', rate: '8n', octave: 4, volume: -22 },
    bass: { style: 'sub', pattern: 'root' },
    drums: 'soft',
    melody: {
      rate: '4n',
      style: 'flute',
      notes: [
        'A4', 'C5', 'F5', null, 'E5', null, 'C5', null, 'D5', 'E5', 'F5', null, 'D5', null, 'C5', null,
        'A4', 'C5', 'F5', null, 'G5', null, 'E5', null, 'D5', null, 'C5', 'D5', 'C5', null, null, null,
      ],
    },
    reverb: 0.45,
  },
}

/** Треки, которые игрок может подложить под свои ролики */
export const REEL_TRACKS: { id: ThemeId; name: string; mood: string; pro: boolean }[] = [
  { id: 'studio', name: 'Лоу-фай вечер', mood: 'спокойно, доверительно', pro: false },
  { id: 'lighthouse', name: 'Маяк', mood: 'надежда, тепло', pro: false },
  { id: 'launch', name: 'Площадь', mood: 'энергично, вдохновляюще', pro: false },
  { id: 'title', name: 'Ночная Психея', mood: 'глубина, рефлексия', pro: true },
  { id: 'ending', name: 'Свет, который нашли', mood: 'история успеха', pro: true },
  { id: 'forest', name: 'Лес Смыслов', mood: 'загадка, инсайт', pro: true },
  { id: 'tower', name: 'Башня', mood: 'технологично, бодро', pro: true },
]

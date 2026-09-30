import { useEffect, useMemo, useRef, useState } from 'react'
import { Coffee, Feather, HeartHandshake, Shield } from 'lucide-react'
import { BOSS_LOOKS, Inkblot, type BossLookId } from '../art/Inkblot'
import { playTheme, sfx, stinger } from '../audio/engine'
import type { ThemeId } from '../audio/themes'
import { CONSUMABLES } from '../game/items'
import { damageMult, maxHp } from '../game/progression'
import { useGame, useHeroStats, useTextCtx } from '../game/store'
import { fmt } from '../game/text'
import { Bar } from '../ui/Bar'
import { Button } from '../ui/Button'
import './battle.css'

export type AnswerQuality = 'great' | 'ok' | 'bad' | 'toxic'

export interface BattleOption {
  text: string
  q: AnswerQuality
  why: string
  /** Для Гидры: такой ответ заставляет голову отрасти */
  regrow?: boolean
}

export interface BattleAttack {
  line: string
  options: BattleOption[]
  head?: number
}

export interface BossDef {
  id: string
  name: string
  epithet: string
  look: BossLookId
  hp: number
  intro: string
  attacks: BattleAttack[]
  defeatLine: string
  heads?: string[]
  value?: boolean
  theme?: ThemeId
}

export interface BattleResult {
  perfect: boolean
  turns: number
  great: number
  hpLeft: number
}

interface Props {
  boss: BossDef
  onWin: (r: BattleResult) => void
  onLeave: () => void
}

type Phase = 'intro' | 'turn' | 'resolve' | 'won' | 'lost'

interface Floater {
  id: number
  text: string
  kind: 'dmg' | 'crit' | 'hurt' | 'heal' | 'regrow'
  side: 'boss' | 'hero'
}

const QUALITY_LABEL: Record<AnswerQuality, string> = {
  great: 'Сильный ответ',
  ok: 'Так себе',
  bad: 'Мимо',
  toxic: 'Манипуляция',
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed * 9301 + 49297
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

let floaterSeq = 1

export function Battle({ boss, onWin, onLeave }: Props) {
  const stats = useHeroStats()
  const relics = useGame((s) => s.relics)
  const consumables = useGame((s) => s.consumables)
  const scale = useGame((s) => s.plan?.bossScale ?? 1)
  const ctx = useTextCtx()
  const useConsumable = useGame((s) => s.useConsumable)
  const adjustReputation = useGame((s) => s.adjustReputation)
  const recordBattle = useGame((s) => s.recordBattle)

  const heroMax = maxHp(stats, relics)
  const bossMax = Math.round(boss.hp * scale)
  const heads = boss.heads ?? []
  const headMax = heads.length ? bossMax / heads.length : bossMax

  const [phase, setPhase] = useState<Phase>('intro')
  const [heroHp, setHeroHp] = useState(heroMax)
  const [headHp, setHeadHp] = useState<number[]>(() => (heads.length ? heads.map(() => headMax) : [bossMax]))
  const [turn, setTurn] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [order, setOrder] = useState<number[]>(() => boss.attacks.map((_, i) => i))
  const [pos, setPos] = useState(0)
  const [picked, setPicked] = useState<{ opt: BattleOption; dmg: number; crit: boolean } | null>(null)
  const [hinted, setHinted] = useState(false)
  const [bossState, setBossState] = useState<'idle' | 'hit' | 'attack' | 'dying' | 'dead'>('idle')
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [hurt, setHurt] = useState(false)
  const [stats2, setStats2] = useState({ bad: 0, great: 0 })
  const [typed, setTyped] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  // карточка Роршаха подстраивается под экран: высота карточки = 0.8 ширины
  const [blotSize] = useState(() =>
    typeof window === 'undefined' ? 340 : Math.round(Math.min(340, window.innerWidth * 0.78, (window.innerHeight * 0.3) / 0.8)),
  )

  const bossHp = headHp.reduce((a, b) => a + Math.max(0, b), 0)

  useEffect(() => {
    playTheme(boss.theme ?? 'battle')
    const t = timers.current
    return () => t.forEach(clearTimeout)
  }, [boss.theme])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms))
  }

  const float = (text: string, kind: Floater['kind'], side: Floater['side']) => {
    const id = floaterSeq++
    setFloaters((f) => [...f, { id, text, kind, side }])
    later(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1100)
  }

  // выбор следующей атаки с учётом мёртвых голов
  const attackIndex = useMemo(() => {
    const alive = (i: number) => {
      const h = boss.attacks[i].head
      return h === undefined || (headHp[h] ?? 1) > 0
    }
    for (let k = 0; k < order.length; k++) {
      const i = order[(pos + k) % order.length]
      if (alive(i)) return i
    }
    return order[pos % order.length]
  }, [order, pos, headHp, boss.attacks])

  const attack = boss.attacks[attackIndex]
  const options = useMemo(() => seededShuffle(attack.options, turn + 7 * cycle + 3), [attack, turn, cycle])
  const bossLine = phase === 'intro' ? fmt(boss.intro, ctx) : fmt(attack.line, ctx)

  // печать реплики босса
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'turn') return
    setTyped(0)
    let i = 0
    const t = setInterval(() => {
      i += 2
      setTyped(i)
      if (i % 6 === 0) sfx('type')
      if (i >= bossLine.length) clearInterval(t)
    }, 16)
    return () => clearInterval(t)
  }, [bossLine, phase])

  const choose = (opt: BattleOption) => {
    if (phase !== 'turn') return
    const mult = damageMult(stats) * (boss.value && relics.includes('hammer') ? 1.15 : 1)
    let dmg = 0
    let crit = false
    const h = attack.head ?? 0
    const nextHeads = [...headHp]
    if (opt.q === 'great') {
      const critChance = 0.15 + (relics.includes('calm_voice') ? 0.15 : 0)
      crit = Math.random() < critChance
      dmg = Math.round(26 * mult * (crit ? 1.6 : 1))
      nextHeads[h] = nextHeads[h] - dmg
      sfx(crit ? 'crit' : 'hit')
      float(`−${dmg}`, crit ? 'crit' : 'dmg', 'boss')
      setBossState('hit')
      setStats2((s) => ({ ...s, great: s.great + 1 }))
    } else if (opt.q === 'ok') {
      dmg = Math.round(11 * mult)
      nextHeads[h] = nextHeads[h] - dmg
      sfx('hit')
      float(`−${dmg}`, 'dmg', 'boss')
      setBossState('hit')
    } else {
      const loss = Math.round((opt.q === 'toxic' ? 12 : 16) * (1 + cycle * 0.15))
      setHeroHp((v) => Math.max(0, v - loss))
      float(`−${loss}`, 'hurt', 'hero')
      setHurt(true)
      later(() => setHurt(false), 420)
      sfx('hurt')
      setBossState('attack')
      setStats2((s) => ({ ...s, bad: s.bad + 1 }))
      if (opt.q === 'toxic') {
        adjustReputation(-4)
        nextHeads[h] = Math.min(headMax, nextHeads[h] + 10)
        float('+10', 'heal', 'boss')
      }
    }
    if (opt.regrow) {
      nextHeads[h] = Math.min(headMax, Math.max(nextHeads[h], 0) + headMax * 0.5)
      later(() => float('отрастает', 'regrow', 'boss'), 300)
    }
    setHeadHp(nextHeads)
    setPicked({ opt, dmg, crit })
    setHinted(false)
    setPhase('resolve')
    later(() => setBossState('idle'), 480)
  }

  const next = () => {
    const totalLeft = headHp.reduce((a, b) => a + Math.max(0, b), 0)
    if (totalLeft <= 0) {
      setPhase('won')
      setBossState('dying')
      stinger('victory')
      recordBattle(true)
      later(() => setBossState('dead'), 1300)
      return
    }
    if (heroHp <= 0) {
      setPhase('lost')
      stinger('defeat')
      recordBattle(false)
      return
    }
    setTurn((t) => t + 1)
    if (pos + 1 >= order.length) {
      setCycle((c) => c + 1)
      setOrder(seededShuffle(boss.attacks.map((_, i) => i), cycle + 11))
      setPos(0)
    } else setPos(pos + 1)
    setPicked(null)
    setPhase('turn')
  }

  const retry = () => {
    sfx('heal')
    setHeroHp(heroMax)
    setHeadHp(heads.length ? heads.map(() => headMax) : [bossMax])
    setTurn(0)
    setCycle(0)
    setPos(0)
    setPicked(null)
    setStats2({ bad: 0, great: 0 })
    setBossState('idle')
    setPhase('intro')
  }

  const drink = (id: 'tea' | 'supervision') => {
    if (!useConsumable(id)) return
    const heal = id === 'tea' ? 25 : heroMax
    setHeroHp((v) => Math.min(heroMax, v + heal))
    float(`+${Math.min(heal, heroMax)}`, 'heal', 'hero')
    sfx('heal')
  }

  const hint = () => {
    if (hinted || !useConsumable('hint')) return
    sfx('magic')
    setHinted(true)
  }

  const headsView = heads.map((label, i) => ({ label, alive: (headHp[i] ?? 0) > 0 }))
  const showOptions = phase === 'turn' && typed >= Math.min(bossLine.length, 24)

  return (
    <div className={`bt ${hurt ? 'is-hurt' : ''}`}>
      <div className="bt-vignette" />
      <header className="bt-top">
        <div className="bt-side">
          <div className="spread small">
            <span className="bt-who">Ты</span>
            <span className="num muted">
              {Math.max(0, Math.round(heroHp))} / {heroMax}
            </span>
          </div>
          <Bar value={heroHp} max={heroMax} variant="mint" label="Уверенность" />
          {relics.includes('shield_facts') ? (
            <span className="bt-relic tiny">
              <Shield size={13} /> Щит фактов
            </span>
          ) : null}
        </div>
        <div className="bt-side bt-boss-side">
          <div className="spread small">
            <span className="bt-who display">{boss.name}</span>
            <span className="num muted">{Math.max(0, Math.round(bossHp))}</span>
          </div>
          <Bar value={bossHp} max={bossMax} variant="ink" label={boss.name} />
          <span className="tiny faint">{fmt(boss.epithet, ctx)}</span>
        </div>
      </header>

      <div className="bt-arena">
        <div className="bt-card-wrap">
          <Inkblot {...BOSS_LOOKS[boss.look]} hp={bossMax ? bossHp / bossMax : 0} heads={heads.length ? headsView : undefined} state={bossState} size={blotSize} />
          {floaters
            .filter((f) => f.side === 'boss')
            .map((f) => (
              <span key={f.id} className={`bt-float bt-float-${f.kind}`}>
                {f.text}
              </span>
            ))}
        </div>
        {phase === 'intro' || phase === 'turn' ? (
          <div className="bt-bubble panel" aria-live="polite">
            <p>
              {bossLine.slice(0, typed)}
              <span className="dlg-ghost">{bossLine.slice(typed)}</span>
            </p>
          </div>
        ) : null}
        {floaters
          .filter((f) => f.side === 'hero')
          .map((f) => (
            <span key={f.id} className={`bt-float bt-float-hero bt-float-${f.kind}`}>
              {f.text}
            </span>
          ))}
      </div>

      <footer className="bt-bottom">
        {phase === 'intro' ? (
          <div className="bt-panel panel anim-rise">
            <p className="muted small">
              {fmt('Каждая реплика тени — это мысль, которую ты уже {слышал|слышала} внутри. Отвечай так, как {ответил|ответила} бы клиенту.', ctx)}
            </p>
            <Button variant="lit" size="lg" onClick={() => setPhase('turn')}>
              Принять бой
            </Button>
          </div>
        ) : null}

        {phase === 'turn' ? (
          <div className="bt-panel panel">
            <div className="bt-options">
              {showOptions
                ? options.map((o, i) => (
                    <button
                      key={i}
                      className={`choice bt-option anim-rise ${hinted && o.q === 'great' ? 'is-hinted' : ''}`}
                      style={{ animationDelay: `${i * 60}ms` }}
                      onClick={() => choose(o)}
                    >
                      {fmt(o.text, ctx)}
                    </button>
                  ))
                : null}
            </div>
            <div className="bt-items">
              <button className="chip" disabled={!consumables.tea} onClick={() => drink('tea')} title={CONSUMABLES.tea.desc}>
                <Coffee size={14} /> Чай ({consumables.tea ?? 0})
              </button>
              <button
                className="chip"
                disabled={!consumables.supervision}
                onClick={() => drink('supervision')}
                title={CONSUMABLES.supervision.desc}
              >
                <HeartHandshake size={14} /> Супервизия ({consumables.supervision ?? 0})
              </button>
              <button className="chip" disabled={!consumables.hint || hinted} onClick={hint} title={CONSUMABLES.hint.desc}>
                <Feather size={14} /> Перо Совы ({consumables.hint ?? 0})
              </button>
            </div>
          </div>
        ) : null}

        {phase === 'resolve' && picked ? (
          <div className={`bt-panel panel anim-rise bt-resolve is-${picked.opt.q}`}>
            <div className="row">
              <span className={`badge ${picked.opt.q === 'great' ? 'badge-mint' : picked.opt.q === 'ok' ? '' : 'badge-ember'}`}>
                {QUALITY_LABEL[picked.opt.q]}
                {picked.crit ? ', точно в цель' : ''}
              </span>
              {picked.opt.regrow ? <span className="badge badge-ink">Голова отрастает</span> : null}
            </div>
            <p className="bt-why">{fmt(picked.opt.why, ctx)}</p>
            <div className="row">
              <Button variant="lit" onClick={next}>
                {bossHp <= 0 ? 'Добить тень' : heroHp <= 0 ? 'Дальше' : 'Следующая реплика'}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === 'won' ? (
          <div className="bt-panel panel anim-rise">
            <p className="display t-20">{fmt(boss.defeatLine, ctx)}</p>
            <p className="small muted">
              {stats2.bad === 0 ? 'Ни одного промаха. Тень даже не успела испугаться.' : `Сильных ответов: ${stats2.great}. Промахов: ${stats2.bad} — и это нормально, ты учишься.`}
            </p>
            <Button
              variant="lit"
              size="lg"
              onClick={() => onWin({ perfect: stats2.bad === 0, turns: turn + 1, great: stats2.great, hpLeft: heroHp })}
            >
              Забрать награду
            </Button>
          </div>
        ) : null}

        {phase === 'lost' ? (
          <div className="bt-panel panel anim-rise">
            <p className="display t-20">Сова подхватывает тебя у самой земли.</p>
            <p className="small muted">
              «Проиграть тени — не стыдно. Стыдно не вернуться. Выпей чаю, перечитай свои факты — и попробуем ещё раз».
            </p>
            <div className="row-wrap">
              <Button variant="lit" onClick={retry}>
                Попробовать снова
              </Button>
              <Button variant="ghost" onClick={onLeave}>
                Вернуться на карту
              </Button>
            </div>
          </div>
        ) : null}
      </footer>
    </div>
  )
}

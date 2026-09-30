import type { CSSProperties, ReactNode } from 'react'
import { Backpack, Coins, ScrollText, Settings as SettingsIcon, Ship, Store, UserRound, Volume2, VolumeX } from 'lucide-react'
import { sfx } from '../audio/engine'
import { currentWeek } from '../game/planner'
import { titleForLevel, xpForLevel } from '../game/progression'
import { lanternOf, seasonClients, useGame } from '../game/store'
import { Bar } from '../ui/Bar'
import './hud.css'

export function Hud() {
  const hero = useGame((s) => s.hero)
  const level = useGame((s) => s.level)
  const xp = useGame((s) => s.xp)
  const coins = useGame((s) => s.coins)
  const skillPoints = useGame((s) => s.skillPoints)
  const muted = useGame((s) => s.settings.music === 0 && s.settings.sfx === 0)
  const light = useGame((s) => lanternOf(s).color)
  const openPanel = useGame((s) => s.openPanel)
  const need = xpForLevel(level)

  const toggleSound = () => {
    const st = useGame.getState()
    if (muted) st.setSettings({ music: 0.55, sfx: 0.8 })
    else st.setSettings({ music: 0, sfx: 0 })
    sfx('click')
  }

  return (
    <header className="hud">
      <button className="hud-hero" onClick={() => openPanel('hero')} aria-label="Карточка героя">
        <span className="hud-avatar" style={{ '--l': light } as CSSProperties}>
          {(hero?.name ?? 'Ф').slice(0, 1).toUpperCase()}
          {skillPoints > 0 ? <span className="hud-dot" aria-label="Есть очки навыков" /> : null}
        </span>
        <span className="hud-who">
          <span className="hud-name">
            {hero?.name ?? 'Фонарщик'} <span className="hud-lvl num">ур. {level}</span>
          </span>
          <span className="hud-title tiny">{titleForLevel(level)}</span>
          <Bar value={xp} max={need} height={5} label="Опыт" />
        </span>
      </button>
      <div className="hud-right">
        <button className="chip hud-coins" onClick={() => openPanel('shop', { shopTab: 'coins' })} aria-label={`Монеты: ${coins}. Открыть Лавку`}>
          <Coins size={15} /> <span className="num">{coins}</span>
        </button>
        <button className="btn btn-quiet btn-icon btn-sm" onClick={toggleSound} aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button className="btn btn-quiet btn-icon btn-sm" onClick={() => openPanel('settings')} aria-label="Настройки">
          <SettingsIcon size={18} />
        </button>
      </div>
    </header>
  )
}

export function Dock() {
  const openPanel = useGame((s) => s.openPanel)
  const clients = useGame((s) => seasonClients(s).length)
  const goal = useGame((s) => s.goal?.clients ?? 10)
  const skillPoints = useGame((s) => s.skillPoints)
  const weekDone = useGame((s) => {
    if (!s.goal || !s.plan) return ''
    const w = s.plan.weeks[currentWeek(s.goal) - 1]
    return w ? `${w.quests.filter((q) => s.quests[q.id]?.done).length}/${w.quests.length}` : ''
  })
  const items: { id: 'quests' | 'clients' | 'chest' | 'shop' | 'hero'; label: string; icon: ReactNode; extra?: string; dot?: boolean }[] = [
    { id: 'quests', label: 'Журнал', icon: <ScrollText size={20} />, extra: weekDone || undefined },
    { id: 'clients', label: 'Клиенты', icon: <Ship size={20} />, extra: `${clients}/${goal}` },
    { id: 'chest', label: 'Сундук', icon: <Backpack size={20} /> },
    { id: 'shop', label: 'Лавка', icon: <Store size={20} /> },
    { id: 'hero', label: 'Герой', icon: <UserRound size={20} />, dot: skillPoints > 0 },
  ]
  return (
    <nav className="dock panel" aria-label="Меню">
      {items.map((it) => (
        <button key={it.id} className="dock-btn" onClick={() => openPanel(it.id)}>
          <span className="dock-icon">
            {it.icon}
            {it.dot ? <span className="hud-dot" /> : null}
          </span>
          <span className="dock-label">
            {it.label}
            {it.extra ? <span className="dock-extra num"> {it.extra}</span> : null}
          </span>
        </button>
      ))}
    </nav>
  )
}

// Полноэкранные фоны локаций. Обёртка absolute/inset:0, внутри — стопка SVG-слоёв 1600×900 (slice).
import { memo, type JSX, type MemoExoticComponent, type ReactNode } from 'react'
import './art.css'
import { clamp, cx } from './geom'
import { ArenaScene } from './scenes/arena'
import { CampScene } from './scenes/camp'
import { DoubtScene } from './scenes/doubt'
import { ForestScene } from './scenes/forest'
import { ForgeScene } from './scenes/forge'
import { LaunchScene } from './scenes/launch'
import { LighthouseScene } from './scenes/lighthouse'
import { StudioScene } from './scenes/studio'
import { TitleScene } from './scenes/title'
import { TowerScene } from './scenes/tower'

export type SceneId =
  | 'title'
  | 'camp'
  | 'doubt'
  | 'forest'
  | 'forge'
  | 'tower'
  | 'studio'
  | 'launch'
  | 'arena'
  | 'lighthouse'

const SCENES: Record<SceneId, MemoExoticComponent<() => JSX.Element>> = {
  title: memo(TitleScene),
  camp: memo(CampScene),
  doubt: memo(DoubtScene),
  forest: memo(ForestScene),
  forge: memo(ForgeScene),
  tower: memo(TowerScene),
  studio: memo(StudioScene),
  launch: memo(LaunchScene),
  arena: memo(ArenaScene),
  lighthouse: memo(LighthouseScene),
}

/** Цвет подложки до отрисовки SVG — верх неба сцены. */
const BG: Record<SceneId, string> = {
  title: '#090d2a',
  camp: '#0b1030',
  doubt: '#14152e',
  forest: '#061019',
  forge: '#100c22',
  tower: '#070d22',
  studio: '#0a0618',
  launch: '#0b0e2c',
  arena: '#1d1440',
  lighthouse: '#08102c',
}

export function Scene({
  id,
  className,
  dim = 0,
  children,
}: {
  id: SceneId
  className?: string
  /** 0..1 — затемнение для читаемости диалогов */
  dim?: number
  children?: ReactNode
}): JSX.Element {
  const Body = SCENES[id]
  return (
    <div className={cx('art-scene', `art-scene--${id}`, className)} style={{ background: BG[id] }}>
      <Body />
      <div className="art-scene-dim" style={{ opacity: clamp(dim) }} aria-hidden="true" />
      {children != null && <div className="art-scene-content">{children}</div>}
    </div>
  )
}

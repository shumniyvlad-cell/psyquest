import type { ReactNode } from 'react'
import type { NpcId } from '../art/Portrait'
import type { ConsumableId, RelicId } from '../game/items'
import type { GameState } from '../game/store'
import type { ChapterId, ChapterMode } from '../game/types'
import type { BossDef } from './Battle'
import type { Line } from './Dialogue'

export interface StepApi {
  /** Шаг выполнен — идём дальше */
  done: () => void
  /** Вернуться на карту, прогресс шага сохранится */
  leave: () => void
  replay: boolean
}

export type StepDef =
  | { id: string; kind: 'dialogue'; lines: Line[] | ((s: GameState) => Line[]); npc?: NpcId }
  | { id: string; kind: 'battle'; boss: BossDef | ((s: GameState) => BossDef); xp: number; coins: number }
  | { id: string; kind: 'custom'; title: string; lead?: string; wide?: boolean; bare?: boolean; headless?: boolean; render: (api: StepApi) => ReactNode }

export interface ChapterReward {
  xp: number
  coins: number
  relic?: RelicId
  item?: { id: ConsumableId; n: number }
}

export interface ChapterDef {
  id: ChapterId
  steps: (mode: ChapterMode, s: GameState) => StepDef[]
  reward: ChapterReward
  /** Итоговая фраза на экране награды */
  summary: (s: GameState) => string
}

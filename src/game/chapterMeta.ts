import type { ChapterId } from './types'
import type { SceneId } from '../art/Scene'
import type { PlaceId } from '../art/icons'
import type { ThemeId } from '../audio/themes'
import type { NpcId } from '../art/Portrait'

export interface ChapterMeta {
  id: ChapterId
  name: string
  short: string
  outcome: string
  scene: SceneId
  place: PlaceId
  theme: ThemeId
  npc: NpcId
  free: boolean
}

export const ROUTE_ORDER: ChapterId[] = ['doubt', 'forest', 'forge', 'tower', 'studio', 'launch', 'arena', 'lighthouse']

export const CHAPTER_META: Record<ChapterId, ChapterMeta> = {
  doubt: {
    id: 'doubt',
    name: 'Долина Сомнений',
    short: 'Уверенность и досье экспертизы',
    outcome: 'Досье экспертизы — твои факты против синдрома самозванца',
    scene: 'doubt',
    place: 'doubt',
    theme: 'doubt',
    npc: 'owl',
    free: true,
  },
  forest: {
    id: 'forest',
    name: 'Лес Смыслов',
    short: 'Ниша и позиционирование',
    outcome: 'Позиционирование одной фразой: кому, с чем и как ты помогаешь',
    scene: 'forest',
    place: 'forest',
    theme: 'forest',
    npc: 'owl',
    free: true,
  },
  forge: {
    id: 'forge',
    name: 'Кузница Продукта',
    short: 'Линейка услуг и цены',
    outcome: 'Лестница продуктов: польза, знакомство, пакет, сопровождение',
    scene: 'forge',
    place: 'forge',
    theme: 'forge',
    npc: 'bear',
    free: false,
  },
  tower: {
    id: 'tower',
    name: 'Башня Ботов',
    short: 'Бот-воронка в Telegram',
    outcome: 'Бот, который встречает, дарит пользу и записывает на встречу',
    scene: 'tower',
    place: 'tower',
    theme: 'tower',
    npc: 'robot',
    free: false,
  },
  studio: {
    id: 'studio',
    name: 'Студия Эха',
    short: 'Контент и первый рилс',
    outcome: 'Хуки, сценарии, контент-план и смонтированный ролик',
    scene: 'studio',
    place: 'studio',
    theme: 'studio',
    npc: 'fox',
    free: false,
  },
  launch: {
    id: 'launch',
    name: 'Площадь Запуска',
    short: 'Прогрев и открытие записи',
    outcome: 'План запуска по дням и отрепетированная неделя продаж',
    scene: 'launch',
    place: 'launch',
    theme: 'launch',
    npc: 'raven',
    free: false,
  },
  arena: {
    id: 'arena',
    name: 'Арена Продаж',
    short: 'Диагностика и возражения',
    outcome: 'Сценарий диагностической встречи и ответы на возражения',
    scene: 'arena',
    place: 'arena',
    theme: 'arena',
    npc: 'lion',
    free: false,
  },
  lighthouse: {
    id: 'lighthouse',
    name: 'Маяк',
    short: 'Первые клиенты',
    outcome: 'Живой счёт реальных клиентов — до твоей цели',
    scene: 'lighthouse',
    place: 'lighthouse',
    theme: 'lighthouse',
    npc: 'owl',
    free: false,
  },
}

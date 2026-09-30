import type { ChapterId } from '../game/types'
import type { ChapterDef } from '../systems/chapterTypes'
import { arenaChapter } from './arena'
import { doubtChapter } from './doubt'
import { forestChapter } from './forest'
import { forgeChapter } from './forge'
import { launchChapter } from './launch'
import { lighthouseChapter } from './lighthouse'
import { studioChapter } from './studio'
import { towerChapter } from './tower'

export const CHAPTERS: Record<ChapterId, ChapterDef> = {
  doubt: doubtChapter,
  forest: forestChapter,
  forge: forgeChapter,
  tower: towerChapter,
  studio: studioChapter,
  launch: launchChapter,
  arena: arenaChapter,
  lighthouse: lighthouseChapter,
}

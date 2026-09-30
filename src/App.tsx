import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { setVolumes } from './audio/engine'
import { lanternOf, useGame } from './game/store'
import { ChapterScreen } from './screens/ChapterScreen'
import { CreateHero } from './screens/CreateHero'
import { Ending } from './screens/Ending'
import { Oath } from './screens/Oath'
import { Prologue } from './screens/Prologue'
import { RouteReveal } from './screens/RouteReveal'
import { Title } from './screens/Title'
import { WorldMap } from './screens/WorldMap'
import { handlePaymentReturn } from './systems/checkout'
import { Panels } from './systems/Panels'
import { useInstant } from './ui/useInstant'

const SCREENS = {
  title: Title,
  create: CreateHero,
  prologue: Prologue,
  oath: Oath,
  route: RouteReveal,
  map: WorldMap,
  chapter: ChapterScreen,
  ending: Ending,
} as const

export function App() {
  const scene = useGame((s) => s.scene)
  const music = useGame((s) => s.settings.music)
  const sfxLevel = useGame((s) => s.settings.sfx)
  const reduced = useGame((s) => s.settings.reducedMotion)
  const lantern = useGame(lanternOf)

  useEffect(() => setVolumes(music, sfxLevel), [music, sfxLevel])

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reduced ? 'true' : 'false'
  }, [reduced])

  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--hero-light', lantern.color)
    r.setProperty('--hero-light-soft', lantern.soft)
  }, [lantern])

  useEffect(() => {
    handlePaymentReturn().catch(() => undefined)
  }, [])

  // защита от «сломанного» сохранения: без героя или плана нельзя на карту
  const hero = useGame((s) => s.hero)
  const plan = useGame((s) => s.plan)
  const safeScene = (scene === 'map' || scene === 'chapter' || scene === 'route') && (!hero || !plan) ? 'title' : scene
  const Screen = SCREENS[safeScene]
  const instant = useInstant()

  if (instant) {
    return (
      <>
        <div className="scene-wrap" key={safeScene}>
          <Screen />
        </div>
        <Panels />
      </>
    )
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={safeScene}
          className="scene-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Screen />
        </motion.div>
      </AnimatePresence>
      <Panels />
    </>
  )
}

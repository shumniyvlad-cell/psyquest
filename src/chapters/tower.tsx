import { lazy, useState } from 'react'
import { deployBot, isDemo } from '../api/client'
import { defaultBotConfig } from '../minigames/bot/model'
import { hasPro, useGame } from '../game/store'
import type { BotConfig } from '../game/types'
import type { ChapterDef, StepApi } from '../systems/chapterTypes'
import { StepFooter } from '../systems/Helpers'
import { LazyBox } from '../ui/Lazy'

const BotBuilder = lazy(() => import('../minigames/bot/BotBuilder').then((m) => ({ default: m.BotBuilder })))

function TowerWorkshop({ api }: { api: StepApi }) {
  const saved = useGame((s) => s.artifacts.bot)
  const pro = useGame(hasPro)
  const playerId = useGame((s) => s.playerId)
  const setArtifact = useGame((s) => s.setArtifact)
  const [cfg, setCfg] = useState<BotConfig>(() => {
    const s = useGame.getState()
    return saved ?? defaultBotConfig({ heroName: s.hero?.name ?? 'Психолог', positioning: s.artifacts.positioning, product: s.artifacts.product })
  })
  const [passed, setPassed] = useState(false)

  const onChange = (c: BotConfig) => {
    setCfg(c)
    setArtifact('bot', c)
  }

  const deploy = isDemo
    ? undefined
    : async (token: string, c: BotConfig) => {
        const r = await deployBot(playerId, token, c)
        useGame.getState().gainXp(150, 'бот ожил в Telegram')
        return r
      }

  return (
    <div className="workbench">
      <LazyBox>
      <BotBuilder
        value={cfg}
        onChange={onChange}
        onTestPassed={() => {
          if (passed) return
          setPassed(true)
          setArtifact('bot', cfg)
          if (!api.replay) useGame.getState().gainXp(180, 'бот прошёл тест-драйв')
        }}
        deploy={deploy}
        pro={pro}
        onNeedPro={() => useGame.getState().openPanel('shop', { shopTab: 'treasury' })}
      />
      </LazyBox>
      <StepFooter
        canGo={passed}
        onGo={api.done}
        label="Дальше"
        note={passed ? 'Голем Молчания повержен. Сценарий сохранён в Сундуке.' : 'Проведи тест-драйв: все три гостя должны дойти до записи.'}
      />
    </div>
  )
}

export const towerChapter: ChapterDef = {
  id: 'tower',
  reward: { xp: 170, coins: 70, relic: 'gear', item: { id: 'hint', n: 1 } },
  summary: (s) =>
    s.artifacts.bot?.deployed
      ? `Бот @${s.artifacts.bot.deployed.username} уже встречает людей в Telegram.`
      : 'Сценарий бота готов: встречает, дарит пользу, бережно приглашает на встречу.',
  steps: (mode) => [
    {
      id: 'intro',
      kind: 'dialogue',
      lines:
        mode === 'express'
          ? [
              { who: 'robot', text: 'Бип! Бот у тебя уже есть? Отлично. Давай проверим его протоколы — вдруг где-то тишина.' },
            ]
          : [
              { who: 'narrator', text: 'Башня гудит, как старый сервер. В окнах мерцают синие огоньки.' },
              { who: 'robot', mood: 'happy', text: 'Бип-буп! Посетитель! Люди пишут в три часа ночи. Ты спишь. Я — нет. Давай меня настроим.' },
              { who: 'robot', mood: 'thinking', text: 'Мой протокол: встретить, дать пользу, спросить разрешения, задать пару вопросов, пригласить на встречу. Без давления. Давление — это баг.' },
              { who: 'owl', text: 'И ещё одно правило Башни: если человеку по-настоящему плохо, бот не продаёт. Он даёт телефоны помощи и зовёт тебя.' },
              { who: 'robot', mood: 'thinking', text: 'Приготовь две ссылки. Первая — где лежит твоя польза: файл в облаке или пост в канале. Вторая — куда записываться: твой Telegram или календарь.' },
              { who: 'robot', mood: 'worried', text: 'На нижнем этаже живёт Голем Молчания. Он питается сообщениями, на которые никто не ответил.' },
            ],
    },
    {
      id: 'builder',
      kind: 'custom',
      title: 'Этажи Башни',
      lead: 'Собери бота-воронку и проведи тест-драйв на трёх гостях. Если сервер игры подключён — бота можно сразу запустить в Telegram.',
      wide: true,
      headless: true,
      render: (api) => <TowerWorkshop api={api} />,
    },
    {
      id: 'outro',
      kind: 'dialogue',
      lines: [
        { who: 'robot', mood: 'proud', text: 'Голем рассыпался! Бип. Я доволен. Это новое для меня чувство.' },
        {
          who: 'owl',
          text: isDemo
            ? 'Сценарий готов. Перенеси его в BotHelp, SaleBot или Leadteh — текст сценария лежит в Сундуке. А когда подключишь сервер игры, бот запустится прямо отсюда.'
            : 'Бот готов. Если ты его уже {запустил|запустила} — заявки будут приходить тебе в Telegram.',
        },
        { who: 'robot', text: 'Возьми шестерёнку. Пусть крутится, пока ты отдыхаешь.' },
      ],
    },
  ],
}

import { useEffect } from 'react'
import { Scene } from '../art/Scene'
import { playTheme } from '../audio/engine'
import { useGame } from '../game/store'
import { Dialogue, type Line } from '../systems/Dialogue'

const LINES: Line[] = [
  { who: 'narrator', text: 'Психея. Страна, где живут чувства, мысли и сны. Ночью здесь всегда туман.' },
  { who: 'owl', mood: 'happy', text: 'Ещё один Фонарщик проснулся. Привет, {name}. Я — Юнга. Сова. Да, в честь того самого. Сны толкую только по пятницам.' },
  { who: 'owl', mood: 'thinking', text: 'Видишь огоньки внизу, в тумане? Это люди, которым нужна помощь. Они блуждают, читают гороскопы и советы из пабликов. А тебя не видят.' },
  { who: 'owl', text: 'Твой фонарь пока светит на полметра. Чтобы тебя находили, нужен Маяк — практика, к которой люди приходят сами.' },
  { who: 'owl', mood: 'proud', text: 'Дорога к Маяку идёт через восемь земель и пару неприятных теней. Я проложу маршрут под твою цель — настоящую, из жизни.' },
  { who: 'owl', text: 'Одно правило: всё, что ты создашь в пути, — настоящее. Позиционирование, продукт, бот, ролики, план запуска. Ты выйдешь отсюда с работающей практикой.' },
  {
    choice: [
      { text: '{Готов|Готова}. Куда идём?', reply: [{ who: 'owl', mood: 'happy', text: 'Сначала — клятва. Скажи мне, к чему ты идёшь.' }] },
      {
        text: 'А если у меня не получится?',
        reply: [{ who: 'owl', mood: 'thinking', text: 'Отличный вопрос. Значит, нам будет о чём поговорить в первой главе. А пока — клятва.' }],
      },
    ],
  },
]

export function Prologue() {
  useEffect(() => {
    playTheme('title')
  }, [])
  return (
    <div className="screen">
      <Scene id="camp" dim={0.15} />
      <Dialogue lines={LINES} npc="owl" onDone={() => useGame.getState().go('oath')} />
    </div>
  )
}

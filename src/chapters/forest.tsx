import { useMemo, useState, type CSSProperties } from 'react'
import { BOSS_LOOKS, Inkblot } from '../art/Inkblot'
import { sfx, stinger } from '../audio/engine'
import { CLASSES } from '../game/progression'
import { scorePositioning } from '../game/scoring'
import { useGame } from '../game/store'
import type { PositioningArtifact } from '../game/types'
import type { ChapterDef, StepApi } from '../systems/chapterTypes'
import { HintReveal, MentorBox, StepFooter } from '../systems/Helpers'
import { Bar } from '../ui/Bar'
import { Button } from '../ui/Button'
import './forest.css'

const WHO = [
  'IT-специалисты с выгоранием',
  'мамы в декрете',
  'женщины 30–45 после развода',
  'пары в кризисе',
  'родители подростков',
  'предприниматели и руководители',
  'студенты и молодые специалисты',
  'люди в эмиграции',
]
const PAIN = [
  'нет сил и радости от работы',
  'тревога не даёт спать',
  'ссоры стали привычкой',
  'раздражение сменяется виной',
  'страшно что-то менять',
  'не на кого опереться',
  'накрывают панические атаки',
  'кажется, что ты хуже других',
]
const RESULT = [
  'вернуть энергию и интерес к жизни',
  'снова спокойно спать и меньше тревожиться',
  'восстановить близость и научиться договариваться',
  'чувствовать себя увереннее',
  'пережить расставание и собрать себя заново',
  'выстроить границы без чувства вины',
  'справляться с паникой и не бояться её',
  'найти своё направление',
]
const METHODS = ['КПТ', 'гештальт', 'психоанализ', 'схема-терапия', 'ACT', 'арт-терапия', 'телесная терапия', 'коучинг']

const EXAMPLES = [
  'Мои клиенты — IT-специалисты, которые выгорели на работе мечты. Приходят, когда нет сил даже на любимые проекты. Помогаю вернуть энергию и выстроить ритм без переработок. Подход — КПТ, 8–12 встреч.',
  'Работаю с женщинами 30–45, которые переживают развод. Помогаю пережить расставание, собрать себя заново и перестать винить себя. Гештальт-подход, бережно и в вашем темпе.',
  'Помогаю родителям подростков, когда дома — постоянные ссоры и хлопанье дверями. Учимся слышать друг друга и договариваться без крика. Семейная системная терапия.',
]

function PositioningForge({ api, express }: { api: StepApi; express: boolean }) {
  const saved = useGame((s) => s.artifacts.positioning)
  const hero = useGame((s) => s.hero)
  const niche = useGame((s) => s.goal?.niche ?? '')
  const setArtifact = useGame((s) => s.setArtifact)
  const gainXp = useGame((s) => s.gainXp)

  const classMethod = hero ? CLASSES[hero.classId].method.split(',')[0] : 'КПТ'
  const [stage, setStage] = useState<'cards' | 'text' | 'clear'>(saved?.statement ? 'text' : 'cards')
  const [who, setWho] = useState(saved?.who ?? niche)
  const [pain, setPain] = useState(saved?.pain ?? '')
  const [result, setResult] = useState(saved?.result ?? '')
  const [method, setMethod] = useState(saved?.method ?? classMethod)
  const [statement, setStatement] = useState(saved?.statement ?? '')

  const whoList = useMemo(() => (niche && !WHO.includes(niche) ? [niche, ...WHO] : WHO), [niche])
  const methods = useMemo(() => (METHODS.includes(classMethod) ? METHODS : [classMethod, ...METHODS]), [classMethod])
  const parts = { who, pain, result, method }
  const sc = useMemo(() => scorePositioning(statement, { who, pain, result, method }), [statement, who, pain, result, method])
  const cardsReady = who.trim() && pain.trim() && result.trim()

  const toText = () => {
    sfx('page')
    if (!statement.trim()) {
      setStatement(`Мои клиенты — ${who}. Приходят, когда ${pain}. Помогаю ${result}. Работаю в подходе: ${method}.`)
    }
    setStage('text')
  }

  const save = (score: number) => {
    const art: PositioningArtifact = { who, pain, result, method, statement: statement.trim(), score }
    setArtifact('positioning', art)
  }

  const clear = () => {
    save(sc.score)
    stinger('victory')
    setStage('clear')
    if (!api.replay) gainXp(120 + Math.round((sc.score - 65) * 2), 'туман рассеян')
  }

  const fogLine =
    sc.score < 30 ? 'Всё сливается… Кто ты? Кому ты?' : sc.score < 65 ? 'Уже что-то видно… но я ещё держусь.' : 'Нет… слишком ясно…'

  return (
    <div className="workbench">
      <div className="fp-fog" style={{ opacity: stage === 'clear' ? 0 : 0.75 * (1 - sc.score / 100) }} aria-hidden="true" />

      {stage === 'cards' ? (
        <>
          {express ? (
            <p className="small muted">Ниша у тебя уже есть. Разложим её на части — так будет видно, где туман.</p>
          ) : null}
          <CardGroup title="Кто твой клиент" hint="Кого ты хочешь видеть в кресле напротив чаще всего?" list={whoList} value={who} onChange={setWho} placeholder="Свой вариант: например, врачи после ковида" />
          <CardGroup title="С чем приходят" hint="Состояние или ситуация — словами клиента, не терминами." list={PAIN} value={pain} onChange={setPain} placeholder="Свой вариант: например, не могут выйти на работу после декрета" prefix="Приходят, когда…" />
          <CardGroup title="К чему приходят" hint="Какой результат человек заметит сам." list={RESULT} value={result} onChange={setResult} placeholder="Свой вариант: например, вернуться к работе без паники" prefix="Помогаю…" />
          <CardGroup title="Как ты работаешь" hint="Метод вызывает доверие, но он — не главное." list={methods} value={method} onChange={setMethod} placeholder="Свой вариант" />
          <StepFooter canGo={!!cardsReady} onGo={toText} label="Собрать фразу" note={cardsReady ? undefined : 'Выбери клиента, запрос и результат.'} />
        </>
      ) : null}

      {stage === 'text' ? (
        <>
          <div className="fp-duel panel panel-pad">
            <div className="fp-blot">
              <Inkblot {...BOSS_LOOKS.fog} hp={1 - sc.score / 100} state={sc.score >= 65 ? 'hit' : 'idle'} size={200} />
            </div>
            <div className="fp-meter stack">
              <p className="display t-20">Туман Размытости</p>
              <p className="small muted fp-fogline">«{fogLine}»</p>
              <div className="spread small">
                <span>Ясность</span>
                <span className="num gold">{sc.score}%</span>
              </div>
              <Bar value={sc.score} max={100} variant={sc.score >= 65 ? 'mint' : 'gold'} />
              <p className="tiny faint">Чтобы рассеять туман, нужно 65% и больше.</p>
            </div>
          </div>

          <div className="panel panel-pad workbench-card">
            <label className="field-label" htmlFor="fp-text">
              Твоё позиционирование
            </label>
            <textarea id="fp-text" className="textarea fp-text" rows={4} value={statement} onChange={(e) => setStatement(e.target.value)} />
            <div className="fp-notes">
              {sc.good.map((g) => (
                <p key={g} className="small mint">
                  {g}
                </p>
              ))}
              {sc.tips.map((t) => (
                <p key={t} className="small fp-tip">
                  {t}
                </p>
              ))}
            </div>
            <div className="row-wrap">
              <Button variant="quiet" size="sm" onClick={() => setStage('cards')}>
                Изменить части
              </Button>
            </div>
            <HintReveal id="forest_statement" items={EXAMPLES} onUse={(t) => setStatement(t)} />
            <MentorBox task="positioning" draft={statement} context={{ ...parts, goal: 'позиционирование психолога для шапки профиля' }} onApply={(t) => setStatement(t)} />
          </div>
          <StepFooter canGo={sc.score >= 65} onGo={clear} label="Рассеять туман" note={sc.score >= 65 ? 'Туман дрожит. Самое время.' : undefined} />
        </>
      ) : null}

      {stage === 'clear' ? (
        <div className="panel panel-pad workbench-card anim-rise fp-clear">
          <Inkblot {...BOSS_LOOKS.fog} hp={0} state="dying" size={160} />
          <p className="display t-25">Туман рассеялся</p>
          <blockquote className="fp-quote">{statement}</blockquote>
          <p className="small muted">Скопируй эту фразу в шапку профиля и описание канала. Её можно будет улучшать по дороге — она лежит в Сундуке.</p>
          <div className="row-wrap">
            <Button
              variant="ghost"
              onClick={() => {
                navigator.clipboard?.writeText(statement).catch(() => undefined)
                useGame.getState().toast('Позиционирование скопировано', 'info')
              }}
            >
              Скопировать
            </Button>
            <Button variant="lit" onClick={api.done}>
              Дальше
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CardGroup({
  title,
  hint,
  list,
  value,
  onChange,
  placeholder,
  prefix,
}: {
  title: string
  hint: string
  list: string[]
  value: string
  onChange: (v: string) => void
  placeholder: string
  prefix?: string
}) {
  const custom = value && !list.includes(value) ? value : ''
  return (
    <section className="panel panel-pad workbench-card">
      <div className="stack" style={{ '--gap': '2px' } as CSSProperties}>
        <h3 className="display t-20">{title}</h3>
        <p className="small faint">{hint}</p>
      </div>
      <div className="fp-cards">
        {list.map((item) => (
          <button
            key={item}
            className="choice fp-card"
            aria-pressed={value === item}
            onClick={() => {
              sfx('select')
              onChange(item)
            }}
          >
            {prefix ? <span className="tiny faint">{prefix} </span> : null}
            {item}
          </button>
        ))}
      </div>
      <input className="input" placeholder={placeholder} value={custom} onChange={(e) => onChange(e.target.value)} />
    </section>
  )
}

export const forestChapter: ChapterDef = {
  id: 'forest',
  reward: { xp: 140, coins: 60, relic: 'compass', item: { id: 'hint', n: 1 } },
  summary: (s) => `Теперь у тебя есть компас: «${s.artifacts.positioning?.statement ?? 'твоё позиционирование'}»`,
  steps: (mode) => [
    {
      id: 'intro',
      kind: 'dialogue',
      lines:
        mode === 'express'
          ? [
              { who: 'narrator', text: 'Лес Смыслов. Тропинки здесь меняются местами, если идти без цели.' },
              { who: 'owl', text: 'Ниша у тебя уже есть — отлично. Проверим, насколько она острая. Туман не любит точных слов.' },
            ]
          : [
              { who: 'narrator', text: 'Лес Смыслов. Тропинки здесь меняются местами, если идти без цели.' },
              { who: 'owl', text: 'Главный вопрос леса звучит просто: «Кому ты помогаешь?» Попробуй ответить.' },
              {
                choice: [
                  {
                    text: 'Всем, кому нужна помощь!',
                    reply: [
                      { who: 'owl', mood: 'worried', text: 'Слышишь, как сгустился туман? «Всем» — любимое слово Тумана Размытости. Когда ты говоришь «всем», тебя не слышит никто.' },
                    ],
                  },
                  {
                    text: 'Людям с тревогой, наверное…',
                    reply: [
                      { who: 'owl', mood: 'thinking', text: 'Уже теплее. Но тревога бывает у подростка перед экзаменом и у топ-менеджера перед советом директоров. Это разные люди — и разные слова.' },
                    ],
                  },
                  {
                    text: 'Пока не знаю — поэтому я здесь.',
                    reply: [{ who: 'owl', mood: 'happy', text: 'Честный ответ — лучшее начало. Сейчас разберёмся.' }],
                  },
                ],
              },
              { who: 'owl', text: 'Позиционирование — это не про ограничения. Это про то, чтобы нужный человек узнал себя в твоих словах и подумал: «Это про меня».' },
              { who: 'owl', mood: 'thinking', text: 'Соберём фразу из четырёх частей: кто клиент, с чем приходит, к чему приходит и как ты работаешь.' },
            ],
    },
    {
      id: 'forge',
      kind: 'custom',
      title: 'Тропа позиционирования',
      lead: 'Собери фразу, в которой твой клиент узнает себя. Чем она точнее, тем меньше тумана.',
      render: (api) => <PositioningForge api={api} express={mode === 'express'} />,
    },
    {
      id: 'outro',
      kind: 'dialogue',
      lines: [
        { who: 'owl', mood: 'proud', text: 'Слышишь? Тишина. Так звучит ясность.' },
        { who: 'owl', text: 'Эта фраза — не навсегда. Позиционирование растёт вместе с тобой. Но сейчас у тебя есть компас.' },
        { who: 'owl', mood: 'thinking', text: 'Дальше тропа ведёт к Вратам Мастерства. За ними — Кузница, Башня, Студия, Площадь и Арена. Там мы соберём всё, что нужно для первых клиентов.' },
      ],
    },
  ],
}

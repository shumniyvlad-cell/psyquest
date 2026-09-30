import { useEffect, useRef, useState } from 'react'
import { Hammer } from 'lucide-react'
import { sfx, stinger } from '../audio/engine'
import { fmtRub } from '../game/planner'
import { useGame } from '../game/store'
import { q } from '../game/text'
import type { ProductArtifact, ProductItem } from '../game/types'
import type { BossDef } from '../systems/Battle'
import type { ChapterDef, StepApi } from '../systems/chapterTypes'
import { HintReveal, MentorBox, StepFooter } from '../systems/Helpers'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import './forge.css'

type Tier = 'leadMagnet' | 'entry' | 'core' | 'premium'

const TIERS: { key: Tier; title: string; role: string; formats: string[] }[] = [
  {
    key: 'leadMagnet',
    title: 'Польза бесплатно',
    role: 'Первое касание: человек получает пользу за 10 минут и узнаёт твой голос.',
    formats: ['чек-лист', 'мини-тест', 'аудиопрактика', 'гайд', 'видеоурок'],
  },
  {
    key: 'entry',
    title: 'Знакомство',
    role: 'Недорогая встреча: вы понимаете, подходите ли друг другу, и человек видит, как ты работаешь.',
    formats: ['диагностическая встреча', 'консультация-знакомство', 'разбор запроса'],
  },
  {
    key: 'core',
    title: 'Основной пакет',
    role: 'Главная работа с запросом. Здесь — твой доход и результат клиента.',
    formats: ['пакет встреч', 'курс терапии', 'программа сопровождения'],
  },
  {
    key: 'premium',
    title: 'Сопровождение',
    role: 'Для тех, кому нужно больше: глубже, дольше, с поддержкой между встречами.',
    formats: ['долгосрочная терапия', 'сопровождение с поддержкой в мессенджере', 'интенсив'],
  },
]

function suggest(key: Tier, check: number, who: string, result: string): ProductItem {
  void who
  switch (key) {
    case 'leadMagnet':
      return { name: `Чек-лист «5 признаков, что пора позаботиться о себе»`, format: 'чек-лист', price: 0, promise: 'За 10 минут помогает заметить своё состояние и понять, с чего начать' }
    case 'entry':
      return { name: 'Встреча-знакомство', format: 'диагностическая встреча', price: Math.max(500, Math.round(check / 10 / 100) * 100), promise: 'Разберём запрос, наметим план работы и решим, подходим ли мы друг другу' }
    case 'core':
      return { name: 'Пакет «Путь к опоре»', format: 'пакет встреч', price: check, promise: result ? `8 встреч, чтобы ${result}` : '8 встреч раз в неделю с понятными шагами' }
    case 'premium':
      return { name: 'Сопровождение 3 месяца', format: 'сопровождение с поддержкой в мессенджере', price: Math.round((check * 2.6) / 1000) * 1000, promise: 'Еженедельные встречи и поддержка между ними' }
  }
}

function Ladder({ api }: { api: StepApi }) {
  const goal = useGame((s) => s.goal)
  const pos = useGame((s) => s.artifacts.positioning)
  const saved = useGame((s) => s.artifacts.product)
  const setArtifact = useGame((s) => s.setArtifact)
  const gainXp = useGame((s) => s.gainXp)
  const check = goal?.check ?? 20000
  const [p, setP] = useState<Record<Tier, ProductItem>>(() => ({
    leadMagnet: saved?.leadMagnet ?? suggest('leadMagnet', check, pos?.who ?? '', pos?.result ?? ''),
    entry: saved?.entry ?? suggest('entry', check, pos?.who ?? '', pos?.result ?? ''),
    core: saved?.core ?? suggest('core', check, pos?.who ?? '', pos?.result ?? ''),
    premium: saved?.premium ?? suggest('premium', check, pos?.who ?? '', pos?.result ?? ''),
  }))

  const set = (t: Tier, patch: Partial<ProductItem>) => setP((cur) => ({ ...cur, [t]: { ...cur[t], ...patch } }))

  const clients = goal?.clients ?? 10
  const income = clients * p.core.price
  const perSession = p.core.price / 8
  const ready = TIERS.every((t) => p[t.key].name.trim().length > 2) && p.core.price > 0

  const finish = () => {
    const art: ProductArtifact = { ...p, quality: saved?.quality ?? 'B' }
    setArtifact('product', art)
    if (!api.replay) gainXp(100, 'лестница продуктов')
    api.done()
  }

  return (
    <div className="workbench">
      <div className="fg-ladder">
        {TIERS.map((t, i) => (
          <section key={t.key} className="panel panel-pad workbench-card fg-tier" style={{ marginLeft: `${i * 3}%` }}>
            <div className="fg-tier-head">
              <span className="fg-step num">{i + 1}</span>
              <div className="stack" style={{ gap: 2 }}>
                <h3 className="display t-20">{t.title}</h3>
                <p className="small faint">{t.role}</p>
              </div>
            </div>
            <div className="fg-grid">
              <Field label="Название">
                <input className="input" value={p[t.key].name} onChange={(e) => set(t.key, { name: e.target.value })} />
              </Field>
              <Field label="Формат">
                <select className="select" value={p[t.key].format} onChange={(e) => set(t.key, { format: e.target.value })}>
                  {[...new Set([p[t.key].format, ...t.formats])].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.key === 'leadMagnet' ? 'Цена (обычно бесплатно)' : 'Цена, ₽'}>
                <input
                  className="input num"
                  type="number"
                  min={0}
                  step={100}
                  value={p[t.key].price}
                  onChange={(e) => set(t.key, { price: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Field>
            </div>
            <Field label="Что получит человек" hint="Процесс и типичные изменения — без обещаний гарантированного результата.">
              <input className="input" value={p[t.key].promise} onChange={(e) => set(t.key, { promise: e.target.value })} />
            </Field>
          </section>
        ))}
      </div>

      <div className="panel panel-pad workbench-card fg-calc">
        <h3 className="display t-20">Проверка цели</h3>
        <div className="fg-calc-grid">
          <div>
            <span className="fg-big gold num">{fmtRub(income)}</span>
            <span className="small muted">
              {clients} × {fmtRub(p.core.price)} — доход от первой волны пакетов
            </span>
          </div>
          <div>
            <span className="fg-big num">{fmtRub(Math.round(perSession))}</span>
            <span className="small muted">стоимость одной встречи внутри пакета из 8</span>
          </div>
          <div>
            <span className="fg-big num">{clients + (goal?.currentClients ?? 0)}</span>
            <span className="small muted">сессий в неделю, когда цель будет достигнута</span>
          </div>
        </div>
        {perSession < 1500 ? (
          <p className="small ember">Встреча дешевле 1 500 ₽ — это заметно ниже рынка. Проверь, хватит ли сил на такую нагрузку за такие деньги.</p>
        ) : null}
        <MentorBox
          task="offer"
          label="Разбор Совы: линейка и цены"
          draft={TIERS.map((t) => `${t.title}: ${p[t.key].name} (${p[t.key].format}), ${p[t.key].price} ₽ — ${p[t.key].promise}`).join('\n')}
          context={{ who: pos?.who, result: pos?.result, check }}
        />
        <HintReveal
          id="forge_ladder"
          items={[
            'Польза: аудиопрактика «10 минут тишины для тревожного ума» — бесплатно. Знакомство: встреча 50 минут — 2 000 ₽. Пакет: 8 встреч «Спокойная голова» — 24 000 ₽. Сопровождение: 3 месяца + чат поддержки — 65 000 ₽.',
            'Польза: тест «Насколько вы выгорели» с разбором — бесплатно. Знакомство: разбор запроса 30 минут — 1 000 ₽. Пакет: 10 встреч по КПТ — 35 000 ₽. Интенсив: 3 встречи за неделю перед важным решением — 18 000 ₽.',
          ]}
        />
      </div>

      <StepFooter canGo={ready} onGo={finish} label="Отнести на наковальню" note={ready ? undefined : 'Назови все четыре ступени и укажи цену основного пакета.'} />
    </div>
  )
}

/** Ковка: попасть по наковальне, когда искра в золотой зоне. Три удара. */
function ForgeGame({ api }: { api: StepApi }) {
  const setArtifact = useGame((s) => s.setArtifact)
  const product = useGame((s) => s.artifacts.product)
  const gainXp = useGame((s) => s.gainXp)
  const [hits, setHits] = useState<number[]>([])
  const [pos, setPos] = useState(0)
  const [flash, setFlash] = useState('')
  const raf = useRef(0)
  const start = useRef(performance.now())
  const done = hits.length >= 3

  useEffect(() => {
    if (done) return
    const speed = 1.3 + hits.length * 0.45
    const tick = (t: number) => {
      const x = (Math.sin(((t - start.current) / 1000) * speed * Math.PI) + 1) / 2
      setPos(x)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [hits.length, done])

  const strike = () => {
    if (done) return
    const dist = Math.abs(pos - 0.5)
    const quality = dist < 0.06 ? 3 : dist < 0.14 ? 2 : dist < 0.26 ? 1 : 0
    sfx('forge')
    setFlash(['Мимо', 'Сойдёт', 'Хорошо', 'Идеально'][quality])
    const next = [...hits, quality]
    setHits(next)
    if (next.length >= 3) {
      const sum = next.reduce((a, b) => a + b, 0)
      const grade: ProductArtifact['quality'] = sum >= 8 ? 'S' : sum >= 6 ? 'A' : sum >= 3 ? 'B' : 'C'
      if (product) setArtifact('product', { ...product, quality: grade })
      stinger(grade === 'S' || grade === 'A' ? 'victory' : 'quest')
      if (!api.replay) gainXp(40 + sum * 10, `ковка на ${grade}`)
    }
  }

  const strikeRef = useRef(strike)
  strikeRef.current = strike
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        strikeRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sum = hits.reduce((a, b) => a + b, 0)
  const grade = sum >= 8 ? 'S' : sum >= 6 ? 'A' : sum >= 3 ? 'B' : 'C'

  return (
    <div className="workbench">
      <div className="panel panel-pad workbench-card fg-anvil">
        <p className="muted">
          Бей, когда искра в золотой зоне. Пробел или кнопка. От качества ковки зависит, насколько уверенно ты будешь говорить о цене.
        </p>
        <div className="fg-track" aria-hidden="true">
          <div className="fg-zone fg-zone-ok" />
          <div className="fg-zone fg-zone-good" />
          <div className="fg-zone fg-zone-best" />
          <div className="fg-spark" style={{ left: `${pos * 100}%` }} />
        </div>
        <div className="fg-hits">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`fg-hit ${hits[i] !== undefined ? `q${hits[i]}` : ''}`}>
              {hits[i] !== undefined ? ['Мимо', 'Сойдёт', 'Хорошо', 'Идеально'][hits[i]] : `Удар ${i + 1}`}
            </span>
          ))}
        </div>
        {!done ? (
          <Button variant="lit" size="lg" icon={<Hammer size={20} />} onClick={strike} sound={false}>
            Ударить молотом
          </Button>
        ) : (
          <div className="stack anim-rise" style={{ alignItems: 'center' }}>
            <span className="fg-grade">{grade}</span>
            <p className="display t-20">
              {grade === 'S'
                ? 'Безупречно. Бер одобрительно хмыкает.'
                : grade === 'A'
                  ? 'Крепкая работа. Такой продукт не стыдно показать.'
                  : grade === 'B'
                    ? 'Годится. Отполируешь в процессе.'
                    : 'Кривовато, но это первый металл. Бывает.'}
            </p>
            <Button variant="lit" onClick={api.done}>
              Дальше
            </Button>
          </div>
        )}
        {flash && !done ? <span className="fg-flash anim-rise" key={hits.length}>{flash}</span> : null}
      </div>
    </div>
  )
}

function goblin(): BossDef {
  const price = useGame.getState().artifacts.product?.core.price ?? 20000
  const pretty = new Intl.NumberFormat('ru-RU').format(price)
  return {
    id: 'goblin',
    name: 'Гоблин Обесценивания',
    epithet: 'шепчет, что твоя работа ничего не стоит',
    look: 'goblin',
    hp: 120,
    value: true,
    intro: 'Хи-хи. Продукт выковал? Сейчас мы узнаем, сколько он стоит на самом деле. Подсказка: ноль.',
    defeatLine: 'Ладно-ладно… Пусть будет полная цена. Но я ещё посижу в чате с клиентами. Хи.',
    attacks: [
      {
        line: `${pretty} ₽ за разговоры? Я с подругой поговорю бесплатно!`,
        options: [
          {
            text: 'Подруга поддержит — и это ценно. А я помогу разобраться, почему это повторяется и что с этим делать. У меня метод и профессиональная ответственность.',
            q: 'great',
            why: 'Отлично: ты не обесцениваешь подругу и объясняешь разницу — метод, структура, ответственность.',
          },
          {
            text: 'Вообще-то я {дипломированный|дипломированная} специалист.',
            q: 'ok',
            why: 'Диплом — аргумент для тебя, а не для клиента. Ему важно, что изменится в его жизни.',
          },
          {
            text: 'Подруга только навредит, лучше идите ко мне.',
            q: 'toxic',
            why: 'Обесценивать близких клиента — плохая идея: это его опора. И заодно манипуляция.',
          },
        ],
      },
      {
        line: 'Сделай скидку, ты же {начинающий|начинающая}!',
        options: [
          {
            text: 'Моя цена отражает мою работу. Если сейчас это много — начнём со встречи-знакомства, она дешевле. А пакет возьмёте, когда будете уверены.',
            q: 'great',
            why: 'Сильно: ты сохраняешь цену и даёшь человеку вход поменьше. Лестница продуктов работает.',
          },
          {
            text: 'Ну ладно, минус 30%.',
            q: 'ok',
            why: 'Скидка из неловкости учит клиента, что цену можно продавить. А тебя — что твоё время стоит меньше.',
          },
          {
            text: 'Да, я пока дёшево беру.',
            q: 'bad',
            why: 'Самообесценивание. Цена новичка может быть ниже рынка — но это решение, а не извинение.',
          },
        ],
      },
      {
        line: 'Психология — это не настоящая помощь, так, болтовня.',
        options: [
          {
            text: 'Психотерапия — метод с доказанной эффективностью. Но спорить не буду: приходите на одну встречу и решите сами.',
            q: 'great',
            why: 'Спокойствие, факт и приглашение без давления. Ты не втягиваешься в спор.',
          },
          {
            text: 'Вы просто не встречали хорошего психолога.',
            q: 'ok',
            why: 'Защищаться естественно, но это спор о вкусах. Лучше спокойно опереться на факты.',
          },
          {
            text: 'С таким отношением вам никто не поможет.',
            q: 'toxic',
            why: 'Это обвинение. Человек, который сомневается, после такого точно не придёт.',
          },
        ],
      },
      {
        line: 'Вон у блогера марафон за 990 — и все счастливы!',
        options: [
          {
            text: 'Марафон — формат для вдохновения. Я работаю с запросом глубоко и индивидуально. Это разные продукты — как фитнес-челлендж и тренер.',
            q: 'great',
            why: 'Ты не ругаешь конкурентов, а показываешь разницу форматов. Клиенту так проще выбрать.',
          },
          {
            text: 'Ну, могу тоже сделать марафон.',
            q: 'ok',
            why: 'Можно — если это часть твоей лестницы. Но копировать чужой формат из страха — не стратегия.',
          },
          {
            text: 'Эх, наверное, людям правда нужно подешевле.',
            q: 'bad',
            why: 'Людям нужен понятный результат. Дешевизна — не единственная причина выбирать.',
          },
        ],
      },
      {
        line: 'А гарантии дашь? Нет? Тогда за что платить?',
        options: [
          {
            text: 'Гарантировать результат в терапии не может никто — это честно. Я гарантирую другое: профессиональную работу, конфиденциальность и регулярную обратную связь о прогрессе.',
            q: 'great',
            why: 'Идеально: этично и конкретно. Ты заменяешь невозможную гарантию реальными обязательствами.',
          },
          {
            text: 'Гарантирую: через месяц вы забудете о проблеме!',
            q: 'toxic',
            why: 'Обещание результата нарушает этику и почти всегда оборачивается разочарованием. Тень смеётся.',
          },
          {
            text: 'Ну… обычно людям помогает.',
            q: 'ok',
            why: 'Неуверенно. Лучше прямо сказать, что ты можешь гарантировать, а что — нет.',
          },
        ],
      },
    ],
  }
}

export const forgeChapter: ChapterDef = {
  id: 'forge',
  reward: { xp: 160, coins: 70, relic: 'hammer', item: { id: 'supervision', n: 1 } },
  summary: (s) => {
    const p = s.artifacts.product
    return p ? `Выкован продукт ${q(p.core.name)} за ${fmtRub(p.core.price)} и вся лестница вокруг него.` : 'Лестница продуктов готова.'
  },
  steps: (mode) => [
    {
      id: 'intro',
      kind: 'dialogue',
      lines:
        mode === 'express'
          ? [
              { who: 'bear', text: 'Продукт у тебя уже есть? Хорошо. Положим на наковальню — проверим, где металл тонкий.' },
            ]
          : [
              { who: 'narrator', text: 'Жар кузницы слышно раньше, чем видно. Молот бьёт в такт сердцу.' },
              { who: 'bear', text: 'Кто пришёл в кузню без металла? А, у тебя позиционирование. Годится. Из него и будем ковать.' },
              { who: 'bear', mood: 'thinking', text: 'Запомни: одна услуга — это ещё не продукт. Продукт — это лестница. По ней человек поднимается к тебе, шаг за шагом.' },
              { who: 'bear', text: 'Первая ступень — польза бесплатно. Вторая — знакомство. Третья — основной пакет. Четвёртая — сопровождение для тех, кому нужно больше.' },
              { who: 'owl', mood: 'happy', text: 'Бер немногословный. Но по делу.' },
            ],
    },
    {
      id: 'ladder',
      kind: 'custom',
      title: 'Лестница продуктов',
      lead: 'Четыре ступени — от первой пользы до глубокой работы. Цены можно поменять когда угодно, но назвать их нужно сейчас.',
      wide: true,
      render: (api) => <Ladder api={api} />,
    },
    {
      id: 'anvil',
      kind: 'custom',
      title: 'Ковка',
      lead: 'Продукт на наковальне. Три точных удара — и он станет крепче.',
      render: (api) => <ForgeGame api={api} />,
    },
    {
      id: 'goblin-intro',
      kind: 'dialogue',
      lines: [
        { who: 'narrator', text: 'Из-за наковальни выползает мелкая колючая клякса. Пахнет скидками.' },
        { who: 'bear', mood: 'worried', text: 'Гоблин Обесценивания. Будет торговаться. Не поддавайся — но и не груби.' },
      ],
    },
    { id: 'battle', kind: 'battle', boss: goblin, xp: 170, coins: 45 },
    {
      id: 'outro',
      kind: 'dialogue',
      lines: [
        { who: 'bear', mood: 'proud', text: 'Вот теперь это продукт. С ценой, с формой, с обещанием, которое ты можешь выполнить.' },
        { who: 'bear', text: 'Держи молот. Тяжёлый? Это вес твоей ценности. Привыкай.' },
      ],
    },
  ],
}

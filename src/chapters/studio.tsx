import { lazy, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clapperboard, Lock, Plus, Shuffle, Trash2 } from 'lucide-react'
import { sfx } from '../audio/engine'
import { hasPro, shortId, useGame } from '../game/store'
import { q } from '../game/text'
import type { ContentArtifact, ContentPlanDay, ReelScript } from '../game/types'
import type { BossDef } from '../systems/Battle'
import type { ChapterDef, StepApi } from '../systems/chapterTypes'
import { HintReveal, MentorBox, StepFooter } from '../systems/Helpers'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { LazyBox } from '../ui/Lazy'
import './studio.css'

const FREE_FORMULAS = [
  'Почему ты [устаёшь], даже если [спишь по 8 часов]',
  '3 признака, что [ты на грани выгорания]',
  'Я психолог, и вот что я никогда не скажу [клиенту с тревогой]',
  'Если ты [откладываешь дела], это не лень. Это [страх ошибки]',
  'Стоп. Перестань [терпеть], если хочешь [сохранить отношения]',
  'Что происходит в голове, когда [накрывает паника]',
  'Одна фраза, которая помогает, когда [хочется всё бросить]',
  'Ошибка, которую делают почти все [родители подростков]',
]
const PRO_FORMULAS = [
  'Ты не [слабый человек]. Ты [слишком долго был сильным]',
  'Самая частая причина [ссор в паре] — не то, что ты думаешь',
  'Долго считалось, что [терапия — для слабых]. Это не так',
  'Что сказать себе, когда [всё валится из рук]',
  '[Айтишники], это видео для вас',
  'Почему после [отпуска] становится хуже, а не лучше',
  'Упражнение на 60 секунд, если [сердце колотится перед встречей]',
  'Не делай этого, когда [ты злишься на ребёнка]',
  'Разница между [усталостью] и [выгоранием], которую важно знать',
  'Вопрос, который я задаю каждому клиенту на первой встрече',
  'Как понять, что [пора к психологу]? Проверь три пункта',
  'Мне часто пишут: «[я всё понимаю, но не могу]». Разбираю',
]

const ReelEditor = lazy(() => import('../minigames/video/ReelEditor').then((m) => ({ default: m.ReelEditor })))

const NO_SCRIPTS: ReelScript[] = []

const RUBRIC: Record<ContentPlanDay['rubric'], string> = {
  expert: 'Экспертный',
  personal: 'Личный',
  engaging: 'Вовлекающий',
  selling: 'Продающий',
}
const FORMAT: Record<ContentPlanDay['format'], string> = { reel: 'Рилс', post: 'Пост', stories: 'Сторис', live: 'Эфир' }

function HookLab({ api }: { api: StepApi }) {
  const pro = useGame(hasPro)
  const saved = useGame((s) => s.artifacts.content)
  const pos = useGame((s) => s.artifacts.positioning)
  const setArtifact = useGame((s) => s.setArtifact)
  const gainXp = useGame((s) => s.gainXp)
  const [hooks, setHooks] = useState<string[]>(saved?.hooks?.length ? saved.hooks : [])

  useEffect(() => {
    const cur = useGame.getState().artifacts.content
    setArtifact('content', { hooks, scripts: cur?.scripts ?? [], plan: cur?.plan ?? [] })
  }, [hooks, setArtifact])

  const add = (t: string) => {
    sfx('select')
    setHooks((prev) => [...prev, t])
  }
  const good = hooks.filter((h) => h.trim().length > 12 && !h.includes('[')).length

  return (
    <div className="workbench">
      <div className="panel panel-pad workbench-card">
        <h3 className="display t-20">Формулы хуков</h3>
        <p className="small faint">Нажми на формулу — она попадёт в список. Замени слова в скобках на свои: боль и язык твоего клиента{pos?.who ? ` (${pos.who})` : ''}.</p>
        <div className="st-formulas">
          {FREE_FORMULAS.map((f) => (
            <button key={f} className="choice st-formula" onClick={() => add(f)}>
              {f}
            </button>
          ))}
          {PRO_FORMULAS.map((f) => (
            <button
              key={f}
              className={`choice st-formula ${pro ? '' : 'is-locked'}`}
              onClick={() => (pro ? add(f) : useGame.getState().openPanel('shop', { shopTab: 'treasury' }))}
            >
              {pro ? null : <Lock size={13} />} {f}
            </button>
          ))}
        </div>
        {!pro ? <p className="tiny faint">Ещё 12 формул — в Наборе Мастера.</p> : null}
      </div>

      <div className="panel panel-pad workbench-card">
        <div className="spread">
          <h3 className="display t-20">Твои хуки</h3>
          <span className="small muted num">готово {good} из 3</span>
        </div>
        {hooks.length === 0 ? <p className="small faint">Пока пусто. Выбери пару формул выше или напиши свой хук.</p> : null}
        {hooks.map((h, i) => (
          <div key={i} className="st-hook">
            <input
              className="input"
              value={h}
              onChange={(e) => {
                const v = e.target.value
                setHooks((prev) => prev.map((x, j) => (j === i ? v : x)))
              }}
              aria-label={`Хук ${i + 1}`}
            />
            <button className="btn btn-quiet btn-icon btn-sm" aria-label="Удалить хук" onClick={() => setHooks((prev) => prev.filter((_, j) => j !== i))}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="row-wrap">
          <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={() => add('')}>
            Свой хук
          </Button>
        </div>
        {hooks.some((h) => h.includes('[')) ? <p className="tiny ember">В некоторых хуках остались скобки — замени их своими словами.</p> : null}
        <MentorBox task="hooks" draft={hooks.join('\n')} context={{ who: pos?.who, pain: pos?.pain }} />
      </div>
      <StepFooter
        canGo={good >= 3}
        onGo={() => {
          if (!api.replay) gainXp(70, 'хуки')
          api.done()
        }}
        label="К сценариям"
        note={good >= 3 ? undefined : 'Нужно минимум три готовых хука.'}
      />
    </div>
  )
}

function makeScript(hook: string, s: ReturnType<typeof useGame.getState>): ReelScript {
  const pos = s.artifacts.positioning
  const magnet = s.artifacts.product?.leadMagnet.name
  return {
    id: shortId(),
    hook,
    problem: pos ? `Ко мне часто приходят, когда ${pos.pain}. И кажется, что так будет всегда.` : '',
    insight: pos ? `Это не про слабость. Первый шаг — заметить, что происходит, и дать себе опору. Например: …` : '',
    cta: magnet ? `Забери ${q(magnet)} в моём боте — ссылка в профиле.` : 'Если откликается — напиши мне, ссылка в профиле.',
  }
}

function Scripts({ api }: { api: StepApi }) {
  const content = useGame((s) => s.artifacts.content)
  const setArtifact = useGame((s) => s.setArtifact)
  const gainXp = useGame((s) => s.gainXp)
  const [scripts, setScripts] = useState<ReelScript[]>(() => {
    if (content?.scripts?.length) return content.scripts
    const st = useGame.getState()
    return (content?.hooks ?? []).slice(0, 3).map((h) => makeScript(h, st))
  })
  useEffect(() => {
    const cur = useGame.getState().artifacts.content
    setArtifact('content', { hooks: cur?.hooks ?? [], scripts, plan: cur?.plan ?? [] })
  }, [scripts, setArtifact])
  const upd = (i: number, patch: Partial<ReelScript>) => setScripts((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const complete = scripts.filter((x) => x.hook.trim() && x.problem.trim().length > 10 && x.insight.trim().length > 10 && x.cta.trim()).length

  return (
    <div className="workbench">
      {scripts.map((sc, i) => (
        <section key={sc.id} className="panel panel-pad workbench-card">
          <div className="spread">
            <h3 className="display t-20">Рилс {i + 1}</h3>
            <button className="btn btn-quiet btn-sm" onClick={() => setScripts((prev) => prev.filter((_, j) => j !== i))}>
              Убрать
            </button>
          </div>
          <Field label="Хук — первые 1,5 секунды">
            <input className="input" value={sc.hook} onChange={(e) => upd(i, { hook: e.target.value })} />
          </Field>
          <Field label="Проблема — узнавание" hint="Опиши ситуацию словами клиента. Зритель должен подумать: «Это про меня».">
            <textarea className="textarea" rows={2} value={sc.problem} onChange={(e) => upd(i, { problem: e.target.value })} />
          </Field>
          <Field label="Инсайт — польза" hint="Одна мысль или упражнение, которое можно применить сегодня.">
            <textarea className="textarea" rows={3} value={sc.insight} onChange={(e) => upd(i, { insight: e.target.value })} />
          </Field>
          <Field label="Призыв — следующий шаг" hint="Мягко: лид-магнит в боте, запись, вопрос в комментариях.">
            <input className="input" value={sc.cta} onChange={(e) => upd(i, { cta: e.target.value })} />
          </Field>
          <MentorBox task="reel" draft={`Хук: ${sc.hook}\nПроблема: ${sc.problem}\nИнсайт: ${sc.insight}\nПризыв: ${sc.cta}`} context={{}} />
        </section>
      ))}
      <div className="row-wrap">
        <Button variant="ghost" icon={<Plus size={16} />} onClick={() => setScripts((prev) => [...prev, makeScript('', useGame.getState())])}>
          Добавить сценарий
        </Button>
      </div>
      <HintReveal
        id="studio_script"
        items={[
          'Хук: «Почему ты устаёшь, даже если спишь по 8 часов». Проблема: «Просыпаешься уже без сил, кофе не помогает, выходные пролетают». Инсайт: «Усталость бывает не телесной, а эмоциональной — от постоянного напряжения. Попробуй сегодня вечером 10 минут ничего не делать — без телефона. Просто заметь, что почувствуешь». Призыв: «Чек-лист признаков эмоционального выгорания — в боте, ссылка в профиле».',
          'Хук: «Одна фраза, которая помогает, когда хочется всё бросить». Проблема: «Бывает, всё валится из рук, и кажется, что ты не справляешься ни с чем». Инсайт: «Скажи себе: „Мне сейчас трудно, и это нормально“. Признание трудности снижает напряжение сильнее, чем попытка себя взбодрить». Призыв: «Сохрани, чтобы не потерять. А если трудно давно — напиши мне».',
        ]}
      />
      <StepFooter
        canGo={complete >= 1}
        onGo={() => {
          if (!api.replay) gainXp(60 + complete * 20, 'сценарии рилсов')
          api.done()
        }}
        label="К контент-плану"
        note={complete >= 1 ? `Готово сценариев: ${complete}.` : 'Заполни хотя бы один сценарий целиком.'}
      />
    </div>
  )
}

function genPlan(days: number, s: ReturnType<typeof useGame.getState>, seed: number): ContentPlanDay[] {
  const pos = s.artifacts.positioning
  const prod = s.artifacts.product
  const hooks = s.artifacts.content?.hooks ?? []
  const pain = pos?.pain ?? 'тревожно и тяжело'
  const result = pos?.result ?? 'вернуть опору'
  const topics: Record<ContentPlanDay['rubric'], string[]> = {
    expert: [
      `Почему «${pain}» — не слабость`,
      '3 мифа о терапии, которые мешают начать',
      'Как понять, что пора к психологу',
      'Что происходит на первой встрече с психологом',
      `Упражнение на 5 минут, если ${pain}`,
      'Чем психолог отличается от подруги и коуча',
      ...hooks,
    ],
    personal: ['Как началась моя практика', 'Один день из жизни психолога', 'Что даёт мне силы в работе', 'Зачем психологу свой психолог', 'Мои правила конфиденциальности'],
    engaging: ['Опрос: что сейчас даётся тяжелее всего', 'Вопрос-ответ в сторис', 'Выберите тему следующего эфира', 'Поделитесь: что помогает вам восстанавливаться'],
    selling: [
      prod ? `Как проходит работа в пакете ${q(prod.core.name)}` : 'Как проходит работа со мной',
      prod ? `Бесплатно: ${q(prod.leadMagnet.name)}` : 'Бесплатная польза в боте',
      'Открыта запись на знакомство',
      `Кейс (обезличенно, с согласия клиента): как удалось ${result}`,
    ],
  }
  const rubrics: ContentPlanDay['rubric'][] = ['expert', 'personal', 'expert', 'engaging', 'expert', 'selling', 'personal']
  const channel = s.goal?.channel ?? 'instagram'
  const formats: ContentPlanDay['format'][] =
    channel === 'telegram'
      ? ['post', 'post', 'stories', 'post', 'live', 'post', 'stories']
      : channel === 'threads'
        ? ['post', 'post', 'reel', 'post', 'post', 'post', 'reel']
        : ['reel', 'stories', 'reel', 'post', 'reel', 'stories', 'live']
  const used: Record<string, number> = {}
  return Array.from({ length: days }, (_, i) => {
    const rubric = rubrics[(i + seed) % rubrics.length]
    const list = topics[rubric]
    const k = (used[rubric] = (used[rubric] ?? seed) + 1)
    return { day: i + 1, rubric, format: formats[(i + seed) % formats.length], topic: list[k % list.length] }
  })
}

function ContentPlanStep({ api }: { api: StepApi }) {
  const pro = useGame(hasPro)
  const content = useGame((s) => s.artifacts.content)
  const setArtifact = useGame((s) => s.setArtifact)
  const gainXp = useGame((s) => s.gainXp)
  const days = pro ? 28 : 14
  const [seed, setSeed] = useState(0)
  const [plan, setPlan] = useState<ContentPlanDay[]>(() =>
    content?.plan?.length ? content.plan : genPlan(days, useGame.getState(), 0),
  )
  useEffect(() => {
    const cur = useGame.getState().artifacts.content
    const art: ContentArtifact = { hooks: cur?.hooks ?? [], scripts: cur?.scripts ?? [], plan }
    setArtifact('content', art)
  }, [plan, setArtifact])
  const save = (next: ContentPlanDay[]) => setPlan(next)
  const counts = useMemo(() => {
    const c = { expert: 0, personal: 0, engaging: 0, selling: 0 }
    plan.forEach((d) => c[d.rubric]++)
    return c
  }, [plan])

  return (
    <div className="workbench">
      <div className="panel panel-pad workbench-card">
        <div className="spread">
          <p className="small muted">
            Баланс: экспертных {counts.expert}, личных {counts.personal}, вовлекающих {counts.engaging}, продающих {counts.selling}. Продающих — не больше четверти, иначе аудитория устаёт.
          </p>
          <Button
            variant="ghost"
            size="sm"
            icon={<Shuffle size={16} />}
            onClick={() => {
              const ns = seed + 1
              setSeed(ns)
              save(genPlan(days, useGame.getState(), ns))
            }}
          >
            Перемешать
          </Button>
        </div>
        {!pro ? <p className="tiny faint">План на 4 недели — в Наборе Мастера. Сейчас — 2 недели.</p> : null}
      </div>
      <div className="st-plan">
        {plan.map((d, i) => (
          <div key={d.day} className={`st-day panel is-${d.rubric}`}>
            <div className="spread tiny">
              <span className="faint">День {d.day}</span>
              <span className="st-tag">
                {RUBRIC[d.rubric]}, {FORMAT[d.format].toLowerCase()}
              </span>
            </div>
            <textarea
              className="st-topic"
              rows={2}
              value={d.topic}
              onChange={(e) => {
                const v = e.target.value
                setPlan((prev) => prev.map((x, j) => (j === i ? { ...x, topic: v } : x)))
              }}
              aria-label={`Тема дня ${d.day}`}
            />
          </div>
        ))}
      </div>
      <StepFooter
        canGo={plan.length > 0}
        onGo={() => {
          save(plan)
          if (!api.replay) gainXp(60, 'контент-план')
          api.done()
        }}
        label="Сохранить план"
      />
    </div>
  )
}

function Montage({ api }: { api: StepApi }) {
  const pro = useGame(hasPro)
  const scripts = useGame((s) => s.artifacts.content?.scripts) ?? NO_SCRIPTS
  const reel = useGame((s) => s.artifacts.reel)
  const [open, setOpen] = useState(false)
  return (
    <div className="workbench">
      <div className="panel panel-pad workbench-card st-montage">
        <Clapperboard size={40} className="gold" />
        <p className="lead">
          Собери первый рилс прямо здесь: свои видео или фото, «живой фон» для текстового ролика, хук и субтитры из твоего сценария, музыка из игры. На выходе — файл, который можно выложить.
        </p>
        {reel ? <p className="small mint">Ролик уже смонтирован: {Math.round(reel.durationSec)} с, {reel.format}.</p> : null}
        <div className="row-wrap">
          <Button variant="lit" size="lg" onClick={() => setOpen(true)}>
            Открыть Монтажную
          </Button>
          <Button variant="ghost" onClick={api.done}>
            {reel ? 'Дальше' : 'Смонтирую позже'}
          </Button>
        </div>
        {!reel ? <p className="tiny faint">Если пропустить — квест «Опубликуй первый рилс» останется в Журнале.</p> : null}
      </div>
      {open
        ? createPortal(
        <LazyBox>
        <ReelEditor
          scripts={scripts}
          pro={pro}
          onClose={() => setOpen(false)}
          onNeedPro={() => useGame.getState().openPanel('shop', { shopTab: 'treasury' })}
          onExported={(info) => {
            const st = useGame.getState()
            const first = !st.artifacts.reel
            st.setArtifact('reel', info)
            if (first) st.gainXp(150, 'первый рилс смонтирован')
          }}
        />
        </LazyBox>,
            document.body,
          )
        : null}
    </div>
  )
}

const troll: BossDef = {
  id: 'troll',
  name: 'Тролль-Хейтер',
  epithet: 'пишет гадости, потому что может',
  look: 'troll',
  hp: 90,
  intro: 'О, психолог выложил видео! Сейчас я тебе всё объясню про твою «профессию».',
  defeatLine: 'Скучно с тобой. Ты не злишься. Пойду к тем, кто злится.',
  attacks: [
    {
      line: 'Психологи — это те, кто сами себе помочь не могут! Ха!',
      options: [
        {
          text: 'Спасибо за мнение. Если захотите поговорить по сути — я {открыт|открыта} к диалогу.',
          q: 'great',
          why: 'Спокойная граница без оправданий. Другие читатели видят взрослую позицию — это вызывает доверие.',
        },
        {
          text: 'Удалить комментарий и переживать весь вечер.',
          q: 'ok',
          why: 'Удалить хамство — нормально. Переживать весь вечер — дорого. Это не про тебя, а про него.',
        },
        {
          text: 'Высмеять его в сторис, чтобы подписчики накинулись.',
          q: 'toxic',
          why: 'Травля в ответ на травлю бьёт по репутации специалиста. Психолог, который стравливает людей, — плохая реклама.',
        },
      ],
    },
    {
      line: 'Опять очевидные вещи. Кто это вообще смотрит?',
      options: [
        {
          text: 'Очевидное для вас бывает спасительным для кого-то. Это видео — для тех, кто сейчас в этом.',
          q: 'great',
          why: 'Ты говоришь о своей аудитории, а не оправдываешься перед критиком.',
        },
        {
          text: 'Промолчать и снять ролик «посложнее», чтобы ему понравилось.',
          q: 'ok',
          why: 'Подстраиваться под критика — путь в никуда. Твоя аудитория — не он.',
        },
        {
          text: 'Написать длинное оправдание на три абзаца.',
          q: 'bad',
          why: 'Оправдания кормят тролля. Он получил то, за чем пришёл, — твою энергию.',
        },
      ],
    },
    {
      line: 'Сколько тебе платят за эту рекламу? Инфоцыганщина!',
      options: [
        {
          text: 'Я психолог и открыто рассказываю о своей работе. Цены — в профиле, решение — за вами.',
          q: 'great',
          why: 'Прозрачность — лучший ответ на подозрения. Спокойно и без обиды.',
        },
        {
          text: 'Сам ты инфоцыган.',
          q: 'toxic',
          why: 'Переход на личности — поражение в любом споре. И минус к репутации.',
        },
        {
          text: 'Заблокировать всех, кто хоть раз возразил.',
          q: 'ok',
          why: 'Блокировать хамов — нормально, но несогласие — не хамство. Живая дискуссия бывает полезной.',
        },
      ],
    },
    {
      line: 'Ты даже в камеру смотреть не умеешь. Позорище.',
      options: [
        {
          text: 'Я учусь, и это видно. Мне важнее быть {живым|живой}, чем {идеальным|идеальной}.',
          q: 'great',
          why: 'Живость продаёт лучше идеальности. Люди идут к человеку, а не к картинке.',
        },
        {
          text: 'Удалить все ролики и больше никогда не снимать.',
          q: 'bad',
          why: 'Ровно этого тень и хотела. Первый рилс всегда неловкий — это цена входа, а не приговор.',
        },
        {
          text: 'Купить дорогой свет и микрофон, прежде чем снимать дальше.',
          q: 'ok',
          why: 'Техника помогает, но не решает. Снимать можно и на телефон у окна — главное смысл.',
        },
      ],
    },
  ],
}

export const studioChapter: ChapterDef = {
  id: 'studio',
  reward: { xp: 170, coins: 70, relic: 'crystal_echo', item: { id: 'tea', n: 2 } },
  summary: (s) => {
    const c = s.artifacts.content
    return `Хуков: ${c?.hooks.length ?? 0}, сценариев: ${c?.scripts.length ?? 0}, дней в контент-плане: ${c?.plan.length ?? 0}${s.artifacts.reel ? ', и первый рилс смонтирован' : ''}.`
  },
  steps: (mode) => [
    {
      id: 'intro',
      kind: 'dialogue',
      lines:
        mode === 'express'
          ? [{ who: 'fox', text: 'Контент ты уже ведёшь? Прекрасно. Докрутим хуки и соберём план — чтобы не выгореть на третьей неделе.' }]
          : [
              { who: 'narrator', text: 'Пещера отвечает эхом на каждый шаг. Кристаллы светятся, когда рядом звучит живой голос.' },
              { who: 'fox', text: 'Детка, у тебя полторы секунды, чтобы тебя не пролистали. Время пошло.' },
              { who: 'fox', mood: 'happy', text: 'Шучу. Почти. Контент психолога — это не танцы. Это разговор, после которого человеку становится чуть яснее.' },
              { who: 'fox', mood: 'thinking', text: 'Три вещи: хук, который цепляет. Сценарий, который ведёт. И план, который не даёт бросить на третьей неделе.' },
            ],
    },
    { id: 'hooks', kind: 'custom', title: 'Лаборатория хуков', lead: 'Первая фраза решает, посмотрят ли тебя дальше. Собери минимум три.', render: (api) => <HookLab api={api} /> },
    { id: 'scripts', kind: 'custom', title: 'Сценарии рилсов', lead: 'Хук, узнавание, польза, мягкий призыв. 30–45 секунд — идеальная длина.', render: (api) => <Scripts api={api} /> },
    { id: 'plan', kind: 'custom', title: 'Контент-план', lead: 'Ровный ритм важнее рывков. Отредактируй темы под себя.', wide: true, render: (api) => <ContentPlanStep api={api} /> },
    {
      id: 'troll-intro',
      kind: 'dialogue',
      lines: [
        { who: 'narrator', text: 'Эхо вдруг возвращается искажённым. В комментариях кто-то очень старается.' },
        { who: 'fox', mood: 'worried', text: 'Тролль-Хейтер. Не корми его. Но и не прячься — тебя читают другие.' },
      ],
    },
    { id: 'battle', kind: 'battle', boss: troll, xp: 140, coins: 40 },
    { id: 'montage', kind: 'custom', title: 'Монтажная', lead: 'Первый ролик — самый страшный. Потом легче.', render: (api) => <Montage api={api} /> },
    {
      id: 'outro',
      kind: 'dialogue',
      lines: [
        { who: 'fox', mood: 'proud', text: 'Вот это я понимаю — эхо. Твой голос теперь возвращается к тебе людьми.' },
        { who: 'fox', text: 'Кристалл — тебе. Когда будет страшно выходить в кадр, вспомни: ты уже {прошёл|прошла} через Тролля.' },
      ],
    },
  ],
}

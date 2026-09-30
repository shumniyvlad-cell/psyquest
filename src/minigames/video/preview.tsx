// Dev-стенд «Монтажной»: npx vite → /src/minigames/video/preview.html
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/alice'
import '@fontsource-variable/golos-text'
import '../../styles/global.css'
import { isAudioReady, unlockAudio } from '../../audio/engine'
import type { ReelExport, ReelScript } from '../../game/types'
import { Button } from '../../ui/Button'
import { ReelEditor } from './ReelEditor'

const SCRIPTS: ReelScript[] = [
  {
    id: 'rest',
    hook: 'Почему отдых больше не помогает',
    problem: 'Вы спите по восемь часов и берёте выходные, а сил всё равно нет. Кажется, что с вами что-то не так.',
    insight:
      'Отдых восстанавливает тело, но не снимает внутреннее напряжение. Пока психика всё время начеку, батарейка не заряжается.',
    cta: 'Сохраните ролик и напишите «ресурс» — пришлю практику на пять минут.',
  },
  {
    id: 'couple',
    hook: 'Три фразы, которые тихо разрушают доверие в паре',
    problem: '«Ты опять», «ты всегда», «ты никогда». Кажется, что это просто эмоции.',
    insight: 'Обобщения превращают поступок в приговор характеру — и партнёр начинает защищаться, а не слышать.',
    cta: 'Попробуйте говорить о конкретном случае. Больше приёмов — в профиле.',
  },
  {
    id: 'anxiety',
    hook: 'Тревога — не враг',
    problem: 'С тревогой обычно воюют: отвлекаются, заедают, прокручивают.',
    insight: 'Тревога — это сигнал о том, что важно. Когда его слышат, он становится тише.',
    cta: 'Запишитесь на бесплатную встречу-знакомство — ссылка в шапке профиля.',
  },
]

function Stand() {
  const [open, setOpen] = useState(true)
  const [pro, setPro] = useState(false)
  const [withScripts, setWithScripts] = useState(true)
  const [devOpen, setDevOpen] = useState(false)
  const [sound, setSound] = useState(isAudioReady())
  const [log, setLog] = useState<string[]>([])
  const push = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString('ru-RU')}  ${s}`, ...l].slice(0, 20))

  const enableSound = async () => {
    await unlockAudio()
    setSound(true)
    push('unlockAudio()')
  }

  return (
    <>
      <main className="ve-stand">
        <div className="ve-stand-box panel panel-pad stack">
          <h1 className="display t-31">Монтажная — стенд</h1>
          <p className="muted">Проверка редактора рилсов вне игры. Файлы никуда не уходят — всё в памяти вкладки.</p>
          <div className="row-wrap">
            <Button variant="lit" onClick={() => setOpen(true)}>
              Открыть монтажную
            </Button>
            <Button variant="ghost" onClick={enableSound} disabled={sound}>
              {sound ? 'Звук включён' : 'Включить звук'}
            </Button>
          </div>
          <label className="row small">
            <input type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} /> Набор Мастера (pro)
          </label>
          <label className="row small">
            <input type="checkbox" checked={withScripts} onChange={(e) => setWithScripts(e.target.checked)} /> Есть
            сценарии из «Студии Эха»
          </label>
          <pre className="ve-stand-log" aria-live="polite">
            {log.length ? log.join('\n') : 'Событий пока нет'}
          </pre>
        </div>
      </main>

      {open ? (
        <ReelEditor
          scripts={withScripts ? SCRIPTS : []}
          pro={pro}
          onExported={(info: ReelExport) => push(`onExported ${JSON.stringify(info)}`)}
          onClose={() => {
            setOpen(false)
            push('onClose')
          }}
          onNeedPro={() => push('onNeedPro')}
        />
      ) : null}

      {open ? (
        <div className="ve-stand-dev">
          {devOpen ? (
            <div className="panel">
              <Button size="sm" variant="ghost" onClick={enableSound} disabled={sound}>
                {sound ? 'Звук включён' : 'Включить звук'}
              </Button>
              <label className="row small">
                <input type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} /> pro
              </label>
              <label className="row small">
                <input type="checkbox" checked={withScripts} onChange={(e) => setWithScripts(e.target.checked)} />{' '}
                сценарии
              </label>
              <pre className="ve-stand-log">{log.slice(0, 6).join('\n') || 'Событий пока нет'}</pre>
            </div>
          ) : null}
          <Button size="sm" variant="quiet" onClick={() => setDevOpen((v) => !v)}>
            {devOpen ? 'Скрыть стенд' : 'Стенд'}
          </Button>
        </div>
      ) : null}
    </>
  )
}

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <StrictMode>
      <Stand />
    </StrictMode>,
  )
}

// Dev-стенд Башни Ботов: /src/minigames/bot/preview.html
import '../../styles/global.css'
import '@fontsource/alice'
import '@fontsource-variable/golos-text'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { BotConfig, PositioningArtifact, ProductArtifact } from '../../game/types'
import { unlockAudio } from '../../audio/engine'
import { Button } from '../../ui/Button'
import { BotBuilder, type DeployResult } from './BotBuilder'
import { defaultBotConfig } from './model'

const POSITIONING: PositioningArtifact = {
  who: 'женщинам 30–45',
  pain: 'тревога и бессонница перед важными событиями',
  result: 'спокойствие и сон',
  method: 'КПТ',
  statement: 'Я помогаю женщинам 30–45 справиться с тревогой и вернуть сон с помощью КПТ',
  score: 82,
}

const PRODUCT: ProductArtifact = {
  leadMagnet: { name: 'Аудиопрактика «Тихая гавань»', format: 'аудио, 12 минут', price: 0, promise: 'успокоиться перед сном' },
  entry: {
    name: 'Диагностическая сессия',
    format: 'онлайн, 60 минут',
    price: 2500,
    promise: 'разберём, что запускает тревогу, и соберём план на месяц',
  },
  core: { name: 'Пакет «Опора»', format: '8 встреч', price: 24000, promise: '' },
  premium: { name: 'Сопровождение', format: '3 месяца', price: 60000, promise: '' },
  quality: 'A',
}

const withArtifacts = () => defaultBotConfig({ heroName: 'Анна', positioning: POSITIONING, product: PRODUCT })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function demoDeploy(token: string, cfg: BotConfig): Promise<DeployResult> {
  await sleep(1500)
  if (token.startsWith('000000')) throw new Error('Telegram не принял токен. Скопируй его заново из @BotFather.')
  const slug = cfg.botName.toLowerCase().includes('анна') ? 'anna_psy' : 'psyquest_demo'
  return { botId: `demo-${Date.now().toString(36)}`, username: `${slug}_bot`, adminCode: 'LAMP-4821' }
}

function Stand() {
  const [cfg, setCfg] = useState<BotConfig>(withArtifacts)
  const [pro, setPro] = useState(false)
  const [server, setServer] = useState(true)
  const [log, setLog] = useState<string[]>([])
  const note = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString('ru-RU')} ${s}`, ...l].slice(0, 6))

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 16px 60px' }}>
      <div className="panel" style={{ padding: 12, marginBottom: 18 }}>
        <div className="row-wrap" style={{ gap: 8 }}>
          <span className="small faint">Стенд:</span>
          <button type="button" className="chip" aria-pressed={pro} onClick={() => setPro((v) => !v)}>
            Набор Мастера
          </button>
          <button type="button" className="chip" aria-pressed={server} onClick={() => setServer((v) => !v)}>
            Сервер игры
          </button>
          <Button size="sm" variant="quiet" onClick={() => setCfg(withArtifacts())}>
            С артефактами
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setCfg(defaultBotConfig({ heroName: 'Влад' }))}>
            Без артефактов
          </Button>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setCfg((c) => ({ ...c, leadMagnetUrl: 'disk.yandex.ru/i/tihaya-gavan', bookingUrl: 't.me/anna_psy' }))}
          >
            Заполнить ссылки
          </Button>
        </div>
        {log.length ? (
          <div className="tiny muted" style={{ marginTop: 8 }}>
            {log.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        ) : null}
      </div>

      <BotBuilder
        value={cfg}
        onChange={setCfg}
        onTestPassed={(r) => note(`onTestPassed: ${r.passed}/${r.personas}, замечаний ${r.issues.length}`)}
        deploy={server ? demoDeploy : undefined}
        pro={pro}
        onNeedPro={() => note('onNeedPro')}
      />
    </div>
  )
}

window.addEventListener('pointerdown', () => void unlockAudio(), { once: true })

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Stand />
    </StrictMode>,
  )
}

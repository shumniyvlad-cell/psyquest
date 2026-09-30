import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { LighthouseArt } from '../art/LighthouseArt'
import { playTheme, stinger } from '../audio/engine'
import { fmtRub, plural } from '../game/planner'
import { titleForLevel } from '../game/progression'
import { useGame, useSeasonClients, type SaveData } from '../game/store'
import { artifactSections } from '../systems/ChestPanel'
import { IN_ARTIFACT } from '../env'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { isInstantNow } from '../ui/useInstant'
import './ending.css'

async function makeCertificate(s: SaveData, clients: number): Promise<Blob | null> {
  const W = 1080
  const H = 1350
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) return null
  try {
    await Promise.all([document.fonts.load('64px Alice'), document.fonts.load('600 28px "Golos Text Variable"')])
  } catch {
    /* шрифты по умолчанию */
  }
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0a0f2e')
  bg.addColorStop(0.55, '#1a2354')
  bg.addColorStop(1, '#0e1330')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  // звёзды
  let seed = 11
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < 160; i++) {
    g.globalAlpha = 0.25 + rnd() * 0.7
    g.fillStyle = '#f2e8d5'
    g.beginPath()
    g.arc(rnd() * W, rnd() * H * 0.62, 0.6 + rnd() * 1.8, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  // луч маяка
  const beam = g.createLinearGradient(540, 430, 1080, 300)
  beam.addColorStop(0, 'rgba(255,214,138,0.55)')
  beam.addColorStop(1, 'rgba(255,214,138,0)')
  g.fillStyle = beam
  g.beginPath()
  g.moveTo(540, 430)
  g.lineTo(1080, 250)
  g.lineTo(1080, 420)
  g.closePath()
  g.fill()
  const glow = g.createRadialGradient(540, 430, 0, 540, 430, 260)
  glow.addColorStop(0, 'rgba(255,220,150,0.95)')
  glow.addColorStop(0.2, 'rgba(255,181,71,0.55)')
  glow.addColorStop(1, 'rgba(255,181,71,0)')
  g.fillStyle = glow
  g.beginPath()
  g.arc(540, 430, 260, 0, Math.PI * 2)
  g.fill()
  // маяк
  g.fillStyle = '#0b1026'
  g.beginPath()
  g.moveTo(500, 460)
  g.lineTo(580, 460)
  g.lineTo(610, 760)
  g.lineTo(470, 760)
  g.closePath()
  g.fill()
  g.fillStyle = '#fff1cc'
  g.fillRect(508, 400, 64, 52)
  g.fillStyle = '#0b1026'
  g.beginPath()
  g.moveTo(496, 402)
  g.lineTo(540, 360)
  g.lineTo(584, 402)
  g.closePath()
  g.fill()
  // утёс и вода
  g.fillStyle = '#070a1c'
  g.beginPath()
  g.moveTo(0, 820)
  g.quadraticCurveTo(300, 740, 470, 760)
  g.lineTo(640, 760)
  g.quadraticCurveTo(820, 780, 1080, 840)
  g.lineTo(1080, 1350)
  g.lineTo(0, 1350)
  g.closePath()
  g.fill()
  // огоньки кораблей
  for (let i = 0; i < Math.min(12, clients); i++) {
    const x = 120 + ((i * 97) % 840)
    const y = 700 + ((i * 53) % 90)
    const sg = g.createRadialGradient(x, y, 0, x, y, 16)
    sg.addColorStop(0, 'rgba(255,230,170,1)')
    sg.addColorStop(1, 'rgba(255,181,71,0)')
    g.fillStyle = sg
    g.beginPath()
    g.arc(x, y, 16, 0, Math.PI * 2)
    g.fill()
  }
  // рамка
  g.strokeStyle = 'rgba(255,214,150,0.45)'
  g.lineWidth = 2
  g.strokeRect(40, 40, W - 80, H - 80)
  // тексты
  g.textAlign = 'center'
  g.fillStyle = '#ffd68a'
  g.font = '44px Alice, Georgia, serif'
  g.fillText('Смотритель Маяка', W / 2, 150)
  g.fillStyle = '#fff4dc'
  g.font = '92px Alice, Georgia, serif'
  g.fillText(s.hero?.name ?? 'Фонарщик', W / 2, 250)
  g.font = '600 38px "Golos Text Variable", system-ui, sans-serif'
  g.fillStyle = '#f2e8d5'
  g.fillText(`${clients} ${plural(clients, 'клиент нашёл', 'клиента нашли', 'клиентов нашли')} меня в тумане`, W / 2, 960)
  g.font = '28px "Golos Text Variable", system-ui, sans-serif'
  g.fillStyle = '#c9c0d8'
  const days = Math.max(1, Math.round((Date.now() - s.createdAt) / 864e5))
  g.fillText(`${days} ${plural(days, 'день', 'дня', 'дней')} пути. Уровень ${s.level}: ${titleForLevel(s.level)}`, W / 2, 1015)
  g.fillText(new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, 1065)
  g.fillStyle = '#8e8bb8'
  g.font = '24px "Golos Text Variable", system-ui, sans-serif'
  g.fillText('PsyQuest — игра, в которой психолог строит свою практику', W / 2, 1250)
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'))
}

export function Ending() {
  const clients = useSeasonClients()
  const hero = useGame((s) => s.hero)
  const level = useGame((s) => s.level)
  const createdAt = useGame((s) => s.createdAt)
  const questsDone = useGame((s) => s.counters.questsDone)
  const battles = useGame((s) => s.counters.battlesWon)
  const [lit, setLit] = useState(0.5)
  const [stage, setStage] = useState(0)
  const income = clients.reduce((a, c) => a + (c.amount || 0), 0)
  const days = Math.max(1, Math.round((Date.now() - createdAt) / 864e5))
  const artifacts = artifactSections(useGame.getState()).length

  useEffect(() => {
    playTheme('ending')
    stinger('victory')
    const st = useGame.getState()
    st.setFlag(`ending_s${st.season}`)
    let raf = 0
    if (isInstantNow()) setLit(1)
    else {
      const t0 = performance.now()
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 2600)
        setLit(0.5 + 0.5 * k)
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    const timers = [setTimeout(() => setStage(1), 1200), setTimeout(() => setStage(2), 2600), setTimeout(() => setStage(3), 3800)]
    if (!st.settings.reducedMotion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timers.push(
        setTimeout(() => {
          confetti({ particleCount: 140, spread: 90, origin: { y: 0.45 }, colors: ['#ffb547', '#ffd68a', '#6fe3c8', '#f2e8d5'] })
        }, 2600),
      )
    }
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
    }
  }, [])

  const [cert, setCert] = useState<string | null>(null)
  const showCert = async () => {
    const blob = await makeCertificate(useGame.getState(), clients.length)
    if (!blob) return
    setCert(URL.createObjectURL(blob))
  }
  const closeCert = () => {
    if (cert) URL.revokeObjectURL(cert)
    setCert(null)
  }
  const download = () => {
    if (!cert) return
    const a = document.createElement('a')
    a.href = cert
    a.download = 'psyquest-smotritel-mayaka.png'
    a.click()
  }

  return (
    <div className="screen en">
      <LighthouseArt lit={lit} ships={Math.min(12, clients.length)} />
      <div className="en-shade" />
      <main className="en-center">
        <p className={`en-line display ${stage >= 1 ? 'is-on' : ''}`}>Маяк горит.</p>
        <p className={`en-line en-sub ${stage >= 2 ? 'is-on' : ''}`}>
          {clients.length} {plural(clients.length, 'человек нашёл', 'человека нашли', 'человек нашли')} тебя в тумане, {hero?.name}.
        </p>
        {stage >= 3 ? (
          <div className="en-card panel panel-pad anim-rise">
            <div className="en-stats">
              <div>
                <span className="display gold num">{days}</span>
                <span className="tiny muted">{plural(days, 'день', 'дня', 'дней')} пути</span>
              </div>
              <div>
                <span className="display gold num">{level}</span>
                <span className="tiny muted">уровень, {titleForLevel(level)}</span>
              </div>
              <div>
                <span className="display gold num">{questsDone}</span>
                <span className="tiny muted">реальных шагов</span>
              </div>
              <div>
                <span className="display gold num">{artifacts}</span>
                <span className="tiny muted">артефактов практики</span>
              </div>
              <div>
                <span className="display gold num">{battles}</span>
                <span className="tiny muted">теней повержено</span>
              </div>
              <div>
                <span className="display gold">{income ? fmtRub(income) : '—'}</span>
                <span className="tiny muted">доход первой волны</span>
              </div>
            </div>
            <p className="small muted">
              Всё, что ты {hero?.gender === 'm' ? 'создал' : 'создала'} в пути, лежит в Сундуке: позиционирование, продукт, бот, контент, план запуска и сценарий продаж. Это уже не игра — это твоя практика.
            </p>
            <div className="row-wrap">
              <Button variant="lit" onClick={showCert}>
                Сертификат
              </Button>
              <Button variant="ghost" onClick={() => useGame.getState().go('oath')}>
                Новая цель
              </Button>
              <Button variant="quiet" onClick={() => useGame.getState().go('map')}>
                На карту
              </Button>
            </div>
            <p className="tiny faint en-credits">PsyQuest. Идея и продюсирование — Vlad March Media. Музыка и звуки синтезированы прямо в браузере.</p>
          </div>
        ) : null}
      </main>
      <Modal open={!!cert} onClose={closeCert} title="Смотритель Маяка" width={520}>
        {cert ? (
          <div className="stack en-cert">
            <img src={cert} alt="Сертификат «Смотритель Маяка»" className="en-cert-img" />
            <p className="small muted">
              Картинка 1080 на 1350 — формат поста и сторис. {IN_ARTIFACT ? 'Чтобы сохранить, нажми на неё правой кнопкой или удерживай палец.' : ''}
            </p>
            {!IN_ARTIFACT ? (
              <Button variant="lit" onClick={download}>
                Скачать картинку
              </Button>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

// Вкладка «Экспорт»: проверка перед записью, запись в реальном времени, результат.
import { useRef, type ReactNode } from 'react'
import { IN_ARTIFACT } from '../../env'
import {
  CircleAlert,
  CircleCheck,
  Download,
  Info,
  LoaderCircle,
  Lock,
  RotateCcw,
  Share2,
  Square,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { Switch } from './controls'
import type { ReelEngine } from './engine'
import { supportMessage, type ExportExt, type ExportSupport } from './exporter'
import { useEngineTick } from './hooks'
import { MAX_TOTAL_SEC } from './types'
import { clamp, fmtBytes, fmtTime } from './util'

export type ExportPhase = 'idle' | 'preparing' | 'recording' | 'paused' | 'finishing'

export interface ExportResultInfo {
  url: string
  fileName: string
  ext: ExportExt
  size: number
  durationSec: number
  blob: Blob
}

interface ExportPanelProps {
  engine: ReelEngine | null
  support: ExportSupport
  duration: number
  total: number
  clipsCount: number
  hasHook: boolean
  captions: number
  pro: boolean
  musicLabel: string
  monitor: boolean
  phase: ExportPhase
  prepLabel: string
  error: string | null
  result: ExportResultInfo | null
  canShare: boolean
  onMonitor: (v: boolean) => void
  onStart: () => void
  onCancel: () => void
  onDownload: () => void
  onShare: () => void
  onNeedPro: () => void
}

type CheckState = 'ok' | 'warn' | 'bad'

function Check({ state, children }: { state: CheckState; children: ReactNode }) {
  const Icon = state === 'ok' ? CircleCheck : state === 'warn' ? Info : CircleAlert
  return (
    <li className={`ve-check is-${state}`}>
      <Icon size={18} aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function Progress({ engine, phase, prepLabel }: { engine: ReelEngine | null; phase: ExportPhase; prepLabel: string }) {
  const barRef = useRef<HTMLElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  useEngineTick(engine, (t, d) => {
    if (phase === 'preparing') return
    const k = d > 0 ? clamp(t / d, 0, 1) : 0
    if (barRef.current) barRef.current.style.width = `${k * 100}%`
    if (wrapRef.current) wrapRef.current.setAttribute('aria-valuenow', String(Math.round(k * 100)))
    if (timeRef.current) timeRef.current.textContent = `${fmtTime(t)} из ${fmtTime(d)}`
  })
  const label =
    phase === 'preparing'
      ? `${prepLabel}…`
      : phase === 'paused'
        ? 'Запись на паузе — вернитесь во вкладку'
        : phase === 'finishing'
          ? 'Сохраняю файл…'
          : 'Идёт запись'
  return (
    <div className="stack ve-stack-xs" aria-live="polite">
      <div className="spread">
        <span className="ve-progress-label">
          {phase === 'preparing' || phase === 'finishing' ? (
            <LoaderCircle size={16} className="ve-spin" aria-hidden="true" />
          ) : (
            <i className={`ve-dot${phase === 'paused' ? ' is-paused' : ''}`} aria-hidden="true" />
          )}
          {label}
        </span>
        <span ref={timeRef} className="num small muted" />
      </div>
      <div
        ref={wrapRef}
        className="bar"
        role="progressbar"
        aria-label="Запись ролика"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <i ref={barRef} className="ve-bar-live" />
      </div>
    </div>
  )
}

export function ExportPanel(p: ExportPanelProps) {
  const busy = p.phase !== 'idle'
  const empty = p.clipsCount === 0 || p.duration <= 0.05
  const ext = p.support.ext
  const formatLabel = ext === 'mp4' ? 'MP4 (H.264)' : ext === 'webm' ? 'WebM' : 'формат браузера'

  return (
    <div className="stack ve-stack">
      {!p.support.ok ? (
        <section className="ve-card ve-card-alert" role="alert">
          <div className="ve-card-head">
            <TriangleAlert size={18} aria-hidden="true" />
            <h3 className="ve-h">Запись здесь недоступна</h3>
          </div>
          <p className="small">{supportMessage(p.support.problem)}</p>
          <p className="field-hint">Монтаж и превью здесь работают, а записать файл получится в Chrome, Edge или Safari свежих версий.</p>
        </section>
      ) : null}

      <section className="ve-card">
        <div className="ve-card-head">
          <h3 className="ve-h">Перед записью</h3>
        </div>
        <dl className="ve-summary">
          <div>
            <dt>Длительность</dt>
            <dd className="num">{fmtTime(p.duration)}</dd>
          </div>
          <div>
            <dt>Кадр</dt>
            <dd className="num">720×1280, 30 кадров/с</dd>
          </div>
          <div>
            <dt>Формат</dt>
            <dd>{formatLabel}</dd>
          </div>
          <div>
            <dt>Музыка</dt>
            <dd>{p.musicLabel}</dd>
          </div>
        </dl>
        <ul className="ve-checks">
          {empty ? (
            <Check state="bad">Добавьте хотя бы один клип или живой фон.</Check>
          ) : (
            <Check state="ok">Клипы на месте.</Check>
          )}
          {p.hasHook ? (
            <Check state="ok">Есть хук на первые секунды.</Check>
          ) : (
            <Check state="warn">Без хука: добавьте цепляющую фразу во вкладке «Текст».</Check>
          )}
          {p.captions > 0 ? <Check state="ok">Субтитров: {p.captions}.</Check> : null}
          {p.total > MAX_TOTAL_SEC ? (
            <Check state="warn">Ролик длиннее 90 секунд — в файл попадут первые 90.</Check>
          ) : null}
          {!empty && p.duration < 3 ? <Check state="warn">Соцсети обычно принимают рилсы от 3 секунд.</Check> : null}
          {ext === 'webm' ? (
            <Check state="warn">
              Этот браузер запишет WebM. Instagram иногда его не принимает — свежие Chrome и Edge пишут MP4.
            </Check>
          ) : null}
        </ul>
        <div className="ve-wm">
          {p.pro ? (
            <p className="small muted">Набор Мастера: ролик без водяного знака.</p>
          ) : (
            <>
              <p className="small muted">Внизу будет аккуратная подпись «Сделано в PsyQuest».</p>
              <Button size="sm" variant="quiet" sound="lock" icon={<Lock size={14} />} onClick={p.onNeedPro}>
                Убрать подпись
              </Button>
            </>
          )}
        </div>
        <Switch checked={p.monitor} onChange={p.onMonitor} disabled={busy} hint="Выключите, чтобы записывать тихо">
          Слушать звук во время записи
        </Switch>
      </section>

      <section className="ve-card ve-go">
        {busy ? (
          <>
            <Progress engine={p.engine} phase={p.phase} prepLabel={p.prepLabel} />
            <Button variant="danger" icon={<Square size={16} />} onClick={p.onCancel} sound="close">
              Остановить запись
            </Button>
          </>
        ) : (
          <Button
            variant="lit"
            size="lg"
            block
            sound={false}
            icon={<Download size={20} />}
            disabled={!p.support.ok || empty || !p.engine}
            onClick={p.onStart}
          >
            {p.result ? 'Записать заново' : 'Записать и скачать ролик'}
          </Button>
        )}
        <p className="field-hint">
          Запись идёт в реальном времени: ролик на {Math.max(1, Math.round(p.duration))} с пишется столько же. Не
          сворачивайте вкладку — иначе запись встанет на паузу.
        </p>
      </section>

      {p.error && !busy ? (
        <section className="ve-card ve-card-alert" role="alert">
          <div className="ve-card-head">
            <CircleAlert size={18} aria-hidden="true" />
            <h3 className="ve-h">Запись не удалась</h3>
          </div>
          <p className="small">{p.error}</p>
          <Button size="sm" variant="ghost" icon={<RotateCcw size={16} />} onClick={p.onStart} disabled={!p.support.ok || empty}>
            Попробовать ещё раз
          </Button>
        </section>
      ) : null}

      {p.result && !busy ? (
        <section className="ve-card ve-result">
          <div className="ve-card-head">
            <CircleCheck size={18} className="mint" aria-hidden="true" />
            <h3 className="ve-h">Ролик записан</h3>
          </div>
          <div className="ve-result-body">
            <video className="ve-result-video" src={p.result.url} controls playsInline preload="metadata" />
            <div className="stack ve-stack-sm ve-result-info">
              <p className="small">
                <b>{p.result.fileName}</b>
              </p>
              <p className="small muted num">
                {fmtTime(p.result.durationSec)}, {fmtBytes(p.result.size)}
              </p>
              <p className="field-hint">
                {IN_ARTIFACT
                  ? 'В этой версии игры файл не скачивается сам. Сохрани ролик через меню видео (правая кнопка или долгий тап) или открой полную версию игры.'
                  : 'Файл сохранён в загрузки. Если браузер его не скачал — нажмите кнопку ниже.'}
              </p>
              <div className="row-wrap">
                {!IN_ARTIFACT ? (
                  <Button size="sm" variant="aurora" icon={<Download size={16} />} onClick={p.onDownload}>
                    Скачать ещё раз
                  </Button>
                ) : null}
                {p.canShare ? (
                  <Button size="sm" variant="ghost" icon={<Share2 size={16} />} onClick={p.onShare}>
                    Поделиться
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {p.result.ext === 'webm' ? (
            <p className="field-hint">
              Instagram может не принять WebM. Откройте монтажную в свежем Chrome или Edge — они записывают MP4. Или
              переведите файл в MP4 любым конвертером перед публикацией.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

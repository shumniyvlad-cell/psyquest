import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, CircleX, Copy, Download, ExternalLink, Info, LoaderCircle, RefreshCw, Rocket } from 'lucide-react'
import type { BotConfig } from '../../game/types'
import { sfx, stinger } from '../../audio/engine'
import { Button } from '../../ui/Button'
import type { DeployResult } from './BotBuilder'
import { botScriptText, exportableConfig } from './model'
import { IN_ARTIFACT } from '../../env'
import { copyText, downloadFile, plural, slugify } from './util'

export const TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/

function useFlag(ms = 2200): [boolean, () => void] {
  const [on, setOn] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return [
    on,
    () => {
      setOn(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setOn(false), ms)
    },
  ]
}

function BotFatherSteps({ forDeploy }: { forDeploy?: boolean }) {
  return (
    <ol className="bb-steps">
      <li>
        Открой{' '}
        <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">
          @BotFather
        </a>{' '}
        в Telegram.
      </li>
      <li>
        Отправь команду <code>/newbot</code>.
      </li>
      <li>
        Придумай имя — его увидят люди — и username. Username должен заканчиваться на <code>bot</code>, например{' '}
        <code>anna_psy_bot</code>.
      </li>
      <li>
        {forDeploy
          ? 'Скопируй токен из ответа BotFather и вставь его в поле ниже.'
          : 'Скопируй токен из ответа, подключи бота в конструкторе и перенеси сценарий по шагам.'}
      </li>
    </ol>
  )
}

// ---------- Экспорт ----------

export function ExportPanel({ cfg }: { cfg: BotConfig }) {
  const script = useMemo(() => botScriptText(cfg), [cfg])
  const [copied, flashCopied] = useFlag()
  const [failed, setFailed] = useState(false)

  const download = () => {
    sfx('drop')
    const name = `bot-${slugify(cfg.botName)}.json`
    downloadFile(name, `${JSON.stringify(exportableConfig(cfg), null, 2)}\n`, 'application/json')
  }

  const copy = async () => {
    const ok = await copyText(script)
    if (ok) {
      sfx('success')
      setFailed(false)
      flashCopied()
    } else {
      sfx('error')
      setFailed(true)
    }
  }

  return (
    <section className="panel bb-sec" aria-labelledby="bb-exp-title">
      <div className="bb-sec-head">
        <div>
          <h3 className="display t-20" id="bb-exp-title">
            Экспорт сценария
          </h3>
          <p className="small muted">Перенеси бота в BotHelp, SaleBot или Leadteh — или сохрани копию себе.</p>
        </div>
      </div>
      <div className="row-wrap">
        {!IN_ARTIFACT ? (
        <Button variant="ghost" className="bb-btn-wrap" icon={<Download size={17} />} sound={false} onClick={download}>
          Скачать сценарий (JSON)
        </Button>
        ) : null}
        <Button
          variant="ghost"
          className="bb-btn-wrap"
          icon={copied ? <Check size={17} /> : <Copy size={17} />}
          sound={false}
          onClick={copy}
        >
          {copied ? 'Сценарий скопирован' : 'Скопировать сценарий для конструктора'}
        </Button>
      </div>
      {failed ? (
        <p className="small ember" role="alert">
          Браузер не дал скопировать автоматически. Открой текст ниже, выдели его и скопируй вручную.
        </p>
      ) : null}
      <details className="bb-details" open={failed || undefined}>
        <summary>Показать текст сценария</summary>
        <textarea
          className="textarea bb-script"
          readOnly
          rows={12}
          value={script}
          aria-label="Текст сценария для конструктора"
          onFocus={(e) => e.currentTarget.select()}
        />
      </details>
      <div className="bb-howto">
        <div className="field-label">Как создать бота в Telegram</div>
        <BotFatherSteps />
      </div>
    </section>
  )
}

// ---------- Запуск ----------

interface DeployPanelProps {
  cfg: BotConfig
  deploy?: (token: string, cfg: BotConfig) => Promise<DeployResult>
  errorCount: number
  onDeployed: (res: DeployResult) => void
}

export function DeployPanel({ cfg, deploy, errorCount, onDeployed }: DeployPanelProps) {
  const deployed = cfg.deployed
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(!deployed)
  const showForm = formOpen || !deployed
  const [copied, flashCopied] = useFlag()
  const inputId = useId()
  const hintId = useId()
  const trimmed = token.trim()
  const tokenOk = TOKEN_RE.test(trimmed)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const launch = async () => {
    if (!deploy || !tokenOk || busy || errorCount > 0) return
    const secret = trimmed
    // Токен живёт только в этой функции: поле очищаем сразу, в конфиг он не попадает.
    setToken('')
    setBusy(true)
    setError(null)
    sfx('whoosh')
    try {
      const res = await deploy(secret, exportableConfig(cfg))
      onDeployed(res)
      stinger('ship')
      if (mounted.current) setFormOpen(false)
    } catch (e) {
      sfx('error')
      if (mounted.current) {
        setError(
          e instanceof Error && e.message
            ? e.message
            : 'Не получилось запустить бота. Проверь токен и попробуй ещё раз.',
        )
      }
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const copyAdmin = async () => {
    if (!deployed) return
    const ok = await copyText(`/admin ${deployed.adminCode}`)
    sfx(ok ? 'success' : 'error')
    if (ok) flashCopied()
  }

  return (
    <section className="panel bb-sec bb-launch" aria-labelledby="bb-launch-title">
      <div className="bb-sec-head">
        <div>
          <h3 className="display t-20" id="bb-launch-title">
            Оживить бота
          </h3>
          <p className="small muted">Настоящий бот в Telegram: сервер игры будет вести людей по твоей воронке.</p>
        </div>
      </div>

      {deployed ? (
        <div className="bb-live" role="status">
          <div className="bb-live-head">
            <span className="bb-live-dot" aria-hidden="true" />
            Бот запущен
          </div>
          <a className="bb-live-link" href={`https://t.me/${deployed.username}`} target="_blank" rel="noopener noreferrer">
            t.me/{deployed.username}
            <ExternalLink size={15} aria-hidden="true" />
          </a>
          <div className="bb-admin">
            <div className="small muted">Код администратора</div>
            <div className="bb-admin-row">
              <code className="bb-code">{deployed.adminCode}</code>
              <Button
                variant="ghost"
                size="sm"
                sound={false}
                icon={copied ? <Check size={15} /> : <Copy size={15} />}
                onClick={copyAdmin}
              >
                {copied ? 'Команда скопирована' : 'Скопировать команду'}
              </Button>
            </div>
            <p className="small">
              Отправь своему боту <code>/admin {deployed.adminCode}</code>, чтобы получать заявки.
            </p>
          </div>
          {deploy ? (
            <div>
              <Button
                variant="quiet"
                size="sm"
                icon={<RefreshCw size={15} />}
                aria-expanded={showForm}
                onClick={() => setFormOpen((v) => !v)}
              >
                {showForm ? 'Свернуть' : 'Обновить сценарий в боте'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!deploy ? (
        <div className="bb-plate">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>Живой запуск доступен, когда подключён сервер игры.</strong> Пока — экспорт сценария: скачай JSON или
            скопируй текст и собери бота в BotHelp, SaleBot или Leadteh.
          </div>
        </div>
      ) : showForm ? (
        <div className="stack bb-deploy">
          {deployed ? (
            <p className="small muted">Сценарий поменялся? Вставь токен ещё раз — бот получит новую версию.</p>
          ) : (
            <BotFatherSteps forDeploy />
          )}
          <div className="field">
            <label className="field-label" htmlFor={inputId}>
              Токен бота
            </label>
            <input
              id={inputId}
              className="input bb-token"
              type="password"
              name="bb-bot-token"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              data-1p-ignore="true"
              data-lpignore="true"
              placeholder="123456789:AAE…"
              value={token}
              disabled={busy}
              aria-invalid={trimmed.length > 0 && !tokenOk}
              aria-describedby={hintId}
              onChange={(e) => {
                setToken(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void launch()
                }
              }}
            />
            <div className="field-hint" id={hintId}>
              {trimmed && !tokenOk ? (
                <span className="ember">
                  Токен выглядит так: 123456789:AAE… — цифры, двоеточие и длинный хвост из букв. Скопируй его целиком из
                  сообщения @BotFather.
                </span>
              ) : (
                'Токен уйдёт на сервер игры один раз и не сохранится ни в браузере, ни в сценарии.'
              )}
            </div>
          </div>
          {errorCount > 0 ? (
            <p className="small ember">
              Сначала исправь {errorCount} {plural(errorCount, 'ошибку', 'ошибки', 'ошибок')} на этажах — бот с ошибками
              потеряет людей.
            </p>
          ) : null}
          <div>
            <Button
              variant="lit"
              sound={false}
              icon={busy ? <LoaderCircle size={18} className="bb-spin" /> : <Rocket size={18} />}
              disabled={!tokenOk || busy || errorCount > 0}
              aria-busy={busy}
              onClick={() => void launch()}
            >
              {busy ? 'Запускаю бота…' : deployed ? 'Обновить бота' : 'Запустить бота'}
            </Button>
          </div>
          {error ? (
            <div className="bb-error" role="alert">
              <CircleX size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

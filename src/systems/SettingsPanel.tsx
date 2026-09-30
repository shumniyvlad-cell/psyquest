import { useRef, useState } from 'react'
import { isDemo, serverInfo } from '../api/client'
import { sfx } from '../audio/engine'
import { useGame } from '../game/store'
import type { Settings } from '../game/types'
import { IN_ARTIFACT } from '../env'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'

const SPEEDS: { id: Settings['textSpeed']; label: string }[] = [
  { id: 'slow', label: 'Медленно' },
  { id: 'normal', label: 'Обычно' },
  { id: 'fast', label: 'Быстро' },
  { id: 'instant', label: 'Сразу' },
]

export function SettingsPanel() {
  const settings = useGame((s) => s.settings)
  const setSettings = useGame((s) => s.setSettings)
  const [confirmReset, setConfirmReset] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const exportSave = () => {
    const text = useGame.getState().exportSave()
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `psyquest-save-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const importSave = async (f: File) => {
    const text = await f.text()
    const ok = useGame.getState().importSave(text)
    setMsg(ok ? 'Сохранение загружено.' : 'Не получилось прочитать файл. Нужен файл сохранения PsyQuest.')
    sfx(ok ? 'success' : 'error')
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Field label={`Музыка: ${Math.round(settings.music * 100)}%`} htmlFor="set-music">
        <input id="set-music" type="range" min={0} max={1} step={0.05} value={settings.music} onChange={(e) => setSettings({ music: Number(e.target.value) })} />
      </Field>
      <Field label={`Звуки: ${Math.round(settings.sfx * 100)}%`} htmlFor="set-sfx">
        <input
          id="set-sfx"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.sfx}
          onChange={(e) => setSettings({ sfx: Number(e.target.value) })}
          onPointerUp={() => sfx('coin')}
        />
      </Field>
      <div className="field">
        <span className="field-label">Скорость текста</span>
        <div className="row-wrap">
          {SPEEDS.map((s) => (
            <button key={s.id} className="chip" aria-pressed={settings.textSpeed === s.id} onClick={() => setSettings({ textSpeed: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <label className="row small">
        <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => setSettings({ reducedMotion: e.target.checked })} />
        Меньше анимации
      </label>

      <hr className="divider" />

      <div className="stack">
        <b>Сохранение</b>
        <p className="small faint">Игра хранится в этом браузере. Скачай файл, чтобы перенести прогресс на другое устройство.</p>
        <div className="row-wrap">
          {!IN_ARTIFACT ? (
            <Button variant="ghost" size="sm" onClick={exportSave}>
              Скачать сохранение
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(useGame.getState().exportSave()).then(
                () => setMsg('Сохранение скопировано. Вставь его в заметку или файл .json, чтобы перенести игру.'),
                () => setMsg('Браузер не дал скопировать. Попробуй кнопку ещё раз.'),
              )
            }}
          >
            Скопировать сохранение
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            Загрузить сохранение
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importSave(f)
              e.target.value = ''
            }}
          />
        </div>
        {msg ? <p className="small muted">{msg}</p> : null}
      </div>

      <div className="stack">
        <b>Начать путь заново</b>
        <p className="small faint">Новый герой и новая клятва. Покупки, монеты и разборы Совы останутся.</p>
        {confirmReset ? (
          <div className="row-wrap">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setConfirmReset(false)
                useGame.getState().newGame()
              }}
            >
              Да, начать заново
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setConfirmReset(false)}>
              Оставить как есть
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
              Начать заново
            </Button>
          </div>
        )}
      </div>

      <hr className="divider" />
      <div className="stack" style={{ gap: 4 }}>
        <p className="small">
          <b>PsyQuest</b> — игра, в которой психолог строит свою практику. Продюсирование: Vlad March Media.
        </p>
        <p className="tiny faint">
          {isDemo ? 'Режим: демо — всё работает в браузере, покупки без оплаты.' : `Сервер игры: ${serverInfo()}`}
        </p>
        <p className="tiny faint">Музыка и звуки синтезируются прямо в браузере. Твои тексты и клиенты не покидают устройство, кроме запросов к Сове и запуска бота через сервер.</p>
      </div>
    </div>
  )
}

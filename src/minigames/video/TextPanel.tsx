// Вкладка «Текст»: сборка из сценария, хук, субтитры, стиль и позиция.
import { useEffect, useRef, useState } from 'react'
import { Plus, Timer, Trash, WandSparkles } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import type { ReelScript } from '../../game/types'
import { BG_PRESETS } from './backgrounds'
import { AutoTextarea, Chips, SecInput, Switch } from './controls'
import { SAMPLE_SCRIPT } from './script'
import {
  HOOK_MAX_SEC,
  HOOK_MIN_SEC,
  MAX_TOTAL_SEC,
  type BgPreset,
  type Caption,
  type TextPos,
  type TextSettings,
  type TextStyleId,
} from './types'
import { clamp, fmtSec, round1, uid } from './util'

const STYLES: { id: TextStyleId; name: string; hint: string }[] = [
  { id: 'clean', name: 'Чистый', hint: 'Белый текст с мягкой тенью' },
  { id: 'lantern', name: 'Фонарь', hint: 'Тёплая плашка под строками' },
  { id: 'ink', name: 'Чернила', hint: 'Тёмная полупрозрачная карточка' },
  { id: 'notebook', name: 'Тетрадь', hint: 'Листок в линейку, книжный шрифт' },
]

const POSITIONS: { id: TextPos; name: string }[] = [
  { id: 'top', name: 'Сверху' },
  { id: 'center', name: 'По центру' },
  { id: 'bottom', name: 'Снизу' },
]

const MIN_CAP = 0.3

interface TextPanelProps {
  text: TextSettings
  onText: (fn: (t: TextSettings) => TextSettings) => void
  scripts: ReelScript[]
  duration: number
  hasFiles: boolean
  /** Показать кадр в превью (при фокусе на поле) */
  onPreviewAt: (t: number) => void
  /** Текущее положение плейхеда */
  getTime: () => number
  onBuild: (s: ReelScript, preset: BgPreset) => void
}

export function TextPanel(p: TextPanelProps) {
  const { text, onText } = p
  const [focusId, setFocusId] = useState<string | null>(null)

  const setCaption = (id: string, patch: Partial<Caption>) =>
    onText((t) => ({ ...t, captions: t.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))

  const sortCaps = (caps: Caption[]) => [...caps].sort((a, b) => a.start - b.start)

  const setTimes = (id: string, start: number | null, end: number | null) =>
    onText((t) => ({
      ...t,
      captions: sortCaps(
        t.captions.map((c) => {
          if (c.id !== id) return c
          const len = Math.max(MIN_CAP, c.end - c.start)
          const s = clamp(round1(start ?? c.start), 0, MAX_TOTAL_SEC - MIN_CAP)
          let e = end ?? c.end
          if (end === null && e < s + MIN_CAP) e = s + len
          e = clamp(round1(e), s + MIN_CAP, MAX_TOTAL_SEC)
          return { ...c, start: s, end: e }
        }),
      ),
    }))

  const startHere = (id: string) => {
    const now = round1(p.getTime())
    onText((t) => ({
      ...t,
      captions: sortCaps(
        t.captions.map((c) => {
          if (c.id !== id) return c
          const len = Math.max(MIN_CAP, c.end - c.start)
          const s = clamp(now, 0, MAX_TOTAL_SEC - MIN_CAP)
          return { ...c, start: s, end: clamp(round1(s + len), s + MIN_CAP, MAX_TOTAL_SEC) }
        }),
      ),
    }))
  }

  const addCaption = () => {
    const last = text.captions[text.captions.length - 1]
    let start = last ? last.end : text.hook.trim() ? text.hookSec : 0
    if (p.duration > 0 && start >= p.duration - 0.5) start = Math.max(0, p.duration - 2.5)
    start = round1(clamp(start, 0, MAX_TOTAL_SEC - 1))
    const cap: Caption = { id: uid('cap'), text: '', start, end: round1(Math.min(MAX_TOTAL_SEC, start + 2.5)) }
    onText((t) => ({ ...t, captions: sortCaps([...t.captions, cap]) }))
    setFocusId(cap.id)
    p.onPreviewAt(start + 0.3)
  }

  const removeCaption = (id: string) => onText((t) => ({ ...t, captions: t.captions.filter((c) => c.id !== id) }))

  return (
    <div className="stack ve-stack">
      <ScriptBuilder scripts={p.scripts} hasFiles={p.hasFiles} onBuild={p.onBuild} />

      <section className="ve-card">
        <Field
          label="Хук"
          htmlFor="ve-hook"
          hint="Крупный заголовок в первые секунды — от него зависит, досмотрят ли ролик."
        >
          <AutoTextarea
            id="ve-hook"
            className="textarea ve-textarea"
            rows={2}
            maxLength={160}
            value={text.hook}
            placeholder="Например: почему отдых больше не помогает"
            onFocus={() => p.onPreviewAt(0)}
            onChange={(e) => {
              const hook = e.target.value
              onText((t) => ({ ...t, hook }))
            }}
          />
        </Field>
        <div className="ve-field-row">
          <span className="field-label">Показывать</span>
          <span className="small muted num">первые {fmtSec(text.hookSec)} с</span>
        </div>
        <input
          type="range"
          min={HOOK_MIN_SEC}
          max={HOOK_MAX_SEC}
          step={0.5}
          value={text.hookSec}
          aria-label="Сколько секунд показывать хук"
          aria-valuetext={`${fmtSec(text.hookSec)} с`}
          onChange={(e) => {
            const hookSec = Number(e.target.value)
            onText((t) => ({ ...t, hookSec }))
          }}
        />
      </section>

      <section className="ve-card">
        <div className="ve-card-head spread">
          <h3 className="ve-h">Субтитры</h3>
          <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={addCaption}>
            Добавить
          </Button>
        </div>
        {text.captions.length === 0 ? (
          <p className="small faint">Разбейте мысль на короткие фразы — одна-две строки на экран.</p>
        ) : null}
        <ol className="ve-caps">
          {text.captions.map((c, i) => (
            <CaptionRow
              key={c.id}
              cap={c}
              index={i}
              duration={p.duration}
              autoFocus={focusId === c.id}
              onFocused={() => {
                if (focusId === c.id) setFocusId(null)
                p.onPreviewAt(Math.min(c.end - 0.05, c.start + 0.4))
              }}
              onText={(v) => setCaption(c.id, { text: v })}
              onTimes={(s, e) => setTimes(c.id, s, e)}
              onStartHere={() => startHere(c.id)}
              onRemove={() => removeCaption(c.id)}
            />
          ))}
        </ol>
      </section>

      <section className="ve-card">
        <div className="ve-card-head">
          <h3 className="ve-h">Оформление</h3>
        </div>
        <div className="ve-styles" role="group" aria-label="Стиль текста">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="choice ve-style"
              aria-pressed={text.style === s.id}
              title={s.hint}
              onClick={() => onText((t) => ({ ...t, style: s.id }))}
            >
              <span className={`ve-sample is-${s.id}`} aria-hidden="true">
                <span>Аа</span>
              </span>
              <span className="ve-style-name">{s.name}</span>
            </button>
          ))}
        </div>
        <div className="ve-pos">
          <span className="field-label">Хук</span>
          <Chips label="Позиция хука" value={text.hookPos} options={POSITIONS} onChange={(hookPos) => onText((t) => ({ ...t, hookPos }))} />
        </div>
        <div className="ve-pos">
          <span className="field-label">Субтитры</span>
          <Chips label="Позиция субтитров" value={text.capPos} options={POSITIONS} onChange={(capPos) => onText((t) => ({ ...t, capPos }))} />
        </div>
        <Switch
          checked={text.safeZones}
          onChange={(safeZones) => onText((t) => ({ ...t, safeZones }))}
          hint="Где шапка, подпись и кнопки соцсети закроют кадр"
        >
          Показать безопасные зоны
        </Switch>
      </section>
    </div>
  )
}

interface CaptionRowProps {
  cap: Caption
  index: number
  duration: number
  autoFocus: boolean
  onFocused: () => void
  onText: (v: string) => void
  onTimes: (start: number | null, end: number | null) => void
  onStartHere: () => void
  onRemove: () => void
}

function CaptionRow({ cap, index, duration, autoFocus, onFocused, onText, onTimes, onStartHere, onRemove }: CaptionRowProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  const outside = duration > 0 && cap.start >= duration
  return (
    <li className="ve-cap">
      <div className="ve-cap-top">
        <span className="ve-cap-n num" aria-hidden="true">
          {index + 1}
        </span>
        <AutoTextarea
          ref={ref}
          className="textarea ve-textarea"
          rows={2}
          maxLength={220}
          value={cap.text}
          placeholder="Фраза на экране"
          aria-label={`Субтитр ${index + 1}`}
          onFocus={onFocused}
          onChange={(e) => onText(e.target.value)}
        />
      </div>
      <div className="ve-cap-times">
        <SecInput label="С" value={cap.start} onCommit={(v) => onTimes(v, null)} />
        <SecInput label="До" value={cap.end} onCommit={(v) => onTimes(null, v)} />
        <div className="ve-cap-btns">
          <Button
            size="sm"
            variant="quiet"
            icon={<Timer size={16} />}
            aria-label="Начать с текущего момента"
            title="Начать с текущего момента"
            onClick={onStartHere}
          />
          <Button
            size="sm"
            variant="quiet"
            sound="whoosh"
            icon={<Trash size={16} />}
            aria-label={`Удалить субтитр ${index + 1}`}
            title="Удалить субтитр"
            onClick={onRemove}
          />
        </div>
      </div>
      {outside ? (
        <p className="field-hint ember">Фраза начинается после конца ролика — сдвиньте её раньше или добавьте клип.</p>
      ) : null}
    </li>
  )
}

function ScriptBuilder({
  scripts,
  hasFiles,
  onBuild,
}: {
  scripts: ReelScript[]
  hasFiles: boolean
  onBuild: (s: ReelScript, preset: BgPreset) => void
}) {
  const list = scripts.length ? scripts : [SAMPLE_SCRIPT]
  const [id, setId] = useState(list[0].id)
  const [preset, setPreset] = useState<BgPreset>('aurora')
  const script = list.find((s) => s.id === id) ?? list[0]
  const parts: [string, string][] = [
    ['Хук', script.hook],
    ['Проблема', script.problem],
    ['Инсайт', script.insight],
    ['Призыв', script.cta],
  ]
  return (
    <section className="ve-card ve-builder">
      <div className="ve-card-head">
        <WandSparkles size={18} className="mint" aria-hidden="true" />
        <h3 className="ve-h">Собрать из сценария</h3>
      </div>
      {scripts.length ? (
        <Field label="Сценарий" htmlFor="ve-script">
          <select id="ve-script" className="select" value={script.id} onChange={(e) => setId(e.target.value)}>
            {list.map((s, i) => (
              <option key={s.id} value={s.id}>
                {`${i + 1}. ${(s.hook || 'Без хука').slice(0, 70)}`}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p className="small muted">
          Сценариев из «Студии Эха» пока нет. Вот пример — соберите по нему ролик и замените текст на свой.
        </p>
      )}
      <dl className="ve-script">
        {parts.map(([k, v]) =>
          v.trim() ? (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {hasFiles ? (
        <p className="field-hint">Клипы останутся как есть — заменится только текст.</p>
      ) : (
        <div className="stack ve-stack-xs">
          <span className="field-label">Фон</span>
          <Chips label="Живой фон для ролика" value={preset} options={BG_PRESETS.map((b) => ({ id: b.id, name: b.name }))} onChange={setPreset} />
        </div>
      )}
      <p className="field-hint">
        Хук — первые 3 секунды, дальше фразы по очереди: время зависит от длины текста.
      </p>
      <Button
        variant="aurora"
        icon={<WandSparkles size={18} />}
        sound={false}
        disabled={!parts.some(([, v]) => v.trim())}
        onClick={() => onBuild(script, preset)}
      >
        {scripts.length ? 'Собрать ролик' : 'Собрать из примера'}
      </Button>
    </section>
  )
}

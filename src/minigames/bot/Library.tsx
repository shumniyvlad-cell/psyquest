import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Flower2, HeartHandshake, Laptop, Lock, Users, WandSparkles } from 'lucide-react'
import { sfx } from '../../audio/engine'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { BOT_PRESETS, type BotPreset, type PresetIcon } from './presets'

const ICONS: Record<PresetIcon, typeof Laptop> = {
  laptop: Laptop,
  hearts: HeartHandshake,
  family: Users,
  flower: Flower2,
}

interface LibraryProps {
  pro: boolean
  onNeedPro?: () => void
  onApply: (preset: BotPreset) => void
}

export function PresetLibrary({ pro, onNeedPro, onApply }: LibraryProps) {
  const [confirm, setConfirm] = useState<BotPreset | null>(null)

  return (
    <section className="panel bb-sec bb-lib" aria-labelledby="bb-lib-title">
      <div className="bb-sec-head">
        <div>
          <h3 className="display t-20" id="bb-lib-title">
            Готовые сценарии
          </h3>
          <p className="small muted">Четыре проверенные воронки под ниши. Применяются одним нажатием — дальше правь под себя.</p>
        </div>
        <span className={pro ? 'badge badge-mint' : 'badge badge-ink'}>
          {pro ? <WandSparkles size={13} aria-hidden="true" /> : <Lock size={13} aria-hidden="true" />}
          Набор Мастера
        </span>
      </div>
      <ul className="bb-presets">
        {BOT_PRESETS.map((p) => {
          const Icon = ICONS[p.icon]
          return (
            <li key={p.id} className="bb-preset" data-locked={!pro || undefined}>
              <span className="bb-preset-ico" aria-hidden="true">
                <Icon size={20} />
              </span>
              <div className="bb-preset-main">
                <div className="bb-preset-title">{p.title}</div>
                <div className="bb-preset-pitch">{p.pitch}</div>
              </div>
              {pro ? (
                <Button variant="ghost" size="sm" sound="open" onClick={() => setConfirm(p)} aria-label={`Применить сценарий «${p.title}»`}>
                  Применить сценарий
                </Button>
              ) : (
                <Button
                  variant="quiet"
                  size="sm"
                  icon={<Lock size={15} />}
                  sound="lock"
                  disabled={!onNeedPro}
                  onClick={() => onNeedPro?.()}
                  aria-label={`Сценарий «${p.title}» — открыть в Наборе Мастера`}
                >
                  Открыть в Наборе Мастера
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {/* Портал: у панели есть backdrop-filter, он ломает fixed-позиционирование модалки */}
      {createPortal(
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Заменить тексты?" width={480}>
        {confirm ? (
          <div className="stack">
            <p>
              Сценарий «{confirm.title}» заменит приветствие, лид-магнит, вопросы квиза, оффер, кнопку записи и напоминание.
            </p>
            <p className="small muted">
              Имя бота, ссылки, цена и кризисный текст останутся твоими. Согласие на обработку данных включится.
            </p>
            <div className="row-wrap bb-modal-actions">
              <Button
                variant="lit"
                sound={false}
                icon={<WandSparkles size={17} />}
                onClick={() => {
                  sfx('magic')
                  onApply(confirm)
                  setConfirm(null)
                }}
              >
                Заменить тексты
              </Button>
              <Button variant="quiet" onClick={() => setConfirm(null)}>
                Оставить как есть
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>,
        document.body,
      )}
    </section>
  )
}

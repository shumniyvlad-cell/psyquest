// Вкладка «Музыка»: треки игры (часть — в Наборе Мастера), без музыки или свой файл.
import { Check, FileMusic, LoaderCircle, Lock, Music, Play, TriangleAlert, VolumeX } from 'lucide-react'
import { Button } from '../../ui/Button'
import { sfx } from '../../audio/engine'
import { REEL_TRACKS } from '../../audio/themes'
import type { MusicChoice, MusicSettings } from './types'
import { shortName } from './util'

export interface TrackStatus {
  id: string
  state: 'loading' | 'ready' | 'error'
}

interface MusicPanelProps {
  music: MusicSettings
  pro: boolean
  status: TrackStatus | null
  fileName: string | null
  fileBusy: boolean
  canListen: boolean
  onChoose: (c: MusicChoice) => void
  onVolume: (v: number) => void
  onPickFile: () => void
  onNeedPro: () => void
  onListen: () => void
}

export function MusicPanel(p: MusicPanelProps) {
  const choose = (c: MusicChoice) => {
    if (p.music.choice === c) return
    sfx('select')
    p.onChoose(c)
  }
  return (
    <div className="stack ve-stack">
      <section className="ve-card">
        <div className="ve-card-head spread">
          <h3 className="ve-h">Музыка</h3>
          <Button size="sm" variant="ghost" icon={<Play size={16} />} disabled={!p.canListen} onClick={p.onListen}>
            Слушать с начала
          </Button>
        </div>
        <p className="field-hint">
          Треки созданы прямо в игре — их можно ставить в ролики без вопросов об авторских правах.
        </p>
        <div className="ve-tracks">
          <button type="button" className="choice ve-track" aria-pressed={p.music.choice === 'none'} onClick={() => choose('none')}>
            <span className="ve-track-icon" aria-hidden="true">
              <VolumeX size={18} />
            </span>
            <span className="ve-track-text">
              <span className="ve-track-name">Без музыки</span>
              <span className="ve-track-mood">Только звук видео</span>
            </span>
          </button>
          {REEL_TRACKS.map((tr) => {
            const locked = tr.pro && !p.pro
            const st = p.status && p.status.id === tr.id ? p.status.state : null
            const on = p.music.choice === tr.id
            return (
              <button
                key={tr.id}
                type="button"
                className={`choice ve-track${locked ? ' is-locked' : ''}`}
                aria-pressed={on}
                aria-describedby={locked ? 've-pro-note' : undefined}
                onClick={() => {
                  if (locked) {
                    sfx('lock')
                    p.onNeedPro()
                    return
                  }
                  choose(tr.id)
                }}
              >
                <span className="ve-track-icon" aria-hidden="true">
                  {on && st === 'loading' ? (
                    <LoaderCircle size={18} className="ve-spin" />
                  ) : on && st === 'error' ? (
                    <TriangleAlert size={18} />
                  ) : on ? (
                    <Check size={18} />
                  ) : (
                    <Music size={18} />
                  )}
                </span>
                <span className="ve-track-text">
                  <span className="ve-track-name">{tr.name}</span>
                  <span className="ve-track-mood">
                    {on && st === 'loading'
                      ? 'Готовлю трек…'
                      : on && st === 'error'
                        ? 'Не получилось подготовить трек — выберите его ещё раз'
                        : tr.mood}
                  </span>
                </span>
                {tr.pro ? (
                  <span className={`badge ${p.pro ? '' : 'badge-ink'}`}>
                    {locked ? <Lock size={12} aria-hidden="true" /> : null}
                    Мастер
                  </span>
                ) : null}
              </button>
            )
          })}
          <button
            type="button"
            className="choice ve-track"
            aria-pressed={p.music.choice === 'file'}
            onClick={() => {
              if (p.fileName) choose('file')
              else p.onPickFile()
            }}
          >
            <span className="ve-track-icon" aria-hidden="true">
              {p.fileBusy ? <LoaderCircle size={18} className="ve-spin" /> : <FileMusic size={18} />}
            </span>
            <span className="ve-track-text">
              <span className="ve-track-name">Свой трек</span>
              <span className="ve-track-mood">
                {p.fileBusy ? 'Читаю файл…' : p.fileName ? shortName(p.fileName, 40) : 'MP3, M4A, WAV или OGG с устройства'}
              </span>
            </span>
          </button>
        </div>
        {p.fileName ? (
          <Button size="sm" variant="quiet" icon={<FileMusic size={16} />} onClick={p.onPickFile}>
            Выбрать другой файл
          </Button>
        ) : null}
        {!p.pro ? (
          <p id="ve-pro-note" className="field-hint">
            Треки с меткой «Мастер» открываются в Наборе Мастера.
          </p>
        ) : null}
        {p.music.choice === 'file' ? (
          <p className="field-hint">Для своего трека убедитесь, что его можно использовать в публикациях.</p>
        ) : null}
      </section>

      <section className="ve-card">
        <div className="ve-field-row">
          <span className="field-label">Громкость музыки</span>
          <span className="small muted num">{Math.round(p.music.volume * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={p.music.volume}
          disabled={p.music.choice === 'none'}
          aria-label="Громкость музыки"
          aria-valuetext={`${Math.round(p.music.volume * 100)}%`}
          onChange={(e) => p.onVolume(Number(e.target.value))}
        />
        <p className="field-hint">Если в видео есть голос, музыку лучше держать около 30–40%.</p>
      </section>
    </div>
  )
}

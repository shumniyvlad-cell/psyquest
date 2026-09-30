import { useState } from 'react'
import { Copy, Download, FileJson, Printer } from 'lucide-react'
import { botScriptText } from '../minigames/bot/model'
import { fmtRub } from '../game/planner'
import { useGame, type SaveData } from '../game/store'
import { Button } from '../ui/Button'

interface Section {
  key: string
  title: string
  text: string
}

const RUBRIC = { expert: 'экспертный', personal: 'личный', engaging: 'вовлекающий', selling: 'продающий' } as const
const FORMAT = { reel: 'рилс', post: 'пост', stories: 'сторис', live: 'эфир' } as const

export function artifactSections(s: SaveData): Section[] {
  const a = s.artifacts
  const out: Section[] = []
  if (a.expertise) {
    const e = a.expertise
    out.push({
      key: 'expertise',
      title: 'Досье экспертизы',
      text: [
        `Образование: ${e.education}`,
        `Практика: ${e.hours}`,
        `Запросы: ${e.requests}`,
        `История изменений: ${e.caseStory}`,
        `Опора: ${e.support}`,
        `Отличие: ${e.uniqueness}`,
      ]
        .filter((l) => !l.endsWith(': '))
        .join('\n'),
    })
  }
  if (a.positioning) {
    out.push({ key: 'positioning', title: 'Позиционирование', text: `${a.positioning.statement}\n\nЯсность: ${a.positioning.score}%` })
  }
  if (a.product) {
    const p = a.product
    const row = (t: string, x: typeof p.core) => `${t}: ${x.name} (${x.format}) — ${x.price ? fmtRub(x.price) : 'бесплатно'}. ${x.promise}`
    out.push({
      key: 'product',
      title: 'Лестница продуктов',
      text: [row('Польза', p.leadMagnet), row('Знакомство', p.entry), row('Основной пакет', p.core), row('Сопровождение', p.premium)].join('\n'),
    })
  }
  if (a.bot) out.push({ key: 'bot', title: 'Сценарий бота', text: botScriptText(a.bot) })
  if (a.content) {
    const c = a.content
    const parts: string[] = []
    if (c.hooks.length) parts.push('Хуки:\n' + c.hooks.map((h) => `— ${h}`).join('\n'))
    if (c.scripts.length)
      parts.push(
        'Сценарии рилсов:\n' +
          c.scripts.map((r, i) => `${i + 1}. Хук: ${r.hook}\n   Проблема: ${r.problem}\n   Инсайт: ${r.insight}\n   Призыв: ${r.cta}`).join('\n'),
      )
    if (c.plan.length) parts.push('Контент-план:\n' + c.plan.map((d) => `День ${d.day} (${RUBRIC[d.rubric]}, ${FORMAT[d.format]}): ${d.topic}`).join('\n'))
    out.push({ key: 'content', title: 'Контент', text: parts.join('\n\n') })
  }
  if (a.launch) {
    out.push({
      key: 'launch',
      title: 'План запуска',
      text: a.launch.days.map((d) => `${d.date} — ${d.stage}: ${d.content}`).join('\n'),
    })
  }
  if (a.sales) out.push({ key: 'sales', title: 'Сценарий диагностики', text: a.sales.steps.map((x, i) => `${i + 1}. ${x.title}. ${x.text}`).join('\n') })
  if (a.reel) out.push({ key: 'reel', title: 'Первый рилс', text: `Смонтирован ${new Date(a.reel.exportedAt).toLocaleDateString('ru-RU')}, ${Math.round(a.reel.durationSec)} с, формат ${a.reel.format}.` })
  return out
}

function download(name: string, text: string, type = 'text/markdown') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function printSections(title: string, sections: Section[]) {
  const w = window.open('', '_blank')
  if (!w) return
  const d = w.document
  d.documentElement.lang = 'ru'
  d.title = title
  const style = d.createElement('style')
  style.textContent =
    'body{font:15px/1.6 Georgia,serif;color:#1c1a2e;max-width:720px;margin:40px auto;padding:0 20px}h1{font-size:28px}h2{font-size:20px;margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:4px}pre{white-space:pre-wrap;font:inherit}'
  d.head.appendChild(style)
  const h1 = d.createElement('h1')
  h1.textContent = title
  d.body.appendChild(h1)
  for (const sec of sections) {
    const h2 = d.createElement('h2')
    h2.textContent = sec.title
    const pre = d.createElement('pre')
    pre.textContent = sec.text
    d.body.append(h2, pre)
  }
  w.focus()
  w.print()
}

export function ChestPanel() {
  const state = useGame()
  const sections = artifactSections(state)
  const [copied, setCopied] = useState('')
  const name = state.hero?.name ?? 'Фонарщик'
  const title = `Практика: ${name}`

  const md = () => `# ${title}\n\n` + sections.map((s) => `## ${s.title}\n\n${s.text}`).join('\n\n') + '\n\n_Собрано в игре PsyQuest._\n'

  if (!sections.length) {
    return <p className="muted">Сундук пока пуст. Всё, что ты создашь в главах — досье, позиционирование, продукт, бот, контент, — появится здесь.</p>
  }

  return (
    <div className="stack">
      <p className="small muted">Всё, что создано в пути, — твоё: копируй, скачивай, переноси в соцсети и документы.</p>
      <div className="row-wrap">
        <Button variant="lit" size="sm" icon={<Download size={16} />} onClick={() => download(`psyquest-${name}.md`, md())}>
          Скачать всё (.md)
        </Button>
        <Button variant="ghost" size="sm" icon={<Printer size={16} />} onClick={() => printSections(title, sections)}>
          Печать или PDF
        </Button>
        {state.artifacts.bot ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<FileJson size={16} />}
            onClick={() => {
              const { deployed: _d, ...cfg } = state.artifacts.bot!
              void _d
              download('psyquest-bot.json', JSON.stringify(cfg, null, 2), 'application/json')
            }}
          >
            Сценарий бота (.json)
          </Button>
        ) : null}
      </div>
      {sections.map((s) => (
        <article key={s.key} className="card chest-item">
          <div className="spread">
            <h3 className="display t-20">{s.title}</h3>
            <button
              className="btn btn-quiet btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(s.text).then(
                  () => setCopied(s.key),
                  () => setCopied(''),
                )
              }}
            >
              <Copy size={14} /> {copied === s.key ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
          <pre className="chest-text">{s.text}</pre>
        </article>
      ))}
    </div>
  )
}

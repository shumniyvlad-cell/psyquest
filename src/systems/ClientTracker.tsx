import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { fmtRub } from '../game/planner'
import { useGame, useSeasonClients } from '../game/store'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import './clients.css'

const today = () => new Date().toISOString().slice(0, 10)

export function ClientTracker() {
  const goal = useGame((s) => s.goal)
  const clients = useSeasonClients()
  const product = useGame((s) => s.artifacts.product)
  const addClient = useGame((s) => s.addClient)
  const removeClient = useGame((s) => s.removeClient)

  const products = product
    ? [product.core, product.entry, product.premium].map((p) => ({ name: p.name, price: p.price }))
    : [{ name: 'Пакет встреч', price: goal?.check ?? 0 }]
  const [name, setName] = useState('')
  const [date, setDate] = useState(today())
  const [prod, setProd] = useState(products[0].name)
  const [amount, setAmount] = useState<number>(products[0].price)
  const [note, setNote] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const target = goal?.clients ?? 10
  const income = clients.reduce((a, c) => a + (c.amount || 0), 0)

  const add = () => {
    addClient({ name: name.trim() || `Клиент ${clients.length + 1}`, date, amount: amount || 0, product: prod, note: note.trim() })
    setName('')
    setNote('')
  }

  return (
    <div className="ct stack">
      <div className="ct-progress">
        <div className="spread">
          <span className="display t-25">
            {clients.length} <span className="muted">из {target}</span>
          </span>
          <span className="small muted num">{fmtRub(income)}</span>
        </div>
        {target <= 30 ? (
          <div className="ct-lights" aria-label={`Клиентов: ${clients.length} из ${target}`}>
            {Array.from({ length: target }, (_, i) => (
              <span key={i} className={`ct-light ${i < clients.length ? 'is-on' : ''}`} />
            ))}
          </div>
        ) : (
          <div className="bar">
            <i style={{ width: `${Math.min(100, (clients.length / target) * 100)}%` }} />
          </div>
        )}
      </div>

      <div className="card stack">
        <p className="small muted">Новый клиент — тот, кто начал работу с тобой: оплатил встречу или пакет.</p>
        <div className="grid-2">
          <Field label="Имя или инициалы" htmlFor="ct-name">
            <input id="ct-name" className="input" value={name} placeholder="Например: А. К." onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Дата начала" htmlFor="ct-date">
            <input id="ct-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Что купил" htmlFor="ct-prod">
            <select
              id="ct-prod"
              className="select"
              value={prod}
              onChange={(e) => {
                setProd(e.target.value)
                const p = products.find((x) => x.name === e.target.value)
                if (p) setAmount(p.price)
              }}
            >
              {products.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Сумма, ₽" htmlFor="ct-amount">
            <input id="ct-amount" className="input num" type="number" min={0} step={100} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
        </div>
        <Field label="Заметка для себя" hint="Откуда пришёл: бот, рилс, сарафан, эфир. Без диагнозов и личных подробностей." htmlFor="ct-note">
          <input id="ct-note" className="input" value={note} placeholder="Например: пришла из бота после рилса про выгорание" onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="row-wrap">
          <Button variant="lit" onClick={add}>
            Добавить клиента
          </Button>
          <span className="tiny faint">Данные хранятся только в твоём браузере.</span>
        </div>
      </div>

      {clients.length ? (
        <ul className="ct-list">
          {[...clients].reverse().map((c) => (
            <li key={c.id} className="ct-item">
              <span className="ct-dot" />
              <div className="grow">
                <div className="spread">
                  <b>{c.name}</b>
                  <span className="small num muted">{c.amount ? fmtRub(c.amount) : ''}</span>
                </div>
                <p className="tiny faint">
                  {new Date(c.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, {c.product}
                  {c.note ? `. ${c.note}` : ''}
                </p>
              </div>
              {confirmId === c.id ? (
                <span className="row">
                  <button className="btn btn-danger btn-sm" onClick={() => removeClient(c.id)}>
                    Удалить
                  </button>
                  <button className="btn btn-quiet btn-sm" onClick={() => setConfirmId(null)}>
                    Оставить
                  </button>
                </span>
              ) : (
                <button className="btn btn-quiet btn-icon btn-sm" aria-label={`Удалить ${c.name}`} onClick={() => setConfirmId(c.id)}>
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small faint">Пока пусто. Первый клиент — самый важный: он зажжёт первый огонь Маяка.</p>
      )}
    </div>
  )
}

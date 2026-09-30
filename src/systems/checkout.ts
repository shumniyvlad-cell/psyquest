// Покупки: в демо-режиме выдаются сразу, с сервером — через ЮKassa и возврат в игру.
import { checkout, claimCoins, errorText, fetchEntitlements, isDemo, paymentStatus, product } from '../api/client'
import { stinger } from '../audio/engine'
import { useGame } from '../game/store'

export type BuyResult = { ok: true; mode: 'granted' | 'redirect' } | { ok: false; error: string }

export function applyProductLocally(sku: string) {
  const p = product(sku)
  if (!p) return
  const st = useGame.getState()
  st.grant(p.grants)
  if (p.credits) st.addAiCredits(p.credits)
  if (p.coins) st.addCoins(p.coins, 'покупка')
  stinger('unlock')
  st.toast(`${p.title} — теперь у тебя`, 'item')
  st.log(`Покупка: ${p.title}.`)
}

export async function syncEntitlements() {
  if (isDemo) return
  const st = useGame.getState()
  const e = await fetchEntitlements(st.playerId)
  if (!e) return
  st.grant(e.grants)
  useGame.setState({ aiCredits: e.credits })
  if (e.pendingCoins > 0) {
    const c = await claimCoins(st.playerId)
    if (c > 0) st.addCoins(c, 'покупка')
  }
}

export async function buyProduct(sku: string, email: string): Promise<BuyResult> {
  if (isDemo) {
    applyProductLocally(sku)
    return { ok: true, mode: 'granted' }
  }
  try {
    const st = useGame.getState()
    const r = await checkout(st.playerId, sku, email)
    if (r.mode === 'redirect') {
      try {
        sessionStorage.setItem('psyquest-pending-payment', r.localId)
      } catch {
        /* хранилище недоступно — вернёмся по параметру в адресе */
      }
      window.location.href = r.url
      return { ok: true, mode: 'redirect' }
    }
    await syncEntitlements()
    const p = product(sku)
    stinger('unlock')
    st.toast(`${p?.title ?? 'Покупка'} — теперь у тебя`, 'item')
    return { ok: true, mode: 'granted' }
  } catch (e) {
    return { ok: false, error: errorText(e) }
  }
}

/** Вызывается при старте: если вернулись со страницы оплаты — ждём подтверждения. */
export async function handlePaymentReturn() {
  if (isDemo) return
  const url = new URL(window.location.href)
  let pid = url.searchParams.get('pid')
  if (url.searchParams.get('payment') !== 'return') pid = null
  if (!pid) {
    try {
      pid = sessionStorage.getItem('psyquest-pending-payment')
    } catch {
      pid = null
    }
  }
  if (!pid) {
    syncEntitlements().catch(() => undefined)
    return
  }
  url.searchParams.delete('payment')
  url.searchParams.delete('pid')
  window.history.replaceState(null, '', url.toString())
  const st = useGame.getState()
  st.toast('Проверяем оплату…', 'info')
  for (let i = 0; i < 12; i++) {
    try {
      const r = await paymentStatus(pid, st.playerId)
      if (r.status === 'succeeded') {
        try {
          sessionStorage.removeItem('psyquest-pending-payment')
        } catch {
          /* ок */
        }
        await syncEntitlements()
        stinger('unlock')
        st.toast('Оплата прошла. Спасибо!', 'item')
        return
      }
      if (r.status === 'canceled') {
        try {
          sessionStorage.removeItem('psyquest-pending-payment')
        } catch {
          /* ок */
        }
        st.toast('Оплата отменена. Можно попробовать ещё раз в Лавке.', 'warn')
        return
      }
    } catch {
      /* сеть — пробуем ещё */
    }
    await new Promise((r) => setTimeout(r, 2500))
  }
  st.toast('Оплата ещё обрабатывается. Покупка появится, как только банк подтвердит.', 'info')
}

// Только для стенда. В скрытой вкладке браузер не рисует кадры, и анимации motion замирают.
// Адрес с ?instant — кадры идут по таймеру, а анимации мгновенные (см. preview.tsx).
export const INSTANT = new URLSearchParams(location.search).has('instant')

if (INSTANT) {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 0)
  window.cancelAnimationFrame = (id: number) => window.clearTimeout(id)
}

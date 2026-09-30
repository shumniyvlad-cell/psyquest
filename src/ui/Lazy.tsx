import { Suspense, type ReactNode } from 'react'

/** Пока грузится мини-игра — тихий огонёк вместо пустоты */
export function LazyBox({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="lazy-box" role="status">
          <span className="lazy-flame" />
          <span className="small muted">Разжигаем мастерскую…</span>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

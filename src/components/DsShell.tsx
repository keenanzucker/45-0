import type { ReactNode } from 'react'

/** Nintendo DS body: top screen, hinge, bottom (touch) screen. */
export function DsShell({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <main className="ds">
      <section className="ds__screen ds__screen--top" aria-label="Top screen">
        {top}
      </section>
      <div className="ds__hinge" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <section className="ds__screen ds__screen--bottom" aria-label="Bottom screen">
        {bottom}
      </section>
    </main>
  )
}

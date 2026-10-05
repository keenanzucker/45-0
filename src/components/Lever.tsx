import { useEffect, useRef, useState } from 'react'

/** A slot-machine arm. Enabled when the next spin is waiting; pulling it deals the spin. */
export function Lever({ ready, onPull }: { ready: boolean; onPull(): void }) {
  const [pulling, setPulling] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const pull = () => {
    if (!ready) return
    setPulling(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setPulling(false), 500)
    onPull()
  }

  return (
    <button
      type="button"
      className={`lever${ready ? ' lever--ready' : ''}${pulling ? ' lever--pulled' : ''}`}
      disabled={!ready}
      onClick={pull}
      aria-label="Pull the lever to spin"
    >
      <span className="lever__track" aria-hidden="true">
        <span className="lever__arm">
          <span className="lever__ball" />
        </span>
        <span className="lever__base" />
      </span>
      <span className="lever__label" aria-hidden="true">
        {ready ? 'PULL!' : 'PICK'}
      </span>
    </button>
  )
}

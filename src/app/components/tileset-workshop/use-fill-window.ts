import { useEffect, useState } from 'react'

/**
 * Lets an element run from where it starts down to the bottom of the window
 * (S-Q8). It writes its own top, from the top of the page, to `--fill-top`;
 * the stylesheet subtracts it from the window height.
 *
 * Measured rather than guessed: what sits above — the app header, the
 * workshop tabs — wraps and changes height with the width.
 */
export function useFillWindow() {
  const [element, setElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!element) return

    const measure = () => {
      const top = element.getBoundingClientRect().top + globalThis.scrollY
      element.style.setProperty('--fill-top', `${Math.round(top)}px`)
    }
    measure()
    globalThis.addEventListener('resize', measure)
    return () => globalThis.removeEventListener('resize', measure)
  }, [element])

  return setElement
}

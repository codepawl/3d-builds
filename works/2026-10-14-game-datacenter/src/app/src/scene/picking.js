import { select } from '../store.js'

// Click handler that ignores drags (camera orbits) and selects whatever id the picker returns.
export function selectOnClick(pickId) {
  return (event) => {
    if (event.delta > 6) return
    event.stopPropagation()
    const id = pickId(event)
    if (id) select(id)
  }
}

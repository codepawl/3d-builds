import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { World, placePosition } from './world.jsx'
import { CLUES, MOMENTS, PEOPLE, PLACES, QUOTES, VICTIMS, momentById, placeById, visibleAt } from './data.js'
import { BEATS, VIEWS, shotLight } from './beats.js'
import { playClick, playReveal } from './sound.js'
import { easeInOut, later, tween } from './anim.js'
import { invalidateReserved } from './labels.js'
import { Caption, IntroOverlay, SourcesOverlay, Timeline, usePortrait } from './ui.jsx'

const TITLE_VIEW = { position: [-118, 9, 128], target: [10, 9, 30], instant: true }
const GATED_ITEMS = [...PLACES, ...CLUES, ...PEOPLE, ...QUOTES, ...VICTIMS]

// How many places, clues, people and names a moment knows: a rise is a reveal, and gets the soft hit.
function knownCount(moment) {
  return GATED_ITEMS.filter((item) => visibleAt(item, moment)).length
}

function countyView(placeId, distance = 1) {
  const [x, , z] = placePosition(placeId)
  const offMap = placeById(placeId)?.kind === 'offmap'
  const scale = offMap ? 1.6 * distance : distance
  return { position: [x + 600 * scale, 5600 * scale, z + 6800 * scale], target: [x, 0, z] }
}

function viewForShot(shot) {
  const portrait = window.innerHeight > window.innerWidth
  const portraitView = portrait ? VIEWS[`${shot.view}Portrait`] : null
  const base = shot.place ? countyView(shot.place, shot.distance) : portraitView ?? VIEWS[shot.view]
  return { smoothTime: shot.smooth ?? (shot.slow ? 3.2 : 0.7), ...base }
}

const INITIAL = {
  intro: 'title',
  scale: 'opening',
  eventId: MOMENTS[0],
  shotIndex: 0,
  shotStartedAt: 0,
  light: 'day',
  playing: true,
  sources: false,
}

export default function App() {
  const [state, setState] = useState(INITIAL)
  const [view, setView] = useState({ ...TITLE_VIEW, key: 0 })
  const [map, setMap] = useState(null)
  const fadeRef = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state
  // Every selection gets a new serial; scheduled shots and autoplay steps of an older one do nothing.
  const serialRef = useRef(0)
  const revealsRef = useRef(0)
  const portrait = usePortrait()

  useEffect(() => {
    fetch('/data/map.json').then((response) => response.json()).then(setMap)
  }, [])

  const update = useCallback((patch) => setState((previous) => ({ ...previous, ...(typeof patch === 'function' ? patch(previous) : patch) })), [])
  const flyTo = useCallback((nextView) => setView({ ...nextView, key: Math.random() }), [])

  // A direct crossfade: the last frame of the old scene is laid over the new one and fades out.
  const crossfade = useCallback((middle, { duration = 800 } = {}) => {
    const image = fadeRef.current
    const canvas = document.querySelector('.shell canvas')
    image.src = canvas.toDataURL('image/jpeg', 0.92)
    image.decode().catch(() => {}).then(() => {
      // The fade starts on the first frame: holding the old frame at full opacity repeated it in the film.
      image.style.opacity = '0.9'
      middle()
      tween(duration, (progress) => {
        image.style.opacity = String(0.9 * (1 - easeInOut(progress)))
      })
    })
  }, [])

  // One shot: the world, its light and camera. A change of world crossfades; the same world glides.
  const showShot = useCallback((moment, shotIndex) => {
    const shot = BEATS[moment].shots[shotIndex]
    const patch = {
      eventId: moment,
      shotIndex,
      shotStartedAt: performance.now(),
      light: shotLight(moment, shot, momentById(moment).light),
    }
    const nextView = viewForShot(shot)
    if (stateRef.current.scale === shot.scale) {
      update(patch)
      flyTo(nextView)
      return
    }
    crossfade(() => {
      update({ ...patch, scale: shot.scale, shotStartedAt: performance.now() })
      flyTo({ ...nextView, instant: true })
    })
  }, [crossfade, flyTo, update])

  const actions = useMemo(() => {
    const selectEvent = (moment, { click = true } = {}) => {
      if (click) playClick()
      if (knownCount(moment) > knownCount(stateRef.current.eventId)) {
        playReveal()
        revealsRef.current += 1
      }
      const serial = ++serialRef.current
      const beat = BEATS[moment]
      showShot(moment, 0)
      beat.shots.forEach((shot, index) => {
        if (index > 0) later(shot.at * 1000, () => serial === serialRef.current && showShot(moment, index))
      })
      // Autoplay: when the beat has played, the next moment follows.
      if (Number.isFinite(beat.hold)) {
        later(beat.hold * 1000, () => {
          if (serial !== serialRef.current || !stateRef.current.playing) return
          selectEvent(MOMENTS[MOMENTS.indexOf(moment) + 1], { click: false })
        })
      }
    }
    return {
      selectEvent,
      openCase() {
        playClick()
        update({ intro: 'done' })
        selectEvent(MOMENTS[0], { click: false })
      },
      step(direction) {
        const index = MOMENTS.indexOf(stateRef.current.eventId) + direction
        if (index >= 0 && index < MOMENTS.length) selectEvent(MOMENTS[index])
      },
      togglePlay() {
        playClick()
        const playing = !stateRef.current.playing
        update({ playing })
        // Resuming at the end starts over; resuming elsewhere moves on to the next moment.
        if (playing) {
          const index = MOMENTS.indexOf(stateRef.current.eventId)
          selectEvent(MOMENTS[index === MOMENTS.length - 1 ? 0 : index + 1], { click: false })
        }
      },
      toggleSources() {
        update((previous) => ({ sources: !previous.sources }))
      },
    }
  }, [crossfade, showShot, update])

  useEffect(() => {
    if (map) window.appMapRoute = map.route
  }, [map])

  // Keys: arrows step the timeline, space plays or pauses, S shows the sources, Esc hides them.
  useEffect(() => {
    const onKey = (event) => {
      if (stateRef.current.intro !== 'done') return
      if (event.key === 'ArrowRight') actions.step(1)
      else if (event.key === 'ArrowLeft') actions.step(-1)
      else if (event.key === ' ') {
        event.preventDefault()
        actions.togglePlay()
      } else if (event.key === 's' || event.key === 'S') actions.toggleSources()
      else if (event.key === 'Escape') update({ sources: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions, update])

  useEffect(() => {
    window.app = { state: () => stateRef.current, reveals: () => revealsRef.current, moments: MOMENTS, actions }
  }, [actions])

  // The timeline and caption change size with the moment: labels re-read the free space.
  useEffect(() => invalidateReserved(), [state.eventId, state.shotIndex, state.intro, state.sources, portrait])

  const moment = state.eventId
  const event = momentById(moment)
  const shot = BEATS[moment].shots[state.shotIndex] ?? BEATS[moment].shots[0]

  return (
    <div className={`shell intro-${state.intro}${portrait ? ' portrait' : ''}`}>
      <World map={map} state={state} view={view} />
      <div id="label-layer" aria-hidden="true">
        <svg id="label-leaders" width="100%" height="100%" />
      </div>
      {state.intro === 'done' ? (
        <div className="hud">
          <Timeline state={state} actions={actions} />
          <Caption key={`${moment}-${state.shotIndex}`} text={shot.caption} confidence={event.confidence} />
          {state.sources ? <SourcesOverlay moment={moment} onClose={actions.toggleSources} /> : null}
        </div>
      ) : null}
      <IntroOverlay state={state} actions={actions} />
      <img ref={fadeRef} className="fade" alt="" />
    </div>
  )
}

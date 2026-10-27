import { useEffect, useRef, useState } from 'react'
import { SITES, entityPosition } from '../world.js'
import { activeWorld, model, select, switchSite, useModelVersion } from '../store.js'
import { flyTo } from '../cameraRig.js'
import { Icon, Logo } from './icons.jsx'

const SEARCH_LIMIT = 6

function searchEntities(world, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const entities = [...world.units, ...world.jobs, ...world.equipment, ...world.racks]
  return entities.filter((entity) => entity.name.toLowerCase().includes(needle) || entity.id.toLowerCase().includes(needle)).slice(0, SEARCH_LIMIT)
}

const KIND_ICON = { rack: 'rack', robot: 'robot', tech: 'person', job: 'spark', crah: 'fan', chiller: 'fan', substation: 'bolt', battery: 'battery' }

export function focusEntity(world, entity) {
  select(entity.id)
  flyTo(entityPosition(world, entity), entity.kind === 'job' || entity.kind === 'substation' || entity.kind === 'battery' ? 24 : 15)
}

function Search() {
  const world = activeWorld()
  const [query, setQuery] = useState('')
  const inputRef = useRef()
  const results = searchEntities(world, query)

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === '/' && document.activeElement !== inputRef.current) {
        event.preventDefault()
        inputRef.current.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const choose = (entity) => {
    focusEntity(world, entity)
    setQuery('')
    inputRef.current.blur()
  }

  return (
    <div className="search">
      <Icon name="search" size={16} />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && results[0]) choose(results[0])
          if (event.key === 'Escape') setQuery('')
        }}
        placeholder="Search racks, carts, jobs, cooling units…"
        aria-label="Search the hall"
      />
      <kbd>/</kbd>
      {results.length > 0 && (
        <ul className="search-results" role="listbox">
          {results.map((entity) => (
            <li key={entity.id}>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(entity)}>
                <Icon name={KIND_ICON[entity.kind]} size={15} />
                <span>{entity.name}</span>
                <small>{entity.id}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function siteSummary(site) {
  return `${site.purpose} · ${site.rows * site.racksPerRow} racks · ${site.chillers} chillers`
}

function SiteSwitcher() {
  const [open, setOpen] = useState(false)
  const site = SITES.find((candidate) => candidate.id === model.siteId)
  return (
    <div className="site-switcher">
      <button type="button" className="site-current" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="site-switcher">
        <span className="site-code">{site.code}</span>
        <span className="site-text">
          <strong>{site.name}</strong>
          <small>{siteSummary(site)}</small>
        </span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <ul className="site-menu">
          {SITES.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                className={candidate.id === site.id ? 'is-current' : ''}
                data-site={candidate.id}
                onClick={() => {
                  setOpen(false)
                  if (candidate.id !== site.id) switchSite(candidate.id)
                }}
              >
                <span className="site-code">{candidate.code}</span>
                <span className="site-text">
                  <strong>{candidate.name}</strong>
                  <small>{siteSummary(candidate)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LiveClock() {
  const time = new Date(Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <div className="live">
      <span className="live-dot" />
      <span>Live</span>
      <strong>{time}</strong>
    </div>
  )
}

export function TopBar() {
  useModelVersion()
  const world = activeWorld()
  const openAlerts = world.alerts.filter((alert) => !alert.resolved).length
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <span>Kelvin</span>
      </div>
      <Search />
      <div className="topbar-right">
        <SiteSwitcher />
        <LiveClock />
        <button type="button" className="icon-button bell" aria-label={`${openAlerts} open alerts`}>
          <Icon name="bell" size={18} />
          {openAlerts > 0 && <span className="badge">{openAlerts}</span>}
        </button>
        <div className="user">
          <span className="avatar"><Icon name="person" size={16} /></span>
          <span className="user-text">
            <strong>Floor lead</strong>
            <small>Larkspur campus, night shift</small>
          </span>
        </div>
      </div>
    </header>
  )
}

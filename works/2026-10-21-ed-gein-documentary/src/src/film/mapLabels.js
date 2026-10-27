// The words on the map, kept apart from the geometry so the script can time every shot to how long its labels
// take to read. Places come from section 1 of the fact file; Waupun and Madison have no distance there, so their
// arrows carry no number.
export const PLACE_LABELS = {
  store: { name: 'WORDEN HARDWARE', sub: 'PLAINFIELD' },
  farm: { name: 'GEIN FARM' },
  westPlainfield: { name: 'WEST PLAINFIELD' },
  pineGrove: { name: 'TOWN OF PINE GROVE', sub: 'TAVERN LOT UNKNOWN' },
  wautoma: { name: 'WAUTOMA', sub: 'COURTHOUSE' },
}

export const NAME_LABELS = {
  plainfield: { name: 'PLAINFIELD' },
  laCrosse: { name: 'LA CROSSE COUNTY', sub: 'WEST, OFF THIS MAP' },
}

export const LINE_LABELS = {
  farmPineGrove: { name: '7.6 MI TO TOWN CENTRE' },
  storeFarm: { name: 'ABOUT 5 MI' },
  storeWautoma: { name: '13.9 MI' },
  toWaupun: { name: 'WAUPUN', sub: 'OFF THIS MAP' },
  toMadison: { name: 'MADISON', sub: 'OFF THIS MAP' },
}

export const labelCharacters = (label) => label.name.length + (label.sub ? label.sub.length : 0)

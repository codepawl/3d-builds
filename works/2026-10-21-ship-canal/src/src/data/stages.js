// The stages of one uphill transit on lane A at the Gantry Locks, and the camera preset framed on each.
// World axes: x across the canal (lane A is x = -25.75, cut open on its west face), y up, z = -s along the flight.
// Cameras use the rig's orbit form: a target point, a yaw (negative = looking from the west), a pitch and a distance in metres.
// `segment` names which part of the hero ship's schedule (lane A, ship 0) the stage shows; `event` is the moment that counts
// as the stage's key event for the tour.

export const STAGE_SITE = 'flight'
export const STAGE_LANE = 'A'
export const STAGE_SHIP = 0
export const STAGE_FLY_SECONDS = 1.0

export const STAGES = [
  {
    key: '1', id: 'approach', label: 'Approach', detail: 'Ship waits at the approach',
    camera: { target: [-26, 4, 250], yaw: -1.2, pitch: 0.3, distance: 620 },
  },
  {
    key: '2', id: 'tow-in', label: 'Tow in', detail: 'Mules attach and tow the ship into chamber 1',
    camera: { target: [-26, 4, 40], yaw: -1.2, pitch: 0.3, distance: 600 },
  },
  {
    key: '3', id: 'gates-close', label: 'Gates close', detail: 'Gates close behind the ship',
    camera: { target: [-26, 6, -10], yaw: -0.95, pitch: 0.38, distance: 230 },
  },
  {
    key: '4', id: 'fill', label: 'Fill', detail: 'Culvert valves open, the water and the ship rise',
    camera: { target: [-26, 4, -158], yaw: -1.4, pitch: 0.28, distance: 430 },
  },
  {
    key: '5', id: 'gates-open', label: 'Gates open', detail: 'Gates open at the top of chamber 1',
    camera: { target: [-30, 7, -300], yaw: -1.0, pitch: 0.38, distance: 260 },
  },
  {
    key: '6', id: 'next-chamber', label: 'Chamber 2', detail: 'The ship moves up into chamber 2',
    camera: { target: [-26, 9, -330], yaw: -1.25, pitch: 0.32, distance: 540 },
  },
  {
    key: '7', id: 'exit', label: 'Exit', detail: 'The ship leaves chamber 3 for Lake Orrin',
    camera: { target: [-26, 22, -985], yaw: -1.2, pitch: 0.3, distance: 640 },
  },
]

// Lane-A times (seconds of lane time) for each stage: `showAt` is a moment when the stage is in full swing,
// `eventAt` is when its key event has happened. Read from the computed schedule, so they follow the lane.
export function stageTimes(lane) {
  const ship = lane.ships[STAGE_SHIP]
  const [towIn, closeFirst, fillFirst, holdFirst, moveSecond, , , , , , , , leaving] = ship.segments
  const middle = (segment) => (segment.t0 + segment.t1) / 2
  return [
    { showAt: ship.startMove - 6, eventAt: ship.startMove },
    { showAt: towIn.t0 + (towIn.t1 - towIn.t0) * 0.6, eventAt: towIn.t1 },
    { showAt: middle(closeFirst), eventAt: closeFirst.t1 },
    { showAt: middle(fillFirst), eventAt: fillFirst.t1 },
    { showAt: holdFirst.t0 + (holdFirst.t1 - holdFirst.t0) * 0.55, eventAt: holdFirst.t1 },
    { showAt: middle(moveSecond), eventAt: moveSecond.t1 },
    { showAt: middle(leaving), eventAt: leaving.t1 },
  ]
}

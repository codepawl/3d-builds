import { LANE_OFFSET } from './network.js'
// Stage camera presets for the metro process, in process order. One data file: the stage bar, the tour, the checks and the film read it.
//
// Targets are in station-local metres: u along the line, v to the left of travel (north on the Harbour line), y above the rail head.
// yawOffset is added to the station's own yaw, so 0 looks from the open (south) side of the dollhouse cut; pitch and distance
// are the camera's, in radians and metres from the target.
//
// `event` is what the tour waits for once: the simulation log entry (kind, and station) that shows this stage happening.
export const STAGES = [
  {
    key: 'gates', short: 'Fare gates', number: 1, label: 'Fare gates', siteId: 'harbour', stationId: 'H2',
    caption: 'Passengers tap through the gateline on the mezzanine',
    target: { u: -14, y: 7.0, v: 2.0 }, yawOffset: 0.25, pitch: 0.6, distance: 30,
    event: { kind: 'gate', stationId: 'H2' },
  },
  {
    key: 'escalator', short: 'Escalator', number: 2, label: 'Escalator down', siteId: 'harbour', stationId: 'H2',
    caption: 'The escalator carries them down from the street entrance',
    target: { u: -14, y: 9.0, v: 9 }, yawOffset: -0.95, pitch: 0.5, distance: 46,
    event: { kind: 'escalator', stationId: 'H2' },
  },
  {
    key: 'doors-open', short: 'Doors open', number: 3, label: 'Train arrives, doors open', siteId: 'harbour', stationId: 'H2',
    caption: 'The train stops on its mark and the screen doors open with the train doors',
    target: { u: -48, y: 2.2, v: LANE_OFFSET }, yawOffset: 0.5, pitch: 0.13, distance: 17, lowCamera: true,
    event: { kind: 'doorsOpen', stationId: 'H2', dir: -1 },
  },
  {
    key: 'boarding', short: 'Boarding', number: 4, label: 'Boarding, doors close', siteId: 'harbour', stationId: 'H2',
    caption: 'Passengers board, then train and screen doors close',
    target: { u: -48, y: 2.2, v: LANE_OFFSET }, yawOffset: 0.5, pitch: 0.13, distance: 17, lowCamera: true,
    event: { kind: 'doorsClosed', stationId: 'H2', dir: -1 },
  },
  {
    key: 'departs', short: 'Departs', number: 5, label: 'Departs into the tunnel', siteId: 'harbour', stationId: 'H2',
    caption: 'The train pulls out and enters the twin-bore tunnel',
    target: { u: -125, y: 2.4, v: LANE_OFFSET }, yawOffset: 0.0, pitch: 0.45, distance: 62,
    event: { kind: 'depart', stationId: 'H2', dir: -1 },
  },
  {
    key: 'turnback', short: 'Turnback', number: 6, label: 'Turnback at Eastgate', siteId: 'harbour', stationId: 'H5',
    caption: 'At the terminus the train changes ends and crosses to the other road',
    target: { u: 130, y: 2.6, v: 0 }, yawOffset: 0.0, pitch: 0.55, distance: 70,
    event: { kind: 'turnback', stationId: 'H5' },
  },
]

export const stageByKey = Object.fromEntries(STAGES.map((stage) => [stage.key, stage]))

// World position and yaw of a stage target, given the built site's station frames.
export function stageCameraGoal(stage, stationFrames) {
  const frame = stationFrames[stage.stationId]
  if (!frame) return null
  const cosine = Math.cos(frame.yaw)
  const sine = Math.sin(frame.yaw)
  const localZ = -stage.target.v
  return {
    target: [
      frame.x + stage.target.u * cosine + localZ * sine,
      frame.y + stage.target.y,
      frame.z - stage.target.u * sine + localZ * cosine,
    ],
    yaw: frame.yaw + stage.yawOffset,
    pitch: stage.pitch,
    distance: stage.distance,
  }
}

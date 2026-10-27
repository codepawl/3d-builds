// The six lessons: parts and wires with the step each one appears in, camera shots, copy, code, and the
// small simulation that says what the board is doing right now. Hole names are (column, row).
import { BB, colX, place, ROW_Z, UNO } from './layout.js'
import { live } from './live.js'

const SIGNAL = '#ff8a1f'
const SIGNAL_2 = '#f4c20d'
const SIGNAL_3 = '#2fbf71'
const POWER = '#e0343f'
const GROUND = '#3b4048'
const ANALOG = '#8b5cf6'

const hole = (col, row, lift = 0.12) => ({ at: place([col, row], lift) })
const ledTop = (col, row) => ({ at: [(colX(col) + colX(col + 1)) / 2, BB.h + 0.75, BB.z + ROW_Z[row]] })
const gndRail = (col) => ({ railNear: ['botMinus', colX(col)] })
// A jumper from a column in row a down to the ground rail.
const returnWire = (id, col, step) => ({ id, from: [col, 'a'], to: gndRail(col), colour: GROUND, arc: 0.55, step })
const groundWire = (step) => ({ id: 'gnd', from: { uno: 'GND' }, to: { railNear: ['botMinus', -1.0] }, colour: GROUND, step })

const triangle = (value, low, high) => {
  const span = high - low
  const wrapped = ((value % (2 * span)) + 2 * span) % (2 * span)
  return low + (wrapped < span ? wrapped : 2 * span - wrapped)
}

function cycleLine(t, rate, lines) {
  return lines[Math.floor(t * rate) % lines.length]
}

const CAM = {
  overview: { t: [0.5, 0.3, 3.4], d: 28, az: 0, el: 54 },
  unoLarge: { t: [0.1, 0.3, 6.7], d: 16.5, az: -3, el: 56 },
  board: { t: [0.0, 0.4, 1.7], d: 20, az: 0, el: 55 },
  boardLeft: { t: [-1.3, 0.4, 2.2], d: 17, az: 5, el: 52 },
  boardRight: { t: [1.8, 0.5, 2.2], d: 17, az: -4, el: 52 },
  close: { t: [0.1, 0.8, 1.0], d: 11.5, az: 4, el: 50 },
  closeRight: { t: [2.5, 0.9, 1.1], d: 12.5, az: -6, el: 48 },
  servo: { t: [4.5, 0.8, 1.7], d: 22.5, az: -3, el: 52 },
  wide: { t: [0.9, 0.4, 3.2], d: 24, az: 0, el: 54 },
  bench: { t: [-3.3, 0.3, 1.3], d: 17, az: 5, el: 54 },
}

// ---------- 1. Blink ----------
const blink = {
  id: 'blink',
  title: 'Blink',
  short: 'Make an LED flash',
  control: { type: 'slider', key: 'delayMs', label: 'delay()', unit: ' ms', min: 100, max: 1000, step: 50, icon: 'clock' },
  parts: [
    { id: 'bb', type: 'breadboard', step: 1 },
    { id: 'r1', type: 'resistor', ohms: 220, a: [12, 'c'], b: [16, 'c'], step: 2 },
    { id: 'led1', type: 'led', color: 'red', anode: [16, 'e'], cathode: [17, 'e'], drive: 'pin13', needs: ['bb', 'gnd', 'r1', 'sig', 'ret'], step: 2 },
  ],
  wires: [
    groundWire(1),
    { id: 'sig', from: { uno: '13' }, to: [12, 'a'], colour: SIGNAL, step: 3 },
    returnWire('ret', 17, 3),
  ],
  flows: [
    {
      drive: 'pin13',
      needs: ['bb', 'gnd', 'r1', 'sig', 'ret', 'led1'],
      items: [{ wire: 'sig' }, hole(12, 'c', 0.34), hole(16, 'c', 0.34), hole(16, 'e', 0.3), ledTop(16, 'e'), hole(17, 'e', 0.3), hole(17, 'a', 0.12), { wire: 'ret' }, { wire: 'gnd', rev: true }],
    },
  ],
  steps: [
    {
      title: 'The LED already on the board',
      body: 'Pin 13 is wired to a small LED marked L. Send the pin HIGH and 5 V comes out, the LED lights. LOW, and it goes dark.',
      watch: 'The L light on the board follows the code line highlighted on the right.',
      cam: CAM.unoLarge,
      labels: [{ text: 'Pin 13', ref: { uno: '13' }, lift: 0.25 }, { text: 'L (built-in LED)', ref: { at: [(32.5 - 34.29) / 10 + UNO.x, 0.3, UNO.z + (26.67 - 37.0) / 10] }, dx: -120, dy: 6 }],
    },
    {
      title: 'Add a breadboard',
      body: 'The holes in each short column of five are joined underneath. The long rails on the edge run the whole length: the blue − rail will be ground.',
      watch: 'A jumper runs from the Uno GND pin to the − rail.',
      cam: CAM.bench,
      labels: [{ text: 'GND rail −', ref: { rail: 'botMinus', i: 22 }, lift: 0.1 }, { text: 'GND', ref: { uno: 'GND' }, lift: 0.25 }],
    },
    {
      title: 'A resistor, then the LED',
      body: 'An LED has no brakes. The 220 Ω resistor keeps the current near 14 mA. The longer LED leg (anode, +) goes toward the resistor.',
      watch: 'Both legs of each part land in different columns, so the current has to flow through them.',
      cam: CAM.bench,
      labels: [{ text: '220 Ω (red red brown)', ref: hole(14, 'c', 0.7).at, lift: 0.1 }, { text: 'anode +', ref: [16, 'e'], lift: 1.35 }],
    },
    {
      title: 'Close the circuit',
      body: 'Pin 13 feeds the resistor, the LED passes the current on, and the second jumper returns it to ground. When pin 13 is HIGH the current flows.',
      watch: 'Switch on Show current: red dots run from the pin to the LED, blue dots return to GND, only while the pin is HIGH.',
      cam: CAM.board,
      labels: [{ text: 'D13', ref: { uno: '13' }, lift: 0.25 }, { text: 'back to GND', ref: [17, 'a'], lift: 1.9 }],
    },
  ],
  code: (c) => [
    'void setup() {',
    '  pinMode(13, OUTPUT);',
    '}',
    '',
    'void loop() {',
    '  digitalWrite(13, HIGH);',
    `  delay(${c.delayMs});`,
    '  digitalWrite(13, LOW);',
    `  delay(${c.delayMs});`,
    '}',
  ],
  sim(t, dt, c) {
    const half = c.delayMs / 1000
    const phase = t % (2 * half)
    const high = phase < half
    live.drive.pin13 = high ? 1 : 0
    live.drive.onboardL = high ? 1 : 0
    const into = high ? phase : phase - half
    const writing = into < Math.min(0.09, half * 0.25)
    let line
    if (t < 0.15) line = 1
    else if (high) line = writing ? 5 : 6
    else line = writing ? 7 : 8
    return { line, t, high, level: high ? 'HIGH' : 'LOW', current: high ? 13.6 : 0, half }
  },
}

// ---------- 2. Button ----------
const buttonCircuit = [
  { id: 'bb', type: 'breadboard', step: 0 },
  { id: 'r1', type: 'resistor', ohms: 220, a: [12, 'c'], b: [16, 'c'], step: 0 },
  { id: 'led1', type: 'led', color: 'red', anode: [16, 'e'], cathode: [17, 'e'], drive: 'pin13', needs: ['bb', 'gnd', 'r1', 'sig', 'ret'], step: 0 },
]
const button = {
  id: 'button',
  title: 'Button',
  short: 'Read a push button',
  control: { type: 'press', key: 'debounce', label: 'Hold the button', toggleLabel: 'Debounce' },
  parts: [
    ...buttonCircuit,
    { id: 'btn', type: 'button', cols: [24, 26], step: 1 },
    { id: 'r2', type: 'resistor', ohms: 10000, a: [24, 'c'], b: [28, 'c'], step: 2 },
  ],
  wires: [
    groundWire(0),
    { id: 'sig', from: { uno: '13' }, to: [12, 'a'], colour: SIGNAL, step: 0 },
    returnWire('ret', 17, 0),
    { id: 'v5', from: { uno: '5V' }, to: { railNear: ['topPlus', 2.6] }, colour: POWER, step: 2, via: [[0.13, 2.45, 8.55], [1.8, 2.6, 8.3], [4.2, 2.5, 7.3], [4.75, 2.4, 4.4], [4.7, 2.3, 0.4], [4.5, 2.4, -1.9]] },
    { id: 'v5b', from: { railNear: ['topPlus', 2.66] }, to: [26, 'j'], colour: POWER, step: 2, arc: 0.7 },
    { id: 'pin2', from: { uno: '2' }, to: [24, 'a'], colour: SIGNAL_2, step: 2 },
    returnWire('pull', 28, 2),
  ],
  flows: [
    {
      drive: 'pin13',
      needs: ['bb', 'gnd', 'r1', 'sig', 'ret', 'led1'],
      items: [{ wire: 'sig' }, hole(12, 'c', 0.34), hole(16, 'c', 0.34), hole(16, 'e', 0.3), ledTop(16, 'e'), hole(17, 'e', 0.3), hole(17, 'a', 0.12), { wire: 'ret' }, { wire: 'gnd', rev: true }],
    },
    {
      drive: 'pin13',
      needs: ['btn', 'v5', 'v5b', 'pin2'],
      items: [{ wire: 'v5' }, { wire: 'v5b' }, hole(26, 'f', 0.3), hole(26, 'e', 0.3), hole(24, 'e', 0.3), hole(24, 'a', 0.12), { wire: 'pin2', rev: true }],
    },
  ],
  steps: [
    {
      title: 'Reuse the LED circuit',
      body: 'The LED and its 220 Ω resistor from lesson 1 are back, still on pin 13. This time the button will decide when it lights.',
      watch: 'Pin 13 is an output. A new pin will be an input.',
      cam: CAM.board,
      labels: [{ text: 'LED on D13', ref: ledTop(16, 'e').at }],
    },
    {
      title: 'Straddle the middle gap',
      body: 'A push button has four legs. The two on one side are always joined; pressing joins the two sides. Setting it across the centre gap keeps the sides apart.',
      watch: 'Press the red cap on the board with the mouse and hold it.',
      cam: CAM.closeRight,
      labels: [{ text: 'push button', ref: { at: [colX(25), BB.h + 0.9, 0.0] } }],
    },
    {
      title: 'Pull-down wiring',
      body: '5 V goes to one side. The other side goes to pin 2 and, through a 10 kΩ resistor, to ground. Not pressed: the resistor pulls pin 2 to 0 V. Pressed: 5 V wins.',
      watch: 'Switch on Show current to see 5 V reach pin 2 only while you hold the button.',
      cam: CAM.boardRight,
      labels: [{ text: '5 V', ref: { railNear: ['topPlus', 2.6] }, lift: 1.9 }, { text: 'D2', ref: { uno: '2' }, lift: 0.25 }, { text: '10 kΩ pull-down', ref: hole(27, 'c', 0.3).at, dx: 105, dy: 62 }],
    },
    {
      title: 'Why a press can count twice',
      body: 'Metal contacts bounce for a few milliseconds. The raw signal chatters; waiting for it to hold still for 20 ms gives one clean press.',
      watch: 'Press, then switch Debounce on and compare the counts under the scope.',
      cam: CAM.boardRight,
      labels: [],
    },
  ],
  code: (c, r, step) => (step >= 3 && c.debounce
    ? ['int lastRaw = LOW, stable = LOW;', 'unsigned long lastChange = 0;', 'void loop() {', '  int raw = digitalRead(2);', '  if (raw != lastRaw) lastChange = millis();', '  if (millis() - lastChange > 20)', '    stable = raw;', '  lastRaw = raw;', '  digitalWrite(13, stable);', '}']
    : ['const int buttonPin = 2;', 'const int ledPin = 13;', 'void setup() {', '  pinMode(buttonPin, INPUT);', '  pinMode(ledPin, OUTPUT);', '}', 'void loop() {', '  int pressed = digitalRead(buttonPin);', '  digitalWrite(ledPin, pressed);', '}']),
  sim(t, dt, c, m, step) {
    const pressed = live.pressed
    live.drive.pin13 = pressed ? 1 : 0
    live.drive.onboardL = pressed ? 1 : 0
    if (m.simT === undefined) {
      Object.assign(m, { simT: 0, raw: false, deb: false, lastChange: 0, rawLevel: false, bounce: null, last: false, nextSample: 0, rawBuf: [], debBuf: [], rawCount: 0, debCount: 0, seed: 7 })
    }
    if (pressed !== m.last) {
      // A bounce train: the contact flips five or seven times in a few milliseconds before it settles.
      const flips = m.seed % 2 ? 5 : 7
      const durations = []
      for (let index = 0; index < flips - 1; index += 1) {
        m.seed = (m.seed * 1103515245 + 12345) & 0x7fffffff
        durations.push(0.0005 + (m.seed % 1000) / 1000 * 0.0011)
      }
      m.bounce = { start: m.simT, durations, finalState: pressed }
      m.last = pressed
    }
    const slow = 0.02 // scope time runs 50 times slower than real time so the chatter can be seen
    const target = m.simT + dt * slow
    while (m.nextSample < target) {
      m.nextSample += 0.0001
      let level = false
      if (m.bounce) {
        let elapsed = m.nextSample - m.bounce.start
        if (elapsed < 0) level = !m.bounce.finalState
        else {
          let index = 0
          while (index < m.bounce.durations.length && elapsed >= m.bounce.durations[index]) {
            elapsed -= m.bounce.durations[index]
            index += 1
          }
          level = index % 2 === 0 ? m.bounce.finalState : !m.bounce.finalState
        }
      }
      if (level !== m.rawLevel) {
        if (level) m.rawCount += 1
        m.lastChange = m.nextSample
        m.rawLevel = level
      }
      if (m.nextSample - m.lastChange >= 0.02 && m.deb !== m.rawLevel) {
        m.deb = m.rawLevel
        if (m.deb) m.debCount += 1
      }
      m.rawBuf.push(level ? 1 : 0)
      m.debBuf.push(m.deb ? 1 : 0)
      if (m.rawBuf.length > 400) {
        m.rawBuf.shift()
        m.debBuf.shift()
      }
    }
    m.simT = target
    const line = cycleLine(t, 5, step >= 3 && c.debounce ? [3, 4, 5, 8] : [7, 8])
    return { line, pressed, raw: m.rawBuf.slice(), deb: m.debBuf.slice(), rawCount: m.rawCount, debCount: m.debCount, level: pressed ? 'HIGH' : 'LOW' }
  },
}

// ---------- 3. Fade ----------
const ledPwmCircuit = [
  { id: 'bb', type: 'breadboard', step: 0 },
  { id: 'r1', type: 'resistor', ohms: 220, a: [10, 'c'], b: [14, 'c'], step: 1 },
  { id: 'led1', type: 'led', color: 'red', anode: [14, 'e'], cathode: [15, 'e'], drive: 'pwm9', needs: ['bb', 'gnd', 'r1', 'sig', 'ret'], step: 1 },
]
const pwmFlow = {
  drive: 'pwm9',
  needs: ['bb', 'gnd', 'r1', 'sig', 'ret', 'led1'],
  items: [{ wire: 'sig' }, hole(10, 'c', 0.34), hole(14, 'c', 0.34), hole(14, 'e', 0.3), ledTop(14, 'e'), hole(15, 'e', 0.3), hole(15, 'a', 0.12), { wire: 'ret' }, { wire: 'gnd', rev: true }],
}
const fade = {
  id: 'fade',
  title: 'Fade',
  short: 'Dim with PWM',
  control: { type: 'slider', key: 'pwm', label: 'analogWrite(9, …)', unit: '', min: 0, max: 255, step: 1, icon: 'wave' },
  parts: ledPwmCircuit,
  wires: [groundWire(0), { id: 'sig', from: { uno: '9' }, to: [10, 'a'], colour: SIGNAL, step: 2 }, returnWire('ret', 15, 2)],
  flows: [pwmFlow],
  steps: [
    {
      title: 'Pins marked with a tilde',
      body: 'Pin 9 is one of six PWM pins (3, 5, 6, 9, 10, 11), marked ~ on the board. It cannot output half a volt, but it can switch 5 V on and off about 490 times a second.',
      watch: 'Find the ~9 label on the board header.',
      cam: CAM.unoLarge,
      labels: [{ text: '~9 (PWM)', ref: { uno: '9' }, lift: 0.25 }],
    },
    {
      title: 'The same LED and resistor',
      body: 'Same parts as before, a 220 Ω resistor in line with the LED, now moved over to be fed by pin 9.',
      watch: 'The ground jumper is already in place.',
      cam: CAM.boardLeft,
      labels: [{ text: '220 Ω', ref: hole(12, 'c', 0.7).at }],
    },
    {
      title: 'Wire it to pin 9',
      body: 'Pin 9 goes to the resistor, the LED returns to ground. Now the slider decides the share of each cycle that the pin spends HIGH.',
      watch: 'Drag the slider: the square wave gets wider and the LED brighter.',
      cam: CAM.board,
      labels: [{ text: 'D9', ref: { uno: '9' }, lift: 0.25 }],
    },
    {
      title: 'Let it breathe',
      body: 'A loop adds 5 to the brightness every 30 ms, and turns around at 0 and 255. Your eye averages the flicker into a smooth glow.',
      watch: 'The slider now moves by itself. Grab it to take over.',
      cam: CAM.board,
      set: { auto: true },
      labels: [],
    },
  ],
  code: (c, r, step) => (step >= 3 && c.auto
    ? ['int brightness = 0;', 'int fadeAmount = 5;', 'void loop() {', `  analogWrite(9, brightness);   // ${r.value}`, '  brightness = brightness + fadeAmount;', '  if (brightness <= 0 || brightness >= 255)', '    fadeAmount = -fadeAmount;', '  delay(30);', '}']
    : ['const int ledPin = 9;', 'void setup() {', '  pinMode(ledPin, OUTPUT);', '}', 'void loop() {', `  analogWrite(ledPin, ${r.value ?? c.pwm});`, '}']),
  sim(t, dt, c, m, step) {
    const auto = step >= 3 && c.auto
    if (m.brightness === undefined) Object.assign(m, { brightness: 0, amount: 5, clock: 0 })
    let value = c.pwm
    if (auto) {
      m.clock += dt
      while (m.clock >= 0.03) {
        m.clock -= 0.03
        m.brightness = Math.max(0, Math.min(255, m.brightness + m.amount))
        if (m.brightness <= 0 || m.brightness >= 255) m.amount = -m.amount
      }
      value = m.brightness
    }
    live.drive.pwm9 = value / 255
    const line = auto ? cycleLine(t, 9, [3, 4, 5, 7]) : 5
    return { line, value, duty: value / 255, average: 5 * value / 255 }
  },
}

// ---------- 4. Potentiometer ----------
const pot = {
  id: 'pot',
  title: 'Potentiometer',
  short: 'Read a knob',
  control: { type: 'slider', key: 'pot', label: 'Knob angle', unit: '°', min: 0, max: 270, step: 1, icon: 'knob' },
  parts: [
    { id: 'bb', type: 'breadboard', step: 0 },
    { id: 'pot', type: 'pot', col: 24, step: 0 },
    { id: 'r1', type: 'resistor', ohms: 220, a: [10, 'c'], b: [14, 'c'], step: 3 },
    { id: 'led1', type: 'led', color: 'red', anode: [14, 'e'], cathode: [15, 'e'], drive: 'pwm9', needs: ['bb', 'gnd', 'r1', 'sig', 'ret'], step: 3 },
  ],
  wires: [
    groundWire(0),
    { id: 'potg', from: [22, 'a'], to: gndRail(22), colour: GROUND, arc: 0.55, step: 1 },
    { id: 'v5', from: { uno: '5V' }, to: { railNear: ['botPlus', 3.2] }, colour: POWER, step: 1, via: [[0.13, 2.45, 8.55], [1.8, 2.6, 8.3], [4.2, 2.5, 7.3], [4.75, 2.4, 4.4], [4.6, 2.3, 2.9]] },
    { id: 'v5b', from: { railNear: ['botPlus', 3.2] }, to: [26, 'a'], colour: POWER, arc: 0.5, step: 1 },
    { id: 'a0', from: { uno: 'A0' }, to: [24, 'a'], colour: ANALOG, step: 2, via: [[1.4, 2.6, 8.4], [3.0, 3.1, 8.0], [5.05, 3.0, 6.5], [5.1, 2.9, 3.5], [3.9, 3.1, 1.8], [2.6, 2.8, 1.5]] },
    { id: 'sig', from: { uno: '9' }, to: [10, 'a'], colour: SIGNAL, step: 3 },
    returnWire('ret', 15, 3),
  ],
  flows: [
    { drive: 'pwm9', needs: ['bb', 'gnd', 'r1', 'sig', 'ret', 'led1'], items: pwmFlow.items },
  ],
  steps: [
    {
      title: 'A knob with three legs',
      body: 'A potentiometer is a resistor track with a sliding contact (the wiper). Outer legs are the ends of the track, the middle leg is the wiper. This one is 10 kΩ end to end.',
      watch: 'Drag the black knob left and right, or use the slider.',
      cam: CAM.closeRight,
      labels: [{ text: '10 kΩ pot', ref: { at: [colX(24), 2.5, 0.0] } }],
    },
    {
      title: 'Ends to 5 V and ground',
      body: 'With 5 V on one end and ground on the other, the track divides the voltage. The wiper can pick off anything between 0 V and 5 V.',
      watch: 'The red jumper takes 5 V all the way round the side of the board.',
      cam: CAM.boardRight,
      labels: [{ text: '5 V', ref: { uno: '5V' }, lift: 0.25 }, { text: 'GND', ref: [22, 'a'], lift: 1.9 }],
    },
    {
      title: 'Wiper to A0',
      body: 'Analog pin A0 turns the wiper voltage into a number from 0 (0 V) to 1023 (5 V), using a 10-bit converter.',
      watch: 'The voltage and the reading on the gauge follow the knob.',
      cam: CAM.boardRight,
      labels: [{ text: 'A0', ref: { uno: 'A0' }, lift: 0.25 }],
    },
    {
      title: 'Map it to a brightness',
      body: 'map() squeezes 0 to 1023 into 0 to 255, which analogWrite sends to the LED on pin 9. Turn the knob and the LED fades with it.',
      watch: 'Reading, brightness and duty all move together.',
      cam: CAM.board,
      labels: [{ text: 'D9', ref: { uno: '9' }, lift: 0.25 }],
    },
  ],
  code: (c, r) => [
    'void loop() {',
    `  int reading = analogRead(A0);   // ${r.reading}`,
    '  int level = map(reading, 0, 1023, 0, 255);',
    `  analogWrite(9, level);          // ${r.brightness}`,
    '}',
  ],
  sim(t, dt, c, m, step) {
    const angle = c.pot
    live.potAngle = angle
    const reading = Math.round(angle / 270 * 1023)
    const brightness = Math.floor(reading * 255 / 1023)
    live.drive.pwm9 = step >= 3 ? brightness / 255 : 0
    return { line: cycleLine(t, 5, [1, 2, 3]), reading, volts: reading / 1023 * 5, brightness, value: brightness, duty: brightness / 255 }
  },
}

// ---------- 5. Servo ----------
const servoPlug = [25, 26, 27]
const servo = {
  id: 'servo',
  title: 'Servo',
  short: 'Turn a horn to an angle',
  control: { type: 'slider', key: 'angle', label: 'myServo.write(…)', unit: '°', min: 0, max: 180, step: 1, icon: 'servo' },
  parts: [
    { id: 'bb', type: 'breadboard', step: 0 },
    { id: 'servo', type: 'servo', at: [7.1, 0, 0.9], plugCols: servoPlug, row: 'e', step: 0 },
  ],
  wires: [
    groundWire(0),
    { id: 'sg', from: gndRail(25), to: [25, 'a'], colour: GROUND, arc: 0.5, step: 2 },
    { id: 'v5', from: { uno: '5V' }, to: { railNear: ['botPlus', 3.3] }, colour: POWER, step: 2, via: [[0.13, 2.45, 8.55], [1.8, 2.6, 8.3], [4.2, 2.5, 7.3], [4.75, 2.4, 4.4], [4.6, 2.3, 2.9]] },
    { id: 'v5b', from: { railNear: ['botPlus', 3.3] }, to: [26, 'a'], colour: POWER, arc: 0.5, step: 2 },
    { id: 'sig', from: { uno: '9' }, to: [27, 'a'], colour: SIGNAL, step: 2 },
  ],
  flows: [],
  steps: [
    {
      title: 'Meet the SG90',
      body: 'A hobby servo packs a small motor, gears and a position sensor. It turns its horn to the angle the signal asks for, about 180° of travel in total.',
      watch: 'Three wires: brown ground, red 5 V, orange signal.',
      cam: CAM.servo,
      labels: [],
    },
    {
      title: 'Plug it in',
      body: 'Its plug fits three header pins in a row. Brown to the ground column, red to the middle, orange to the signal column.',
      watch: 'The cable lifts over the edge of the breadboard.',
      cam: CAM.closeRight,
      labels: [{ text: 'brown GND', ref: [25, 'e'], lift: 1.9 }, { text: 'red 5 V', ref: [26, 'e'], lift: 2.45 }, { text: 'orange signal', ref: [27, 'e'], lift: 1.9 }],
    },
    {
      title: 'Power and signal',
      body: 'Ground and 5 V come from the rails, the signal from pin 9. The servo asks for a pulse every 20 ms: 1 ms means one end, 2 ms the other.',
      watch: 'Move the slider: the horn turns and the pulse on the scope gets wider.',
      cam: CAM.servo,
      labels: [{ text: 'D9 signal', ref: { uno: '9' }, lift: 0.25 }],
    },
    {
      title: 'Sweep',
      body: 'A for loop steps the angle up by one degree every 10 ms, then back down.',
      watch: 'The horn sweeps by itself. Grab the slider to take over.',
      cam: CAM.servo,
      set: { auto: true },
      labels: [],
    },
  ],
  code: (c, r, step) => (step >= 3 && c.auto
    ? ['#include <Servo.h>', 'Servo myServo;', 'void setup() { myServo.attach(9); }', 'void loop() {', '  for (int a = 0; a <= 180; a++) {', `    myServo.write(a);   // ${r.angle}`, '    delay(10);', '  }', '  // ...and back down to 0', '}']
    : ['#include <Servo.h>', 'Servo myServo;', 'void setup() {', '  myServo.attach(9);', '}', 'void loop() {', `  myServo.write(${r.angle ?? 90});`, '  delay(15);', '}']),
  sim(t, dt, c, m, step) {
    const auto = step >= 3 && c.auto
    let angle = c.angle
    if (auto) {
      if (m.sweep === undefined) m.sweep = 0
      m.sweep += dt * 100
      angle = Math.round(triangle(m.sweep, 0, 180))
    }
    live.servoAngle = angle
    const pulse = 1 + angle / 180
    return { line: auto ? cycleLine(t, 8, [5, 6]) : cycleLine(t, 4, [6, 7]), angle, pulse }
  },
}

// ---------- 6. Traffic light ----------
const trafficLeds = [
  { id: 'rr', type: 'resistor', ohms: 220, a: [6, 'c'], b: [10, 'c'], step: 0 },
  { id: 'red', type: 'led', color: 'red', anode: [10, 'e'], cathode: [11, 'e'], drive: 'red', needs: ['bb', 'gnd', 'rr', 'sigR', 'retR'], step: 0 },
  { id: 'ry', type: 'resistor', ohms: 220, a: [12, 'c'], b: [16, 'c'], step: 1 },
  { id: 'yellow', type: 'led', color: 'yellow', anode: [16, 'e'], cathode: [17, 'e'], drive: 'yellow', needs: ['bb', 'gnd', 'ry', 'sigY', 'retY'], step: 1 },
  { id: 'rg', type: 'resistor', ohms: 220, a: [18, 'c'], b: [22, 'c'], step: 2 },
  { id: 'green', type: 'led', color: 'green', anode: [22, 'e'], cathode: [23, 'e'], drive: 'green', needs: ['bb', 'gnd', 'rg', 'sigG', 'retG'], step: 2 },
]
const ledFlow = (drive, needs, startCol, resistorId) => ({
  drive,
  needs,
  items: [{ wire: `sig${drive[0].toUpperCase()}` }, hole(startCol, 'c', 0.34), hole(startCol + 4, 'c', 0.34), hole(startCol + 4, 'e', 0.3), ledTop(startCol + 4, 'e'), hole(startCol + 5, 'e', 0.3), hole(startCol + 5, 'a', 0.12), { wire: `ret${drive[0].toUpperCase()}` }, { wire: 'gnd', rev: true }],
  resistorId,
})
const traffic = {
  id: 'traffic',
  title: 'Traffic light',
  short: 'A timed sequence',
  control: { type: 'press', key: 'walk', label: 'Pedestrian button', toggleLabel: null },
  parts: [
    { id: 'bb', type: 'breadboard', step: 0 },
    ...trafficLeds,
    { id: 'btn', type: 'button', cols: [25, 27], step: 3 },
    { id: 'rp', type: 'resistor', ohms: 10000, a: [25, 'c'], b: [29, 'c'], step: 3 },
  ],
  wires: [
    groundWire(0),
    { id: 'sigR', from: { uno: '10' }, to: [6, 'a'], colour: SIGNAL, step: 0 },
    returnWire('retR', 11, 0),
    { id: 'sigY', from: { uno: '9' }, to: [12, 'a'], colour: SIGNAL_2, step: 1 },
    returnWire('retY', 17, 1),
    { id: 'sigG', from: { uno: '8' }, to: [18, 'a'], colour: SIGNAL_3, step: 2 },
    returnWire('retG', 23, 2),
    { id: 'v5', from: { uno: '5V' }, to: { railNear: ['topPlus', 2.9] }, colour: POWER, step: 3, via: [[0.13, 2.45, 8.55], [1.8, 2.6, 8.3], [4.2, 2.5, 7.3], [4.75, 2.4, 4.4], [4.7, 2.3, 0.4], [4.5, 2.4, -1.9]] },
    { id: 'v5b', from: { railNear: ['topPlus', 2.9] }, to: [27, 'j'], colour: POWER, step: 3, arc: 0.7 },
    { id: 'pin2', from: { uno: '2' }, to: [25, 'a'], colour: ANALOG, step: 3, arc: 1.0 },
    returnWire('pull', 29, 3),
  ],
  flows: [
    ledFlow('red', ['bb', 'gnd', 'rr', 'sigR', 'retR', 'red'], 6),
    ledFlow('yellow', ['bb', 'gnd', 'ry', 'sigY', 'retY', 'yellow'], 12),
    ledFlow('green', ['bb', 'gnd', 'rg', 'sigG', 'retG', 'green'], 18),
  ],
  steps: [
    {
      title: 'Red on pin 10',
      body: 'Each light is the same little circuit: pin, 220 Ω resistor, LED, ground. Red goes on pin 10, at the left.',
      watch: 'The red LED lights while the sketch says red.',
      cam: CAM.boardLeft,
      labels: [{ text: 'D10', ref: { uno: '10' }, lift: 0.25 }],
    },
    {
      title: 'Yellow on pin 9',
      body: 'Yellow takes pin 9 and its own resistor. All three LEDs share the one ground rail.',
      watch: 'Check the colour bands: red, red, brown is 220 Ω.',
      cam: CAM.board,
      labels: [{ text: 'D9', ref: { uno: '9' }, lift: 0.25 }],
    },
    {
      title: 'Green on pin 8',
      body: 'Green goes on pin 8. The sketch switches the three pins in order: green, yellow, red, then round again.',
      watch: 'Only one light is on at a time.',
      cam: CAM.board,
      labels: [{ text: 'D8', ref: { uno: '8' }, lift: 0.25 }],
    },
    {
      title: 'A pedestrian button',
      body: 'The button from lesson 2 joins in on pin 2. Press it while the light is green and the sequence skips ahead to yellow, then red, so people can cross.',
      watch: 'Press the red cap during green and watch the timeline.',
      cam: CAM.wide,
      labels: [{ text: 'D2', ref: { uno: '2' }, lift: 0.25 }, { text: 'walk button', ref: { at: [colX(26), BB.h + 0.9, 0.0] } }],
    },
  ],
  code: () => [
    'void loop() {',
    '  setLights(LOW, LOW, HIGH);   // green',
    '  waitForWalk(4000);           // or pin 2',
    '  setLights(LOW, HIGH, LOW);   // yellow',
    '  delay(1500);',
    '  setLights(HIGH, LOW, LOW);   // red',
    '  delay(4500);',
    '}',
  ],
  sim(t, dt, c, m, step) {
    if (m.phase === undefined) Object.assign(m, { phase: 'green', left: 4, last: false, walk: false })
    const pressed = step >= 3 && live.pressed
    if (pressed && !m.last) {
      m.walk = true
      if (m.phase === 'green' && m.left > 1.2) m.left = 1.2
    }
    m.last = pressed
    m.left -= dt
    if (m.left <= 0) {
      if (m.phase === 'green') Object.assign(m, { phase: 'yellow', left: 1.5 })
      else if (m.phase === 'yellow') Object.assign(m, { phase: 'red', left: 4.5 })
      else Object.assign(m, { phase: 'green', left: 4, walk: false })
    }
    live.drive.red = m.phase === 'red' ? 1 : 0
    live.drive.yellow = m.phase === 'yellow' ? 1 : 0
    live.drive.green = m.phase === 'green' ? 1 : 0
    const lengths = { green: 4, yellow: 1.5, red: 4.5 }
    const first = (m.phase === 'green' ? 4 : m.phase === 'yellow' ? 1.5 : 4.5) - m.left < 0.12
    const line = m.phase === 'green' ? (first ? 1 : 2) : m.phase === 'yellow' ? (first ? 3 : 4) : first ? 5 : 6
    return { line, phase: m.phase, left: Math.max(0, m.left), length: lengths[m.phase], walk: m.walk && m.phase === 'red', pending: m.walk && m.phase !== 'red', pressed }
  },
}

// ---------- 7. Build your own (the free sandbox; its parts, wires and sketch live in sandbox.js) ----------
const buildYourOwn = {
  id: 'sandbox',
  title: 'Build your own',
  short: 'A free bench for your circuit',
  sandbox: true,
  control: { type: 'none' },
  parts: [],
  wires: [],
  flows: [],
  steps: [{ title: 'Build your own', body: '', watch: '', cam: { t: [0.3, 0.3, 3.4], d: 23, az: 0, el: 57 }, labels: [], set: {} }],
  code: () => [],
  sim: () => ({}),
}

export const LESSONS = [blink, button, fade, pot, servo, traffic, buildYourOwn]

export const DEFAULT_CONTROLS = { delayMs: 500, debounce: false, pwm: 128, auto: false, pot: 135, angle: 90, walk: false }

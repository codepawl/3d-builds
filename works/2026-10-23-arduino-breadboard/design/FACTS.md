# Facts and simplifications

Sources: Arduino docs, Uno Rev3 product page (docs.arduino.cc/hardware/uno-rev3, read 2026-10-23): ATmega328P at 16 MHz, 5 V I/O,
7-12 V nominal input, 20 mA DC per I/O pin, 32 kB flash, 2 kB SRAM, 1 kB EEPROM, 68.6 mm x 53.4 mm, barrel plug supply, six PWM channels.

Measured from the docs page (checked): board size, MCU, clock, I/O voltage, per-pin current, six PWM channels.
From general knowledge, not re-fetched this session (the language-reference pages did not render without a browser):
- analogWrite on the Uno: 8-bit (0-255), about 490 Hz on pins 3, 9, 10, 11 and 980 Hz on pins 5 and 6. The app shows 490 Hz everywhere.
- analogRead: 10-bit, 0-1023 over 0-5 V.
- LED_BUILTIN is pin 13 (the "L" LED). The "ON" power LED is always lit.
- Servo library: attach(pin), write(angle 0-180); default pulse range 544-2400 us at 50 Hz.
- Breadboard half size: 400 tie points (30 columns x 2 groups of 5 rows = 300, plus 4 rails x 25 = 100), 2.54 mm pitch,
  centre channel 7.62 mm (0.3 in) so a DIP or a button can straddle it. About 82.6 x 54.6 x 8.5 mm.
- 5 mm LED: dome 5 mm, flange 5.8 mm, longer leg is the anode. Red LED forward voltage about 2.0 V, so (5 - 2.0) / 220 = 13.6 mA.
- Resistor colour code: 220 ohm = red red brown gold, 10 k = brown black orange gold (4 band, 5 % gold).
- SG90: body about 22.8 x 12.2 x 22.7 mm, mounting ears 32.5 mm, wires brown (GND), red (5 V), orange (signal).
- Tactile switch 6 x 6 mm.

Simplifications (approximate, stated in the report):
- Servo angle is mapped to a 1.0-2.0 ms pulse (the brief's range) rather than the library's 544-2400 us. The scope is zoomed on the first 2.5 ms of each 20 ms frame.
- Header pin positions come from the 0.1 in grid and the 0.16 in gap between pins 7 and 8 (within about 0.5 mm); chip, USB and jack positions are read from photographs by eye.
- The 3D potentiometer has 5.08 mm leg spacing and the button 5.08 mm leg spacing, a bit wider than a 6 mm tactile switch.
- Bounce scope: 40 ms across, played 50x slower; bounce lengths are made up (0.5-1.6 ms segments) to be visible. Debounce delay 20 ms.
- Traffic sequence: green 4 s, yellow 1.5 s, red 4.5 s; a walk press during green cuts green to 1.2 s.
- Power wires route round the right-hand side of the boards for clarity. Real wires could run straight across.

## Added in the second round (general knowledge, not checked against a source)

- LED current in the sandbox and the mA labels: (5 V - 2.0 V forward drop) / R. 220 ohm gives about 14 mA; 1 kohm about 3 mA; 10 kohm about 0.3 mA. Full brightness is taken as 12 mA, a simplification.
- Servo pins: brown GND, red 5 V, orange signal.
- Only PWM pins 3, 5, 6, 9, 10, 11 fade on an Uno (matches the docs-page facts above).

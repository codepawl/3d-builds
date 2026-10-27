# Edison's carbon-filament lamp, 1879-80: research notes

Read on 2026-10-12. Every fact used in a caption is listed under "Used in the caption" with the page it
was read on. Anything read nowhere in this session is under "Not verified".

## Sources read

1. US patent 223,898, T. A. Edison, "Electric-Lamp". Google Patents (OCR text of the patent):
   https://patents.google.com/patent/US223898A/en
   - Filing date 1879-11-04, publication (grant) date 1880-01-27 (the page's bibliographic data).
   - "a cotton thread properly carbonized and placed in a sealed glass bulb exhausted to one-millionth
     of an atmosphere offers from one hundred to five hundred ohms resistance to the passage of the
     current" (OCR is rough; the words "one-millionth of an atmosphere" and "from one hundred to five
     hundred ohms" are legible).
   - Figure 1 legend: "a is the carbon spiral or thread. c c' are the thickened ends of the spiral ...
     d d' are the platina wires. h h are the clamps, which serve to connect the platina wires, cemented
     in the carbon, with the leading-wires x x, sealed in the glass vacuum-bulb. e e are copper wires,
     connected just outside the bulb to the wires x x."
   - "By using the carbon wire of such high resistance I am enabled to use fine platinum wires for
     leading-wires ..."
   - Claims: (1) "An electric lamp for giving light by incandescence, consisting of a filament of carbon
     of high resistance, made as described, and secured to metallic wires"; (2) carbon filaments with "a
     receiver made entirely of glass and conductors passing through the glass, and from which receiver
     the air is exhausted"; (3) "A carbon filament or strip coiled and connected to electric conductors".
2. Wikipedia, "Incandescent light bulb": https://en.wikipedia.org/wiki/Incandescent_light_bulb
   - "Thomas Edison began serious research into developing a practical incandescent lamp in 1878."
   - "The first successful test was on 22 October 1879, and lasted 13.5 hours."
   - "by 4 November 1879, filed for a US patent for an electric lamp using 'a carbon filament or strip
     coiled and connected ... to platina contact wires.'"
   - "Edison and his team later discovered that a carbonized Japanese bamboo filament could last more
     than 1200 hours."
   - "The first commercially successful light bulb filaments were made from carbonized paper or bamboo."
   - "However, Joseph Swan's incandescent light bulb pre-dated Edison's and was sufficiently practical
     that it was actually installed and in daily use in London in 1881."
3. Wikipedia, "Joseph Swan": https://en.wikipedia.org/wiki/Joseph_Swan
   - First public demonstration of his incandescent carbon lamp at a lecture in Newcastle upon Tyne on
     18 December 1878; repeated "with the lamp shown in actual operation" on 17 January 1879; shown to
     over seven hundred people on 3 February 1879.
   - "responsible for developing the first use of incandescent lights used to illuminate homes and
     public buildings, including the Savoy Theatre, London, in 1881."
   - "Joseph Swan and Thomas Edison are later reported to have used the Sprengel pump to evacuate their
     carbon filament lamps."
4. Wikipedia, "Edison screw": https://en.wikipedia.org/wiki/Edison_screw
   - "developed by Thomas Edison (1847-1931), patented in 1881"; "In designing his screw, Edison copied
     the lid of a kerosene can in his workshop, even sawing it off to make a prototype in 1880."
5. Wikipedia, "Edison light bulb": https://en.wikipedia.org/wiki/Edison_light_bulb
   - "Light bulbs with a carbon filament were first demonstrated by Thomas Edison in October 1879."
6. Wikipedia, "Thomas Edison": https://en.wikipedia.org/wiki/Thomas_Edison
   - "It was not until several months after the patent was granted that Edison and Batchelor discovered
     that a carbonized bamboo filament could last over 1,200 hours."

## Sources that could not be read

- Smithsonian NMAH collection pages (https://americanhistory.si.edu/collections/...): the site answered
  with a "request verification" page to a scripted request, so nothing from it is used.
- The Edison Papers at Rutgers (https://edison.rutgers.edu/): the two addresses tried returned an error
  page and an unrelated article. Nothing from it is used. (Other accounts give 14.5 hours for the October
  1879 test; that figure was not read on a page in this session, so the caption keeps Wikipedia's 13.5.)
- The Henry Ford's lamp pages: the address tried returned 404. Nothing from it is used.

## Used in the caption

| Fact | Source |
|---|---|
| US patent 223,898, "Electric-Lamp", filed 4 November 1879, granted 27 January 1880 | 1 |
| Platinum lead-in wires sealed through the glass; clamps join them to the carbon | 1 |
| Carbon filament of high resistance, 100 to 500 ohms | 1 |
| Bulb of glass, exhausted to one-millionth of an atmosphere | 1 |
| First successful test of a carbon-filament lamp on 22 October 1879, 13.5 hours | 2 |
| A carbonized bamboo filament later lasted more than 1,200 hours | 2, 6 |
| Swan showed a working carbon lamp in Newcastle in early 1879; his lamps lit houses and the Savoy Theatre in 1881 | 3 |
| The patent draws a coiled filament | 1 (figure legend and claim 3) |
| The screw base is the form Edison patented in 1881 | 4 |

The caption does not call the lamp "the first practical" or "the first" light bulb: source 2 itself says
Swan's lamp came earlier and was practical. The strongest wording a source supports is "the first
commercially successful light bulb filaments were made from carbonized paper or bamboo" (source 2).

## What the figure simplifies

- Filament shape: a plain horseshoe loop. The patent's figure shows a coil ("carbon spiral"). That
  Edison's lamps of late 1879 and 1880 used horseshoe loops of carbonized paper and then bamboo is
  general knowledge that was not read on a page in this session.
- Base and socket: a brass screw shell with an insulating filler, standing on a turned wooden socket with
  a key. The screw base is dated by source 4 (prototype 1880, patent 1881). The filler being plaster of
  Paris, the wooden socket and the exact form of the key switch were not read on a page in this session,
  so the legend says "insulating filler" and "key switch" and no more. The base is drawn standing on the
  socket instead of screwed down into it, so that it can be seen.
- Glass stem: drawn as a short tube with a pressed top carrying both wires. The patent's figure shows the
  wires sealed through the glass; the exact shape of the inner glass part is a drawing choice.
- Supply: a two-pole generator with tall field coils, in outline only, with no moving parts. It stands
  for "a source of current" and is not a drawing of a particular machine.
- Wiring inside the socket and base is drawn where it would run, as if seen through the parts.

## What the model is (model.mjs)

Physics: Ohm's law, electric power heating the filament, radiation (temperature to the fourth power)
cooling it, carbon's resistance falling as it gets hot, carbon burning away in air.

Chosen values, not measurements: supply 100 V (control 40 to 115 V), filament 250 ohms cold and 140 ohms
at its working temperature (inside the patent's 100 to 500 ohm range), working temperature 2,100 K,
heat capacity 0.015 J/K (gives 63% of the rise in about 0.8 s, so the warming can be seen; a real thin
filament is of that order but this value was chosen, not measured), burn-through in air in about 1.1 s
at full heat, 0.16 s for the key to turn. The current's arrival is drawn as a sweep of 0.45 s along the
route; in a real circuit the current starts everywhere at once. The colours are a hand-made scale from
dark grey through dull red, orange and yellow to yellow-white, not a colorimetric black-body table.

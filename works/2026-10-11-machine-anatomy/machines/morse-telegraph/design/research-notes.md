# Morse telegraph: sources and what the figure takes from each

Fetched 2026-10-12. Wikipedia pages were read as raw wikitext; the Smithsonian records came from the
Open Access API (`api.si.edu/openaccess/api/v1.0/search?q=morse+vail+telegraph+register`).
The Library of Congress pages (Samuel F. B. Morse Papers) answered with a Cloudflare challenge and
could not be read, so nothing here rests on them.

## Facts used in the caption, each with its source

| Fact | Source |
|---|---|
| Morse's assistant Alfred Vail developed the register; "It embossed dots and dashes on a moving paper tape by a stylus which was operated by an electromagnet." | https://en.wikipedia.org/wiki/Electrical_telegraph |
| "The Morse system uses a single wire between offices." The operator taps a key; "Originally, the armature was intended to make marks on paper tape". | https://en.wikipedia.org/wiki/Electrical_telegraph |
| Register, ca 1845, designed and made by Alfred Vail: pulses "energize the register's electromagnets which move a lever-arm holding a pen or stylus. A clockwork mechanism pulls a strip of paper across the pen or stylus... Short pulses draw or emboss a dot, slightly longer pulses a dash." "The beige coils are electromagnets and their large size was typical for early units." | Smithsonian NMAH, "Telegraph Register", https://n2t.net/ark:/65665/ng49ca746aa-59af-704b-e053-15f76fa0b4fa |
| "Alfred Vail made this key, believed to be from the first Baltimore-Washington telegraph line, as an improvement on Samuel Morse's original transmitter", 1844. | Smithsonian NMAH, "Morse-Vail Telegraph Key", https://n2t.net/ark:/65665/ng49ca746a9-46b1-704b-e053-15f76fa0b4fa |
| The first telegraph key was invented by Alfred Vail. A straight key "is a simple bar with a knob on top and an electrical contact underneath. When the bar is pressed down against spring tension, it makes a closed electric circuit." | https://en.wikipedia.org/wiki/Telegraph_key |
| Relay: "The pulses faded in strength as they traveled through the wire, to the point where the incoming signal was too weak to directly operate a receiving sounder or register. A relay detected a weak signal and used a battery to strengthen the signal so that the receiver would operate." A relay ca 1845 with a frame that "includes the contacts and the armature adjusting spring". | Smithsonian NMAH, "Schneider telegraph relay", https://n2t.net/ark:/65665/ng49ca746af-f6cd-704b-e053-15f76fa0b4fa |
| Armature near the magnet's pole on a pivot; current pulls it to the electromagnet, and it returns when the current ends (described for the sounder, whose "mechanism was similar to a relay"). | https://en.wikipedia.org/wiki/Telegraph_sounder |
| Earth return: the return path is "provided by connection to the earth"; "Connection to earth is made by means of metal plates with a large surface area buried deeply in the ground"; it "rapidly became the norm". Morse "installed the first telegraph line in the United States in 1844 using two copper wires". | https://en.wikipedia.org/wiki/Earth-return_telegraph |
| American Morse is "the original version of the Morse Code, developed in the mid-1840s by Samuel Morse and Alfred Vail". It has a dot, a dash, a long dash (L), an even longer dash (0) and a "long intra-character gap (longer internal gap used in C, O, R, Y, Z and &)". The whole letter and numeral table. | https://en.wikipedia.org/wiki/American_Morse_code |
| First public message "What hath God wrought", sent on May 24, 1844 by Morse in Washington to Alfred Vail in Baltimore. | https://en.wikipedia.org/wiki/American_Morse_code and https://en.wikipedia.org/wiki/Samuel_Morse |
| A photograph endorsed by Morse in 1870 shows "the earliest instrument constructed for public use, and operated upon the experimental telegraph line from Washington to Baltimore in 1844", in Vail's charge at Baltimore. | Smithsonian Institution Archives, "1844 Vail Telegraph Register", https://siarchives.si.edu/collections/siris_arc_388767 |

## Which code, and why

American Morse, the code of 1844. The machine drawn is a mid-1840s Morse and Vail register, and the
first message was sent in this code; International Morse descends from Gerke's 1848 revision
(same Wikipedia article, which says Gerke changed the sequences of eleven letters: C, F, J, L, O, P,
Q, R, X, Y and Z differ in the table), and American Morse has a longer gap
inside C, O, R, Y, Z and a long dash for L. The table in `model.mjs` is typed from the Wikipedia table
and `test-model.mjs` checks it against a second copy typed out in words.

## What is the figure's own choice (not from a source)

- **Lengths of marks and gaps.** The sources name the kinds (dot, dash, long dash, longer dash, three
  gaps) but the fetched pages give no fixed proportions for American Morse. The model uses dot 1,
  dash 3, long dash 5, longer dash 7, gap inside a letter 1, long inner gap 2, gap between letters 3,
  gap between words 6. The caption says the lengths are the figure's own.
- **The staged lighting of the path.** The model lights each stretch of the circuits a fraction of a
  beat after the one before, so the signal can be followed. A real line is live along its length
  practically at once. The caption says so.
- **Sizes and layout.** No dimensions were taken from a drawing. The key, relay and register follow the
  descriptions above (lever, pivot, spring, contact, knob; coils, armature, return spring, contact;
  coils, lever, stylus, clockwork, paper). The register's stylus strikes the tape from below, under a
  roller, which follows the usual description of the Morse register but was not confirmed from a
  fetched source. The gear train is three wheels on one plate, a stand-in for the clockwork, not a
  copy of Vail's train.
- **Weight or spring.** NMAH says "clockwork mechanism"; whether a weight or a spring drove it is not
  in the fetched text, so no weight is drawn and the caption says only "clockwork".
- **Battery cells.** Drawn as plain glass jars with a metal cap. The type of cell on the 1844 line
  (Grove cells are often named) was not confirmed and is not stated.
- **Relay in the receiving office.** NMAH describes a relay working "a receiving sounder or register"
  with a local battery. That a relay stood between the line and the register on any one particular
  line of the 1840s is not claimed.
- **Poles and insulators.** Generic: two wooden poles with one glass insulator each. Not from a source.
- **No speeds, counts or distances** are stated anywhere in the caption.

## Not read

- Library of Congress, Samuel F. B. Morse Papers (the tape of the first message): blocked by a
  Cloudflare challenge from this machine.
- Vail's 1845 book "The American Electro Magnetic Telegraph": not fetched.

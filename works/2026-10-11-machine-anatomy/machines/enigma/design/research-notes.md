# Enigma I: research notes

Pages fetched on 2026-10-11 with `curl` and searched as text. A fact is listed under "Verified" only when
its wording or its numbers were found in the fetched page. Anything else is under "Not verified".

## Sources

- Crypto Museum, Enigma I: https://www.cryptomuseum.com/crypto/enigma/i/index.htm
- Crypto Museum, Enigma wiring: https://www.cryptomuseum.com/crypto/enigma/wiring.htm
- Crypto Museum, how the Enigma works: https://www.cryptomuseum.com/crypto/enigma/working.htm
- Wikipedia, "Enigma rotor details": https://en.wikipedia.org/wiki/Enigma_rotor_details
- Wikipedia, "Enigma machine": https://en.wikipedia.org/wiki/Enigma_machine
- Tony Sale, technical specification of the rotors: https://www.codesandciphers.org.uk/enigma/rotorspec.htm
- Tony Sale, a worked example: https://www.codesandciphers.org.uk/enigma/example1.htm

## Verified, and used in the model

| Fact | Value | Found in |
|---|---|---|
| Rotor I wiring | EKMFLGDQVZNTOWYHXUSPAIBRCJ | Crypto Museum wiring, Wikipedia rotor details, Tony Sale rotorspec (same letters, spaced) |
| Rotor II wiring | AJDKSIRUXBLHWTMCQGZNPYFVOE | same three |
| Rotor III wiring | BDFHJLCPRTXVZNYEIWGAKMUSQO | same three |
| Reflector B (UKW-B) wiring | YRUHQSLDPXNGOKMIEBFZCWVJAT | Crypto Museum wiring, Wikipedia rotor details |
| Notch letters (window letter at turnover) | I: Q, II: E, III: V | Crypto Museum wiring table (columns "Y Q", "M E", "D V"); Wikipedia rotor details: "turnovers on Q, E and V" |
| Entry wheel of the Enigma I | wired in the order of the alphabet (ABC...) | Crypto Museum Enigma I |
| Test vector | I-II-III, reflector B, rings A, start AAA: AAAAA gives BDZGO | Wikipedia rotor details (marked "citation needed" there; the model reproduces it) |
| Test vector with rings | same, all rings at B: AAAAA gives EWTYX | Wikipedia rotor details |
| Double step | ADU, ADV, AEW, BFX with rotors I, II, III | Wikipedia rotor details |
| Period of the rotor positions | 26 x 25 x 26 = 16,900 | Wikipedia Enigma machine |
| The rotors move before the circuit closes | the encoding happens "after the key is pressed and the rotor has turned" | Wikipedia rotor details; Crypto Museum working ("the rotors move into a new position and a contact is closed") |

## Verified, and used in the drawing or the caption

- Order of the current: key switch, plugboard (Steckerbrett), entry wheel (ETW), three rotors, reflector
  (Umkehrwalze, UKW), back through the rotors, the ETW and the plugboard, to the lamp panel. Crypto Museum
  Enigma I and working pages.
- 26 keys, 26 contacts on each side of a rotor. Crypto Museum working page.
- The keyboard is in QWERTZ order. Crypto Museum Enigma I. The three rows used here are QWERTZUIO,
  ASDFGHJK, PYXCVBNML.
- Seen from the operator: the entry wheel is at the right, the three rotors to its left and the reflector
  at the far left. Crypto Museum Enigma I.
- The plugboard is at the front of the machine and has 26 sockets; a cable crosses two letters. Crypto
  Museum Enigma I.
- The machine runs from a 4.5 V battery in a box behind the power switch. Crypto Museum Enigma I. (The
  box and a switch are drawn; no voltage is quoted in the caption.)
- Stepping is done by spring-loaded pawls that push 26-tooth ratchets, all three moving in unison on each
  key press; a pawl only reaches its ratchet when the notched ring of the rotor to its right lets it drop,
  and then it pushes both rotors. Wikipedia Enigma machine ("Stepping" and the caption of the ratchet
  figure, which also says the view is "from the side away from the operator", so the pawls are behind
  the rotors).
- Parts of a rotor, left to right: notched ring, alphabet ring (tyre), finger wheel, ratchet wheel, with
  plate contacts on one face and spring-loaded pins on the other. Wikipedia Enigma machine (rotor diagram
  legend).

## Verified for the second pass (pages fetched again on 2026-10-11, text searched)

| Fact, as drawn | Wording found | Source |
|---|---|---|
| A rotor has 26 sprung pins on one face and 26 flat contacts on the other | "26 brass, spring-loaded, electrical contact pins arranged in a circle on one face, with the other face housing 26 corresponding electrical contacts in the form of circular plates" | https://en.wikipedia.org/wiki/Enigma_machine |
| Inside, 26 wires join each pin to a contact (the model's wiring strings) | wiring tables | https://en.wikipedia.org/wiki/Enigma_rotor_details , https://www.cryptomuseum.com/crypto/enigma/wiring.htm |
| The Army machine's rings carry numbers, not letters | "the rotors of the latter [Navy] have letters (A-Z) rather than numbers" | https://www.cryptomuseum.com/crypto/enigma/i/index.htm |
| The notch is on the ring; one notch per rotor | "In the military variants, the notches are located on the alphabet ring"; "Each rotor has a single notch on its circumference" | Wikipedia Enigma machine; Crypto Museum Enigma I |
| Ratchet with 26 teeth; finger wheel that sticks out of the cover | "Each rotor had a ratchet with 26 teeth"; "the grooved finger-wheel which protrudes from the internal Enigma cover when closed" | https://en.wikipedia.org/wiki/Enigma_machine |
| Three pawls push together; a pawl bites only through a notch and then moves both rotors (the double step) | "All three ratchet pawls push in unison as a key is depressed"; "The alphabet ring of the rotor to the right normally prevented this"; "as it moved forward it pushed against both the ratchet and the notch, advancing both rotors"; "The right-hand pawl, having no rotor and ring to its right, stepped its rotor with every key depression" | https://en.wikipedia.org/wiki/Enigma_machine |
| Each plugboard letter has two holes: upper to the key, lower to the entry wheel; the socket has its own switch | "Each letter on the plugboard had two jacks. Inserting a plug disconnected the upper jack (from the keyboard) and the lower jack (to the entry-rotor) of that letter"; "the sockets had a built-in switch" | Wikipedia Enigma machine; Crypto Museum Enigma I |
| A cable ends in two-pin plugs | "a double-ended plug with a thick and a thin pin" (the two pins are drawn the same size: which is the upper one was not found) | https://www.cryptomuseum.com/crypto/enigma/i/index.htm |
| On the way back the current passes the switch of the lamp letter's key before the lamp | "through a depressed bi-directional keyboard switch to the plugboard" ... "and another bi-directional switch to light the appropriate lamp" | https://en.wikipedia.org/wiki/Enigma_machine |
| Keyboard and lamp panel in QWERTZ order | "The layout of the keyboard and the lamp panel is in the standard QWERTZ order" | https://www.cryptomuseum.com/crypto/enigma/i/index.htm |
| The reflector joins the contacts in 13 pairs | follows from the UKW-B string above; `test-model.mjs` counts 13 | Crypto Museum wiring |
| Wooden case; power switch to the right of the rotors; battery at the far right | "covered by a wooden flap"; "the large rotary switch to the right of the cipher rotors"; "At the far right is the battery" | https://www.cryptomuseum.com/crypto/enigma/i/index.htm |

## Not verified, not drawn, or simplified on purpose

- The hinged top lid with its three windows and the slots for the finger wheels is NOT drawn. Crypto Museum
  confirms it exists ("raise the hinged top lid and access the interior", and Wikipedia: "With the inner lid
  down ... the finger wheels of the rotors protruded through the lid"), but pass one stands the rotors on a
  cradle above the deck, so a lid over them would be a box that no real machine has. The strip with three
  windows in front of the rotors still stands in for it. Sinking the rotors into a well is a redesign.
- The wooden flap that covers the plugboard (Crypto Museum Enigma I) is not drawn; the plugboard is shown open.
- Key levers under the keyboard are not drawn; the lit path goes down the key's stem to a switch under the deck.
- The finger joint on the case corner is a generic box joint, not copied from a photograph.
- The route of the wires inside the case (under the deck, behind the front wall, along the floor) is a plausible
  layout, not taken from a wiring photograph. What is true is the order of the parts it joins.
- Inside a rotor each wire is drawn as a smooth run round the hub from its pin to its contact. Real wires are a
  loose bundle; which pin joins which contact is exact.
- When the right rotor opens, its ring half shows the backs of the 26 contacts. The flat contact faces themselves
  are on the rotor's left face, which this camera never sees.
- Rotor sizes, the pawls' shape and where the notch mark sits are drawn from the descriptions, not measured.
- Dates and voltages are left out of the caption and the film (4.5 V battery: Crypto Museum; not cross-checked).
- "A letter never lights its own lamp" follows from reflector B pairing every contact with a different one;
  `test-model.mjs` checks it over 192 typed letters.
- The start-up cables (A-T and G-L) are an arbitrary example, not a historical key.

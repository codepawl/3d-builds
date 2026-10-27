# First transistor: research notes

Sources fetched on 2026-10-12 and read as text. Each fact below names the page it was read on.
Facts used in the page caption are marked **(caption)**.

## Sources

- CHM: Computer History Museum, "1947: Invention of the Point-Contact Transistor"
  https://www.computerhistory.org/siliconengine/invention-of-the-point-contact-transistor/
- WP-PCT: Wikipedia, "Point-contact transistor" https://en.wikipedia.org/wiki/Point-contact_transistor
- WP-HIST: Wikipedia, "History of the transistor" https://en.wikipedia.org/wiki/History_of_the_transistor
- PBS: PBS "Transistorized!", "The First Transistor" https://www.pbs.org/transistor/science/events/pointctrans.html
- NOBEL: The Nobel Prize in Physics 1956, summary https://www.nobelprize.org/prizes/physics/1956/summary/

Not reached: the Nokia Bell Labs history page (https://www.bell-labs.com/about/history/innovation-stories/invention-transistor/
returned an empty body to a plain request) and Brattain's Nobel lecture page (answered with a bot check).
Nothing in the figure rests on them.

## What the sources say

| Fact | Source |
|---|---|
| Made by John Bardeen and Walter Brattain at Bell Laboratories in December 1947, in a group led by William Shockley **(caption, without the group)** | WP-PCT, CHM |
| The critical experiment was on 16 December 1947 **(caption)** | WP-PCT ("carried out on December 16, 1947"), CHM ("On December 16, 1947, their research culminated in the first successful semiconductor amplifier") |
| Shown to laboratory officials on 23 December 1947 **(caption)** | CHM ("On December 23 they demonstrated their device to lab officials"), WP-HIST (Brattain and H. R. Moore, "to several of their colleagues and managers at Bell Labs on the afternoon of December 23, 1947") |
| In that trial it worked as a speech amplifier with a power gain of 18 **(caption)** | WP-HIST only. CHM gives a different figure, "amplifying the input signal up to 100 times", without saying of what or when; it is not used. |
| A block (slab) of germanium with two very closely spaced gold contacts held against it by a spring **(caption)** | WP-PCT; CHM ("two closely-spaced gold contacts held in place by a plastic wedge to the surface of a small slab of high-purity germanium") |
| A strip of gold foil over the point of a plastic triangle, sliced through at the tip with a razor blade, giving two isolated contacts very close together **(caption)** | WP-PCT, PBS ("a single strip of gold foil over the point of a plastic triangle … a razor blade, he sliced through the gold right at the tip of the triangle"), WP-HIST ("sliced with a razor at the tip of the triangle") |
| The wedge hung on a spring so the contacts lightly touched the surface **(caption)** | PBS |
| The germanium block was mounted on a base, which is the third terminal **(caption: "sits on a metal base")** | WP-PCT ("the base upon which the block of germanium was mounted"); "metal" is from the device as usually described and photographed, not from a sentence in these pages |
| The emitter injects holes ("points which lack electrons") into the germanium **(caption)** | WP-PCT |
| A small positive current into one contact changes the current between the other contact and the base by more: an amplifier. The low-current input is the emitter; base and collector carry the larger current **(caption)** | WP-PCT |
| Separation of the points about 4 × 10⁻³ cm (0.04 mm), from Brattain's notebook entry of 16 December 1947 **(caption)** | WP-HIST (quoting the notebook) |
| "The bias (D.C.) on the grid had to be positive to get amplification" (the emitter is biased positive) | WP-HIST (same notebook entry) |
| Current gain alpha of point-contact transistors "usually around 2 to 3" | WP-PCT, Characteristics |
| Nobel Prize in Physics 1956 to Shockley, Bardeen and Brattain "for their researches on semiconductors and their discovery of the transistor effect" **(caption)** | NOBEL |
| Named "transistor" by John Pierce; announced on 30 June 1948 (not used in the page) | CHM |

## The model (model.mjs) and what it simplifies

One idea: a small current into the emitter controls a larger current through the collector.

- Emitter: no current below a threshold of 0.25 V, then a straight line of 270 ohm. A real point contact
  has a curved diode characteristic.
- Collector: a leakage current of 0.3 mA plus alpha times the emitter current, limited to what a 9 V
  battery pushes through the load. Alpha defaults to 2.2, inside the "2 to 3" range above, and can be
  set from 1 to 3. Why alpha exceeds 1 in a point-contact transistor (what the arriving holes do at the
  collector contact) is not modelled; alpha is just a number here.
- Load 1000 ohm. Voltage gain = alpha × load / emitter resistance = 8.15; power gain = alpha × that =
  17.9. **These values were chosen so the power gain lands near the 18 reported for 23 December. They
  are not measurements of the 1947 device**, and its real resistances, voltages and currents are not
  given in the sources read here.
- Bias off means both batteries disconnected: the input alone (at most 0.2 V) stays under the emitter
  threshold and the collector has no supply, so the output is zero. In reality a little would still leak.
- Above an input level of 0.81 the emitter cuts off for part of each cycle and the output clips; the
  readout says "clipping".
- No frequency behaviour, no noise, no temperature, no negative resistance, no "forming" of the collector.
- The signal is a 0.5 Hz sine so that it can be watched; the demonstration used speech.

## What the drawing simplifies or does not know

- Not to scale. No dimension of the device is taken from a source except the slit, and the slit is
  drawn far wider than 0.04 mm (it would be invisible otherwise), in the figure and more so in the inset.
- The inset is a flat cut, not a view. The pink band is the thin surface layer the holes travel in. The
  moving dots stand for charge, not for single carriers: hollow orange for the holes put in at the
  emitter, filled blue for the larger collector current. Their number follows the model's currents.
- The stand (board, post, arm, clamp screw), the terminals, the signal source, the two batteries, the
  load and the bias switch are a plausible bench arrangement drawn to show the circuit. They are not
  copied from the 1947 apparatus. The spring is drawn as a zigzag of bent wire; the common description
  of it as a bent paper clip was not found in a sentence of the pages read, so the caption says "spring".
- The collector battery's sign (negative, reverse bias) is the standard account of the circuit and of
  Bardeen and Brattain's 1948 letter, which was not fetched here; the caption does not state it.
- "Gathered by the collector" in the caption is the standard account in plain words; WP-PCT says only
  that the emitter current influences the current between the other contact and the base.

# Facts and sources for the Titanic plate

Status: **measured** = read in a source I opened in this session; **inferred** = my own reading or placement, not
checked against a plan; **unchecked** = used in the page but I could not confirm it.

Source opened: English Wikipedia "Titanic" (plain-text extract through the MediaWiki API, 2026-10-26). No deck plan,
Harland and Wolff drawing or Encyclopedia Titanica page was opened, so every room position below is inferred.

## Ship numbers

| Fact | Value in page | Status | Source |
|---|---|---|---|
| Length | 269.1 m (882 ft 9 in) | measured | Wikipedia: "882 feet 9 inches (269.06 m)" |
| Beam | 28.2 m (92 ft 6 in) | measured | Wikipedia: "92 feet 6 inches (28.19 m)" |
| Draught | 10.5 m | measured | Wikipedia: "34 feet 7 inches (10.54 m)" |
| Gross tonnage | 46,329 | measured | Wikipedia |
| Four funnels, buff with black tops, aftmost a dummy (also ventilated kitchen and smoking rooms) | 4 | measured | Wikipedia |
| Two masts, 155 ft (47 m) high | masts top at about 46 m above the keel | measured (height); inferred (measured from keel) | Wikipedia |
| 16 primary compartments, 15 bulkheads | 15 bulkhead walls drawn between rooms | measured | Wikipedia |
| 29 boilers (24 double-ended, 5 single-ended), 159 furnaces | 29 boilers over 6 rooms (5,5,5,5,5,4) | measured (totals); inferred (split per room) | Wikipedia |
| Two four-cylinder triple-expansion engines, each 63 ft long, plus one low-pressure Parsons turbine, three propellers | as drawn | measured | Wikipedia |
| Lifeboats | 16 wooden + 4 collapsibles = 20, capacity 1,178 | measured | Wikipedia |
| People aboard on the maiden voyage | 2,208 | measured | Wikipedia (estimates vary) |
| Trial speed | just under 21 knots | measured | Wikipedia (sea trials) |
| Cargo included a 1912 Renault Type CE Coupe de Ville | one red car in the forward hold | measured | Wikipedia |
| Keel to funnel tops about 53 m | funnel caps top out at about 54 m | unchecked (from the brief; Wikipedia gives keel to bridge top as 32 m) | PLAN.md |
| Waterline at 10.5 m above the keel | 10.5 | inferred (equal to the draught) | |
| Title copy: built in Belfast by Harland and Wolff, maiden voyage April 1912 | | measured | Wikipedia |
| "then the largest ship afloat" | intro | unchecked | not searched for in the extract |

## Decks and rooms (what Wikipedia says, then what I did)

Measured from Wikipedia: boat deck with the bridge and wheelhouse at the forward end in front of the captain's and
officers' quarters; the Grand Staircase entrance and gymnasium midships; A deck promenade held the first class reading
and writing room, lounge, smoke room and Palm Court; D deck held the first class reception room, first class dining
saloon and second class dining saloon; F deck had the pool and Turkish bath; G deck had the squash court and the
travelling post office; the orlop decks and tank top were cargo spaces and double bottom; the Grand Staircase had a
carved clock panel on the uppermost landing; two Marconi operators (Jack Phillips and Harold Bride) ran the wireless.

Inferred (my placement, metres from the stern, not from a plan): deck heights above the keel (tank top 1.8, orlop 5.4,
G 8.2, F 11.0, E 13.8, D 16.6, C 19.4, B 22.2, A 25.0, boat deck 29.0); funnel centres 146, 120, 94, 68; boiler rooms
6 to 1 at 166-182, 150-166, 132-150, 114-132, 98-114, 86-98; engine room 56-86; turbine room 40-56; Grand Staircase
163-177; bridge 206-217; officers' quarters 189-205; Marconi room 178-188; gymnasium 151-162; lounge 118-148; smoking
room 80-112; reading room 150-162; first class dining saloon 98-146; reception room 148-162; second class dining
saloon 62-94; pool 182-197; Turkish bath 198-208; squash court 182-197; mail room 198-214; foremast 228; mainmast 40;
third class rooms forward (x above 208) and aft (x below 54). The real boat deck order, the first class dining saloon
being aft of the reception room, and the squash court sitting forward of the boiler rooms are plausible but unchecked.

## Simplifications to be honest about

- The cut is at the centreline plus one metre. Rooms are drawn 7 m deep (back wall at 6.2 m behind the cut) so every
  stage is readable; the real rooms are 26 m wide.
- Only seven lifeboats stand in the gaps between the funnels (inboard of where they hung); the real 20 hung at the ship's sides.
- Funnels are cylinders with no uptake casings inside the decks.
- Boiler room sizes and boiler counts per room are even splits.
- Callout claims "Second class had its own dining saloon aft of it" is from the Wikipedia D deck sentence plus my placement.
- Not checked: crew count, passenger counts per class, "largest ship afloat", the speed in service, the dining
  capacity (I removed the 550 figure I first wrote because I could not source it).

## Round two changes (inferred, for honesty)

- The whole ship is stretched 1.3x vertically (decks, funnels, masts) so each deck reads as a stage at a 32 degree
  camera; people are not stretched. Real proportions are therefore exaggerated in height.
- Rooms are only 4.4 m deep behind the cut (back wall at 3.4 m), props and people are compressed toward the cut plane.
- Hull ends (stern to 16 m, bow from 258 m) are whole; the starboard side steps down toward the middle. The starboard
  house wall remains only as four short stepped panels. Port-side (far) boat deck carries 10 lifeboats in davits, 7 more
  stand inboard on the near side and 3 collapsibles sit on roofs: 20 in all, positions inferred.
- Boiler rooms use an even split of the 29 boilers as athwartship drums with 2 or 3 furnace doors each (real boilers had
  3 per end); coal bunkers at room ends are schematic.
- The counter stern is not modelled; the stern is a rounded elliptical plan with a raised sheer.

## Round three changes (inferred, for honesty)

- Real proportions: the 1.3x vertical stretch is gone. Decks are 2.8 m apart (the real ship's were about 2.5 to 2.7 m, so this is a little generous), people are 1.8 m tall scaled by a per-person factor.
- Section plane: it leans back above the orlop deck (0.12 m per metre of height, 0.34 m per deck), so each deck's ceiling edge sits behind its floor edge and people a little way into the room are not hidden by the slab above. This is a drawing choice, not a ship fact.
- Rooms are about 6 m deep from their own cut edge to the back wall (the real ship is 28 m wide; the rooms are still stage sets, not the real plan). Upper decks are squeezed shallower by the leaning plane.
- Bunk and cabin rooms: a sitting person has no berth above them (a head would hit the deck above at 2.8 m); the next berth is a made-up pair.
- Counter stern: above the waterline the hull sweeps 5.2 m aft. The real Titanic had an elliptical counter stern; its exact rake is not sourced here.
- Portholes: three rows (12.6, 15.4, 18.2 m above the keel) every 2.7 m on every stretch of starboard hull that stands. Real counts and positions per deck are not sourced; the rows are for the look.
- Figures stand on a surface found in the room data (deck slab, carpet, step, berth top, landing). `plate.floatingFigures()` reports how many are not on one (tolerance 2 cm).

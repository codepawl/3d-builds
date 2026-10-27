# Watt steam engine: sources and what the figure takes from them

Read on 2026-10-12. Every fact in the page's caption is in this list with its source. Anything not listed
here is the figure's own choice and the caption says so.

## Sources

- Wikipedia, "Watt steam engine": https://en.wikipedia.org/wiki/Watt_steam_engine
- Wikipedia, "Parallel motion linkage": https://en.wikipedia.org/wiki/Parallel_motion_linkage
- Wikipedia, "Sun and planet gear": https://en.wikipedia.org/wiki/Sun_and_planet_gear
- Wikipedia, "Centrifugal governor": https://en.wikipedia.org/wiki/Centrifugal_governor
- Wikipedia, "Lap Engine": https://en.wikipedia.org/wiki/Lap_Engine
- Wikipedia, "Old Bess (beam engine)": https://en.wikipedia.org/wiki/Old_Bess_(beam_engine)
- Science Museum Group collection, https://collection.sciencemuseumgroup.org.uk/ : the object pages for the
  Lap engine and Old Bess answered 403 to a scripted request on this day, so nothing in the caption rests on
  them. The Wikipedia articles on the two engines cite them.

## Facts used in the caption

| Caption says | Source sentence | Source |
|---|---|---|
| The separate condenser was Watt's idea of 1765 | "In 1765, Watt conceived the idea of equipping the engine with a separate condensation chamber, which he called a 'condenser'." | Watt steam engine |
| patented in 1769 | "He cleared Watt's debts and funded the building of a prototype engine at Kinneil House, and helped him get his 1769 patent." | Watt steam engine |
| The condenser is kept cold while the cylinder stays hot | "The condenser remained cold and below atmospheric pressure at all times, while the cylinder remained hot at all times." | Watt steam engine |
| A jet of water condenses the steam and the air pump lifts the water out | "The condensate and the injected water was then removed by the air pump..." | Watt steam engine |
| Valves let steam in and then open the cylinder to the condenser, on both sides of the piston | "An arrangement of valves could alternately admit low pressure steam to the cylinder and then connect with the condenser."; the double-acting piston "produced power on both the upward and downward strokes" | Watt steam engine; Parallel motion linkage |
| A chain will not do for a piston that pushes | "...the piston produced power on both the upward and downward strokes, so a chain could not be used to transmit the force to the beam." | Parallel motion linkage |
| Parallel motion, 1784, a nearly straight line | "...a six-bar mechanical linkage invented by the Scottish engineer James Watt in 1784 for the double-acting Watt steam engine. It allows a rod moving practically straight up and down to transmit motion to a beam moving in an arc" | Parallel motion linkage |
| The planet gear cannot turn on the rod; with equal gears the shaft turns twice per double stroke | "...when both sun and planet have the same number of teeth, the drive shaft completes two revolutions for each double stroke of the beam instead of one." | Sun and planet gear |
| Invented by William Murdoch, patented by Watt in 1781, in place of the crank, which another patent covered | "It was invented by the Scottish engineer William Murdoch, an employee of Boulton and Watt, but was patented by James Watt in October 1781. It was invented to bypass the patent on the crank, already held by James Pickard." | Sun and planet gear |
| The flywheel evens out the strokes | "...serving as a flywheel which, once set in motion, by its momentum maintained a constant power and smoothed the action of the alternating strokes." | Watt steam engine |
| The governor, adapted by Watt in 1788, works the steam valve | "In 1788, James Watt adapted one to control his steam engine, where it regulated the admission of steam into the engine's cylinders."; "Watt linked a steam regulator valve to a centrifugal governor" | Centrifugal governor; Watt steam engine |
| Faster: balls out, throttle closes | "...this motion causes the lever arms to pull down on a thrust bearing, which moves a beam linkage, which reduces the aperture of a throttle valve." | Centrifugal governor |
| A heavier load settles a little slower (shown, not captioned) | "A simple governor does not maintain an exact speed but a speed range, since under increasing load the governor opens the throttle as the speed (RPM) decreases." | Centrifugal governor |
| "of the kind Boulton & Watt built in the 1780s" | The Lap Engine (1788) and the Whitbread Engine (1785) "represent survivors of the first engines to show all of Watt's major improvements in one." | Lap Engine |

Other things read and not used in the caption: Old Bess was built in 1777 as a water-returning pump engine and
is "the oldest surviving Watt engine", so it is not a rotative engine and is not the model for this figure. The
Lap Engine drove 43 lapping machines at the Soho Manufactory and, "according to the Science Museum, it was the
first steam engine to be fitted with a centrifugal governor".

## Geometry taken from the sources

- Parallel motion (the Wikipedia article's letters): A beam pivot, B half-way along the beam, C the beam end,
  BE and CD equal links, DE equal and parallel to BC, EG the radius rod to a fixed point G, F the middle of BE.
  "The figure-eight is symmetrical as long as arms AB and EG are equal in length, and straightest when the ratio
  of BF to FE matches that of AB to EG": the model has AB = EG = 50 and F in the middle of BE. The pantograph
  "guarantees that F always lies on a straight line between A and D", which a test checks. The article gives
  Watt's own deviation as "about one part in 4000"; the model's is 0.03 units in a 60 unit stroke (1 in 1900).
- Sun and planet: the planet is fixed to the connecting rod and held at a fixed distance from the shaft by a
  link; the rolling condition gives two turns of the sun per turn of the planet's orbit for equal gears.
- Governor: a conical pendulum, so the balls' drop below the pivot falls with the square of the speed.

## The figure's own choices (not facts about any one engine)

- All sizes, the speed (about 60 turns of the flywheel a minute in the figure) and the load and torque numbers.
  Settled figures from `test-model.mjs`, reread 2026-10-12: light load 63 turns a minute with the throttle 25 %
  open, middle load 60 turns and 49 %, heavy load 56 turns and 80 %; the speed moves by 9.7 % of nominal
  from light to heavy.
- The valve gear: a plug rod hung from the beam with pegs that trip the handles of four valves in two chests.
  The valve timing is a smooth changeover at each dead centre with no early cut-off.
- The air pump rod hangs from point F of the parallel motion; the governor is driven by a belt.
- The boiler is only an outline. The cold-water pump, the injection cock's linkage and the engine house are left out.

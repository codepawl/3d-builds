game-warehouse, port 5493. Shape: live app and film. Look: AAA real-time (An 2026-10-31, DIRECTION.md), PBR SimReady models.

# Rackline: a live automated pallet warehouse

Thesis: what happens between "order placed" and the pallet leaving on a truck? One building, every step visible.

## Real process (real numbers)

- Receiving: pallets leave an inbound trailer at the dock and wait in a staging lane.
- Put-away: a driverless forklift takes a pallet to a free slot in selective pallet racking (aisle about 3.5-4 m for a
  counterbalance truck, travel about 2-2.5 m/s, lift about 0.4 m/s).
- Order: seeded random arrivals, each order asks for N cases of one SKU.
- Retrieval: a forklift brings a pallet of that SKU from the rack to a pick station.
- Case pick: a gantry lifts cases onto a powered conveyor (about 0.5-1 m/s).
- Pack out: a second gantry stacks the order on an outbound pallet at the end of the line.
- Ship: a forklift loads the finished pallet into the outbound trailer. Order to ship time stops there.

## Parts

Racks, forklifts, conveyors, pallets, cases, barriers and walls: NVIDIA SimReady, CC BY 4.0, via codepawl/simready-glb.
Gantries, trailers and dock doors are not in the set: built from plain geometry, and the reply says so.

## Numbers, all from the sim

Orders per hour, order to ship minutes, rack fill percent, free forklifts. No typed numbers.

## Film (15-25 s, 1920x1080, one take, real cursor)

Open on the full cut-open building. Click a forklift, follow it with its path line as it lifts a pallet into the rack.
Click a pick station. Pull back to the outbound dock as a pallet leaves. At most one speed change. No stretch over 2 s
without movement. Sound from ElevenLabs only.

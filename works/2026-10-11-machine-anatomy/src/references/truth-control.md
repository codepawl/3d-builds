# Truth control

The figure must not say anything its sources do not support. Three things carry that: `facts.json`, the
text registry, and provenance marks on every drawn assembly. `node cli.mjs lint <folder>` checks them and
`build` refuses to write a page while lint fails.

## facts.json

```json
{ "facts": {
  "patent-resistance": {
    "text": "The carbon filament has a high resistance, 100 to 500 ohms.",
    "source": "https://patents.google.com/patent/US223898A/en",
    "quote": "offers from one hundred to five hundred ohms resistance",
    "status": "verified"
  },
  "model-values": {
    "text": "The volts and timings come from a small model with chosen values.",
    "source": "reference/notes.md",
    "note": "Chosen for the figure; only the resistance range is sourced.",
    "status": "inferred"
  }
} }
```

- `source`: a URL, or a file inside the machine folder (research notes for drawing choices).
- `verified` needs a `quote` read on the source page in this session. `inferred` needs a `note` saying
  how it follows.
- A source that could not be read (bot wall, 404) is not a source. Leave the fact out or mark it with a
  source you did read.

## Every visible text names facts

In `machine.mjs` a text that states anything about the machine is `{ text, facts: ["id", ...] }`: title,
page title, caption sentences, legend names and short names, steps, trace words, the path key, the
figure's aria label, the simplified notes. Readouts are templates (`readouts: [{ pattern, facts }]`); verify
checks every readout the page shows against them. Control labels, hints and instructions are UI text
(`ui`) and must not make claims.

Lint fails on:

1. a factual text with no fact, or naming an id facts.json does not have;
2. a fact with no source, no status, a verified fact with no quote, an inferred fact with no note;
3. any "first", "fastest", "only", "earliest", "largest", "invented" (and similar) in a text or a fact
   whose facts are not all `verified`; reword ("one of the first", or drop it) or verify it;
4. an assembly with no provenance mark, or a simplified one without a note;
5. visible page text (text nodes and aria labels) that no registered text covers, which means something
   bypassed the registry;
6. an initial readout that matches no template.

## Provenance of drawn parts

Every assembly in `machine.mjs` carries `provenance: { kind, facts, note? }`:

- `sourced`: drawn from a source that shows it (a patent figure, a museum photograph);
- `inferred`: shape follows from sources but is not shown in one;
- `simplified`: drawn simpler than the real part; `note` is a `{ text, facts }` sentence that the page
  shows in its short "Simplified:" line under the caption.

## Model tests stay mandatory

`test-model.mjs` tests the pure model against real values or invariants (a steady current equal to V/R,
a gear ratio, a closed linkage, the order of steps). A figure with no model tests is not finished.

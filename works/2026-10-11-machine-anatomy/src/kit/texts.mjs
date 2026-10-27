// The text registry. The page builder hands every visible text through it, so lint can check that each
// factual text names facts in facts.json, and that the page shows no text that bypassed the registry.
//   fact(entry)     a text that states something about the machine: { text, facts: ["id", ...] }
//   ui(text)        a control label, hint or instruction that states nothing about the machine
//   readout(text)   a live readout; it must match one of the machine's readout templates

export function createTextRegistry() {
  const entries = [];

  function fact(entry) {
    const normal = typeof entry === "string" ? { text: entry, facts: [] } : entry;
    entries.push({ kind: "fact", text: normal.text, facts: normal.facts ?? [] });
    return normal.text;
  }

  function ui(text) {
    entries.push({ kind: "ui", text });
    return text;
  }

  function readout(text) {
    entries.push({ kind: "readout", text });
    return text;
  }

  return { entries, fact, ui, readout };
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

export function numberWord(count) {
  return WORDS[count] ?? String(count);
}

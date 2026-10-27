import sys, pathlib
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
scan = pathlib.Path(sys.argv[1])
segments = {"pan 0-3s": range(0, 6), "zoom 3-6.5s": range(6, 13), "orbit 6.5-10s": range(13, 20)}
print("| preset | mean | pan | zoom | orbit |\n|---|---|---|---|---|")
for name in sys.argv[2:]:
    rows = {}
    for line in (scan / f"{name}.txt").read_text().splitlines()[1:]:
        parts = line.split()
        if len(parts) == 3: rows[int(parts[0])] = float(parts[1])
    values = [rows[i] for i in range(20) if i in rows]
    cells = [sum(rows[i] for i in r if i in rows) / len([i for i in r if i in rows]) for r in segments.values()]
    print(f"| {name} | {sum(values)/len(values):.2f} | " + " | ".join(f"{c:.2f}" for c in cells) + " |")

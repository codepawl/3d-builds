import sys, re, pymupdf
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
for path in sys.argv[1:]:
    document = pymupdf.open(path)
    page = document[0]
    print("==", path.split("/")[-1], "page", page.rect, "images", [(image[0], image[2], image[3]) for image in page.get_images()])
    for xref in range(1, document.xref_length()):
        try:
            text = document.xref_object(xref)
        except Exception:
            continue
        if "GPTS" in text or "LGIDict" in text or "/Viewport" in text or "/BBox" in text and "Measure" in text:
            print(xref, re.sub(r"\s+", " ", text)[:600])

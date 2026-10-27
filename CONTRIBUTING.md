# Adding a work

Each folder under `works/` matches one post on [@anxuanng](https://x.com/anxuanng). The folder holds what someone needs to understand and remake the piece.

```
works/<yyyy-mm-dd>-<slug>/
  README.md     what it is, the post link, how it was made, how to run it, design, assets and credits
  poster.jpg    one still, 1280 px wide, under 400 KB
  prompts.md    the prompts in order, in English
  design/       plan files, look notes, review notes
  src/          the code: app, film recorder, sound and Blender scripts
```

## Rules

- Add the folder and push it before the post goes out. Then reply under the post with the link to the folder.
- Do not add secrets, tokens, `.env` files, personal data or local paths.
- Do not add rendered videos, frame dumps, caches or `node_modules`.
- Add only assets you may share: your own work, CC0, CC BY with credit, MIT or similar.
  For every other asset, name it and say where to get it.
- Keep each file under 20 MB and each folder under 60 MB.
- Before you commit, run `gitleaks dir works --no-banner`.

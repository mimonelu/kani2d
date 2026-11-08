# Kani2D

A browser-based editor for drawing pictures by placing 2D tiles.

## Features

- Place square and right-triangle tiles from a 125-color palette
- Layers with visibility toggles, reordering, duplication and deletion
- Save and load drawings as `.ka2` files
- Export PNG images with a custom tile size and optional anti-aliasing
- Undo / redo and autosave

## Controls

| Action | Input |
| --- | --- |
| Select a tool | Tool buttons in the sidebar, or B (Draw) / E (Erase) / I (Pick) / H (Pan) |
| Select a shape | Shape buttons in the sidebar |
| Place a tile (in the selected shape) / recolor a tile | Draw: left click or drag |
| Rotate a tile | Draw: left click a tile of the selected color |
| Remove a tile | Erase: left click or drag, or right click or drag with any tool |
| Pick a tile's shape and color | Pick: left click, or Alt (⌥) + click with any tool |
| Zoom | Mouse wheel |
| Pan | Pan: left drag, or Space + drag with any tool |
| Undo / Redo | Ctrl (⌘) + Z / Ctrl (⌘) + Shift + Z |

## Development

Requires Node.js 22.23.4 (see `.nvmrc`).

```sh
npm install
npm run dev        # start the dev server
npm test           # run unit tests
npm run build      # type-check and build into dist/
```

Pushing to `main` deploys the app to GitHub Pages via GitHub Actions.

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
| Place a tile / recolor a tile | Left click or drag |
| Rotate a tile | Left click a tile of the selected color |
| Remove a tile | Right click or drag |
| Zoom | Mouse wheel |
| Pan | Space + drag |
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

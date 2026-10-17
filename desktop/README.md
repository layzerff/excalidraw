# Local Canvas desktop — P0 milestone

[图文功能对比与需求状态](../README.md) · [下次迭代完整清单](NEXT-ITERATION.md)

Local-first Windows/macOS app built with the official `@excalidraw/excalidraw` React component, Electron and SQLite. This directory lives in the Excalidraw fork; it is an independent npm project and does not change the upstream editor packages.

## Run

Requires Node 24.13+ (or Node 26) for the storage tests; Electron bundles its own Node/SQLite runtime.

```sh
cd desktop
npm ci --workspaces=false
# If npm blocked the Electron binary download:
node node_modules/electron/install.js
npm run build
npm start
```

`npm run dev` previews the UI only. Use `npm run build && npm start` for filesystem persistence. No server, subscription, account, or Excalidraw+ endpoint is required.

## Included

- Unmodified official Excalidraw editor: drawing, text, arrows, freehand, frames, library and standard editor controls. Fonts are bundled locally. A library is saved with its whiteboard.
- Nested file tree, document/folder creation, rename, move, document switching and recoverable deletion. A folder must be empty before deletion. No document-count or folder-count quota.
- SQLite WAL with FULL synchronous commits, revision-conflict protection, 500 ms debounced saves, at most 2 s between saves during continuous edits, synchronous flush before switching and closing. Failed saves remain dirty and show an error. OS/process crashes can lose changes not yet committed, at most the debounce/max-wait window under normal operation.
- Restore last active document and viewport on restart. Every startup creates a dated workspace snapshot if that day's snapshot does not yet exist. Previous document snapshots are retained in SQLite (up to 30 per document, at most one per minute); the revision browser is a later milestone.
- Import `.excalidraw` or full `.canvas.json`; export both. Standard `.excalidraw` excludes custom navigation scenes; full documents and workspace backups include scenes, images and document library.
- Workspace backup to JSON; restore validates the tree and imports into a new folder with fresh document IDs. Existing documents remain intact. Active-document preference is not replaced when merging backups.
- Scene Manager: manually draw a region, capture current viewport, rename, drag to reorder, keyboard-accessible move-up button, redraw bounds, delete scene. Default 2.2-second navigation with 1.2/3.5/5-second alternatives, via official `updateScene` viewport fields and `CaptureUpdateAction.NEVER`. Pointer, wheel or Escape interrupts the animation.

## Data and recovery

Database: Electron `app.getPath('userData')/workspace.sqlite`; daily startup snapshots: `userData/backups/`. Development and packaged builds both use the `Local Canvas` profile under the operating system's application-data directory. Set `LOCAL_CANVAS_DATA` to an absolute dedicated directory for tests or an explicit profile.

Keep external backups on another disk. Daily snapshots on the same disk do not protect against disk failure. Importing a backup never overwrites the current workspace. Individual document payload limit is 100 MB, backup import file limit 500 MB; these are safety limits on a single operation, not document-count quotas.

## Checks and packaging

```sh
npm test
npm run build
npm run test:e2e
npm run pack       # current platform unpacked application
npm run dist       # macOS DMG/ZIP, or Windows NSIS/portable on Windows
```

The Electron test uses an isolated temporary profile, real editor pointer/keyboard interaction, and temporary files. It replaces only native file pickers with deterministic test paths. It verifies rectangle drawing, undo/redo, scene capture/title/order, animation interruption, switching, import/export, backup restore, shutdown save and restart recovery.

Windows installation and signing must be tested on Windows. macOS distribution requires an Apple signing/notarization identity for a normal public release. Current builds are development artifacts. The entire upstream monorepo test suite is independent and is not run by `desktop` scripts.

## Boundaries and remaining validation

- Renderer has no Node integration; preload exposes only allowlisted operations. IPC accepts only the current main frame. Remote HTTP/WebSocket requests, remote embedded frames and popup windows are blocked. Cloud collaboration, online library browsing, remote embeds and other network-dependent editor features are unavailable in this offline milestone.
- Large boards/image-heavy workloads, IME text input, touch/pen, clipboard image permissions and exhaustive native feature regression require wider device testing.
- Scene bounds currently adjust by redrawing the area; draggable edge handles/numeric precision controls are not implemented.
- Folder trees are expanded; collapse/search, revision browser and backup-retention settings are later improvements.
- Dependency audit after compatible overrides: 4 low production alerts in the Mermaid/KaTeX chain; no high/moderate production alerts at initial validation. Development dependencies have additional moderate alerts. Do not run forced dependency downgrades without regression testing.

## Licensing

Retain the repository root MIT `LICENSE` and `dist/EXCALIDRAW-LICENSE.txt`. `npm run build` generates and includes `THIRD-PARTY-NOTICES.md` from installed locked production dependencies. Fonts ship with their upstream license assets; Electron carries its own MIT and Chromium third-party notices. Packages that do not ship root license files are identified in the report and require a source-level license review before public distribution. No paid Excalidraw+ code or service is used.

Official references: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api and https://github.com/excalidraw/excalidraw/blob/master/LICENSE.

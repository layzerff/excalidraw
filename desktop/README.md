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
- Scene updates: 0.5-second option, compact rows, insertion markers, edge scrolling and a persistent split-panel toggle. Fullscreen presentation provides arrows, temporary ink with color/width, and clear/exit controls. Ink clears on scene changes and exit without modifying elements.
- PDF: entire board or one cropped page per scene, exported as high-resolution PNGs in landscape A4 pages (8192-pixel longest edge cap, up to 200 pages). Text is rasterized, not searchable. JSON remains the editable backup format.
- Fonts/library: bundled Excalifont, classic Virgil and Chinese Xiaolai fallback; font selection uses the original canvas font picker. Local `.excalidrawlib` import merges through the official API. Arbitrary custom font upload remains pending.
- Scene actions now live in a context menu; renaming edits the title inline, with Enter/blur to commit and Escape to cancel. The scene sidebar no longer contains library import or a total count.
- Temporary presentation ink uses a second independent official Excalidraw instance, including the native freedraw renderer and style controls. Its elements/history are never passed to document persistence and are cleared on page changes or destroyed on exit.
- A single top-right export icon opens scope and format options. Manually selected regions support PNG, SVG and PDF. Editable JSON and `.excalidraw` exports always retain the entire document, as stated in the menu.
- Autosave now reacts to content/style and document metadata changes, not viewport movement. Pan, zoom, scene animation and animation completion preserve the last manually saved viewport without writing new document revisions. The Save button and Cmd/Ctrl+S commit both current content and viewport; close/switch only flush pending content. Restart restores the last manually saved view.

## Data and recovery

Default macOS folder: `~/Library/Application Support/Local Canvas/`; default Windows folder: `%APPDATA%/Local Canvas/`. The Save Location panel shows the actual database and backup paths, including custom locations. Choose Change Workspace Location to migrate a consistent SQLite snapshot and backup folder to a new `Local Canvas` subfolder. Nonempty targets are rejected, original data is retained, and editing is blocked until restart. The profile's `storage-location.json` points to the migrated folder; a missing external drive causes a visible startup error rather than opening an empty database. Save As writes a portable full document to a chosen file and does not change the workspace database location.

Presentation always begins with the first ordered scene. The Layers button opens the same draggable scene list and context menu during fullscreen. Editing navigation is fixed at 500 ms; presentation controls offer 500/1000/1500/2000 ms for arrows and automatic playback. Automatic playback waits three seconds after each transition and stops at the last scene; opening Layers or the pen pauses it.

The workspace buttons use two fixed rows: create board/folder, then Save/Save As. Autoplay dwell now offers 1/2/3/5/10/15/30 seconds (default three), independently of transition duration. Changing dwell during playback restarts the current page's countdown.

Database: Electron `app.getPath('userData')/workspace.sqlite`; daily startup snapshots: `userData/backups/`. Development and packaged builds both use the `Local Canvas` profile under the operating system's application-data directory. Set `LOCAL_CANVAS_DATA` to an absolute dedicated directory for tests or an explicit profile.

Keep external backups on another disk. Daily snapshots on the same disk do not protect against disk failure. Importing a backup never overwrites the current workspace. Individual document payload limit is 100 MB, backup import file limit 500 MB; these are safety limits on a single operation, not document-count quotas.

## Checks and packaging

Windows x64 cross-build (NSIS installer plus standalone portable EXE):

```sh
npm run build
npx electron-builder --win --x64
```

The 2026-10-18 cross-build succeeded on macOS. Both NSIS embedded archives pass 7-Zip integrity tests; the application executable is x86-64 PE. These unsigned development packages still need Windows runtime validation. Portable means no installation is needed, not that data is stored next to the EXE: the default workspace remains `%APPDATA%/Local Canvas/` unless changed in Save Location.

```sh
npm test
npm run build
npm run test:e2e
npm run pack       # current platform unpacked application
npm run dist       # macOS DMG/ZIP, or Windows NSIS/portable on Windows
```

The Electron test uses an isolated temporary profile, real editor pointer/keyboard interaction, and temporary files. It replaces only native file pickers with deterministic test paths. It verifies rectangle drawing, undo/redo, scene capture/title/order, animation interruption, switching, import/export, backup restore, shutdown save and restart recovery.

Windows installation and signing must be tested on Windows. macOS distribution requires an Apple signing/notarization identity for a normal public release. Current builds are development artifacts. The entire upstream monorepo test suite is independent and is not run by `desktop` scripts.

macOS development builds now receive an ad-hoc integrity signature before archiving and must pass deep/strict signature verification. This does not replace Apple Developer ID signing or notarization. Extract the ZIP, move the app to Applications and open it; macOS may require approval in System Settings → Privacy & Security. Keep the existing Local Canvas data folder when replacing the application.

## Boundaries and remaining validation

- Renderer has no Node integration; preload exposes only allowlisted operations. IPC accepts only the current main frame. Remote HTTP/WebSocket requests, remote embedded frames and popup windows are blocked. Cloud collaboration, online library browsing, remote embeds and other network-dependent editor features are unavailable in this offline milestone.
- Large boards/image-heavy workloads, IME text input, touch/pen, clipboard image permissions and exhaustive native feature regression require wider device testing.
- Scene bounds currently adjust by redrawing the area; draggable edge handles/numeric precision controls are not implemented.
- Folder trees are expanded; collapse/search, revision browser and backup-retention settings are later improvements.
- Dependency audit after compatible overrides: 4 low production alerts in the Mermaid/KaTeX chain; no high/moderate production alerts at initial validation. Development dependencies have additional moderate alerts. Do not run forced dependency downgrades without regression testing.

## Licensing

Retain the repository root MIT `LICENSE` and `dist/EXCALIDRAW-LICENSE.txt`. `npm run build` generates and includes `THIRD-PARTY-NOTICES.md` from installed locked production dependencies. Fonts ship with their upstream license assets; Electron carries its own MIT and Chromium third-party notices. Packages that do not ship root license files are identified in the report and require a source-level license review before public distribution. No paid Excalidraw+ code or service is used.

Official references: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api and https://github.com/excalidraw/excalidraw/blob/master/LICENSE.

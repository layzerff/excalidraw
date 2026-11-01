# Local Canvas desktop · v0.5.0

[全彩动图功能说明](../README.md) · [下次迭代完整清单](NEXT-ITERATION.md)

Local-first Windows/macOS app built with the official `@excalidraw/excalidraw` React component, Electron and SQLite. This directory lives in the Excalidraw fork; it is an independent npm project and does not change the upstream editor packages.

## 主要功能

- 填充密度实时调节斜线/交叉线，保留原有图形的坐标、尺寸与填充样式。矩形、圆、菱形、直线、画笔和球标分别继承各自的密度；密度不建立专用撤销记录，普通绘图仍使用原生撤销。
- 设置中的滚轮缩放步长提供 5%–50%、每档 5%；触控板仍按移动量连续缩放。偏好重启保留。
- 素材库手动关闭，多选素材后在鼠标位置右键导出或确认删除。搜索下方两个操作等宽排列，“打开网页素材库”位于在线素材库底部。

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

`npm run web:start` serves the built browser UI with the NAS SQLite service; see [NAS deployment](web/README.md). `npm run dev` previews the UI only without that service. Use `npm run build && npm start` for filesystem persistence. No server, subscription, account, or Excalidraw+ endpoint is required.

## Navigation and integrations

- Double-middle-click fits all elements and enables the hand tool; pan and double-middle-click at a target to restore the previous editing zoom. Browsing does not autosave content.
- The toolbar order button enables drag reordering without activating tools; click it again to finish. Order persists across boards and restart.
- The left search field highlights matching board text and supports literal text, Chinese full pinyin, initials and mixed pinyin. Cmd/Ctrl+F focuses it; click a result to locate it.
- Settings offers Simplified Chinese/English for the shell and native editor. Document text and user titles are preserved.
- Generic HTTPS pages load only after per-document-session approval. Generic frames omit `allow-same-origin`; some websites will not function in this isolation. Official YouTube/Bilibili players retain their adapters and scene-change pause behavior. External sites may block embedding; use Open in browser.
- The small online/offline dot reflects authenticated WebDAV endpoint checks, not the operating system network indicator. Unconfigured or failed connections are offline; configured endpoints are rechecked about every minute. Its menu shows WebDAV status and offers testing and Sync now, which uploads a new full backup without two-way merging or overwriting remote files.
- WebDAV configuration is available only in Settings. The native library panel offers browser browsing and local import. Packaged desktop catalog callbacks use `localcanvas://` with a session token, explicit install confirmation, fixed official download hosts, a 50 MB download cap, and a 30-second timeout. Developer launches may lack OS protocol registration; download/import is the fallback. Web callbacks use the NAS page hash and the same confirmation and server-side source validation.

- The library panel separately searches asset names, user tags and internal text, including pinyin. Its expandable official online catalog loads packages on demand, generates local previews, and supports native drag/drop into the board. Save assets to use them offline. Names/tags persist in supported element customData and survive library export/import.
- Fill density is stored per shape in customData. A slider below native fill choices controls hachure/cross-hatch spacing (10–200%, 100% native default); solid fill remains unchanged. Preview updates are coalesced while dragging. The presentation ink panel exposes the same control without saving ink to the document.
- Balloon S/M/L/XL font presets are relative to the current balloon's usable interior and native text metrics. Ordinary text retains native absolute presets. The next balloon inherits the adjusted size.
- Wheel zoom is proportional and capped per event for finer steps, while keeping the native cursor anchor. During overview, right-click keeps the current viewport and returns to selection without opening a context menu.

## Included

- Three scene entry points: draw a fixed region, link currently selected elements/groups, or capture the current view. Linked scenes track official geometry bounds as content moves/resizes/rotates; group membership and element IDs persist with documents and workspace backups. Deleting linked elements cascades to their scenes; undoing deletion restores scenes during the same editor session. Redrawing a linked scene converts it into a fixed region.
- Trash supports restore and a separately confirmed Empty Trash action. Purging is transactional and removes trashed nodes, their revision rows and file-link settings. Associated disk files and existing backups remain untouched.

- Unmodified official Excalidraw editor: drawing, text, arrows, freehand, frames, library and standard editor controls. Fonts are bundled locally. A library is saved with its whiteboard.
- Nested file tree, document/folder creation, rename, move, document switching and recoverable deletion. A folder must be empty before deletion. No document-count or folder-count quota.
- SQLite WAL with FULL synchronous commits, revision-conflict protection, 500 ms debounced saves, at most 2 s between saves during continuous edits, synchronous flush before switching and closing. Failed saves remain dirty and show an error. OS/process crashes can lose changes not yet committed, at most the debounce/max-wait window under normal operation.
- Restore last active document and viewport on restart. Every startup creates a dated workspace snapshot if that day's snapshot does not yet exist. Previous document snapshots are retained in SQLite (up to 30 per document, at most one per minute); the revision browser is a later milestone.
- Import `.excalidraw` or full `.canvas.json`; export both. Local Canvas attaches scenes and libraries in an additional `localCanvas` metadata field when exporting `.excalidraw`; other editors may ignore that field; full documents and workspace backups include scenes, images and document library.
- Workspace backup to JSON; restore validates the tree and imports into a new folder with fresh document IDs. Existing documents remain intact. Active-document preference is not replaced when merging backups.
- Scene Manager: manually draw a region, capture current viewport, rename, drag to reorder, context-menu move-up, redraw bounds and delete scene. Editing navigation is fixed at 0.5 seconds; presentation offers 0.5/1/1.5/2 seconds, via official `updateScene` viewport fields and `CaptureUpdateAction.NEVER`. Pointer, wheel or Escape interrupts the animation.
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
- Folder trees support collapse; tree search, revision browser and backup-retention settings are later improvements.
- Dependency audit after compatible overrides: 4 low production alerts in the Mermaid/KaTeX chain; no high/moderate production alerts at initial validation. Development dependencies have additional moderate alerts. Do not run forced dependency downgrades without regression testing.

## Licensing

Retain the repository root MIT `LICENSE` and `dist/EXCALIDRAW-LICENSE.txt`. `npm run build` generates and includes `THIRD-PARTY-NOTICES.md` from installed locked production dependencies. Fonts ship with their upstream license assets; Electron carries its own MIT and Chromium third-party notices. Packages that do not ship root license files are identified in the report and require a source-level license review before public distribution. No paid Excalidraw+ code or service is used.

Official references: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api and https://github.com/excalidraw/excalidraw/blob/master/LICENSE.

## Appearance and navigation

Choose GitHub, Reddit, VS Code or Notion in the header. Each style has matching shell colors, directory icons, radii and subdued tree highlights; the fixed 20px colored palette icon remains identical. Appearance and independent left/right sidebar preferences survive restart. The heading/status and action group align separately. Double middle click on the drawing surface fits all whiteboard content into the viewport without autosaving. Indented row highlights stay to the right of their guide line, without an inset crescent marker.

The custom native menu keeps Open, Search, Help, Clear, canvas dark mode/background and the project GitHub link. Save/Save As remain in the workspace; the unified export icon remains top right. Help's four external header links are hidden; native platform-specific shortcut labels remain. Cmd/Ctrl+S saves, Cmd/Ctrl+Shift+S opens Save As and Cmd/Ctrl+Shift+E opens unified export. Mac labels were checked on the packaged app; Windows labels were checked with a Win32 navigator simulation, not a Windows runtime test. `node tests/appearance.e2e.mjs` covers these changes and verifies that theme changes do not modify whiteboard data.

## File workflow and UI

The shell uses a GitHub/Primer-inspired light palette and grouped action menus. Row menus contain actions only; Rename and Move open separate anchored forms with Cancel and explicit confirmation. Choosing a target folder alone does not move a board. Trash has its own confirmation and retains recoverability. Native drawing colors, handwriting data, storage formats and presentation functionality are unchanged. `node tests/workspace.e2e.mjs` exercises the menu and workspace flows; the full regression is `npm run test:e2e`.

Mac icon generation (`node scripts/icons.mjs`, macOS with Swift/AppKit and sips) uses `build/app-icon-mac.png` for legacy ICNS optical layout; the in-app PNG and Windows ICO retain the original full artwork. Generated assets are committed, so Windows packaging does not require Swift. See LOGO.md for the source and platform layout details.

Right-click the workspace root or an existing folder to create boards/folders. Directory text is consistently 13px, with folder names at weight 600; the chevron collapses children. Row context menus stay at the click location, and drag-and-drop moves items into folders or back to the root. Logical workspace moves do not move external files.

Open File uses the native picker and retains the source association. Save As chooses and associates a new standalone file; manual Save/Cmd+S writes contents and viewport back to that file. Automatic content saves remain in SQLite for local recovery and do not silently modify external files. If the associated file changes externally, manual saving refuses to overwrite it; Save As resolves the conflict. File Info beside the title shows the path, rather than permanently displaying it in the sidebar. File associations are local settings, not imported with workspace backups.

## Local preview additions

- Videos use native embeddable geometry/selection, with an always-visible official iframe and a top drawing-toolbar entry. Single click near the edge selects it, native handles resize it, Delete removes it, and Undo restores it. Double-click its center for player interaction; presentation permits direct player control. There is no full-canvas player overlay.
- Automatic layout works on a rectangle selection or the current element selection: vertical, horizontal or grid, configurable gaps, preserving groups, frame contents and bound labels. Optionally creates a linked scene for the arranged elements. Complex externally bound connectors may need manual checking after layout.
- WebDAV has an expandable setup explanation next to its heading. Desktop credentials remain OS encrypted; NAS credentials use the service data-directory key.
- The browser edition shares the renderer and file formats, with server-acknowledged SQLite saves, conflict protection, downloadable backups and document import. It is a single-user service, not collaborative cloud editing. See the NAS guide for storage paths and browser file-save limits.

## Numbered balloons and UI alignment

The numbered balloon button uses the native toolbar icon dimensions. Enabling it opens the official ellipse property panel and a next-number input. Each click inserts a native ellipse with centered bound text and a shared group ID, using the editor's current text font and stroke/fill settings. Escape exits placement. The next value persists with full documents, native Local Canvas metadata and workspace backups; undo/redo affects the inserted elements, not the next counter.

See [UI alignment standards](UI-STANDARDS.md) for future controls. Round balloons use circle properties; rounded-corner controls are not applicable to circles.

## Presentation, overview and updates (local preview)

The presentation ink editor stays mounted across scene transitions and synchronizes a viewport only for active user interaction, avoiding the old initial-view feedback. Deleting a member of an element-linked scene removes that scene, with a dismissible explanation; undoing the element deletion restores its scene during the same editing session.

Balloon resizing updates the document's insertion width, height and text size. New balloons keep those dimensions until another balloon is manually resized or the setting is reset.

Double middle-click fits all content and switches to the hand tool. Double middle-click at the target restores the previous editing scale. The official component's native minimum zoom and percentage label are adapted in `scripts/zoom-patch.mjs` for the locked 0.18.1 build; the build fails if the expected sites change. Positive zoom is retained, with a 0.05% guard, and no negative-scale/mirroring semantics. Extremely large visible scenes can still render slowly.

Click the top-left logo for settings: themes, reduced motion, default read-only, cascade notices, storage/WebDAV shortcuts, balloon size reset and GitHub updates. The desktop updater reads only this fork's GitHub Releases, filters stable/prerelease channels, refuses downgrades, chooses platform assets and verifies SHA-256 plus size. Auto-check is enabled by default; auto-download is opt-in. Windows installer launch saves the workspace first; Windows portable and the current ad-hoc Mac builds reveal the verified package for manual replacement. No downloaded package is executed without the user choosing the installation action. Web/NAS deployments remain administrator-managed container updates.

The updater uses GitHub asset `digest` or `SHA256SUMS.txt`; release publishers must include current installers and SHA-256 metadata. No `latest.yml` is needed for this direct Release implementation. Properly signed Mac automatic replacement remains a later integration; Windows actual installer execution has not been tested on this Mac.

### 本地素材库位置

素材默认保存到工作区 `materials/library.json`，在素材面板点“素材保存位置”可查看路径并迁移，保留旧文件并拒绝覆盖已有库。素材跨文档共享；已有文档首次打开时合并其中素材一次，之后删除不因重开旧文档而恢复。本地根目录和文件夹支持右键管理，删除文件夹将内容移回上级。NAS 版通过容器 `/data` 映射管理路径。

字号比例保留 S/M/L/XL，在其下显示 10–100% 滑块与数字输入；绑定文字按容器空间计算，自由文字把当前尺寸对应到 50% 档（100% 对应该尺寸的两倍），调整后新文字继承实际字号。

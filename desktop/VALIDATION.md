# Milestone validation — 2026-10-17

## 0.4.0 — 2026-10-25

- Production build and all 15 unit/resource checks passed. New checks cover four complete theme definitions, safe preference fallback, readable text contrast and center-preserving 100% zoom.
- Actual final Mac arm64 packaged application passed `appearance.e2e.mjs`: four themes without document/revision mutations, per-theme directory icons, identical fixed 20px palette, aligned header controls, computed subdued tree backgrounds, independent sidebars and restart persistence, real double-middle-click 100% zoom without autosave, custom menu and removal of Help header links. Mac shortcut labels and simulated Win32 navigator labels were checked; the latter is not a Windows runtime test.
- Packaged workspace regression passed directory ancestors, move/restart, menus/forms, indentation, transparent logo corners, read-only pointer/Delete protection and automatic loop wrap/stop/persistence. The final tree highlight priority correction was separately checked by computed styles and screenshots in all four themes.
- Complete packaged regression is **not fully green**: attempts stopped at the previously observed native temporary-ink undo assertion, and two attempts at the reverse fullscreen scene drag. A subsequent slower real-pointer drag run passed the two directions but stopped at native ink undo. These failures remain open; no claim is made that this version fixes them. A separate diagnostic run excluding only the failing native-ink undo/redo block passed the later flows: native main-editor undo/redo, library import, file/export/import, PDF/region outputs, external-file conflict protection, backup/restore, storage migration, close flush and restart. That diagnostic pass cannot substitute for a full pass.
- Both Windows x64 NSIS and portable outer archives passed 7-Zip tests; Mac deep/strict ad-hoc signature passed. Bundled versions are 0.4.0, Mac ICNS matches source, and all 193 packaged JS/CSS files match byte-for-byte across Mac/Windows. MIT and third-party notices are present. No Windows runtime, Authenticode signing or Apple notarization.
- README theme and menu images are captured from the final running packaged application. The 0.4.0 logo silhouette is refined and alpha bounds are checked, but no fresh Finder side-by-side comparison was completed for this artwork.

## 0.3.0 — 2026-10-25

- Production build and 12 unit/resource checks passed, including regular/retina ICNS entries and decoded RGBA bounds for the Mac platform icon (transparent padding and approximately 832px artwork).
- Actual Mac arm64 packaged application passed the extended workspace regression: keyboard-triggered row-local menu, action groups without embedded fields, destructive styling, independent focused rename form, successful rename, non-empty-folder error in the popover, cancel without deletion, Home/End/Escape focus navigation, choosing a move target without moving until confirmation, ancestor highlighting, native read-only protection, looping presentation, uniform fonts and restart preferences.
- The first complete editor regression attempt stopped at the previously observed native temporary-ink undo assertion. A second full packaged run passed drawing/undo/redo, scene selection/reordering/navigation, fullscreen layers/autoplay/ink, file links/conflict protection, graphics/PDF/document exports/imports, backup/restore, migration, close-time flush and restart. This is not a claim that the underlying intermittent ink-history issue was fixed.
- Finder icon view on macOS 26.6.2 was inspected side-by-side with a system Calculator reference. The platform-specific ICNS showed comparable visible size and no obvious extra surrounding plate. The temporary reference link and task-created Finder window were cleaned up; no installed application was replaced and no icon cache was reset.
- Mac packaged ICNS matches the committed source; deep/strict ad-hoc signature verification and ZIP integrity checks passed. Windows main EXE, NSIS installer and portable launcher retain the approved custom icon, and both executable archive tests passed. All 193 packaged JS/CSS files match byte-for-byte between Mac and Windows. No Windows runtime test, Apple notarization or Authenticode signing.
- New menu screenshots are element captures from the running packaged app, not design mockups; overall and presentation/export screenshots were refreshed from actual regression runs.

## 0.2.2 — 2026-10-25

- Production build and all 11 unit/resource checks passed.
- Actual Mac arm64 packaged application passed `workspace.e2e.mjs`: loop off by default, wrap from last page to first while still playing, turning loop off stops at the last page, restart remembers the toggle without starting playback; read-only mode prevents real pointer drag and Delete from modifying native elements; transparent alpha at all four logo corners; larger SVG home/chevrons; existing nested-directory, ancestor-highlight, uniform-font and restart checks.
- Actual Mac packaged application also passed the full `desktop.e2e.mjs` regression on this iteration: native drawing and undo/redo, scene selection/order and animation, fullscreen layers/autoplay/native ink, graphic/PDF/document export and import, file links/conflict refusal, backup/restore, migration, close-time flush and restart. Earlier versions' intermittent native-ink undo failures remain historical observations; this is a passing run, not evidence that their underlying cause was fixed.
- Windows main EXE, NSIS installer and portable launcher contain the exact custom 256px PNG from the ICO; outer archive integrity checks passed. Mac ICNS matches the source and deep/strict ad-hoc signing passed. Windows runtime remains unverified; no Windows Authenticode or Apple notarization.
- Native tool-lock semantics were verified directly in the installed official Excalidraw 0.18.1 `LockButton` and Chinese locale: “绘制后保持所选的工具栏状态”. Independent read-only browsing uses official `viewModeEnabled`, not mass changes to element `locked` values.

## 0.2.1 — 2026-10-25

- Production build and 11 unit/resource tests passed (9 storage/navigation checks plus ICO/ICNS structure and sizes).
- `tests/workspace.e2e.mjs` passed on the actual macOS arm64 packaged application: two ancestor folders highlighted on launch, unrelated-folder click followed by reopening the active file, switching documents across branches, 28px indentation and two guide lines, moving the active document and restarting, uniform 14px controls/layers, and the loaded custom logo. Captured `workspace-021.png` and `presentation-021.png` from the running app.
- Windows main EXE, NSIS installer and portable launcher each contain the exact 256px PNG from the committed custom ICO. Mac bundled `icon.icns` is byte-identical to the committed ICNS. Both Windows executable archives passed integrity checks; Windows runtime and shell icon cache behavior remain unverified.
- Mac deep/strict ad-hoc signing passed; no Apple notarization or Windows Authenticode certificate.
- The broader `desktop.e2e.mjs` run stopped at the previously observed native presentation-ink undo assertion on two attempts. Earlier drawing, navigation, layers and uniform-control-font checks passed, but the full suite is **not green** in this iteration. This does not replace a complete regression pass; keep the ink-history issue open.

## 0.2.0 — 2026-10-20

- Production build and all 9 storage/navigation unit tests passed.
- Actual macOS arm64 packaged app passed the complete Electron regression: native drawing/undo/redo, scene selection/reordering, fullscreen layers/autoplay/native ink, export/import, backup/restore, closing and restart.
- New UI assertions passed: no top-level new-board button; root/folder context creation; folder icon and larger/bolder label; move menu; real file drag into a folder and back to root; keyboard sidebar resize; Save As file association; file-info path; manual write-back; external-change refusal preserving original bytes; system-picker reopening; migration and restart.
- Fast synthetic input during macOS fullscreen transitions produced intermittent scene-drag/ink-undo failures in preliminary runs. The packaged regression waits for the native fullscreen transition and new editor history baseline, and uses stepped real mouse input for scene drags. No claim is made that every transition-time race is resolved.
- macOS package version is 0.2.0; deep/strict ad-hoc signature verification passed. No Apple Developer ID notarization.
- Windows x64 NSIS installer and portable EXE built at 0.2.0; both outer archive integrity tests passed. Windows runtime remains unverified and no Authenticode certificate is configured.
- Real packaged screenshots updated under `docs/local-canvas/`; latest file-tree image is `files-current.png`.

Base: official Excalidraw fork `layzerff/excalidraw`, upstream commit `4c37956ba5f04ec342a9d9d5891a38f22c5b7b4e`. Implementation branch: `codex/local-canvas-p0`.

Validated on macOS Apple Silicon with Node 26.8.1, Electron 44.9.0 (Node 24.22.0, SQLite 3.53.4), React 18.3.1, official Excalidraw 0.18.1.

| Check | Result |
| --- | --- |
| Production renderer build | Passed |
| Storage and navigation unit tests | 9 passed |
| Real Electron editor regression | Passed |
| Built macOS application regression | Passed |
| Native rectangle / undo / redo | Passed |
| Scene region / capture view / title / order | Passed |
| Animated viewport and Escape interruption | Passed |
| Document switching and restart | Passed |
| Full document and standard Excalidraw export | Passed |
| Full document import | Passed |
| Workspace backup / non-overwriting restore | Passed |
| Close with pending save and recover on restart | Passed |
| Production dependency audit | 4 low; 0 moderate/high/critical |
| Windows build and runtime | x64 NSIS/portable cross-build and archive checks passed; runtime not run |
| Full upstream editor test suite | Not run; editor source unchanged |
| Public release signing and notarization | Not configured |

The desktop regression uses real pointer and keyboard events and real filesystem/SQLite operations. Native open/save dialogs alone are replaced with predetermined paths in the isolated test profile. Screenshot: `desktop/test-results/desktop.png` (generated, not committed).

Current deliverable is a runnable development milestone, not a signed public release. Follow-up coverage: text/IME, arrows, freehand, frames, image clipboard, library import, stylus/touch, very large boards, Windows installer and full native-feature regression. Scene-area adjustment is implemented by redrawing the region; precision handles are not yet implemented. All remote editor services are disabled.

## Scene/presentation update

Expanded real Electron regression verifies Excalifont/Virgil/Xiaolai font faces load offline, the 0.5-second option, real bidirectional handle dragging, sidebar hiding/showing, fullscreen enter/exit, temporary ink creation/clearing on next page and unchanged document elements. A compatible local library fixture is imported twice to verify deduplication, then retained through document export/import, backup restore and restart.

PDF smoke tests cover scene pages and the whole-board path; generated samples are under test-results/ for visual inspection. Current export rasterizes the board, so searchable text/vector output is not claimed. Third-party library testing covers the standard format fixture, not all remote catalogs and image dependencies. Windows, IME/stylus, huge boards and arbitrary user fonts remain unvalidated.

Final macOS packaged regression passed after the PDF scale correction, single top-right panel toggle and removal of the header font menu. Native text input was exercised with `ABCabc 中文手写` through the canvas font controls. Whole-board PDF and both scene pages were rendered with Poppler and visually inspected: complete lettering, correct board placement and no clipped content. The first scene intentionally contains no artwork; the second contains the rectangle. Current screenshots: `docs/local-canvas/desktop-current.png`, `docs/local-canvas/presentation-current.png`. All 9 storage/navigation tests passed.

## macOS archive integrity correction

The previous archive passed ZIP CRC checks but the application retained an incomplete Electron signature (`code has no resources but signature indicates they must be present`). The `afterPack` hook now ad-hoc signs the complete bundle and requires deep/strict verification before archives are created. The new ZIP was extracted into a fresh temporary directory; its application passes `codesign --verify --deep --strict` and the full real Electron regression. Ad-hoc integrity signing is not Developer ID certification or notarization, and does not establish Gatekeeper trust for downloaded apps.

## Context menus, native ink, export scope and save behavior

The final signed macOS bundle passed the expanded real Electron regression. Verified: scene context-menu rename/move, inline Enter commit and Escape cancellation, pointer-captured bidirectional ordering, removal of scene library import/count/action buttons, and Save located after the two create buttons in the workspace row.

Presentation uses the official native freedraw engine and native styling panel in an independent editor. Actual strokes, native undo/redo, color selection, page-change cleanup and exit were exercised; original document elements remain unchanged. No temporary editor data is connected to save/import/export/backup. Local library import regression now uses the original editor's file-drop path rather than the removed scene button.

The unified export menu was tested with full document, Excalidraw, whole-board PDF, scene PDF and a manually selected region. Region PNG dimensions are checked against the selected bounds (540 × 160 px for a 270 × 80 region at 2×); region SVG and PDF files are generated. PNG and rendered PDF were visually checked for complete Chinese/English lettering and correct cropping. Editable formats intentionally preserve the entire document.

Database revisions remain unchanged after interrupted scene animation, completed animation and wheel panning. Cmd/Ctrl+S and the workspace Save button commit the current view. A subsequent pan followed by a real shape color edit autosaves the changed color while retaining the previously manually saved viewport. Existing switching, restart, backup/restore and close-time content flush checks still pass. All 9 storage/navigation unit tests passed. Developer ID notarization and Windows runtime testing remain outstanding.

## 2026-10-18 presentation and storage regression

Expanded real Electron tests repeat clicks on the active whiteboard and press Save before entering fullscreen, reproducing the old API-null trigger. Navigation and presentation remain operational. The editing sidebar has no duration selector; presentation starts at the first scene and exposes exactly 500/1000/1500/2000 ms. Actual autoplay advances to the final scene and stops. The fullscreen Layers panel is exercised with real bidirectional pointer dragging and context-menu inline renaming. Native ink drawing, undo/redo and original-document isolation remain covered after these actions.

Save As produces a full document containing scenes. The actual storage-location panel is checked against the isolated test profile. The test migrates the workspace and backups through the UI, closes the application while editing is locked, relaunches using the profile's storage-location pointer, and verifies the active document's scene/text data and new displayed database path. The original workspace is retained; nonempty destinations are rejected by the implementation. External-drive disconnect/reconnect and Windows runtime validation remain outstanding.

Final result: the signed macOS packaged application passed the complete expanded desktop regression, including actual fullscreen-layer dragging, first-page entry, auto advance/stop, repeated-document-click recovery, native undo/redo, Save As and storage migration across restart. All 9 storage/navigation unit tests also passed. Updated real screenshots are stored under docs/local-canvas/.

Save/dwell refinement adds actual button bounding-box assertions: Save lies below the create row and aligns vertically with Save As. The autoplay test confirms a default three-second dwell, selects one second, and observes automatic advancement and stopping at the last page, separately from the selected 500 ms movement duration.

## Windows x64 cross-build — 2026-10-18

Built with `npm run build` followed by `npx electron-builder --win --x64` on macOS Apple Silicon. Electron 44.9.0 Windows x64 runtime was bundled successfully. Outputs: NSIS installer (126,703,552 bytes) and portable EXE (126,536,621 bytes). Both outer NSIS archives pass 7-Zip integrity tests. The unpacked application executable is PE32+ x86-64; app.asar contains 449 entries, including main/preload scripts, 238 WOFF2 fonts, Excalidraw MIT license and third-party notices. PE certificate tables are empty (no Authenticode signature). No Wine/Windows host was available, so actual installation/startup, input methods, fullscreen, PDF printing and storage migration on Windows remain unverified.

The installer's embedded `app-64.7z` was extracted and its integrity test also passed (73 files, 408,086,267 uncompressed bytes). Copies placed in task outputs have matching SHA-256 values: installer `26648d197c7b01d16c267ac3691762c71d65ebd2cb9bdba3cea01da6eb7a010b`; portable `de3e42a3504c3d9de00d819f08402e469ce6656a2d08a1068762020db277df5d`.

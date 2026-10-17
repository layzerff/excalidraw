# Milestone validation — 2026-10-17

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
| Windows build and runtime | Not run on this macOS host |
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

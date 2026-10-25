# Canvas logo — 0.4.1

## 0.4.1

Replaced the artwork using the user's new blue-border/yellow-crosshatch Canvas reference. The built-in image editing tool retained the handwritten style, enlarged/boldened the word slightly and requested true alpha outside the rounded outline with an opaque white interior. This is a raster edit, not a claim of pixel-identical reconstruction. Source: `build/app-icon.png`; local preview: `../docs/local-canvas/logo-local.png`. ICO/ICNS are mechanically regenerated; Mac optical bounds use the same visible-alpha threshold as validation so nearly transparent edge pixels do not shrink the apparent artwork.

Final built-in editing prompt:

> Use case: precise-object-edit. Asset type: replacement PNG app icon. The attached image is the edit target, NOT merely a style reference. Preserve this exact hand-drawn Canvas logo: irregular blue rounded-square border, yellow diagonal crosshatch strokes, opaque white interior, and blue handwritten lettering. Keep the original line texture, stroke positions, proportions, colors and exact handwriting letter shapes. Text verbatim: Canvas. Make only these changes: make the existing Canvas lettering slightly bolder (about 10%) and slightly larger (about 7%), centered, without changing its handwritten font or making it black; remove the white background OUTSIDE the rounded blue outline so all four outer corner areas have genuine alpha transparency. Clip any yellow line fragments outside the outline. Keep the white interior opaque. Do NOT redesign the corner shape, straighten the hand-drawn strokes, recolor, add shadows, add symbols, add a border plate, or add text. Keep the complete blue border inside the image with just 1% transparent safety margin and no edge clipping. Flat square PNG, faithful to the attached target.

## 0.4.0 history

Input: user-supplied Canvas logo reference and the 0.2.1 derivative, 2026-10-25. The built-in image editing tool preserved the blue crosshatch and black handwritten Canvas word, changed the border to black, enlarged the lettering slightly and applied an approximate Apple-style continuous-corner app-icon silhouette. Outside corners are genuinely transparent, not a white corner backdrop. This is not the Apple symbol or a claim of exact proprietary mask geometry. No CLI image generation API was used.

Project source: `build/app-icon.png` (1024px). Platform assets: `build/app-icon.ico`, `build/app-icon.icns`. README preview: `../docs/local-canvas/logo.png`. `node scripts/icons.mjs` performs deterministic size/format conversion on macOS using sips; it does not generate or redraw the design. These committed assets let Windows builds run without macOS conversion tools.

0.4.0 refines the outer silhouette to remove clipped corner transitions and keeps a small transparent safety margin so antialiasing is not cut off. The built-in image editing tool preserved the blue crosshatch, black lettering and substantial black border. `scripts/mac-icon.swift` measures alpha bounds before mechanically fitting the artwork into an 832px area centered on a 1024px transparent canvas; it avoids accumulating the source margin as extra platform padding. `scripts/icons.mjs` builds the ICNS including regular small-size entries. This platform padding is not added to the in-app PNG or Windows ICO. The earlier 0.3.0 Finder size comparison is historical evidence, not a fresh Finder inspection of this artwork.

Final editing prompt:

> Use case: precise-object-edit. Edit target is the Canvas app logo. Keep the exact black handwritten Canvas lettering, light blue diagonal crosshatch, white interior, substantial black outline and all overall styling. Repair ONLY the outer silhouette and corners: make all four corners smooth, symmetric Apple-style continuous app-icon corners with no flat cutoffs, kinks, straight clipped corner segments or abrupt tangent changes. The entire black outline and antialiasing must be INSIDE the image, with a very small transparent safety margin (about 1 percent). Outside the rounded shape must have true alpha transparency. No shadows, new text, symbols, mockups or recoloring. Output square flat icon.

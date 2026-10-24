# Canvas logo — 0.2.1

Input: user-supplied Canvas logo reference, 2026-10-25. The built-in image editing tool preserved the blue crosshatch, black handwritten Canvas word and rounded shape while thickening and darkening the teal border. No CLI image generation API was used.

Project source: `build/app-icon.png` (1024px). Platform assets: `build/app-icon.ico`, `build/app-icon.icns`. README preview: `../docs/local-canvas/logo.png`. `node scripts/icons.mjs` performs deterministic size/format conversion on macOS using sips; it does not generate or redraw the design. These committed assets let Windows builds run without macOS conversion tools.

Final editing prompt:

> Use case: precise-object-edit. Asset type: desktop app logo. Input image is the edit target. Preserve the hand-drawn blue diagonal crosshatch, white interior and exact black handwritten word "Canvas" (C a n v a s), original character forms and layout. Change ONLY the outer rounded rectangle border: make it about twice as thick as the reference, darken its teal to approximately #377F89 while retaining its subtly hand-drawn, rounded style. Keep the logo flat, no shadows, gradients or mockup. Deliver a square, high resolution app icon with the rounded rectangle centered, a small white outside margin, preserving all of the reference logo design. Do not add any other text or symbols.

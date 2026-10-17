# Guidelines

- For new DOM/browser API usage, use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node's `ownerDocument` and its `defaultView`.
- When overriding properties of an existing type, prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<Base, keyof Overrides> & Overrides`.

## Local Canvas documentation sync

- User request: keep README focused on differences from upstream Excalidraw and real screenshots. Put detailed requirements, bug explanations and history in desktop/NEXT-ITERATION.md, desktop/CHANGELOG.md and desktop/VALIDATION.md, linked from README.
- Maintain the root `README.md` as the fork overview; retain upstream introduction in `README.upstream.md`. Keep detailed requirements and acceptance criteria in `desktop/NEXT-ITERATION.md` and desktop run instructions in `desktop/README.md`.
- Distinguish shipped/validated, partially supported/unverified, planned, and proposed defaults. Do not present roadmap mockups as completed functionality or official upstream screenshots as fork screenshots.
- Store real UI screenshots and clearly marked planned-feature diagrams under `docs/local-canvas/`, with alt text and portable repository links. Refresh visuals when the visible feature changes materially; text-only changes can reuse a still-accurate visual.
- When publishing an authorized update, sync documentation to the development branch and the default branch README. Default-branch sync is documentation-only until application changes are explicitly merged. Check both remote heads first and use fast-forward updates; preserve unrelated changes.
- If GitHub publication fails, preserve the local documentation and report the sync status. This convention applies when working on this repository; it is not a background scheduled job.

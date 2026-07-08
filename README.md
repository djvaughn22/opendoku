# SnowDoku (snowdoku.com)

Winter brain games in Roman numerals — born as an iDontCry idea, built
through StepInTheRing.com. One static file, no build step.

- **Fresh Tracks** — sudoku where every tile is two puzzles at once
  (numeral + winter sport). Four slopes: 🟢 bunny-hill tutorial,
  🔵 4×4, ⚫ 9×9 black diamond (nine sports, both sudoku-valid),
  ⚫⚫ Slopestyle, where athletes ski to their tiles.
- **Avalanche** — drop-and-merge I→X with sport powers.

Source of truth for the game file: `~/WatchedNotWatched/index.html`
(also embedded at idontcry.com/snowdoku). To update: copy the file here
and push — Vercel deploys `main`.

## Building the next doku (the engine seed pattern)

SnowDoku is the first game on the Open Mirror Puzzle Engine. The engine is
this one file — deliberately: one static file deploys anywhere, embeds
anywhere, works offline, and has zero dependencies to break.

To create SuitDoku / DogDoku / BibleDoku / ColorDoku / etc.:

1. Fork `index.html`. Everything themeable sits in the **THEME ZONE** at the
   top of the script: `GAME` (name, domain, tagline, sub, brand emoji),
   `SUITS` (tile categories — 9 needed for the 9×9 board), `ROMAN` (glyph
   track — 10 glyphs: 9 board + 1 merge cap). The hero, title, and bar all
   render from `GAME`.
2. Swap the suit color variables in `:root` / `[data-theme="light"]` and the
   difficulty labels in the how-to copy.
3. Regenerate `/icons` + `manifest.json` for the new brand.
4. Everything below the THEME ZONE is theme-agnostic engine: board
   generators (incl. the base-3 orthogonal 9×9 construction),
   unique-solution enforcement (`countSolutions`), validators
   (`conflicts`/`completable`), the strikes system, the 💡 coach,
   save/resume (`sd_ft_save`/`sd_av_save`), the drop-clock arcade mode,
   theming, PWA wiring, and embed support.

## App-store readiness checklist

- [x] Offline play (service worker)
- [x] Installable PWA (manifest + icons)
- [x] Save/resume for both games
- [x] Unique-solution puzzle generation (blue + black)
- [x] Reset progress
- [x] Reduced-motion support
- [x] No paid APIs, no accounts, no analytics
- [ ] Daily puzzle mode (seeded deal-of-the-day)
- [ ] Puzzle pack (100+ pregenerated deals)
- [ ] Capacitor/TWA wrappers (see APP-STORES.md)

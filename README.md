# OpenDoku — the puzzle-games family (opendoku.com · snowdoku.com)

Born as an iDontCry idea, built through StepInTheRing.com. Every game is one
static file — no build step, works offline, embeds anywhere.

## The games

- **⛷️ SlopeDoku** (`/slopedoku/`, snowdoku.com redirects here) — winter brain
  games in Roman numerals. *Fresh Tracks*: sudoku where every tile is two
  puzzles (numeral + winter sport), four slopes from 🟢 bunny hill to ⚫⚫
  double black (two full sudokus at once). *Avalanche*: drop-and-merge I→X
  against the clock, with named storm stages, richer tiles per level, and a
  top-5 board.
- **🌞 SurfDoku** (`/surfdoku/`) — the beach remix: *Low Tide* + *Riptide*
  (tide stages Ripple→Open Ocean). Same engine, different weather.
- **⛏️ MineDoku** (`/minedoku/`) — mine the numbers that don't belong; every
  row and column adds to its target. Four depth tiers with 🔥 heat scaling,
  🔦 Lantern memory digs, ⚠️ Cave-In chain runs. **First game published by
  the StepInTheRing Game Engine.**

## Source of truth — every surface serves from THIS repo

Push to `main` → Vercel deploys opendoku.com + snowdoku.com.
idontcry.com/snowdoku **iframes** `https://opendoku.com/slopedoku/` directly —
there are no game copies anywhere to sync. Never copy game files into other
repos; that recreates drift.

## Building the next doku

Two paths:

1. **The Game Engine (preferred):** `_templates/*.html` are complete,
   theme-driven games with `__DOKU_THEME__` + `__DOKU_HEAD__` marker blocks.
   The StepInTheRing Game Engine (stepinthering.com/engines?engine=game)
   swaps the theme, writes the game folder, inserts a homepage card above the
   `__DOKU_CARDS_END__` marker in index.html, commits, and pushes — a real
   deploy. `_templates/sum-mine.html` (MineDoku's engine) is the first
   template; any new game built with the marker blocks becomes a template.
2. **Fork by hand:** slopedoku/surfdoku share a THEME ZONE (`GAME`, `SUITS`,
   `ROMAN`) at the top of the script; everything below is theme-agnostic
   engine (generators, unique-solution enforcement, validators, strikes,
   💡 coach, save/resume, drop-clock arcade, theming, PWA, embed support).

**Game doctrine (applies to every doku):** mobile-first always; the board
always tells the player what to do next (goal line on every deal, live
guidance when stuck, win/next flow visible without scrolling); one easy rule
per game, then a named climb; records and high scores on every mode.

## App-store readiness checklist

- [x] Offline play (service worker)
- [x] Installable PWA (manifest + icons)
- [x] Save/resume
- [x] Unique-solution puzzle generation
- [x] Reset progress
- [x] Reduced-motion support
- [x] No paid APIs, no accounts, no analytics
- [ ] Daily puzzle mode (seeded deal-of-the-day)
- [ ] Puzzle pack (100+ pregenerated deals)
- [ ] Capacitor/TWA wrappers (see APP-STORES.md)

## Saved for later: the lanes & routes game (future OpenDoku title)

SlopeDoku v1's "double black" was a movement puzzle: athletes entered the
board from lanes and *traveled* by their sport's physics — skis straight
down until blocked, snowboards carving diagonally off walls, skates gliding
in from the side, snowshoes walking anywhere — and placed tiles became
terrain that changed every later route. Provably-winnable deals came from a
subset-memo reachability search over placement orders.

That mechanic is retired from SlopeDoku (replaced by the 9×9 double-dual
board) but it is a complete, original game concept of its own: lanes,
routes, terrain, order-of-play strategy. Working name ideas: TrailDoku /
LaneDoku. The full implementation lives in this repo's git history
(pre-Jul-8-2026 index.html: landSki/landBoard/landSkate/movesFor/
dealWinnable + lane arrows and ghost previews). Natural fit as the next
Game Engine template once rebuilt with the marker blocks.

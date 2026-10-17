/* Slide puzzle engine — pure logic, no DOM. Shared by Face Slide and
   Mega Slide.
   tiles[i] is the piece sitting in square i; piece v belongs in square v-1,
   and 0 is the empty square, which belongs bottom-right. Shuffles come from a
   seed (same seed + size = same shuffle, so a shared link replays it) and are
   always solvable: a board can be solved exactly when the permutation's
   parity matches the parity of the empty square's distance from home,
   because every slide flips both. */
(function (root) {
  "use strict";

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function solved(n) {
    var t = [];
    for (var i = 1; i < n * n; i++) t.push(i);
    t.push(0);
    return t;
  }

  function isSolved(tiles) {
    for (var i = 0; i < tiles.length - 1; i++) if (tiles[i] !== i + 1) return false;
    return tiles[tiles.length - 1] === 0;
  }

  function permParity(arr) {
    // parity via cycle decomposition of "square i holds piece that belongs at p"
    var N = arr.length, seen = [], swaps = 0;
    for (var i = 0; i < N; i++) {
      if (seen[i]) continue;
      var len = 0, j = i;
      while (!seen[j]) { seen[j] = true; j = arr[j] === 0 ? N - 1 : arr[j] - 1; len++; }
      swaps += len - 1;
    }
    return swaps % 2;
  }

  function isSolvable(n, tiles) {
    var hole = tiles.indexOf(0);
    var dist = (n - 1 - ((hole / n) | 0)) + (n - 1 - (hole % n));
    return permParity(tiles) === dist % 2;
  }

  function misplaced(tiles) {
    var m = 0;
    for (var i = 0; i < tiles.length; i++) if (tiles[i] !== 0 && tiles[i] !== i + 1) m++;
    return m;
  }

  function shuffle(n, seed) {
    var rand = rng(seed), N = n * n;
    for (var tries = 0; tries < 100; tries++) {
      var t = solved(n);
      for (var i = N - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var x = t[i]; t[i] = t[j]; t[j] = x;
      }
      if (!isSolvable(n, t)) {
        // swapping two pieces (never the gap) flips parity and fixes it
        var a = t[0] === 0 ? 1 : 0, b = (t[a + 1] === 0) ? a + 2 : a + 1;
        var y = t[a]; t[a] = t[b]; t[b] = y;
      }
      // keep it a real puzzle: most pieces start away from home
      if (!isSolved(t) && misplaced(t) >= Math.ceil((N - 1) * 0.6)) return t;
    }
    throw new Error("shuffle failed");
  }

  /* Tap a square: if it shares a row or column with the gap, every piece
     between them slides one step toward the gap. Returns the new tiles and
     the list of [from, to] moves, or null when the tap can't slide. */
  function tap(n, tiles, index) {
    var hole = tiles.indexOf(0);
    if (index === hole || index < 0 || index >= tiles.length) return null;
    var hr = (hole / n) | 0, hc = hole % n, r = (index / n) | 0, c = index % n;
    var step;
    if (r === hr) step = c < hc ? -1 : 1;
    else if (c === hc) step = r < hr ? -n : n;
    else return null;
    var next = tiles.slice(), moves = [], cur = hole;
    while (cur !== index) {
      var from = cur + step;
      next[cur] = next[from];
      moves.push([from, cur]);
      cur = from;
    }
    next[index] = 0;
    return { tiles: next, moves: moves };
  }

  /* Swipe or arrow key: "left" slides the piece to the right of the gap
     leftward into it, and so on. */
  function push(n, tiles, dir) {
    var hole = tiles.indexOf(0), hr = (hole / n) | 0, hc = hole % n, src = -1;
    if (dir === "left" && hc < n - 1) src = hole + 1;
    if (dir === "right" && hc > 0) src = hole - 1;
    if (dir === "up" && hr < n - 1) src = hole + n;
    if (dir === "down" && hr > 0) src = hole - n;
    return src < 0 ? null : tap(n, tiles, src);
  }

  var api = { rng: rng, solved: solved, isSolved: isSolved, isSolvable: isSolvable, shuffle: shuffle, tap: tap, push: push, misplaced: misplaced };
  root.OD_Slide = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

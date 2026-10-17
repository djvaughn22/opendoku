/* Picture Sudoku engine — pure logic, no DOM.
   Values are 1..size (the page draws a picture for each); 0 is empty.
   4×4 uses 2×2 boxes, 6×6 uses boxes 2 rows tall and 3 wide.
   Puzzles come from a seed and are only kept when they can be finished with
   plain "only one picture fits here" steps, so nobody has to guess. */
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

  function shuffle(arr, rand) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  var SIZES = {
    4: { boxR: 2, boxC: 2, keep: 6, label: "Easy" },
    6: { boxR: 2, boxC: 3, keep: 14, label: "Medium" },
  };

  // Every row, column and box as a list of squares.
  function unitsFor(size) {
    var cfg = SIZES[size], units = [], r, c;
    for (r = 0; r < size; r++) { var row = []; for (c = 0; c < size; c++) row.push(r * size + c); units.push(row); }
    for (c = 0; c < size; c++) { var col = []; for (r = 0; r < size; r++) col.push(r * size + c); units.push(col); }
    for (var br = 0; br < size; br += cfg.boxR) {
      for (var bc = 0; bc < size; bc += cfg.boxC) {
        var box = [];
        for (r = br; r < br + cfg.boxR; r++) for (c = bc; c < bc + cfg.boxC; c++) box.push(r * size + c);
        units.push(box);
      }
    }
    return units;
  }

  function peersOf(size) {
    var units = unitsFor(size), peers = [];
    for (var i = 0; i < size * size; i++) peers.push({});
    units.forEach(function (u) {
      u.forEach(function (a) { u.forEach(function (b) { if (a !== b) peers[a][b] = true; }); });
    });
    return peers.map(function (p) { return Object.keys(p).map(Number); });
  }

  function fill(size, rand) {
    var peers = peersOf(size), grid = [];
    for (var i = 0; i < size * size; i++) grid.push(0);
    function ok(i, v) { for (var k = 0; k < peers[i].length; k++) if (grid[peers[i][k]] === v) return false; return true; }
    function go(i) {
      if (i === grid.length) return true;
      var vals = shuffle(Array.from({ length: size }, function (_, k) { return k + 1; }), rand);
      for (var k = 0; k < vals.length; k++) {
        if (ok(i, vals[k])) { grid[i] = vals[k]; if (go(i + 1)) return true; grid[i] = 0; }
      }
      return false;
    }
    go(0);
    return grid;
  }

  function candidates(size, grid, peers, i) {
    var used = {};
    for (var k = 0; k < peers[i].length; k++) used[grid[peers[i][k]]] = true;
    var out = [];
    for (var v = 1; v <= size; v++) if (!used[v]) out.push(v);
    return out;
  }

  /* Find the next square that can be filled with no guessing: either the
     square has only one picture left (naked single), or a picture fits in
     only one square of some row, column or box (hidden single). */
  function nextStep(size, grid, peers, units) {
    for (var i = 0; i < grid.length; i++) {
      if (grid[i]) continue;
      var c = candidates(size, grid, peers, i);
      if (c.length === 1) return { cell: i, value: c[0], why: "only" };
    }
    for (var u = 0; u < units.length; u++) {
      for (var v = 1; v <= size; v++) {
        var spots = [], present = false;
        for (var k = 0; k < units[u].length; k++) {
          var s = units[u][k];
          if (grid[s] === v) { present = true; break; }
          if (!grid[s] && candidates(size, grid, peers, s).indexOf(v) >= 0) spots.push(s);
        }
        if (!present && spots.length === 1) return { cell: spots[0], value: v, why: u < size ? "row" : u < 2 * size ? "column" : "box" };
      }
    }
    return null;
  }

  function logicSolvable(size, puzzle) {
    var grid = puzzle.slice(), peers = peersOf(size), units = unitsFor(size);
    while (true) {
      var step = nextStep(size, grid, peers, units);
      if (!step) break;
      grid[step.cell] = step.value;
    }
    return grid.indexOf(0) < 0;
  }

  function countSolutions(size, puzzle, cap) {
    cap = cap || 2;
    var grid = puzzle.slice(), peers = peersOf(size), count = 0;
    function go() {
      if (count >= cap) return;
      var i = grid.indexOf(0);
      if (i < 0) { count++; return; }
      var c = candidates(size, grid, peers, i);
      for (var k = 0; k < c.length; k++) { grid[i] = c[k]; go(); grid[i] = 0; }
    }
    go();
    return count;
  }

  function generate(size, seed) {
    var cfg = SIZES[size];
    if (!cfg) throw new Error("Unsupported size " + size);
    var rand = rng(seed);
    var solution = fill(size, rand);
    var puzzle = solution.slice();
    var order = shuffle(Array.from({ length: size * size }, function (_, i) { return i; }), rand);
    var clues = size * size;
    for (var k = 0; k < order.length && clues > cfg.keep; k++) {
      var i = order[k], v = puzzle[i];
      puzzle[i] = 0;
      if (logicSolvable(size, puzzle)) clues--;
      else puzzle[i] = v;
    }
    return { size: size, seed: seed >>> 0, boxR: cfg.boxR, boxC: cfg.boxC, solution: solution, puzzle: puzzle, label: cfg.label };
  }

  // Squares whose picture repeats in their row, column or box.
  function conflicts(size, grid) {
    var bad = {};
    unitsFor(size).forEach(function (u) {
      var seen = {};
      u.forEach(function (i) {
        var v = grid[i];
        if (!v) return;
        if (seen[v] !== undefined) { bad[i] = true; bad[seen[v]] = true; }
        else seen[v] = i;
      });
    });
    return Object.keys(bad).map(Number);
  }

  // Hint: a wrong picture first, otherwise the next no-guess step.
  function hint(p, grid) {
    for (var i = 0; i < grid.length; i++) {
      if (grid[i] && !p.puzzle[i] && grid[i] !== p.solution[i]) return { type: "wrong", cell: i };
    }
    var step = nextStep(p.size, grid, peersOf(p.size), unitsFor(p.size));
    if (step) return { type: "place", cell: step.cell, value: step.value, why: step.why };
    return null;
  }

  function isWon(p, grid) {
    for (var i = 0; i < grid.length; i++) if (grid[i] !== p.solution[i]) return false;
    return true;
  }

  var api = { SIZES: SIZES, rng: rng, generate: generate, logicSolvable: logicSolvable, countSolutions: countSolutions, conflicts: conflicts, hint: hint, isWon: isWon, unitsFor: unitsFor };
  root.OD_Sudoku = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

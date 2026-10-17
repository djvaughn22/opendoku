/* Face Regions engine — pure logic, no DOM.
   An n×n board is split into n colored regions. The goal is to place exactly
   one tile in every row, every column, and every region. Puzzles are built
   from a seed (same seed + size = same puzzle, so a shared link replays the
   exact board) and are only accepted when the rule-based solver below can
   finish them without guessing, which also proves the answer is unique. */
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

  function neighbors(n, i) {
    var r = (i / n) | 0, c = i % n, out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  }

  // Is every cell of region g still connected after removing cell `skip`?
  function connectedWithout(n, regions, g, skip) {
    var start = -1, total = 0;
    for (var i = 0; i < n * n; i++) {
      if (i !== skip && regions[i] === g) { total++; if (start < 0) start = i; }
    }
    if (total === 0) return false;
    var seen = {}, stack = [start], count = 0;
    seen[start] = true;
    while (stack.length) {
      var cur = stack.pop(); count++;
      var nb = neighbors(n, cur);
      for (var k = 0; k < nb.length; k++) {
        var x = nb[k];
        if (x !== skip && !seen[x] && regions[x] === g) { seen[x] = true; stack.push(x); }
      }
    }
    return count === total;
  }

  function isContiguous(n, regions) {
    for (var g = 0; g < n; g++) if (!connectedWithout(n, regions, g, -1)) return false;
    return true;
  }

  // Count solutions up to `cap` (backtracking row by row).
  function countSolutions(n, regions, cap) {
    cap = cap || 2;
    var count = 0, colUsed = 0, regUsed = 0;
    function go(r) {
      if (count >= cap) return;
      if (r === n) { count++; return; }
      for (var c = 0; c < n; c++) {
        var g = regions[r * n + c];
        if ((colUsed >> c) & 1 || (regUsed >> g) & 1) continue;
        colUsed |= 1 << c; regUsed |= 1 << g;
        go(r + 1);
        colUsed &= ~(1 << c); regUsed &= ~(1 << g);
      }
    }
    go(0);
    return count;
  }

  /* Rule-based solver. Units are rows, columns and regions; each must hold
     exactly one tile. Techniques, in order:
       1. A unit with one possible square left gets its tile.
       2. If k units of one kind can only use squares inside k units of
          another kind, those k units are spoken for, so every other square
          in them is ruled out (k = 1 is the familiar "this color sits
          entirely in row 3, so the rest of row 3 is out").
     maxK caps how deep step 2 looks (harder sizes allow bigger k). */
  function logicSolve(n, regions, maxK) {
    maxK = maxK || 1;
    var N = n * n, cand = [], placed = [], steps = 0, i;
    for (i = 0; i < N; i++) cand.push(true);
    var unitsOf = function (type, u) {
      var out = [];
      for (var j = 0; j < N; j++) {
        if ((type === 0 && ((j / n) | 0) === u) || (type === 1 && j % n === u) || (type === 2 && regions[j] === u)) out.push(j);
      }
      return out;
    };
    var unitCells = [[], [], []];
    for (var t = 0; t < 3; t++) for (var u = 0; u < n; u++) unitCells[t].push(unitsOf(t, u));
    var unitOfCell = function (type, j) { return type === 0 ? (j / n) | 0 : type === 1 ? j % n : regions[j]; };
    var done = [[], [], []];
    for (t = 0; t < 3; t++) for (u = 0; u < n; u++) done[t].push(false);

    function place(j) {
      placed.push(j);
      var r = (j / n) | 0, c = j % n, g = regions[j];
      done[0][r] = done[1][c] = done[2][g] = true;
      for (var x = 0; x < N; x++) {
        if (x !== j && (((x / n) | 0) === r || x % n === c || regions[x] === g)) cand[x] = false;
      }
      cand[j] = false; // placed, no longer a candidate
    }

    function candsIn(type, u) {
      var out = [], cells = unitCells[type][u];
      for (var k = 0; k < cells.length; k++) if (cand[cells[k]]) out.push(cells[k]);
      return out;
    }

    function combos(arr, k, start, cur, out) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (var q = start; q < arr.length; q++) { cur.push(arr[q]); combos(arr, k, q + 1, cur, out); cur.pop(); }
    }

    var progress = true;
    while (progress) {
      progress = false;
      // 1. singles
      for (t = 0; t < 3 && !progress; t++) {
        for (u = 0; u < n; u++) {
          if (done[t][u]) continue;
          var cs = candsIn(t, u);
          if (cs.length === 0) return { solved: false, broken: true, placed: placed, steps: steps };
          if (cs.length === 1) { place(cs[0]); steps++; progress = true; break; }
        }
      }
      if (progress) continue;
      // 2. k units confined to k units of another kind
      for (var k = 1; k <= maxK && !progress; k++) {
        for (var A = 0; A < 3 && !progress; A++) {
          var open = [];
          for (u = 0; u < n; u++) if (!done[A][u]) open.push(u);
          if (open.length <= k) continue;
          var sets = [];
          combos(open, k, 0, [], sets);
          for (var s = 0; s < sets.length && !progress; s++) {
            var inA = {}, cellsA = [];
            for (var q = 0; q < sets[s].length; q++) {
              var cc = candsIn(A, sets[s][q]);
              for (var w = 0; w < cc.length; w++) { inA[cc[w]] = true; cellsA.push(cc[w]); }
            }
            for (var B = 0; B < 3 && !progress; B++) {
              if (B === A) continue;
              var bset = {}, bcount = 0;
              for (w = 0; w < cellsA.length; w++) {
                var b = unitOfCell(B, cellsA[w]);
                if (!bset[b]) { bset[b] = true; bcount++; }
              }
              if (bcount !== k) continue;
              for (var bu in bset) {
                var cellsB = unitCells[B][+bu];
                for (w = 0; w < cellsB.length; w++) {
                  var x = cellsB[w];
                  if (cand[x] && !inA[x]) { cand[x] = false; progress = true; }
                }
              }
              if (progress) steps++;
            }
          }
        }
      }
    }
    return { solved: placed.length === n, broken: false, placed: placed, steps: steps };
  }

  var SIZES = {
    4: { maxK: 1, label: "Easy" },
    5: { maxK: 1, label: "Medium" },
    6: { maxK: 2, label: "Hard" },
    7: { maxK: 2, label: "Expert" },
  };

  function score(n, regions, maxK) {
    var res = logicSolve(n, regions, maxK);
    return res.solved ? n * 10 : res.placed.length * 10 - (res.broken ? 5 : 0);
  }

  function growRegions(n, sol, rand) {
    var N = n * n, regions = [], i;
    for (i = 0; i < N; i++) regions.push(-1);
    var weight = [];
    for (var g = 0; g < n; g++) {
      regions[g * n + sol[g]] = g;
      weight.push(0.25 + rand() * rand() * 3);
    }
    var left = N - n;
    while (left > 0) {
      // pick a region by weight among those that can still grow
      var opts = [], tot = 0;
      for (g = 0; g < n; g++) {
        var frontier = [];
        for (i = 0; i < N; i++) {
          if (regions[i] !== g) continue;
          var nb = neighbors(n, i);
          for (var k = 0; k < nb.length; k++) if (regions[nb[k]] < 0) frontier.push(nb[k]);
        }
        if (frontier.length) { opts.push([g, frontier]); tot += weight[g]; }
      }
      var pick = rand() * tot, chosen = opts[opts.length - 1];
      for (k = 0; k < opts.length; k++) { pick -= weight[opts[k][0]]; if (pick <= 0) { chosen = opts[k]; break; } }
      var cell = chosen[1][Math.floor(rand() * chosen[1].length)];
      regions[cell] = chosen[0];
      left--;
    }
    return regions;
  }

  function badShape(n, regions) {
    var sizes = [];
    for (var g = 0; g < n; g++) sizes.push(0);
    for (var i = 0; i < n * n; i++) sizes[regions[i]]++;
    var ones = 0, biggest = 0;
    for (g = 0; g < n; g++) { if (sizes[g] === 1) ones++; if (sizes[g] > biggest) biggest = sizes[g]; }
    // One giveaway square at most, and no region swallowing half the board.
    return ones > 1 || biggest > Math.ceil(n * n * 0.4);
  }

  function generate(n, seed) {
    var cfg = SIZES[n];
    if (!cfg) throw new Error("Unsupported size " + n);
    var rand = rng(seed);
    for (var attempt = 0; attempt < 400; attempt++) {
      var sol = shuffle(Array.from({ length: n }, function (_, i) { return i; }), rand);
      var regions = growRegions(n, sol, rand);
      var seeds = {};
      for (var g = 0; g < n; g++) seeds[g * n + sol[g]] = true;
      var cur = score(n, regions, cfg.maxK);
      var target = n * 10;
      for (var it = 0; it < 120 * n && cur < target; it++) {
        var cell = Math.floor(rand() * n * n);
        if (seeds[cell]) continue;
        var nb = neighbors(n, cell), from = regions[cell];
        var to = regions[nb[Math.floor(rand() * nb.length)]];
        if (to === from) continue;
        if (!connectedWithout(n, regions, from, cell)) continue;
        regions[cell] = to;
        var next = score(n, regions, cfg.maxK);
        if (next >= cur) cur = next;
        else regions[cell] = from;
      }
      if (cur >= target && !badShape(n, regions)) {
        return { n: n, seed: seed >>> 0, regions: regions, solution: sol, label: cfg.label };
      }
    }
    throw new Error("Could not build a puzzle for seed " + seed);
  }

  /* Check a set of placed squares against the rules. Returns which squares
     break a rule (and why), plus whether the board is finished. */
  function check(n, regions, placed) {
    var rows = {}, cols = {}, regs = {};
    placed.forEach(function (j) {
      var r = (j / n) | 0, c = j % n, g = regions[j];
      (rows[r] = rows[r] || []).push(j);
      (cols[c] = cols[c] || []).push(j);
      (regs[g] = regs[g] || []).push(j);
    });
    var bad = {}, reasons = [];
    function mark(map, kind) {
      for (var key in map) {
        if (map[key].length > 1) {
          map[key].forEach(function (j) { bad[j] = true; });
          reasons.push({ kind: kind, index: +key, cells: map[key].slice() });
        }
      }
    }
    mark(rows, "row"); mark(cols, "column"); mark(regs, "color");
    var conflicts = Object.keys(bad).map(Number);
    var regionsDone = [];
    for (var g = 0; g < n; g++) regionsDone.push(!!regs[g] && regs[g].length === 1);
    return {
      conflicts: conflicts,
      reasons: reasons,
      regionsDone: regionsDone,
      won: placed.length === n && conflicts.length === 0,
    };
  }

  // Squares ruled out by the tiles already placed (same row, column or color).
  function blocked(n, regions, placed) {
    var out = {};
    placed.forEach(function (j) {
      var r = (j / n) | 0, c = j % n, g = regions[j];
      for (var x = 0; x < n * n; x++) {
        if (x !== j && (((x / n) | 0) === r || x % n === c || regions[x] === g)) out[x] = true;
      }
    });
    return out;
  }

  // A hint: point out a misplaced tile first, otherwise reveal one answer
  // square (preferring the one the solver would find first).
  function hint(puzzle, placed) {
    var n = puzzle.n, sol = puzzle.solution;
    for (var k = 0; k < placed.length; k++) {
      var j = placed[k];
      if (sol[(j / n) | 0] !== j % n) return { type: "wrong", cell: j };
    }
    var have = {};
    placed.forEach(function (j) { have[j] = true; });
    var order = logicSolve(n, puzzle.regions, SIZES[n].maxK).placed;
    for (k = 0; k < order.length; k++) if (!have[order[k]]) return { type: "place", cell: order[k] };
    for (var r = 0; r < n; r++) if (!have[r * n + sol[r]]) return { type: "place", cell: r * n + sol[r] };
    return null;
  }

  var api = {
    SIZES: SIZES, rng: rng, generate: generate, check: check, blocked: blocked, hint: hint,
    countSolutions: countSolutions, logicSolve: logicSolve, isContiguous: isContiguous,
  };
  root.OD_Regions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

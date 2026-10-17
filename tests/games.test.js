// Rules and share-link tests for the photo games and Originals.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../kit/regions-engine.js");
const S = require("../kit/slide-engine.js");
const P = require("../kit/sudoku-engine.js");
const K = require("../kit/photo-kit.js");

/* ---------------- Face Regions ---------------- */

function regionSizes(n, regions) {
  const sizes = Array(n).fill(0);
  regions.forEach((g) => sizes[g]++);
  return sizes;
}

for (const n of [4, 5, 6, 7]) {
  test(`Face Regions ${n}×${n}: every puzzle follows the rules and has one answer`, () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = R.generate(n, seed * 2654435761);
      assert.equal(p.regions.length, n * n);
      // n regions, each one contiguous piece
      assert.deepEqual([...new Set(p.regions)].sort(), [...Array(n).keys()]);
      assert.ok(R.isContiguous(n, p.regions), "regions are contiguous");
      // the answer: one per row (by construction), one per column, one per color
      assert.deepEqual([...p.solution].sort(), [...Array(n).keys()], "one per column");
      const colors = p.solution.map((c, r) => p.regions[r * n + c]);
      assert.equal(new Set(colors).size, n, "one per color");
      // unique, and solvable step by step without guessing
      assert.equal(R.countSolutions(n, p.regions, 2), 1, "exactly one answer");
      assert.ok(R.logicSolve(n, p.regions, R.SIZES[n].maxK).solved, "no guessing needed");
      // at most one one-square region (a giveaway)
      assert.ok(regionSizes(n, p.regions).filter((s) => s === 1).length <= 1);
    }
  });
}

test("Face Regions: same seed and size give the same board (shared links replay it)", () => {
  const a = R.generate(6, 123456789), b = R.generate(6, 123456789);
  assert.deepEqual(a, b);
  assert.notDeepEqual(R.generate(6, 987654321).regions, a.regions);
});

test("Face Regions: check() names row, column and color clashes and spots the win", () => {
  const p = R.generate(5, 42), n = 5;
  const answer = p.solution.map((c, r) => r * n + c);
  let res = R.check(n, p.regions, answer);
  assert.ok(res.won);
  assert.equal(res.conflicts.length, 0);
  assert.ok(res.regionsDone.every(Boolean));

  // two in one row
  const r0 = answer[0], sameRow = (r0 - (r0 % n)) + ((r0 % n) + 1) % n;
  res = R.check(n, p.regions, [r0, sameRow]);
  assert.ok(res.reasons.some((x) => x.kind === "row"));
  assert.ok(res.conflicts.includes(r0) && res.conflicts.includes(sameRow));
  assert.ok(!res.won);

  // two in one column
  const sameCol = (r0 + n) % (n * n);
  res = R.check(n, p.regions, [r0, sameCol]);
  assert.ok(res.reasons.some((x) => x.kind === "column"));

  // two in one color
  const g = p.regions[r0];
  const other = p.regions.findIndex((x, i) => x === g && i !== r0);
  if (other >= 0) {
    res = R.check(n, p.regions, [r0, other]);
    assert.ok(res.reasons.some((x) => x.kind === "color"));
  }

  // a full board with a clash is not a win
  const wrong = answer.slice();
  wrong[1] = wrong[0] + n; // same column as row 0's tile
  assert.ok(!R.check(n, p.regions, wrong).won);
});

test("Face Regions: blocked() rules out the row, column and color of each tile", () => {
  const p = R.generate(4, 7), n = 4, t = p.solution[0];
  const b = R.blocked(n, p.regions, [t]);
  for (let x = 0; x < n * n; x++) {
    const expect = x !== t && ((x / n | 0) === 0 || x % n === t % n || p.regions[x] === p.regions[t]);
    assert.equal(!!b[x], expect, `square ${x}`);
  }
});

test("Face Regions: hints flag a wrong tile, then reveal right ones until solved", () => {
  const p = R.generate(6, 31337), n = 6;
  const answer = new Set(p.solution.map((c, r) => r * n + c));
  const wrongCell = [...Array(n * n).keys()].find((i) => !answer.has(i));
  assert.deepEqual(R.hint(p, [wrongCell]), { type: "wrong", cell: wrongCell });
  let placed = [];
  for (let i = 0; i < n; i++) {
    const h = R.hint(p, placed);
    assert.equal(h.type, "place");
    assert.ok(answer.has(h.cell));
    placed.push(h.cell);
  }
  assert.ok(R.check(n, p.regions, placed).won);
  assert.equal(R.hint(p, placed), null);
});

test("Face Regions: a 7×7 board builds quickly", () => {
  const t0 = Date.now();
  for (let s = 0; s < 20; s++) R.generate(7, 1000 + s);
  assert.ok((Date.now() - t0) / 20 < 400, "average under 400 ms");
});

/* ---------------- Face Slide / Mega Slide ---------------- */

// Breadth-first search proves a 3×3 shuffle can really be solved.
function solve3(tiles) {
  const goal = S.solved(3).join(",");
  let frontier = [tiles], seen = new Set([tiles.join(",")]), depth = 0;
  while (frontier.length) {
    const next = [];
    for (const t of frontier) {
      if (t.join(",") === goal) return depth;
      for (const d of ["left", "right", "up", "down"]) {
        const r = S.push(3, t, d);
        if (r && !seen.has(r.tiles.join(","))) { seen.add(r.tiles.join(",")); next.push(r.tiles); }
      }
    }
    frontier = next; depth++;
  }
  return -1;
}

test("Slide: 3×3 shuffles are always solvable (checked by actually solving them)", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const t = S.shuffle(3, seed * 7777);
    assert.ok(S.isSolvable(3, t));
    assert.ok(solve3(t) > 0, "solvable and not already solved");
  }
});

test("Slide: the solvability check matches real reachability", () => {
  // swapping two pieces of a solved board makes it impossible
  const t = S.solved(3); [t[0], t[1]] = [t[1], t[0]];
  assert.equal(S.isSolvable(3, t), false);
  assert.equal(solve3(t), -1);
});

for (const n of [3, 4, 5, 6, 7]) {
  test(`Slide ${n}×${n}: shuffles are solvable, scrambled, and repeatable by seed`, () => {
    for (let seed = 1; seed <= 50; seed++) {
      const t = S.shuffle(n, seed);
      assert.equal(t.length, n * n);
      assert.deepEqual([...t].sort((a, b) => a - b), [...Array(n * n).keys()]);
      assert.ok(S.isSolvable(n, t));
      assert.ok(!S.isSolved(t));
      assert.ok(S.misplaced(t) >= Math.ceil((n * n - 1) * 0.6));
    }
    assert.deepEqual(S.shuffle(n, 99), S.shuffle(n, 99));
  });
}

test("Slide: taps move a whole line toward the gap; off-line taps do nothing", () => {
  const solved = S.solved(4); // gap at 15 (bottom-right)
  assert.equal(S.tap(4, solved, 15), null, "tapping the gap");
  assert.equal(S.tap(4, solved, 0), null, "not in the gap's row or column");
  const r = S.tap(4, solved, 12); // bottom-left: three pieces slide right
  assert.deepEqual(r.tiles.slice(12), [0, 13, 14, 15]);
  assert.equal(r.moves.length, 3);
  const c = S.tap(4, solved, 3); // top-right: three pieces slide down
  assert.deepEqual([c.tiles[3], c.tiles[7], c.tiles[11], c.tiles[15]], [0, 4, 8, 12]);
  // moves stay solvable, and undoing returns to solved
  assert.ok(S.isSolvable(4, r.tiles));
  assert.ok(S.isSolved(S.tap(4, r.tiles, 15).tiles));
});

test("Slide: swipes push the neighbor into the gap", () => {
  const solved = S.solved(3);
  assert.equal(S.push(3, solved, "left"), null, "nothing right of the gap");
  assert.equal(S.push(3, solved, "right").tiles[8], 8);
  assert.equal(S.push(3, solved, "down").tiles[8], 6);
});

/* ---------------- Picture Sudoku ---------------- */

for (const size of [4, 6]) {
  test(`Picture Sudoku ${size}×${size}: valid, unique, and solvable without guessing`, () => {
    const units = P.unitsFor(size);
    for (let seed = 1; seed <= 30; seed++) {
      const p = P.generate(size, seed * 104729);
      units.forEach((u) => assert.equal(new Set(u.map((i) => p.solution[i])).size, size));
      p.puzzle.forEach((v, i) => { if (v) assert.equal(v, p.solution[i]); });
      assert.ok(P.logicSolvable(size, p.puzzle));
      assert.equal(P.countSolutions(size, p.puzzle, 2), 1);
      const clues = p.puzzle.filter(Boolean).length;
      assert.ok(clues >= P.SIZES[size].keep && clues < size * size);
    }
  });
}

test("Picture Sudoku: conflicts, hints and the win", () => {
  const p = P.generate(6, 5), grid = p.puzzle.slice();
  const empty = grid.indexOf(0);
  const rowStart = empty - (empty % 6);
  const clueInRow = [...Array(6).keys()].map((c) => rowStart + c).find((i) => grid[i]);
  grid[empty] = grid[clueInRow];
  assert.ok(P.conflicts(6, grid).includes(empty));
  assert.deepEqual(P.hint(p, grid), { type: "wrong", cell: empty });
  grid[empty] = 0;
  let g = grid.slice(), guard = 0;
  while (!P.isWon(p, g) && guard++ < 40) {
    const h = P.hint(p, g);
    assert.equal(h.type, "place");
    assert.equal(h.value, p.solution[h.cell]);
    g[h.cell] = h.value;
  }
  assert.ok(P.isWon(p, g));
  assert.equal(P.conflicts(6, g).length, 0);
});

/* ---------------- Share links ---------------- */

const fakeJpeg = "data:image/jpeg;base64," + Buffer.from(Array.from({ length: 900 }, (_, i) => (i * 37) % 256)).toString("base64");

test("Share link: round-trips game, size, seed, name, time and photo", () => {
  const h = K.encodeShare({ g: "regions", s: 6, k: 4294967295, n: "Grandma Jo", t: 84, p: fakeJpeg });
  assert.ok(!/[+/=\s]/.test(h.split("p=")[1]), "photo is URL-safe");
  const d = K.decodeShare("#" + h, [4, 5, 6, 7]);
  assert.deepEqual(d, { g: "regions", s: 6, k: 4294967295, n: "Grandma Jo", p: fakeJpeg, t: 84, m: 0 });
  const s = K.decodeShare(K.encodeShare({ g: "slide", s: 3, k: 12, n: "Leo", m: 40, p: fakeJpeg }), [3, 4]);
  assert.equal(s.g, "slide"); assert.equal(s.m, 40); assert.equal(s.k, 12);
});

test("Share link: names are cleaned and capped", () => {
  assert.equal(K.cleanName("  <b>Nana</b>  "), "bNana/b");
  assert.equal(K.cleanName("A".repeat(50)).length, K.NAME_MAX);
  assert.equal(K.cleanName("Tía\u0007 Rosa"), "Tía Rosa");
  const h = K.encodeShare({ g: "slide", s: 3, k: 1, n: "Mamá & Papá #1", p: fakeJpeg });
  assert.equal(K.decodeShare(h, [3, 4]).n, "Mamá & Papá #1");
  assert.equal(K.who(""), "photo");
  assert.equal(K.who("Leo"), "Leo");
});

test("Share link: junk, wrong sizes and non-photo data are refused", () => {
  const good = K.encodeShare({ g: "regions", s: 5, k: 9, n: "Al", p: fakeJpeg });
  assert.equal(K.decodeShare("", [5]), null);
  assert.equal(K.decodeShare("#hello", [5]), null);
  assert.equal(K.decodeShare(good, [4, 6]), null, "size not offered by this game");
  assert.equal(K.decodeShare(good.replace("g=regions", "g=chess"), [5]), null);
  assert.equal(K.decodeShare(good.replace(/p=.*/, "p=j.<script>"), [5]), null);
  assert.equal(K.decodeShare(good.replace(/p=.*/, "p=x." + "A".repeat(200)), [5]), null);
  assert.equal(K.packPhoto("data:image/svg+xml;base64,PHN2Zz4="), null, "only jpeg/webp photos");
  assert.equal(K.decodeShare(good.replace(/k=[^&]+/, "k=zzzzzzzzz"), [5]), null, "bad seed");
});

test("Share link: time formatting", () => {
  assert.equal(K.fmtTime(0), "0:00");
  assert.equal(K.fmtTime(84), "1:24");
  assert.equal(K.fmtTime(3725), "1:02:05");
});

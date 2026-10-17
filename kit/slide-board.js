/* Slide puzzle board — the shared playing surface for Face Slide and Mega
   Slide. Tap a tile in line with the gap, swipe on the board, or use the
   arrow keys. Needs slide-engine.js. */
(function (root) {
  "use strict";
  var S = root.OD_Slide;

  function create(host, opts) {
    var n = opts.n, tiles = opts.tiles.slice(), moves = opts.moves || 0, done = false;
    var board = document.createElement("div");
    board.className = "sboard" + (opts.numbers ? " nums" : "");
    board.style.setProperty("--n", n);
    board.setAttribute("role", "group");
    board.setAttribute("aria-label", "Slide puzzle, " + n + " by " + n + ". Arrow keys slide a tile into the gap.");
    board.tabIndex = 0;
    var els = {};
    for (var v = 1; v <= n * n; v++) {
      var b = document.createElement(v === n * n ? "div" : "button");
      b.className = "stile" + (v === n * n ? " last" : "");
      if (v < n * n) { b.type = "button"; b.dataset.v = v; }
      var hr = ((v - 1) / n) | 0, hc = (v - 1) % n;
      var face = document.createElement("span");
      face.className = "face";
      face.style.backgroundPosition = (n > 1 ? (hc / (n - 1)) * 100 : 0) + "% " + (n > 1 ? (hr / (n - 1)) * 100 : 0) + "%";
      b.appendChild(face);
      if (v < n * n) {
        var num = document.createElement("span");
        num.className = "num"; num.textContent = v; num.setAttribute("aria-hidden", "true");
        b.appendChild(num);
      }
      board.appendChild(b);
      els[v] = b;
    }
    els[n * n].style.setProperty("--c", n - 1);
    els[n * n].style.setProperty("--r", n - 1);
    var peek = document.createElement("div");
    peek.className = "speek"; peek.setAttribute("aria-hidden", "true");
    board.appendChild(peek);
    host.innerHTML = "";
    host.appendChild(board);
    setPicture(opts.picture);

    function place() {
      tiles.forEach(function (v, i) {
        if (!v) return;
        var e = els[v];
        e.style.setProperty("--c", i % n);
        e.style.setProperty("--r", (i / n) | 0);
        var home = i === v - 1;
        e.classList.toggle("home", home);
        e.setAttribute("aria-label", "Tile " + v + (home ? ", in place" : "") + ", row " + (((i / n) | 0) + 1) + ", column " + ((i % n) + 1));
      });
    }

    function apply(res) {
      if (!res || done) return false;
      tiles = res.tiles;
      moves += res.moves.length;
      place();
      if (opts.onMove) opts.onMove({ tiles: tiles.slice(), moves: moves, moved: res.moves.length });
      if (S.isSolved(tiles)) {
        done = true;
        setTimeout(function () { board.classList.add("done"); }, 160);
        if (opts.onWin) setTimeout(function () { opts.onWin({ tiles: tiles.slice(), moves: moves }); }, 520);
      }
      return true;
    }

    var swiped = false, start = null;
    board.addEventListener("click", function (e) {
      if (swiped) { swiped = false; return; }
      var t = e.target.closest(".stile");
      if (!t || !t.dataset.v) return;
      if (!apply(S.tap(n, tiles, tiles.indexOf(+t.dataset.v))) && !done) {
        t.classList.remove("nope"); void t.offsetWidth; t.classList.add("nope");
      }
    });
    board.addEventListener("pointerdown", function (e) { start = { x: e.clientX, y: e.clientY }; swiped = false; });
    board.addEventListener("pointerup", function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      swiped = true;
      apply(S.push(n, tiles, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down")));
      setTimeout(function () { swiped = false; }, 50);
    });
    board.addEventListener("pointercancel", function () { start = null; });
    board.addEventListener("keydown", function (e) {
      var dir = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[e.key];
      if (!dir) return;
      e.preventDefault();
      apply(S.push(n, tiles, dir));
    });

    function setPicture(src) {
      board.style.setProperty("--pic", 'url("' + src + '")');
    }

    place();
    if (S.isSolved(tiles)) { done = true; board.classList.add("done"); }
    return {
      el: board,
      get tiles() { return tiles.slice(); },
      get moves() { return moves; },
      get done() { return done; },
      setPicture: setPicture,
      setNumbers: function (on) { board.classList.toggle("nums", !!on); },
      peek: function (on) { board.classList.toggle("peeking", !!on); },
      // for automated checks: slide pieces home along a known solution
      apply: apply,
    };
  }

  root.OD_SlideBoard = { create: create };
})(typeof window !== "undefined" ? window : globalThis);

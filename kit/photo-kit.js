/* OpenDoku photo kit — shared by the homepage, Face Regions and Face Slide
   (and the chrome helpers by every new game page).

   The person (photo + name) lives only in this browser's localStorage. A
   shared puzzle carries a small copy of the photo inside the link, after the
   "#", which browsers never send to a server. The pages move that part out
   of the address bar before analytics loads (inline script in each photo
   game's <head>), so it isn't reported anywhere. */
(function (root) {
  "use strict";

  var PERSON_KEY = "od_person_v1";
  var SHARED_KEY = "od_shared_v1";
  var NAME_MAX = 20;
  var SHARE_BUDGET = 9000; // characters of photo data in a share link
  var PHOTO_RE = /^[jw]\.[A-Za-z0-9_-]{100,200000}$/;

  /* ---------- pure helpers (tested in Node) ---------- */

  function b64ToUrl(b64) { return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function urlToB64(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return s;
  }

  function cleanName(s) {
    return String(s == null ? "" : s)
      .replace(/[\u0000-\u001f\u007f<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, NAME_MAX)
      .trim();
  }

  // data:image/jpeg;base64,... -> "j.<base64url>" (w = webp)
  function packPhoto(dataUrl) {
    var m = /^data:image\/(jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
    if (!m) return null;
    return (m[1] === "webp" ? "w." : "j.") + b64ToUrl(m[2]);
  }
  function unpackPhoto(p) {
    if (!PHOTO_RE.test(p || "")) return null;
    return "data:image/" + (p[0] === "w" ? "webp" : "jpeg") + ";base64," + urlToB64(p.slice(2));
  }

  /* A shared puzzle: g = game ("regions" | "slide"), s = size, k = seed,
     n = name, p = photo, t = sender's time in seconds, m = sender's moves. */
  function encodeShare(o) {
    var parts = ["v=1", "g=" + o.g, "s=" + (o.s | 0), "k=" + ((o.k >>> 0).toString(36))];
    var name = cleanName(o.n);
    if (name) parts.push("n=" + encodeURIComponent(name));
    if (o.t > 0) parts.push("t=" + Math.round(o.t));
    if (o.m > 0) parts.push("m=" + Math.round(o.m));
    parts.push("p=" + packPhoto(o.p));
    return parts.join("&");
  }

  function decodeShare(hash, allowedSizes) {
    var h = String(hash || "").replace(/^#/, "");
    if (h.indexOf("v=1&") !== 0) return null;
    var q = {};
    h.split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i > 0) q[kv.slice(0, i)] = kv.slice(i + 1);
    });
    var g = q.g;
    if (g !== "regions" && g !== "slide") return null;
    var s = parseInt(q.s, 10);
    if (allowedSizes && allowedSizes.indexOf(s) < 0) return null;
    if (!/^[0-9a-z]{1,7}$/.test(q.k || "")) return null;
    var k = parseInt(q.k, 36) >>> 0;
    var photo = unpackPhoto(q.p);
    if (!photo) return null;
    var name = "";
    try { name = cleanName(decodeURIComponent(q.n || "")); } catch (e) { name = ""; }
    var t = parseInt(q.t, 10), m = parseInt(q.m, 10);
    return {
      g: g, s: s, k: k, n: name, p: photo,
      t: t > 0 && t < 360000 ? t : 0,
      m: m > 0 && m < 1000000 ? m : 0,
    };
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    return m + ":" + String(s).padStart(2, "0");
  }

  // The word the games use for the person: their name, or "photo".
  function who(name) { return cleanName(name) || "photo"; }

  /* ---------- storage ---------- */

  function store() { try { return root.localStorage; } catch (e) { return null; } }
  function session() { try { return root.sessionStorage; } catch (e) { return null; } }

  function getJSON(key, fallback) {
    try { var v = store().getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function setJSON(key, val) {
    try { store().setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  function loadPerson() {
    var p = getJSON(PERSON_KEY, null);
    if (!p || typeof p.photo !== "string" || p.photo.indexOf("data:image/") !== 0) return null;
    return { name: cleanName(p.name), photo: p.photo, sample: !!p.sample };
  }
  function savePerson(person) {
    return setJSON(PERSON_KEY, { name: cleanName(person.name), photo: person.photo, sample: !!person.sample, saved: Date.now() });
  }
  function clearPerson() { try { store().removeItem(PERSON_KEY); } catch (e) {} }

  /* Each photo game's <head> moves a shared puzzle out of the address bar
     into this tab's sessionStorage (key SHARED_KEY + path) before analytics
     loads; these read it back. */
  function readShared(allowedSizes) {
    var raw = null;
    try { raw = session().getItem(SHARED_KEY + root.location.pathname); } catch (e) {}
    return raw ? decodeShare(raw, allowedSizes) : null;
  }
  function dropShared() { try { session().removeItem(SHARED_KEY + root.location.pathname); } catch (e) {} }

  function newSeed() {
    try { var a = new Uint32Array(1); root.crypto.getRandomValues(a); return a[0] >>> 0; }
    catch (e) { return (Math.random() * 4294967296) >>> 0; }
  }

  /* ---------- pictures ---------- */

  function emojiFont(px) { return px + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; }

  // Biscuit the dog: the stand-in for anyone who hasn't added a photo yet.
  function samplePerson() {
    var S = 480, c = document.createElement("canvas");
    c.width = c.height = S;
    var x = c.getContext("2d");
    x.fillStyle = "#f9c46b"; x.fillRect(0, 0, S, S);
    x.fillStyle = "#f4a259"; x.beginPath(); x.arc(S / 2, S * 1.05, S * 0.62, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#fde68a";
    [[0.14, 0.16], [0.84, 0.2], [0.12, 0.78], [0.88, 0.8]].forEach(function (p) {
      x.beginPath(); x.arc(S * p[0], S * p[1], S * 0.05, 0, Math.PI * 2); x.fill();
    });
    x.textAlign = "center"; x.textBaseline = "middle";
    x.font = emojiFont(S * 0.62);
    x.fillText("🐶", S / 2, S * 0.53);
    return { name: "Biscuit", photo: c.toDataURL("image/jpeg", 0.9), sample: true };
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("That file didn't open as a picture.")); };
      img.src = src;
    });
  }

  function readFile(file) {
    if (!file || !/^image\//.test(file.type || "image/")) return Promise.reject(new Error("Please pick a photo."));
    var url = URL.createObjectURL(file);
    return loadImage(url).then(function (img) { URL.revokeObjectURL(url); return img; }, function (e) { URL.revokeObjectURL(url); throw e; });
  }

  function encodeCanvas(canvas, quality) {
    var webp = canvas.toDataURL("image/webp", quality);
    if (webp.indexOf("data:image/webp") === 0) {
      var jpg = canvas.toDataURL("image/jpeg", quality);
      return webp.length < jpg.length ? webp : jpg;
    }
    return canvas.toDataURL("image/jpeg", quality);
  }

  // Shrink a photo until it fits comfortably inside a link.
  function compactPhoto(dataUrl) {
    return loadImage(dataUrl).then(function (img) {
      var tries = [[256, 0.62], [256, 0.5], [224, 0.5], [208, 0.44], [192, 0.4], [168, 0.38], [144, 0.35]];
      var c = document.createElement("canvas"), x = c.getContext("2d"), out = null;
      for (var i = 0; i < tries.length; i++) {
        c.width = c.height = tries[i][0];
        x.imageSmoothingQuality = "high";
        x.drawImage(img, 0, 0, c.width, c.height);
        out = encodeCanvas(c, tries[i][1]);
        if (packPhoto(out) && packPhoto(out).length <= SHARE_BUDGET) return out;
      }
      return out;
    });
  }

  /* Square cropper: drag to move, pinch / slider / wheel to zoom. */
  function Cropper(host, img) {
    host.innerHTML = "";
    var wrap = el("div", "crop");
    var cv = el("canvas", "crop-cv");
    var ring = el("div", "crop-ring");
    wrap.appendChild(cv); wrap.appendChild(ring);
    var zoomRow = el("label", "crop-zoom");
    zoomRow.innerHTML = '<span aria-hidden="true">➖</span>';
    var slider = el("input");
    slider.type = "range"; slider.min = "1"; slider.max = "4"; slider.step = "0.01"; slider.value = "1";
    slider.setAttribute("aria-label", "Zoom");
    zoomRow.appendChild(slider);
    zoomRow.insertAdjacentHTML("beforeend", '<span aria-hidden="true">➕</span>');
    host.appendChild(wrap); host.appendChild(zoomRow);

    var V = 0, z = 1, ox = 0, oy = 0, dpr = Math.min(root.devicePixelRatio || 1, 3);
    function base() { return Math.max(V / img.naturalWidth, V / img.naturalHeight); }
    function clamp() {
      var s = base() * z, w = img.naturalWidth * s, h = img.naturalHeight * s;
      var mx = Math.max(0, (w - V) / 2), my = Math.max(0, (h - V) / 2);
      ox = Math.min(mx, Math.max(-mx, ox)); oy = Math.min(my, Math.max(-my, oy));
    }
    function drawTo(ctx, size) {
      var k = size / V, s = base() * z * k;
      var w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, size, size);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, size / 2 - w / 2 + ox * k, size / 2 - h / 2 + oy * k, w, h);
    }
    function render() {
      V = wrap.clientWidth || 260;
      cv.width = cv.height = Math.round(V * dpr);
      clamp();
      drawTo(cv.getContext("2d"), cv.width);
    }
    function setZoom(nz, cx, cy) {
      nz = Math.min(4, Math.max(1, nz));
      if (cx != null) { var f = nz / z; ox = cx + (ox - cx) * f; oy = cy + (oy - cy) * f; }
      z = nz; slider.value = String(z); render();
    }
    slider.addEventListener("input", function () { setZoom(parseFloat(slider.value)); });

    var pts = {}, last = null, pinch = null;
    wrap.addEventListener("pointerdown", function (e) {
      wrap.setPointerCapture(e.pointerId);
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: z };
      } else { last = { x: e.clientX, y: e.clientY }; }
    });
    wrap.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length >= 2 && pinch) {
        var a = pts[ids[0]], b = pts[ids[1]];
        setZoom(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / (pinch.d || 1));
      } else if (last) {
        ox += e.clientX - last.x; oy += e.clientY - last.y;
        last = { x: e.clientX, y: e.clientY };
        render();
      }
    });
    function up(e) {
      delete pts[e.pointerId];
      if (Object.keys(pts).length < 2) pinch = null;
      var ids = Object.keys(pts);
      last = ids.length ? { x: pts[ids[0]].x, y: pts[ids[0]].y } : null;
    }
    wrap.addEventListener("pointerup", up);
    wrap.addEventListener("pointercancel", up);
    wrap.addEventListener("wheel", function (e) {
      e.preventDefault();
      var r = wrap.getBoundingClientRect();
      setZoom(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left - V / 2, e.clientY - r.top - V / 2);
    }, { passive: false });

    var ro = root.ResizeObserver ? new ResizeObserver(render) : null;
    if (ro) ro.observe(wrap);
    render();

    return {
      toDataURL: function (size) {
        var c = document.createElement("canvas");
        c.width = c.height = size || 480;
        drawTo(c.getContext("2d"), c.width);
        return encodeCanvas(c, 0.86);
      },
      destroy: function () { if (ro) ro.disconnect(); host.innerHTML = ""; },
    };
  }

  /* ---------- small UI helpers ---------- */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById("odToast");
    if (!t) { t = el("div", "od-toast"); t.id = "odToast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function btn(label, kind, fn) {
    var b = el("button", "od-btn wide" + (kind ? " " + kind : ""), label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  // A short shower of emoji when a puzzle is solved.
  function burst() {
    var host = el("div", "burst");
    host.setAttribute("aria-hidden", "true");
    var bits = ["🎉", "⭐", "💛", "✨", "🎊", "💜"];
    for (var i = 0; i < 26; i++) {
      var s = el("span", null, bits[i % bits.length]);
      s.style.left = Math.random() * 100 + "%";
      s.style.animationDelay = Math.random() * 0.6 + "s";
      host.appendChild(s);
    }
    document.body.appendChild(host);
    setTimeout(function () { host.remove(); }, 2800);
  }

  function copyText(text) {
    if (root.navigator.clipboard && root.isSecureContext) {
      return root.navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(false);
  }

  /* The share sheet. Shows who and what is being sent, says plainly that the
     photo travels inside the link, then hands off to the phone's share menu
     or copies the link. */
  function openShareSheet(opts) {
    closeSheet();
    var back = el("div", "od-sheet-back");
    back.id = "odSheet";
    var sheet = el("div", "od-sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "odSheetTitle");
    var head = el("div", "od-sheet-head");
    var img = el("img", "od-avatar lg");
    img.src = opts.photo; img.alt = "";
    var ht = el("div");
    var h = el("h2", null, opts.title); h.id = "odSheetTitle";
    ht.appendChild(h);
    ht.appendChild(el("p", "od-dim", opts.subtitle));
    head.appendChild(img); head.appendChild(ht);
    sheet.appendChild(head);
    sheet.appendChild(el("p", "od-note", "The photo travels inside the link. Anyone you send it to (or anyone they forward it to) can see it, so share it with people you trust."));
    var status = el("p", "od-dim od-sheet-status", "Getting the link ready…");
    sheet.appendChild(status);
    var row = el("div", "od-sheet-actions");
    var bShare = el("button", "od-btn primary", root.navigator.share ? "📤 Share…" : "📋 Copy link");
    var bCopy = el("button", "od-btn", "📋 Copy link");
    bShare.disabled = bCopy.disabled = true;
    row.appendChild(bShare);
    if (root.navigator.share) row.appendChild(bCopy);
    sheet.appendChild(row);
    var linkBox = el("input", "od-linkbox");
    linkBox.readOnly = true; linkBox.setAttribute("aria-label", "Puzzle link");
    linkBox.hidden = true;
    sheet.appendChild(linkBox);
    var close = el("button", "od-btn ghost", "Close");
    close.addEventListener("click", closeSheet);
    sheet.appendChild(close);
    back.appendChild(sheet);
    back.addEventListener("click", function (e) { if (e.target === back) closeSheet(); });
    document.body.appendChild(back);
    document.addEventListener("keydown", escClose);

    Promise.resolve(opts.getUrl()).then(function (url) {
      status.textContent = "Ready to send.";
      bShare.disabled = bCopy.disabled = false;
      linkBox.value = url;
      function doCopy() {
        copyText(url).then(function (ok) {
          linkBox.hidden = false;
          if (ok) { status.textContent = "Link copied. Paste it into a text or email."; toast("Link copied"); }
          else { status.textContent = "Copy the link below and paste it into a text or email."; linkBox.focus(); linkBox.select(); }
          if (opts.onShared) opts.onShared("copy");
        });
      }
      bCopy.addEventListener("click", doCopy);
      bShare.addEventListener("click", function () {
        if (!root.navigator.share) return doCopy();
        root.navigator.share({ title: opts.title, text: opts.text, url: url }).then(function () {
          status.textContent = "Sent. Thanks for sharing!";
          if (opts.onShared) opts.onShared("share");
        }, function (err) {
          if (err && err.name === "AbortError") return;
          doCopy();
        });
      });
      bShare.focus();
    }, function () {
      status.textContent = "Couldn't get the link ready. Try again in a moment.";
    });
  }
  function escClose(e) { if (e.key === "Escape") closeSheet(); }
  function closeSheet() {
    var s = document.getElementById("odSheet");
    if (s) s.remove();
    document.removeEventListener("keydown", escClose);
  }

  /* Header chrome every new page shares: light/dark toggle (the family
     om-theme key) and the games menu button. */
  function initChrome() {
    var b = document.getElementById("themeBtn");
    function apply(t) {
      document.body.dataset.theme = t;
      document.documentElement.dataset.omTheme = t;
      if (b) b.textContent = t === "dark" ? "🌙" : "☀️";
    }
    var saved = null;
    try { saved = store().getItem("om-theme"); } catch (e) {}
    apply(saved === "light" ? "light" : "dark");
    if (b) b.addEventListener("click", function () {
      var t = document.body.dataset.theme === "dark" ? "light" : "dark";
      try { store().setItem("om-theme", t); } catch (e) {}
      apply(t);
    });
    var mb = document.getElementById("gamesBtn"), m = document.getElementById("gamesMenu");
    if (mb && m) {
      mb.addEventListener("click", function (e) { e.stopPropagation(); m.hidden = !m.hidden; mb.setAttribute("aria-expanded", String(!m.hidden)); });
      document.addEventListener("click", function (e) { if (!m.hidden && !m.contains(e.target)) { m.hidden = true; mb.setAttribute("aria-expanded", "false"); } });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !m.hidden) { m.hidden = true; mb.setAttribute("aria-expanded", "false"); mb.focus(); } });
    }
  }

  /* Photo + name form, used on the homepage and inside the photo games.
     opts.onSave(person) runs when a photo and name are saved. */
  function mountPersonSetup(host, opts) {
    opts = opts || {};
    host.innerHTML = "";
    var current = opts.person || null, cropper = null;
    var form = el("div", "od-setup");

    var photoArea = el("div", "od-photo-area");
    var pick = el("label", "od-pick");
    pick.innerHTML = '<span class="od-pick-ico" aria-hidden="true">📷</span><span class="od-pick-txt">Add a photo</span><span class="od-pick-sub">Pick one from your phone or take a new one</span>';
    var input = el("input");
    input.type = "file"; input.accept = "image/*"; input.className = "od-file";
    input.setAttribute("aria-label", "Add a photo");
    pick.appendChild(input);
    var cropHost = el("div", "od-crop-host");
    cropHost.hidden = true;
    var cropHelp = el("p", "od-dim od-crop-help", "Drag to move the face into the circle. Use the slider or pinch to zoom.");
    cropHelp.hidden = true;
    var swap = el("button", "od-link", "Choose a different photo");
    swap.type = "button"; swap.hidden = true;
    swap.addEventListener("click", function () { input.click(); });
    photoArea.appendChild(pick); photoArea.appendChild(cropHost); photoArea.appendChild(cropHelp); photoArea.appendChild(swap);

    var nameLbl = el("label", "od-field");
    nameLbl.appendChild(el("span", "od-field-lbl", "Who's in the photo?"));
    var name = el("input", "od-input");
    name.type = "text"; name.maxLength = NAME_MAX; name.autocomplete = "off";
    name.placeholder = "Grandma, Leo, Coach Kim…";
    name.value = current && !current.sample ? current.name : "";
    nameLbl.appendChild(name);

    var err = el("p", "od-err");
    err.setAttribute("role", "alert");
    var save = el("button", "od-btn primary wide", opts.saveLabel || "Save");
    save.type = "button";
    var note = el("p", "od-note", "Your photo stays on this device. It only leaves when you send someone a puzzle link.");
    var sample = el("button", "od-link", "No photo handy? Play with Biscuit the dog 🐶");
    sample.type = "button";

    form.appendChild(photoArea); form.appendChild(nameLbl); form.appendChild(err);
    form.appendChild(save); form.appendChild(note);
    if (opts.allowSample !== false) form.appendChild(sample);
    if (opts.onCancel) {
      var cancel = el("button", "od-link", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", function () { if (cropper) cropper.destroy(); opts.onCancel(); });
      form.appendChild(cancel);
    }
    host.appendChild(form);

    function showImage(img) {
      if (cropper) cropper.destroy();
      pick.hidden = true; cropHost.hidden = false; cropHelp.hidden = false; swap.hidden = false;
      cropper = Cropper(cropHost, img);
    }
    if (current && current.photo && !current.sample) loadImage(current.photo).then(showImage);

    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      err.textContent = "";
      if (!f) return;
      readFile(f).then(showImage, function (e) { err.textContent = e.message; });
      input.value = "";
    });
    save.addEventListener("click", function () {
      err.textContent = "";
      if (!cropper) { err.textContent = "Add a photo first, or play with Biscuit."; pick.focus(); return; }
      var person = { name: cleanName(name.value), photo: cropper.toDataURL(480) };
      if (!person.name) { err.textContent = "Type their name so the puzzle can use it."; name.focus(); return; }
      if (!savePerson(person)) err.textContent = "This browser wouldn't save the photo, but you can still play now.";
      if (cropper) cropper.destroy();
      if (opts.onSave) opts.onSave(person);
    });
    sample.addEventListener("click", function () {
      if (cropper) cropper.destroy();
      var p = samplePerson();
      savePerson(p);
      if (opts.onSave) opts.onSave(p);
    });
    return { focusName: function () { name.focus(); } };
  }

  var api = {
    NAME_MAX: NAME_MAX, SHARE_BUDGET: SHARE_BUDGET,
    b64ToUrl: b64ToUrl, urlToB64: urlToB64, cleanName: cleanName, packPhoto: packPhoto, unpackPhoto: unpackPhoto,
    encodeShare: encodeShare, decodeShare: decodeShare, fmtTime: fmtTime, who: who,
    getJSON: getJSON, setJSON: setJSON, loadPerson: loadPerson, savePerson: savePerson, clearPerson: clearPerson,
    readShared: readShared, dropShared: dropShared, newSeed: newSeed,
    samplePerson: samplePerson, loadImage: loadImage, compactPhoto: compactPhoto, Cropper: Cropper,
    el: el, btn: btn, burst: burst, toast: toast, openShareSheet: openShareSheet, closeSheet: closeSheet, initChrome: initChrome,
    mountPersonSetup: mountPersonSetup, emojiFont: emojiFont,
  };
  root.OD_Kit = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

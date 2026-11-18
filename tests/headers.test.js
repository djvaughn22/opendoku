// Security headers for the static site, set in vercel.json.
// iDontCry's /snowdoku page frames https://opendoku.com/slopedoku/, so framing
// is limited to an allowlist (Content-Security-Policy frame-ancestors) rather
// than X-Frame-Options: SAMEORIGIN, which would blank that page.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const cfg = require("../vercel.json");

const allPages = () => {
  const rule = (cfg.headers || []).find((h) => h.source === "/(.*)");
  assert.ok(rule, "a header rule covers every path");
  return Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
};

test("every page sends nosniff and a strict referrer policy", () => {
  const h = allPages();
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin");
});

test("framing is allowed for OpenDoku itself and iDontCry, nobody else", () => {
  const h = allPages();
  const ancestors = (h["Content-Security-Policy"] || "").match(/frame-ancestors ([^;]+)/);
  assert.ok(ancestors, "frame-ancestors is set");
  const list = ancestors[1].trim().split(/\s+/);
  for (const origin of ["'self'", "https://www.idontcry.com", "https://idontcry.com"]) {
    assert.ok(list.includes(origin), `${origin} may frame OpenDoku`);
  }
  assert.ok(!list.includes("*") && !list.some((o) => o.includes("*.")), "no wildcard hosts");
});

test("X-Frame-Options is not set (it would block iDontCry's SlopeDoku frame)", () => {
  assert.equal(allPages()["X-Frame-Options"], undefined);
});

test("the snowdoku.com home redirect is still there", () => {
  const r = cfg.redirects.find((x) => x.has && x.has.some((h) => h.value === "snowdoku.com"));
  assert.equal(r.destination, "/slopedoku/");
});

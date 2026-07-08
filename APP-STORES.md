# SlopeDoku (OpenDoku) → App Stores playbook

The site is now a full PWA (manifest + offline service worker + icons), which
is the foundation for both stores. Current fastest paths:

## Right now, $0 — instant phone testing
Open **snowdoku.com** on any phone → browser menu → **Add to Home Screen /
Install app**. Full-screen, offline-capable, real app icon. This is the
fastest way to put it in testers' hands today.

## Google Play — ~$25 one-time
1. Create a Google Play Developer account ($25, one-time): play.google.com/console
2. Wrap the PWA as a Trusted Web Activity with Bubblewrap:
   `npm i -g @bubblewrap/cli && bubblewrap init --manifest https://snowdoku.com/manifest.json && bubblewrap build`
3. Upload the generated `.aab` to Play Console, add store listing
   (use `icons/icon-512.png` + screenshots), publish.
   The app IS the live site — every game update ships instantly, no store review.

## Apple App Store — $99/year + a Mac build step
1. Apple Developer Program: developer.apple.com ($99/yr).
2. Wrap with Capacitor (config can live in this repo):
   `npm i @capacitor/core @capacitor/cli @capacitor/ios && npx cap init SnowDoku com.openmirror.snowdoku --web-dir=.` then `npx cap add ios`.
3. Build/submit needs Xcode: either any Mac, or a cloud build service
   (Codemagic / Ionic Appflow — both build + submit iOS from this repo
   without owning a Mac).
4. Apple dislikes bare website wrappers — SnowDoku is fine (real game,
   offline play), but keep the Capacitor shell pointed at the bundled
   files (web-dir), not a URL.

## Store listing basics (both stores)
- Name: SlopeDoku — winter brain games (an OpenDoku game)
- Subtitle: Sudoku × winter sports. No luck, no crying.
- Category: Puzzle
- Price: free to start; the $3 goal fits better as "paid up front" on
  Apple / Play once there's a rating base, or keep free + promote the family.

## Promotion domains
Any new domain attaches to any Vercel project in one command
(`vercel domains add <domain> <project>`) — nameservers at GoDaddy →
ns1/ns2.vercel-dns.com, done. Ask Claude; it's a 2-minute job per domain.

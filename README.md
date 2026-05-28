# Claude Clicker

A cozy pixel-art idle/clicker game starring the Claude Code mascot. Single-file HTML, no build step — and an installable PWA that runs offline and feels native on phone and desktop.

## Features

- **Pixel-art mascot** with calm click squish, crit clicks, ripples, and floating sparkles
- **105 upgrades total** across three shops:
  - **Auto** — 16 buildings that generate tokens per second
  - **Click** — 10 upgrades that boost per-click power
  - **Boost** — 78 tier upgrades + 11 one-time power mods
- **Combo system** — chain clicks for escalating bonus multipliers (the click sound crescendos with the combo)
- **Golden Claude** spawns every 1–3 min → Frenzy (×7 for 15s) or Lucky (instant tokens)
- **Prestige (Vibes)** — ascend at 1B+ all-time tokens for a permanent boost
- **64 achievements** with toast notifications
- **Offline progress** — earn at 50% rate while away (8h cap) with a "welcome back" summary
- **Buy ×1 / ×10 / ×100 / Max** bulk-purchase toggle
- **Synthesized audio** (Web Audio, no asset files) with a mute toggle
- **Haptic feedback** on supported devices (clicks, crits, purchases, golden, achievements)
- **News ticker**, progress bars, production breakdown, and live stat chips
- **Auto-save** to localStorage every 5s + on backgrounding/close (resilient on mobile)
- **Keyboard shortcuts**: `Space` to click, `1/2/3/M` for buy multipliers, `S` to mute

## Installable app (PWA)

Claude Clicker is a full Progressive Web App, so it installs to the home screen and runs offline:

- **Web App Manifest** (`manifest.webmanifest`) — name, theme, and `any` + `maskable` icons
- **Service worker** (`sw.js`) — caches the app shell for offline play; network-first navigation so updates land instantly when online
- **App icons** in `icons/` (192 / 512 / maskable / Apple touch / favicons / social card)
- **Native feel** — fullscreen standalone display, safe-area insets for notched phones, no overscroll bounce / tap-highlight / long-press callout, a branded launch splash, and an in-app install prompt (Android/desktop) or "Add to Home Screen" hint (iOS)

### Install it

- **iPhone/iPad (Safari):** Share → **Add to Home Screen**
- **Android/desktop (Chrome/Edge):** tap the in-app **Install app** button, or use the browser's install icon

> Want it in the actual App Store / Play Store? Point [PWABuilder](https://www.pwabuilder.com/) at the deployed URL to package the PWA for store submission.

## Run locally

Just open `index.html` in a browser. No build, no dependencies. (For service-worker/PWA testing, serve over `localhost` or HTTPS — e.g. `npx serve .` — since service workers don't run from `file://`.)

## Regenerating icons

App icons are rendered from the mascot pixel-art by a small zero-dependency Node script (`node tools/cc-icons.js icons` if kept), using only Node's built-in `zlib`. No rasterizer or image library required.

## Deploy

Already configured for Vercel — push to GitHub and deploy. Relative asset paths mean it works both at a subpath locally and at the site root in production.

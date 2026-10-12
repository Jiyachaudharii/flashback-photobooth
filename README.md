# FLASHBACK ✦ your internet photo booth

A free, no-sign-up photo booth that runs entirely in the browser. Four shots with a countdown, vintage filters, and one downloadable photo strip. **Photos never leave the device**: there is no backend, no account, and no upload.

**Live demo:** _add your Vercel link here_

## Features

- **4-shot booth**: a 3-2-1 countdown and flash for each shot; tap any shot to retake it.
- **Filters**: Clear, Faded film, Y2K pop, Sepia, B&W (with film grain on export).
- **Strip papers**: Bubblegum, Chrome, Midnight, Classic.
- **Download or share**: a 1200px-wide PNG, plus the native share sheet on phones that support it.
- **Front/back camera flip** on devices with more than one camera.
- Clear error messages when camera access is blocked, missing, or busy.
- Responsive layout, keyboard focus states, and reduced-motion support.

## Tech

React 18 · TypeScript · Vite · HTML Canvas · `getUserMedia`

| File | What it does |
|---|---|
| `src/App.tsx` | Screens (landing → studio → result), camera hook, countdown, capture |
| `src/filters.ts` | Filter definitions, used for both the CSS preview and pixel-level export |
| `src/strip.ts` | Draws the final strip on a canvas |
| `src/styles.css` | Y2K design system and responsive layout |

### Design decisions

- **The camera starts in exactly one place.** A single `useEffect` in `useCamera` starts the stream when the studio mounts, restarts it when you flip cameras or retry, and stops every track on cleanup. The camera light turns off as soon as you leave the studio, and React StrictMode's double-mount can't leave a stream orphaned.
- **What you see is what you save.** Each filter is a list of CSS filter operations. The live preview uses the CSS string. The export applies the same color matrices from the W3C Filter Effects spec to the pixels. This approach also works on browsers that ignore `ctx.filter`.
- **Raw frames are stored and the filter is applied at export**, so you can change the filter after shooting.
- Frames are center-cropped to 4:3, and the front camera is mirrored so the strip matches the preview.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

The camera only works on `https://` or `localhost`. To test on your phone, deploy first; a plain LAN IP over http will be blocked.

## Deploy (Vercel, free)

1. Push this folder to a GitHub repo. `node_modules` and `dist` are already ignored.
2. In Vercel, import the repo. It auto-detects Vite. The build command is `npm run build` and the output directory is `dist`.
3. Open the HTTPS URL on an iPhone and an Android phone and run the checklist below.

## Launch checklist

- [ ] Landing page looks right on desktop and mobile
- [ ] Camera prompt appears; denying it shows the "Camera access was blocked" message
- [ ] Countdown captures four distinct photos
- [ ] Tapping a shot removes it, and "Shoot 1 more" refills it
- [ ] Each filter and paper changes the strip
- [ ] Downloaded PNG contains all four photos (on iPhone, check Files or Photos)
- [ ] DevTools → Network shows no uploads

## Privacy

No analytics, cookies, accounts, or servers. Images live in browser memory until you close the tab. The only network requests are for the page itself and Google Fonts.

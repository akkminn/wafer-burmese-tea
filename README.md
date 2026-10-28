# Wafer Dessert & Burmese Tea — pre-order website

Team 2 · IRS 154 · Booth: **26 Nov 2026, 1:00–4:00 PM, Building 11, 1st floor, in front of the auditorium room**

Shop name: **ဆရာကြီး**. A one-page React site styled after the "animated burger landing page" idea:
bold single-colour scenes, a spotlight, giant outlined words, and the product pulled apart with leader lines.

1. **Wafer scroll scenes** (green, real 3D): intro, Classic, Choco-Coco, Mixed-Layer, packed in the kraft box.
   Each box holds two stacks of 3 sheets, each with runny milk (ယို) or runny chocolate (ယို) and coconut slices (အုန်းသီးဖက်, young coconut)
   between them, and nothing on top. The drizzle drips and stretches as the layers pull apart. Dots on the left jump between scenes.
   Labels are in English and Burmese. If a device has no WebGL, a flat drawing is shown instead.
2. **Tea cup** (gold, scroll-driven 3D): a small cup, about 3 in / 7.5 cm tall, modelled on the real cup photos (straight tapered paper cup, ribbed collar, ဆရာကြီး sticker, flat brown sip lid with a raised centre and a sip slot). As you scroll the lid lifts off, milk falls in, sugar (drawn as cubes) drops in, then strong tea is poured from high and turns frothy, with steam rising. Labels with leader lines name each thing added (English + Burmese). The cup only turns a little, and the lid goes back on at the end. No jug is drawn; the liquids fall in from above. Code: `TeaScroll.jsx` (captions) + `Tea3D.jsx` (scene, timeline, labels) + `tea3d/parts.js` (shapes, stream and texture helpers); `CupSpin.jsx` (drag-to-spin) is the fallback when WebGL is off. Reference photos: `plastic_cup.png`, `cup_lid.webp` in the project folder.
3. **Videos:** phone-shaped players. Only the small poster loads with the page; the video downloads when the visitor presses play, and a tap pauses or resumes it. At the end of each video, while the picture is blurred, an info card fades in: logo, offer, prices, booth place and time, a QR code and the donation line.
4. **Pre-order:** pick quantities, choose a pickup slot, get an order code. 5 baht off every wafer and tea.
5. **Booth:** date, place, how it works, allergy notice, and the **QR code (download as PNG)**.

The layer recipes are in `src/components/WaferScroll.jsx` (`RECIPES`); the 3D shapes are in `src/components/wafer3d/parts.js` (coconut strips, drizzle, waffle texture). The colours are the CSS variables at the top of `src/styles.css`.

## Run it

```bash
npm install        # once
npm run dev        # http://localhost:5173
npm run build      # makes the "dist" folder you upload
```

## What you still need to fill in

Everything is in **`src/config.js`**. Empty values are simply hidden or handled.

| Setting | What it does |
|---|---|
| `siteUrl` | The final web address, used for the QR code. If empty, the QR uses whatever address you opened. |
| `orderEndpoint` | Read from the `VITE_ORDER_ENDPOINT` environment variable (see below): the Apps Script link that saves orders and payment slips. Until it is set, nothing is saved and customers are asked to send the slip on LINE. See `apps-script/README.md`. |
| `lineOAId` | Your LINE Official Account (e.g. `@wafertea`) so "Send on LINE" opens a chat with you. |
| `social` | Instagram, TikTok, and LINE handles shown in the booth section. |
| `prices.wafer` | Wafer price per flavour (Classic 45, Choco-Coco 55, Mixed-Layer 50). |
| `preorder.discount` / `preorder.mode` | 5 baht off. `perItem` = every wafer and tea in the order (default), `perOrder` = once per order. |
| `preorder.closesISO` | Optional pre-order deadline, e.g. `'2026-11-25T23:59:00+07:00'`. |
| `donation` | The sentence about donating profits. Add the recipient when decided. |
| `allergy` | The allergy notice. Check it with whoever prepares the food. |

## Payment

Pre-orders are paid **in advance** by PromptPay. After "Next: pay", the customer sees a PromptPay QR that already contains their
exact total (built in `src/promptpay.js` from the number in `CONFIG.payment`), uploads a screenshot of the slip, and you confirm it.
On booth day they tell you their name or show the order code. Walk-ins (no pre-order) simply pay at the booth.

When the slip is sent, the customer gets a picture of their order ticket (code, name, pickup, items, total) to save and show at the booth (`src/ticket.js`).

## Environment variables (keep private values out of Git)

| Name | What it is |
|---|---|
| `VITE_ORDER_ENDPOINT` | The Apps Script web-app URL (`apps-script/README.md`). Without it slips cannot be uploaded. |
| `VITE_PROMPTPAY_ID` | The PromptPay mobile number that receives the payments. Without it the payment QR is not shown. |

- **Local:** copy `.env.example` to `.env.local` and fill it in. `.env.local` is ignored by Git.
- **Vercel:** Project Settings > Environment Variables, add both names (Production and Preview), then **redeploy**. The values are baked in at build time.
- They are not secret from visitors (the browser needs them to show the QR and send orders); the point is that they stay out of the public Git repository.

The slip upload needs the Apps Script endpoint (`apps-script/README.md`, which also stores the slips in a private Drive folder).
Until `orderEndpoint` is set, customers are asked to send the slip on LINE instead.

## Photos and logo

- `public/img/logo-large.webp` and `logo-sticker.webp` come from `logo.png`.
- Wafer photos come from your final deck. To use your own photos instead, replace the files in `public/img/` with the same names.

## Add your videos

1. Convert each video to **MP4 (H.264 + AAC), vertical 9:16, about 720×1280**. Phone `.mov` files often have audio that browsers cannot play. This command works:
   `ffmpeg -i "my video.mov" -vf scale=720:1280 -c:v libx264 -crf 24 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k public/videos/name.mp4`
2. Make a still image for the first frame (optional): `ffmpeg -ss 4 -i "my video.mov" -frames:v 1 -vf scale=540:960 public/videos/name.jpg`
3. Add an entry to `VIDEOS` in `src/data.js` (copy the first one). Set `endAt` to the second where the picture is fully blurred. The info card fades in there.
4. A video whose file is missing is hidden on the live site (in dev it shows a placeholder).

Current video: `public/videos/tea-1.mp4` (blur is complete from 11.9 s, `endAt: 11.5`).

If the videos will also be posted on Instagram/TikTok, the info and the QR must be **burned into the video file itself** (the page card only exists on this website). See `Team 2 - Video brief for members.md`.

## Put it online

Pick one (all free):
- **Netlify Drop**: run `npm run build`, then drag the `dist` folder onto <https://app.netlify.com/drop>.
- **Vercel**: import the project (or run `npx vercel` inside `website/`). Framework preset **Vite**, Root Directory **`website`**, build command `npm run build`, output `dist`. Nothing else to set. The QR code uses the address it is opened on, so the QR on the live site is already the final one (`siteUrl` only matters for a custom domain).
- **GitHub Pages**: upload this folder and set the build command to `npm run build`, output folder `dist`.

Then open the live site, scroll to the Booth section, press **Download QR (PNG)**, and give that file to the video editors and the poster designer.

## Pricing rules (in `src/pricing.js`)

Wafer: Classic 45, Choco-Coco 55, Mixed-Layer 50 · Tea 35 · every wafer + tea pair saves 5, every day (so Classic Combo = 75, Choco-Coco Combo = 85, Mixed Combo = 80, Share & Sip of two Classic = 120) · pre-order: another 5 off every wafer and every tea.

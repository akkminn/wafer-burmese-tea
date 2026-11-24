# Walk-in sales setup

This feature is on `/staff/walk-in`. Staff sign in with an email and password configured in server-only environment variables (no Google OAuth required). Walk-in records are saved into the **same Google Spreadsheet as pre-orders** (`16jAoXImadvU2clmyGB-t9A3UChbKICS1BEiPpYtIiw0`), inside three new tabs (`Sales`, `SaleItems`, and `AuditLog`) alongside the existing `Orders` tab.

The staff page is optimized for phones with bottom tabs (**New Sale**, **Summary**, **History**), quick combo buttons, a sticky total bar, and a live exact-amount **PromptPay QR** code (with a full-screen customer QR modal). Staff must still verify cash in hand or bank app confirmation before saving; the system does not query a bank.

## 1. Update the Apps Script on your pre-order spreadsheet (recommended: one script, one sheet)

1. Open your pre-order spreadsheet (`16jAoXImadvU2clmyGB-t9A3UChbKICS1BEiPpYtIiw0`), then open **Extensions → Apps Script**.
2. Replace `Code.gs` with [`apps-script/Code.gs`](../apps-script/Code.gs). It keeps pre-orders & slips writing to `Orders`, and handles HMAC-signed walk-in POS calls writing to three new tabs (`Sales`, `SaleItems`, `AuditLog`) in the **same spreadsheet**.
3. In **Project Settings → Script Properties**, add `WALKIN_SHARED_SECRET` (same 32-byte hex secret as Vercel's `WALKIN_APPS_SCRIPT_SECRET`).
4. Select the `setup` function in the toolbar and click **Run** once. It keeps `Orders` intact and automatically creates the `Sales`, `SaleItems`, and `AuditLog` tabs with frozen row 1 headers.
5. Deploy a new version: **Deploy → Manage deployments → Edit → New version → Deploy**.
6. In Vercel, `WALKIN_APPS_SCRIPT_URL` can point to this same `/exec` URL (or be omitted so it automatically reuses `VITE_ORDER_ENDPOINT`).

*(If you still prefer keeping a separate Apps Script deployment, [`walkin-apps-script/Code.gs`](../walkin-apps-script/Code.gs) also points to the same pre-order spreadsheet `16jAoXImadvU2clmyGB-t9A3UChbKICS1BEiPpYtIiw0` and auto-creates `Sales`, `SaleItems`, and `AuditLog`.)*

## 2. Configure staff accounts & Vercel environment variables

Add these environment variables in Vercel (**Project Settings → Environment Variables**) for Production and Preview, then redeploy:

| Name | Visibility | Value |
|---|---|---|
| `VITE_ORDER_ENDPOINT` | Public | Pre-order & walk-in Apps Script `/exec` URL |
| `VITE_PROMPTPAY_ID` | Public | PromptPay mobile number or ID (generates exact-amount QR codes) |
| `STAFF_ACCOUNTS` | Server only | Comma-separated `email:password:role` entries, e.g. `admin@example.com:StrongPass123:admin,staff@example.com:BoothPass123:staff` |
| `STAFF_SESSION_SECRET` | Server only | Optional random secret for signing 12-hour staff sessions (defaults to `WALKIN_APPS_SCRIPT_SECRET` if omitted) |
| `WALKIN_APPS_SCRIPT_SECRET` | Server only | Same HMAC secret as `WALKIN_SHARED_SECRET` in Script Properties |
| `WALKIN_APPS_SCRIPT_URL` | Server only | Optional — falls back to `VITE_ORDER_ENDPOINT` if using the unified Apps Script |

Roles in `STAFF_ACCOUNTS`:
- `admin` (or `manager` / `void`): can record sales, view summary/history, and **void** completed sales.
- `staff` (default if omitted): can record sales and view summary/history, but cannot void sales.

Alternatively, for a single admin account, you can set `STAFF_LOGIN_EMAIL` and `STAFF_LOGIN_PASSWORD` instead of `STAFF_ACCOUNTS`.

Never put `STAFF_ACCOUNTS`, `STAFF_LOGIN_PASSWORD`, `STAFF_SESSION_SECRET`, or `WALKIN_APPS_SCRIPT_SECRET` in a `VITE_` variable.

## 3. Run and verify locally

1. Run `npm test` and `npm run build` inside `website/`.
2. Ensure `.env.local` has `STAFF_ACCOUNTS`, `VITE_PROMPTPAY_ID`, `VITE_ORDER_ENDPOINT` (or `WALKIN_APPS_SCRIPT_URL`), and `WALKIN_APPS_SCRIPT_SECRET`.
3. Run `npm run dev:full` from `website/` so both the Vite frontend and `/api/staff/*` Vercel Functions run together.
4. Open `http://localhost:3000/staff/walk-in`, sign in with your configured email & password, test a Cash sale and a PromptPay QR sale, and verify `Sales`, `SaleItems`, and `AuditLog` tabs in your pre-order spreadsheet.

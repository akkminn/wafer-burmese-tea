# Walk-in sales & pre-order pickup setup

This feature is on `/staff/walk-in`. Staff sign in with an email and password configured in server-only environment variables. Walk-in records are saved into the **same Google Spreadsheet as pre-orders** (`16jAoXImadvU2clmyGB-t9A3UChbKICS1BEiPpYtIiw0`), using separate tabs (`Sales`, `SaleItems`, `AuditLog`) alongside the existing `Orders` tab.

The staff page is optimized for phones with bottom tabs (**Sale**, **Pickups**, **Summary**, **History**), quick combo buttons, a sticky total bar, live exact-amount **PromptPay QR** codes (with a full-screen customer QR modal), and pre-order search & pickup confirmation. Staff must still verify cash in hand or bank app confirmation before saving.

## 1. Deploy the unified Apps Script on your pre-order spreadsheet

1. Open your pre-order spreadsheet (`16jAoXImadvU2clmyGB-t9A3UChbKICS1BEiPpYtIiw0`) → **Extensions → Apps Script**.
2. Paste [`apps-script/Code.gs`](../apps-script/Code.gs) and save.
3. In **Project Settings → Script Properties**, add `WALKIN_SHARED_SECRET` (same 32-byte hex secret as Vercel's `WALKIN_APPS_SCRIPT_SECRET`).
4. Select **`setup`** in the toolbar and click **Run** once. It keeps `Orders` intact and auto-creates `Sales`, `SaleItems`, and `AuditLog` with frozen row 1 headers.
5. Deploy a new version: **Deploy → Manage deployments → Edit → New version → Deploy**.

## 2. Configure Vercel environment variables

Add these variables in Vercel (**Project Settings → Environment Variables**) for Production and Preview, then redeploy:

| Name | Visibility | Value |
|---|---|---|
| `VITE_ORDER_ENDPOINT` | Public | Unified Apps Script `/exec` URL |
| `VITE_PROMPTPAY_ID` | Public | PromptPay mobile number or ID |
| `STAFF_ACCOUNTS` | Server only | Comma-separated `email:password:role` entries, e.g. `admin@example.com:StrongPass123:admin,staff@example.com:BoothPass123:staff` |
| `WALKIN_APPS_SCRIPT_SECRET` | Server only | Same HMAC secret as `WALKIN_SHARED_SECRET` in Script Properties |
| `STAFF_SESSION_SECRET` | Server only | Optional random secret for 12-hour staff sessions (defaults to `WALKIN_APPS_SCRIPT_SECRET`) |

Roles in `STAFF_ACCOUNTS`:
- `admin` (or `manager` / `void`): can record walk-in sales, confirm pre-order pickups, view summary/history, and **void** completed sales.
- `staff` (default if omitted): can record walk-in sales, confirm pre-order pickups, and view summary/history, but cannot void sales.

Never put `STAFF_ACCOUNTS`, `STAFF_SESSION_SECRET`, or `WALKIN_APPS_SCRIPT_SECRET` in a `VITE_` variable.

## 3. Run and verify locally

1. Copy [`.env.example`](../.env.example) to `.env.local` and fill in your values.
2. Run `npm test` and `npm run build` inside `website/`.
3. Run `npm run dev` and open `http://localhost:5173/staff/walk-in` (or your LAN IP on your phone). Both the staff UI and `/api/staff/*` endpoints run directly under `npm run dev`.

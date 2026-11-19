# Walk-in sales setup

This feature is on `/staff/walk-in`. The public site and pre-order endpoint are separate. The staff page does not collect customer names or accounts. Staff must verify cash or PromptPay receipt themselves before saving; the system does not query a bank.

## 1. Create the spreadsheet

Create a Google spreadsheet that only the booth managers can edit. Set its time zone to **Asia/Bangkok**. Create three worksheets with these exact names and put the following headers in row 1, in order:

**Sales**

```text
sale_id,request_id,timestamp,staff_id,sale_type,subtotal,combo_discount,total,currency,payment_method,payment_status,sale_status,voided_at,void_reason,voided_by,record_state,request_hash
```

**SaleItems**

```text
sale_id,product_id,product_name,quantity,unit_price,line_total
```

**AuditLog**

```text
timestamp,sale_id,action,staff_id,reason
```

The last three Sales columns support void accountability and recovery from incomplete writes. Do not edit, sort, or delete rows while the booth is taking sales. The dashboard recognizes only `record_state=COMPLETED`, `sale_status=completed`, and `payment_status=paid` for revenue.

## 2. Deploy the separate Apps Script

1. Open **Extensions → Apps Script** from that spreadsheet and replace its `Code.gs` with [`walkin-apps-script/Code.gs`](../walkin-apps-script/Code.gs).
2. In **Project Settings → Script Properties**, add `SHEET_ID` (the ID between `/d/` and `/edit` in the spreadsheet URL) and `WALKIN_SHARED_SECRET` (a new random secret of at least 32 bytes). For example, generate one locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep it private.
3. Deploy as a **Web app**, executing as the owner. Select access **Anyone** so the Vercel server can call it without an interactive Google session. Every action, including reads, requires a valid HMAC signature and a recent timestamp; callers without the secret cannot write or read sales. The web app URL itself is not a credential.
4. Copy the `/exec` deployment URL into the server-only `WALKIN_APPS_SCRIPT_URL` variable. When changing `Code.gs`, deploy a new version so the live URL runs the new code.

The Apps Script HMAC secret must match the Vercel secret. Rotate both together if it is exposed. The deployment should be used only for walk-in data; leave the pre-order Apps Script deployment alone.

## 3. Configure Google sign-in

In Google Cloud Console, create a **Web application OAuth client ID** for the staff page. Configure the OAuth consent screen as needed and add your Vercel domain plus local development origin (usually `http://localhost:3000` for `vercel dev`) as authorized JavaScript origins. If the consent screen is in testing mode, add each staff account as a test user.

Set the same client ID as `VITE_GOOGLE_CLIENT_ID` (public, built into the staff page) and `GOOGLE_CLIENT_ID` (server-side audience check). Add comma-separated, exact Google email addresses to `STAFF_ALLOWED_EMAILS`. Add manager email addresses to `STAFF_VOID_EMAILS`; each void manager must also appear in `STAFF_ALLOWED_EMAILS`. Only a verified Google ID token for an allowed address can call the staff API. Sign-in tokens are kept in page memory and are not written to local storage.

## 4. Configure Vercel

Keep the Vercel project root at this repository and the output directory at `dist`. Add these environment variables to the intended Preview/Production environments:

| Name | Visibility | Value |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Public | OAuth web client ID |
| `GOOGLE_CLIENT_ID` | Server only | Same OAuth web client ID |
| `STAFF_ALLOWED_EMAILS` | Server only | Comma-separated staff emails |
| `STAFF_VOID_EMAILS` | Server only | Comma-separated manager emails |
| `WALKIN_APPS_SCRIPT_URL` | Server only | Separate Apps Script `/exec` URL |
| `WALKIN_APPS_SCRIPT_SECRET` | Server only | Same secret as Script Property |

Do not put the secret, spreadsheet ID, or staff allowlists in a `VITE_` variable. The existing `VITE_ORDER_ENDPOINT` and `VITE_PROMPTPAY_ID` are unrelated and should remain as configured for pre-orders. Adding or changing environment variables requires a new Vercel build/deployment. Do not deploy this feature until a manager has tested the spreadsheet and staff access.

## 5. Run and verify locally

1. Run `npm ci`, `npm test`, and `npm run build`.
2. Copy [`.env.walkin.example`](../.env.walkin.example) to `.env.local` and fill in the values for a **test** spreadsheet and script deployment. Preserve any existing pre-order values already in `.env.local`.
3. Use Vercel CLI `vercel dev` from the repository root to run the static site and `/api/staff/*` functions together. Plain `npm run dev` serves the staff UI but not the Vercel Functions.
4. Open `/staff/walk-in`, sign in with an allowed Google account, and record one test Cash sale and one test PromptPay sale. Confirm Sales, SaleItems, AuditLog, history, and summary. Test a void with a manager account and confirm revenue decreases while history remains.
5. Check that an unlisted Google account cannot read sales, a listed non-manager cannot void, and the public pre-order page still loads.

For an uncertain network result, the staff page keeps the same request ID and cart locally. Use **Check status**, then **Retry same request** if needed. Never create a new sale ID to retry an uncertain payment. Do not clear the pending request until the completed sale is shown or a manager has investigated it.

## Operational limits and troubleshooting

- **No automatic payment verification:** The checkbox records staff confirmation. Check the bank app for PromptPay or cash in hand before saving. Unconfirmed payments should not be entered as completed sales.
- **Apps Script and Sheets are not transactional across worksheets:** The script writes a `PENDING` Sales record, reconciles item rows and the audit row under a script lock, then marks the sale `COMPLETED`. A partial write stays out of history and revenue until the same request ID is retried. Do not delete pending rows manually during the event.
- **Apps Script quotas and timeouts:** A quota or timeout can leave a pending request. Check its status and retry with the same ID. Review Apps Script **Executions** for server errors. If a request remains pending, keep its ID and ask a manager to inspect the three worksheets.
- **Sign-in error:** Check the Google authorized JavaScript origin, test users, both client ID values, and the staff allowlist. Sign in again when the token expires.
- **Storage unavailable:** Check both copies of the HMAC secret, the `/exec` URL, the spreadsheet ID, sheet names, and row 1 headers. A new Apps Script version must be deployed after code changes.
- **Do not expose records:** Keep the spreadsheet shared only with managers. The staff page route is publicly reachable, but every data API call verifies a Google token and an allowlist; the Apps Script endpoint verifies the server HMAC signature.

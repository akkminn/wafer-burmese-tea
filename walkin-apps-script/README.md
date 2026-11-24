# Walk-in storage script

`Code.gs` is the Apps Script deployment for staff walk-in sales. It writes to `Sales`, `SaleItems`, and `AuditLog` tabs inside the same Google Spreadsheet used for pre-orders (`16jAoXImadvU2clmyGB-t9A3UChbKICS1BEiPpYtIiw0`), without modifying the existing `Orders` tab or pre-order endpoint.

The script automatically creates `Sales`, `SaleItems`, and `AuditLog` with their required row 1 headers if they do not exist yet (or run `setup()` once from the Apps Script editor).

Follow [the full setup guide](../docs/walk-in-setup.md) to set Script Properties, deploy the web app, and connect the Vercel Functions. Do not paste the shared secret into React or a `VITE_` variable.

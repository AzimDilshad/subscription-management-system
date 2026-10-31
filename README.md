# Brightloop — Subscription Management System

React + Vite front end, Supabase (Postgres + Auth) back end.

## 1. Run it
```bash
npm install
cp .env.example .env      # then paste your Supabase URL + anon key
npm run dev
```
`.env` (Supabase → Project Settings → API):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
Use the **anon / public** key only. Never put the service_role key in a Vite app.

### Deploy to Vercel
1. Push this project to a Git provider and import it into Vercel. The included `vercel.json`
   selects Vite, builds with `npm run build`, publishes `dist`, and routes app URLs to the SPA entry.
2. In Vercel → Project Settings → Environment Variables, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` for Preview and Production. Use the Supabase anon/public key only.
   These values are included in the browser build, so never add a service-role or other secret key.
3. Redeploy after adding variables. In Supabase Authentication → URL Configuration, set the
   production Site URL to your Vercel domain and add the Vercel preview URLs to allowed redirect URLs.

`.gitignore` excludes local `.env` files, dependency folders, build output, and `.vercel` metadata;
`.env.example` stays tracked as the configuration template. The Supabase public URL and anon key
must be configured in the Vercel project before sign-in and database features can work.

## 2. Edits to make in Supabase (one time)
1. **SQL Editor → New query →** paste all of `supabase/schema.sql` → Run.
   Creates tables, indexes, row-level security, invoice generation, billing run, dashboard function.
2. **Authentication → Providers → Email →** set *Minimum password length* to **9** and
   require lowercase, uppercase and symbols (the app checks this too).
   For quick testing you may switch off *Confirm email*.
3. **Authentication → URL Configuration →** Site URL `http://localhost:5173`
   (add your deployed URL later). The password-reset link returns here.
4. Sign up in the app, then make yourself admin (SQL Editor):
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```
   After that, admins add staff from **Users & staff** (the person signs up first, admin promotes them).
5. Optional – automatic daily billing: enable the `pg_cron` extension and uncomment the
   `cron.schedule` line at the bottom of `schema.sql`.

## 3. How the brief maps to the code
| Brief | Where |
|---|---|
| One account per email, strong password | Supabase Auth + `passwordError()` |
| Roles: admin / staff / customer | `profiles.role`, RLS policies, `Workspace.jsx` menus |
| Only admin adds staff | `protect_role` trigger + Users page |
| Products, variants (+560 for Odoo), plans, lifecycle flags | Products / Plans pages |
| Quote templates, number, Draft→Active→Closed | Subscriptions page |
| Invoices auto-built, taxes, never twice | `generate_invoice()`, `unique(subscription_id, period_start)` |
| Discounts auto-applied, limits, expiry | `discounts` table + `generate_invoice()` |
| Payments against invoices, paid / outstanding | Payments page + `apply_payment` trigger |
| Finance dashboard, overdue, < 2 s pages | Dashboard, `dashboard_stats()`, indexes, server-side paging |

## 4. Admin feature update
The admin workspace also includes product categories, quotation records, refund tracking,
payment-method configuration, notification templates, support tickets, automation-rule
configuration, business settings, and a read-only audit log. The additive database update is
`supabase/migrations/20261031000000_admin_features.sql`.

To apply it, open **Supabase Dashboard → SQL Editor → New query**, paste that migration, and
run it after the original `supabase/schema.sql`. Existing data is retained. For Supabase CLI,
keep the migration in `supabase/migrations` and run `supabase db push` against the linked
project. Supabase database updates use SQL migrations; YAML is not the database migration
format.

The additional customer, quotation, search, tax, payment and automation workflows are in
`supabase/migrations/20261101000000_workflows.sql`,
`supabase/migrations/20261102000000_automation_notifications.sql`, and
`supabase/migrations/20261103000000_tax_financial_fields.sql`. Run them in timestamp order
after the admin feature update. When using SQL Editor, paste and run each file as its own
query.

Subscription pause/resume uses a PostgreSQL enum update followed by its RPC migration. Run
`supabase/migrations/20261104000000_subscription_status_values.sql` by itself, then run
`supabase/migrations/20261105000000_subscription_pause_resume.sql`. The admin Automation page
can run billing catch-up, quote expiry, plan closure, and in-app overdue reminders. Schedule
`select run_business_automations();` with Supabase pg_cron to run those jobs automatically.
For a daily run at 02:00 UTC, enable the `pg_cron` extension, then use:
```sql
select cron.schedule(
  'brightloop-business-automations',
  '0 2 * * *',
  $$ select public.run_business_automations(); $$
);
```

If subscription creation reports `record "new" has no field "total"`, apply
`supabase/migrations/20261106000000_fix_business_notification_trigger.sql` in SQL Editor as
its own query. It corrects the shared invoice/payment/subscription notification trigger.

The migration adds RLS policies and append-only activity logs for core record changes. Admin
rules and notification templates are configuration records: sending email/SMS/WhatsApp,
processing refunds through a gateway, executing automation actions, and scheduled workers
require trusted server-side integrations and credentials. Do not put gateway secrets in the
browser or public payment-method configuration.
"# subscription-management-system" 

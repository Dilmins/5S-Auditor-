# JASTECA — 5S Monthly Audit

Multi-organisation 5S audit tool. Vidullanka PLC is the original organisation, but admins and external (senior) auditors can add further organisations and sites from within the app — this is no longer a single fixed-organisation build.

- Username/password authentication
- Three roles: `admin`, `internal` (Auditor), `external` (Senior Auditor)
- Internal auditors are assigned to one or more organisations, and to specific site(s) within each — they can only read/save/delete audits for sites they're actually granted
- External auditors and admins can access every organisation and every site
- Server-side authorisation on every audit read/save/delete request — enforced by session lookup, never trusted from the browser
- Adding or removing an organisation or a site is restricted to `admin`/`external` accounts only
- Neon PostgreSQL as the database, accessed only from server-side API routes
- Auditor name/type populated from the authenticated account, not from client input
- Excel and Word export retained
- Electronic signature retained
- Admin API and admin panel for creating and managing auditor accounts, organisations, and site assignments

## Important architecture

The browser does **not** connect directly to Neon. The Neon `DATABASE_URL` remains a server-side environment variable in Vercel. The browser calls `/api/*` endpoints, and those endpoints use `@neondatabase/serverless`.

This is required because a Neon database password/connection string must never be placed in `index.html`.

## Deploy

1. Put this project in your GitHub repository.
2. Import the repository into Vercel.
3. Add environment variables:
   - `DATABASE_URL` = the same Neon connection string used by your existing application.
   - `ADMIN_BOOTSTRAP_SECRET` = a long random temporary secret.
4. Deploy.
5. Run `schema.sql` in the same Neon database. **See note below — this file is currently out of date and does not yet create the organisation tables the app relies on.**
6. Call `POST /api/admin-bootstrap` once with header `x-bootstrap-secret` and an admin username/password. After the admin is created, remove `ADMIN_BOOTSTRAP_SECRET` from Vercel or change it.
7. Sign in as the admin and create internal/external auditor accounts, organisations, and site assignments.

## Account rules

- `admin`: can manage users, organisations, and sites, and can view all audits.
- `internal`: can only view/save/delete audits for the organisation(s) and site(s) assigned to that account.
- `external`: can view/save/delete audits for every organisation and every active site.

The role is taken from the database account. It is not trusted from the browser.

## Organisations and sites

- Any organisation's audits, sites, and history persist independently — deleting an organisation or a site is blocked if it still has saved audit history or assigned auditors.
- Adding a new organisation or site is an `admin`/`external` action only, done from the Admin panel. Internal auditors cannot add or remove organisations or sites.

## Known issue — schema.sql is out of date

`schema.sql` in this repo only creates the original single-organisation tables (a flat `five_s_sites` list and a `five_s_audits.organisation` text column). It does not create the tables the current API code actually queries: `five_s_organisations`, `five_s_org_sites`, `five_s_user_organisations`, or the `organisation_id` column on `five_s_audits`.

If your live database already has these (which it must, since the "Add organisation" feature is working in production), this file is just stale documentation — safe to ignore for an existing deployment, but it will fail if run against a brand-new Neon database. It should be updated to match the live schema before it's relied on for a fresh setup or disaster recovery.

## Existing Neon database

Use the **same `DATABASE_URL`** from your existing Neon-backed application. The SQL creates separate tables beginning with `five_s_`, so it does not modify your existing Kaizen tables.

# Vidullanka PLC — 5S Monthly Audit + Neon PostgreSQL

This version keeps the existing 5S audit design but adds:

- Vidullanka PLC fixed as the organisation
- Username/password authentication
- Internal Auditor and External Auditor roles
- Internal auditors can access only their assigned site(s)
- External auditors can access all sites
- Server-side authorisation on every audit read/save/delete request
- Neon PostgreSQL as the database
- Auditor name/type populated from the authenticated account
- Excel and Word export retained
- Electronic signature retained
- Admin API for creating and managing auditor accounts

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
5. Run `sql/schema.sql` in the same Neon database.
6. Call `POST /api/admin-bootstrap` once with header `x-bootstrap-secret` and an admin username/password. After the admin is created, remove `ADMIN_BOOTSTRAP_SECRET` from Vercel or change it.
7. Sign in as the admin and create internal/external auditor accounts.

## Account rules

- `admin`: can manage users and view all audits.
- `internal`: can only view/save/delete audits for the site(s) assigned to that account.
- `external`: can view/save/delete audits for every active site.

The role is taken from the database account. It is not trusted from the browser.

## Existing Neon database

Use the **same `DATABASE_URL`** from your existing Neon-backed application. The SQL creates separate tables beginning with `five_s_`, so it does not modify your existing Kaizen tables.

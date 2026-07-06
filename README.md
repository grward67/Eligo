# Eligo Voting (Next.js)

## Local setup

```bash
npm install
npm run db:generate
npm run db:migrate    # applies the schema to DATABASE_URL, prompts for a migration name
npm run db:seed       # creates the one admin account from .env (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run dev
```

`DATABASE_URL` must point at a Postgres database (see Deployment below —
use a separate dev database/branch from production).

## Testing

```bash
npm test
```

Covers: the STV counting engine (`src/lib/stv/count.test.ts`), access-code
generation/hashing (`src/lib/auth/access-code.test.ts`), route protection
(`tests/middleware.test.ts`), and ballot submission
(`src/lib/services/ballot-service.test.ts`, against an in-memory fake
Prisma client so it doesn't need a real database).

## Using it

1. Sign in at `/admin/login`.
2. Create an election, add candidates, set status to `OPEN`.
3. Generate access codes on the election's "Access codes" page (choose
   reusable or a max-use count) and download the CSV.
4. Give voters the link `/vote/<electionId>` — they enter a code, then
   are redirected to the ballot page to rank candidates.
5. View live results and the round-by-round audit trail on the
   election's "Results" page; view all admin/voter events on `/admin/audit`.

## Deployment (Vercel + Postgres)

1. Create a Postgres database (Neon, Vercel Postgres, or Supabase all
   have free tiers) and grab its connection string.
2. Point your local `.env`'s `DATABASE_URL` at it (or a separate dev
   branch/database) and run `npm run db:migrate` once to create the
   schema, then `npm run db:seed` to create the admin account.
3. Push this repo to GitHub, import it in Vercel, and set these
   environment variables in the Vercel project settings (same values
   as your `.env`, generate fresh secrets for production — don't reuse
   local dev secrets):
   - `DATABASE_URL`
   - `ADMIN_SESSION_SECRET`
   - `VOTER_SESSION_SECRET`
   - `ACCESS_CODE_HASH_SECRET`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (only needed once, to seed)
4. After the first deploy, run the seed once against production —
   easiest way is running `npm run db:seed` locally with
   `DATABASE_URL` temporarily set to the production connection string.
5. Add your custom domain in Vercel's project settings and point its
   DNS record at Vercel from wherever the domain is registered.

## Notes on this first pass

- Admin accounts are only created via `npm run db:seed` — there's no
  public admin signup route, deliberately.
- Election/candidate editing is minimal (no delete/reorder), there's no
  "revoke a voter session" admin action, and the audit log page is a
  flat global list rather than filtered per-election.

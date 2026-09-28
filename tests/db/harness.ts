import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

// Real Postgres (PGlite: the Postgres engine compiled to WASM, in-process)
// with every migration in supabase/migrations applied, on top of a minimal
// shim of what the Supabase platform provides: the anon / authenticated /
// service_role roles, auth.users, auth.uid(), and Supabase's default
// privileges (postgres-created tables are granted to all three API roles).
// Runs inside `npm run test` locally and in CI — no Docker, no Supabase CLI.

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations')

const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  -- Same contract as Supabase: the JWT "sub" claim of the current request.
  create function auth.uid () returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid () to anon, authenticated, service_role;

  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on functions to anon, authenticated, service_role;
`

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_SHIM)
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  return db
}

// Creates an auth user the way GoTrue does (which fires handle_new_user).
export async function signUp(db: PGlite, id: string, inviteCode: string | null): Promise<void> {
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    `${id}@example.com`,
    inviteCode === null ? {} : { invite_code: inviteCode },
  ])
}

type Role = 'anon' | 'authenticated' | 'service_role'

// Runs `fn` exactly as PostgREST would for a request from `role` (and, for
// authenticated, the user `uid`), then rolls back so tests stay independent.
export async function as<T>(
  db: PGlite,
  role: Role,
  uid: string | null,
  fn: (tx: Pick<PGlite, 'query' | 'exec'>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(uid ? { sub: uid, role } : { role }),
    ])
    await tx.exec(`set local role ${role}`)
    const result = await fn(tx)
    await tx.rollback()
    return result
  })
}

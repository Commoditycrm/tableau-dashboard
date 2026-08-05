import { sql } from '@vercel/postgres'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

// Fallback seed value used only when app_settings has no dashboard_url yet.
// After the first admin edit in the app, the DB value is the source of truth.
const DEFAULT_DASHBOARD_URL =
  process.env.TABLEAU_DASHBOARD_URL ||
  process.env.VITE_TABLEAU_DASHBOARD_URL ||
  'https://us-east-1.online.tableau.com/#/site/smartlogistics/views/SCai/Dashboard_1?:iid=1'

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)`
  console.log('users table is ready')

  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by TEXT
    )
  `
  // Seed the dashboard URL once; never overwrite an admin's saved value.
  await sql`
    INSERT INTO app_settings (key, value, updated_by)
    VALUES ('dashboard_url', ${DEFAULT_DASHBOARD_URL}, 'init-db')
    ON CONFLICT (key) DO NOTHING
  `
  console.log('app_settings table is ready (dashboard_url seeded)')

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

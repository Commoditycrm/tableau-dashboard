import { sql } from '@vercel/postgres'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

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
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

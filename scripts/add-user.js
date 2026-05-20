import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

async function main() {
  const [rawEmail, password] = process.argv.slice(2)
  if (!rawEmail || !password) {
    console.error('Usage: node scripts/add-user.js <email> <password>')
    process.exit(1)
  }

  const email = rawEmail.trim().toLowerCase()
  const hash = await bcrypt.hash(password, 10)

  await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${hash})
    ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash
  `

  console.log(`upserted user: ${email}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

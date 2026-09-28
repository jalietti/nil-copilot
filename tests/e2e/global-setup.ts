import { execSync } from 'node:child_process'

// Every run starts from the seed (supabase/seed.sql), since tests change data.
export default function globalSetup() {
  execSync('npx -y supabase@2 db reset', { stdio: 'inherit' })
}

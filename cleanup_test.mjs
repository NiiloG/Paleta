import { readFileSync } from 'fs'

const URL_BASE = 'https://fbolmgbcvykkkfgxgvwi.supabase.co'
const SVC_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZib2xtZ2Jjdnlra2tmZ3hndndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTcwNTI4MSwiZXhwIjoyMDk1MjgxMjgxfQ.3KRHw0flL65Mxawy0d5pl8rH7smqAaNPKp46zKDjqZ0'
const H = { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` }

const { uids } = JSON.parse(readFileSync('./test_uids.json', 'utf8'))

console.log(`\n  Deleting ${uids.length} test accounts...\n`)

let n = 0
for (const id of uids) {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: H })
  if (r.ok) { n++; process.stdout.write(`  ✓  ${id}\n`) }
  else { process.stdout.write(`  ✗  ${id} (${r.status})\n`) }
}

console.log(`\n  Done — ${n}/${uids.length} accounts deleted.\n`)

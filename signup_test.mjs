import { writeFileSync } from 'fs'

const URL_BASE = 'https://fbolmgbcvykkkfgxgvwi.supabase.co'
const SVC_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZib2xtZ2Jjdnlra2tmZ3hndndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTcwNTI4MSwiZXhwIjoyMDk1MjgxMjgxfQ.3KRHw0flL65Mxawy0d5pl8rH7smqAaNPKp46zKDjqZ0'
const EVENT_ID = '7d929692-447a-4af4-8eb3-7376c70c8456'
const ELO      = 857   // display score 3.00
const TAG      = 'ct'  // claude test

const H = { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }

async function api(method, path, body) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method, headers: { ...H, Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(j))
  return j
}

const NAMES = [
  'Alex Mora','Ben Torres','Carlos Ruiz','Diana Vega','Emma Soler',
  'Finn Ortiz','Grace Leal','Hugo Pons','Isabel Reig','Jack Blanco',
  'Karen Font','Luis Serra','Maria Cano','Nick Roca','Olivia Mas',
  'Pablo Gil','Quinn Vera','Rosa Llop','Sam Tudela','Tomas Faus',
]

const ok   = m => console.log(`  ✓  ${m}`)
const fail = m => console.log(`  ✗  ${m}`)

const uids = []
const base = Date.now()

console.log('\n  Creating 20 accounts (score 3.00) and signing up for Claude Test...\n')

for (let i = 0; i < NAMES.length; i++) {
  const name  = NAMES[i]
  const email = `${TAG}_${String(i+1).padStart(2,'0')}_${base}@paleta.test`

  try {
    // Create auth user
    const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ email, password: 'TestPass123!', email_confirm: true }),
    })
    const user = await res.json()
    if (!user.id) throw new Error(user.message ?? JSON.stringify(user))
    uids.push(user.id)

    // Wait for DB trigger then set name + ELO
    await new Promise(r => setTimeout(r, 150))
    await fetch(`${URL_BASE}/rest/v1/profielen?id=eq.${user.id}`, {
      method: 'PATCH', headers: H,
      body: JSON.stringify({ naam: name, elo_rating: ELO }),
    })

    // Sign up for event
    await fetch(`${URL_BASE}/rest/v1/event_signups`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        event_id:     EVENT_ID,
        player_id:    user.id,
        status:       'confirmed',
        elo_at_signup: ELO,
        signed_up_at: new Date(base + i * 500).toISOString(),
      }),
    })

    ok(`${name.padEnd(14)}  score 3.00  signed up`)
  } catch (e) {
    fail(`${name}: ${e.message}`)
  }
}

// Save IDs for cleanup
writeFileSync('./test_uids.json', JSON.stringify({ tag: TAG, event_id: EVENT_ID, uids }, null, 2))

console.log(`\n  ✓  Done — ${uids.length}/20 accounts created and signed up`)
console.log(`  ✓  IDs saved to test_uids.json for cleanup later\n`)

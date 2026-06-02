// paleta — Full Event Simulation Script
// Uses direct Supabase REST API (no SDK) to avoid Node 20 WebSocket issues

const URL_BASE   = 'https://fbolmgbcvykkkfgxgvwi.supabase.co'
const SVC_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZib2xtZ2Jjdnlra2tmZ3hndndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTcwNTI4MSwiZXhwIjoyMDk1MjgxMjgxfQ.3KRHw0flL65Mxawy0d5pl8rH7smqAaNPKp46zKDjqZ0'
const COURTS     = 4
const TAG        = `sim${Date.now()}`

// ── REST helpers ───────────────────────────────────────────────────────────

const H = { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json' }

async function gql(path) {
  const r = await fetch(`${URL_BASE}${path}`, { headers: H })
  const j = await r.json()
  if (!r.ok) throw new Error(`GET ${path} → ${JSON.stringify(j)}`)
  return j
}

async function post(table, body) {
  const r = await fetch(`${URL_BASE}/rest/v1/${table}`, {
    method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(body)
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`POST ${table} → ${JSON.stringify(j)}`)
  return Array.isArray(j) ? j : [j]
}

async function patch(table, filter, body) {
  const r = await fetch(`${URL_BASE}/rest/v1/${table}?${filter}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body)
  })
  if (!r.ok) { const t = await r.text(); throw new Error(`PATCH ${table}?${filter} → ${t}`) }
}

async function del(table, filter) {
  const r = await fetch(`${URL_BASE}/rest/v1/${table}?${filter}`, {
    method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' }
  })
  if (!r.ok) { const t = await r.text(); throw new Error(`DELETE ${table}?${filter} → ${t}`) }
}

async function select(table, cols, filter = '') {
  return gql(`/rest/v1/${table}?select=${cols}${filter ? '&' + filter : ''}`)
}

async function createAuthUser(email) {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ email, password: 'TestPass123!', email_confirm: true })
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`createUser ${email} → ${JSON.stringify(j)}`)
  return j.id
}

async function deleteAuthUser(id) {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: H })
  if (!r.ok) { const t = await r.text(); return false }
  return true
}

// ── App logic (replicated) ─────────────────────────────────────────────────

function eloToDisplay(elo) {
  return Math.min(7.0, Math.max(0.0, (elo / 2000) * 7.0)).toFixed(2)
}

function displayDelta(before, after) {
  const d = ((after - before) / 2000 * 7)
  return (d >= 0 ? '+' : '') + d.toFixed(2)
}

function generateRoundDraw(players) {
  const courtCount = players.length / 4
  const sorted = [...players].sort((a, b) => b.elo - a.elo)
  const courts = Array.from({ length: courtCount }, () => [])
  sorted.forEach((p, i) => {
    const pos = i % (courtCount * 2)
    courts[pos < courtCount ? pos : courtCount * 2 - 1 - pos].push(p)
  })
  return courts.map((c, idx) => {
    const s = [...c].sort((a, b) => b.elo - a.elo)
    return { court: idx + 1, a1: s[0].id, a2: s[3].id, b1: s[1].id, b2: s[2].id }
  })
}

function calcEloDeltas(teamA, teamB, sa, sb) {
  const total = sa + sb
  if (total === 0) return [...teamA, ...teamB].map(p => ({ id: p.id, delta: 0 }))
  const K = 32
  const avgA = (teamA[0].elo + teamA[1].elo) / 2
  const avgB = (teamB[0].elo + teamB[1].elo) / 2
  const exp  = 1 / (1 + Math.pow(10, (avgB - avgA) / 400))
  const dA   = Math.round(K * (sa / total - exp))
  return [...teamA.map(p => ({ id: p.id, delta: dA })), ...teamB.map(p => ({ id: p.id, delta: -dA }))]
}

function recalcStatuses(signups, courtCount) {
  const sorted = [...signups].sort((a, b) => new Date(a.signed_up_at) - new Date(b.signed_up_at))
  const spots  = Math.min(Math.floor(sorted.length / 4) * 4, courtCount * 4)
  return sorted.map((s, i) => ({ ...s, newStatus: i < spots ? 'confirmed' : 'waitlisted' }))
}

// ── Output ─────────────────────────────────────────────────────────────────

const ok   = m => console.log(`  ✓  ${m}`)
const fail = m => console.log(`  ✗  ${m}`)
const hdr  = m => console.log(`\n${'─'.repeat(64)}\n  ${m}\n${'─'.repeat(64)}`)
const info = m => console.log(`     ${m}`)

// ── Players ────────────────────────────────────────────────────────────────

const NAMES = [
  'Alex Mora','Ben Torres','Carlos Ruiz','Diana Vega','Emma Soler',
  'Finn Ortiz','Grace Leal','Hugo Pons','Isabel Reig','Jack Blanco',
  'Karen Font','Luis Serra','Maria Cano','Nick Roca','Olivia Mas',
  'Pablo Gil','Quinn Vera','Rosa Llop','Sam Tudela','Tomas Faus',
]
// Spread ELOs from ~450 (low Beginner) to ~1620 (solid Advanced), step 62
const PLAYERS = NAMES.map((name, i) => ({
  name, email: `${TAG}_${String(i+1).padStart(2,'0')}@paleta.test`,
  elo: Math.round(450 + i * 62),
}))

const SCORES = [
  [7,3],[6,4],[8,2],[5,5],  // round 1 per court (4 courts)
  [6,4],[9,1],[6,4],[7,3],  // round 2
  [8,2],[6,4],[7,3],[5,5],  // round 3
]

// ── State ──────────────────────────────────────────────────────────────────

const uids = []
let eventId = null

// ── Cleanup ────────────────────────────────────────────────────────────────

async function cleanup() {
  hdr('CLEANUP')
  if (eventId) {
    try { await del('events', `id=eq.${eventId}`); ok('Deleted event + cascade (matches, signups)') }
    catch (e) { fail(`Event delete: ${e.message}`) }
  }
  let n = 0
  for (const id of uids) { if (await deleteAuthUser(id)) n++ }
  ok(`Deleted ${n}/${uids.length} auth users`)
  console.log()
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(64)}`)
  console.log(`  paleta — Event Workflow Simulation`)
  console.log(`  Tag: ${TAG}`)
  console.log(`  Players: ${PLAYERS.length}  |  Courts: ${COURTS}  |  Capacity: ${COURTS*4}`)
  console.log(`${'═'.repeat(64)}`)

  try {
    await phase1_users()
    await phase2_event()
    await phase3_signups()
    await phase4_cancels()
    await phase5_draw()
    await phase6_scores()
    await phase7_finalize()
    await phase8_verify()
  } catch (e) {
    console.log(`\n  FATAL: ${e.message}`)
  } finally {
    await cleanup()
  }
}

// ── Phase 1 ────────────────────────────────────────────────────────────────

async function phase1_users() {
  hdr('PHASE 1 — Create 20 users via admin API')
  let fails = 0

  for (const p of PLAYERS) {
    try {
      const uid = await createAuthUser(p.email)
      uids.push(uid)
      await new Promise(r => setTimeout(r, 150)) // let DB trigger fire
      // Force-set name + ELO (trigger may default to 1000)
      await patch('profielen', `id=eq.${uid}`, { naam: p.name, elo_rating: p.elo })
    } catch (e) {
      fail(`${p.name}: ${e.message}`)
      fails++
    }
  }

  // Verify profielen
  const profiles = await select('profielen', 'id,naam,elo_rating', `id=in.(${uids.join(',')})`)
  const profMap  = Object.fromEntries(profiles.map(p => [p.id, p]))
  let mismatches = 0

  info(`${'Name'.padEnd(16)} ${'Expected'.padStart(9)} ${'Got'.padStart(9)}`)
  info('─'.repeat(38))
  for (let i = 0; i < uids.length; i++) {
    const got      = profMap[uids[i]]
    const expected = PLAYERS[i].elo
    const match    = got?.elo_rating === expected
    if (!match) mismatches++
    info(`${PLAYERS[i].name.padEnd(16)} ${eloToDisplay(expected).padStart(9)} ${eloToDisplay(got?.elo_rating ?? 0).padStart(9)}  ${match ? '✓' : '✗'}`)
  }
  console.log()
  ok(`Created ${uids.length}/${PLAYERS.length} users`)
  mismatches === 0 ? ok('All ELO placements correct') : fail(`${mismatches} ELO mismatches`)
  if (fails) fail(`${fails} creation failures`)
}

// ── Phase 2 ────────────────────────────────────────────────────────────────

async function phase2_event() {
  hdr('PHASE 2 — Create test event')
  const dt = new Date(); dt.setDate(dt.getDate() + 2); dt.setHours(10,0,0,0)
  const rows = await post('events', {
    title: `[SIM] ${TAG}`, datetime: dt.toISOString(),
    location: 'Test Courts, Javea', court_count: COURTS, is_finalized: false,
  })
  eventId = rows[0].id
  ok(`Event created  id=${eventId}`)
  ok(`Capacity: ${COURTS} courts × 4 = ${COURTS*4}`)
}

// ── Phase 3 ────────────────────────────────────────────────────────────────

async function phase3_signups() {
  hdr('PHASE 3 — Sign up all 20 players')
  const base = Date.now()
  let fails = 0

  for (let i = 0; i < uids.length; i++) {
    try {
      await post('event_signups', {
        event_id: eventId, player_id: uids[i], status: 'waitlisted',
        elo_at_signup: PLAYERS[i].elo,
        signed_up_at: new Date(base + i * 500).toISOString(),
      })
    } catch (e) { fail(`${PLAYERS[i].name}: ${e.message}`); fails++ }
  }

  const signups  = await select('event_signups', '*', `event_id=eq.${eventId}`)
  const recalced = recalcStatuses(signups, COURTS)
  for (const s of recalced)
    await patch('event_signups', `id=eq.${s.id}`, { status: s.newStatus })

  const c = recalced.filter(s => s.newStatus === 'confirmed').length
  const w = recalced.filter(s => s.newStatus === 'waitlisted').length
  ok(`${c} confirmed, ${w} waitlisted`)
  c === COURTS*4 ? ok(`Confirmed = ${COURTS}×4 ✓`) : fail(`Expected ${COURTS*4} confirmed, got ${c}`)
  if (fails) fail(`${fails} signup failures`)
}

// ── Phase 4 ────────────────────────────────────────────────────────────────

async function phase4_cancels() {
  hdr('PHASE 4 — Cancellation & re-add')

  const before   = await select('event_signups', '*', `event_id=eq.${eventId}&order=signed_up_at.asc`)
  const confirmed = before.filter(s => s.status === 'confirmed')
  const waitlist  = before.filter(s => s.status === 'waitlisted')
  info(`Start: ${confirmed.length} confirmed, ${waitlist.length} waitlisted`)

  // 4a — 8th confirmed player self-cancels
  const target1 = confirmed[7]
  const name1   = PLAYERS[uids.indexOf(target1.player_id)]?.name ?? '?'
  await del('event_signups', `id=eq.${target1.id}`)
  const a1 = await select('event_signups', '*', `event_id=eq.${eventId}`)
  const r1 = recalcStatuses(a1, COURTS)
  for (const s of r1) await patch('event_signups', `id=eq.${s.id}`, { status: s.newStatus })
  ok(`${name1} cancelled  →  ${r1.filter(s=>s.newStatus==='confirmed').length} confirmed, ${r1.filter(s=>s.newStatus==='waitlisted').length} waitlisted`)

  // 4b — Admin removes 3rd confirmed player
  const a1b = await select('event_signups', '*', `event_id=eq.${eventId}`)
  const cur  = recalcStatuses(a1b, COURTS)
  const target2 = cur.filter(s => s.newStatus === 'confirmed')[2]
  const name2   = PLAYERS[uids.indexOf(target2.player_id)]?.name ?? '?'
  await del('event_signups', `id=eq.${target2.id}`)
  const a2 = await select('event_signups', '*', `event_id=eq.${eventId}`)
  const r2 = recalcStatuses(a2, COURTS)
  for (const s of r2) await patch('event_signups', `id=eq.${s.id}`, { status: s.newStatus })
  ok(`Admin removed ${name2}  →  ${r2.filter(s=>s.newStatus==='confirmed').length} confirmed, ${r2.filter(s=>s.newStatus==='waitlisted').length} waitlisted`)

  // 4c — Admin re-adds the self-cancelled player (back of queue)
  await post('event_signups', {
    event_id: eventId, player_id: target1.player_id, status: 'waitlisted',
    elo_at_signup: PLAYERS[uids.indexOf(target1.player_id)]?.elo ?? 1000,
    signed_up_at: new Date(Date.now() + 999999).toISOString(),
  })
  const a3 = await select('event_signups', '*', `event_id=eq.${eventId}`)
  const r3 = recalcStatuses(a3, COURTS)
  for (const s of r3) await patch('event_signups', `id=eq.${s.id}`, { status: s.newStatus })
  const c3 = r3.filter(s=>s.newStatus==='confirmed').length
  const w3 = r3.filter(s=>s.newStatus==='waitlisted').length
  ok(`Re-added ${name1} (back of queue)  →  ${c3} confirmed, ${w3} waitlisted`)
  c3 === COURTS*4 ? ok(`Confirmed still ${COURTS*4} ✓`) : fail(`Confirmed ${c3}, expected ${COURTS*4}`)
}

// ── Phase 5 ────────────────────────────────────────────────────────────────

async function phase5_draw() {
  hdr('PHASE 5 — Generate draw (3 rounds)')

  const signups  = await select('event_signups', 'player_id,elo_at_signup', `event_id=eq.${eventId}&status=eq.confirmed`)
  const profiles = await select('profielen', 'id,naam,elo_rating', `id=in.(${signups.map(s=>s.player_id).join(',')})`)
  const profMap  = Object.fromEntries(profiles.map(p => [p.id, p]))

  const players = signups.map(s => ({ id: s.player_id, elo: profMap[s.player_id]?.elo_rating ?? s.elo_at_signup }))
  if (players.length !== COURTS*4) throw new Error(`Expected ${COURTS*4} confirmed, got ${players.length}`)

  const draw       = generateRoundDraw(players)
  const courtNums  = Array.from({ length: COURTS }, (_, i) => i + 1)
  const active     = players.length / 4

  // Round 1 — snake draw
  const r1rows = draw.map(m => ({
    event_id: eventId,
    court_number: courtNums[active - m.court],
    round_number: 1,
    player_a1: m.a1, player_a2: m.a2, player_b1: m.b1, player_b2: m.b2,
  }))
  await post('event_matches', r1rows)
  ok(`Round 1: ${r1rows.length} matches generated`)
  info(`${'Court'.padEnd(7)} ${'Team A'.padEnd(26)} ${'vs'.padEnd(4)} Team B`)
  info('─'.repeat(56))
  for (const m of r1rows) {
    const n = id => profMap[id]?.naam.split(' ')[0] ?? '?'
    info(`Court ${m.court_number}  ${(n(m.player_a1)+' & '+n(m.player_a2)).padEnd(26)} vs   ${n(m.player_b1)} & ${n(m.player_b2)}`)
  }

  // Rounds 2 & 3 — rotate partners
  for (const rn of [2, 3]) {
    const rows = draw.map(m => ({
      event_id: eventId,
      court_number: courtNums[active - m.court],
      round_number: rn,
      player_a1: m.a1, player_a2: m.b1,
      player_b1: m.a2, player_b2: m.b2,
    }))
    await post('event_matches', rows)
    ok(`Round ${rn}: ${rows.length} matches (partner rotation)`)
  }
}

// ── Phase 6 ────────────────────────────────────────────────────────────────

async function phase6_scores() {
  hdr('PHASE 6 — Enter scores')

  const matches = await select('event_matches', 'id,round_number,court_number',
    `event_id=eq.${eventId}&order=round_number.asc,court_number.asc`)

  for (let i = 0; i < matches.length; i++) {
    const [sa, sb] = SCORES[i % SCORES.length]
    await patch('event_matches', `id=eq.${matches[i].id}`, { team_a_score: sa, team_b_score: sb })
  }
  ok(`Scores entered for all ${matches.length} matches`)

  info(`R  Ct  Score`)
  info('─'.repeat(18))
  const scored = await select('event_matches', 'round_number,court_number,team_a_score,team_b_score',
    `event_id=eq.${eventId}&order=round_number.asc,court_number.asc`)
  for (const m of scored)
    info(`${m.round_number}  ${m.court_number}   ${m.team_a_score} – ${m.team_b_score}`)
}

// ── Phase 7 ────────────────────────────────────────────────────────────────

async function phase7_finalize() {
  hdr('PHASE 7 — Finalize & apply ELO')

  const matches = await select('event_matches', '*',
    `event_id=eq.${eventId}&team_a_score=not.is.null&team_b_score=not.is.null`)

  const playerIds = [...new Set(matches.flatMap(m =>
    [m.player_a1, m.player_a2, m.player_b1, m.player_b2].filter(Boolean)))]

  const players = await select('profielen',
    'id,naam,elo_rating,wedstrijden_gespeeld,gewonnen,verloren',
    `id=in.(${playerIds.join(',')})`)

  const eloMap    = {}, eloBefore = {}, statsMap = {}
  players.forEach(p => {
    eloMap[p.id] = eloBefore[p.id] = p.elo_rating
    statsMap[p.id] = { games: 0, wins: 0, losses: 0 }
  })

  for (const m of matches) {
    const { player_a1: a1, player_a2: a2, player_b1: b1, player_b2: b2 } = m
    if (!a1||!a2||!b1||!b2) continue
    const teamA = [{ id: a1, elo: eloMap[a1] }, { id: a2, elo: eloMap[a2] }]
    const teamB = [{ id: b1, elo: eloMap[b1] }, { id: b2, elo: eloMap[b2] }]
    calcEloDeltas(teamA, teamB, m.team_a_score, m.team_b_score)
      .forEach(({ id, delta }) => { eloMap[id] = (eloMap[id] ?? 1000) + delta })
    const aWon = m.team_a_score > m.team_b_score
    ;[a1,a2].forEach(id => { statsMap[id].games++; if (aWon) statsMap[id].wins++; else if (m.team_b_score>m.team_a_score) statsMap[id].losses++ })
    ;[b1,b2].forEach(id => { statsMap[id].games++; if (!aWon&&m.team_b_score>m.team_a_score) statsMap[id].wins++; else if (aWon) statsMap[id].losses++ })
  }

  let ok_n = 0, fail_n = 0
  for (const p of players) {
    const newElo = Math.max(100, Math.round(eloMap[p.id] ?? p.elo_rating))
    const st     = statsMap[p.id] ?? { games:0, wins:0, losses:0 }
    try {
      await patch('profielen', `id=eq.${p.id}`, {
        elo_rating: newElo, wedstrijden_gespeeld: p.wedstrijden_gespeeld + st.games,
        gewonnen: p.gewonnen + st.wins, verloren: p.verloren + st.losses,
      })
      await patch('event_signups',
        `event_id=eq.${eventId}&player_id=eq.${p.id}`,
        { elo_after: newElo })
      ok_n++
    } catch (e) { fail(`Update ${p.naam}: ${e.message}`); fail_n++ }
  }

  await patch('events', `id=eq.${eventId}`, { is_finalized: true })
  ok(`ELO applied: ${ok_n} ok, ${fail_n} failed`)
  ok('Event marked finalized')

  const results = players
    .map(p => ({ ...p, after: Math.max(100, Math.round(eloMap[p.id]??p.elo_rating)), stats: statsMap[p.id] }))
    .sort((a, b) => (b.after-eloBefore[b.id]) - (a.after-eloBefore[a.id]))

  info(`\n  ${'Player'.padEnd(15)} ${'Before'.padStart(7)} ${'After'.padStart(7)} ${'Impact'.padStart(8)} ${'W/L'.padStart(5)}`)
  info('  '+'─'.repeat(46))
  for (const r of results) {
    const s = r.stats
    info(`  ${r.naam.split(' ')[0].padEnd(15)}` +
      `${eloToDisplay(eloBefore[r.id]).padStart(7)}` +
      `${eloToDisplay(r.after).padStart(7)}` +
      `${displayDelta(eloBefore[r.id], r.after).padStart(8)}` +
      `${(s.wins+'W/'+s.losses+'L').padStart(5)}`)
  }
}

// ── Phase 8 ────────────────────────────────────────────────────────────────

async function phase8_verify() {
  hdr('PHASE 8 — Verification')

  // finalized flag
  const [ev] = await select('events', 'is_finalized', `id=eq.${eventId}`)
  ev?.is_finalized ? ok('Event is_finalized = true') : fail('Event NOT finalized')

  // all matches scored
  const matches = await select('event_matches', 'id,team_a_score', `event_id=eq.${eventId}`)
  const unscored = matches.filter(m => m.team_a_score === null).length
  unscored === 0 ? ok(`All ${matches.length} matches scored`) : fail(`${unscored} unscored matches`)

  // elo_after populated (requires migration)
  const signups = await select('event_signups', 'elo_at_signup,elo_after',
    `event_id=eq.${eventId}&status=eq.confirmed`)
  const withAfter = signups.filter(s => s.elo_after !== null).length
  withAfter === signups.length
    ? ok(`elo_after populated for all ${signups.length} confirmed players`)
    : fail(`elo_after missing for ${signups.length - withAfter}/${signups.length} — run: ALTER TABLE event_signups ADD COLUMN IF NOT EXISTS elo_after numeric`)

  // stats updated
  const pids     = await select('event_signups', 'player_id', `event_id=eq.${eventId}&status=eq.confirmed`)
  const profiles = await select('profielen', 'naam,wedstrijden_gespeeld,elo_rating',
    `id=in.(${pids.map(p=>p.player_id).join(',')})`)
  const withGames = profiles.filter(p => p.wedstrijden_gespeeld > 0).length
  ok(`${withGames}/${profiles.length} players have updated match counts`)

  // no one hit the ELO floor
  const floored = profiles.filter(p => p.elo_rating <= 100).length
  floored === 0 ? ok('No players hit the ELO floor') : fail(`${floored} players hit ELO floor (100)`)

  // signup counts
  const all    = await select('event_signups', 'status', `event_id=eq.${eventId}`)
  const counts = all.reduce((a, s) => ({ ...a, [s.status]: (a[s.status]??0)+1 }), {})
  ok(`Final breakdown: ${counts.confirmed??0} confirmed, ${counts.waitlisted??0} waitlisted`)
}

main()

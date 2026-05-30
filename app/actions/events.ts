'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateRoundDraw, calculateEloDeltas } from '@/lib/americano'
import { sendWaitlistPromotionEmail } from '@/lib/email'

const ROUNDS_PER_EVENT = 3
const SIGNUP_CUTOFF_MS = 2 * 60 * 60 * 1000 // 2 hours

// ── Delete event (admin only) ─────────────────────────────────────────────
export async function deleteEvent(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const service = await createServiceClient()
  const { error } = await service.from('events').delete().eq('id', eventId)
  if (error) return { fout: error.message }

  revalidatePath('/events')
  revalidatePath('/admin')
  return {}
}

// ── Create event (admin only) ──────────────────────────────────────────────
export async function createEvent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const title      = (formData.get('title')      as string).trim()
  const datetime   = formData.get('datetime')    as string
  const location   = (formData.get('location')   as string).trim()
  const organizer  = (formData.get('organizer')  as string | null)?.trim() || null
  const courtCount = parseInt(formData.get('court_count') as string, 10)

  if (!title || !datetime || !location || isNaN(courtCount) || courtCount < 1) {
    return { fout: 'All fields are required' }
  }

  const service = await createServiceClient()
  const { data, error } = await service.from('events').insert({
    title, datetime, location, organizer, court_count: courtCount, created_by: user.id,
  }).select('id').single()

  if (error) return { fout: error.message }

  revalidatePath('/events')
  return { id: data.id }
}

// ── Sign up for event ──────────────────────────────────────────────────────
export async function signUpForEvent(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const service = await createServiceClient()

  const { data: event } = await service
    .from('events').select('court_count, is_finalized, datetime, title, location').eq('id', eventId).single()
  if (!event) return { fout: 'Event not found' }
  if (event.is_finalized) return { fout: 'Event is already finalized' }

  if (Date.now() >= new Date(event.datetime).getTime() - SIGNUP_CUTOFF_MS) {
    return { fout: 'Sign-up is closed 2 hours before the event' }
  }

  const { data: profiel } = await service.from('profielen').select('elo_rating').eq('id', user.id).single()

  // Snapshot current waitlisted player IDs before inserting the new signup
  const { data: existing } = await service
    .from('event_signups').select('player_id, status')
    .eq('event_id', eventId)
  const previouslyWaitlisted = new Set(
    (existing ?? []).filter(s => s.status === 'waitlisted').map(s => s.player_id)
  )

  const { error } = await service.from('event_signups').insert({
    event_id: eventId,
    player_id: user.id,
    status: 'waitlisted',
    elo_at_signup: profiel?.elo_rating ?? 1000,
  })

  if (error) {
    if (error.code === '23505') return { fout: 'Already signed up' }
    return { fout: error.message }
  }

  // Recalculate all statuses in signup order
  const { data: allSignups } = await service
    .from('event_signups').select('id, player_id')
    .eq('event_id', eventId)
    .order('signed_up_at', { ascending: true })

  let finalStatus: 'confirmed' | 'waitlisted' = 'waitlisted'
  const newlyConfirmed: string[] = [] // player_ids promoted from waitlist

  if (allSignups && allSignups.length > 0) {
    const confirmedSpots = Math.min(
      Math.floor(allSignups.length / 4) * 4,
      event.court_count * 4,
    )
    for (let i = 0; i < allSignups.length; i++) {
      const s = i < confirmedSpots ? 'confirmed' : 'waitlisted'
      await service.from('event_signups').update({ status: s }).eq('id', allSignups[i].id)
      if (allSignups[i].player_id === user.id) finalStatus = s
      // Only notify others who were already on the waitlist (not the person just signing up)
      if (s === 'confirmed' && previouslyWaitlisted.has(allSignups[i].player_id)) {
        newlyConfirmed.push(allSignups[i].player_id)
      }
    }
  }

  // Send promotion emails to players moved from waitlist → confirmed
  if (newlyConfirmed.length > 0) {
    const { data: players } = await service
      .from('profielen').select('id, naam, email, email_notifications')
      .in('id', newlyConfirmed)
    await Promise.all(
      (players ?? [])
        .filter(p => p.email_notifications !== false)
        .map(p => sendWaitlistPromotionEmail({
          to: p.email, name: p.naam,
          eventTitle: event.title, eventDatetime: event.datetime, eventLocation: event.location,
        }))
    )
  }

  revalidatePath(`/events/${eventId}`)
  return { status: finalStatus }
}

// ── Cancel event signup ────────────────────────────────────────────────────
export async function cancelEventSignup(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const service = await createServiceClient()

  // Find the signup to determine its status before deleting
  const { data: signup } = await service
    .from('event_signups').select('id, status').eq('event_id', eventId).eq('player_id', user.id).single()
  if (!signup) return { fout: 'Signup not found' }

  // Snapshot current waitlisted players before deletion
  const { data: before } = await service
    .from('event_signups').select('player_id, status').eq('event_id', eventId)
  const previouslyWaitlisted = new Set(
    (before ?? []).filter(s => s.status === 'waitlisted').map(s => s.player_id)
  )

  await service.from('event_signups').delete().eq('id', signup.id)

  // Recalculate all statuses: confirmed = floor(remaining/4)*4 players in signup order
  const { data: event } = await service
    .from('events').select('court_count, title, datetime, location').eq('id', eventId).single()

  const { data: remaining } = await service
    .from('event_signups').select('id, player_id')
    .eq('event_id', eventId)
    .order('signed_up_at', { ascending: true })

  const newlyConfirmed: string[] = []

  if (remaining && remaining.length > 0 && event) {
    const confirmedSpots = Math.min(
      Math.floor(remaining.length / 4) * 4,
      event.court_count * 4,
    )
    for (let i = 0; i < remaining.length; i++) {
      const s = i < confirmedSpots ? 'confirmed' : 'waitlisted'
      await service.from('event_signups')
        .update({ status: s })
        .eq('id', remaining[i].id)
      if (s === 'confirmed' && previouslyWaitlisted.has(remaining[i].player_id)) {
        newlyConfirmed.push(remaining[i].player_id)
      }
    }
  }

  // Send promotion emails to players moved from waitlist → confirmed
  if (newlyConfirmed.length > 0 && event) {
    const { data: players } = await service
      .from('profielen').select('id, naam, email, email_notifications')
      .in('id', newlyConfirmed)
    await Promise.all(
      (players ?? [])
        .filter(p => p.email_notifications !== false)
        .map(p => sendWaitlistPromotionEmail({
          to: p.email, name: p.naam,
          eventTitle: event.title, eventDatetime: event.datetime, eventLocation: event.location,
        }))
    )
  }

  revalidatePath(`/events/${eventId}`)
  return {}
}

// ── Generate draw for a round (admin only) ────────────────────────────────
export async function generateEventDraw(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const eventId     = formData.get('event_id')     as string
  const roundNumber = parseInt(formData.get('round_number') as string, 10)

  const service = await createServiceClient()

  const { data: event } = await service.from('events').select('court_count, is_finalized').eq('id', eventId).single()
  if (!event) return { fout: 'Event not found' }
  if (event.is_finalized) return { fout: 'Event is finalized' }

  // Get confirmed players
  const { data: signups } = await service
    .from('event_signups')
    .select('player_id, elo_at_signup, profielen(id, elo_rating)')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')

  if (!signups || signups.length === 0) return { fout: 'No confirmed players' }
  if (signups.length % 4 !== 0) {
    return { fout: `Confirmed players must be a multiple of 4, have ${signups.length}` }
  }

  // Calculate event points for each player from previous rounds (for seeding round 2+)
  const { data: prevMatches } = await service
    .from('event_matches')
    .select('player_a1,player_a2,player_b1,player_b2,team_a_score,team_b_score')
    .eq('event_id', eventId)
    .lt('round_number', roundNumber)
    .not('team_a_score', 'is', null)

  const eventPoints: Record<string, number> = {}
  signups.forEach(s => { eventPoints[s.player_id] = 0 })
  ;(prevMatches ?? []).forEach(m => {
    const sa = m.team_a_score ?? 0
    const sb = m.team_b_score ?? 0
    ;[m.player_a1, m.player_a2].forEach(id => { if (id) eventPoints[id] = (eventPoints[id] ?? 0) + sa })
    ;[m.player_b1, m.player_b2].forEach(id => { if (id) eventPoints[id] = (eventPoints[id] ?? 0) + sb })
  })

  const activeCourts = signups.length / 4

  // Build player list sorted by event points (desc), ELO as tiebreak
  const players = signups.map(s => {
    const p = (s.profielen as unknown as { id: string; elo_rating: number } | null)
    return {
      id: s.player_id,
      elo_rating: p?.elo_rating ?? s.elo_at_signup,
      eventPoints: eventPoints[s.player_id] ?? 0,
    }
  }).sort((a, b) =>
    a.eventPoints !== b.eventPoints
      ? b.eventPoints - a.eventPoints
      : b.elo_rating - a.elo_rating,
  )

  let matches
  try {
    matches = generateRoundDraw(players, roundNumber)
  } catch (e) {
    return { fout: (e as Error).message }
  }

  // Delete existing matches for this round (allow regeneration)
  await service.from('event_matches').delete().eq('event_id', eventId).eq('round_number', roundNumber)

  const { error } = await service.from('event_matches').insert(
    matches.map(m => ({
      event_id:     eventId,
      court_number: m.courtNumber,
      round_number: m.roundNumber,
      player_a1:    m.playerA1,
      player_a2:    m.playerA2,
      player_b1:    m.playerB1,
      player_b2:    m.playerB2,
    })),
  )

  if (error) return { fout: error.message }

  // Create empty shells for rounds 2…ROUNDS_PER_EVENT (only if they don't exist yet)
  for (let r = 2; r <= ROUNDS_PER_EVENT; r++) {
    const { count } = await service
      .from('event_matches')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('round_number', r)

    if ((count ?? 0) === 0) {
      await service.from('event_matches').insert(
        Array.from({ length: activeCourts }, (_, i) => ({
          event_id:     eventId,
          court_number: i + 1,
          round_number: r,
        })),
      )
    }
  }

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/events/${eventId}/admin`)
  return {}
}

// ── Assign players to a match (admin only) ───────────────────────────────
export async function assignMatchPlayers(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const matchId = formData.get('match_id') as string
  const a1 = (formData.get('player_a1') as string) || null
  const a2 = (formData.get('player_a2') as string) || null
  const b1 = (formData.get('player_b1') as string) || null
  const b2 = (formData.get('player_b2') as string) || null

  const service = await createServiceClient()
  const { data: match } = await service.from('event_matches').select('event_id').eq('id', matchId).single()
  if (!match) return { fout: 'Match not found' }

  const { error } = await service.from('event_matches').update({
    player_a1: a1, player_a2: a2, player_b1: b1, player_b2: b2,
  }).eq('id', matchId)

  if (error) return { fout: error.message }

  revalidatePath(`/events/${match.event_id}`)
  revalidatePath(`/events/${match.event_id}/admin`)
  return {}
}

// ── Save score for a single match (admin only) ────────────────────────────
export async function saveEventScore(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const matchId    = formData.get('match_id')    as string
  const teamAScore = parseInt(formData.get('team_a_score') as string, 10)
  const teamBScore = parseInt(formData.get('team_b_score') as string, 10)

  if (isNaN(teamAScore) || isNaN(teamBScore) || teamAScore < 0 || teamBScore < 0) {
    return { fout: 'Invalid scores' }
  }

  const service = await createServiceClient()
  const { data: match } = await service
    .from('event_matches').select('event_id').eq('id', matchId).single()
  if (!match) return { fout: 'Match not found' }

  const { error } = await service.from('event_matches').update({
    team_a_score: teamAScore,
    team_b_score: teamBScore,
  }).eq('id', matchId)

  if (error) return { fout: error.message }

  revalidatePath(`/events/${match.event_id}`)
  revalidatePath(`/events/${match.event_id}/admin`)
  return {}
}

// ── Finalize event — calculate and apply ELO (admin only) ─────────────────
export async function finalizeEvent(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const service = await createServiceClient()

  const { data: event } = await service.from('events').select('is_finalized').eq('id', eventId).single()
  if (!event) return { fout: 'Event not found' }
  if (event.is_finalized) return { fout: 'Already finalized' }

  // Get all scored matches ordered by round then court
  const { data: matches } = await service
    .from('event_matches')
    .select('*')
    .eq('event_id', eventId)
    .not('team_a_score', 'is', null)
    .not('team_b_score', 'is', null)
    .order('round_number', { ascending: true })
    .order('court_number', { ascending: true })

  if (!matches || matches.length === 0) return { fout: 'No scored matches to finalize' }

  // Collect all player IDs
  const playerIds = new Set<string>()
  matches.forEach(m => {
    ;[m.player_a1, m.player_a2, m.player_b1, m.player_b2]
      .filter(Boolean).forEach(id => playerIds.add(id as string))
  })

  const { data: players } = await service
    .from('profielen')
    .select('id, elo_rating, wedstrijden_gespeeld, gewonnen, verloren')
    .in('id', Array.from(playerIds))

  if (!players) return { fout: 'Could not load player data' }

  // Running ELO map
  const eloMap: Record<string, number> = {}
  const statsMap: Record<string, { games: number; wins: number; losses: number }> = {}
  players.forEach(p => {
    eloMap[p.id] = p.elo_rating
    statsMap[p.id] = { games: 0, wins: 0, losses: 0 }
  })

  for (const m of matches) {
    const a1 = m.player_a1, a2 = m.player_a2, b1 = m.player_b1, b2 = m.player_b2
    if (!a1 || !a2 || !b1 || !b2) continue

    const teamA = [{ id: a1, elo_rating: eloMap[a1] }, { id: a2, elo_rating: eloMap[a2] }]
    const teamB = [{ id: b1, elo_rating: eloMap[b1] }, { id: b2, elo_rating: eloMap[b2] }]
    const sa = m.team_a_score as number
    const sb = m.team_b_score as number

    const deltas = calculateEloDeltas(teamA, teamB, sa, sb)
    deltas.forEach(({ id, delta }) => { eloMap[id] = (eloMap[id] ?? 1000) + delta })

    const aWon = sa > sb
    ;[a1, a2].forEach(id => {
      if (!statsMap[id]) statsMap[id] = { games: 0, wins: 0, losses: 0 }
      statsMap[id].games++
      if (aWon) statsMap[id].wins++; else if (sb > sa) statsMap[id].losses++
    })
    ;[b1, b2].forEach(id => {
      if (!statsMap[id]) statsMap[id] = { games: 0, wins: 0, losses: 0 }
      statsMap[id].games++
      if (!aWon && sb > sa) statsMap[id].wins++; else if (aWon) statsMap[id].losses++
    })
  }

  // Apply all ELO and stat changes
  const updateErrors: string[] = []
  for (const p of players) {
    const stats = statsMap[p.id] ?? { games: 0, wins: 0, losses: 0 }
    const newElo = Number.isFinite(eloMap[p.id])
      ? Math.max(100, Math.round(eloMap[p.id]))
      : p.elo_rating
    const { error } = await service.from('profielen').update({
      elo_rating:           newElo,
      wedstrijden_gespeeld: p.wedstrijden_gespeeld + stats.games,
      gewonnen:             p.gewonnen + stats.wins,
      verloren:             p.verloren + stats.losses,
    }).eq('id', p.id)
    if (error) updateErrors.push(error.message)
  }
  if (updateErrors.length > 0) return { fout: `ELO update failed: ${updateErrors.join('; ')}` }

  // Mark event finalized
  await service.from('events').update({ is_finalized: true }).eq('id', eventId)

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/events/${eventId}/admin`)
  revalidatePath('/events')
  revalidatePath('/spelers')
  revalidatePath('/dashboard')
  return {}
}

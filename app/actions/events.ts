'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateRoundDraw, calculateEloDeltas } from '@/lib/americano'
import { sendWaitlistPromotionEmail, sendDemotedToWaitlistEmail, sendLateCancellationEmail, sendDrawNotificationEmail } from '@/lib/email'

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

  const locationId      = (formData.get('location_id')   as string | null)?.trim() || null
  if (!locationId) return { fout: 'A saved venue must be selected' }

  if (!title || !datetime || !location || isNaN(courtCount) || courtCount < 1) {
    return { fout: 'All fields are required' }
  }

  const endTime         = (formData.get('end_time')      as string | null)?.trim() || null
  const courtNumbersRaw = (formData.get('court_numbers') as string | null)?.trim() || ''
  const courtNumbers    = courtNumbersRaw
    ? courtNumbersRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
    : null
  const matchType       = (formData.get('match_type')    as string | null) || null
  const minLevelRaw     = (formData.get('min_level')     as string | null)?.trim()
  const maxLevelRaw     = (formData.get('max_level')     as string | null)?.trim()
  const minLevel        = minLevelRaw ? parseFloat(minLevelRaw) : null
  const maxLevel        = maxLevelRaw ? parseFloat(maxLevelRaw) : null

  const service = await createServiceClient()
  const { data, error } = await service.from('events').insert({
    title, datetime, location, organizer, court_count: courtCount, created_by: user.id,
    end_time:      endTime,
    court_numbers: courtNumbers?.length ? courtNumbers : null,
    match_type:    matchType,
    min_level:     minLevel,
    max_level:     maxLevel,
    location_id:   locationId,
  }).select('id').single()

  if (error) return { fout: error.message }

  revalidatePath('/events')
  return { id: data.id }
}

// ── Update event (admin only) ─────────────────────────────────────────────
export async function updateEvent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const eventId    = formData.get('event_id')    as string
  const title      = (formData.get('title')      as string).trim()
  const datetime   = formData.get('datetime')    as string
  const location   = (formData.get('location')   as string).trim()
  const organizer  = (formData.get('organizer')  as string | null)?.trim() || null
  const courtCount = parseInt(formData.get('court_count') as string, 10)

  if (!title || !datetime || !location || isNaN(courtCount) || courtCount < 1) {
    return { fout: 'All required fields must be filled' }
  }

  const endTime         = (formData.get('end_time')      as string | null)?.trim() || null
  const courtNumbersRaw = (formData.get('court_numbers') as string | null)?.trim() || ''
  const courtNumbers    = courtNumbersRaw
    ? courtNumbersRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
    : null
  const matchType       = (formData.get('match_type')    as string | null) || null
  const minLevelRaw     = (formData.get('min_level')     as string | null)?.trim()
  const maxLevelRaw     = (formData.get('max_level')     as string | null)?.trim()
  const minLevel        = minLevelRaw ? parseFloat(minLevelRaw) : null
  const maxLevel        = maxLevelRaw ? parseFloat(maxLevelRaw) : null
  const locationId      = (formData.get('location_id')   as string | null)?.trim() || null

  const service = await createServiceClient()

  const { data: current } = await service.from('events').select('court_count').eq('id', eventId).single()
  if (!current) return { fout: 'Event not found' }
  const courtCountChanged = current.court_count !== courtCount

  const { error } = await service.from('events').update({
    title, datetime, location, organizer,
    court_count:   courtCount,
    end_time:      endTime,
    court_numbers: courtNumbers?.length ? courtNumbers : null,
    match_type:    matchType,
    min_level:     minLevel,
    max_level:     maxLevel,
    location_id:   locationId,
  }).eq('id', eventId)

  if (error) return { fout: error.message }

  // Recalculate signup statuses when court_count changes
  if (courtCountChanged) {
    const { data: allSignups } = await service
      .from('event_signups').select('id, player_id, status')
      .eq('event_id', eventId)
      .order('signed_up_at', { ascending: true })

    if (allSignups && allSignups.length > 0) {
      const previouslyWaitlisted = new Set(allSignups.filter(s => s.status === 'waitlisted').map(s => s.player_id))
      const previouslyConfirmed  = new Set(allSignups.filter(s => s.status === 'confirmed').map(s => s.player_id))
      const confirmedSpots = Math.min(Math.floor(allSignups.length / 4) * 4, courtCount * 4)
      const newlyConfirmed: string[] = []
      const newlyDemoted:   string[] = []

      for (let i = 0; i < allSignups.length; i++) {
        const s = i < confirmedSpots ? 'confirmed' : 'waitlisted'
        await service.from('event_signups').update({ status: s }).eq('id', allSignups[i].id)
        if (s === 'confirmed' && previouslyWaitlisted.has(allSignups[i].player_id)) newlyConfirmed.push(allSignups[i].player_id)
        if (s === 'waitlisted' && previouslyConfirmed.has(allSignups[i].player_id))  newlyDemoted.push(allSignups[i].player_id)
      }

      const { data: evData } = await service
        .from('events').select('title, datetime, location').eq('id', eventId).single()

      if (evData) {
        if (newlyConfirmed.length > 0) {
          const { data: players } = await service
            .from('profielen').select('id, naam, email, email_notifications').in('id', newlyConfirmed)
          await Promise.all(
            (players ?? []).filter(p => p.email_notifications !== false).map(p =>
              sendWaitlistPromotionEmail({
                to: p.email, name: p.naam,
                eventTitle: evData.title, eventDatetime: evData.datetime, eventLocation: evData.location,
              })
            )
          )
        }
        if (newlyDemoted.length > 0) {
          const { data: players } = await service
            .from('profielen').select('id, naam, email, email_notifications').in('id', newlyDemoted)
          await Promise.all(
            (players ?? []).filter(p => p.email_notifications !== false).map(p =>
              sendDemotedToWaitlistEmail({
                to: p.email, name: p.naam,
                eventTitle: evData.title, eventDatetime: evData.datetime, eventLocation: evData.location,
              })
            )
          )
        }
      }
    }
  }

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/events/${eventId}/admin`)
  revalidatePath('/events')
  revalidatePath('/admin')
  return {}
}

// ── Sign up for event ──────────────────────────────────────────────────────
export async function signUpForEvent(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const service = await createServiceClient()

  const { data: event } = await service
    .from('events')
    .select('court_count, is_finalized, datetime, title, location, locations(booking_deadline_hours)')
    .eq('id', eventId).single()
  if (!event) return { fout: 'Event not found' }
  if (event.is_finalized) return { fout: 'Event is already finalized' }

  const locationData = event.locations as unknown as { booking_deadline_hours: number | null } | null
  const cutoffMs = (locationData?.booking_deadline_hours ?? 2) * 60 * 60 * 1000
  if (Date.now() >= new Date(event.datetime).getTime() - cutoffMs) {
    const hours = locationData?.booking_deadline_hours ?? 2
    return { fout: `Sign-up is closed — this venue requires booking ${hours} hour${hours !== 1 ? 's' : ''} in advance` }
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

  // Snapshot statuses before deletion so we can detect status changes
  const { data: before } = await service
    .from('event_signups').select('player_id, status').eq('event_id', eventId)
  const previouslyWaitlisted = new Set(
    (before ?? []).filter(s => s.status === 'waitlisted').map(s => s.player_id)
  )
  const previouslyConfirmed = new Set(
    (before ?? []).filter(s => s.status === 'confirmed').map(s => s.player_id)
  )

  await service.from('event_signups').delete().eq('id', signup.id)

  // Recalculate all statuses: confirmed = floor(remaining/4)*4 players in signup order
  const { data: event } = await service
    .from('events').select('court_count, title, datetime, location, created_by, locations(booking_deadline_hours)').eq('id', eventId).single()

  const { data: remaining } = await service
    .from('event_signups').select('id, player_id')
    .eq('event_id', eventId)
    .order('signed_up_at', { ascending: true })

  const newlyConfirmed: string[] = []
  const newlyDemoted: string[] = []

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
      if (s === 'waitlisted' && previouslyConfirmed.has(remaining[i].player_id)) {
        newlyDemoted.push(remaining[i].player_id)
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

  // Send demotion emails to players moved from confirmed → waitlisted
  if (newlyDemoted.length > 0 && event) {
    const { data: players } = await service
      .from('profielen').select('id, naam, email, email_notifications')
      .in('id', newlyDemoted)
    await Promise.all(
      (players ?? [])
        .filter(p => p.email_notifications !== false)
        .map(p => sendDemotedToWaitlistEmail({
          to: p.email, name: p.naam,
          eventTitle: event.title, eventDatetime: event.datetime, eventLocation: event.location,
        }))
    )
  }

  // If sign-up was already closed, notify all admins of the late cancellation
  const locationData = event ? (event.locations as unknown as { booking_deadline_hours: number | null } | null) : null
  const cutoffMs = (locationData?.booking_deadline_hours ?? 2) * 60 * 60 * 1000
  const isLate = event && Date.now() >= new Date(event.datetime).getTime() - cutoffMs
  if (isLate && event) {
    const { data: canceller } = await service.from('profielen').select('naam').eq('id', user.id).single()
    const { data: admins } = await service.from('profielen').select('naam, email').eq('is_admin', true)
    await Promise.all(
      (admins ?? []).map(a =>
        sendLateCancellationEmail({
          to: a.email, adminName: a.naam,
          cancellerName: canceller?.naam ?? 'A player',
          eventTitle: event.title, eventDatetime: event.datetime, eventLocation: event.location,
        })
      )
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

  const { data: event } = await service.from('events').select('court_count, court_numbers, is_finalized').eq('id', eventId).single()
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

  // Resolve physical court numbers to use.
  // If event.court_numbers has exactly activeCourts entries, use those sorted ascending.
  // Highest court number → strongest players (idx 0); lowest → weakest.
  const specifiedCourts = ((event.court_numbers ?? []) as number[])
    .filter(n => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b)
  const courtNumbers: number[] = specifiedCourts.length === activeCourts
    ? specifiedCourts
    : Array.from({ length: activeCourts }, (_, i) => i + 1)

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

  // m.courtNumber is 1-based internal index from generateRoundDraw.
  // idx 0 (m.courtNumber=1) carries the strongest players → map to the highest physical court.
  // Mapping: courtNumbers[activeCourts - m.courtNumber]
  const { error } = await service.from('event_matches').insert(
    matches.map(m => ({
      event_id:     eventId,
      court_number: courtNumbers[activeCourts - m.courtNumber],
      round_number: m.roundNumber,
      player_a1:    m.playerA1,
      player_a2:    m.playerA2,
      player_b1:    m.playerB1,
      player_b2:    m.playerB2,
    })),
  )

  if (error) return { fout: error.message }

  // Create empty shells for rounds 2…ROUNDS_PER_EVENT using the same physical court numbers
  for (let r = 2; r <= ROUNDS_PER_EVENT; r++) {
    const { count } = await service
      .from('event_matches')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('round_number', r)

    if ((count ?? 0) === 0) {
      await service.from('event_matches').insert(
        courtNumbers.map(cn => ({
          event_id:     eventId,
          court_number: cn,
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

    // Snapshot post-event ELO on the signup row for historical ranking
    await service.from('event_signups')
      .update({ elo_after: newElo })
      .eq('event_id', eventId)
      .eq('player_id', p.id)
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

// ── Admin: remove any player from event ──────────────────────────────────
export async function adminRemovePlayer(eventId: string, playerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const service = await createServiceClient()

  const { data: signup } = await service
    .from('event_signups').select('id').eq('event_id', eventId).eq('player_id', playerId).single()
  if (!signup) return { fout: 'Signup not found' }

  const { data: before } = await service.from('event_signups').select('player_id, status').eq('event_id', eventId)
  const previouslyWaitlisted = new Set((before ?? []).filter(s => s.status === 'waitlisted').map(s => s.player_id))
  const previouslyConfirmed  = new Set((before ?? []).filter(s => s.status === 'confirmed').map(s => s.player_id))

  await service.from('event_signups').delete().eq('id', signup.id)

  const { data: event } = await service
    .from('events').select('court_count, title, datetime, location').eq('id', eventId).single()

  const { data: remaining } = await service
    .from('event_signups').select('id, player_id')
    .eq('event_id', eventId).order('signed_up_at', { ascending: true })

  const newlyConfirmed: string[] = []
  const newlyDemoted:   string[] = []

  if (remaining && remaining.length > 0 && event) {
    const confirmedSpots = Math.min(Math.floor(remaining.length / 4) * 4, event.court_count * 4)
    for (let i = 0; i < remaining.length; i++) {
      const s = i < confirmedSpots ? 'confirmed' : 'waitlisted'
      await service.from('event_signups').update({ status: s }).eq('id', remaining[i].id)
      if (s === 'confirmed' && previouslyWaitlisted.has(remaining[i].player_id)) newlyConfirmed.push(remaining[i].player_id)
      if (s === 'waitlisted' && previouslyConfirmed.has(remaining[i].player_id))  newlyDemoted.push(remaining[i].player_id)
    }
  }

  if (event) {
    if (newlyConfirmed.length > 0) {
      const { data: players } = await service.from('profielen').select('id, naam, email, email_notifications').in('id', newlyConfirmed)
      await Promise.all((players ?? []).filter(p => p.email_notifications !== false).map(p =>
        sendWaitlistPromotionEmail({ to: p.email, name: p.naam, eventTitle: event.title, eventDatetime: event.datetime, eventLocation: event.location })
      ))
    }
    if (newlyDemoted.length > 0) {
      const { data: players } = await service.from('profielen').select('id, naam, email, email_notifications').in('id', newlyDemoted)
      await Promise.all((players ?? []).filter(p => p.email_notifications !== false).map(p =>
        sendDemotedToWaitlistEmail({ to: p.email, name: p.naam, eventTitle: event.title, eventDatetime: event.datetime, eventLocation: event.location })
      ))
    }
  }

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/events/${eventId}/admin`)
  return {}
}

// ── Admin: add any registered player to event ─────────────────────────────
export async function adminAddPlayer(eventId: string, playerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const service = await createServiceClient()

  const { data: event } = await service
    .from('events').select('court_count, title, datetime, location').eq('id', eventId).single()
  if (!event) return { fout: 'Event not found' }

  const { data: playerProfile } = await service.from('profielen').select('elo_rating').eq('id', playerId).single()
  if (!playerProfile) return { fout: 'Player not found' }

  const { data: existing } = await service.from('event_signups').select('player_id, status').eq('event_id', eventId)
  const previouslyWaitlisted = new Set((existing ?? []).filter(s => s.status === 'waitlisted').map(s => s.player_id))

  const { error } = await service.from('event_signups').insert({
    event_id: eventId, player_id: playerId,
    status: 'waitlisted', elo_at_signup: playerProfile.elo_rating,
  })
  if (error) {
    if (error.code === '23505') return { fout: 'Player already signed up' }
    return { fout: error.message }
  }

  const { data: allSignups } = await service
    .from('event_signups').select('id, player_id')
    .eq('event_id', eventId).order('signed_up_at', { ascending: true })

  const newlyConfirmed: string[] = []
  if (allSignups && allSignups.length > 0) {
    const confirmedSpots = Math.min(Math.floor(allSignups.length / 4) * 4, event.court_count * 4)
    for (let i = 0; i < allSignups.length; i++) {
      const s = i < confirmedSpots ? 'confirmed' : 'waitlisted'
      await service.from('event_signups').update({ status: s }).eq('id', allSignups[i].id)
      if (s === 'confirmed' && previouslyWaitlisted.has(allSignups[i].player_id)) newlyConfirmed.push(allSignups[i].player_id)
    }
  }

  if (newlyConfirmed.length > 0) {
    const { data: players } = await service.from('profielen').select('id, naam, email, email_notifications').in('id', newlyConfirmed)
    await Promise.all((players ?? []).filter(p => p.email_notifications !== false).map(p =>
      sendWaitlistPromotionEmail({ to: p.email, name: p.naam, eventTitle: event.title, eventDatetime: event.datetime, eventLocation: event.location })
    ))
  }

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/events/${eventId}/admin`)
  return {}
}

// ── Update court number for a single match (admin only) ──────────────────
export async function updateMatchCourt(matchId: string, courtNumber: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  if (!Number.isInteger(courtNumber) || courtNumber < 1) return { fout: 'Invalid court number' }

  const service = await createServiceClient()
  const { data: match } = await service.from('event_matches').select('event_id').eq('id', matchId).single()
  if (!match) return { fout: 'Match not found' }

  const { error } = await service.from('event_matches').update({ court_number: courtNumber }).eq('id', matchId)
  if (error) return { fout: error.message }

  revalidatePath(`/events/${match.event_id}`)
  revalidatePath(`/events/${match.event_id}/admin`)
  return {}
}

export async function updateAllMatchesCourt(eventId: string, oldCourtNumber: number, newCourtNumber: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  if (!Number.isInteger(newCourtNumber) || newCourtNumber < 1) return { fout: 'Invalid court number' }

  const service = await createServiceClient()
  const { error } = await service
    .from('event_matches')
    .update({ court_number: newCourtNumber })
    .eq('event_id', eventId)
    .eq('court_number', oldCourtNumber)
  if (error) return { fout: error.message }

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/events/${eventId}/admin`)
  return {}
}

// ── Send draw notification emails (admin only) ────────────────────────────
export async function sendDrawNotificationEmails(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const service = await createServiceClient()

  const { data: event } = await service.from('events')
    .select('title, datetime, location, locations(maps_url)').eq('id', eventId).single()
  if (!event) return { fout: 'Event not found' }

  const mapsUrl = (event.locations as unknown as { maps_url: string | null } | null)?.maps_url ?? null

  const { data: matches } = await service.from('event_matches')
    .select('court_number, player_a1, player_a2, player_b1, player_b2')
    .eq('event_id', eventId).eq('round_number', 1).not('player_a1', 'is', null)

  if (!matches || matches.length === 0) return { fout: 'No draw found for round 1' }

  const allIds = new Set<string>()
  for (const m of matches) {
    ;[m.player_a1, m.player_a2, m.player_b1, m.player_b2]
      .filter(Boolean).forEach(id => allIds.add(id as string))
  }

  const { data: profiles } = await service.from('profielen')
    .select('id, naam, email, email_notifications').in('id', Array.from(allIds))

  type PMap = { naam: string; email: string; email_notifications: boolean | null }
  const pMap: Record<string, PMap> = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  let sent = 0
  const sends: Promise<void>[] = []

  for (const m of matches) {
    const slots = [
      { pid: m.player_a1, partner: m.player_a2, opp1: m.player_b1, opp2: m.player_b2 },
      { pid: m.player_a2, partner: m.player_a1, opp1: m.player_b1, opp2: m.player_b2 },
      { pid: m.player_b1, partner: m.player_b2, opp1: m.player_a1, opp2: m.player_a2 },
      { pid: m.player_b2, partner: m.player_b1, opp1: m.player_a1, opp2: m.player_a2 },
    ]
    for (const { pid, partner, opp1, opp2 } of slots) {
      if (!pid) continue
      const p = pMap[pid]
      if (!p || p.email_notifications === false) continue
      sends.push(sendDrawNotificationEmail({
        to: p.email, name: p.naam,
        courtNumber: m.court_number,
        partnerName: pMap[partner as string]?.naam ?? '—',
        opp1Name:    pMap[opp1 as string]?.naam   ?? '—',
        opp2Name:    pMap[opp2 as string]?.naam   ?? '—',
        eventTitle: event.title, eventDatetime: event.datetime, eventLocation: event.location,
        eventMapsUrl: mapsUrl,
      }))
      sent++
    }
  }

  await Promise.all(sends)
  return { sent }
}

// ── Admin: delete all matches to allow draw regeneration ──────────────────
export async function resetEventDraw(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not authenticated' }

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only' }

  const service = await createServiceClient()
  const { error } = await service.from('event_matches').delete().eq('event_id', eventId)
  if (error) return { fout: error.message }

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/events/${eventId}/admin`)
  return {}
}

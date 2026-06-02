'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { maakGebalanceerdeTeams } from '@/lib/matchmaking'
import type { Profiel } from '@/types'

export async function aanmeldenVoorWedstrijd(wedstrijdId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { fout: 'You must be signed in to join.' }

  const { data: wedstrijd } = await supabase
    .from('wedstrijden')
    .select('id, status, max_spelers')
    .eq('id', wedstrijdId)
    .single()

  if (!wedstrijd) return { fout: 'Match not found.' }
  if (wedstrijd.status !== 'open') return { fout: 'Sign-ups are closed for this match.' }

  const { count } = await supabase
    .from('aanmeldingen')
    .select('id', { count: 'exact', head: true })
    .eq('wedstrijd_id', wedstrijdId)

  if ((count ?? 0) >= wedstrijd.max_spelers) {
    return { fout: 'This match is already full.' }
  }

  const { error } = await supabase
    .from('aanmeldingen')
    .insert({ wedstrijd_id: wedstrijdId, speler_id: user.id })

  if (error) {
    if (error.code === '23505') return { fout: 'You are already signed up for this match.' }
    return { fout: 'Sign-up failed. Please try again.' }
  }

  const nieuweCount = (count ?? 0) + 1
  if (nieuweCount >= wedstrijd.max_spelers) {
    await maakTeamsAan(wedstrijdId)
  }

  revalidatePath('/wedstrijden')
  return { succes: true }
}

export async function afmeldenVanWedstrijd(wedstrijdId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { fout: 'Not signed in.' }

  const { data: wedstrijd } = await supabase
    .from('wedstrijden')
    .select('status')
    .eq('id', wedstrijdId)
    .single()

  if (wedstrijd?.status !== 'open') {
    return { fout: 'You can no longer cancel your sign-up for this match.' }
  }

  await supabase
    .from('aanmeldingen')
    .delete()
    .eq('wedstrijd_id', wedstrijdId)
    .eq('speler_id', user.id)

  revalidatePath('/wedstrijden')
  return { succes: true }
}

async function maakTeamsAan(wedstrijdId: string) {
  const service = await createServiceClient()

  const { data: aanmeldingen } = await service
    .from('aanmeldingen')
    .select('speler_id, profielen(id, naam, email, elo_rating, wedstrijden_gespeeld, gewonnen, verloren, is_admin, aangemaakt_op)')
    .eq('wedstrijd_id', wedstrijdId)
    .order('aangemeld_op', { ascending: true })
    .limit(4)

  if (!aanmeldingen || aanmeldingen.length < 4) return

  const spelers = aanmeldingen.map(a => a.profielen as unknown as Profiel)
  const { team1, team2 } = maakGebalanceerdeTeams(spelers)

  for (const speler of team1) {
    await service.from('aanmeldingen').update({ team: 1 })
      .eq('wedstrijd_id', wedstrijdId).eq('speler_id', speler.id)
  }
  for (const speler of team2) {
    await service.from('aanmeldingen').update({ team: 2 })
      .eq('wedstrijd_id', wedstrijdId).eq('speler_id', speler.id)
  }

  await service.from('wedstrijden').update({ status: 'vol' }).eq('id', wedstrijdId)
}

// Any logged-in user can create a match.
// gepland_op should be a timezone-aware ISO string built on the client.
export async function maakWedstrijd(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not signed in.' }

  const geplandOp   = formData.get('gepland_op') as string
  const locatie     = (formData.get('locatie')    as string | null)?.trim() || 'Javea'
  const matchTypeRaw = (formData.get('match_type') as string | null)?.trim() || null
  const minLevelRaw  = (formData.get('min_level')  as string | null)?.trim()
  const maxLevelRaw  = (formData.get('max_level')  as string | null)?.trim()
  const minLevel    = minLevelRaw ? parseFloat(minLevelRaw) : null
  const maxLevel    = maxLevelRaw ? parseFloat(maxLevelRaw) : null

  if (!geplandOp) return { fout: 'Date and time are required.' }

  const service = await createServiceClient()

  // Try the full insert including optional fields (requires migration to have been run).
  // If it fails for any reason — most likely missing columns — fall back to a base
  // insert so the match is always created.
  const fullData: Record<string, unknown> = {
    gepland_op:      geplandOp,
    locatie,
    aangemaakt_door: user.id,
  }
  if (matchTypeRaw && matchTypeRaw !== 'Mixed') fullData.match_type = matchTypeRaw
  if (minLevel !== null && !isNaN(minLevel))    fullData.min_level  = minLevel
  if (maxLevel !== null && !isNaN(maxLevel))    fullData.max_level  = maxLevel

  let { error } = await service.from('wedstrijden').insert(fullData)

  if (error && Object.keys(fullData).length > 3) {
    // Optional columns are not in the DB yet — retry with just the base fields.
    const baseData = { gepland_op: geplandOp, locatie, aangemaakt_door: user.id }
    ;({ error } = await service.from('wedstrijden').insert(baseData))
  }

  if (error) return { fout: 'Could not create match. Please try again.' }

  revalidatePath('/wedstrijden')
  return { succes: true }
}

// Match creator (or admin) can confirm/unconfirm the court booking.
export async function bevestigBaanBoeking(wedstrijdId: string, confirmed: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not signed in.' }

  const service = await createServiceClient()
  const { data: wedstrijd } = await service
    .from('wedstrijden').select('aangemaakt_door').eq('id', wedstrijdId).single()
  if (!wedstrijd) return { fout: 'Match not found.' }

  const { data: profiel } = await supabase
    .from('profielen').select('is_admin').eq('id', user.id).single()

  if (wedstrijd.aangemaakt_door !== user.id && !profiel?.is_admin) {
    return { fout: 'Only the match creator can update the court booking.' }
  }

  const { error } = await service
    .from('wedstrijden')
    .update({ court_booking_confirmed: confirmed })
    .eq('id', wedstrijdId)

  if (error) {
    if (error.message?.includes('court_booking_confirmed')) {
      return { fout: 'Court booking requires a database update — run migration_matches.sql in Supabase first.' }
    }
    return { fout: 'Could not update court booking status.' }
  }

  revalidatePath('/wedstrijden')
  return {}
}

// Admin: enable or disable the "Create match" button for all users.
export async function setMatchesEnabled(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not signed in.' }

  const { data: profiel } = await supabase
    .from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) return { fout: 'Admin only.' }

  const service = await createServiceClient()
  const { error } = await service
    .from('instellingen')
    .upsert({ id: 1, matches_enabled: enabled }, { onConflict: 'id' })

  if (error) return { fout: 'Could not update setting. Run migration_matches.sql in Supabase first.' }

  revalidatePath('/wedstrijden')
  revalidatePath('/admin')
  return {}
}

export async function annuleerWedstrijd(wedstrijdId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not signed in.' }

  const service = await createServiceClient()
  const { data: wedstrijd } = await service
    .from('wedstrijden').select('aangemaakt_door').eq('id', wedstrijdId).single()

  const { data: profiel } = await supabase
    .from('profielen').select('is_admin').eq('id', user.id).single()

  if (wedstrijd?.aangemaakt_door !== user.id && !profiel?.is_admin) {
    return { fout: 'Not authorised.' }
  }

  await service.from('wedstrijden').update({ status: 'geannuleerd' }).eq('id', wedstrijdId)

  revalidatePath('/wedstrijden')
  revalidatePath('/admin')
  return { succes: true }
}

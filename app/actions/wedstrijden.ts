'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { maakGebalanceerdeTeams } from '@/lib/matchmaking'
import { berekenTeamEloNaWedstrijd } from '@/lib/elo'
import type { Profiel } from '@/types'

export async function aanmeldenVoorWedstrijd(wedstrijdId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { fout: 'Je moet ingelogd zijn om je aan te melden.' }

  const { data: wedstrijd } = await supabase
    .from('wedstrijden')
    .select('id, status, max_spelers')
    .eq('id', wedstrijdId)
    .single()

  if (!wedstrijd) return { fout: 'Wedstrijd niet gevonden.' }
  if (wedstrijd.status !== 'open') return { fout: 'Aanmelden is niet meer mogelijk voor deze wedstrijd.' }

  const { count } = await supabase
    .from('aanmeldingen')
    .select('id', { count: 'exact', head: true })
    .eq('wedstrijd_id', wedstrijdId)

  if ((count ?? 0) >= wedstrijd.max_spelers) {
    return { fout: 'Deze wedstrijd is al vol.' }
  }

  const { error } = await supabase
    .from('aanmeldingen')
    .insert({ wedstrijd_id: wedstrijdId, speler_id: user.id })

  if (error) {
    if (error.code === '23505') return { fout: 'Je bent al aangemeld voor deze wedstrijd.' }
    return { fout: 'Aanmelden mislukt. Probeer het opnieuw.' }
  }

  const nieuweCount = (count ?? 0) + 1
  if (nieuweCount >= wedstrijd.max_spelers) {
    await maakTeamsAan(wedstrijdId)
  }

  revalidatePath('/')
  return { succes: true }
}

export async function afmeldenVanWedstrijd(wedstrijdId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { fout: 'Je moet ingelogd zijn.' }

  const { data: wedstrijd } = await supabase
    .from('wedstrijden')
    .select('status')
    .eq('id', wedstrijdId)
    .single()

  if (wedstrijd?.status !== 'open') {
    return { fout: 'Je kunt je niet meer afmelden voor deze wedstrijd.' }
  }

  await supabase
    .from('aanmeldingen')
    .delete()
    .eq('wedstrijd_id', wedstrijdId)
    .eq('speler_id', user.id)

  revalidatePath('/')
  return { succes: true }
}

async function maakTeamsAan(wedstrijdId: string) {
  const supabase = await createServiceClient()

  const { data: aanmeldingen } = await supabase
    .from('aanmeldingen')
    .select('speler_id, profielen(id, naam, email, elo_rating, wedstrijden_gespeeld, gewonnen, verloren, is_admin, aangemaakt_op)')
    .eq('wedstrijd_id', wedstrijdId)
    .order('aangemeld_op', { ascending: true })
    .limit(4)

  if (!aanmeldingen || aanmeldingen.length < 4) return

  const spelers = aanmeldingen.map(a => a.profielen as unknown as Profiel)
  const { team1, team2 } = maakGebalanceerdeTeams(spelers)

  for (const speler of team1) {
    await supabase
      .from('aanmeldingen')
      .update({ team: 1 })
      .eq('wedstrijd_id', wedstrijdId)
      .eq('speler_id', speler.id)
  }

  for (const speler of team2) {
    await supabase
      .from('aanmeldingen')
      .update({ team: 2 })
      .eq('wedstrijd_id', wedstrijdId)
      .eq('speler_id', speler.id)
  }

  await supabase
    .from('wedstrijden')
    .update({ status: 'vol' })
    .eq('id', wedstrijdId)
}

export async function maakWedstrijd(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { fout: 'Niet ingelogd.' }

  const { data: profiel } = await supabase
    .from('profielen')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profiel?.is_admin) return { fout: 'Geen beheerdersrechten.' }

  const datum = formData.get('datum') as string
  const tijd = formData.get('tijd') as string
  const locatie = formData.get('locatie') as string

  if (!datum || !tijd) return { fout: 'Datum en tijd zijn verplicht.' }

  const geplandOp = new Date(`${datum}T${tijd}:00`).toISOString()

  const { error } = await supabase
    .from('wedstrijden')
    .insert({
      gepland_op: geplandOp,
      locatie: locatie || 'Javea',
      aangemaakt_door: user.id,
    })

  if (error) return { fout: 'Aanmaken mislukt. Probeer het opnieuw.' }

  revalidatePath('/')
  revalidatePath('/admin')
  return { succes: true }
}

export async function legResultaatVast(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { fout: 'Niet ingelogd.' }

  const { data: profiel } = await supabase
    .from('profielen')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profiel?.is_admin) return { fout: 'Geen beheerdersrechten.' }

  const wedstrijdId = formData.get('wedstrijd_id') as string
  const team1Score = parseInt(formData.get('team1_score') as string)
  const team2Score = parseInt(formData.get('team2_score') as string)

  if (isNaN(team1Score) || isNaN(team2Score) || team1Score < 0 || team2Score < 0) {
    return { fout: 'Ongeldige scores.' }
  }
  if (team1Score === team2Score) {
    return { fout: 'Een gelijkspel is niet mogelijk in padel.' }
  }

  const { data: aanmeldingen } = await supabase
    .from('aanmeldingen')
    .select('speler_id, team, profielen(id, elo_rating, wedstrijden_gespeeld, gewonnen, verloren)')
    .eq('wedstrijd_id', wedstrijdId)
    .in('team', [1, 2])

  if (!aanmeldingen || aanmeldingen.length !== 4) {
    return { fout: 'Wedstrijd heeft niet de juiste teamindeling.' }
  }

  const serviceSupabase = await createServiceClient()

  await serviceSupabase
    .from('resultaten')
    .insert({
      wedstrijd_id: wedstrijdId,
      team1_score: team1Score,
      team2_score: team2Score,
      vastgelegd_door: user.id,
    })

  await serviceSupabase
    .from('wedstrijden')
    .update({ status: 'voltooid' })
    .eq('id', wedstrijdId)

  const team1Spelers = aanmeldingen.filter(a => a.team === 1).map(a => a.profielen as unknown as Profiel & { elo_rating: number })
  const team2Spelers = aanmeldingen.filter(a => a.team === 2).map(a => a.profielen as unknown as Profiel & { elo_rating: number })

  const team1Gewonnen = team1Score > team2Score
  const nieuweElo = berekenTeamEloNaWedstrijd(
    [team1Spelers[0].elo_rating, team1Spelers[1].elo_rating],
    [team2Spelers[0].elo_rating, team2Spelers[1].elo_rating],
    team1Gewonnen
  )

  for (let i = 0; i < 2; i++) {
    const speler = team1Spelers[i]
    await serviceSupabase
      .from('profielen')
      .update({
        elo_rating: nieuweElo.team1[i],
        wedstrijden_gespeeld: speler.wedstrijden_gespeeld + 1,
        gewonnen: speler.gewonnen + (team1Gewonnen ? 1 : 0),
        verloren: speler.verloren + (team1Gewonnen ? 0 : 1),
      })
      .eq('id', speler.id)
  }

  for (let i = 0; i < 2; i++) {
    const speler = team2Spelers[i]
    await serviceSupabase
      .from('profielen')
      .update({
        elo_rating: nieuweElo.team2[i],
        wedstrijden_gespeeld: speler.wedstrijden_gespeeld + 1,
        gewonnen: speler.gewonnen + (team1Gewonnen ? 0 : 1),
        verloren: speler.verloren + (team1Gewonnen ? 1 : 0),
      })
      .eq('id', speler.id)
  }

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/spelers')
  revalidatePath('/dashboard')
  return { succes: true }
}

export async function annuleerWedstrijd(wedstrijdId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { fout: 'Niet ingelogd.' }

  const { data: profiel } = await supabase
    .from('profielen')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profiel?.is_admin) return { fout: 'Geen beheerdersrechten.' }

  await supabase
    .from('wedstrijden')
    .update({ status: 'geannuleerd' })
    .eq('id', wedstrijdId)

  revalidatePath('/')
  revalidatePath('/admin')
  return { succes: true }
}

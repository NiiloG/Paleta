'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const VALID_STARTING_ELOS = [286, 857, 1429, 1857]

// Called immediately after client-side signUp to guarantee the correct starting
// ELO is written, regardless of whether the DB trigger reads metadata correctly.
export async function setStartingElo(userId: string, elo: number) {
  if (!VALID_STARTING_ELOS.includes(elo)) return
  const service = createServiceClient()
  await service.from('profielen').update({ elo_rating: elo }).eq('id', userId)
}

export async function inloggen(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('wachtwoord') as string,
  })

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { fout: 'Je e-mailadres is nog niet bevestigd. Controleer je inbox (en spammap).' }
    }
    return { fout: 'Ongeldig e-mailadres of wachtwoord.' }
  }

  revalidatePath('/', 'layout')
  return { succes: true }
}

export async function registreren(formData: FormData) {
  const supabase = await createClient()

  const naam = formData.get('naam') as string
  const email = formData.get('email') as string
  const wachtwoord = formData.get('wachtwoord') as string

  if (!naam || naam.trim().length < 2) {
    return { fout: 'Naam moet minimaal 2 tekens bevatten.' }
  }

  if (!email || !email.includes('@')) {
    return { fout: 'Voer een geldig e-mailadres in.' }
  }

  if (!wachtwoord || wachtwoord.length < 8) {
    return { fout: 'Wachtwoord moet minimaal 8 tekens bevatten.' }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password: wachtwoord,
    options: {
      data: { naam: naam.trim() },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { fout: 'Dit e-mailadres is al geregistreerd.' }
    }
    return { fout: 'Er is iets misgegaan. Probeer het opnieuw.' }
  }

  revalidatePath('/', 'layout')
  return { succes: true }
}

export async function uitloggen() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

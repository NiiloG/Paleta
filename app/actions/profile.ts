'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function updateEmailNotifications(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('profielen').update({ email_notifications: enabled }).eq('id', user.id)
  revalidatePath('/dashboard')
}

export async function updateBlurName(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('profielen').update({ blur_name: enabled }).eq('id', user.id)
  revalidatePath('/dashboard')
  revalidatePath('/spelers')
}

export async function updateBlurNumber(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('profielen').update({ blur_number: enabled }).eq('id', user.id)
  revalidatePath('/dashboard')
  revalidatePath('/spelers')
}

// Update display name and optional phone number.
// Falls back to naam-only if the phone column doesn't exist yet (migration pending).
export async function updateProfileInfo(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not signed in.' }

  const firstName = (formData.get('first_name') as string | null)?.trim() ?? ''
  const lastName  = (formData.get('last_name')  as string | null)?.trim() ?? ''
  const phone     = (formData.get('phone')       as string | null)?.trim() || null

  const naam = [firstName, lastName].filter(Boolean).join(' ')
  if (!naam) return { fout: 'First name is required.' }

  let { error } = await supabase.from('profielen').update({ naam, phone }).eq('id', user.id)
  if (error) {
    // phone column may not exist yet — retry without it
    ;({ error } = await supabase.from('profielen').update({ naam }).eq('id', user.id))
  }
  if (error) return { fout: 'Could not update profile. Please try again.' }

  revalidatePath('/dashboard')
  revalidatePath('/spelers')
  revalidatePath('/wedstrijden')
  return {}
}

// Send a Supabase password-reset email to the signed-in user's address.
export async function sendPasswordReset() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { fout: 'Not signed in.' }

  const headersList = await headers()
  const origin = headersList.get('origin') ?? `https://${headersList.get('host')}`

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/api/auth/callback?next=/update-password`,
  })
  if (error) return { fout: error.message }
  return {}
}

// Permanently delete the authenticated user's account (cascades to profielen via FK).
export async function deleteAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fout: 'Not signed in.' }

  const service = createServiceClient()
  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) return { fout: error.message }

  return {}
}

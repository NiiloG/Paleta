'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateEmailNotifications(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('profielen').update({ email_notifications: enabled }).eq('id', user.id)
  revalidatePath('/dashboard')
}

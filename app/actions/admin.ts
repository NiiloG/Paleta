'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

// ── Locations ──────────────────────────────────────────────────────────────

export async function createLocation(formData: FormData) {
  if (!await requireAdmin()) return { fout: 'Admin only.' }
  const service = createServiceClient()
  const deadlineRaw = (formData.get('booking_deadline_hours') as string | null)?.trim()
  const deadlineHours = deadlineRaw ? parseInt(deadlineRaw, 10) : null
  const { error } = await service.from('locations').insert({
    name:                   (formData.get('name')       as string).trim(),
    address:                (formData.get('address')    as string | null)?.trim()   || null,
    maps_url:               (formData.get('maps_url')   as string | null)?.trim()   || null,
    extra_info:             (formData.get('extra_info') as string | null)?.trim()   || null,
    booking_deadline_hours: deadlineHours && !isNaN(deadlineHours) ? deadlineHours : null,
  })
  if (error) return { fout: error.message }
  revalidatePath('/admin')
  return {}
}

export async function updateLocation(id: string, formData: FormData) {
  if (!await requireAdmin()) return { fout: 'Admin only.' }
  const service = createServiceClient()
  const deadlineRaw = (formData.get('booking_deadline_hours') as string | null)?.trim()
  const deadlineHours = deadlineRaw ? parseInt(deadlineRaw, 10) : null
  const { error } = await service.from('locations').update({
    name:                   (formData.get('name')       as string).trim(),
    address:                (formData.get('address')    as string | null)?.trim()   || null,
    maps_url:               (formData.get('maps_url')   as string | null)?.trim()   || null,
    extra_info:             (formData.get('extra_info') as string | null)?.trim()   || null,
    booking_deadline_hours: deadlineHours && !isNaN(deadlineHours) ? deadlineHours : null,
  }).eq('id', id)
  if (error) return { fout: error.message }
  revalidatePath('/admin')
  return {}
}

export async function deleteLocation(id: string) {
  if (!await requireAdmin()) return { fout: 'Admin only.' }
  const service = createServiceClient()
  const { error } = await service.from('locations').delete().eq('id', id)
  if (error) return { fout: error.message }
  revalidatePath('/admin')
  return {}
}

// ── Costs ──────────────────────────────────────────────────────────────────

export async function createCost(formData: FormData) {
  if (!await requireAdmin()) return { fout: 'Admin only.' }
  const amount = parseFloat(formData.get('amount') as string)
  if (isNaN(amount) || amount <= 0) return { fout: 'Invalid amount.' }
  const service = createServiceClient()
  const { error } = await service.from('costs').insert({
    description: (formData.get('description') as string).trim(),
    amount,
    date:       formData.get('date') as string,
    is_monthly: formData.get('is_monthly') === 'true',
  })
  if (error) return { fout: error.message }
  revalidatePath('/admin')
  return {}
}

export async function deleteCost(id: string) {
  if (!await requireAdmin()) return { fout: 'Admin only.' }
  const service = createServiceClient()
  const { error } = await service.from('costs').delete().eq('id', id)
  if (error) return { fout: error.message }
  revalidatePath('/admin')
  return {}
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  if (!await requireAdmin()) return { fout: 'Admin only.' }
  const service = createServiceClient()
  const { error } = await service.from('profielen').update({ is_admin: isAdmin }).eq('id', userId)
  if (error) return { fout: error.message }
  revalidatePath('/admin')
  return {}
}

export async function removeUserAsAdmin(userId: string) {
  if (!await requireAdmin()) return { fout: 'Admin only.' }
  const service = createServiceClient()
  const { error } = await service.auth.admin.deleteUser(userId)
  if (error) return { fout: error.message }
  revalidatePath('/admin')
  revalidatePath('/spelers')
  return {}
}

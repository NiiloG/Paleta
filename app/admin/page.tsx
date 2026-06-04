import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Event, Location, Cost, AdminUserRow } from '@/types'
import AdminTabs from './AdminTabs'

export const revalidate = 0

type EventRow = Event & { event_signups: { status: string }[] }

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) redirect('/')

  const service = createServiceClient()

  // Overview stats
  const [
    { count: playerCount },
    { count: elapsedEvents },
    { count: totalSignups },
  ] = await Promise.all([
    supabase.from('profielen').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_finalized', true),
    supabase.from('event_signups').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
  ])

  // Events
  const { data: rawEvents } = await service
    .from('events')
    .select('*, event_signups(status)')
    .order('datetime', { ascending: false })
    .limit(50)
  const events = (rawEvents ?? []) as unknown as EventRow[]

  // Locations
  const { data: rawLocations } = await service.from('locations').select('*').order('name')
  const locations = (rawLocations ?? []) as Location[]

  // Costs
  const { data: rawCosts } = await service.from('costs').select('*').order('date', { ascending: false })
  const costs = (rawCosts ?? []) as Cost[]

  // Users — profielen + auth confirmation status
  const { data: profiles } = await service.from('profielen').select('*').order('aangemaakt_op', { ascending: false })
  const { data: authData } = await service.auth.admin.listUsers({ perPage: 1000 })
  const authMap = Object.fromEntries((authData?.users ?? []).map(u => [u.id, u]))

  const adminUsers: AdminUserRow[] = (profiles ?? []).map(p => ({
    id:              p.id,
    naam:            p.naam,
    email:           p.email,
    phone:           p.phone ?? null,
    player_number:   p.player_number,
    is_admin:        p.is_admin,
    email_confirmed: !!authMap[p.id]?.email_confirmed_at,
    aangemaakt_op:   p.aangemaakt_op,
  }))

  // Settings
  const { data: settings } = await supabase.from('instellingen').select('matches_enabled').eq('id', 1).single()
  const matchesEnabled = settings?.matches_enabled ?? true

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>Admin</p>
        <h1 className="font-serif text-4xl font-bold text-white">Management</h1>
      </div>

      <AdminTabs
        overviewStats={{ playerCount: playerCount ?? 0, elapsedEvents: elapsedEvents ?? 0, totalSignups: totalSignups ?? 0 }}
        events={events}
        locations={locations}
        costs={costs}
        users={adminUsers}
        matchesEnabled={matchesEnabled}
      />
    </div>
  )
}

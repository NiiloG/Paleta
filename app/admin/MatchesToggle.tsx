'use client'

import { useState } from 'react'
import { setMatchesEnabled } from '@/app/actions/wedstrijden'

export default function MatchesToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving]   = useState(false)
  const [fout, setFout]       = useState<string | null>(null)

  async function handleToggle() {
    setSaving(true)
    setFout(null)
    const next = !enabled
    const result = await setMatchesEnabled(next)
    if (result?.fout) {
      setFout(result.fout)
    } else {
      setEnabled(next)
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">Match creation</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {enabled ? 'Players can currently create matches' : 'Match creation is disabled for all players'}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          title={enabled ? 'Disable match creation' : 'Enable match creation'}
          style={{
            flexShrink: 0,
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            background: enabled ? '#f5a623' : 'rgba(255,255,255,0.15)',
            border: 'none',
            position: 'relative',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute',
            top: '2px',
            left: enabled ? '22px' : '2px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.18s',
          }} />
        </button>
      </div>
      {fout && (
        <p className="text-xs mt-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(232,131,74,0.12)', border: '0.5px solid rgba(232,131,74,0.28)', color: '#f0a070' }}>
          {fout}
        </p>
      )}
    </div>
  )
}

export interface TierCfg {
  label:  string
  color:  string
  bg:     string
  border: string
}

export function tierCfg(elo: number): TierCfg {
  if (elo >= 1500) return { label: 'Expert',       color: '#f9d070', bg: 'rgba(245,166,35,0.16)', border: 'rgba(245,166,35,0.35)' }
  if (elo >= 1000) return { label: 'Advanced',     color: '#ef9a9a', bg: 'rgba(239,83,80,0.14)',  border: 'rgba(239,83,80,0.32)'  }
  if (elo >= 666)  return { label: 'Intermediate', color: '#6dd0e8', bg: 'rgba(42,135,168,0.14)', border: 'rgba(42,135,168,0.30)' }
  return                  { label: 'Beginner',     color: '#81c784', bg: 'rgba(76,175,80,0.12)',  border: 'rgba(76,175,80,0.28)'  }
}

export function eloColor(elo: number): string {
  return tierCfg(elo).color
}

/**
 * Convert raw ELO to a Playtomic-style display score.
 * Formula: 1.0 + (ELO / 2000) × 6.0, capped at [1.00, 7.00].
 */
export function eloToPlaytomic(elo: number): string {
  const raw    = 1.0 + (elo / 2000) * 6.0
  const capped = Math.min(7.0, Math.max(1.0, raw))
  return capped.toFixed(2)
}

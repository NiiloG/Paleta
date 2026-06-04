export interface DrawPlayer {
  id: string
  elo_rating: number
}

export interface DrawMatch {
  courtNumber: number
  roundNumber: number
  playerA1: string
  playerA2: string
  playerB1: string
  playerB2: string
}

/**
 * Sequential seeding: sorts players by rating (desc), groups them into
 * blocks of 4, and assigns the top block to the highest court.
 * Within each court: [1st & 4th] vs [2nd & 3rd] balances the two teams.
 *
 * For round 1, players are seeded by elo_rating.
 * For round N, pass players sorted by accumulated event points (desc),
 * with elo_rating as tiebreak — caller is responsible for ordering.
 */
export function generateRoundDraw(players: DrawPlayer[], roundNumber: number): DrawMatch[] {
  if (players.length === 0 || players.length % 4 !== 0) {
    throw new Error(`Player count must be a non-zero multiple of 4, got ${players.length}`)
  }

  const courtCount = players.length / 4
  const sorted = [...players].sort((a, b) => b.elo_rating - a.elo_rating)

  // Sequential grouping: best 4 → group 0 (top court), next 4 → group 1, etc.
  const courtPlayers: DrawPlayer[][] = Array.from({ length: courtCount }, (_, i) =>
    sorted.slice(i * 4, i * 4 + 4)
  )

  return courtPlayers.map((court, idx) => ({
    courtNumber: idx + 1,
    roundNumber,
    playerA1: court[0].id,  // 1st (best)  + 4th (worst) = Team A
    playerA2: court[3].id,
    playerB1: court[1].id,  // 2nd + 3rd = Team B
    playerB2: court[2].id,
  }))
}

/**
 * Proportion-based ELO: actual score = scoreA / (scoreA + scoreB).
 * K=32. Each player on a team receives the same delta.
 */
export function calculateEloDeltas(
  teamA: DrawPlayer[],
  teamB: DrawPlayer[],
  scoreA: number,
  scoreB: number,
): { id: string; delta: number }[] {
  const total = scoreA + scoreB
  if (total === 0) return [...teamA, ...teamB].map(p => ({ id: p.id, delta: 0 }))

  const K = 32
  const avgEloA = (teamA[0].elo_rating + teamA[1].elo_rating) / 2
  const avgEloB = (teamB[0].elo_rating + teamB[1].elo_rating) / 2
  const expectedA = 1 / (1 + Math.pow(10, (avgEloB - avgEloA) / 400))
  const actualA = scoreA / total
  const deltaA = Math.round(K * (actualA - expectedA))

  return [
    ...teamA.map(p => ({ id: p.id, delta: deltaA })),
    ...teamB.map(p => ({ id: p.id, delta: -deltaA })),
  ]
}

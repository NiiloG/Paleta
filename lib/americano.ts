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
 * Snake-distributes players across courts by ELO so each court gets
 * a balanced average. Within each court, pairs [1st+4th] vs [2nd+3rd].
 *
 * For round 1, pass players sorted by elo_rating (desc).
 * For round N, pass players sorted by accumulated event points (desc),
 * with elo_rating as tiebreak — caller is responsible for ordering.
 */
export function generateRoundDraw(players: DrawPlayer[], roundNumber: number): DrawMatch[] {
  if (players.length === 0 || players.length % 4 !== 0) {
    throw new Error(`Player count must be a non-zero multiple of 4, got ${players.length}`)
  }

  const courtCount = players.length / 4
  const sorted = [...players].sort((a, b) => b.elo_rating - a.elo_rating)

  // Distribute using snake pattern across courts
  const courtPlayers: DrawPlayer[][] = Array.from({ length: courtCount }, () => [])
  sorted.forEach((player, i) => {
    const posInBlock = i % (courtCount * 2)
    const courtIndex = posInBlock < courtCount
      ? posInBlock
      : courtCount * 2 - 1 - posInBlock
    courtPlayers[courtIndex].push(player)
  })

  return courtPlayers.map((court, idx) => {
    const byElo = [...court].sort((a, b) => b.elo_rating - a.elo_rating)
    return {
      courtNumber: idx + 1,
      roundNumber,
      playerA1: byElo[0].id,
      playerA2: byElo[3].id,
      playerB1: byElo[1].id,
      playerB2: byElo[2].id,
    }
  })
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

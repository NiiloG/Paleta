import type { Profiel } from '@/types'

export function maakGebalanceerdeTeams(spelers: Profiel[]): {
  team1: Profiel[]
  team2: Profiel[]
} {
  if (spelers.length !== 4) {
    throw new Error('Precies 4 spelers vereist voor teamindeling')
  }

  const gesorteerd = [...spelers].sort((a, b) => b.elo_rating - a.elo_rating)

  // Greedy balancing: beste + slechtste vs tweede + derde
  // This minimizes the ELO difference between teams
  const team1 = [gesorteerd[0], gesorteerd[3]]
  const team2 = [gesorteerd[1], gesorteerd[2]]

  const team1Gem = (team1[0].elo_rating + team1[1].elo_rating) / 2
  const team2Gem = (team2[0].elo_rating + team2[1].elo_rating) / 2

  // Try swapping [0][1] vs [0][2] to see if that's more balanced
  const altTeam1 = [gesorteerd[0], gesorteerd[2]]
  const altTeam2 = [gesorteerd[1], gesorteerd[3]]
  const altTeam1Gem = (altTeam1[0].elo_rating + altTeam1[1].elo_rating) / 2
  const altTeam2Gem = (altTeam2[0].elo_rating + altTeam2[1].elo_rating) / 2

  if (Math.abs(altTeam1Gem - altTeam2Gem) < Math.abs(team1Gem - team2Gem)) {
    return { team1: altTeam1, team2: altTeam2 }
  }

  return { team1, team2 }
}

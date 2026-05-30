const K_FACTOR = 32

function verwachtResultaat(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

export function berekenNieuweElo(
  spelerRating: number,
  tegenstaderRating: number,
  gewonnen: boolean
): number {
  const verwacht = verwachtResultaat(spelerRating, tegenstaderRating)
  const werkelijk = gewonnen ? 1 : 0
  return Math.round(spelerRating + K_FACTOR * (werkelijk - verwacht))
}

export function berekenTeamEloNaWedstrijd(
  team1: [number, number],
  team2: [number, number],
  team1Gewonnen: boolean
): { team1: [number, number]; team2: [number, number] } {
  const team1Gem = (team1[0] + team1[1]) / 2
  const team2Gem = (team2[0] + team2[1]) / 2

  return {
    team1: [
      berekenNieuweElo(team1[0], team2Gem, team1Gewonnen),
      berekenNieuweElo(team1[1], team2Gem, team1Gewonnen),
    ],
    team2: [
      berekenNieuweElo(team2[0], team1Gem, !team1Gewonnen),
      berekenNieuweElo(team2[1], team1Gem, !team1Gewonnen),
    ],
  }
}

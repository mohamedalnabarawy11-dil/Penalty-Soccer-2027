import {
  ACHIEVEMENTS,
  EGYPTIAN_CLUBS,
  getSeasonRewardForRank,
  SEASON_LENGTH,
} from '../data/customization';
import {
  ClubStandingRow,
  LeagueSeasonState,
  SaveData,
} from '../types/game';

const STORAGE_KEY = 'penalty_soccer_2627_save_v1';

export function createInitialStandings(): ClubStandingRow[] {
  return EGYPTIAN_CLUBS.map((club) => ({
    clubId: club.id,
    played: 0,
    won: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));
}

export function generateRoundRobinSchedule(): [string, string][][] {
  const ids = EGYPTIAN_CLUBS.map((c) => c.id);
  // Shuffle order each season so fixture sequence feels fresh every season
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const n = ids.length; // 18 clubs
  const roundsCount = n - 1; // 17 rounds
  const half = n / 2; // 9 matches per round
  const rounds: [string, string][][] = [];

  const fixed = ids[0];
  const rotating = ids.slice(1); // 17 clubs

  for (let r = 0; r < roundsCount; r++) {
    const roundMatches: [string, string][] = [];
    const firstOpponent = rotating[0];
    roundMatches.push(
      r % 2 === 0 ? [fixed, firstOpponent] : [firstOpponent, fixed]
    );

    for (let i = 1; i < half; i++) {
      const teamA = rotating[i];
      const teamB = rotating[rotating.length - i];
      roundMatches.push((r + i) % 2 === 0 ? [teamA, teamB] : [teamB, teamA]);
    }

    rounds.push(roundMatches);

    // Rotate clockwise: move last element to front
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  return rounds;
}

export function createInitialLeagueState(seasonNumber = 1): LeagueSeasonState {
  return {
    seasonNumber,
    matchesPlayed: 0,
    seasonLength: SEASON_LENGTH,
    schedule: generateRoundRobinSchedule(),
    standings: createInitialStandings(),
    pendingSeasonReward: null,
  };
}

export function getScheduledOpponent(
  league: LeagueSeasonState,
  playerClubId: string
): string {
  const roundIdx =
    league.matchesPlayed >= league.seasonLength ? 0 : league.matchesPlayed;
  const roundFixtures = league.schedule?.[roundIdx] || [];
  const match = roundFixtures.find(
    ([a, b]) => a === playerClubId || b === playerClubId
  );
  if (match) {
    return match[0] === playerClubId ? match[1] : match[0];
  }
  const fallback = EGYPTIAN_CLUBS.find((c) => c.id !== playerClubId);
  return fallback ? fallback.id : EGYPTIAN_CLUBS[0].id;
}

export function sortStandings(rows: ClubStandingRow[]): ClubStandingRow[] {
  const clubMap = new Map(EGYPTIAN_CLUBS.map((c) => [c.id, c]));
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    const ratA = clubMap.get(a.clubId)?.rating ?? 60;
    const ratB = clubMap.get(b.clubId)?.rating ?? 60;
    return ratB - ratA;
  });
}

export function advanceLeagueMatchday(
  league: LeagueSeasonState,
  playerClubId: string,
  opponentClubId: string,
  playerScore: number,
  aiScore: number,
  playerWon: boolean
): { nextLeague: LeagueSeasonState; seasonBonusCoins: number } {
  const baseLeague =
    league.matchesPlayed >= league.seasonLength
      ? createInitialLeagueState(league.seasonNumber + 1)
      : league;

  const clubMap = new Map(EGYPTIAN_CLUBS.map((c) => [c.id, c]));
  const rows = baseLeague.standings.map((r) => ({ ...r }));
  const rowMap = new Map(rows.map((r) => [r.clubId, r]));

  // 1. Record Player vs Scheduled Opponent real shootout score
  const pRow = rowMap.get(playerClubId);
  const oRow = rowMap.get(opponentClubId);
  if (pRow && oRow) {
    pRow.played += 1;
    oRow.played += 1;
    pRow.goalsFor += playerScore;
    pRow.goalsAgainst += aiScore;
    oRow.goalsFor += aiScore;
    oRow.goalsAgainst += playerScore;
    if (playerWon) {
      pRow.won += 1;
      pRow.points += 3;
      oRow.lost += 1;
    } else {
      oRow.won += 1;
      oRow.points += 3;
      pRow.lost += 1;
    }
  }

  // 2. Simulate the exact remaining 8 matches in this round's round-robin schedule
  const roundFixtures = baseLeague.schedule?.[baseLeague.matchesPlayed] || [];
  const otherMatches = roundFixtures.filter(
    ([a, b]) =>
      a !== playerClubId &&
      b !== playerClubId &&
      a !== opponentClubId &&
      b !== opponentClubId
  );

  // Fallback pair list if any club mismatch occurred
  const pairsToSimulate: [string, string][] =
    otherMatches.length > 0
      ? otherMatches
      : (() => {
          const rem = EGYPTIAN_CLUBS.map((c) => c.id).filter(
            (id) => id !== playerClubId && id !== opponentClubId
          );
          const list: [string, string][] = [];
          for (let i = 0; i + 1 < rem.length; i += 2) {
            list.push([rem[i], rem[i + 1]]);
          }
          return list;
        })();

  for (const [idA, idB] of pairsToSimulate) {
    const rowA = rowMap.get(idA);
    const rowB = rowMap.get(idB);
    const clubA = clubMap.get(idA);
    const clubB = clubMap.get(idB);
    if (!rowA || !rowB || !clubA || !clubB) continue;

    const scoreA = clubA.rating + (Math.random() - 0.5) * 26;
    const scoreB = clubB.rating + (Math.random() - 0.5) * 26;
    const aWins = scoreA >= scoreB;

    const winnerGoals = 4 + Math.floor(Math.random() * 2);
    const loserGoals = Math.max(
      2,
      winnerGoals - 1 - Math.floor(Math.random() * 2)
    );

    rowA.played += 1;
    rowB.played += 1;
    if (aWins) {
      rowA.won += 1;
      rowA.points += 3;
      rowA.goalsFor += winnerGoals;
      rowA.goalsAgainst += loserGoals;
      rowB.lost += 1;
      rowB.goalsFor += loserGoals;
      rowB.goalsAgainst += winnerGoals;
    } else {
      rowB.won += 1;
      rowB.points += 3;
      rowB.goalsFor += winnerGoals;
      rowB.goalsAgainst += loserGoals;
      rowA.lost += 1;
      rowA.goalsFor += loserGoals;
      rowA.goalsAgainst += winnerGoals;
    }
  }

  const sorted = sortStandings(rows);
  const nextMatchesPlayed = baseLeague.matchesPlayed + 1;
  let pendingSeasonReward = baseLeague.pendingSeasonReward;
  let seasonBonusCoins = 0;

  if (nextMatchesPlayed >= baseLeague.seasonLength) {
    const idx = sorted.findIndex((r) => r.clubId === playerClubId);
    const rank = idx >= 0 ? idx + 1 : sorted.length;
    seasonBonusCoins = getSeasonRewardForRank(rank);
    pendingSeasonReward = {
      seasonNumber: baseLeague.seasonNumber,
      rank,
      coins: seasonBonusCoins,
    };
  }

  return {
    nextLeague: {
      ...baseLeague,
      matchesPlayed: nextMatchesPlayed,
      standings: sorted,
      pendingSeasonReward,
    },
    seasonBonusCoins,
  };
}

export const DEFAULT_SAVE: SaveData = {
  coins: 120,
  totalGoals: 0,
  totalSaves: 0,
  matchesWon: 0,
  matchesPlayed: 0,
  bestStreak: 0,
  unlockedClubs: [],
  selectedClubId: '',
  unlockedKits: ['black-gold'],
  unlockedBalls: ['classic-star'],
  selectedKitId: 'black-gold',
  selectedBallId: 'classic-star',
  unlockedAchievements: [],
  league: createInitialLeagueState(1),
  muted: false,
  musicEnabled: true,
  language: 'ar',
  difficulty: 'pro',
};

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE, league: createInitialLeagueState(1) };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const validLeague =
      parsed.league &&
      Array.isArray(parsed.league.standings) &&
      parsed.league.standings.length === EGYPTIAN_CLUBS.length &&
      Array.isArray(parsed.league.schedule) &&
      parsed.league.schedule.length === SEASON_LENGTH &&
      parsed.league.seasonLength === SEASON_LENGTH;

    return {
      ...DEFAULT_SAVE,
      ...parsed,
      unlockedClubs: Array.isArray(parsed.unlockedClubs)
        ? parsed.unlockedClubs
        : DEFAULT_SAVE.unlockedClubs,
      selectedClubId:
        typeof parsed.selectedClubId === 'string'
          ? parsed.selectedClubId
          : DEFAULT_SAVE.selectedClubId,
      unlockedKits: Array.isArray(parsed.unlockedKits)
        ? parsed.unlockedKits
        : DEFAULT_SAVE.unlockedKits,
      unlockedBalls: Array.isArray(parsed.unlockedBalls)
        ? parsed.unlockedBalls
        : DEFAULT_SAVE.unlockedBalls,
      unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
        ? parsed.unlockedAchievements
        : DEFAULT_SAVE.unlockedAchievements,
      league: validLeague ? parsed.league! : createInitialLeagueState(1),
    };
  } catch {
    return { ...DEFAULT_SAVE, league: createInitialLeagueState(1) };
  }
}

export function writeSaveData(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function evaluateAchievements(data: SaveData): {
  updated: SaveData;
  newlyUnlocked: string[];
} {
  const newlyUnlocked: string[] = [];
  let coinsBonus = 0;
  const set = new Set(data.unlockedAchievements);

  const check = (id: string, condition: boolean) => {
    if (condition && !set.has(id)) {
      set.add(id);
      newlyUnlocked.push(id);
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) coinsBonus += def.reward;
    }
  };

  check('first-goal', data.totalGoals >= 1);
  check('clean-gloves', data.totalSaves >= 5);
  check('champion-win', data.matchesWon >= 3);
  check('streak-5', data.bestStreak >= 5);
  check('hard-master', data.totalGoals >= 15);

  if (newlyUnlocked.length === 0) {
    return { updated: data, newlyUnlocked };
  }

  const updated: SaveData = {
    ...data,
    coins: data.coins + coinsBonus,
    unlockedAchievements: Array.from(set),
  };
  writeSaveData(updated);
  return { updated, newlyUnlocked };
}

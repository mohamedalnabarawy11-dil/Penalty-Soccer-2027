export type Language = 'ar' | 'en';
export type Difficulty = 'easy' | 'pro' | 'hard';
export type GameMode = 'shootout' | 'streak';
export type TurnRole = 'shoot' | 'save';

export type ScreenView = 'splash' | 'menu' | 'locker' | 'playing';

export type DiveDirection =
  | 'left-high'
  | 'left-low'
  | 'center'
  | 'right-low'
  | 'right-high';

export type ShotOutcome =
  | 'goal'
  | 'saved'
  | 'missed'
  | 'woodwork';

export interface ClubStar {
  nameAr: string;
  nameEn: string;
  number: number;
}

export interface EgyptianClub {
  id: string;
  nameAr: string;
  nameEn: string;
  shortAr: string;
  shortEn: string;
  primary: string;
  secondary: string;
  shorts: string;
  socks: string;
  gkPrimary: string;
  gkSecondary: string;
  accent: string;
  price: number;
  tier: 'elite' | 'pro' | 'starter';
  rating: number;
  stars: ClubStar[];
}

export interface KitOption {
  id: string;
  nameAr: string;
  nameEn: string;
  primary: string;
  secondary: string;
  shorts: string;
  socks: string;
  accent: string;
  price: number;
}

export interface BallOption {
  id: string;
  nameAr: string;
  nameEn: string;
  baseColor: string;
  panelColor: string;
  accentColor: string;
  price: number;
}

export interface AchievementDef {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  reward: number;
}

export interface ClubStandingRow {
  clubId: string;
  played: number;
  won: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface SeasonRewardRecord {
  seasonNumber: number;
  rank: number;
  coins: number;
}

export interface LeagueSeasonState {
  seasonNumber: number;
  matchesPlayed: number;
  seasonLength: number;
  schedule: [string, string][][];
  standings: ClubStandingRow[];
  pendingSeasonReward: SeasonRewardRecord | null;
}

export interface SaveData {
  coins: number;
  totalGoals: number;
  totalSaves: number;
  matchesWon: number;
  matchesPlayed: number;
  bestStreak: number;
  unlockedClubs: string[];
  selectedClubId: string;
  unlockedKits: string[];
  unlockedBalls: string[];
  selectedKitId: string;
  selectedBallId: string;
  unlockedAchievements: string[];
  league: LeagueSeasonState;
  muted: boolean;
  musicEnabled: boolean;
  language: Language;
  difficulty: Difficulty;
}

export interface KickHistoryItem {
  role: TurnRole;
  outcome: ShotOutcome;
}

export interface MatchHudState {
  mode: GameMode;
  role: TurnRole;
  round: number;
  playerScore: number;
  aiScore: number;
  playerHistory: ('goal' | 'miss' | 'pending')[];
  aiHistory: ('goal' | 'miss' | 'pending')[];
  streakCount: number;
  banner: {
    text: string;
    subtext: string;
    tone: 'gold' | 'emerald' | 'blue' | 'red' | 'slate';
  } | null;
  phase:
    | 'turn_intro'
    | 'walk_up'
    | 'place_ball'
    | 'aiming'
    | 'charging'
    | 'running'
    | 'ball_flight'
    | 'result'
    | 'huddle'
    | 'fading'
    | 'match_over';
  power: number;
  isSuddenDeath: boolean;
  canControl: boolean;
  selectedDive: DiveDirection | null;
  matchWinner: 'player' | 'ai' | null;
  coinsEarnedThisMatch: number;
  winBonusAwarded: number;
  activeTakerName: string;
  activeTakerNumber: number;
  activeTakerSlot: number;
  isPlayerKickTurn: boolean;
  playerRating: number;
  opponentRating: number;
}

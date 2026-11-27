import { EGYPTIAN_CLUBS } from '../data/customization';
import {
  DiveDirection,
  EgyptianClub,
  GameMode,
  MatchHudState,
  ShotOutcome,
  TurnRole,
} from '../types/game';
import { soundEngine } from './sound';

export const GOAL_HALF_W = 3.66;
export const GOAL_H = 2.44;
export const GOAL_DEPTH = 1.85;
export const PENALTY_Z = 11.0;
export const BALL_RADIUS = 0.115;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface NetNode {
  baseX: number;
  baseY: number;
  baseZ: number;
  dispZ: number;
  velZ: number;
}

export interface CrowdDot {
  x: number;
  y: number;
  z: number;
  color: string;
  phase: number;
  row: number;
}

export interface FlashSpark {
  x: number;
  y: number;
  z: number;
  life: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class PenaltyEngine {
  // Match config & club strength
  public mode: GameMode = 'shootout';
  public playerClub: EgyptianClub = EGYPTIAN_CLUBS[EGYPTIAN_CLUBS.length - 1];
  public opponentClub: EgyptianClub = EGYPTIAN_CLUBS[0];
  public playerStrength = 0.2;
  public opponentStrength = 0.8;

  public role: TurnRole = 'shoot';
  public round = 1;
  public playerScore = 0;
  public aiScore = 0;
  public playerHistory: ('goal' | 'miss' | 'pending')[] = Array(5).fill(
    'pending'
  );
  public aiHistory: ('goal' | 'miss' | 'pending')[] = Array(5).fill('pending');
  public streakCount = 0;
  public coinsEarnedThisMatch = 0;
  public winBonusAwarded = 0;
  public isSuddenDeath = false;
  public matchWinner: 'player' | 'ai' | null = null;
  public paused = false;

  // Taker info
  public activeTakerName = '';
  public activeTakerNumber = 10;
  public activeTakerSlot = 1;
  public isPlayerKickTurn = false;
  private aiTeammateWaitingToRun = false;

  // Turn phase
  public phase: MatchHudState['phase'] = 'walk_up';
  private phaseTimer = 0;
  private fadeDir: 'out' | 'in' | 'none' = 'none';
  public curtainAlpha = 0;
  private pendingActionAfterFade: (() => void) | null = null;

  // Aiming & Power
  public aimX = 0; // -4.3 .. +4.3
  public aimY = 1.15; // 0.16 .. 3.05
  public joyX = 0;
  public joyY = 0;
  public dpadX = 0;
  public dpadY = 0;
  public power = 0.5;
  private powerRising = true;
  public isCharging = false;

  // Ball physics
  public ballPos: Vec3 = { x: 0, y: BALL_RADIUS, z: PENALTY_Z };
  public ballVel: Vec3 = { x: 0, y: 0, z: 0 };
  public ballSpin: Vec3 = { x: 0, y: 0, z: 0 };
  public ballRot: Vec3 = { x: 0, y: 0, z: 0 };
  public ballTrail: Vec3[] = [];
  public ballCarried = false;
  private shotResolved = false;
  private shotOutcome: ShotOutcome | null = null;
  private hitWoodworkThisShot = false;
  private hitGoalNetThisShot = false;

  // Striker animation state
  public strikerPos: Vec3 = { x: -0.55, y: 0, z: PENALTY_Z + 3.1 };
  public strikerProgress = 0; // 0..1 run-up, >1 follow-through
  public strikerKickCycle = 0;
  public strikerHasKicked = false;
  public strikerBend = 0; // 0..1 crouch when placing ball
  public strikerFacingDir = -1; // -1 facing goal (-z)
  private queuedShot = {
    tx: 0,
    ty: 1.1,
    power: 0.7,
    spinY: 0,
  };

  // Goalkeeper animation state
  public keeperPos: Vec3 = { x: 0, y: 0, z: 0.16 };
  public keeperBaseX = 0;
  public keeperDiveStartX = 0;
  public keeperDiveDir: DiveDirection | null = null;
  public preselectedDive: DiveDirection | null = null;
  public keeperDiveProgress = 0; // 0..1
  public keeperTarget: Vec3 = { x: 0, y: 0, z: 0.16 };
  public keeperIdlePhase = 0;
  private aiKeeperReactionDelay = 0.2;
  private aiKeeperReacted = false;
  private aiKeeperPlannedDive: DiveDirection = 'center';

  // Net mesh (15 cols x 7 rows)
  public netCols = 15;
  public netRows = 7;
  public netNodes: NetNode[] = [];

  // Camera & FX (Unified main stadium view facing the goal!)
  public cameraPos: Vec3 = { x: 0, y: 2.22, z: 16.4 };
  public cameraLook: Vec3 = { x: 0, y: 1.05, z: 0 };
  public shakeTime = 0;
  public shakeIntensity = 0;
  public crowdExcitement = 0;
  public crowdTime = 0;
  public crowdDots: CrowdDot[] = [];
  public flashes: FlashSpark[] = [];
  public particles: Particle[] = [];

  // Banner & callbacks
  public banner: MatchHudState['banner'] = null;
  private onMatchRecordCallback?: (
    outcome: ShotOutcome,
    role: TurnRole,
    matchEnded: boolean,
    winner: 'player' | 'ai' | null,
    streak: number
  ) => number;
  private onHudChange?: (hud: MatchHudState) => void;
  private lang: 'ar' | 'en' = 'ar';
  private texts: Record<string, string> = {};

  constructor() {
    this.initNet();
    this.initCrowd();
    this.resetCamera();
  }

  public setLocale(lang: 'ar' | 'en', texts: Record<string, string>) {
    this.lang = lang;
    this.texts = texts;
  }

  public setCallbacks(
    onHudChange: (hud: MatchHudState) => void,
    onMatchRecord: (
      outcome: ShotOutcome,
      role: TurnRole,
      matchEnded: boolean,
      winner: 'player' | 'ai' | null,
      streak: number
    ) => number
  ) {
    this.onHudChange = onHudChange;
    this.onMatchRecordCallback = onMatchRecord;
  }

  private initNet() {
    this.netNodes = [];
    for (let r = 0; r < this.netRows; r++) {
      const y = (r / (this.netRows - 1)) * GOAL_H;
      for (let c = 0; c < this.netCols; c++) {
        const x = -GOAL_HALF_W + (c / (this.netCols - 1)) * (GOAL_HALF_W * 2);
        this.netNodes.push({
          baseX: x,
          baseY: y,
          baseZ: -GOAL_DEPTH,
          dispZ: 0,
          velZ: 0,
        });
      }
    }
  }

  private initCrowd() {
    this.crowdDots = [];
    const palette = [
      '#e2e8f0',
      '#d4af37',
      '#94a3b8',
      '#ef4444',
      '#22c55e',
      '#f8fafc',
      '#3b82f6',
    ];
    for (let row = 0; row < 6; row++) {
      const y = 1.6 + row * 0.72;
      const z = -6.2 - row * 1.15;
      const count = 48 + row * 6;
      for (let i = 0; i < count; i++) {
        const x = -18 + (i / (count - 1)) * 36 + (Math.random() - 0.5) * 0.4;
        this.crowdDots.push({
          x,
          y,
          z,
          color: palette[Math.floor(Math.random() * palette.length)],
          phase: Math.random() * Math.PI * 2,
          row,
        });
      }
    }
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        const y = 1.6 + row * 0.7;
        const x = side * (12.5 + row * 1.1);
        for (let i = 0; i < 18; i++) {
          const z = -5 + i * 1.25;
          this.crowdDots.push({
            x,
            y,
            z,
            color: palette[Math.floor(Math.random() * palette.length)],
            phase: Math.random() * Math.PI * 2,
            row,
          });
        }
      }
    }
  }

  public startNewMatch(
    mode: GameMode,
    playerClub: EgyptianClub,
    opponentClub: EgyptianClub
  ) {
    this.mode = mode;
    this.playerClub = playerClub;
    this.opponentClub = opponentClub;
    this.playerStrength = Math.max(
      0.08,
      Math.min(1, (playerClub.rating - 60) / 35)
    );
    this.opponentStrength = Math.max(
      0.08,
      Math.min(1, (opponentClub.rating - 60) / 35)
    );

    this.role = 'shoot';
    this.round = 1;
    this.playerScore = 0;
    this.aiScore = 0;
    this.playerHistory = Array(5).fill('pending');
    this.aiHistory = Array(5).fill('pending');
    this.streakCount = 0;
    this.coinsEarnedThisMatch = 0;
    this.winBonusAwarded = 0;
    this.isSuddenDeath = false;
    this.matchWinner = null;
    this.paused = false;
    this.curtainAlpha = 1;
    this.fadeDir = 'in';
    this.resetTurnEntities();
    this.emitHud();
    soundEngine.startStadiumAmbience();
    soundEngine.playWhistle();
  }

  private resolveTurnTaker() {
    const slot = ((this.round - 1) % 5) + 1;
    this.activeTakerSlot = slot;

    if (this.role === 'shoot') {
      if (this.mode === 'streak' || this.round >= 5) {
        // 5th taker (or sudden death / streak) is ALWAYS the Player!
        this.isPlayerKickTurn = true;
        this.activeTakerName =
          this.texts.fifthTakerYou ||
          (this.lang === 'ar' ? 'أنت (المسدد 5)' : 'You (Taker #5)');
        this.activeTakerNumber = 10;
      } else {
        // Rounds 1..4: Club's 4 top AI stars take the kicks in order
        this.isPlayerKickTurn = false;
        const star =
          this.playerClub.stars[(slot - 1) % this.playerClub.stars.length];
        this.activeTakerName =
          this.lang === 'ar' ? star.nameAr : star.nameEn;
        this.activeTakerNumber = star.number;
      }
    } else {
      this.isPlayerKickTurn = false;
      if (slot <= 4) {
        const star =
          this.opponentClub.stars[(slot - 1) % this.opponentClub.stars.length];
        this.activeTakerName =
          this.lang === 'ar' ? star.nameAr : star.nameEn;
        this.activeTakerNumber = star.number;
      } else {
        this.activeTakerName =
          this.lang === 'ar'
            ? `قائد ${this.opponentClub.shortAr}`
            : `${this.opponentClub.shortEn} Captain`;
        this.activeTakerNumber = 10;
      }
    }
  }

  private resetTurnEntities() {
    this.resolveTurnTaker();
    this.phaseTimer = 0;
    this.banner = null;
    this.isCharging = false;
    this.aiTeammateWaitingToRun = false;
    this.power = 0.25;
    this.powerRising = true;
    this.aimX = 0;
    this.aimY = 1.15;
    this.joyX = 0;
    this.joyY = 0;
    this.dpadX = 0;
    this.dpadY = 0;

    this.ballVel = { x: 0, y: 0, z: 0 };
    this.ballSpin = { x: 0, y: 0, z: 0 };
    this.ballTrail = [];
    this.shotResolved = false;
    this.shotOutcome = null;
    this.hitWoodworkThisShot = false;
    this.hitGoalNetThisShot = false;

    this.strikerProgress = 0;
    this.strikerKickCycle = 0;
    this.strikerHasKicked = false;
    this.strikerBend = 0;
    this.strikerFacingDir = -1;

    this.keeperBaseX = 0;
    this.keeperDiveStartX = 0;
    this.keeperPos = { x: 0, y: 0, z: 0.16 };
    this.keeperDiveDir = null;
    this.preselectedDive = null;
    this.keeperDiveProgress = 0;
    this.keeperTarget = { x: 0, y: 0, z: 0.16 };
    this.aiKeeperReacted = false;

    for (const n of this.netNodes) {
      n.dispZ = 0;
      n.velZ = 0;
    }

    this.resetCamera();

    const activeClub =
      this.role === 'shoot' ? this.playerClub : this.opponentClub;
    const clubName =
      this.lang === 'ar' ? activeClub.nameAr : activeClub.nameEn;
    const turnClubPrefix =
      this.texts.turnNowClub ||
      (this.lang === 'ar' ? 'الدور الآن على فريق' : 'Now Shooting:');

    if (this.role === 'shoot') {
      this.ballCarried = true;
      this.strikerPos = { x: -1.75, y: 0, z: PENALTY_Z + 4.1 };
      this.updateCarriedBallPos();
    } else {
      this.ballCarried = false;
      this.ballPos = { x: 0, y: BALL_RADIUS, z: PENALTY_Z };
      this.strikerPos = { x: -0.55, y: 0, z: PENALTY_Z + 3.1 };
      this.prepareOpponentShot();
    }

    const isMyTeam = this.role === 'shoot';
    const teamTag = isMyTeam
      ? this.lang === 'ar'
        ? '(فريقك)'
        : '(Your Team)'
      : this.lang === 'ar'
      ? '(الخصم)'
      : '(Opponent)';

    // Dedicated readable pause (~2.1s) before every kick so user sees which club shoots now
    this.phase = 'turn_intro';
    this.phaseTimer = 0;
    this.banner = {
      text: `${turnClubPrefix} ${clubName} ${teamTag}`,
      subtext:
        this.role === 'shoot'
          ? this.isPlayerKickTurn
            ? this.texts.yourTurnFifth ||
              (this.lang === 'ar'
                ? 'المسدد الخامس — دورك الآن!'
                : '5th Taker — Your Turn!')
            : `#${this.activeTakerNumber} ${this.activeTakerName} (${this.activeTakerSlot}/5)`
          : this.lang === 'ar'
          ? `#${this.activeTakerNumber} ${this.activeTakerName} يستعد للتسديد · استعد للتصدي`
          : `#${this.activeTakerNumber} ${this.activeTakerName} stepping up · Get ready to save`,
      tone: isMyTeam ? 'blue' : 'red',
    };
  }

  private updateCarriedBallPos() {
    this.ballPos = {
      x: this.strikerPos.x + 0.32,
      y: 0.94 - this.strikerBend * 0.5,
      z: this.strikerPos.z - 0.12,
    };
  }

  private resetCamera() {
    // Same main stadium camera facing the goal in BOTH shoot and save roles!
    this.cameraPos = { x: 0, y: 2.22, z: 16.4 };
    this.cameraLook = { x: 0, y: 1.05, z: 0 };
  }

  private prepareOpponentShot() {
    // Opponent shot precision & power scale strictly with opponent club rating!
    const s = this.opponentStrength; // ~0.08 .. 0.92
    const zones = [
      { x: -3.05, y: 0.52 },
      { x: -2.95, y: 1.88 },
      { x: 0, y: 1.62 },
      { x: 2.95, y: 1.88 },
      { x: 3.05, y: 0.52 },
      { x: -1.75, y: 0.65 },
      { x: 1.75, y: 0.65 },
    ];
    const pick = zones[Math.floor(Math.random() * zones.length)];
    const spread = 0.62 - s * 0.42; // weaker clubs 0.58, top clubs 0.23
    let tx = pick.x + (Math.random() - 0.5) * spread;
    let ty = Math.max(0.24, pick.y + (Math.random() - 0.5) * spread);

    // Lower-rated clubs have higher chance of dragging a penalty wide/high
    const missChance = Math.max(0.04, 0.22 - s * 0.18);
    if (Math.random() < missChance) {
      tx = (Math.random() < 0.5 ? -1 : 1) * (GOAL_HALF_W + 0.48);
      ty = 1.85;
    }

    const power = 0.52 + s * 0.26 + Math.random() * 0.11;
    const spinY = -tx * (1.2 + s * 1.4);
    this.queuedShot = { tx, ty, power, spinY };
  }

  private prepareAiTeammateShot() {
    // AI star teammate (Rounds 1..4) shoots based on player club's star strength
    const s = this.playerStrength;
    const zones = [
      { x: -2.95, y: 0.55 },
      { x: -2.85, y: 1.82 },
      { x: -1.6, y: 0.72 },
      { x: 1.6, y: 0.72 },
      { x: 2.85, y: 1.82 },
      { x: 2.95, y: 0.55 },
    ];
    const pick = zones[Math.floor(Math.random() * zones.length)];
    const spread = 0.52 - s * 0.32;
    let tx = pick.x + (Math.random() - 0.5) * spread;
    let ty = Math.max(0.24, pick.y + (Math.random() - 0.5) * spread);

    const missChance = Math.max(0.05, 0.18 - s * 0.12);
    if (Math.random() < missChance) {
      tx = (Math.random() < 0.5 ? -1 : 1) * (GOAL_HALF_W + 0.45);
      ty = 1.75;
    }

    const power = 0.58 + s * 0.22 + Math.random() * 0.08;
    const spinY = -tx * (1.4 + s * 1.1);
    this.queuedShot = { tx, ty, power, spinY };
    this.planAiKeeperDive(tx, ty);
  }

  public setJoystick(jx: number, jy: number) {
    this.joyX = Math.max(-1, Math.min(1, jx));
    this.joyY = Math.max(-1, Math.min(1, jy));
    if (
      this.role === 'shoot' &&
      this.isPlayerKickTurn &&
      (this.phase === 'aiming' || this.phase === 'charging')
    ) {
      this.aimX = this.joyX * 4.15;
      this.aimY = 1.25 - this.joyY * 1.15;
      this.aimY = Math.max(0.18, Math.min(3.1, this.aimY));
    }
  }

  public setDpadDirection(dx: number, dy: number) {
    this.dpadX = Math.max(-1, Math.min(1, dx));
    this.dpadY = Math.max(-1, Math.min(1, dy));
  }

  public nudgeAim(dx: number, dy: number) {
    if (
      this.role !== 'shoot' ||
      !this.isPlayerKickTurn ||
      (this.phase !== 'aiming' && this.phase !== 'charging')
    ) {
      return;
    }
    this.aimX = Math.max(-4.15, Math.min(4.15, this.aimX + dx));
    this.aimY = Math.max(0.18, Math.min(3.1, this.aimY + dy));
  }

  public moveKeeperLateral(dx: number) {
    if (this.role !== 'save' || this.paused) return;
    if (this.phase !== 'aiming' && this.phase !== 'running') return;
    if (this.keeperDiveDir) return;
    this.keeperBaseX = Math.max(-2.15, Math.min(2.15, this.keeperBaseX + dx));
    this.keeperPos.x = this.keeperBaseX;
  }

  public startCharge() {
    if (
      this.role !== 'shoot' ||
      !this.isPlayerKickTurn ||
      this.phase !== 'aiming' ||
      this.paused
    ) {
      return;
    }
    soundEngine.unlock();
    this.isCharging = true;
    this.phase = 'charging';
    this.power = 0.2;
    this.powerRising = true;
    this.emitHud();
  }

  public releaseCharge() {
    if (
      this.role !== 'shoot' ||
      !this.isPlayerKickTurn ||
      this.phase !== 'charging'
    ) {
      return;
    }
    this.isCharging = false;

    const spinY = -this.aimX * 1.9;
    this.queuedShot = {
      tx: this.aimX,
      ty: this.aimY,
      power: this.power,
      spinY,
    };

    this.planAiKeeperDive(this.aimX, this.aimY);

    this.phase = 'running';
    this.phaseTimer = 0;
    this.strikerProgress = 0;
    this.strikerHasKicked = false;
    this.emitHud();
  }

  private planAiKeeperDive(tx: number, ty: number) {
    // AI Keeper difficulty scales with opponent club rating!
    const s = this.opponentStrength; // 0.08..0.92
    const smartChance = 0.28 + s * 0.54; // ~0.32 for weak club, ~0.78 for Al Ahly/Zamalek
    const reaction = 0.28 - s * 0.2; // ~0.26s weak, ~0.09s top club
    this.aiKeeperReactionDelay = reaction;
    this.aiKeeperReacted = false;

    const allDirs: DiveDirection[] = [
      'left-high',
      'left-low',
      'center',
      'right-low',
      'right-high',
    ];

    if (Math.random() < smartChance) {
      if (tx < -1.1) {
        this.aiKeeperPlannedDive = ty > 1.35 ? 'left-high' : 'left-low';
      } else if (tx > 1.1) {
        this.aiKeeperPlannedDive = ty > 1.35 ? 'right-high' : 'right-low';
      } else {
        this.aiKeeperPlannedDive = 'center';
      }
    } else {
      this.aiKeeperPlannedDive =
        allDirs[Math.floor(Math.random() * allDirs.length)];
    }
  }

  public selectKeeperCorner(dir: DiveDirection) {
    if (this.role !== 'save' || this.paused) return;
    soundEngine.unlock();
    soundEngine.playClick();
    if (this.phase === 'aiming') {
      this.preselectedDive = dir;
      this.emitHud();
      return;
    }
    if (this.phase === 'running' || this.phase === 'ball_flight') {
      this.preselectedDive = dir;
      if (!this.keeperDiveDir) {
        this.applyKeeperDive(dir);
      }
      this.emitHud();
    }
  }

  public confirmKeeperReady() {
    if (this.role !== 'save' || this.phase !== 'aiming' || this.paused) return;
    soundEngine.unlock();
    soundEngine.playWhistle();
    this.phase = 'running';
    this.phaseTimer = 0;
    this.strikerProgress = 0;
    this.strikerHasKicked = false;
    this.emitHud();
  }

  public triggerKeeperDive(dir: DiveDirection) {
    if (this.role !== 'save' || this.paused) return;
    if (this.phase === 'aiming') {
      this.selectKeeperCorner(dir);
      return;
    }
    if (this.phase !== 'running' && this.phase !== 'ball_flight') {
      return;
    }
    if (this.keeperDiveDir) return;

    soundEngine.unlock();
    this.preselectedDive = dir;
    this.applyKeeperDive(dir);
    this.emitHud();
  }

  private applyKeeperDive(dir: DiveDirection) {
    this.keeperDiveDir = dir;
    this.keeperDiveProgress = 0;
    this.keeperDiveStartX = this.keeperPos.x;

    // Unified camera faces the goal (-z) in BOTH roles: screen-left is -x, screen-right is +x!
    switch (dir) {
      case 'left-high':
        this.keeperTarget = { x: -2.75, y: 1.58, z: 0.18 };
        break;
      case 'left-low':
        this.keeperTarget = { x: -2.85, y: 0.45, z: 0.18 };
        break;
      case 'center':
        this.keeperTarget = { x: this.keeperBaseX * 0.35, y: 1.15, z: 0.25 };
        break;
      case 'right-low':
        this.keeperTarget = { x: 2.85, y: 0.45, z: 0.18 };
        break;
      case 'right-high':
        this.keeperTarget = { x: 2.75, y: 1.58, z: 0.18 };
        break;
    }
  }

  private launchBall() {
    const { tx, ty, power, spinY } = this.queuedShot;
    this.strikerHasKicked = true;

    const speed = 21 + power * 14.5;
    let targetX = tx;
    let targetY = ty;

    if (power > 0.85) {
      const over = (power - 0.85) / 0.15;
      targetY += over * 1.55;
      targetX += (Math.random() - 0.5) * over * 1.1;
    }

    const dx = targetX - this.ballPos.x;
    const dy = targetY - this.ballPos.y;
    const dz = 0 - this.ballPos.z;
    const dist = Math.hypot(dx, dy, dz);
    const tFlight = dist / speed;

    const g = 9.81;
    const magnusFactor = 0.048;
    const curveShift =
      0.5 * magnusFactor * spinY * (-dz / tFlight) * tFlight * tFlight;

    this.ballVel = {
      x: (dx - curveShift) / tFlight,
      y: dy / tFlight + 0.5 * g * tFlight,
      z: dz / tFlight,
    };

    this.ballSpin = {
      x: -14 - power * 10,
      y: spinY * 3.2,
      z: -this.ballVel.x * 1.4,
    };

    this.phase = 'ball_flight';
    this.phaseTimer = 0;
    soundEngine.playKick(power);

    if (
      this.role === 'save' &&
      this.preselectedDive &&
      !this.keeperDiveDir
    ) {
      this.applyKeeperDive(this.preselectedDive);
    }

    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: this.ballPos.x + (Math.random() - 0.5) * 0.25,
        y: 0.04,
        z: this.ballPos.z,
        vx: (Math.random() - 0.5) * 2.2,
        vy: 1.0 + Math.random() * 1.8,
        vz: (Math.random() - 0.5) * 1.5,
        color: '#2e7d32',
        size: 3 + Math.random() * 3,
        life: 0,
        maxLife: 0.45,
      });
    }
  }

  public getTrajectoryPreview(): Vec3[] {
    if (
      this.role !== 'shoot' ||
      !this.isPlayerKickTurn ||
      (this.phase !== 'aiming' && this.phase !== 'charging')
    ) {
      return [];
    }

    const power = this.phase === 'charging' ? this.power : 0.7;
    const spinY = -this.aimX * 1.9;
    const speed = 21 + power * 14.5;

    let targetX = this.aimX;
    let targetY = this.aimY;
    if (power > 0.85) {
      const over = (power - 0.85) / 0.15;
      targetY += over * 1.55;
    }

    const dx = targetX - this.ballPos.x;
    const dy = targetY - this.ballPos.y;
    const dz = -PENALTY_Z;
    const dist = Math.hypot(dx, dy, dz);
    const tFlight = dist / speed;
    const g = 9.81;
    const magnusFactor = 0.048;
    const curveShift =
      0.5 * magnusFactor * spinY * (-dz / tFlight) * tFlight * tFlight;

    let px = this.ballPos.x;
    let py = this.ballPos.y;
    let pz = this.ballPos.z;
    let vx = (dx - curveShift) / tFlight;
    let vy = dy / tFlight + 0.5 * g * tFlight;
    const vz = dz / tFlight;

    const pts: Vec3[] = [{ x: px, y: py, z: pz }];
    const steps = 16;
    const dt = tFlight / steps;
    for (let i = 0; i < steps; i++) {
      vx += magnusFactor * spinY * -vz * dt;
      vy -= g * dt;
      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;
      pts.push({ x: px, y: Math.max(BALL_RADIUS, py), z: pz });
    }
    return pts;
  }

  public update(dt: number) {
    if (this.paused) return;
    const clampedDt = Math.min(dt, 0.05);

    this.crowdTime += clampedDt;
    this.keeperIdlePhase += clampedDt * 5.2;
    this.crowdExcitement = Math.max(0, this.crowdExcitement - clampedDt * 0.45);

    if (Math.random() < clampedDt * 2.2) {
      const dot =
        this.crowdDots[Math.floor(Math.random() * this.crowdDots.length)];
      if (dot) {
        this.flashes.push({ x: dot.x, y: dot.y, z: dot.z, life: 0.18 });
      }
    }
    this.flashes = this.flashes
      .map((f) => ({ ...f, life: f.life - clampedDt }))
      .filter((f) => f.life > 0);

    this.particles = this.particles
      .map((p) => ({
        ...p,
        x: p.x + p.vx * clampedDt,
        y: Math.max(0.02, p.y + p.vy * clampedDt),
        z: p.z + p.vz * clampedDt,
        vy: p.vy - 9.8 * clampedDt,
        life: p.life + clampedDt,
      }))
      .filter((p) => p.life < p.maxLife);

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - clampedDt);
    }

    for (const node of this.netNodes) {
      const spring = -28 * node.dispZ - 6.2 * node.velZ;
      node.velZ += spring * clampedDt;
      node.dispZ += node.velZ * clampedDt;
    }

    // Fade-to-black curtain transition
    if (this.fadeDir === 'out') {
      this.curtainAlpha = Math.min(1, this.curtainAlpha + clampedDt * 3.1);
      if (this.curtainAlpha >= 1) {
        this.fadeDir = 'in';
        if (this.pendingActionAfterFade) {
          this.pendingActionAfterFade();
          this.pendingActionAfterFade = null;
        }
      }
    } else if (this.fadeDir === 'in') {
      this.curtainAlpha = Math.max(0, this.curtainAlpha - clampedDt * 3.1);
      if (this.curtainAlpha <= 0) {
        this.fadeDir = 'none';
      }
    }

    // Phase 0: Readable Turn Intro Pause (~2.1s) announcing which club shoots now
    if (this.phase === 'turn_intro') {
      this.phaseTimer += clampedDt;
      if (this.phaseTimer >= 2.1) {
        this.banner = null;
        this.phaseTimer = 0;
        this.phase = this.role === 'shoot' ? 'walk_up' : 'aiming';
        this.emitHud();
      }
      return;
    }

    // Phase 1: Automatic Walk-up carrying the ball toward the penalty spot
    if (this.phase === 'walk_up') {
      const walkDuration = this.isPlayerKickTurn ? 1.35 : 0.72;
      this.phaseTimer += clampedDt;
      const t = Math.min(1, this.phaseTimer / walkDuration);
      this.strikerKickCycle += clampedDt * 7.8;

      const startX = -1.75;
      const startZ = PENALTY_Z + 4.1;
      const spotApproachX = -0.22;
      const spotApproachZ = PENALTY_Z + 0.36;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      this.strikerPos = {
        x: startX + (spotApproachX - startX) * ease,
        y: 0,
        z: startZ + (spotApproachZ - startZ) * ease,
      };
      this.ballCarried = true;
      this.strikerBend = 0;
      this.updateCarriedBallPos();

      if (t >= 1) {
        this.phase = 'place_ball';
        this.phaseTimer = 0;
        this.banner = null;
        this.emitHud();
      }
    }

    // Phase 2: Bend down, set ball on penalty spot, then step back to kick stance
    if (this.phase === 'place_ball') {
      const placeDuration = this.isPlayerKickTurn ? 0.85 : 0.45;
      this.phaseTimer += clampedDt;
      const t = Math.min(1, this.phaseTimer / placeDuration);

      if (t < 0.48) {
        // Crouch down & lower ball onto the spot
        const k = t / 0.48;
        this.strikerBend = Math.sin(k * Math.PI * 0.5);
        this.ballCarried = true;
        this.ballPos = {
          x: -0.08 * (1 - k),
          y: 0.75 * (1 - k) + BALL_RADIUS * k,
          z: PENALTY_Z + 0.08 * (1 - k),
        };
      } else {
        // Ball placed cleanly on spot; striker rises & steps back to kick stance
        const k = (t - 0.48) / 0.52;
        this.ballCarried = false;
        this.ballPos = { x: 0, y: BALL_RADIUS, z: PENALTY_Z };
        this.strikerBend = (1 - k) * 0.8;
        this.strikerKickCycle += clampedDt * 6.5;

        const startX = -0.22;
        const startZ = PENALTY_Z + 0.36;
        const endX = -0.55;
        const endZ = PENALTY_Z + 3.1;
        this.strikerPos = {
          x: startX + (endX - startX) * k,
          y: 0,
          z: startZ + (endZ - startZ) * k,
        };
      }

      if (t >= 1) {
        this.strikerBend = 0;
        this.ballCarried = false;
        this.ballPos = { x: 0, y: BALL_RADIUS, z: PENALTY_Z };
        this.strikerPos = { x: -0.55, y: 0, z: PENALTY_Z + 3.1 };
        this.strikerKickCycle = 0;
        this.phase = 'aiming';
        this.phaseTimer = 0;

        if (!this.isPlayerKickTurn) {
          this.prepareAiTeammateShot();
          this.aiTeammateWaitingToRun = true;
        }
        this.emitHud();
      }
    }

    // D-Pad gliding (Aiming in Shoot mode, OR Lateral positioning in Save mode)
    if (
      this.role === 'shoot' &&
      this.isPlayerKickTurn &&
      (this.phase === 'aiming' || this.phase === 'charging') &&
      (this.dpadX !== 0 || this.dpadY !== 0)
    ) {
      this.aimX = Math.max(
        -4.15,
        Math.min(4.15, this.aimX + this.dpadX * 5.2 * clampedDt)
      );
      this.aimY = Math.max(
        0.18,
        Math.min(3.1, this.aimY - this.dpadY * 3.4 * clampedDt)
      );
    } else if (
      this.role === 'save' &&
      this.phase === 'aiming' &&
      this.dpadX !== 0
    ) {
      this.moveKeeperLateral(this.dpadX * 3.2 * clampedDt);
    }

    // AI star teammate brief poise before running up
    if (
      this.phase === 'aiming' &&
      this.role === 'shoot' &&
      !this.isPlayerKickTurn &&
      this.aiTeammateWaitingToRun
    ) {
      this.phaseTimer += clampedDt;
      if (this.phaseTimer >= 0.32) {
        this.aiTeammateWaitingToRun = false;
        this.phase = 'running';
        this.phaseTimer = 0;
        this.strikerProgress = 0;
        this.strikerHasKicked = false;
        this.emitHud();
      }
    }

    // In Save mode, 'aiming' waits for the player to position/choose corner & tap Ready
    if (this.phase === 'aiming' && this.role === 'save') {
      this.phaseTimer += clampedDt;
    }

    if (this.phase === 'charging') {
      const rate = 0.92;
      if (this.powerRising) {
        this.power += clampedDt * rate;
        if (this.power >= 1) {
          this.power = 1;
          this.powerRising = false;
        }
      } else {
        this.power -= clampedDt * rate;
        if (this.power <= 0.2) {
          this.power = 0.2;
          this.powerRising = true;
        }
      }
      this.emitHud();
    }

    if (this.phase === 'running') {
      const runDuration = 0.68;
      this.phaseTimer += clampedDt;
      this.strikerProgress = Math.min(1, this.phaseTimer / runDuration);
      this.strikerKickCycle += clampedDt * 12;

      const startX = -0.55;
      const startZ = PENALTY_Z + 3.1;
      const endX = -0.26;
      const endZ = PENALTY_Z + 0.36;
      const ease = 1 - Math.pow(1 - this.strikerProgress, 2);
      this.strikerPos = {
        x: startX + (endX - startX) * ease,
        y: 0,
        z: startZ + (endZ - startZ) * ease,
      };

      if (this.strikerProgress >= 1 && !this.strikerHasKicked) {
        this.launchBall();
        this.emitHud();
      }
    }

    if (this.phase === 'ball_flight') {
      this.phaseTimer += clampedDt;
      this.strikerProgress = Math.min(
        1.45,
        this.strikerProgress + clampedDt * 1.4
      );

      // AI keeper reaction in shoot mode
      if (
        this.role === 'shoot' &&
        !this.aiKeeperReacted &&
        this.phaseTimer >= this.aiKeeperReactionDelay
      ) {
        this.aiKeeperReacted = true;
        this.applyKeeperDive(this.aiKeeperPlannedDive);
      }

      // Advance keeper dive animation smoothly from keeperDiveStartX
      if (this.keeperDiveDir) {
        this.keeperDiveProgress = Math.min(
          1,
          this.keeperDiveProgress + clampedDt * 2.45
        );
        const e = 1 - Math.pow(1 - this.keeperDiveProgress, 2.2);
        this.keeperPos.x =
          this.keeperDiveStartX +
          (this.keeperTarget.x - this.keeperDiveStartX) * e;
        this.keeperPos.y =
          this.keeperTarget.y * Math.sin(e * Math.PI * 0.65);
        this.keeperPos.z = this.keeperTarget.z;
      }

      const substeps = 4;
      const subDt = clampedDt / substeps;
      for (let s = 0; s < substeps; s++) {
        this.stepBallPhysics(subDt);
      }

      this.ballTrail.push({ ...this.ballPos });
      if (this.ballTrail.length > 10) this.ballTrail.shift();

      // Unified dynamic camera follow in BOTH roles
      const progress = Math.max(
        0,
        Math.min(1, (PENALTY_Z - this.ballPos.z) / PENALTY_Z)
      );
      this.cameraPos.z = 16.4 - progress * 2.5;
      this.cameraPos.x = this.ballPos.x * 0.14;
      this.cameraLook.x = this.ballPos.x * 0.22;

      if (
        !this.shotResolved &&
        (this.ballPos.z < -GOAL_DEPTH - 1.5 ||
          this.phaseTimer > 2.3 ||
          (this.ballVel.z > 0.5 && this.ballPos.z > 4.2))
      ) {
        this.resolveShot(this.shotOutcome ?? 'missed');
      }
    }

    if (this.phase === 'result') {
      this.phaseTimer += clampedDt;
      this.stepBallPhysics(clampedDt * 0.7);
      if (this.keeperDiveDir) {
        this.keeperDiveProgress = Math.min(
          1,
          this.keeperDiveProgress + clampedDt * 1.5
        );
        const e = 1 - Math.pow(1 - this.keeperDiveProgress, 2);
        this.keeperPos.x =
          this.keeperDiveStartX +
          (this.keeperTarget.x - this.keeperDiveStartX) * e;
        this.keeperPos.y = Math.max(0, this.keeperPos.y - clampedDt * 2.1);
      }

      if (this.phaseTimer >= 1.85) {
        const check = this.evaluateMatchEnd();
        if (check.ended) {
          this.finishMatch(check.winner);
        } else {
          // Transition to the Team Huddle (players standing shoulder-to-shoulder left & right)
          this.phase = 'huddle';
          this.phaseTimer = 0;
          this.emitHud();
        }
      }
    }

    // Between-kicks Team Huddle showcase (4-5 players left & right shoulder-to-shoulder)
    if (this.phase === 'huddle') {
      this.phaseTimer += clampedDt;
      const t = Math.min(1, this.phaseTimer / 0.55);
      const ease = 1 - Math.pow(1 - t, 2);
      this.cameraPos.x = this.cameraPos.x * (1 - ease);
      this.cameraPos.y = 2.22 + (2.78 - 2.22) * ease;
      this.cameraPos.z = 16.4 + (19.2 - 16.4) * ease;
      this.cameraLook.x = 0;
      this.cameraLook.y = 1.05;
      this.cameraLook.z = 2.6 * ease;

      if (this.phaseTimer >= 1.5 && this.fadeDir === 'none') {
        this.startFadeToNextTurn();
      }
    }
  }

  private stepBallPhysics(dt: number) {
    const g = 9.81;
    const magnusFactor = 0.048;

    this.ballVel.x +=
      magnusFactor * (this.ballSpin.y / 3.2) * -this.ballVel.z * dt;
    this.ballVel.y -= g * dt;

    this.ballPos.x += this.ballVel.x * dt;
    this.ballPos.y += this.ballVel.y * dt;
    this.ballPos.z += this.ballVel.z * dt;

    this.ballRot.x += this.ballSpin.x * dt;
    this.ballRot.y += this.ballSpin.y * dt;
    this.ballRot.z += this.ballSpin.z * dt;

    if (this.ballPos.y < BALL_RADIUS) {
      this.ballPos.y = BALL_RADIUS;
      this.ballVel.y = -this.ballVel.y * 0.48;
      this.ballVel.x *= 0.86;
      this.ballVel.z *= 0.86;
      this.ballSpin.x *= 0.82;
      this.ballSpin.y *= 0.82;
    }

    const postR = 0.065 + BALL_RADIUS;
    if (Math.abs(this.ballPos.z) < postR && !this.hitGoalNetThisShot) {
      const dLeft = Math.hypot(this.ballPos.x + GOAL_HALF_W, this.ballPos.z);
      if (dLeft < postR && this.ballPos.y <= GOAL_H + postR) {
        this.bounceOffPost(-GOAL_HALF_W, 0);
      }
      const dRight = Math.hypot(this.ballPos.x - GOAL_HALF_W, this.ballPos.z);
      if (dRight < postR && this.ballPos.y <= GOAL_H + postR) {
        this.bounceOffPost(GOAL_HALF_W, 0);
      }
      if (Math.abs(this.ballPos.x) <= GOAL_HALF_W + postR) {
        const dBar = Math.hypot(this.ballPos.y - GOAL_H, this.ballPos.z);
        if (dBar < postR) {
          const ny = (this.ballPos.y - GOAL_H) / (dBar || 1);
          const nz = this.ballPos.z / (dBar || 1);
          const dot = this.ballVel.y * ny + this.ballVel.z * nz;
          if (dot < 0) {
            this.ballVel.y = (this.ballVel.y - 2 * dot * ny) * 0.72;
            this.ballVel.z = (this.ballVel.z - 2 * dot * nz) * 0.72;
            this.ballPos.y = GOAL_H + ny * (postR + 0.01);
            this.ballPos.z = nz * (postR + 0.01);
            this.onWoodworkHit();
          }
        }
      }
    }

    if (
      !this.shotResolved &&
      this.ballVel.z < 0 &&
      this.ballPos.z <= 0.55 &&
      this.ballPos.z >= -0.15
    ) {
      const kCenterX = this.keeperPos.x;
      const kCenterY = this.keeperPos.y + 0.88;
      const gkBonus =
        this.role === 'save' ? this.playerStrength * 0.1 : 0;
      const reachX =
        (this.keeperDiveDir && this.keeperDiveDir !== 'center' ? 0.94 : 0.64) +
        gkBonus;
      const reachY = 0.94 + gkBonus * 0.5;
      const dx = (this.ballPos.x - kCenterX) / reachX;
      const dy = (this.ballPos.y - kCenterY) / reachY;
      if (dx * dx + dy * dy <= 1.0) {
        this.ballVel.z = Math.abs(this.ballVel.z) * 0.42 + 2.5;
        this.ballVel.x += (this.ballPos.x - kCenterX) * 4.5;
        this.ballVel.y = Math.max(2.2, this.ballVel.y * 0.4 + 2.5);
        this.ballSpin.y *= -0.5;
        soundEngine.playSave();
        this.triggerShake(0.2, 5);
        this.resolveShot('saved');
        return;
      }
    }

    if (
      !this.shotResolved &&
      this.ballPos.z < -BALL_RADIUS &&
      Math.abs(this.ballPos.x) < GOAL_HALF_W - 0.05 &&
      this.ballPos.y < GOAL_H - 0.04
    ) {
      this.resolveShot('goal');
    }

    if (
      Math.abs(this.ballPos.x) <= GOAL_HALF_W &&
      this.ballPos.y <= GOAL_H &&
      this.ballPos.z < 0
    ) {
      if (this.ballPos.z <= -GOAL_DEPTH + BALL_RADIUS) {
        this.hitGoalNetThisShot = true;
        this.impulseNet(
          this.ballPos.x,
          this.ballPos.y,
          Math.abs(this.ballVel.z) * 0.055
        );
        this.ballPos.z = -GOAL_DEPTH + BALL_RADIUS;
        this.ballVel.z = -this.ballVel.z * 0.14;
        this.ballVel.x *= 0.35;
        this.ballVel.y *= 0.35;
      }
      if (Math.abs(this.ballPos.x) >= GOAL_HALF_W - BALL_RADIUS) {
        this.ballPos.x =
          Math.sign(this.ballPos.x) * (GOAL_HALF_W - BALL_RADIUS);
        this.ballVel.x = -this.ballVel.x * 0.25;
      }
      if (this.ballPos.y >= GOAL_H - BALL_RADIUS) {
        this.ballPos.y = GOAL_H - BALL_RADIUS;
        this.ballVel.y = -this.ballVel.y * 0.25;
      }
    }
  }

  private bounceOffPost(postX: number, postZ: number) {
    const dx = this.ballPos.x - postX;
    const dz = this.ballPos.z - postZ;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d;
    const nz = dz / d;
    const dot = this.ballVel.x * nx + this.ballVel.z * nz;
    if (dot < 0) {
      this.ballVel.x = (this.ballVel.x - 2 * dot * nx) * 0.72;
      this.ballVel.z = (this.ballVel.z - 2 * dot * nz) * 0.72;
      this.onWoodworkHit();
    }
  }

  private onWoodworkHit() {
    if (this.hitWoodworkThisShot) return;
    this.hitWoodworkThisShot = true;
    soundEngine.playCrossbar();
    this.triggerShake(0.28, 9);
  }

  private impulseNet(wx: number, wy: number, strength: number) {
    for (const node of this.netNodes) {
      const dist = Math.hypot(node.baseX - wx, node.baseY - wy);
      if (dist < 1.7) {
        const falloff = 1 - dist / 1.7;
        node.velZ -= strength * falloff * 14;
      }
    }
  }

  private triggerShake(duration: number, intensity: number) {
    this.shakeTime = duration;
    this.shakeIntensity = intensity;
  }

  private resolveShot(outcome: ShotOutcome) {
    if (this.shotResolved) return;
    this.shotResolved = true;
    this.shotOutcome = outcome;
    this.phase = 'result';
    this.phaseTimer = 0;

    const isMyTeam = this.role === 'shoot';
    const teamTag = isMyTeam
      ? this.lang === 'ar'
        ? '(فريقك)'
        : '(Your Team)'
      : this.lang === 'ar'
      ? '(الخصم)'
      : '(Opponent)';
    const bannerTone = isMyTeam ? 'blue' : 'red';

    const shootingClub = isMyTeam ? this.playerClub : this.opponentClub;
    const defendingClub = isMyTeam ? this.opponentClub : this.playerClub;
    const shootingClubName =
      this.lang === 'ar' ? shootingClub.nameAr : shootingClub.nameEn;
    const defendingClubName =
      this.lang === 'ar' ? defendingClub.nameAr : defendingClub.nameEn;

    if (outcome === 'goal') {
      soundEngine.playGoal();
      this.triggerShake(0.36, 11);
      this.crowdExcitement = 1.0;

      for (let i = 0; i < 24; i++) {
        this.particles.push({
          x: this.ballPos.x,
          y: Math.max(0.5, this.ballPos.y),
          z: -0.6,
          vx: (Math.random() - 0.5) * 6,
          vy: 2 + Math.random() * 5,
          vz: (Math.random() - 0.5) * 3,
          color: i % 2 === 0 ? '#f4ce65' : '#ffffff',
          size: 4 + Math.random() * 3,
          life: 0,
          maxLife: 1.1,
        });
      }

      this.banner = {
        text: this.texts.goalBanner || 'GOAL!',
        subtext:
          this.lang === 'ar'
            ? `فريق ${shootingClubName} ${teamTag} سجل هدفاً!`
            : `${shootingClubName} ${teamTag} scored a goal!`,
        tone: bannerTone,
      };
    } else if (outcome === 'saved') {
      this.crowdExcitement = 0.6;
      this.banner = {
        text: this.texts.savedBanner || 'SAVED!',
        subtext:
          this.lang === 'ar'
            ? `فريق ${shootingClubName} ${teamTag} ضيع الهدف · تصدي حارس ${defendingClubName}!`
            : `${shootingClubName} ${teamTag} missed — saved by ${defendingClubName}!`,
        tone: bannerTone,
      };
    } else {
      soundEngine.playMiss();
      this.banner = {
        text: this.hitWoodworkThisShot
          ? this.texts.woodworkBanner || 'CROSSBAR!'
          : this.texts.missedBanner || 'MISS!',
        subtext:
          this.lang === 'ar'
            ? `فريق ${shootingClubName} ${teamTag} ضيع الهدف!`
            : `${shootingClubName} ${teamTag} missed the target!`,
        tone: bannerTone,
      };
    }

    if (this.mode === 'shootout') {
      const idx = this.round - 1;
      if (this.role === 'shoot') {
        if (idx < 5) {
          this.playerHistory[idx] = outcome === 'goal' ? 'goal' : 'miss';
        }
        if (outcome === 'goal') this.playerScore++;
      } else {
        if (idx < 5) {
          this.aiHistory[idx] = outcome === 'goal' ? 'goal' : 'miss';
        }
        if (outcome === 'goal') this.aiScore++;
      }
    } else {
      const success =
        (this.role === 'shoot' && outcome === 'goal') ||
        (this.role === 'save' && outcome !== 'goal');
      if (success) {
        this.streakCount++;
      } else {
        this.streakCount = 0;
      }
    }

    const matchCheck = this.evaluateMatchEnd();
    if (this.onMatchRecordCallback) {
      const earned = this.onMatchRecordCallback(
        outcome,
        this.role,
        matchCheck.ended,
        matchCheck.winner,
        this.streakCount
      );
      this.coinsEarnedThisMatch += earned;
    }

    this.emitHud();
  }

  private evaluateMatchEnd(): { ended: boolean; winner: 'player' | 'ai' | null } {
    if (this.mode !== 'shootout') return { ended: false, winner: null };

    if (this.round <= 5) {
      const playerKicksTaken = this.round;
      const aiKicksTaken =
        this.role === 'shoot' ? this.round - 1 : this.round;
      const playerRemaining = 5 - playerKicksTaken;
      const aiRemaining = 5 - aiKicksTaken;

      if (this.playerScore > this.aiScore + aiRemaining) {
        return { ended: true, winner: 'player' };
      }
      if (this.aiScore > this.playerScore + playerRemaining) {
        return { ended: true, winner: 'ai' };
      }
      if (this.round === 5 && this.role === 'save') {
        if (this.playerScore > this.aiScore) {
          return { ended: true, winner: 'player' };
        }
        if (this.aiScore > this.playerScore) {
          return { ended: true, winner: 'ai' };
        }
        this.isSuddenDeath = true;
      }
    } else {
      if (this.role === 'save') {
        if (this.playerScore > this.aiScore) {
          return { ended: true, winner: 'player' };
        }
        if (this.aiScore > this.playerScore) {
          return { ended: true, winner: 'ai' };
        }
      }
    }
    return { ended: false, winner: null };
  }

  private finishMatch(winner: 'player' | 'ai' | null) {
    this.matchWinner = winner;
    this.phase = 'match_over';
    if (winner === 'player') {
      this.winBonusAwarded = 25;
      soundEngine.playVictory();
      window.setTimeout(() => soundEngine.playCoin(), 320);
    }
    this.emitHud();
  }

  private startFadeToNextTurn() {
    const check = this.evaluateMatchEnd();
    if (check.ended) {
      this.finishMatch(check.winner);
      return;
    }

    this.phase = 'fading';
    this.fadeDir = 'out';
    this.pendingActionAfterFade = () => {
      if (this.role === 'shoot') {
        this.role = 'save';
      } else {
        this.role = 'shoot';
        this.round++;
      }
      this.resetTurnEntities();
      soundEngine.playWhistle();
      this.emitHud();
    };
  }

  public getHudState(): MatchHudState {
    return {
      mode: this.mode,
      role: this.role,
      round: this.round,
      playerScore: this.playerScore,
      aiScore: this.aiScore,
      playerHistory: [...this.playerHistory],
      aiHistory: [...this.aiHistory],
      streakCount: this.streakCount,
      banner: this.banner,
      phase: this.phase,
      power: this.power,
      isSuddenDeath: this.isSuddenDeath,
      canControl:
        !this.paused &&
        ((this.role === 'shoot' &&
          this.isPlayerKickTurn &&
          (this.phase === 'aiming' || this.phase === 'charging')) ||
          (this.role === 'save' &&
            (this.phase === 'aiming' ||
              this.phase === 'running' ||
              this.phase === 'ball_flight'))),
      selectedDive: this.preselectedDive,
      matchWinner: this.matchWinner,
      coinsEarnedThisMatch: this.coinsEarnedThisMatch,
      winBonusAwarded: this.winBonusAwarded,
      activeTakerName: this.activeTakerName,
      activeTakerNumber: this.activeTakerNumber,
      activeTakerSlot: this.activeTakerSlot,
      isPlayerKickTurn: this.isPlayerKickTurn,
      playerRating: this.playerClub.rating,
      opponentRating: this.opponentClub.rating,
    };
  }

  private emitHud() {
    if (this.onHudChange) {
      this.onHudChange(this.getHudState());
    }
  }
}

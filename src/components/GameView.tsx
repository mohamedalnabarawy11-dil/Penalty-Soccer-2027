import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  ListOrdered,
  Maximize2,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BALLS, EGYPTIAN_CLUBS, TEXT } from '../data/customization';
import { PenaltyEngine } from '../game/engine';
import { renderScene } from '../game/renderer';
import { soundEngine } from '../game/sound';
import {
  DiveDirection,
  GameMode,
  MatchHudState,
  SaveData,
  ShotOutcome,
  TurnRole,
} from '../types/game';
import { getScheduledOpponent } from '../utils/storage';
import { PlayStationDpad } from './PlayStationDpad';

interface GameViewProps {
  mode: GameMode;
  saveData: SaveData;
  onExitToMenu: () => void;
  onExitToStandings: () => void;
  onOpenSettings: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onRecordTurnResult: (
    outcome: ShotOutcome,
    role: TurnRole,
    matchEnded: boolean,
    winner: 'player' | 'ai' | null,
    streak: number,
    opponentRating: number,
    matchSummary?: {
      mode: GameMode;
      opponentId: string;
      playerScore: number;
      aiScore: number;
    }
  ) => number;
}

export const GameView: React.FC<GameViewProps> = ({
  mode,
  saveData,
  onExitToMenu,
  onExitToStandings,
  onOpenSettings,
  onToggleMute,
  onToggleFullscreen,
  onRecordTurnResult,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PenaltyEngine | null>(null);
  const shootPointerId = useRef<number | null>(null);
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null);

  const [paused, setPaused] = useState(false);
  const [matchNonce, setMatchNonce] = useState(0);
  const [redirectSec, setRedirectSec] = useState(3);

  const lang = saveData.language;
  const t = TEXT[lang];

  const club =
    EGYPTIAN_CLUBS.find((c) => c.id === saveData.selectedClubId) ||
    EGYPTIAN_CLUBS[EGYPTIAN_CLUBS.length - 1];

  const opponentClub = useMemo(() => {
    if (mode === 'shootout') {
      const oppId = getScheduledOpponent(saveData.league, club.id);
      return (
        EGYPTIAN_CLUBS.find((c) => c.id === oppId) ||
        EGYPTIAN_CLUBS.find((c) => c.id !== club.id) ||
        EGYPTIAN_CLUBS[0]
      );
    }
    const others = EGYPTIAN_CLUBS.filter((c) => c.id !== club.id);
    return others[Math.floor(Math.random() * others.length)] || EGYPTIAN_CLUBS[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club.id, mode, matchNonce]);

  const ballSkin =
    BALLS.find((b) => b.id === saveData.selectedBallId) || BALLS[0];

  const [hud, setHud] = useState<MatchHudState>({
    mode,
    role: 'shoot',
    round: 1,
    playerScore: 0,
    aiScore: 0,
    playerHistory: Array(5).fill('pending'),
    aiHistory: Array(5).fill('pending'),
    streakCount: 0,
    banner: null,
    phase: 'walk_up',
    power: 0.25,
    isSuddenDeath: false,
    canControl: false,
    selectedDive: null,
    matchWinner: null,
    coinsEarnedThisMatch: 0,
    winBonusAwarded: 0,
    activeTakerName: '',
    activeTakerNumber: 10,
    activeTakerSlot: 1,
    isPlayerKickTurn: mode === 'streak',
    playerRating: club.rating,
    opponentRating: opponentClub.rating,
  });

  const clubRef = useRef(club);
  const oppRef = useRef(opponentClub);
  const ballRef = useRef(ballSkin);
  const langRef = useRef(lang);
  clubRef.current = club;
  oppRef.current = opponentClub;
  ballRef.current = ballSkin;
  langRef.current = lang;

  const recordRef = useRef(onRecordTurnResult);
  recordRef.current = onRecordTurnResult;

  useEffect(() => {
    const engine = new PenaltyEngine();
    engine.setLocale(lang, t);
    engine.setCallbacks(
      (nextHud) => setHud(nextHud),
      (outcome, role, matchEnded, winner, streak) =>
        recordRef.current(
          outcome,
          role,
          matchEnded,
          winner,
          streak,
          oppRef.current.rating,
          matchEnded
            ? {
                mode,
                opponentId: oppRef.current.id,
                playerScore: engine.playerScore,
                aiScore: engine.aiScore,
              }
            : undefined
        )
    );
    engine.startNewMatch(mode, clubRef.current, oppRef.current);
    engineRef.current = engine;

    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      engine.update(dt);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = canvas.width / dpr;
          const h = canvas.height / dpr;
          ctx.save();
          ctx.scale(dpr, dpr);
          renderScene(
            ctx,
            w,
            h,
            engine,
            clubRef.current,
            oppRef.current,
            ballRef.current,
            langRef.current
          );
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    soundEngine.setThemeDucking(true);

    return () => {
      cancelAnimationFrame(rafId);
      soundEngine.stopStadiumAmbience();
      soundEngine.setThemeDucking(false);
    };
  }, [mode, matchNonce]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setLocale(lang, t);
    }
  }, [lang, t]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, []);

  // Auto-redirect to Main Menu -> League Standings after Shootout ends
  useEffect(() => {
    if (hud.phase !== 'match_over' || mode !== 'shootout') {
      setRedirectSec(3);
      return;
    }
    setRedirectSec(3);
    const interval = window.setInterval(() => {
      setRedirectSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          onExitToStandings();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [hud.phase, mode, onExitToStandings]);

  // Keyboard shortcuts
  useEffect(() => {
    const keys = new Set<string>();
    let aimLoop = 0;

    const tickAim = () => {
      const eng = engineRef.current;
      if (eng && !eng.paused) {
        if (eng.role === 'shoot' && eng.isPlayerKickTurn) {
          let dx = 0;
          let dy = 0;
          if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 0.045;
          if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 0.045;
          if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 0.045;
          if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 0.045;
          if (dx !== 0 || dy !== 0) {
            eng.nudgeAim(dx * 2.2, -dy * 1.5);
          }
        } else if (eng.role === 'save' && eng.phase === 'aiming') {
          if (keys.has('ArrowLeft') || keys.has('KeyA')) {
            eng.moveKeeperLateral(-0.075);
          }
          if (keys.has('ArrowRight') || keys.has('KeyD')) {
            eng.moveKeeperLateral(0.075);
          }
        }
      }
      aimLoop = requestAnimationFrame(tickAim);
    };
    aimLoop = requestAnimationFrame(tickAim);

    const onKeyDown = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      keys.add(e.code);

      if (e.code === 'Escape') {
        togglePause();
        return;
      }

      if (eng.role === 'shoot' && eng.isPlayerKickTurn) {
        if (e.code === 'Space' && !e.repeat) {
          e.preventDefault();
          eng.startCharge();
        }
      } else if (eng.role === 'save') {
        if (
          e.code === 'Enter' ||
          (e.code === 'Space' && eng.phase === 'aiming')
        ) {
          e.preventDefault();
          eng.confirmKeeperReady();
        } else if (eng.phase !== 'aiming') {
          if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            eng.triggerKeeperDive(e.shiftKey ? 'left-high' : 'left-low');
          } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            eng.triggerKeeperDive(e.shiftKey ? 'right-high' : 'right-low');
          } else if (
            e.code === 'ArrowUp' ||
            e.code === 'KeyW' ||
            e.code === 'Space'
          ) {
            eng.triggerKeeperDive('center');
          } else if (e.code === 'KeyQ') {
            eng.triggerKeeperDive('left-high');
          } else if (e.code === 'KeyE') {
            eng.triggerKeeperDive('right-high');
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
      const eng = engineRef.current;
      if (
        eng &&
        eng.role === 'shoot' &&
        eng.isPlayerKickTurn &&
        e.code === 'Space'
      ) {
        eng.releaseCharge();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      cancelAnimationFrame(aimLoop);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const togglePause = () => {
    const eng = engineRef.current;
    if (!eng || eng.phase === 'match_over') return;
    soundEngine.playClick();
    const next = !eng.paused;
    eng.paused = next;
    setPaused(next);
  };

  const handleRestart = () => {
    soundEngine.playClick();
    setPaused(false);
    setMatchNonce((n) => n + 1);
  };

  const handleShootDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    shootPointerId.current = e.pointerId;
    engineRef.current?.startCharge();
  };

  const handleShootUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (shootPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    shootPointerId.current = null;
    engineRef.current?.releaseCharge();
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    soundEngine.unlock();
    if (hud.role !== 'save' || !hud.canControl) return;
    swipeStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      hud.role !== 'save' ||
      !swipeStart.current ||
      swipeStart.current.id !== e.pointerId
    ) {
      return;
    }
    const dx = e.clientX - swipeStart.current.x;
    const dy = e.clientY - swipeStart.current.y;
    if (Math.hypot(dx, dy) > 34) {
      let dir: DiveDirection = 'center';
      if (Math.abs(dx) < 22 && dy < -20) {
        dir = 'center';
      } else if (dx < 0) {
        dir = dy < -18 ? 'left-high' : 'left-low';
      } else {
        dir = dy < -18 ? 'right-high' : 'right-low';
      }
      engineRef.current?.triggerKeeperDive(dir);
      swipeStart.current = null;
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (swipeStart.current?.id === e.pointerId) {
      swipeStart.current = null;
    }
  };

  const powerPct = Math.round(hud.power * 100);
  const powerColor =
    hud.power > 0.85
      ? 'bg-red-500'
      : hud.power >= 0.5
      ? 'bg-[#d4af37]'
      : 'bg-emerald-400';

  const myClubShort = lang === 'ar' ? club.shortAr : club.shortEn;
  const oppClubShort =
    lang === 'ar' ? opponentClub.shortAr : opponentClub.shortEn;
  const isMyTeamTurn = hud.role === 'shoot';
  const turnTeamTag = isMyTeamTurn
    ? lang === 'ar'
      ? '(فريقك)'
      : '(Your Team)'
    : lang === 'ar'
    ? '(الخصم)'
    : '(Opponent)';
  const shootingClubFull = isMyTeamTurn
    ? lang === 'ar'
      ? club.nameAr
      : club.nameEn
    : lang === 'ar'
    ? opponentClub.nameAr
    : opponentClub.nameEn;

  return (
    <div className="fixed inset-0 h-dvh w-screen overflow-hidden bg-[#07080b] select-none">
      {/* Full-Screen 2.5D Stadium Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        className="fixed inset-0 block h-full w-full touch-none"
      />

      {/* Compact Top Broadcast Scoreboard HUD */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-2.5 pt-1.5 sm:px-5 sm:pt-2">
        {/* Left: Back Button + Role + Coins */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onExitToMenu();
            }}
            aria-label={t.back}
            className="flex h-8 items-center gap-1 rounded-lg border border-white/15 bg-black/60 px-2 text-[11px] font-extrabold text-white hover:bg-white/15 backdrop-blur-sm"
          >
            {lang === 'ar' ? (
              <ArrowRight className="h-3.5 w-3.5 text-[#f3d26b]" />
            ) : (
              <ArrowLeft className="h-3.5 w-3.5 text-[#f3d26b]" />
            )}
            <span className="hidden sm:inline">{t.back}</span>
          </button>

          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/55 px-2.5 py-1 backdrop-blur-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                hud.role === 'shoot' ? 'bg-[#d4af37]' : 'bg-emerald-400'
              }`}
            />
            <span className="text-[11px] font-extrabold text-white whitespace-nowrap">
              {hud.role === 'shoot' ? t.shootTurn : t.saveTurn}
            </span>
            <span className="text-white/20">·</span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-[#f3d26b] tabular-nums">
              <Coins className="h-3 w-3 text-[#d4af37]" />
              {saveData.coins}
            </span>
          </div>
        </div>

        {/* Center: Compact Scoreboard with Club Ratings */}
        {hud.mode === 'shootout' ? (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2.5 rounded-lg border border-[#d4af37]/40 bg-black/65 px-3 py-1 shadow-md backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/50"
                  style={{ backgroundColor: club.primary }}
                />
                <span className="text-[11px] font-extrabold text-[#f3d26b] whitespace-nowrap">
                  {myClubShort}{' '}
                  <span className="opacity-70 tabular-nums">
                    ({club.rating})
                  </span>
                </span>
                <div className="hidden items-center gap-1 sm:flex">
                  {hud.playerHistory.map((st, i) => (
                    <span
                      key={i}
                      className={`h-2 w-2 rounded-full border ${
                        st === 'goal'
                          ? 'border-emerald-300 bg-emerald-400'
                          : st === 'miss'
                          ? 'border-red-300 bg-red-500'
                          : i === (hud.round - 1) % 5 && hud.role === 'shoot'
                          ? 'border-[#f3d26b] bg-[#d4af37]/40'
                          : 'border-white/30 bg-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="font-display text-lg font-black tracking-wider text-white tabular-nums sm:text-xl">
                {hud.playerScore} - {hud.aiScore}
              </div>

              <div className="flex items-center gap-1.5">
                <div className="hidden items-center gap-1 sm:flex">
                  {hud.aiHistory.map((st, i) => (
                    <span
                      key={i}
                      className={`h-2 w-2 rounded-full border ${
                        st === 'goal'
                          ? 'border-emerald-300 bg-emerald-400'
                          : st === 'miss'
                          ? 'border-red-300 bg-red-500'
                          : i === (hud.round - 1) % 5 && hud.role === 'save'
                          ? 'border-emerald-300 bg-emerald-400/40'
                          : 'border-white/30 bg-transparent'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-extrabold text-slate-200 whitespace-nowrap">
                  {oppClubShort}{' '}
                  <span className="opacity-70 tabular-nums">
                    ({opponentClub.rating})
                  </span>
                </span>
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/50"
                  style={{ backgroundColor: opponentClub.primary }}
                />
              </div>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold text-slate-100 drop-shadow">
              <span
                className={`rounded border px-2 py-0.5 ${
                  isMyTeamTurn
                    ? 'border-sky-400/70 bg-blue-950/85 text-sky-200'
                    : 'border-red-400/70 bg-red-950/85 text-red-200'
                }`}
              >
                {t.turnNowClub} {shootingClubFull} {turnTeamTag}
              </span>
              <span>
                {hud.isSuddenDeath
                  ? t.suddenDeath
                  : `${t.round} ${hud.round}/5`}
                {hud.activeTakerName
                  ? ` · ${hud.activeTakerName}`
                  : ''}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-[#d4af37]/40 bg-black/65 px-3 py-1 shadow-md backdrop-blur-sm">
            <span className="text-[11px] font-bold text-slate-200">
              {t.streakLabel}:{' '}
              <strong className="font-display text-base text-[#4ade80] tabular-nums">
                {hud.streakCount}
              </strong>
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-[#f3d26b] tabular-nums">
              <Coins className="h-3 w-3" />+{hud.coinsEarnedThisMatch}
            </span>
          </div>
        )}

        {/* Right: Quick Action Controls (Mute, Fullscreen, Settings, Pause) */}
        <div className="pointer-events-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={saveData.muted ? t.unmute : t.mute}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white hover:bg-white/15 backdrop-blur-sm"
          >
            {saveData.muted ? (
              <VolumeX className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-[#d4af37]" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={t.fullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white hover:bg-white/15 backdrop-blur-sm"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenSettings();
            }}
            aria-label={t.settings}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-slate-200 hover:bg-white/15 backdrop-blur-sm"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={togglePause}
            aria-label={t.pause}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4af37]/40 bg-black/55 text-[#f3d26b] hover:bg-white/15 backdrop-blur-sm"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* GOAL / SAVED / MISS / TURN ANNOUNCEMENT Banner */}
      {hud.banner && hud.phase !== 'match_over' && (
        <div className="pointer-events-none fixed inset-x-0 top-1/4 z-20 flex flex-col items-center justify-center px-4 text-center">
          <div
            className={`animate-banner-pop rounded-2xl border-2 px-6 py-2 shadow-2xl backdrop-blur-md ${
              hud.banner.tone === 'blue'
                ? 'border-sky-400 bg-gradient-to-r from-blue-950/95 via-blue-700/95 to-blue-950/95 text-white'
                : hud.banner.tone === 'emerald'
                ? 'border-[#d4af37] bg-gradient-to-r from-[#0a4a24]/95 via-[#10783b]/95 to-[#0a4a24]/95 text-white'
                : hud.banner.tone === 'gold'
                ? 'border-white/70 bg-gradient-to-r from-[#9e7816]/95 via-[#d4af37]/95 to-[#9e7816]/95 text-[#07080b]'
                : hud.banner.tone === 'red'
                ? 'border-red-400 bg-gradient-to-r from-red-950/95 via-red-800/95 to-red-950/95 text-white'
                : 'border-white/30 bg-slate-900/90 text-white'
            }`}
          >
            <div
              className={`font-display font-black tracking-wide ${
                hud.phase === 'turn_intro' || hud.phase === 'walk_up'
                  ? 'text-lg sm:text-2xl'
                  : 'text-2xl sm:text-4xl'
              }`}
            >
              {hud.banner.text}
            </div>
            {hud.banner.subtext && (
              <div className="mt-0.5 text-xs font-bold opacity-95">
                {hud.banner.subtext}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtle Walk-up / Place Ball Indicator */}
      {(hud.phase === 'walk_up' || hud.phase === 'place_ball') && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-3">
          <div
            className={`rounded-lg border px-4 py-1 text-[11px] font-bold backdrop-blur-sm ${
              isMyTeamTurn
                ? 'border-sky-400/60 bg-blue-950/75 text-sky-200'
                : 'border-red-400/60 bg-red-950/75 text-red-200'
            }`}
          >
            {t.turnNowClub} {shootingClubFull} {turnTeamTag} · #
            {hud.activeTakerNumber} {hud.activeTakerName}
          </div>
        </div>
      )}

      {/* SHOOT ROLE: COMPACT UNOBSTRUCTED CORNER CONTROLS (ONLY when it is the player's kick!) */}
      {hud.role === 'shoot' &&
        hud.isPlayerKickTurn &&
        (hud.phase === 'aiming' || hud.phase === 'charging') && (
          <>
            {/* Bottom-Left: Compact PlayStation D-Pad */}
            <div
              dir="ltr"
              className="fixed bottom-2.5 left-2.5 z-20 sm:bottom-4 sm:left-5"
            >
              <PlayStationDpad
                disabled={!hud.canControl}
                onDirectionChange={(dx, dy) =>
                  engineRef.current?.setDpadDirection(dx, dy)
                }
                onNudge={(dx, dy) => engineRef.current?.nudgeAim(dx, dy)}
              />
            </div>

            {/* Bottom-Right: Slim Power Meter + Compact Translucent Shoot Trigger */}
            <div
              dir="ltr"
              className="fixed bottom-2.5 right-2.5 z-20 flex items-end gap-2 sm:bottom-4 sm:right-5"
            >
              <div className="flex flex-col items-center gap-0.5">
                <div className="relative h-24 w-3.5 overflow-hidden rounded-full border border-white/25 bg-black/50 p-0.5 backdrop-blur-[2px] sm:h-28 sm:w-4">
                  <div
                    className="pointer-events-none absolute inset-x-0 border-y border-[#d4af37]/60 bg-[#d4af37]/15"
                    style={{ bottom: '50%', height: '35%' }}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 bg-red-500/25"
                    style={{ height: '15%' }}
                  />
                  <div
                    className={`absolute inset-x-0.5 bottom-0.5 rounded-full transition-[height] duration-75 ${powerColor}`}
                    style={{ height: `calc(${powerPct}% - 4px)` }}
                  />
                </div>
                <span className="font-display text-[11px] font-extrabold text-white tabular-nums drop-shadow">
                  {powerPct}%
                </span>
              </div>

              <button
                type="button"
                onPointerDown={handleShootDown}
                onPointerUp={handleShootUp}
                onPointerCancel={handleShootUp}
                disabled={!hud.canControl}
                className={`flex h-22 w-22 touch-none flex-col items-center justify-center rounded-full border-3 shadow-xl transition active:scale-95 sm:h-26 sm:w-26 backdrop-blur-[2px] ${
                  hud.phase === 'charging'
                    ? 'border-white bg-[#d4af37]/95 text-[#07080b] scale-105'
                    : 'border-[#d4af37]/85 bg-black/45 text-[#f3d26b] hover:bg-black/60'
                }`}
              >
                <span className="text-sm font-black tracking-wide sm:text-base">
                  {t.shoot}
                </span>
                <span className="mt-0.5 text-[9px] font-bold opacity-85">
                  {hud.phase === 'charging' ? t.releaseToKick : t.holdToCharge}
                </span>
              </button>
            </div>
          </>
        )}

      {/* SAVE ROLE: COMPACT CORNER DIVE PADS + I'M READY AT VERY BOTTOM EDGE */}
      {hud.role === 'save' &&
        (hud.phase === 'aiming' ||
          hud.phase === 'running' ||
          hud.phase === 'ball_flight') && (
          <>
            <div
              dir="ltr"
              className="pointer-events-none fixed inset-x-0 bottom-1.5 z-20 flex items-end justify-between px-2.5 sm:bottom-2.5 sm:px-5"
            >
              {/* Left Corner Dive Pads */}
              <div className="pointer-events-auto flex flex-col gap-1">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.triggerKeeperDive('left-high');
                  }}
                  className={`min-h-[34px] min-w-[78px] rounded-lg border px-2 py-1 text-[10px] font-extrabold backdrop-blur-[2px] active:scale-95 transition sm:min-h-[36px] sm:min-w-[84px] sm:text-[11px] ${
                    hud.selectedDive === 'left-high'
                      ? 'border-white bg-[#d4af37] text-[#07080b] shadow-[0_0_14px_rgba(212,175,55,0.65)]'
                      : 'border-[#d4af37]/60 bg-black/45 text-[#f3d26b]'
                  }`}
                >
                  ↖ {t.diveLeftHigh}
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.triggerKeeperDive('left-low');
                  }}
                  className={`min-h-[34px] min-w-[78px] rounded-lg border px-2 py-1 text-[10px] font-extrabold backdrop-blur-[2px] active:scale-95 transition sm:min-h-[36px] sm:min-w-[84px] sm:text-[11px] ${
                    hud.selectedDive === 'left-low'
                      ? 'border-white bg-[#d4af37] text-[#07080b] shadow-[0_0_14px_rgba(212,175,55,0.65)]'
                      : 'border-white/30 bg-black/45 text-white'
                  }`}
                >
                  ↙ {t.diveLeftLow}
                </button>
              </div>

              {/* Right Corner Dive Pads */}
              <div className="pointer-events-auto flex flex-col gap-1">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.triggerKeeperDive('right-high');
                  }}
                  className={`min-h-[34px] min-w-[78px] rounded-lg border px-2 py-1 text-[10px] font-extrabold backdrop-blur-[2px] active:scale-95 transition sm:min-h-[36px] sm:min-w-[84px] sm:text-[11px] ${
                    hud.selectedDive === 'right-high'
                      ? 'border-white bg-[#d4af37] text-[#07080b] shadow-[0_0_14px_rgba(212,175,55,0.65)]'
                      : 'border-[#d4af37]/60 bg-black/45 text-[#f3d26b]'
                  }`}
                >
                  {t.diveRightHigh} ↗
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.triggerKeeperDive('right-low');
                  }}
                  className={`min-h-[34px] min-w-[78px] rounded-lg border px-2 py-1 text-[10px] font-extrabold backdrop-blur-[2px] active:scale-95 transition sm:min-h-[36px] sm:min-w-[84px] sm:text-[11px] ${
                    hud.selectedDive === 'right-low'
                      ? 'border-white bg-[#d4af37] text-[#07080b] shadow-[0_0_14px_rgba(212,175,55,0.65)]'
                      : 'border-white/30 bg-black/45 text-white'
                  }`}
                >
                  {t.diveRightLow} ↘
                </button>
              </div>
            </div>

            {/* Center-Screen Semi-Transparent Frosted "أنا جاهز" Button (away from corner dive controls) */}
            {hud.phase === 'aiming' && (
              <div className="fixed top-[57%] left-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.confirmKeeperReady();
                  }}
                  className="rounded-2xl border-2 border-[#d4af37]/85 bg-[#07080b]/35 px-7 py-2.5 text-sm font-black text-[#f3d26b] shadow-[0_0_24px_rgba(212,175,55,0.35)] backdrop-blur-sm hover:bg-[#07080b]/55 active:scale-95 transition whitespace-nowrap sm:text-base"
                >
                  {t.imReady}
                </button>
              </div>
            )}

            {/* Bottom Bezel Center: Move Keeper + Center Dive */}
            <div
              dir="ltr"
              className="fixed bottom-1 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5"
            >
              {hud.phase === 'aiming' && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.moveKeeperLateral(-0.45);
                  }}
                  aria-label={t.moveLeft}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-black/55 text-white active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  engineRef.current?.triggerKeeperDive('center');
                }}
                className={`h-8 rounded-lg border px-2.5 text-[10px] font-extrabold backdrop-blur-[2px] active:scale-95 transition sm:text-[11px] ${
                  hud.selectedDive === 'center'
                    ? 'border-white bg-emerald-400 text-[#07080b] shadow-[0_0_14px_rgba(52,211,153,0.65)]'
                    : 'border-emerald-400/60 bg-black/55 text-emerald-200'
                }`}
              >
                ↑ {t.diveCenter}
              </button>

              {hud.phase === 'aiming' && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.moveKeeperLateral(0.45);
                  }}
                  aria-label={t.moveRight}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-black/55 text-white active:scale-95"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        )}

      {/* PAUSE MODAL */}
      {paused && hud.phase !== 'match_over' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-[#d4af37]/40 bg-[#0d1119] p-5 text-center shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-black text-white">{t.pause}</h2>
              <button
                type="button"
                onClick={togglePause}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={togglePause}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] text-sm font-black text-[#07080b] hover:bg-[#f0cd5e] transition"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{t.resume}</span>
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-sm font-bold text-white hover:bg-white/10 transition"
              >
                <RotateCcw className="h-4 w-4" />
                <span>{t.restart}</span>
              </button>

              <a
                href="https://wa.me/201034910183"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/50 text-xs font-bold text-emerald-300 hover:bg-emerald-900/60 transition"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{t.supportDev}</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onExitToMenu();
                }}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-950/30 text-sm font-bold text-red-300 hover:bg-red-900/40 transition"
              >
                <span>{t.mainMenu}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MATCH OVER MODAL -> Redirects to Main Menu & League Table (No Play Again in League Mode) */}
      {hud.phase === 'match_over' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-[#d4af37]/60 bg-[#0d1119] p-5 text-center shadow-2xl">
            <div
              className={`mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl ${
                hud.matchWinner === 'player'
                  ? 'bg-[#d4af37] text-[#07080b]'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {hud.matchWinner === 'player' ? (
                <Trophy className="h-6 w-6" />
              ) : (
                <Check className="h-6 w-6" />
              )}
            </div>

            <h2 className="text-xl font-black text-white sm:text-2xl">
              {hud.matchWinner === 'player' ? t.victory : t.defeat}
            </h2>

            <div className="my-3 flex items-center justify-center gap-6 border-y border-white/10 py-2.5">
              <div>
                <div className="text-xs font-bold text-[#f3d26b]">
                  {myClubShort}
                </div>
                <div className="font-display text-3xl font-black text-white tabular-nums">
                  {hud.playerScore}
                </div>
              </div>
              <div className="font-display text-xl font-bold text-slate-500">
                -
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400">
                  {oppClubShort}
                </div>
                <div className="font-display text-3xl font-black text-white tabular-nums">
                  {hud.aiScore}
                </div>
              </div>
            </div>

            {hud.matchWinner === 'player' && (
              <div className="animate-banner-pop mb-2.5 flex items-center justify-between rounded-xl border border-[#d4af37]/70 bg-gradient-to-r from-[#d4af37]/20 via-[#f4ce65]/25 to-[#d4af37]/20 px-4 py-2">
                <span className="text-xs font-extrabold text-white">
                  {t.winBonusLabel}
                </span>
                <span className="flex items-center gap-1 font-display text-lg font-black text-[#f3d26b] tabular-nums">
                  <Coins className="h-4 w-4 text-[#d4af37]" />+25
                </span>
              </div>
            )}

            {saveData.league.pendingSeasonReward && (
              <div className="animate-banner-pop mb-2.5 flex items-center justify-between rounded-xl border border-emerald-400/60 bg-emerald-950/60 px-4 py-2">
                <span className="text-xs font-extrabold text-emerald-200">
                  {t.seasonCompleteTitle} (#{saveData.league.pendingSeasonReward.rank})
                </span>
                <span className="flex items-center gap-1 font-display text-lg font-black text-emerald-300 tabular-nums">
                  <Coins className="h-4 w-4" />+
                  {saveData.league.pendingSeasonReward.coins}
                </span>
              </div>
            )}

            <div className="mb-3 flex items-center justify-center gap-4 text-xs font-bold text-slate-300 tabular-nums">
              <span className="flex items-center gap-1 text-[#f3d26b]">
                <Coins className="h-3.5 w-3.5 text-[#d4af37]" />
                {t.earnedCoins}: +{hud.coinsEarnedThisMatch}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-white">
                {t.totalBalance}: {saveData.coins}
              </span>
            </div>

            {mode === 'shootout' && (
              <div className="mb-3 text-[11px] font-bold text-emerald-300 tabular-nums">
                {t.redirectingStandings} {redirectSec}
                {t.secondsShort}...
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {mode === 'shootout' ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onExitToStandings();
                  }}
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#d4af37] px-2 text-xs font-black text-[#07080b] hover:bg-[#f0cd5e] transition sm:text-sm"
                >
                  <ListOrdered className="h-4 w-4" />
                  <span>{t.viewStandings}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRestart}
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#d4af37] px-2 text-xs font-black text-[#07080b] hover:bg-[#f0cd5e] transition sm:text-sm"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{t.newChallenge}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onExitToMenu();
                }}
                className="flex min-h-[42px] items-center justify-center rounded-xl border border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10 transition sm:text-sm"
              >
                {t.mainMenu}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

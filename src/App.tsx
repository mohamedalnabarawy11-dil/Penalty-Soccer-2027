import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Play,
  RotateCw,
  Shield,
  Trophy,
  X,
} from 'lucide-react';
import { GameView } from './components/GameView';
import { LockerModal, LockerTab } from './components/LockerModal';
import { MainMenu } from './components/MainMenu';
import { OfflineIndicator } from './components/PWAInstallButton';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SplashScreen } from './components/SplashScreen';
import {
  ACHIEVEMENTS,
  BALLS,
  EGYPTIAN_CLUBS,
  TEXT,
  WIN_MATCH_BONUS_COINS,
} from './data/customization';
import { soundEngine } from './game/sound';
import {
  GameMode,
  SaveData,
  ScreenView,
  ShotOutcome,
  TurnRole,
} from './types/game';
import {
  advanceLeagueMatchday,
  createInitialLeagueState,
  evaluateAchievements,
  loadSaveData,
  writeSaveData,
} from './utils/storage';

export default function App() {
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<ScreenView>('splash');
  const [activeMode, setActiveMode] = useState<GameMode>('shootout');
  const [showLocker, setShowLocker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lockerTab, setLockerTab] = useState<LockerTab>('clubs');
  const [welcomeClubId, setWelcomeClubId] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissPortrait, setDismissPortrait] = useState(false);
  const [toastAchId, setToastAchId] = useState<string | null>(null);

  const lang = saveData.language;
  const t = TEXT[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    soundEngine.setMuted(saveData.muted);
    soundEngine.setMusicEnabled(saveData.musicEnabled !== false);
  }, [lang, saveData.muted, saveData.musicEnabled]);

  // Start official Egyptian cheering anthem smoothly on first user interaction anywhere in the game
  useEffect(() => {
    const startAudio = () => {
      soundEngine.unlock();
      if (!saveData.muted && saveData.musicEnabled !== false) {
        soundEngine.startOfficialTheme();
      }
    };
    window.addEventListener('pointerdown', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
    window.addEventListener('touchstart', startAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('keydown', startAudio);
      window.removeEventListener('touchstart', startAudio);
    };
  }, [saveData.muted, saveData.musicEnabled]);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSaveData((prev) => {
      const next = updater(prev);
      writeSaveData(next);
      return next;
    });
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        const orientation = screenOrientation();
        if (orientation?.lock) {
          orientation.lock('landscape').catch(() => {});
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen restrictions in embedded iframes
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    soundEngine.unlock();
    updateSave((prev) => {
      const nextMuted = !prev.muted;
      soundEngine.setMuted(nextMuted);
      if (!nextMuted) soundEngine.playClick();
      return { ...prev, muted: nextMuted };
    });
  }, [updateSave]);

  const handleToggleMusic = useCallback(() => {
    soundEngine.unlock();
    updateSave((prev) => {
      const nextMusic = !(prev.musicEnabled !== false);
      soundEngine.setMusicEnabled(nextMusic);
      return { ...prev, musicEnabled: nextMusic };
    });
  }, [updateSave]);

  const handleToggleLanguage = useCallback(() => {
    updateSave((prev) => ({
      ...prev,
      language: prev.language === 'ar' ? 'en' : 'ar',
    }));
  }, [updateSave]);

  const handleBuyOrEquipClub = useCallback(
    (clubId: string) => {
      const club = EGYPTIAN_CLUBS.find((c) => c.id === clubId);
      if (!club) return;

      const alreadyOwned = saveData.unlockedClubs.includes(clubId);
      const canJoin = alreadyOwned || saveData.coins >= club.price;
      if (!canJoin) return;

      if (alreadyOwned) {
        soundEngine.playClick();
      } else {
        soundEngine.playCoin();
      }

      updateSave((prev) => {
        if (prev.unlockedClubs.includes(clubId)) {
          return { ...prev, selectedClubId: clubId };
        }
        if (prev.coins >= club.price) {
          return {
            ...prev,
            coins: prev.coins - club.price,
            unlockedClubs: [...prev.unlockedClubs, clubId],
            selectedClubId: clubId,
          };
        }
        return prev;
      });

      setWelcomeClubId(clubId);
    },
    [saveData.coins, saveData.unlockedClubs, updateSave]
  );

  const handleBuyOrEquipBall = useCallback(
    (ballId: string) => {
      const ball = BALLS.find((b) => b.id === ballId);
      if (!ball) return;

      updateSave((prev) => {
        if (prev.unlockedBalls.includes(ballId)) {
          soundEngine.playClick();
          return { ...prev, selectedBallId: ballId };
        }
        if (prev.coins >= ball.price) {
          soundEngine.playCoin();
          return {
            ...prev,
            coins: prev.coins - ball.price,
            unlockedBalls: [...prev.unlockedBalls, ballId],
            selectedBallId: ballId,
          };
        }
        return prev;
      });
    },
    [updateSave]
  );

  const handleStartNewSeason = useCallback(() => {
    soundEngine.playClick();
    updateSave((prev) => ({
      ...prev,
      league: createInitialLeagueState(prev.league.seasonNumber + 1),
    }));
  }, [updateSave]);

  const handleStartGame = useCallback(
    (mode: GameMode) => {
      if (!saveData.selectedClubId) {
        soundEngine.playClick();
        setLockerTab('clubs');
        setShowLocker(true);
        return;
      }
      setActiveMode(mode);
      setScreen('playing');
    },
    [saveData.selectedClubId]
  );

  const handleRecordTurnResult = useCallback(
    (
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
    ): number => {
      const oppStrength = Math.max(
        0.08,
        Math.min(1, (opponentRating - 60) / 35)
      );
      const clubMult = 1 + oppStrength * 0.45;
      let earned = 0;

      if (role === 'shoot' && outcome === 'goal') {
        earned += Math.round(15 * clubMult);
      } else if (role === 'save' && outcome === 'saved') {
        earned += Math.round(20 * clubMult);
      } else if (role === 'save' && outcome !== 'goal') {
        earned += 5;
      }

      // Exact +25 coins win bonus on every match won
      if (matchEnded) {
        earned += winner === 'player' ? WIN_MATCH_BONUS_COINS : 10;
      }

      setSaveData((prev) => {
        let nextLeague = prev.league;
        let seasonBonusCoins = 0;

        if (
          matchEnded &&
          matchSummary?.mode === 'shootout' &&
          prev.selectedClubId
        ) {
          const result = advanceLeagueMatchday(
            prev.league,
            prev.selectedClubId,
            matchSummary.opponentId,
            matchSummary.playerScore,
            matchSummary.aiScore,
            winner === 'player'
          );
          nextLeague = result.nextLeague;
          seasonBonusCoins = result.seasonBonusCoins;
        }

        const next: SaveData = {
          ...prev,
          coins: prev.coins + earned + seasonBonusCoins,
          totalGoals:
            prev.totalGoals + (role === 'shoot' && outcome === 'goal' ? 1 : 0),
          totalSaves:
            prev.totalSaves + (role === 'save' && outcome === 'saved' ? 1 : 0),
          matchesPlayed: prev.matchesPlayed + (matchEnded ? 1 : 0),
          matchesWon:
            prev.matchesWon + (matchEnded && winner === 'player' ? 1 : 0),
          bestStreak: Math.max(prev.bestStreak, streak),
          league: nextLeague,
        };
        const { updated, newlyUnlocked } = evaluateAchievements(next);
        writeSaveData(updated);

        if (newlyUnlocked.length > 0 || seasonBonusCoins > 0) {
          soundEngine.playCoin();
        }
        if (newlyUnlocked.length > 0) {
          setToastAchId(newlyUnlocked[0]);
          window.setTimeout(() => setToastAchId(null), 3200);
        }

        return updated;
      });

      return earned;
    },
    []
  );

  const toastAch = toastAchId
    ? ACHIEVEMENTS.find((a) => a.id === toastAchId)
    : null;

  const welcomeClub = welcomeClubId
    ? EGYPTIAN_CLUBS.find((c) => c.id === welcomeClubId) || null
    : null;

  return (
    <div className="fixed inset-0 h-dvh w-screen overflow-hidden bg-[#07080b] text-white">
      {screen === 'splash' && (
        <SplashScreen lang={lang} onFinish={() => setScreen('menu')} />
      )}

      {screen === 'menu' && (
        <MainMenu
          saveData={saveData}
          onStartGame={handleStartGame}
          onOpenLocker={() => {
            setLockerTab('clubs');
            setShowLocker(true);
          }}
          onOpenStandings={() => {
            setLockerTab('standings');
            setShowLocker(true);
          }}
          onOpenSettings={() => setShowSettings(true)}
          onToggleLanguage={handleToggleLanguage}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {screen === 'playing' && (
        <GameView
          mode={activeMode}
          saveData={saveData}
          onExitToMenu={() => {
            setShowLocker(false);
            setScreen('menu');
          }}
          onExitToStandings={() => {
            setScreen('menu');
            setLockerTab('standings');
            setShowLocker(true);
          }}
          onOpenSettings={() => setShowSettings(true)}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
          onRecordTurnResult={handleRecordTurnResult}
        />
      )}

      {showLocker && (
        <LockerModal
          lang={lang}
          saveData={saveData}
          initialTab={lockerTab}
          onClose={() => setShowLocker(false)}
          onBuyOrEquipClub={handleBuyOrEquipClub}
          onBuyOrEquipBall={handleBuyOrEquipBall}
          onStartNewSeason={handleStartNewSeason}
        />
      )}

      <SettingsDrawer
        open={showSettings}
        lang={lang}
        muted={saveData.muted}
        musicEnabled={saveData.musicEnabled !== false}
        onClose={() => setShowSettings(false)}
        onToggleLanguage={handleToggleLanguage}
        onToggleMute={handleToggleMute}
        onToggleMusic={handleToggleMusic}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Celebratory Club Welcome Overlay */}
      {welcomeClub && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="animate-banner-pop relative w-full max-w-md rounded-2xl border-2 border-[#d4af37] bg-[#0c111a] p-5 text-center shadow-[0_0_50px_rgba(212,175,55,0.3)]">
            <button
              type="button"
              onClick={() => setWelcomeClubId(null)}
              aria-label="Close"
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#d4af37]/70 shadow-lg" style={{ backgroundColor: welcomeClub.primary }}>
              <Shield className="h-7 w-7" style={{ color: welcomeClub.secondary }} />
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-extrabold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{t.welcomeClubTitle}</span>
            </div>

            <h2 className="mt-3 text-lg font-black text-white sm:text-xl">
              {t.welcomeClubPrefix}{' '}
              <span className="text-[#f3d26b]">
                {lang === 'ar' ? welcomeClub.nameAr : welcomeClub.nameEn}
              </span>
            </h2>

            <div className="mt-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-300">
              <span>{t.clubRatingLabel}:</span>
              <span className="rounded bg-[#d4af37]/20 px-2 py-0.5 text-[#f3d26b] tabular-nums">
                {welcomeClub.rating}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setWelcomeClubId(null);
                  setShowLocker(false);
                  setActiveMode('shootout');
                  setScreen('playing');
                }}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#d4af37] px-4 text-sm font-black text-[#07080b] hover:bg-[#f0cd5e] transition"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{t.startPlayingNow}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setWelcomeClubId(null);
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-slate-200 hover:bg-white/10 transition"
              >
                {lang === 'ar' ? (
                  <ArrowRight className="h-3.5 w-3.5 text-[#f3d26b]" />
                ) : (
                  <ArrowLeft className="h-3.5 w-3.5 text-[#f3d26b]" />
                )}
                <span>{t.back}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Unlocked Toast */}
      {toastAch && (
        <div className="fixed top-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#d4af37] bg-[#0c1018]/95 px-4 py-2.5 shadow-2xl backdrop-blur-md">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d4af37] text-[#07080b]">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-[#f3d26b]">
              {lang === 'ar' ? toastAch.titleAr : toastAch.titleEn}
            </div>
            <div className="text-[11px] text-slate-300 tabular-nums">
              +{toastAch.reward} {t.coins}
            </div>
          </div>
        </div>
      )}

      {/* Landscape Orientation Guard on Portrait Mobile */}
      {isPortrait && !dismissPortrait && screen !== 'splash' && (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-[#07080b]/95 p-6 text-center backdrop-blur-md">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d4af37]/50 bg-[#0e131d] text-[#d4af37]">
            <RotateCw
              className="h-8 w-8 animate-spin"
              style={{ animationDuration: '3.5s' }}
            />
          </div>
          <h2 className="text-xl font-black text-white">{t.rotateTitle}</h2>
          <p className="mt-2 max-w-xs text-sm text-slate-400">
            {t.rotateDesc}
          </p>
          <div className="mt-5 flex w-full max-w-xs flex-col gap-2.5">
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="min-h-[44px] w-full rounded-xl bg-[#d4af37] text-sm font-black text-[#07080b]"
            >
              {t.fullscreen}
            </button>
            <button
              type="button"
              onClick={() => setDismissPortrait(true)}
              className="min-h-[42px] w-full rounded-xl border border-white/15 bg-white/5 text-xs font-bold text-slate-300"
            >
              {t.continueAnyway}
            </button>
          </div>
        </div>
      )}

      <OfflineIndicator lang={lang} />
    </div>
  );
}

function screenOrientation(): { lock?: (o: string) => Promise<void> } | null {
  return (
    (
      window.screen as unknown as {
        orientation?: { lock?: (o: string) => Promise<void> };
      }
    )?.orientation ?? null
  );
}

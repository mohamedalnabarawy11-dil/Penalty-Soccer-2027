import React, { useState } from 'react';
import {
  Coins,
  Crown,
  Flame,
  Globe,
  ListOrdered,
  Maximize2,
  MessageCircle,
  Play,
  Settings,
  Trophy,
  UserPlus,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { EGYPTIAN_CLUBS, TEXT } from '../data/customization';
import { GameMode, Language, SaveData } from '../types/game';
import { PWAInstallButton } from './PWAInstallButton';
import { soundEngine } from '../game/sound';
import { getScheduledOpponent, sortStandings } from '../utils/storage';

interface MainMenuProps {
  saveData: SaveData;
  onStartGame: (mode: GameMode) => void;
  onOpenLocker: () => void;
  onOpenStandings: () => void;
  onOpenSettings: () => void;
  onToggleLanguage: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  saveData,
  onStartGame,
  onOpenLocker,
  onOpenStandings,
  onOpenSettings,
  onToggleLanguage,
  onToggleMute,
  onToggleFullscreen,
}) => {
  const [imgError, setImgError] = useState(false);
  const lang: Language = saveData.language;
  const t = TEXT[lang];

  const activeClub = saveData.selectedClubId
    ? EGYPTIAN_CLUBS.find((c) => c.id === saveData.selectedClubId) || null
    : null;

  const nextOpponentClub = activeClub
    ? EGYPTIAN_CLUBS.find(
        (c) => c.id === getScheduledOpponent(saveData.league, activeClub.id)
      ) || null
    : null;

  const sortedStandings = sortStandings(saveData.league.standings);
  const currentRank = activeClub
    ? sortedStandings.findIndex((r) => r.clubId === activeClub.id) + 1
    : 0;

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#07080b] px-4 py-3 sm:px-8 sm:py-5">
      {/* Mohamed Salah Stadium Hero Backdrop */}
      {!imgError && (
        <img
          src="/src/assets/images/salah_stadium_hero_1795803760088.jpg"
          alt="Mohamed Salah - Penalty Soccer 2026/2027"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[72%_25%] opacity-85"
        />
      )}

      {/* Measured contrast scrim preserving Salah on the right while keeping UI crisp */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(7,8,11,0.90) 0%, rgba(7,8,11,0.72) 48%, rgba(7,8,11,0.42) 100%), linear-gradient(180deg, rgba(7,8,11,0.72) 0%, rgba(7,8,11,0.18) 45%, rgba(7,8,11,0.88) 100%)',
        }}
      />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between gap-4 border-b border-white/15 pb-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d4af37]/70 bg-[#0e131d]/90">
            <Trophy className="h-4 w-4 text-[#d4af37]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-black tracking-tight text-white sm:text-xl drop-shadow">
                {t.title}
              </h1>
              <span className="shrink-0 rounded border border-[#d4af37]/40 bg-[#d4af37]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#f3d26b] whitespace-nowrap">
                النبراوي · Nabraawy
              </span>
            </div>
            <p className="hidden text-[11px] font-medium text-slate-300 sm:block">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* Utility Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 rounded-lg border border-[#d4af37]/30 bg-black/50 px-2.5 py-1.5 text-sm font-extrabold text-[#f3d26b] tabular-nums backdrop-blur-sm">
            <Coins className="h-4 w-4 text-[#d4af37]" />
            <span>{saveData.coins}</span>
          </div>

          <PWAInstallButton lang={lang} />

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onToggleLanguage();
            }}
            className="flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/15 transition whitespace-nowrap backdrop-blur-sm"
          >
            <Globe className="h-3.5 w-3.5 text-[#d4af37]" />
            <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={saveData.muted ? t.unmute : t.mute}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-slate-200 hover:bg-white/15 transition backdrop-blur-sm"
          >
            {saveData.muted ? (
              <VolumeX className="h-4 w-4 text-red-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-[#d4af37]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onToggleFullscreen();
            }}
            aria-label={t.fullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-slate-200 hover:bg-white/15 transition backdrop-blur-sm"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenSettings();
            }}
            aria-label={t.settings}
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#d4af37]/50 bg-black/60 px-2.5 py-1.5 text-xs font-extrabold text-[#f3d26b] hover:bg-[#d4af37]/20 transition backdrop-blur-sm"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t.settings}</span>
          </button>
        </div>
      </header>

      {/* Main Landscape Grid */}
      <main className="relative z-10 my-auto grid grid-cols-12 items-stretch gap-3 py-2 sm:gap-5">
        {/* Primary Play Column (7 cols) */}
        <div className="col-span-7 flex flex-col justify-center gap-2.5 sm:gap-3">
          {/* Shootout Mode Hero CTA */}
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playClick();
              onStartGame('shootout');
            }}
            className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-[#d4af37]/90 bg-gradient-to-r from-[#d4af37] via-[#e7c555] to-[#b58e22] px-5 py-3 text-start text-[#07080b] shadow-[0_12px_36px_rgba(212,175,55,0.28)] transition active:scale-[0.985] sm:py-4"
          >
            <div className="min-w-0">
              <div className="text-base font-black sm:text-xl">
                {activeClub ? t.playShootout : t.freeAgentPrompt}
              </div>
              <div className="mt-0.5 text-xs font-bold text-[#07080b]/85 sm:text-sm">
                {activeClub && nextOpponentClub
                  ? `${t.roundOfLabel} ${Math.min(
                      saveData.league.matchesPlayed + 1,
                      saveData.league.seasonLength
                    )}/${saveData.league.seasonLength} · ${t.nextMatchVs} ${
                      lang === 'ar'
                        ? nextOpponentClub.nameAr
                        : nextOpponentClub.nameEn
                    }`
                  : t.playShootoutDesc}
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#07080b] text-[#f3d26b] shadow-md group-hover:scale-105 transition-transform">
              <Play className="h-5 w-5 fill-current" />
            </div>
          </button>

          {/* Secondary Mode + Clubs + League Standings Row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playClick();
                onStartGame('streak');
              }}
              className="flex flex-col justify-between rounded-xl border border-[#1a8a4b]/70 bg-[#0c2618]/85 p-2.5 text-start text-white hover:border-[#24b464] hover:bg-[#103320] active:scale-[0.98] transition backdrop-blur-sm sm:p-3"
            >
              <div className="flex items-center justify-between">
                <Flame className="h-4 w-4 text-[#4ade80]" />
                <span className="text-[10px] font-bold text-[#86efac] tabular-nums">
                  {saveData.bestStreak}
                </span>
              </div>
              <div className="mt-1.5">
                <div className="text-xs font-extrabold sm:text-sm line-clamp-1">
                  {t.playStreak}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[10px] text-slate-300">
                  {t.playStreakDesc}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playClick();
                onOpenLocker();
              }}
              className={`flex flex-col justify-between rounded-xl border p-2.5 text-start text-white active:scale-[0.98] transition backdrop-blur-sm sm:p-3 ${
                activeClub
                  ? 'border-[#d4af37]/45 bg-[#0f1420]/85 hover:border-[#d4af37]'
                  : 'border-[#d4af37] bg-[#d4af37]/20 hover:bg-[#d4af37]/30'
              }`}
            >
              <div className="flex items-center justify-between">
                {activeClub ? (
                  <span
                    className="inline-block h-4 w-4 rounded-full border"
                    style={{
                      backgroundColor: activeClub.primary,
                      borderColor: activeClub.secondary,
                    }}
                  />
                ) : (
                  <UserPlus className="h-4 w-4 text-[#f3d26b]" />
                )}
                <span className="text-[10px] font-bold text-[#f3d26b] tabular-nums">
                  {saveData.unlockedClubs.length}/{EGYPTIAN_CLUBS.length}
                </span>
              </div>
              <div className="mt-1.5">
                <div className="text-xs font-extrabold sm:text-sm line-clamp-1">
                  {activeClub
                    ? lang === 'ar'
                      ? activeClub.nameAr
                      : activeClub.nameEn
                    : t.freeAgentTitle}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[10px] text-slate-300">
                  {activeClub ? t.locker : t.freeAgentSubtitle}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playClick();
                onOpenStandings();
              }}
              className="flex flex-col justify-between rounded-xl border border-white/20 bg-[#0e131d]/85 p-2.5 text-start text-white hover:border-[#d4af37]/70 active:scale-[0.98] transition backdrop-blur-sm sm:p-3"
            >
              <div className="flex items-center justify-between">
                <ListOrdered className="h-4 w-4 text-[#f3d26b]" />
                <span className="text-[10px] font-bold text-[#f3d26b] tabular-nums">
                  {currentRank > 0
                    ? `${t.rankBadge} #${currentRank}`
                    : `${saveData.league.matchesPlayed}/${saveData.league.seasonLength}`}
                </span>
              </div>
              <div className="mt-1.5">
                <div className="text-xs font-extrabold sm:text-sm line-clamp-1">
                  {t.standingsTab}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[10px] text-slate-300">
                  {t.seasonLabel} {saveData.league.seasonNumber} ·{' '}
                  {saveData.league.matchesPlayed}/{saveData.league.seasonLength}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Right Club Power & Stats Column (5 cols) */}
        <div className="col-span-5 flex flex-col justify-between rounded-2xl border border-white/15 bg-[#0b0f17]/82 p-3 backdrop-blur-md sm:p-4">
          {activeClub ? (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-200 truncate">
                  {t.clubPowerTitle}
                </span>
                <span className="flex shrink-0 items-center gap-1 rounded-md border border-[#d4af37]/50 bg-[#d4af37]/20 px-2 py-0.5 font-display text-xs font-black text-[#f3d26b] tabular-nums">
                  <Zap className="h-3 w-3" />
                  {activeClub.rating}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1">
                {activeClub.stars.map((star, idx) => (
                  <span
                    key={star.number + '-' + idx}
                    className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-slate-200"
                  >
                    {idx + 1}. {lang === 'ar' ? star.nameAr : star.nameEn}
                  </span>
                ))}
                <span className="rounded-md border border-[#d4af37]/60 bg-[#d4af37]/20 px-1.5 py-0.5 text-[10px] font-black text-[#f3d26b]">
                  5. {t.fifthTakerYou}
                </span>
              </div>

              <div className="mt-1 text-[10px] text-slate-400">
                {t.autoDifficultyNote}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start justify-center gap-1">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#f3d26b]">
                <Crown className="h-4 w-4" />
                <span>{t.freeAgentTitle}</span>
              </div>
              <p className="text-[11px] leading-snug text-slate-300">
                {t.freeAgentSubtitle}
              </p>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onOpenLocker();
                }}
                className="mt-1 rounded-lg bg-[#d4af37] px-3 py-1 text-[11px] font-black text-[#07080b]"
              >
                {t.clubsTab}
              </button>
            </div>
          )}

          {/* Clean Career Telemetry */}
          <div className="my-1.5 grid grid-cols-3 divide-x divide-white/10 rtl:divide-x-reverse border-y border-white/10 py-2 text-center">
            <div>
              <div className="font-display text-lg font-extrabold text-white tabular-nums sm:text-xl">
                {saveData.totalGoals}
              </div>
              <div className="text-[10px] font-medium text-slate-400">
                {t.goals}
              </div>
            </div>
            <div>
              <div className="font-display text-lg font-extrabold text-[#4ade80] tabular-nums sm:text-xl">
                {saveData.totalSaves}
              </div>
              <div className="text-[10px] font-medium text-slate-400">
                {t.saves}
              </div>
            </div>
            <div>
              <div className="font-display text-lg font-extrabold text-[#f3d26b] tabular-nums sm:text-xl">
                {saveData.matchesWon}
              </div>
              <div className="text-[10px] font-medium text-slate-400">
                {t.wins}
              </div>
            </div>
          </div>

          {/* WhatsApp Developer Support Link */}
          <a
            href="https://wa.me/201034910183"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => soundEngine.playClick()}
            className="flex min-h-[36px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-900/60 active:scale-[0.98] transition"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{t.supportDev}</span>
          </a>
        </div>
      </main>

      {/* Quiet Footer Metadata */}
      <footer className="relative z-10 flex items-center justify-between text-[11px] font-medium text-slate-400">
        <span>
          <strong className="text-[#f3d26b]">النبراوي · Nabraawy</strong> · {t.brand}
        </span>
        <span dir="ltr">+20 103 491 0183</span>
      </footer>
    </div>
  );
};

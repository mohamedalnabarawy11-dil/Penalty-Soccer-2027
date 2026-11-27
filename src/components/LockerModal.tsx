import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coins,
  Crown,
  ListOrdered,
  Lock,
  Shield,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  BALLS,
  EGYPTIAN_CLUBS,
  TEXT,
} from '../data/customization';
import { Language, SaveData } from '../types/game';
import { soundEngine } from '../game/sound';
import { sortStandings } from '../utils/storage';

export type LockerTab = 'clubs' | 'standings' | 'balls' | 'achievements';

interface LockerModalProps {
  lang: Language;
  saveData: SaveData;
  initialTab?: LockerTab;
  onClose: () => void;
  onBuyOrEquipClub: (clubId: string) => void;
  onBuyOrEquipBall: (ballId: string) => void;
  onStartNewSeason: () => void;
}

export const LockerModal: React.FC<LockerModalProps> = ({
  lang,
  saveData,
  initialTab = 'clubs',
  onClose,
  onBuyOrEquipClub,
  onBuyOrEquipBall,
  onStartNewSeason,
}) => {
  const [tab, setTab] = useState<LockerTab>(initialTab);
  const t = TEXT[lang];

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const eliteClubs = EGYPTIAN_CLUBS.filter((c) => c.tier === 'elite');
  const otherClubs = EGYPTIAN_CLUBS.filter((c) => c.tier !== 'elite');
  const isFreeAgent = !saveData.selectedClubId;

  const sortedStandings = sortStandings(saveData.league.standings);
  const clubLookup = new Map(EGYPTIAN_CLUBS.map((c) => [c.id, c]));
  const seasonDone =
    saveData.league.matchesPlayed >= saveData.league.seasonLength;

  const renderClubCard = (club: (typeof EGYPTIAN_CLUBS)[number]) => {
    const unlocked = saveData.unlockedClubs.includes(club.id);
    const selected = saveData.selectedClubId === club.id;
    const canAfford = saveData.coins >= club.price;
    const isElite = club.tier === 'elite';

    return (
      <div
        key={club.id}
        className={`flex flex-col justify-between rounded-xl border p-2.5 transition ${
          selected
            ? 'border-[#d4af37] bg-[#d4af37]/12'
            : isElite
            ? 'border-[#d4af37]/40 bg-[#15120a]/90'
            : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        <div className="flex flex-col items-center">
          <div className="flex w-full items-center justify-between text-[10px] font-black">
            <span className="flex items-center gap-0.5 text-[#f3d26b] tabular-nums">
              <Zap className="h-3 w-3" />
              {club.rating}
            </span>
            {isElite && <Crown className="h-3.5 w-3.5 text-[#f3d26b]" />}
          </div>
          <div className="relative my-1 flex h-11 w-11 items-center justify-center rounded-xl bg-[#07090e]">
            <svg viewBox="0 0 64 64" className="h-8 w-8">
              <path
                d="M20 14 L10 22 L16 32 L21 28 L21 52 L43 52 L43 28 L48 32 L54 22 L44 14 L38 18 L26 18 Z"
                fill={club.primary}
                stroke={club.secondary}
                strokeWidth="2.8"
              />
              <text
                x="32"
                y="38"
                textAnchor="middle"
                fill={club.secondary}
                fontSize="13"
                fontWeight="800"
              >
                10
              </text>
            </svg>
          </div>
          <p className="text-center text-xs font-extrabold text-white line-clamp-1">
            {lang === 'ar' ? club.nameAr : club.nameEn}
          </p>
        </div>

        <button
          type="button"
          disabled={!unlocked && !canAfford}
          onClick={() => onBuyOrEquipClub(club.id)}
          className={`mt-2 flex min-h-[34px] w-full items-center justify-center gap-1 rounded-lg text-[11px] font-bold transition ${
            selected
              ? 'bg-[#d4af37] text-[#07080b]'
              : unlocked
              ? 'bg-white/10 text-white hover:bg-white/20'
              : canAfford
              ? 'bg-[#0e6b38] text-white hover:bg-[#138547]'
              : 'cursor-not-allowed bg-white/5 text-slate-500'
          }`}
        >
          {selected ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>{t.equipped}</span>
            </>
          ) : unlocked ? (
            <span>{t.equip}</span>
          ) : (
            <>
              <Lock className="h-3 w-3" />
              <span className="tabular-nums">
                {t.buy} · {club.price}
              </span>
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md">
      <div className="flex h-full max-h-[460px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#d4af37]/35 bg-[#0c1018] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onClose();
              }}
              className="flex min-h-[34px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-extrabold text-white hover:bg-white/15 transition"
            >
              {lang === 'ar' ? (
                <ArrowRight className="h-3.5 w-3.5 text-[#f3d26b]" />
              ) : (
                <ArrowLeft className="h-3.5 w-3.5 text-[#f3d26b]" />
              )}
              <span>{t.back}</span>
            </button>
            <h2 className="text-sm font-extrabold text-white sm:text-lg">
              {tab === 'standings' ? t.leagueTableTitle : t.locker}
            </h2>
            <div className="flex items-center gap-1.5 text-sm font-bold text-[#f3d26b] tabular-nums">
              <Coins className="h-4 w-4 text-[#d4af37]" />
              <span>{saveData.coins}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setTab('clubs');
                }}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  tab === 'clubs'
                    ? 'bg-[#d4af37] text-[#07080b]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Crown className="h-3.5 w-3.5" />
                <span>{t.kits}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setTab('standings');
                }}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  tab === 'standings'
                    ? 'bg-[#d4af37] text-[#07080b]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                <span>{t.standingsTab}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setTab('balls');
                }}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  tab === 'balls'
                    ? 'bg-[#d4af37] text-[#07080b]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                <span>{t.balls}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setTab('achievements');
                }}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  tab === 'achievements'
                    ? 'bg-[#d4af37] text-[#07080b]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Trophy className="h-3.5 w-3.5" />
                <span>{t.achievements}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3.5">
          {tab === 'clubs' && (
            <div className="space-y-4">
              {isFreeAgent && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d4af37]/50 bg-[#d4af37]/10 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 shrink-0 text-[#f3d26b]" />
                    <span className="text-xs font-extrabold text-white sm:text-sm">
                      {t.freeAgentPrompt}
                    </span>
                  </div>
                  <span className="shrink-0 font-display text-sm font-black text-[#f3d26b] tabular-nums">
                    {saveData.coins} {t.coins}
                  </span>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[#f3d26b]">
                  <Crown className="h-3.5 w-3.5" />
                  <span>{t.eliteTier}</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {eliteClubs.map(renderClubCard)}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-bold text-slate-300">
                  {t.leagueTier}
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
                  {otherClubs.map(renderClubCard)}
                </div>
              </div>
            </div>
          )}

          {tab === 'standings' && (
            <div className="space-y-3">
              {/* Season Status & Position Reward Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                <div className="text-xs font-bold text-slate-200">
                  {t.seasonLabel} {saveData.league.seasonNumber} ·{' '}
                  <span className="text-[#f3d26b] tabular-nums">
                    {t.roundOfLabel} {saveData.league.matchesPlayed} /{' '}
                    {saveData.league.seasonLength}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-400">
                  {t.seasonRewardsInfo}
                </div>
              </div>

              {seasonDone && saveData.league.pendingSeasonReward && (() => {
                const championRow = sortedStandings[0];
                const championClub = championRow
                  ? clubLookup.get(championRow.clubId)
                  : undefined;
                const isPlayerChampion =
                  saveData.league.pendingSeasonReward.rank === 1;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#d4af37] bg-gradient-to-r from-[#d4af37]/25 via-[#f4ce65]/20 to-[#d4af37]/15 px-4 py-3 shadow-lg">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-[#f3d26b]">
                        <Trophy className="h-4 w-4" />
                        <span>
                          {isPlayerChampion
                            ? t.seasonChampionYou
                            : t.seasonCompleteTitle}
                        </span>
                      </div>
                      {championClub && (
                        <div className="text-xs font-extrabold text-white">
                          {t.leagueChampionLabel}:{' '}
                          <span className="text-[#f3d26b]">
                            {lang === 'ar'
                              ? championClub.nameAr
                              : championClub.nameEn}
                          </span>{' '}
                          ({championRow.points} {t.ptsCol})
                        </div>
                      )}
                      <div className="text-xs font-bold text-slate-200 tabular-nums">
                        {t.yourFinalRank}: #
                        {saveData.league.pendingSeasonReward.rank} ·{' '}
                        {t.seasonRewardEarned}: +
                        {saveData.league.pendingSeasonReward.coins} {t.coins}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onStartNewSeason();
                      }}
                      className="rounded-lg bg-[#d4af37] px-3.5 py-2 text-xs font-black text-[#07080b] hover:bg-[#f0cd5e] transition"
                    >
                      {t.startNewSeason}
                    </button>
                  </div>
                );
              })()}

              {/* Standings Table */}
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#080b10]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04] text-[11px] font-bold text-slate-400">
                      <th className="px-2.5 py-2 text-center w-9">{t.rankCol}</th>
                      <th className="px-2.5 py-2 text-start">{t.clubCol}</th>
                      <th className="px-2 py-2 text-center">{t.playedCol}</th>
                      <th className="px-2 py-2 text-center">{t.wonCol}</th>
                      <th className="px-2 py-2 text-center">{t.lostCol}</th>
                      <th className="px-2 py-2 text-center">{t.gdCol}</th>
                      <th className="px-3 py-2 text-center text-[#f3d26b]">
                        {t.ptsCol}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedStandings.map((row, idx) => {
                      const c = clubLookup.get(row.clubId);
                      if (!c) return null;
                      const isPlayerClub = c.id === saveData.selectedClubId;
                      const gd = row.goalsFor - row.goalsAgainst;
                      const rank = idx + 1;
                      return (
                        <tr
                          key={row.clubId}
                          className={
                            isPlayerClub
                              ? 'bg-[#d4af37]/16 font-extrabold text-white'
                              : 'text-slate-300 hover:bg-white/[0.02]'
                          }
                        >
                          <td className="px-2.5 py-1.5 text-center font-display font-black tabular-nums">
                            <span
                              className={
                                rank === 1
                                  ? 'text-[#f3d26b]'
                                  : rank <= 3
                                  ? 'text-emerald-400'
                                  : 'text-slate-400'
                              }
                            >
                              {rank}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full border"
                                style={{
                                  backgroundColor: c.primary,
                                  borderColor: c.secondary,
                                }}
                              />
                              <span className="truncate">
                                {lang === 'ar' ? c.nameAr : c.nameEn}
                              </span>
                              {isPlayerClub && (
                                <span className="text-[10px] font-black text-[#f3d26b]">
                                  ★
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center tabular-nums">
                            {row.played}
                          </td>
                          <td className="px-2 py-1.5 text-center text-emerald-400 tabular-nums">
                            {row.won}
                          </td>
                          <td className="px-2 py-1.5 text-center text-red-400 tabular-nums">
                            {row.lost}
                          </td>
                          <td className="px-2 py-1.5 text-center tabular-nums">
                            {gd > 0 ? `+${gd}` : gd}
                          </td>
                          <td className="px-3 py-1.5 text-center font-display text-sm font-black text-[#f3d26b] tabular-nums">
                            {row.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'balls' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BALLS.map((ball) => {
                const unlocked = saveData.unlockedBalls.includes(ball.id);
                const selected = saveData.selectedBallId === ball.id;
                const canAfford = saveData.coins >= ball.price;

                return (
                  <div
                    key={ball.id}
                    className={`flex flex-col justify-between rounded-xl border p-3.5 transition ${
                      selected
                        ? 'border-[#d4af37] bg-[#d4af37]/10'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="my-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#07090e]">
                        <svg viewBox="0 0 64 64" className="h-11 w-11">
                          <circle
                            cx="32"
                            cy="32"
                            r="24"
                            fill={ball.baseColor}
                            stroke={ball.accentColor}
                            strokeWidth="2.5"
                          />
                          <polygon
                            points="32,20 42,27 38,39 26,39 22,27"
                            fill={ball.panelColor}
                          />
                        </svg>
                      </div>
                      <p className="text-center text-xs font-bold text-white">
                        {lang === 'ar' ? ball.nameAr : ball.nameEn}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!unlocked && !canAfford}
                      onClick={() => onBuyOrEquipBall(ball.id)}
                      className={`mt-3 flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
                        selected
                          ? 'bg-[#d4af37] text-[#07080b]'
                          : unlocked
                          ? 'bg-white/10 text-white hover:bg-white/20'
                          : canAfford
                          ? 'bg-[#0e6b38] text-white hover:bg-[#138547]'
                          : 'cursor-not-allowed bg-white/5 text-slate-500'
                      }`}
                    >
                      {selected ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>{t.equipped}</span>
                        </>
                      ) : unlocked ? (
                        <span>{t.equip}</span>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          <span className="tabular-nums">
                            {t.buy} · {ball.price}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'achievements' && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ACHIEVEMENTS.map((ach) => {
                const done = saveData.unlockedAchievements.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`flex items-center justify-between rounded-xl border p-3.5 ${
                      done
                        ? 'border-[#d4af37]/60 bg-[#d4af37]/10'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          done
                            ? 'bg-[#d4af37] text-[#07080b]'
                            : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        <Trophy className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          {lang === 'ar' ? ach.titleAr : ach.titleEn}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {lang === 'ar' ? ach.descAr : ach.descEn}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-end">
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          done ? 'text-[#f3d26b]' : 'text-slate-400'
                        }`}
                      >
                        +{ach.reward}
                      </span>
                      <div className="text-[11px] text-slate-400">
                        {done ? t.unlocked : t.locked}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

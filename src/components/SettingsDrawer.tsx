import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Maximize2,
  MessageCircle,
  Music,
  Settings,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { TEXT } from '../data/customization';
import { soundEngine } from '../game/sound';
import { Language } from '../types/game';

interface SettingsDrawerProps {
  open: boolean;
  lang: Language;
  muted: boolean;
  musicEnabled: boolean;
  onClose: () => void;
  onToggleLanguage: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onToggleFullscreen: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  lang,
  muted,
  musicEnabled,
  onClose,
  onToggleLanguage,
  onToggleMute,
  onToggleMusic,
  onToggleFullscreen,
}) => {
  if (!open) return null;

  const t = TEXT[lang];
  const isRtl = lang === 'ar';

  return (
    <div className="fixed inset-0 z-[80] flex">
      {/* Backdrop */}
      <div
        onClick={() => {
          soundEngine.playClick();
          onClose();
        }}
        className="flex-1 bg-black/70 backdrop-blur-sm"
      />

      {/* Side Settings Drawer */}
      <aside
        dir={isRtl ? 'rtl' : 'ltr'}
        className="flex h-full w-full max-w-xs flex-col justify-between border-s border-[#d4af37]/35 bg-[#0b0f17] p-4 shadow-2xl sm:max-w-sm"
      >
        <div className="flex flex-col gap-3 overflow-y-auto">
          {/* Header with explicit Back Button */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onClose();
              }}
              className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-white/15 transition"
            >
              {isRtl ? (
                <ArrowRight className="h-3.5 w-3.5 text-[#f3d26b]" />
              ) : (
                <ArrowLeft className="h-3.5 w-3.5 text-[#f3d26b]" />
              )}
              <span>{t.back}</span>
            </button>

            <div className="flex items-center gap-2 text-sm font-black text-[#f3d26b]">
              <Settings className="h-4 w-4" />
              <span>{t.settings}</span>
            </div>
          </div>

          {/* Language Selector (Arabic & English) */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-200">
              <Globe className="h-3.5 w-3.5 text-[#d4af37]" />
              <span>{t.languageLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  if (lang !== 'ar') onToggleLanguage();
                }}
                className={`min-h-[38px] rounded-lg border text-xs font-extrabold transition ${
                  lang === 'ar'
                    ? 'border-[#d4af37] bg-[#d4af37] text-[#07080b]'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  if (lang !== 'en') onToggleLanguage();
                }}
                className={`min-h-[38px] rounded-lg border text-xs font-extrabold transition ${
                  lang === 'en'
                    ? 'border-[#d4af37] bg-[#d4af37] text-[#07080b]'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Sound & Fullscreen */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 text-xs font-bold text-white hover:bg-white/10 transition"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-red-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-[#d4af37]" />
              )}
              <span>{muted ? t.unmute : t.mute}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onToggleFullscreen();
              }}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 text-xs font-bold text-white hover:bg-white/10 transition"
            >
              <Maximize2 className="h-4 w-4 text-[#d4af37]" />
              <span>{t.fullscreen}</span>
            </button>
          </div>

          {/* Official Egypt Cheer Anthem Toggle */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onToggleMusic();
            }}
            className={`flex min-h-[44px] w-full items-center justify-between rounded-xl border px-3.5 text-xs font-extrabold transition ${
              musicEnabled && !muted
                ? 'border-[#d4af37]/60 bg-[#d4af37]/15 text-[#f3d26b]'
                : 'border-white/15 bg-white/[0.03] text-slate-300 hover:bg-white/10'
            }`}
          >
            <span className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              <span>{t.officialAnthemLabel}</span>
            </span>
            <span className="rounded bg-black/40 px-2 py-0.5 text-[10px]">
              {musicEnabled ? t.anthemOn : t.anthemOff}
            </span>
          </button>

          {/* Creator & Game Credits */}
          <div className="rounded-xl border border-[#d4af37]/30 bg-gradient-to-br from-[#d4af37]/10 to-transparent p-3.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#f3d26b]">
              <ShieldCheck className="h-4 w-4" />
              <span>{t.gameInfoLabel}</span>
            </div>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>{t.creatorLabel}:</span>
                <strong className="text-white">{t.creatorName}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>{t.title}</span>
                <span className="font-mono text-[11px]">v2.0</span>
              </div>
            </div>
          </div>

          {/* Developer Support (WhatsApp) */}
          <a
            href="https://wa.me/201034910183"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => soundEngine.playClick()}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/45 bg-emerald-950/60 px-4 text-xs font-extrabold text-emerald-300 hover:bg-emerald-900/60 transition"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span>{t.supportDev}</span>
          </a>
        </div>

        {/* Bottom Back CTA */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onClose();
          }}
          className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] text-sm font-black text-[#07080b] hover:bg-[#f0cd5e] transition"
        >
          {isRtl ? (
            <ArrowRight className="h-4 w-4" />
          ) : (
            <ArrowLeft className="h-4 w-4" />
          )}
          <span>{t.back}</span>
        </button>
      </aside>
    </div>
  );
};

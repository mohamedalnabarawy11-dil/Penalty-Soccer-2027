import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Language } from '../types/game';
import { TEXT } from '../data/customization';
import { soundEngine } from '../game/sound';

interface SplashScreenProps {
  lang: Language;
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  lang,
  onFinish,
}) => {
  const t = TEXT[lang];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onFinish();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [onFinish]);

  const handleTap = () => {
    soundEngine.unlock();
    onFinish();
  };

  return (
    <div
      onClick={handleTap}
      className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden bg-[#07080b]"
    >
      {/* Subtle night stadium spotlight sweep */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(212, 175, 55, 0.16) 0%, rgba(13, 91, 45, 0.08) 38%, rgba(7, 8, 11, 0.96) 76%)',
        }}
      />

      {/* Gold crest & brand mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.84 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#d4af37]/80 bg-[#0d1118] shadow-[0_0_45px_rgba(212,175,55,0.28)]">
          <svg viewBox="0 0 64 64" className="h-11 w-11">
            <circle
              cx="32"
              cy="34"
              r="20"
              fill="#f8fafc"
              stroke="#d4af37"
              strokeWidth="2.5"
            />
            <polygon
              points="32,22 41,29 38,40 26,40 23,29"
              fill="#11151d"
            />
            <path
              d="M20 12 L25 5 L32 10 L39 5 L44 12 Z"
              fill="#d4af37"
            />
          </svg>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="gold-shimmer text-5xl font-black tracking-tight sm:text-6xl"
        >
          {t.brand}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="mt-2 font-display text-sm font-bold tracking-[0.28em] text-slate-300 uppercase"
        >
          PENALTY SOCCER 2026 / 2027
        </motion.p>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 1.5, ease: 'easeInOut' }}
          className="mt-6 h-0.5 w-44 origin-center bg-gradient-to-r from-transparent via-[#d4af37] to-transparent"
        />

        <span className="mt-4 text-xs font-medium text-slate-500">
          {t.tapToSkip}
        </span>
      </motion.div>
    </div>
  );
};

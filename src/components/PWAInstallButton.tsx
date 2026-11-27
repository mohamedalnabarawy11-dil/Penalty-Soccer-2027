import React, { useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { Language } from '../types/game';
import { TEXT } from '../data/customization';

interface PWAInstallButtonProps {
  lang: Language;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const t = TEXT[lang];

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-lg bg-[#d4af37] px-3.5 py-2 text-xs font-bold text-[#07080b] shadow-md hover:bg-[#f1cd5e] active:scale-95 transition whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="w-4 h-4" />
        <span>{t.installApp}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-lg border border-[#d4af37]/50 bg-[#141720] px-3 py-2 text-xs font-semibold text-[#f3d26b] hover:bg-[#1e2330] transition whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Download className="w-4 h-4" />
          <span>{t.installIos}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-[#d4af37]/40 bg-[#0d1017] p-5 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-[#f3d26b]">
                  {t.installIos}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {lang === 'ar'
                  ? '1. اضغط على زر المشاركة (Share) في شريط سفاري.\n2. اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                  : '1. Tap the Share button in Safari.\n2. Scroll down and tap Add to Home Screen.'}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-[#d4af37] py-2.5 text-xs font-bold text-[#07080b]"
              >
                {lang === 'ar' ? 'حسناً' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC<{ lang: Language }> = ({ lang }) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 rounded-lg border border-[#d4af37]/40 bg-[#0b0e14]/95 px-3 py-1.5 text-xs font-semibold text-[#f3d26b] shadow-lg backdrop-blur-md">
      <WifiOff className="w-3.5 h-3.5" />
      <span>{TEXT[lang].offlineBanner}</span>
    </div>
  );
};

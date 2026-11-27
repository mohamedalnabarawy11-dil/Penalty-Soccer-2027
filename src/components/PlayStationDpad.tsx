import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { soundEngine } from '../game/sound';

interface PlayStationDpadProps {
  disabled?: boolean;
  onDirectionChange: (dx: number, dy: number) => void;
  onNudge: (dx: number, dy: number) => void;
}

type DirKey = 'up' | 'down' | 'left' | 'right' | null;

export const PlayStationDpad: React.FC<PlayStationDpadProps> = ({
  disabled = false,
  onDirectionChange,
  onNudge,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [activeDir, setActiveDir] = useState<DirKey>(null);

  const computeDirFromPoint = (
    clientX: number,
    clientY: number
  ): { dir: DirKey; dx: number; dy: number } => {
    const el = containerRef.current;
    if (!el) return { dir: null, dx: 0, dy: 0 };
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const vx = clientX - cx;
    const vy = clientY - cy;

    if (Math.hypot(vx, vy) < 10) {
      return { dir: null, dx: 0, dy: 0 };
    }

    if (Math.abs(vx) > Math.abs(vy)) {
      return vx > 0
        ? { dir: 'right', dx: 1, dy: 0 }
        : { dir: 'left', dx: -1, dy: 0 };
    } else {
      return vy > 0
        ? { dir: 'down', dx: 0, dy: 1 }
        : { dir: 'up', dx: 0, dy: -1 };
    }
  };

  const triggerStep = (dir: DirKey, dx: number, dy: number) => {
    if (dir && dir !== activeDir) {
      soundEngine.unlock();
      onNudge(dx * 0.34, -dy * 0.24);
    }
    setActiveDir(dir);
    onDirectionChange(dx, dy);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    const res = computeDirFromPoint(e.clientX, e.clientY);
    triggerStep(res.dir, res.dx, res.dy);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    const res = computeDirFromPoint(e.clientX, e.clientY);
    if (res.dir !== activeDir) {
      setActiveDir(res.dir);
      onDirectionChange(res.dx, res.dy);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    activePointerId.current = null;
    setActiveDir(null);
    onDirectionChange(0, 0);
  };

  const pieceBase =
    'flex items-center justify-center border transition-all duration-75 shadow-md';
  const pieceIdle =
    'border-white/25 bg-black/45 text-white/90';
  const pieceActive =
    'border-[#f6de87] bg-[#d4af37] text-[#07080b] scale-95 shadow-[0_0_14px_rgba(212,175,55,0.65)]';

  return (
    <div
      ref={containerRef}
      dir="ltr"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative grid h-28 w-28 touch-none grid-cols-3 grid-rows-3 gap-0.5 rounded-2xl border border-white/15 bg-black/25 p-1 backdrop-blur-[2px] sm:h-32 sm:w-32 ${
        disabled ? 'pointer-events-none opacity-40' : 'cursor-pointer'
      }`}
    >
      {/* Top-Left Spacer */}
      <div />

      {/* UP */}
      <div
        className={`${pieceBase} ${
          activeDir === 'up' ? pieceActive : pieceIdle
        } rounded-t-xl rounded-b-sm`}
      >
        <ChevronUp className="h-6 w-6 stroke-[2.75]" />
      </div>

      {/* Top-Right Spacer */}
      <div />

      {/* LEFT */}
      <div
        className={`${pieceBase} ${
          activeDir === 'left' ? pieceActive : pieceIdle
        } rounded-l-xl rounded-r-sm`}
      >
        <ChevronLeft className="h-6 w-6 stroke-[2.75]" />
      </div>

      {/* Center PlayStation Pivot */}
      <div className="flex items-center justify-center rounded-md bg-[#090c12]/90 border border-white/10">
        <div className="h-3.5 w-3.5 rounded-full border border-[#d4af37]/50 bg-[#151a24]" />
      </div>

      {/* RIGHT */}
      <div
        className={`${pieceBase} ${
          activeDir === 'right' ? pieceActive : pieceIdle
        } rounded-r-xl rounded-l-sm`}
      >
        <ChevronRight className="h-6 w-6 stroke-[2.75]" />
      </div>

      {/* Bottom-Left Spacer */}
      <div />

      {/* DOWN */}
      <div
        className={`${pieceBase} ${
          activeDir === 'down' ? pieceActive : pieceIdle
        } rounded-b-xl rounded-t-sm`}
      >
        <ChevronDown className="h-6 w-6 stroke-[2.75]" />
      </div>

      {/* Bottom-Right Spacer */}
      <div />
    </div>
  );
};

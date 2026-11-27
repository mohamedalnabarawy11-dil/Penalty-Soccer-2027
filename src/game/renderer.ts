import { BallOption, DiveDirection, EgyptianClub, Language } from '../types/game';
import {
  BALL_RADIUS,
  GOAL_DEPTH,
  GOAL_H,
  GOAL_HALF_W,
  PENALTY_Z,
  PenaltyEngine,
  Vec3,
} from './engine';

interface Projected {
  x: number;
  y: number;
  scale: number;
  depth: number;
}

interface CameraBasis {
  pos: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  focal: number;
  cx: number;
  cy: number;
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function buildCamera(
  engine: PenaltyEngine,
  width: number,
  height: number
): CameraBasis {
  const forward = normalize({
    x: engine.cameraLook.x - engine.cameraPos.x,
    y: engine.cameraLook.y - engine.cameraPos.y,
    z: engine.cameraLook.z - engine.cameraPos.z,
  });
  const worldUp = { x: 0, y: 1, z: 0 };
  const right = normalize(cross(forward, worldUp));
  const up = cross(right, forward);

  let shakeX = 0;
  let shakeY = 0;
  if (engine.shakeTime > 0) {
    const mag = engine.shakeIntensity * (engine.shakeTime / 0.36);
    shakeX = (Math.random() - 0.5) * mag * 2;
    shakeY = (Math.random() - 0.5) * mag * 2;
  }

  return {
    pos: engine.cameraPos,
    forward,
    right,
    up,
    focal: Math.max(width * 0.62, height * 1.08),
    cx: width / 2 + shakeX,
    cy: height * 0.49 + shakeY,
  };
}

function project(p: Vec3, cam: CameraBasis): Projected | null {
  const dx = p.x - cam.pos.x;
  const dy = p.y - cam.pos.y;
  const dz = p.z - cam.pos.z;

  const depth = dx * cam.forward.x + dy * cam.forward.y + dz * cam.forward.z;
  if (depth <= 0.35) return null;

  const rx = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
  const ry = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;

  const scale = cam.focal / depth;
  return {
    x: cam.cx + rx * scale,
    y: cam.cy - ry * scale,
    scale,
    depth,
  };
}

function drawQuad3D(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  pts: Vec3[],
  fillStyle: string | CanvasGradient
) {
  const projected: Projected[] = [];
  for (const p of pts) {
    const pr = project(p, cam);
    if (!pr) return;
    projected.push(pr);
  }
  ctx.beginPath();
  ctx.moveTo(projected[0].x, projected[0].y);
  for (let i = 1; i < projected.length; i++) {
    ctx.lineTo(projected[i].x, projected[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function drawLine3D(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  a: Vec3,
  b: Vec3,
  color: string,
  widthMeters = 0.08,
  minPx = 1
) {
  const pa = project(a, cam);
  const pb = project(b, cam);
  if (!pa || !pb) return;
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(minPx, ((pa.scale + pb.scale) * 0.5) * widthMeters);
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawLimb3D(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  pA: Vec3,
  pB: Vec3,
  radiusA: number,
  radiusB: number,
  baseColor: string,
  shadeColor: string
) {
  const a = project(pA, cam);
  const b = project(pB, cam);
  if (!a || !b) return;

  const rA = Math.max(2, radiusA * a.scale);
  const rB = Math.max(1.8, radiusB * b.scale);

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const grad = ctx.createLinearGradient(
    a.x - nx * rA,
    a.y - ny * rA,
    a.x + nx * rA,
    a.y + ny * rA
  );
  grad.addColorStop(0, baseColor);
  grad.addColorStop(0.6, baseColor);
  grad.addColorStop(1, shadeColor);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(a.x - nx * rA, a.y - ny * rA);
  ctx.lineTo(b.x - nx * rB, b.y - ny * rB);
  ctx.lineTo(b.x + nx * rB, b.y + ny * rB);
  ctx.lineTo(a.x + nx * rA, a.y + ny * rA);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(a.x, a.y, rA, 0, Math.PI * 2);
  ctx.arc(b.x, b.y, rB, 0, Math.PI * 2);
  ctx.fill();
}

function shadeHex(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 'rgba(0,0,0,0.65)';
  const r = Math.max(
    0,
    Math.min(255, Math.round(parseInt(clean.slice(0, 2), 16) * factor))
  );
  const g = Math.max(
    0,
    Math.min(255, Math.round(parseInt(clean.slice(2, 4), 16) * factor))
  );
  const b = Math.max(
    0,
    Math.min(255, Math.round(parseInt(clean.slice(4, 6), 16) * factor))
  );
  return `rgb(${r}, ${g}, ${b})`;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  engine: PenaltyEngine,
  club: EgyptianClub,
  opponentClub: EgyptianClub,
  ballSkin: BallOption,
  lang: Language
) {
  const cam = buildCamera(engine, width, height);

  // 1. Night Sky & Stadium Atmosphere
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.65);
  skyGrad.addColorStop(0, '#03050a');
  skyGrad.addColorStop(0.5, '#09101d');
  skyGrad.addColorStop(1, '#132033');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Horizon / Stands Base (Always looking toward goal!)
  const horizonP = project({ x: 0, y: 0, z: -18 }, cam);
  const horizonY = horizonP
    ? Math.max(height * 0.18, Math.min(height * 0.5, horizonP.y))
    : height * 0.36;

  // 3D Floodlight towers & volumetric beams
  drawFloodlights3D(ctx, cam, width, height, horizonY);

  // Stadium Roof & Upper Bowl Architecture
  drawStadiumArchitecture(ctx, cam, width, height, horizonY);

  // 2. Mowed Turf Surface with 3D perspective stripes
  const turfGrad = ctx.createLinearGradient(0, horizonY, 0, height);
  turfGrad.addColorStop(0, '#083a1d');
  turfGrad.addColorStop(0.42, '#0d5e2f');
  turfGrad.addColorStop(1, '#07351a');
  ctx.fillStyle = turfGrad;
  ctx.fillRect(0, horizonY, width, height - horizonY);

  for (let i = -3; i < 18; i++) {
    if (i % 2 !== 0) continue;
    const z1 = i * 1.35;
    const z2 = (i + 1) * 1.35;
    drawQuad3D(
      ctx,
      cam,
      [
        { x: -25, y: 0, z: z1 },
        { x: 25, y: 0, z: z1 },
        { x: 25, y: 0, z: z2 },
        { x: -25, y: 0, z: z2 },
      ],
      'rgba(255, 255, 255, 0.036)'
    );
  }

  const spotCenter = project({ x: 0, y: 0, z: 6.5 }, cam);
  if (spotCenter) {
    const glowR = width * 0.58;
    const rad = ctx.createRadialGradient(
      spotCenter.x,
      spotCenter.y,
      glowR * 0.08,
      spotCenter.x,
      spotCenter.y,
      glowR
    );
    rad.addColorStop(0, 'rgba(255, 250, 220, 0.14)');
    rad.addColorStop(0.58, 'rgba(34, 197, 94, 0.05)');
    rad.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, horizonY, width, height - horizonY);
  }

  // 3. Animated Crowd & 3D Perimeter LED Boards
  drawCrowd(ctx, cam, engine);
  drawAdBoards3D(ctx, cam, width, club, opponentClub, lang);

  // 4. Pitch Lines + 3D Penalty Arc + Corner Flags
  drawPitchLines(ctx, cam, engine.crowdTime, club.primary);

  // 5. Goal & Net (Always facing the goal from the main stadium angle!)
  drawGoalAndNet(ctx, cam, engine);

  // 6. Goalkeeper (Your club GK in Save mode, Opponent GK in Shoot mode)
  const keeperClub = engine.role === 'shoot' ? opponentClub : club;
  drawGoalkeeper3D(ctx, cam, engine, keeperClub);

  // 7. Save Mode Pre-Selected Dive Cue OR Shoot Mode Trajectory & Reticle
  if (
    engine.role === 'save' &&
    engine.phase === 'aiming' &&
    engine.preselectedDive
  ) {
    drawPreselectedDiveCue(ctx, cam, engine.preselectedDive, engine.crowdTime);
  }
  drawTrajectoryAndReticle(ctx, cam, engine);

  // 8. Left & Right Waiting Team Huddles (4-5 players per team shoulder-to-shoulder!)
  drawTeamHuddles3D(ctx, cam, engine, club, opponentClub);

  // 9. Striker & Ball (Skip striker during huddle so the two standing teams take center stage!)
  const strikerClub = engine.role === 'shoot' ? club : opponentClub;
  if (engine.phase !== 'huddle') {
    if (engine.ballCarried) {
      drawStriker3D(ctx, cam, engine, strikerClub);
      drawBall(ctx, cam, engine, ballSkin);
    } else {
      drawBall(ctx, cam, engine, ballSkin);
      drawStriker3D(ctx, cam, engine, strikerClub);
    }
  } else {
    drawBall(ctx, cam, engine, ballSkin);
  }

  // 10. Particles (turf dust & gold goal confetti)
  for (const p of engine.particles) {
    const pr = project(p, cam);
    if (!pr) continue;
    const alpha = Math.max(0, 1 - p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(
      pr.x,
      pr.y,
      Math.max(1.5, p.size * (pr.scale / 85)),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 11. Smooth Fade-to-Black Curtain
  if (engine.curtainAlpha > 0.005) {
    ctx.fillStyle = `rgba(5, 6, 9, ${engine.curtainAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawFloodlights3D(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  width: number,
  height: number,
  horizonY: number
) {
  const zPos = -14;
  const towers3D = [
    { x: -19, y: 12.5, z: zPos },
    { x: -9, y: 13.8, z: zPos - 2 },
    { x: 9, y: 13.8, z: zPos - 2 },
    { x: 19, y: 12.5, z: zPos },
  ];

  for (const t3 of towers3D) {
    const top = project(t3, cam);
    const base = project({ x: t3.x, y: 4.5, z: t3.z }, cam);
    if (!top) continue;

    if (base) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = Math.max(2, top.scale * 0.14);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
    }

    const beam = ctx.createLinearGradient(
      top.x,
      top.y,
      width * 0.5,
      horizonY + height * 0.3
    );
    beam.addColorStop(0, 'rgba(255, 248, 220, 0.18)');
    beam.addColorStop(0.5, 'rgba(255, 248, 220, 0.04)');
    beam.addColorStop(1, 'rgba(255, 248, 220, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(top.x - 18, top.y);
    ctx.lineTo(top.x + 18, top.y);
    ctx.lineTo(top.x + width * 0.22, horizonY + height * 0.36);
    ctx.lineTo(top.x - width * 0.22, horizonY + height * 0.36);
    ctx.closePath();
    ctx.fill();

    const halo = ctx.createRadialGradient(top.x, top.y, 2, top.x, top.y, 38);
    halo.addColorStop(0, 'rgba(255, 253, 244, 0.96)');
    halo.addColorStop(0.28, 'rgba(244, 210, 110, 0.48)');
    halo.addColorStop(1, 'rgba(244, 210, 110, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(top.x, top.y, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(top.x - 10, top.y - 4, 20, 8);
  }
}

function drawStadiumArchitecture(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  width: number,
  height: number,
  horizonY: number
) {
  ctx.fillStyle = '#090e17';
  ctx.fillRect(0, horizonY - height * 0.19, width, height * 0.2);

  for (let tier = 0; tier < 4; tier++) {
    const y = 1.4 + tier * 1.45;
    const z = -5.8 - tier * 1.9;
    drawLine3D(
      ctx,
      cam,
      { x: -24, y, z },
      { x: 24, y, z },
      'rgba(148, 163, 184, 0.14)',
      0.06,
      1
    );
  }

  drawLine3D(
    ctx,
    cam,
    { x: -26, y: 7.4, z: -11.5 },
    { x: 26, y: 7.4, z: -11.5 },
    'rgba(212, 175, 55, 0.22)',
    0.1,
    1.5
  );
}

function drawCrowd(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  engine: PenaltyEngine
) {
  const speed = 3.2 + engine.crowdExcitement * 9;
  const amp = 0.06 + engine.crowdExcitement * 0.22;

  for (const d of engine.crowdDots) {
    const bounce = Math.abs(Math.sin(engine.crowdTime * speed + d.phase)) * amp;
    const pr = project({ x: d.x, y: d.y + bounce, z: d.z }, cam);
    if (!pr) continue;
    const r = Math.max(1.8, pr.scale * 0.12);
    ctx.fillStyle = d.color;
    ctx.globalAlpha = 0.74;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const f of engine.flashes) {
    const pr = project(f, cam);
    if (!pr) continue;
    const alpha = f.life / 0.18;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.92})`;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAdBoards3D(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  width: number,
  club: EgyptianClub,
  opponentClub: EgyptianClub,
  lang: Language
) {
  const clubTitle = lang === 'ar' ? club.nameAr : club.nameEn;
  const oppTitle = lang === 'ar' ? opponentClub.shortAr : opponentClub.shortEn;
  const boards = [
    {
      x1: -14.5,
      x2: -5.6,
      label: lang === 'ar' ? 'الدوري المصري' : 'EGYPTIAN LEAGUE',
      bg: '#090c12',
      fg: '#d4af37',
    },
    {
      x1: -5.5,
      x2: 5.5,
      label: `${clubTitle} × ${oppTitle}`,
      bg: '#111723',
      fg: club.accent,
    },
    {
      x1: 5.6,
      x2: 14.5,
      label: 'PENALTY SOCCER 26/27',
      bg: '#090c12',
      fg: '#d4af37',
    },
  ];
  for (const b of boards) {
    drawQuad3D(
      ctx,
      cam,
      [
        { x: b.x1, y: 0, z: -3.4 },
        { x: b.x2, y: 0, z: -3.4 },
        { x: b.x2, y: 0.9, z: -3.4 },
        { x: b.x1, y: 0.9, z: -3.4 },
      ],
      b.bg
    );
    drawLine3D(
      ctx,
      cam,
      { x: b.x1, y: 0.89, z: -3.4 },
      { x: b.x2, y: 0.89, z: -3.4 },
      club.secondary,
      0.045,
      1
    );
    const mid = project({ x: (b.x1 + b.x2) / 2, y: 0.45, z: -3.38 }, cam);
    if (mid && width > 480) {
      ctx.fillStyle = b.fg;
      ctx.font = `800 ${Math.max(9, Math.round(mid.scale * 0.25))}px Cairo, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, mid.x, mid.y);
    }
  }

  for (const side of [-1, 1]) {
    const sx = side * 14.5;
    drawQuad3D(
      ctx,
      cam,
      [
        { x: sx, y: 0, z: -3.4 },
        { x: sx, y: 0, z: 12 },
        { x: sx, y: 0.9, z: 12 },
        { x: sx, y: 0.9, z: -3.4 },
      ],
      '#0b1018'
    );
    drawLine3D(
      ctx,
      cam,
      { x: sx, y: 0.88, z: -3.4 },
      { x: sx, y: 0.88, z: 12 },
      club.accent,
      0.04,
      1
    );
  }
}

function drawPitchLines(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  time: number,
  flagColor: string
) {
  const lineCol = 'rgba(248, 250, 252, 0.84)';

  drawLine3D(
    ctx,
    cam,
    { x: -22, y: 0.01, z: 0 },
    { x: 22, y: 0.01, z: 0 },
    lineCol,
    0.09,
    1.5
  );
  drawLine3D(
    ctx,
    cam,
    { x: -9.16, y: 0.01, z: 0 },
    { x: -9.16, y: 0.01, z: 5.5 },
    lineCol,
    0.08,
    1.2
  );
  drawLine3D(
    ctx,
    cam,
    { x: 9.16, y: 0.01, z: 0 },
    { x: 9.16, y: 0.01, z: 5.5 },
    lineCol,
    0.08,
    1.2
  );
  drawLine3D(
    ctx,
    cam,
    { x: -9.16, y: 0.01, z: 5.5 },
    { x: 9.16, y: 0.01, z: 5.5 },
    lineCol,
    0.08,
    1.2
  );

  drawLine3D(
    ctx,
    cam,
    { x: -20.16, y: 0.01, z: 0 },
    { x: -20.16, y: 0.01, z: 16.5 },
    lineCol,
    0.09,
    1.2
  );
  drawLine3D(
    ctx,
    cam,
    { x: 20.16, y: 0.01, z: 0 },
    { x: 20.16, y: 0.01, z: 16.5 },
    lineCol,
    0.09,
    1.2
  );
  drawLine3D(
    ctx,
    cam,
    { x: -20.16, y: 0.01, z: 16.5 },
    { x: 20.16, y: 0.01, z: 16.5 },
    lineCol,
    0.09,
    1.2
  );

  const arcR = 9.15;
  const steps = 16;
  let prevArc: Vec3 | null = null;
  for (let i = 0; i <= steps; i++) {
    const ang = -0.92 + (i / steps) * 1.84;
    const ax = Math.sin(ang) * arcR;
    const az = PENALTY_Z + Math.cos(ang) * arcR;
    if (az >= 16.48) {
      const pt = { x: ax, y: 0.01, z: az };
      if (prevArc) {
        drawLine3D(ctx, cam, prevArc, pt, lineCol, 0.08, 1.2);
      }
      prevArc = pt;
    }
  }

  const spot = project({ x: 0, y: 0.015, z: PENALTY_Z }, cam);
  if (spot) {
    ctx.fillStyle = lineCol;
    ctx.beginPath();
    ctx.ellipse(
      spot.x,
      spot.y,
      Math.max(3.5, spot.scale * 0.14),
      Math.max(1.8, spot.scale * 0.06),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  for (const side of [-1, 1]) {
    const fx = side * 21.5;
    drawLine3D(
      ctx,
      cam,
      { x: fx, y: 0, z: 0 },
      { x: fx, y: 1.45, z: 0 },
      '#f8fafc',
      0.04,
      1.2
    );
    const wave = Math.sin(time * 4 + side) * 0.14;
    drawQuad3D(
      ctx,
      cam,
      [
        { x: fx, y: 1.45, z: 0 },
        { x: fx - side * 0.45, y: 1.38, z: wave },
        { x: fx - side * 0.45, y: 1.12, z: wave },
        { x: fx, y: 1.14, z: 0 },
      ],
      flagColor
    );
  }
}

function drawPreselectedDiveCue(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  dir: DiveDirection,
  time: number
) {
  // Unified main camera (-z): screen-left is -x, screen-right is +x
  let tx = 0;
  let ty = 0.85;
  switch (dir) {
    case 'left-high':
      tx = -2.65;
      ty = 1.65;
      break;
    case 'left-low':
      tx = -2.7;
      ty = 0.5;
      break;
    case 'center':
      tx = 0;
      ty = 1.45;
      break;
    case 'right-low':
      tx = 2.7;
      ty = 0.5;
      break;
    case 'right-high':
      tx = 2.65;
      ty = 1.65;
      break;
  }

  const p = project({ x: tx, y: ty, z: 0.15 }, cam);
  if (!p) return;

  const pulse = 1 + Math.sin(time * 6) * 0.08;
  const r = Math.max(14, p.scale * 0.34 * pulse);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = '#f4ce65';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(212, 175, 55, 0.22)';
  ctx.fill();
  ctx.restore();
}

function drawGoalAndNet(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  engine: PenaltyEngine
) {
  const netColor = 'rgba(241, 245, 249, 0.46)';
  const cols = engine.netCols;
  const rows = engine.netRows;

  ctx.strokeStyle = netColor;
  ctx.lineWidth = 1.3;

  for (let r = 0; r < rows; r++) {
    ctx.beginPath();
    let started = false;
    for (let c = 0; c < cols; c++) {
      const node = engine.netNodes[r * cols + c];
      const pr = project(
        { x: node.baseX, y: node.baseY, z: node.baseZ + node.dispZ },
        cam
      );
      if (!pr) continue;
      if (!started) {
        ctx.moveTo(pr.x, pr.y);
        started = true;
      } else {
        ctx.lineTo(pr.x, pr.y);
      }
    }
    ctx.stroke();
  }

  for (let c = 0; c < cols; c++) {
    ctx.beginPath();
    let started = false;
    for (let r = 0; r < rows; r++) {
      const node = engine.netNodes[r * cols + c];
      const pr = project(
        { x: node.baseX, y: node.baseY, z: node.baseZ + node.dispZ },
        cam
      );
      if (!pr) continue;
      if (!started) {
        ctx.moveTo(pr.x, pr.y);
        started = true;
      } else {
        ctx.lineTo(pr.x, pr.y);
      }
    }
    ctx.stroke();
  }

  for (const side of [-1, 1]) {
    const sx = side * GOAL_HALF_W;
    for (let i = 1; i < 6; i++) {
      const y = (i / 6) * GOAL_H;
      drawLine3D(
        ctx,
        cam,
        { x: sx, y, z: 0 },
        { x: sx, y, z: -GOAL_DEPTH },
        netColor,
        0.015,
        0.8
      );
    }
    for (let k = 1; k < 5; k++) {
      const z = -(k / 5) * GOAL_DEPTH;
      drawLine3D(
        ctx,
        cam,
        { x: sx, y: 0, z },
        { x: sx, y: GOAL_H, z },
        netColor,
        0.015,
        0.8
      );
    }
  }
  for (let c = 1; c < 10; c++) {
    const x = -GOAL_HALF_W + (c / 10) * (GOAL_HALF_W * 2);
    drawLine3D(
      ctx,
      cam,
      { x, y: GOAL_H, z: 0 },
      { x, y: GOAL_H, z: -GOAL_DEPTH },
      netColor,
      0.015,
      0.8
    );
  }

  const stanchionColor = 'rgba(203, 213, 225, 0.78)';
  drawLine3D(
    ctx,
    cam,
    { x: -GOAL_HALF_W, y: 0, z: -GOAL_DEPTH },
    { x: -GOAL_HALF_W, y: GOAL_H, z: -GOAL_DEPTH },
    stanchionColor,
    0.05,
    1.5
  );
  drawLine3D(
    ctx,
    cam,
    { x: GOAL_HALF_W, y: 0, z: -GOAL_DEPTH },
    { x: GOAL_HALF_W, y: GOAL_H, z: -GOAL_DEPTH },
    stanchionColor,
    0.05,
    1.5
  );
  drawLine3D(
    ctx,
    cam,
    { x: -GOAL_HALF_W, y: GOAL_H, z: -GOAL_DEPTH },
    { x: GOAL_HALF_W, y: GOAL_H, z: -GOAL_DEPTH },
    stanchionColor,
    0.05,
    1.5
  );
  drawLine3D(
    ctx,
    cam,
    { x: -GOAL_HALF_W, y: 0, z: 0 },
    { x: -GOAL_HALF_W, y: 0, z: -GOAL_DEPTH },
    stanchionColor,
    0.05,
    1.5
  );
  drawLine3D(
    ctx,
    cam,
    { x: GOAL_HALF_W, y: 0, z: 0 },
    { x: GOAL_HALF_W, y: 0, z: -GOAL_DEPTH },
    stanchionColor,
    0.05,
    1.5
  );
  drawLine3D(
    ctx,
    cam,
    { x: -GOAL_HALF_W, y: GOAL_H, z: 0 },
    { x: -GOAL_HALF_W, y: GOAL_H, z: -GOAL_DEPTH },
    stanchionColor,
    0.055,
    1.5
  );
  drawLine3D(
    ctx,
    cam,
    { x: GOAL_HALF_W, y: GOAL_H, z: 0 },
    { x: GOAL_HALF_W, y: GOAL_H, z: -GOAL_DEPTH },
    stanchionColor,
    0.055,
    1.5
  );

  const postCol = '#f8fafc';
  drawLine3D(
    ctx,
    cam,
    { x: -GOAL_HALF_W, y: 0, z: 0 },
    { x: -GOAL_HALF_W, y: GOAL_H, z: 0 },
    postCol,
    0.13,
    3.5
  );
  drawLine3D(
    ctx,
    cam,
    { x: GOAL_HALF_W, y: 0, z: 0 },
    { x: GOAL_HALF_W, y: GOAL_H, z: 0 },
    postCol,
    0.13,
    3.5
  );
  drawLine3D(
    ctx,
    cam,
    { x: -GOAL_HALF_W, y: GOAL_H, z: 0 },
    { x: GOAL_HALF_W, y: GOAL_H, z: 0 },
    postCol,
    0.13,
    3.5
  );
}

/**
 * Draws the two opposing 5-player penalty shootout huddles on the left and right flanks,
 * standing shoulder-to-shoulder with arms draped across teammates' shoulders!
 */
function drawTeamHuddles3D(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  engine: PenaltyEngine,
  playerClub: EgyptianClub,
  opponentClub: EgyptianClub
) {
  const isHuddleFocus = engine.phase === 'huddle';

  // During huddle showcase, pull teams inward slightly so all 5 players per team are prominently framed;
  // During kicks, keep them flanking cleanly outside the penalty spot & goal frame!
  const leftAnchorX = isHuddleFocus ? -5.85 : -7.45;
  const rightAnchorX = isHuddleFocus ? 5.85 : 7.45;
  const baseZ = isHuddleFocus ? 6.2 : 4.9;

  const drawGroup = (
    club: EgyptianClub,
    anchorX: number,
    sideSign: -1 | 1,
    numbers: number[]
  ) => {
    const count = 5;
    const spacing = 0.62; // close shoulder-to-shoulder stance
    const players: { x: number; z: number; num: number; phase: number }[] = [];

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spacing;
      const x = anchorX + offset * 0.88;
      // Slight curved arc facing toward the goal/action
      const z = baseZ + Math.abs(offset) * 0.28 + i * 0.05 * sideSign;
      players.push({
        x,
        z,
        num: numbers[i] ?? i + 7,
        phase: engine.crowdTime * (isHuddleFocus ? 3.8 : 2.1) + i * 0.85,
      });
    }

    // Sort back-to-front (smaller z first for camera at +z)
    players.sort((a, b) => a.z - b.z);

    const jersey = club.primary;
    const jerseyShade = shadeHex(jersey, 0.56);
    const trim = club.secondary;
    const shorts = club.shorts;
    const shortsShade = shadeHex(shorts, 0.55);
    const socks = club.socks;
    const socksShade = shadeHex(socks, 0.6);
    const skin = '#d9a066';

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const bob = Math.sin(p.phase) * (isHuddleFocus ? 0.03 : 0.014);
      const hipY = 0.88 + bob;

      const shadow = project({ x: p.x, y: 0.01, z: p.z }, cam);
      if (!shadow) continue;

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.ellipse(
        shadow.x,
        shadow.y,
        Math.max(6, shadow.scale * 0.28),
        Math.max(2.5, shadow.scale * 0.09),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Legs
      const hipL: Vec3 = { x: p.x - 0.11, y: hipY, z: p.z };
      const hipR: Vec3 = { x: p.x + 0.11, y: hipY, z: p.z };
      const kneeL: Vec3 = { x: p.x - 0.12, y: hipY - 0.4, z: p.z };
      const kneeR: Vec3 = { x: p.x + 0.12, y: hipY - 0.4, z: p.z };
      const footL: Vec3 = { x: p.x - 0.13, y: 0.06, z: p.z };
      const footR: Vec3 = { x: p.x + 0.13, y: 0.06, z: p.z };

      drawLimb3D(ctx, cam, hipL, kneeL, 0.082, 0.065, shorts, shortsShade);
      drawLimb3D(ctx, cam, hipR, kneeR, 0.082, 0.065, shorts, shortsShade);
      drawLimb3D(ctx, cam, kneeL, footL, 0.058, 0.044, socks, socksShade);
      drawLimb3D(ctx, cam, kneeR, footR, 0.058, 0.044, socks, socksShade);

      // Shoulders & Torso
      const shL: Vec3 = { x: p.x - 0.21, y: hipY + 0.52, z: p.z };
      const shR: Vec3 = { x: p.x + 0.21, y: hipY + 0.52, z: p.z };
      const pHipL = project(hipL, cam);
      const pHipR = project(hipR, cam);
      const pShL = project(shL, cam);
      const pShR = project(shR, cam);

      if (pHipL && pHipR && pShL && pShR) {
        const grad = ctx.createLinearGradient(pShL.x, pShL.y, pShR.x, pShR.y);
        grad.addColorStop(0, jersey);
        grad.addColorStop(0.55, jersey);
        grad.addColorStop(1, jerseyShade);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(pShL.x, pShL.y);
        ctx.lineTo(pShR.x, pShR.y);
        ctx.lineTo(pHipR.x, pHipR.y);
        ctx.lineTo(pHipL.x, pHipL.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = trim;
        ctx.lineWidth = Math.max(1.2, pShL.scale * 0.03);
        ctx.stroke();

        // Jersey number on back
        if (pShL.scale > 22) {
          const cx = (pShL.x + pShR.x + pHipL.x + pHipR.x) / 4;
          const cy = (pShL.y + pHipL.y) / 2;
          ctx.fillStyle = trim;
          ctx.font = `800 ${Math.max(8, Math.round(pShL.scale * 0.2))}px "Barlow Condensed", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(p.num), cx, cy);
        }
      }

      // Arms draped over neighbor's shoulders!
      if (i < players.length - 1) {
        const neighbor = players[i + 1];
        const neighborShoulderY = 0.88 + Math.sin(neighbor.phase) * (isHuddleFocus ? 0.03 : 0.014) + 0.53;
        const armEnd: Vec3 = {
          x: neighbor.x - 0.14,
          y: neighborShoulderY,
          z: neighbor.z - 0.05,
        };
        const armStart = neighbor.x >= p.x ? shR : shL;
        drawLimb3D(ctx, cam, armStart, armEnd, 0.058, 0.044, jersey, jerseyShade);
      }
      if (i > 0) {
        const prev = players[i - 1];
        const prevShoulderY = 0.88 + Math.sin(prev.phase) * (isHuddleFocus ? 0.03 : 0.014) + 0.53;
        const armEnd: Vec3 = {
          x: prev.x + 0.14,
          y: prevShoulderY,
          z: prev.z - 0.05,
        };
        const armStart = prev.x <= p.x ? shL : shR;
        drawLimb3D(ctx, cam, armStart, armEnd, 0.056, 0.042, jersey, jerseyShade);
      }

      // Head
      const head = project({ x: p.x, y: hipY + 0.72, z: p.z }, cam);
      if (head) {
        const hr = Math.max(4, head.scale * 0.125);
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(head.x, head.y, hr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#111318';
        ctx.beginPath();
        ctx.arc(head.x, head.y - hr * 0.1, hr * 1.02, Math.PI * 0.88, Math.PI * 2.12);
        ctx.fill();
      }
    }
  };

  const playerNums = [
    ...playerClub.stars.map((s) => s.number),
    10,
  ];
  const oppNums = [
    ...opponentClub.stars.map((s) => s.number),
    10,
  ];

  drawGroup(playerClub, leftAnchorX, -1, playerNums);
  drawGroup(opponentClub, rightAnchorX, 1, oppNums);
}

/**
 * 3D Volumetric Goalkeeper Skeleton Renderer
 */
function drawGoalkeeper3D(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  engine: PenaltyEngine,
  keeperClub: EgyptianClub
) {
  const px = engine.keeperPos.x;
  const py = engine.keeperPos.y;
  const pz = engine.keeperPos.z;

  const base = project({ x: px, y: 0.01, z: pz }, cam);
  if (!base) return;

  const shadowScale = Math.max(0.42, 1 - py * 0.35);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.46 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(
    base.x,
    base.y,
    Math.max(12, base.scale * 0.45 * (engine.keeperDiveDir ? 1.65 : 1)),
    Math.max(4, base.scale * 0.13),
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const idleBob = engine.keeperDiveDir
    ? 0
    : Math.abs(Math.sin(engine.keeperIdlePhase)) * 0.05;
  const idleSway = engine.keeperDiveDir
    ? 0
    : Math.sin(engine.keeperIdlePhase * 0.5) * 0.07;

  let tiltAngle = 0;
  let reachStretch = 0;
  if (engine.keeperDiveDir) {
    const e = Math.min(1, engine.keeperDiveProgress * 1.25);
    const deltaX = engine.keeperTarget.x - engine.keeperDiveStartX;
    const targetSign = deltaX < -0.25 ? -1 : deltaX > 0.25 ? 1 : 0;
    tiltAngle = targetSign * 1.18 * e;
    reachStretch = e;
  }

  const toWorld = (lx: number, ly: number, lz: number): Vec3 => {
    const cos = Math.cos(tiltAngle);
    const sin = Math.sin(tiltAngle);
    const rx = lx * cos + ly * sin;
    const ry = -lx * sin + ly * cos;
    return {
      x: px + idleSway + rx,
      y: py + idleBob + ry + 0.92,
      z: pz + lz,
    };
  };

  const gkPrimary = keeperClub.gkPrimary;
  const gkShade = shadeHex(gkPrimary, 0.58);
  const gkShorts = keeperClub.shorts;
  const gkShortsShade = shadeHex(gkShorts, 0.55);
  const skin = '#e0ac69';
  const skinShade = '#a87439';

  const hipL = toWorld(-0.14, -0.04, 0);
  const hipR = toWorld(0.14, -0.04, 0);
  const kneeL = toWorld(-0.19, -0.45, engine.keeperDiveDir ? 0.1 : 0.14);
  const kneeR = toWorld(0.19, -0.45, engine.keeperDiveDir ? 0.1 : 0.14);
  const footL = toWorld(-0.22, -0.88, engine.keeperDiveDir ? 0.05 : 0.02);
  const footR = toWorld(0.22, -0.88, engine.keeperDiveDir ? 0.05 : 0.02);

  const shL = toWorld(-0.24, 0.56, 0);
  const shR = toWorld(0.24, 0.56, 0);
  const headPos = toWorld(0, 0.78, 0.04);

  const armY = engine.keeperDiveDir
    ? 0.88 * reachStretch + 0.35 * (1 - reachStretch)
    : 0.25;
  const armX = engine.keeperDiveDir ? 0.36 : 0.48;
  const elbowL = toWorld(-armX * 0.78, armY * 0.72 + 0.2, 0.16);
  const elbowR = toWorld(armX * 0.78, armY * 0.72 + 0.2, 0.16);
  const handL = toWorld(-armX, armY + 0.24, 0.28);
  const handR = toWorld(armX, armY + 0.24, 0.28);

  drawLimb3D(ctx, cam, hipL, kneeL, 0.095, 0.075, gkShorts, gkShortsShade);
  drawLimb3D(ctx, cam, hipR, kneeR, 0.095, 0.075, gkShorts, gkShortsShade);
  drawLimb3D(ctx, cam, kneeL, footL, 0.068, 0.052, '#1e293b', '#090d16');
  drawLimb3D(ctx, cam, kneeR, footR, 0.068, 0.052, '#1e293b', '#090d16');

  for (const f of [footL, footR]) {
    const pf = project(f, cam);
    if (pf) {
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.ellipse(
        pf.x,
        pf.y,
        Math.max(4, pf.scale * 0.11),
        Math.max(2.5, pf.scale * 0.065),
        tiltAngle,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  const pHipL = project(hipL, cam);
  const pHipR = project(hipR, cam);
  const pShL = project(shL, cam);
  const pShR = project(shR, cam);
  if (pHipL && pHipR && pShL && pShR) {
    const torsoGrad = ctx.createLinearGradient(pShL.x, pShL.y, pShR.x, pShR.y);
    torsoGrad.addColorStop(0, gkPrimary);
    torsoGrad.addColorStop(0.55, gkPrimary);
    torsoGrad.addColorStop(1, gkShade);

    ctx.fillStyle = torsoGrad;
    ctx.beginPath();
    ctx.moveTo(pShL.x, pShL.y);
    ctx.lineTo(pShR.x, pShR.y);
    ctx.lineTo(pHipR.x, pHipR.y);
    ctx.lineTo(pHipL.x, pHipL.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = keeperClub.gkSecondary;
    ctx.lineWidth = Math.max(2, pShL.scale * 0.06);
    ctx.beginPath();
    ctx.moveTo((pShL.x + pHipL.x) * 0.5, (pShL.y + pHipL.y) * 0.5);
    ctx.lineTo((pShR.x + pHipR.x) * 0.5, (pShR.y + pHipR.y) * 0.5);
    ctx.stroke();
  }

  drawLimb3D(ctx, cam, shL, elbowL, 0.072, 0.06, gkPrimary, gkShade);
  drawLimb3D(ctx, cam, shR, elbowR, 0.072, 0.06, gkPrimary, gkShade);
  drawLimb3D(ctx, cam, elbowL, handL, 0.058, 0.048, skin, skinShade);
  drawLimb3D(ctx, cam, elbowR, handR, 0.058, 0.048, skin, skinShade);

  for (const h of [handL, handR]) {
    const ph = project(h, cam);
    if (ph) {
      const gr = Math.max(5, ph.scale * 0.115);
      const gGrad = ctx.createRadialGradient(
        -gr * 0.25 + ph.x,
        -gr * 0.25 + ph.y,
        gr * 0.1,
        ph.x,
        ph.y,
        gr
      );
      gGrad.addColorStop(0, '#ffffff');
      gGrad.addColorStop(0.7, '#e2e8f0');
      gGrad.addColorStop(1, '#64748b');
      ctx.fillStyle = gGrad;
      ctx.beginPath();
      ctx.arc(ph.x, ph.y, gr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  const pHead = project(headPos, cam);
  if (pHead) {
    const hr = Math.max(5.5, pHead.scale * 0.145);
    const hGrad = ctx.createRadialGradient(
      pHead.x - hr * 0.3,
      pHead.y - hr * 0.3,
      hr * 0.1,
      pHead.x,
      pHead.y,
      hr
    );
    hGrad.addColorStop(0, '#f3c38a');
    hGrad.addColorStop(0.65, skin);
    hGrad.addColorStop(1, skinShade);
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(pHead.x, pHead.y, hr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(
      pHead.x,
      pHead.y - hr * 0.12,
      hr * 1.02,
      Math.PI * 0.92,
      Math.PI * 2.08
    );
    ctx.fill();
  }
}

/**
 * 3D Volumetric Striker Skeleton Renderer
 * Supports: walk_up (carrying ball in hand), place_ball (crouching to place ball), run-up & kick!
 */
function drawStriker3D(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  engine: PenaltyEngine,
  strikerClub: EgyptianClub
) {
  const sx = engine.strikerPos.x;
  const sz = engine.strikerPos.z;
  const footShadow = project({ x: sx, y: 0.01, z: sz }, cam);
  if (!footShadow) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.beginPath();
  ctx.ellipse(
    footShadow.x,
    footShadow.y,
    Math.max(10, footShadow.scale * 0.36),
    Math.max(4, footShadow.scale * 0.12),
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const isWalking = engine.phase === 'walk_up';
  const isPlacing = engine.phase === 'place_ball';
  const isRunning = engine.phase === 'running';
  const stride =
    isRunning || isWalking || isPlacing
      ? Math.sin(engine.strikerKickCycle) * (isRunning ? 1 : 0.65)
      : 0;
  const windup =
    isRunning && engine.strikerProgress > 0.72
      ? (engine.strikerProgress - 0.72) / 0.28
      : 0;
  const kickFollow = engine.strikerHasKicked
    ? Math.min(1, (engine.strikerProgress - 1) * 3.8)
    : 0;

  const bend = engine.strikerBend; // 0..1 crouch while placing the ball
  const forwardLean = isRunning
    ? 0.18
    : isPlacing
    ? 0.32 * bend
    : kickFollow * 0.22;
  const hipY =
    0.92 -
    bend * 0.28 -
    (isRunning || isWalking ? Math.abs(stride) * 0.04 : 0);

  const jerseyColor = strikerClub.primary;
  const jerseyShade = shadeHex(jerseyColor, 0.55);
  const trimColor = strikerClub.secondary;
  const shortsColor = strikerClub.shorts;
  const shortsShade = shadeHex(shortsColor, 0.55);
  const socksColor = strikerClub.socks;
  const socksShade = shadeHex(socksColor, 0.6);
  const skin = '#d9a066';
  const skinShade = '#9b6734';

  const hipL: Vec3 = { x: sx - 0.13, y: hipY, z: sz };
  const kneeL: Vec3 = {
    x: sx - 0.15,
    y: hipY - 0.42 + bend * 0.12 + Math.max(0, stride) * 0.12,
    z: sz - stride * 0.24 - bend * 0.14,
  };
  const ankleL: Vec3 = {
    x: sx - 0.16,
    y: 0.08 + Math.max(0, stride) * 0.18,
    z: sz - stride * 0.36,
  };

  const kickZ =
    windup > 0
      ? windup * 0.58
      : kickFollow > 0
      ? -kickFollow * 0.68
      : stride * 0.34;
  const kickYBoost =
    windup > 0
      ? windup * 0.28
      : kickFollow > 0
      ? kickFollow * 0.42
      : Math.max(0, -stride) * 0.18;

  const hipR: Vec3 = { x: sx + 0.13, y: hipY, z: sz };
  const kneeR: Vec3 = {
    x: sx + 0.15,
    y: hipY - 0.42 + bend * 0.12 + kickYBoost * 0.45,
    z: sz + kickZ * 0.55 - bend * 0.14,
  };
  const ankleR: Vec3 = {
    x: sx + 0.17 + kickFollow * 0.12,
    y: 0.08 + kickYBoost,
    z: sz + kickZ,
  };

  const shL: Vec3 = {
    x: sx - 0.23,
    y: hipY + 0.56 - bend * 0.08,
    z: sz - forwardLean * 0.6,
  };
  const shR: Vec3 = {
    x: sx + 0.23,
    y: hipY + 0.56 - bend * 0.08,
    z: sz - forwardLean * 0.6,
  };
  const headPos: Vec3 = {
    x: sx,
    y: hipY + 0.78 - bend * 0.12,
    z: sz - forwardLean * 0.78,
  };

  // Arms: either carrying the ball in right hand / placing on ground, or running stride
  let elbowL: Vec3;
  let handL: Vec3;
  let elbowR: Vec3;
  let handR: Vec3;

  if (engine.ballCarried) {
    elbowL = {
      x: sx - 0.32,
      y: hipY + 0.3,
      z: sz + stride * 0.2,
    };
    handL = {
      x: sx - 0.34,
      y: hipY + 0.08,
      z: sz + stride * 0.28,
    };
    // Right arm cradles/holds the ball cleanly out to the right side so it's clearly visible!
    elbowR = {
      x: sx + 0.34,
      y: hipY + 0.24 - bend * 0.18,
      z: sz - 0.08,
    };
    handR = {
      x: sx + 0.32,
      y: 0.9 - bend * 0.48,
      z: sz - 0.12,
    };
  } else {
    elbowL = {
      x: sx - 0.34,
      y: hipY + 0.32,
      z: sz + stride * 0.28 - kickFollow * 0.2,
    };
    handL = {
      x: sx - 0.38,
      y: hipY + 0.12 + kickFollow * 0.2,
      z: sz + stride * 0.42 - kickFollow * 0.34,
    };
    elbowR = {
      x: sx + 0.34,
      y: hipY + 0.32,
      z: sz - stride * 0.28 + kickFollow * 0.24,
    };
    handR = {
      x: sx + 0.38,
      y: hipY + 0.12,
      z: sz - stride * 0.42 + kickFollow * 0.36,
    };
  }

  drawLimb3D(ctx, cam, hipL, kneeL, 0.095, 0.075, shortsColor, shortsShade);
  drawLimb3D(ctx, cam, hipR, kneeR, 0.095, 0.075, shortsColor, shortsShade);
  drawLimb3D(ctx, cam, kneeL, ankleL, 0.068, 0.052, socksColor, socksShade);
  drawLimb3D(ctx, cam, kneeR, ankleR, 0.068, 0.052, socksColor, socksShade);

  for (const ank of [ankleL, ankleR]) {
    const pAnk = project(ank, cam);
    const pToe = project(
      { x: ank.x, y: Math.max(0.03, ank.y - 0.02), z: ank.z - 0.16 },
      cam
    );
    if (pAnk && pToe) {
      drawLimb3D(
        ctx,
        cam,
        ank,
        { x: ank.x, y: Math.max(0.03, ank.y - 0.02), z: ank.z - 0.14 },
        0.056,
        0.044,
        '#111827',
        '#020617'
      );
    }
  }

  const pHipL = project(hipL, cam);
  const pHipR = project(hipR, cam);
  const pShL = project(shL, cam);
  const pShR = project(shR, cam);
  if (pHipL && pHipR && pShL && pShR) {
    const grad = ctx.createLinearGradient(pShL.x, pShL.y, pShR.x, pShR.y);
    grad.addColorStop(0, jerseyColor);
    grad.addColorStop(0.55, jerseyColor);
    grad.addColorStop(1, jerseyShade);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pShL.x, pShL.y);
    ctx.lineTo(pShR.x, pShR.y);
    ctx.lineTo(pHipR.x, pHipR.y);
    ctx.lineTo(pHipL.x, pHipL.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = trimColor;
    ctx.lineWidth = Math.max(1.5, pShL.scale * 0.035);
    ctx.stroke();

    // Dynamic Taker Jersey Number on Back
    const cx = (pShL.x + pShR.x + pHipL.x + pHipR.x) / 4;
    const cy = (pShL.y + pHipL.y) / 2;
    ctx.fillStyle = trimColor;
    ctx.font = `800 ${Math.max(10, Math.round(pShL.scale * 0.25))}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(engine.activeTakerNumber), cx, cy);
  }

  drawLimb3D(ctx, cam, shL, elbowL, 0.072, 0.058, jerseyColor, jerseyShade);
  drawLimb3D(ctx, cam, shR, elbowR, 0.072, 0.058, jerseyColor, jerseyShade);
  drawLimb3D(ctx, cam, elbowL, handL, 0.052, 0.04, skin, skinShade);
  drawLimb3D(ctx, cam, elbowR, handR, 0.052, 0.04, skin, skinShade);

  const pHead = project(headPos, cam);
  if (pHead) {
    const hr = Math.max(5, pHead.scale * 0.14);
    const hGrad = ctx.createRadialGradient(
      pHead.x - hr * 0.28,
      pHead.y - hr * 0.28,
      hr * 0.1,
      pHead.x,
      pHead.y,
      hr
    );
    hGrad.addColorStop(0, '#f0be82');
    hGrad.addColorStop(0.65, skin);
    hGrad.addColorStop(1, skinShade);
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(pHead.x, pHead.y, hr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111318';
    ctx.beginPath();
    ctx.arc(
      pHead.x,
      pHead.y - hr * 0.12,
      hr * 1.04,
      Math.PI * 0.88,
      Math.PI * 2.12
    );
    ctx.fill();
  }
}

function drawTrajectoryAndReticle(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  engine: PenaltyEngine
) {
  if (
    engine.role !== 'shoot' ||
    !engine.isPlayerKickTurn ||
    (engine.phase !== 'aiming' && engine.phase !== 'charging')
  ) {
    return;
  }

  const pts = engine.getTrajectoryPreview();
  const isOverpower = engine.phase === 'charging' && engine.power > 0.85;
  const guideColor = isOverpower
    ? 'rgba(239, 68, 68, 0.88)'
    : engine.phase === 'charging'
    ? 'rgba(244, 206, 101, 0.92)'
    : 'rgba(255, 255, 255, 0.72)';

  for (let i = 1; i < pts.length; i++) {
    const pr = project(pts[i], cam);
    if (!pr) continue;
    const t = i / pts.length;
    const r = Math.max(2.2, (1 - t * 0.42) * 5);
    ctx.fillStyle = guideColor;
    ctx.globalAlpha = 0.38 + t * 0.55;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const target = project({ x: engine.aimX, y: engine.aimY, z: 0 }, cam);
  if (target) {
    const r = Math.max(13, target.scale * 0.32);
    ctx.save();
    ctx.translate(target.x, target.y);

    ctx.strokeStyle = isOverpower ? '#ef4444' : '#f4ce65';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = isOverpower
      ? 'rgba(239, 68, 68, 0.2)'
      : 'rgba(244, 206, 101, 0.16)';
    ctx.fill();

    const tick = r * 0.45;
    ctx.beginPath();
    ctx.moveTo(-r - 4, 0);
    ctx.lineTo(-r + tick, 0);
    ctx.moveTo(r + 4, 0);
    ctx.lineTo(r - tick, 0);
    ctx.moveTo(0, -r - 4);
    ctx.lineTo(0, -r + tick);
    ctx.moveTo(0, r + 4);
    ctx.lineTo(0, r - tick);
    ctx.stroke();

    ctx.restore();
  }
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  cam: CameraBasis,
  engine: PenaltyEngine,
  skin: BallOption
) {
  for (let i = 0; i < engine.ballTrail.length; i++) {
    const tp = engine.ballTrail[i];
    const pr = project(tp, cam);
    if (!pr) continue;
    const frac = (i + 1) / engine.ballTrail.length;
    const r = Math.max(2, BALL_RADIUS * pr.scale * frac * 0.72);
    ctx.fillStyle = `rgba(244, 206, 101, ${frac * 0.24})`;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const shadowP = project(
    { x: engine.ballPos.x, y: 0.012, z: engine.ballPos.z },
    cam
  );
  if (shadowP) {
    const heightFactor = Math.max(0.32, 1 - engine.ballPos.y * 0.24);
    const rx = Math.max(4, BALL_RADIUS * shadowP.scale * 1.2 * heightFactor);
    const ry = Math.max(2, rx * 0.38);
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.54 * heightFactor).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(shadowP.x, shadowP.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const pr = project(engine.ballPos, cam);
  if (!pr) return;
  const r = Math.max(4.5, BALL_RADIUS * pr.scale);

  ctx.save();
  ctx.translate(pr.x, pr.y);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  grad.addColorStop(0, skin.baseColor);
  grad.addColorStop(0.75, skin.baseColor);
  grad.addColorStop(1, '#64748b');
  ctx.fillStyle = grad;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  const patches = [
    { lat: 0, lon: 0 },
    { lat: 0.9, lon: 0 },
    { lat: 0.9, lon: 2.1 },
    { lat: 0.9, lon: 4.2 },
    { lat: -0.9, lon: 1.05 },
    { lat: -0.9, lon: 3.15 },
    { lat: -0.9, lon: 5.25 },
  ];

  for (const p of patches) {
    const lon = p.lon + engine.ballRot.y;
    const lat = p.lat + engine.ballRot.x;
    const x3 = Math.cos(lat) * Math.sin(lon);
    const y3 = Math.sin(lat);
    const z3 = Math.cos(lat) * Math.cos(lon);

    if (z3 > -0.1) {
      const px = x3 * r * 0.85;
      const py = y3 * r * 0.85;
      const prSize = r * 0.34 * Math.max(0.25, z3 * 0.8 + 0.3);

      ctx.fillStyle = skin.panelColor;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k * Math.PI * 2) / 5 + engine.ballRot.z;
        const vx = px + Math.cos(a) * prSize;
        const vy = py + Math.sin(a) * prSize;
        if (k === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = skin.accentColor;
      ctx.lineWidth = Math.max(0.6, r * 0.05);
      ctx.stroke();
    }
  }

  const rim = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.3, 0, 0, r);
  rim.addColorStop(0, 'rgba(255,255,255,0.22)');
  rim.addColorStop(0.7, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(0,0,0,0.48)');
  ctx.fillStyle = rim;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  ctx.restore();
}

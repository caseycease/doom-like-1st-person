// HUD overlay drawn with Canvas 2D primitives on the (already-scaled) display
// context — cheap, no per-pixel work. PLATFORM layer.

import type { World } from '../engine/world';
import { currentWeaponDef } from '../engine/entities';

export function drawHud(
  ctx: CanvasRenderingContext2D,
  world: World,
  w: number,
  h: number,
  fps: number,
  levelName: string,
): void {
  const p = world.player;
  const def = currentWeaponDef(p);
  const ammo = p.ammo[def.ammoType];

  // --- weapon viewmodel ---
  const justFired = p.cooldownTimer > def.fireRate * 0.55;
  const gx = w / 2;
  const gy = h;
  ctx.fillStyle = '#2b2b33';
  ctx.fillRect(gx - 18, gy - 70, 36, 70);
  ctx.fillStyle = '#1a1a20';
  ctx.fillRect(gx - 10, gy - 110, 20, 45);
  if (justFired) {
    ctx.fillStyle = 'rgba(255,220,120,0.9)';
    ctx.beginPath();
    ctx.arc(gx, gy - 116, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- crosshair ---
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 8, h / 2);
  ctx.lineTo(w / 2 + 8, h / 2);
  ctx.moveTo(w / 2, h / 2 - 8);
  ctx.lineTo(w / 2, h / 2 + 8);
  ctx.stroke();

  const pad = 16;
  ctx.textBaseline = 'bottom';
  ctx.font = '700 28px system-ui, sans-serif';

  const hpColor = p.health > 50 ? '#7CFC7C' : p.health > 20 ? '#FFD54A' : '#FF5A5A';
  drawLabel(ctx, `❤ ${Math.ceil(p.health)}`, pad, h - pad, hpColor);

  drawLabel(ctx, `${def.name.toUpperCase()}  ${ammo}`, w - pad, h - pad, '#FFE08A', 'right');

  // weapon slots line
  ctx.font = '600 14px system-ui, monospace';
  const slots = p.weapons.map((wid, i) => (i === p.currentWeapon ? `[${wid}]` : wid)).join('  ');
  drawLabel(ctx, slots, w - pad, h - pad - 32, 'rgba(220,220,235,0.85)', 'right');

  // dev meters (top-left)
  drawLabel(ctx, `${fps.toFixed(0)} fps`, pad, pad + 14, 'rgba(180,180,200,0.8)');
  ctx.font = '700 16px system-ui, sans-serif';
  drawLabel(ctx, levelName, pad, pad + 38, 'rgba(230,210,160,0.9)');

  if (world.levelComplete) banner(ctx, w, h, '#80FF88', 'LEVEL CLEARED', 'tap to continue');
  if (p.health <= 0) {
    ctx.fillStyle = 'rgba(60,0,0,0.55)';
    ctx.fillRect(0, 0, w, h);
    centerText(ctx, w, h - 10, '#FF6A6A', '800 48px system-ui, sans-serif', 'YOU DIED');
    centerText(ctx, w, h / 2 + 40, '#FF6A6A', '600 20px system-ui, sans-serif', 'tap to restart');
  }
}

function banner(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, big: string, small: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, h / 2 - 50, w, 100);
  centerText(ctx, w, h / 2 + 6, color, '800 40px system-ui, sans-serif', big);
  centerText(ctx, w, h / 2 + 36, color, '600 18px system-ui, sans-serif', small);
}

function centerText(ctx: CanvasRenderingContext2D, w: number, y: number, color: string, font: string, text: string): void {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, y);
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  align: 'left' | 'right' = 'left',
): void {
  ctx.save();
  ctx.textAlign = align;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

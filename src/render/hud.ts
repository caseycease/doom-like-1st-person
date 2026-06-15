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

  // --- weapon viewmodel (per weapon, with recoil kick + muzzle flash) ---
  const recoil = def.fireRate > 0 ? Math.max(0, p.cooldownTimer / def.fireRate) : 0;
  drawViewmodel(ctx, def.id, w, h, recoil);

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

function drawViewmodel(ctx: CanvasRenderingContext2D, id: string, w: number, h: number, recoil: number): void {
  const gx = w / 2;
  const gy = h + recoil * 14; // kick down on fire
  const flash = recoil > 0.55;
  ctx.save();
  const metal = '#23242c';
  const dark = '#14151b';
  if (id === 'shotgun') {
    ctx.fillStyle = metal;
    ctx.fillRect(gx - 26, gy - 60, 52, 60);
    ctx.fillStyle = dark;
    ctx.fillRect(gx - 18, gy - 104, 14, 50);
    ctx.fillRect(gx + 4, gy - 104, 14, 50);
  } else if (id === 'smg') {
    ctx.fillStyle = metal;
    ctx.fillRect(gx - 16, gy - 64, 32, 64);
    ctx.fillStyle = dark;
    ctx.fillRect(gx - 6, gy - 124, 12, 64);
  } else if (id === 'rocket') {
    ctx.fillStyle = '#3a3030';
    ctx.fillRect(gx - 30, gy - 70, 60, 70);
    ctx.fillStyle = '#262024';
    ctx.fillRect(gx - 14, gy - 116, 28, 52);
    ctx.strokeStyle = '#5a4a3a';
    ctx.lineWidth = 3;
    ctx.strokeRect(gx - 14, gy - 116, 28, 52);
  } else {
    // pistol
    ctx.fillStyle = metal;
    ctx.fillRect(gx - 18, gy - 70, 36, 70);
    ctx.fillStyle = dark;
    ctx.fillRect(gx - 10, gy - 110, 20, 45);
  }
  if (flash) {
    const topY = id === 'rocket' ? gy - 116 : id === 'smg' ? gy - 124 : id === 'shotgun' ? gy - 104 : gy - 110;
    const grd = ctx.createRadialGradient(gx, topY, 2, gx, topY, 22);
    grd.addColorStop(0, 'rgba(255,245,200,0.95)');
    grd.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(gx, topY, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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

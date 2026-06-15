// HUD overlay drawn with Canvas 2D primitives on the (already-scaled) display
// context — cheap, no per-pixel work. PLATFORM layer.

import type { World } from '../engine/world';

export function drawHud(
  ctx: CanvasRenderingContext2D,
  world: World,
  w: number,
  h: number,
  fps: number,
): void {
  const p = world.player;
  const weapon = p.weapons[p.currentWeapon];

  // --- weapon viewmodel (simple pistol) bottom-center ---
  const justFired = weapon.cooldownTimer > weapon.fireRate * 0.6;
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

  // --- HUD text ---
  const pad = 16;
  ctx.textBaseline = 'bottom';
  ctx.font = '700 28px system-ui, sans-serif';

  // health (left)
  const hpColor = p.health > 50 ? '#7CFC7C' : p.health > 20 ? '#FFD54A' : '#FF5A5A';
  drawLabel(ctx, `❤ ${Math.ceil(p.health)}`, pad, h - pad, hpColor);

  // ammo (right)
  const ammoText = `${weapon.name.toUpperCase()}  ${weapon.ammo}`;
  ctx.textAlign = 'right';
  drawLabel(ctx, ammoText, w - pad, h - pad, '#FFE08A', 'right');
  ctx.textAlign = 'left';

  // fps (top-left, dev)
  ctx.font = '600 14px system-ui, monospace';
  drawLabel(ctx, `${fps.toFixed(0)} fps`, pad, pad + 14, 'rgba(180,180,200,0.8)');

  // level-complete banner
  if (world.levelComplete) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, h / 2 - 50, w, 100);
    ctx.fillStyle = '#80FF88';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL CLEARED', w / 2, h / 2 + 14);
    ctx.textAlign = 'left';
  }

  // death banner
  if (p.health <= 0) {
    ctx.fillStyle = 'rgba(60,0,0,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FF6A6A';
    ctx.font = '800 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED', w / 2, h / 2);
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText('tap to restart', w / 2, h / 2 + 40);
    ctx.textAlign = 'left';
  }
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

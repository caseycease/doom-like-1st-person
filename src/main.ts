// Composition root: wires PLATFORM (canvas, input, audio, loop, save) to the
// pure ENGINE and the renderer. Only file that touches everything.

import './style.css';
import { createWorld, step, type World } from './engine/world';
import { emptyInput, type InputState } from './engine/input';
import { CAMPAIGN } from './levels';
import { ProceduralAssets } from './assets/procedural';
import { Renderer } from './render/renderer';
import { drawHud } from './render/hud';
import { GameLoop } from './platform/loop';
import { TouchControls } from './platform/touch';
import { KeyboardControls } from './platform/keyboard';
import { AudioEngine } from './platform/audio';
import { serializeProgress, applyProgress, encode, decode } from './engine/save';

const BASE_COLS = 480;
const MIN_COLS = 240;
const MAX_COLS = 480;
const SAVE_KEY = 'carnival.save.v1';

const display = document.getElementById('game') as HTMLCanvasElement;
const ctx = display.getContext('2d')!;
const assets = new ProceduralAssets();

// --- campaign / world state ---
let levelIndex = 0;
let world: World = createWorld(CAMPAIGN[0].map);
let paused = false;
let victory = false;

function levelSeed(idx: number): number {
  return 0x1000 + idx * 0x101;
}

function loadLevel(idx: number, carry?: World['player']): void {
  levelIndex = idx;
  world = createWorld(CAMPAIGN[idx].map, levelSeed(idx), carry);
  victory = false;
  saveCheckpoint();
}

function saveCheckpoint(): void {
  try {
    localStorage.setItem(SAVE_KEY, encode(serializeProgress(levelIndex, world.player)));
  } catch {
    /* storage unavailable (private mode etc.) — fine, just no save */
  }
}

function bootFromSave(): void {
  try {
    const saved = decode(localStorage.getItem(SAVE_KEY));
    if (saved) {
      const idx = Math.max(0, Math.min(CAMPAIGN.length - 1, saved.levelIndex));
      world = createWorld(CAMPAIGN[idx].map, levelSeed(idx));
      levelIndex = idx;
      applyProgress(world.player, saved);
    }
  } catch {
    /* ignore */
  }
}

function advanceLevel(): void {
  if (levelIndex < CAMPAIGN.length - 1) loadLevel(levelIndex + 1, world.player);
  else victory = true;
}

function reloadCheckpoint(): void {
  const carry = decode(localStorage.getItem(SAVE_KEY));
  world = createWorld(CAMPAIGN[levelIndex].map, levelSeed(levelIndex));
  if (carry) applyProgress(world.player, carry);
}

function restartCampaign(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
  loadLevel(0);
}

// --- rendering surfaces ---
let cols = BASE_COLS;
let cssW = 1;
let cssH = 1;
let dpr = 1;
let renderer = new Renderer(cols, Math.round((cols * 9) / 16), assets);
const off = document.createElement('canvas');
const offCtx = off.getContext('2d')!;
let imageData = new ImageData(1, 1);

function applyResolution(): void {
  const h = Math.max(2, Math.round((cols * cssH) / cssW));
  renderer.resize(cols, h);
  off.width = cols;
  off.height = h;
  imageData = new ImageData(new Uint8ClampedArray(renderer.buf.buffer as ArrayBuffer), cols, h);
}

function resize(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssW = display.clientWidth || window.innerWidth;
  cssH = display.clientHeight || window.innerHeight;
  display.width = Math.round(cssW * dpr);
  display.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  applyResolution();
}

// --- input ---
const touch = new TouchControls(display);
const keyboard = new KeyboardControls(display);
const audio = new AudioEngine();

function sampleInput(): InputState {
  const t = touch.sample();
  const k = keyboard.sample();
  const out = emptyInput();
  if (t.move.x !== 0 || t.move.y !== 0) out.move = t.move;
  else out.move = k.move;
  out.look.x = t.look.x + k.look.x;
  out.look.y = t.look.y + k.look.y;
  out.firing = t.firing || k.firing;
  out.swapWeapon = t.swapWeapon || k.swapWeapon;
  return out;
}

display.addEventListener('pointerdown', () => {
  audio.resume();
  if (paused) return;
  if (world.player.health <= 0) reloadCheckpoint();
  else if (victory) restartCampaign();
  else if (world.levelComplete) advanceLevel();
});

// --- adaptive resolution ---
let lowFrames = 0;
let highFrames = 0;
function adapt(fps: number): void {
  if (fps < 28) {
    if (++lowFrames > 30 && cols > MIN_COLS) {
      cols = Math.max(MIN_COLS, cols - 80);
      applyResolution();
      lowFrames = 0;
    }
  } else lowFrames = 0;
  if (fps > 56) {
    if (++highFrames > 120 && cols < MAX_COLS) {
      cols = Math.min(MAX_COLS, cols + 80);
      applyResolution();
      highFrames = 0;
    }
  } else highFrames = 0;
}

// --- loop ---
const loop = new GameLoop({
  update: (dt) => {
    if (touch.consumePause() || keyboard.consumePause()) paused = !paused;
    if (paused || victory) return;
    if (world.player.health <= 0 || world.levelComplete) return; // freeze until tap
    step(world, dt, sampleInput());
    audio.play(world.events);
  },
  render: (_alpha, fps) => {
    renderer.render(world);
    offCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(off, 0, 0, cssW, cssH);
    drawTouchUi();
    drawHud(ctx, world, cssW, cssH, fps, CAMPAIGN[levelIndex].name);
    if (paused) overlay('PAUSED', 'tap pause again to resume');
    if (victory) overlay('YOU ESCAPED', 'tap to play again');
    adapt(fps);
  },
});

function overlay(big: string, small: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFE08A';
  ctx.font = '800 46px system-ui, sans-serif';
  ctx.fillText(big, cssW / 2, cssH / 2);
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(small, cssW / 2, cssH / 2 + 40);
  ctx.restore();
}

function drawTouchUi(): void {
  const ui = touch.ui();
  ctx.save();
  ctx.lineWidth = 3;
  if (ui.joyActive) {
    ring(ui.joyX, ui.joyY, 70, 'rgba(255,255,255,0.18)');
    disc(ui.joyX + ui.joyDX, ui.joyY + ui.joyDY, 28, 'rgba(255,255,255,0.30)');
  }
  disc(ui.fireCX, ui.fireCY, 50, 'rgba(220,60,60,0.30)');
  ring(ui.fireCX, ui.fireCY, 50, 'rgba(255,120,120,0.5)');
  disc(ui.swapCX, ui.swapCY, 30, 'rgba(120,160,255,0.25)');
  ring(ui.swapCX, ui.swapCY, 30, 'rgba(160,190,255,0.5)');
  // pause button (two bars)
  disc(ui.pauseCX, ui.pauseCY, 26, 'rgba(0,0,0,0.3)');
  ring(ui.pauseCX, ui.pauseCY, 26, 'rgba(220,220,235,0.6)');
  ctx.fillStyle = 'rgba(230,230,245,0.85)';
  ctx.fillRect(ui.pauseCX - 7, ui.pauseCY - 8, 4, 16);
  ctx.fillRect(ui.pauseCX + 3, ui.pauseCY - 8, 4, 16);
  ctx.restore();
}

function disc(x: number, y: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function ring(x: number, y: number, r: number, stroke: string): void {
  ctx.strokeStyle = stroke;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

bootFromSave();
window.addEventListener('resize', resize);
resize();
loop.start();

const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
void orientation?.lock?.('landscape').catch(() => {});

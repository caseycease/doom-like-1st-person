// Composition root: wires PLATFORM (canvas, input, audio, loop) to the pure
// ENGINE and the renderer. This is the only file that touches everything.

import './style.css';
import { createWorld, step, type World } from './engine/world';
import { emptyInput, type InputState } from './engine/input';
import { level01 } from './levels/level01';
import { ProceduralAssets } from './assets/procedural';
import { Renderer } from './render/renderer';
import { drawHud } from './render/hud';
import { GameLoop } from './platform/loop';
import { TouchControls } from './platform/touch';
import { KeyboardControls } from './platform/keyboard';
import { AudioEngine } from './platform/audio';

const BASE_COLS = 480;
const MIN_COLS = 240;
const MAX_COLS = 480;

const display = document.getElementById('game') as HTMLCanvasElement;
const ctx = display.getContext('2d')!;

const assets = new ProceduralAssets();
let world: World = createWorld(level01);

let cols = BASE_COLS;
let cssW = 1;
let cssH = 1;
let dpr = 1;
let renderer = new Renderer(cols, Math.round((cols * 9) / 16), assets);

// offscreen buffer canvas we putImageData into, then upscale to the display.
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
  // movement: prefer whichever stick/keys are active this tick
  if (t.move.x !== 0 || t.move.y !== 0) {
    out.move = t.move;
  } else {
    out.move = k.move;
  }
  out.look.x = t.look.x + k.look.x;
  out.look.y = t.look.y + k.look.y;
  out.firing = t.firing || k.firing;
  out.swapWeapon = t.swapWeapon || k.swapWeapon;
  return out;
}

// --- restart handling ---
function restartIfRequested(): void {
  if (world.player.health <= 0 || world.levelComplete) {
    world = createWorld(level01);
  }
}
display.addEventListener('pointerdown', () => {
  audio.resume();
  restartIfRequested();
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
    if (world.player.health <= 0) return; // freeze sim on death until restart
    const input = sampleInput();
    step(world, dt, input);
    audio.play(world.events);
  },
  render: (_alpha, fps) => {
    renderer.render(world);
    offCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(off, 0, 0, cssW, cssH);
    drawTouchUi();
    drawHud(ctx, world, cssW, cssH, fps);
    adapt(fps);
  },
});

function drawTouchUi(): void {
  const ui = touch.ui();
  ctx.save();
  ctx.lineWidth = 3;
  // joystick
  if (ui.joyActive) {
    ring(ctx, ui.joyX, ui.joyY, 70, 'rgba(255,255,255,0.18)');
    disc(ctx, ui.joyX + ui.joyDX, ui.joyY + ui.joyDY, 28, 'rgba(255,255,255,0.30)');
  }
  // fire button
  disc(ctx, ui.fireCX, ui.fireCY, 50, 'rgba(220,60,60,0.30)');
  ring(ctx, ui.fireCX, ui.fireCY, 50, 'rgba(255,120,120,0.5)');
  // swap button
  disc(ctx, ui.swapCX, ui.swapCY, 30, 'rgba(120,160,255,0.25)');
  ring(ctx, ui.swapCX, ui.swapCY, 30, 'rgba(160,190,255,0.5)');
  ctx.restore();
}

function disc(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}
function ring(c: CanvasRenderingContext2D, x: number, y: number, r: number, stroke: string): void {
  c.strokeStyle = stroke;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
}

window.addEventListener('resize', resize);
resize();
loop.start();

// Best-effort landscape lock (ignored where unsupported).
const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
void orientation?.lock?.('landscape').catch(() => {});

/**
 * Generate a CWS-compliant 128x128 store icon using Node canvas.
 * Requirements: 128x128 PNG, ~96x96 content centered with ~16px padding.
 */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const SIZE = 128;
const PAD = 16;
const CONTENT = SIZE - PAD * 2; // 96
const RADIUS = 16;

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// Transparent background (default)

// Draw rounded rectangle with gradient
const grad = ctx.createLinearGradient(PAD, PAD, PAD + CONTENT, PAD + CONTENT);
grad.addColorStop(0, '#2563EB');
grad.addColorStop(1, '#06B6D4');

ctx.fillStyle = grad;
ctx.beginPath();
ctx.roundRect(PAD, PAD, CONTENT, CONTENT, RADIUS);
ctx.fill();

// Draw "W" lettermark
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 56px Arial, Helvetica, sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('W', SIZE / 2, SIZE / 2 + 2);

// Save
const buf = canvas.toBuffer('image/png');
writeFileSync('store-assets/store-icon-128x128.png', buf);
console.log(`✅ store-icon-128x128.png (${buf.length} bytes)`);

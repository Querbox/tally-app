import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons');

// DMG window size: 540x380
const width = 540;
const height = 380;

// Create SVG for the background
const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Subtle gradient background -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FAFAFA"/>
      <stop offset="50%" style="stop-color:#F5F5F5"/>
      <stop offset="100%" style="stop-color:#F0F0F0"/>
    </linearGradient>

    <!-- Decorative circles -->
    <radialGradient id="circle1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#E5E5E5;stop-opacity:0.5"/>
      <stop offset="100%" style="stop-color:#E5E5E5;stop-opacity:0"/>
    </radialGradient>

    <radialGradient id="circle2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#D4D4D4;stop-opacity:0.3"/>
      <stop offset="100%" style="stop-color:#D4D4D4;stop-opacity:0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>

  <!-- Decorative elements -->
  <circle cx="-50" cy="-50" r="200" fill="url(#circle1)"/>
  <circle cx="${width + 50}" cy="${height + 50}" r="250" fill="url(#circle2)"/>
  <circle cx="${width - 100}" cy="50" r="100" fill="url(#circle1)"/>

  <!-- Subtle grid pattern -->
  <g opacity="0.03">
    ${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 30}" y1="0" x2="${i * 30}" y2="${height}" stroke="#000" stroke-width="1"/>`).join('')}
    ${Array.from({ length: 15 }, (_, i) => `<line x1="0" y1="${i * 30}" x2="${width}" y2="${i * 30}" stroke="#000" stroke-width="1"/>`).join('')}
  </g>

  <!-- Title -->
  <text x="${width / 2}" y="55"
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
        font-size="24"
        font-weight="600"
        fill="#1A1A1A"
        text-anchor="middle">
    Tally installieren
  </text>

  <!-- Subtitle -->
  <text x="${width / 2}" y="80"
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
        font-size="13"
        fill="#737373"
        text-anchor="middle">
    Ziehe Tally in den Programme-Ordner
  </text>

  <!-- Arrow between icons -->
  <g transform="translate(${width / 2 - 30}, 185)">
    <!-- Arrow line -->
    <line x1="0" y1="12" x2="45" y2="12" stroke="#A3A3A3" stroke-width="2" stroke-linecap="round"/>
    <!-- Arrow head -->
    <polyline points="38,6 48,12 38,18" fill="none" stroke="#A3A3A3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <!-- Labels -->
  <text x="130" y="290"
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
        font-size="12"
        fill="#525252"
        text-anchor="middle"
        font-weight="500">
    Tally
  </text>

  <text x="410" y="290"
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
        font-size="12"
        fill="#525252"
        text-anchor="middle"
        font-weight="500">
    Programme
  </text>

  <!-- Bottom branding -->
  <text x="${width / 2}" y="${height - 25}"
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
        font-size="11"
        fill="#A3A3A3"
        text-anchor="middle">
    Version 1.2.0
  </text>
</svg>
`;

// Generate 1x image
await sharp(Buffer.from(svg))
  .png()
  .toFile(join(iconsDir, 'dmg-background.png'));

console.log('Created dmg-background.png');

// Generate 2x image for Retina displays
const svg2x = svg
  .replace(`width="${width}"`, `width="${width * 2}"`)
  .replace(`height="${height}"`, `height="${height * 2}"`)
  .replace(/font-size="(\d+)"/g, (_, size) => `font-size="${parseInt(size) * 2}"`)
  .replace(/r="(\d+)"/g, (_, r) => `r="${parseInt(r) * 2}"`)
  .replace(/cx="(-?\d+)"/g, (_, cx) => `cx="${parseInt(cx) * 2}"`)
  .replace(/cy="(-?\d+)"/g, (_, cy) => `cy="${parseInt(cy) * 2}"`)
  .replace(/x="(\d+)"/g, (_, x) => `x="${parseInt(x) * 2}"`)
  .replace(/y="(\d+)"/g, (_, y) => `y="${parseInt(y) * 2}"`)
  .replace(/x1="(\d+)"/g, (_, x) => `x1="${parseInt(x) * 2}"`)
  .replace(/y1="(\d+)"/g, (_, y) => `y1="${parseInt(y) * 2}"`)
  .replace(/x2="(\d+)"/g, (_, x) => `x2="${parseInt(x) * 2}"`)
  .replace(/y2="(\d+)"/g, (_, y) => `y2="${parseInt(y) * 2}"`)
  .replace(/stroke-width="(\d+)"/g, (_, w) => `stroke-width="${parseInt(w) * 2}"`)
  .replace(/transform="translate\((\d+), (\d+)\)"/g, (_, x, y) => `transform="translate(${parseInt(x) * 2}, ${parseInt(y) * 2})"`)
  .replace(/points="(\d+),(\d+) (\d+),(\d+) (\d+),(\d+)"/g, (_, x1, y1, x2, y2, x3, y3) =>
    `points="${parseInt(x1) * 2},${parseInt(y1) * 2} ${parseInt(x2) * 2},${parseInt(y2) * 2} ${parseInt(x3) * 2},${parseInt(y3) * 2}"`);

await sharp(Buffer.from(svg2x))
  .png()
  .toFile(join(iconsDir, 'dmg-background@2x.png'));

console.log('Created dmg-background@2x.png');
console.log('Done!');

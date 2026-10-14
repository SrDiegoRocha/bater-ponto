// Gera todos os PNGs da marca a partir da geometria do símbolo (seção 6.2 / 6.8 do PLANEJAMENTO.md).
// Uso: npm run brand
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const MINT = '#3DDC97';
const MINT_LIGHT = '#0B7F50';
const INK = '#0B0D10';

// Geometria em unidades de 24u: anel r=9 centrado em (12,12), arco de 300°, ponto r=2.25 no fim.
// A extensão total do símbolo (incluindo o ponto) é de ~22.5u.
function symbol({ color, stroke = 2.5, dot = 2.25 }) {
  return `
    <path d="M12 3 A9 9 0 1 1 4.2058 7.5" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>
    <circle cx="4.2058" cy="7.5" r="${dot}" fill="${color}"/>`;
}

// size = lado do PNG; scale = fração do lado ocupada pelos 24u do símbolo
function svg({ size, scale, color, background, stroke, dot }) {
  const units = 24 / scale; // viewBox centrado no símbolo
  const offset = (units - 24) / 2;
  const bg = background ? `<rect x="${-offset}" y="${-offset}" width="${units}" height="${units}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-offset} ${-offset} ${units} ${units}">${bg}${symbol({ color, stroke, dot })}</svg>`;
}

function render(file, options) {
  const png = new Resvg(svg(options), { fitTo: { mode: 'width', value: options.size } }).render().asPng();
  const out = join(root, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png);
  console.log(`✓ ${file} (${options.size}px)`);
}

// Ícone legado / Play Store: sangrado, menta sobre Tinta
render('assets/icon.png', { size: 1024, scale: 0.56, color: MINT, background: INK });
render('assets/store/play-store-icon.png', { size: 512, scale: 0.56, color: MINT, background: INK });

// Ícone adaptativo: zona segura = 66/108 do canvas. O símbolo ocupa ~47%, com folga dentro dela.
render('assets/android-icon-foreground.png', { size: 1024, scale: 0.47, color: MINT });
render('assets/android-icon-monochrome.png', { size: 1024, scale: 0.47, color: '#FFFFFF' });

// Splash (API de splash do Android 12+: ícone recortado num círculo, por isso a margem generosa)
render('assets/splash-icon.png', { size: 1024, scale: 0.62, color: MINT_LIGHT });
render('assets/splash-icon-dark.png', { size: 1024, scale: 0.62, color: MINT });

// Favicon: traço e ponto mais grossos para ler bem em 48px
render('assets/favicon.png', { size: 48, scale: 0.78, color: MINT, background: INK, stroke: 3.2, dot: 2.8 });

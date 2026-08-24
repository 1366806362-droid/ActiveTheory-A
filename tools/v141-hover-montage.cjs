const path = require('node:path');
const sharp = require('sharp');

const directory = path.resolve(
  process.env.ACTIVETHEORY_V141_GATE_DIR
    || 'art/visual-gate/universe-composition-v1'
);
const output = path.join(directory, 'V141_HOVER_MONTAGE.png');
const panels = [
  ['V141_DEFAULT.png', 'DEFAULT', 0, 0],
  ['V141_GEO_HOVER.png', 'GEO HOVER', 640, 0],
  ['V141_5A_HOVER.png', '5A HOVER', 0, 360],
  ['V141_BRAND_MIND_HOVER.png', 'BRAND MIND HOVER', 640, 360]
];

function createPanelLabel(text) {
  return Buffer.from(`
    <svg width="220" height="34" xmlns="http://www.w3.org/2000/svg">
      <rect width="220" height="34" rx="2" fill="rgba(1,7,18,0.72)"/>
      <text x="12" y="22" fill="#bcecff" font-family="Arial, sans-serif"
        font-size="13" font-weight="600" letter-spacing="2">${text}</text>
    </svg>
  `);
}

(async () => {
  const composites = await Promise.all(panels.map(async ([file, label, left, top]) => {
    const input = await sharp(path.join(directory, file))
      .resize(640, 360)
      .composite([{ input: createPanelLabel(label), left: 14, top: 12 }])
      .png()
      .toBuffer();
    return { input, left, top };
  }));

  await sharp({
    create: { width: 1280, height: 720, channels: 3, background: '#010612' }
  }).composite(composites).png().toFile(output);
  console.log(output);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

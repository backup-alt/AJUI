const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.resolve(__dirname, '..', '..', 'logo.png');
const ANDROID_RES = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Standard launcher icon densities
const DENSITIES = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192,
};

const FG_DENSITIES = {
  'mdpi': 108,
  'hdpi': 162,
  'xhdpi': 216,
  'xxhdpi': 324,
  'xxxhdpi': 432,
};

function logoBufferBase64() {
  return fs.readFileSync(SRC).toString('base64');
}

async function makeIcon(size, round) {
  const innerSize = Math.round(size * 0.78);
  const offset = Math.round((size - innerSize) / 2);
  const radius = round ? size / 2 : Math.round(size * 0.18);

  const bgShape = round
    ? `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#002263"/>`
    : `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#002263"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    ${bgShape}
    <image href="data:image/png;base64,${logoBufferBase64()}" x="${offset}" y="${offset}" width="${innerSize}" height="${innerSize}"/>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function run() {
  if (!fs.existsSync(SRC)) {
    console.error('Source logo not found at', SRC);
    process.exit(1);
  }

  for (const [den, size] of Object.entries(DENSITIES)) {
    const outPath = path.join(ANDROID_RES, `mipmap-${den}`, 'ic_launcher.png');
    const roundPath = path.join(ANDROID_RES, `mipmap-${den}`, 'ic_launcher_round.png');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    await makeIcon(size, false).then((buf) => fs.promises.writeFile(outPath, buf));
    console.log('Wrote', outPath);

    await makeIcon(size, true).then((buf) => fs.promises.writeFile(roundPath, buf));
    console.log('Wrote', roundPath);
  }

  for (const [den, size] of Object.entries(FG_DENSITIES)) {
    const outPath = path.join(ANDROID_RES, `drawable-${den}`, 'ic_launcher_foreground.png');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const innerW = Math.round(size * 0.55);
    const pad = Math.round((size - innerW) / 2);
    await sharp(SRC)
      .resize(innerW, innerW, { fit: 'contain' })
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outPath);
    console.log('Wrote', outPath);
  }

  // Adaptive icon background as a vector drawable
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#002263"
        android:pathData="M0,0h108v108h-108z"/>
</vector>`;
  fs.writeFileSync(path.join(ANDROID_RES, 'drawable', 'ic_launcher_background.xml'), bgXml);
  console.log('Wrote drawable/ic_launcher_background.xml');

  // Splash screen background (royal blue with logo)
  const splashXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@drawable/splash_bg"/>
</layer-list>`;
  fs.writeFileSync(path.join(ANDROID_RES, 'drawable', 'splash_screen.xml'), splashXml);
  fs.writeFileSync(
    path.join(ANDROID_RES, 'drawable', 'splash_bg.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#002263"
        android:pathData="M0,0h108v108h-108z"/>
</vector>`
  );

  console.log('Done.');
}

run().catch((e) => { console.error(e); process.exit(1); });
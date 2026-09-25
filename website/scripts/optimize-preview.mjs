import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, '../assets/Preview.png');
const outputPathPng = path.resolve(__dirname, '../public/preview.png');
const outputPathJpg = path.resolve(__dirname, '../public/preview.jpg');

async function optimize() {
  console.log('Reading input:', inputPath);
  const metadata = await sharp(inputPath).metadata();
  console.log(`Original: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

  // Standard OpenGraph dimension is 1200x630 (1.91:1) or 1200x675 (16:9)
  // WhatsApp / iMessage hard limit is < 300 KB!
  await sharp(inputPath)
    .resize(1200, 630, { fit: 'cover' })
    .png({
      quality: 85,
      compressionLevel: 9,
      palette: true,
      colours: 256,
      effort: 10,
    })
    .toFile(outputPathPng);

  const pngStats = fs.statSync(outputPathPng);
  console.log(`Optimized preview.png: ${pngStats.size} bytes (${(pngStats.size / 1024).toFixed(1)} KB)`);

  await sharp(inputPath)
    .resize(1200, 630, { fit: 'cover' })
    .jpeg({
      quality: 88,
      mozjpeg: true,
    })
    .toFile(outputPathJpg);

  const jpgStats = fs.statSync(outputPathJpg);
  console.log(`Optimized preview.jpg: ${jpgStats.size} bytes (${(jpgStats.size / 1024).toFixed(1)} KB)`);
}

optimize().catch(err => {
  console.error('Error optimizing preview:', err);
  process.exit(1);
});

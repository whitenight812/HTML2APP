import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const ANDROID_ICON_SIZES = [
  { name: 'mdpi', size: 48, density: 'mdpi' },
  { name: 'hdpi', size: 72, density: 'hdpi' },
  { name: 'xhdpi', size: 96, density: 'xhdpi' },
  { name: 'xxhdpi', size: 144, density: 'xxhdpi' },
  { name: 'xxxhdpi', size: 192, density: 'xxxhdpi' },
];

function toSharpInput(source: string | Buffer): Buffer | string {
  if (Buffer.isBuffer(source)) return source;
  // Strip data:image/...;base64, prefix — sharp treats plain strings as file paths
  if (source.startsWith('data:')) {
    const b64 = source.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(b64, 'base64');
  }
  return source;
}

export async function generateIcons(
  imageSource: string | Buffer,
  androidResDir: string
): Promise<void> {
  const baseImage = sharp(toSharpInput(imageSource)).resize(192, 192);

  for (const { name, size } of ANDROID_ICON_SIZES) {
    const dir = path.join(androidResDir, `mipmap-${name}`);
    await fs.mkdir(dir, { recursive: true });

    await baseImage
      .clone()
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // Also create round icon
    await baseImage
      .clone()
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));
  }

  // Remove adaptive icon XML so Android uses our PNGs instead
  const adaptiveDir = path.join(androidResDir, 'mipmap-anydpi-v26');
  try { await fs.rm(adaptiveDir, { recursive: true, force: true }); } catch {}
}

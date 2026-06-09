import fs from "node:fs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export type DiffResult = {
  diffScore: number;
  diffImagePath: string;
  changedPixels: number;
  totalPixels: number;
};

/**
 * Pixel-diffs two PNG screenshots. Produces a red-highlight diff image at
 * diffOutputPath and returns a DiffResult with the fraction of changed pixels.
 */
export async function diffScreenshots(opts: {
  baselinePath: string;
  currentPath: string;
  diffOutputPath: string;
  threshold?: number;
}): Promise<DiffResult> {
  const baselinePng = PNG.sync.read(fs.readFileSync(opts.baselinePath));
  const currentPng = PNG.sync.read(fs.readFileSync(opts.currentPath));

  // Use the larger dimensions for the diff canvas.
  const width = Math.max(baselinePng.width, currentPng.width);
  const height = Math.max(baselinePng.height, currentPng.height);

  // Pad images to the same size if they differ.
  function padImage(src: PNG): Buffer {
    if (src.width === width && src.height === height) {
      return src.data;
    }
    const padded = Buffer.alloc(width * height * 4, 0);
    for (let y = 0; y < src.height && y < height; y++) {
      for (let x = 0; x < src.width && x < width; x++) {
        const srcIdx = (y * src.width + x) * 4;
        const dstIdx = (y * width + x) * 4;
        padded[dstIdx] = src.data[srcIdx]!;
        padded[dstIdx + 1] = src.data[srcIdx + 1]!;
        padded[dstIdx + 2] = src.data[srcIdx + 2]!;
        padded[dstIdx + 3] = src.data[srcIdx + 3]!;
      }
    }
    return padded;
  }

  const img1 = padImage(baselinePng);
  const img2 = padImage(currentPng);

  const diffPng = new PNG({ width, height });

  const changedPixels = pixelmatch(img1, img2, diffPng.data, width, height, {
    threshold: opts.threshold ?? 0.1,
    includeAA: true,
  });

  fs.writeFileSync(opts.diffOutputPath, PNG.sync.write(diffPng));

  const totalPixels = width * height;
  const diffScore = totalPixels > 0 ? changedPixels / totalPixels : 0;

  return {
    diffScore,
    diffImagePath: opts.diffOutputPath,
    changedPixels,
    totalPixels,
  };
}

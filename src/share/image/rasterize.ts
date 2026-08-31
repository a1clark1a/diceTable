import type { ShareImage } from './buildShareSvg';

// A data: URL, never a blob: one. The deployed CSP allows `img-src 'self' data:`
// and nothing else, so a blob URL would be refused before the image ever
// decoded. Everything the SVG needs is inlined, so the canvas never taints and
// toBlob always succeeds.
function toDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The comparison could not be drawn.'));
    img.src = src;
  });
}

export async function rasterize(image: ShareImage): Promise<Blob> {
  const img = await loadImage(toDataUrl(image.svg));

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('This browser would not give us a drawing surface.');
  }
  ctx.drawImage(img, 0, 0, image.width, image.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error('The image could not be saved.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

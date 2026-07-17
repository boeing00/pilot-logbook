/**
 * Prepare a phone photo / scan for Tesseract. Real logbook photos are often
 * huge (12–48 MP) or slightly soft; Tesseract works best on a sharpened,
 * high-contrast grayscale image around 2000–3000 px on the long edge.
 */
export async function prepareImageForOcr(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const maxEdge = 3200
    const minEdge = 2000
    const long = Math.max(bitmap.width, bitmap.height)
    let scale = 1
    if (long > maxEdge) scale = maxEdge / long
    else if (long < minEdge) scale = Math.min(3, minEdge / long)

    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Canvas unavailable for OCR preprocessing')

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)

    const image = ctx.getImageData(0, 0, w, h)
    const d = image.data

    // Grayscale + mild contrast stretch around the midtones, then a soft
    // unsharp-ish boost by pushing mid values apart. Keeps thin table text
    // readable without turning the paper into pure black/white speckles.
    let min = 255
    let max = 0
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      if (g < min) min = g
      if (g > max) max = g
    }
    const range = Math.max(1, max - min)
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      let v = ((g - min) / range) * 255
      // Extra midtone contrast (S-curve-ish).
      v = ((v / 255 - 0.5) * 1.35 + 0.5) * 255
      v = Math.max(0, Math.min(255, v))
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(image, 0, 0)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode preprocessed image'))),
        'image/png',
      )
    })
    return blob
  } finally {
    bitmap.close()
  }
}

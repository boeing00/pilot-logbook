import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import Tesseract from 'tesseract.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type ProgressFn = (message: string, ratio?: number) => void

interface TextItemLike {
  str: string
  width?: number
  transform: number[]
}

interface Glyph {
  x: number
  width: number
  str: string
}

/**
 * Join glyphs on a row into text. pdf.js often emits each character as its own
 * item, so a naive join with spaces produces "2 0 2 6". Instead we concatenate
 * directly and only insert a space where there is a real horizontal gap between
 * consecutive glyphs. Existing space glyphs are preserved and de-duplicated.
 */
function joinRow(parts: Glyph[]): string {
  parts.sort((a, b) => a.x - b.x)
  let out = ''
  let prevEnd: number | null = null
  for (const p of parts) {
    if (prevEnd !== null && p.x - prevEnd > 1.2) out += ' '
    out += p.str
    prevEnd = p.x + p.width
  }
  return out.replace(/\s+/g, ' ').trim()
}

/**
 * Extract text from a text-based PDF using pdf.js. Items are grouped into rows
 * by their vertical position so that table rows survive extraction.
 */
async function extractPdfText(file: File, onProgress?: ProgressFn): Promise<string> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pages: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(`Reading PDF page ${pageNum}/${pdf.numPages}`, pageNum / pdf.numPages)
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const items = content.items as TextItemLike[]

    // Bucket items into lines by their y-coordinate (transform[5]).
    const rows = new Map<number, Glyph[]>()
    for (const item of items) {
      if (!item.str) continue
      const y = Math.round(item.transform[5])
      const x = item.transform[4]
      const bucketKey = [...rows.keys()].find((k) => Math.abs(k - y) <= 3) ?? y
      const bucket = rows.get(bucketKey) ?? []
      bucket.push({ x, width: item.width ?? 0, str: item.str })
      rows.set(bucketKey, bucket)
    }

    const sortedRows = [...rows.entries()].sort((a, b) => b[0] - a[0])
    const lines = sortedRows.map(([, parts]) => joinRow(parts))
    pages.push(lines.join('\n'))
  }

  return pages.join('\n')
}

/** OCR an image file (JPG/PNG, e.g. a phone photo) using tesseract.js. */
async function extractImageText(file: File, onProgress?: ProgressFn): Promise<string> {
  onProgress?.('Loading OCR engine…', 0)
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.('Recognizing text…', m.progress)
      } else {
        onProgress?.(m.status)
      }
    },
  })
  try {
    // Whitelist the characters that appear in a logbook to reduce OCR noise.
    await worker.setParameters({
      tessedit_char_whitelist:
        '0123456789:/-* ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    })
    const { data } = await worker.recognize(file)
    return data.text
  } finally {
    await worker.terminate()
  }
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp']

export function isSupportedFile(file: File): boolean {
  if (file.type === 'application/pdf') return true
  if (IMAGE_TYPES.includes(file.type)) return true
  return /\.(pdf|jpe?g|png|webp|bmp)$/i.test(file.name)
}

export async function extractText(file: File, onProgress?: ProgressFn): Promise<string> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (isPdf) return extractPdfText(file, onProgress)
  return extractImageText(file, onProgress)
}

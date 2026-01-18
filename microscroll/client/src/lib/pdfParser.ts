/**
 * PDF Text Extraction Utility
 * 
 * Extracts text content from PDF files using native browser APIs
 * and basic PDF structure parsing without external libraries.
 */

interface PDFTextResult {
  text: string
  pageCount: number
  metadata?: {
    title?: string
    author?: string
  }
}

/**
 * Extract text from a PDF file
 * Uses pdf.js library loaded from CDN for reliable parsing
 */
export async function extractTextFromPDF(file: File): Promise<PDFTextResult> {
  // Load pdf.js from CDN if not already loaded
  await loadPdfJs()
  
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise
  
  let fullText = ''
  const pageCount = pdf.numPages
  
  // Extract text from each page
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    
    // Combine text items with proper spacing
    const pageText = textContent.items
      .map((item: any) => {
        // Add newline for significant Y position changes
        return item.str
      })
      .join(' ')
    
    fullText += pageText + '\n\n'
  }
  
  // Try to extract metadata
  let metadata: PDFTextResult['metadata']
  try {
    const info = await pdf.getMetadata()
    metadata = {
      title: info?.info?.Title,
      author: info?.info?.Author,
    }
  } catch {
    // Metadata extraction failed, continue without it
  }
  
  return {
    text: cleanText(fullText),
    pageCount,
    metadata,
  }
}

/**
 * Load pdf.js library from CDN
 */
async function loadPdfJs(): Promise<void> {
  if ((window as any).pdfjsLib) {
    return
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      // Set worker source
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load PDF.js'))
    document.head.appendChild(script)
  })
}

/**
 * Clean extracted text
 * - Remove excessive whitespace
 * - Fix common OCR issues
 * - Normalize line endings
 */
function cleanText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Fix common ligature issues
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    // Remove null characters
    .replace(/\0/g, '')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Normalize dashes
    .replace(/[–—]/g, '-')
    // Split into paragraphs on double newlines
    .replace(/\n\n+/g, '\n\n')
    // Trim
    .trim()
}

/**
 * Check if a file is a valid PDF
 */
export function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/**
 * Estimate reading time for extracted text
 * Average reading speed: 200-250 words per minute
 */
export function estimateReadingTime(text: string): number {
  const wordCount = text.split(/\s+/).length
  return Math.ceil(wordCount / 225) // minutes
}

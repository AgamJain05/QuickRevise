/**
 * DOCX Text Extraction Utility
 * 
 * Extracts text content from DOCX files by parsing the underlying XML
 * without external libraries (using native browser APIs).
 */

import JSZip from 'jszip'

interface DOCXTextResult {
  text: string
  paragraphs: string[]
  metadata?: {
    title?: string
    author?: string
    created?: string
  }
}

/**
 * Extract text from a DOCX file
 * DOCX files are ZIP archives containing XML files
 */
export async function extractTextFromDOCX(file: File): Promise<DOCXTextResult> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  
  // Main document content is in word/document.xml
  const documentXml = await zip.file('word/document.xml')?.async('string')
  
  if (!documentXml) {
    throw new Error('Invalid DOCX file: document.xml not found')
  }
  
  // Parse the XML
  const parser = new DOMParser()
  const doc = parser.parseFromString(documentXml, 'text/xml')
  
  // Extract text from paragraphs
  const paragraphs = extractParagraphs(doc)
  const text = paragraphs.join('\n\n')
  
  // Try to extract metadata from docProps/core.xml
  let metadata: DOCXTextResult['metadata']
  try {
    const coreXml = await zip.file('docProps/core.xml')?.async('string')
    if (coreXml) {
      metadata = extractMetadata(coreXml)
    }
  } catch {
    // Metadata extraction failed, continue without it
  }
  
  return {
    text: cleanText(text),
    paragraphs,
    metadata,
  }
}

/**
 * Extract paragraphs from DOCX XML document
 */
function extractParagraphs(doc: Document): string[] {
  const paragraphs: string[] = []
  
  // DOCX uses namespaces, we need to handle them
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  
  // Get all paragraph elements
  const pElements = doc.getElementsByTagNameNS(ns, 'p')
  
  for (let i = 0; i < pElements.length; i++) {
    const p = pElements[i]
    const textContent = extractTextFromElement(p, ns)
    
    if (textContent.trim()) {
      paragraphs.push(textContent.trim())
    }
  }
  
  return paragraphs
}

/**
 * Extract text from a paragraph element, handling nested runs
 */
function extractTextFromElement(element: Element, ns: string): string {
  let text = ''
  
  // Get all text elements (w:t)
  const textElements = element.getElementsByTagNameNS(ns, 't')
  
  for (let i = 0; i < textElements.length; i++) {
    const t = textElements[i]
    text += t.textContent || ''
  }
  
  // Handle tab characters
  const tabElements = element.getElementsByTagNameNS(ns, 'tab')
  if (tabElements.length > 0) {
    text = text.replace(/\t/g, '    ')
  }
  
  return text
}

/**
 * Extract metadata from core.xml
 */
function extractMetadata(coreXml: string): DOCXTextResult['metadata'] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(coreXml, 'text/xml')
  
  const dcNs = 'http://purl.org/dc/elements/1.1/'
  const dcTermsNs = 'http://purl.org/dc/terms/'
  
  return {
    title: doc.getElementsByTagNameNS(dcNs, 'title')[0]?.textContent || undefined,
    author: doc.getElementsByTagNameNS(dcNs, 'creator')[0]?.textContent || undefined,
    created: doc.getElementsByTagNameNS(dcTermsNs, 'created')[0]?.textContent || undefined,
  }
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    // Normalize whitespace within paragraphs
    .replace(/[ \t]+/g, ' ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim lines
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Final trim
    .trim()
}

/**
 * Check if a file is a valid DOCX
 */
export function isDOCX(file: File): boolean {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  )
}

/**
 * Extract text from PPTX (PowerPoint) files
 * Similar structure to DOCX but slides are in ppt/slides/
 */
export async function extractTextFromPPTX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  
  const texts: string[] = []
  const slidePattern = /^ppt\/slides\/slide\d+\.xml$/
  
  // Get all slide files and sort them
  const slideFiles = Object.keys(zip.files)
    .filter(name => slidePattern.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0')
      const numB = parseInt(b.match(/\d+/)?.[0] || '0')
      return numA - numB
    })
  
  for (const slidePath of slideFiles) {
    const slideXml = await zip.file(slidePath)?.async('string')
    if (slideXml) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(slideXml, 'text/xml')
      
      // Extract text from a:t elements (DrawingML text)
      const textElements = doc.getElementsByTagNameNS(
        'http://schemas.openxmlformats.org/drawingml/2006/main',
        't'
      )
      
      const slideTexts: string[] = []
      for (let i = 0; i < textElements.length; i++) {
        const text = textElements[i].textContent?.trim()
        if (text) {
          slideTexts.push(text)
        }
      }
      
      if (slideTexts.length > 0) {
        texts.push(slideTexts.join('\n'))
      }
    }
  }
  
  return texts.join('\n\n---\n\n')
}

/**
 * Check if a file is a valid PPTX
 */
export function isPPTX(file: File): boolean {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file.name.toLowerCase().endsWith('.pptx')
  )
}

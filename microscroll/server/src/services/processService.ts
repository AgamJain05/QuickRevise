import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { extractText } from './parserService.js';
import { generateCardsFromContent, GEMINI_LIMITS, CARD_CONFIG } from './aiService.js';
import { estimateCardCount } from './chunkerService.js';
import { errors } from '../utils/errors.js';
import { getFileType } from '../middleware/upload.js';

// Processing job status
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ProcessingStep = 'upload' | 'parsing' | 'generating';

// Export limits for frontend
export const CONTENT_LIMITS = {
  maxChars: GEMINI_LIMITS.maxInputChars,
  maxCharsFormatted: '30,000',
  approximatePages: 15,
  approximateWords: 5000,
  cardConfig: CARD_CONFIG,
};

// ===========================================
// Process Uploaded File
// ===========================================

export interface ProcessFileOptions {
  userId: string;
  filePath: string;
  fileName: string;
  title?: string;
}

export async function processFile(options: ProcessFileOptions) {
  console.log('🔄 [Service.processFile] Starting...');
  console.log('🔄 [Service.processFile] Options:', {
    userId: options.userId,
    filePath: options.filePath,
    fileName: options.fileName,
    title: options.title,
  });
  
  const { userId, filePath, fileName, title } = options;
  const fileType = getFileType(fileName);
  console.log('🔄 [Service.processFile] Detected file type:', fileType);

  // Create processing job
  console.log('🔄 [Service.processFile] Creating processing job...');
  const job = await prisma.processingJob.create({
    data: {
      userId,
      status: 'processing',
      step: 'parsing',
      progress: 10,
      filePath,
      fileName,
      fileType,
    },
  });
  console.log('🔄 [Service.processFile] Job created with ID:', job.id);

  try {
    // Step 1: Parse file and extract text
    await updateJob(job.id, 'parsing', 20);
    console.log(`📂 [Service.processFile] Step 1: Parsing ${fileType.toUpperCase()} file: ${fileName}`);
    
    let text: string;
    try {
      console.log('🔄 [Service.processFile] Calling extractText...');
      text = await extractText(filePath, fileType);
      console.log('🔄 [Service.processFile] extractText returned:', text?.length || 0, 'chars');
    } catch (parseError) {
      console.error(`❌ [Service.processFile] File parsing failed for ${fileName}:`, parseError);
      console.error('❌ [Service.processFile] Parse error stack:', parseError instanceof Error ? parseError.stack : 'No stack');
      throw new Error(
        parseError instanceof Error 
          ? parseError.message 
          : 'Failed to extract text from file'
      );
    }

    console.log(`📝 [Service.processFile] Extracted ${text?.length || 0} characters from ${fileName}`);
    console.log(`📝 [Service.processFile] Text preview: "${text?.slice(0, 200)}..."`)

    if (!text || text.trim().length < 50) {
      throw new Error(
        `Not enough text content extracted from file (got ${text?.trim().length || 0} chars, need at least 50). ` +
        'The file may be empty, scanned, or image-based.'
      );
    }

    // Trim to Gemini limits
    if (text.length > GEMINI_LIMITS.maxInputChars) {
      text = text.slice(0, GEMINI_LIMITS.maxInputChars);
    }

    // Estimate expected cards
    const expectedCards = estimateCardCount(text);
    console.log(`📄 Processing ${fileName}: ~${text.split(/\s+/).length} words → ${expectedCards} expected cards`);

    // Step 2: Generate micro-learning cards with Gemini
    console.log('🔄 [Service.processFile] Step 2: Generating cards with Gemini...');
    await updateJob(job.id, 'generating', 50);
    
    console.log('🔄 [Service.processFile] Calling generateCardsFromContent with title:', title || path.parse(fileName).name);
    const generatedCards = await generateCardsFromContent(text, title || path.parse(fileName).name);
    console.log('🔄 [Service.processFile] generateCardsFromContent returned:', generatedCards?.length || 0, 'cards');

    if (generatedCards.length === 0) {
      console.error('🔄 [Service.processFile] ERROR: No cards generated!');
      throw new Error('No cards generated');
    }

    console.log(`✅ [Service.processFile] Generated ${generatedCards.length} micro-cards`);

    // Step 3: Create deck and cards in database
    await updateJob(job.id, 'generating', 80);

    const deck = await prisma.deck.create({
      data: {
        title: title || path.parse(fileName).name,
        userId,
        sourceType: fileType,
        sourceName: fileName,
        totalCards: generatedCards.length,
      },
    });

    // Create all cards with micro-learning fields
    await prisma.$transaction(
      generatedCards.map((card, index) =>
        prisma.card.create({
          data: {
            deckId: deck.id,
            headline: card.headline,
            detailParagraph: card.detailParagraph,
            bulletPoints: card.bulletPoints,
            emoji: card.emoji,
            difficulty: card.difficulty,
            ghostWords: card.ghostWords,
            eli5Version: card.eli5Version || null,
            quizQuestion: card.quizQuestion || null,
            quizAnswer: card.quizAnswer ?? null,
            order: index,
          },
        })
      )
    );

    // Complete job
    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        resultDeckId: deck.id,
      },
    });

    // Clean up uploaded file
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup errors
    }

    return { job, deck, cardCount: generatedCards.length };
  } catch (error) {
    // Mark job as failed
    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

// ===========================================
// Process Raw Text
// ===========================================

export interface ProcessTextOptions {
  userId: string;
  content: string;
  title: string;
}

export async function processText(options: ProcessTextOptions) {
  const { userId, title } = options;
  let { content } = options;

  if (!content || content.trim().length < 50) {
    throw errors.badRequest('Content must be at least 50 characters');
  }

  // Trim to Gemini limits
  if (content.length > GEMINI_LIMITS.maxInputChars) {
    content = content.slice(0, GEMINI_LIMITS.maxInputChars);
  }

  // Estimate expected cards
  const expectedCards = estimateCardCount(content);
  console.log(`📝 Processing text: ~${content.split(/\s+/).length} words → ${expectedCards} expected cards`);

  // Create processing job
  const job = await prisma.processingJob.create({
    data: {
      userId,
      status: 'processing',
      step: 'generating',
      progress: 30,
      fileType: 'text',
    },
  });

  try {
    // Generate micro-learning cards with Gemini
    await updateJob(job.id, 'generating', 50);
    const generatedCards = await generateCardsFromContent(content, title);

    if (generatedCards.length === 0) {
      throw new Error('No cards generated');
    }

    console.log(`✅ Generated ${generatedCards.length} micro-cards`);

    // Create deck and cards
    await updateJob(job.id, 'generating', 80);

    const deck = await prisma.deck.create({
      data: {
        title,
        userId,
        sourceType: 'text',
        totalCards: generatedCards.length,
      },
    });

    // Create all cards
    await prisma.$transaction(
      generatedCards.map((card, index) =>
        prisma.card.create({
          data: {
            deckId: deck.id,
            headline: card.headline,
            detailParagraph: card.detailParagraph,
            bulletPoints: card.bulletPoints,
            emoji: card.emoji,
            difficulty: card.difficulty,
            ghostWords: card.ghostWords,
            eli5Version: card.eli5Version || null,
            quizQuestion: card.quizQuestion || null,
            quizAnswer: card.quizAnswer ?? null,
            order: index,
          },
        })
      )
    );

    // Complete job
    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        resultDeckId: deck.id,
      },
    });

    return { job, deck, cardCount: generatedCards.length };
  } catch (error) {
    // Mark job as failed
    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

// ===========================================
// Job Management
// ===========================================

async function updateJob(
  jobId: string,
  step: ProcessingStep,
  progress: number
) {
  await prisma.processingJob.update({
    where: { id: jobId },
    data: { step, progress },
  });
}

export async function getJob(jobId: string, userId: string) {
  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw errors.notFound('Processing job');
  }

  if (job.userId !== userId) {
    throw errors.forbidden('You do not have access to this job');
  }

  return job;
}

export async function listJobs(userId: string) {
  return prisma.processingJob.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

// Get content limits for frontend
export function getContentLimits() {
  return CONTENT_LIMITS;
}

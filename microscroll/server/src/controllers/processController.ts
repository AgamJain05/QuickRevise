import { Request, Response, NextFunction } from 'express';
import * as processService from '../services/processService.js';
import { errors } from '../utils/errors.js';
import { GEMINI_LIMITS } from '../services/aiService.js';

// POST /api/process/upload - Upload and process file
export async function uploadFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw errors.badRequest('No file uploaded');
    }

    const result = await processService.processFile({
      userId: req.user!.id,
      filePath: req.file.path,
      fileName: req.file.originalname,
      title: req.body.title,
    });

    res.status(201).json({
      success: true,
      data: {
        job: result.job,
        deck: result.deck,
      },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/process/text - Process raw text
export async function processText(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await processService.processText({
      userId: req.user!.id,
      content: req.body.content,
      title: req.body.title,
    });

    res.status(201).json({
      success: true,
      data: {
        job: result.job,
        deck: result.deck,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/process/jobs - List user's processing jobs
export async function listJobs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const jobs = await processService.listJobs(req.user!.id);

    res.json({
      success: true,
      data: { jobs },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/process/jobs/:id - Get job status
export async function getJob(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const job = await processService.getJob(req.params.id, req.user!.id);

    res.json({
      success: true,
      data: { job },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/process/limits - Get content limits
export async function getLimits(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  res.json({
    success: true,
    data: {
      maxChars: GEMINI_LIMITS.maxInputChars,
      maxCharsFormatted: '30,000',
      approximatePages: 15,
      approximateWords: 5000,
      fileMaxSizeMB: 10,
      supportedFormats: ['PDF', 'DOCX', 'PPTX', 'TXT'],
      cardConfig: {
        targetWordsPerCard: 90,
        minWordsPerCard: 50,
        maxWordsPerCard: 150,
        expectedCardsFor2000Words: 22,
        style: 'TikTok-style micro-learning',
      },
    },
  });
}

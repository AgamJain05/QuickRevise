import { Request, Response, NextFunction } from 'express';
import * as deckService from '../services/deckService.js';

// GET /api/decks - List user's decks
export async function listDecks(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await deckService.listDecks(req.user!.id, req.query as any);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/decks/:id - Get deck by ID
export async function getDeck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const deck = await deckService.getDeckById(req.params.id, req.user!.id);

    res.json({
      success: true,
      data: { deck },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/decks - Create new deck
export async function createDeck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const deck = await deckService.createDeck(req.user!.id, req.body);

    res.status(201).json({
      success: true,
      data: { deck },
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/decks/:id - Update deck
export async function updateDeck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const deck = await deckService.updateDeck(
      req.params.id,
      req.user!.id,
      req.body
    );

    res.json({
      success: true,
      data: { deck },
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/decks/:id - Delete deck
export async function deleteDeck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await deckService.deleteDeck(req.params.id, req.user!.id);

    res.json({
      success: true,
      message: 'Deck deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/decks/stats - Get deck stats
export async function getStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await deckService.getDeckStats(req.user!.id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

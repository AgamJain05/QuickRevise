import { Request, Response, NextFunction } from 'express';
import * as cardService from '../services/cardService.js';

// GET /api/decks/:id/cards - List cards in deck
export async function listCards(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cards = await cardService.listCards(req.params.id, req.user!.id);

    res.json({
      success: true,
      data: { cards },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/cards/:cardId - Get single card
export async function getCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const card = await cardService.getCardById(req.params.cardId, req.user!.id);

    res.json({
      success: true,
      data: { card },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/decks/:id/cards - Create single card
export async function createCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const card = await cardService.createCard(
      req.params.id,
      req.user!.id,
      req.body
    );

    res.status(201).json({
      success: true,
      data: { card },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/decks/:id/cards/bulk - Create multiple cards
export async function createCards(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cards = await cardService.createCards(
      req.params.id,
      req.user!.id,
      req.body
    );

    res.status(201).json({
      success: true,
      data: { cards, count: cards.length },
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/cards/:cardId - Update card
export async function updateCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const card = await cardService.updateCard(
      req.params.cardId,
      req.user!.id,
      req.body
    );

    res.json({
      success: true,
      data: { card },
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/cards/:cardId - Delete card
export async function deleteCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await cardService.deleteCard(req.params.cardId, req.user!.id);

    res.json({
      success: true,
      message: 'Card deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/decks/:id/cards/reorder - Reorder cards
export async function reorderCards(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cards = await cardService.reorderCards(
      req.params.id,
      req.user!.id,
      req.body
    );

    res.json({
      success: true,
      data: { cards },
    });
  } catch (error) {
    next(error);
  }
}

import { Router } from 'express';
import * as deckController from '../controllers/deckController.js';
import * as cardController from '../controllers/cardController.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
  createDeckSchema,
  updateDeckSchema,
  deckIdSchema,
  listDecksQuerySchema,
} from '../schemas/deck.js';
import {
  createCardSchema,
  updateCardSchema,
  createCardsSchema,
  reorderCardsSchema,
} from '../schemas/card.js';

const router = Router();

// All deck routes require authentication
router.use(authenticate);

// ===========================================
// Deck Routes
// ===========================================

// GET /api/decks/stats - Get deck statistics
router.get('/stats', deckController.getStats);

// GET /api/decks - List user's decks
router.get(
  '/',
  validateQuery(listDecksQuerySchema),
  deckController.listDecks
);

// POST /api/decks - Create new deck
router.post(
  '/',
  validateBody(createDeckSchema),
  deckController.createDeck
);

// GET /api/decks/:id - Get deck by ID
router.get(
  '/:id',
  validateParams(deckIdSchema),
  deckController.getDeck
);

// PUT /api/decks/:id - Update deck
router.put(
  '/:id',
  validateParams(deckIdSchema),
  validateBody(updateDeckSchema),
  deckController.updateDeck
);

// DELETE /api/decks/:id - Delete deck
router.delete(
  '/:id',
  validateParams(deckIdSchema),
  deckController.deleteDeck
);

// ===========================================
// Card Routes (nested under decks)
// ===========================================

// GET /api/decks/:id/cards - List cards in deck
router.get(
  '/:id/cards',
  validateParams(deckIdSchema),
  cardController.listCards
);

// POST /api/decks/:id/cards - Create single card
router.post(
  '/:id/cards',
  validateParams(deckIdSchema),
  validateBody(createCardSchema),
  cardController.createCard
);

// POST /api/decks/:id/cards/bulk - Create multiple cards
router.post(
  '/:id/cards/bulk',
  validateParams(deckIdSchema),
  validateBody(createCardsSchema),
  cardController.createCards
);

// PUT /api/decks/:id/cards/reorder - Reorder cards
router.put(
  '/:id/cards/reorder',
  validateParams(deckIdSchema),
  validateBody(reorderCardsSchema),
  cardController.reorderCards
);

export default router;

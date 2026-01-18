import { Router } from 'express';
import * as cardController from '../controllers/cardController.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { updateCardSchema, cardIdSchema } from '../schemas/card.js';

const router = Router();

// All card routes require authentication
router.use(authenticate);

// GET /api/cards/:cardId - Get single card
router.get(
  '/:cardId',
  validateParams(cardIdSchema),
  cardController.getCard
);

// PUT /api/cards/:cardId - Update card
router.put(
  '/:cardId',
  validateParams(cardIdSchema),
  validateBody(updateCardSchema),
  cardController.updateCard
);

// DELETE /api/cards/:cardId - Delete card
router.delete(
  '/:cardId',
  validateParams(cardIdSchema),
  cardController.deleteCard
);

export default router;

import { prisma } from '../lib/prisma.js';
import { errors } from '../utils/errors.js';
import type {
  CreateCardInput,
  UpdateCardInput,
  CreateCardsInput,
  ReorderCardsInput,
} from '../schemas/card.js';

// Helper: Check deck ownership
async function verifyDeckOwnership(deckId: string, userId: string) {
  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { userId: true },
  });

  if (!deck) {
    throw errors.notFound('Deck');
  }

  if (deck.userId !== userId) {
    throw errors.forbidden('You do not own this deck');
  }

  return deck;
}

// List cards in a deck
export async function listCards(deckId: string, userId: string) {
  // Verify access
  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { userId: true, isPublic: true },
  });

  if (!deck) {
    throw errors.notFound('Deck');
  }

  if (deck.userId !== userId && !deck.isPublic) {
    throw errors.forbidden('You do not have access to this deck');
  }

  const cards = await prisma.card.findMany({
    where: { deckId },
    orderBy: { order: 'asc' },
  });

  return cards;
}

// Get single card
export async function getCardById(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      deck: {
        select: { userId: true, isPublic: true },
      },
    },
  });

  if (!card) {
    throw errors.notFound('Card');
  }

  if (card.deck.userId !== userId && !card.deck.isPublic) {
    throw errors.forbidden('You do not have access to this card');
  }

  return card;
}

// Create single card
export async function createCard(
  deckId: string,
  userId: string,
  input: CreateCardInput
) {
  await verifyDeckOwnership(deckId, userId);

  // Get max order
  const maxOrder = await prisma.card.aggregate({
    where: { deckId },
    _max: { order: true },
  });

  const card = await prisma.card.create({
    data: {
      ...input,
      deckId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  // Update deck card count
  await prisma.deck.update({
    where: { id: deckId },
    data: { totalCards: { increment: 1 } },
  });

  return card;
}

// Create multiple cards (bulk)
export async function createCards(
  deckId: string,
  userId: string,
  input: CreateCardsInput
) {
  await verifyDeckOwnership(deckId, userId);

  // Get max order
  const maxOrder = await prisma.card.aggregate({
    where: { deckId },
    _max: { order: true },
  });

  let startOrder = (maxOrder._max.order ?? -1) + 1;

  // Create all cards
  const cards = await prisma.$transaction(
    input.cards.map((cardInput, index) =>
      prisma.card.create({
        data: {
          ...cardInput,
          deckId,
          order: startOrder + index,
        },
      })
    )
  );

  // Update deck card count
  await prisma.deck.update({
    where: { id: deckId },
    data: { totalCards: { increment: input.cards.length } },
  });

  return cards;
}

// Update card
export async function updateCard(
  cardId: string,
  userId: string,
  input: UpdateCardInput
) {
  // Get card with deck info
  const existing = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      deck: { select: { userId: true } },
    },
  });

  if (!existing) {
    throw errors.notFound('Card');
  }

  if (existing.deck.userId !== userId) {
    throw errors.forbidden('You do not own this card');
  }

  const card = await prisma.card.update({
    where: { id: cardId },
    data: input,
  });

  return card;
}

// Delete card
export async function deleteCard(cardId: string, userId: string) {
  // Get card with deck info
  const existing = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      deck: { select: { id: true, userId: true } },
    },
  });

  if (!existing) {
    throw errors.notFound('Card');
  }

  if (existing.deck.userId !== userId) {
    throw errors.forbidden('You do not own this card');
  }

  // Delete card
  await prisma.card.delete({
    where: { id: cardId },
  });

  // Update deck card count
  await prisma.deck.update({
    where: { id: existing.deck.id },
    data: { totalCards: { decrement: 1 } },
  });
}

// Reorder cards
export async function reorderCards(
  deckId: string,
  userId: string,
  input: ReorderCardsInput
) {
  await verifyDeckOwnership(deckId, userId);

  // Update order for each card
  await prisma.$transaction(
    input.cardIds.map((cardId, index) =>
      prisma.card.update({
        where: { id: cardId },
        data: { order: index },
      })
    )
  );

  // Return updated cards
  const cards = await prisma.card.findMany({
    where: { deckId },
    orderBy: { order: 'asc' },
  });

  return cards;
}

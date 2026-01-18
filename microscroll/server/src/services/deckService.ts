import { prisma } from '../lib/prisma.js';
import { errors } from '../utils/errors.js';
import type { CreateDeckInput, UpdateDeckInput, ListDecksQuery } from '../schemas/deck.js';

// List user's decks with pagination
export async function listDecks(userId: string, query: ListDecksQuery) {
  const { page, limit, search, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = { userId };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Get decks and total count
  const [decks, total] = await Promise.all([
    prisma.deck.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    }),
    prisma.deck.count({ where }),
  ]);

  return {
    items: decks.map((deck) => ({
      ...deck,
      totalCards: deck._count.cards,
      _count: undefined,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Get deck by ID
export async function getDeckById(deckId: string, userId: string) {
  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    include: {
      cards: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: { cards: true },
      },
    },
  });

  if (!deck) {
    throw errors.notFound('Deck');
  }

  // Check ownership (unless public)
  if (deck.userId !== userId && !deck.isPublic) {
    throw errors.forbidden('You do not have access to this deck');
  }

  return {
    ...deck,
    totalCards: deck._count.cards,
    _count: undefined,
  };
}

// Create new deck
export async function createDeck(userId: string, input: CreateDeckInput) {
  const deck = await prisma.deck.create({
    data: {
      ...input,
      userId,
    },
  });

  return deck;
}

// Update deck
export async function updateDeck(
  deckId: string,
  userId: string,
  input: UpdateDeckInput
) {
  // Check deck exists and belongs to user
  const existing = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { userId: true },
  });

  if (!existing) {
    throw errors.notFound('Deck');
  }

  if (existing.userId !== userId) {
    throw errors.forbidden('You do not own this deck');
  }

  const deck = await prisma.deck.update({
    where: { id: deckId },
    data: input,
  });

  return deck;
}

// Delete deck
export async function deleteDeck(deckId: string, userId: string) {
  // Check deck exists and belongs to user
  const existing = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { userId: true },
  });

  if (!existing) {
    throw errors.notFound('Deck');
  }

  if (existing.userId !== userId) {
    throw errors.forbidden('You do not own this deck');
  }

  // Delete deck (cards cascade delete)
  await prisma.deck.delete({
    where: { id: deckId },
  });
}

// Get deck stats for user
export async function getDeckStats(userId: string) {
  const [totalDecks, totalCards, recentDecks] = await Promise.all([
    prisma.deck.count({ where: { userId } }),
    prisma.card.count({
      where: { deck: { userId } },
    }),
    prisma.deck.findMany({
      where: { userId },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        emoji: true,
        updatedAt: true,
        _count: { select: { cards: true } },
      },
    }),
  ]);

  return {
    totalDecks,
    totalCards,
    recentDecks: recentDecks.map((d) => ({
      ...d,
      totalCards: d._count.cards,
      _count: undefined,
    })),
  };
}

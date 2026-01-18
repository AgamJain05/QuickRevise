import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: config.isDev ? ['query', 'error', 'warn'] : ['error'],
});

if (config.isDev) {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

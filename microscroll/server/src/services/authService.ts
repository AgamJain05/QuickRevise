import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  parseExpiresIn,
} from '../utils/jwt.js';
import { errors } from '../utils/errors.js';
import { config } from '../config/index.js';
import crypto from 'crypto';

// Types
export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  tokens: AuthTokens;
}

// Register new user
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const { email, password, name } = input;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw errors.conflict('User with this email already exists', 'EMAIL_EXISTS');
  }

  // Validate password strength
  if (password.length < 8) {
    throw errors.validation('Password must be at least 8 characters');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user with default settings
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name,
      settings: {
        create: {}, // Uses defaults
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  // Generate tokens
  const tokens = await createTokens(user.id, user.email);

  return { user, tokens };
}

// Login user
export async function login(input: LoginInput): Promise<AuthResponse> {
  const { email, password } = input;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw errors.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw errors.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Generate tokens
  const tokens = await createTokens(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    tokens,
  };
}

// Refresh tokens
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  // Verify refresh token
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw errors.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Find refresh token in database
  const storedToken = await prisma.refreshToken.findUnique({
    where: { id: payload.tokenId },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    // Clean up expired token if exists
    if (storedToken) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    }
    throw errors.unauthorized('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
  }

  // Delete old refresh token (rotation)
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  // Generate new tokens
  return createTokens(storedToken.user.id, storedToken.user.email);
}

// Logout (invalidate refresh token)
export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.delete({ where: { id: payload.tokenId } });
  } catch {
    // Token already invalid, ignore
  }
}

// Logout from all devices
export async function logoutAll(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

// Helper: Create access and refresh tokens
async function createTokens(userId: string, email: string): Promise<AuthTokens> {
  // Generate access token
  const accessToken = generateAccessToken({ userId, email });

  // Create refresh token record
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + parseExpiresIn(config.jwt.refreshExpiresIn));

  const refreshTokenRecord = await prisma.refreshToken.create({
    data: {
      id: tokenId,
      token: crypto.randomBytes(32).toString('hex'),
      userId,
      expiresAt,
    },
  });

  // Generate refresh token JWT
  const refreshToken = generateRefreshToken({
    userId,
    tokenId: refreshTokenRecord.id,
  });

  return { accessToken, refreshToken };
}

// Get current user
export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      settings: true,
      _count: {
        select: {
          decks: true,
          cardProgress: true,
        },
      },
    },
  });

  if (!user) {
    throw errors.notFound('User');
  }

  return user;
}

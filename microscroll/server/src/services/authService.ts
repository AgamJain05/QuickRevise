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

// ===========================================
// Password Validation
// ===========================================

const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false, // Optional for better UX
};

function validatePasswordStrength(password: string): void {
  const errors: string[] = [];

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`at least ${PASSWORD_RULES.minLength} characters`);
  }
  if (password.length > PASSWORD_RULES.maxLength) {
    errors.push(`no more than ${PASSWORD_RULES.maxLength} characters`);
  }
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('one uppercase letter');
  }
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('one lowercase letter');
  }
  if (PASSWORD_RULES.requireNumber && !/\d/.test(password)) {
    errors.push('one number');
  }
  if (PASSWORD_RULES.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('one special character');
  }

  if (errors.length > 0) {
    throw new Error(`Password must contain ${errors.join(', ')}`);
  }
}

// ===========================================
// Account Lockout Configuration
// ===========================================

const LOCKOUT_CONFIG = {
  maxAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
};

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
  validatePasswordStrength(password);

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

  // Find user with lockout fields
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      failedLoginAttempts: true,
      lockoutUntil: true,
      emailVerified: true,
    },
  });

  if (!user) {
    throw errors.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Check if account is locked
  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    const remainingMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
    throw errors.forbidden(
      `Account locked. Try again in ${remainingMinutes} minute(s)`,
      'ACCOUNT_LOCKED'
    );
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.passwordHash);
  
  if (!isValidPassword) {
    // Increment failed attempts
    const newAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= LOCKOUT_CONFIG.maxAttempts;
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newAttempts,
        lockoutUntil: shouldLock 
          ? new Date(Date.now() + LOCKOUT_CONFIG.lockoutDurationMs) 
          : null,
      },
    });

    if (shouldLock) {
      throw errors.forbidden(
        `Too many failed attempts. Account locked for ${LOCKOUT_CONFIG.lockoutDurationMs / 60000} minutes`,
        'ACCOUNT_LOCKED'
      );
    }

    throw errors.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Reset failed attempts on successful login
  if (user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });
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
      emailVerified: true,
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

// ===========================================
// Email Verification (OTP-based)
// ===========================================

import { sendVerificationOTP, generateOTP } from './emailService.js';

// Send verification OTP
export async function sendEmailVerification(userId: string): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, emailVerified: true },
  });

  if (!user) {
    throw errors.notFound('User');
  }

  if (user.emailVerified) {
    throw errors.badRequest('Email already verified');
  }

  // Generate 6-digit OTP
  const otp = generateOTP();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationToken: otp,
      emailVerificationExpires: expires,
    },
  });

  await sendVerificationOTP(user.email, user.name, otp);

  return { message: 'Verification code sent to your email' };
}

// Verify email with OTP
export async function verifyEmailOTP(userId: string, otp: string): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      emailVerificationToken: true,
      emailVerificationExpires: true,
      emailVerified: true,
    },
  });

  if (!user) {
    throw errors.notFound('User');
  }

  if (user.emailVerified) {
    return { success: true, message: 'Email already verified' };
  }

  if (!user.emailVerificationToken || !user.emailVerificationExpires) {
    throw errors.badRequest('No verification code found. Please request a new one.');
  }

  if (user.emailVerificationExpires < new Date()) {
    throw errors.badRequest('Verification code expired. Please request a new one.');
  }

  if (user.emailVerificationToken !== otp) {
    throw errors.badRequest('Invalid verification code');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return { success: true, message: 'Email verified successfully' };
}

// ===========================================
// Google OAuth
// ===========================================

interface GoogleUserInput {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export async function findOrCreateGoogleUser(input: GoogleUserInput): Promise<AuthResponse> {
  const { email, name, avatarUrl } = input;

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    // Create new user (no password needed for OAuth users)
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: '', // Empty for OAuth users
        name,
        avatarUrl,
        emailVerified: true, // Google emails are verified
        settings: {
          create: {},
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  } else {
    // Update avatar if user exists
    if (avatarUrl) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl },
      });
    }
  }

  // Generate tokens
  const tokens = await createTokens(user.id, user.email);

  return { user, tokens };
}

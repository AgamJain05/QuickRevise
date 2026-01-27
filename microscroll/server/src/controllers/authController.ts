import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService.js';

// POST /api/auth/register
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.register(req.body);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/login
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.login(req.body);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/refresh
export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshTokens(refreshToken);
    
    res.json({
      success: true,
      data: { tokens },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/logout
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/logout-all
export async function logoutAll(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await authService.logoutAll(req.user!.id);
    
    res.json({
      success: true,
      message: 'Logged out from all devices',
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/auth/me
export async function me(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    
    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// Email Verification (OTP-based)
// ===========================================

// POST /api/auth/send-verification
export async function sendVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.sendEmailVerification(req.user!.id);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/verify-otp
export async function verifyOTP(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { otp } = req.body;
    const result = await authService.verifyEmailOTP(req.user!.id, otp);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// Google OAuth
// ===========================================

import { config } from '../config/index.js';

// Helper function to get the correct base URL (handles proxy headers)
function getBaseUrl(req: Request): string {
  // Check for proxy headers (used by Render, Heroku, etc.)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
}

// GET /api/auth/google - Redirect to Google OAuth
export async function googleAuth(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  if (!config.google.clientId) {
    res.status(501).json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Google OAuth not configured' },
    });
    return;
  }

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: `${getBaseUrl(req)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

// GET /api/auth/google/callback - Google OAuth callback
export async function googleCallback(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.redirect(`${config.cors.origin}/auth?error=missing_code`);
      return;
    }

    if (!config.google.clientId || !config.google.clientSecret) {
      res.redirect(`${config.cors.origin}/auth?error=not_configured`);
      return;
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: `${getBaseUrl(req)}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; id_token?: string };

    if (!tokenData.access_token) {
      res.redirect(`${config.cors.origin}/auth?error=token_exchange_failed`);
      return;
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userResponse.json() as {
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!googleUser.email) {
      res.redirect(`${config.cors.origin}/auth?error=no_email`);
      return;
    }

    // Find or create user
    const result = await authService.findOrCreateGoogleUser({
      email: googleUser.email,
      name: googleUser.name || null,
      avatarUrl: googleUser.picture || null,
    });

    // Redirect to frontend with tokens
    const params = new URLSearchParams({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });

    res.redirect(`${config.cors.origin}/auth/callback?${params}`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect(`${config.cors.origin}/auth?error=oauth_failed`);
  }
}
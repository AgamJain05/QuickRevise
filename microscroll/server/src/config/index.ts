import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  
  // Supabase PostgreSQL
  DATABASE_URL: z.string().url('Invalid DATABASE_URL'),
  DIRECT_URL: z.string().url('Invalid DIRECT_URL'), // Required for Supabase migrations
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Client
  CLIENT_URL: z.string().default('http://localhost:5173'),
  
  // AI API - Google Gemini
  GEMINI_API_KEY: z.string().optional(),
  
  // File Upload
  MAX_FILE_SIZE: z.string().default('10485760'),
  UPLOAD_DIR: z.string().default('./uploads'),
  
  // Email Service (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('MicroScroll <noreply@microscroll.app>'),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
};

const env = parseEnv();

// Export configuration object
export const config = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  
  server: {
    port: parseInt(env.PORT, 10),
  },
  
  database: {
    url: env.DATABASE_URL,
    directUrl: env.DIRECT_URL,
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  
  cors: {
    origin: env.CLIENT_URL,
  },
  
  ai: {
    geminiKey: env.GEMINI_API_KEY,
  },
  
  upload: {
    maxFileSize: parseInt(env.MAX_FILE_SIZE, 10),
    uploadDir: env.UPLOAD_DIR,
  },
  
  email: {
    resendApiKey: env.RESEND_API_KEY,
    fromAddress: env.EMAIL_FROM,
  },
  
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  },
} as const;

export type Config = typeof config;

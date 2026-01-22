import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import routes from './routes/index.js';

// Create Express app
const app = express();

// ===========================================
// Security Middleware
// ===========================================

// Helmet - Enhanced Security Headers
app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: config.isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", config.cors.origin],
    },
  } : false, // Disable in development for easier debugging
  
  // Strict Transport Security (HTTPS only)
  hsts: config.isProd ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,
  
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  
  // Prevent MIME sniffing
  noSniff: true,
  
  // XSS Protection
  xssFilter: true,
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS - Cross-Origin Resource Sharing
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ===========================================
// Body Parsing
// ===========================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===========================================
// Rate Limiting
// ===========================================

app.use('/api', apiLimiter);

// ===========================================
// API Routes
// ===========================================

app.use('/api', routes);

// ===========================================
// Error Handling
// ===========================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ===========================================
// Server Start
// ===========================================

const PORT = config.server.port;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║                                                ║
║   🚀 MicroScroll API Server                    ║
║                                                ║
║   Environment: ${config.env.padEnd(28)}║
║   Port:        ${String(PORT).padEnd(28)}║
║   Database:    Supabase PostgreSQL             ║
║   Time:        ${new Date().toISOString().slice(0, 19).padEnd(28)}║
║                                                ║
╚════════════════════════════════════════════════╝
  `);
  
  if (config.isDev) {
    console.log('📍 API Endpoints:');
    console.log('');
    console.log('   Auth:');
    console.log('   POST /api/auth/register     - Create account');
    console.log('   POST /api/auth/login        - Login');
    console.log('   POST /api/auth/refresh      - Refresh token');
    console.log('   POST /api/auth/logout       - Logout');
    console.log('   GET  /api/auth/me           - Current user');
    console.log('');
    console.log('   Decks:');
    console.log('   GET  /api/decks             - List decks');
    console.log('   POST /api/decks             - Create deck');
    console.log('   GET  /api/decks/:id         - Get deck');
    console.log('   PUT  /api/decks/:id         - Update deck');
    console.log('   DELETE /api/decks/:id       - Delete deck');
    console.log('   GET  /api/decks/stats       - Deck statistics');
    console.log('');
    console.log('   Cards:');
    console.log('   GET  /api/decks/:id/cards   - List cards');
    console.log('   POST /api/decks/:id/cards   - Create card');
    console.log('   POST /api/decks/:id/cards/bulk - Bulk create');
    console.log('   PUT  /api/cards/:id         - Update card');
    console.log('   DELETE /api/cards/:id       - Delete card');
    console.log('');
    console.log('   Processing:');
    console.log('   POST /api/process/upload    - Upload file');
    console.log('   POST /api/process/text      - Process text');
    console.log('   GET  /api/process/jobs      - List jobs');
    console.log('   GET  /api/process/jobs/:id  - Job status');
    console.log('');
    console.log('   Health:');
    console.log('   GET  /api/health            - Health check');
    console.log('');
  }
});

export default app;

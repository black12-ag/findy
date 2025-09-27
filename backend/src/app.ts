import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from '@/config/env';
import { logger } from '@/config/logger';
import { connectDatabase } from '@/config/database';
import { connectRedis } from '@/config/redis';
import { errorHandler, notFound } from '@/middleware/error';
import { 
  initSentry as initializeSentry, 
  sentryRequestHandler, 
  sentryTracingHandler, 
  sentryErrorHandler 
} from '@/config/sentry-simple';
import { setupSwagger } from '@/config/swagger';

// Import routes
import placesRoutes from '@/routes/places';
import routesRoutes from '@/routes/routes';
import usersRoutes from '@/routes/users';
import socialRoutes from '@/routes/social';

const app = express();

// Initialize Sentry before any other middleware
initializeSentry();

// Sentry request handler must be the first middleware
app.use(sentryRequestHandler);
app.use(sentryTracingHandler);

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    const allowedOrigins = config.cors.allowedOrigins;
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
  ],
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit.max, // limit each IP to max requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

app.use(limiter);

// OAuth/authentication disabled for no-auth mode

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, _res, next) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.node.env,
  });
});

// API routes (auth removed for no-auth mode)
app.use('/api/v1/places', placesRoutes);
app.use('/api/v1/routes', routesRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/social', socialRoutes);

// Setup Swagger documentation
setupSwagger(app);

// API documentation endpoint
app.get('/api/v1', (_req, res) => {
  res.json({
    name: 'PathFinder Pro API',
    version: '1.0.0',
    description: 'Navigation and location services API',
    endpoints: {
      places: '/api/v1/places',
      routes: '/api/v1/routes',
      users: '/api/v1/users',
      social: '/api/v1/social',
    },
    documentation: 'https://docs.pathfinderpro.com/api',
  });
});

// 404 handler
app.use(notFound);

// Sentry error handler must be before any other error handler
app.use(sentryErrorHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Add cleanup logic here
  // Close database connections, clear intervals, etc.
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server function
export const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');

    // Start HTTP server
    const PORT = config.server.port;
    app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`, {
        environment: config.node.env,
        port: PORT,
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

export default app;
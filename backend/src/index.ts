import { createServer } from 'http';
import app from './app';
import { WebSocketService } from '@/services/websocket';
import { config } from '@/config/env';
import { logger } from '@/config/logger';
import { connectDatabase } from '@/config/database';
import { connectRedis } from '@/config/redis';

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');

    // Create HTTP server
    const server = createServer(app);

    // Initialize WebSocket service
    const wsService = new WebSocketService(server);
    logger.info('WebSocket service initialized');

    // Start server
    const PORT = config.server.port;
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`, {
        environment: config.node.env,
        port: PORT,
        endpoints: {
          api: `http://localhost:${PORT}/api/v1`,
          health: `http://localhost:${PORT}/health`,
          docs: `http://localhost:${PORT}/api/v1`,
        },
      });
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
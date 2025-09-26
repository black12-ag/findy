"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const app_1 = __importDefault(require("./app"));
const websocket_1 = require("@/services/websocket");
const env_1 = require("@/config/env");
const logger_1 = require("@/config/logger");
const database_1 = require("@/config/database");
const redis_1 = require("@/config/redis");
async function startServer() {
    try {
        await (0, database_1.connectDatabase)();
        logger_1.logger.info('Database connected successfully');
        await (0, redis_1.connectRedis)();
        logger_1.logger.info('Redis connected successfully');
        const server = (0, http_1.createServer)(app_1.default);
        const wsService = new websocket_1.WebSocketService(server);
        logger_1.logger.info('WebSocket service initialized');
        const PORT = env_1.config.server.port;
        server.listen(PORT, () => {
            logger_1.logger.info(`🚀 Server running on port ${PORT}`, {
                environment: env_1.config.node.env,
                port: PORT,
                endpoints: {
                    api: `http://localhost:${PORT}/api/v1`,
                    health: `http://localhost:${PORT}/health`,
                    docs: `http://localhost:${PORT}/api/v1`,
                },
            });
        });
        const gracefulShutdown = (signal) => {
            logger_1.logger.info(`Received ${signal}. Starting graceful shutdown...`);
            server.close(() => {
                logger_1.logger.info('HTTP server closed');
                process.exit(0);
            });
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map
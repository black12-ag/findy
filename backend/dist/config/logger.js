"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.morganStream = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const config_1 = __importDefault(require("./config"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.prettyPrint());
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({
    format: 'HH:mm:ss',
}), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
}));
const transports = [];
transports.push(new winston_1.default.transports.Console({
    format: config_1.default.server.isDevelopment ? consoleFormat : logFormat,
    level: config_1.default.logging.level,
}));
if (config_1.default.server.isProduction || config_1.default.server.isDevelopment) {
    transports.push(new winston_daily_rotate_file_1.default({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        format: logFormat,
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
    }));
    transports.push(new winston_daily_rotate_file_1.default({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        format: logFormat,
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
    }));
    transports.push(new winston_daily_rotate_file_1.default({
        filename: 'logs/access-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        format: logFormat,
        maxSize: '20m',
        maxFiles: '30d',
        zippedArchive: true,
    }));
}
const logger = winston_1.default.createLogger({
    level: config_1.default.logging.level,
    format: logFormat,
    transports,
    exitOnError: false,
    silent: config_1.default.server.isTest,
});
exports.morganStream = {
    write: (message) => {
        logger.info(message.trim(), { service: 'http' });
    },
};
exports.default = logger;
//# sourceMappingURL=logger.js.map
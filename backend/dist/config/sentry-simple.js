"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = exports.getCurrentHub = exports.startTransaction = exports.withScope = exports.setContext = exports.setTag = exports.setUser = exports.addBreadcrumb = exports.captureMessage = exports.captureException = exports.sentryTracingHandler = exports.sentryErrorHandler = exports.sentryRequestHandler = exports.initSentry = void 0;
const logger_1 = __importDefault(require("./logger"));
const initSentry = () => {
    logger_1.default.info('Sentry integration temporarily disabled');
};
exports.initSentry = initSentry;
exports.init = exports.initSentry;
const sentryRequestHandler = () => {
    return (req, res, next) => {
        next();
    };
};
exports.sentryRequestHandler = sentryRequestHandler;
const sentryErrorHandler = () => {
    return (error, req, res, next) => {
        logger_1.default.error('Error handled by simplified Sentry middleware', {
            error: error.message,
            path: req.path,
            method: req.method,
        });
        next(error);
    };
};
exports.sentryErrorHandler = sentryErrorHandler;
const sentryTracingHandler = () => {
    return (req, res, next) => {
        next();
    };
};
exports.sentryTracingHandler = sentryTracingHandler;
const captureException = (error) => {
    logger_1.default.error('Exception captured by simplified Sentry', {
        error: error.message,
        stack: error.stack,
    });
};
exports.captureException = captureException;
const captureMessage = (message, level = 'info') => {
    logger_1.default.info('Message captured by simplified Sentry', {
        message,
        level,
    });
};
exports.captureMessage = captureMessage;
const addBreadcrumb = (breadcrumb) => {
    logger_1.default.debug('Breadcrumb added', breadcrumb);
};
exports.addBreadcrumb = addBreadcrumb;
const setUser = (user) => {
    logger_1.default.debug('User context set', { userId: user?.id });
};
exports.setUser = setUser;
const setTag = (key, value) => {
    logger_1.default.debug('Tag set', { key, value });
};
exports.setTag = setTag;
const setContext = (name, context) => {
    logger_1.default.debug('Context set', { name, context });
};
exports.setContext = setContext;
const withScope = (callback) => {
    callback({});
};
exports.withScope = withScope;
const startTransaction = (transactionContext) => {
    logger_1.default.debug('Transaction started', transactionContext);
    return {
        setName: (name) => logger_1.default.debug('Transaction name set', { name }),
        setTag: (key, value) => logger_1.default.debug('Transaction tag set', { key, value }),
        finish: () => logger_1.default.debug('Transaction finished'),
    };
};
exports.startTransaction = startTransaction;
const getCurrentHub = () => {
    return {
        configureScope: (callback) => callback({}),
    };
};
exports.getCurrentHub = getCurrentHub;
//# sourceMappingURL=sentry-simple.js.map
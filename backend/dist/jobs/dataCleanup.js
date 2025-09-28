"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataCleanupProcessor = void 0;
exports.scheduleDataCleanup = scheduleDataCleanup;
exports.scheduleRegularCleanups = scheduleRegularCleanups;
const queues_1 = require("@/queues");
const DatabaseService_1 = require("@/services/DatabaseService");
const CacheService_1 = require("@/services/CacheService");
const StorageService_1 = require("@/services/StorageService");
const logger_1 = __importDefault(require("@/config/logger"));
const database_1 = require("@/config/database");
class DataCleanupJobProcessor {
    constructor() {
        this.databaseService = new DatabaseService_1.DatabaseService();
        this.cacheService = new CacheService_1.CacheService();
        this.storageService = new StorageService_1.StorageService();
        this.setupProcessor();
    }
    setupProcessor() {
        const queue = queues_1.queueManager.getQueue(queues_1.JobTypes.DATA_CLEANUP);
        if (queue) {
            queue.process('*', this.processCleanup.bind(this));
            logger_1.default.info('Data cleanup job processor initialized');
        }
    }
    async processCleanup(job) {
        const startTime = Date.now();
        const { type, maxAge, batchSize = 1000, dryRun = false } = job.data;
        try {
            logger_1.default.info('Starting data cleanup job', {
                jobId: job.id,
                type,
                maxAge,
                batchSize,
                dryRun,
            });
            await job.progress(5);
            let result;
            switch (type) {
                case 'sessions':
                    result = await this.cleanupExpiredSessions(maxAge, batchSize, dryRun, job);
                    break;
                case 'locations':
                    result = await this.cleanupOldLocations(maxAge, batchSize, dryRun, job);
                    break;
                case 'cache':
                    result = await this.cleanupCache(maxAge, dryRun, job);
                    break;
                case 'logs':
                    result = await this.cleanupOldLogs(maxAge, batchSize, dryRun, job);
                    break;
                case 'temp_files':
                    result = await this.cleanupTempFiles(maxAge, dryRun, job);
                    break;
                case 'expired_tokens':
                    result = await this.cleanupExpiredTokens(batchSize, dryRun, job);
                    break;
                case 'old_analytics':
                    result = await this.cleanupOldAnalytics(maxAge, batchSize, dryRun, job);
                    break;
                default:
                    throw new Error(`Unknown cleanup type: ${type}`);
            }
            result.duration = Date.now() - startTime;
            await job.progress(100);
            logger_1.default.info('Data cleanup job completed', {
                jobId: job.id,
                ...result,
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Data cleanup job failed', {
                jobId: job.id,
                type,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async cleanupExpiredSessions(maxAge = 7 * 24 * 60 * 60 * 1000, batchSize, dryRun, job) {
        const cutoffDate = new Date(Date.now() - maxAge);
        let itemsProcessed = 0;
        let itemsDeleted = 0;
        const errors = [];
        try {
            const expiredCount = await database_1.prisma.session.count({
                where: {
                    expiresAt: {
                        lt: cutoffDate,
                    },
                },
            });
            itemsProcessed = expiredCount;
            await job.progress(20);
            if (!dryRun && expiredCount > 0) {
                let processed = 0;
                while (processed < expiredCount) {
                    const batch = await database_1.prisma.session.findMany({
                        where: {
                            expiresAt: {
                                lt: cutoffDate,
                            },
                        },
                        take: batchSize,
                        select: { id: true },
                    });
                    if (batch.length === 0)
                        break;
                    const deleteResult = await database_1.prisma.session.deleteMany({
                        where: {
                            id: {
                                in: batch.map(s => s.id),
                            },
                        },
                    });
                    itemsDeleted += deleteResult.count;
                    processed += batch.length;
                    const progress = Math.min(90, 20 + (processed / expiredCount) * 70);
                    await job.progress(progress);
                    if (processed < expiredCount) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }
            else {
                itemsDeleted = dryRun ? 0 : itemsProcessed;
            }
        }
        catch (error) {
            errors.push(`Session cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            type: 'sessions',
            itemsProcessed,
            itemsDeleted,
            spaceSaved: itemsDeleted * 512,
            duration: 0,
            errors,
        };
    }
    async cleanupOldLocations(maxAge = 30 * 24 * 60 * 60 * 1000, batchSize, dryRun, job) {
        const cutoffDate = new Date(Date.now() - maxAge);
        let itemsProcessed = 0;
        let itemsDeleted = 0;
        const errors = [];
        try {
            const oldLocationCount = await database_1.prisma.userLocation.count({
                where: {
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
            });
            itemsProcessed = oldLocationCount;
            await job.progress(20);
            if (!dryRun && oldLocationCount > 0) {
                let processed = 0;
                while (processed < oldLocationCount) {
                    const batch = await database_1.prisma.userLocation.findMany({
                        where: {
                            createdAt: {
                                lt: cutoffDate,
                            },
                        },
                        take: batchSize,
                        select: { id: true },
                    });
                    if (batch.length === 0)
                        break;
                    const deleteResult = await database_1.prisma.userLocation.deleteMany({
                        where: {
                            id: {
                                in: batch.map(l => l.id),
                            },
                        },
                    });
                    itemsDeleted += deleteResult.count;
                    processed += batch.length;
                    const progress = Math.min(90, 20 + (processed / oldLocationCount) * 70);
                    await job.progress(progress);
                    if (processed < oldLocationCount) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }
            else {
                itemsDeleted = dryRun ? 0 : itemsProcessed;
            }
        }
        catch (error) {
            errors.push(`Location cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            type: 'locations',
            itemsProcessed,
            itemsDeleted,
            spaceSaved: itemsDeleted * 256,
            duration: 0,
            errors,
        };
    }
    async cleanupCache(maxAge = 24 * 60 * 60 * 1000, dryRun, job) {
        let itemsProcessed = 0;
        let itemsDeleted = 0;
        const errors = [];
        try {
            await job.progress(20);
            const cacheStats = await this.cacheService.getStats();
            itemsProcessed = cacheStats.keys || 0;
            if (!dryRun) {
                const deletedKeys = await this.cacheService.cleanupExpired(maxAge);
                itemsDeleted = deletedKeys.length;
            }
            await job.progress(90);
        }
        catch (error) {
            errors.push(`Cache cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            type: 'cache',
            itemsProcessed,
            itemsDeleted,
            spaceSaved: itemsDeleted * 1024,
            duration: 0,
            errors,
        };
    }
    async cleanupOldLogs(maxAge = 7 * 24 * 60 * 60 * 1000, batchSize, dryRun, job) {
        const cutoffDate = new Date(Date.now() - maxAge);
        let itemsProcessed = 0;
        let itemsDeleted = 0;
        const errors = [];
        try {
            const oldLogCount = await database_1.prisma.systemLog.count({
                where: {
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
            });
            itemsProcessed = oldLogCount;
            await job.progress(20);
            if (!dryRun && oldLogCount > 0) {
                let processed = 0;
                while (processed < oldLogCount) {
                    const deleteResult = await database_1.prisma.systemLog.deleteMany({
                        where: {
                            createdAt: {
                                lt: cutoffDate,
                            },
                        },
                    });
                    itemsDeleted += deleteResult.count;
                    processed += deleteResult.count;
                    const progress = Math.min(90, 20 + (processed / oldLogCount) * 70);
                    await job.progress(progress);
                    if (deleteResult.count === 0)
                        break;
                    if (processed < oldLogCount) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }
            else {
                itemsDeleted = dryRun ? 0 : itemsProcessed;
            }
        }
        catch (error) {
            errors.push(`Log cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            type: 'logs',
            itemsProcessed,
            itemsDeleted,
            spaceSaved: itemsDeleted * 2048,
            duration: 0,
            errors,
        };
    }
    async cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000, dryRun, job) {
        let itemsProcessed = 0;
        let itemsDeleted = 0;
        let spaceSaved = 0;
        const errors = [];
        try {
            await job.progress(20);
            const tempFiles = await this.storageService.listTempFiles();
            itemsProcessed = tempFiles.length;
            const cutoffDate = Date.now() - maxAge;
            const filesToDelete = tempFiles.filter(file => file.lastModified < cutoffDate);
            await job.progress(50);
            if (!dryRun) {
                for (const file of filesToDelete) {
                    try {
                        await this.storageService.deleteFile(file.path);
                        spaceSaved += file.size;
                        itemsDeleted++;
                    }
                    catch (error) {
                        errors.push(`Failed to delete ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }
            else {
                itemsDeleted = filesToDelete.length;
                spaceSaved = filesToDelete.reduce((total, file) => total + file.size, 0);
            }
            await job.progress(90);
        }
        catch (error) {
            errors.push(`Temp file cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            type: 'temp_files',
            itemsProcessed,
            itemsDeleted,
            spaceSaved,
            duration: 0,
            errors,
        };
    }
    async cleanupExpiredTokens(batchSize, dryRun, job) {
        let itemsProcessed = 0;
        let itemsDeleted = 0;
        const errors = [];
        try {
            const now = new Date();
            const expiredTokenCount = await database_1.prisma.refreshToken.count({
                where: {
                    expiresAt: {
                        lt: now,
                    },
                },
            });
            itemsProcessed = expiredTokenCount;
            await job.progress(20);
            if (!dryRun && expiredTokenCount > 0) {
                const deleteResult = await database_1.prisma.refreshToken.deleteMany({
                    where: {
                        expiresAt: {
                            lt: now,
                        },
                    },
                });
                itemsDeleted = deleteResult.count;
            }
            else {
                itemsDeleted = dryRun ? 0 : itemsProcessed;
            }
            await job.progress(90);
        }
        catch (error) {
            errors.push(`Token cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            type: 'expired_tokens',
            itemsProcessed,
            itemsDeleted,
            spaceSaved: itemsDeleted * 128,
            duration: 0,
            errors,
        };
    }
    async cleanupOldAnalytics(maxAge = 90 * 24 * 60 * 60 * 1000, batchSize, dryRun, job) {
        const cutoffDate = new Date(Date.now() - maxAge);
        let itemsProcessed = 0;
        let itemsDeleted = 0;
        const errors = [];
        try {
            const oldAnalyticsCount = await database_1.prisma.userAnalytics.count({
                where: {
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
            });
            itemsProcessed = oldAnalyticsCount;
            await job.progress(20);
            if (!dryRun && oldAnalyticsCount > 0) {
                let processed = 0;
                while (processed < oldAnalyticsCount) {
                    const deleteResult = await database_1.prisma.userAnalytics.deleteMany({
                        where: {
                            createdAt: {
                                lt: cutoffDate,
                            },
                        },
                    });
                    itemsDeleted += deleteResult.count;
                    processed += deleteResult.count;
                    const progress = Math.min(90, 20 + (processed / oldAnalyticsCount) * 70);
                    await job.progress(progress);
                    if (deleteResult.count === 0)
                        break;
                    if (processed < oldAnalyticsCount) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }
            else {
                itemsDeleted = dryRun ? 0 : itemsProcessed;
            }
        }
        catch (error) {
            errors.push(`Analytics cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            type: 'old_analytics',
            itemsProcessed,
            itemsDeleted,
            spaceSaved: itemsDeleted * 1024,
            duration: 0,
            errors,
        };
    }
}
exports.dataCleanupProcessor = new DataCleanupJobProcessor();
async function scheduleDataCleanup(data, options = {}) {
    return queues_1.queueManager.addJob(queues_1.JobTypes.DATA_CLEANUP, data, {
        priority: 10,
        ...options,
    });
}
async function scheduleRegularCleanups() {
    await queues_1.queueManager.scheduleJob(queues_1.JobTypes.DATA_CLEANUP, '0 2 * * *', { type: 'sessions' });
    await queues_1.queueManager.scheduleJob(queues_1.JobTypes.DATA_CLEANUP, '0 3 * * 0', { type: 'locations' });
    await queues_1.queueManager.scheduleJob(queues_1.JobTypes.DATA_CLEANUP, '0 1 * * *', { type: 'cache' });
    await queues_1.queueManager.scheduleJob(queues_1.JobTypes.DATA_CLEANUP, '0 4 * * 0', { type: 'logs' });
    await queues_1.queueManager.scheduleJob(queues_1.JobTypes.DATA_CLEANUP, '0 5 * * *', { type: 'temp_files' });
    await queues_1.queueManager.scheduleJob(queues_1.JobTypes.DATA_CLEANUP, '0 6 * * *', { type: 'expired_tokens' });
    await queues_1.queueManager.scheduleJob(queues_1.JobTypes.DATA_CLEANUP, '0 7 1 * *', { type: 'old_analytics' });
    logger_1.default.info('Regular cleanup jobs scheduled');
}
//# sourceMappingURL=dataCleanup.js.map
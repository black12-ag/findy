"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const database_1 = require("@/config/database");
const logger_1 = require("@/config/logger");
const error_1 = require("@/utils/error");
class DatabaseService {
    async executeRawQuery(query, params = []) {
        try {
            const result = await database_1.prisma.$queryRawUnsafe(query, ...params);
            return result;
        }
        catch (error) {
            logger_1.logger.error('Raw query execution failed', {
                query,
                params,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Database query failed', 500);
        }
    }
    async getStats() {
        try {
            const tables = await database_1.prisma.$queryRaw `
        SELECT 
          schemaname,
          tablename as table_name,
          n_tup_ins + n_tup_upd + n_tup_del as row_count
        FROM pg_stat_user_tables
      `;
            const tableStats = tables.reduce((acc, table) => {
                acc[table.table_name] = table.row_count;
                return acc;
            }, {});
            const totalRecords = Object.values(tableStats).reduce((sum, count) => sum + count, 0);
            return {
                tables: tableStats,
                totalRecords,
                dbSize: 0,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get database stats', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to get database statistics', 500);
        }
    }
    async healthCheck() {
        try {
            await database_1.prisma.$queryRaw `SELECT 1`;
            return true;
        }
        catch (error) {
            logger_1.logger.error('Database health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    async cleanup(options) {
        const { table, dateField, maxAge, batchSize = 1000 } = options;
        try {
            const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
            const result = await this.executeRawQuery(`DELETE FROM ${table} WHERE ${dateField} < $1`, [cutoffDate]);
            logger_1.logger.info('Database cleanup completed', {
                table,
                maxAge,
                deletedRows: result.length,
            });
            return result.length;
        }
        catch (error) {
            logger_1.logger.error('Database cleanup failed', {
                table,
                maxAge,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Database cleanup failed', 500);
        }
    }
    async backup(options = {}) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = options.path || `/tmp/backup-${timestamp}.sql`;
            logger_1.logger.info('Database backup initiated', { backupPath });
            return backupPath;
        }
        catch (error) {
            logger_1.logger.error('Database backup failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Database backup failed', 500);
        }
    }
}
exports.DatabaseService = DatabaseService;
//# sourceMappingURL=DatabaseService.js.map
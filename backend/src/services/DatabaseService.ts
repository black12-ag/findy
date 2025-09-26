import { prisma } from '@/config/database';
import { logger } from '@/config/logger';
import { AppError } from '@/utils/error';

export class DatabaseService {
  /**
   * Execute raw SQL query
   */
  async executeRawQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await prisma.$queryRawUnsafe(query, ...params);
      return result as T[];
    } catch (error) {
      logger.error('Raw query execution failed', {
        query,
        params,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Database query failed', 500);
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    tables: Record<string, number>;
    totalRecords: number;
    dbSize: number;
  }> {
    try {
      const tables = await prisma.$queryRaw<Array<{ table_name: string; row_count: number }>>`
        SELECT 
          schemaname,
          tablename as table_name,
          n_tup_ins + n_tup_upd + n_tup_del as row_count
        FROM pg_stat_user_tables
      `;

      const tableStats = tables.reduce((acc, table) => {
        acc[table.table_name] = table.row_count;
        return acc;
      }, {} as Record<string, number>);

      const totalRecords = Object.values(tableStats).reduce((sum, count) => sum + count, 0);

      return {
        tables: tableStats,
        totalRecords,
        dbSize: 0, // Simplified
      };
    } catch (error) {
      logger.error('Failed to get database stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to get database statistics', 500);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Clean up old records
   */
  async cleanup(options: {
    table: string;
    dateField: string;
    maxAge: number; // in days
    batchSize?: number;
  }): Promise<number> {
    const { table, dateField, maxAge, batchSize = 1000 } = options;
    
    try {
      const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
      
      const result = await this.executeRawQuery(
        `DELETE FROM ${table} WHERE ${dateField} < $1`,
        [cutoffDate]
      );

      logger.info('Database cleanup completed', {
        table,
        maxAge,
        deletedRows: result.length,
      });

      return result.length;
    } catch (error) {
      logger.error('Database cleanup failed', {
        table,
        maxAge,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Database cleanup failed', 500);
    }
  }

  /**
   * Backup database (simplified)
   */
  async backup(options: { path?: string; compression?: boolean } = {}): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = options.path || `/tmp/backup-${timestamp}.sql`;
      
      logger.info('Database backup initiated', { backupPath });
      
      // In production, you'd implement actual backup logic here
      // This could use pg_dump or similar tools
      
      return backupPath;
    } catch (error) {
      logger.error('Database backup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Database backup failed', 500);
    }
  }
}
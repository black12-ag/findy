export declare class DatabaseService {
    executeRawQuery<T = any>(query: string, params?: any[]): Promise<T[]>;
    getStats(): Promise<{
        tables: Record<string, number>;
        totalRecords: number;
        dbSize: number;
    }>;
    healthCheck(): Promise<boolean>;
    cleanup(options: {
        table: string;
        dateField: string;
        maxAge: number;
        batchSize?: number;
    }): Promise<number>;
    backup(options?: {
        path?: string;
        compression?: boolean;
    }): Promise<string>;
}
//# sourceMappingURL=DatabaseService.d.ts.map
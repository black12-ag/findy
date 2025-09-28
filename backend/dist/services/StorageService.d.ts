export interface FileInfo {
    path: string;
    size: number;
    lastModified: number;
    isDirectory: boolean;
}
export declare class StorageService {
    private readonly tempDir;
    private readonly uploadDir;
    constructor();
    private ensureDirectories;
    storeFile(fileName: string, content: Buffer | string, isTemp?: boolean): Promise<string>;
    getFile(filePath: string): Promise<Buffer>;
    deleteFile(filePath: string): Promise<void>;
    listTempFiles(): Promise<FileInfo[]>;
    private listFilesRecursively;
    fileExists(filePath: string): Promise<boolean>;
    getFileStats(filePath: string): Promise<FileInfo>;
    cleanupTempFiles(maxAge?: number): Promise<number>;
    getStorageUsage(): Promise<{
        tempSize: number;
        uploadSize: number;
        totalSize: number;
        fileCount: number;
    }>;
}
//# sourceMappingURL=StorageService.d.ts.map
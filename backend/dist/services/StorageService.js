"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const logger_1 = require("@/config/logger");
const error_1 = require("@/utils/error");
class StorageService {
    constructor() {
        this.tempDir = '/tmp/pathfinder';
        this.uploadDir = process.env.UPLOAD_DIR || '/uploads';
        this.ensureDirectories();
    }
    async ensureDirectories() {
        try {
            await fs_1.promises.mkdir(this.tempDir, { recursive: true });
            await fs_1.promises.mkdir(this.uploadDir, { recursive: true });
            logger_1.logger.debug('Storage directories ensured', {
                tempDir: this.tempDir,
                uploadDir: this.uploadDir,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to create storage directories', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async storeFile(fileName, content, isTemp = false) {
        try {
            const baseDir = isTemp ? this.tempDir : this.uploadDir;
            const filePath = path_1.default.join(baseDir, fileName);
            const dir = path_1.default.dirname(filePath);
            await fs_1.promises.mkdir(dir, { recursive: true });
            await fs_1.promises.writeFile(filePath, content);
            logger_1.logger.info('File stored', {
                fileName,
                filePath,
                size: Buffer.isBuffer(content) ? content.length : content.length,
                isTemp,
            });
            return filePath;
        }
        catch (error) {
            logger_1.logger.error('Failed to store file', {
                fileName,
                isTemp,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to store file', 500);
        }
    }
    async getFile(filePath) {
        try {
            const content = await fs_1.promises.readFile(filePath);
            logger_1.logger.debug('File retrieved', { filePath, size: content.length });
            return content;
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve file', {
                filePath,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('File not found', 404);
        }
    }
    async deleteFile(filePath) {
        try {
            await fs_1.promises.unlink(filePath);
            logger_1.logger.info('File deleted', { filePath });
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                logger_1.logger.warn('File not found for deletion', { filePath });
                return;
            }
            logger_1.logger.error('Failed to delete file', {
                filePath,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('Failed to delete file', 500);
        }
    }
    async listTempFiles() {
        try {
            const files = await this.listFilesRecursively(this.tempDir);
            return files;
        }
        catch (error) {
            logger_1.logger.error('Failed to list temp files', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return [];
        }
    }
    async listFilesRecursively(dirPath) {
        const files = [];
        try {
            const entries = await fs_1.promises.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path_1.default.join(dirPath, entry.name);
                const stats = await fs_1.promises.stat(fullPath);
                if (entry.isDirectory()) {
                    const subFiles = await this.listFilesRecursively(fullPath);
                    files.push(...subFiles);
                }
                else {
                    files.push({
                        path: fullPath,
                        size: stats.size,
                        lastModified: stats.mtime.getTime(),
                        isDirectory: false,
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.warn('Error listing directory', {
                dirPath,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
        return files;
    }
    async fileExists(filePath) {
        try {
            await fs_1.promises.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async getFileStats(filePath) {
        try {
            const stats = await fs_1.promises.stat(filePath);
            return {
                path: filePath,
                size: stats.size,
                lastModified: stats.mtime.getTime(),
                isDirectory: stats.isDirectory(),
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get file stats', {
                filePath,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new error_1.AppError('File not found', 404);
        }
    }
    async cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000) {
        try {
            const files = await this.listTempFiles();
            const cutoffTime = Date.now() - maxAge;
            let deletedCount = 0;
            for (const file of files) {
                if (file.lastModified < cutoffTime) {
                    try {
                        await this.deleteFile(file.path);
                        deletedCount++;
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to delete temp file during cleanup', {
                            filePath: file.path,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }
            }
            logger_1.logger.info('Temp files cleanup completed', {
                totalFiles: files.length,
                deletedFiles: deletedCount,
                maxAge,
            });
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Temp files cleanup failed', {
                maxAge,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return 0;
        }
    }
    async getStorageUsage() {
        try {
            const [tempFiles, uploadFiles] = await Promise.all([
                this.listFilesRecursively(this.tempDir),
                this.listFilesRecursively(this.uploadDir),
            ]);
            const tempSize = tempFiles.reduce((sum, file) => sum + file.size, 0);
            const uploadSize = uploadFiles.reduce((sum, file) => sum + file.size, 0);
            return {
                tempSize,
                uploadSize,
                totalSize: tempSize + uploadSize,
                fileCount: tempFiles.length + uploadFiles.length,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get storage usage', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return {
                tempSize: 0,
                uploadSize: 0,
                totalSize: 0,
                fileCount: 0,
            };
        }
    }
}
exports.StorageService = StorageService;
//# sourceMappingURL=StorageService.js.map
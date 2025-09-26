import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '@/config/logger';
import { AppError } from '@/utils/error';

export interface FileInfo {
  path: string;
  size: number;
  lastModified: number;
  isDirectory: boolean;
}

export class StorageService {
  private readonly tempDir = '/tmp/pathfinder';
  private readonly uploadDir = process.env.UPLOAD_DIR || '/uploads';

  constructor() {
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.uploadDir, { recursive: true });
      logger.debug('Storage directories ensured', {
        tempDir: this.tempDir,
        uploadDir: this.uploadDir,
      });
    } catch (error) {
      logger.error('Failed to create storage directories', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Store file
   */
  async storeFile(
    fileName: string,
    content: Buffer | string,
    isTemp: boolean = false
  ): Promise<string> {
    try {
      const baseDir = isTemp ? this.tempDir : this.uploadDir;
      const filePath = path.join(baseDir, fileName);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, content);
      
      logger.info('File stored', {
        fileName,
        filePath,
        size: Buffer.isBuffer(content) ? content.length : content.length,
        isTemp,
      });
      
      return filePath;
    } catch (error) {
      logger.error('Failed to store file', {
        fileName,
        isTemp,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to store file', 500);
    }
  }

  /**
   * Retrieve file
   */
  async getFile(filePath: string): Promise<Buffer> {
    try {
      const content = await fs.readFile(filePath);
      logger.debug('File retrieved', { filePath, size: content.length });
      return content;
    } catch (error) {
      logger.error('Failed to retrieve file', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('File not found', 404);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info('File deleted', { filePath });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        logger.warn('File not found for deletion', { filePath });
        return;
      }
      logger.error('Failed to delete file', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to delete file', 500);
    }
  }

  /**
   * List temporary files
   */
  async listTempFiles(): Promise<FileInfo[]> {
    try {
      const files = await this.listFilesRecursively(this.tempDir);
      return files;
    } catch (error) {
      logger.error('Failed to list temp files', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * List files recursively
   */
  private async listFilesRecursively(dirPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);

        if (entry.isDirectory()) {
          const subFiles = await this.listFilesRecursively(fullPath);
          files.push(...subFiles);
        } else {
          files.push({
            path: fullPath,
            size: stats.size,
            lastModified: stats.mtime.getTime(),
            isDirectory: false,
          });
        }
      }
    } catch (error) {
      logger.warn('Error listing directory', {
        dirPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return files;
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(filePath);
      return {
        path: filePath,
        size: stats.size,
        lastModified: stats.mtime.getTime(),
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      logger.error('Failed to get file stats', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('File not found', 404);
    }
  }

  /**
   * Clean up old temp files
   */
  async cleanupTempFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const files = await this.listTempFiles();
      const cutoffTime = Date.now() - maxAge;
      let deletedCount = 0;

      for (const file of files) {
        if (file.lastModified < cutoffTime) {
          try {
            await this.deleteFile(file.path);
            deletedCount++;
          } catch (error) {
            logger.warn('Failed to delete temp file during cleanup', {
              filePath: file.path,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      logger.info('Temp files cleanup completed', {
        totalFiles: files.length,
        deletedFiles: deletedCount,
        maxAge,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Temp files cleanup failed', {
        maxAge,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Get storage usage
   */
  async getStorageUsage(): Promise<{
    tempSize: number;
    uploadSize: number;
    totalSize: number;
    fileCount: number;
  }> {
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
    } catch (error) {
      logger.error('Failed to get storage usage', {
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
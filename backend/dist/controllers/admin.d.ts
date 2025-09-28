import { Request, Response } from 'express';
export declare class AdminController {
    getJobSystemHealth(_req: Request, res: Response): Promise<void>;
    getQueueStats(_req: Request, res: Response): Promise<void>;
    pauseQueue(req: Request, res: Response): Promise<void>;
    resumeQueue(req: Request, res: Response): Promise<void>;
    scheduleJob(req: Request, res: Response): Promise<void>;
    scheduleRecurringJob(req: Request, res: Response): Promise<void>;
    stopRecurringJob(req: Request, res: Response): Promise<void>;
    triggerCleanup(req: Request, res: Response): Promise<void>;
    triggerAnalytics(req: Request, res: Response): Promise<void>;
    sendNotification(req: Request, res: Response): Promise<void>;
    getJobTypes(_req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=admin.d.ts.map
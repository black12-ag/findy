import { Request, Response, NextFunction } from 'express';
export declare const initSentry: () => void;
export declare const sentryRequestHandler: () => (req: Request, res: Response, next: NextFunction) => void;
export declare const sentryErrorHandler: () => (error: any, req: Request, res: Response, next: NextFunction) => void;
export declare const sentryTracingHandler: () => (req: Request, res: Response, next: NextFunction) => void;
export declare const captureException: (error: Error) => void;
export declare const captureMessage: (message: string, level?: string) => void;
export declare const addBreadcrumb: (breadcrumb: any) => void;
export declare const setUser: (user: any) => void;
export declare const setTag: (key: string, value: string) => void;
export declare const setContext: (name: string, context: any) => void;
export declare const withScope: (callback: (scope: any) => void) => void;
export declare const startTransaction: (transactionContext: any) => any;
export declare const getCurrentHub: () => any;
export { initSentry as init };
//# sourceMappingURL=sentry-simple.d.ts.map
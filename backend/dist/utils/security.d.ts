export declare const sanitizeInput: (input: any) => any;
export declare const generateSecureToken: (length?: number) => string;
export declare const generateUUID: () => string;
export declare const hashData: (data: string) => string;
export declare const isValidEmail: (email: string) => boolean;
export declare const isValidPhoneNumber: (phone: string) => boolean;
export declare const validatePasswordStrength: (password: string) => {
    isValid: boolean;
    errors: string[];
};
export declare const generateRateLimitKey: (identifier: string, endpoint: string) => string;
export declare const maskSensitiveData: (data: any) => any;
export declare const containsSQLInjection: (input: string) => boolean;
export declare const containsXSS: (input: string) => boolean;
export declare const validateInput: (input: string, fieldName?: string) => void;
export declare const generateAPIKey: () => string;
export declare const isValidAPIKey: (apiKey: string) => boolean;
//# sourceMappingURL=security.d.ts.map
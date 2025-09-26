import crypto from 'crypto';
import { AppError } from './error';

// Input sanitization
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove HTML brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};

// Generate secure random token
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate UUID
export const generateUUID = (): string => {
  return crypto.randomUUID();
};

// Hash sensitive data (not for passwords - use bcrypt for that)
export const hashData = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number (basic)
export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\s|-/g, ''));
};

// Validate password strength
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Rate limiting key generator
export const generateRateLimitKey = (
  identifier: string,
  endpoint: string
): string => {
  return `rate_limit:${endpoint}:${hashData(identifier)}`;
};

// Mask sensitive data for logging
export const maskSensitiveData = (data: any): any => {
  if (typeof data === 'string') {
    // Mask email addresses
    if (isValidEmail(data)) {
      const [username, domain] = data.split('@');
      return `${username.substring(0, 2)}***@${domain}`;
    }
    
    // Mask phone numbers
    if (isValidPhoneNumber(data)) {
      return data.replace(/\d(?=\d{4})/g, '*');
    }
    
    // Mask potential tokens or IDs
    if (data.length > 10 && /^[a-zA-Z0-9]+$/.test(data)) {
      return `${data.substring(0, 4)}***${data.substring(data.length - 4)}`;
    }
  }
  
  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }
  
  if (typeof data === 'object' && data !== null) {
    const masked: any = {};
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));
      
      if (isSensitive) {
        masked[key] = '***REDACTED***';
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }
  
  return data;
};

// Check for SQL injection patterns
export const containsSQLInjection = (input: string): boolean => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b)/i,
    /(\b(UNION|OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(--|#|\/\*|\*\/)/,
    /(\bxp_\w+\b)/i,
    /(\bsp_\w+\b)/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
};

// Check for XSS patterns
export const containsXSS = (input: string): boolean => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]*src\s*=\s*["']?javascript:/gi,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
};

// Validate input against common attacks
export const validateInput = (input: string, fieldName: string = 'input'): void => {
  if (containsSQLInjection(input)) {
    throw new AppError(
      `Invalid ${fieldName}: potential SQL injection detected`,
      400,
      true,
      'SECURITY_VIOLATION'
    );
  }
  
  if (containsXSS(input)) {
    throw new AppError(
      `Invalid ${fieldName}: potential XSS attack detected`,
      400,
      true,
      'SECURITY_VIOLATION'
    );
  }
};

// Generate API key
export const generateAPIKey = (): string => {
  const prefix = 'pfp'; // PathFinder Pro
  const timestamp = Date.now().toString(36);
  const random = generateSecureToken(16);
  return `${prefix}_${timestamp}_${random}`;
};

// Validate API key format
export const isValidAPIKey = (apiKey: string): boolean => {
  const pattern = /^pfp_[a-z0-9]+_[a-f0-9]{32}$/;
  return pattern.test(apiKey);
};
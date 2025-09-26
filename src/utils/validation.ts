/**
 * Form validation utilities using Zod
 * Provides reusable validation schemas and error formatting
 */

import { z } from 'zod';

// User authentication schemas
export const loginSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password is too long'),
});

export const registerSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string(),
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name is too long')
    .regex(/^[a-zA-Z\s]+$/, 'First name can only contain letters and spaces'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name is too long')
    .regex(/^[a-zA-Z\s]+$/, 'Last name can only contain letters and spaces'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Profile update schema
export const profileUpdateSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name is too long')
    .regex(/^[a-zA-Z\s]+$/, 'First name can only contain letters and spaces'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name is too long')
    .regex(/^[a-zA-Z\s]+$/, 'Last name can only contain letters and spaces'),
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  phoneNumber: z.string()
    .optional()
    .refine((val) => !val || /^\+?[\d\s\-\(\)]+$/.test(val), 'Please enter a valid phone number'),
});

// Simple profile edit schema (for name + email forms)
export const profileEditSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name is too long')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

// Search validation
export const searchQuerySchema = z.object({
  query: z.string()
    .min(2, 'Search query must be at least 2 characters')
    .max(100, 'Search query is too long')
    .regex(/^[a-zA-Z0-9\s\-\.,#]+$/, 'Search query contains invalid characters'),
});

// Location validation
export const locationSchema = z.object({
  lat: z.number()
    .min(-90, 'Invalid latitude')
    .max(90, 'Invalid latitude'),
  lng: z.number()
    .min(-180, 'Invalid longitude')
    .max(180, 'Invalid longitude'),
});

export const savedPlaceSchema = z.object({
  name: z.string()
    .min(1, 'Place name is required')
    .max(100, 'Place name is too long'),
  address: z.string()
    .min(1, 'Address is required')
    .max(200, 'Address is too long'),
  category: z.enum(['home', 'work', 'gym', 'restaurant', 'shopping', 'entertainment', 'health', 'education', 'other'])
    .optional(),
  notes: z.string()
    .max(500, 'Notes are too long')
    .optional(),
});

// Settings validation
export const settingsUpdateSchema = z.object({
  defaultTransportMode: z.enum(['driving', 'walking', 'transit', 'cycling']).optional(),
  voiceGuidance: z.boolean().optional(),
  avoidTolls: z.boolean().optional(),
  avoidHighways: z.boolean().optional(),
  avoidFerries: z.boolean().optional(),
  mapStyle: z.string().optional(),
  darkMode: z.boolean().optional(),
  language: z.string().min(2).max(5).optional(),
  units: z.enum(['metric', 'imperial']).optional(),
});

// API key validation
export const apiKeySchema = z.object({
  key: z.string()
    .min(10, 'API key is too short')
    .max(200, 'API key is too long')
    .regex(/^[a-zA-Z0-9\-_]+$/, 'API key contains invalid characters'),
});

// Contact/Support validation
export const contactFormSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name is too long'),
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  subject: z.string()
    .min(1, 'Subject is required')
    .max(200, 'Subject is too long'),
  message: z.string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message is too long'),
});

// Review validation
export const reviewSchema = z.object({
  rating: z.number()
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  comment: z.string()
    .min(1, 'Review comment is required')
    .max(1000, 'Review is too long'),
});

// Route planning validation
export const routePlanningSchema = z.object({
  from: z.object({
    name: z.string().min(1, 'Starting location is required'),
    lat: z.number(),
    lng: z.number(),
  }),
  to: z.object({
    name: z.string().min(1, 'Destination is required'),
    lat: z.number(),
    lng: z.number(),
  }),
  mode: z.enum(['driving', 'walking', 'transit', 'cycling']),
  waypoints: z.array(z.object({
    name: z.string().min(1),
    lat: z.number(),
    lng: z.number(),
  })).optional(),
});

// Export type definitions
export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
export type ProfileUpdateForm = z.infer<typeof profileUpdateSchema>;
export type SearchQueryForm = z.infer<typeof searchQuerySchema>;
export type SavedPlaceForm = z.infer<typeof savedPlaceSchema>;
export type SettingsUpdateForm = z.infer<typeof settingsUpdateSchema>;
export type ContactForm = z.infer<typeof contactFormSchema>;
export type ReviewForm = z.infer<typeof reviewSchema>;
export type RoutePlanningForm = z.infer<typeof routePlanningSchema>;

// Validation helper functions
export const validateForm = <T>(data: unknown, schema: z.ZodSchema<T>): {
  isValid: boolean;
  data?: T;
  errors: Record<string, string>;
} => {
  try {
    const result = schema.parse(data);
    return { isValid: true, data: result, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        if (err.path.length > 0) {
          errors[err.path.join('.')] = err.message;
        }
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { general: 'Validation failed' } };
  }
};

// Field validation helper for real-time validation
export const validateField = <T>(schema: z.ZodSchema<T>, field: string, value: any): string | null => {
  try {
    // Create a partial schema for the specific field
    const fieldSchema = schema.shape?.[field as keyof z.infer<typeof schema>];
    if (fieldSchema) {
      fieldSchema.parse(value);
    }
    return null;
  } catch (error) {
    if (error instanceof z.ZodError && error.errors.length > 0) {
      return error.errors[0].message;
    }
    return 'Invalid input';
  }
};

// Format validation errors for display
export const formatValidationErrors = (errors: z.ZodError): Record<string, string> => {
  const formatted: Record<string, string> = {};
  errors.errors.forEach((error) => {
    const path = error.path.join('.');
    formatted[path] = error.message;
  });
  return formatted;
};
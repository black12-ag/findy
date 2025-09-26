/**
 * useForm hook for form validation and state management
 * Provides real-time validation, error handling, and form submission
 */

import { useState, useCallback } from 'react';
import { z } from 'zod';
import { validateForm, validateField } from '../utils/validation';
import { logger } from '../utils/logger';

interface UseFormOptions<T> {
  schema: z.ZodSchema<T>;
  initialValues?: Partial<T>;
  onSubmit: (data: T) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

interface FieldError {
  message: string;
  touched: boolean;
}

interface UseFormReturn<T> {
  values: Partial<T>;
  errors: Record<keyof T, FieldError>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setError: (field: keyof T, message: string) => void;
  clearError: (field: keyof T) => void;
  clearAllErrors: () => void;
  validateField: (field: keyof T) => boolean;
  validateForm: () => boolean;
  handleBlur: (field: keyof T) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  reset: (newValues?: Partial<T>) => void;
  getFieldError: (field: keyof T) => string | undefined;
  hasFieldError: (field: keyof T) => boolean;
}

export function useForm<T extends Record<string, any>>({
  schema,
  initialValues = {},
  onSubmit,
  validateOnChange = true,
  validateOnBlur = true,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [values, setValuesState] = useState<Partial<T>>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, FieldError>>({} as Record<keyof T, FieldError>);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<keyof T>>(new Set());
  const [isDirty, setIsDirty] = useState(false);

  // Check if form is valid
  const isValid = Object.keys(errors).every(key => !errors[key as keyof T]?.message);

  const setValue = useCallback((field: keyof T, value: any) => {
    setValuesState(prev => {
      const newValues = { ...prev, [field]: value };
      setIsDirty(true);
      
      // Real-time validation on change
      if (validateOnChange) {
        try {
          const fieldSchema = (schema as any).shape?.[field];
          if (fieldSchema) {
            fieldSchema.parse(value);
            // Clear error if validation passes
            setErrors(prev => ({
              ...prev,
              [field]: { message: '', touched: prev[field]?.touched || false }
            }));
          }
        } catch (error) {
          if (error instanceof z.ZodError && error.errors.length > 0) {
            setErrors(prev => ({
              ...prev,
              [field]: { message: error.errors[0].message, touched: prev[field]?.touched || false }
            }));
          }
        }
      }
      
      return newValues;
    });
  }, [schema, validateOnChange]);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(newValues);
    setIsDirty(true);
  }, []);

  const setError = useCallback((field: keyof T, message: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: { message, touched: true }
    }));
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setErrors(prev => ({
      ...prev,
      [field]: { message: '', touched: prev[field]?.touched || false }
    }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({} as Record<keyof T, FieldError>);
  }, []);

  const validateFieldFn = useCallback((field: keyof T): boolean => {
    try {
      const fieldSchema = (schema as any).shape?.[field];
      if (fieldSchema) {
        fieldSchema.parse(values[field]);
        clearError(field);
        return true;
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError && error.errors.length > 0) {
        setError(field, error.errors[0].message);
        return false;
      }
      return false;
    }
  }, [schema, values, setError, clearError]);

  const validateFormFn = useCallback((): boolean => {
    try {
      const result = validateForm(schema, values);
      if (result.success) {
        clearAllErrors();
        return true;
      } else {
        // Set all errors
        const newErrors: Record<keyof T, FieldError> = {} as Record<keyof T, FieldError>;
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, message]) => {
            newErrors[field as keyof T] = { message, touched: true };
          });
        }
        setErrors(newErrors);
        return false;
      }
    } catch (error) {
      logger.error('Form validation failed', { error, values });
      return false;
    }
  }, [schema, values, clearAllErrors]);

  const handleBlur = useCallback((field: keyof T) => {
    setTouchedFields(prev => new Set(prev).add(field));
    
    if (validateOnBlur) {
      validateFieldFn(field);
    }
  }, [validateOnBlur, validateFieldFn]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (isSubmitting) return;

    // Mark all fields as touched
    const allFields = Object.keys(values) as (keyof T)[];
    setTouchedFields(new Set(allFields));

    // Validate entire form
    if (!validateFormFn()) {
      logger.warn('Form validation failed on submit', { errors });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values as T);
      logger.debug('Form submitted successfully', { values });
    } catch (error) {
      logger.error('Form submission failed', { error, values });
      
      // If it's a validation error from server, show it
      if (error instanceof Error && error.message.includes('validation')) {
        setError('general' as keyof T, 'Please check your input and try again');
      } else {
        setError('general' as keyof T, 'An error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, validateFormFn, onSubmit, values, errors, setError]);

  const reset = useCallback((newValues?: Partial<T>) => {
    const valuesToSet = newValues || initialValues;
    setValuesState(valuesToSet);
    setErrors({} as Record<keyof T, FieldError>);
    setTouchedFields(new Set());
    setIsDirty(false);
  }, [initialValues]);

  const getFieldError = useCallback((field: keyof T): string | undefined => {
    const error = errors[field];
    return error?.touched && error?.message ? error.message : undefined;
  }, [errors]);

  const hasFieldError = useCallback((field: keyof T): boolean => {
    const error = errors[field];
    return !!(error?.touched && error?.message);
  }, [errors]);

  return {
    values,
    errors,
    isSubmitting,
    isValid,
    isDirty,
    setValue,
    setValues,
    setError,
    clearError,
    clearAllErrors,
    validateField: validateFieldFn,
    validateForm: validateFormFn,
    handleBlur,
    handleSubmit,
    reset,
    getFieldError,
    hasFieldError,
  };
}

// Specialized hooks for common forms
export function useLoginForm(onSubmit: (data: { email: string; password: string }) => Promise<void>) {
  const { loginSchema } = await import('../utils/validation');
  return useForm({
    schema: loginSchema,
    onSubmit,
    initialValues: { email: '', password: '' },
  });
}

export function useRegisterForm(onSubmit: (data: {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}) => Promise<void>) {
  const { registerSchema } = await import('../utils/validation');
  return useForm({
    schema: registerSchema,
    onSubmit,
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
    },
  });
}

export function useSearchForm(onSubmit: (data: { query: string }) => Promise<void>) {
  const { searchQuerySchema } = await import('../utils/validation');
  return useForm({
    schema: searchQuerySchema,
    onSubmit,
    initialValues: { query: '' },
    validateOnChange: true,
  });
}
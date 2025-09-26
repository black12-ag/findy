/**
 * LoginForm component with validation
 * Uses the useForm hook for form validation and state management
 */

import React from 'react';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { useForm } from '../../hooks/useForm';
import { loginSchema, type LoginForm as LoginFormData } from '../../utils/validation';
import { useUser } from '../../contexts/UserContext';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
  className?: string;
}

export function LoginForm({ onSuccess, onSwitchToRegister, className = '' }: LoginFormProps) {
  const { login } = useUser();
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<LoginFormData>({
    schema: loginSchema,
    initialValues: {
      email: '',
      password: '',
    },
    onSubmit: async (data) => {
      try {
        await login(data.email, data.password);
        logger.success('Successfully logged in');
        onSuccess?.();
      } catch (error) {
        logger.error('Login failed', { error, email: data.email });
        form.setError('general' as keyof LoginFormData, 'Invalid email or password. Please try again.');
        throw error; // Re-throw to let form handle it
      }
    },
  });

  return (
    <Card className={`p-6 w-full max-w-md ${className}`}>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
        <p className="text-gray-600 mt-1">Sign in to your PathFinder Pro account</p>
      </div>

      <form onSubmit={form.handleSubmit} className="space-y-4">
        {/* General Error */}
        {form.getFieldError('general' as keyof LoginFormData) && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-700">{form.getFieldError('general' as keyof LoginFormData)}</p>
          </div>
        )}

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <Input
            id="email"
            type="email"
            value={form.values.email || ''}
            onChange={(e) => form.setValue('email', e.target.value)}
            onBlur={() => form.handleBlur('email')}
            className={form.hasFieldError('email') ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
            placeholder="Enter your email"
            autoComplete="email"
            disabled={form.isSubmitting}
          />
          {form.getFieldError('email') && (
            <p className="mt-1 text-sm text-red-600">{form.getFieldError('email')}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={form.values.password || ''}
              onChange={(e) => form.setValue('password', e.target.value)}
              onBlur={() => form.handleBlur('password')}
              className={form.hasFieldError('password') ? 'border-red-300 focus:border-red-500 focus:ring-red-500 pr-10' : 'pr-10'}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={form.isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              disabled={form.isSubmitting}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {form.getFieldError('password') && (
            <p className="mt-1 text-sm text-red-600">{form.getFieldError('password')}</p>
          )}
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
              Remember me
            </label>
          </div>
          <button
            type="button"
            className="text-sm text-blue-600 hover:text-blue-500"
            onClick={() => {
              logger.info('Forgot password clicked');
              toast.info('Password reset feature will redirect to password recovery page');
              // In a real app, this would open a password reset modal or navigate to reset page
              // window.location.href = '/forgot-password';
            }}
          >
            Forgot password?
          </button>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={form.isSubmitting || !form.isValid}
        >
          {form.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </>
          )}
        </Button>

        {/* Switch to Register */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-medium text-blue-600 hover:text-blue-500"
              disabled={form.isSubmitting}
            >
              Sign up now
            </button>
          </p>
        </div>

        {/* Guest Option */}
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Or continue without an account</p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              logger.info('Continue as guest');
              onSuccess?.();
            }}
            disabled={form.isSubmitting}
          >
            Continue as Guest
          </Button>
        </div>
      </form>

      {/* Development Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-500">
            Development: Form valid: {form.isValid ? '✅' : '❌'} | 
            Dirty: {form.isDirty ? '✅' : '❌'} |
            Submitting: {form.isSubmitting ? '✅' : '❌'}
          </p>
        </div>
      )}
    </Card>
  );
}

export default LoginForm;
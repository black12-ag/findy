import React, { createContext, useContext, useState, ReactNode } from 'react';
import LoadingSpinner, { LoadingOverlay as LoadingOverlayComponent } from '../components/LoadingSpinner';
import { GlobalLoading } from '../components/GlobalLoading';
import { Loader2 } from 'lucide-react';

interface LoadingState {
  [key: string]: boolean;
}

interface LoadingContextType {
  loadingStates: LoadingState;
  setLoading: (key: string, isLoading: boolean) => void;
  isLoading: (key?: string) => boolean;
  isAnyLoading: () => boolean;
  clearAllLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  const setLoading = (key: string, isLoading: boolean) => {
    setLoadingStates(prev => {
      if (!isLoading && prev[key]) {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      }
      if (isLoading && !prev[key]) {
        return { ...prev, [key]: true };
      }
      return prev;
    });
  };

  const isLoading = (key?: string) => {
    if (key) {
      return !!loadingStates[key];
    }
    return Object.keys(loadingStates).length > 0;
  };

  const isAnyLoading = () => {
    return Object.keys(loadingStates).length > 0;
  };

  const clearAllLoading = () => {
    setLoadingStates({});
  };

  return (
    <LoadingContext.Provider value={{
      loadingStates,
      setLoading,
      isLoading,
      isAnyLoading,
      clearAllLoading
    }}>
      {children}
    </LoadingContext.Provider>
  );
};

// Loading spinner component
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text, 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Loader2 className={`animate-spin text-blue-600 ${sizeClasses[size]}`} />
      {text && (
        <span className="text-sm text-gray-600 animate-pulse">{text}</span>
      )}
    </div>
  );
};

// Full screen loading overlay
interface LoadingOverlayProps {
  visible: boolean;
  text?: string;
  backdrop?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  visible, 
  text = 'Loading...', 
  backdrop = true 
}) => {
  if (!visible) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${
      backdrop ? 'bg-black bg-opacity-50' : ''
    }`}>
      <div className="bg-white rounded-lg p-6 shadow-xl">
        <LoadingSpinner size="lg" text={text} className="flex-col gap-3" />
      </div>
    </div>
  );
};

// Button with loading state
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({ 
  children, 
  loading = false, 
  loadingText, 
  disabled,
  className = '',
  variant = 'primary',
  size = 'md',
  ...props 
}) => {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
    ghost: 'hover:bg-gray-100 text-gray-700'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-md font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {loading ? (loadingText || children) : children}
    </button>
  );
};

// Hook for easy loading state management
export const useLoadingState = (key: string) => {
  const { setLoading, isLoading } = useLoading();

  const startLoading = () => setLoading(key, true);
  const stopLoading = () => setLoading(key, false);
  const isCurrentlyLoading = isLoading(key);

  return {
    isLoading: isCurrentlyLoading,
    startLoading,
    stopLoading,
    setLoading: (loading: boolean) => setLoading(key, loading)
  };
};

// Higher-order component for adding loading states
export const withLoading = <P extends object>(
  Component: React.ComponentType<P>,
  loadingKey?: string
) => {
  return React.forwardRef<any, P & { loading?: boolean }>((props, ref) => {
    const { loading, ...otherProps } = props;
    const { setLoading } = useLoading();
    const key = loadingKey || Component.displayName || Component.name || 'component';

    React.useEffect(() => {
      if (loading !== undefined) {
        setLoading(key, loading);
      }
      return () => setLoading(key, false);
    }, [loading, key, setLoading]);

    return <Component {...(otherProps as P)} ref={ref} />;
  });
};
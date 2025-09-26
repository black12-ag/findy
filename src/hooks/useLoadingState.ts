import { useContext } from 'react';
import { LoadingContext, LoadingContextType } from '../contexts/LoadingContext';

export const useLoadingState = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  
  if (!context) {
    throw new Error('useLoadingState must be used within a LoadingProvider');
  }
  
  return context;
};
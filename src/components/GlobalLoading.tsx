import React, { useContext } from 'react';
import { LoadingContext } from '../contexts/LoadingContext';
import { LoadingOverlay } from './LoadingSpinner';

const GlobalLoading: React.FC = () => {
  const { isLoading, loadingMessage, loadingType } = useContext(LoadingContext);

  if (!isLoading) {
    return null;
  }

  return (
    <LoadingOverlay 
      message={loadingMessage} 
      variant={loadingType === 'navigation' ? 'navigation' : 'default'}
    />
  );
};

export default GlobalLoading;
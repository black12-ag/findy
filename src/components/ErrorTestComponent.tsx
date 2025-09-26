import React, { useState } from 'react';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorTestComponentProps {
  onClose: () => void;
}

export const ErrorTestComponent: React.FC<ErrorTestComponentProps> = ({ onClose }) => {
  const [shouldError, setShouldError] = useState(false);

  // This will trigger an error that the ErrorBoundary should catch
  if (shouldError) {
    throw new Error('Test error: This is an intentional error for testing the ErrorBoundary');
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-lg max-w-md mx-auto mt-8">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="w-6 h-6 text-orange-500" />
        <h3 className="text-lg font-semibold">Error Boundary Test</h3>
      </div>
      
      <p className="text-gray-600 mb-4">
        Click the button below to trigger an error and test the error boundary functionality.
      </p>
      
      <div className="flex gap-2">
        <Button 
          onClick={() => setShouldError(true)}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          Trigger Error
        </Button>
        <Button 
          variant="outline" 
          onClick={onClose}
        >
          Close Test
        </Button>
      </div>
    </div>
  );
};

export default ErrorTestComponent;
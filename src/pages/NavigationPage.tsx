import React from 'react';
import { ArrowLeft, Navigation } from 'lucide-react';

interface NavigationPageProps {
  onNavigateBack?: () => void;
  isFullscreen?: boolean;
  [key: string]: any;
}

export default function NavigationPage({ onNavigateBack, isFullscreen = false, ...props }: NavigationPageProps) {
  return (
    <div className={`${isFullscreen ? 'h-screen' : 'h-full'} bg-white flex flex-col`}>
      {!isFullscreen && onNavigateBack && (
        <div className="flex items-center p-4 border-b">
          <button onClick={onNavigateBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Navigation className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">NavigationPage</h1>
          <p className="text-gray-600 mb-6">
            This is a web-compatible placeholder for the NavigationPage component.
          </p>
          <div className="text-sm text-gray-500">
            Props received: {JSON.stringify(Object.keys(props), null, 2)}
          </div>
        </div>
      </div>
    </div>
  );
}

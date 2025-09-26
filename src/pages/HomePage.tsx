/**
 * 🏠 Home/Map Page Component
 * 
 * Web-compatible stub for the main homepage
 */

import React from 'react';
import { Home, ArrowLeft } from 'lucide-react';

interface HomePageProps {
  onNavigateBack?: () => void;
  isFullscreen?: boolean;
}

export default function HomePage({ onNavigateBack, isFullscreen = false }: HomePageProps) {
  return (
    <div className={`${isFullscreen ? 'h-screen' : 'h-full'} bg-white flex flex-col`}>
      {/* Header */}
      {!isFullscreen && onNavigateBack && (
        <div className="flex items-center p-4 border-b">
          <button onClick={onNavigateBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Home className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Home Page</h1>
          <p className="text-gray-600 mb-6">
            This is a full-screen home page component. In the original React Native version, 
            this would contain the map view and location search functionality.
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <p>• Interactive map with current location</p>
            <p>• Search for places and addresses</p>
            <p>• Transportation mode selection</p>
            <p>• Nearby points of interest</p>
            <p>• Quick navigation shortcuts</p>
          </div>
          {onNavigateBack && (
            <button 
              onClick={onNavigateBack}
              className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Main App
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
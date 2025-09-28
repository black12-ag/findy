import React from 'react';
import { Map, Search, MapPin, User, Users } from 'lucide-react';
import { Button } from './ui/button';

type Screen = 'map' | 'search' | 'route' | 'navigation' | 'saved' | 'settings' | 'transit' | 'offline' | 'ar' | 'social';

interface BottomNavigationProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export function BottomNavigation({ currentScreen, onScreenChange }: BottomNavigationProps) {
  const navItems = [
    { id: 'map', icon: Map, label: 'Map' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'saved', icon: MapPin, label: 'Saved' },
    { id: 'social', icon: Users, label: 'Community' },
    { id: 'profile', icon: User, label: 'Profile' },
  ] as const;

  return (
    <div className="bg-white border-t border-gray-200 px-2 sm:px-4 py-1.5 sm:py-2 safe-area-pb">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-0.5 sm:gap-1 h-auto py-1.5 sm:py-2 px-2 sm:px-3 touch-manipulation min-w-0 flex-1 ${
                isActive 
                  ? 'text-purple-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => onScreenChange(item.id as Screen)}
            >
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'text-purple-600' : ''}`} />
              <span className={`text-xs leading-none ${isActive ? 'text-purple-600 font-medium' : ''} truncate`}>
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
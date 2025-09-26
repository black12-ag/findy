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
    <div className="bg-white border-t border-gray-200 px-4 py-2 safe-area-pb">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 px-3 ${
                isActive 
                  ? 'text-purple-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => onScreenChange(item.id as Screen)}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-purple-600' : ''}`} />
              <span className={`text-xs ${isActive ? 'text-purple-600 font-medium' : ''}`}>
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
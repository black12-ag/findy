import React from 'react';
import { Car, UserRound, Bus, Bike } from 'lucide-react';
import { Button } from './ui/button';

type TransportMode = 'driving' | 'walking' | 'transit' | 'cycling';

interface TransportModeSelectorProps {
  currentMode: TransportMode;
  onModeChange: (mode: TransportMode) => void;
}

export function TransportModeSelector({ currentMode, onModeChange }: TransportModeSelectorProps) {
  const modes = [
    { id: 'driving', icon: Car, color: '#3B82F6', label: 'Drive' },
    { id: 'walking', icon: UserRound, color: '#10B981', label: 'Walk' },
    { id: 'transit', icon: Bus, color: '#F59E0B', label: 'Transit' },
    { id: 'cycling', icon: Bike, color: '#8B5CF6', label: 'Bike' },
  ] as const;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;
        
        return (
          <Button
            key={mode.id}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            className={`w-full justify-start gap-2 rounded-none border-0 ${
              isActive 
                ? 'text-white' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
            style={isActive ? { backgroundColor: mode.color } : {}}
            onClick={() => onModeChange(mode.id as TransportMode)}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm">{mode.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
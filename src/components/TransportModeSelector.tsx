import React from 'react';
import { Button } from './ui/button';

type TransportMode = 'driving' | 'walking' | 'transit' | 'cycling';

interface TransportModeSelectorProps {
  currentMode: TransportMode;
  onModeChange: (mode: TransportMode) => void;
}

export function TransportModeSelector({ currentMode, onModeChange }: TransportModeSelectorProps) {
  // Emoji selector with names; Taxi maps to driving
  const modes: Array<{ key: string; label: string; name: string; color: string; mapsTo: TransportMode }> = [
    { key: 'driving', label: '🚗', name: 'Drive', color: '#3B82F6', mapsTo: 'driving' },
    { key: 'walking', label: '🚶', name: 'Walk', color: '#10B981', mapsTo: 'walking' },
    { key: 'transit', label: '🚌', name: 'Transit', color: '#F59E0B', mapsTo: 'transit' },
    { key: 'cycling', label: '🚲', name: 'Bike', color: '#8B5CF6', mapsTo: 'cycling' },
  ];

  return (
    <div className="inline-flex gap-2">
      {modes.map((m) => {
        const isActive = currentMode === m.mapsTo;
        return (
          <Button
            key={m.key}
            variant={isActive ? 'default' : 'ghost'}
            aria-label={m.name}
            className={`h-12 rounded-xl border-0 justify-center flex-row gap-2 px-3 min-w-[80px] shadow-lg ${
              isActive ? 'text-white' : 'text-gray-700 bg-white/95 backdrop-blur hover:bg-white'
            }`}
            style={isActive ? { backgroundColor: m.color } : {}}
            onClick={() => onModeChange(m.mapsTo)}
            title={m.name}
          >
            <span className="text-lg leading-none">{m.label}</span>
            <span className="text-sm leading-none">{m.name}</span>
          </Button>
        );
      })}
    </div>
  );
}

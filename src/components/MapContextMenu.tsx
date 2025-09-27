import React from 'react';
import { MapPin, Navigation, Save, Share2, Compass, Info, Copy, ExternalLink } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { logger } from '../utils/logger';
import { toast } from 'sonner';

interface Location {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

interface MapContextMenuProps {
  position: { x: number; y: number } | null;
  location: Location | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (location: Location) => void;
  onSave: (location: Location) => void;
  onShare: (location: Location) => void;
  onCopyCoordinates: (location: Location) => void;
  onOpenInMaps: (location: Location) => void;
  onViewDetails: (location: Location) => void;
}

export function MapContextMenu({
  position,
  location,
  isOpen,
  onClose,
  onNavigate,
  onSave,
  onShare,
  onCopyCoordinates,
  onOpenInMaps,
  onViewDetails,
}: MapContextMenuProps) {
  if (!position || !location || !isOpen) return null;

  const handleNavigate = () => {
    onNavigate(location);
    onClose();
    toast.success('Starting navigation...');
  };

  const handleSave = () => {
    onSave(location);
    onClose();
  };

  const handleShare = () => {
    onShare(location);
    onClose();
  };

  const handleCopyCoordinates = () => {
    const coords = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
    navigator.clipboard.writeText(coords);
    toast.success('Coordinates copied to clipboard');
    onCopyCoordinates(location);
    onClose();
  };

  const handleOpenInMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
    window.open(url, '_blank');
    onOpenInMaps(location);
    onClose();
  };

  const handleViewDetails = () => {
    onViewDetails(location);
    onClose();
  };

  return (
    <div
      className="absolute z-50"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        pointerEvents: 'auto'
      }}
    >
      <DropdownMenu open={isOpen} onOpenChange={onClose}>
        <DropdownMenuTrigger asChild>
          <div className="w-0 h-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={handleNavigate}>
            <Navigation className="w-4 h-4 mr-2 text-blue-600" />
            <span>Navigate here</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleSave}>
            <Save className="w-4 h-4 mr-2 text-green-600" />
            <span>Save this location</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2 text-purple-600" />
            <span>Share location</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleViewDetails}>
            <Info className="w-4 h-4 mr-2 text-gray-600" />
            <span>What's here?</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleCopyCoordinates}>
            <Copy className="w-4 h-4 mr-2 text-gray-600" />
            <span>Copy coordinates</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleOpenInMaps}>
            <ExternalLink className="w-4 h-4 mr-2 text-gray-600" />
            <span>Open in Google Maps</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
import React from 'react';
import { Menu, Search, Bell, User } from 'lucide-react';
import { Button } from './ui/button';

interface NetflixHeaderProps {
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
  showSearch?: boolean;
  showNotifications?: boolean;
  showProfile?: boolean;
}

export const NetflixHeader: React.FC<NetflixHeaderProps> = ({
  onMenuClick,
  onSearchClick,
  onNotificationClick,
  onProfileClick,
  showSearch = true,
  showNotifications = true,
  showProfile = true,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        {/* Left side - Logo and Menu */}
        <div className="flex items-center space-x-4">
          {/* Menu button for mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-800 text-white"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <img 
              src="/fin.png" 
              alt="FINDY" 
              className="h-8 w-8 object-contain"
            />
            <span className="text-red-600 text-2xl font-bold tracking-tight">
              FINDY
            </span>
          </div>
        </div>

        {/* Center - Navigation (desktop) */}
        <nav className="hidden lg:flex items-center space-x-8">
          <Button
            variant="ghost"
            className="text-white hover:text-red-400 hover:bg-transparent font-medium"
          >
            Navigate
          </Button>
          <Button
            variant="ghost"
            className="text-white hover:text-red-400 hover:bg-transparent font-medium"
          >
            Explore
          </Button>
          <Button
            variant="ghost"
            className="text-white hover:text-red-400 hover:bg-transparent font-medium"
          >
            Saved Places
          </Button>
          <Button
            variant="ghost"
            className="text-white hover:text-red-400 hover:bg-transparent font-medium"
          >
            Traffic
          </Button>
        </nav>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-2">
          {showSearch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSearchClick}
              className="p-2 hover:bg-gray-800 text-white"
            >
              <Search className="h-5 w-5" />
            </Button>
          )}
          
          {showNotifications && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNotificationClick}
              className="p-2 hover:bg-gray-800 text-white relative"
            >
              <Bell className="h-5 w-5" />
              {/* Notification dot */}
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full"></span>
            </Button>
          )}
          
          {showProfile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onProfileClick}
              className="p-2 hover:bg-gray-800 text-white"
            >
              <User className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default NetflixHeader;
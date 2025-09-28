import React, { useState } from 'react';
import { 
  ArrowLeft, 
  User, 
  Navigation, 
  Volume2, 
  Moon, 
  Shield, 
  Download, 
  Accessibility,
  Bell,
  MapPin,
  Fuel,
  Route,
  ChevronRight,
  Settings,
  HelpCircle,
  Mic,
  Speaker,
  VolumeX,
  Type,
  Eye,
  Contrast,
  ZoomIn
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { useUser } from '../contexts/UserContext';
import { logger } from '../utils/logger';
import { ThemeToggle } from './ThemeToggle';
import { toast } from 'sonner';

interface SettingsPanelProps {
  onBack: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToFleet?: () => void;
  onNavigateToAPIDocs?: () => void;
  onNavigateToORSConfig?: () => void;
  onNavigateToDeveloper?: () => void;
  onNavigateToPushSettings?: () => void;
  onNavigateToDeviceTest?: () => void;
  onNavigateToCrashReports?: () => void;
  onNavigateToOfflineMaps?: () => void;
}

export function SettingsPanel({ onBack, onNavigateToIntegrations, onNavigateToFleet, onNavigateToAPIDocs, onNavigateToORSConfig, onNavigateToDeveloper, onNavigateToPushSettings, onNavigateToDeviceTest, onNavigateToCrashReports, onNavigateToOfflineMaps }: SettingsPanelProps) {
  const { preferences, updatePreference, updatePreferences } = useUser();
  const [currentView, setCurrentView] = useState<'main' | 'voice' | 'accessibility'>('main');
  
  // Derived state from UserContext preferences
  const darkMode = preferences.darkMode;
  const voiceGuidance = preferences.voiceGuidance;
  const notifications = preferences.socialNotifications; // Using social notifications as general notifications
  const avoidTolls = preferences.avoidTolls;
  const avoidHighways = preferences.avoidHighways;
  
  // Voice & Audio Settings - using localStorage for persistence
  const [voiceType, setVoiceType] = useState(() => localStorage.getItem('voice_type') || 'female');
  const [voiceLanguage, setVoiceLanguage] = useState(() => localStorage.getItem('voice_language') || preferences.language || 'en-US');
  const [voiceSpeed, setVoiceSpeed] = useState(() => [parseFloat(localStorage.getItem('voice_speed') || '1.0')]);
  const [masterVolume, setMasterVolume] = useState(() => [parseInt(localStorage.getItem('master_volume') || '70')]);
  const [navigationVolume, setNavigationVolume] = useState(() => [parseInt(localStorage.getItem('navigation_volume') || '80')]);
  const [alertVolume, setAlertVolume] = useState(() => [parseInt(localStorage.getItem('alert_volume') || '75')]);
  const [soundEffects, setSoundEffects] = useState(() => localStorage.getItem('sound_effects') !== 'false');
  const [readStreetNames, setReadStreetNames] = useState(() => localStorage.getItem('read_street_names') !== 'false');
  const [announceTraffic, setAnnounceTraffic] = useState(() => localStorage.getItem('announce_traffic') !== 'false');
  
  // Accessibility Settings - using localStorage for persistence
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('high_contrast') === 'true');
  const [largeText, setLargeText] = useState(() => localStorage.getItem('large_text') === 'true');
  const [screenReader, setScreenReader] = useState(() => localStorage.getItem('screen_reader') === 'true');
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem('reduce_motion') === 'true');
  const [colorBlindMode, setColorBlindMode] = useState(() => localStorage.getItem('color_blind_mode') || 'none');
  const [textSize, setTextSize] = useState(() => [parseInt(localStorage.getItem('text_size') || '100')]);
  const [buttonSize, setButtonSize] = useState(() => [parseInt(localStorage.getItem('button_size') || '100')]);
  const [vibration, setVibration] = useState(() => localStorage.getItem('vibration') !== 'false');

  // Helper functions to persist settings to localStorage
  const updateVoiceSetting = (key: string, value: any) => {
    localStorage.setItem(key, value.toString());
    logger.debug('Voice setting updated', { key, value });
    // Show success toast for important settings
    if (key === 'voice_type' || key === 'voice_language') {
      toast.success('Voice setting updated');
    }
  };

  const updateAccessibilitySetting = (key: string, value: any) => {
    localStorage.setItem(key, value.toString());
    logger.debug('Accessibility setting updated', { key, value });
    // Show success toast for accessibility changes
    if (key === 'high_contrast' || key === 'large_text' || key === 'screen_reader') {
      toast.success('Accessibility setting updated');
    }
  };

  const settingSections = [
    {
      title: 'Account',
      items: [
        { id: 'profile', icon: User, label: 'Profile & Account', description: 'Manage your personal information' },
        { id: 'sync', icon: Download, label: 'Sync & Backup', description: 'Keep your data safe across devices' },
      ]
    },
    {
      title: 'Navigation',
      items: [
        { id: 'nav-prefs', icon: Navigation, label: 'Navigation Preferences', description: 'Default transport mode, voice settings' },
        { id: 'route-options', icon: Route, label: 'Route Options', description: 'Avoid tolls, highways, and more' },
        { id: 'voice', icon: Volume2, label: 'Voice & Audio', description: 'Voice guidance and audio alerts', onClick: () => setCurrentView('voice') },
        { id: 'offline-maps', icon: Download, label: 'Offline Maps', description: 'Download maps for offline use', onClick: onNavigateToOfflineMaps },
      ]
    },
    {
      title: 'Display',
      items: [
        { id: 'appearance', icon: Moon, label: 'Appearance', description: 'Dark mode and map styles' },
        { id: 'accessibility', icon: Accessibility, label: 'Accessibility', description: 'Screen reader, high contrast, text size', onClick: () => setCurrentView('accessibility') },
      ]
    },
    {
      title: 'Privacy & Data',
      items: [
        { id: 'privacy', icon: Shield, label: 'Privacy Settings', description: 'Location history and data usage' },
        { id: 'push-settings', icon: Bell, label: 'Push Notifications', description: 'Configure app notifications and alerts', onClick: onNavigateToPushSettings },
      ]
    },
    {
      title: 'Device Integration',
      items: [
        { id: 'device-test', icon: Settings, label: 'Device Integration Test', description: 'Test device sensors and APIs', onClick: onNavigateToDeviceTest },
        { id: 'crash-reports', icon: Shield, label: 'Crash Reports', description: 'View app error logs and diagnostics', onClick: onNavigateToCrashReports },
      ]
    },
    {
      title: 'Integrations',
      items: [
        { id: 'connected', icon: Settings, label: 'Connected Services', description: 'Manage app integrations', onClick: onNavigateToIntegrations },
        { id: 'experiments', icon: Settings, label: 'Experiment Management', description: 'Feature flags and A/B testing', onClick: onNavigateToDeveloper },
        { id: 'ors-config', icon: Settings, label: 'OpenRouteService API', description: 'Configure live navigation APIs', onClick: onNavigateToORSConfig },
        { id: 'developer', icon: Settings, label: 'Developer Tools', description: 'Debugging and diagnostics', onClick: onNavigateToDeveloper },
      ]
    },
    {
      title: 'Business',
      items: [
        { id: 'fleet', icon: Settings, label: 'Fleet Management', description: 'Manage vehicle fleets', onClick: onNavigateToFleet },
        { id: 'api', icon: Settings, label: 'API Documentation', description: 'Developer resources', onClick: onNavigateToAPIDocs },
      ]
    }
  ];

  const quickSettings = [
    { id: 'voice', label: 'Voice Guidance', value: voiceGuidance, onChange: (value: boolean) => {
      updatePreference('voiceGuidance', value);
      logger.debug('Voice guidance preference updated', { value });
      toast.success(`Voice guidance ${value ? 'enabled' : 'disabled'}`);
    }},
    { id: 'notifications', label: 'Push Notifications', value: notifications, onChange: (value: boolean) => {
      updatePreference('socialNotifications', value);
      logger.debug('Notifications preference updated', { value });
    }},
    { id: 'tolls', label: 'Avoid Tolls', value: avoidTolls, onChange: (value: boolean) => {
      updatePreference('avoidTolls', value);
      logger.debug('Avoid tolls preference updated', { value });
    }},
    { id: 'highways', label: 'Avoid Highways', value: avoidHighways, onChange: (value: boolean) => {
      updatePreference('avoidHighways', value);
      logger.debug('Avoid highways preference updated', { value });
    }},
  ];

  if (currentView === 'voice') {
    return (
      <div className="h-full bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentView('main')}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="font-medium text-gray-900 text-base sm:text-lg truncate">Voice & Audio</h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Configure voice guidance and sounds</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-y hide-scrollbar scroll-smooth">
          {/* Voice Selection */}
          <Card className="m-3 sm:m-4 p-3 sm:p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Voice Selection
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Voice Type</label>
                <Select value={voiceType} onValueChange={(value) => {
                  setVoiceType(value);
                  updateVoiceSetting('voice_type', value);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female Voice</SelectItem>
                    <SelectItem value="male">Male Voice</SelectItem>
                    <SelectItem value="neutral">Neutral Voice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                <Select value={voiceLanguage} onValueChange={(value) => {
                  setVoiceLanguage(value);
                  updateVoiceSetting('voice_language', value);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-UK">English (UK)</SelectItem>
                    <SelectItem value="es-ES">Spanish</SelectItem>
                    <SelectItem value="fr-FR">French</SelectItem>
                    <SelectItem value="de-DE">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Voice Speed</label>
                <div className="px-3">
                  <Slider
                    value={voiceSpeed}
                    onValueChange={(value) => {
                      setVoiceSpeed(value);
                      updateVoiceSetting('voice_speed', value[0]);
                    }}
                    max={2.0}
                    min={0.5}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Slow</span>
                    <span>{voiceSpeed[0]}x</span>
                    <span>Fast</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="w-full">
                <Speaker className="w-4 h-4 mr-2" />
                Test Voice
              </Button>
            </div>
          </Card>

          {/* Audio Levels */}
          <Card className="m-4 p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Audio Levels
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Master Volume</label>
                <div className="px-3">
                  <Slider
                    value={masterVolume}
                    onValueChange={(value) => {
                      setMasterVolume(value);
                      updateVoiceSetting('master_volume', value[0]);
                    }}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <VolumeX className="w-3 h-3" />
                    <span>{masterVolume[0]}%</span>
                    <Volume2 className="w-3 h-3" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Navigation Voice</label>
                <div className="px-3">
                  <Slider
                    value={navigationVolume}
                    onValueChange={(value) => {
                      setNavigationVolume(value);
                      updateVoiceSetting('navigation_volume', value[0]);
                    }}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <div className="text-center text-xs text-gray-500 mt-1">{navigationVolume[0]}%</div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alert Sounds</label>
                <div className="px-3">
                  <Slider
                    value={alertVolume}
                    onValueChange={(value) => {
                      setAlertVolume(value);
                      updateVoiceSetting('alert_volume', value[0]);
                    }}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <div className="text-center text-xs text-gray-500 mt-1">{alertVolume[0]}%</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Audio Options */}
          <Card className="m-4 p-4">
            <h3 className="font-medium text-gray-900 mb-4">Audio Options</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Sound Effects</span>
                  <p className="text-sm text-gray-500">Button clicks and UI sounds</p>
                </div>
                <Switch checked={soundEffects} onCheckedChange={(value) => {
                  setSoundEffects(value);
                  updateVoiceSetting('sound_effects', value);
                }} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Read Street Names</span>
                  <p className="text-sm text-gray-500">Announce street names during navigation</p>
                </div>
                <Switch checked={readStreetNames} onCheckedChange={setReadStreetNames} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Traffic Announcements</span>
                  <p className="text-sm text-gray-500">Audio alerts for traffic conditions</p>
                </div>
                <Switch checked={announceTraffic} onCheckedChange={setAnnounceTraffic} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (currentView === 'accessibility') {
    return (
      <div className="h-full bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentView('main')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="font-medium text-gray-900">Accessibility</h2>
              <p className="text-sm text-gray-500">Make the app easier to use</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-y hide-scrollbar scroll-smooth">
          {/* Visual Accessibility */}
          <Card className="m-4 p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Visual Accessibility
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">High Contrast Mode</span>
                  <p className="text-sm text-gray-500">Increase contrast for better visibility</p>
                </div>
                <Switch checked={highContrast} onCheckedChange={(value) => {
                  setHighContrast(value);
                  updateAccessibilitySetting('high_contrast', value);
                }} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Large Text</span>
                  <p className="text-sm text-gray-500">Use larger fonts throughout the app</p>
                </div>
                <Switch checked={largeText} onCheckedChange={setLargeText} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Reduce Motion</span>
                  <p className="text-sm text-gray-500">Minimize animations and transitions</p>
                </div>
                <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color Blind Support</label>
                <Select value={colorBlindMode} onValueChange={setColorBlindMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="protanopia">Protanopia (Red-blind)</SelectItem>
                    <SelectItem value="deuteranopia">Deuteranopia (Green-blind)</SelectItem>
                    <SelectItem value="tritanopia">Tritanopia (Blue-blind)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Size & Scale */}
          <Card className="m-4 p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <ZoomIn className="w-5 h-5" />
              Size & Scale
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Text Size</label>
                <div className="px-3">
                  <Slider
                    value={textSize}
                    onValueChange={(value) => {
                      setTextSize(value);
                      updateAccessibilitySetting('text_size', value[0]);
                    }}
                    max={150}
                    min={75}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Small</span>
                    <span>{textSize[0]}%</span>
                    <span>Large</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Button Size</label>
                <div className="px-3">
                  <Slider
                    value={buttonSize}
                    onValueChange={setButtonSize}
                    max={150}
                    min={75}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Small</span>
                    <span>{buttonSize[0]}%</span>
                    <span>Large</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Interaction */}
          <Card className="m-4 p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Type className="w-5 h-5" />
              Interaction
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Screen Reader Support</span>
                  <p className="text-sm text-gray-500">Enhanced compatibility with screen readers</p>
                </div>
                <Switch checked={screenReader} onCheckedChange={setScreenReader} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Haptic Feedback</span>
                  <p className="text-sm text-gray-500">Vibration for button presses and alerts</p>
                </div>
                <Switch checked={vibration} onCheckedChange={setVibration} />
              </div>
            </div>
          </Card>

          {/* Accessibility Status */}
          <Card className="m-4 p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Accessibility className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900">Accessibility Features Active</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {highContrast && <Badge variant="secondary">High Contrast</Badge>}
                  {largeText && <Badge variant="secondary">Large Text</Badge>}
                  {screenReader && <Badge variant="secondary">Screen Reader</Badge>}
                  {reduceMotion && <Badge variant="secondary">Reduced Motion</Badge>}
                  {colorBlindMode !== 'none' && <Badge variant="secondary">Color Blind Support</Badge>}
                  {(!highContrast && !largeText && !screenReader && !reduceMotion && colorBlindMode === 'none') && (
                    <span className="text-sm text-blue-700">None active</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-200">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="font-medium text-gray-900 text-base sm:text-lg truncate">Settings</h2>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Customize your experience</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y hide-scrollbar scroll-smooth">
        {/* Profile Section */}
        <Card className="m-3 sm:m-4 p-3 sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-medium flex-shrink-0">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 text-sm sm:text-base truncate">John Doe</h3>
              <p className="text-xs sm:text-sm text-gray-500 truncate">john.doe@example.com</p>
              <p className="text-xs text-gray-400 mt-1">Member since Jan 2024</p>
            </div>
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
          </div>
        </Card>

        {/* Quick Settings */}
        <Card className="m-3 sm:m-4 p-3 sm:p-4">
          <h3 className="font-medium text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Quick Settings</h3>
          <div className="space-y-3 sm:space-y-4">
            {quickSettings.map((setting) => (
              <div key={setting.id} className="flex items-center justify-between">
                <span className="text-gray-700 text-sm sm:text-base">{setting.label}</span>
                <Switch
                  checked={setting.value}
                  onCheckedChange={setting.onChange}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Settings Sections */}
        {settingSections.map((section) => (
          <div key={section.title} className="mb-4 sm:mb-6">
            <div className="px-3 sm:px-4 py-1.5 sm:py-2">
              <h3 className="font-medium text-gray-500 uppercase text-xs sm:text-sm tracking-wide">
                {section.title}
              </h3>
            </div>
            <Card className="mx-3 sm:mx-4">
              {section.items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.id}>
                    <button 
                      className="w-full p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:bg-gray-50 transition-colors touch-manipulation"
                      onClick={item.onClick || (() => {})}
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{item.label}</div>
                        <div className="text-xs sm:text-sm text-gray-500 line-clamp-2">{item.description}</div>
                      </div>
                      {item.id === 'appearance' ? <ThemeToggle /> : <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />}
                    </button>
                    {index < section.items.length - 1 && (
                      <Separator className="ml-14 sm:ml-18" />
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        ))}

        {/* Help & Support */}
        <Card className="m-3 sm:m-4 p-3 sm:p-4">
          <h3 className="font-medium text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Help & Support</h3>
          <div className="space-y-2 sm:space-y-3">
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors touch-manipulation">
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
              <span className="text-gray-700 text-sm sm:text-base">Help Center</span>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 ml-auto flex-shrink-0" />
            </button>
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors touch-manipulation">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
              <span className="text-gray-700 text-sm sm:text-base">Report a Problem</span>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 ml-auto flex-shrink-0" />
            </button>
          </div>
        </Card>

        {/* App Info */}
        <div className="p-3 sm:p-4 text-center text-xs sm:text-sm text-gray-500">
          <p>PathFinder Pro v2.1.0</p>
          <p>© 2024 PathFinder Technologies</p>
        </div>
      </div>
    </div>
  );
}
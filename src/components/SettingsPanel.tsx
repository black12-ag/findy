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

interface SettingsPanelProps {
  onBack: () => void;
  onNavigateToOffline?: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToFleet?: () => void;
  onNavigateToAPIDocs?: () => void;
}

export function SettingsPanel({ onBack, onNavigateToOffline, onNavigateToIntegrations, onNavigateToFleet, onNavigateToAPIDocs }: SettingsPanelProps) {
  const [darkMode, setDarkMode] = useState(false);
  const [voiceGuidance, setVoiceGuidance] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [currentView, setCurrentView] = useState<'main' | 'voice' | 'accessibility'>('main');
  
  // Voice & Audio Settings
  const [voiceType, setVoiceType] = useState('female');
  const [voiceLanguage, setVoiceLanguage] = useState('en-US');
  const [voiceSpeed, setVoiceSpeed] = useState([1.0]);
  const [masterVolume, setMasterVolume] = useState([70]);
  const [navigationVolume, setNavigationVolume] = useState([80]);
  const [alertVolume, setAlertVolume] = useState([75]);
  const [soundEffects, setSoundEffects] = useState(true);
  const [readStreetNames, setReadStreetNames] = useState(true);
  const [announceTraffic, setAnnounceTraffic] = useState(true);
  
  // Accessibility Settings
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [colorBlindMode, setColorBlindMode] = useState('none');
  const [textSize, setTextSize] = useState([100]);
  const [buttonSize, setButtonSize] = useState([100]);
  const [vibration, setVibration] = useState(true);

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
        { id: 'notifications', icon: Bell, label: 'Notifications', description: 'Traffic alerts and trip updates' },
        { id: 'offline', icon: Download, label: 'Offline Maps', description: 'Download maps for offline use', onClick: onNavigateToOffline },
      ]
    },
    {
      title: 'Integrations',
      items: [
        { id: 'connected', icon: Settings, label: 'Connected Services', description: 'Manage app integrations', onClick: onNavigateToIntegrations },
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
    { id: 'dark-mode', label: 'Dark Mode', value: darkMode, onChange: setDarkMode },
    { id: 'voice', label: 'Voice Guidance', value: voiceGuidance, onChange: setVoiceGuidance },
    { id: 'notifications', label: 'Push Notifications', value: notifications, onChange: setNotifications },
    { id: 'tolls', label: 'Avoid Tolls', value: avoidTolls, onChange: setAvoidTolls },
    { id: 'highways', label: 'Avoid Highways', value: avoidHighways, onChange: setAvoidHighways },
  ];

  if (currentView === 'voice') {
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
              <h2 className="font-medium text-gray-900">Voice & Audio</h2>
              <p className="text-sm text-gray-500">Configure voice guidance and sounds</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-y hide-scrollbar scroll-smooth">
          {/* Voice Selection */}
          <Card className="m-4 p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Voice Selection
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Voice Type</label>
                <Select value={voiceType} onValueChange={setVoiceType}>
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
                <Select value={voiceLanguage} onValueChange={setVoiceLanguage}>
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
                    onValueChange={setVoiceSpeed}
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
                    onValueChange={setMasterVolume}
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
                    onValueChange={setNavigationVolume}
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
                    onValueChange={setAlertVolume}
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
                <Switch checked={soundEffects} onCheckedChange={setSoundEffects} />
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
                <Switch checked={highContrast} onCheckedChange={setHighContrast} />
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
                    onValueChange={setTextSize}
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
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-medium text-gray-900">Settings</h2>
            <p className="text-sm text-gray-500">Customize your experience</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y hide-scrollbar scroll-smooth">
        {/* Profile Section */}
        <Card className="m-4 p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xl font-medium">
              JD
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">John Doe</h3>
              <p className="text-sm text-gray-500">john.doe@example.com</p>
              <p className="text-xs text-gray-400 mt-1">Member since Jan 2024</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Card>

        {/* Quick Settings */}
        <Card className="m-4 p-4">
          <h3 className="font-medium text-gray-900 mb-4">Quick Settings</h3>
          <div className="space-y-4">
            {quickSettings.map((setting) => (
              <div key={setting.id} className="flex items-center justify-between">
                <span className="text-gray-700">{setting.label}</span>
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
          <div key={section.title} className="mb-6">
            <div className="px-4 py-2">
              <h3 className="font-medium text-gray-500 uppercase text-sm tracking-wide">
                {section.title}
              </h3>
            </div>
            <Card className="mx-4">
              {section.items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.id}>
                    <button 
                      className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                      onClick={item.onClick || (() => {})}
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <Icon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">{item.label}</div>
                        <div className="text-sm text-gray-500">{item.description}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                    {index < section.items.length - 1 && (
                      <Separator className="ml-18" />
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        ))}

        {/* Help & Support */}
        <Card className="m-4 p-4">
          <h3 className="font-medium text-gray-900 mb-4">Help & Support</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
              <HelpCircle className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700">Help Center</span>
              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
            </button>
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
              <Settings className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700">Report a Problem</span>
              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
            </button>
          </div>
        </Card>

        {/* App Info */}
        <div className="p-4 text-center text-sm text-gray-500">
          <p>PathFinder Pro v2.1.0</p>
          <p>© 2024 PathFinder Technologies</p>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { 
  MapPin, 
  Navigation, 
  Shield, 
  Mic, 
  Bell, 
  Home, 
  Briefcase,
  ChevronRight,
  Check,
  ArrowRight,
  Car,
  UserRound,
  Bus,
  Bike,
  Volume2,
  Globe
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Switch } from './ui/switch';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth';

type OnboardingStep = 'welcome' | 'permissions' | 'personalization' | 'tutorial';
type TransportMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { user, updateProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [permissions, setPermissions] = useState({
    location: false,
    notifications: false,
    microphone: false
  });
  
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [preferredModes, setPreferredModes] = useState<TransportMode[]>(['DRIVING']);
  const [accessibilityPrefs, setAccessibilityPrefs] = useState({
    voiceGuidance: true,
    highContrast: false,
    largeText: false
  });
  const [language, setLanguage] = useState('English');

  // Request actual browser permissions
  const requestPermissions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Request location permission
      if (permissions.location && navigator.geolocation) {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
          });
        });
      }

      // Request notification permission
      if (permissions.notifications && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'denied') {
          throw new Error('Notification permission denied');
        }
      }

      // Request microphone permission for voice commands
      if (permissions.microphone && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately after getting permission
        stream.getTracks().forEach(track => track.stop());
      }

    } catch (err: any) {
      setError(err.message || 'Failed to get permissions');
    } finally {
      setIsLoading(false);
    }
  };

  // Save user preferences to backend
  const savePreferences = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Update user preferences
      await authService.updatePreferences({
        defaultTravelMode: preferredModes[0] || 'DRIVING',
        language: language === 'English' ? 'en' : 'en',
        theme: 'SYSTEM',
        notifications: {
          email: true,
          push: permissions.notifications,
          sms: false,
          marketing: false,
        },
        privacy: {
          shareLocation: permissions.location,
          showOnlineStatus: true,
          allowFriendRequests: true,
          shareTrips: false,
        },
        mapSettings: {
          showTraffic: true,
          showSatellite: false,
          autoRecenter: true,
          voiceNavigation: accessibilityPrefs.voiceGuidance,
        },
      });

      // Update profile with addresses if provided
      if (homeAddress || workAddress) {
        await updateProfile({
          bio: JSON.stringify({
            homeAddress: homeAddress || null,
            workAddress: workAddress || null,
            preferredModes,
            accessibilityPrefs,
          }),
        });
      }

    } catch (err: any) {
      setError(err.message || 'Failed to save preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionRequest = async (type: keyof typeof permissions) => {
    const newPermissions = { ...permissions, [type]: !permissions[type] };
    setPermissions(newPermissions);

    // If turning on location permission, request it immediately
    if (type === 'location' && !permissions.location && navigator.geolocation) {
      try {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
          });
        });
      } catch (error) {
        console.warn('Failed to get location permission:', error);
      }
    }
  };

  const toggleTransportMode = (mode: TransportMode) => {
    setPreferredModes(prev => 
      prev.includes(mode) 
        ? prev.filter(m => m !== mode)
        : [...prev, mode]
    );
  };

  const nextStep = async () => {
    setError(null);

    switch (currentStep) {
      case 'welcome':
        setCurrentStep('permissions');
        break;
        
      case 'permissions':
        // Request browser permissions before proceeding
        if (permissions.location || permissions.notifications || permissions.microphone) {
          await requestPermissions();
          if (error) return; // Don't proceed if permission request failed
        }
        setCurrentStep('personalization');
        break;
        
      case 'personalization':
        // Save preferences before proceeding
        await savePreferences();
        if (error) return; // Don't proceed if save failed
        setCurrentStep('tutorial');
        break;
        
      case 'tutorial':
        // Mark onboarding as complete
        localStorage.setItem('pathfinder_onboarding_complete', 'true');
        localStorage.setItem('pathfinder_onboarding_data', JSON.stringify({
          permissions,
          homeAddress,
          workAddress,
          preferredModes,
          accessibilityPrefs,
          completedAt: new Date().toISOString(),
        }));
        onComplete();
        break;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'permissions':
        return permissions.location; // Location is required
      case 'personalization':
        return preferredModes.length > 0 && !isLoading;
      case 'tutorial':
        return true;
      default:
        return false;
    }
  };

  const renderWelcomeScreen = () => (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-8"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl flex items-center justify-center mb-6 mx-auto">
          <Navigation className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to PathFinder Pro</h1>
        <p className="text-lg text-gray-600 mb-8 max-w-sm">
          Your intelligent navigation companion with real-time guidance and smart recommendations
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="space-y-4 mb-8"
      >
        <div className="flex items-center gap-3 text-gray-700">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-green-600" />
          </div>
          <span>Smart route optimization</span>
        </div>
        <div className="flex items-center gap-3 text-gray-700">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-green-600" />
          </div>
          <span>Real-time traffic updates</span>
        </div>
        <div className="flex items-center gap-3 text-gray-700">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-green-600" />
          </div>
          <span>Offline maps available</span>
        </div>
      </motion.div>

      <Button 
        className="w-full max-w-sm" 
        style={{ backgroundColor: '#5B4FE5' }}
        onClick={nextStep}
      >
        Get Started
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );

  const renderPermissionItem = (type: keyof typeof permissions, title: string, description: string, Icon: React.ElementType, color: string) => {
    const isAllowed = permissions[type];

    return (
      <div className=\"flex items-center gap-4\">
        <div className={`w-12 h-12 bg-${color}-100 rounded-full flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
        <div className=\"flex-1\">
          <h3 className=\"font-medium text-gray-900 mb-1\">{title}</h3>
          <p className=\"text-sm text-gray-600\">{description}</p>
        </div>
        <Switch
          checked={isAllowed}
          onCheckedChange={() => handlePermissionRequest(type)}
          aria-label={`${title} permission`}
        />
      </div>
    );
  };

  const renderPermissionsScreen = () => (
    <div className="flex flex-col h-full px-6 bg-gray-50 items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Allow Permissions</h2>
          <p className="text-gray-600">We need these permissions to provide the best navigation experience</p>
        </div>

        <Card className="p-6 shadow-lg">
          <div className="space-y-6">
            {renderPermissionItem('location', 'Location Access', 'Required for navigation and finding nearby places', MapPin, 'blue')}
            {renderPermissionItem('notifications', 'Notifications', 'Get traffic alerts and navigation updates', Bell, 'amber')}
            {renderPermissionItem('microphone', 'Microphone', 'Enable voice commands and search', Mic, 'purple')}
          </div>
          
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <label htmlFor="all-permissions" className="flex items-center gap-3 cursor-pointer">
              <Switch 
                id="all-permissions" 
                checked={permissions.location && permissions.notifications && permissions.microphone}
                onCheckedChange={(checked) => {
                  setPermissions({ location: checked, notifications: checked, microphone: checked });
                }}
              />
              <span className="font-medium text-gray-800">Allow All</span>
            </label>
            <p className="text-sm text-gray-500">You can change this later</p>
          </div>
        </Card>

        <div className="mt-8">
          <Button 
            className="w-full py-3 text-lg" 
            style={{ backgroundColor: '#5B4FE5' }}
            onClick={nextStep}
            disabled={!canProceed()}
          >
            Continue
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderPersonalizationScreen = () => (
    <div className=\"flex flex-col h-full px-6\">\n      <div className=\"pt-8 pb-6\">\n        <h2 className=\"text-2xl font-bold text-gray-900 mb-2\">Personalize Your Experience</h2>\n        <p className=\"text-gray-600\">Set up your preferences for better recommendations</p>\n      </div>\n\n      <div className=\"flex-1 space-y-6 scroll-y hide-scrollbar scroll-smooth\">\n        {/* Address Setup */}\n        <div>\n          <h3 className=\"font-medium text-gray-900 mb-3\">Quick Access Locations</h3>\n          <div className=\"space-y-3\">\n            <div>\n              <label className=\"block text-sm text-gray-600 mb-1\">Home Address</label>\n              <div className=\"relative\">\n                <Home className=\"absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400\" />\n                <Input
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                  placeholder=\"Enter your home address\"
                  className=\"pl-10\"
                />
              </div>
            </div>
            <div>
              <label className=\"block text-sm text-gray-600 mb-1\">Work Address</label>
              <div className=\"relative\">\n                <Briefcase className=\"absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400\" />\n                <Input
                  value={workAddress}
                  onChange={(e) => setWorkAddress(e.target.value)}
                  placeholder=\"Enter your work address\"
                  className=\"pl-10\"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Transport Modes */}\n        <div>\n          <h3 className=\"font-medium text-gray-900 mb-3\">Preferred Transport Modes</h3>\n          <div className=\"grid grid-cols-2 gap-3\">\n            {[
              { id: 'driving', icon: Car, label: 'Driving', color: '#3B82F6' },
              { id: 'walking', icon: UserRound, label: 'Walking', color: '#10B981' },
              { id: 'transit', icon: Bus, label: 'Transit', color: '#F59E0B' },
              { id: 'cycling', icon: Bike, label: 'Cycling', color: '#8B5CF6' }
            ].map((mode) => {
              const Icon = mode.icon;
              const isSelected = preferredModes.includes(mode.id as TransportMode);
              return (
                <Card
                  key={mode.id}
                  className={`p-3 cursor-pointer transition-all ${
                    isSelected ? 'ring-2' : 'hover:shadow-md'
                  }`}
                  style={isSelected ? { 
                    backgroundColor: `${mode.color}08`
                  } : undefined}
                  onClick={() => toggleTransportMode(mode.id as TransportMode)}
                >
                  <div className=\"flex items-center gap-3\">
                    <div 
                      className=\"w-10 h-10 rounded-full flex items-center justify-center text-white\"
                      style={{ backgroundColor: mode.color }}
                    >
                      <Icon className=\"w-5 h-5\" />
                    </div>
                    <span className=\"font-medium text-gray-900\">{mode.label}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Accessibility */}\n        <div>\n          <h3 className=\"font-medium text-gray-900 mb-3\">Accessibility Preferences</h3>\n          <div className=\"space-y-4\">\n            <div className=\"flex items-center justify-between\">
              <div className=\"flex items-center gap-3\">
                <Volume2 className=\"w-5 h-5 text-gray-600\" />
                <div>
                  <span className=\"text-gray-900\">Voice Guidance</span>
                  <p className=\"text-sm text-gray-500\">Turn-by-turn voice instructions</p>
                </div>
              </div>
              <Switch
                checked={accessibilityPrefs.voiceGuidance}
                onCheckedChange={(checked) => 
                  setAccessibilityPrefs(prev => ({ ...prev, voiceGuidance: checked }))
                }
              />
            </div>
            <div className=\"flex items-center justify-between\">
              <div className=\"flex items-center gap-3\">
                <Shield className=\"w-5 h-5 text-gray-600\" />
                <div>
                  <span className=\"text-gray-900\">High Contrast Mode</span>
                  <p className=\"text-sm text-gray-500\">Better visibility</p>
                </div>
              </div>
              <Switch
                checked={accessibilityPrefs.highContrast}
                onCheckedChange={(checked) => 
                  setAccessibilityPrefs(prev => ({ ...prev, highContrast: checked }))
                }
              />
            </div>
          </div>
        </div>

        {/* Language */}\n        <div>\n          <h3 className=\"font-medium text-gray-900 mb-3\">Language</h3>\n          <Card className=\"p-3\">
            <div className=\"flex items-center gap-3\">
              <Globe className=\"w-5 h-5 text-gray-600\" />
              <span className=\"text-gray-900\">{language}</span>
              <ChevronRight className=\"w-4 h-4 text-gray-400 ml-auto\" />
            </div>
          </Card>
        </div>
      </div>

      <div className=\"pb-6\">
        <Button 
          className=\"w-full\" 
          style={{ backgroundColor: '#5B4FE5' }}
          onClick={nextStep}
          disabled={!canProceed()}
        >
          Continue
          <ChevronRight className=\"w-4 h-4 ml-2\" />
        </Button>
      </div>
    </div>
  );

  const renderTutorialScreen = () => (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-6 mx-auto">
          <Navigation className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">You're All Set!</h2>
        <p className="text-gray-600 mb-8 max-w-sm">
          PathFinder Pro is ready to guide you. Tap the search bar to find your destination or explore nearby places.
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="space-y-4 mb-8 w-full max-w-sm"
      >
        <Card className="p-4 text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Quick Tip</p>
              <p className="text-sm text-gray-600">Say "Hey PathFinder" for voice search</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Navigation className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Pro Tip</p>
              <p className="text-sm text-gray-600">Save frequent destinations for faster access</p>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="space-y-3 w-full max-w-sm">
        <Button 
          className="w-full" 
          style={{ backgroundColor: '#5B4FE5' }}
          onClick={nextStep}
        >
          Start Navigating
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button variant="ghost" className="w-full text-gray-600">
          Skip Tutorial
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-white">
      {currentStep === 'welcome' && renderWelcomeScreen()}
      {currentStep === 'permissions' && renderPermissionsScreen()}
      {currentStep === 'personalization' && renderPersonalizationScreen()}
      {currentStep === 'tutorial' && renderTutorialScreen()}
    </div>
  );
}

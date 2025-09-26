import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Phone, 
  Navigation, 
  Eye, 
  Coffee,
  Activity,
  Users,
  MapPin,
  ChevronRight,
  ArrowLeft,
  Settings,
  Bell
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';

interface SafetyCenterProps {
  onBack: () => void;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

interface SafetySettings {
  fatigueAlertsEnabled: boolean;
  crashDetectionEnabled: boolean;
  autoCall911: boolean;
  safeRoutesEnabled: boolean;
  shareLocationWithContacts: boolean;
}

export function SafetyCenter({ onBack }: SafetyCenterProps) {
  const [settings, setSettings] = useState<SafetySettings>({
    fatigueAlertsEnabled: true,
    crashDetectionEnabled: true,
    autoCall911: false,
    safeRoutesEnabled: true,
    shareLocationWithContacts: false,
  });

  const [drivingTime, setDrivingTime] = useState(0); // minutes
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { id: '1', name: 'Mom', phone: '555-0123', relationship: 'Mother' },
    { id: '2', name: 'Sarah', phone: '555-0124', relationship: 'Spouse' },
  ]);

  const [crashDetected, setCrashDetected] = useState(false);
  const [emergencyCountdown, setEmergencyCountdown] = useState(15);

  // Simulate driving time tracker
  useEffect(() => {
    const interval = setInterval(() => {
      setDrivingTime(prev => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Emergency countdown when crash detected
  useEffect(() => {
    if (crashDetected && emergencyCountdown > 0) {
      const timer = setTimeout(() => {
        setEmergencyCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (crashDetected && emergencyCountdown === 0) {
      callEmergency();
    }
  }, [crashDetected, emergencyCountdown]);

  const callEmergency = () => {
    console.log('Calling emergency services...');
    // Implement actual emergency call logic
  };

  const cancelEmergencyCall = () => {
    setCrashDetected(false);
    setEmergencyCountdown(15);
  };

  const testCrashDetection = () => {
    setCrashDetected(true);
  };

  const fatigueProgress = Math.min((drivingTime / 120) * 100, 100); // 2 hours = 100%

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-medium text-gray-900">Safety Center</h2>
            <p className="text-sm text-gray-500">Your protection on the road</p>
          </div>
          <Shield className="w-6 h-6 text-blue-500" />
        </div>
      </div>

      {/* Emergency Alert (if crash detected) */}
      {crashDetected && (
        <Alert className="m-4 border-red-500 bg-red-50">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <AlertTitle className="text-red-900">Crash Detected!</AlertTitle>
          <AlertDescription>
            <div className="space-y-3 mt-2">
              <p className="text-red-700">
                Emergency services will be contacted in {emergencyCountdown} seconds
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={cancelEmergencyCall}
                  className="flex-1"
                >
                  I'm OK - Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={callEmergency}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Call Now
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 overflow-y-auto scroll-y hide-scrollbar scroll-smooth">
        {/* Driver Fatigue Monitor */}
        <Card className="m-4 p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Coffee className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Driver Fatigue Monitor</h3>
                <p className="text-sm text-gray-500">Driving for {drivingTime} minutes</p>
              </div>
            </div>
            <Switch 
              checked={settings.fatigueAlertsEnabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, fatigueAlertsEnabled: checked }))
              }
            />
          </div>
          
          <Progress value={fatigueProgress} className="mb-3" />
          
          {fatigueProgress >= 75 && (
            <Alert className="bg-yellow-50 border-yellow-300">
              <Eye className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                You've been driving for a while. Consider taking a break soon.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-gray-600">Next recommended break</span>
            <span className="font-medium text-gray-900">
              {Math.max(120 - drivingTime, 0)} min
            </span>
          </div>
        </Card>

        {/* Crash Detection */}
        <Card className="m-4 p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Crash Detection</h3>
                <p className="text-sm text-gray-500">Automatic emergency response</p>
              </div>
            </div>
            <Switch 
              checked={settings.crashDetectionEnabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, crashDetectionEnabled: checked }))
              }
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Auto-call 911</span>
              <Switch 
                checked={settings.autoCall911}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, autoCall911: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Share location with contacts</span>
              <Switch 
                checked={settings.shareLocationWithContacts}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, shareLocationWithContacts: checked }))
                }
              />
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-4"
            onClick={testCrashDetection}
          >
            Test Crash Detection
          </Button>
        </Card>

        {/* Emergency Contacts */}
        <Card className="m-4 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-medium text-gray-900">Emergency Contacts</h3>
            </div>
            <Badge variant="secondary">{emergencyContacts.length}</Badge>
          </div>
          
          <div className="space-y-2">
            {emergencyContacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{contact.name}</p>
                  <p className="text-sm text-gray-500">{contact.relationship} • {contact.phone}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            ))}
            
            <Button variant="outline" size="sm" className="w-full">
              Add Emergency Contact
            </Button>
          </div>
        </Card>

        {/* Safe Routes */}
        <Card className="m-4 p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Navigation className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Safe Routes</h3>
                <p className="text-sm text-gray-500">Prioritize well-lit, populated paths</p>
              </div>
            </div>
            <Switch 
              checked={settings.safeRoutesEnabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, safeRoutesEnabled: checked }))
              }
            />
          </div>
          
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-2">
              <input type="checkbox" className="rounded" defaultChecked />
              <span className="text-sm text-gray-700">Avoid high-crime areas</span>
            </label>
            <label className="flex items-center gap-3 p-2">
              <input type="checkbox" className="rounded" defaultChecked />
              <span className="text-sm text-gray-700">Prefer well-lit streets</span>
            </label>
            <label className="flex items-center gap-3 p-2">
              <input type="checkbox" className="rounded" />
              <span className="text-sm text-gray-700">Women's safety mode</span>
            </label>
          </div>
        </Card>

        {/* Quick Emergency Actions */}
        <Card className="m-4 p-4">
          <h3 className="font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="destructive" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Call 911
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Share Location
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Nearest Hospital
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Alert Contacts
            </Button>
          </div>
        </Card>

        {/* Safety Tips */}
        <Card className="m-4 p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Safety Tip</h4>
              <p className="text-sm text-blue-800">
                Always share your trip with a trusted contact when traveling alone at night. 
                Your safety is our priority.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
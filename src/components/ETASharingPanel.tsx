import React, { useState } from 'react';
import { mockETAData } from '../utils/mockData';
import { 
  X, 
  Share, 
  Users, 
  MessageCircle, 
  Mail, 
  Copy,
  Check,
  Clock,
  MapPin,
  Navigation,
  AlertCircle,
  Settings
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Switch } from './ui/switch';
import { useAuth } from '../hooks/useAuth';
import { socialService } from '../services/socialService';
import socialServiceBackend from '../services/social';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { useLoading } from '../contexts/LoadingContext';

interface Route {
  id: string;
  from: { name: string; address: string };
  to: { name: string; address: string };
  distance: string;
  duration: string;
  mode: string;
  eta: string;
}

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar: string;
  isEmergencyContact?: boolean;
}

interface ETASharingPanelProps {
  route: Route;
  onClose: () => void;
}

export function ETASharingPanel({ route, onClose }: ETASharingPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const { startLoading, stopLoading } = useLoading();
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [etaInfo] = useState(mockETAData);
  const [customMessage, setCustomMessage] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch real friends/contacts when component mounts
  useEffect(() => {
    const fetchContacts = async () => {
      if (!isAuthenticated || !user) {
        // Fallback to mock contacts when not authenticated
        setContacts([
          { id: '1', name: 'Sarah Chen', phone: '+1 555-0123', avatar: 'SC', isEmergencyContact: true },
          { id: '2', name: 'Mike Rodriguez', phone: '+1 555-0124', avatar: 'MR' },
          { id: '3', name: 'Emily Watson', email: 'emily@example.com', avatar: 'EW' },
          { id: '4', name: 'David Kim', phone: '+1 555-0125', avatar: 'DK' },
          { id: '5', name: 'Lisa Park', email: 'lisa@example.com', avatar: 'LP', isEmergencyContact: true },
        ]);
        return;
      }
      
      setIsLoading(true);
      startLoading('Loading contacts...');
      try {
        const friends = await socialServiceBackend.getAcceptedFriends();
        const formattedContacts: Contact[] = friends.map((friend) => {
          const friendData = socialServiceBackend.formatFriend(friend, user.id);
          return {
            id: friendData.id,
            name: friendData.name,
            email: friendData.email,
            avatar: friendData.avatar || friendData.name.split(' ').map(n => n[0]).join(''),
            isEmergencyContact: false // This would come from user preferences in a real app
          };
        });
        setContacts(formattedContacts);
      } catch (error) {
        logger.error('Failed to fetch contacts:', error);
        // Use mock data as fallback
        setContacts([
          { id: '1', name: 'Sarah Chen', phone: '+1 555-0123', avatar: 'SC', isEmergencyContact: true },
          { id: '2', name: 'Mike Rodriguez', phone: '+1 555-0124', avatar: 'MR' },
        ]);
      } finally {
        setIsLoading(false);
        stopLoading();
      }
    };

    fetchContacts();
  }, [isAuthenticated, user]);

  const emergencyContacts = contacts.filter(c => c.isEmergencyContact);
  const regularContacts = contacts.filter(c => !c.isEmergencyContact);

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const generateShareMessage = () => {
    const baseMessage = `I'm heading to ${route.to.name}. Expected arrival: ${route.eta}. Track my progress: https://pathfinder.app/track/abc123`;
    return customMessage || baseMessage;
  };

  const copyShareLink = () => {
    const link = 'https://pathfinder.app/track/abc123';
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaText = async () => {
    if (!isAuthenticated || selectedContacts.length === 0) return;
    
    const message = generateShareMessage();
    const selectedContactsList = contacts.filter(c => selectedContacts.includes(c.id));
    
    startLoading('Sharing ETA via text...');
    try {
      // Use real Web Share API for ETA sharing
      await socialService.shareETA({
        destination: route.to.name,
        eta: route.eta,
        recipientIds: selectedContacts,
        message: message,
        includeTracking: true
      });
      
      logger.info('ETA shared successfully via text:', { message, contacts: selectedContactsList });
      toast.success('ETA shared via text successfully!');
    } catch (error) {
      logger.error('Failed to share ETA via text:', error);
      toast.error('Failed to share ETA via text. Please try again.');
    } finally {
      stopLoading();
    }
  };

  const shareViaEmail = async () => {
    if (!isAuthenticated || selectedContacts.length === 0) return;
    
    const message = generateShareMessage();
    const selectedContactsList = contacts.filter(c => selectedContacts.includes(c.id));
    
    startLoading('Sharing ETA via email...');
    try {
      // Use real Web Share API for ETA sharing via email
      await socialService.shareETA({
        destination: route.to.name,
        eta: route.eta,
        recipientIds: selectedContacts,
        message: message,
        includeTracking: true
      });
      
      logger.info('ETA shared successfully via email:', { message, contacts: selectedContactsList });
      toast.success('ETA shared via email successfully!');
    } catch (error) {
      logger.error('Failed to share ETA via email:', error);
      toast.error('Failed to share ETA via email. Please try again.');
    } finally {
      stopLoading();
    }
  };

  const shareToEmergencyContacts = () => {
    const emergencyIds = emergencyContacts.map(c => c.id);
    setSelectedContacts(emergencyIds);
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-medium text-gray-900">Share ETA</h2>
            <p className="text-sm text-gray-500">Let others know when you'll arrive</p>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Trip Summary */}
      <div className="flex-shrink-0 p-4 bg-blue-50 border-b border-blue-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
            <Navigation className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-blue-900">{route.to.name}</h3>
            <p className="text-sm text-blue-800 mb-2">{route.to.address}</p>
            <div className="flex items-center gap-4 text-sm text-blue-700">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>ETA: {route.eta}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{route.distance}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 scroll-y hide-scrollbar scroll-smooth">
        {/* Share Options */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-4">Share Options</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-900">Auto-update ETA</span>
                <p className="text-sm text-gray-500">Update contacts if arrival time changes</p>
              </div>
              <Switch
                checked={autoUpdate}
                onCheckedChange={setAutoUpdate}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-900">Share live location</span>
                <p className="text-sm text-gray-500">Let contacts track your progress</p>
              </div>
              <Switch
                checked={shareLocation}
                onCheckedChange={setShareLocation}
              />
            </div>
          </div>
        </div>

        {/* Emergency Contacts */}
        {emergencyContacts.length > 0 && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Emergency Contacts</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={shareToEmergencyContacts}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Select All
              </Button>
            </div>
            
            <div className="space-y-2">
              {emergencyContacts.map((contact) => (
                <Card
                  key={contact.id}
                  className={`p-3 cursor-pointer transition-all ${
                    selectedContacts.includes(contact.id)
                      ? 'ring-2 ring-red-500 bg-red-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleContact(contact.id)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{contact.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{contact.name}</span>
                        <Badge variant="outline" className="text-red-600 border-red-200">
                          Emergency
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {contact.phone || contact.email}
                      </p>
                    </div>
                    {selectedContacts.includes(contact.id) && (
                      <Check className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Regular Contacts */}
        <div className="p-4">
          <h3 className="font-medium text-gray-900 mb-4">Contacts</h3>
          <div className="space-y-2">
            {regularContacts.map((contact) => (
              <Card
                key={contact.id}
                className={`p-3 cursor-pointer transition-all ${
                  selectedContacts.includes(contact.id)
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleContact(contact.id)}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{contact.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{contact.name}</span>
                    <p className="text-sm text-gray-500">
                      {contact.phone || contact.email}
                    </p>
                  </div>
                  {selectedContacts.includes(contact.id) && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Custom Message */}
        <div className="p-4 border-t border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">Custom Message (Optional)</h3>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add a personal message..."
            className="w-full p-3 border border-gray-300 rounded-lg resize-none text-sm"
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave empty to use default message with ETA and tracking link
          </p>
        </div>

        {/* Share Link */}
        <div className="p-4 border-t border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">Share Link</h3>
          <div className="flex gap-2">
            <Input
              value="https://pathfinder.app/track/abc123"
              readOnly
              className="text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={copyShareLink}
              className={copied ? 'text-green-600' : ''}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={shareViaEmail}
            disabled={selectedContacts.length === 0}
          >
            <Mail className="w-4 h-4 mr-2" />
            Email ({selectedContacts.length})
          </Button>
          
          <Button
            className="flex-1"
            style={{ backgroundColor: '#5B4FE5' }}
            onClick={shareViaText}
            disabled={selectedContacts.length === 0}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Text ({selectedContacts.length})
          </Button>
        </div>
        
        {selectedContacts.length === 0 && (
          <p className="text-center text-sm text-gray-500 mt-2">
            Select contacts to share your ETA
          </p>
        )}
      </div>
    </div>
  );
}
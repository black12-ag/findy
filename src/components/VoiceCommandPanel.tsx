import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Settings,
  HelpCircle,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { motion } from 'motion/react';
import { useSpeech } from '../services/speechService';
import { logger } from '../utils/logger';

interface VoiceCommandPanelProps {
  onClose: () => void;
  onVoiceCommand: (command: string) => void;
}

interface VoiceCommand {
  phrase: string;
  description: string;
  category: string;
}

export function VoiceCommandPanel({ onClose, onVoiceCommand }: VoiceCommandPanelProps) {
  const {
    isListening,
    isSpeaking,
    currentTranscript,
    state,
    error,
    lastCommand,
    isRecognitionSupported,
    isSynthesisSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    getAvailableCommands
  } = useSpeech();

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [wakePhraseEnabled, setWakePhraseEnabled] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(true);

  // Get available voice commands from Speech Service
  const availableCommands = getAvailableCommands();
  
  // Transform to display format
  const voiceCommands: VoiceCommand[] = [
    { phrase: 'Navigate to [place]', description: 'Start navigation to a destination', category: 'Navigation' },
    { phrase: 'Find [type of place]', description: 'Search for nearby places', category: 'Search' },
    { phrase: 'Take me home', description: 'Navigate to your home address', category: 'Navigation' },
    { phrase: 'Go to work', description: 'Navigate to your work address', category: 'Navigation' },
    { phrase: 'Avoid [option]', description: 'Change route preferences (highways, tolls, etc.)', category: 'Route Options' },
    { phrase: 'Add a stop', description: 'Add waypoint to current route', category: 'Route Options' },
    { phrase: 'Report [incident]', description: 'Report traffic incident', category: 'Community' },
    { phrase: 'Share my location', description: 'Share current location', category: 'Sharing' },
    { phrase: 'Switch to [mode]', description: 'Change transport mode (walking, driving, etc.)', category: 'Transport' },
    { phrase: 'Mute navigation', description: 'Turn off voice guidance', category: 'Settings' },
    { phrase: 'Repeat directions', description: 'Repeat last instruction', category: 'Navigation' },
    { phrase: 'Help', description: 'Show available commands', category: 'Help' },
    { phrase: 'Stop', description: 'Cancel current action', category: 'Control' }
  ];

  // Group commands by category
  const commandsByCategory = voiceCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = [];
    }
    acc[command.category].push(command);
    return acc;
  }, {} as Record<string, VoiceCommand[]>);

  // Handle voice command events
  useEffect(() => {
    const handleVoiceCommand = (event: CustomEvent) => {
      const { action, parameters, originalText } = event.detail;
      
      // Call the parent callback
      onVoiceCommand(originalText);
      
      // Provide voice feedback if enabled
      if (autoSpeak && isSynthesisSupported) {
        let response = '';
        
        switch (action) {
          case 'navigate':
            response = `Navigating to ${parameters.destination}`;
            break;
          case 'navigate_home':
            response = 'Taking you home';
            break;
          case 'navigate_work':
            response = 'Navigating to work';
            break;
          case 'search':
            response = `Searching for ${parameters.type}`;
            break;
          case 'add_stop':
            response = 'Adding stop to your route';
            break;
          case 'mute':
            response = 'Navigation muted';
            break;
          case 'unmute':
            response = 'Navigation unmuted';
            break;
          case 'help':
            response = 'Here are the available voice commands. You can say navigate to a place, find nearby locations, or ask me to take you home.';
            break;
          default:
            response = `Command ${action} executed`;
        }
        
        if (response) {
          speak(response);
        }
      }
    };

    window.addEventListener('voiceCommand', handleVoiceCommand as EventListener);
    
    return () => {
      window.removeEventListener('voiceCommand', handleVoiceCommand as EventListener);
    };
  }, [autoSpeak, isSynthesisSupported, onVoiceCommand, speak]);

  const handleStartListening = async () => {
    if (!voiceEnabled || !isRecognitionSupported) return;
    
    try {
      await startListening();
    } catch (error) {
      logger.error('Failed to start voice listening:', error);
    }
  };

  const handleStopListening = () => {
    stopListening();
  };

  const getVoiceStateInfo = () => {
    if (error) {
      return { color: '#EF4444', text: 'Error', description: error.message || 'Please try again' };
    }
    
    switch (state) {
      case 'listening':
        return { color: '#3B82F6', text: 'Listening...', description: 'Speak your command' };
      case 'processing':
        return { color: '#F59E0B', text: 'Processing...', description: 'Understanding your request' };
      case 'error':
        return { color: '#EF4444', text: 'Error', description: 'Please try again' };
      default:
        if (isSpeaking) {
          return { color: '#10B981', text: 'Speaking...', description: 'Providing response' };
        }
        return { color: '#6B7280', text: 'Ready', description: isRecognitionSupported ? 'Tap to start' : 'Speech recognition not supported' };
    }
  };

  const stateInfo = getVoiceStateInfo();

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
            <h2 className="font-medium text-gray-900">Voice Commands</h2>
            <p className="text-sm text-gray-500">Control PathFinder with your voice</p>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Voice Control Interface */}
      <div className="flex-shrink-0 p-6 text-center bg-gray-50">
        <div className="mb-6">
          <motion.button
            className="w-24 h-24 rounded-full shadow-lg flex items-center justify-center text-white relative"
            style={{ backgroundColor: stateInfo.color }}
            onClick={isListening ? handleStopListening : handleStartListening}
            disabled={!voiceEnabled || !isRecognitionSupported || state === 'processing' || isSpeaking}
            whileTap={{ scale: 0.95 }}
            animate={isListening ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: isListening ? Infinity : 0, duration: 1 }}
          >
            {isListening ? (
              <MicOff className="w-10 h-10" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
            
            {isListening && (
              <div className="absolute inset-0 rounded-full border-4 border-blue-300 animate-ping" />
            )}
          </motion.button>
        </div>

        <div className="mb-4">
          <div className="text-lg font-medium text-gray-900 mb-1">{stateInfo.text}</div>
          <div className="text-sm text-gray-500">{stateInfo.description}</div>
        </div>

        {currentTranscript && (
          <Card className="p-3 mb-4 bg-blue-50 border-blue-200">
            <div className="text-sm text-blue-900">"{currentTranscript}"</div>
          </Card>
        )}

        {lastCommand && state === 'idle' && (
          <Card className="p-3 mb-4 bg-green-50 border-green-200">
            <div className="flex items-center gap-2 justify-center">
              <Check className="w-4 h-4 text-green-600" />
              <div className="text-sm text-green-900">Last: "{lastCommand.originalText}"</div>
            </div>
          </Card>
        )}
        
        {error && (
          <Card className="p-3 mb-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <div className="text-sm text-red-900">{error.message}</div>
            </div>
          </Card>
        )}

        {/* Wake Phrase */}
        {wakePhraseEnabled && (
          <div className="text-center">
            <Badge variant="outline" className="text-purple-700 border-purple-200 bg-purple-50">
              Say "Hey PathFinder" to activate
            </Badge>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-gray-600" />
              <div>
                <span className="text-gray-900">Voice Commands</span>
                <p className="text-sm text-gray-500">Enable voice control</p>
              </div>
            </div>
            <Switch
              checked={voiceEnabled}
              onCheckedChange={setVoiceEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-gray-600" />
              <div>
                <span className="text-gray-900">Wake Phrase</span>
                <p className="text-sm text-gray-500">"Hey PathFinder" activation</p>
              </div>
            </div>
            <Switch
              checked={wakePhraseEnabled}
              onCheckedChange={setWakePhraseEnabled}
              disabled={!voiceEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-gray-600" />
              <div>
                <span className="text-gray-900">Voice Responses</span>
                <p className="text-sm text-gray-500">Spoken confirmations</p>
              </div>
            </div>
            <Switch
              checked={autoSpeak}
              onCheckedChange={setAutoSpeak}
              disabled={!voiceEnabled}
            />
          </div>
        </div>
      </div>

      {/* Command Examples */}
      <div className="flex-1 scroll-y hide-scrollbar scroll-smooth p-4">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Voice Commands</h3>
        </div>

        <div className="space-y-4">
          {Object.entries(commandsByCategory).map(([category, commands]) => (
            <Card key={category} className="p-4">
              <h4 className="font-medium text-gray-900 mb-3">{category}</h4>
              <div className="space-y-2">
                {commands.map((command, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">"{command.phrase}"</div>
                      <div className="text-xs text-gray-500">{command.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Tips */}
        <Card className="p-4 mt-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Voice Tips</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Speak clearly and at normal pace</li>
                <li>• Use specific place names when possible</li>
                <li>• Commands work while navigating</li>
                <li>• Say "help" to hear available commands</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
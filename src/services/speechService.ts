import React from 'react';
import { logger } from '../utils/logger';

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechSynthesisOptions {
  text: string;
  voice?: SpeechSynthesisVoice;
  pitch?: number; // 0-2
  rate?: number; // 0.1-10
  volume?: number; // 0-1
}

export interface VoiceCommand {
  phrase: string;
  patterns: RegExp[];
  action: string;
  parameters?: string[];
}

export type SpeechRecognitionState = 'idle' | 'listening' | 'processing' | 'error';

class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  
  // Event subscribers
  private resultSubscribers: ((result: SpeechRecognitionResult) => void)[] = [];
  private stateSubscribers: ((state: SpeechRecognitionState) => void)[] = [];
  private errorSubscribers: ((error: Error) => void)[] = [];

  // Voice commands patterns
  private voiceCommands: VoiceCommand[] = [
    {
      phrase: 'navigate to {destination}',
      patterns: [/navigate to (.+)/i, /go to (.+)/i, /take me to (.+)/i],
      action: 'navigate',
      parameters: ['destination']
    },
    {
      phrase: 'find {type}',
      patterns: [/find (.+)/i, /search for (.+)/i, /look for (.+)/i],
      action: 'search',
      parameters: ['type']
    },
    {
      phrase: 'take me home',
      patterns: [/take me home/i, /go home/i, /navigate home/i],
      action: 'navigate_home'
    },
    {
      phrase: 'go to work',
      patterns: [/go to work/i, /navigate to work/i, /take me to work/i],
      action: 'navigate_work'
    },
    {
      phrase: 'avoid {option}',
      patterns: [/avoid (.+)/i, /no (.+)/i],
      action: 'avoid',
      parameters: ['option']
    },
    {
      phrase: 'add stop',
      patterns: [/add stop/i, /add a stop/i, /make a stop/i],
      action: 'add_stop'
    },
    {
      phrase: 'report {incident}',
      patterns: [/report (.+)/i, /there is (.+)/i],
      action: 'report',
      parameters: ['incident']
    },
    {
      phrase: 'share location',
      patterns: [/share location/i, /share my location/i, /send location/i],
      action: 'share_location'
    },
    {
      phrase: 'switch to {mode}',
      patterns: [/switch to (.+)/i, /change to (.+)/i, /use (.+) mode/i],
      action: 'transport_mode',
      parameters: ['mode']
    },
    {
      phrase: 'mute navigation',
      patterns: [/mute/i, /mute navigation/i, /stop talking/i, /be quiet/i],
      action: 'mute'
    },
    {
      phrase: 'unmute navigation',
      patterns: [/unmute/i, /unmute navigation/i, /start talking/i, /speak/i],
      action: 'unmute'
    },
    {
      phrase: 'repeat directions',
      patterns: [/repeat/i, /repeat directions/i, /say again/i],
      action: 'repeat'
    },
    {
      phrase: 'help',
      patterns: [/help/i, /what can you do/i, /commands/i],
      action: 'help'
    },
    {
      phrase: 'stop',
      patterns: [/stop/i, /cancel/i, /nevermind/i],
      action: 'stop'
    }
  ];

  constructor() {
    this.init();
  }

  private init() {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      this.setupRecognitionEvents();
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  private setupRecognitionEvents() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.notifyStateChange('listening');
    };

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();
      
      const recognitionResult: SpeechRecognitionResult = {
        transcript,
        confidence: result[0].confidence,
        isFinal: result.isFinal
      };

      this.notifyResult(recognitionResult);

      if (result.isFinal) {
        this.processVoiceCommand(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      const error = new Error(`Speech recognition error: ${event.error}`);
      this.notifyError(error);
      this.notifyStateChange('error');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.notifyStateChange('idle');
    };
  }

  /**
   * Check if speech recognition is supported
   */
  isRecognitionSupported(): boolean {
    return !!(('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window));
  }

  /**
   * Check if speech synthesis is supported
   */
  isSynthesisSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  /**
   * Start speech recognition
   */
  async startListening(): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition is not supported');
    }

    if (this.isListening) {
      logger.warn('Speech recognition is already active');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      throw new Error(`Failed to start speech recognition: ${error}`);
    }
  }

  /**
   * Stop speech recognition
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Process voice command and extract action/parameters
   */
  private processVoiceCommand(transcript: string): void {
    this.notifyStateChange('processing');

    // Find matching command
    for (const command of this.voiceCommands) {
      for (const pattern of command.patterns) {
        const match = transcript.match(pattern);
        if (match) {
          const parameters: { [key: string]: string } = {};
          
          if (command.parameters && match.length > 1) {
            command.parameters.forEach((param, index) => {
              parameters[param] = match[index + 1]?.trim() || '';
            });
          }

          // Emit command event
          this.emitCommand(command.action, parameters, transcript);
          return;
        }
      }
    }

    // No command matched
    this.handleUnknownCommand(transcript);
  }

  private emitCommand(action: string, parameters: { [key: string]: string }, originalText: string) {
    // Create custom event for voice command
    const event = new CustomEvent('voiceCommand', {
      detail: { action, parameters, originalText }
    });
    window.dispatchEvent(event);
  }

  private handleUnknownCommand(transcript: string) {
    logger.info('Unknown voice command:', transcript);
    this.speak(`Sorry, I didn't understand "${transcript}". Say "help" to hear available commands.`);
  }

  /**
   * Speak text using Text-to-Speech
   */
  async speak(text: string, options: Partial<SpeechSynthesisOptions> = {}): Promise<void> {
    if (!this.synthesis) {
      throw new Error('Speech synthesis is not supported');
    }

    // Cancel current speech if any
    this.synthesis.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      // Set options
      if (options.voice) utterance.voice = options.voice;
      if (options.pitch !== undefined) utterance.pitch = options.pitch;
      if (options.rate !== undefined) utterance.rate = options.rate;
      if (options.volume !== undefined) utterance.volume = options.volume;

      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      this.synthesis.speak(utterance);
    });
  }

  /**
   * Stop current speech
   */
  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.currentUtterance = null;
    }
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  /**
   * Check if currently listening
   */
  getListeningState(): boolean {
    return this.isListening;
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis ? this.synthesis.speaking : false;
  }

  /**
   * Subscribe to recognition results
   */
  subscribeToResults(callback: (result: SpeechRecognitionResult) => void): () => void {
    this.resultSubscribers.push(callback);
    return () => {
      const index = this.resultSubscribers.indexOf(callback);
      if (index > -1) {
        this.resultSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribeToState(callback: (state: SpeechRecognitionState) => void): () => void {
    this.stateSubscribers.push(callback);
    return () => {
      const index = this.stateSubscribers.indexOf(callback);
      if (index > -1) {
        this.stateSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to errors
   */
  subscribeToErrors(callback: (error: Error) => void): () => void {
    this.errorSubscribers.push(callback);
    return () => {
      const index = this.errorSubscribers.indexOf(callback);
      if (index > -1) {
        this.errorSubscribers.splice(index, 1);
      }
    };
  }

  private notifyResult(result: SpeechRecognitionResult) {
    this.resultSubscribers.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        logger.error('Error in speech result subscriber:', error);
      }
    });
  }

  private notifyStateChange(state: SpeechRecognitionState) {
    this.stateSubscribers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        logger.error('Error in speech state subscriber:', error);
      }
    });
  }

  private notifyError(error: Error) {
    this.errorSubscribers.forEach(callback => {
      try {
        callback(error);
      } catch (error) {
        logger.error('Error in speech error subscriber:', error);
      }
    });
  }

  /**
   * Get all available commands
   */
  getAvailableCommands(): VoiceCommand[] {
    return this.voiceCommands;
  }
}

// React hook for speech functionality
export const useSpeech = () => {
  const [isListening, setIsListening] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [currentTranscript, setCurrentTranscript] = React.useState('');
  const [state, setState] = React.useState<SpeechRecognitionState>('idle');
  const [error, setError] = React.useState<Error | null>(null);
  const [lastCommand, setLastCommand] = React.useState<{
    action: string;
    parameters: { [key: string]: string };
    originalText: string;
  } | null>(null);

  React.useEffect(() => {
    const unsubscribeResults = speechService.subscribeToResults((result) => {
      setCurrentTranscript(result.transcript);
      if (result.isFinal) {
        setTimeout(() => setCurrentTranscript(''), 2000);
      }
    });

    const unsubscribeState = speechService.subscribeToState((newState) => {
      setState(newState);
      setIsListening(speechService.getListeningState());
    });

    const unsubscribeErrors = speechService.subscribeToErrors((err) => {
      setError(err);
    });

    // Listen for voice commands
    const handleVoiceCommand = (event: CustomEvent) => {
      setLastCommand(event.detail);
    };

    window.addEventListener('voiceCommand', handleVoiceCommand as EventListener);

    // Check speaking status periodically
    const speakingInterval = setInterval(() => {
      setIsSpeaking(speechService.isSpeaking());
    }, 100);

    return () => {
      unsubscribeResults();
      unsubscribeState();
      unsubscribeErrors();
      window.removeEventListener('voiceCommand', handleVoiceCommand as EventListener);
      clearInterval(speakingInterval);
    };
  }, []);

  const startListening = async () => {
    try {
      await speechService.startListening();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start listening'));
    }
  };

  const stopListening = () => {
    speechService.stopListening();
  };

  const speak = async (text: string, options?: Partial<SpeechSynthesisOptions>) => {
    try {
      await speechService.speak(text, options);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to speak'));
    }
  };

  const stopSpeaking = () => {
    speechService.stopSpeaking();
  };

  return {
    isListening,
    isSpeaking,
    currentTranscript,
    state,
    error,
    lastCommand,
    isRecognitionSupported: speechService.isRecognitionSupported(),
    isSynthesisSupported: speechService.isSynthesisSupported(),
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    getAvailableVoices: speechService.getAvailableVoices.bind(speechService),
    getAvailableCommands: speechService.getAvailableCommands.bind(speechService)
  };
};

export const speechService = new SpeechService();
export default speechService;
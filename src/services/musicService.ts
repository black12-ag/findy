/**
 * Music Service
 * Integrates with media apps and controls using Media Session API and Web Audio API
 */

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: MediaImage[];
  duration?: number;
  url?: string;
  isPlaying: boolean;
  currentTime: number;
  source: 'spotify' | 'apple_music' | 'youtube_music' | 'local' | 'browser';
}

export interface PlaybackState {
  state: 'playing' | 'paused' | 'stopped' | 'loading';
  track: MediaTrack | null;
  position: number;
  duration: number;
  volume: number;
  repeat: 'none' | 'track' | 'playlist';
  shuffle: boolean;
  canPlay: boolean;
  canPause: boolean;
  canSeek: boolean;
  canSkipNext: boolean;
  canSkipPrevious: boolean;
}

export interface MusicProvider {
  id: string;
  name: string;
  isConnected: boolean;
  isActive: boolean;
  canControl: boolean;
  accessToken?: string;
  lastActivity?: Date;
}

export interface DrivingModeSettings {
  enabled: boolean;
  autoStart: boolean;
  voiceControlEnabled: boolean;
  handsFreeOnly: boolean;
  limitedUI: boolean;
  autoPlayOnConnect: boolean;
  preferredProvider?: string;
  volume: number;
}

class MusicService {
  private mediaSession: MediaSession | null = null;
  private currentTrack: MediaTrack | null = null;
  private playbackState: PlaybackState;
  private providers: Map<string, MusicProvider> = new Map();
  private audioContext: AudioContext | null = null;
  private drivingMode: DrivingModeSettings;
  private subscribers: ((state: PlaybackState) => void)[] = [];
  private isInitialized: boolean = false;

  constructor() {
    this.playbackState = {
      state: 'stopped',
      track: null,
      position: 0,
      duration: 0,
      volume: 0.7,
      repeat: 'none',
      shuffle: false,
      canPlay: false,
      canPause: false,
      canSeek: false,
      canSkipNext: false,
      canSkipPrevious: false
    };

    this.drivingMode = {
      enabled: false,
      autoStart: false,
      voiceControlEnabled: true,
      handsFreeOnly: true,
      limitedUI: false,
      autoPlayOnConnect: false,
      volume: 0.7
    };

    this.initialize();
  }

  /**
   * Initialize music service and media session
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize Media Session API
      if ('mediaSession' in navigator) {
        this.mediaSession = navigator.mediaSession;
        this.setupMediaSessionHandlers();
      }

      // Initialize Web Audio API
      if ('AudioContext' in window || 'webkitAudioContext' in window) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Load settings from localStorage
      this.loadSettings();

      // Initialize music providers
      this.initializeProviders();

      // Set up driving mode detection
      this.setupDrivingModeDetection();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize music service:', error);
    }
  }

  /**
   * Check if Media Session API is supported
   */
  isMediaSessionSupported(): boolean {
    return 'mediaSession' in navigator;
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Get connected music providers
   */
  getProviders(): MusicProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Connect to Spotify
   */
  async connectSpotify(): Promise<MusicProvider> {
    try {
      const provider: MusicProvider = {
        id: 'spotify',
        name: 'Spotify',
        isConnected: false,
        isActive: false,
        canControl: false
      };

      // In a real implementation, this would use Spotify Web API
      if (typeof window !== 'undefined' && 'Spotify' in window) {
        // Use real Spotify Web Playback SDK if available
        await this.authenticateSpotify(provider);
      } else {
        // Mock Spotify connection
        provider.isConnected = true;
        provider.canControl = true;
        provider.accessToken = 'mock_spotify_token';
      }

      this.providers.set(provider.id, provider);
      this.saveSettings();
      
      return provider;
    } catch (error) {
      console.error('Failed to connect Spotify:', error);
      throw error;
    }
  }

  /**
   * Connect to Apple Music
   */
  async connectAppleMusic(): Promise<MusicProvider> {
    try {
      const provider: MusicProvider = {
        id: 'apple_music',
        name: 'Apple Music',
        isConnected: false,
        isActive: false,
        canControl: false
      };

      // Mock Apple Music connection
      // In a real implementation, this would use MusicKit JS
      provider.isConnected = true;
      provider.canControl = true;
      provider.accessToken = 'mock_apple_music_token';

      this.providers.set(provider.id, provider);
      this.saveSettings();
      
      return provider;
    } catch (error) {
      console.error('Failed to connect Apple Music:', error);
      throw error;
    }
  }

  /**
   * Play music
   */
  async play(track?: MediaTrack): Promise<void> {
    if (track) {
      this.currentTrack = track;
      this.playbackState.track = track;
    }

    if (!this.currentTrack) {
      throw new Error('No track to play');
    }

    try {
      this.playbackState.state = 'playing';
      this.playbackState.canPause = true;
      this.playbackState.canPlay = false;

      // Update media session metadata
      if (this.mediaSession && this.currentTrack) {
        this.mediaSession.metadata = new MediaMetadata({
          title: this.currentTrack.title,
          artist: this.currentTrack.artist,
          album: this.currentTrack.album,
          artwork: this.currentTrack.artwork
        });

        this.mediaSession.playbackState = 'playing';
      }

      // In a real implementation, control the actual music player
      await this.controlActiveProvider('play', this.currentTrack);

      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to play music:', error);
      this.playbackState.state = 'stopped';
      throw error;
    }
  }

  /**
   * Pause music
   */
  async pause(): Promise<void> {
    try {
      this.playbackState.state = 'paused';
      this.playbackState.canPlay = true;
      this.playbackState.canPause = false;

      if (this.mediaSession) {
        this.mediaSession.playbackState = 'paused';
      }

      await this.controlActiveProvider('pause');
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to pause music:', error);
      throw error;
    }
  }

  /**
   * Stop music
   */
  async stop(): Promise<void> {
    try {
      this.playbackState.state = 'stopped';
      this.playbackState.position = 0;
      this.playbackState.canPlay = true;
      this.playbackState.canPause = false;

      if (this.mediaSession) {
        this.mediaSession.playbackState = 'none';
      }

      await this.controlActiveProvider('stop');
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to stop music:', error);
      throw error;
    }
  }

  /**
   * Skip to next track
   */
  async skipNext(): Promise<void> {
    try {
      await this.controlActiveProvider('next');
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to skip next:', error);
      throw error;
    }
  }

  /**
   * Skip to previous track
   */
  async skipPrevious(): Promise<void> {
    try {
      await this.controlActiveProvider('previous');
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to skip previous:', error);
      throw error;
    }
  }

  /**
   * Seek to position
   */
  async seekTo(position: number): Promise<void> {
    try {
      this.playbackState.position = position;
      await this.controlActiveProvider('seek', undefined, position);
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to seek:', error);
      throw error;
    }
  }

  /**
   * Set volume
   */
  async setVolume(volume: number): Promise<void> {
    try {
      this.playbackState.volume = Math.max(0, Math.min(1, volume));
      await this.controlActiveProvider('volume', undefined, this.playbackState.volume);
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to set volume:', error);
      throw error;
    }
  }

  /**
   * Toggle shuffle
   */
  async toggleShuffle(): Promise<void> {
    try {
      this.playbackState.shuffle = !this.playbackState.shuffle;
      await this.controlActiveProvider('shuffle', undefined, this.playbackState.shuffle);
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to toggle shuffle:', error);
      throw error;
    }
  }

  /**
   * Toggle repeat mode
   */
  async toggleRepeat(): Promise<void> {
    try {
      const modes: Array<'none' | 'track' | 'playlist'> = ['none', 'track', 'playlist'];
      const currentIndex = modes.indexOf(this.playbackState.repeat);
      this.playbackState.repeat = modes[(currentIndex + 1) % modes.length];
      
      await this.controlActiveProvider('repeat', undefined, this.playbackState.repeat);
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to toggle repeat:', error);
      throw error;
    }
  }

  /**
   * Enable driving mode
   */
  async enableDrivingMode(settings?: Partial<DrivingModeSettings>): Promise<void> {
    this.drivingMode = { ...this.drivingMode, enabled: true, ...settings };
    
    if (this.drivingMode.autoPlayOnConnect && !this.playbackState.track) {
      // Auto-play default playlist or last track
      await this.playDrivingPlaylist();
    }

    if (this.drivingMode.volume !== this.playbackState.volume) {
      await this.setVolume(this.drivingMode.volume);
    }

    this.saveSettings();
  }

  /**
   * Disable driving mode
   */
  async disableDrivingMode(): Promise<void> {
    this.drivingMode.enabled = false;
    this.saveSettings();
  }

  /**
   * Get driving mode settings
   */
  getDrivingModeSettings(): DrivingModeSettings {
    return { ...this.drivingMode };
  }

  /**
   * Subscribe to playback state changes
   */
  subscribe(callback: (state: PlaybackState) => void): () => void {
    this.subscribers.push(callback);
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Setup media session handlers
   */
  private setupMediaSessionHandlers(): void {
    if (!this.mediaSession) return;

    // Play/pause handlers
    this.mediaSession.setActionHandler('play', () => {
      this.play().catch(error => console.error('Media session play failed:', error));
    });

    this.mediaSession.setActionHandler('pause', () => {
      this.pause().catch(error => console.error('Media session pause failed:', error));
    });

    this.mediaSession.setActionHandler('stop', () => {
      this.stop().catch(error => console.error('Media session stop failed:', error));
    });

    // Skip handlers
    this.mediaSession.setActionHandler('nexttrack', () => {
      this.skipNext().catch(error => console.error('Media session next failed:', error));
    });

    this.mediaSession.setActionHandler('previoustrack', () => {
      this.skipPrevious().catch(error => console.error('Media session previous failed:', error));
    });

    // Seek handler
    this.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        this.seekTo(details.seekTime).catch(error => console.error('Media session seek failed:', error));
      }
    });

    // Position state update
    this.updatePositionState();
  }

  /**
   * Update media session position state
   */
  private updatePositionState(): void {
    if (!this.mediaSession) return;

    try {
      this.mediaSession.setPositionState({
        duration: this.playbackState.duration,
        playbackRate: 1.0,
        position: this.playbackState.position
      });
    } catch (error) {
      console.error('Failed to update position state:', error);
    }
  }

  /**
   * Initialize music providers
   */
  private initializeProviders(): void {
    // Add browser audio provider
    const browserProvider: MusicProvider = {
      id: 'browser',
      name: 'Browser Audio',
      isConnected: true,
      isActive: false,
      canControl: true
    };
    this.providers.set(browserProvider.id, browserProvider);
  }

  /**
   * Setup driving mode detection
   */
  private setupDrivingModeDetection(): void {
    // Detect when device is connected to car (Android Auto, CarPlay, etc.)
    if ('navigator' in window && 'connection' in navigator) {
      // Monitor connection changes that might indicate car connection
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          if (this.drivingMode.autoStart) {
            this.detectCarConnection();
          }
        });
      }
    }

    // Listen for orientation changes that might indicate driving
    window.addEventListener('orientationchange', () => {
      if (this.drivingMode.autoStart) {
        this.detectDrivingContext();
      }
    });
  }

  /**
   * Detect car connection (mock implementation)
   */
  private async detectCarConnection(): Promise<void> {
    // In a real implementation, this would detect Android Auto, CarPlay, etc.
    // For now, this is a placeholder
    if (this.drivingMode.autoStart && !this.drivingMode.enabled) {
      await this.enableDrivingMode();
    }
  }

  /**
   * Detect driving context (mock implementation)
   */
  private async detectDrivingContext(): Promise<void> {
    // In a real implementation, this would use device sensors to detect driving
    // For now, this is a placeholder
  }

  /**
   * Authenticate with Spotify (mock implementation)
   */
  private async authenticateSpotify(provider: MusicProvider): Promise<void> {
    // In a real implementation, this would handle Spotify OAuth
    provider.isConnected = true;
    provider.canControl = true;
    provider.accessToken = 'mock_spotify_token';
  }

  /**
   * Control active music provider
   */
  private async controlActiveProvider(
    action: string, 
    track?: MediaTrack, 
    value?: any
  ): Promise<void> {
    const activeProvider = Array.from(this.providers.values()).find(p => p.isActive);
    
    if (!activeProvider) {
      // Use browser provider as fallback
      const browserProvider = this.providers.get('browser');
      if (browserProvider) {
        browserProvider.isActive = true;
      }
    }

    // Mock provider control
    // Controlling music: ${action} - ${track || 'unknown'}
    
    // Update last activity
    if (activeProvider) {
      activeProvider.lastActivity = new Date();
    }
  }

  /**
   * Play driving playlist
   */
  private async playDrivingPlaylist(): Promise<void> {
    // Mock driving playlist
    const drivingTrack: MediaTrack = {
      id: 'driving_track_1',
      title: 'Highway Drive',
      artist: 'Driving Music',
      album: 'Road Trip',
      isPlaying: false,
      currentTime: 0,
      source: 'local',
      artwork: [
        {
          src: '/music-artwork.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    };

    await this.play(drivingTrack);
  }

  /**
   * Notify subscribers of state changes
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.playbackState);
      } catch (error) {
        console.error('Error in music subscriber:', error);
      }
    });
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): void {
    try {
      const savedSettings = localStorage.getItem('music_service_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        this.drivingMode = { ...this.drivingMode, ...settings.drivingMode };
        this.playbackState.volume = settings.volume || this.playbackState.volume;
      }
    } catch (error) {
      console.error('Failed to load music settings:', error);
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      const settings = {
        drivingMode: this.drivingMode,
        volume: this.playbackState.volume,
        providers: Array.from(this.providers.values())
      };
      localStorage.setItem('music_service_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save music settings:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clean up media session
    if (this.mediaSession) {
      this.mediaSession.setActionHandler('play', null);
      this.mediaSession.setActionHandler('pause', null);
      this.mediaSession.setActionHandler('stop', null);
      this.mediaSession.setActionHandler('nexttrack', null);
      this.mediaSession.setActionHandler('previoustrack', null);
      this.mediaSession.setActionHandler('seekto', null);
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
    }

    this.subscribers = [];
    this.providers.clear();
  }
}

// Export singleton instance
export const musicService = new MusicService();
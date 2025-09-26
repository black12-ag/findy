/**
 * Calendar Service
 * Integrates with calendar APIs for event management and travel planning
 */

import { logger } from '../utils/logger';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: {
    address: string;
    lat?: number;
    lng?: number;
  };
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  attendees?: string[];
  calendarId: string;
  source: 'google' | 'outlook' | 'apple' | 'local';
  reminders?: {
    method: 'email' | 'popup' | 'sms';
    minutes: number;
  }[];
  isRecurring?: boolean;
  recurrenceRule?: string;
}

export interface TravelSuggestion {
  eventId: string;
  departureTime: Date;
  route: {
    from: string;
    to: string;
    duration: number;
    distance: number;
    mode: 'driving' | 'transit' | 'walking' | 'cycling';
  };
  bufferTime: number; // minutes
  trafficFactor: number;
}

export interface CalendarIntegration {
  id: string;
  name: string;
  type: 'google' | 'outlook' | 'apple' | 'caldav';
  isEnabled: boolean;
  accessToken?: string;
  refreshToken?: string;
  lastSync: Date | null;
  syncStatus: 'connected' | 'error' | 'syncing';
}

class CalendarService {
  private integrations: Map<string, CalendarIntegration> = new Map();
  private events: Map<string, CalendarEvent> = new Map();
  private eventSubscribers: ((events: CalendarEvent[]) => void)[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeService();
  }

  /**
   * Initialize calendar service and check for existing integrations
   */
  async initializeService(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load saved integrations from localStorage
      const savedIntegrations = localStorage.getItem('calendar_integrations');
      if (savedIntegrations) {
        const integrations = JSON.parse(savedIntegrations);
        integrations.forEach((integration: CalendarIntegration) => {
          this.integrations.set(integration.id, integration);
        });
      }

      // Check for native calendar API support
      this.checkNativeCalendarSupport();
      
      // Start periodic sync if any integrations are enabled
      this.startPeriodicSync();
      
      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize calendar service', { error });
    }
  }

  /**
   * Connect to Google Calendar
   */
  async connectGoogleCalendar(): Promise<CalendarIntegration> {
    try {
      // In a real implementation, this would use Google Calendar API
      const integration: CalendarIntegration = {
        id: 'google_' + this.generateId(),
        name: 'Google Calendar',
        type: 'google',
        isEnabled: true,
        lastSync: null,
        syncStatus: 'connected'
      };

      // Mock Google OAuth flow
      if (typeof window !== 'undefined' && 'google' in window) {
        // Use real Google Calendar API if available
        await this.authenticateWithGoogle(integration);
      } else {
        // Fallback to mock implementation
        integration.accessToken = 'mock_google_token';
        await this.loadMockGoogleEvents(integration.id);
      }

      this.integrations.set(integration.id, integration);
      this.saveIntegrationsToStorage();
      
      return integration;
    } catch (error) {
      logger.error('Failed to connect Google Calendar', { error });
      throw error;
    }
  }

  /**
   * Connect to Outlook Calendar
   */
  async connectOutlookCalendar(): Promise<CalendarIntegration> {
    try {
      const integration: CalendarIntegration = {
        id: 'outlook_' + this.generateId(),
        name: 'Outlook Calendar',
        type: 'outlook',
        isEnabled: true,
        lastSync: null,
        syncStatus: 'connected'
      };

      // Mock Microsoft Graph API integration
      integration.accessToken = 'mock_outlook_token';
      await this.loadMockOutlookEvents(integration.id);

      this.integrations.set(integration.id, integration);
      this.saveIntegrationsToStorage();
      
      return integration;
    } catch (error) {
      logger.error('Failed to connect Outlook Calendar', { error });
      throw error;
    }
  }

  /**
   * Get all connected calendar integrations
   */
  getIntegrations(): CalendarIntegration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Get events from all connected calendars
   */
  async getEvents(dateRange?: { start: Date; end: Date }): Promise<CalendarEvent[]> {
    const allEvents = Array.from(this.events.values());
    
    if (!dateRange) {
      return allEvents;
    }

    return allEvents.filter(event => {
      return event.startTime >= dateRange.start && event.startTime <= dateRange.end;
    });
  }

  /**
   * Create a new calendar event
   */
  async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const newEvent: CalendarEvent = {
      ...event,
      id: this.generateId()
    };

    // In a real implementation, this would create the event via the respective calendar API
    if (event.calendarId.startsWith('google_')) {
      await this.createGoogleEvent(newEvent);
    } else if (event.calendarId.startsWith('outlook_')) {
      await this.createOutlookEvent(newEvent);
    }

    this.events.set(newEvent.id, newEvent);
    this.notifyEventSubscribers();

    return newEvent;
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const existingEvent = this.events.get(eventId);
    if (!existingEvent) {
      throw new Error('Event not found');
    }

    const updatedEvent = { ...existingEvent, ...updates };

    // Update via respective calendar API
    if (existingEvent.calendarId.startsWith('google_')) {
      await this.updateGoogleEvent(updatedEvent);
    } else if (existingEvent.calendarId.startsWith('outlook_')) {
      await this.updateOutlookEvent(updatedEvent);
    }

    this.events.set(eventId, updatedEvent);
    this.notifyEventSubscribers();

    return updatedEvent;
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Delete via respective calendar API
    if (event.calendarId.startsWith('google_')) {
      await this.deleteGoogleEvent(event);
    } else if (event.calendarId.startsWith('outlook_')) {
      await this.deleteOutlookEvent(event);
    }

    this.events.delete(eventId);
    this.notifyEventSubscribers();
  }

  /**
   * Get travel suggestions for upcoming events
   */
  async getTravelSuggestions(userLocation?: { lat: number; lng: number }): Promise<TravelSuggestion[]> {
    const upcomingEvents = await this.getEvents({
      start: new Date(),
      end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
    });

    const eventsWithLocation = upcomingEvents.filter(event => event.location?.address);
    const suggestions: TravelSuggestion[] = [];

    for (const event of eventsWithLocation) {
      if (!event.location?.address) continue;

      try {
        const suggestion = await this.calculateTravelSuggestion(event, userLocation);
        suggestions.push(suggestion);
      } catch (error) {
        logger.error('Failed to calculate travel for event', { eventId: event.id, error });
      }
    }

    return suggestions.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
  }

  /**
   * Add travel time to calendar event
   */
  async addTravelTimeToEvent(eventId: string, suggestion: TravelSuggestion): Promise<CalendarEvent> {
    const travelEvent: Omit<CalendarEvent, 'id'> = {
      title: `🚗 Travel to ${suggestion.route.to}`,
      description: `Travel time: ${Math.round(suggestion.route.duration)} minutes\nDistance: ${(suggestion.route.distance / 1000).toFixed(1)}km\nMode: ${suggestion.route.mode}`,
      startTime: suggestion.departureTime,
      endTime: new Date(suggestion.departureTime.getTime() + suggestion.route.duration * 60 * 1000),
      allDay: false,
      calendarId: 'local_travel',
      source: 'local',
      location: {
        address: suggestion.route.from
      }
    };

    return await this.createEvent(travelEvent);
  }

  /**
   * Subscribe to event updates
   */
  subscribeToEvents(callback: (events: CalendarEvent[]) => void): () => void {
    this.eventSubscribers.push(callback);
    
    return () => {
      const index = this.eventSubscribers.indexOf(callback);
      if (index > -1) {
        this.eventSubscribers.splice(index, 1);
      }
    };
  }

  /**
   * Sync all calendar integrations
   */
  async syncAllCalendars(): Promise<void> {
    const integrations = Array.from(this.integrations.values()).filter(i => i.isEnabled);
    
    for (const integration of integrations) {
      try {
        integration.syncStatus = 'syncing';
        
        if (integration.type === 'google') {
          await this.syncGoogleCalendar(integration);
        } else if (integration.type === 'outlook') {
          await this.syncOutlookCalendar(integration);
        }
        
        integration.lastSync = new Date();
        integration.syncStatus = 'connected';
      } catch (error) {
        logger.error('Failed to sync calendar integration', { integrationName: integration.name, error });
        integration.syncStatus = 'error';
      }
    }

    this.saveIntegrationsToStorage();
    this.notifyEventSubscribers();
  }

  /**
   * Check for native calendar API support (experimental)
   */
  private checkNativeCalendarSupport(): void {
    // Check for experimental calendar API
    if ('calendar' in navigator) {
      logger.info('Native calendar API is available');
      // Could implement native calendar access here
    }
  }

  /**
   * Authenticate with Google Calendar API (mock implementation)
   */
  private async authenticateWithGoogle(integration: CalendarIntegration): Promise<void> {
    // In a real implementation, this would handle Google OAuth flow
    // For now, we'll simulate the authentication
    
    try {
      // Mock Google OAuth response
      integration.accessToken = 'mock_google_access_token';
      integration.refreshToken = 'mock_google_refresh_token';
      
      // Load initial events
      await this.loadMockGoogleEvents(integration.id);
    } catch (error) {
      throw new Error('Failed to authenticate with Google Calendar');
    }
  }

  /**
   * Load mock Google Calendar events
   */
  private async loadMockGoogleEvents(calendarId: string): Promise<void> {
    const mockEvents: CalendarEvent[] = [
      {
        id: 'google_event_1',
        title: 'Team Meeting',
        description: 'Weekly team standup meeting',
        location: {
          address: '123 Office St, San Francisco, CA'
        },
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
        allDay: false,
        calendarId,
        source: 'google',
        reminders: [
          { method: 'popup', minutes: 15 }
        ]
      },
      {
        id: 'google_event_2',
        title: 'Doctor Appointment',
        location: {
          address: '456 Medical Center Dr, San Francisco, CA'
        },
        startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // In 3 days
        endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 minutes later
        allDay: false,
        calendarId,
        source: 'google',
        reminders: [
          { method: 'popup', minutes: 60 }
        ]
      }
    ];

    mockEvents.forEach(event => {
      this.events.set(event.id, event);
    });
  }

  /**
   * Load mock Outlook Calendar events
   */
  private async loadMockOutlookEvents(calendarId: string): Promise<void> {
    const mockEvents: CalendarEvent[] = [
      {
        id: 'outlook_event_1',
        title: 'Client Presentation',
        description: 'Quarterly business review presentation',
        location: {
          address: '789 Business Ave, San Francisco, CA'
        },
        startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // In 2 days
        endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000), // 1.5 hours later
        allDay: false,
        calendarId,
        source: 'outlook',
        attendees: ['client@example.com', 'manager@company.com'],
        reminders: [
          { method: 'email', minutes: 30 }
        ]
      }
    ];

    mockEvents.forEach(event => {
      this.events.set(event.id, event);
    });
  }

  /**
   * Calculate travel suggestion for an event
   */
  private async calculateTravelSuggestion(
    event: CalendarEvent, 
    userLocation?: { lat: number; lng: number }
  ): Promise<TravelSuggestion> {
    // Mock travel calculation - in reality, would use routing API
    const baseTime = 30; // minutes
    const bufferTime = 15; // minutes
    const trafficFactor = 1.2;
    
    const totalTravelTime = Math.round(baseTime * trafficFactor);
    const departureTime = new Date(event.startTime.getTime() - (totalTravelTime + bufferTime) * 60 * 1000);

    return {
      eventId: event.id,
      departureTime,
      route: {
        from: userLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'Current Location',
        to: event.location!.address,
        duration: totalTravelTime,
        distance: 15000, // 15km
        mode: 'driving'
      },
      bufferTime,
      trafficFactor
    };
  }

  /**
   * Create event in Google Calendar (mock)
   */
  private async createGoogleEvent(event: CalendarEvent): Promise<void> {
    // Mock Google Calendar API call
    logger.debug('Creating Google Calendar event', { eventTitle: event.title, eventId: event.id });
  }

  /**
   * Create event in Outlook Calendar (mock)
   */
  private async createOutlookEvent(event: CalendarEvent): Promise<void> {
    // Mock Microsoft Graph API call
    logger.debug('Creating Outlook Calendar event', { eventTitle: event.title, eventId: event.id });
  }

  /**
   * Update event in Google Calendar (mock)
   */
  private async updateGoogleEvent(event: CalendarEvent): Promise<void> {
    logger.debug('Updating Google Calendar event', { eventTitle: event.title, eventId: event.id });
  }

  /**
   * Update event in Outlook Calendar (mock)
   */
  private async updateOutlookEvent(event: CalendarEvent): Promise<void> {
    logger.debug('Updating Outlook Calendar event', { eventTitle: event.title, eventId: event.id });
  }

  /**
   * Delete event from Google Calendar (mock)
   */
  private async deleteGoogleEvent(event: CalendarEvent): Promise<void> {
    logger.debug('Deleting Google Calendar event', { eventTitle: event.title, eventId: event.id });
  }

  /**
   * Delete event from Outlook Calendar (mock)
   */
  private async deleteOutlookEvent(event: CalendarEvent): Promise<void> {
    logger.debug('Deleting Outlook Calendar event', { eventTitle: event.title, eventId: event.id });
  }

  /**
   * Sync Google Calendar (mock)
   */
  private async syncGoogleCalendar(integration: CalendarIntegration): Promise<void> {
    // Mock sync process
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Sync Outlook Calendar (mock)
   */
  private async syncOutlookCalendar(integration: CalendarIntegration): Promise<void> {
    // Mock sync process
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Start periodic sync of all calendars
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 15 minutes
    this.syncInterval = setInterval(() => {
      this.syncAllCalendars();
    }, 15 * 60 * 1000);
  }

  /**
   * Notify event subscribers
   */
  private notifyEventSubscribers(): void {
    const events = Array.from(this.events.values());
    this.eventSubscribers.forEach(callback => {
      try {
        callback(events);
      } catch (error) {
        logger.error('Error in event subscriber', { error });
      }
    });
  }

  /**
   * Save integrations to localStorage
   */
  private saveIntegrationsToStorage(): void {
    try {
      const integrations = Array.from(this.integrations.values());
      localStorage.setItem('calendar_integrations', JSON.stringify(integrations));
    } catch (error) {
      logger.error('Failed to save calendar integrations', { error });
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.eventSubscribers = [];
    this.events.clear();
    this.integrations.clear();
  }
}

// Export singleton instance
export const calendarService = new CalendarService();
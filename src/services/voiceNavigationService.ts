/**
 * Voice Navigation Service
 * Provides turn-by-turn voice guidance during navigation
 */

import { logger } from '../utils/logger';
import { RouteDeviation } from './realtimeNavigationService';

interface NavigationStep {
  instruction: string;
  distance: number; // in meters
  maneuver?: string;
}

class VoiceNavigationService {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isEnabled: boolean = true;
  private lastAnnouncedStep: number = -1;
  private announcedTurns: Set<string> = new Set();
  private lastWrongWayAlert: number = 0;
  private lastDeviationAlert: number = 0;
  private lastAlternativeAlert: number = 0;
  private wrongWayCount: number = 0;
  
  // Cooldown periods to avoid spam (in milliseconds)
  private readonly WRONG_WAY_COOLDOWN = 10000; // 10 seconds
  private readonly DEVIATION_COOLDOWN = 15000; // 15 seconds
  private readonly ALTERNATIVE_COOLDOWN = 20000; // 20 seconds

  constructor() {
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      logger.info('Voice navigation initialized');
    } else {
      logger.warn('Speech synthesis not supported');
    }
  }

  /**
   * Speak navigation instruction
   */
  speak(text: string, priority: 'high' | 'normal' = 'normal'): void {
    if (!this.synthesis || !this.isEnabled) return;

    // Cancel current speech if high priority
    if (priority === 'high' && this.synthesis.speaking) {
      this.synthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    this.currentUtterance = utterance;
    this.synthesis.speak(utterance);
    logger.debug('Speaking:', text);
  }

  /**
   * Announce turn based on distance
   */
  announceTurn(instruction: string, distance: number, maneuver?: string): void {
    const turnKey = `${instruction}_${distance}`;
    
    // Avoid repeating the same announcement
    if (this.announcedTurns.has(turnKey)) return;

    let announcement = '';
    
    // Format the instruction for voice
    const cleanInstruction = instruction
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Clean extra spaces
      .trim();

    if (distance <= 50) {
      // Immediate turn
      announcement = this.getImmediateTurnPhrase(maneuver) || cleanInstruction;
      this.speak(announcement, 'high');
      this.announcedTurns.add(turnKey);
    } else if (distance <= 100) {
      // Turn coming up soon (100m warning for cars)
      announcement = `In 100 meters, ${this.getManeuverPhrase(maneuver) || cleanInstruction.toLowerCase()}`;
      this.speak(announcement, 'high');
      this.announcedTurns.add(turnKey);
    } else if (distance <= 300) {
      // Advance warning
      announcement = `In ${Math.round(distance / 10) * 10} meters, ${this.getManeuverPhrase(maneuver) || cleanInstruction.toLowerCase()}`;
      this.speak(announcement, 'normal');
      this.announcedTurns.add(turnKey);
    }
  }

  /**
   * Get immediate turn phrase
   */
  private getImmediateTurnPhrase(maneuver?: string): string {
    switch (maneuver) {
      case 'turn-left':
        return 'Turn left now';
      case 'turn-right':
        return 'Turn right now';
      case 'turn-sharp-left':
        return 'Sharp left turn now';
      case 'turn-sharp-right':
        return 'Sharp right turn now';
      case 'turn-slight-left':
        return 'Slight left now';
      case 'turn-slight-right':
        return 'Slight right now';
      case 'straight':
        return 'Continue straight';
      case 'ramp-left':
        return 'Take the ramp on the left';
      case 'ramp-right':
        return 'Take the ramp on the right';
      case 'merge':
        return 'Merge ahead';
      case 'fork-left':
        return 'Keep left at the fork';
      case 'fork-right':
        return 'Keep right at the fork';
      case 'roundabout-left':
        return 'At the roundabout, turn left';
      case 'roundabout-right':
        return 'At the roundabout, turn right';
      case 'uturn-left':
        return 'Make a U-turn';
      case 'uturn-right':
        return 'Make a U-turn';
      default:
        return '';
    }
  }

  /**
   * Get maneuver phrase for advance warning
   */
  private getManeuverPhrase(maneuver?: string): string {
    switch (maneuver) {
      case 'turn-left':
        return 'turn left';
      case 'turn-right':
        return 'turn right';
      case 'turn-sharp-left':
        return 'make a sharp left';
      case 'turn-sharp-right':
        return 'make a sharp right';
      case 'turn-slight-left':
        return 'turn slightly left';
      case 'turn-slight-right':
        return 'turn slightly right';
      case 'straight':
        return 'continue straight';
      case 'ramp-left':
        return 'take the left ramp';
      case 'ramp-right':
        return 'take the right ramp';
      case 'merge':
        return 'merge';
      case 'fork-left':
        return 'keep left';
      case 'fork-right':
        return 'keep right';
      case 'roundabout-left':
        return 'exit left at the roundabout';
      case 'roundabout-right':
        return 'exit right at the roundabout';
      case 'uturn-left':
      case 'uturn-right':
        return 'make a U-turn';
      default:
        return '';
    }
  }

  /**
   * Announce arrival at destination
   */
  announceArrival(): void {
    this.speak('You have arrived at your destination', 'high');
    // Clear announced turns for next navigation
    this.announcedTurns.clear();
  }

  /**
   * Announce route start
   */
  announceStart(totalDistance: string, totalTime: string): void {
    this.speak(`Starting navigation. Total distance ${totalDistance}, estimated time ${totalTime}`, 'normal');
  }

  /**
   * Announce when user is off route
   */
  announceOffRoute(): void {
    this.speak('You are off route. Recalculating', 'high');
  }

  /**
   * Toggle voice navigation on/off
   */
  toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    if (this.isEnabled) {
      this.speak('Voice navigation enabled', 'normal');
    }
    return this.isEnabled;
  }

  /**
   * Stop current speech
   */
  stop(): void {
    if (this.synthesis?.speaking) {
      this.synthesis.cancel();
    }
  }

  /**
   * Check if voice is enabled
   */
  isVoiceEnabled(): boolean {
    return this.isEnabled && this.synthesis !== null;
  }

  /**
   * Announce wrong-way detection with direction guidance
   */
  announceWrongWay(userHeading: number, correctHeading: number, transportMode: string): void {
    const now = Date.now();
    if (now - this.lastWrongWayAlert < this.WRONG_WAY_COOLDOWN) return;

    this.wrongWayCount++;
    this.lastWrongWayAlert = now;

    // Calculate how to correct direction
    const headingDiff = this.getAngleDifference(userHeading, correctHeading);
    const turnDirection = this.getTurnDirection(userHeading, correctHeading);
    
    let message: string;
    
    if (this.wrongWayCount === 1) {
      // First wrong-way alert - be gentle
      message = `You're heading in the wrong direction. Please ${turnDirection} to get back on route.`;
    } else if (this.wrongWayCount <= 3) {
      // Repeated wrong-way - be more direct
      if (headingDiff > 150) {
        // Nearly opposite direction
        message = `You're going the opposite way! Please turn around and head ${this.getCompassDirection(correctHeading)}.`;
      } else {
        message = `Still wrong direction. ${turnDirection} towards ${this.getCompassDirection(correctHeading)}.`;
      }
    } else {
      // Multiple wrong-ways - suggest stopping
      message = `Multiple wrong turns detected. Please stop safely and check your route, then head ${this.getCompassDirection(correctHeading)}.`;
    }

    this.speak(message, 'high');
    logger.warn('🔊 Wrong-way alert:', { userHeading, correctHeading, count: this.wrongWayCount });
  }

  /**
   * Announce route deviation with guidance
   */
  announceRouteDeviation(deviation: RouteDeviation, transportMode: string): void {
    const now = Date.now();
    if (now - this.lastDeviationAlert < this.DEVIATION_COOLDOWN) return;

    this.lastDeviationAlert = now;
    const distance = Math.round(deviation.deviationDistance);
    const duration = Math.round(deviation.deviationDuration);

    let message: string;

    switch (deviation.suggestedAction) {
      case 'return':
        if (distance < 20) {
          message = `You're slightly off route. Please return to the path.`;
        } else {
          message = `You're ${distance} meters off route. Please head back to the main path.`;
        }
        break;
        
      case 'recalculate':
        message = `You've been off route for ${duration} seconds. Recalculating a new route from your location.`;
        break;
        
      case 'alternative':
        message = `You're off the main route. Looking for alternative paths from here.`;
        break;
    }

    this.speak(message, 'high');
  }

  /**
   * Announce alternative route suggestions
   */
  announceAlternativeRoute(routes: google.maps.DirectionsRoute[], selectedIndex: number = 0): void {
    const now = Date.now();
    if (now - this.lastAlternativeAlert < this.ALTERNATIVE_COOLDOWN) return;

    this.lastAlternativeAlert = now;
    
    if (routes.length <= 1) return;

    const mainRoute = routes[0];
    const alternativeRoute = routes[1];
    
    const mainTime = mainRoute.legs[0]?.duration?.text || 'unknown';
    const altTime = alternativeRoute.legs[0]?.duration?.text || 'unknown';
    
    const mainDistance = mainRoute.legs[0]?.distance?.text || 'unknown';
    const altDistance = alternativeRoute.legs[0]?.distance?.text || 'unknown';

    let message: string;
    
    if (routes.length === 2) {
      message = `I found an alternative route. Main route: ${mainTime}, ${mainDistance}. Alternative: ${altTime}, ${altDistance}. Continuing with the fastest option.`;
    } else {
      message = `I found ${routes.length} alternative routes. Taking the fastest one: ${mainTime}, ${mainDistance}.`;
    }

    this.speak(message, 'normal');
    logger.info('🔊 Alternative routes announced:', routes.length);
  }

  /**
   * Provide directional guidance based on compass heading
   */
  announceDirectionalGuidance(currentHeading: number, targetHeading: number, transportMode: string): void {
    const turnDirection = this.getTurnDirection(currentHeading, targetHeading);
    const compassDirection = this.getCompassDirection(targetHeading);
    
    const transportEmoji = {
      walking: '🚶',
      cycling: '🚴', 
      driving: '🚗',
      transit: '🚌'
    }[transportMode as keyof typeof transportEmoji] || '🚶';
    
    const message = `${transportEmoji} Head ${turnDirection} towards ${compassDirection}`;
    this.speak(message, 'normal');
  }

  /**
   * Announce back on route
   */
  announceBackOnRoute(): void {
    this.wrongWayCount = 0; // Reset wrong-way counter
    this.speak('Great! You\'re back on the correct route.', 'normal');
  }

  /**
   * Speed-based guidance announcements
   */
  announceSpeedGuidance(currentSpeed: number, transportMode: string): void {
    const speedKmh = currentSpeed * 3.6; // Convert m/s to km/h
    
    let message: string | null = null;
    
    switch (transportMode) {
      case 'walking':
        if (speedKmh > 8) {
          message = 'You seem to be moving quite fast for walking. Consider switching to cycling mode.';
        }
        break;
      case 'cycling':
        if (speedKmh < 5) {
          message = 'You\'re moving slowly. Consider switching to walking mode for better directions.';
        } else if (speedKmh > 25) {
          message = 'You\'re moving quite fast. Consider switching to driving mode.';
        }
        break;
      case 'driving':
        if (speedKmh < 10) {
          message = 'You\'re in heavy traffic or moving slowly. I\'ll provide more frequent updates.';
        }
        break;
    }
    
    if (message) {
      this.speak(message, 'normal');
    }
  }

  /**
   * Get turn direction instruction
   */
  private getTurnDirection(fromHeading: number, toHeading: number): string {
    const diff = this.getSignedAngleDifference(fromHeading, toHeading);
    
    if (Math.abs(diff) < 15) return 'continue straight';
    if (Math.abs(diff) > 150) return 'turn around';
    
    if (diff > 0) {
      if (diff < 45) return 'turn slightly right';
      if (diff < 135) return 'turn right';
      return 'turn sharp right';
    } else {
      if (diff > -45) return 'turn slightly left';
      if (diff > -135) return 'turn left';
      return 'turn sharp left';
    }
  }

  /**
   * Get compass direction from heading
   */
  private getCompassDirection(heading: number): string {
    const directions = [
      'north', 'northeast', 'east', 'southeast',
      'south', 'southwest', 'west', 'northwest'
    ];
    
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  }

  /**
   * Get angle difference between two bearings
   */
  private getAngleDifference(angle1: number, angle2: number): number {
    let diff = Math.abs(angle1 - angle2);
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

  /**
   * Get signed angle difference (positive = clockwise)
   */
  private getSignedAngleDifference(from: number, to: number): number {
    let diff = to - from;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
  }

  /**
   * Reset all counters and alerts (for new navigation)
   */
  reset(): void {
    this.announcedTurns.clear();
    this.lastAnnouncedStep = -1;
    this.wrongWayCount = 0;
    this.lastWrongWayAlert = 0;
    this.lastDeviationAlert = 0;
    this.lastAlternativeAlert = 0;
  }
}

// Export singleton instance
export const voiceNavigationService = new VoiceNavigationService();
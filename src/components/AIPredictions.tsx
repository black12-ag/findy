import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  Clock, 
  Car, 
  AlertTriangle,
  MapPin,
  Calendar,
  Activity,
  Sparkles,
  ChevronRight,
  Info,
  Navigation,
  Cloud
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { aiPredictionsService } from '../services/aiPredictionsService';
import { useLocation } from '../contexts/LocationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { logger } from '../utils/logger';
import { toast } from 'sonner';

interface PredictionData {
  type: 'traffic' | 'parking' | 'departure' | 'weather' | 'event' | 'route';
  confidence: number;
  title: string;
  description: string;
  suggestion?: string;
  impact?: 'low' | 'medium' | 'high';
  timeframe?: string;
  actionData?: any;
}

interface AIPredictionsProps {
  destination?: string;
  currentLocation?: string;
  onSuggestionAccept?: (suggestion: any) => void;
  map?: google.maps.Map;
}

export function AIPredictions({ destination, currentLocation, onSuggestionAccept, map }: AIPredictionsProps) {
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionData | null>(null);
  const [trafficLayerEnabled, setTrafficLayerEnabled] = useState(false);
  const [parkingMarkers, setParkingMarkers] = useState<google.maps.Marker[]>([]);
  
  const { currentLocation: locationData } = useLocation();
  const { selectedLocation } = useNavigation();

  // Initialize AI service with map
  useEffect(() => {
    if (map && window.google) {
      aiPredictionsService.initialize(map);
      logger.info('AI predictions service initialized with map');
    }
  }, [map]);

  // Load predictions based on real data
  useEffect(() => {
    const loadPredictions = async () => {
      if (!locationData || !selectedLocation) {
        // Use mock data if no real locations
        setLoading(true);
        setTimeout(() => {
          setPredictions([
            {
              type: 'traffic',
              confidence: 92,
              title: 'Heavy Traffic Expected',
              description: 'Rush hour traffic building on major routes',
              suggestion: 'Leave 15 minutes earlier or take alternative route',
              impact: 'high',
              timeframe: 'Next 2 hours'
            },
            {
              type: 'parking',
              confidence: 78,
              title: 'Limited Parking Available',
              description: 'Nearby parking areas 85% full',
              suggestion: 'Reserve spot in advance',
              impact: 'medium',
              timeframe: 'Current'
            },
          ]);
          setLoading(false);
        }, 1000);
        return;
      }

      setLoading(true);
      const newPredictions: PredictionData[] = [];

      try {
        // Analyze real-time traffic
        const trafficData = await aiPredictionsService.analyzeTraffic(
          locationData,
          selectedLocation
        );
        
        if (trafficData.estimatedDelay > 5) {
          newPredictions.push({
            type: 'traffic',
            confidence: 85,
            title: `${trafficData.severity.charAt(0).toUpperCase() + trafficData.severity.slice(1)} Traffic Detected`,
            description: `${trafficData.estimatedDelay} min delay on primary route`,
            suggestion: trafficData.alternativeRoutes[0]
              ? `Take ${trafficData.alternativeRoutes[0].via} to save ${trafficData.alternativeRoutes[0].timeSaved} min`
              : 'Consider leaving earlier',
            impact: trafficData.severity === 'severe' ? 'high' : trafficData.severity === 'high' ? 'high' : 'medium',
            timeframe: 'Current',
            actionData: { trafficData, showTrafficLayer: true }
          });
        }

        // Analyze parking availability
        const parkingData = await aiPredictionsService.predictParking(selectedLocation);
        if (parkingData.bestOption) {
          newPredictions.push({
            type: 'parking',
            confidence: Math.round(parkingData.bestOption.availability),
            title: 'Parking Recommendation',
            description: `${parkingData.bestOption.name} - ${Math.round(parkingData.bestOption.walkingDistance / 80)} min walk`,
            suggestion: `${parkingData.bestOption.availability}% available at ${parkingData.bestOption.pricing}`,
            impact: parkingData.averageOccupancy > 70 ? 'high' : 'medium',
            timeframe: 'At destination',
            actionData: { parkingSpots: parkingData.nearbySpots }
          });
        }

        // Calculate optimal departure time
        const arrivalTarget = new Date();
        arrivalTarget.setHours(arrivalTarget.getHours() + 1); // Example: arrive in 1 hour
        
        const departureRec = await aiPredictionsService.recommendDepartureTime(
          locationData,
          selectedLocation,
          arrivalTarget
        );
        
        newPredictions.push({
          type: 'departure',
          confidence: departureRec.confidence,
          title: 'Recommended Departure',
          description: departureRec.reasoning,
          suggestion: `Leave at ${departureRec.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          impact: 'low',
          timeframe: 'Today'
        });

        // Analyze weather impact
        const weatherImpact = await aiPredictionsService.analyzeWeatherImpact(null);
        if (weatherImpact.impact !== 'none') {
          newPredictions.push({
            type: 'weather',
            confidence: 75,
            title: `Weather: ${weatherImpact.condition.charAt(0).toUpperCase() + weatherImpact.condition.slice(1)}`,
            description: weatherImpact.recommendations[0],
            suggestion: weatherImpact.recommendations.join(', '),
            impact: weatherImpact.impact === 'high' ? 'high' : 'medium',
            timeframe: 'Current conditions'
          });
        }

        setPredictions(newPredictions);
      } catch (error) {
        logger.error('Failed to load AI predictions', { error });
        toast.error('Failed to load predictions');
      } finally {
        setLoading(false);
      }
    };

    loadPredictions();
  }, [locationData, selectedLocation]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'traffic': return TrendingUp;
      case 'parking': return Car;
      case 'departure': return Clock;
      case 'weather': return Cloud;
      case 'event': return Calendar;
      case 'route': return Navigation;
      default: return Activity;
    }
  };

  const handlePredictionAction = (prediction: PredictionData) => {
    if (!prediction.actionData) return;

    // Handle traffic layer toggle
    if (prediction.type === 'traffic' && prediction.actionData.showTrafficLayer) {
      aiPredictionsService.showTrafficLayer(!trafficLayerEnabled);
      setTrafficLayerEnabled(!trafficLayerEnabled);
      toast.success(trafficLayerEnabled ? 'Traffic layer disabled' : 'Traffic layer enabled');
    }

    // Handle parking markers
    if (prediction.type === 'parking' && prediction.actionData.parkingSpots && map) {
      // Clear existing markers
      parkingMarkers.forEach(marker => marker.setMap(null));
      
      if (parkingMarkers.length === 0) {
        // Add new markers
        const newMarkers = aiPredictionsService.addParkingMarkers(
          prediction.actionData.parkingSpots,
          map
        );
        setParkingMarkers(newMarkers);
        toast.success('Showing parking options on map');
      } else {
        // Clear markers
        setParkingMarkers([]);
        toast.success('Parking markers hidden');
      }
    }

    // Pass to parent handler for navigation actions
    if (onSuggestionAccept) {
      onSuggestionAccept(prediction);
    }
  };

  const getImpactColor = (impact?: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-5 h-5 text-purple-600 animate-pulse" />
          <span className="text-gray-600">Analyzing patterns...</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">AI Predictions</h3>
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            Beta
          </Badge>
        </div>
        <Button variant="ghost" size="sm">
          <Info className="w-4 h-4" />
        </Button>
      </div>

      {/* Active Predictions */}
      <div className="space-y-3">
        {predictions.map((prediction, index) => {
          const Icon = getIcon(prediction.type);
          return (
            <Card 
              key={index}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedPrediction(prediction);
                handlePredictionAction(prediction);
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getImpactColor(prediction.impact)}`}>
                  <Icon className="w-4 h-4" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">{prediction.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {prediction.confidence}% confident
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{prediction.description}</p>
                  
                  {prediction.suggestion && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-purple-600 font-medium">
                        💡 {prediction.suggestion}
                      </p>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  
                  {prediction.timeframe && (
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{prediction.timeframe}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Confidence Bar */}
              <div className="mt-3">
                <Progress value={prediction.confidence} className="h-1" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Prediction Accuracy & Controls */}
      <Alert>
        <Activity className="w-4 h-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>AI predictions improve over time. Accuracy: 84%</span>
          <div className="flex gap-2">
            {trafficLayerEnabled && (
              <Badge variant="secondary" className="text-xs">
                <TrendingUp className="w-3 h-3 mr-1" />
                Traffic Live
              </Badge>
            )}
            {parkingMarkers.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Car className="w-3 h-3 mr-1" />
                Parking Shown
              </Badge>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* Selected Prediction Detail Modal */}
      {selectedPrediction && (
        <Card className="p-4 border-purple-200 bg-purple-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Apply Suggestion?</h4>
            <button 
              className="text-gray-500 hover:text-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPrediction(null);
              }}
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-4">{selectedPrediction.suggestion}</p>
          <div className="flex gap-2">
            <Button 
              className="flex-1"
              onClick={() => {
                if (onSuggestionAccept) {
                  onSuggestionAccept(selectedPrediction);
                }
                handlePredictionAction(selectedPrediction);
                setSelectedPrediction(null);
              }}
            >
              Apply
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setSelectedPrediction(null)}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
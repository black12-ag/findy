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
  Info
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';

interface PredictionData {
  type: 'traffic' | 'parking' | 'departure' | 'weather' | 'event';
  confidence: number;
  title: string;
  description: string;
  suggestion?: string;
  impact?: 'low' | 'medium' | 'high';
  timeframe?: string;
}

interface AIPredictionsProps {
  destination?: string;
  currentLocation?: string;
  onSuggestionAccept?: (suggestion: string) => void;
}

export function AIPredictions({ destination, currentLocation, onSuggestionAccept }: AIPredictionsProps) {
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionData | null>(null);

  useEffect(() => {
    // Simulate AI predictions loading
    const timer = setTimeout(() => {
      setPredictions([
        {
          type: 'traffic',
          confidence: 92,
          title: 'Heavy Traffic Expected',
          description: 'Rush hour traffic building on I-405 North',
          suggestion: 'Leave 15 minutes earlier or take SR-520',
          impact: 'high',
          timeframe: 'Next 2 hours'
        },
        {
          type: 'parking',
          confidence: 78,
          title: 'Limited Parking Available',
          description: 'Downtown parking garages 85% full',
          suggestion: 'Reserve spot at Park Plaza ($12/day)',
          impact: 'medium',
          timeframe: 'Current'
        },
        {
          type: 'departure',
          confidence: 95,
          title: 'Optimal Departure Time',
          description: 'Based on your calendar and traffic patterns',
          suggestion: 'Leave at 2:45 PM for 3:30 PM meeting',
          impact: 'low',
          timeframe: 'Today'
        },
        {
          type: 'weather',
          confidence: 88,
          title: 'Rain Expected',
          description: 'Heavy rain starting around 5 PM',
          suggestion: 'Plan indoor parking or bring umbrella',
          impact: 'medium',
          timeframe: 'This evening'
        },
        {
          type: 'event',
          confidence: 71,
          title: 'Sports Event Nearby',
          description: 'Mariners game at 7:10 PM causing congestion',
          suggestion: 'Avoid stadium area after 6 PM',
          impact: 'high',
          timeframe: 'Tonight'
        }
      ]);
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [destination]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'traffic': return TrendingUp;
      case 'parking': return Car;
      case 'departure': return Clock;
      case 'weather': return AlertTriangle;
      case 'event': return Calendar;
      default: return Activity;
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
              onClick={() => setSelectedPrediction(prediction)}
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

      {/* Prediction Accuracy */}
      <Alert>
        <Activity className="w-4 h-4" />
        <AlertDescription>
          AI predictions improve over time based on your driving patterns and preferences.
          Current accuracy: 84%
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
                if (selectedPrediction.suggestion && onSuggestionAccept) {
                  onSuggestionAccept(selectedPrediction.suggestion);
                }
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
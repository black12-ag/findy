import React, { useState, useEffect } from 'react';
import { Bug, Send, Trash2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { logger } from '../utils/logger';
import { toast } from 'sonner';

interface CrashReport {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  id?: string;
}

interface UserFeedback {
  reportId: string;
  feedback: string;
  email?: string;
  timestamp: string;
}

const CrashReporting: React.FC = () => {
  const [crashReports, setCrashReports] = useState<CrashReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<CrashReport | null>(null);
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  useEffect(() => {
    loadCrashReports();
  }, []);

  const loadCrashReports = () => {
    try {
      const reports = JSON.parse(localStorage.getItem('crashReports') || '[]');
      setCrashReports(reports.map((report: CrashReport, index: number) => ({
        ...report,
        id: `crash_${index}_${Date.parse(report.timestamp)}`
      })));
    } catch (error) {
      logger.error('Failed to load crash reports:', error);
    }
  };

  const clearCrashReports = () => {
    localStorage.removeItem('crashReports');
    setCrashReports([]);
    setSelectedReport(null);
    setShowFeedbackForm(false);
  };

  const submitFeedback = async () => {
    if (!selectedReport || !feedback.trim()) return;

    setIsSubmitting(true);
    
    try {
      const userFeedback: UserFeedback = {
        reportId: selectedReport.id || 'unknown',
        feedback: feedback.trim(),
        email: email.trim() || undefined,
        timestamp: new Date().toISOString()
      };

      // Store feedback locally (in a real app, you'd send this to a server)
      const existingFeedback = JSON.parse(localStorage.getItem('crashFeedback') || '[]');
      existingFeedback.push(userFeedback);
      localStorage.setItem('crashFeedback', JSON.stringify(existingFeedback));

      // In a real app, you'd send this to your crash reporting service
      logger.info('Crash feedback submitted:', userFeedback);

      // Reset form
      setFeedback('');
      setEmail('');
      setShowFeedbackForm(false);
      
      // Show success message
      toast.success('Thank you for your feedback! This helps us improve the app.');
      
    } catch (error) {
      logger.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getErrorSeverity = (error: CrashReport) => {
    if (error.message.toLowerCase().includes('network') || 
        error.message.toLowerCase().includes('fetch')) {
      return 'low';
    }
    if (error.message.toLowerCase().includes('permission') || 
        error.message.toLowerCase().includes('geolocation')) {
      return 'medium';
    }
    return 'high';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-yellow-100 text-yellow-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (crashReports.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bug className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Crash Reports
          </h3>
          <p className="text-gray-600">
            Great! The app is running smoothly with no recorded crashes.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <h2 className="text-xl font-semibold">Crash Reports</h2>
          <Badge variant="secondary">{crashReports.length}</Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={clearCrashReports}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All
        </Button>
      </div>

      {/* Crash Reports List */}
      <div className="grid gap-4">
        {crashReports.map((report) => {
          const severity = getErrorSeverity(report);
          
          return (
            <Card
              key={report.id}
              className={`p-4 cursor-pointer transition-all ${
                selectedReport?.id === report.id
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : 'hover:shadow-md'
              }`}
              onClick={() => setSelectedReport(report)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge className={getSeverityColor(severity)}>
                      {severity.toUpperCase()}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {formatTimestamp(report.timestamp)}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">
                    {report.message}
                  </h3>
                  <p className="text-sm text-gray-600 truncate">
                    {report.url}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedReport(report);
                    setShowFeedbackForm(true);
                  }}
                >
                  <Bug className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Detailed Report View */}
      {selectedReport && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Error Details</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Error Message
              </label>
              <p className="text-sm bg-red-50 p-3 rounded border text-red-800">
                {selectedReport.message}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL
              </label>
              <p className="text-sm text-gray-600">{selectedReport.url}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timestamp
              </label>
              <p className="text-sm text-gray-600">
                {formatTimestamp(selectedReport.timestamp)}
              </p>
            </div>

            {selectedReport.stack && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stack Trace
                </label>
                <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto text-gray-700">
                  {selectedReport.stack}
                </pre>
              </div>
            )}

            <div className="flex space-x-3">
              <Button
                onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                className="flex-1"
              >
                <Send className="w-4 h-4 mr-2" />
                {showFeedbackForm ? 'Hide' : 'Provide'} Feedback
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Feedback Form */}
      {showFeedbackForm && selectedReport && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Help Us Fix This Issue</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What were you doing when this error occurred? *
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Please describe what you were trying to do when the error happened..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email (optional)
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com (for follow-up if needed)"
              />
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={submitFeedback}
                disabled={isSubmitting || !feedback.trim()}
                className="flex-1"
              >
                {isSubmitting ? (
                  <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Submit Feedback
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFeedbackForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CrashReporting;
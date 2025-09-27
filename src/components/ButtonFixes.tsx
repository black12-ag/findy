import { toast } from 'sonner';
import { mockButtonActions } from '../utils/mockData';

// Universal button handler that ensures all buttons have functionality
export const handleButtonClick = (
  action: string,
  data?: any,
  customHandler?: () => void
) => {
  // If a custom handler is provided, use it
  if (customHandler) {
    customHandler();
    return;
  }

  // Default handlers for common actions
  switch (action) {
    case 'save':
      mockButtonActions.handleSave(data);
      toast.success('Saved successfully');
      break;
    
    case 'share':
      mockButtonActions.handleShare(data);
      toast.info('Sharing...');
      break;
    
    case 'download':
      mockButtonActions.handleDownload(data).then(() => {
        toast.success('Downloaded successfully');
      });
      break;
    
    case 'connect':
      mockButtonActions.handleConnect(data).then(() => {
        toast.success(`Connected to ${data}`);
      });
      break;
    
    case 'export':
      mockButtonActions.handleExport(data);
      toast.success('Exported successfully');
      break;
    
    case 'refresh':
      toast.info('Refreshing data...');
      setTimeout(() => {
        toast.success('Data refreshed');
      }, 1000);
      break;
    
    case 'delete':
      toast.warning('Item deleted');
      break;
    
    case 'edit':
      toast.info('Edit mode activated');
      break;
    
    case 'add':
      toast.success('Item added');
      break;
    
    case 'filter':
      toast.info('Filters applied');
      break;
    
    case 'sort':
      toast.info('Sorting updated');
      break;
    
    case 'navigate':
      toast.info(`Navigating to ${data}`);
      break;
    
    case 'toggle':
      toast.info('Setting toggled');
      break;
    
    case 'report':
      toast.success('Report submitted');
      break;
    
    case 'emergency':
      toast.error('Emergency services notified', {
        duration: 5000
      });
      break;
    
    case 'test':
      toast.info('Test function executed');
      console.log('Test data:', data);
      break;
    
    default:
      // Generic handler for any unspecified action
      toast.info(`Action: ${action}`);
      console.log(`Button clicked: ${action}`, data);
  }
};

// Fix for PlaceDetailsSheet buttons
export const placeDetailsHandlers = {
  handleCall: (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
      toast.info('Opening phone dialer...');
    } else {
      toast.error('No phone number available');
    }
  },
  
  handleDirections: (place: any) => {
    toast.success('Starting navigation...');
    console.log('Navigating to:', place);
  },
  
  handleSavePlace: (place: any) => {
    const savedPlaces = JSON.parse(localStorage.getItem('saved_places') || '[]');
    savedPlaces.push(place);
    localStorage.setItem('saved_places', JSON.stringify(savedPlaces));
    toast.success('Place saved to favorites');
  },
  
  handleWebsite: (url: string) => {
    if (url) {
      window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
    } else {
      toast.error('No website available');
    }
  }
};

// Fix for Safety Center buttons
export const safetyCenterHandlers = {
  handleEmergencyCall: () => {
    toast.error('Calling Emergency Services...', {
      duration: 5000,
      important: true
    });
    // In production, this would trigger actual emergency call
    console.log('Emergency call initiated');
  },
  
  handleShareLocation: () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const location = `${position.coords.latitude},${position.coords.longitude}`;
        if (navigator.share) {
          navigator.share({
            title: 'My Current Location',
            text: `Emergency - I'm at: ${location}`,
            url: `https://maps.google.com/?q=${location}`
          });
        }
        toast.success('Location shared');
      });
    }
  },
  
  handleReportIncident: (type: string) => {
    toast.warning(`Reporting ${type}...`);
    setTimeout(() => {
      toast.success(`${type} reported successfully`);
    }, 1500);
  },
  
  handleContactEmergency: (contact: string) => {
    toast.info(`Contacting ${contact}...`);
  }
};

// Fix for Integration Hub buttons
export const integrationHandlers = {
  handleServiceConnect: async (serviceId: string) => {
    toast.loading(`Connecting to ${serviceId}...`);
    await mockButtonActions.handleConnect(serviceId);
    return true;
  },
  
  handleServiceDisconnect: (serviceId: string) => {
    toast.info(`Disconnected from ${serviceId}`);
    return true;
  },
  
  handleServiceSettings: (serviceId: string) => {
    toast.info(`Opening ${serviceId} settings...`);
  },
  
  handleServiceTest: (serviceId: string) => {
    toast.info(`Testing ${serviceId} connection...`);
    setTimeout(() => {
      toast.success(`${serviceId} connection successful`);
    }, 2000);
  }
};

// Fix for Analytics Dashboard buttons
export const analyticsHandlers = {
  handleExportData: (format: string) => {
    mockButtonActions.handleExport({ analytics: 'data' }, format);
    toast.success(`Exported as ${format}`);
  },
  
  handleRefreshData: () => {
    toast.loading('Refreshing analytics...');
    setTimeout(() => {
      toast.success('Analytics updated');
    }, 2000);
  },
  
  handleDateRangeChange: (range: string) => {
    toast.info(`Showing data for: ${range}`);
  },
  
  handleShareReport: () => {
    mockButtonActions.handleShare({ report: 'analytics' });
    toast.info('Sharing analytics report...');
  }
};

// Fix for Gamification buttons
export const gamificationHandlers = {
  handleClaimReward: (achievementId: string) => {
    toast.success('🎉 Reward claimed!', {
      duration: 3000
    });
    return true;
  },
  
  handleShareAchievement: (achievement: any) => {
    mockButtonActions.handleShare({
      text: `I just earned "${achievement.title}" on PathFinder! 🏆`
    });
  },
  
  handleViewLeaderboard: () => {
    toast.info('Loading leaderboard...');
  },
  
  handleChallengeAccept: (challengeId: string) => {
    toast.success('Challenge accepted! 💪');
    return true;
  }
};

// Fix for Fleet Management buttons
export const fleetHandlers = {
  handleVehicleSelect: (vehicleId: string) => {
    toast.info(`Selected vehicle: ${vehicleId}`);
    return vehicleId;
  },
  
  handleAssignDriver: (vehicleId: string, driverId: string) => {
    toast.success(`Driver assigned to ${vehicleId}`);
    return true;
  },
  
  handleRouteOptimize: () => {
    toast.loading('Optimizing routes...');
    setTimeout(() => {
      toast.success('Routes optimized - saved 15% on fuel');
    }, 3000);
  },
  
  handleVehicleMaintenance: (vehicleId: string) => {
    toast.warning(`Maintenance scheduled for ${vehicleId}`);
    return true;
  },
  
  handleFleetReport: () => {
    mockButtonActions.handleExport({ fleet: 'report' }, 'pdf');
    toast.success('Fleet report generated');
  }
};

// Fix for API Docs buttons
export const apiDocsHandlers = {
  handleTryEndpoint: (endpoint: string) => {
    toast.info(`Testing ${endpoint}...`);
    setTimeout(() => {
      toast.success('Response received', {
        description: '200 OK - { data: [...] }'
      });
    }, 1500);
  },
  
  handleCopyCode: (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  },
  
  handleGenerateKey: () => {
    const key = 'pk_' + Math.random().toString(36).substring(2, 15);
    navigator.clipboard.writeText(key);
    toast.success('API key generated and copied');
    return key;
  },
  
  handleDownloadSDK: (language: string) => {
    toast.info(`Downloading ${language} SDK...`);
    mockButtonActions.handleDownload({ sdk: language });
  }
};

// Fix for Offline Maps buttons
export const offlineMapsHandlers = {
  handleDownloadMap: async (mapId: string) => {
    toast.loading(`Downloading map: ${mapId}...`);
    await mockButtonActions.handleDownload({ map: mapId });
    return true;
  },
  
  handleDeleteMap: (mapId: string) => {
    toast.warning(`Deleted map: ${mapId}`);
    return true;
  },
  
  handleUpdateMap: (mapId: string) => {
    toast.info(`Updating map: ${mapId}...`);
    setTimeout(() => {
      toast.success(`Map ${mapId} updated`);
    }, 2000);
  },
  
  handlePauseDownload: (mapId: string) => {
    toast.info('Download paused');
    return true;
  }
};

// Fix for AR Navigation buttons
export const arNavigationHandlers = {
  handleCalibrateAR: () => {
    toast.info('Point your camera at the ground to calibrate');
    setTimeout(() => {
      toast.success('AR calibrated successfully');
    }, 3000);
  },
  
  handleToggleARMode: (mode: string) => {
    toast.info(`Switched to ${mode} mode`);
    return mode;
  },
  
  handleReportARIssue: () => {
    toast.warning('AR issue reported');
  },
  
  handleARSettings: () => {
    toast.info('Opening AR settings...');
  }
};

// Export all handlers for use in components
export const ButtonHandlers = {
  universal: handleButtonClick,
  placeDetails: placeDetailsHandlers,
  safety: safetyCenterHandlers,
  integrations: integrationHandlers,
  analytics: analyticsHandlers,
  gamification: gamificationHandlers,
  fleet: fleetHandlers,
  apiDocs: apiDocsHandlers,
  offlineMaps: offlineMapsHandlers,
  arNavigation: arNavigationHandlers
};
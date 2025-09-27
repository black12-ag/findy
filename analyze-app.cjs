#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of all screens in the app
const SCREENS = [
  'map', 'search', 'route', 'navigation', 'saved', 'settings', 
  'transit', 'offline', 'ar', 'social', 'profile', 'voice', 
  'eta-share', 'safety', 'integrations', 'ai-predictions', 
  'analytics', 'parking', 'gamification', 'fleet', 'api-docs', 
  'multi-stop', 'ors-config', 'developer', 'place-details', 
  'push-settings', 'device-test', 'crash-reports'
];

// Components to analyze
const COMPONENTS = [
  'SearchPanel', 'NavigationPanel', 'BottomNavigation', 'EnhancedRoutePanel',
  'SettingsPanel', 'SavedPlacesPanel', 'PublicTransitPanel', 'OfflineMapsPanel',
  'ARNavigationPanel', 'SocialPanelFixed', 'ProfilePanel', 'VoiceCommandPanel',
  'PushNotificationSettings', 'DeviceIntegrationTest', 'CrashReporting',
  'SmartNotifications', 'ETASharingPanel', 'TransportModeSelector', 'SafetyCenter',
  'IntegrationsHub', 'AIPredictions', 'AnalyticsDashboard', 'ParkingFinder',
  'Gamification', 'FleetManagement', 'APIDocs', 'MultiStopRoutePlanner',
  'ORSConfigPanel', 'DeveloperPanel', 'PlaceDetailsSheet'
];

console.log('🔍 Analyzing Comtion Navigation App\n');
console.log('=====================================\n');

// Analysis results
const analysis = {
  totalScreens: SCREENS.length,
  totalComponents: COMPONENTS.length,
  buttonsWithoutHandlers: [],
  emptyPages: [],
  missingFeatures: [],
  workingFeatures: [],
  navigationPaths: {}
};

// Check each component file
console.log('📊 Component Analysis:\n');

COMPONENTS.forEach(componentName => {
  const possiblePaths = [
    path.join(__dirname, 'src', 'components', `${componentName}.tsx`),
    path.join(__dirname, 'src', 'components', 'safety', `${componentName}.tsx`),
    path.join(__dirname, 'src', 'components', 'integrations', `${componentName}.tsx`)
  ];
  
  let componentPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      componentPath = p;
      break;
    }
  }
  
  if (componentPath) {
    const content = fs.readFileSync(componentPath, 'utf8');
    
    // Count buttons and handlers
    const buttonMatches = content.match(/<Button/g) || [];
    const onClickMatches = content.match(/onClick/g) || [];
    
    // Check for empty states
    const hasEmptyState = content.includes('No data') || 
                         content.includes('Coming soon') || 
                         content.includes('Not implemented');
    
    // Check for mock data
    const hasMockData = content.includes('mock') || 
                       content.includes('sample') || 
                       content.includes('demo');
    
    console.log(`${componentName}:`);
    console.log(`  ✓ Buttons: ${buttonMatches.length}`);
    console.log(`  ✓ Click handlers: ${onClickMatches.length}`);
    
    if (buttonMatches.length > onClickMatches.length) {
      console.log(`  ⚠️ Warning: More buttons than handlers!`);
      analysis.buttonsWithoutHandlers.push(componentName);
    }
    
    if (hasEmptyState) {
      console.log(`  ⚠️ Has empty states or placeholder content`);
      analysis.emptyPages.push(componentName);
    }
    
    if (hasMockData) {
      console.log(`  ℹ️ Uses mock/demo data`);
    }
    
    console.log('');
  } else {
    console.log(`${componentName}: ⚠️ File not found\n`);
    analysis.missingFeatures.push(componentName);
  }
});

// Check App.tsx for screen implementations
console.log('\n📱 Screen Implementation Check:\n');

const appPath = path.join(__dirname, 'src', 'App.tsx');
if (fs.existsSync(appPath)) {
  const appContent = fs.readFileSync(appPath, 'utf8');
  
  SCREENS.forEach(screen => {
    const casePattern = new RegExp(`case '${screen}':`);
    if (appContent.match(casePattern)) {
      console.log(`✓ ${screen} screen implemented`);
      analysis.workingFeatures.push(screen);
      
      // Check if it returns actual content
      const screenSection = appContent.split(`case '${screen}':`)[1]?.split('case ')[0];
      if (screenSection) {
        if (screenSection.includes('return (') || screenSection.includes('return <')) {
          // Screen has content
        } else {
          console.log(`  ⚠️ May have empty implementation`);
          analysis.emptyPages.push(screen);
        }
      }
    } else {
      console.log(`✗ ${screen} screen not implemented`);
      analysis.missingFeatures.push(screen);
    }
  });
}

// Summary
console.log('\n=====================================');
console.log('📈 Summary Report\n');
console.log(`Total Screens: ${analysis.totalScreens}`);
console.log(`Implemented Screens: ${analysis.workingFeatures.length}`);
console.log(`Components: ${analysis.totalComponents}`);
console.log(`Components with Button Issues: ${analysis.buttonsWithoutHandlers.length}`);
console.log(`Pages with Empty Content: ${analysis.emptyPages.length}`);
console.log(`Missing Features: ${analysis.missingFeatures.length}`);

if (analysis.buttonsWithoutHandlers.length > 0) {
  console.log('\n⚠️ Components with potential button issues:');
  analysis.buttonsWithoutHandlers.forEach(c => console.log(`  - ${c}`));
}

if (analysis.emptyPages.length > 0) {
  console.log('\n⚠️ Pages that may need content:');
  analysis.emptyPages.forEach(p => console.log(`  - ${p}`));
}

if (analysis.missingFeatures.length > 0) {
  console.log('\n⚠️ Missing features:');
  analysis.missingFeatures.forEach(f => console.log(`  - ${f}`));
}

console.log('\n=====================================');
console.log('✅ Analysis Complete!\n');
/**
 * 🚗 Comtion Navigation App
 * 
 * Main app component with navigation setup
 * Integrates all OpenRouteService APIs with full quota management
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Pages
import HomePage from './src/pages/HomePage';
import NavigationPage from './src/pages/NavigationPage';
import ReachabilityPage from './src/pages/ReachabilityPage';
import PlaceDetailsPage from './src/pages/PlaceDetailsPage';
import SearchResultsPage from './src/pages/SearchResultsPage';
import RouteOptionsPage from './src/pages/RouteOptionsPage';
import SettingsPage from './src/pages/SettingsPage';

// Stack navigator
const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerShown: false, // Hide default headers, pages handle their own
        }}
      >
        {/* Home/Map Page */}
        <Stack.Screen 
          name="Home" 
          component={HomePage}
          options={{
            title: 'Comtion Navigation'
          }}
        />
        
        {/* Real-Time Navigation */}
        <Stack.Screen 
          name="Navigation" 
          component={NavigationPage}
          options={{
            title: 'Navigation',
            gestureEnabled: false, // Prevent swiping back during navigation
          }}
        />
        
        {/* Reachability Analysis */}
        <Stack.Screen 
          name="Reachability" 
          component={ReachabilityPage}
          options={{
            title: 'Reachability Analysis'
          }}
        />
        
        {/* Place Details */}
        <Stack.Screen 
          name="PlaceDetails" 
          component={PlaceDetailsPage}
          options={{
            title: 'Place Details'
          }}
        />
        
        {/* Search Results */}
        <Stack.Screen 
          name="SearchResults" 
          component={SearchResultsPage}
          options={{
            title: 'Search Results'
          }}
        />
        
        {/* Route Options */}
        <Stack.Screen 
          name="RouteOptions" 
          component={RouteOptionsPage}
          options={{
            title: 'Route Options'
          }}
        />
        
        {/* Settings */}
        <Stack.Screen 
          name="Settings" 
          component={SettingsPage}
          options={{
            title: 'Settings'
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
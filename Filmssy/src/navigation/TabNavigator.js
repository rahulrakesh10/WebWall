import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import MediaScreen from '../screens/MediaScreen';
import RecsScreen from '../screens/RecsScreen';
import MeScreen from '../screens/MeScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#181818', borderTopColor: '#222' },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#fff',
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Media') iconName = 'film-outline';
          else if (route.name === 'Recs') iconName = 'sparkles-outline';
          else if (route.name === 'Me') iconName = 'person-circle-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Media" component={MediaScreen} />
      <Tab.Screen name="Recs" component={RecsScreen} />
      <Tab.Screen name="Me" component={MeScreen} />
    </Tab.Navigator>
  );
}

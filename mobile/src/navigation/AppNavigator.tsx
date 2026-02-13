import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { HomeScreen } from '../screens/HomeScreen';
import { PositionsScreen } from '../screens/PositionsScreen';
// DiscoverScreen removed for simplicity
import { AgentFeedScreen } from '../screens/AgentFeedScreen';
import { PositionDetailScreen } from '../screens/PositionDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator
      id="HomeStack"
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.deep, elevation: 0, shadowOpacity: 0 },
        headerTintColor: colors.accent,
        headerTitleStyle: { fontWeight: '700' },
        cardStyle: { backgroundColor: colors.bg.deep },
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function PositionsStack() {
  return (
    <Stack.Navigator
      id="PositionsStack"
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.deep, elevation: 0, shadowOpacity: 0 },
        headerTintColor: colors.accent,
        headerTitleStyle: { fontWeight: '700' },
        cardStyle: { backgroundColor: colors.bg.deep },
      }}
    >
      <Stack.Screen name="PositionsMain" component={PositionsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="PositionDetail"
        component={PositionDetailScreen}
        options={({ route }: any) => ({
          title: route.params?.position?.pair || 'Position',
          headerBackTitle: 'Back',
        })}
      />
    </Stack.Navigator>
  );
}

const tabIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Positions: 'layers-outline',
  Agent: 'pulse-outline',
};

const tabIconsActive: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Positions: 'layers',
  Agent: 'pulse',
};

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        id="MainTabs"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bg.base,
            borderTopColor: colors.border.subtle,
            borderTopWidth: 1,
            height: 80,
            paddingBottom: 20,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.text.faint,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? tabIconsActive[route.name] : tabIcons[route.name]}
              size={22}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Positions" component={PositionsStack} />
        <Tab.Screen name="Agent" component={AgentFeedScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

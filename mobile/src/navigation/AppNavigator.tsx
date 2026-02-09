import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { Text } from 'react-native';
import { colors } from '../theme/colors';
import { HomeScreen } from '../screens/HomeScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
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

const tabLabels: Record<string, string> = {
  Home: 'H',
  Discover: 'D',
  Agent: 'A',
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
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 16, fontWeight: '800', color }}>{tabLabels[route.name]}</Text>
          ),
        })}
      >
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Discover" component={DiscoverScreen} />
        <Tab.Screen name="Agent" component={AgentFeedScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

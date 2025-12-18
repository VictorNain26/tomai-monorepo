import { Tabs } from 'expo-router';
import { Home, Users, User } from 'lucide-react-native';

export default function ParentLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: 'hsl(222.2, 47.4%, 11.2%)',
        tabBarInactiveTintColor: 'hsl(215.4, 16.3%, 46.9%)',
        tabBarStyle: {
          backgroundColor: 'hsl(0, 0%, 100%)',
          borderTopColor: 'hsl(214.3, 31.8%, 91.4%)',
          paddingTop: 8,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="children"
        options={{
          title: 'Enfants',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

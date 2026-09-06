import React from 'react';
import { Tabs } from 'expo-router';
import { Text as RNText } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Five tabs, exactly as the brief specifies (§55). Community lives inside Home
 * and Learn rather than taking a sixth slot.
 *
 * Glyphs are text so the app has no icon-font dependency; a real build swaps in
 * the icon set of choice without touching the routes.
 */
function TabGlyph({ glyph, color }: { glyph: string; color: string }) {
  return <RNText style={{ fontSize: 20, color }}>{glyph}</RNText>;
}

export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home.greetingMorning'),
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <TabGlyph glyph="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: t('learn.title'),
          tabBarLabel: t('learn.title'),
          tabBarIcon: ({ color }) => <TabGlyph glyph="≡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: t('practice.title'),
          tabBarLabel: t('practice.title'),
          tabBarIcon: ({ color }) => <TabGlyph glyph="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="teachers"
        options={{
          title: t('teachers.title'),
          tabBarLabel: t('teachers.title'),
          tabBarIcon: ({ color }) => <TabGlyph glyph="☺" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile.title'),
          tabBarLabel: t('profile.title'),
          tabBarIcon: ({ color }) => <TabGlyph glyph="◐" color={color} />,
        }}
      />
    </Tabs>
  );
}

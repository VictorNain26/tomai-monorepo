/**
 * ChildTabBar - Instagram-style scrollable tab bar with child names.
 *
 * Horizontal scroll, active indicator animates under selected tab.
 */

import { useRef, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks';
import type { IChild } from '@/hooks/useParentDashboard';

interface ChildTabBarProps {
  items: IChild[];
  activeIndex: number;
  onTabPress: (index: number) => void;
}

export function ChildTabBar({ items, activeIndex, onTabPress }: ChildTabBarProps) {
  const colors = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to keep active tab visible
  useEffect(() => {
    if (scrollRef.current && items.length > 0) {
      // Rough estimate: each tab ~100px, scroll to center it
      const x = Math.max(0, activeIndex * 100 - 100);
      scrollRef.current.scrollTo({ x, animated: true });
    }
  }, [activeIndex, items.length]);

  if (items.length <= 1) return null;

  return (
    <View className="border-b border-slate-200 dark:border-slate-700">
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-4"
      >
        {items.map((child, index) => {
          const isActive = index === activeIndex;
          return (
            <TouchableOpacity
              key={child.id}
              onPress={() => onTabPress(index)}
              className="mr-6 pb-3 pt-2"
            >
              <Text
                className={`text-sm font-semibold ${isActive ? '' : 'opacity-50'}`}
                style={isActive ? { color: colors.primary } : undefined}
              >
                {child.firstName}
              </Text>
              {isActive && (
                <View
                  className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full"
                  style={{ backgroundColor: colors.primary }}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

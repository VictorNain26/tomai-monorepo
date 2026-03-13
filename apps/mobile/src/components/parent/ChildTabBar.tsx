/**
 * ChildTabBar - Instagram-style scrollable tab bar with child names.
 *
 * Horizontal scroll, active indicator under selected tab.
 * Uses onLayout to measure real tab widths for accurate auto-scroll.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { View, TouchableOpacity, ScrollView, type LayoutChangeEvent } from 'react-native';
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
  const [tabOffsets, setTabOffsets] = useState<number[]>([]);

  const handleTabLayout = useCallback(
    (index: number) => (e: LayoutChangeEvent) => {
      const { x } = e.nativeEvent.layout;
      setTabOffsets((prev) => {
        const next = [...prev];
        next[index] = x;
        return next;
      });
    },
    []
  );

  // Auto-scroll to keep active tab centered
  useEffect(() => {
    if (scrollRef.current && tabOffsets[activeIndex] !== undefined) {
      const x = Math.max(0, tabOffsets[activeIndex] - 60);
      scrollRef.current.scrollTo({ x, animated: true });
    }
  }, [activeIndex, tabOffsets]);

  if (items.length <= 1) return null;

  return (
    <View className="border-b border-slate-200 dark:border-slate-700">
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5"
      >
        {items.map((child, index) => {
          const isActive = index === activeIndex;
          return (
            <TouchableOpacity
              key={child.id}
              onPress={() => onTabPress(index)}
              onLayout={handleTabLayout(index)}
              className="mr-6 pb-3 pt-2"
              accessibilityLabel={`Onglet ${child.firstName}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                className={`text-sm font-semibold ${isActive ? '' : 'opacity-40'}`}
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

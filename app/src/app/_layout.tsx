import { useFonts } from 'expo-font';
import { DarkTheme, ThemeProvider, router } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sky } from '@/components/sky';
import { TAB_BAR_HEIGHT, useTheme, Press } from '@/components/ui';
import { StoreProvider } from '@/state/store';
import { FONTS } from '@/theme';

function TabButton({ children, isFocused, onReselect, ...props }: TabTriggerSlotProps & { onReselect?: () => void }) {
  const { C, LABEL } = useTheme();
  return (
    // Cast: the slot's ref type and Pressable's don't line up in the type definitions.
    <Press
      {...(props as object)}
      onPress={(e) => {
        props.onPress?.(e);
        if (isFocused) onReselect?.();
      }}
      hitSlop={8}
      style={styles.tab}>
      <Text style={[styles.tabText, { fontFamily: LABEL, color: isFocused ? C.text : C.faint }]}>{children}</Text>
      <View style={[styles.dot, isFocused && { backgroundColor: C.text }]} />
    </Press>
  );
}

// Transparent screens so the shared sky shows through.
const THEME = { ...DarkTheme, colors: { ...DarkTheme.colors, background: 'transparent' } };

function Shell() {
  const insets = useSafeAreaInsets();
  const [loaded, error] = useFonts(FONTS);
  const { look } = useTheme();
  // Nearly solid, so page text scrolling underneath doesn't show through the tab labels.
  const n = parseInt(look.onFill.replace('#', ''), 16);
  const barColor = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.94)`;
  return (
    <>
      <Sky />
      <StatusBar style="light" />
      {(loaded || error) && (
        <Tabs>
          <TabSlot style={{ flex: 1 }} />
          <TabList style={[styles.bar, { backgroundColor: barColor, paddingBottom: Math.max(insets.bottom, 10), height: TAB_BAR_HEIGHT + insets.bottom }]}>
            <TabTrigger name="today" href="/" asChild>
              {/* Tapping Today again while looking at another bird goes back to today's bird. */}
              <TabButton onReselect={() => router.setParams({ bird: undefined })}>Today</TabButton>
            </TabTrigger>
            <TabTrigger name="alarms" href="/alarms" asChild>
              <TabButton>Alarm</TabButton>
            </TabTrigger>
            <TabTrigger name="library" href="/library" asChild>
              <TabButton>Birds</TabButton>
            </TabTrigger>
            <TabTrigger name="settings" href="/settings" asChild>
              <TabButton>Settings</TabButton>
            </TabTrigger>
            <TabTrigger name="credits" href="/credits" asChild>
              <TabButton>Credits</TabButton>
            </TabTrigger>
          </TabList>
        </Tabs>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={THEME}>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  tab: { alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 6 },
  tabText: { fontSize: 13, letterSpacing: 0.4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
});

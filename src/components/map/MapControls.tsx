import React from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Languages, Sun, Moon, Crosshair, Eye, EyeOff, Package, Layers, Maximize2, Minimize2, LayoutList } from 'lucide-react-native';
import { FONT_EN } from './mapUtils';

export const MapControls = ({
  T, lang, font, isDark, theme, labels,
  showControls, setShowControls,
  toggleLang, toggleTheme,
  stickyVisible, setStickyVisible,
  recenterAnim, reenterFollow,
  assignedOrders, batchGroups,
  hideBottomNav, setHideBottomNav,
  viewMode, setViewMode,
  minimal = false
}: any) => {
  const insets = useSafeAreaInsets();

  return (
    <>
      {/* ── HEADER CONTROLS ──────────────────────────────────────────────── */}
      {showControls && !minimal && (
        <View style={[styles.header, { top: insets.top + 5 }]}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.headerBlur}>
            <View style={styles.headerInner}>
              <Pressable style={[styles.searchBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                <Search size={18} color={T.sub} />
                <Text style={{ color: T.sub, fontSize: 13, fontFamily: font, marginLeft: 8 }}>{labels.search[lang]}</Text>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={toggleLang} style={[styles.controlBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                  <Languages size={20} color={T.text} />
                </Pressable>

                <Pressable onPress={toggleTheme} style={[styles.controlBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                  {theme === 'dark' ? <Sun size={20} color="#fbbf24" /> : <Moon size={20} color={T.text} />}
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      )}

      {/* ── RE-CENTER BUTTON ─────────────────────────────────────────────── */}
      <Animated.View style={[
        styles.recenterWrap,
        {
          opacity: recenterAnim,
          transform: [{ scale: recenterAnim }],
          bottom: minimal ? 120 : 420
        }
      ]}>
        <Pressable onPress={reenterFollow} style={[styles.recenterBtn, { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: 'rgba(255,255,255,0.15)' }]}>
          <View style={styles.recenterInner}>
            <Crosshair size={18} color="#fff" strokeWidth={2.5} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {labels.recenter[lang]}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* ── SIDE CONTROLS ────────────────────────────────────────────────── */}
      {showControls && !minimal && (
        <View style={[styles.mapControls, { bottom: minimal ? 40 : 380 }]}>
          <Pressable
            onPress={() => setHideBottomNav(!hideBottomNav)}
            style={styles.fab}
          >
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.fabBlur}>
              {hideBottomNav ? <Minimize2 size={20} color={T.text} /> : <Maximize2 size={20} color={T.accent} />}
            </BlurView>
          </Pressable>

          <Pressable
            onPress={() => setStickyVisible(!stickyVisible)}
            style={[styles.fab, { backgroundColor: T.surface }]}
          >
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.fabBlur}>
              {stickyVisible ? <EyeOff size={22} color={T.text} /> : <Eye size={22} color={T.accent} />}
            </BlurView>
          </Pressable>

          <View style={[styles.countPillContainer, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Package size={16} color={T.accent} />
              <Text style={{ fontSize: 10, fontWeight: '900', color: T.text, fontFamily: FONT_EN }}>{assignedOrders.length}</Text>
            </View>
            <View style={{ width: 20, height: 1, backgroundColor: T.border }} />
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Layers size={16} color="#8b5cf6" />
              <Text style={{ fontSize: 10, fontWeight: '900', color: T.text, fontFamily: FONT_EN }}>{batchGroups.length}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => setViewMode('list')}
            style={[styles.fab, { backgroundColor: T.accent }]}
          >
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.fabBlur}>
              <LayoutList size={22} color="#fff" />
            </BlurView>
          </Pressable>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 44, left: 16, right: 16, zIndex: 100 },
  headerBlur: { borderRadius: 24, overflow: 'hidden', padding: 4 },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  searchBtn: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginRight: 10 },
  controlBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  recenterWrap: { position: 'absolute', bottom: 420, right: 16, zIndex: 95 },
  recenterBtn: { height: 46, borderRadius: 23, paddingHorizontal: 16, overflow: 'hidden', borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 15, elevation: 12 },
  recenterInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapControls: { position: 'absolute', bottom: 380, right: 16, gap: 12, zIndex: 90 },
  fab: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  fabBlur: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  countPillContainer: { width: 44, paddingVertical: 12, alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 1, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
});

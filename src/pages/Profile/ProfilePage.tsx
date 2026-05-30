import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Animated as RNAnimated, Dimensions, StyleSheet, Modal, Image, ActivityIndicator, Linking } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { db, auth } from '../../config/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp, onSnapshot, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User, Phone, Mail, LogOut, MapPin, CheckCircle2, ChevronRight,
  Power, Sun, Moon, Languages, AlertCircle,
  ShoppingBag, Banknote, TrendingUp, Star, ShieldCheck,
  HelpCircle, MessageSquare, ExternalLink, Info, Bell, Settings, Camera,
  Upload
} from 'lucide-react-native';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useApp } from '../../context/AppContext';
import { useRiderData } from '../../context/RiderDataContext';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Animated, { 
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence, withRepeat,
  FadeIn, FadeOut, FadeInDown, FadeInUp, SlideInDown, ZoomIn,
  runOnJS, Easing
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function ProfilePage() {
  const { rider, setRider } = useAuthStore();
  const router = useRouter();
  const { theme, lang, t, T, toggleTheme, toggleLang, font, toastEnabled, toggleToast, showToast } = useApp();
  const isDark = theme === 'dark';

  const { pickAndUpload, uploading } = useImageUpload();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [avatarCacheBuster, setAvatarCacheBuster] = useState<number | null>(null);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);

  const handleUpdateAvatar = async (fromCamera: boolean) => {
    if (!rider?.uid || uploading) return;
    try {
      const storagePath = `users/${rider.uid}/avatar.jpg`;
      const url = await pickAndUpload(storagePath, { 
        fromCamera,
        onLocalUri: (uri) => {
          setLocalPhotoUri(uri);
        }
      });
      if (url) {
        if (auth.currentUser) {
          try {
            await updateProfile(auth.currentUser, { photoURL: url });
          } catch (profileErr) {
            console.error('Error updating Firebase Auth profile:', profileErr);
          }
        }
        const riderRef = doc(db, 'employees', rider.uid);
        await updateDoc(riderRef, { 
          photoURL: url,
          profilePic: url,
          avatar: url,
          photo: url
        });
        setRider({ 
          ...rider, 
          photoURL: url,
          profilePic: url,
          avatar: url,
          photo: url
        } as any);
        setAvatarCacheBuster(Date.now());
        if (showToast) {
          showToast(
            lang === 'bn' ? 'সাফল্য' : 'Success',
            lang === 'bn' ? 'প্রোফাইল ছবি সফলভাবে আপডেট করা হয়েছে!' : 'Profile picture updated successfully!',
            'success'
          );
        }
      } else {
        if (showToast) {
          showToast(
            lang === 'bn' ? 'ব্যর্থতা' : 'Failed',
            lang === 'bn' ? 'ছবি আপলোড করা সম্ভব হয়নি' : 'Failed to upload photo',
            'danger'
          );
        }
      }
    } catch (error: any) {
      console.error('Error updating avatar:', error);
      if (showToast) {
        showToast(
          lang === 'bn' ? 'ত্রুটি' : 'Error',
          error?.message || (lang === 'bn' ? 'ছবি আপলোড করতে ত্রুটি ঘটেছে' : 'Error updating profile picture'),
          'danger'
        );
      }
    } finally {
      setShowUploadModal(false);
    }
  };

  // THEME TRANSITION ANIMATION
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetTheme, setTargetTheme] = useState<string>(theme);
  const scale1 = useSharedValue(0);
  const scale2 = useSharedValue(0);
  const scale3 = useSharedValue(0);
  const circleOpacity = useSharedValue(0);
  const circlePos = useSharedValue({ x: 0, y: 0 });

  const animatedCircle1 = useAnimatedStyle(() => ({
    position: 'absolute',
    top: circlePos.value.y - 60,
    left: circlePos.value.x - 60,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: targetTheme === 'dark' ? 'rgba(2, 6, 23, 0.85)' : 'rgba(248, 250, 252, 0.85)',
    transform: [{ scale: scale1.value }],
    opacity: circleOpacity.value,
    zIndex: 9999,
    elevation: 50,
  }));

  const animatedCircle2 = useAnimatedStyle(() => ({
    position: 'absolute',
    top: circlePos.value.y - 60,
    left: circlePos.value.x - 60,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: targetTheme === 'dark' ? 'rgba(2, 6, 23, 0.85)' : 'rgba(248, 250, 252, 0.85)',
    transform: [{ scale: scale2.value }],
    opacity: circleOpacity.value,
    zIndex: 10000,
    elevation: 51,
  }));

  const animatedCircle3 = useAnimatedStyle(() => ({
    position: 'absolute',
    top: circlePos.value.y - 60,
    left: circlePos.value.x - 60,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: targetTheme === 'dark' ? 'rgba(2, 6, 23, 0.85)' : 'rgba(248, 250, 252, 0.85)',
    transform: [{ scale: scale3.value }],
    opacity: circleOpacity.value,
    zIndex: 10001,
    elevation: 52,
  }));

  const handleThemeToggle = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    const nextTheme = isDark ? 'light' : 'dark';
    
    setTargetTheme(nextTheme);
    circlePos.value = { x: pageX, y: pageY };
    setIsTransitioning(true);
    circleOpacity.value = 1;
    
    // CINEMATIC EASING: Slower, more deliberate motion
    const cinematicEasing = Easing.bezier(0.4, 0, 0.2, 1);
    
    scale1.value = withTiming(35, { duration: 1500, easing: cinematicEasing });
    scale2.value = withDelay(120, withTiming(32, { duration: 1600, easing: cinematicEasing }));
    scale3.value = withDelay(250, withTiming(30, { duration: 1700, easing: cinematicEasing }, (finished) => {
      if (finished) {
        circleOpacity.value = withTiming(0, { duration: 600 }, (f2) => {
          if (f2) {
            scale1.value = 0; scale2.value = 0; scale3.value = 0;
            runOnJS(setIsTransitioning)(false);
          }
        });
      }
    }));

    // Trigger toggle mid-expansion (at 800ms) for a seamless reveal
    scale2.value = withDelay(120, withTiming(32, { duration: 1600, easing: cinematicEasing }, (f) => {
      if (f) runOnJS(toggleTheme)();
    }));
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [activeOrderWarning, setActiveOrderWarning] = useState(false);
  const [holdingBalanceCache, setHoldingBalanceCache] = useState(0);
  const [ratingCache, setRatingCache] = useState(0);

  // Stats from centralized context
  const { stats, totalDelivered: ctxTotalDelivered } = useRiderData();
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState<number>(0);
  const holdingBalance = (rider as any)?.holdingBalance || 0;
  const totalDelivered = ctxTotalDelivered;
  const todayCount = stats.todayDeliveredCount;

  // Load cache on mount
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cashStr = await AsyncStorage.getItem('gb_cache_val_cash');
        if (cashStr) setHoldingBalanceCache(Number(cashStr));
        const ratStr = await AsyncStorage.getItem('gb_cache_val_rating');
        if (ratStr) setRatingCache(Number(ratStr));
      } catch (e) { }
    };
    loadCache();
  }, []);

  useEffect(() => {
    if (!rider?.uid) return;

    const q = query(collection(db, 'reviews'), where('rider.riderId', '==', rider.uid));
    const unsubReviews = onSnapshot(q, (snap) => {
      const revList = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setReviews(revList);
      if (revList.length > 0) {
        const avg = revList.reduce((s: number, r: any) => s + (r.rating || 0), 0) / revList.length;
        setRating(avg);
        AsyncStorage.setItem('gb_cache_val_rating', avg.toString());
      }
    });

    return () => {
      unsubReviews();
    };
  }, [rider?.uid]);

  const isOnline = rider?.dutyStatus === 'online';

  const getTodayId = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const toggleDuty = async () => {
    if (!rider?.uid) return;
    if (isOnline) {
      const activeStatuses = ['assigned', 'accepted', 'arrived_at_branch', 'picked', 'out_for_delivery', 'arrived_at_customer'];
      const q = query(collection(db, 'orders'), where('riderId', '==', rider.uid), where('status', 'in', activeStatuses));
      const snap = await getDocs(q);
      if (!snap.empty) { setActiveOrderWarning(true); return; }
    }

    setIsUpdatingStatus(true);
    const todayId = getTodayId();
    const attendRef = doc(db, 'employees', rider.uid, 'attendance', todayId);
    const riderRef = doc(db, 'employees', rider.uid);
    try {
      if (!isOnline) {
        await setDoc(attendRef, { date: todayId, lastCheckIn: serverTimestamp(), riderName: rider.name, status: 'present' }, { merge: true });
        await updateDoc(riderRef, { dutyStatus: 'online' });
      } else {
        const snap = await getDoc(attendRef);
        let totalMins = 0;
        if (snap.exists() && snap.data().lastCheckIn) {
          const checkInDate = snap.data().lastCheckIn.toDate();
          totalMins = Math.floor((new Date().getTime() - checkInDate.getTime()) / 60000);
        }
        await setDoc(attendRef, { lastCheckOut: serverTimestamp(), totalMinutes: totalMins }, { merge: true });
        await updateDoc(riderRef, { dutyStatus: 'offline' });
      }
    } catch (e) { console.error(e); }
    finally { setIsUpdatingStatus(false); }
  };

  const handleLogout = async () => {
    if (!rider?.uid) return;
    const activeStatuses = ['assigned', 'accepted', 'arrived_at_branch', 'picked', 'out_for_delivery', 'arrived_at_customer'];
    const q = query(collection(db, 'orders'), where('riderId', '==', rider.uid), where('status', 'in', activeStatuses));
    const snap = await getDocs(q);
    if (!snap.empty) { setActiveOrderWarning(true); return; }

    setIsLoggingOut(true);
    try {
      if (isOnline) {
        const todayId = getTodayId();
        const attendRef = doc(db, 'employees', rider.uid, 'attendance', todayId);
        const snapAtt = await getDoc(attendRef);
        let totalMins = 0;
        if (snapAtt.exists() && snapAtt.data().lastCheckIn) {
          const checkInDate = snapAtt.data().lastCheckIn.toDate();
          totalMins = Math.floor((new Date().getTime() - checkInDate.getTime()) / 60000);
        }
        await setDoc(attendRef, { lastCheckOut: serverTimestamp(), totalMinutes: totalMins }, { merge: true });
        await updateDoc(doc(db, 'employees', rider.uid), { dutyStatus: 'offline' });
      }
      const logoutFn = (useAuthStore.getState() as any).logout;
      if (typeof logoutFn === 'function') await logoutFn();
      // Router redirection should happen in _layout due to protected routing hook.
    } catch (e) { console.error(e); }
    finally { setIsLoggingOut(false); }
  };

  const statCards = [
    { label: t('profile_stat_today'), value: todayCount, icon: ShoppingBag, color: '#38bdf8', bg: T.cardB },
    { label: t('profile_stat_cash'), value: `৳${holdingBalance.toLocaleString()}`, icon: Banknote, color: T.accent, bg: T.cardA },
    { label: t('profile_stat_total'), value: totalDelivered, icon: TrendingUp, color: '#22d47a', bg: T.cardC },
    { label: t('profile_stat_avg'), value: rating > 0 ? rating.toFixed(1) : '—', icon: Star, color: '#f59e0b', bg: T.cardD, unit: rating > 0 ? '/ 5' : null },
  ];

  // Animations
  const glowValue = useSharedValue(1);

  useEffect(() => {
    if (isOnline) {
      glowValue.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1500 }),
          withTiming(1, { duration: 1500 })
        ),
        -1,
        true
      );
    } else {
      glowValue.value = 1;
    }
  }, [isOnline]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowValue.value }],
    opacity: withTiming(isOnline ? 0.3 : 0)
  }));

  const themeSwitchAnim = useRef(new RNAnimated.Value(isDark ? 1 : 0)).current;
  const langSwitchAnim = useRef(new RNAnimated.Value(lang === 'en' ? 1 : 0)).current;
  const toastSwitchAnim = useRef(new RNAnimated.Value(toastEnabled ? 1 : 0)).current;

  useEffect(() => {
    RNAnimated.spring(themeSwitchAnim, { toValue: isDark ? 1 : 0, useNativeDriver: false, tension: 50, friction: 7 }).start();
  }, [isDark]);

  useEffect(() => {
    RNAnimated.spring(langSwitchAnim, { toValue: lang === 'en' ? 1 : 0, useNativeDriver: false, tension: 50, friction: 7 }).start();
  }, [lang]);

  useEffect(() => {
    RNAnimated.spring(toastSwitchAnim, { toValue: toastEnabled ? 1 : 0, useNativeDriver: false, tension: 50, friction: 7 }).start();
  }, [toastEnabled]);

  const levelProgress = Math.min((totalDelivered % 100) / 100, 1);
  const currentLevel = Math.floor(totalDelivered / 100) + 1;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

        {/* PREMIUM HEADER */}
        <View style={{ marginBottom: 24 }}>
          <LinearGradient
            colors={[isOnline ? '#10b981' : T.accent, isDark ? T.bg : '#fff']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280, opacity: 0.15 }}
          />
          
          <Animated.View 
            entering={FadeInUp.delay(200).springify()}
            style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 }}
          >
            <Pressable 
              onPress={() => setShowUploadModal(true)} 
              disabled={uploading}
              style={{ marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}
            >
              <Animated.View style={[{
                position: 'absolute',
                width: 140, height: 140, borderRadius: 70,
                backgroundColor: isOnline ? '#10b981' : T.accent,
              }, glowStyle]} />

              <View style={{
                width: 110, height: 110, borderRadius: 36, backgroundColor: T.surface, padding: 4,
                borderWidth: 2, borderColor: isOnline ? '#10b981' : T.border,
                shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 5
              }}>
                <View style={{ width: '100%', height: '100%', borderRadius: 32, overflow: 'hidden', backgroundColor: T.hi, alignItems: 'center', justifyContent: 'center' }}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={T.accent} />
                  ) : localPhotoUri ? (
                    <Image source={{ uri: localPhotoUri }} style={{ width: '100%', height: '100%' }} />
                  ) : (rider?.photoURL || (rider as any)?.profilePic || (rider as any)?.avatar || (rider as any)?.photo) ? (
                    <Image 
                      source={{ 
                        uri: (() => {
                          const base = rider?.photoURL || (rider as any)?.profilePic || (rider as any)?.avatar || (rider as any)?.photo || '';
                          if (!avatarCacheBuster) return base;
                          return base.includes('?') ? `${base}&t=${avatarCacheBuster}` : `${base}?t=${avatarCacheBuster}`;
                        })(),
                        cache: 'force-cache'
                      }} 
                      style={{ width: '100%', height: '100%' }} 
                    />
                  ) : (
                    <User size={48} color={isOnline ? '#10b981' : T.sub} strokeWidth={1.5} />
                  )}
                </View>
              </View>

              {/* Camera edit badge centered at the bottom */}
              <View style={{
                position: 'absolute', bottom: -6, alignSelf: 'center', width: 34, height: 34, borderRadius: 17,
                backgroundColor: T.accent, borderWidth: 4, borderColor: isDark ? T.surface : '#fff',
                alignItems: 'center', justifyContent: 'center', elevation: 4
              }}>
                <Camera size={14} color="#fff" strokeWidth={2.5} />
              </View>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontFamily: font, fontSize: 32, color: T.text, fontWeight: '900' }}>
                {rider?.name || 'Rider'}
              </Text>
              <CheckCircle2 size={24} color={isOnline ? '#10b981' : T.accent} strokeWidth={2.5} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: T.sub }}>ID: {rider?.uid?.slice(-6).toUpperCase()}</Text>
              </View>
              <View style={{ backgroundColor: '#10b98120', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#10b981' }}>{t('profile_certified')}</Text>
              </View>
            </View>

            {/* EXPERIENCE RANK */}
            <View style={{ width: '100%', paddingHorizontal: 20, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: T.sub }}>{t('profile_rank_title')} {currentLevel}</Text>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: T.sub, opacity: 0.5 }} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: T.sub, opacity: 0.7 }}>{totalDelivered} {t('unit_orders')}</Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: '900', color: T.accent }}>{Math.round(levelProgress * 100)}%</Text>
              </View>
              <View style={{ height: 6, backgroundColor: T.hi, borderRadius: 3, overflow: 'hidden' }}>
                <Animated.View 
                  entering={FadeInUp.delay(500)}
                  style={{ width: `${levelProgress * 100}%`, height: '100%', backgroundColor: T.accent, borderRadius: 3 }} 
                />
              </View>
            </View>

            {/* COMPACT STATS GRID (1x4) */}
            <Animated.View 
              entering={FadeInDown.delay(300).springify()}
              style={{ 
                flexDirection: 'row', 
                backgroundColor: T.surface, 
                borderWidth: 1, borderColor: T.border, 
                borderRadius: 24, padding: 12, 
                width: '100%',
                justifyContent: 'space-between',
                elevation: isDark ? 0 : 4, shadowColor: T.accent, shadowOpacity: isDark ? 0.2 : 0.05, shadowRadius: 30
              }}
            >
              {statCards.map((card, i) => (
                <View key={i} style={{ width: (width - 80) / 4, alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: `${card.color}15`, alignItems: 'center', justifyContent: 'center' }}>
                    <card.icon size={14} color={card.color} strokeWidth={2.5} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: T.text, fontFamily: font }}>
                    {typeof card.value === 'string' && card.value.includes('৳') ? card.value.replace('৳', '') : card.value}
                  </Text>
                  <Text style={{ fontSize: 7, fontWeight: '800', textTransform: 'uppercase', color: T.sub, fontFamily: font, textAlign: 'center' }} numberOfLines={1}>{card.label.split(' ')[0]}</Text>
                </View>
              ))}
            </Animated.View>
          </Animated.View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 20 }}>

          {/* SYSTEM & PREFERENCES */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6 }}>
              <Settings size={14} color={T.accent} strokeWidth={2.5} />
              <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, fontFamily: font }}>{t('profile_settings_title')}</Text>
            </View>
            <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 26, paddingVertical: 14, paddingHorizontal: 20, gap: 12 }}>
              {/* Theme Toggle */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: isDark ? 'rgba(251,191,36,0.1)' : 'rgba(232,93,4,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    {isDark ? <Sun size={18} color="#fbbf24" strokeWidth={2} /> : <Moon size={18} color={T.accent} strokeWidth={2} />}
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: T.text, fontFamily: font }}>{isDark ? t('dark_mode') : t('light_mode')}</Text>
                </View>
                <Pressable onPress={(e) => handleThemeToggle(e)} style={{ width: 76, height: 34, borderRadius: 17, backgroundColor: T.hi, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                  <RNAnimated.View style={{ position: 'absolute', left: themeSwitchAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 40] }), width: 30, height: 26, borderRadius: 13, backgroundColor: T.surface, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }} />
                  <View style={{ width: 30, alignItems: 'center', zIndex: 1 }}>
                    <Sun size={14} color={!isDark ? T.accent : T.sub} strokeWidth={2.5} />
                  </View>
                  <View style={{ width: 30, alignItems: 'center', zIndex: 1 }}>
                    <Moon size={14} color={isDark ? T.accent : T.sub} strokeWidth={2.5} />
                  </View>
                </Pressable>
              </View>
              <View style={{ height: 1, backgroundColor: T.border }} />
              {/* Language Toggle */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Languages size={18} color="#3b82f6" strokeWidth={2} />
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: T.text, fontFamily: font }}>{lang === 'bn' ? 'বাংলা' : 'English'}</Text>
                </View>
                <Pressable onPress={toggleLang} style={{ width: 86, height: 34, borderRadius: 17, backgroundColor: T.hi, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                  <RNAnimated.View style={{ position: 'absolute', left: langSwitchAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 46] }), width: 34, height: 26, borderRadius: 13, backgroundColor: T.surface, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }} />
                  <View style={{ width: 34, alignItems: 'center', zIndex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: lang === 'bn' ? T.accent : T.sub, fontFamily: font }}>BN</Text>
                  </View>
                  <View style={{ width: 34, alignItems: 'center', zIndex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: lang === 'en' ? T.accent : T.sub, fontFamily: font }}>EN</Text>
                  </View>
                </Pressable>
              </View>
              <View style={{ height: 1, backgroundColor: T.border }} />
              {/* Toast Toggle */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(34,212,122,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Bell size={18} color={T.green} strokeWidth={2} />
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: T.text, fontFamily: font }}>{t('profile_toast_notif')}</Text>
                </View>
                <Pressable onPress={toggleToast} style={{ width: 66, height: 34, borderRadius: 17, backgroundColor: T.hi, borderWidth: 1, borderColor: T.border, justifyContent: 'center', paddingHorizontal: 4 }}>
                  <RNAnimated.View style={{ transform: [{ translateX: toastSwitchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 32] }) }], width: 26, height: 26, borderRadius: 13, backgroundColor: toastEnabled ? T.green : T.surface, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* DUTY TOGGLE CARD */}
          <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 26, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: isOnline ? T.green : T.accent }}>
            <View>
              <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, marginBottom: 4, fontFamily: font }}>{t('profile_duty_label')}</Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: T.text, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: font }}>
                {isOnline ? t('profile_shift_on') : t('profile_shift_off')}
              </Text>
              <Text style={{ fontSize: 10, color: isOnline ? T.green : T.sub, fontWeight: '700', marginTop: 4, fontFamily: font }}>
                {isOnline ? t('profile_visible') : t('profile_invisible')}
              </Text>
            </View>
            <Pressable onPress={toggleDuty} disabled={isUpdatingStatus}
              style={({ pressed }) => [{
                width: 54, height: 54, borderRadius: 18,
                backgroundColor: isOnline ? 'rgba(255,77,109,0.08)' : 'rgba(34,212,122,0.08)',
                alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1
              }]}
            >
              {isUpdatingStatus ? (
                <ActivityIndicator size="small" color={isOnline ? T.danger : T.green} />
              ) : (
                <Power size={24} color={isOnline ? T.danger : T.green} strokeWidth={3} />
              )}
            </Pressable>
          </View>

          {/* ACCOUNT DETAILS SECTION */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6 }}>
              <ShieldCheck size={14} color={T.accent} strokeWidth={2.5} />
              <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, fontFamily: font }}>{t('profile_account_title')}</Text>
            </View>
            <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 26, overflow: 'hidden' }}>
              {[
                { icon: Phone, label: t('profile_phone'), value: rider?.phone },
                { icon: Mail, label: t('profile_email'), value: rider?.email },
                { icon: MapPin, label: t('profile_location'), value: rider?.currentLocation ? `${rider.currentLocation.lat.toFixed(4)}, ${rider.currentLocation.lng.toFixed(4)}` : t('profile_gps_wait') }
              ].map((item, i, arr) => (
                <View key={i}>
                  <View style={{ paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: T.hi, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border }}>
                        <item.icon size={16} color={T.sub} strokeWidth={2} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', color: T.sub, marginBottom: 2, fontFamily: font }}>{item.label}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, fontFamily: font }}>{item.value || 'Not Set'}</Text>
                      </View>
                    </View>
                  </View>
                  {i < arr.length - 1 && <View style={{ height: 1, backgroundColor: T.border, marginHorizontal: 20 }} />}
                </View>
              ))}
            </View>
          </View>


          {/* HELP & SUPPORT SECTION */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6 }}>
              <HelpCircle size={14} color={T.accent} strokeWidth={2.5} />
              <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, fontFamily: font }}>{t('profile_help_title')}</Text>
            </View>
            <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 26, overflow: 'hidden' }}>
              {[
                { 
                  icon: MessageSquare, 
                  label: t('profile_contact_support'), 
                  action: () => {
                    Linking.openURL('https://wa.me/8801700000000').catch(err => console.error('Error opening support link:', err));
                  }
                },
                { 
                  icon: ShieldCheck, 
                  label: t('profile_privacy_policy'), 
                  action: () => {
                    Linking.openURL('https://rider-privacy.example.com').catch(err => console.error('Error opening privacy link:', err));
                  }
                },
                { 
                  icon: ExternalLink, 
                  label: t('profile_terms_service'), 
                  action: () => router.push('/(auth)/terms') 
                }
              ].map((item, i, arr) => (
                <View key={i}>
                  <Pressable onPress={item.action} style={({ pressed }) => [{ paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: pressed ? 'rgba(0,0,0,0.02)' : 'transparent' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: T.hi, alignItems: 'center', justifyContent: 'center' }}>
                        <item.icon size={16} color={T.sub} strokeWidth={2} />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, fontFamily: font }}>{item.label}</Text>
                    </View>
                    <ChevronRight size={14} color={T.border} strokeWidth={3} />
                  </Pressable>
                  {i < arr.length - 1 && <View style={{ height: 1, backgroundColor: T.border, marginHorizontal: 20 }} />}
                </View>
              ))}
            </View>
          </View>

          {/* LOGOUT BUTTON */}
          <Pressable onPress={handleLogout} disabled={isLoggingOut}
            style={({ pressed }) => [{
              width: '100%', padding: 20, borderRadius: 26,
              borderWidth: 1, borderColor: isDark ? 'rgba(255,77,109,0.15)' : 'rgba(220,38,38,0.1)',
              backgroundColor: isDark ? 'rgba(255,77,109,0.06)' : 'rgba(220,38,38,0.04)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
              opacity: pressed ? 0.7 : 1
            }]}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color={T.danger} />
            ) : (
              <LogOut size={18} strokeWidth={3} color={T.danger} />
            )}
            <Text style={{ color: T.danger, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontFamily: font }}>
              {t('profile_logout')}
            </Text>
          </Pressable>

        </View>
      </ScrollView>

      {/* THEME TRANSITION OVERLAY (Venom Style - Full Screen Cover) */}
      <Modal visible={isTransitioning} transparent animationType="none" pointerEvents="none" statusBarTranslucent>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View pointerEvents="none" style={animatedCircle1} />
          <Animated.View pointerEvents="none" style={animatedCircle2} />
          <Animated.View pointerEvents="none" style={animatedCircle3} />
        </View>
      </Modal>

      {/* ACTIVE ORDER WARNING MODAL */}
      <Modal visible={activeOrderWarning} transparent animationType="fade" onRequestClose={() => setActiveOrderWarning(false)}>
        <Pressable onPress={() => setActiveOrderWarning(false)} style={{ flex: 1, backgroundColor: 'rgba(2,6,23,0.8)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Pressable onPress={() => { }} style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 32, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', width: '100%', maxWidth: 320, elevation: 10, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 50 }}>
            <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(255,77,109,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <AlertCircle size={32} color={T.danger} strokeWidth={2.5} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: T.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, fontFamily: font, textAlign: 'center' }}>
              {lang === 'bn' ? 'অর্ডার সতর্কতা!' : 'Active Orders!'}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: T.sub, marginBottom: 24, lineHeight: 20, fontFamily: font, textAlign: 'center' }}>
              {lang === 'bn' ? 'আপনার ফোনে এখনও একটি সক্রিয় অর্ডার রয়েছে। অফলাইন যাওয়ার আগে অনুগ্রহ করে তা শেষ করুন।' : 'You still have active orders. Please complete them before going offline or logging out.'}
            </Text>
            <Pressable onPress={() => setActiveOrderWarning(false)} style={({ pressed }) => [{ width: '100%', borderRadius: 16, overflow: 'hidden', opacity: pressed ? 0.8 : 1 }]}>
              <LinearGradient colors={[T.accent, '#9d0208']} style={{ padding: 14, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, fontFamily: font }}>
                  {t('confirm') || 'OK, GOT IT'}
                </Text>
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* PHOTO UPLOAD SELECT MODAL */}
      <Modal visible={showUploadModal} transparent animationType="fade" onRequestClose={() => setShowUploadModal(false)}>
        <Pressable onPress={() => setShowUploadModal(false)} style={{ flex: 1, backgroundColor: 'rgba(2,6,23,0.75)', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Animated.View 
            entering={SlideInDown.duration(250)}
            style={{ 
              alignSelf: 'stretch',
              backgroundColor: isDark ? '#0f172a' : '#ffffff', 
              borderTopLeftRadius: 32, borderTopRightRadius: 32, 
              borderWidth: 1, borderColor: T.border,
              padding: 24, paddingBottom: 46,
              gap: 20,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -10 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 25
            }}
          >
            <View style={{ alignItems: 'center', gap: 6, alignSelf: 'stretch' }}>
              <View style={{ width: 40, height: 5, borderRadius: 2.5, backgroundColor: T.border, marginBottom: 8 }} />
              <Text style={{ fontSize: 18, fontWeight: '900', color: T.text, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>
                {lang === 'bn' ? 'প্রোফাইল ছবি পরিবর্তন করুন' : 'Change Profile Photo'}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: T.sub, fontFamily: font, textAlign: 'center' }}>
                {lang === 'bn' ? 'নতুন ছবি আপলোড করতে একটি অপশন নির্বাচন করুন' : 'Select an option to upload your new photo'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' }}>
              {/* Camera Option */}
              <Pressable 
                onPress={() => handleUpdateAvatar(true)}
                style={({ pressed }) => [{
                  width: 150,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderWidth: 1, borderColor: T.border,
                  borderRadius: 24, paddingVertical: 24, paddingHorizontal: 12,
                  gap: 12, opacity: pressed ? 0.85 : 1,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
                }]}
              >
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${T.accent}15`, alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={26} color={T.accent} strokeWidth={2.5} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '900', color: T.text, fontFamily: font, textAlign: 'center' }}>
                  {lang === 'bn' ? 'ছবি তুলুন' : 'Take Photo'}
                </Text>
              </Pressable>

              {/* Gallery Option */}
              <Pressable 
                onPress={() => handleUpdateAvatar(false)}
                style={({ pressed }) => [{
                  width: 150,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderWidth: 1, borderColor: T.border,
                  borderRadius: 24, paddingVertical: 24, paddingHorizontal: 12,
                  gap: 12, opacity: pressed ? 0.85 : 1,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
                }]}
              >
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={26} color="#3b82f6" strokeWidth={2.5} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '900', color: T.text, fontFamily: font, textAlign: 'center' }}>
                  {lang === 'bn' ? 'ছবি আপলোড' : 'Photo Upload'}
                </Text>
              </Pressable>
            </View>

            <Pressable 
              onPress={() => setShowUploadModal(false)}
              style={({ pressed }) => [{
                alignSelf: 'stretch', padding: 18, borderRadius: 24,
                backgroundColor: isDark ? '#334155' : '#e2e8f0',
                alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1
              }]}
            >
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#ef4444', fontFamily: font, textTransform: 'uppercase', letterSpacing: 1.5, textAlign: 'center' }}>
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

    </View>
  );
}

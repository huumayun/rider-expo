import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Mail, Lock, Eye, EyeOff, Bike,
  AlertCircle, ShieldCheck, Sun, Moon,
  Globe, ChevronRight, CheckCircle2
} from 'lucide-react-native';
import { auth, signInWithEmailAndPassword } from '../../config/firebase';
import { useApp } from '../../context/AppContext';

const { width } = Dimensions.get('window');

export default function LoginPage() {
  const { T, t, theme, lang, font, toggleTheme, toggleLang } = useApp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const passwordRef = useRef<TextInput>(null);
  const isDark = theme === 'dark';

  const shake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleLogin = async () => {
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg(t('login_email') + ' required');
      shake();
      return;
    }
    if (!password) {
      setErrorMsg(t('login_password') + ' required');
      shake();
      return;
    }
    if (!termsAccepted) {
      Alert.alert(
        t('login_terms_link'),
        lang === 'bn'
          ? 'লগইন করতে শর্তাবলী মেনে নিতে হবে।'
          : 'You must accept the Terms & Conditions to continue.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (err: any) {
      console.error("Login Error Detailed:", err);
      const code = err?.code || '';
      let msg = lang === 'bn' ? 'লগইন ব্যর্থ হয়েছে।' : 'Login failed.';
      if (code.includes('user-not-found') || code.includes('invalid-credential')) {
        msg = lang === 'bn' ? 'ইমেইল বা পাসওয়ার্ড ভুল।' : 'Invalid email or password.';
      } else if (code.includes('too-many-requests')) {
        msg = lang === 'bn' ? 'অনেক চেষ্টা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।' : 'Too many attempts. Try again later.';
      } else if (code.includes('network')) {
        msg = lang === 'bn' ? 'ইন্টারনেট সংযোগ নেই।' : 'No internet connection.';
      }
      setErrorMsg(msg);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]}>
      {/* Background blobs */}
      <View style={[styles.blob1, { opacity: isDark ? 0.08 : 0.05 }]} />
      <View style={[styles.blob2, { opacity: isDark ? 0.06 : 0.03 }]} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top toggles */}
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={toggleLang}
              style={[styles.toggleBtn, { borderColor: T.border, backgroundColor: T.surface }]}
            >
              <Globe size={14} color={T.sub} style={{ marginRight: 6 }} />
              <Text style={[styles.toggleText, { color: T.sub }]}>
                {lang === 'bn' ? 'English' : 'বাংলা'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.toggleBtn, { borderColor: T.border, backgroundColor: T.surface, width: 44, justifyContent: 'center', paddingHorizontal: 0 }]}
            >
              {isDark ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color={T.sub} />}
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <View style={styles.logoArea}>
            <LinearGradient
              colors={['#22d47a', '#10b981']}
              style={styles.logoBox}
            >
              <Bike size={42} color="#fff" strokeWidth={1.5} />
            </LinearGradient>
            <Text style={[styles.brandName, { color: T.text }]}>
              Graam<Text style={{ color: '#22d47a' }}>Bazaar</Text>
            </Text>
            <Text style={[styles.brandSub, { color: T.sub, fontFamily: font }]}>
              {t('login_sub')}
            </Text>
          </View>

          {/* Card */}
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: T.surface, borderColor: T.border },
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            {/* Email field */}
            <Text style={[styles.fieldLabel, { color: T.sub, fontFamily: font }]}>
              {t('login_email')}
            </Text>
            <View style={[styles.inputRow, {
              borderColor: focusedField === 'email' ? '#22d47a' : T.border,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              borderWidth: focusedField === 'email' ? 1.5 : 1,
            }]}>
              <Mail size={18} color={focusedField === 'email' ? '#22d47a' : T.sub} style={{ marginRight: 12 }} />
              <TextInput
                style={[styles.input, {
                  color: T.text,
                  fontFamily: font,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
                }]}
                placeholder="example@grambaazar.com"
                placeholderTextColor={T.sub as string}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                underlineColorAndroid="transparent"
                selectionColor="#22d47a"
                cursorColor="#22d47a"
                autoCorrect={false}
                value={email}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                onChangeText={v => { setEmail(v); setErrorMsg(''); }}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            {/* Password field */}
            <Text style={[styles.fieldLabel, { color: T.sub, fontFamily: font, marginTop: 20 }]}>
              {t('login_password')}
            </Text>
            <View style={[styles.inputRow, {
              borderColor: focusedField === 'password' ? '#22d47a' : T.border,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              borderWidth: focusedField === 'password' ? 1.5 : 1,
            }]}>
              <Lock size={18} color={focusedField === 'password' ? '#22d47a' : T.sub} style={{ marginRight: 12 }} />
              <TextInput
                ref={passwordRef}
                style={[styles.input, {
                  color: T.text,
                  fontFamily: font,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
                }]}
                placeholder="••••••••"
                placeholderTextColor={T.sub as string}
                secureTextEntry={!showPass}
                autoComplete="password"
                returnKeyType="done"
                underlineColorAndroid="transparent"
                selectionColor="#22d47a"
                cursorColor="#22d47a"
                autoCorrect={false}
                value={password}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onChangeText={v => { setPassword(v); setErrorMsg(''); }}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                {showPass ? <EyeOff size={20} color={T.sub} /> : <Eye size={20} color={T.sub} />}
              </TouchableOpacity>
            </View>

            {/* Error message */}
            {errorMsg ? (
              <View style={[styles.errorRow, { backgroundColor: isDark ? 'rgba(244,63,94,0.1)' : '#fef2f2' }]}>
                <AlertCircle size={16} color="#f43f5e" style={{ marginRight: 8 }} />
                <Text style={[styles.errorText, { fontFamily: font }]}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Terms row */}
            <View style={styles.termsRow}>
              <TouchableOpacity
                onPress={() => setTermsAccepted(p => !p)}
                style={styles.checkboxWrap}
              >
                <View style={[
                  styles.checkbox,
                  {
                    borderColor: termsAccepted ? '#22d47a' : T.border as string,
                    backgroundColor: termsAccepted ? '#22d47a' : 'transparent',
                  },
                ]}>
                  {termsAccepted && <CheckCircle2 size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
              <View style={styles.termsTextWrap}>
                <Text style={[styles.termsBaseText, { color: T.sub, fontFamily: font }]}>
                  {t('login_terms_label')}{' '}
                </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/terms')}>
                  <Text style={[styles.termsLink, { fontFamily: font }]}>
                    {t('login_terms_link')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Login button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.loginBtn, { opacity: loading ? 0.75 : 1 }]}
            >
              <LinearGradient
                colors={['#22d47a', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginGrad}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.loginBtnText, { fontFamily: font }]}>{t('login_btn')}</Text>
                      <ChevronRight size={18} color="#fff" style={{ marginLeft: 6 }} />
                    </View>
                  )
                }
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer badge */}
          <View style={styles.footerBadge}>
            <ShieldCheck size={16} color="#22d47a" />
            <Text style={[styles.footerText, { color: T.sub, fontFamily: font }]}>
              {lang === 'bn' ? 'শুধুমাত্র অনুমোদিত রাইডারদের জন্য' : 'Authorized riders only'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  blob1: {
    position: 'absolute', width: width * 1, height: width * 1,
    borderRadius: width * 0.5, backgroundColor: '#22d47a',
    top: -width * 0.4, left: -width * 0.3,
  },
  blob2: {
    position: 'absolute', width: width * 0.8, height: width * 0.8,
    borderRadius: width * 0.4, backgroundColor: '#3b82f6',
    bottom: -width * 0.2, right: -width * 0.3,
  },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 40 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 40 },
  toggleBtn: {
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  toggleText: { fontSize: 13, fontWeight: '800' },
  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoBox: {
    width: 80, height: 80, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#22d47a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 12
  },
  brandName: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  brandSub: { fontSize: 11, marginTop: 4, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.8 },
  card: {
    borderRadius: 32, borderWidth: 1,
    padding: 24,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 30, elevation: 15,
  },
  fieldLabel: {
    fontSize: 12, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10,
    opacity: 0.9
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 16, height: 58,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600' },
  eyeBtn: { padding: 8 },
  errorRow: {
    marginTop: 16,
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 12,
  },
  errorText: { color: '#f43f5e', fontSize: 14, fontWeight: '600', flex: 1 },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 4 },
  checkboxWrap: { padding: 4 },
  checkbox: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  termsTextWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  termsBaseText: { fontSize: 13, fontWeight: '500' },
  termsLink: { fontSize: 13, color: '#22d47a', fontWeight: '800', textDecorationLine: 'underline' },
  loginBtn: { marginTop: 24, borderRadius: 20, overflow: 'hidden', elevation: 8, shadowColor: '#22d47a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  loginGrad: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  footerBadge: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 32, gap: 8,
  },
  footerText: { fontSize: 13, fontWeight: '700' },
});

// "Me" tab: account (guest -> real account, same pattern as IziCamera), language, privacy, intro replay.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ONBOARDING_KEY } from '@/components/onboarding';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { ensureSession, supabase } from '@/lib/supabase';

type Mode = 'none' | 'upgrade' | 'signin';

export default function MeScreen() {
  const { lang, setLang } = useLang();
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const [mode, setMode] = useState<Mode>('none');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.getUser();
    setEmail(data.user?.email ?? null);
    setIsGuest(Boolean(data.user?.is_anonymous) || !data.user?.email);
  }
  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { refresh(); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];
  const validEmail = formEmail.includes('@') && formEmail.includes('.');

  async function upgrade() {
    if (!validEmail || formPassword.length < 6) { Alert.alert(t('Check the form'), t('Enter a valid email and a password of at least 6 characters.')); return; }
    setBusy(true);
    try {
      await ensureSession();
      const { error } = await supabase.auth.updateUser({ email: formEmail.trim(), password: formPassword });
      if (error) throw error;
      setMode('none'); setFormPassword('');
      Alert.alert(t('Account created'), t('Your receipts are now linked to %email%. You stay signed in on this phone.', { email: formEmail.trim() }));
      await refresh();
    } catch (e) { Alert.alert(t('Error'), String((e as Error).message ?? e)); }
    finally { setBusy(false); }
  }

  async function signIn() {
    if (!validEmail || !formPassword) { Alert.alert(t('Check the form'), t('Enter your email and password.')); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: formEmail.trim(), password: formPassword });
      if (error) throw error;
      setMode('none'); setFormPassword('');
      await refresh();
    } catch (e) { Alert.alert(t('Error'), String((e as Error).message ?? e)); }
    finally { setBusy(false); }
  }

  function confirmSignInOther() {
    if (isGuest) {
      Alert.alert(t('You are a guest'), t('Signing in with another account will leave the receipts you scanned as a guest behind. Create an account first to keep them.'), [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Continue'), style: 'destructive', onPress: () => setMode('signin') },
      ]);
    } else setMode('signin');
  }

  function signOut() {
    Alert.alert(
      t('Sign out?'),
      isGuest ? t('You are a guest. Signing out permanently loses the receipts on this phone. Create an account first to keep them.') : t('You will be signed out on this phone only.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Sign out'), style: 'destructive', onPress: async () => { await supabase.auth.signOut({ scope: 'local' }); await ensureSession(); await refresh(); } },
      ],
    );
  }

  const version = Constants.expoConfig?.version ?? '';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Account */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={isGuest ? 'person-outline' : 'person-circle'} size={26} color={Brand.primary} />
              <View>
                <ThemedText type="smallBold">{isGuest ? t('Guest') : email}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{isGuest ? t('Receipts live only on this phone') : t('Signed in')}</ThemedText>
              </View>
            </View>
          </View>

          {isGuest && mode === 'none' ? (
            <View style={styles.upgradeCard}>
              <ThemedText type="smallBold">{t('Keep your receipts safe')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{t('Create a free account so your receipts survive a lost or new phone. Everything you scanned as a guest is kept.')}</ThemedText>
              <Pressable style={styles.primaryBtn} onPress={() => setMode('upgrade')}>
                <ThemedText style={styles.primaryBtnText}>{t('Create account')}</ThemedText>
              </Pressable>
              <Pressable style={styles.linkBtn} onPress={confirmSignInOther}>
                <ThemedText style={{ color: Brand.primary }}>{t('I already have an account')}</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {mode !== 'none' ? (
            <View style={{ gap: Spacing.two }}>
              <ThemedText type="smallBold">{mode === 'upgrade' ? t('Create account') : t('Sign in')}</ThemedText>
              <TextInput style={inputStyle} placeholder={t('Email')} placeholderTextColor="#888" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={formEmail} onChangeText={setFormEmail} />
              <TextInput style={inputStyle} placeholder={t('Password')} placeholderTextColor="#888" secureTextEntry autoComplete={mode === 'upgrade' ? 'new-password' : 'password'} value={formPassword} onChangeText={setFormPassword} />
              <Pressable style={[styles.primaryBtn, busy && { opacity: 0.5 }]} disabled={busy} onPress={mode === 'upgrade' ? upgrade : signIn}>
                <ThemedText style={styles.primaryBtnText}>{busy ? t('Please wait…') : mode === 'upgrade' ? t('Create account') : t('Sign in')}</ThemedText>
              </Pressable>
              <Pressable style={styles.linkBtn} onPress={() => setMode('none')}><ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText></Pressable>
            </View>
          ) : null}

          {!isGuest && mode === 'none' ? (
            <Pressable style={styles.linkBtn} onPress={confirmSignInOther}><ThemedText style={{ color: Brand.primary }}>{t('Sign in with another account')}</ThemedText></Pressable>
          ) : null}
          {mode === 'none' ? (
            <Pressable style={styles.linkBtn} onPress={signOut}><ThemedText style={{ color: Brand.danger }}>{t('Sign out')}</ThemedText></Pressable>
          ) : null}
        </ThemedView>

        {/* Language */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{t('Language')}</ThemedText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['en', 'pt'] as const).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[styles.pill, lang === l && styles.pillActive]}>
                <ThemedText style={lang === l ? { color: '#fff', fontWeight: '700' } : undefined}>{l === 'en' ? 'English' : 'Português'}</ThemedText>
              </Pressable>
            ))}
          </View>
        </ThemedView>

        {/* Privacy */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="shield-checkmark" size={20} color={Brand.success} />
            <ThemedText type="smallBold">{t('Your privacy')}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">{t('Your receipts, totals and reports are private to you.')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('Community prices (coming soon) share only the price of a product at a store on a date, never who bought it or what else was in the basket.')}</ThemedText>
        </ThemedView>

        <Pressable style={styles.linkBtn} onPress={async () => { await AsyncStorage.removeItem(ONBOARDING_KEY); router.replace('/'); Alert.alert(t('Introduction'), t('The introduction will show the next time the app starts.')); }}>
          <ThemedText themeColor="textSecondary">{t('Show the introduction again')}</ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>IziCost {version}</ThemedText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  upgradeCard: { backgroundColor: Brand.primary + '14', borderColor: Brand.primary + '66', borderWidth: 1, borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  primaryBtn: { backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  pill: { borderWidth: 1, borderColor: Brand.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  pillActive: { backgroundColor: Brand.primary },
});

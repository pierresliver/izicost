// Me tab: create / join / manage the household.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { PromptModal } from '@/features/prices/components/prompt-modal';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import { createHousehold, joinHousehold, leaveHousehold, removeMember, renameHousehold, rotateCode, setMyDisplayName, useHousehold, type Member } from '../api';
import { HOUSEHOLD_ERRORS } from '../i18n';

type Form = 'none' | 'create' | 'join';

function friendly(e: unknown): string {
  const msg = String((e as Error)?.message ?? e);
  const code = Object.keys(HOUSEHOLD_ERRORS).find((k) => msg.toLowerCase().includes(k));
  return code ? t(code) === code ? HOUSEHOLD_ERRORS[code] : t(code) : msg;
}

export function HouseholdCard({ isGuest, onNeedAccount }: { isGuest: boolean; onNeedAccount: () => void }) {
  const theme = useTheme();
  const { household, loaded, error: loadError, refresh } = useHousehold();
  const [form, setForm] = useState<Form>('none');
  const [name, setName] = useState('');
  const [me, setMe] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<'rename' | 'myname' | null>(null);

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    try { await fn(); after?.(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
    catch (e) { Alert.alert(t('Error'), friendly(e)); }
    finally { setBusy(false); }
  }

  function shareCode() {
    if (!household) return;
    Share.share({ message: t('Join my IziCost household “%name%” with the code %code%. In the app: Me → Household → Join with a code.', { name: household.name, code: household.invite_code }) }).catch(() => {});
  }
  function confirmRemove(m: Member) {
    Alert.alert(t('Remove %name% from the household?', { name: m.display_name }), t('They keep their receipts; they just stop being shared.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Remove'), style: 'destructive', onPress: () => run(() => removeMember(m.user_id)) },
    ]);
  }
  function confirmLeave() {
    Alert.alert(t('Leave the household?'), t('Your receipts stay yours and stop being shared with the others.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Leave'), style: 'destructive', onPress: () => run(() => leaveHousehold()) },
    ]);
  }

  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name="people" size={20} color={Brand.primary} />
      <ThemedText type="smallBold">{t('Household')}</ThemedText>
      {busy ? <ActivityIndicator size="small" color={Brand.primary} style={{ marginLeft: 'auto' }} /> : null}
    </View>
  );

  if (!loaded) return <ThemedView type="backgroundElement" style={styles.card}>{head}<ActivityIndicator color={Brand.primary} /></ThemedView>;

  if (!household && loadError) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        {head}
        <ThemedText type="small" themeColor="textSecondary">{t('Could not load your household. Check your connection and try again.')}</ThemedText>
        <Pressable style={styles.outlineBtn} onPress={() => run(() => refresh())}><ThemedText style={styles.outlineBtnText}>{t('Try again')}</ThemedText></Pressable>
      </ThemedView>
    );
  }

  if (!household) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        {head}
        <ThemedText type="smallBold">{t('Share spending with your household')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('Family members join with a code. Everyone in the household sees each other’s receipts, including restaurants and parking, and the reports add everything together.')}
        </ThemedText>
        {isGuest ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">{t('A household needs an account, so your data has a stable owner. Create a free account first.')}</ThemedText>
            <Pressable style={styles.primaryBtn} onPress={onNeedAccount}><ThemedText style={styles.primaryBtnText}>{t('Create account')}</ThemedText></Pressable>
          </>
        ) : form === 'none' ? (
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={() => setForm('create')}><ThemedText style={styles.primaryBtnText}>{t('Create a household')}</ThemedText></Pressable>
            <Pressable style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setForm('join')}><ThemedText style={styles.outlineBtnText}>{t('Join with a code')}</ThemedText></Pressable>
          </View>
        ) : (
          <View style={{ gap: Spacing.two }}>
            {form === 'create' ? (
              <TextInput style={inputStyle} placeholder={t('Household name, e.g. Casa Silva')} placeholderTextColor="#888" value={name} onChangeText={setName} maxLength={60} />
            ) : (
              <TextInput style={[inputStyle, styles.code]} placeholder={t('Invite code (6 characters)')} placeholderTextColor="#888" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={8} />
            )}
            <TextInput style={inputStyle} placeholder={t('Your name as others will see it')} placeholderTextColor="#888" value={me} onChangeText={setMe} maxLength={40} />
            {form === 'join' ? <ThemedText type="small" themeColor="textSecondary">{t('By joining you will see everyone’s receipts and they will see yours.')}</ThemedText> : null}
            <Pressable
              style={[styles.primaryBtn, (busy || (form === 'create' ? !name.trim() : code.replace(/[^A-Z0-9]/g, '').length !== 6)) && { opacity: 0.5 }]}
              disabled={busy || (form === 'create' ? !name.trim() : code.replace(/[^A-Z0-9]/g, '').length !== 6)}
              onPress={() => run(() => (form === 'create' ? createHousehold(name, me) : joinHousehold(code, me)), () => { setForm('none'); setName(''); setCode(''); })}>
              <ThemedText style={styles.primaryBtnText}>{form === 'create' ? t('Create') : t('Join')}</ThemedText>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={() => setForm('none')}><ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText></Pressable>
          </View>
        )}
      </ThemedView>
    );
  }

  const owner = household.my_role === 'owner';
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {head}
      <Pressable onPress={owner ? () => setPrompt('rename') : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ThemedText style={{ fontSize: 20, fontWeight: '700' }}>{household.name}</ThemedText>
        {owner ? <Ionicons name="pencil" size={14} color={theme.textSecondary} /> : null}
      </Pressable>

      <View style={[styles.codeBox, { backgroundColor: theme.background }]}>
        <View style={{ flex: 1 }}>
          <ThemedText type="small" themeColor="textSecondary">{t('Invite code')}</ThemedText>
          <ThemedText style={styles.codeText}>{household.invite_code}</ThemedText>
        </View>
        <Pressable onPress={shareCode} style={styles.smallBtn} accessibilityLabel={t('Share code')}>
          <Ionicons name="share-social" size={16} color="#fff" />
          <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('Share code')}</ThemedText>
        </Pressable>
      </View>

      <ThemedText type="smallBold">{t('Members')} ({household.members.length})</ThemedText>
      {household.members.map((m) => (
        <View key={m.user_id} style={styles.memberRow}>
          <Ionicons name={m.role === 'owner' ? 'star' : 'person-circle-outline'} size={18} color={m.role === 'owner' ? Brand.warning : theme.textSecondary} />
          <Pressable onPress={m.is_me ? () => setPrompt('myname') : undefined} style={{ flex: 1 }}>
            <ThemedText>{m.display_name}{m.is_me ? ` (${t('you')})` : ''}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{t(m.role)}</ThemedText>
          </Pressable>
          {owner && !m.is_me ? (
            <Pressable onPress={() => confirmRemove(m)} hitSlop={8} accessibilityLabel={t('Remove')}><Ionicons name="close-circle-outline" size={22} color={Brand.danger} /></Pressable>
          ) : null}
        </View>
      ))}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.one }}>
        {owner ? (
          <Pressable style={styles.linkBtn} onPress={() => run(() => rotateCode())}><ThemedText style={{ color: Brand.primary }}>{t('New code')}</ThemedText></Pressable>
        ) : <View />}
        <Pressable style={styles.linkBtn} onPress={confirmLeave}><ThemedText style={{ color: Brand.danger }}>{t('Leave household')}</ThemedText></Pressable>
      </View>

      <PromptModal
        key={prompt ?? 'none'} // remount per prompt: no stale text between "rename" and "my name"
        visible={prompt !== null}
        initialValue={prompt === 'rename' ? household.name : prompt === 'myname' ? household.members.find((m) => m.is_me)?.display_name : undefined}
        title={prompt === 'rename' ? t('Rename household') : t('Change my name')}
        placeholder={prompt === 'rename' ? t('Household name, e.g. Casa Silva') : t('Your name as others will see it')}
        onClose={() => setPrompt(null)}
        onSubmit={(v) => { const which = prompt; setPrompt(null); run(() => (which === 'rename' ? renameHousehold(v) : setMyDisplayName(v))); }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  code: { letterSpacing: 4, fontWeight: '700', textAlign: 'center' },
  primaryBtn: { backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  outlineBtn: { borderWidth: 1.5, borderColor: Brand.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { color: Brand.primary, fontSize: 15, fontWeight: '700' },
  linkBtn: { paddingVertical: Spacing.two },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, padding: Spacing.two + 4 },
  codeText: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: 4 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 4 },
});

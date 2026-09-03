// Small cross-platform text prompt (Alert.prompt is iOS-only).
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

export function PromptModal({ visible, title, message, placeholder, keyboardType, confirmLabel, initialValue, onSubmit, onClose }: {
  visible: boolean; title: string; message?: string; placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad'; confirmLabel?: string;
  /** Prefilled text (e.g. the current name when renaming). Give the modal a `key` to reset it between uses. */
  initialValue?: string;
  onSubmit: (value: string) => void; onClose: () => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue ?? '');
  const submit = () => { const v = value.trim(); if (!v) return; onSubmit(v); setValue(''); };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <ThemedView style={styles.box}>
          <ThemedText type="smallBold" style={{ fontSize: 17 }}>{title}</ThemedText>
          {message ? <ThemedText type="small" themeColor="textSecondary">{message}</ThemedText> : null}
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholder={placeholder} placeholderTextColor="#888" value={value} onChangeText={setValue}
            keyboardType={keyboardType ?? 'default'} autoFocus onSubmitEditing={submit}
          />
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.btn}><ThemedText themeColor="textSecondary">{t('Cancel')}</ThemedText></Pressable>
            <Pressable onPress={submit} style={[styles.btn, { backgroundColor: Brand.primary }]}>
              <ThemedText style={{ color: '#fff', fontWeight: '700' }}>{confirmLabel ?? t('OK')}</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: Spacing.four, backgroundColor: 'rgba(0,0,0,0.4)' },
  box: { borderRadius: 18, padding: Spacing.three, gap: Spacing.two },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 18 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two, marginTop: Spacing.one },
  btn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
});

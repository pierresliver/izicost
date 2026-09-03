// Voice input for the shopping list: the phone's own speech recogniser (free, Portuguese + English,
// offline on most Androids). We only get text back; the audio never leaves the recogniser.
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';

import type { Lang } from '@/lib/i18n';

export type VoiceStatus = 'idle' | 'starting' | 'listening';
export type VoiceError = 'not-allowed' | 'unavailable' | 'no-speech' | 'network' | 'other';

/** Recogniser locale per app language. pt-PT is the closest available to Mozambican Portuguese. */
export function voiceLocale(lang: Lang): string {
  return lang === 'pt' ? 'pt-PT' : 'en-ZA';
}

/**
 * @param onFinal called once per listening session with the text heard (never after cancel()).
 * @param onError called once per session with a coarse error code (never for a user cancel).
 */
export function useVoiceInput(lang: Lang, onFinal: (transcript: string) => void, onError: (code: VoiceError) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const lastRef = useRef('');
  const finalSentRef = useRef(false);

  useSpeechRecognitionEvent('start', () => { setStatus('listening'); });
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    lastRef.current = text;
    setTranscript(text);
    if (e.isFinal && text.trim() && !finalSentRef.current) { finalSentRef.current = true; onFinal(text.trim()); }
  });
  useSpeechRecognitionEvent('end', () => {
    setStatus('idle');
    if (finalSentRef.current) return;
    finalSentRef.current = true;
    // Some recognisers stop without an isFinal result: use the last interim text. Nothing at all
    // (Done tapped before speaking, silent end) counts as "nothing heard" so the sheet never hangs.
    if (lastRef.current.trim()) onFinal(lastRef.current.trim());
    else onError('no-speech');
  });
  useSpeechRecognitionEvent('error', (e) => {
    setStatus('idle');
    if (e.error === 'aborted' || finalSentRef.current) return; // cancelled, or a late error after the text was already delivered
    finalSentRef.current = true; // one outcome per session: an error means no onFinal from 'end'
    if (e.error === 'no-speech' || e.error === 'speech-timeout') onError('no-speech');
    else if (e.error === 'not-allowed') onError('not-allowed');
    else if (e.error === 'service-not-allowed' || e.error === 'language-not-supported') onError('unavailable');
    else if (e.error === 'network') onError('network');
    else onError('other');
  });

  const start = useCallback(async () => {
    setTranscript(''); lastRef.current = ''; finalSentRef.current = false;
    setStatus('starting');
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) { setStatus('idle'); finalSentRef.current = true; onError('unavailable'); return; }
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { setStatus('idle'); finalSentRef.current = true; onError('not-allowed'); return; }
      ExpoSpeechRecognitionModule.start({
        lang: voiceLocale(lang),
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        contextualStrings: lang === 'pt'
          ? ['arroz', 'leite', 'ovos', 'óleo', 'açúcar', 'farinha', 'pão', 'frango', 'tomate', 'cebola', 'sabão', 'quilos', 'litros']
          : ['rice', 'milk', 'eggs', 'oil', 'sugar', 'flour', 'bread', 'chicken', 'tomatoes', 'onions', 'soap', 'kilos', 'litres'],
      });
    } catch {
      setStatus('idle'); finalSentRef.current = true; onError('unavailable');
    }
  }, [lang, onError]);

  const stop = useCallback(() => { try { ExpoSpeechRecognitionModule.stop(); } catch { /* not running */ } }, []);
  const cancel = useCallback(() => {
    finalSentRef.current = true; // whatever comes after this is not wanted
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* not running */ }
    setStatus('idle'); setTranscript('');
  }, []);

  return { status, transcript, start, stop, cancel };
}

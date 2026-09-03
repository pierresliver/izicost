// Voice input for the shopping list: the phone's own speech recogniser (free, Portuguese + English,
// offline on most Androids). We only get text back; the audio never leaves the recogniser.
//
// Lessons from the first phone test (2026-09-03): (1) the spoken language must be chosen by the user,
// not inferred from the app language; (2) "single phrase" mode stops at the first pause, so we listen
// continuously, collect every phrase, and only finish when the user taps Done. If the phone ends the
// session early anyway (older Android), we keep what was heard and offer "Add more".
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceLang = 'pt' | 'en';
export type VoiceStatus = 'idle' | 'starting' | 'listening' | 'paused';
export type VoiceError = 'not-allowed' | 'unavailable' | 'no-speech' | 'network' | 'other';

const LANG_KEY = 'izicost.voiceLang';
const PT_REGIONS = ['MZ', 'PT', 'BR', 'AO', 'CV', 'GW', 'ST', 'TL'];

/** Remembered choice, else Portuguese in Portuguese-speaking regions, else the app language. */
export async function loadVoiceLang(appLang: VoiceLang): Promise<VoiceLang> {
  try {
    const v = await AsyncStorage.getItem(LANG_KEY);
    if (v === 'pt' || v === 'en') return v;
  } catch { /* default */ }
  try {
    const region = String(Intl.DateTimeFormat().resolvedOptions().locale ?? '').split(/[-_]/)[1]?.toUpperCase() ?? '';
    if (PT_REGIONS.includes(region)) return 'pt';
  } catch { /* default */ }
  return appLang;
}
export async function saveVoiceLang(v: VoiceLang): Promise<void> {
  try { await AsyncStorage.setItem(LANG_KEY, v); } catch { /* fine */ }
}

let supportedCache: string[] | null = null;
/** Recogniser locale: prefer pt-PT (closest to Mozambique), fall back to pt-BR when only that is installed. */
async function voiceLocale(lang: VoiceLang): Promise<string> {
  if (lang === 'en') return 'en-ZA';
  try {
    if (!supportedCache) {
      const s = await ExpoSpeechRecognitionModule.getSupportedLocales({});
      supportedCache = [...(s.locales ?? []), ...(s.installedLocales ?? [])].map((l) => l.replace('_', '-'));
    }
    const has = (code: string) => supportedCache!.some((l) => l.toLowerCase() === code.toLowerCase());
    if (has('pt-PT')) return 'pt-PT';
    if (has('pt-BR')) return 'pt-BR';
  } catch { /* unknown: try pt-PT */ }
  return 'pt-PT';
}

const CONTEXT: Record<VoiceLang, string[]> = {
  pt: ['arroz', 'leite', 'ovos', 'óleo', 'açúcar', 'farinha', 'pão', 'frango', 'tomate', 'cebola', 'sabão', 'quilos', 'litros', 'picanha', 'vinho', 'whisky'],
  en: ['rice', 'milk', 'eggs', 'oil', 'sugar', 'flour', 'bread', 'chicken', 'tomatoes', 'onions', 'soap', 'kilos', 'litres', 'steak', 'wine', 'whisky'],
};

/**
 * @param onFinal called once per session with everything heard, when the user taps Done.
 * @param onError called once per session with a coarse error code (never for a user cancel).
 */
export function useVoiceInput(onFinal: (transcript: string) => void, onError: (code: VoiceError) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const partsRef = useRef<string[]>([]);     // finished phrases
  const interimRef = useRef('');              // the phrase being spoken now
  const doneRef = useRef(false);              // the user tapped Done: the next 'end' delivers the text
  const cancelledRef = useRef(false);
  const settledRef = useRef(false);           // onFinal/onError already sent for this session
  const langRef = useRef<VoiceLang>('pt');

  const full = () => [...partsRef.current, interimRef.current].map((s) => s.trim()).filter(Boolean).join(', ');
  const publish = () => setTranscript(full());

  useSpeechRecognitionEvent('start', () => { setStatus('listening'); });
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) { if (text.trim()) partsRef.current.push(text.trim()); interimRef.current = ''; }
    else interimRef.current = text;
    publish();
  });
  useSpeechRecognitionEvent('end', () => {
    if (cancelledRef.current || settledRef.current) { setStatus('idle'); return; }
    if (interimRef.current.trim()) { partsRef.current.push(interimRef.current.trim()); interimRef.current = ''; publish(); }
    if (doneRef.current) {
      settledRef.current = true; setStatus('idle');
      const text = full();
      if (text) onFinal(text); else onError('no-speech');
    } else {
      // the phone stopped on its own (a pause, or an old Android without continuous mode): keep the text
      setStatus('paused');
    }
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (cancelledRef.current || settledRef.current) { setStatus('idle'); return; }
    if (e.error === 'aborted') { setStatus('idle'); return; }
    if (e.error === 'no-speech' || e.error === 'speech-timeout') {
      // nothing new was heard: pause with what we have (an empty pause is fine too — the sheet offers Done / Add more)
      if (doneRef.current) { settledRef.current = true; setStatus('idle'); const text = full(); if (text) onFinal(text); else onError('no-speech'); }
      else setStatus('paused');
      return;
    }
    settledRef.current = true; setStatus('idle');
    if (e.error === 'not-allowed') onError('not-allowed');
    else if (e.error === 'service-not-allowed' || e.error === 'language-not-supported') onError('unavailable');
    else if (e.error === 'network') onError('network');
    else onError('other');
  });

  const listen = useCallback(async (lang: VoiceLang) => {
    setStatus('starting');
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) { settledRef.current = true; setStatus('idle'); onError('unavailable'); return; }
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { settledRef.current = true; setStatus('idle'); onError('not-allowed'); return; }
      ExpoSpeechRecognitionModule.start({
        lang: await voiceLocale(lang),
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,               // keep listening through pauses (Android 13+); older phones fall back to 'paused'
        contextualStrings: CONTEXT[lang],
        androidIntentOptions: {         // for phones that ignore `continuous`: allow long pauses before giving up
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 6000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 6000,
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 20000,
        },
      });
    } catch {
      settledRef.current = true; setStatus('idle'); onError('unavailable');
    }
  }, [onError]);

  /** New session: forget everything and listen. */
  const start = useCallback(async (lang: VoiceLang) => {
    partsRef.current = []; interimRef.current = ''; doneRef.current = false; cancelledRef.current = false; settledRef.current = false;
    langRef.current = lang; setTranscript('');
    await listen(lang);
  }, [listen]);

  /** After a pause: keep what was heard and listen for more (optionally in another language). */
  const resume = useCallback(async (lang?: VoiceLang) => {
    if (lang) langRef.current = lang;
    if (status === 'listening') { try { ExpoSpeechRecognitionModule.abort(); } catch { /* not running */ } }
    await listen(langRef.current);
  }, [listen, status]);

  /** The user is finished: deliver the text (via 'end' when still listening, directly when paused). */
  const finish = useCallback(() => {
    doneRef.current = true;
    if (status === 'listening' || status === 'starting') { try { ExpoSpeechRecognitionModule.stop(); } catch { /* not running */ } return; }
    if (settledRef.current) return;
    settledRef.current = true; setStatus('idle');
    const text = full();
    if (text) onFinal(text); else onError('no-speech');
  }, [status, onFinal, onError]);

  const cancel = useCallback(() => {
    cancelledRef.current = true; settledRef.current = true;
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* not running */ }
    setStatus('idle'); setTranscript('');
  }, []);

  // never leave the microphone open when the screen goes away
  useEffect(() => () => { try { ExpoSpeechRecognitionModule.abort(); } catch { /* not running */ } }, []);

  return { status, transcript, start, resume, finish, cancel };
}

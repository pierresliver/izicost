// IziCost — lightweight i18n (English + Português), same pattern as IziCamera, no shared code.
//   t('English text') — the English string IS the key. If a Portuguese entry exists it is
//   returned; otherwise the English falls through, so nothing ever renders blank.
//   Device language is detected; a manual override persists in AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'en' | 'pt';
const STORAGE_KEY = 'izicost.language';

const PT: Record<string, string> = {
  // tabs
  'Home': 'Início',
  'Scan': 'Digitalizar',
  'Receipts': 'Recibos',
  'Prices': 'Preços',
  'Community prices are coming soon.': 'Os preços da comunidade chegam em breve.',
  // home
  'This month': 'Este mês',
  'receipts': 'recibos',
  'No receipts yet. Scan your first one!': 'Ainda não há recibos. Digitalize o primeiro!',
  'Scan a receipt': 'Digitalizar um recibo',
  'Top stores': 'Lojas principais',
  'By category': 'Por categoria',
  // scan
  'Take a photo': 'Tirar foto',
  'Choose from gallery': 'Escolher da galeria',
  'Lay the receipt flat, good light, no glare. Include the total.': 'Coloque o recibo plano, com boa luz e sem reflexos. Inclua o total.',
  'Uploading photo…': 'A enviar a foto…',
  'Reading the receipt… about 10 seconds': 'A ler o recibo… cerca de 10 segundos',
  'Could not read this receipt': 'Não foi possível ler este recibo',
  'Camera permission is needed to scan receipts.': 'É necessária permissão da câmara para digitalizar recibos.',
  'Try again': 'Tentar de novo',
  // confirm
  'Check what we read': 'Confirme o que lemos',
  'Store': 'Loja',
  'Address': 'Endereço',
  'Date': 'Data',
  'Total': 'Total',
  'Currency': 'Moeda',
  'Paid by': 'Pago com',
  'Items': 'Artigos',
  'Qty': 'Qtd',
  'Item': 'Artigo',
  'Price': 'Preço',
  'Add item': 'Adicionar artigo',
  'Save': 'Guardar',
  'Saving…': 'A guardar…',
  'Cancel': 'Cancelar',
  'Doubtful lines are highlighted. Tap any value to fix it.': 'As linhas duvidosas estão destacadas. Toque num valor para o corrigir.',
  'Items add up to %sum%, receipt total is %total%.': 'Os artigos somam %sum%, o total do recibo é %total%.',
  'Items match the total.': 'Os artigos batem certo com o total.',
  'Nothing to save': 'Nada para guardar',
  'Could not save': 'Não foi possível guardar',
  'cash': 'dinheiro',
  'card': 'cartão',
  'mobile_money': 'dinheiro móvel',
  'other': 'outro',
  'unknown': 'desconhecido',
  // receipts
  'No receipts saved yet.': 'Ainda não há recibos guardados.',
  'items': 'artigos',
  'Delete': 'Eliminar',
  'Delete this receipt?': 'Eliminar este recibo?',
  'Could not delete': 'Não foi possível eliminar',
  'This cannot be undone.': 'Esta ação não pode ser anulada.',
  'Receipt': 'Recibo',
  'Photo': 'Foto',
  'Language': 'Idioma',
  // onboarding
  'Skip': 'Saltar',
  'Next': 'Seguinte',
  'Get started': 'Começar',
  'Snap the receipt': 'Fotografe o recibo',
  'Take one photo. IziCost reads the store, the date and every item and price in about ten seconds.': 'Tire uma foto. O IziCost lê a loja, a data e cada artigo e preço em cerca de dez segundos.',
  'Check it in one tap': 'Confirme com um toque',
  'We show you what we read next to the photo. Anything doubtful is highlighted. Fix it if needed, then tap Save.': 'Mostramos o que lemos ao lado da foto. O que for duvidoso fica destacado. Corrija se for preciso e toque em Guardar.',
  'See where your money goes': 'Veja para onde vai o seu dinheiro',
  'Spending by month, store and category, with every receipt photo kept safely. Private to you, always.': 'Gastos por mês, loja e categoria, com a foto de cada recibo guardada em segurança. Sempre privado.',
  'Find where things are cheapest': 'Descubra onde é mais barato',
  'Prices from all users are pooled anonymously, so you can see where each product costs less near you or in any city. Only prices are shared, never who you are or what you spent.': 'Os preços de todos os utilizadores são reunidos de forma anónima, para ver onde cada produto custa menos perto de si ou em qualquer cidade. Só se partilham preços, nunca quem você é nem quanto gastou.',
  // me / account
  'Me': 'Eu',
  'Guest': 'Convidado',
  'Receipts live only on this phone': 'Os recibos só existem neste telemóvel',
  'Signed in': 'Sessão iniciada',
  'Keep your receipts safe': 'Proteja os seus recibos',
  'Create a free account so your receipts survive a lost or new phone. Everything you scanned as a guest is kept.': 'Crie uma conta gratuita para que os seus recibos sobrevivam a um telemóvel perdido ou novo. Tudo o que digitalizou como convidado é mantido.',
  'Create account': 'Criar conta',
  'I already have an account': 'Já tenho uma conta',
  'Sign in': 'Entrar',
  'Sign in with another account': 'Entrar com outra conta',
  'Sign out': 'Terminar sessão',
  'Sign out?': 'Terminar sessão?',
  'You will be signed out on this phone only.': 'A sessão será terminada apenas neste telemóvel.',
  'You are a guest. Signing out permanently loses the receipts on this phone. Create an account first to keep them.': 'É um convidado. Terminar a sessão perde para sempre os recibos deste telemóvel. Crie primeiro uma conta para os manter.',
  'You are a guest': 'É um convidado',
  'Signing in with another account will leave the receipts you scanned as a guest behind. Create an account first to keep them.': 'Entrar com outra conta deixa para trás os recibos que digitalizou como convidado. Crie primeiro uma conta para os manter.',
  'Continue': 'Continuar',
  'Email': 'Email',
  'Password': 'Palavra-passe',
  'Please wait…': 'Aguarde…',
  'Check the form': 'Verifique o formulário',
  'Enter a valid email and a password of at least 6 characters.': 'Introduza um email válido e uma palavra-passe com pelo menos 6 caracteres.',
  'Enter your email and password.': 'Introduza o seu email e palavra-passe.',
  'Account created': 'Conta criada',
  'Your receipts are now linked to %email%. You stay signed in on this phone.': 'Os seus recibos estão agora ligados a %email%. Continua com sessão iniciada neste telemóvel.',
  'Error': 'Erro',
  'Your privacy': 'A sua privacidade',
  'Your receipts, totals and reports are private to you.': 'Os seus recibos, totais e relatórios são privados.',
  'Community prices share only the price of a product at a store on a date, never who bought it or what else was in the basket. A price is shown only after at least two reports.': 'Os preços da comunidade partilham apenas o preço de um produto numa loja numa data, nunca quem o comprou nem o que mais estava no cesto. Um preço só aparece depois de pelo menos dois registos.',
  'Show the introduction again': 'Mostrar a introdução novamente',
  'Introduction': 'Introdução',
  'The introduction will show the next time the app starts.': 'A introdução será mostrada na próxima vez que a aplicação iniciar.',
  // categories
  'food': 'alimentação',
  'drink': 'bebidas',
  'alcohol': 'álcool',
  'restaurant': 'restaurante',
  'household': 'casa',
  'personal_care': 'higiene',
  'pharmacy': 'farmácia',
  'pet': 'animais',
  'clothing': 'roupa',
  'electronics': 'eletrónica',
  'fuel': 'combustível',
  'parking': 'estacionamento',
  'transport': 'transporte',
  'utilities': 'serviços (água, luz, TV)',
  'services': 'serviços',
};

function deviceLang(): Lang {
  try {
    // Hermes ships full Intl, so this reflects the phone's language on Android and iOS.
    const s = String(Intl.DateTimeFormat().resolvedOptions().locale ?? 'en');
    return s.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  } catch {
    return 'en';
  }
}

let currentLang: Lang = deviceLang();

/**
 * Feature modules add their own Portuguese strings with this, from their own file
 * (e.g. src/features/reports/i18n.ts), so several people can work without editing this file.
 */
export function registerTranslations(dict: Record<string, string>): void {
  Object.assign(PT, dict);
}

/** Translate. Supports %name% placeholders via the second argument. */
export function t(en: string, vars?: Record<string, string | number>): string {
  let s = currentLang === 'pt' ? PT[en] ?? en : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`%${k}%`).join(String(v));
  return s;
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => { currentLang = deviceLang(); return currentLang; });
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'en' || v === 'pt') { currentLang = v; setLangState(v); }
    }).catch(() => {});
  }, []);
  const value = useMemo(
    () => ({
      lang,
      setLang: (l: Lang) => { currentLang = l; setLangState(l); AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {}); },
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

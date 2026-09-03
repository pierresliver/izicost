// Portuguese for households (family sharing) and the Me / Household switch.
import { registerTranslations } from '@/lib/i18n';

registerTranslations({
  'Household': 'Agregado familiar',
  'Me': 'Eu',
  'Share spending with your household': 'Partilhe os gastos com o seu agregado familiar',
  'Family members join with a code. Everyone in the household sees each other’s receipts, including restaurants and parking, and the reports add everything together.':
    'Os membros da família entram com um código. Todos no agregado veem os recibos uns dos outros, incluindo restaurantes e estacionamento, e os relatórios somam tudo.',
  'A household needs an account, so your data has a stable owner. Create a free account first.':
    'Um agregado familiar precisa de uma conta, para que os seus dados tenham um dono estável. Crie primeiro uma conta gratuita.',
  'Create a household': 'Criar um agregado',
  'Join with a code': 'Entrar com um código',
  'Household name, e.g. Casa Silva': 'Nome do agregado, ex.: Casa Silva',
  'Your name as others will see it': 'O seu nome, como os outros o verão',
  'Invite code (6 characters)': 'Código de convite (6 caracteres)',
  'Create': 'Criar',
  'Join': 'Entrar',
  'By joining you will see everyone’s receipts and they will see yours.': 'Ao entrar, verá os recibos de todos e eles verão os seus.',
  'Invite code': 'Código de convite',
  'Share code': 'Partilhar código',
  'New code': 'Novo código',
  'Members': 'Membros',
  'owner': 'responsável',
  'member': 'membro',
  'you': 'você',
  'Remove': 'Remover',
  'Remove %name% from the household?': 'Remover %name% do agregado?',
  'They keep their receipts; they just stop being shared.': 'Mantém os seus recibos; apenas deixam de ser partilhados.',
  'Leave household': 'Sair do agregado',
  'Leave the household?': 'Sair do agregado?',
  'Your receipts stay yours and stop being shared with the others.': 'Os seus recibos continuam seus e deixam de ser partilhados com os outros.',
  'Leave': 'Sair',
  'Rename household': 'Mudar o nome do agregado',
  'Change my name': 'Mudar o meu nome',
  'Join my IziCost household “%name%” with the code %code%. In the app: Me → Household → Join with a code.':
    'Entre no meu agregado IziCost “%name%” com o código %code%. Na app: Eu → Agregado familiar → Entrar com um código.',
  'Household this month': 'Agregado este mês',
  'Scanned by %name%': 'Digitalizado por %name%',
  'Only the person who scanned a receipt can change or delete it.': 'Só quem digitalizou um recibo o pode alterar ou eliminar.',
  'Showing the whole household': 'A mostrar todo o agregado',
  'Could not load your household. Check your connection and try again.': 'Não foi possível carregar o seu agregado. Verifique a ligação e tente de novo.',
  'Only you': 'Só você',
  'Budgets are personal: they compare against your own receipts.': 'Os orçamentos são pessoais: comparam com os seus próprios recibos.',
  'Showing only your receipts': 'A mostrar apenas os seus recibos',
  // RPC error codes -> plain language
  'account required': 'É preciso uma conta para isto.',
  'already in a household': 'Já faz parte de um agregado. Saia primeiro para criar ou entrar noutro.',
  'invalid code': 'Código inválido. Verifique os 6 caracteres com quem o convidou.',
  'too many attempts': 'Demasiadas tentativas hoje. Tente de novo amanhã.',
  'household full': 'Este agregado já tem o máximo de 12 membros.',
  'not owner': 'Só o responsável do agregado pode fazer isto.',
  'name required': 'Escreva um nome.',
});

/** Plain-language versions of the server error codes (English side; Portuguese comes from the dictionary). */
export const HOUSEHOLD_ERRORS: Record<string, string> = {
  'account required': 'An account is needed for this.',
  'already in a household': 'You are already in a household. Leave it first to create or join another.',
  'invalid code': 'Invalid code. Check the 6 characters with the person who invited you.',
  'too many attempts': 'Too many attempts today. Try again tomorrow.',
  'household full': 'This household already has the maximum of 12 members.',
  'not owner': 'Only the household owner can do this.',
  'name required': 'Please enter a name.',
};

// Budgets: one overall monthly limit (category = null) plus optional per-category limits.
// Table: public.budgets (supabase/migrations/002_budgets.sql).
import { ensureSession, supabase } from '@/lib/supabase';

import { daysLeftInMonth } from './dates';

export type Budget = {
  id: string;
  category: string | null;   // null = overall
  amount: number;
  currency: string;
  period: string;
};

export class BudgetsUnavailable extends Error {}

function isMissingTable(message: string): boolean {
  return /relation .*budgets.* does not exist|Could not find the table 'public\.budgets'|schema cache/i.test(message);
}

export async function listBudgets(): Promise<Budget[]> {
  await ensureSession();
  const { data, error } = await supabase.from('budgets').select('id, category, amount, currency, period').order('category', { nullsFirst: true });
  if (error) {
    if (isMissingTable(error.message)) throw new BudgetsUnavailable(error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((b) => ({ ...(b as Budget), amount: Number((b as Budget).amount) }));
}

/** Insert or update the budget for (category, currency). `amount` <= 0 deletes it. */
export async function setBudget(category: string | null, amount: number, currency: string): Promise<void> {
  const uid = await ensureSession();
  let q = supabase.from('budgets').select('id').eq('currency', currency);
  q = category === null ? q.is('category', null) : q.eq('category', category);
  const { data: found, error: e1 } = await q.limit(1).maybeSingle();
  if (e1) throw new Error(isMissingTable(e1.message) ? 'budgets table missing' : e1.message);

  if (!(amount > 0)) {
    if (found?.id) {
      const { error } = await supabase.from('budgets').delete().eq('id', found.id);
      if (error) throw new Error(error.message);
    }
    return;
  }
  if (found?.id) {
    const { error } = await supabase.from('budgets').update({ amount }).eq('id', found.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('budgets').insert({ user_id: uid, category, amount, currency, period: 'month' });
    if (error) throw new Error(error.message);
  }
}

export type BudgetStatus = {
  budget: Budget;
  spent: number;
  ratio: number;            // spent / amount
  left: number;             // may be negative
  leftPerDay: number;       // 0 when over
  level: 'ok' | 'warn' | 'over';
};

/** Progress for each budget given this month's spend (overall total + per-category slices). */
export function budgetStatus(budgets: Budget[], currency: string, monthTotal: number, byCategory: { name: string; total: number }[]): BudgetStatus[] {
  const daysLeft = daysLeftInMonth();
  return budgets
    .filter((b) => b.currency === currency && b.period === 'month')
    .map((budget): BudgetStatus => {
      const spent = budget.category === null ? monthTotal : byCategory.find((c) => c.name === budget.category)?.total ?? 0;
      const ratio = budget.amount > 0 ? spent / budget.amount : 0;
      const left = budget.amount - spent;
      return {
        budget,
        spent,
        ratio,
        left,
        leftPerDay: left > 0 ? left / daysLeft : 0,
        level: ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok',
      };
    })
    .sort((a, b) => (a.budget.category === null ? -1 : b.budget.category === null ? 1 : b.ratio - a.ratio));
}

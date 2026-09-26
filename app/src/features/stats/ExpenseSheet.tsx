import { useState } from 'react';
import { formatPEN, parseSolesToCents } from '../../domain/money';
import { EXPENSE_CATEGORIES, registerExpense, type ExpenseCategory } from '../../db/cash';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { NumPad } from '../../ui/NumPad';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast, toastError } from '../../ui/toast';
import styles from './Stats.module.css';

export function ExpenseSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('transporte');
  const [method, setMethod] = useState<'cash' | 'digital'>('cash');
  const [note, setNote] = useState('');
  const amount = parseSolesToCents(text || '0');
  const valid = amount !== null && amount > 0;
  const save = async () => {
    if (!valid) return;
    try {
      await registerExpense(amount, category, method, note);
      toast(t.expense.saved, 'success');
      onClose();
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <Sheet
      title={t.expense.title}
      onClose={onClose}
      footer={
        <Button variant="primary" block disabled={!valid} onClick={save}>
          {t.common.save} {valid ? `· ${formatPEN(amount)}` : ''}
        </Button>
      }
    >
      <div className={styles.amountDisplay}>S/ {text || '0'}</div>
      <div className={s.label}>{t.expense.category}</div>
      <div className={styles.chips} role="group" aria-label={t.expense.category}>
        {EXPENSE_CATEGORIES.map((c) => (
          <button key={c} type="button" className={styles.chip} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {t.expense.categories[c]}
          </button>
        ))}
      </div>
      <div className={s.segment} role="group" aria-label="Método">
        <button type="button" aria-pressed={method === 'cash'} onClick={() => setMethod('cash')}>
          {t.checkout.cash}
        </button>
        <button type="button" aria-pressed={method === 'digital'} onClick={() => setMethod('digital')}>
          {t.checkout.digital}
        </button>
      </div>
      <input
        className={s.input}
        placeholder={t.expense.note}
        aria-label={t.expense.note}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <NumPad value={text} onChange={setText} decimals={2} />
    </Sheet>
  );
}

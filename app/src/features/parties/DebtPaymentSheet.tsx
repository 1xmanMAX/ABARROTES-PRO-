import { useState } from 'react';
import { centsToInput, formatPEN, parseSolesToCents } from '../../domain/money';
import { receiveDebtPayment } from '../../db/parties';
import type { Party } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { NumPad } from '../../ui/NumPad';
import { PinPad } from '../../ui/PinPad';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast } from '../../ui/toast';
import styles from './Parties.module.css';

interface Props {
  party: Party;
  onDone: (signatureId: string) => void;
  onClose: () => void;
}

/** Cobrar una deuda (SPEC §7): monto (Todo o parcial), método y firma de la persona. */
export function DebtPaymentSheet({ party, onDone, onClose }: Props) {
  const [text, setText] = useState(centsToInput(party.balance));
  const [method, setMethod] = useState<'cash' | 'digital'>('cash');
  const [signing, setSigning] = useState(false);
  const amount = parseSolesToCents(text || '0');
  const valid = amount !== null && amount > 0 && amount <= party.balance;
  const firstName = party.name.split(' ')[0] ?? party.name;

  return (
    <Sheet title={`${t.parties.payTitle} · ${party.name}`} onClose={onClose}>
      {signing && valid ? (
        <PinPad
          title={t.parties.paySign(firstName, formatPEN(amount))}
          hint={t.pin.handPhone}
          onSubmit={async (pin) => {
            const sig = await receiveDebtPayment(party.id, amount, method, pin);
            toast(t.parties.payDone, 'success');
            onDone(sig.id);
          }}
        />
      ) : (
        <>
          <div className={s.muted}>
            {t.parties.balance}: <strong className="mono">{formatPEN(party.balance)}</strong>
          </div>
          <div className={styles.amountDisplay}>S/ {text || '0'}</div>
          {amount !== null && amount > party.balance && (
            <p className={styles.warn}>{t.checkout.owes(formatPEN(party.balance))}</p>
          )}
          <div className={s.segment} role="group">
            <button
              type="button"
              aria-pressed={text === centsToInput(party.balance)}
              onClick={() => setText(centsToInput(party.balance))}
            >
              {t.parties.payAll}
            </button>
            <button type="button" aria-pressed={text !== centsToInput(party.balance)} onClick={() => setText('')}>
              {t.parties.payOther}
            </button>
          </div>
          <div className={s.segment} role="group" aria-label="Método">
            <button type="button" aria-pressed={method === 'cash'} onClick={() => setMethod('cash')}>
              {t.checkout.cash}
            </button>
            <button type="button" aria-pressed={method === 'digital'} onClick={() => setMethod('digital')}>
              {t.checkout.digital}
            </button>
          </div>
          <NumPad value={text} onChange={setText} decimals={2} />
          <Button variant="primary" block disabled={!valid} onClick={() => setSigning(true)}>
            {t.pin.sign} · {valid ? formatPEN(amount) : ''}
          </Button>
        </>
      )}
    </Sheet>
  );
}

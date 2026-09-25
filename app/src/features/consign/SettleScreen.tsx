import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNav } from '../../app/nav';
import { pendingQty, pendingValue, previewSettlement } from '../../domain/consignment';
import { formatPEN, parseSolesToCents } from '../../domain/money';
import { formatQty } from '../../domain/qty';
import { dayKeyOf, formatDayKey } from '../../domain/time';
import { getOpenConsignments, settleConsignments, type OpenConsignment } from '../../db/consignments';
import { db } from '../../db/schema';
import type { Party } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { NumPad } from '../../ui/NumPad';
import { PinPad } from '../../ui/PinPad';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast } from '../../ui/toast';
import styles from './Consign.module.css';

export default function SettleScreen({ partyId }: { partyId: string }) {
  const data = useLiveQuery(
    async () => ({ party: await db.parties.get(partyId), open: await getOpenConsignments(partyId) }),
    [partyId],
  );
  if (!data?.party) return null;
  return <SettleForm party={data.party} open={data.open} />;
}

/** Liquidar al vendedor (SPEC §8.2). */
function SettleForm({ party, open }: { party: Party; open: OpenConsignment[] }) {
  const replace = useNav((st) => st.replace);
  const [selected, setSelected] = useState<string[]>(() => open.map((o) => o.consignment.id));
  const [returns, setReturns] = useState<Record<string, number>>({});
  const [payMode, setPayMode] = useState<'all' | 'none' | 'other'>('all');
  const [otherText, setOtherText] = useState('');
  const [method, setMethod] = useState<'cash' | 'digital'>('cash');
  const [signing, setSigning] = useState(false);

  const lines = useMemo(
    () => open.filter((o) => selected.includes(o.consignment.id)).flatMap((o) => o.lines.filter((l) => pendingQty(l) > 0)),
    [open, selected],
  );
  const preview = useMemo(() => previewSettlement(lines, returns, party.balance), [lines, returns, party.balance]);
  const other = parseSolesToCents(otherText || '0');
  const paidNow = payMode === 'all' ? preview.totalDue : payMode === 'none' ? 0 : (other ?? 0);
  const valid = selected.length > 0 && paidNow >= 0 && paidNow <= preview.totalDue && (payMode !== 'other' || other !== null);
  const firstName = party.name.split(' ')[0] ?? party.name;

  if (open.length === 0) {
    return (
      <div className={s.screen}>
        <ScreenHeader title={t.consign.settleTitle(party.name)} />
        <p className={s.empty}>{t.consign.noOpen}</p>
      </div>
    );
  }

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.consign.settleTitle(party.name)} />
      <div className={s.content}>
        {open.length > 1 &&
          open.map((o) => (
            <label key={o.consignment.id} className={s.check}>
              <input
                type="checkbox"
                checked={selected.includes(o.consignment.id)}
                onChange={(e) =>
                  setSelected((cur) =>
                    e.target.checked ? [...cur, o.consignment.id] : cur.filter((x) => x !== o.consignment.id),
                  )
                }
              />
              {t.consign.deliveryOf(formatDayKey(dayKeyOf(o.consignment.createdAt)), formatPEN(pendingValue(o.lines)))}
            </label>
          ))}

        <div className={s.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>{t.consign.deliveredCol}</th>
                <th>{t.consign.returns}</th>
                <th>{t.consign.sold}</th>
                <th>{t.consign.toPay}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const x = preview.lines.find((p) => p.lineId === l.id)!;
                const q = { allowsFraction: l.fractional };
                const step = l.fractional ? 1000 : 1;
                return (
                  <tr key={l.id}>
                    <td>{l.productName}</td>
                    <td className="mono">{formatQty(q, x.pending)}</td>
                    <td>
                      <span className={styles.miniStepper}>
                        <button
                          type="button"
                          aria-label={`Devuelve uno menos de ${l.productName}`}
                          disabled={x.returned <= 0}
                          onClick={() => setReturns((r) => ({ ...r, [l.id]: Math.max(0, x.returned - step) }))}
                        >
                          −
                        </button>
                        <span data-testid={`ret-${l.productName}`}>{formatQty(q, x.returned)}</span>
                        <button
                          type="button"
                          aria-label={`Devuelve uno más de ${l.productName}`}
                          disabled={x.returned + step > x.pending}
                          onClick={() => setReturns((r) => ({ ...r, [l.id]: Math.min(x.pending, x.returned + step) }))}
                        >
                          +
                        </button>
                      </span>
                    </td>
                    <td className="mono">{formatQty(q, x.sold)}</td>
                    <td className="mono">{formatPEN(x.lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={s.card}>
          <div className={styles.summaryRow}>
            <span>{t.consign.soldNow}</span>
            <span className="mono">{formatPEN(preview.soldValue)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>{t.consign.prevDebt}</span>
            <span className="mono">{formatPEN(preview.previousBalance)}</span>
          </div>
          <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
            <span>{t.consign.totalDue}</span>
            <span className="mono" data-testid="settle-total">
              {formatPEN(preview.totalDue)}
            </span>
          </div>
        </div>

        <div className={s.label}>{t.consign.paysNow}</div>
        <div className={s.segment} role="group" aria-label={t.consign.paysNow}>
          <button type="button" aria-pressed={payMode === 'all'} onClick={() => setPayMode('all')}>
            {t.consign.payAll}
          </button>
          <button
            type="button"
            aria-pressed={payMode === 'other'}
            onClick={() => {
              setPayMode('other');
              setOtherText('');
            }}
          >
            {t.consign.payOther}
          </button>
          <button type="button" aria-pressed={payMode === 'none'} onClick={() => setPayMode('none')}>
            {t.consign.payNone}
          </button>
        </div>
        {payMode === 'other' && (
          <>
            <div className={styles.display}>S/ {otherText || '0'}</div>
            <NumPad value={otherText} onChange={setOtherText} decimals={2} />
          </>
        )}
        {paidNow > 0 && (
          <div className={s.segment} role="group" aria-label="Método">
            <button type="button" aria-pressed={method === 'cash'} onClick={() => setMethod('cash')}>
              {t.checkout.cash}
            </button>
            <button type="button" aria-pressed={method === 'digital'} onClick={() => setMethod('digital')}>
              {t.checkout.digital}
            </button>
          </div>
        )}
        {paidNow > preview.totalDue && <p className={styles.warn}>{t.checkout.owes(formatPEN(preview.totalDue))}</p>}
        {paidNow < preview.totalDue && <p className={s.muted}>{t.consign.remains(formatPEN(preview.totalDue - paidNow))}</p>}
        <Button variant="primary" block disabled={!valid} onClick={() => setSigning(true)}>
          {t.consign.signSettle} · {formatPEN(paidNow)}
        </Button>
      </div>

      {signing && (
        <Sheet title={t.consign.settle} onClose={() => setSigning(false)}>
          <PinPad
            title={
              paidNow > 0
                ? t.consign.settleSignPay(firstName, formatPEN(paidNow))
                : t.consign.settleSignDebt(firstName, formatPEN(preview.totalDue))
            }
            hint={t.pin.handPhone}
            onSubmit={async (pin) => {
              const sig = await settleConsignments(party.id, selected, returns, paidNow, method, pin);
              toast(t.consign.settled, 'success');
              replace({ name: 'voucher', signatureId: sig.id });
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

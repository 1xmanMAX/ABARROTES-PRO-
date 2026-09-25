import { useMemo, useState } from 'react';
import { useProductMap, useProducts, useSettings } from '../../app/data';
import { haggleOptions } from '../../domain/haggle';
import { lineAmount } from '../../domain/qty';
import { useNav } from '../../app/nav';
import { cartTotal } from '../../domain/cart';
import { billSuggestions, computeChange, formatPEN, parseSolesToCents, type Cents } from '../../domain/money';
import { formatQty } from '../../domain/qty';
import { getTicketWithLines, voidTicket, type Payment } from '../../db/tickets';
import { t } from '../../i18n/es-PE';
import { usePrint } from '../../print/printStore';
import { Button } from '../../ui/Button';
import { NumPad } from '../../ui/NumPad';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast, toastError, useToast, vibrate } from '../../ui/toast';
import { activeTicket, afterSalesChange, useSell } from './sellStore';
import styles from './Checkout.module.css';

type Method = 'cash' | 'digital';

export function CheckoutScreen() {
  const products = useProducts();
  const productMap = useProductMap(products);
  const ticket = useSell(activeTicket);
  const checkout = useSell((st) => st.checkout);
  const back = useNav((st) => st.back);
  const settings = useSettings();
  const gross = useMemo(() => cartTotal(ticket.lines, productMap), [ticket.lines, productMap]);
  // Rebaja por regateo: solo sobre productos que la admiten.
  const eligibleTotal = useMemo(
    () =>
      ticket.lines.reduce((a, l) => {
        const p = productMap.get(l.productId);
        return p?.allowsHaggle ? a + lineAmount(p, l.qty, l.priceOverride ?? p.salePrice) : a;
      }, 0),
    [ticket.lines, productMap],
  );
  const haggleChoices = haggleOptions(settings.maxHaggle, eligibleTotal);
  const [haggle, setHaggle] = useState(0);
  const effectiveHaggle = haggleChoices.includes(haggle) ? haggle : 0;
  const total = gross - effectiveHaggle;

  const [method, setMethod] = useState<Method>('cash');
  // null = Exacto (por defecto: 5 toques para una venta típica).
  const [received, setReceived] = useState<Cents | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [digitalRef, setDigitalRef] = useState('');
  const [busy, setBusy] = useState(false);

  const bills = billSuggestions(total);
  const cashReceived = received ?? total;
  const change = computeChange(total, cashReceived);
  const canPay = total > 0 && (method !== 'cash' || change >= 0) && !busy;

  const pay = async (print: boolean) => {
    if (!canPay) return;
    setBusy(true);
    const payment: Payment =
      method === 'cash'
        ? { method: 'cash', cashReceived, haggle: effectiveHaggle }
        : { method: 'digital', digitalRef: digitalRef || null, haggle: effectiveHaggle };
    try {
      const closed = await checkout(payment);
      vibrate(30);
      back();
      if (print) {
        const data = await getTicketWithLines(closed.id);
        if (data) usePrint.getState().print(data.ticket, data.lines);
      }
      useToast.getState().show({
        message: t.checkout.registered(formatPEN(closed.total)),
        tone: 'success',
        actionLabel: t.common.undo,
        onAction: () => {
          voidTicket(closed.id, t.checkout.undoneReason).then(() => {
            toast(t.checkout.undone);
            void afterSalesChange();
          }, toastError);
        },
      });
    } catch (err) {
      setBusy(false);
      toastError(err);
    }
  };

  if (ticket.lines.length === 0) {
    return (
      <div className={s.screen}>
        <ScreenHeader title={t.checkout.title(ticket.label)} />
        {!busy && <p className={s.empty}>{t.sell.emptyTicket}</p>}
      </div>
    );
  }

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.checkout.title(ticket.label)} />
      <main className={styles.main}>
        <div className={styles.totalBox}>
          <div className={s.muted}>{t.checkout.total}</div>
          <div className={styles.total} data-testid="checkout-total">
            {formatPEN(total)}
          </div>
          {effectiveHaggle > 0 && (
            <div className={styles.haggleNote}>
              {formatPEN(gross)} − {t.checkout.haggle} {formatPEN(effectiveHaggle)}
            </div>
          )}
        </div>

        {/* Lista para leerle al cliente: evita cobrar de menos con apuro. */}
        <ul className={styles.lines} aria-label={t.checkout.itemsTitle}>
          {ticket.lines.map((l) => {
            const p = productMap.get(l.productId);
            if (!p) return null;
            const price = l.priceOverride ?? p.salePrice;
            return (
              <li key={l.productId} className={styles.lineRow}>
                <span className={styles.lineQty}>{formatQty(p, l.qty)}</span>
                <span className={styles.lineName}>
                  {p.name}
                  {l.priceOverride !== null && <small> · {formatPEN(price)} c/u</small>}
                </span>
                <span className="mono">{formatPEN(lineAmount(p, l.qty, price))}</span>
              </li>
            );
          })}
        </ul>

        {haggleChoices.length > 0 && (
          <div>
            <div className={s.label} style={{ marginBottom: 6 }}>
              {t.checkout.haggleTitle}
            </div>
            <div className={styles.haggleRow} role="group" aria-label={t.checkout.haggleTitle}>
              {haggleChoices.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={effectiveHaggle === v ? styles.haggleActive : styles.haggleBtn}
                  aria-pressed={effectiveHaggle === v}
                  aria-label={`${t.checkout.haggle} ${formatPEN(v)}`}
                  onClick={() => {
                    setHaggle(effectiveHaggle === v ? 0 : v);
                    setReceived(null);
                  }}
                >
                  −{v / 100}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={s.segment} role="group" aria-label="Método de pago">
          <button type="button" aria-pressed={method === 'cash'} onClick={() => setMethod('cash')}>
            {t.checkout.cash}
          </button>
          <button type="button" aria-pressed={method === 'digital'} onClick={() => setMethod('digital')}>
            {t.checkout.digital}
          </button>
          <button type="button" className={styles.credit} onClick={() => toast(t.checkout.creditSoon)} aria-disabled="true">
            {t.checkout.credit}
            <small> · {t.common.soon}</small>
          </button>
        </div>

        {method === 'cash' ? (
          <>
            <div>
              <div className={s.label} style={{ marginBottom: 6 }}>
                {t.checkout.customerGives}
              </div>
              <div className={styles.bills}>
                <button
                  type="button"
                  className={received === null ? styles.billActive : styles.bill}
                  aria-pressed={received === null}
                  onClick={() => setReceived(null)}
                >
                  {t.checkout.exact}
                </button>
                {bills.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={received === b ? styles.billActive : styles.bill}
                    aria-pressed={received === b}
                    onClick={() => setReceived(b)}
                  >
                    S/ {b / 100}
                  </button>
                ))}
                <button
                  type="button"
                  className={received !== null && !bills.includes(received) ? styles.billActive : styles.bill}
                  onClick={() => setOtherOpen(true)}
                >
                  {received !== null && !bills.includes(received) ? formatPEN(received) : t.checkout.other}
                </button>
              </div>
            </div>
            <div className={styles.changeBox}>
              {change >= 0 ? (
                <>
                  <span className={styles.changeLabel}>{t.checkout.change}</span>
                  <span className={styles.change} data-testid="change">
                    {formatPEN(change)}
                  </span>
                </>
              ) : (
                <span className={styles.missing}>{t.checkout.missing(formatPEN(-change))}</span>
              )}
            </div>
          </>
        ) : (
          <label className={s.field}>
            {t.checkout.digitalRef}
            <input
              className={`${s.input} mono`}
              inputMode="numeric"
              maxLength={3}
              value={digitalRef}
              onChange={(e) => setDigitalRef(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="123"
            />
          </label>
        )}

        <div className={styles.actions}>
          <Button variant="primary" block disabled={!canPay} onClick={() => pay(true)}>
            {t.checkout.payPrint}
          </Button>
          <Button block disabled={!canPay} onClick={() => pay(false)}>
            {t.checkout.payNoPrint}
          </Button>
        </div>
      </main>
      {otherOpen && (
        <OtherAmountSheet
          total={total}
          onDone={(v) => {
            setReceived(v);
            setOtherOpen(false);
          }}
          onClose={() => setOtherOpen(false)}
        />
      )}
    </div>
  );
}

function OtherAmountSheet({ total, onDone, onClose }: { total: Cents; onDone: (v: Cents) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const value = parseSolesToCents(text || '0');
  const change = value === null ? null : value - total;
  return (
    <Sheet
      title={t.checkout.enterAmount}
      onClose={onClose}
      footer={
        <Button variant="primary" block disabled={value === null || value <= 0} onClick={() => value !== null && onDone(value)}>
          {t.common.accept}
        </Button>
      }
    >
      <div className={styles.otherDisplay}>S/ {text || '0'}</div>
      {change !== null && value! > 0 && (
        <div className={change >= 0 ? styles.otherChange : styles.missing}>
          {change >= 0 ? `${t.checkout.change}: ${formatPEN(change)}` : t.checkout.missing(formatPEN(-change))}
        </div>
      )}
      <NumPad value={text} onChange={setText} decimals={2} />
    </Sheet>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useProductMap, useProducts, useSettings } from '../../app/data';
import { haggleOptions } from '../../domain/haggle';
import { lineAmount } from '../../domain/qty';
import { useNav } from '../../app/nav';
import { cartTotal } from '../../domain/cart';
import { changeBreakdown, describeBreakdown, spokenAmount, TENDER_BILLS } from '../../domain/cashPieces';
import { billSuggestions, computeChange, formatPEN, parseSolesToCents, type Cents } from '../../domain/money';
import { formatQty } from '../../domain/qty';
import { getTicketWithLines, voidTicket, type Payment } from '../../db/tickets';
import { t } from '../../i18n/es-PE';
import { usePrint } from '../../print/printStore';
import { Button } from '../../ui/Button';
import { ChangePieces, Piece } from '../../ui/CashPieces';
import { NumPad } from '../../ui/NumPad';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { speak } from '../../ui/speak';
import { toast, toastError, useToast, vibrate } from '../../ui/toast';
import { activeTicket, afterSalesChange, useSell } from './sellStore';
import { CreditPanel } from './CreditPanel';
import { useSaleDone } from './SaleDone';
import styles from './Checkout.module.css';

type Method = 'cash' | 'digital' | 'credit';

export function CheckoutScreen() {
  const products = useProducts();
  const productMap = useProductMap(products);
  const ticket = useSell(activeTicket);
  const checkout = useSell((st) => st.checkout);
  const checkoutCredit = useSell((st) => st.checkoutCredit);
  const back = useNav((st) => st.back);
  const replace = useNav((st) => st.replace);
  const settings = useSettings();
  const helper = settings.helperMode;
  const gross = useMemo(() => cartTotal(ticket.lines, productMap), [ticket.lines, productMap]);
  // Rebaja por regateo: solo sobre productos que la admiten (y nunca en modo ayudante).
  const eligibleTotal = useMemo(
    () =>
      ticket.lines.reduce((a, l) => {
        const p = productMap.get(l.productId);
        return p?.allowsHaggle ? a + lineAmount(p, l.qty, l.priceOverride ?? p.salePrice) : a;
      }, 0),
    [ticket.lines, productMap],
  );
  const haggleChoices = helper ? [] : haggleOptions(settings.maxHaggle, eligibleTotal);
  const [haggle, setHaggle] = useState(0);
  const effectiveHaggle = haggleChoices.includes(haggle) ? haggle : 0;
  const total = gross - effectiveHaggle;

  const [method, setMethod] = useState<Method>('cash');
  // null = Exacto (por defecto: 5 toques para una venta típica).
  const [received, setReceived] = useState<Cents | null>(null);
  // Billetes tocados uno por uno ("100 + 50"): para quien no calcula de memoria.
  const [counted, setCounted] = useState<Cents[]>([]);
  const [otherOpen, setOtherOpen] = useState(false);
  const [digitalRef, setDigitalRef] = useState('');
  const [busy, setBusy] = useState(false);

  // Voz (opcional): decir el total al abrir el cobro, para confirmarlo con el cliente.
  const [spokenTotal, setSpokenTotal] = useState<Cents | null>(null);
  useEffect(() => {
    if (!settings.voice || total <= 0 || spokenTotal === total) return;
    setSpokenTotal(total);
    void speak(t.checkout.sayTotal(spokenAmount(total)));
  }, [settings.voice, total, spokenTotal]);

  const bills = billSuggestions(total);
  const cashReceived = received ?? total;
  const change = computeChange(total, cashReceived);
  const canPay = total > 0 && (method !== 'cash' || change >= 0) && !busy;

  const choose = (value: Cents | null) => {
    setCounted([]);
    setReceived(value);
  };
  const addBill = (bill: Cents) => {
    vibrate(10);
    const next = [...counted, bill];
    setCounted(next);
    setReceived(next.reduce((a, b) => a + b, 0));
  };

  const pay = async (print: boolean) => {
    // `busy` bloquea el segundo toque; el cobro además falla si el ticket ya no está abierto.
    if (!canPay || method === 'credit') return;
    setBusy(true);
    const payment: Payment =
      method === 'cash'
        ? { method: 'cash', cashReceived, haggle: effectiveHaggle, byHelper: helper }
        : { method: 'digital', digitalRef: digitalRef || null, haggle: effectiveHaggle, byHelper: helper };
    try {
      const closed = await checkout(payment);
      vibrate([30, 60, 30]);
      back();
      if (print) {
        const data = await getTicketWithLines(closed.id);
        if (data) usePrint.getState().print(data.ticket, data.lines);
      }
      const changeGiven = closed.change ?? 0;
      if (method === 'cash' && changeGiven > 0) {
        // Con vuelto: pantalla grande hasta tocar "Listo".
        useSaleDone.getState().show({ ticketId: closed.id, total: closed.total, received: cashReceived, change: changeGiven });
        if (settings.voice) {
          void speak(t.checkout.sayChange(spokenAmount(changeGiven), describeBreakdown(changeBreakdown(changeGiven))));
        }
        return;
      }
      if (settings.voice) void speak(t.checkout.sayPaid(spokenAmount(closed.total)));
      useToast.getState().show({
        message: t.checkout.registered(formatPEN(closed.total)),
        tone: 'success',
        actionLabel: t.common.undo,
        durationMs: 6000,
        onAction: () => {
          voidTicket(closed.id, t.checkout.undoneReason).then(() => {
            toast(t.checkout.undone);
            void afterSalesChange();
          }, toastError);
        },
      });
    } catch (err) {
      setBusy(false);
      vibrate([80, 60, 80]);
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

  const isOther = received !== null && counted.length === 0 && !bills.includes(received);

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.checkout.title(ticket.label)} />
      <main className={styles.main}>
        <div className={styles.totalBox}>
          <div className={styles.totalLabel}>{t.checkout.total}</div>
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
                    choose(null);
                  }}
                >
                  −{v / 100}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`${s.segment} ${styles.methods}`} role="group" aria-label="Método de pago">
          <button type="button" aria-pressed={method === 'cash'} onClick={() => setMethod('cash')}>
            <span aria-hidden="true">💵</span> {t.checkout.cash}
          </button>
          <button type="button" aria-pressed={method === 'digital'} onClick={() => setMethod('digital')}>
            <span aria-hidden="true">📱</span> {t.checkout.digital}
          </button>
          {!helper && (
            <button type="button" className={styles.credit} aria-pressed={method === 'credit'} onClick={() => setMethod('credit')}>
              <span aria-hidden="true">📒</span> {t.checkout.credit}
            </button>
          )}
        </div>

        {method === 'credit' ? (
          <CreditPanel
            total={total}
            onSign={async (partyId, pin, ownerPin) => {
              const sig = await checkoutCredit(partyId, pin, { ownerPin, haggle: effectiveHaggle });
              vibrate([30, 60, 30]);
              replace({ name: 'voucher', signatureId: sig.id });
              toast(t.checkout.creditDone(sig.partyName, formatPEN(sig.amount)), 'success');
            }}
          />
        ) : method === 'cash' ? (
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
                  onClick={() => choose(null)}
                >
                  {t.checkout.exact}
                </button>
                {bills.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={received === b && counted.length === 0 ? styles.billActive : styles.bill}
                    aria-pressed={received === b && counted.length === 0}
                    onClick={() => choose(b)}
                  >
                    S/ {b / 100}
                  </button>
                ))}
                <button type="button" className={isOther ? styles.billActive : styles.bill} onClick={() => setOtherOpen(true)}>
                  {isOther ? formatPEN(received) : t.checkout.other}
                </button>
              </div>
            </div>

            <div>
              <div className={s.label} style={{ marginBottom: 6 }}>
                {t.checkout.countBills}
              </div>
              <div className={styles.tender} role="group" aria-label={t.checkout.countBills}>
                {TENDER_BILLS.map((b) => (
                  <button key={b} type="button" className={styles.tenderBtn} aria-label={`+ S/ ${b / 100}`} onClick={() => addBill(b)}>
                    <Piece value={b} />
                  </button>
                ))}
              </div>
              {counted.length > 0 && (
                <div className={styles.countedRow}>
                  <span className="mono" data-testid="counted">
                    {t.checkout.counted(counted.map((b) => b / 100).join(' + '))}
                  </span>
                  <button type="button" className={styles.clearCount} onClick={() => choose(null)}>
                    {t.checkout.clearCount}
                  </button>
                </div>
              )}
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
                <span className={styles.missing}>⚠ {t.checkout.missing(formatPEN(-change))}</span>
              )}
            </div>
            {change > 0 && <ChangePieces change={change} />}
          </>
        ) : (
          <>
            {/* Yape/Plin falsos: estafa frecuente en bodegas. Solo vale el aviso en el celular propio. */}
            <p className={styles.yapeCheck} role="note">
              <span aria-hidden="true">⚠</span> {t.checkout.yapeCheck}
            </p>
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
          </>
        )}

        {method !== 'credit' && (
          <div className={styles.actions}>
            <Button variant="primary" block disabled={!canPay} onClick={() => pay(true)}>
              {method === 'digital' ? t.checkout.yapeArrivedPrint : t.checkout.payPrint}
            </Button>
            <Button block disabled={!canPay} onClick={() => pay(false)}>
              {method === 'digital' ? t.checkout.yapeArrived : t.checkout.payNoPrint}
            </Button>
          </div>
        )}
      </main>
      {otherOpen && (
        <OtherAmountSheet
          total={total}
          onDone={(v) => {
            choose(v);
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

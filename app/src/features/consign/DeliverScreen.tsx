import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useProducts } from '../../app/data';
import { useNav } from '../../app/nav';
import { reservedByProduct } from '../../domain/cart';
import { defaultAgreedPrice } from '../../domain/consignment';
import { searchProducts } from '../../domain/gridOrder';
import { centsToInput, formatPEN, parseSolesToCents } from '../../domain/money';
import { formatQty, lineAmount, parseQty, unitStep } from '../../domain/qty';
import { formatDayKey, dayKeyOf } from '../../domain/time';
import { deliverConsignment } from '../../db/consignments';
import { db } from '../../db/schema';
import type { Party, Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { NumPad } from '../../ui/NumPad';
import { PinPad } from '../../ui/PinPad';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast } from '../../ui/toast';
import { useSell } from '../sell/sellStore';
import styles from './Consign.module.css';

const DAY = 86_400_000;
const DUE_OPTIONS = [1, 3, 7];

export default function DeliverScreen({ partyId }: { partyId: string }) {
  const party = useLiveQuery(() => db.parties.get(partyId), [partyId]);
  if (!party) return null;
  return <DeliverForm party={party} />;
}

interface Item {
  qty: number;
  price: number;
}

/** Entregar a vendedor (SPEC §8.1): productos, cantidad, precio pactado, fecha y firma. */
function DeliverForm({ party }: { party: Party }) {
  const products = useProducts();
  const replace = useNav((st) => st.replace);
  const tickets = useSell((st) => st.tickets);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Record<string, Item>>({});
  const [dueDays, setDueDays] = useState(3);
  const [editing, setEditing] = useState<{ product: Product; field: 'qty' | 'price' } | null>(null);
  const [signing, setSigning] = useState(false);

  const reserved = useMemo(() => reservedByProduct(tickets), [tickets]);
  const available = (p: Product) => p.stock - (reserved.get(p.id) ?? 0);
  const list = useMemo(
    () =>
      searchProducts(
        products.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name, 'es')),
        q,
      ),
    [products, q],
  );
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const chosen = Object.entries(items).filter(([, it]) => it.qty > 0);
  const total = chosen.reduce((a, [id, it]) => a + lineAmount(byId.get(id)!, it.qty, it.price), 0);
  const dueDate = Date.now() + dueDays * DAY;
  const firstName = party.name.split(' ')[0] ?? party.name;

  const setQty = (p: Product, qty: number) =>
    setItems((cur) => ({
      ...cur,
      [p.id]: {
        qty: Math.max(0, Math.min(qty, available(p))),
        price: cur[p.id]?.price ?? defaultAgreedPrice(p, party.specialPrices),
      },
    }));

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.consign.deliverTitle(party.name)} />
      <div className={s.content}>
        <input
          className={s.input}
          type="search"
          placeholder={t.consign.search}
          aria-label={t.consign.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className={styles.list}>
          {list.map((p) => {
            const it = items[p.id];
            const step = unitStep(p);
            const price = it?.price ?? defaultAgreedPrice(p, party.specialPrices);
            const avail = available(p);
            return (
              <li key={p.id} className={`${styles.item} ${it?.qty ? styles.itemOn : ''}`}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{p.name}</span>
                  <button type="button" className={styles.priceBtn} onClick={() => setEditing({ product: p, field: 'price' })}>
                    {formatPEN(price)} c/u
                  </button>
                  <span className={s.muted}>{t.consign.available(formatQty(p, avail))}</span>
                </div>
                <div className={styles.stepper}>
                  <button
                    type="button"
                    aria-label={`Quitar 1 ${p.name}`}
                    disabled={!it?.qty}
                    onClick={() => setQty(p, (it?.qty ?? 0) - step)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={styles.qty}
                    aria-label={`Cantidad de ${p.name}`}
                    onClick={() => setEditing({ product: p, field: 'qty' })}
                  >
                    {formatQty(p, it?.qty ?? 0)}
                  </button>
                  <button
                    type="button"
                    aria-label={`Agregar 1 ${p.name}`}
                    disabled={(it?.qty ?? 0) + step > avail}
                    onClick={() => setQty(p, (it?.qty ?? 0) + step)}
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className={s.label}>{t.consign.dueDate}</div>
        <div className={s.segment} role="group" aria-label={t.consign.dueDate}>
          {DUE_OPTIONS.map((d) => (
            <button key={d} type="button" aria-pressed={dueDays === d} onClick={() => setDueDays(d)}>
              {t.consign.days(d)}
            </button>
          ))}
        </div>
        <p className={s.muted}>{formatDayKey(dayKeyOf(dueDate))}</p>
      </div>

      <div className={styles.bar}>
        <div>
          <div className={styles.barLabel}>{t.consign.total}</div>
          <div className={styles.barTotal} data-testid="deliver-total">
            {formatPEN(total)}
          </div>
        </div>
        <Button variant="primary" disabled={chosen.length === 0} onClick={() => setSigning(true)}>
          {t.consign.signReceive}
        </Button>
      </div>

      {editing && (
        <EditSheet
          product={editing.product}
          field={editing.field}
          item={items[editing.product.id] ?? { qty: 0, price: defaultAgreedPrice(editing.product, party.specialPrices) }}
          max={available(editing.product)}
          onSave={(it) => {
            setItems((cur) => ({ ...cur, [editing.product.id]: it }));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {signing && (
        <Sheet title={t.consign.deliver} onClose={() => setSigning(false)}>
          <PinPad
            title={t.consign.receiveSign(firstName, formatPEN(total))}
            hint={t.pin.handPhone}
            onSubmit={async (pin) => {
              const sig = await deliverConsignment(
                party.id,
                chosen.map(([productId, it]) => ({ productId, qty: it.qty, agreedPrice: it.price })),
                dueDate,
                pin,
              );
              toast(t.consign.delivered, 'success');
              replace({ name: 'voucher', signatureId: sig.id });
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

function EditSheet({
  product,
  field,
  item,
  max,
  onSave,
  onClose,
}: {
  product: Product;
  field: 'qty' | 'price';
  item: Item;
  max: number;
  onSave: (it: Item) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(field === 'qty' ? (item.qty ? formatQty(product, item.qty) : '') : centsToInput(item.price));
  const value = field === 'qty' ? parseQty(product, text || '0') : parseSolesToCents(text || '0');
  const valid = value !== null && (field === 'price' ? value > 0 : value <= max);
  return (
    <Sheet
      title={`${product.name} · ${field === 'qty' ? t.sell.qty : t.consign.agreedPrice}`}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          block
          disabled={!valid}
          onClick={() => value !== null && onSave(field === 'qty' ? { ...item, qty: value } : { ...item, price: value })}
        >
          {t.common.accept}
        </Button>
      }
    >
      <div className={styles.display}>{field === 'price' ? `S/ ${text || '0'}` : text || '0'}</div>
      {field === 'qty' && value !== null && value > max && (
        <p className={styles.warn}>{t.sell.onlyLeft(formatQty(product, max))}</p>
      )}
      <NumPad value={text} onChange={setText} decimals={field === 'price' ? 2 : product.allowsFraction ? 3 : 0} />
    </Sheet>
  );
}

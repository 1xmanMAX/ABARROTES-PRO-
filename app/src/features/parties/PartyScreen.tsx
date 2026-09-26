import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNav } from '../../app/nav';
import { formatPEN } from '../../domain/money';
import { pinStatus } from '../../domain/pin';
import { formatDateTime } from '../../domain/time';
import { getPartyHistory } from '../../db/parties';
import { getOpenConsignments } from '../../db/consignments';
import { isOverdue, pendingValue } from '../../domain/consignment';
import { dayKeyOf, formatDayKey } from '../../domain/time';
import { setPartyPin, unlockPartyPin } from '../../db/pins';
import { db } from '../../db/schema';
import type { Party } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { PinCreate } from '../../ui/PinCreate';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast } from '../../ui/toast';
import { DebtPaymentSheet } from './DebtPaymentSheet';
import { PartyBadges } from './PartiesScreen';
import styles from './Parties.module.css';
import { useOwnerPin } from './usePin';

export default function PartyScreen({ id }: { id: string }) {
  const party = useLiveQuery(() => db.parties.get(id), [id]);
  if (!party) return null;
  return <PartyDetail party={party} />;
}

function PartyDetail({ party }: { party: Party }) {
  const push = useNav((st) => st.push);
  const history = useLiveQuery(() => getPartyHistory(party.id), [party.id, party.updatedAt, party.balance]) ?? [];
  const open = useLiveQuery(() => getOpenConsignments(party.id), [party.id, party.updatedAt]) ?? [];
  const seller = party.roles.includes('seller');
  const inHands = open.reduce((a, o) => a + pendingValue(o.lines), 0);
  const [askOwner, ownerSheet] = useOwnerPin();
  const [paying, setPaying] = useState(false);
  // null: cerrado; string: crear código (con el código de dueño verificado si ya tenía uno)
  const [creatingPin, setCreatingPin] = useState<{ ownerPin?: string } | null>(null);

  const status = party.pin ? pinStatus(party.pin, Date.now()) : null;
  const locked = status && status.kind !== 'ok';
  const firstName = party.name.split(' ')[0] ?? party.name;

  return (
    <div className={s.screen}>
      <ScreenHeader title={party.name} />
      <div className={s.content}>
        <div className={styles.meta}>
          <PartyBadges party={party} />
          {party.phone && <span>· {party.phone}</span>}
        </div>

        <div className={`${s.card} ${styles.balanceCard}`}>
          <div>
            <div className={s.label}>{t.parties.balance}</div>
            <div className={`${styles.balance} ${party.balance > 0 ? styles.balanceOwes : ''}`} data-testid="party-balance">
              {formatPEN(party.balance)}
            </div>
            <div className={s.muted}>
              {t.parties.limit}: {party.creditLimit > 0 ? formatPEN(party.creditLimit) : t.checkout.noLimit}
            </div>
          </div>
        </div>

        {seller && (
          <div className={s.card}>
            <div className={s.label}>{t.consign.inHands}</div>
            <div className={styles.balance} data-testid="in-hands">
              {formatPEN(inHands)}
            </div>
            {open.map((o) => (
              <div key={o.consignment.id} className={styles.meta} style={{ marginTop: 6 }}>
                <span>
                  {t.consign.deliveryOf(formatDayKey(dayKeyOf(o.consignment.createdAt)), formatPEN(pendingValue(o.lines)))}
                </span>
                <span>· {t.consign.due(formatDayKey(dayKeyOf(o.consignment.dueDate)))}</span>
                {isOverdue(o.consignment.dueDate, Date.now()) && <span className={styles.overdueTag}>{t.consign.overdue}</span>}
              </div>
            ))}
          </div>
        )}

        {!party.pin && <p className={styles.warn}>{t.parties.noPinWarn}</p>}
        {locked && <p className={styles.warn}>{t.parties.lockedWarn}</p>}

        <div className={styles.actions}>
          {party.balance > 0 && party.pin && !locked && (
            <Button variant="primary" onClick={() => setPaying(true)} style={{ gridColumn: '1 / -1' }}>
              {t.parties.collect}
            </Button>
          )}
          {seller && party.pin && !locked && (
            <Button variant={open.length ? 'outline' : 'primary'} onClick={() => push({ name: 'deliver', partyId: party.id })}>
              {t.consign.deliver}
            </Button>
          )}
          {seller && open.length > 0 && party.pin && !locked && (
            <Button variant="primary" onClick={() => push({ name: 'settle', partyId: party.id })}>
              {t.consign.settle}
            </Button>
          )}
          {!party.pin ? (
            <Button onClick={() => setCreatingPin({})}>{t.parties.createPin}</Button>
          ) : (
            <Button
              onClick={() =>
                askOwner(t.parties.changePin, async (ownerPin) => {
                  setCreatingPin({ ownerPin });
                })
              }
            >
              {t.parties.changePin}
            </Button>
          )}
          {locked && (
            <Button
              variant="danger"
              onClick={() =>
                askOwner(t.parties.unlock, async (ownerPin) => {
                  await unlockPartyPin(party.id, ownerPin);
                  toast(t.parties.unlocked, 'success');
                })
              }
            >
              {t.parties.unlock}
            </Button>
          )}
          <Button variant="plain" onClick={() => push({ name: 'partyEdit', id: party.id })}>
            {t.parties.edit}
          </Button>
        </div>

        <div className={s.label}>{t.parties.history}</div>
        {history.length === 0 && <p className={s.muted}>{t.parties.noHistory}</p>}
        {history.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`${styles.histRow} ${h.voided ? styles.voided : ''}`}
            disabled={!h.signatureId}
            onClick={() => h.signatureId && push({ name: 'voucher', signatureId: h.signatureId })}
          >
            <span className={styles.histLabel}>
              <span>{h.label}</span>
              <span className={styles.histDate}>{formatDateTime(h.at)}</span>
            </span>
            {h.amount !== null && (
              <span className={`mono ${h.kind === 'charge' ? styles.charge : h.kind === 'payment' ? styles.payment : ''}`}>
                {h.kind === 'charge' ? '+' : h.kind === 'payment' ? '−' : ''}
                {formatPEN(Math.abs(h.amount))}
              </span>
            )}
          </button>
        ))}
      </div>

      {paying && (
        <DebtPaymentSheet
          party={party}
          onDone={(signatureId) => {
            setPaying(false);
            push({ name: 'voucher', signatureId });
          }}
          onClose={() => setPaying(false)}
        />
      )}
      {creatingPin && (
        <Sheet title={party.pin ? t.parties.changePin : t.parties.createPin} onClose={() => setCreatingPin(null)}>
          <PinCreate
            title={t.pin.createTitle(firstName)}
            hint={t.pin.handPhone}
            onCreate={async (pin) => {
              await setPartyPin(party.id, pin, creatingPin.ownerPin);
              toast(t.pin.created, 'success');
              setCreatingPin(null);
            }}
          />
        </Sheet>
      )}
      {ownerSheet}
    </div>
  );
}

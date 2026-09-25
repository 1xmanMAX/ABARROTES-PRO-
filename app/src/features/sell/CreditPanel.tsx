import { useMemo, useState } from 'react';
import { useNav } from '../../app/nav';
import { checkCredit } from '../../domain/balances';
import { formatPEN } from '../../domain/money';
import { pinStatus } from '../../domain/pin';
import type { Party } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { PinPad } from '../../ui/PinPad';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { filterParties, useParties } from '../parties/PartiesScreen';
import styles from '../parties/Parties.module.css';
import { useOwnerPin } from '../parties/usePin';

interface Props {
  total: number;
  /** Firma la venta al fiado; lanza error con mensaje si el código no sirve. */
  onSign: (partyId: string, pin: string, ownerPin: string | undefined) => Promise<void>;
}

/** Fiado en Cobrar (SPEC §6): persona, saldo, límite, nuevo saldo y firma. */
export function CreditPanel({ total, onSign }: Props) {
  const parties = useParties();
  const push = useNav((st) => st.push);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ownerPin, setOwnerPin] = useState<string | undefined>();
  const [signing, setSigning] = useState(false);
  const [askOwner, ownerSheet] = useOwnerPin();

  const clients = useMemo(
    () =>
      filterParties(
        parties.filter((p) => p.roles.includes('client')),
        q,
      ).sort((a, b) => b.lastUsedAt - a.lastUsedAt),
    [parties, q],
  );
  const selected: Party | undefined = parties.find((p) => p.id === selectedId);
  const credit = selected ? checkCredit(selected.balance, selected.creditLimit, total) : null;
  const firstName = selected ? (selected.name.split(' ')[0] ?? selected.name) : '';
  const pinOk = selected?.pin && pinStatus(selected.pin, Date.now()).kind === 'ok';
  const canSign = !!selected && !!pinOk && (!credit?.overLimit || !!ownerPin);

  return (
    <>
      <div className={s.label}>{t.checkout.whoCredit}</div>
      {parties.length > 6 && (
        <input
          className={s.input}
          type="search"
          placeholder={t.checkout.searchParty}
          aria-label={t.checkout.searchParty}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {clients.length === 0 && <p className={s.muted}>{t.checkout.noParties}</p>}
        {clients.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.row} ${p.id === selectedId ? styles.rowActive : ''}`}
            aria-pressed={p.id === selectedId}
            onClick={() => {
              setSelectedId(p.id);
              setOwnerPin(undefined);
            }}
          >
            <span className={styles.main}>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.meta}>
                {p.creditLimit > 0 ? t.checkout.limit(formatPEN(p.creditLimit)) : t.checkout.noLimit}
                {!p.pin && ` · ${t.checkout.noPin}`}
              </span>
            </span>
            {p.balance > 0 && <span className={styles.owes}>{t.checkout.owes(formatPEN(p.balance))}</span>}
          </button>
        ))}
        <Button variant="plain" onClick={() => push({ name: 'partyEdit', id: null })}>
          {t.checkout.newParty}
        </Button>
      </div>

      {selected && credit && (
        <div className={s.card} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700 }}>{t.checkout.newBalance(firstName)}</span>
          <span className={`mono ${styles.owes}`} style={{ fontSize: 22 }} data-testid="new-balance">
            {formatPEN(credit.newBalance)}
          </span>
        </div>
      )}
      {selected && !selected.pin && <p className={styles.warn}>{t.checkout.noPin}</p>}
      {selected && selected.pin && !pinOk && <p className={styles.warn}>{t.parties.lockedWarn}</p>}
      {credit?.overLimit && !ownerPin && (
        <>
          <p className={styles.warn}>{t.checkout.overLimit(formatPEN(credit.excess))}</p>
          <Button variant="danger" block onClick={() => askOwner(t.checkout.authorize, async (pin) => setOwnerPin(pin))}>
            {t.checkout.authorize}
          </Button>
        </>
      )}
      {credit?.overLimit && ownerPin && <p className={s.muted}>✓ {t.checkout.authorized}</p>}

      <div style={{ marginTop: 'auto' }}>
        <Button variant="primary" block disabled={!canSign} onClick={() => setSigning(true)}>
          {t.checkout.signCredit}
        </Button>
      </div>

      {signing && selected && (
        <Sheet title={t.checkout.creditTitle} onClose={() => setSigning(false)}>
          <PinPad
            title={t.checkout.creditSign(firstName, formatPEN(total))}
            hint={t.pin.handPhone}
            onSubmit={(pin) => onSign(selected.id, pin, ownerPin)}
          />
        </Sheet>
      )}
      {ownerSheet}
    </>
  );
}

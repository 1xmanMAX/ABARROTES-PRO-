import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNav } from '../../app/nav';
import { normalize } from '../../domain/gridOrder';
import { formatPEN } from '../../domain/money';
import { db } from '../../db/schema';
import type { Party } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { ScreenHeader } from '../../ui/ScreenHeader';
import s from '../../ui/Screen.module.css';
import styles from './Parties.module.css';

export function useParties(): Party[] {
  return useLiveQuery(() => db.parties.filter((p) => p.active).toArray(), []) ?? [];
}

export function filterParties(parties: Party[], q: string): Party[] {
  const nq = normalize(q);
  return parties.filter((p) => !nq || normalize(`${p.name} ${p.phone}`).includes(nq));
}

export function PartyBadges({ party }: { party: Party }) {
  return (
    <>
      {party.roles.includes('client') && <span className={styles.badge}>{t.parties.client}</span>}
      {party.roles.includes('seller') && <span className={`${styles.badge} ${styles.badgeSeller}`}>{t.parties.seller}</span>}
    </>
  );
}

export default function PartiesScreen() {
  const parties = useParties();
  const push = useNav((st) => st.push);
  const [q, setQ] = useState('');
  const list = useMemo(
    () => filterParties(parties, q).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'es')),
    [parties, q],
  );
  return (
    <div className={s.screen}>
      <ScreenHeader title={t.parties.title} />
      <div className={s.content}>
        <Button variant="primary" block onClick={() => push({ name: 'partyEdit', id: null })}>
          + {t.parties.new}
        </Button>
        <input
          className={s.input}
          type="search"
          placeholder={t.parties.search}
          aria-label={t.parties.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {list.length === 0 && <p className={s.empty}>{t.parties.empty}</p>}
        {list.map((p) => (
          <button key={p.id} type="button" className={styles.row} onClick={() => push({ name: 'party', id: p.id })}>
            <span className={styles.main}>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.meta}>
                <PartyBadges party={p} />
              </span>
            </span>
            {p.balance > 0 ? (
              <span className={styles.owes}>
                {t.parties.owes} {formatPEN(p.balance)}
              </span>
            ) : (
              <span className={s.muted}>{t.parties.nothingOwed}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

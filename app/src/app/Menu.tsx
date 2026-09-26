import { useLiveQuery } from 'dexie-react-hooks';
import { backupDue, daysSince } from '../domain/backup';
import { db } from '../db/schema';
import { t } from '../i18n/es-PE';
import { useSettings } from './data';
import { useNav, type Route } from './nav';
import styles from './Menu.module.css';

const ITEMS: { label: string; route: Route }[] = [
  { label: t.menu.today, route: { name: 'today' } },
  { label: t.menu.cash, route: { name: 'cash' } },
  { label: t.menu.profit, route: { name: 'profit' } },
  { label: t.menu.inventory, route: { name: 'inventory' } },
  { label: t.menu.parties, route: { name: 'parties' } },
  { label: t.menu.history, route: { name: 'history' } },
  { label: t.menu.backup, route: { name: 'backup' } },
  { label: t.menu.settings, route: { name: 'settings' } },
];

export function Menu({ onClose }: { onClose: () => void }) {
  const push = useNav((s) => s.push);
  const settings = useSettings();
  const hasData = useLiveQuery(() => db.products.count().then((c) => c > 0), []) ?? false;
  const due = backupDue(settings.lastBackupAt, hasData, Date.now());
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <nav className={styles.drawer} aria-label={t.menu.title} onClick={(e) => e.stopPropagation()}>
        <div className={styles.brand}>{t.app.name}</div>
        <button type="button" className={`${styles.item} ${styles.current}`} onClick={onClose}>
          {t.menu.sell}
        </button>
        {ITEMS.map((it) => (
          <button
            key={it.label}
            type="button"
            className={styles.item}
            onClick={() => {
              onClose();
              push(it.route);
            }}
          >
            {it.label}
          </button>
        ))}
        {due && (
          <button
            type="button"
            className={styles.reminder}
            onClick={() => {
              onClose();
              push({ name: 'backup' });
            }}
          >
            {t.menu.backupDue(
              settings.lastBackupAt ? t.backup.ago(daysSince(settings.lastBackupAt, Date.now())) : t.backup.neverShort,
            )}
          </button>
        )}
        <p className={styles.soon}>{t.menu.comingSoon}</p>
      </nav>
    </div>
  );
}

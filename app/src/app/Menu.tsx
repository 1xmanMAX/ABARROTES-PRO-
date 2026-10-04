import { useLiveQuery } from 'dexie-react-hooks';
import { backupDue, daysSince } from '../domain/backup';
import { db } from '../db/schema';
import { updateSettings } from '../db/settings';
import { useOwnerPin } from '../features/parties/usePin';
import { t } from '../i18n/es-PE';
import { toast } from '../ui/toast';
import { useSettings } from './data';
import { useNav, type Route } from './nav';
import styles from './Menu.module.css';

/** Ícono + palabra: el ícono ayuda a quien lee despacio; la palabra quita la duda. */
const ITEMS: { icon: string; label: string; route: Route }[] = [
  { icon: '🏠', label: t.menu.today, route: { name: 'today' } },
  { icon: '💰', label: t.menu.cash, route: { name: 'cash' } },
  { icon: '📈', label: t.menu.profit, route: { name: 'profit' } },
  { icon: '📦', label: t.menu.inventory, route: { name: 'inventory' } },
  { icon: '👥', label: t.menu.parties, route: { name: 'parties' } },
  { icon: '🧾', label: t.menu.history, route: { name: 'history' } },
  { icon: '🔄', label: t.menu.sync, route: { name: 'sync' } },
  { icon: '💾', label: t.menu.backup, route: { name: 'backup' } },
  { icon: '⚙️', label: t.menu.settings, route: { name: 'settings' } },
];

export function Menu({ onClose }: { onClose: () => void }) {
  const push = useNav((s) => s.push);
  const settings = useSettings();
  const [askOwner, ownerSheet] = useOwnerPin();
  const hasData = useLiveQuery(() => db.products.count().then((c) => c > 0), []) ?? false;
  const due = backupDue(settings.lastBackupAt, hasData, Date.now());
  const helper = settings.helperMode;
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <nav className={styles.drawer} aria-label={t.menu.title} onClick={(e) => e.stopPropagation()}>
        <div className={styles.brand}>{t.app.name}</div>
        <button type="button" className={`${styles.item} ${styles.current}`} onClick={onClose}>
          <span className={styles.icon} aria-hidden="true">
            🛒
          </span>
          {t.menu.sell}
        </button>
        {helper ? (
          <>
            <p className={styles.helperNote}>{t.helper.menuNote}</p>
            <button
              type="button"
              className={styles.item}
              onClick={() =>
                askOwner(t.helper.exitTitle, async () => {
                  await updateSettings({ helperMode: false });
                  toast(t.helper.exited, 'success');
                  onClose();
                })
              }
            >
              <span className={styles.icon} aria-hidden="true">
                🔓
              </span>
              {t.helper.exit}
            </button>
          </>
        ) : (
          ITEMS.map((it) => (
            <button
              key={it.label}
              type="button"
              className={styles.item}
              onClick={() => {
                onClose();
                push(it.route);
              }}
            >
              <span className={styles.icon} aria-hidden="true">
                {it.icon}
              </span>
              {it.label}
            </button>
          ))
        )}
        {due && !helper && (
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
        {!helper && <p className={styles.soon}>{t.menu.comingSoon}</p>}
      </nav>
      {/* La hoja del código queda fuera del cajón para no cerrarse con su clic. */}
      <div onClick={(e) => e.stopPropagation()}>{ownerSheet}</div>
    </div>
  );
}

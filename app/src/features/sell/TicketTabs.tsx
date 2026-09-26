import { memo } from 'react';
import { formatPEN } from '../../domain/money';
import { t } from '../../i18n/es-PE';
import { useLongPress } from '../../ui/useLongPress';
import styles from './Sell.module.css';

export interface TabInfo {
  id: string;
  label: string;
  total: number;
}

interface Props {
  tabs: TabInfo[];
  activeId: string | null;
  canAdd: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onAdd: () => void;
}

const Tab = memo(function Tab({
  tab,
  active,
  onSelect,
  onRename,
}: {
  tab: TabInfo;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
}) {
  const press = useLongPress(
    () => onSelect(tab.id),
    () => onRename(tab.id),
  );
  return (
    <button type="button" className={`${styles.tab} ${active ? styles.tabActive : ''}`} aria-pressed={active} {...press}>
      {tab.label}
      {tab.total > 0 && <span className="mono"> · {formatPEN(tab.total)}</span>}
    </button>
  );
});

export function TicketTabs({ tabs, activeId, canAdd, onSelect, onRename, onAdd }: Props) {
  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <Tab key={tab.id} tab={tab} active={tab.id === activeId} onSelect={onSelect} onRename={onRename} />
      ))}
      <button type="button" className={styles.tabAdd} aria-label={t.sell.newTicket} disabled={!canAdd} onClick={onAdd}>
        +
      </button>
    </div>
  );
}

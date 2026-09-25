import type { ReactNode } from 'react';
import { useNav } from '../app/nav';
import { t } from '../i18n/es-PE';
import styles from './ScreenHeader.module.css';

export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const back = useNav((s) => s.back);
  return (
    <header className={styles.header}>
      <button type="button" className={styles.icon} aria-label={t.common.back} onClick={back}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <h1 className={styles.title}>{title}</h1>
      {right}
    </header>
  );
}

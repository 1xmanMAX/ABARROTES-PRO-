import { useEffect, useState } from 'react';
import { formatDateTime } from '../../domain/time';
import { t } from '../../i18n/es-PE';
import { parseCode } from '../../sync/http';
import { isAndroid, link, loadSync, pcInfo, scanAndLink, syncNow, unlink, useSync } from '../../sync/state';
import { Button } from '../../ui/Button';
import { ScreenHeader } from '../../ui/ScreenHeader';
import s from '../../ui/Screen.module.css';
import { toast } from '../../ui/toast';
import { NexoPanel } from './NexoPanel';
import styles from './Sync.module.css';

export function ago(at: number, now = Date.now()): string {
  const sec = Math.round((now - at) / 1000);
  if (sec < 60) return t.sync.justNow;
  if (sec < 3600) return t.sync.minutesAgo(Math.round(sec / 60));
  if (sec < 86_400) return t.sync.hoursAgo(Math.round(sec / 3600));
  return formatDateTime(at);
}

/**
 * Sincronizar: primero el grupo de aparatos (Nexo); debajo, el vínculo con la PC por QR como
 * respaldo. Sin copia local (la versión web), solo el vínculo.
 */
export function SyncPanel({ onLinked }: { onLinked?: () => void }) {
  const withNexo = Boolean(pcInfo) || isAndroid;
  if (!withNexo) return <LinkPanel onLinked={onLinked} />;
  return (
    <>
      <h2 className={styles.heading}>{t.nexo.title}</h2>
      <NexoPanel />
      <details className={`${s.card} ${styles.backup}`}>
        <summary>{t.sync.backupTitle}</summary>
        <div className={styles.section}>
          <p className={s.muted}>{t.sync.backupHint}</p>
          <LinkPanel onLinked={onLinked} />
        </div>
      </details>
    </>
  );
}

/** El vínculo con la PC por QR: en la PC muestra el QR; en el celular, vincular y el estado. */
function LinkPanel({ onLinked }: { onLinked?: () => void }) {
  const st = useSync();
  const [pasted, setPasted] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    // En la PC, al mostrar el QR se sincroniza ya: el celular que lo escanee recibe todo al día.
    void loadSync().then(() => pcInfo && syncNow({ silent: true }));
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const status = st.busy ? (
    <p className={styles.status}>{st.progress || t.sync.working}</p>
  ) : st.error ? (
    <p className={`${styles.status} ${styles.error}`} role="alert">
      {st.error}
    </p>
  ) : st.last ? (
    <p className={`${styles.status} ${styles.ok}`} data-testid="sync-last">
      {t.sync.lastAt(ago(st.last.at))}
      {st.last.conflicts > 0 && t.sync.conflicts(st.last.conflicts)}
    </p>
  ) : null;

  const others = st.group.filter((g) => g.id !== st.device?.id);
  const devices = others.length > 0 && (
    <div className={s.card}>
      <div className={s.label}>{t.sync.devices}</div>
      <ul className={styles.devices}>
        {others.map((g) => (
          <li key={g.id}>
            <strong>{g.nombre || 'Aparato'}</strong>
            <span>{g.sincronizado ? t.sync.deviceSynced(ago(g.sincronizado)) : t.sync.deviceNever}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const afterLink = (r: unknown) => {
    if (r) {
      toast(t.sync.done, 'success');
      onLinked?.();
    }
  };

  if (pcInfo) {
    return (
      <>
        <p>{t.sync.pcIntro}</p>
        <div className={styles.qr} dangerouslySetInnerHTML={{ __html: pcInfo.qr }} />
        <label className={s.field}>
          {t.sync.copyLabel}
          <div className={styles.codeRow}>
            <input className={`${s.input} ${styles.code}`} readOnly value={pcInfo.codigo} onFocus={(e) => e.target.select()} />
            <Button onClick={() => navigator.clipboard?.writeText(pcInfo!.codigo).then(() => toast(t.sync.copied, 'success'))}>
              {t.sync.copy}
            </Button>
          </div>
        </label>
        <p className={s.muted}>{t.sync.sameWifi}</p>
        {devices}
        {status}
      </>
    );
  }

  if (!st.code) {
    return (
      <>
        <p>{t.sync.intro}</p>
        {isAndroid && (
          <>
            <Button variant="primary" block disabled={st.busy} onClick={() => void scanAndLink().then(afterLink)}>
              {t.sync.scan}
            </Button>
            <p className={styles.or}>{t.sync.orPaste}</p>
          </>
        )}
        <label className={s.field}>
          {!isAndroid && t.sync.codeLabel}
          <div className={styles.codeRow}>
            <input
              className={`${s.input} ${styles.code}`}
              placeholder="mibodega-sync://…"
              autoComplete="off"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              aria-label={t.sync.codeLabel}
            />
            <Button disabled={st.busy || !pasted.trim()} onClick={() => void link(pasted).then(afterLink)}>
              {t.sync.link}
            </Button>
          </div>
        </label>
        {status}
      </>
    );
  }

  return (
    <>
      <p>{t.sync.linked(parseCode(st.code).url.replace('http://', ''))}</p>
      <Button variant="primary" block disabled={st.busy} onClick={() => void syncNow().then((r) => r && toast(t.sync.done, 'success'))}>
        {st.busy ? t.sync.working : t.sync.now}
      </Button>
      {status}
      {devices}
      <Button
        variant="danger"
        onClick={() => {
          if (confirm(t.sync.unlinkConfirm)) void unlink();
        }}
      >
        {t.sync.unlink}
      </Button>
    </>
  );
}

export default function SyncScreen() {
  return (
    <div className={s.screen}>
      <ScreenHeader title={t.sync.title} />
      <div className={s.content}>
        <SyncPanel />
      </div>
    </div>
  );
}

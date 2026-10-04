import { useEffect, useState } from 'react';
import { t } from '../../i18n/es-PE';
import { cleanGroupCode, isGroupCode } from '../../sync/groupCode';
import { nexoOrder, refreshNexo, useSync } from '../../sync/state';
import { Button } from '../../ui/Button';
import s from '../../ui/Screen.module.css';
import { toast } from '../../ui/toast';
import { ago } from './SyncScreen';
import styles from './Sync.module.css';

/**
 * El grupo de aparatos (Nexo): crear el grupo o unirse con su código, ver quién está, sacar un
 * aparato perdido y sincronizar. Todo pasa por la copia local de este aparato.
 */
export function NexoPanel() {
  const nexo = useSync((st) => st.nexo);
  const node = useSync((st) => st.node);
  const busy = useSync((st) => st.nexoBusy);
  const [code, setCode] = useState('');
  const [ip, setIp] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void refreshNexo();
    const id = setInterval(() => void refreshNexo(), 3000);
    return () => clearInterval(id);
  }, [node]);

  const run = async (orden: string, datos: Record<string, string> = {}, ok?: (r: Record<string, unknown>) => void) => {
    setError('');
    try {
      const r = await nexoOrder(orden, datos);
      ok?.(r);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!node) {
    if (nexo?.error) return <p className={`${styles.status} ${styles.error}`}>{t.nexo.unavailable(nexo.error)}</p>;
    return null;
  }
  if (!nexo || !nexo.activo) {
    return <p className={styles.status}>{nexo?.error ? t.nexo.unavailable(nexo.error) : t.nexo.starting}</p>;
  }

  const errorBox = error && (
    <p className={`${styles.status} ${styles.error}`} role="alert">
      ⚠ {error}
    </p>
  );

  if (!nexo.enGrupo) {
    const valid = isGroupCode(code);
    return (
      <div className={styles.section}>
        <p>{t.nexo.intro}</p>
        <Button variant="primary" block disabled={busy} onClick={() => run('crear', {}, () => toast(t.nexo.created, 'success'))}>
          ➕ {t.nexo.create}
        </Button>
        <p className={s.muted}>{t.nexo.createHint}</p>
        <label className={s.field}>
          {t.nexo.joinTitle}
          <input
            className={`${s.input} ${styles.joinInput}`}
            placeholder={t.nexo.joinPlaceholder}
            autoComplete="off"
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(cleanGroupCode(e.target.value))}
            data-testid="group-code-input"
          />
        </label>
        <Button block disabled={busy || !valid} onClick={() => run('unirse', { codigo: code, ip }, () => toast(t.nexo.joined, 'success'))}>
          {busy ? t.nexo.joining : `🤝 ${t.nexo.join}`}
        </Button>
        <details>
          <summary className={s.muted}>{t.nexo.byIp}</summary>
          <input
            className={`${s.input} mono`}
            style={{ marginTop: 8, width: '100%' }}
            placeholder={t.nexo.ipPlaceholder}
            inputMode="decimal"
            value={ip}
            onChange={(e) => setIp(e.target.value.trim())}
            aria-label={t.nexo.byIp}
          />
        </details>
        {errorBox}
      </div>
    );
  }

  const members = nexo.miembros ?? [];
  return (
    <div className={styles.section}>
      {nexo.codigo && (
        <div className={styles.groupCode}>
          <div className={s.label}>{t.nexo.codeTitle}</div>
          <strong data-testid="group-code">{nexo.codigo}</strong>
          <p className={s.muted} style={{ margin: '6px 0 0' }}>
            {t.nexo.codeHint}
          </p>
        </div>
      )}

      <div className={s.card}>
        <div className={s.label}>{t.nexo.members}</div>
        {members.map((m) => (
          <div key={m.id} className={styles.member}>
            <span className={styles.dot} aria-hidden="true">
              {m.yo ? '⭐' : m.aLaVista ? '📶' : '💤'}
            </span>
            <div>
              <strong>{m.nombre || 'Aparato'}</strong>
              <small>{m.yo ? t.nexo.me : m.aLaVista ? t.nexo.inView : t.nexo.away}</small>
            </div>
            {!m.yo && (
              <button
                type="button"
                className={styles.memberRemove}
                disabled={busy}
                onClick={() => {
                  if (confirm(t.nexo.removeConfirm(m.nombre || 'Aparato'))) void run('expulsar', { id: m.id }, () => toast(t.nexo.removed));
                }}
              >
                {t.nexo.remove}
              </button>
            )}
          </div>
        ))}
      </div>

      <Button
        variant="primary"
        block
        disabled={busy}
        onClick={() =>
          run('sincronizar', {}, (r) => toast(t.nexo.synced(Number(r.aparatos ?? 0), Number(r.aplicados ?? 0)), 'success'))
        }
      >
        🔄 {t.nexo.syncNow}
      </Button>
      {nexo.ultimaSincro ? <p className={`${styles.status} ${styles.ok}`}>{t.nexo.lastSync(ago(nexo.ultimaSincro))}</p> : null}
      {errorBox}
      <div className={s.row}>
        <Button
          disabled={busy}
          onClick={() => {
            if (confirm(t.nexo.renewConfirm)) void run('renovar');
          }}
        >
          {t.nexo.renew}
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            if (confirm(t.nexo.leaveConfirm)) void run('salir', {}, () => toast(t.nexo.left));
          }}
        >
          {t.nexo.leave}
        </Button>
      </div>
      {nexo.direccion && <p className={s.muted}>{t.nexo.address(nexo.direccion)}</p>}
    </div>
  );
}

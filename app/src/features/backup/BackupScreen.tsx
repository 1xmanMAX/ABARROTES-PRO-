import { useState } from 'react';
import { useSettings } from '../../app/data';
import { saveOrShareFile } from '../../app/fileShare';
import { daysSince } from '../../domain/backup';
import { formatDateTime } from '../../domain/time';
import { createBackup, inspectBackup, restoreBackup } from '../../db/backup';
import { verifyOwnerPin } from '../../db/pins';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { PinPad } from '../../ui/PinPad';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';
import { toast, toastError } from '../../ui/toast';

type Restore = { text: string; info: string; step: 'confirm' | 'current' | 'backup'; currentPin?: string };

/** Copia de seguridad cifrada (SPEC §13): crear y restaurar. */
export default function BackupScreen() {
  const settings = useSettings();
  const [creating, setCreating] = useState(false);
  const [restore, setRestore] = useState<Restore | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const env = inspectBackup(text);
      setRestore({
        text,
        step: 'confirm',
        info: t.backup.fileInfo(
          formatDateTime(env.createdAt),
          env.summary.products ?? 0,
          env.summary.sales ?? env.summary.tickets ?? 0,
          env.summary.parties ?? 0,
        ),
      });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.backup.title} />
      <div className={s.content}>
        <p>{t.backup.why}</p>
        <div className={s.card}>
          <div className={s.label}>{t.backup.last}</div>
          <div style={{ fontWeight: 800, fontSize: 18 }} data-testid="last-backup">
            {settings.lastBackupAt
              ? `${formatDateTime(settings.lastBackupAt)} (${t.backup.ago(daysSince(settings.lastBackupAt, Date.now()))})`
              : t.backup.never}
          </div>
        </div>
        <Button variant="primary" block onClick={() => setCreating(true)}>
          {t.backup.create}
        </Button>

        <label className={`${s.input} ${s.check}`} style={{ justifyContent: 'center', fontWeight: 700 }}>
          {t.backup.restore}
          <input
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            data-testid="restore-file"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>

        <div className={s.card}>
          <div className={s.muted}>{t.backup.security}</div>
        </div>
      </div>

      {creating && (
        <Sheet title={t.backup.createTitle} onClose={() => setCreating(false)}>
          <PinPad
            title={t.backup.createTitle}
            hint={t.pin.ownerHint}
            submitLabel={t.common.accept}
            onSubmit={async (pin) => {
              const { fileName, text } = await createBackup(pin);
              setCreating(false);
              try {
                const how = await saveOrShareFile(fileName, text, t.backup.title);
                toast(how === 'shared' ? t.backup.created : t.backup.downloaded, 'success');
              } catch (err) {
                if (!(err instanceof DOMException && err.name === 'AbortError')) toastError(err);
              }
            }}
          />
        </Sheet>
      )}

      {restore && (
        <Sheet title={t.backup.restore} onClose={() => setRestore(null)}>
          {restore.step === 'confirm' && (
            <>
              <p style={{ fontWeight: 700 }}>{restore.info}</p>
              <p style={{ color: 'var(--brick)', fontWeight: 800 }}>{t.backup.restoreWarn}</p>
              <Button variant="danger" block onClick={() => setRestore({ ...restore, step: 'current' })}>
                {t.backup.restoreConfirm}
              </Button>
            </>
          )}
          {restore.step === 'current' && (
            <PinPad
              title={t.backup.stepCurrent}
              hint={t.pin.ownerHint}
              submitLabel={t.common.accept}
              onSubmit={async (pin) => {
                await verifyOwnerPin(pin);
                setRestore({ ...restore, step: 'backup', currentPin: pin });
              }}
            />
          )}
          {restore.step === 'backup' && (
            <PinPad
              key="backup"
              title={t.backup.stepBackup}
              hint={restore.info}
              submitLabel={t.common.accept}
              onSubmit={async (pin) => {
                await restoreBackup(restore.text, pin, restore.currentPin);
                toast(t.backup.restored, 'success');
                // Recargar para que la venta y la predicción lean los datos nuevos.
                setTimeout(() => window.location.reload(), 800);
              }}
            />
          )}
        </Sheet>
      )}
    </div>
  );
}

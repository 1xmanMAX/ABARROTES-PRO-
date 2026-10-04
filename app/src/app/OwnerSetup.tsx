import { useState } from 'react';
import { setOwnerPin } from '../db/pins';
import { SyncPanel } from '../features/sync/SyncScreen';
import { pcInfo } from '../sync/state';
import { Button } from '../ui/Button';
import { t } from '../i18n/es-PE';
import { PinCreate } from '../ui/PinCreate';
import s from '../ui/Screen.module.css';
import { toast } from '../ui/toast';

/** Primer arranque: crear el código de dueño. */
export function OwnerSetup() {
  // Un celular nuevo puede vincularse con la PC en vez de crear otro código: recibe el de la PC.
  const [linking, setLinking] = useState(false);
  if (linking) {
    return (
      <div className={s.screen}>
        <div className={s.content}>
          <h1 style={{ margin: 0, fontSize: '1.4375rem' }}>{t.sync.title}</h1>
          <SyncPanel />
          <Button onClick={() => setLinking(false)}>{t.common.back}</Button>
        </div>
      </div>
    );
  }
  return (
    <div className={s.screen}>
      <div className={s.content} style={{ justifyContent: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.4375rem' }}>{t.pin.ownerSetupTitle}</h1>
        <p className={s.muted}>{t.pin.ownerSetupText}</p>
        <PinCreate
          title={t.pin.ownerNew}
          hint={t.pin.ownerHint}
          onCreate={async (pin) => {
            await setOwnerPin(pin);
            toast(t.pin.created, 'success');
          }}
        />
        {!pcInfo && <Button onClick={() => setLinking(true)}>{t.sync.setupLink}</Button>}
      </div>
    </div>
  );
}

import { setOwnerPin } from '../db/pins';
import { t } from '../i18n/es-PE';
import { PinCreate } from '../ui/PinCreate';
import s from '../ui/Screen.module.css';
import { toast } from '../ui/toast';

/** Primer arranque: crear el código de dueño. */
export function OwnerSetup() {
  return (
    <div className={s.screen}>
      <div className={s.content} style={{ justifyContent: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{t.pin.ownerSetupTitle}</h1>
        <p className={s.muted}>{t.pin.ownerSetupText}</p>
        <PinCreate
          title={t.pin.ownerNew}
          hint={t.pin.ownerHint}
          onCreate={async (pin) => {
            await setOwnerPin(pin);
            toast(t.pin.created, 'success');
          }}
        />
      </div>
    </div>
  );
}

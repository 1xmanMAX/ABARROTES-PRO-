import { useEffect, useState } from 'react';
import { recomputeGridOrder, useSettings } from '../../app/data';
import { seedDemo } from '../../db/seed';
import { refreshStats } from '../../app/stats';
import { updateSettings } from '../../db/settings';
import { centsToInput, parseSolesToCents } from '../../domain/money';
import { setOwnerPin } from '../../db/pins';
import { PinCreate } from '../../ui/PinCreate';
import { Sheet } from '../../ui/Sheet';
import { useOwnerPin } from '../parties/usePin';
import type { ThemePref } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { ScreenHeader } from '../../ui/ScreenHeader';
import s from '../../ui/Screen.module.css';
import { toast, toastError } from '../../ui/toast';
import { anyTicketHasLines, useSell } from '../sell/sellStore';

const THEMES: ThemePref[] = ['light', 'dark', 'system'];

export default function SettingsScreen() {
  const settings = useSettings();
  const [shopName, setShopName] = useState(settings.shopName);
  const [footer, setFooter] = useState(settings.receiptFooter);
  const [fixed, setFixed] = useState(settings.fixedMonthlyCosts ? centsToInput(settings.fixedMonthlyCosts) : '');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [changingPin, setChangingPin] = useState<string | null>(null);
  const [askOwner, ownerSheet] = useOwnerPin();

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(false));
  }, []);

  const saveTexts = () =>
    updateSettings({ shopName: shopName.trim() || 'Mi Bodega', receiptFooter: footer.trim() }).then(
      () => toast(t.settings.saved, 'success'),
      toastError,
    );

  const reorder = async () => {
    // SPEC §2.2: el orden no cambia mientras algún ticket tenga productos.
    if (anyTicketHasLines(useSell.getState())) return toast(t.settings.reorderBusy, 'error');
    await recomputeGridOrder();
    toast(t.settings.reorderDone, 'success');
  };

  const demo = async () => {
    const n = await seedDemo();
    await refreshStats();
    if (n === 0) return toast(t.settings.demoSkip);
    await recomputeGridOrder();
    toast(t.settings.demoDone(n), 'success');
  };

  return (
    <div className={s.screen}>
      <ScreenHeader title={t.settings.title} />
      <div className={s.content}>
        <label className={s.field}>
          {t.settings.shopName}
          <input className={s.input} value={shopName} onChange={(e) => setShopName(e.target.value)} onBlur={saveTexts} />
        </label>
        <label className={s.field}>
          {t.settings.receiptFooter}
          <input className={s.input} value={footer} onChange={(e) => setFooter(e.target.value)} onBlur={saveTexts} />
        </label>

        <label className={s.field}>
          {t.settings.fixedCosts}
          <input
            className={`${s.input} mono`}
            inputMode="decimal"
            value={fixed}
            placeholder="0.00"
            onChange={(e) => setFixed(e.target.value)}
            onBlur={() => {
              const v = parseSolesToCents(fixed || '0');
              if (v === null) return toast(t.errors.invalidAmount, 'error');
              void updateSettings({ fixedMonthlyCosts: v }).then(() => toast(t.settings.saved, 'success'));
            }}
          />
          <span className={s.muted}>{t.settings.fixedCostsHint}</span>
        </label>

        <div className={s.field}>
          {t.settings.paperWidth}
          <div className={s.segment} role="group" aria-label={t.settings.paperWidth}>
            {([58, 80] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={settings.paperWidth === w}
                onClick={() => updateSettings({ paperWidth: w })}
              >
                {w} mm
              </button>
            ))}
          </div>
        </div>

        <div className={s.field}>
          {t.settings.maxHaggle}
          <div className={s.segment} role="group" aria-label={t.settings.maxHaggle}>
            {[0, 100, 200, 300, 400, 500].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={settings.maxHaggle === v}
                onClick={() => updateSettings({ maxHaggle: v })}
              >
                {v === 0 ? 'No' : `S/ ${v / 100}`}
              </button>
            ))}
          </div>
        </div>

        <div className={s.field}>
          {t.settings.theme}
          <div className={s.segment} role="group" aria-label={t.settings.theme}>
            {THEMES.map((th) => (
              <button key={th} type="button" aria-pressed={settings.theme === th} onClick={() => updateSettings({ theme: th })}>
                {t.settings.themes[th]}
              </button>
            ))}
          </div>
        </div>

        <Button block onClick={reorder}>
          {t.settings.reorder}
        </Button>
        <Button block variant="plain" onClick={demo}>
          {t.settings.demo}
        </Button>
        <p className={s.muted}>{t.settings.demoHint}</p>

        <Button block onClick={() => askOwner(t.pin.ownerCurrent, async (pin) => setChangingPin(pin))}>
          {t.settings.changeOwnerPin}
        </Button>

        <div className={s.card}>
          <div className={s.label}>{t.settings.help}</div>
          <div className={s.muted}>{t.settings.helpText}</div>
        </div>

        <div className={s.card}>
          <div className={s.label}>{t.settings.storage}</div>
          <div className={s.muted}>{persisted ? t.settings.storageOn : t.settings.storageOff}</div>
        </div>
        <p className={s.muted}>
          {t.settings.version} {__APP_VERSION__}
        </p>
      </div>
      {ownerSheet}
      {changingPin && (
        <Sheet title={t.settings.changeOwnerPin} onClose={() => setChangingPin(null)}>
          <PinCreate
            title={t.pin.ownerNew}
            hint={t.pin.ownerHint}
            onCreate={async (pin) => {
              await setOwnerPin(pin, changingPin);
              toast(t.pin.ownerChanged, 'success');
              setChangingPin(null);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

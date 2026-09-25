import { useEffect, useState } from 'react';
import { recomputeGridOrder, useSettings } from '../../app/data';
import { seedDemoProducts } from '../../db/seed';
import { updateSettings } from '../../db/settings';
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
  const [persisted, setPersisted] = useState<boolean | null>(null);

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
    const n = await seedDemoProducts();
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

        <div className={s.field}>
          {t.settings.paperWidth}
          <div className={s.segment} role="group" aria-label={t.settings.paperWidth}>
            {([58, 80] as const).map((w) => (
              <button key={w} type="button" aria-pressed={settings.paperWidth === w} onClick={() => updateSettings({ paperWidth: w })}>
                {w} mm
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

        <div className={s.card}>
          <div className={s.label}>{t.settings.storage}</div>
          <div className={s.muted}>{persisted ? t.settings.storageOn : t.settings.storageOff}</div>
        </div>
        <p className={s.muted}>
          {t.settings.version} {__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}

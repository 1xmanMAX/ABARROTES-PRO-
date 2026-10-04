import { lazy, Suspense, useEffect, useState } from 'react';
import { ReceiptPrinter } from '../print/Receipt';
import { ToastHost } from '../ui/ToastHost';
import { SellScreen } from '../features/sell/SellScreen';
import { CheckoutScreen } from '../features/sell/CheckoutScreen';
import { SaleDone } from '../features/sell/SaleDone';
import { useSell } from '../features/sell/sellStore';
import { useSettings } from './data';
import { bootstrap } from './bootstrap';
import { currentRoute, installBackHandler, useNav } from './nav';
import { OwnerSetup } from './OwnerSetup';
import { startAutoSync } from '../sync/state';

function usePrefersMoreContrast(): boolean {
  const query = '(prefers-contrast: more)';
  const [more, setMore] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setMore(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return more;
}

const loaders = {
  inventory: () => import('../features/inventory/InventoryScreen'),
  product: () => import('../features/inventory/ProductScreen'),
  history: () => import('../features/history/HistoryScreen'),
  settings: () => import('../features/settings/SettingsScreen'),
  parties: () => import('../features/parties/PartiesScreen'),
  party: () => import('../features/parties/PartyScreen'),
  partyEdit: () => import('../features/parties/PartyEditScreen'),
  voucher: () => import('../features/parties/VoucherScreen'),
  today: () => import('../features/stats/TodayScreen'),
  deliver: () => import('../features/consign/DeliverScreen'),
  cash: () => import('../features/cash/CashScreen'),
  backup: () => import('../features/backup/BackupScreen'),
  purchase: () => import('../features/cash/PurchaseScreen'),
  settle: () => import('../features/consign/SettleScreen'),
  profit: () => import('../features/stats/ProfitScreen'),
  sync: () => import('../features/sync/SyncScreen'),
};
const InventoryScreen = lazy(loaders.inventory);
const ProductScreen = lazy(loaders.product);
const HistoryScreen = lazy(loaders.history);
const SettingsScreen = lazy(loaders.settings);
const PartiesScreen = lazy(loaders.parties);
const PartyScreen = lazy(loaders.party);
const PartyEditScreen = lazy(loaders.partyEdit);
const VoucherScreen = lazy(loaders.voucher);
const TodayScreen = lazy(loaders.today);
const DeliverScreen = lazy(loaders.deliver);
const CashScreen = lazy(loaders.cash);
const BackupScreen = lazy(loaders.backup);
const PurchaseScreen = lazy(loaders.purchase);
const SettleScreen = lazy(loaders.settle);
const ProfitScreen = lazy(loaders.profit);
const SyncScreen = lazy(loaders.sync);

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = useNav(currentRoute);
  const loaded = useSell((s) => s.loaded);
  const settings = useSettings();

  useEffect(() => installBackHandler(), []);
  useEffect(() => {
    bootstrap()
      .then(() => {
        setReady(true);
        // Sincronización con la PC (si este aparato está vinculado).
        void startAutoSync();
        // Precargar las pantallas secundarias para que abran al instante.
        setTimeout(() => Object.values(loaders).forEach((load) => load()), 500);
      })
      .catch((err) => {
        console.error(err);
        setError(String(err?.message ?? err));
      });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.textSize === 'normal') delete root.dataset.text;
    else root.dataset.text = settings.textSize;
  }, [settings.textSize]);

  // Modo Sol: elegido en Ajustes o pedido por el sistema ("aumentar contraste").
  const prefersMore = usePrefersMoreContrast();
  useEffect(() => {
    const root = document.documentElement;
    if (settings.contrast === 'sol' || prefersMore) root.dataset.contrast = 'sol';
    else delete root.dataset.contrast;
  }, [settings.contrast, prefersMore]);

  if (error) return <p style={{ padding: 16 }}>No se pudo abrir la base de datos: {error}</p>;
  if (!ready || !loaded) return null;
  // SPEC §9.5: el código de dueño se crea en el primer arranque.
  if (!settings.ownerPin) return <OwnerSetup />;

  return (
    <>
      {/* Vender queda montado debajo para volver al instante. */}
      <div style={{ display: route.name === 'sell' ? 'contents' : 'none' }}>
        <SellScreen />
      </div>
      <Suspense fallback={null}>
        {route.name === 'checkout' && <CheckoutScreen />}
        {route.name === 'inventory' && <InventoryScreen />}
        {route.name === 'product' && <ProductScreen id={route.id} />}
        {route.name === 'history' && <HistoryScreen />}
        {route.name === 'settings' && <SettingsScreen />}
        {route.name === 'parties' && <PartiesScreen />}
        {route.name === 'party' && <PartyScreen id={route.id} />}
        {route.name === 'partyEdit' && <PartyEditScreen id={route.id} />}
        {route.name === 'voucher' && <VoucherScreen signatureId={route.signatureId} />}
        {route.name === 'today' && <TodayScreen />}
        {route.name === 'deliver' && <DeliverScreen partyId={route.partyId} />}
        {route.name === 'cash' && <CashScreen />}
        {route.name === 'backup' && <BackupScreen />}
        {route.name === 'purchase' && <PurchaseScreen />}
        {route.name === 'settle' && <SettleScreen partyId={route.partyId} />}
        {route.name === 'profit' && <ProfitScreen />}
        {route.name === 'sync' && <SyncScreen />}
      </Suspense>
      <SaleDone />
      <ToastHost />
      <ReceiptPrinter />
    </>
  );
}

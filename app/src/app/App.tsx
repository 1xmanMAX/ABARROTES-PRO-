import { lazy, Suspense, useEffect, useState } from 'react';
import { ReceiptPrinter } from '../print/Receipt';
import { ToastHost } from '../ui/Toast';
import { SellScreen } from '../features/sell/SellScreen';
import { CheckoutScreen } from '../features/sell/CheckoutScreen';
import { useSell } from '../features/sell/sellStore';
import { useSettings } from './data';
import { bootstrap } from './bootstrap';
import { currentRoute, installBackHandler, useNav } from './nav';

const loaders = {
  inventory: () => import('../features/inventory/InventoryScreen'),
  product: () => import('../features/inventory/ProductScreen'),
  history: () => import('../features/history/HistoryScreen'),
  settings: () => import('../features/settings/SettingsScreen'),
};
const InventoryScreen = lazy(loaders.inventory);
const ProductScreen = lazy(loaders.product);
const HistoryScreen = lazy(loaders.history);
const SettingsScreen = lazy(loaders.settings);

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

  if (error) return <p style={{ padding: 16 }}>No se pudo abrir la base de datos: {error}</p>;
  if (!ready || !loaded) return null;

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
      </Suspense>
      <ToastHost />
      <ReceiptPrinter />
    </>
  );
}

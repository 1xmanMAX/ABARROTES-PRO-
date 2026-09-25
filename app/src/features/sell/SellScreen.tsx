import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useOrderedSellProducts, useProductMap, useProducts } from '../../app/data';
import { Menu } from '../../app/Menu';
import { useNav } from '../../app/nav';
import { cartItemCount, cartTotal, reservedByProduct } from '../../domain/cart';
import { formatQty, unitStep } from '../../domain/qty';
import { seedDemoProducts } from '../../db/seed';
import type { Product } from '../../db/types';
import { MAX_OPEN_TICKETS } from '../../db/tickets';
import { recomputeGridOrder } from '../../app/data';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { toast, toastError, vibrate } from '../../ui/toast';
import { CartSheet } from './CartSheet';
import { CheckoutBar } from './CheckoutBar';
import { LineEditSheet } from './LineEditSheet';
import { MultiplierBar } from './MultiplierBar';
import { ProductGrid } from './ProductGrid';
import { RenameSheet } from './RenameSheet';
import { SearchSheet } from './SearchSheet';
import { activeTicket, useSell } from './sellStore';
import { TicketTabs, type TabInfo } from './TicketTabs';
import styles from './Sell.module.css';

type Overlay =
  | { kind: 'none' }
  | { kind: 'menu' }
  | { kind: 'search' }
  | { kind: 'cart' }
  | { kind: 'edit'; productId: string }
  | { kind: 'rename'; ticketId: string };

/** Disponible para agregar = stock − lo reservado en TODOS los tickets abiertos. */
function availableNow(p: Product): number {
  const reserved = reservedByProduct(useSell.getState().tickets).get(p.id) ?? 0;
  return p.stock - reserved;
}

export function SellScreen() {
  const products = useProducts();
  const productMap = useProductMap(products);
  const gridProducts = useOrderedSellProducts(products);
  const push = useNav((s) => s.push);
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const close = useCallback(() => setOverlay({ kind: 'none' }), []);

  const tickets = useSell((s) => s.tickets);
  const activeId = useSell((s) => s.activeId);
  const multiplier = useSell((s) => s.multiplier);
  const active = useSell(activeTicket);
  const actions = useSell(
    useShallow((s) => ({
      setActive: s.setActive,
      newTicket: s.newTicket,
      rename: s.rename,
      closeEmpty: s.closeEmpty,
      setLineQty: s.setLineQty,
      setLinePrice: s.setLinePrice,
      clear: s.clear,
      undo: s.undo,
      pressMultiplier: s.pressMultiplier,
    })),
  );

  const reserved = useMemo(() => reservedByProduct(tickets), [tickets]);
  const available = useCallback((p: Product) => p.stock - (reserved.get(p.id) ?? 0), [reserved]);
  const qtyInActive = useMemo(() => new Map(active.lines.map((l) => [l.productId, l.qty])), [active.lines]);
  const total = useMemo(() => cartTotal(active.lines, productMap), [active.lines, productMap]);
  const count = useMemo(() => cartItemCount(active.lines, productMap), [active.lines, productMap]);
  const tabs: TabInfo[] = useMemo(
    () => tickets.map((tk) => ({ id: tk.id, label: tk.label, total: cartTotal(tk.lines, productMap) })),
    [tickets, productMap],
  );

  // Estable entre renders: los tiles memoizados no se repintan por cada toque.
  const onTap = useCallback((p: Product) => {
    const state = useSell.getState();
    const avail = availableNow(p);
    const wanted = state.multiplier.value * unitStep(p);
    const added = state.tap(p.id, unitStep(p), avail);
    if (added > 0) vibrate(15);
    if (added < wanted) {
      vibrate([30, 40, 30]);
      toast(avail > 0 ? t.sell.onlyLeft(formatQty(p, avail)) : t.sell.noStock, 'error');
    }
  }, []);
  const onLongPress = useCallback((p: Product) => {
    vibrate(25);
    setOverlay({ kind: 'edit', productId: p.id });
  }, []);

  const onAdd = async () => {
    try {
      await actions.newTicket();
    } catch {
      toast(t.sell.maxTickets, 'error');
    }
  };

  if (products.length === 0) {
    return (
      <div className={styles.screen}>
        <SellHeader onMenu={() => setOverlay({ kind: 'menu' })} />
        <div className={styles.emptyState}>
          <p>{t.sell.noProducts}</p>
          <Button variant="primary" onClick={() => push({ name: 'inventory' })}>
            {t.sell.goInventory}
          </Button>
          <Button
            onClick={async () => {
              await seedDemoProducts();
              await recomputeGridOrder();
            }}
          >
            {t.sell.loadDemo}
          </Button>
        </div>
        {overlay.kind === 'menu' && <Menu onClose={close} />}
      </div>
    );
  }

  const editProduct = overlay.kind === 'edit' ? productMap.get(overlay.productId) : undefined;
  const renameTicket = overlay.kind === 'rename' ? tickets.find((tk) => tk.id === overlay.ticketId) : undefined;

  return (
    <div className={styles.screen}>
      <SellHeader onMenu={() => setOverlay({ kind: 'menu' })}>
        <TicketTabs
          tabs={tabs}
          activeId={activeId}
          canAdd={tickets.length < MAX_OPEN_TICKETS}
          onSelect={actions.setActive}
          onRename={(id) => setOverlay({ kind: 'rename', ticketId: id })}
          onAdd={onAdd}
        />
      </SellHeader>

      <main className={styles.main}>
        <ProductGrid
          products={gridProducts}
          qtyInActive={qtyInActive}
          available={available}
          onTap={onTap}
          onLongPress={onLongPress}
          onSearch={() => setOverlay({ kind: 'search' })}
        />
        <MultiplierBar
          state={multiplier}
          canUndo={active.undo.length > 0}
          onPress={actions.pressMultiplier}
          onUndo={actions.undo}
        />
      </main>

      <CheckoutBar
        count={count}
        label={active.label}
        total={total}
        onDetail={() => setOverlay({ kind: 'cart' })}
        onCharge={() => push({ name: 'checkout' })}
      />

      {overlay.kind === 'menu' && <Menu onClose={close} />}
      {overlay.kind === 'search' && (
        <SearchSheet
          products={gridProducts}
          available={available}
          onPick={(p) => {
            onTap(p);
            close();
          }}
          onClose={close}
        />
      )}
      {overlay.kind === 'cart' && (
        <CartSheet
          lines={active.lines}
          products={productMap}
          available={available}
          total={total}
          onSetQty={actions.setLineQty}
          onEdit={(p) => setOverlay({ kind: 'edit', productId: p.id })}
          onClear={actions.clear}
          onClose={close}
        />
      )}
      {editProduct && (
        <LineEditSheet
          product={editProduct}
          line={active.lines.find((l) => l.productId === editProduct.id)}
          maxQty={available(editProduct) + (qtyInActive.get(editProduct.id) ?? 0)}
          onSave={(qty, price) => {
            actions.setLineQty(editProduct.id, qty);
            if (qty > 0) actions.setLinePrice(editProduct.id, price);
            close();
          }}
          onClose={close}
        />
      )}
      {renameTicket && (
        <RenameSheet
          label={renameTicket.label}
          canClose={renameTicket.lines.length === 0 && tickets.length > 1}
          onSave={(label) => actions.rename(renameTicket.id, label).then(close, toastError)}
          onCloseTab={() => actions.closeEmpty(renameTicket.id).then(close, toastError)}
          onClose={close}
        />
      )}
    </div>
  );
}

function SellHeader({ onMenu, children }: { onMenu: () => void; children?: React.ReactNode }) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.menuBtn} aria-label={t.sell.menu} onClick={onMenu}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      </button>
      {children}
    </header>
  );
}

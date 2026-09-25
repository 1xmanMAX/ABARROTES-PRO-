import { memo, useEffect, useState } from 'react';
import { formatPEN } from '../../domain/money';
import { tileGradient } from '../../domain/tileColor';
import type { Product } from '../../db/types';
import { useLongPress } from '../../ui/useLongPress';
import styles from './Sell.module.css';

interface Props {
  product: Product;
  /** Cantidad en el ticket activo, ya formateada ('' = no está). */
  count: string;
  disabled: boolean;
  onTap: (p: Product) => void;
  onLongPress: (p: Product) => void;
}

function usePhotoUrl(photo: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) return setUrl(null);
    const u = URL.createObjectURL(photo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  return url;
}

/** Tile de venta. Memoizado: solo se repinta si cambia su producto, contador o estado. */
export const TileButton = memo(function TileButton({ product, count, disabled, onTap, onLongPress }: Props) {
  const photoUrl = usePhotoUrl(product.photo);
  const press = useLongPress(
    () => onTap(product),
    () => onLongPress(product),
  );
  const selected = count !== '';
  return (
    <button
      type="button"
      className={`${styles.tile} ${selected ? styles.tileSelected : ''}`}
      style={{ background: photoUrl ? undefined : tileGradient(product.tileColor) }}
      disabled={disabled}
      aria-label={`${product.name}, ${formatPEN(product.salePrice)}${selected ? `, ${count} en el ticket` : ''}`}
      data-product-id={product.id}
      {...press}
    >
      {photoUrl ? (
        <img className={styles.tilePhoto} src={photoUrl} alt="" draggable={false} />
      ) : (
        <span className={styles.tileInitial} aria-hidden="true">
          {product.name.charAt(0).toUpperCase()}
        </span>
      )}
      {selected && (
        <span className={styles.tileCount} aria-hidden="true">
          {count}
        </span>
      )}
      <span className={styles.tileLabel}>
        <span className={styles.tileName}>{product.name}</span>
        <span className={styles.tilePrice}>{formatPEN(product.salePrice)}</span>
      </span>
    </button>
  );
});

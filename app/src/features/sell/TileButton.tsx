import { memo, useEffect, useState } from 'react';
import { formatPEN } from '../../domain/money';
import { tileSwatch } from '../../domain/tileColor';
import type { Product } from '../../db/types';
import { t } from '../../i18n/es-PE';
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

/**
 * Tile de venta. Memoizado: solo se repinta si cambia su producto, contador o estado.
 * El texto va siempre sobre fondo liso (nunca sobre la foto): se lee igual al sol y con poca vista.
 */
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
      className={`${styles.tile} ${photoUrl ? '' : styles.tileNoPhoto} ${selected ? styles.tileSelected : ''}`}
      disabled={disabled}
      aria-label={`${product.name}, ${disabled ? t.sell.soldOut : formatPEN(product.salePrice)}${selected ? `, ${count} en el ticket` : ''}`}
      data-product-id={product.id}
      {...press}
    >
      {photoUrl ? (
        <img className={styles.tilePhoto} src={photoUrl} alt="" draggable={false} />
      ) : (
        <span className={styles.tileSwatch} style={{ background: tileSwatch(product.tileColor) }} aria-hidden="true" />
      )}
      {selected && (
        // key: al cambiar la cantidad, el número "salta" (confirma el toque sin mirar dos veces).
        <span key={count} className={styles.tileCount} aria-hidden="true">
          {count}
        </span>
      )}
      <span className={styles.tileLabel}>
        <span className={styles.tileName}>{product.name}</span>
        {disabled ? (
          <span className={styles.tileSoldOut}>{t.sell.soldOut}</span>
        ) : (
          <span className={styles.tilePrice}>
            <small>S/</small>
            {formatPEN(product.salePrice).replace('S/ ', '')}
          </span>
        )}
      </span>
    </button>
  );
});

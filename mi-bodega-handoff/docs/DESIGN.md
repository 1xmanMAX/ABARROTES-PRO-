# Diseño — Mi Bodega

## Idea visual

"Libreta de cuentas de bodega": fondo papel, tapa verde botella, detalles en dorado y cifras en tipografía monoespaciada tipo recibo. Pensado para leerse bajo el sol, con prisa y con una sola mano.

## Tokens

```css
:root {
  --paper: #F3ECDA;       /* fondo */
  --paper-line: #E1D4AC;  /* bordes, divisores */
  --surface: #FFFDF6;     /* tarjetas */
  --ink: #21291F;         /* texto */
  --ink-soft: #5C6552;    /* texto secundario */
  --cover: #2B4636;       /* barras, cabecera */
  --cover-dark: #1D3226;
  --gold: #C89A3E;        /* acento: botón principal, selección */
  --gold-dark: #A67C2B;
  --leaf: #4C7A5D;        /* dinero que entra, vuelto, ganancia */
  --brick: #A24632;       /* deudas, egresos, alertas */

  --font-display: 'Archivo', system-ui, sans-serif;           /* 500–800 */
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;      /* cifras */

  --radius-sm: 8px; --radius-md: 10px; --radius-lg: 12px;
  --tap-min: 44px;        /* cualquier control */
  --tap-sell: 96px;       /* tiles de venta, mínimo */
  --tap-primary: 56px;    /* alto de Cobrar y botones de confirmación */
}
```

Las fuentes deben quedar **incluidas en el paquete** (no desde Google Fonts en tiempo de ejecución), porque la app es offline.

Modo oscuro: los tokens equivalentes están en `design/prototipo-v1/mi-bodega-v1.html`. Por defecto va el modo claro, que se lee mejor al sol.

## Reglas de color con significado

- Dorado = acción principal o selección. Solo hay **un** botón dorado por pantalla.
- Verde = entra dinero. Rojo ladrillo = se debe o sale dinero. Nunca se usa solo el color: siempre va con signo (+/−) o palabra.
- Los tiles sin foto usan degradados de la paleta (6 pares, en `mi-bodega-v1.html` → `TILE_GRADIENTS`) con la inicial grande semitransparente.

## Mockups

| Archivo | Pantalla | Qué observar |
|---|---|---|
| `mockups-v2/V2-Vender.dc.html` | Vender rápido | pestañas de tickets en espera, fila "Siguiente probable", cuadrícula 3×3, multiplicador, barra de cobro |
| `mockups-v2/V2-Cobrar.dc.html` | Cobrar | segmentado de método, billetes rápidos, vuelto grande |
| `mockups-v2/V2-Fiado.dc.html` | Fiado | lista con saldo y límite, nuevo saldo, PinPad con el texto de lo que se firma |
| `mockups-v2/V2-Entrega.dc.html` | Entregar a vendedor | tabla producto/cant./precio pactado, fecha de liquidación, firma de recepción |
| `mockups-v2/V2-Liquidar.dc.html` | Cobrar al vendedor | devuelve con −/+, total a pagar, pago parcial |
| `mockups-v2/V2-Comprobante.dc.html` | Pago firmado | sello, n.º de operación, imprimir y WhatsApp |
| `mockups-v1/*.dc.html` | Inicio, Inventario, Estadísticas, Caja (v1) | referencia de esas secciones, que no se rediseñaron |

Los `.dc.html` son archivos de un lienzo de diseño. Contienen marcado con estilos inline y huecos `{{accent}}` (= `--gold`). Úsalos como referencia de layout, jerarquía y tamaños, y construye componentes propios. Los números que aparecen son de ejemplo.

## Componentes compartidos a construir

`TileButton`, `SuggestionChip`, `MultiplierBar`, `TicketTabs`, `CheckoutBar`, `MoneyText` (siempre mono, con signo opcional), `PinPad`, `PartyRow`, `StampReceipt`, `Sheet` (hoja inferior), `Toast` con acción Deshacer.

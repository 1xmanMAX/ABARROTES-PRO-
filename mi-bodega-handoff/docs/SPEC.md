# Especificación funcional — Mi Bodega v2

## Contexto de uso

- Un puesto de abarrotes **por mayor** (sacos, cajas, bolsas) en un mercado lleno de gente.
- Hay **pocos productos** (entre 15 y 60), que se repiten mucho.
- Un solo operador, el dueño, trabaja de pie con un teléfono Android y a veces con una impresora térmica.
- Muchas veces atiende a 2 o 3 clientes a la vez: uno pide, otro va a traer dinero, otro espera.
- Además vende **al fiado** a clientes de confianza y **entrega mercadería a vendedores** que la revenden y pagan después.
- La señal de internet es mala o no hay.

**Meta principal:** una venta típica de 3 productos se registra y cobra en **5 toques o menos**, sin tener que mirar dos veces la pantalla.

---

## §0. Fases de entrega

| Fase | Contenido | Secciones |
|---|---|---|
| 1 | Base: esquema de BD, inventario, vender (cuadrícula, carrito, multiplicador, deshacer, tickets en espera), cobrar (efectivo/Yape), recibo imprimible, PWA offline | §1, §2, §3, §4 |
| 2 | Predicción ("Siguiente probable") y orden estable de la cuadrícula | §2.3, DATA_MODEL §4 |
| 3 | Clientes y vendedores, código personal, fiado con firma, cobro de deudas con firma, comprobante sellado | §5, §6, §7, §9 |
| 4 | Consignación: entregar a vendedor con firma y liquidar (devoluciones, pago firmado) | §8 |
| 5 | Caja, compras, gastos, retiros, aportes, estadísticas, inicio | §10, §11, §12 |
| 6 (opcional) | Respaldo/exportación, ESC/POS por Bluetooth, sincronización en la nube | §13 |

---

## §1. Navegación general

- Al abrir, la app **arranca en Vender**. Es la pantalla principal.
- Un menú (botón ☰ arriba a la izquierda) da acceso a: Inicio (resumen), Inventario, Clientes y vendedores, Caja, Estadísticas y Ajustes.
- Hay un botón de volver en todas las pantallas secundarias. Vender siempre queda a un toque.
- Sin barra de navegación inferior en Vender, para dar el espacio a la cuadrícula y a la barra de cobro.

## §2. Vender (mockup: `design/mockups-v2/V2-Vender.dc.html`)

### §2.1 Cuadrícula de productos

- Cuadrícula de **3 columnas** con tiles cuadrados de unos 110 px o más.
- Cada tile muestra la imagen del producto (o un degradado con la inicial si no tiene foto), el nombre de la presentación ("Arroz saco 50kg") y el precio.
- **Toque en un tile:** agrega `multiplicador × 1` unidad al ticket activo. La respuesta visual es inmediata: borde de acento, contador en la esquina y una vibración corta (`navigator.vibrate(15)` si existe).
- **Toque largo (500 ms):** abre una hoja para escribir la cantidad exacta o cambiar el precio de esta línea (con motivo "descuento").
- Un producto sin stock disponible se ve atenuado y no responde al toque. Stock disponible = stock − lo que ya está en todos los tickets abiertos.
- El último tile es **"Buscar"**: abre una búsqueda con teclado para los productos que no entran en pantalla.
- Un mismo producto base puede tener varias presentaciones (saco, bolsa, kilo suelto). Cada presentación es un tile distinto.

### §2.2 Orden estable (muy importante)

- El orden de la cuadrícula **no cambia mientras hay algún ticket con productos**. Así el dedo siempre encuentra el producto donde lo dejó.
- El orden se recalcula: (a) al abrir la app, (b) al iniciar el día (primera venta después de medianoche) y (c) cuando el dueño toca "Reordenar" en Ajustes.
- Criterio: unidades vendidas en los últimos 30 días con decaimiento (DATA_MODEL §4.1). Los empates se resuelven por nombre.
- El dueño puede **fijar** tiles en una posición (Inventario → producto → "Fijar en posición N"). Los fijados no se mueven.

### §2.3 Fila "Siguiente probable"

- Es una fila **aparte, encima de la cuadrícula**, con 3 botones grandes ("+ Aceite Primor").
- Con el ticket vacío muestra los 3 productos más probables para esta hora del día.
- Con productos en el ticket muestra los 3 que más suelen comprarse **junto con lo que ya lleva** (DATA_MODEL §4.2). Se recalcula con cada toque, incluso si el último producto fue inusual.
- Excluye lo que ya está en el ticket y lo que no tiene stock.
- Tocar un botón de esta fila hace lo mismo que tocar ese tile.
- El cálculo tarda menos de 16 ms con 60 productos y 50 000 líneas de venta históricas (usa estadísticas precalculadas, no recorre el historial en cada toque).

### §2.4 Multiplicador y deshacer

- Fila con **×1 · ×5 · ×10 · Deshacer**.
- ×5 o ×10 aplica solo al **siguiente** toque y luego vuelve solo a ×1. Si se toca dos veces, queda fijo (candado) hasta tocarlo de nuevo.
- **Deshacer** revierte el último toque del ticket activo (pila de acciones). Funciona varias veces seguidas.

### §2.5 Tickets en espera (varios clientes a la vez)

- Arriba se ven pestañas: "Cliente 1 · S/ 32.40", "Cliente 2", "+".
- "+" abre un ticket nuevo vacío y lo deja activo.
- Se puede renombrar una pestaña con toque largo ("Señora del puesto 14").
- Los tickets en espera se guardan en la BD y sobreviven si se cierra la app o se reinicia el teléfono.
- Máximo 6 tickets abiertos.

### §2.6 Barra de cobro

- Fija abajo: la cantidad de productos, el **total grande** y el botón **Cobrar** (el más grande de la pantalla).
- Tocar el total despliega el detalle del ticket: líneas con −/+, cantidad editable, quitar línea y "Vaciar" (pide confirmación si hay más de 3 líneas).

**Criterios de aceptación §2**
- [ ] 3 productos distintos y cobro exacto en efectivo: 5 toques (3 tiles + Cobrar + Cobrar sin ticket/imprimir).
- [ ] La cuadrícula no cambia de orden durante una venta (test e2e: se leen las posiciones antes y después de 5 toques).
- [ ] Los tickets en espera persisten después de recargar la página.
- [ ] Deshacer revierte con exactitud multiplicadores, líneas nuevas y cantidades.
- [ ] No se puede vender más que el stock disponible sumando todos los tickets abiertos.

## §3. Cobrar (mockup: `V2-Cobrar.dc.html`)

- Se abre como hoja o pantalla con el **total grande**.
- Método de pago segmentado: **Efectivo** (por defecto) · **Yape/Plin** · **Fiado**.
- Efectivo:
  - Botones rápidos: **Exacto**, el billete redondo siguiente (redondea hacia arriba a 10, 50, 100 o 200) y el siguiente a ese, más **Otro monto** (teclado numérico propio, no el del sistema).
  - El vuelto se ve grande en verde. Si falta dinero, se ve "Falta S/ X" en rojo y no deja confirmar.
- Yape/Plin: campo opcional para los últimos 3 dígitos de la operación.
- Fiado: va a §6.
- Botones: **Cobrar e imprimir** (principal) y **Cobrar sin ticket**.
- Al confirmar (en una sola transacción): el ticket queda `paid`, se descuenta el stock, se registra el movimiento de caja, se actualizan las estadísticas de predicción y se vuelve a Vender con el ticket cerrado. Si había otros en espera, queda activo el siguiente.
- Aparece un aviso de 3 s "Venta S/ X registrada — Deshacer". Deshacer anula el ticket (`void`) y repone el stock.

## §4. Recibo e impresión

- Ticket de 58 mm u 80 mm (configurable en Ajustes) con CSS `@media print`. Contiene: nombre del negocio, fecha y hora, n.º de ticket, líneas (nombre × cant. y subtotal), total, método, recibido y vuelto, y un pie configurable.
- La impresión no debe bloquear: el ticket ya está guardado antes de abrir el diálogo.
- Se puede reimprimir cualquier ticket desde el historial.
- Fase 6: impresión directa ESC/POS por Web Bluetooth, sin diálogo.

## §5. Clientes y vendedores

- Una sola entidad **Persona** (`Party`) con tipo `client` o `seller` (puede ser ambos).
- Lista con buscador que muestra nombre, tipo, **saldo que debe** y mercadería en su poder (solo vendedores).
- Ficha de la persona: datos (nombre, teléfono, límite de crédito, precio especial por producto para vendedores), saldo, historial cronológico (ventas al fiado, entregas, devoluciones, pagos) y botones **Cobrar deuda**, **Entregar mercadería** (vendedor) y **Cambiar código**.
- **Crear persona:** nombre obligatorio y teléfono opcional. Luego **la persona crea su código** (§9.1). Sin código no puede recibir fiado ni mercadería.

## §6. Venta al fiado (mockup: `V2-Fiado.dc.html`)

1. En Cobrar se elige **Fiado**.
2. Se elige la persona (buscador y lista ordenada por uso reciente). Se muestra su saldo actual, su límite y el **nuevo saldo**.
3. Si el nuevo saldo supera el límite: aviso en rojo. El dueño puede autorizarlo con **su propio código de dueño**.
4. **La persona escribe su código** en el teclado PIN (§9.2) para aceptar la deuda.
5. Al validar, en una sola transacción: ticket `credit`, descuento de stock, cargo en el libro de la persona, registro de firma, estadísticas y recibo con "FIADO — firmado por X".
- El fiado **no entra a Caja**. Solo entra cuando se cobra (§7).

## §7. Cobrar una deuda

- Desde la ficha de la persona o desde Inicio → "Por cobrar".
- Se ve el saldo total. Monto a pagar: botón **Todo** o monto parcial. Método: efectivo o Yape.
- **La persona firma con su código.**
- Al validar: abono en el libro de la persona, movimiento de caja de tipo cobro de deuda, firma y **comprobante sellado** (§9.4).
- Un pago mayor que el saldo no se permite.

## §8. Consignación: entregar y liquidar

### §8.1 Entregar a vendedor (mockup: `V2-Entrega.dc.html`)
- Se elige al vendedor y se agregan productos con la misma cuadrícula de Vender (se puede reutilizar el componente) o con un buscador.
- Para cada línea: cantidad y **precio pactado** (por defecto el precio especial del vendedor para ese producto, si no el precio de venta).
- Fecha prevista de liquidación (por defecto: dentro de 3 días).
- **El vendedor firma con su código** que recibió la mercadería.
- Al validar: entrega `open`, el stock sale del inventario como "en consignación" (movimiento de stock propio, no venta) y se genera el comprobante de entrega.
- En este momento **no** se genera deuda: la deuda nace al liquidar, por lo vendido.

### §8.2 Liquidar (mockup: `V2-Liquidar.dc.html`)
- Se abre desde la entrega o desde la ficha del vendedor. Si hay varias entregas abiertas, se liquidan juntas o de a una.
- Por línea: entregado (fijo), **devuelve** (−/+) y vendido (= entregado − devuelto) × precio pactado = a pagar.
- Resumen: vendido esta vez + deuda anterior = **total a pagar**.
- Monto que paga ahora (Todo o parcial). La diferencia queda como deuda.
- **El vendedor firma con su código.**
- Al validar, en una sola transacción: lo devuelto vuelve al stock, se registran las ventas por lo vendido (cuentan en estadísticas y ganancia, con el precio pactado), se carga lo vendido a su libro, se abona el pago, se registra el movimiento de caja por lo pagado, la entrega pasa a `settled` y se emite el comprobante sellado.
- Una devolución no puede superar lo entregado.

## §9. Código personal (firma)

### §9.1 Crear código
- Se entrega el teléfono a la persona. Ella escribe un código de **4 dígitos** dos veces, en el teclado PIN.
- Se rechazan códigos triviales: 0000, 1111…, 1234, 4321 y su año de nacimiento si lo dieron.
- Se guarda **solo el hash** (DATA_MODEL §5). La pantalla nunca muestra los dígitos, solo puntos.

### §9.2 Teclado PIN (componente `PinPad`)
- Teclado propio de 3×4 (1–9, Borrar, 0, Firmar), con teclas de 48 px o más y 4 puntos de progreso.
- Arriba se ve **qué se está firmando**: "Rosa acepta deber S/ 478.00" o "Juan recibe mercadería por S/ 2,773.00" o "Juan paga S/ 2,000.00".
- Código incorrecto: vibración, puntos en rojo y "Código incorrecto (quedan N intentos)".
- **3 fallos seguidos:** bloqueo de 5 minutos para esa persona. Después de 6 fallos en 24 h, solo el dueño puede desbloquear (con su código de dueño).

### §9.3 Olvido de código
- Solo en persona: el dueño escribe **su código de dueño** y luego la persona crea uno nuevo. Queda registrado en el historial ("Código cambiado").

### §9.4 Comprobante sellado (mockup: `V2-Comprobante.dc.html`)
- Contiene: fecha y hora, persona, concepto, monto, saldo anterior y nuevo, sello visual **PAGADO / FIADO / RECIBIDO** y **n.º de operación** único (DATA_MODEL §5.3).
- Acciones: **Imprimir** y **Enviar por WhatsApp** (`https://wa.me/<tel>?text=...` con el resumen y el n.º de operación).
- Aclaración para el usuario (en Ajustes → Ayuda): el código prueba que la persona aprobó la operación en tu teléfono. No es una firma legal formal. El envío por WhatsApp deja una copia en el teléfono de la otra persona.

### §9.5 Código de dueño
- Se crea en el primer arranque. Se exige para: autorizar un fiado por encima del límite, anular ventas de días anteriores, desbloquear o restablecer códigos, cambiar precios de costo en masa y exportar datos.

## §10. Inventario

- Lista con buscador. Cada producto tiene: nombre, presentación (saco, caja, bolsa, unidad, kg), foto opcional (cámara o galería, comprimida a unos 200 KB), categoría, precio de venta, costo, precio para vendedores (opcional), stock, stock mínimo, "permite fracciones" y posición fijada (opcional).
- Se muestra el margen al editar.
- **Ajuste de stock** con motivo (conteo, merma, regalo). Queda como movimiento, no como edición directa.
- Stock en consignación visible: "12 en tienda · 8 con vendedores".

## §11. Caja, compras y movimientos

- **Compra (reposición):** proveedor, líneas (producto, cantidad, costo unitario) y "actualizar costo del producto" (sí por defecto). Suma al stock y resta de la caja.
- **Gasto, retiro y aporte (reinversión):** monto y nota.
- **Saldo de caja** = saldo inicial + ventas en efectivo + cobros de deuda en efectivo + aportes − compras − gastos − retiros. Yape se muestra aparte ("Digital").
- **Cierre del día:** el dueño cuenta el efectivo, la app muestra la diferencia con lo esperado y se guarda el cierre.
- Lista de movimientos filtrable por tipo y rango.

## §12. Inicio y estadísticas

- **Inicio:** ventas de hoy, ganancia de hoy, efectivo esperado en caja, **por cobrar** (fiado + deudas de vendedores), **mercadería en consignación**, stock bajo y entregas vencidas.
- **Estadísticas** (7 días, 30 días, todo): ventas, ganancia, ticket promedio, productos estrella, ventas por hora del día, pares que más se compran juntos (útil para ver la predicción), deudores principales y rendimiento por vendedor (vendido y devuelto).

## §13. Fase 6 (opcional)

- **Respaldo:** exportar e importar un JSON cifrado con el código de dueño, más un recordatorio semanal.
- **Impresión ESC/POS** por Web Bluetooth.
- **Sincronización** en la nube (por ejemplo Supabase) para usar dos dispositivos, con resolución de conflictos por evento (el diseño basado en movimientos lo facilita).

## §14. Requisitos no funcionales

- Funciona 100 % offline una vez instalada.
- Arranque en frío menor a 1.5 s en un Android de gama media. El toque en un tile responde en menos de 50 ms.
- Tolerante a cierres: una venta confirmada nunca se pierde, y un ticket abierto se recupera.
- Pide almacenamiento persistente al instalar (`navigator.storage.persist()`).
- Soporta modo claro y oscuro. En el mercado conviene el **modo claro de alto contraste** por defecto (sol directo).

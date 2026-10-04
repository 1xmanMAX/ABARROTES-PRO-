# Estudio: cobro rápido, confiable y fácil de usar en Mi Bodega

Mi Bodega es la app de punto de venta de un puesto de abarrotes por mayor. Este estudio busca cómo hacerla más rápida, con menos errores y fácil de usar para todos los que atienden:

- **el dueño**, en un teléfono Android y casi siempre con apuro;
- **familiares mayores** que ven poco;
- **niños** de 8 a 14 años que a veces atienden;
- todos ellos **a pleno sol** en el mercado.

Fecha: 2026-10-03. Al final de cada sección dice qué se hizo en la app.

> **Nota sobre el método.** Los fabricantes de puntos de venta casi no publican cifras de "toques por venta". Las cifras de contraste las calculé con las fórmulas de WCAG 2.x y de APCA 0.0.98G; conviene comprobarlas con una herramienta externa. APCA todavía no es una norma: es el candidato de WCAG 3. Por eso la referencia obligatoria es WCAG 2.2. Las cifras del artículo de Jin et al. (2007) salen del resumen, porque el texto completo es de pago.

---

## 1. Cómo hacen rápida la venta los puntos de venta líderes

| Técnica | Quién la usa | Mi Bodega |
|---|---|---|
| Cuadrícula de productos frecuentes con foto | Shopify POS (Smart Grid), Loyverse (Favoritos), SumUp, Kyte | Ya la tenía, ordenada por popularidad y con "Siguiente probable" |
| Botones de efectivo rápido según el total | Toast, Fiscal POS ("Fast Cash"), Square | Ya los tenía: Exacto y billetes sugeridos. **Nuevo:** contar los billetes tocándolos |
| Varios clientes en espera | Loyverse (tickets abiertos) | Ya los tenía (pestañas) |
| Escáner de códigos de barras | Casi todos | No se hizo. En la venta por mayor los sacos casi nunca llevan código. Queda posible con `BarcodeDetector` en Chrome Android |
| Pantalla para el cliente | Loyverse CDS | Parcial: la pantalla de vuelto se puede mostrar al cliente |
| Redondeo del efectivo | Square, Toast | No hace falta: los precios por mayor son redondos |

**Riesgo detectado:** si los tiles cambian de lugar, quien atiende pierde la memoria de dónde está cada producto. Mi Bodega ya lo evita: el orden no cambia mientras hay un ticket con productos y se recalcula solo al empezar el día.

Fuentes:
- [Shopify Smart Grid](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/smart-grid-management)
- [Loyverse Favoritos](https://help.loyverse.com/help/favorites-on-smartphones)
- [Toast: pagos en efectivo](https://support.toasttab.com/en/article/Cash-Payments-Configuration)
- [Fiscal POS: Fast Cash](https://fiscal.screenstepslive.com/s/help/m/POS/l/59450-how-do-i-use-the-quick-cash-buttons)
- [Square: medios de pago](https://squareup.com/help/us/en/article/5177-accept-cash-checks-and-other-tender)
- [Loyverse: tickets abiertos](https://help.loyverse.com/help/open-tickets)
- [Chrome: Shape Detection API](https://developer.chrome.com/docs/capabilities/shape-detection)
- [Kyte](https://www.kyteapp.com/)

## 2. Confiabilidad: errores al cobrar y cómo evitarlos

- **Cobro doble.** El estándar de la industria es la idempotencia: cada operación tiene un ID único y repetirla no tiene efecto ([DZone](https://dzone.com/articles/art-of-idempotency-preventing-double-charges-and-duplicate)). En Mi Bodega el ID es el del ticket: dentro de la transacción de cobro, el ticket deja de estar "abierto", así que un segundo cobro falla. **Se agregó un test** con dos cobros simultáneos: el resultado es una sola venta, un solo movimiento de caja y un solo descuento de stock.
- **Confirmar o deshacer.** Según NN/g, las confirmaciones solo valen para acciones graves. Si aparecen siempre, se aceptan sin leer. Para el resto es mejor ofrecer deshacer ([NN/g, diálogos de confirmación](https://www.nngroup.com/articles/confirmation-dialog/)). La app mantiene "Deshacer" después de cobrar, ahora por 6 segundos, y pone "Deshacer esta venta" **lejos** del botón principal ([NN/g, opciones graves juntas](https://www.nngroup.com/articles/proximity-consequential-options/)).
- **El vuelto** es el error más común con apuro. También es la base de la estafa del "cambio rápido" ([Truthfully](https://truthfully.com/article/5-ways-to-protect-yourself-from-quick-change-scam)). Las recomendaciones son mostrar en grande cuánto se recibió y cuánto hay que devolver, mantenerlo en pantalla hasta terminar y guardar en la venta el monto recibido. **Se hizo:** una pantalla grande "Da de vuelto S/ X" que muestra qué billetes y monedas entregar y se queda hasta tocar "Listo". El monto recibido ya se guardaba.
- **Yape o Plin falsos.** En Perú hay estafas activas contra bodegas con apps clonadas o capturas editadas ([Infobae 2025](https://www.infobae.com/peru/2025/06/18/siguen-las-estafas-con-yape-falso-estas-son-las-cuatro-maneras-de-prevenirlas/)). **Se hizo:** al cobrar con Yape aparece un aviso que dice "Mira TU celular… No aceptes capturas", y el botón dice **"Sí llegó · Cobrar"**. Así no se agrega ningún toque.

## 3. Niños de 8 a 14 años

- Desde los 9 años los niños ya hacen las interacciones de un adulto, pero **se equivocan más al tocar** y necesitan **retroalimentación exagerada y evidente** ([NN/g, desarrollo físico](https://www.nngroup.com/articles/children-ux-physical-development/), [NN/g, cognición](https://www.nngroup.com/articles/kids-cognition/); Anthony et al., 2012 y 2013).
- También escriben con errores de ortografía. Por eso la búsqueda debe tolerarlos.
- Loyverse resuelve el acceso con permisos por rol: lo restringido pide el PIN de un administrador ([Loyverse, permisos](https://help.loyverse.com/help/how-manage-access-rights-employees)).

**Se hizo:**
- **Modo ayudante.** Solo se vende, en efectivo o Yape. No se pueden cambiar precios, no hay rebajas ni fiado y el menú queda cerrado. Para salir se pide el código de dueño. Las ventas del ayudante quedan marcadas.
- **Vuelto dibujado** en billetes y monedas del sol, con los colores aproximados de cada denominación:
  - billetes de 10, 20, 50, 100 y 200;
  - monedas de 0.10, 0.20, 0.50, 1, 2 y 5. Las de 1 y 5 céntimos ya no circulan.

  Se usa el método codicioso, que con las denominaciones del sol siempre da la menor cantidad de piezas.
- **Contar billetes tocándolos** (200 + 100…): así no hay que sumar de memoria.
- **Retroalimentación:** el número del tile "salta" con cada toque, y la vibración es distinta al agregar, al cobrar y ante un error.
- **Búsqueda tolerante:** "arros" encuentra arroz y "asucar" encuentra azúcar.
- **Ícono y palabra** en el menú.

## 4. Baja visión

- **Tamaño de letra.** La velocidad de lectura cae en picada por debajo del "tamaño crítico de impresión", que es más alto en las personas con baja visión (Legge y Bigelow, 2011, *Journal of Vision* 11(5):8). En casi 20 años de pruebas de NN/g con personas de 65 años o más, el texto pequeño y el bajo contraste aparecieron como problema en **todas** las rondas ([Kane, 2019](https://www.nngroup.com/articles/usability-for-senior-citizens/)).
- **Tipografía.** Atkinson Hyperlegible (Braille Institute, 2019; *Next* de 2025) se diseñó con personas con baja visión. Distingue bien 1/l/I, 0/O y 8/B.
- **Texto sobre fotos: era el problema más serio de la app.** Este fue el contraste del texto blanco según el fondo que tenía debajo:

  | Fondo bajo el texto | Contraste |
  |---|---|
  | Zona oscura del degradado | 10.4:1 |
  | Zona media | 3.95:1 |
  | Foto clara (arroz, azúcar, harina) | **1.4:1** |

  Los productos de empaque claro son justo los más vendidos. La regla 1.4.3 de WCAG falla con fondos variables.
- **Pleno sol.** El reflejo baja el contraste efectivo de la pantalla a menos de la mitad (DisplayMate). Por eso conviene apuntar a AAA (7:1) en todo el texto, no solo en el pequeño.

**Se hizo:**
- **Letra:** Atkinson Hyperlegible Next y Mono, incluidas en la app para que funcionen sin internet.
- **Tamaños:** todo el texto está en `rem`, así que respeta la letra del sistema, y ninguno baja de 14 px. En Ajustes se elige Normal, Grande o Muy grande. Con Muy grande la cuadrícula pasa a 2 columnas para que el nombre entre completo.
- **Tiles:** franja de color arriba y nombre y precio sobre fondo liso. El precio siempre entra en una línea. Si no hay stock, dice **"Agotado"** en vez de apagarse, porque un tile apagado no se lee.
- **Modo Sol:** blanco y negro puros con bordes de 3 px. Se activa también si el teléfono tiene "aumentar contraste".
- **Voz opcional:** lee el total y el vuelto ("Vuelto: 25 soles. Da un billete de 20 soles y una moneda de 5 soles"). Los montos se dicen en palabras para que el motor no lea mal "S/ 63.70". Nunca lee códigos de clientes.

## 5. Color

Cerca del 8 % de los hombres tiene alguna deficiencia rojo-verde (Wong, 2011, *Nature Methods*). La pareja "verde = entra, rojo = sale" es justo la que se confunde. Okabe e Ito (2008) recomiendan **azul frente a naranja**. Además, la regla 1.4.1 de WCAG prohíbe que el color sea el único medio para dar información.

### Paleta nueva (tema claro)

| Token | Valor | Contraste | Uso |
|---|---|---|---|
| Texto | #14110C sobre #FBF7EE | 17.6:1 | Todo el texto principal |
| Texto secundario | #3D372C | 11.0:1 | Etiquetas y ayudas |
| Cabecera | #1E3A2B con texto blanco | 12.4:1 | Barra superior y de cobro |
| Botón principal | #E0B04A con texto #14110C | 9.4:1 | Antes, el blanco sobre dorado daba **2.6:1** |
| Entra dinero | #0B4F8A | 7.9:1 | Cobros, aportes |
| Sale dinero / fiado / rebaja | #8A3B00 | 7.3:1 | Fiado, gastos, retiros, descuentos |
| Éxito / vuelto | #00573F | 8.1:1 | Venta registrada, vuelto |
| Error / anular | #9E1B1B | 7.5:1 | Errores, anulaciones |
| Bordes de controles | #5C5446 | 7:1 | La regla 1.4.11 pide 3:1 |

El tema oscuro sigue el mismo criterio, con todos los textos a 7:1 o más (`app/src/styles/tokens.css`). Lo elegido no se marca solo con color: lleva un marco grueso y la cantidad, el "Agotado" va escrito y el "Falta" lleva ⚠.

## 6. Objetivos táctiles

| Fuente | Tamaño mínimo |
|---|---|
| Jin, Plocher y Kiff (2007), personas mayores | ~19 mm, con separación de 3–13 mm |
| Parhi et al. (2006), adultos con el pulgar | ~9.6 mm |
| Apple | 44 pt |
| Material Design | 48 dp |
| WCAG 2.5.5 (AAA) | 44 px |

**Se hizo:**
- mínimo general de 48 px;
- botones principales de 64–72 px;
- tiles de venta de 96 px o más (unos 114 px en un teléfono), con 10 px de separación;
- la pulsación larga del tile tiene alternativa visible: el detalle del ticket, con sus botones.

## 7. Qué falta probar en el teléfono real

1. **Voz:** con el modo avión, comprobar que habla o, si no tiene voz en español, que la app sigue igual.
2. **Un niño cobrando:** que cobre S/ 37 con un billete de S/ 50 sin ayuda. Medir el tiempo y los errores.
3. **Una persona mayor:** que haga una venta con letra "Grande" y modo Sol, y preguntarle qué no pudo leer.
4. **A pleno sol:** comparar los modos Normal y Sol.

## Referencias principales

- Anthony, L., et al. (2012). *Interaction and recognition challenges in interpreting children's touch and gesture input on mobile devices.* ACM ITS.
- Anthony, L., et al. (2013). *Examining the need for visual feedback during gesture interaction on mobile touchscreen devices for kids.* ACM IDC. https://dl.acm.org/doi/10.1145/2485760.2485775
- Braille Institute (2019/2025). *Atkinson Hyperlegible / Next.* https://www.brailleinstitute.org/freefont/
- Harley, A. (2019). *Touch Targets on Touchscreens.* NN/g. https://www.nngroup.com/articles/touch-target-size/
- Jin, Z. X., Plocher, T., y Kiff, L. (2007). *Touch Screen User Interfaces for Older Adults: Button Size and Spacing.* UAHCI, LNCS 4554. https://link.springer.com/chapter/10.1007/978-3-540-73279-2_104
- Kane, L. (2019). *Usability for Older Adults.* NN/g. https://www.nngroup.com/articles/usability-for-senior-citizens/
- Legge, G. E., y Bigelow, C. A. (2011). *Does print size matter for reading?* Journal of Vision 11(5):8. https://doi.org/10.1167/11.5.8
- Okabe, M., e Ito, K. (2008). *Color Universal Design.* https://jfly.uni-koeln.de/color/
- Parhi, P., Karlson, A., y Bederson, B. (2006). *Target size study for one-handed thumb use on small touchscreen devices.* MobileHCI. https://doi.org/10.1145/1152215.1152260
- Sesto, M. E., et al. (2012). *Effect of Touch Screen Button Size and Spacing…* Human Factors 54(3).
- W3C (2023). *WCAG 2.2.* https://www.w3.org/TR/WCAG22/
- W3C (2021). *Making Content Usable for People with Cognitive and Learning Disabilities.* https://www.w3.org/TR/coga-usable/
- Wong, B. (2011). *Color blindness.* Nature Methods 8, 441. https://doi.org/10.1038/nmeth.1618
- BCRP: billetes y monedas en circulación. https://www.bcrp.gob.pe

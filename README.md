<p align="center">
  <img src="docs/presentacion/portada.png" alt="Mi Bodega: punto de venta para abarrotes por mayor" width="100%">
</p>

<p align="center">
  <a href="https://github.com/1xmanMAX/ABARROTES-PRO-/releases/download/apk-latest/mi-bodega.apk"><img src="https://img.shields.io/badge/Descargar-APK%20Android-2e7d32?style=for-the-badge&logo=android&logoColor=white" alt="Descargar APK Android"></a>
  <a href="https://1xmanmax.github.io/ABARROTES-PRO-/"><img src="https://img.shields.io/badge/Abrir-Versi%C3%B3n%20web%20(PC)-1e3a2b?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Abrir versión web"></a>
  <a href="#9-para-programadores"><img src="https://img.shields.io/badge/Para-programadores-e0b04a?style=for-the-badge&logo=react&logoColor=14281d" alt="Para programadores"></a>
</p>

<p align="center">
  <a href="https://github.com/1xmanMAX/ABARROTES-PRO-/actions/workflows/android-apk.yml"><img src="https://github.com/1xmanMAX/ABARROTES-PRO-/actions/workflows/android-apk.yml/badge.svg" alt="Compilación del APK"></a>
  <img src="https://img.shields.io/badge/funciona-sin%20internet-1e3a2b" alt="Funciona sin internet">
  <img src="https://img.shields.io/badge/contraste-WCAG%20AAA-0b4f8a" alt="Contraste WCAG AAA">
  <img src="https://img.shields.io/badge/tests-117%20%2B%2020%20flujos-00573f" alt="Tests">
  <img src="https://img.shields.io/badge/idioma-espa%C3%B1ol%20(Per%C3%BA)-8a3b00" alt="Español de Perú">
</p>

<h3 align="center">Vende en 5 toques · cobra sin errores · fía con firma · sabe si tu negocio gana</h3>

**Mi Bodega** es un punto de venta hecho para un **puesto de abarrotes por mayor** en el mercado. Corre en el teléfono Android del dueño y en la PC, **funciona sin internet** y está pensado para que lo pueda usar cualquiera de la familia: el dueño con apuro, un familiar que ve poco o un hijo que ayuda a atender.

---

## En pocas palabras

| | |
|---|---|
| 🏪 **Para quién** | Un puesto de abarrotes por mayor: el dueño, su familia y sus ayudantes |
| 📱 **Dónde corre** | Celular Android (APK) y PC con Windows o cualquier navegador |
| ⚡ **Venta típica** | **5 toques**: tres productos, Cobrar y Cobrar sin ticket |
| 📶 **Internet** | **No hace falta**: todo funciona sin señal |
| 🔄 **Varios aparatos** | Un **grupo** de celulares y PC que se sincronizan entre ellos por el Wi-Fi, sin servidor |
| 👀 **Accesible** | Contraste AAA, letra grande, modo Sol, voz y modo ayudante para niños |
| ✅ **Calidad** | 120 tests de lógica y base de datos, 21 flujos completos en el navegador y 8 tests de Rust |

---

## Contenido

| | | |
|---|---|---|
| 🌟 [Por qué Mi Bodega](#1-por-qué-mi-bodega) | 🛒 [Así se hace una venta](#2-así-se-hace-una-venta) | 📲 [Instalar](#3-instalar) |
| 🚀 [Primer día](#4-primer-día-paso-a-paso) | 📱 [Todas las funciones](#5-todas-las-funciones) | 🔄 [Todos tus aparatos en un grupo](#6-todos-tus-aparatos-en-un-grupo) |
| 👀 [Fácil de ver y de usar](#7-fácil-de-ver-y-de-usar) | 📈 [Ganancias y análisis](#8-ganancias-y-análisis-económico) | 🔒 [Seguridad](#9-seguridad-del-dinero-y-de-los-datos) |
| 🧠 [Cómo funciona por dentro](#10-cómo-funciona-por-dentro) | 🛣️ [Cómo mejorarla](#11-cómo-mejorarla-hoja-de-ruta) | 💻 [Para programadores](#12-para-programadores) |

---

## 1. Por qué Mi Bodega

<table>
<tr>
<td width="33%" valign="top">

### ⚡ Rápida
Una venta de 3 productos en **5 toques**. La app **adivina lo que el cliente lleva** con lo que ya pidió, y los productos más vendidos quedan siempre a la mano.

</td>
<td width="33%" valign="top">

### ✅ Sin errores
El **vuelto sale dibujado** en billetes y monedas. No deja cobrar si falta plata, **tocar dos veces no cobra dos veces** y avisa de los **Yape falsos**.

</td>
<td width="33%" valign="top">

### 📶 Sin internet
Todo funciona **sin señal**. Tus celulares y tu PC forman un **grupo** y se sincronizan entre ellos **por el Wi-Fi**, sin nube. La copia de seguridad va **cifrada**.

</td>
</tr>
<tr>
<td valign="top">

### ✍️ Fiado con firma
Cada cliente **firma con su código** en tu teléfono y recibe un **comprobante sellado** por WhatsApp. Se acabaron las peleas por el cuaderno.

</td>
<td valign="top">

### 👨‍👩‍👧 Para toda la familia
**Modo ayudante** para los hijos (solo vender), **letra grande**, **modo Sol** para leer al aire libre y **voz** que dice el total y el vuelto.

</td>
<td valign="top">

### 📊 Sabes si ganas
Ganancia del día después de gastos, **qué producto gana y cuál pierde**, punto de equilibrio, Pareto, BCG y GMROI, explicados en palabras simples.

</td>
</tr>
</table>

---

## 2. Así se hace una venta

<p align="center"><img src="docs/presentacion/recorrido.png" alt="Recorrido de una venta: tocar productos, cobrar, dar el vuelto, fiar y ver la ganancia" width="100%"></p>

> **Venta típica:** Arroz → Aceite → Azúcar → **Cobrar** → **Cobrar sin ticket**. Son **5 toques** y ya está registrada, con el stock descontado y la caja al día.

### Qué pasa por dentro al cobrar

```mermaid
flowchart LR
    A([🛒 Tocas los productos]) --> B[Ticket del cliente<br/>hasta 6 clientes a la vez]
    B --> C{Cobrar}
    C -->|💵 Efectivo| D[Tocas los billetes que te da<br/>y ves el vuelto dibujado]
    C -->|📱 Yape / Plin| E[Confirmas que llegó el aviso<br/>a TU celular]
    C -->|📒 Fiado| F[El cliente firma<br/>con su código]
    D --> G[(Venta registrada<br/>todo junto o nada)]
    E --> G
    F --> G
    G --> H[📦 Baja el stock]
    G --> I[💰 Sube la caja]
    G --> J[📈 Ganancia del día]
    G --> K[🔄 Llega a los otros aparatos]
```

Todo lo de la derecha ocurre **en una sola operación**. Si algo falla, no se guarda nada a medias, y tocar dos veces "Cobrar" no cobra dos veces.

---

## 3. Instalar

<table>
<tr>
<td width="50%" valign="top">

### 📱 En el teléfono Android (recomendado)

1. En el teléfono, abre en Chrome:<br>
   **[⬇️ Descargar mi-bodega.apk](https://github.com/1xmanMAX/ABARROTES-PRO-/releases/download/apk-latest/mi-bodega.apk)**
2. Abre el archivo y toca **Instalar**. Si Android lo pide, permite *"instalar apps de esta fuente"*.
3. Listo: aparece **Mi Bodega** en tus aplicaciones.

✅ Las versiones nuevas van en **el mismo link** y se instalan **encima sin borrar tus datos**.<br>
⚠️ No desinstales la app: desinstalar sí borra todo.

</td>
<td width="50%" valign="top">

### 💻 En la PC

**Como programa de Windows (recomendado):**
```powershell
powershell -ExecutionPolicy Bypass -File pc\instalar-windows.ps1
```
Crea el acceso directo **Mi Bodega** en el escritorio. Se abre en una ventana de **Comet** (o Edge o Chrome) y casi no consume memoria. Los datos quedan en `%LOCALAPPDATA%\MiBodega\datos`.

**O en el navegador:** abre **[1xmanmax.github.io/ABARROTES-PRO-](https://1xmanmax.github.io/ABARROTES-PRO-/)** y toca **Instalar** (⊕) en la barra de direcciones.

</td>
</tr>
</table>

<p align="center"><img src="docs/capturas/20-pc.png" width="85%" alt="Versión de PC: cuadrícula grande y ticket a la derecha"></p>

<p align="center"><i>En la PC el ticket queda siempre a la derecha. Escribe el nombre del producto y pulsa <b>Enter</b> para venderlo (por ejemplo: <code>arr</code> + Enter suma un arroz).</i></p>

<details>
<summary><b>Diferencias entre Android y PC</b></summary>

| Función | Android (APK) | PC / navegador |
|---|---|---|
| Vender, cobrar, fiado, entregas, caja, rentabilidad | ✅ | ✅ |
| Sin internet | ✅ | ✅ (después de abrirla una vez) |
| Imprimir recibos y comprobantes | ✅ (sistema de impresión de Android) | ✅ (impresora de la PC) |
| Copia de seguridad | ✅ Se comparte por WhatsApp o Drive | ✅ Se descarga el archivo |
| Foto de producto | ✅ Cámara o galería | ✅ Archivo o cámara web |
| Comprobante por WhatsApp | ✅ | ✅ WhatsApp Web |
| Leer en voz alta | ✅ Voz del teléfono | ✅ Voz del navegador |
| Escribir con el teclado | — | ✅ |
| Vibración al tocar | ✅ | — |

</details>

---

## 4. Primer día, paso a paso

| Paso | Qué hacer | Dónde |
|:---:|---|---|
| 1️⃣ | Crea tu **código de dueño** (4 dígitos que solo tú sabes). | Al abrir por primera vez |
| 2️⃣ | Carga tus productos con **precio de venta y costo**. Sin el costo, la ganancia no es real. | Menú → Inventario |
| 3️⃣ | Anota tus **gastos fijos del mes** (alquiler del puesto, luz, ayudante). | Menú → Ajustes |
| 4️⃣ | Registra el **saldo inicial** de la caja (el sencillo). | Menú → Caja |
| 5️⃣ | Registra a tus **clientes de fiado y vendedores**. Cada uno crea su propio código. | Menú → Clientes y vendedores |
| 6️⃣ | **¡A vender!** | Pantalla principal |
| 7️⃣ | Al cerrar, haz el **cierre del día** (cuentas el efectivo). | Menú → Caja |
| 8️⃣ | Una vez por semana, haz la **copia de seguridad**. | Menú → Copia de seguridad |

> 💡 **¿Solo quieres probar?** En **Ajustes** toca **"Cargar datos de ejemplo"**. Carga 10 productos, 30 días de ventas y dos personas: Rosa (cliente) y Juan (vendedor). El código de los dos es **2580**.

---

## 5. Todas las funciones

### 🛒 Vender

<table>
<tr>
<td width="300"><img src="docs/capturas/01-vender.png" width="280" alt="Pantalla Vender"></td>
<td valign="top">

- **Toca un producto** y se suma al ticket. El número grande de la esquina dice cuántos lleva.
- **×5 / ×10** multiplica el **siguiente** toque. Con dos toques queda fijo 🔒.
- **Deshacer** revierte el último toque, las veces que haga falta.
- **Mantén presionado** un producto para escribir la cantidad exacta o un precio especial.
- **Siguiente probable:** 3 botones con lo que el cliente suele llevar junto con lo que ya pidió.
- **Pestañas arriba:** atiende hasta a **6 clientes a la vez**. Mantén presionada una pestaña para ponerle nombre ("Señora del puesto 14").
- **La cuadrícula no se mueve mientras atiendes.** Se ordena sola por lo más vendido al empezar el día.
- No deja vender más de lo que hay en stock, sumando todos los tickets abiertos. Si un producto se acaba, dice **Agotado**.
- **Buscar** entiende errores de escritura: "arros" encuentra arroz.

</td>
</tr>
</table>

### 💵 Cobrar

<table>
<tr>
<td width="300"><img src="docs/capturas/21-contar-billetes.png" width="280" alt="Cobrar contando billetes"></td>
<td valign="top">

- **Lista grande de lo que lleva**, para leérsela al cliente y no cobrar de menos.
- **Rebaja por regateo:** de −S/ 1 a −S/ 5 en un toque, solo para los productos que la admiten.
- **Efectivo:**
  - **Exacto**, billetes sugeridos (S/ 300, 400…) u **Otro monto**;
  - o **toca los billetes que te da el cliente** (200 + 100) y la app los suma.
- **El vuelto sale en grande y dibujado en billetes y monedas.** Si falta plata dice **"Falta S/ X"** y no deja cobrar.
- **Yape / Plin:** te recuerda **mirar el aviso en TU celular**, porque las capturas falsas son una estafa frecuente. El botón dice **"Sí llegó · Cobrar"**.
- **Fiado:** ver más abajo.
- Tocar dos veces "Cobrar" **no cobra dos veces**.

</td>
</tr>
</table>

### 🪙 Dar el vuelto

<table>
<tr>
<td width="300"><img src="docs/capturas/22-vuelto.png" width="280" alt="Pantalla de vuelto"></td>
<td valign="top">

Cuando hay vuelto, aparece esta pantalla y **se queda hasta tocar "Listo"**. Así nadie se olvida del vuelto con el apuro:

- lo **cobrado** y lo **recibido**;
- **"Da de vuelto S/ 7.00"** en letras enormes;
- **qué billetes y monedas entregar**, de mayor a menor (aquí: una moneda de S/ 5 y una de S/ 2);
- **"Deshacer esta venta"**, lejos del botón principal para no tocarlo por error.

Sin vuelto (pago exacto o Yape), sale un aviso de 6 segundos con **Deshacer**.

</td>
</tr>
</table>

### ✍️ Fiado con firma

<p align="center">
  <img src="docs/capturas/03-fiado.png" width="30%" alt="Elegir a quién se fía">
  <img src="docs/capturas/04-firma.png" width="30%" alt="El cliente firma con su código">
  <img src="docs/capturas/05-comprobante.png" width="30%" alt="Comprobante sellado">
</p>

1. En Cobrar eliges **Fiado** y a la persona. Ves su deuda, su límite y el **nuevo saldo**.
2. **La persona escribe su código** en tu teléfono. Si el código no es correcto, no se guarda nada.
3. Si pasa su límite, **tú autorizas** con tu código de dueño.
4. Sale un **comprobante sellado** (FIADO / PAGADO / RECIBIDO) con número de operación, para **imprimir** o **enviar por WhatsApp**.

Para **cobrar una deuda**: Clientes y vendedores → la persona → **Cobrar deuda** (todo o una parte). La persona firma con su código.

### 👥 Clientes y vendedores (consignación)

<p align="center">
  <img src="docs/capturas/08-clientes.png" width="30%" alt="Clientes y vendedores">
  <img src="docs/capturas/09-entregar.png" width="30%" alt="Entregar mercadería">
  <img src="docs/capturas/10-liquidar.png" width="30%" alt="Liquidar">
</p>

- **Lista** con lo que debe cada uno y la mercadería que tiene cada vendedor.
- **Entregar mercadería a un vendedor:** productos, cantidades, **precio pactado** (la app recuerda el último) y fecha de liquidación. El vendedor firma que la recibió.
- **Liquidar:** por producto marcas cuánto **devuelve**; lo demás cuenta como **vendido**. Total a pagar = lo vendido + la deuda anterior. Puede pagar todo, una parte o nada, y firma.
- Las entregas vencidas se marcan en rojo en la ficha y en Inicio.

### 📦 Inventario

<p align="center">
  <img src="docs/capturas/06-inventario.png" width="30%" alt="Inventario">
  <img src="docs/capturas/07-producto.png" width="30%" alt="Ficha de producto">
</p>

- Cada producto lleva:
  - nombre y foto (opcional);
  - precio de venta, **costo** y precio para vendedores;
  - stock mínimo;
  - si se vende por kilo y si **admite rebaja**;
  - una posición fija en la cuadrícula.
- Al editar un producto ves su **margen** al instante.
- **Ajustar stock** pide un motivo (conteo, merma, regalo) y queda registrado.
- Ves cuánto hay en tienda y cuánto con vendedores: *"30 en tienda · 10 con vendedores"*.

### 💰 Caja e 🏠 Inicio

<p align="center">
  <img src="docs/capturas/11-caja.png" width="30%" alt="Caja">
  <img src="docs/capturas/12-inicio.png" width="30%" alt="Inicio">
</p>

- **Caja:**
  - cuánto **efectivo debe haber**, qué entró y salió hoy, y Yape/Plin aparte;
  - **compras** a proveedor (suben el stock y actualizan el costo), **gastos**, **retiros**, **aportes** y **saldo inicial**;
  - **cierre del día**: cuentas el efectivo y la app te dice si **sobra o falta**.
- **Inicio:**
  - **ganancia de hoy** después de gastos;
  - lo vendido, el número de ventas, las rebajas dadas, lo que **te deben**, el **stock bajo** y las entregas vencidas.

### 🧾 Historial, 💾 copia de seguridad y 🌙 modo oscuro

<p align="center">
  <img src="docs/capturas/18-copia.png" width="30%" alt="Copia de seguridad">
  <img src="docs/capturas/19-oscuro.png" width="30%" alt="Modo oscuro">
</p>

- **Historial de ventas:** reimprimir o **anular con motivo**. Las ventas de días anteriores piden tu código de dueño.
- **Copia de seguridad cifrada** (AES-256 con tu código de dueño), para enviarte por WhatsApp o Drive. La app te la recuerda cada semana.
- **Modo oscuro** para la noche o lugares cerrados.

---

## 6. Todos tus aparatos en un grupo

<table>
<tr>
<td width="50%"><img src="docs/capturas/26-grupo-creado.png" alt="Grupo creado con su código"></td>
<td width="50%"><img src="docs/capturas/27-grupo-unido.png" alt="Un celular unido al grupo"></td>
</tr>
</table>

Junta tus celulares y tu PC en un **grupo**: todos ven las mismas ventas, productos, fiados y caja. La sincronización la hace **[Nexo](https://github.com/1xmanMAX/THE-WORLD-NEX)**, y funciona así:

1. **En un solo aparato** (el que ya tiene tus datos, por ejemplo la PC): **Menú → Sincronizar aparatos → Crear un grupo nuevo**. Aparece un código como `AXKSV-J57N9`.
2. **En cada uno de los demás**: **Menú → Sincronizar aparatos**, escribe ese código y toca **Unirme al grupo**. Da igual escribirlo en minúsculas o sin el guion. Un celular nuevo también lo puede hacer desde la primera pantalla.
3. Listo. Desde ese momento se sincronizan **solos**, segundos después de cada venta.

| | |
|---|---|
| 📡 **Sin servidor** | Cada aparato se sincroniza **directo con los demás**: celular con celular, celular con PC. **La PC no tiene que estar prendida.** |
| 🔍 **Se encuentran solos** | Basta con estar en el **mismo Wi-Fi**. No hace falta internet ni escribir direcciones. |
| 🤝 **Nada se pierde** | Cada venta viaja por separado. Si dos aparatos cambian el mismo producto a la vez (el precio en uno y el nombre en otro), **se juntan los dos cambios**. El stock suma las ventas de todos. |
| 🔒 **Seguro** | Todo va cifrado y firmado. El código nunca viaja por la red y solo entran los aparatos que lo saben. |
| 🚫 **Celular perdido** | Desde cualquier aparato del grupo: **Sacar**, y después **Código nuevo**. Ese celular deja de recibir datos. |

> **Respaldo:** el vínculo anterior (escanear el QR de la PC) sigue funcionando debajo, en **"Vínculo con la PC por QR (respaldo)"**. Úsalo si un aparato todavía no tiene la versión nueva. La PC guarda además un respaldo por día de los últimos 30 días.

### Cómo se conectan

Cada aparato guarda **su propia copia** de los datos. Nexo, dentro de esa copia, la mantiene igual a la de los demás: cada aparato habla **directo** con los otros por el Wi-Fi. No hay un servidor en el medio, ni en internet ni en la PC.

```mermaid
flowchart LR
    subgraph C1["📱 Celular del dueño"]
        direction TB
        App1["App (APK)"] <--> Copia1["Copia local"]
        Copia1 --- N1(("Nexo"))
    end
    subgraph PC["💻 PC"]
        direction TB
        AppPC["App en Comet"] <--> CopiaPC["Copia local<br/>mi-bodega.exe"]
        CopiaPC --- NexoPC(("Nexo"))
    end
    subgraph C2["📱 Celular del ayudante"]
        direction TB
        App2["App (APK)"] <--> Copia2["Copia local"]
        Copia2 --- N2(("Nexo"))
    end
    WIFI{{"📶 Wi-Fi de la tienda<br/>sin internet · cifrado"}}
    N1 <-.-> WIFI
    NexoPC <-.-> WIFI
    N2 <-.-> WIFI
```

### Cómo entra un aparato nuevo

```mermaid
sequenceDiagram
    autonumber
    participant P as 💻 PC (ya tiene los datos)
    participant C as 📱 Celular nuevo
    P->>P: Crear grupo → muestra el código AXKSV-J57N9
    C->>C: La persona escribe el código
    C-->>P: Se encuentran solos en el Wi-Fi
    C->>P: Demuestra que sabe el código<br/>(SPAKE2: el código nunca viaja)
    P-->>C: Lo acepta en el grupo (registro firmado)
    P-->>C: Le pasa todos los datos
    Note over P,C: Desde ahora se sincronizan solos
```

### Cómo viaja una venta

```mermaid
sequenceDiagram
    autonumber
    actor D as Dueño
    participant A as 📱 App del celular
    participant CA as Copia del celular
    participant CP as Copia de la PC
    participant B as 💻 App de la PC
    D->>A: Cobra una venta
    A->>CA: La guarda (2 segundos después)
    CA-->>CP: Nexo envía solo lo nuevo, cifrado
    Note over CA,CP: Si los dos cambiaron el mismo producto,<br/>se juntan los cambios campo por campo
    B->>CP: ¿Hay algo nuevo? (cada 4 segundos)
    CP-->>B: Llega la venta
    B->>B: Recalcula stock y saldos con las ventas de todos
```

---

## 7. Fácil de ver y de usar

<p align="center"><img src="docs/presentacion/accesible.png" alt="Normal, modo Sol con letra grande, modo oscuro y modo ayudante" width="100%"></p>

La app se diseñó a partir de un **estudio con fuentes académicas** sobre puntos de venta, niños, baja visión y color ([`docs/ESTUDIO-UX.md`](docs/ESTUDIO-UX.md)). En **Ajustes → Fácil de ver y de usar**, cada teléfono elige lo suyo:

| Ajuste | Para qué sirve |
|---|---|
| 🔠 **Tamaño de letra** (Normal · Grande · Muy grande) | Para quien ve poco. Con "Muy grande" los productos van en 2 columnas para que el nombre entre completo. También respeta el tamaño de letra del teléfono. |
| ☀️ **Colores "Sol"** | Blanco y negro puros con bordes gruesos, para atender **a pleno sol**. Se activa solo si el teléfono tiene "aumentar contraste". |
| 🔊 **Leer en voz alta** | Dice el total y el vuelto: *"Vuelto: 25 soles. Da un billete de 20 soles y una moneda de 5 soles."* |
| 🧒 **Modo ayudante** | Para los hijos o un ayudante: **solo vender** en efectivo o Yape, sin cambiar precios, sin rebajas ni fiado y con el menú cerrado. **Para salir se pide el código de dueño.** Sus ventas quedan marcadas. |

**Y para todos, siempre:**
- letra **Atkinson Hyperlegible**, creada por el Braille Institute para personas con baja visión;
- **todos los textos con contraste AAA** (7:1 o más);
- colores seguros para **daltónicos**: azul cuando entra dinero y naranja cuando sale, siempre con su palabra o signo;
- el nombre del producto **nunca va encima de la foto**;
- **botones grandes** (los productos miden más de 2 cm);
- **íconos con palabras** en el menú.

---

## 8. Ganancias y análisis económico

<table>
<tr>
<td width="300"><img src="docs/capturas/13-rentabilidad.png" width="280" alt="Rentabilidad"></td>
<td valign="top">

En **Menú → Rentabilidad** (7 días, 30 días o todo), la app te dice en una frase **si el negocio es rentable** y cómo va frente al periodo anterior. Además da un **veredicto para cada producto**:

| Veredicto | Qué hacer |
|---|---|
| ★ **Estrella** | Que nunca te falte |
| ✓ **Bien** | Seguir igual |
| ⏳ **Se mueve lento** | Compra menos la próxima vez |
| ↓ **Margen bajo** | Revisa el precio o el costo |
| ✕ **Pierde** | Sube el precio o no lo rebajes |
| ∅ **Sin ventas** | Considera dejar de traerlo |
| ? **Sin costo** | Ponle el costo en Inventario |

</td>
</tr>
</table>

Cada indicador tiene su gráfico y un botón **"¿Qué es?"** que lo explica dentro de la app:

<table>
<tr>
<td width="50%"><img src="docs/capturas/14-equilibrio.png" alt="Punto de equilibrio"></td>
<td width="50%"><img src="docs/capturas/15-pareto.png" alt="Pareto ABC"></td>
</tr>
<tr>
<td valign="top"><b>Punto de equilibrio:</b> <i>"Necesitas vender S/ X al día para no perder."</i> Muestra también cuánto pueden bajar tus ventas antes de perder.</td>
<td valign="top"><b>Pareto / ABC (80/20):</b> qué pocos productos dejan casi toda la ganancia (A) y cuáles ocupan espacio y plata sin rendir (C).</td>
</tr>
<tr>
<td><img src="docs/capturas/16-bcg.png" alt="Matriz BCG"></td>
<td><img src="docs/capturas/17-gmroi.png" alt="GMROI"></td>
</tr>
<tr>
<td valign="top"><b>Matriz BCG:</b> Estrella, Vaca lechera, Interrogante o Perro, según cuánto deja cada producto y si sus ventas crecen.</td>
<td valign="top"><b>GMROI y rotación:</b> cuántos soles de ganancia al año deja cada sol que tienes metido en stock.</td>
</tr>
</table>

> Para que los números sean reales: **pon el costo** de cada producto, los **gastos fijos del mes** en Ajustes y **registra los gastos** del día.

---

## 9. Seguridad del dinero y de los datos

| | |
|---|---|
| 🧮 **Céntimos exactos** | El dinero se calcula en céntimos enteros: nunca hay errores de redondeo en el vuelto ni en los totales. |
| 🗂️ **Nada se borra** | Ventas, gastos y movimientos se **anulan con motivo** y queda el rastro. |
| ⚛️ **Todo o nada** | Una venta descuenta el stock, registra la caja y actualiza todo junto. Si algo falla, no se guarda nada a medias. |
| 🔑 **Códigos protegidos** | El código de cada persona no se guarda: solo una huella cifrada (PBKDF2). Con 3 intentos fallidos se bloquea 5 minutos. |
| 👑 **Código de dueño** | Se pide para fiar sobre el límite, anular ventas pasadas, cambiar códigos, salir del modo ayudante y crear o restaurar copias. |
| 💾 **Copia cifrada** | Con AES-256. La app te la recuerda cada semana. |

> ⚠️ **Importante:** los datos viven en tu teléfono (y en tu PC, si los sincronizas). Si el teléfono se pierde y no hay copia, se pierden. **Haz la copia cada semana.** El código de 4 dígitos prueba que la persona aprobó la operación en tu teléfono, pero no es una firma legal formal.

<details>
<summary><b>❓ Preguntas frecuentes</b></summary>

**¿Necesito internet?**
No. La app funciona completa sin señal. Solo se necesita internet para descargar el APK y para enviar la copia o el comprobante por WhatsApp.

**Toqué ×10 y no pasó nada.**
El ×10 se aplica al **siguiente** producto que toques: primero ×10 y después el producto.

**Me equivoqué al cobrar.**
Justo después de cobrar, toca **Deshacer**. Si ya pasó, ve a Menú → Historial de ventas → la venta → **Anular venta**.

**Mi hijo va a atender. ¿Puede tocar algo que no debe?**
Activa el **modo ayudante** en Ajustes: solo podrá vender, y para salir del modo hace falta tu código.

**No veo bien las letras al sol.**
En Ajustes → Fácil de ver y de usar elige letra **Grande** y colores **Sol**.

**Un cliente olvidó su código.**
En su ficha toca **Cambiar código**. Tú escribes tu código de dueño y la persona crea uno nuevo.

**¿Por qué la ganancia de hoy sale negativa?**
Porque ya se descontó la parte del día de tus gastos fijos. Es normal en días flojos; mira la Rentabilidad de 30 días.

**¿Puedo usarla en dos teléfonos o en el teléfono y la PC?**
Sí, en todos los que quieras. Crea un **grupo** en uno y únete con su código en los demás (Menú → Sincronizar aparatos). Se sincronizan entre ellos por el Wi-Fi, aunque la PC esté apagada.

**Un aparato del grupo no recibe nada.**
Revisa que esté en el **mismo Wi-Fi** y con Mi Bodega abierta. Algunos routers de invitados aíslan a los aparatos: usa la red principal. Si sigue sin encontrarlos, en "Unirme al grupo" está la opción de unirse por la **dirección** del otro aparato (aparece al final de su pantalla de Sincronizar).

**¿Cómo imprimo?**
Al cobrar, toca **Cobrar e imprimir**. También puedes reimprimir desde el Historial o el comprobante.

**Actualicé la app, ¿perdí algo?**
No. Instalar el APK nuevo encima conserva todo. Solo desinstalar borra los datos.

</details>

---

## 10. Cómo funciona por dentro

### Las capas de la app

```mermaid
flowchart TB
    UI["🖥️ Pantallas (React)<br/>features/: vender, cobrar, inventario, caja…"]
    Estado["⚡ Estado del momento (Zustand)<br/>carrito y clientes en espera"]
    Ops["🧾 Operaciones del negocio (db/)<br/>cobrar, fiar, liquidar, comprar, cerrar caja"]
    Dom["🧮 Lógica pura (domain/)<br/>dinero, vuelto, predicción, saldos, indicadores"]
    BD[("💾 Base de datos del aparato<br/>IndexedDB con Dexie")]
    Sync["🔄 Sincronización (sync/)<br/>fusión a 3 vías y recálculo de stock y saldos"]
    Copia["📦 Copia local + Nexo (Rust)<br/>pc/src y pc/movil"]
    UI --> Estado
    UI -->|lecturas en vivo| BD
    Estado --> Ops
    Ops --> Dom
    Ops -->|una transacción por operación| BD
    BD <--> Sync
    Sync <--> Copia
```

### Los datos

Lo principal del modelo (el detalle está en [`mi-bodega-handoff/docs/DATA_MODEL.md`](mi-bodega-handoff/docs/DATA_MODEL.md)):

```mermaid
erDiagram
    PRODUCTO ||--o{ LINEA_DE_VENTA : "se vende en"
    VENTA ||--|{ LINEA_DE_VENTA : tiene
    VENTA ||--o| FIRMA : "si es fiado"
    PRODUCTO ||--o{ MOVIMIENTO_DE_STOCK : "entra y sale"
    VENTA ||--o{ MOVIMIENTO_DE_CAJA : "mueve la caja"
    PERSONA ||--o{ MOVIMIENTO_DE_CUENTA : "debe y paga"
    PERSONA ||--o{ ENTREGA : "recibe mercadería"
    ENTREGA ||--|{ LINEA_DE_ENTREGA : tiene
    COMPRA ||--|{ LINEA_DE_COMPRA : tiene
    PRODUCTO ||--o{ LINEA_DE_COMPRA : "se compra en"
```

### Las reglas que hacen que los números cuadren

| Regla | Qué significa | Por qué importa |
|---|---|---|
| 🪙 **Céntimos enteros** | S/ 18.50 se guarda como `1850` | Nunca hay errores de redondeo en el vuelto ni en los totales |
| ⚛️ **Todo o nada** | Cada operación del negocio es una sola transacción | Una venta no puede bajar el stock sin registrar la caja |
| 🗂️ **Nada se borra** | Se **anula** con motivo y fecha | Siempre queda el rastro de lo que pasó |
| 📸 **Copia del momento** | Cada venta guarda el nombre, el precio y el costo de ese día | Cambiar un precio no altera el historial |
| ➕ **Stock y saldos se calculan** | Salen de sumar los movimientos, no se escriben a mano | Con varios aparatos, las ventas de todos cuentan |
| 🔐 **Códigos con huella** | De cada código solo se guarda una huella (PBKDF2) | Nadie puede leer el código de un cliente |

---

## 11. Cómo mejorarla: hoja de ruta

### Lo que ya está

| Fase | Contenido | Estado |
|---|---|:---:|
| 1 | Vender, cobrar, inventario, recibo, sin internet | ✅ |
| 2 | "Siguiente probable" y orden por popularidad | ✅ |
| 3 | Clientes, código personal, fiado y cobro de deudas con comprobante | ✅ |
| 4 | Entregas a vendedores y liquidación | ✅ |
| 5 | Caja, cierre del día, inicio, ganancias y análisis económico | ✅ |
| 6a | Copia de seguridad cifrada con recordatorio semanal | ✅ |
| 6c | Sincronización por Wi-Fi entre la PC y los celulares | ✅ |
| — | Grupo de aparatos con Nexo: celular ↔ celular ↔ PC sin servidor | ✅ (falta probarlo en celulares reales) |
| — | Fácil de ver y de usar: letra grande, modo Sol, vuelto dibujado, voz y modo ayudante | ✅ |

### Lo que sigue

| Prioridad | Mejora | Para qué | Estado |
|:---:|---|---|:---:|
| 🔴 | **Probar el grupo en celulares reales** | Confirmar que los celulares se encuentran en el Wi-Fi de la tienda (NSD) y que la venta llega en segundos | 🔜 Próximo |
| 🔴 | **Sincronizar con la app cerrada** | Que el celular reciba las ventas aunque la app no esté abierta (Nexo ya trae el trabajo en segundo plano de Android) | 📝 Diseñado |
| 🟠 | **Impresora térmica Bluetooth** | Imprimir el ticket directo, sin el diálogo de Android (ESC/POS) | ⏳ Pendiente |
| 🟠 | **Código de cada ayudante** | Que cada ayudante entre con su propio código y ver cuánto vendió cada uno | 💡 Idea |
| 🟡 | **Qué reponer y cuánto** | Usar las ventas y la rotación para sugerir la compra al proveedor | 💡 Idea |
| 🟡 | **Escáner de código de barras** | Vender y registrar productos envasados con la cámara | 💡 Idea |
| 🟡 | **Reportes en PDF o Excel** | Pasarle al contador las ventas, gastos y ganancias del mes | 💡 Idea |
| ⚪ | **iPhone y Mac** | Nexo ya tiene su paquete para Apple; faltaría la app | 💡 Idea |
| ⚪ | **Pantalla para el cliente** | Girar el teléfono y mostrarle el total y el vuelto en grande | 💡 Idea |

Las decisiones tomadas y las propuestas abiertas, con su explicación, están en [`PLAN.md`](PLAN.md). El estudio de usabilidad que guió el diseño está en [`docs/ESTUDIO-UX.md`](docs/ESTUDIO-UX.md).

### Cómo ayudar

1. **Prueba la app** en tu teléfono y cuéntanos qué no se entiende o qué falla: abre un [issue](https://github.com/1xmanMAX/ABARROTES-PRO-/issues) con una captura.
2. **¿Propones una mejora?** Explica el problema del puesto que resuelve (no solo la función), y si es posible, cuántos toques ahorra.
3. **¿Programas?**
   - Lee las reglas en [`mi-bodega-handoff/CLAUDE.md`](mi-bodega-handoff/CLAUDE.md).
   - Agrega tests de lo que cambies: de lógica en `domain/`, de base de datos en `db/` y un flujo en `e2e/`.
   - Corre `npm test` y `npm run e2e` antes de enviar tu cambio.
   - Los textos van en español de Perú, en `src/i18n/es-PE.ts`.

---

## 12. Para programadores

<table>
<tr><td><b>App</b></td><td>React 19 + TypeScript (estricto) + Vite 8</td></tr>
<tr><td><b>Offline</b></td><td>PWA con <code>vite-plugin-pwa</code> (Workbox); fuentes incluidas</td></tr>
<tr><td><b>Base de datos</b></td><td>IndexedDB con Dexie 4 (transacciones y migraciones)</td></tr>
<tr><td><b>Estado</b></td><td>Zustand (carrito, tickets en espera); lecturas con <code>useLiveQuery</code></td></tr>
<tr><td><b>Criptografía</b></td><td>WebCrypto: PBKDF2-SHA256, SHA-256, AES-GCM</td></tr>
<tr><td><b>Android</b></td><td>Capacitor 8 (impresión y voz nativas), compilado por GitHub Actions</td></tr>
<tr><td><b>PC</b></td><td><code>pc/mi-bodega.exe</code> (Rust): sirve la app, guarda la copia principal y la abre en Comet</td></tr>
<tr><td><b>Sincronización</b></td><td><a href="https://github.com/1xmanMAX/THE-WORLD-NEX">Nexo</a> (Rust, QUIC + mDNS, grupo con SPAKE2 y Ed25519) dentro de la copia local de cada aparato: <code>pc/src/nodo.rs</code> en la PC y <code>pc/movil</code> (biblioteca nativa con NSD) en el APK</td></tr>
<tr><td><b>Tests</b></td><td>Vitest + fake-indexeddb (120), Playwright en teléfono 390×844 y PC 1366×768 (21 flujos, uno con dos aparatos en grupo) y Rust (8, dos de ellos con Nexo)</td></tr>
</table>

<details>
<summary><b>Estructura del código</b></summary>

```
app/
  src/
    domain/      lógica pura y probada: dinero, vuelto en billetes, carrito, predicción,
                 códigos, saldos, consignación, caja, ganancias, indicadores, respaldo
    db/          esquema Dexie y una función por operación atómica
    features/    pantallas: sell, inventory, parties, consign, cash, stats, backup,
                 history, settings, sync
    sync/        sincronización por Wi-Fi con la PC (cifrado, fusión, parches)
    ui/          componentes compartidos (Sheet, NumPad, PinPad, CashPieces, gráficos…)
    styles/      tokens de color con contraste AAA, modo Sol y escala de letra
    i18n/es-PE.ts  todos los textos de la interfaz
  e2e/           flujos completos, capturas y portada del README
  android/       proyecto Android (Capacitor)
pc/              programa de Windows e instalador; src/nodo.rs une la copia principal con Nexo
  movil/         la misma copia + Nexo para el APK (biblioteca nativa, NSD de Android)
  examples/      nodo_prueba: un aparato de prueba para el test de dos aparatos
docs/            capturas, imágenes de presentación y estudio de usabilidad
mi-bodega-handoff/  especificación original (SPEC, modelo de datos, diseño)
PLAN.md          fases, decisiones tomadas y propuestas pendientes
```

</details>

<details>
<summary><b>Comandos</b></summary>

```bash
cd app
npm install
npm run dev            # servidor en la red local (ábrelo desde el teléfono)
npm test               # tests de dominio y base de datos
npm run e2e            # flujos en el navegador
npm run build && npm run preview   # PWA instalable y offline
npm run build:android  # copia la web al proyecto Android
npm run capturas       # regenera las capturas y las imágenes de este README

# Rust (pc/): servidor de la PC, Nexo y la biblioteca del APK
cd ../pc && cargo test                                   # incluye dos aparatos en grupo
cargo ndk -t arm64-v8a -P 24 build --release -p mi-bodega-movil
cargo build --example nodo_prueba && NEXO_PRUEBA=<ruta>/nodo_prueba npx playwright test nexo
```

</details>

<details>
<summary><b>Publicación automática</b></summary>

- **APK:** cada push a `main` o a `claude/**` que toque `app/` corre los tests, compila la biblioteca nativa de Nexo (`app/android/compilar-nexo.sh`), arma el APK y lo publica en la release [`apk-latest`](https://github.com/1xmanMAX/ABARROTES-PRO-/releases/tag/apk-latest). Siempre se firma con la misma clave, así las actualizaciones se instalan encima.
- **Web:** cada push a `main` publica la versión web en GitHub Pages ([`pages.yml`](.github/workflows/pages.yml)).
- **Reglas del código:** las principales están en [`mi-bodega-handoff/CLAUDE.md`](mi-bodega-handoff/CLAUDE.md):
  - el dinero siempre en céntimos enteros;
  - cada operación de negocio en una sola transacción;
  - nada se borra, se anula;
  - las ventas guardan una copia del nombre, el precio y el costo de ese momento.

</details>

<p align="center"><sub>Hecho para el mercado, en español de Perú 🇵🇪 · Sincronización con <a href="https://github.com/1xmanMAX/THE-WORLD-NEX">Nexo</a></sub></p>

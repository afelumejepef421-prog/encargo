# Módulo 2: Diseño, UX y Contenido
**Plataforma de Intermediación de Servicios «Encargo»**
*Guía de Interfaz, Experiencia de Usuario y Lineamientos Editoriales*

---

## 2.1 Sistema de Diseño Visual (Design System)

El diseño de **Encargo** está fundamentado en principios de claridad, confiabilidad transaccional y accesibilidad, cumpliendo con la especificación de diseño y contraste mínimo 4.5:1 exigido por **WCAG 2.1 Nivel AA**.

### 2.1.1 Paleta Cromática Institucional

| Rol Cromático | Código Hexadecimal | Variable / Clase CSS | Uso en la Aplicación |
|---|---|---|---|
| **Cabecera / Dark Base** | `#1a1a2e` | `.cabecera` | Barra de navegación superior fija y contraste primario |
| **Primario / Acción** | `#16213e` | `.btn-principal:hover` | Botones de acción principal y submit de formularios |
| **Acento Primario** | `#3b82f6` | `.enlace-activo` / `.btn-link` | Enlaces interactivos, foco de accesibilidad e iconos clave |
| **Alerta / Advertencia** | `#f59e0b` | `.badge-pendiente` / `.alerta` | Estados "PUBLICADO", avisos de acuerdo pendiente |
| **Éxito / Conclusión** | `#10b981` | `.badge-completado` | Estados "COMPLETADO", transacciones exitosas |
| **Peligro / Salida** | `#dc2626` | `.btn-salir`, `.btn-peligro` | **Botón de Cerrar Sesión** (rojo llamativo) y cancelación |
| **Peligro Hover** | `#b91c1c` | `.btn-salir:hover` | Estado interactivo hover del botón de salida |
| **Borde de Salida** | `#f87171` | `.btn-salir` border | Borde sutil de alto contraste para el botón de salida |
| **Fondo General** | `#ffffff` | `body` | Lienzo principal limpio para reducir fatiga visual |
| **Fondo Neutro Secundario** | `#f7f7f7` | `.tarjeta`, `.panel-acuerdo` | Fondos de tarjetas de solicitud, chat y tablas |
| **Bordes Estructurales** | `#d9d9d9` | `border: 1px solid` | Delimitadores de contenedores y campos de entrada |
| **Texto Principal** | `#222222` | `body`, `h1, h2, h3` | Tipografía principal de alta legibilidad |
| **Texto Atenuado** | `#666666` | `.usuario-info`, metadatos | Fechas, subtítulos y textos secundarios |

> [!IMPORTANT]
> **Optimización UI del Botón de Cierre de Sesión:**
> En revisiones previas, el botón de cierre de sesión presentaba un tono azul similar a la barra de navegación que dificultaba su identificación rápida. Se actualizó a la clase `.btn-salir` con fondo rojo vibrante (`#dc2626`), borde contrastante (`#f87171`) y hover (`#b91c1c`), garantizando que cualquier usuario pueda desautenticarse de forma inmediata e inequívoca desde cualquier pantalla.

> [!NOTE]
> **Limpieza de Seguridad en la Pantalla de Inicio de Sesión:**
> Se eliminó completamente de la interfaz pública de login (`Acceso.jsx`) el recuadro que exponía las credenciales del Administrador Principal (`admin@encargo.com` / `administradorEncargo@`). El acceso a roles privilegiados ahora es gestionado de manera opaca sin filtración en la vista pública.

### 2.1.2 Jerarquía Tipográfica y Espaciado Modular
- **Pila Tipográfica:** Pila nativa del sistema operativo para rendimiento instantáneo sin peticiones de red:
  `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`.
- **Escala de Tamaños:**
  - `h1`: 32px (2.0rem) — Títulos principales de página.
  - `h2`: 24px (1.5rem) — Secciones y títulos de modales.
  - `h3`: 20px (1.25rem) — Subsecciones y encabezados de tarjetas.
  - `Body / P`: 16px (1.0rem) — Texto corrido estándar.
  - `Small / Metadato`: 12px-13px (0.75rem - 0.8125rem) — Información contextual y etiquetas.
- **Grilla de Espaciado:** Sistema modular basado en múltiplos de 8px: `8px`, `16px`, `24px`, `32px`.

### 2.1.3 Componentes Reutilizables de la Aplicación
1. **Selector Territorial Cascada (`SelectorUbicacion.jsx`):**
   - Integra la división político-administrativa oficial de Colombia (32 Departamentos + Distrito Capital Bogotá).
   - Al seleccionar un departamento, el selector de municipios se actualiza en memoria sin latencia de red.
2. **Panel de Negociación y Acuerdo Bilateral (`AcuerdoChatPanel.jsx`):**
   - Visualiza en tiempo real el valor acordado en pesos colombianos ($ COP) y la fecha/hora programada.
   - Cuenta con indicadores visuales interactivos de confirmación por cada parte (`clientConfirmed`, `providerConfirmed`).
   - Bloquea dinámicamente las acciones hasta que se satisfacen las reglas de validación (mínimo un mensaje de cada parte).
3. **Insignias de Estado (`Estado.jsx`):**
   - Mapeo semántico por colores:
     - `PUBLICADO`: Amarillo / Ámbar (abierto a postulaciones).
     - `acordada` / `en_progreso`: Azul / Púrpura (en ejecución).
     - `COMPLETADO`: Verde (finalizado y liquidado).
     - `cancelada`: Rojo / Gris oscuro (anulada o penalizada).
4. **Billetera Virtual con Saldo Líquido (`Billetera.jsx`):**
   - Formato visual de balance en COP, botones de recarga rápida y listado cronológico de comprobantes transaccionales.

### 2.1.4 Guía de Adaptabilidad Responsive (Breakpoints)
- **Móvil (< 640px):** Disposición en columna única vertical. Menú de navegación adaptable con wrap. Botones de ancho completo (`width: 100%`) para facilitar el toque táctil (área mínima de contacto de 44x44px).
- **Tablet (640px - 1024px):** Rejilla de 2 columnas para tarjetas de solicitudes. Chat y panel de acuerdo organizados en pestañas o columnas colapsables.
- **Escritorio (> 1024px):** Ancho máximo delimitado a `1100px` centrado con márgenes automáticos para prevenir dispersión visual en monitores ultrawide.

---

## 2.2 Arquitectura de Información y Navegación

### 2.2.1 Mapa de Vistas y Jerarquía

```
                         [ INICIO / PANEL PÚBLICO ] (/)
                                      |
         +----------------------------+----------------------------+
         |                                                         |
  [ NO AUTENTICADO ]                                        [ AUTENTICADO ]
         |                                                         |
  +------+------+                               +------------------+------------------+
  |             |                               |                  |                  |
[Login]    [Registro]                     [Mis Solicitudes]   [Nueva Solicitud]   [Billetera]
(/login)   (/registro)                    (/mis-solicitudes)     (/nueva)        (/billetera)
                                                |                  |                  |
                                         [Detalle / Chat]     [Mi Perfil]       [Admin Panel]*
                                         (/solicitudes/:id)    (/perfil)           (/admin)
                                                                            *Solo role == 'ADMIN'
```

### 2.2.2 Menús Dinámicos y Visibilidad Condicional
La cabecera (`App.jsx`) evalúa en tiempo real el estado de autenticación y el rol del usuario:
- **Usuario Invitado:** Muestra accesos directos a "Explorar Solicitudes", "Iniciar Sesión" y "Registrarse".
- **Usuario Autenticado (Cliente/Proveedor):**
  - Muestra saldo disponible en pesos colombianos con formato en vivo: `💰 $XX.XXX COP`.
  - Enlaces a "Explorar", "Mis Solicitudes", "Publicar Encargo", "Billetera", "Mi Perfil".
  - Botón de cierre de sesión `.btn-salir` en color rojo.
- **Usuario con Rol de Administrador:**
  - Incorpora de forma exclusiva el acceso al **"🛡️ Panel Admin"** (`/admin`), inaccesible para cuentas convencionales.

---

## 2.3 Experiencia de Usuario (Customer Journey Maps)

### 2.3.1 Viaje del Cliente (Demandante del Servicio)
1. **Publicación del Encargo:** Selecciona categoría (ej. Plomería), ingresa título, descripción, ubicación geográfica (Dpto/Municipio) y presupuesto de referencia.
2. **Recepción de Interesados:** El encargo queda en estado `PUBLICADO`. Proveedores interesados inician conversaciones privadas.
3. **Negociación en Chat:** El cliente debate el alcance con el proveedor. Cada mensaje se registra en tiempo real.
4. **Fijación de Términos:** Se pacta el precio final en COP y la fecha límite.
5. **Doble Confirmación & Retención:** El cliente pulsa "Confirmar Compromiso". Se verifica que su billetera tenga saldo suficiente. El 100% del valor pactado pasa a custodia segura (`escrowAmount`), garantizando al proveedor que los fondos existen.
6. **Recepción y Aprobación:** Finalizado el trabajo, el cliente confirma la entrega. Los fondos son liberados de forma atómica.

### 2.3.2 Viaje del Proveedor (Solucionador)
1. **Descubrimiento:** Explora solicitudes filtrando por su departamento y ciudad de residencia.
2. **Postulación:** Entra al detalle y envía un mensaje privado presentándose y proponiendo términos.
3. **Confirmación Formal:** Una vez acordados valor y fecha en el chat, pulsa "Confirmar Compromiso". Se compromete formalmente bajo advertencia de penalizaciones.
4. **Ejecución y Cobro:** Tras realizar el servicio, marca "Declarar Labor Finalizada". Cuando el cliente aprueba, recibe el 92% neto directamente en su saldo líquido, mientras el 8% se acredita a la plataforma.

### 2.3.3 Viaje del Administrador
1. **Supervisión y Gobernanza:** Ingresa con credenciales privilegiadas (`admin@encargo.com` o administradores delegados).
2. **Panel de Gestión de Roles:** Visualiza la lista de todos los usuarios registrados, su rol actual, estado de baneo y contador de strikes.
3. **Promoción de Cuentas:** Puede elevar a un usuario regular a rango de `ADMIN` con un clic, con validación de seguridad que impide degradar o banear la cuenta raíz `admin@encargo.com`.

---

## 2.4 Guía Editorial y Microcopy en el Contexto Colombiano

- **Claridad Transaccional:** Cada botón con implicaciones financieras especifica el monto exacto: *"Confirmar Compromiso (Retener $50.000 COP en Custodia)"*.
- **Cultura de Cumplimiento:** Advertencias explícitas sobre las consecuencias de cancelación unilateral: *"Recuerda: cancelar un encargo confirmado generará una sanción económica de $5.000 COP y sumará una falta a tu perfil"*.
- **Transparencia en Comisiones:** Desglose transparente en el panel de entrega: *"Valor pactado: $100.000 COP · Tarifa de plataforma (8%): $8.000 COP · Total a recibir: $92.000 COP"*.

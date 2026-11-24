# Documentación Técnica Integral «Encargo»
**Repositorio Oficial de Documentación de Arquitectura, Diseño, Operaciones y Seguridad**

Bienvenido a la documentación técnica oficial de la plataforma **Encargo**, desarrollada con React 18, Vite, Cloud Firestore, Firebase Authentication y Firebase Hosting.

---

## 📁 Estructura Modular de Documentación

Los documentos se organizan modularmente dentro del directorio `/docs` para facilitar su consulta, auditoría y mantenimiento continuo:

1. [**01. Arquitectura y Aspectos Técnicos**](file:///C:/Users/luisk/.gemini/antigravity/scratch/encargo/docs/01_arquitectura_y_tecnica.md)
   - Topología de red en la nube, Firebase Hosting CDN y certificados SSL/TLS.
   - Pila tecnológica completa (`package.json`) y estructura de directorios.
   - Diccionario NoSQL y esquema de colecciones en Cloud Firestore.
   - Sincronización en tiempo real (`onSnapshot`) y métricas Core Web Vitals.

2. [**02. Diseño, UX y Contenido**](file:///C:/Users/luisk/.gemini/antigravity/scratch/encargo/docs/02_diseno_ux_contenido.md)
   - Sistema de diseño, paleta de colores hexadecimal y accesibilidad WCAG 2.1 AA.
   - **Botón de salir rojo (.btn-salir)** para contraste y seguridad de sesión.
   - Limpieza y desexposición de credenciales de administrador en la pantalla de login.
   - Customer Journey Maps (Cliente, Proveedor y Administrador) y microcopy colombiano en COP.

3. [**03. Funcionalidad, Casos de Uso y Operaciones**](file:///C:/Users/luisk/.gemini/antigravity/scratch/encargo/docs/03_funcionalidad_casos_uso_operaciones.md)
   - Especificación formal de los 7 Casos de Uso (CU-01 a CU-07).
   - Doble confirmación de compromiso con regla de mensajes previos obligatorios.
   - Lógica transaccional de billetera, custodia (escrow 100%) y liquidación (92% prestador / 8% plataforma).
   - Manual de operaciones, sembrado de datos (seed) y política de respaldos.

4. [**04. Seguridad, Privacidad y Cumplimiento Legal**](file:///C:/Users/luisk/.gemini/antigravity/scratch/encargo/docs/04_seguridad_privacidad_legal.md)
   - Matriz de control de acceso basada en roles (RBAC) y auditoría de `firestore.rules`.
   - Protección de la cuenta raíz `admin@encargo.com` contra degradación o baneo.
   - Protocolo de respuesta ante incidentes de seguridad (P1 a P4).
   - Cumplimiento de la Ley 1581 de 2012 (Habeas Data) y Ley 1480 de 2011 (Estatuto del Consumidor en Colombia).

5. [**05. Diagramas de Arquitectura y Procesos**](file:///C:/Users/luisk/.gemini/antigravity/scratch/encargo/docs/05_diagramas_y_flujos.md)
   - Diagrama 1: Arquitectura Global del Sistema e Infraestructura.
   - Diagrama 2: Máquina de Estados del Ciclo de Vida de una Solicitud.
   - Diagrama 3: Secuencia Transaccional de Custodia y Comisión.
   - Diagrama 4: Flujograma de Faltas, Multas COP ($5k / $10k) y Suspensión de 7 Días.

---

## 📑 Compilación a PDF

Para generar el archivo consolidado descargable `Documentacion_Integral_Plataforma.pdf` con todos los diagramas integrados en alta definición vectorial, ejecute:

```powershell
& "backend/.venv/Scripts/python.exe" docs/build_pdf.py
```
El archivo final resultante se compila en la raíz del proyecto:
- [Documentacion_Integral_Plataforma.pdf](file:///C:/Users/luisk/.gemini/antigravity/scratch/encargo/Documentacion_Integral_Plataforma.pdf)

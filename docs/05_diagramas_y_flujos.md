# Módulo 5: Diagramas de Arquitectura y Procesos
**Plataforma de Intermediación de Servicios «Encargo»**
*Representación Gráfica Formal de Flujos de Negocio, Estados y Topología*

---

## 5.1 Diagrama 1: Arquitectura Global del Sistema

Este diagrama ilustra la separación de capas entre el cliente web (SPA React), la red de distribución de contenidos (Firebase Hosting CDN), los servicios de identidad (Firebase Auth) y la capa de base de datos distribuida con motor de reglas (Cloud Firestore).

```mermaid
graph TD
    subgraph Capa_Cliente["Capa de Presentación (Frontend SPA)"]
        UI_Cliente["Cliente Web (Navegador Desktop / Móvil)"]
        React_App["React 18 + Vite Router"]
        Store_State["Estado Reactivo & onSnapshot"]
        UI_Cliente --> React_App
        React_App --> Store_State
    end

    subgraph Firebase_Infra["Infraestructura Cloud Serverless (GCP / Firebase)"]
        CDN["Firebase Hosting Edge CDN\n(https://encargo-app-8a98f.web.app)"]
        Auth["Firebase Authentication\n(Tokens JWT & Identity)"]
        Rules["Motor de Reglas de Seguridad\n(firestore.rules)"]
        Firestore["Cloud Firestore NoSQL\n(users, solicitudes, chats, penalties, revenue)"]
        Storage["Firebase Storage\n(storage.rules)"]
    end

    UI_Cliente -- "HTTPS / TLS 1.3" --> CDN
    CDN -- "Bundle JS/CSS Optimizado" --> React_App
    React_App -- "Credenciales / Auth State" --> Auth
    Auth -- "Token JWT Criptográfico" --> React_App
    React_App -- "runTransaction & Consultas" --> Rules
    Rules -- "Validación Aprobada" --> Firestore
    Store_State <-- "Sincronización en Tiempo Real (WebSocket)" --> Firestore
    React_App -- "Subida de Evidencias" --> Storage
```

---

## 5.2 Diagrama 2: Máquina de Estados del Ciclo de Vida de una Solicitud

Representa las transiciones formales por las que atraviesa un encargo desde su publicación inicial hasta su liquidación o cancelación.

```mermaid
stateDiagram-v2
    [*] --> PUBLICADO: Cliente crea solicitud (NuevaSolicitud.jsx)
    
    PUBLICADO --> Negociacion: Proveedor se postula e inicia chat
    Negociacion --> Negociacion: Intercambio de mensajes (mínimo 1 cada uno)
    
    Negociacion --> acordada: Ambas partes confirman compromiso (Doble Confirmación)
    note right of acordada
      Transacción atómica:
      - 100% retenido en custodia (escrow)
      - Se fija providerUid
    end note
    
    acordada --> en_progreso: Inicio formal de la labor
    
    en_progreso --> Entrega_Declarada: Proveedor marca 'Labor Finalizada'
    Entrega_Declarada --> COMPLETADO: Cliente aprueba y libera fondos
    note right of COMPLETADO
      Transacción atómica:
      - 92% acreditado a Proveedor
      - 8% registrado a platform_revenue
      - Escrow liberado a 0
    end note
    
    en_progreso --> cancelada: Reporte de incumplimiento unilateral
    acordada --> cancelada: Cancelación con compromiso activo
    note right of cancelada
      Transacción de penalización:
      - Multa $5.000 COP (strikes 1-2) o $10.000 COP (strike >= 3)
      - Suspensión 7 días si strikes >= 3
      - Restitución de fondos al afectado
    end note

    COMPLETADO --> [*]
    cancelada --> [*]
```

---

## 5.3 Diagrama 3: Flujo Transaccional de Custodia (Escrow) y Distribución 92% / 8%

Modela el intercambio financiero atómico bajo la primitiva `runTransaction` de Firestore para garantizar que no existan inconsistencias monetarias.

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente (Demandante)
    participant S as Solicitud (Firestore)
    participant B as Billetera Cliente
    participant P as Billetera Proveedor
    participant R as Platform Revenue (8%)

    Note over C,S: 1. Fase de Retención en Custodia (Doble Compromiso)
    C->>S: Confirmar Compromiso ($100.000 COP)
    activate S
    S->>B: Verificar saldo disponible >= $100.000 COP
    B-->>S: Saldo suficiente verificado
    S->>B: Debitar $100.000 COP de walletBalance
    S->>S: Asignar escrowAmount = $100.000 COP (Estado: en_progreso)
    deactivate S

    Note over C,P: 2. Fase de Ejecución del Servicio

    Note over C,R: 3. Fase de Liquidación y Liberación (Doble Aprobación)
    C->>S: Aprobar y Liberar Pago
    activate S
    Note over S: Ejecución runTransaction Atómica
    S->>P: Acreditar 92% ($92.000 COP) a walletBalance
    S->>R: Acreditar 8% ($8.000 COP) a plataforma
    S->>S: escrowAmount = $0 (Estado: COMPLETADO)
    deactivate S
    Note over P,R: Transacción Cerrada y Liquidada con Éxito
```

---

## 5.4 Diagrama 4: Protocolo de Penalizaciones, Multas COP y Suspensión de 7 Días

Detalla la lógica algorítmica aplicada ante cancelaciones unilaterales o incumplimientos auditados.

```mermaid
flowchart TD
    Inicio([Evento: Reporte de Incumplimiento o Cancelación]) --> ValidaEstado{¿Solicitud en compromiso confirmado?}
    ValidaEstado -- No --> FinSinMulta[Cancelación libre sin penalidad]
    ValidaEstado -- Sí --> IdentificaInfractor[Identificar UID del infractor]
    
    IdentificaInfractor --> ConsultaStrikes[(Consultar strikes actuales en users/UID)]
    ConsultaStrikes --> EvaluaStrikes{¿Strikes previos < 2?}
    
    EvaluaStrikes -- Sí (Strikes 0 o 1) --> AplicaMulta5k[Aplicar Multa: $5.000 COP\nNuevo strikes = strikes + 1]
    EvaluaStrikes -- No (Strikes >= 2) --> AplicaMulta10k[Aplicar Multa: $10.000 COP\nNuevo strikes = strikes + 1\nSuspender cuenta por 7 días]
    
    AplicaMulta5k --> DebitaSaldo[Debitar multa de walletBalance del infractor]
    AplicaMulta10k --> DebitaSaldo
    
    DebitaSaldo --> RestituyeCustodia{¿Había fondos retenidos en custodia?}
    RestituyeCustodia -- Sí --> ReembolsaCliente[Reembolsar 100% de escrow al Cliente afectado]
    RestituyeCustodia -- No --> RegistraAudit
    
    ReembolsaCliente --> RegistraAudit[(Crear registro inmutable en colección 'penalties')]
    RegistraAudit --> ActualizaSolicitud[(Actualizar estado de solicitud a 'cancelada')]
    ActualizaSolicitud --> Fin([Notificar a las partes y finalizar])
```

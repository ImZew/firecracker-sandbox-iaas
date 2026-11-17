# Ephemeral Code Execution IaaS — Firecracker-style MicroVM Control Plane

Backend serverless multi-tenant construido con **AWS CDK (`cdklocal`)**, **LocalStack (`localstack/localstack:4.14`)**, **Redis (`redis:7-alpine`)**, **DynamoDB (Single-Table Design)** y **Python 3.11**, siguiendo la arquitectura de tres contenedores del Módulo 8 (`8_proyecto_final_entorno.pptx`).

---

## 1. Arquitectura de Contenedores (`docker-compose.yml`)

| Contenedor | Imagen | Puerto | Rol |
| :--- | :--- | :--- | :--- |
| `emulador` | `localstack/localstack:4.14` | `4566:4566` | Emula **API Gateway**, **Lambda** (`LAMBDA_EXECUTOR=docker`) y **DynamoDB** |
| `redis` | `redis:7-alpine` | `6379:6379` | Caché in-memory con persistencia AOF (`--appendonly yes`) para patrones **Cache-Aside** y **TTL (`EXPIRE`)** |
| `cdk-dev` | `python:3.11-slim` + `aws-cdk` + `aws-cdk-local` | CLI (`bash`) | Entorno de desarrollo con `AWS_ENDPOINT_URL=http://emulador:4566` y `REDIS_HOST=redis` |

---

## 2. Estructura de Carpetas

```text
Aurora/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── pytest.ini
└── app/
    ├── cdk.json
    ├── pytest.ini
    ├── requirements.txt
    ├── infra/
    │   ├── __init__.py
    │   ├── app.py
    │   └── stack.py                # DynamoDB Single-Table + Lambdas Python 3.11 + LambdaRestApi
    ├── layers/
    │   └── dependencias/
    │       └── requirements.txt    # Dependencias compartidas de las Lambdas
    ├── lambdas/
    │   ├── api/
    │   │   ├── __init__.py
    │   │   ├── handler.py          # Router principal de API Gateway
    │   │   ├── auth.py             # PBKDF2-HMAC-SHA256 + JWT HS256
    │   │   ├── cache.py            # Redis Cache-Aside con EXPIRE (TTL) y _fuente
    │   │   ├── quota.py            # Control de cuotas mensuales (FREE=14,400s, PRO=ilimitado)
    │   │   └── sandbox.py          # Runner efímero aislado con telemetría microVM Firecracker
    │   └── health/
    │       ├── __init__.py
    │       └── handler.py          # Health check dedicado
    └── tests/
        ├── __init__.py
        ├── conftest.py             # Fixtures con moto (DynamoDB) y fakeredis
        ├── test_cache.py
        ├── test_auth_and_endpoints.py
        └── test_quota_and_sandbox.py
```

---

## 3. Diseño DynamoDB Single-Table (`EphemeralSandboxTable`)

- **Partition Key (`PK`)**: `STRING`
- **Sort Key (`SK`)**: `STRING`
- **Billing Mode**: `PAY_PER_REQUEST`

| Entidad | `PK` | `SK` | Atributos Principales |
| :--- | :--- | :--- | :--- |
| **Account** | `ACCOUNT#<id>` | `METADATA` | `account_id`, `email`, `username`, `tier` (`FREE` \| `PRO`), `password_hash`, `created_at` |
| **Email Index** | `EMAIL#<email>` | `LOOKUP` | `account_id`, `email`, `tier` |
| **Monthly Quota** | `QUOTA#<account_id>#<YYYY-MM>` | `SUMMARY` | `account_id`, `period`, `tier`, `accumulated_seconds`, `limit_seconds` (`14400` \| `null`), `execution_count` |
| **Execution** | `EXEC#<execution_id>` | `METADATA` | `execution_id`, `account_id`, `code`, `runtime`, `duration`, `timeout_enforced`, `status`, `stdout`, `stderr`, `telemetry` (`vm_id`, `boot_time_ms`, `teardown_time_ms`, `state_transitions`) |

---

## 4. Flujo de Trabajo con Docker Compose y `cdklocal`

```bash
# 1. Levantar los 3 contenedores
docker compose up -d --build

# 2. Entrar al contenedor de desarrollo
docker compose exec cdk-dev bash

# 3. Preparar el emulador para despliegues CDK
cdklocal bootstrap

# 4. Sintetizar y desplegar el stack en LocalStack
cdklocal deploy --require-approval never

# 5. Ejecutar pruebas unitarias (con moto y fakeredis, sin requerir el emulador)
python -m pytest -v
```

---

## 5. Endpoints del API

| Método | Ruta | Auth | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | No | Estado del servicio y configuración del plano de control |
| `POST` | `/auth/register` | No | Registra cuenta (`FREE` o `PRO`), inicializa cuota mensual y retorna JWT |
| `POST` | `/auth/login` | No | Autentica credenciales y emite token JWT |
| `POST` | `/execute` | `Bearer <JWT>` | Verifica cuota mensual (`429` si excedida), limita el timeout al saldo restante de cuota, ejecuta el código en un sandbox efímero aislado y guarda telemetría microVM |
| `GET` | `/executions/{id}` | Opcional | Obtiene resultado y telemetría vía **Cache-Aside** (`"_fuente": "cache" \| "dynamodb"`) |
## 6. Frontend Minimalist Brutalist Control Plane (`frontend/`)

El proyecto incluye una aplicación web completa en **Next.js 14 (App Router + TypeScript + Tailwind CSS + componentes estilo shadcn)** bajo `frontend/`, diseñada con estética **Brutalist Minimalist** (sin emojis, sin gradientes, bordes sólidos de `2px`, sombras offset `shadow-brutal` y tipografía monoespaciada).

### Características del Frontend
- **Landing Page (`/`)**: Arquitectura del plano de control Firecracker MicroVM, esquema DynamoDB Single-Table (`ACCOUNT#<id>`, `QUOTA#<account_id>#<YYYY-MM>`, `EXEC#<execution_id>`), y planes de suscripción `FREE` y `PRO` con compra dummy instantánea (**0.00 USD / sin paywall**).
- **Auth Context & Refresh Manager (`src/context/auth-context.tsx` y `/auth`)**:
  - Registro (`POST /auth/register`), inicio de sesión (`POST /auth/login`), rotación de JWT (`POST /auth/refresh`), y acceso en 1 clic con cuenta Demo Operator (`operator@aurora.microvm`).
  - Polling en tiempo real configurable (`2s`, `5s`, `15s` o `MANUAL`) y sincronización inmediata tras cada ejecución.
- **Dashboard con Editor Python 3.11, Costes y Telemetría (`/dashboard`)**:
  - **Editor y Dispatcher Manual de Código Python 3.11**: Numeración de líneas, plantillas de prueba (SHA-256 benchmark, bucle con `stderr`, prueba de timeout estricto `time.sleep(5)` y prueba de límite de memoria `32MB > 16MB`), selector de `timeout` y `memory_limit_mb`, y botón manual **DISPATCH MICROVM (`POST /execute`)**.
  - **Métricas de Costes y Uso (`DAILY`, `WEEKLY`, `MONTHLY`, `PROJECTED`)**: Cálculo en tiempo real de segundos acumulados, `GB-seconds`, invocaciones microVM, coste por cómputo y proyección a fin de mes.
  - **Simulador de Cuotas y Cache-Aside (`_fuente`)**: Botones en 1 clic para simular agotamiento de cuota (`14,400s` $\rightarrow$ `HTTP 429`), límite estricto de timeout (`14,399.5s` $\rightarrow$ `0.5s` restantes), compra dummy instantánea de `PRO` (`UNLIMITED`), e inspección de `GET /executions/{id}` observando el cambio de `_fuente: "dynamodb"` a `_fuente: "cache"`.

### Ejecutar el Frontend
```bash
cd frontend
npm install
npm run dev
# Abrir http://localhost:3000
```


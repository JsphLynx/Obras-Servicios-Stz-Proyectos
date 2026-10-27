# Preparación local y configuración

## Qué se puede comprobar sin servicios externos

Requisitos del código: Node.js >= 22.13 y pnpm 11.25.0. El lockfile fija las dependencias. Linux o WSL2 simplifica el uso de los scripts Bash del proyecto.

```bash
pnpm install --frozen-lockfile
cp .openai/hosting.example.json .openai/hosting.json
pnpm test:unit
pnpm typecheck
pnpm build
```

La configuración de ejemplo declara el binding `BUCKET` y no contiene un proyecto de hosting. Permite preparar una compilación local; no provisiona servicios. El script selecciona un perfil portable en un clon limpio. Los scripts de instalación y previsualización conservan componentes del entorno Sites.

## Requisitos para abrir la aplicación con datos

1. Un entorno de ejemplos y otro de prácticas con el esquema completo, funciones, vistas, permisos y datos sintéticos preparados. Las migraciones publicadas son incrementales; no son un instalador de las 104 tablas ni un seed completo.
2. Conexiones con el rol restringido `stz_runtime`, junto con `app_stz.web_environment` y su comprobación de rama correctamente configurados en cada destino.
3. Tablas y configuración de perfiles de usuario. `AUTH_DATABASE_URL` puede separar su conexión; si no se proporciona, la aplicación utiliza `DATABASE_URL`.
4. Una entrada autenticada de confianza compatible con la identidad de Sites. Los encabezados `oai-authenticated-user-id` y `oai-authenticated-user-email` solo son válidos si los establece esa entrada y no pueden ser falsificados por clientes.
5. Almacenamiento privado R2 con binding `BUCKET`, accesible desde las rutas del servidor.

Consulta [SECURITY.md](../SECURITY.md) antes de adaptar el despliegue. La simulación local de identidad no acredita autenticación para un despliegue público.

## Variables

Usa `.dev.vars.example` como inventario y configura los valores mediante el mecanismo de secretos de tu ejecución Workers/Sites. Una conexión no debe estar en variables públicas del cliente.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión del entorno de ejemplos. |
| `PRACTICE_DATABASE_URL` | Conexión distinta para prácticas. |
| `AUTH_DATABASE_URL` | Conexión de perfiles; opcional fuera del QA separado. |
| `STZ_EXAMPLES_BRANCH_ID` | Identificador esperado por el control del entorno de ejemplos. |
| `STZ_PRACTICE_BRANCH_ID` | Identificador esperado por el control del entorno de prácticas. |
| `STZ_OWNER_EMAIL` | Identidad propietaria para el alta inicial de administrador. |

Los identificadores deben coincidir con la configuración de la base, no con un valor elegido en el navegador. Si faltan, el acceso a datos se rechaza. En `migrations/006_environment.sql`, `:branch_id` es un marcador que debe sustituir el responsable tras verificar el destino.

Una vez provisionados los servicios y las variables:

```bash
pnpm dev
```

El perfil portable usa el puerto 5173. Los endpoints son `/api/session`, `/api/data`, `/api/operations`, `/api/documents` y `/api/users`. No se proporciona una cuenta pública de demostración ni se crean roles automáticamente para cualquier visitante.

## Árbol de código

| Ruta | Contenido |
|---|---|
| `app/` | Interfaz, autenticación de entrada y handlers HTTP. |
| `lib/stz/` | Reglas de negocio, contexto, datos, acceso y formularios. |
| `components/`, `hooks/` | Componentes de interfaz y hooks. |
| `migrations/` | Migraciones incrementales conservadas del proyecto. |
| `tests/` | Pruebas unitarias y escenarios de integración. |
| `scripts/`, `build/` | Herramientas de ejecución, compilación y administración. |
| `docs/` | Arquitectura, alcance, evidencia y manuales públicos. |

No ejecutes los scripts administrativos ni los tests de PostgreSQL sobre una base compartida sin preparar un entorno de ensayo. Algunos crean y modifican registros; no forman parte de `pnpm test:unit`.

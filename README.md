# Kidose — Backend

API REST de Kidose (app educativa de dosificación pediátrica de emergencia). Express + Prisma + SQLite con TypeScript. Es un proyecto universitario: no maneja datos médicos reales ni implica responsabilidad médica.

El frontend es otro repositorio (`kidose - frontend`). El recorrido de cada pedido es:

```
Expo (pantalla) → fetch() HTTP/JSON → Express (ruta) → Prisma Client → SQLite → respuesta JSON → Expo
```

La app nunca toca la base: solo habla con esta API.

## Versiones

Node 20 o superior · npm 10 · Express 5 · Prisma 6.19 · TypeScript 5.9.3 (fijo, `ts-node` no es compatible con TS 7).

## Instalación y ejecución

```powershell
cd kidose---backend
npm install
copy .env.example .env     # y completar JWT_SECRET con un texto largo
npm run db:init            # crea las tablas y carga los datos iniciales (se puede repetir)
npm run dev                # queda escuchando en http://localhost:3000
```

Después, el frontend: `npx expo start` en la otra carpeta. Primero el backend, después Expo.

Scripts: `dev` (desarrollo con recarga), `build` (compila a `dist/`), `start` (corre `dist/`), `prisma:generate`, `prisma:migrate`, `db:init` (`prisma db push` + datos iniciales).

`.env`:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="un-texto-largo-y-secreto"
PORT=3000
```

El `.env` y la base (`prisma/dev.db`) no se suben a git. Para empezar de cero: borrar `prisma/dev.db` y correr `npm run db:init`.

## Datos iniciales

| Qué | Detalle |
|---|---|
| Cuentas de prueba | `admin@kidose.com` / `Admin123` · `medico@kidose.com` y `medico2@kidose.com` / `Medico123` · `paciente@kidose.com` / `Paciente123` |
| Registro de matrículas | 123456 Laura Fernández (DNI 30123456), 234567 Martín Gómez (28456789), 345678 Sofía Acosta (33987654). La 345678 queda libre para probar el registro de un médico. |
| Medicamentos | 5 categorías (reanimación, intubación, convulsiones, asma, anafilaxia) tomadas de las tablas por peso del libro de Medicamentos en Emergencias Pediátricas. Ver `src/datos-semilla.ts`. |
| Historial | La paciente de prueba tiene dos atenciones de ejemplo. |

Los medicamentos se vuelven a cargar desde `src/datos-semilla.ts` cada vez que arranca la API, así que ese archivo es la fuente de verdad del catálogo. Cuando el libro da un rango (ketamina y fentanilo, 1–2 por kg) se guarda el mínimo y la nota lo aclara. `dosisMaxima` es la dosis de adulto que el libro muestra en los pesos más altos; si el libro no trae tope queda en `null`.

## Autenticación

`POST /api/auth/login` devuelve un token (JWT, 7 días). Todas las demás rutas, salvo `health`, `login`, `registro` y `matriculas`, exigen el encabezado `Authorization: Bearer <token>`. Las contraseñas se guardan con hash (bcrypt) y nunca se devuelven. Hay tres roles: `medico`, `paciente` y `admin`; cada ruta indica quién puede usarla (403 si el rol no corresponde).

Una cuenta de médico nueva queda en estado `pendiente` y no puede ingresar hasta que un admin la apruebe.

## Endpoints

Errores: siempre `{ "error": "mensaje" }`. Códigos: 200 lectura/actualización · 201 alta · 400 datos inválidos · 401 sin sesión · 403 sin permiso · 404 no existe · 409 ya existe · 410 código vencido · 500 error del servidor.

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| GET | `/api/health` | todos | Confirma que el servidor está encendido → `{ ok: true }` |
| POST | `/api/auth/login` | todos | Body `{ email, contrasena }` → `{ token, usuario }`. 401 si son incorrectos, 403 si la cuenta está pendiente o rechazada |
| GET | `/api/auth/yo` | con sesión | Devuelve el usuario del token |
| POST | `/api/auth/registro` | todos | Crea una cuenta. 201. Médico: `rol, nombre, dni, email, contrasena, matricula, hospital` (la matrícula debe existir y coincidir con nombre y DNI; queda pendiente). Paciente: `rol, nombre, dni, email, contrasena, fechaNacimiento, pesoKg, alergias[], direccion, latitud, longitud` |
| GET | `/api/matriculas/:matricula` | todos | Consulta el registro de matrículas (404 si no figura) |
| GET | `/api/usuarios?estado=pendiente` | admin | Lista cuentas de médicos |
| PATCH | `/api/usuarios/:id` | admin | Body `{ estado: "aprobada" \| "rechazada" }` |
| GET | `/api/pacientes/:id` | médico, o el propio paciente | Datos del paciente con sus alergias |
| PATCH | `/api/pacientes/:id` | médico, o el propio paciente | Cambia solo lo enviado: `pesoKg` (ambos) y `alergias` (solo el paciente) |
| POST | `/api/qr` | paciente | Genera el código de su QR (vence a los 5 min) → `{ codigo, venceEn }`. 201 |
| POST | `/api/qr/leer` | médico | Body `{ codigo }` → el paciente. 404 si no existe, 410 si venció |
| GET | `/api/categorias` | con sesión | Categorías con sus medicamentos |
| GET | `/api/atenciones?pacienteId=` | médico (obligatorio) o paciente (solo las suyas) | Historial, de la más nueva a la más vieja |
| POST | `/api/atenciones` | médico | Body `{ pacienteId, pesoKg, dosis: [{ medicamentoId, cantidad, hora }] }`. Valida que ninguna dosis supere peso × dosis por kg ni la dosis máxima; guarda la atención y actualiza el peso del paciente en una sola transacción. 201 |

## Probar la API sin la app (PowerShell)

```powershell
Invoke-RestMethod http://localhost:3000/api/health

# Login y token
$login = @{ email = "medico@kidose.com"; contrasena = "Medico123" } | ConvertTo-Json
$sesion = Invoke-RestMethod http://localhost:3000/api/auth/login -Method Post -ContentType "application/json" -Body $login
$h = @{ Authorization = "Bearer $($sesion.token)" }

# Leer medicamentos
Invoke-RestMethod http://localhost:3000/api/categorias -Headers $h

# Un pedido inválido devuelve 400 (acá falta el email)
$mal = @{ contrasena = "x" } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api/auth/login -Method Post -ContentType "application/json" -Body $mal
```

## Modelos de datos (`prisma/schema.prisma`)

| Modelo | Para qué |
|---|---|
| `Usuario` | Una tabla para médico, paciente y admin (`rol`). Los campos que no corresponden al rol quedan en null |
| `Alergia` | Alergias del paciente (1 paciente → N alergias) |
| `CodigoQr` | Código aleatorio con vencimiento que muestra el QR del paciente |
| `Matricula` | Registro de matrículas contra el que se verifica a los médicos |
| `Categoria`, `Medicamento` | Catálogo de la calculadora |
| `Atencion`, `Dosis` | Historial: una atención tiene muchas dosis suministradas |

## Qué hace cada archivo

| Archivo | Responsabilidad |
|---|---|
| `src/index.ts` | Configuración de Express, montaje de rutas, errores 404/500 y arranque |
| `src/initDb.ts` | Datos iniciales (idempotente) |
| `src/datos-semilla.ts` | Medicamentos del libro y registro de matrículas |
| `src/prisma.ts` | Única instancia de `PrismaClient` |
| `src/auth.ts` | Token JWT, middleware de sesión y de roles |
| `src/validaciones.ts` | Validaciones hechas a mano (sin regex ni librerías) |
| `src/rutas/*.ts` | Un archivo por recurso |

## Checklist

- [ ] `npm run dev` deja la API escuchando en el puerto 3000
- [ ] `/api/health` devuelve `{ ok: true }`
- [ ] Login con las cuentas de prueba y rutas protegidas con token
- [ ] El registro de un médico queda pendiente y el admin lo aprueba
- [ ] `npx tsc --noEmit` y `npm run build` pasan sin errores

# FinanceLab

Radar privado de inversión de Ramón, servido en [ramonruizherrero.com/apps/finanzas](https://www.ramonruizherrero.com/apps/finanzas). Código fuente en este repositorio; integración de producción en `ruizherrero1/Web`.

## Incluye

- Universo seleccionado de 26 índices y empresas de EE. UU. y Europa, filtros y seguimiento privado.
- Precios e históricos indicativos de Yahoo Finance; variaciones de 21, 63 y 252 sesiones, media de 200 sesiones y volumen relativo.
- Índices oficiales de declaraciones PTR de la Cámara de Representantes del año actual y anterior; búsqueda por declarante. Lectura parcial de los PDF con identificación del cónyuge y de opciones cuando figura en el documento.
- Operaciones declaradas de Trump tomadas de la página pública de Quiver, con fechas de operación y publicación separadas. Muestra una selección reciente, no un histórico completo.
- Órdenes ejecutivas del Federal Register y titulares enlazados de Google News.
- Diario privado de simulaciones: tesis, riesgo, horizonte, precio y fecha del dato de entrada, cierre y persistencia en Supabase.

No ejecuta operaciones, no conecta con un broker y no promete rentabilidad. El filtro de tendencias es descriptivo y no está validado como estrategia. El diario mide variación de precio: excluye dividendos, comisiones, impuestos, cambio de divisa y ajustes posteriores por splits.

## Acceso y datos

Reutiliza el proyecto Supabase y la sesión del hub TravelKit/Viajes. Cada endpoint verifica el token con `auth.getUser`, exige correo confirmado y comprueba una fila de propietario en `finance_workspace`. RLS permite leer y modificar solo al propietario preaprovisionado; los usuarios no pueden darse acceso ni cambiar el propietario. No hay una clave de servicio en el navegador ni una excepción de autenticación en desarrollo.

La página de inicio de sesión es pública. El dashboard y los datos personales solo se entregan tras autorizar al propietario. Las respuestas usan `Cache-Control: private, no-store`. El esquema de la tabla está en `database/schema.sql`; fue aplicado mediante la migración remota `finance_private_workspace`. La identidad del propietario se provisiona por administración y no está en el repositorio público.

## Actualización y límites

Se consulta al abrir y cada 15 minutos mientras la pestaña esté visible. Caché de servidor: cotizaciones 15 minutos, política y declaraciones 6 horas, titulares 1 hora. No hay tareas de fondo ni avisos por correo. Los límites de caché son de revalidación; cada cotización muestra su fecha real del proveedor.

Yahoo y la página pública de Quiver son fuentes sin SLA y pueden bloquearse o cambiar de formato. Si hay un fallo se informa en pantalla; nunca se muestran datos inventados. Los índices oficiales no incluyen Senado; el lector PDF es deliberadamente conservador y puede omitir filas o formatos desconocidos. Revisar siempre el PDF original, incluidas descripciones y rectificaciones. Las operaciones no demuestran quién tomó la decisión ni conocimiento privilegiado.

## Desarrollo

Node.js 22.13 o posterior (probado con 24). `npm ci`, copiar `.env.example` a `.env.local` y configurar las dos variables públicas del mismo proyecto Supabase del hub. Después `npm run dev` y abrir `/apps/finanzas`. Sin configuración o sin propietario autorizado el acceso queda cerrado.

- `npm test`: métricas, fechas, extracción y rechazo de accesos.
- `npm run build`: compilación, TypeScript y generación de rutas.
- `npm audit`: dependencias.
- `node scripts/mock-auth.mjs`: servidor de autenticación simulado **solo en 127.0.0.1:3101**, para las pruebas de interfaz. No se copia a Web ni se despliega.
- Para la prueba visual, arrancar otro proceso Next en el puerto 3100 con `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3101` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test-key`; ejecutar `node scripts/check-ui.mjs`. Usa una cuenta ficticia y fuentes públicas reales, Chrome sin interfaz y capturas en `scratch/`.

## Integración y publicación

`npm run sync:web -- RUTA_AL_REPO_WEB` copia únicamente `src/app/apps/finanzas`, `src/app/api/finanzas` y `src/lib/finanzas`. Usa el cliente Supabase ya existente de Web y actualiza las dependencias necesarias. Confirmar el código aquí **antes** de sincronizar. Revisar cambios y ejecutar `npm install`, `npm run lint` y `npm run build` en Web. La tarjeta FinanceLab enlaza a `/apps/finanzas`; no se incluye en el sitemap.

El despliegue lo hace la integración GitHub/Vercel existente de Web. No necesita un proyecto nuevo ni una suscripción de datos. Las futuras modificaciones deben hacerse aquí y sincronizarse: no editar las copias por separado. Para revertir la interfaz se revierte el cambio de Web; no borrar la tabla del diario.

Fuentes: [Yahoo Finance](https://finance.yahoo.com/), [Cámara](https://disclosures-clerk.house.gov/FinancialDisclosure), [Quiver Trump](https://www.quiverquant.com/Donald-Trump-Stock-Trades/), [Federal Register](https://www.federalregister.gov/), [plazos PTR](https://ethics.house.gov/periodic-transaction-report-calculator/).

// dotenv carga las variables definidas en backend/.env.
import "dotenv/config";

// Dependencias externas: servidor HTTP y CORS.
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";

// Codigo propio del proyecto.
import { initDatabase } from "./initDb";
import { rutasAtenciones } from "./rutas/atenciones";
import { rutasAuth } from "./rutas/auth";
import { rutasCategorias } from "./rutas/categorias";
import { rutasMatriculas } from "./rutas/matriculas";
import { rutasPacientes } from "./rutas/pacientes";
import { rutasQr } from "./rutas/qr";
import { rutasUsuarios } from "./rutas/usuarios";

// -----------------------------------------------------------------------------
// 1. Configuracion inicial
// -----------------------------------------------------------------------------
const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors()); // permite que Expo se conecte desde otro origen
app.use(express.json()); // transforma el body JSON en req.body

// -----------------------------------------------------------------------------
// 2. Rutas de la API REST
// -----------------------------------------------------------------------------

// GET /api/health
// Ruta de prueba: confirma que Express esta encendido.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", rutasAuth);
app.use("/api/matriculas", rutasMatriculas);
app.use("/api/usuarios", rutasUsuarios);
app.use("/api/pacientes", rutasPacientes);
app.use("/api/qr", rutasQr);
app.use("/api/categorias", rutasCategorias);
app.use("/api/atenciones", rutasAtenciones);

// Ruta que no existe: 404 en JSON, igual que el resto de los errores.
app.use((_req, res) => {
  res.status(404).json({ error: "La ruta no existe" });
});

// Ultimo middleware: cualquier error inesperado responde 500 en vez de dejar la respuesta vacia.
// El body JSON mal formado es un error del cliente (400).
app.use((error: { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (error.type === "entity.parse.failed") {
    res.status(400).json({ error: "El JSON enviado no es válido" });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Error interno" });
});

// -----------------------------------------------------------------------------
// 3. Arranque del servidor
// -----------------------------------------------------------------------------
async function start() {
  await initDatabase();
  app.listen(port, () => {
    console.log(`API escuchando en http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("No se pudo iniciar la API", error);
  process.exit(1);
});

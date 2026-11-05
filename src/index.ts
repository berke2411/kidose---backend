import "dotenv/config";

import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";

import { initDatabase } from "./initDb";
import { rutasAtenciones } from "./rutas/atenciones";
import { rutasAuth } from "./rutas/auth";
import { rutasLibro } from "./rutas/libro";
import { rutasMatriculas } from "./rutas/matriculas";
import { rutasPacientes } from "./rutas/pacientes";
import { rutasQr } from "./rutas/qr";
import { rutasUsuarios } from "./rutas/usuarios";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", rutasAuth);
app.use("/api/matriculas", rutasMatriculas);
app.use("/api/usuarios", rutasUsuarios);
app.use("/api/pacientes", rutasPacientes);
app.use("/api/qr", rutasQr);
app.use("/api/libro", rutasLibro);
app.use("/api/atenciones", rutasAtenciones);

app.use((_req, res) => {
  res.status(404).json({ error: "La ruta no existe" });
});

app.use((error: { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (error.type === "entity.parse.failed") {
    res.status(400).json({ error: "El JSON enviado no es válido" });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Error interno" });
});

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

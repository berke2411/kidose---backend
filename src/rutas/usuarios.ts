import { Router } from "express";

import { autenticar, soloRol, usuarioPublico } from "../auth";
import { prisma } from "../prisma";
import { parseId, texto } from "../validaciones";

export const rutasUsuarios = Router();

// Todo lo de este archivo es solo para administradores.
rutasUsuarios.use(autenticar, soloRol("admin"));

const ESTADOS = ["pendiente", "aprobada", "rechazada"];

// GET /api/usuarios?estado=pendiente
// Lista las cuentas de medicos, opcionalmente filtradas por estado.
rutasUsuarios.get("/", async (req, res) => {
  const estado = texto(req.query.estado);
  if (estado !== "" && !ESTADOS.includes(estado)) {
    res.status(400).json({ error: "El estado no es válido" });
    return;
  }

  const medicos = await prisma.usuario.findMany({
    where: { rol: "medico", ...(estado !== "" ? { estado } : {}) },
    orderBy: { createdAt: "desc" },
  });
  res.json(medicos.map((medico) => usuarioPublico(medico)));
});

// PATCH /api/usuarios/:id
// Aprueba o rechaza la solicitud de un medico.
rutasUsuarios.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "El id no es válido" });
    return;
  }

  const estado = texto(req.body?.estado);
  if (estado !== "aprobada" && estado !== "rechazada") {
    res.status(400).json({ error: "El estado debe ser aprobada o rechazada" });
    return;
  }

  const medico = await prisma.usuario.findUnique({ where: { id } });
  if (!medico || medico.rol !== "medico") {
    res.status(404).json({ error: "No existe la solicitud" });
    return;
  }

  const actualizado = await prisma.usuario.update({ where: { id }, data: { estado } });
  res.json(usuarioPublico(actualizado));
});

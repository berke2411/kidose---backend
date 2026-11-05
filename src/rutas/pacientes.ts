import type { Usuario } from "@prisma/client";
import { Router } from "express";

import { autenticar, soloRol, usuarioPublico } from "../auth";
import { prisma } from "../prisma";
import { esAlergenoDelLibro, normalizarPeso } from "../libro";
import { limpiarAlergias, parseId, validarPeso } from "../validaciones";

export const rutasPacientes = Router();

rutasPacientes.use(autenticar, soloRol("medico", "paciente"));

function puedeAcceder(usuario: Usuario, pacienteId: number): boolean {
  return usuario.rol === "medico" || usuario.id === pacienteId;
}

// GET /api/pacientes/:id
rutasPacientes.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "El id no es válido" });
    return;
  }
  if (!puedeAcceder(res.locals.usuario, id)) {
    res.status(403).json({ error: "No tenés permiso para ver a este paciente" });
    return;
  }

  const paciente = await prisma.usuario.findFirst({
    where: { id, rol: "paciente" },
    include: { alergias: true },
  });
  if (!paciente) {
    res.status(404).json({ error: "No existe el paciente" });
    return;
  }
  res.json(usuarioPublico(paciente));
});

// PATCH /api/pacientes/:id
rutasPacientes.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "El id no es válido" });
    return;
  }
  const usuario: Usuario = res.locals.usuario;
  if (!puedeAcceder(usuario, id)) {
    res.status(403).json({ error: "No tenés permiso para modificar a este paciente" });
    return;
  }

  const { pesoKg, alergias } = req.body ?? {};
  const data: { pesoKg?: number } = {};

  if (pesoKg !== undefined) {
    const error = validarPeso(pesoKg);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    data.pesoKg = normalizarPeso(pesoKg) ?? undefined;
  }

  let nuevasAlergias: string[] | null = null;
  if (alergias !== undefined) {
    if (usuario.rol !== "paciente") {
      res.status(403).json({ error: "Solo el paciente puede cambiar sus alergias" });
      return;
    }
    nuevasAlergias = limpiarAlergias(alergias);
    if (nuevasAlergias === null) {
      res.status(400).json({ error: "Las alergias no son válidas" });
      return;
    }
  }

  if (Object.keys(data).length === 0 && nuevasAlergias === null) {
    res.status(400).json({ error: "No hay campos para actualizar" });
    return;
  }

  const existe = await prisma.usuario.findFirst({ where: { id, rol: "paciente" }, include: { alergias: true } });
  if (!existe) {
    res.status(404).json({ error: "No existe el paciente" });
    return;
  }

  const yaCargadas = existe.alergias.map((alergia) => alergia.nombre.toLowerCase());
  if (nuevasAlergias !== null && !nuevasAlergias.every((nombre) => esAlergenoDelLibro(nombre) || yaCargadas.includes(nombre.toLowerCase()))) {
    res.status(400).json({ error: "Las alergias tienen que ser de la lista del libro" });
    return;
  }

  const alergiasFinales = nuevasAlergias;
  const paciente = await prisma.$transaction(async (tx) => {
    if (alergiasFinales !== null) {
      await tx.alergia.deleteMany({ where: { pacienteId: id } });
      await tx.alergia.createMany({
        data: alergiasFinales.map((nombre) => ({ nombre, pacienteId: id })),
      });
    }
    return tx.usuario.update({ where: { id }, data, include: { alergias: true } });
  });
  res.json(usuarioPublico(paciente));
});

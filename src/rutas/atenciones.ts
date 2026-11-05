import type { FilaLibro, Prisma, Usuario } from "@prisma/client";
import { Router } from "express";

import { autenticar, soloRol } from "../auth";
import { prisma } from "../prisma";
import { normalizarPeso } from "../libro";
import { parseFecha, parseId, validarPeso } from "../validaciones";

export const rutasAtenciones = Router();

rutasAtenciones.use(autenticar);

const incluirAtencion = {
  medico: { select: { id: true, nombre: true } },
  dosis: { orderBy: { hora: "asc" as const }, include: { medicamento: true } },
};

// GET /api/atenciones?pacienteId=1
rutasAtenciones.get("/", soloRol("medico", "paciente"), async (req, res) => {
  const usuario: Usuario = res.locals.usuario;
  let pacienteId: number | null;

  if (usuario.rol === "paciente") {
    pacienteId = req.query.pacienteId === undefined ? usuario.id : parseId(req.query.pacienteId);
    if (pacienteId !== usuario.id) {
      res.status(403).json({ error: "No tenés permiso para ver este historial" });
      return;
    }
  } else {
    pacienteId = parseId(req.query.pacienteId);
    if (!pacienteId) {
      res.status(400).json({ error: "Falta el paciente" });
      return;
    }
  }

  const atenciones = await prisma.atencion.findMany({
    where: { pacienteId },
    orderBy: { fecha: "desc" },
    include: incluirAtencion,
  });
  res.json(atenciones);
});

function resumenDeLaFila(fila: FilaLibro): string {
  const partes = [fila.dosisKg, fila.indicar, fila.administrar === "" ? "" : `Administrar ${fila.administrar}`, fila.preparar];
  const lineas = fila.detalle === "" ? [] : fila.detalle.split("\n");
  return [...partes, ...lineas].filter((parte) => parte !== "").join(" · ").slice(0, 600);
}

// POST /api/atenciones
rutasAtenciones.post("/", soloRol("medico"), async (req, res) => {
  const medico: Usuario = res.locals.usuario;
  const cuerpo = req.body ?? {};

  const pacienteId = parseId(cuerpo.pacienteId);
  if (!pacienteId) {
    res.status(400).json({ error: "Falta el paciente" });
    return;
  }

  const errorPeso = validarPeso(cuerpo.pesoKg);
  if (errorPeso) {
    res.status(400).json({ error: errorPeso });
    return;
  }
  const pesoKg = normalizarPeso(cuerpo.pesoKg);
  if (pesoKg === null) {
    res.status(400).json({ error: "El peso es menor al de las tablas del libro" });
    return;
  }

  if (!Array.isArray(cuerpo.dosis) || cuerpo.dosis.length === 0) {
    res.status(400).json({ error: "Falta suministrar al menos una dosis" });
    return;
  }
  if (cuerpo.dosis.length > 50) {
    res.status(400).json({ error: "Hay demasiadas dosis en una sola atención" });
    return;
  }

  const paciente = await prisma.usuario.findFirst({ where: { id: pacienteId, rol: "paciente" } });
  if (!paciente) {
    res.status(404).json({ error: "No existe el paciente" });
    return;
  }

  const ids: number[] = [];
  for (const item of cuerpo.dosis) {
    const medicamentoId = parseId(item?.medicamentoId);
    if (!medicamentoId) {
      res.status(400).json({ error: "Hay una dosis sin medicamento válido" });
      return;
    }
    ids.push(medicamentoId);
  }
  const medicamentos = await prisma.medicamento.findMany({
    where: { id: { in: ids } },
    include: { filas: { where: { peso: pesoKg } } },
  });

  const dosisParaCrear: Prisma.DosisUncheckedCreateWithoutAtencionInput[] = [];
  for (const item of cuerpo.dosis) {
    const medicamento = medicamentos.find((otro) => otro.id === Number(item.medicamentoId));
    if (!medicamento) {
      res.status(404).json({ error: "No existe uno de los medicamentos" });
      return;
    }

    const cantidad = item.cantidad;
    if (typeof cantidad !== "number" || !(cantidad > 0)) {
      res.status(400).json({ error: `La cantidad de ${medicamento.nombre} no es válida` });
      return;
    }

    const fila = medicamento.filas[0];
    if (!fila) {
      res.status(400).json({ error: `El libro no tiene ${medicamento.nombre} en la tabla de ${pesoKg} kg` });
      return;
    }
    if (cantidad < fila.cantidadMin * 0.999 || cantidad > fila.cantidadMax * 1.001) {
      res.status(400).json({ error: `La dosis de ${medicamento.nombre} no coincide con la del libro para ${pesoKg} kg` });
      return;
    }

    const hora = item.hora === undefined ? new Date() : parseFecha(item.hora);
    if (!hora) {
      res.status(400).json({ error: "La hora de una dosis no es válida" });
      return;
    }

    dosisParaCrear.push({
      medicamentoId: medicamento.id,
      nombre: medicamento.nombre,
      via: medicamento.via,
      cantidad,
      unidad: fila.unidad,
      detalle: resumenDeLaFila(fila),
      hora,
    });
  }

  const atencion = await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: pacienteId }, data: { pesoKg } });
    return tx.atencion.create({
      data: {
        pacienteId,
        medicoId: medico.id,
        lugar: medico.hospital ?? "",
        pesoKg,
        dosis: { create: dosisParaCrear },
      },
      include: incluirAtencion,
    });
  });

  res.status(201).json(atencion);
});

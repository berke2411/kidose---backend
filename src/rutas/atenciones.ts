import type { Prisma, Usuario } from "@prisma/client";
import { Router } from "express";

import { autenticar, soloRol } from "../auth";
import { prisma } from "../prisma";
import { parseFecha, parseId, validarPeso } from "../validaciones";

export const rutasAtenciones = Router();

rutasAtenciones.use(autenticar);

// Lo que se devuelve de cada atencion: el medico, y las dosis con su medicamento
// (la app lo usa para mostrar las contraindicaciones desde el historial).
const incluirAtencion = {
  medico: { select: { id: true, nombre: true } },
  dosis: { orderBy: { hora: "asc" as const }, include: { medicamento: true } },
};

// GET /api/atenciones?pacienteId=3
// El paciente ve solo las suyas; el medico elige de que paciente.
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

// POST /api/atenciones
// El medico envia la atencion: las dosis que suministro a un paciente.
// Se valida que ninguna dosis supere lo que da el peso (y el tope) del medicamento.
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
  const pesoKg: number = cuerpo.pesoKg;

  if (!Array.isArray(cuerpo.dosis) || cuerpo.dosis.length === 0) {
    res.status(400).json({ error: "Falta suministrar al menos una dosis" });
    return;
  }

  const paciente = await prisma.usuario.findFirst({ where: { id: pacienteId, rol: "paciente" } });
  if (!paciente) {
    res.status(404).json({ error: "No existe el paciente" });
    return;
  }

  // Se buscan todos los medicamentos de una vez.
  const ids: number[] = [];
  for (const item of cuerpo.dosis) {
    const medicamentoId = parseId(item?.medicamentoId);
    if (!medicamentoId) {
      res.status(400).json({ error: "Hay una dosis sin medicamento válido" });
      return;
    }
    ids.push(medicamentoId);
  }
  const medicamentos = await prisma.medicamento.findMany({ where: { id: { in: ids } } });

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

    // Mismo calculo que la calculadora: peso x dosis por kg, con tope en la dosis maxima.
    let calculada = pesoKg * medicamento.dosisPorKg;
    if (medicamento.dosisMaxima !== null && calculada > medicamento.dosisMaxima) {
      calculada = medicamento.dosisMaxima;
    }
    if (cantidad > calculada * 1.001) {
      res.status(400).json({ error: `La dosis de ${medicamento.nombre} supera la calculada para el peso` });
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
      unidad: medicamento.unidad,
      hora,
    });
  }

  // La atencion y el nuevo peso se guardan juntos: o se guarda todo o nada.
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

  // 201 indica que se creo un recurso nuevo.
  res.status(201).json(atencion);
});

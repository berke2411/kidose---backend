import type { Usuario } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { Router } from "express";

import { autenticar, soloRol, usuarioPublico } from "../auth";
import { prisma } from "../prisma";
import { texto } from "../validaciones";

export const rutasQr = Router();

rutasQr.use(autenticar);

// El codigo del QR dura 5 minutos: una foto vieja del QR no sirve para acceder al paciente.
const MINUTOS_DE_VIDA = 5;

// POST /api/qr
// El paciente pide un codigo nuevo para mostrar en su QR.
rutasQr.post("/", soloRol("paciente"), async (_req, res) => {
  const paciente: Usuario = res.locals.usuario;

  // Se borran los codigos vencidos de este paciente para que la tabla no crezca.
  await prisma.codigoQr.deleteMany({ where: { pacienteId: paciente.id, venceEn: { lt: new Date() } } });

  const venceEn = new Date(Date.now() + MINUTOS_DE_VIDA * 60 * 1000);
  const codigoQr = await prisma.codigoQr.create({
    data: { codigo: randomBytes(8).toString("hex"), pacienteId: paciente.id, venceEn },
  });
  res.status(201).json({ codigo: codigoQr.codigo, venceEn: codigoQr.venceEn });
});

// POST /api/qr/leer
// El medico manda el codigo leido con la camara y recibe al paciente.
rutasQr.post("/leer", soloRol("medico"), async (req, res) => {
  const codigo = texto(req.body?.codigo);
  if (codigo === "") {
    res.status(400).json({ error: "Falta el código" });
    return;
  }

  const codigoQr = await prisma.codigoQr.findUnique({ where: { codigo } });
  if (!codigoQr) {
    res.status(404).json({ error: "El código no pertenece a ningún paciente de Kidose" });
    return;
  }
  if (codigoQr.venceEn < new Date()) {
    res.status(410).json({ error: "El código venció. Pedile al paciente que actualice su QR" });
    return;
  }

  const paciente = await prisma.usuario.findUnique({
    where: { id: codigoQr.pacienteId },
    include: { alergias: true },
  });
  res.json(usuarioPublico(paciente!));
});

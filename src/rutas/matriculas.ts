import { Router } from "express";

import { prisma } from "../prisma";
import { validarMatricula } from "../validaciones";

export const rutasMatriculas = Router();

// GET /api/matriculas/:matricula
// Consulta el registro de matriculas: la app lo usa para verificar al medico mientras escribe.
// Es publica porque el medico todavia no tiene cuenta cuando se registra.
rutasMatriculas.get("/:matricula", async (req, res) => {
  const matricula = String(req.params.matricula);
  const error = validarMatricula(matricula);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const registrado = await prisma.matricula.findUnique({ where: { matricula } });
  if (!registrado) {
    res.status(404).json({ error: "Esta matrícula no figura en el registro" });
    return;
  }

  res.json({
    matricula: registrado.matricula,
    nombre: registrado.nombre,
    dni: registrado.dni,
    especialidad: registrado.especialidad,
  });
});

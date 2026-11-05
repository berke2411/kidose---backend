import { Router } from "express";

import { prisma } from "../prisma";
import { validarMatricula } from "../validaciones";

export const rutasMatriculas = Router();

// GET /api/matriculas/:matricula
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

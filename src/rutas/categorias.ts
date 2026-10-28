import { Router } from "express";

import { autenticar } from "../auth";
import { prisma } from "../prisma";

export const rutasCategorias = Router();

rutasCategorias.use(autenticar);

// GET /api/categorias
// Categorias con sus medicamentos, en el orden en que se muestran en la calculadora.
rutasCategorias.get("/", async (_req, res) => {
  const categorias = await prisma.categoria.findMany({
    orderBy: { orden: "asc" },
    include: { medicamentos: { orderBy: { orden: "asc" } } },
  });
  res.json(categorias);
});

import { Router } from "express";

import { autenticar, soloRol } from "../auth";
import { ALERGENOS } from "../datos-semilla";
import { calcular, leerJson, normalizarPeso, pesosDelLibro } from "../libro";
import type { Calculo } from "../libro";
import { prisma } from "../prisma";

export const rutasLibro = Router();

type FichaGeneral = {
  clave: string;
  nombre: string;
  items: {
    nombre: string;
    dosis?: string;
    maximo?: string;
    info?: string;
    pasos?: string[];
    calc?: Calculo[];
  }[];
};

type Generales = {
  avisos: string[];
  edadPeso: { edad: string; etiqueta: string; kg: number; texto: string }[];
  formulas: { nombre: string; texto: string }[];
  fichas: FichaGeneral[];
};

const generales = leerJson<Generales>("generales.json");

rutasLibro.get("/pesos", (_req, res) => {
  res.json({ pesos: pesosDelLibro(), edadPeso: generales.edadPeso, avisos: generales.avisos });
});

rutasLibro.get("/alergenos", (_req, res) => {
  res.json({ alergenos: ALERGENOS });
});

function pesoDelPedido(valor: unknown): { ingresado: number; peso: number } | string {
  const ingresado = Number(String(valor ?? "").split(",").join("."));
  if (!Number.isFinite(ingresado)) return "Falta el peso";
  const peso = normalizarPeso(ingresado);
  if (peso === null) return `El libro no tiene tablas para menos de ${pesosDelLibro()[0]} kg`;
  return { ingresado, peso };
}

rutasLibro.use(autenticar, soloRol("medico"));

rutasLibro.get("/tabla", async (req, res) => {
  const elegido = pesoDelPedido(req.query.peso);
  if (typeof elegido === "string") {
    res.status(400).json({ error: elegido });
    return;
  }

  const filas = await prisma.filaLibro.findMany({
    where: { peso: elegido.peso, medicamento: { activo: true } },
    include: { medicamento: { include: { categoria: true } } },
  });
  filas.sort(
    (a, b) =>
      a.medicamento.categoria.orden - b.medicamento.categoria.orden || a.medicamento.orden - b.medicamento.orden
  );

  const categorias: {
    clave: string;
    nombre: string;
    nota: string | null;
    items: object[];
  }[] = [];
  for (const fila of filas) {
    const { medicamento } = fila;
    let categoria = categorias.find((otra) => otra.clave === medicamento.categoria.clave);
    if (!categoria) {
      categoria = { clave: medicamento.categoria.clave, nombre: medicamento.categoria.nombre, nota: medicamento.categoria.nota, items: [] };
      categorias.push(categoria);
    }
    categoria.items.push({
      medicamentoId: medicamento.id,
      nombre: medicamento.nombre,
      principioActivo: medicamento.principioActivo,
      viaCima: medicamento.viaCima,
      via: medicamento.via,
      esCritico: medicamento.esCritico,
      dosisKg: fila.dosisKg,
      indicar: fila.indicar,
      preparar: fila.preparar,
      administrar: fila.administrar,
      alerta: fila.alerta,
      detalle: fila.detalle === "" ? [] : fila.detalle.split("\n"),
      cantidadMin: fila.cantidadMin,
      cantidadMax: fila.cantidadMax,
      unidad: fila.unidad,
      correccion: fila.correccion,
    });
  }

  res.json({ pesoIngresado: elegido.ingresado, peso: elegido.peso, categorias });
});

rutasLibro.get("/generales", (req, res) => {
  const elegido = pesoDelPedido(req.query.peso);
  if (typeof elegido === "string") {
    res.status(400).json({ error: elegido });
    return;
  }

  const fichas = generales.fichas.map((ficha) => ({
    clave: ficha.clave,
    nombre: ficha.nombre,
    items: ficha.items.map(({ calc, ...item }) => ({
      ...item,
      calculos: (calc ?? []).map((regla) => calcular(regla, elegido.peso)).filter((resultado) => resultado !== null),
    })),
  }));

  res.json({
    peso: elegido.peso,
    formulas: generales.formulas,
    fichas,
  });
});

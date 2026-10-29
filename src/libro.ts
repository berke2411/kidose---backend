import fs from "node:fs";
import path from "node:path";

import { ALERGENOS } from "./datos-semilla";
import { prisma } from "./prisma";

export function leerJson<T>(archivo: string): T {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", archivo), "utf8")) as T;
}

// Los pesos son los de las tablas del libro (se cargan de la base al arrancar).
let pesos: number[] = [];

export async function cargarPesos(): Promise<void> {
  const filas = await prisma.filaLibro.findMany({ distinct: ["peso"], select: { peso: true }, orderBy: { peso: "asc" } });
  pesos = filas.map((fila) => fila.peso);
}

export function pesosDelLibro(): number[] {
  return pesos;
}

// El libro solo tiene tablas para ciertos pesos: siempre se usa el de la tabla que no supera al peso real
// (11,7 kg se trata como 11 kg). Devuelve null si el peso es menor al de la primera tabla.
export function normalizarPeso(peso: number): number | null {
  let elegido: number | null = null;
  for (const candidato of pesos) {
    if (candidato <= peso) elegido = candidato;
  }
  return elegido;
}

export function esAlergenoDelLibro(nombre: string): boolean {
  return ALERGENOS.some((alergeno) => alergeno.nombre.toLowerCase() === nombre.toLowerCase());
}

export type Calculo = {
  etiqueta: string;
  porKg?: number[];
  fija?: number[];
  unidad: string;
  por?: string;
  tope?: number;
  pesoDesde?: number;
  pesoHasta?: number;
};

export type ResultadoCalculo = {
  etiqueta: string;
  min: number;
  max: number | null;
  unidad: string;
  por: string | null;
  tope: number | null;
  llegoAlTope: boolean;
};

function redondear(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

// Dosis por kg (o dosis fija por franja de peso) con su tope, tal como lo indica el libro.
// Devuelve null si la regla no corresponde a este peso.
export function calcular(calculo: Calculo, peso: number): ResultadoCalculo | null {
  if (calculo.pesoDesde !== undefined && peso < calculo.pesoDesde) return null;
  if (calculo.pesoHasta !== undefined && peso > calculo.pesoHasta) return null;

  const base = calculo.fija ?? (calculo.porKg ?? []).map((porKg) => porKg * peso);
  if (base.length === 0) return null;

  let llegoAlTope = false;
  const valores = base.map((valor) => {
    if (calculo.tope !== undefined && valor >= calculo.tope) {
      llegoAlTope = true;
      return calculo.tope;
    }
    return redondear(valor);
  });

  return {
    etiqueta: calculo.etiqueta,
    min: valores[0],
    max: valores.length > 1 && valores[1] !== valores[0] ? valores[1] : null,
    unidad: calculo.unidad,
    por: calculo.por ?? null,
    tope: calculo.tope ?? null,
    llegoAlTope,
  };
}

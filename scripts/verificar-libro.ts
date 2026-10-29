import { IDENTIDADES } from "../src/datos-semilla";
import { leerJson } from "../src/libro";

// Revisa que data/libro.json sea consistente con las propias cuentas del libro:
// 1) la dosis que indica cada fila es la dosis por kg por el peso de la tabla,
// 2) el volumen a administrar es la dosis dividida por la concentracion de la preparacion,
// 3) toda fila tiene su identidad cargada en datos-semilla.ts.
// Uso: npm run verificar:libro

type Fila = {
  nombre: string;
  dosisKg?: string;
  indicar?: string;
  preparar?: string;
  administrar?: string;
};
type Libro = { tablas: { peso: number; secciones: Record<string, Fila[]> }[] };

const EN_MG: Record<string, number> = { mg: 1, mcg: 0.001, g: 1000 };

function numero(texto: string): number {
  return Number(texto.split(",").join("."));
}

function sinRuido(texto: string | undefined): string {
  return (texto ?? "").split("(γ)").join("").split(" ").join("");
}

// "14-28mg", "1,4mg", "70mcg": rango y unidad (las cantidades en mg se llevan a mg)
function cantidad(texto: string | undefined): { min: number; max: number; unidad: string } | null {
  const partes = sinRuido(texto).match(/^([\d.,]+)(?:[-–]([\d.,]+))?(mg|mcg|g|mL|ml)$/);
  if (!partes) return null;
  const unidad = partes[3] === "ml" ? "mL" : partes[3];
  const factor = EN_MG[unidad] ?? 1;
  const min = numero(partes[1]) * factor;
  return { min, max: partes[2] ? numero(partes[2]) * factor : min, unidad };
}

// El libro redondea a un decimal, por eso los volumenes toleran hasta 0,07 mL de diferencia
function cercano(real: number, esperado: number, margen = 0.011): boolean {
  return Math.abs(real - esperado) <= Math.max(0.07 * esperado, margen);
}

const libro = leerJson<Libro>("libro.json");
let comprobadas = 0;
const problemas: string[] = [];

for (const tabla of libro.tablas) {
  for (const [seccion, filas] of Object.entries(tabla.secciones)) {
    for (const fila of filas) {
      const donde = `${tabla.peso} kg · ${fila.nombre}`;

      if (!(IDENTIDADES[seccion] ?? []).some((identidad) => identidad.nombre === fila.nombre)) {
        problemas.push(`${donde}: falta la identidad en datos-semilla.ts`);
      }

      // 1) dosis por kg por el peso
      const indicada = cantidad(fila.indicar);
      const porKg = sinRuido(fila.dosisKg).match(/^([\d.,]+)(?:[-–]([\d.,]+))?(mg|mcg|g)\/kg$/);
      if (porKg && indicada) {
        comprobadas++;
        const factor = EN_MG[porKg[3]];
        const minimo = numero(porKg[1]) * factor * tabla.peso;
        const maximo = porKg[2] ? numero(porKg[2]) * factor * tabla.peso : minimo;
        if (!cercano(indicada.min, minimo) || !cercano(indicada.max, maximo)) {
          problemas.push(`${donde}: ${fila.dosisKg} por ${tabla.peso} kg no da «${fila.indicar}»`);
        }
      }

      // 2) volumen = dosis / concentracion
      const preparar = (fila.preparar ?? "").split("(γ)").join("");
      let concentracion: number | null = null;
      const usar = preparar.match(/[Uu]sar concentraci[oó]n(?: de)? ?([\d.,]+) ?(mg|mcg|g) ?\/ ?mL/);
      const tomar = preparar.match(/(?:Tomar|Reconstituir) ?([\d.,]+) ?(mg|mcg|g),? ?(?:llevar|con) ?(?:a )?([\d.,]+) ?mL/);
      if (usar) concentracion = numero(usar[1]) * EN_MG[usar[2]];
      else if (tomar) concentracion = (numero(tomar[1]) * EN_MG[tomar[2]]) / numero(tomar[3]);
      const volumen = cantidad(fila.administrar);
      if (concentracion && indicada && volumen && volumen.unidad === "mL" && indicada.unidad !== "mL") {
        comprobadas++;
        if (!cercano(volumen.min, indicada.min / concentracion, 0.07) || !cercano(volumen.max, indicada.max / concentracion, 0.07)) {
          problemas.push(`${donde}: «${fila.indicar}» con ${concentracion} mg/mL no da «${fila.administrar}»`);
        }
      }
    }
  }
}

console.log(`${libro.tablas.length} tablas, ${comprobadas} cuentas comprobadas, ${problemas.length} diferencias`);
for (const problema of problemas) console.log(" -", problema);
process.exit(problemas.length === 0 ? 0 : 1);

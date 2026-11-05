import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { ALERGENOS, IDENTIDADES, MATRICULAS_SEMILLA } from "./datos-semilla";
import { cargarPesos, leerJson, normalizarPeso } from "./libro";
import { prisma } from "./prisma";

type FilaJson = {
  nombre: string;
  dosisKg?: string;
  indicar?: string;
  preparar?: string;
  administrar?: string;
  alerta?: string;
  detalle?: string[];
  cantidadMin: number;
  cantidadMax: number;
  unidad: string;
};

type LibroJson = {
  categorias: { clave: string; nombre: string; nota?: string }[];
  correcciones: { peso: number; seccion: string; item: string; libro: string; motivo: string }[];
  tablas: { peso: number; secciones: Record<string, FilaJson[]> }[];
};

async function sembrarLibro(): Promise<void> {
  const libro = leerJson<LibroJson>("libro.json");
  const idsActivos: number[] = [];
  const porNombre = new Map<string, number>();

  for (const [ordenCategoria, categoria] of libro.categorias.entries()) {
    const guardada = await prisma.categoria.upsert({
      where: { clave: categoria.clave },
      update: { nombre: categoria.nombre, nota: categoria.nota ?? null, orden: ordenCategoria },
      create: { clave: categoria.clave, nombre: categoria.nombre, nota: categoria.nota ?? null, orden: ordenCategoria },
    });

    for (const [orden, identidad] of (IDENTIDADES[categoria.clave] ?? []).entries()) {
      const datos = {
        principioActivo: identidad.principioActivo ?? "",
        viaCima: identidad.viaCima ?? "",
        via: identidad.via,
        esCritico: identidad.esCritico ?? false,
        activo: true,
        orden,
      };
      const existente = await prisma.medicamento.findFirst({ where: { categoriaId: guardada.id, nombre: identidad.nombre } });
      const medicamento = existente
        ? await prisma.medicamento.update({ where: { id: existente.id }, data: datos })
        : await prisma.medicamento.create({ data: { ...datos, nombre: identidad.nombre, categoriaId: guardada.id } });
      idsActivos.push(medicamento.id);
      porNombre.set(`${categoria.clave}/${identidad.nombre}`, medicamento.id);
    }
  }

  await prisma.medicamento.updateMany({ where: { id: { notIn: idsActivos } }, data: { activo: false } });

  const filas: Prisma.FilaLibroCreateManyInput[] = [];
  for (const tabla of libro.tablas) {
    for (const [seccion, items] of Object.entries(tabla.secciones)) {
      for (const item of items) {
        const medicamentoId = porNombre.get(`${seccion}/${item.nombre}`);
        if (medicamentoId === undefined) throw new Error(`Falta la identidad de ${seccion}/${item.nombre}`);
        const correccion = libro.correcciones.find(
          (otra) => otra.peso === tabla.peso && otra.seccion === seccion && otra.item === item.nombre
        );
        filas.push({
          medicamentoId,
          peso: tabla.peso,
          dosisKg: item.dosisKg ?? "",
          indicar: item.indicar ?? "",
          preparar: item.preparar ?? "",
          administrar: item.administrar ?? "",
          alerta: item.alerta ?? "",
          detalle: (item.detalle ?? []).join("\n"),
          cantidadMin: item.cantidadMin,
          cantidadMax: item.cantidadMax,
          unidad: item.unidad,
          correccion: correccion ? `El libro imprime «${correccion.libro}» (${correccion.motivo}).` : "",
        });
      }
    }
  }

  const tandas = Array.from({ length: Math.ceil(filas.length / 400) }, (_, i) => filas.slice(i * 400, (i + 1) * 400));
  await prisma.$transaction([prisma.filaLibro.deleteMany(), ...tandas.map((data) => prisma.filaLibro.createMany({ data }))]);
  await cargarPesos();
}

async function limpiarAlergiasFueraDelLibro(): Promise<void> {
  const nombres = ALERGENOS.map((alergeno) => alergeno.nombre);
  await prisma.alergia.deleteMany({ where: { nombre: { notIn: nombres } } });
}

async function completarDetalleDeDosis(): Promise<void> {
  await prisma.dosis.updateMany({ where: { detalle: "" }, data: { detalle: "Registrada antes de usar las tablas del libro" } });
}

async function normalizarPesosDePacientes(): Promise<void> {
  const pacientes = await prisma.usuario.findMany({ where: { pesoKg: { not: null } }, select: { id: true, pesoKg: true } });
  for (const paciente of pacientes) {
    const peso = normalizarPeso(paciente.pesoKg as number);
    if (peso !== null && peso !== paciente.pesoKg) {
      await prisma.usuario.update({ where: { id: paciente.id }, data: { pesoKg: peso } });
    }
  }
}

async function sembrarMatriculas(): Promise<void> {
  for (const registro of MATRICULAS_SEMILLA) {
    await prisma.matricula.upsert({
      where: { matricula: registro.matricula },
      update: {},
      create: registro,
    });
  }
}

async function sembrarUsuarios(): Promise<void> {
  if (await prisma.usuario.findUnique({ where: { email: "admin@kidose.com" } })) return;

  await prisma.usuario.create({
    data: {
      rol: "admin",
      nombre: "Admin Kidose",
      email: "admin@kidose.com",
      contrasena: await bcrypt.hash("Admin123", 10),
      dni: "10000000",
    },
  });

  const laura = await prisma.usuario.create({
    data: {
      rol: "medico",
      nombre: "Laura Fernández",
      email: "medico@kidose.com",
      contrasena: await bcrypt.hash("Medico123", 10),
      dni: "30123456",
      matricula: "123456",
      especialidad: "Emergentología pediátrica",
      hospital: "Hospital de Niños",
    },
  });

  const martin = await prisma.usuario.create({
    data: {
      rol: "medico",
      nombre: "Martín Gómez",
      email: "medico2@kidose.com",
      contrasena: await bcrypt.hash("Medico123", 10),
      dni: "28456789",
      matricula: "234567",
      especialidad: "Pediatría",
      hospital: "Hospital de Niños",
    },
  });

  const lucia = await prisma.usuario.create({
    data: {
      rol: "paciente",
      nombre: "Lucía Ramos",
      email: "paciente@kidose.com",
      contrasena: await bcrypt.hash("Paciente123", 10),
      dni: "52345678",
      fechaNacimiento: new Date("2023-07-15T12:00:00Z"),
      direccion: "AV SANTA FE 1234, Comuna 1, Ciudad Autónoma de Buenos Aires",
      latitud: -34.5957,
      longitud: -58.3835,
      pesoKg: 14,
      alergias: { create: [{ nombre: "Ketamina" }, { nombre: "Midazolam" }] },
    },
  });

  async function dosis(nombre: string, hora: string) {
    const medicamento = await prisma.medicamento.findFirstOrThrow({ where: { nombre, activo: true } });
    const fila = await prisma.filaLibro.findFirstOrThrow({ where: { medicamentoId: medicamento.id, peso: 14 } });
    return {
      medicamentoId: medicamento.id,
      nombre: medicamento.nombre,
      via: medicamento.via,
      cantidad: fila.cantidadMax as number,
      unidad: fila.unidad,
      detalle: [fila.dosisKg, fila.indicar, fila.preparar].filter((parte) => parte !== "").join(" · "),
      hora: new Date(hora),
    };
  }

  await prisma.atencion.create({
    data: {
      pacienteId: lucia.id,
      medicoId: martin.id,
      lugar: "Hospital de Niños",
      pesoKg: 14,
      fecha: new Date("2026-05-03T12:40:00Z"),
      dosis: {
        create: [await dosis("Metilprednisolona", "2026-05-03T12:40:00Z"), await dosis("Sulfato de magnesio (asma)", "2026-05-03T12:55:00Z")],
      },
    },
  });
  await prisma.atencion.create({
    data: {
      pacienteId: lucia.id,
      medicoId: laura.id,
      lugar: "Hospital de Niños",
      pesoKg: 14,
      fecha: new Date("2026-08-12T00:05:00Z"),
      dosis: {
        create: [await dosis("Midazolam IV / IM", "2026-08-12T00:05:00Z"), await dosis("Levetiracetam", "2026-08-12T00:20:00Z")],
      },
    },
  });
}

export async function initDatabase(): Promise<void> {
  await sembrarMatriculas();
  await sembrarLibro();
  await sembrarUsuarios();
  await normalizarPesosDePacientes();
  await limpiarAlergiasFueraDelLibro();
  await completarDetalleDeDosis();
}

if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log("Base de datos lista");
      return prisma.$disconnect();
    })
    .catch((error) => {
      console.error("No se pudo preparar la base de datos", error);
      process.exit(1);
    });
}

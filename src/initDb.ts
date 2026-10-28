import bcrypt from "bcryptjs";

import { CATEGORIAS_SEMILLA, MATRICULAS_SEMILLA } from "./datos-semilla";
import { prisma } from "./prisma";

// Carga los datos iniciales. Las tablas las crea Prisma (npx prisma db push, que ya
// incluye "npm run db:init"). Se puede ejecutar muchas veces: no duplica ni borra nada.

// Los medicamentos se actualizan siempre desde datos-semilla.ts, que es la fuente de verdad.
async function sembrarMedicamentos(): Promise<void> {
  for (const [ordenCategoria, categoria] of CATEGORIAS_SEMILLA.entries()) {
    const guardada = await prisma.categoria.upsert({
      where: { clave: categoria.clave },
      update: { nombre: categoria.nombre, orden: ordenCategoria },
      create: { clave: categoria.clave, nombre: categoria.nombre, orden: ordenCategoria },
    });

    for (const [orden, medicamento] of categoria.medicamentos.entries()) {
      const datos = {
        nombre: medicamento.nombre,
        principioActivo: medicamento.principioActivo,
        viaCima: medicamento.viaCima,
        via: medicamento.via,
        dosisPorKg: medicamento.dosisPorKg,
        dosisMaxima: medicamento.dosisMaxima,
        unidad: medicamento.unidad,
        nota: medicamento.nota,
        esCritico: medicamento.esCritico ?? false,
        orden,
      };
      const existente = await prisma.medicamento.findFirst({
        where: { categoriaId: guardada.id, nombre: medicamento.nombre },
      });
      if (existente) {
        await prisma.medicamento.update({ where: { id: existente.id }, data: datos });
      } else {
        await prisma.medicamento.create({ data: { ...datos, categoriaId: guardada.id } });
      }
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

// Crea las cuentas de prueba solo si todavia no existen.
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
      alergias: { create: [{ nombre: "Penicilina" }, { nombre: "Látex" }] },
    },
  });

  // Historial de ejemplo, con las dosis que da la calculadora para 14 kg.
  const metilprednisolona = await prisma.medicamento.findFirstOrThrow({ where: { nombre: "Metilprednisolona" } });
  const magnesio = await prisma.medicamento.findFirstOrThrow({ where: { nombre: "Sulfato de magnesio" } });
  const midazolam = await prisma.medicamento.findFirstOrThrow({ where: { nombre: "Midazolam IV / IM" } });
  const levetiracetam = await prisma.medicamento.findFirstOrThrow({ where: { nombre: "Levetiracetam" } });

  function dosis(medicamento: typeof magnesio, hora: string) {
    return {
      medicamentoId: medicamento.id,
      nombre: medicamento.nombre,
      via: medicamento.via,
      cantidad: Math.round(14 * medicamento.dosisPorKg * 1000) / 1000,
      unidad: medicamento.unidad,
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
        create: [dosis(metilprednisolona, "2026-05-03T12:40:00Z"), dosis(magnesio, "2026-05-03T12:55:00Z")],
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
        create: [dosis(midazolam, "2026-08-12T00:05:00Z"), dosis(levetiracetam, "2026-08-12T00:20:00Z")],
      },
    },
  });
}

export async function initDatabase(): Promise<void> {
  await sembrarMatriculas();
  await sembrarMedicamentos();
  await sembrarUsuarios();
}

// Permite correrlo a mano con "npm run db:init".
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

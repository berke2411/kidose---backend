import bcrypt from "bcryptjs";
import { Router } from "express";

import { autenticar, crearToken, usuarioPublico } from "../auth";
import { prisma } from "../prisma";
import {
  limpiarAlergias,
  nombresIguales,
  parseFecha,
  texto,
  validarContrasena,
  validarDni,
  validarEmail,
  validarMatricula,
  validarNombre,
  validarPeso,
} from "../validaciones";

export const rutasAuth = Router();

// POST /api/auth/login
// Compara la contrasena con el hash guardado y devuelve el token y el usuario.
rutasAuth.post("/login", async (req, res) => {
  const cuerpo = req.body ?? {};
  const email = texto(cuerpo.email).toLowerCase();
  const contrasena = String(cuerpo.contrasena ?? "");

  if (email === "" || contrasena === "") {
    res.status(400).json({ error: "Faltan el email o la contraseña" });
    return;
  }

  const usuario = await prisma.usuario.findUnique({ where: { email }, include: { alergias: true } });
  const coincide = usuario ? await bcrypt.compare(contrasena, usuario.contrasena) : false;
  if (!usuario || !coincide) {
    res.status(401).json({ error: "Email o contraseña incorrectos" });
    return;
  }

  // Los medicos nuevos no pueden ingresar hasta que un admin los apruebe.
  if (usuario.estado === "pendiente") {
    res.status(403).json({ error: "Tu cuenta todavía está pendiente de aprobación" });
    return;
  }
  if (usuario.estado === "rechazada") {
    res.status(403).json({ error: "Tu solicitud de cuenta fue rechazada" });
    return;
  }

  res.json({ token: crearToken(usuario), usuario: usuarioPublico(usuario) });
});

// GET /api/auth/yo
// Devuelve el usuario del token: la app lo usa para recuperar la sesion al abrirse.
rutasAuth.get("/yo", autenticar, async (_req, res) => {
  const { id } = res.locals.usuario;
  const usuario = await prisma.usuario.findUnique({ where: { id }, include: { alergias: true } });
  res.json(usuarioPublico(usuario!));
});

// POST /api/auth/registro
// Crea una cuenta nueva. El paciente queda aprobado; el medico queda pendiente
// y solo se crea si su matricula existe en el registro y coincide con su nombre y DNI.
rutasAuth.post("/registro", async (req, res) => {
  const cuerpo = req.body ?? {};
  const rol = texto(cuerpo.rol);
  const nombre = texto(cuerpo.nombre).split(" ").filter((palabra) => palabra !== "").join(" ");
  const dni = texto(cuerpo.dni);
  const email = texto(cuerpo.email).toLowerCase();
  const contrasena = String(cuerpo.contrasena ?? "");

  if (rol !== "medico" && rol !== "paciente") {
    res.status(400).json({ error: "El tipo de cuenta no es válido" });
    return;
  }

  const errorComun =
    validarNombre(nombre) ?? validarDni(dni) ?? validarEmail(email) ?? validarContrasena(contrasena);
  if (errorComun) {
    res.status(400).json({ error: errorComun });
    return;
  }

  if (await prisma.usuario.findUnique({ where: { email } })) {
    res.status(409).json({ error: "Ya existe una cuenta con este email" });
    return;
  }
  if (await prisma.usuario.findUnique({ where: { dni } })) {
    res.status(409).json({ error: "Ya existe una cuenta con este DNI" });
    return;
  }

  const hash = await bcrypt.hash(contrasena, 10);

  if (rol === "medico") {
    const matricula = texto(cuerpo.matricula);
    const hospital = texto(cuerpo.hospital);

    const errorMatricula = validarMatricula(matricula);
    if (errorMatricula) {
      res.status(400).json({ error: errorMatricula });
      return;
    }
    if (hospital === "") {
      res.status(400).json({ error: "Falta el hospital o la institución" });
      return;
    }

    const registrado = await prisma.matricula.findUnique({ where: { matricula } });
    if (!registrado) {
      res.status(400).json({ error: "Esta matrícula no figura en el registro" });
      return;
    }
    if (!nombresIguales(nombre, registrado.nombre)) {
      res.status(400).json({ error: "El nombre no coincide con el de la matrícula" });
      return;
    }
    if (dni !== registrado.dni) {
      res.status(400).json({ error: "El DNI no coincide con el de la matrícula" });
      return;
    }
    if (await prisma.usuario.findUnique({ where: { matricula } })) {
      res.status(409).json({ error: "Ya existe una cuenta con esta matrícula" });
      return;
    }

    const medico = await prisma.usuario.create({
      data: {
        rol,
        estado: "pendiente",
        nombre: registrado.nombre, // se guarda el nombre oficial del registro
        email,
        contrasena: hash,
        dni,
        matricula,
        especialidad: registrado.especialidad,
        hospital,
      },
    });
    res.status(201).json(usuarioPublico(medico));
    return;
  }

  // Paciente
  const fechaNacimiento = parseFecha(cuerpo.fechaNacimiento);
  const hoy = new Date();
  const limiteAntiguo = new Date(hoy.getFullYear() - 120, hoy.getMonth(), hoy.getDate());
  if (!fechaNacimiento || fechaNacimiento > hoy || fechaNacimiento < limiteAntiguo) {
    res.status(400).json({ error: "La fecha de nacimiento no es válida" });
    return;
  }

  const errorPeso = validarPeso(cuerpo.pesoKg);
  if (errorPeso) {
    res.status(400).json({ error: errorPeso });
    return;
  }

  const alergias = limpiarAlergias(cuerpo.alergias ?? []);
  if (alergias === null) {
    res.status(400).json({ error: "Las alergias no son válidas" });
    return;
  }

  // La direccion la verifica la app con Georef; aca se exige que haya llegado completa.
  const direccion = texto(cuerpo.direccion);
  if (direccion === "" || typeof cuerpo.latitud !== "number" || typeof cuerpo.longitud !== "number") {
    res.status(400).json({ error: "Falta verificar la dirección" });
    return;
  }

  const paciente = await prisma.usuario.create({
    data: {
      rol,
      estado: "aprobada",
      nombre,
      email,
      contrasena: hash,
      dni,
      fechaNacimiento,
      direccion,
      latitud: cuerpo.latitud,
      longitud: cuerpo.longitud,
      pesoKg: cuerpo.pesoKg,
      alergias: { create: alergias.map((alergia) => ({ nombre: alergia })) },
    },
    include: { alergias: true },
  });
  res.status(201).json(usuarioPublico(paciente));
});

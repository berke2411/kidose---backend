import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Alergia, Usuario } from "@prisma/client";

import { prisma } from "./prisma";

// Secreto para firmar los tokens: sale de backend/.env.
const secreto = process.env.JWT_SECRET;
if (!secreto) {
  throw new Error("Falta JWT_SECRET en el archivo .env");
}

// Un token vale 7 dias; despues hay que volver a iniciar sesion.
export function crearToken(usuario: Usuario): string {
  return jwt.sign({ id: usuario.id, rol: usuario.rol }, secreto as string, { expiresIn: "7d" });
}

// Usuario sin la contrasena y con las alergias como lista de textos.
// Es lo unico que sale de la API: el hash nunca se devuelve.
export function usuarioPublico(usuario: Usuario & { alergias?: Alergia[] }) {
  const { contrasena, alergias, ...datos } = usuario;
  return { ...datos, alergias: (alergias ?? []).map((alergia) => alergia.nombre) };
}

// Middleware: exige "Authorization: Bearer <token>", carga al usuario y deja pasar solo cuentas aprobadas.
// El usuario queda en res.locals.usuario para las rutas.
export async function autenticar(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cabecera = req.headers.authorization ?? "";
  if (!cabecera.startsWith("Bearer ")) {
    res.status(401).json({ error: "Falta iniciar sesión" });
    return;
  }

  let id: number;
  try {
    const datos = jwt.verify(cabecera.slice("Bearer ".length), secreto as string);
    id = typeof datos === "object" ? Number(datos.id) : 0;
  } catch {
    res.status(401).json({ error: "La sesión no es válida o venció" });
    return;
  }

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario || usuario.estado !== "aprobada") {
    res.status(401).json({ error: "La cuenta no está habilitada" });
    return;
  }

  res.locals.usuario = usuario;
  next();
}

// Middleware: solo deja pasar a los roles indicados (403 si el rol no corresponde).
export function soloRol(...roles: string[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const usuario = res.locals.usuario as Usuario;
    if (!roles.includes(usuario.rol)) {
      res.status(403).json({ error: "No tenés permiso para hacer esto" });
      return;
    }
    next();
  };
}

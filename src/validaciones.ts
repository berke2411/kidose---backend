
export function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

export function parseFecha(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function texto(value: unknown): string {
  return String(value ?? "").trim();
}

function soloNumeros(valor: string): boolean {
  return valor !== "" && valor.split("").every((letra) => letra >= "0" && letra <= "9");
}

export function validarEmail(email: string): string | null {
  if (email === "") return "Falta el email";

  const partes = email.split("@");
  if (email.includes(" ") || partes.length !== 2) return "El email no es válido";

  const [usuario, dominio] = partes;
  const ultimoPunto = dominio.lastIndexOf(".");
  const terminacionCorta = dominio.length - ultimoPunto < 3;
  if (usuario === "" || ultimoPunto < 1 || terminacionCorta || dominio.includes("..")) {
    return "El email no es válido";
  }
  return null;
}

export function validarContrasena(contrasena: string): string | null {
  if (contrasena.length < 8) return "La contraseña debe tener al menos 8 caracteres";

  const letras = contrasena.split("");
  const tieneLetra = letras.some((letra) => letra.toLowerCase() !== letra.toUpperCase());
  const tieneNumero = letras.some((letra) => letra >= "0" && letra <= "9");
  if (!tieneLetra || !tieneNumero) return "La contraseña debe incluir letras y números";
  return null;
}

export function validarNombre(nombre: string): string | null {
  const palabras = nombre.split(" ").filter((palabra) => palabra !== "");
  return palabras.length < 2 ? "Falta nombre y apellido" : null;
}

export function validarDni(dni: string): string | null {
  return soloNumeros(dni) && dni.length >= 7 && dni.length <= 8
    ? null
    : "El DNI debe tener 7 u 8 números, sin puntos";
}

export function validarMatricula(matricula: string): string | null {
  return soloNumeros(matricula) && matricula.length >= 5 && matricula.length <= 6
    ? null
    : "La matrícula debe tener 5 o 6 números";
}

export function nombresIguales(a: string, b: string): boolean {
  return normalizarNombre(a) === normalizarNombre(b);
}

function normalizarNombre(nombre: string): string {
  const sinTildes = nombre
    .normalize("NFD")
    .split("")
    .filter((letra) => letra < "̀" || letra > "ͯ")
    .join("");
  return sinTildes
    .toLowerCase()
    .split(" ")
    .filter((palabra) => palabra !== "")
    .join(" ");
}

export const PESO_MINIMO = 2;
export const PESO_MAXIMO = 80;

export function validarPeso(valor: unknown): string | null {
  if (typeof valor !== "number" || Number.isNaN(valor)) return "El peso no es válido";
  if (valor < PESO_MINIMO || valor > PESO_MAXIMO) {
    return `El peso debe estar entre ${PESO_MINIMO} y ${PESO_MAXIMO} kg`;
  }
  return null;
}

export function limpiarAlergias(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) return null;
  const alergias: string[] = [];
  for (const item of valor) {
    if (typeof item !== "string") return null;
    const nombre = item.trim();
    const repetida = alergias.some((otra) => otra.toLowerCase() === nombre.toLowerCase());
    if (nombre !== "" && !repetida) alergias.push(nombre);
  }
  return alergias;
}

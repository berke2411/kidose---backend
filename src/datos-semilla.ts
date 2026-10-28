// Datos iniciales de la base.
//
// Los medicamentos salen del libro "Medicamentos en Emergencias Pediatricas: Latinoamerica"
// (fuente unica del proyecto), de sus tablas por peso. Cada dosisPorKg es la dosis por kg
// que indica el libro, y dosisMaxima es la dosis de adulto que el libro muestra en las
// tablas de los pesos mas altos. Si el libro no trae tope para un medicamento, queda en null.

export type MedicamentoSemilla = {
  nombre: string;
  principioActivo: string; // nombre del principio activo en CIMA (en minuscula)
  viaCima: string; // via tal como figura en CIMA, para elegir la ficha correcta
  via: string;
  dosisPorKg: number;
  dosisMaxima: number | null;
  unidad: string;
  nota: string;
  esCritico?: boolean;
};

export type CategoriaSemilla = {
  clave: string;
  nombre: string;
  medicamentos: MedicamentoSemilla[];
};

export const CATEGORIAS_SEMILLA: CategoriaSemilla[] = [
  {
    clave: "reanimacion",
    nombre: "Reanimación",
    medicamentos: [
      {
        nombre: "Adrenalina 1:10.000",
        principioActivo: "epinefrina",
        viaCima: "INTRAVENOSA",
        via: "IV / IO",
        dosisPorKg: 0.01,
        dosisMaxima: 1,
        unidad: "mg",
        nota: "10 mcg/kg. Tomar 1 mg y llevar a 10 mL (1:10.000). Dosis de adulto: 1 mg.",
        esCritico: true,
      },
      {
        nombre: "Atropina",
        principioActivo: "atropina",
        viaCima: "INTRAVENOSA",
        via: "IV / IO",
        dosisPorKg: 0.02,
        dosisMaxima: 1,
        unidad: "mg",
        nota: "20 mcg/kg. Tomar 1 mg y llevar a 10 mL con SF. Dosis de adulto: 1 mg.",
      },
      {
        nombre: "Amiodarona",
        principioActivo: "amiodarona",
        viaCima: "INTRAVENOSA",
        via: "IV / IO",
        dosisPorKg: 5,
        dosisMaxima: 300,
        unidad: "mg",
        nota: "TV sin pulso: en 3 min. TV con pulso: en 20 a 120 min.",
      },
      {
        nombre: "Solución fisiológica",
        principioActivo: "sodio cloruro",
        viaCima: "INTRAVENOSA",
        via: "BOLO IV / IO",
        dosisPorKg: 20,
        dosisMaxima: null,
        unidad: "ml",
        nota: "Bolo de 20 mL/kg. En la tabla de 2 kg el libro indica 10 mL/kg.",
      },
      {
        nombre: "Dextrosa 10%",
        principioActivo: "glucosa",
        viaCima: "INTRAVENOSA",
        via: "IV / IO",
        dosisPorKg: 5,
        dosisMaxima: null,
        unidad: "ml",
        nota: "Glucosa 500 mg/kg (5 mL/kg de Dx10%). En la tabla de 2 kg el libro indica 2 mL/kg.",
      },
    ],
  },
  {
    clave: "intubacion",
    nombre: "Intubación",
    medicamentos: [
      {
        nombre: "Ketamina",
        principioActivo: "ketamina",
        viaCima: "INTRAVENOSA",
        via: "IV — INDUCCIÓN",
        dosisPorKg: 1,
        dosisMaxima: null,
        unidad: "mg",
        nota: "El libro indica 1–2 mg/kg: se calcula el mínimo. Riesgo cardiovascular.",
      },
      {
        nombre: "Fentanilo",
        principioActivo: "fentanilo",
        viaCima: "INTRAVENOSA",
        via: "IV — INDUCCIÓN",
        dosisPorKg: 1,
        dosisMaxima: null,
        unidad: "mcg",
        nota: "El libro indica 1–2 mcg/kg: se calcula el mínimo. Cuidado en hipotensión grave.",
      },
      {
        nombre: "Midazolam (inducción)",
        principioActivo: "midazolam",
        viaCima: "INTRAVENOSA",
        via: "IV — INDUCCIÓN",
        dosisPorKg: 0.1,
        dosisMaxima: null,
        unidad: "mg",
        nota: "Puede ser peligroso en hipotensión grave, sepsis o enfermedad cardíaca.",
      },
      {
        nombre: "Rocuronio",
        principioActivo: "rocuronio",
        viaCima: "INTRAVENOSA",
        via: "IV — BNM",
        dosisPorKg: 0.5,
        dosisMaxima: null,
        unidad: "mg",
        nota: "Agente paralizante. Usar concentración de 10 mg/mL.",
      },
      {
        nombre: "Succinilcolina",
        principioActivo: "suxametonio",
        viaCima: "INTRAVENOSA",
        via: "IV — BNM",
        dosisPorKg: 1,
        dosisMaxima: null,
        unidad: "mg",
        nota: "Agente paralizante. La preparación depende del peso: ver la tabla del libro.",
        esCritico: true,
      },
    ],
  },
  {
    clave: "convulsiones",
    nombre: "Convulsiones",
    medicamentos: [
      {
        nombre: "Midazolam IV / IM",
        principioActivo: "midazolam",
        viaCima: "INTRAVENOSA",
        via: "IV / IM",
        dosisPorKg: 0.15,
        dosisMaxima: 10,
        unidad: "mg",
        nota: "Dosis de adulto: 10 mg. IM: usar concentración de 5 mg/mL.",
        esCritico: true,
      },
      {
        nombre: "Midazolam intranasal / bucal",
        principioActivo: "midazolam",
        viaCima: "BUCAL",
        via: "IN / BUCAL",
        dosisPorKg: 0.3,
        dosisMaxima: 10,
        unidad: "mg",
        nota: "Usar concentración de 5 mg/mL. El algoritmo de estatus epiléptico indica 0,5 mg/kg por vía bucal.",
      },
      {
        nombre: "Diazepam IV",
        principioActivo: "diazepam",
        viaCima: "INTRAVENOSA",
        via: "IV",
        dosisPorKg: 0.25,
        dosisMaxima: 10,
        unidad: "mg",
        nota: "Usar concentración de 5 mg/mL. Dosis de adulto: 10 mg.",
      },
      {
        nombre: "Fenitoína",
        principioActivo: "fenitoina",
        viaCima: "INTRAVENOSA",
        via: "IV — CARGA",
        dosisPorKg: 20,
        dosisMaxima: 1500,
        unidad: "mg",
        nota: "Llevar a SF e infundir en 20 min.",
      },
      {
        nombre: "Levetiracetam",
        principioActivo: "levetiracetam",
        viaCima: "INTRAVENOSA",
        via: "IV — CARGA",
        dosisPorKg: 40,
        dosisMaxima: 3000,
        unidad: "mg",
        nota: "Llevar a SF e infundir en 15 min.",
      },
      {
        nombre: "Fenobarbital",
        principioActivo: "fenobarbital",
        viaCima: "INTRAVENOSA",
        via: "IV — CARGA",
        dosisPorKg: 20,
        dosisMaxima: 1000,
        unidad: "mg",
        nota: "Llevar a SF e infundir en 15 min.",
      },
    ],
  },
  {
    clave: "asma",
    nombre: "Asma",
    medicamentos: [
      {
        nombre: "Metilprednisolona",
        principioActivo: "metilprednisolona",
        viaCima: "INTRAVENOSA",
        via: "IV",
        dosisPorKg: 2,
        dosisMaxima: 60,
        unidad: "mg",
        nota: "Dosis inicial. El libro indica continuar cada 6 horas.",
      },
      {
        nombre: "Hidrocortisona",
        principioActivo: "hidrocortisona",
        viaCima: "INTRAVENOSA",
        via: "IV",
        dosisPorKg: 5,
        dosisMaxima: 300,
        unidad: "mg",
        nota: "El libro indica repetirla cada 6 horas.",
      },
      {
        nombre: "Sulfato de magnesio",
        principioActivo: "magnesio sulfato",
        viaCima: "INTRAVENOSA",
        via: "IV — 20 min",
        dosisPorKg: 50,
        dosisMaxima: 2000,
        unidad: "mg",
        nota: "Llevar a Dx5% o SF y pasar en 20 min, en infusión separada.",
        esCritico: true,
      },
      {
        nombre: "Aminofilina",
        principioActivo: "aminofilina",
        viaCima: "INTRAVENOSA",
        via: "IV — 1 hora",
        dosisPorKg: 6,
        dosisMaxima: null,
        unidad: "mg",
        nota: "Llevar a SF o Dx5% y pasar en 1 hora, en infusión separada.",
      },
    ],
  },
  {
    clave: "anafilaxia",
    nombre: "Anafilaxia",
    medicamentos: [
      {
        nombre: "Adrenalina 1:1.000",
        principioActivo: "epinefrina",
        viaCima: "INTRAMUSCULAR",
        via: "IM",
        dosisPorKg: 0.01,
        dosisMaxima: 0.5,
        unidad: "mg",
        nota: "10 mcg/kg. Usar concentración de 1 mg/mL. Repetir una vez si es necesario. Dosis de adulto: 0,5 mg.",
        esCritico: true,
      },
    ],
  },
];

// Registro de matriculas de ejemplo (simula el registro oficial de profesionales).
export const MATRICULAS_SEMILLA = [
  { matricula: "123456", nombre: "Laura Fernández", dni: "30123456", especialidad: "Emergentología pediátrica" },
  { matricula: "234567", nombre: "Martín Gómez", dni: "28456789", especialidad: "Pediatría" },
  { matricula: "345678", nombre: "Sofía Acosta", dni: "33987654", especialidad: "Terapia intensiva pediátrica" },
];

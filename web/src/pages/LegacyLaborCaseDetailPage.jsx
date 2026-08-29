import { LaborCaseDetailView } from "./LaborCaseDetailPage.jsx";
import { LABOR_CASE_SURFACES } from "./laborCaseSurface.js";

/**
 * Superficie pública independiente para srcAccionesIncidentesLegal_OLD.
 * Comparte primitivas de render con el detalle vigente, pero recibe únicamente
 * el contrato OLD recuperado del OML y nunca se redirige ni se fusiona con él.
 */
export function LegacyLaborCaseDetailPage() {
  return <LaborCaseDetailView surface={LABOR_CASE_SURFACES.legacy} />;
}


import { getDatabasePool } from "../config/database.js";

const ACTIVE_LOGIN_COUNTRIES_QUERY = `
  SELECT
    Codigo_Pais AS countryCode,
    Nombre_Pais AS name
  FROM tblPaises
  WHERE isActivo = 1
    AND Codigo_Pais = 4
  ORDER BY Nombre_Pais
  LIMIT 50
`;

export function createCountryRepository(pool = getDatabasePool()) {
  return {
    async listActiveLoginCountries() {
      const [rows] = await pool.execute(ACTIVE_LOGIN_COUNTRIES_QUERY);
      return rows;
    },
  };
}

export { ACTIVE_LOGIN_COUNTRIES_QUERY };

import { getDatabasePool } from "../config/database.js";

const AUTHENTICATION_QUERY = `
  SELECT
    Codigo_Personas,
    Primer_Nombre,
    Segundo_Nombre,
    Primer_Apellido,
    Segundo_Apellido,
    CodigoRol,
    CodigoPais,
    isResetear,
    Codigo_Sucursal,
    Codigo_Puesto
  FROM tblPersonas
  WHERE Correo_electronico = ?
    AND Credencial = ?
    AND CodigoPais = ?
    AND isActivo = 1
  LIMIT 2
`;

const RECOVERY_QUERY = `
  SELECT
    Codigo_Personas,
    Correo_electronico,
    Primer_Nombre,
    Primer_Apellido
  FROM tblPersonas
  WHERE Correo_electronico = ?
    AND CodigoPais = ?
    AND isActivo = 1
  LIMIT 2
`;

export function createPersonRepository(pool = getDatabasePool()) {
  return {
    async findActiveByCredentials({ email, credential, countryCode }) {
      const [rows] = await pool.execute(AUTHENTICATION_QUERY, [email, credential, countryCode]);
      return rows;
    },

    async findActiveForRecovery({ username, countryCode }) {
      const [rows] = await pool.execute(RECOVERY_QUERY, [username, countryCode]);
      return rows;
    },

    async updateCredential({ personId, credential, mustResetPassword }) {
      const [result] = await pool.execute(
        `UPDATE tblPersonas
         SET Credencial = ?, isResetear = ?
         WHERE Codigo_Personas = ? AND isActivo = 1`,
        [credential, mustResetPassword ? 1 : 0, personId],
      );
      return result.affectedRows === 1;
    },
  };
}

export { AUTHENTICATION_QUERY, RECOVERY_QUERY };

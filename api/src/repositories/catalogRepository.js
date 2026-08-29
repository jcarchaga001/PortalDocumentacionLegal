import { getDatabasePool } from "../config/database.js";
import { getDatabaseNames } from "../config/databaseNames.js";

function addFilter(conditions, parameters, value, expression) {
  if (value !== undefined && value !== null && value !== "") {
    conditions.push(expression);
    parameters.push(value);
  }
}

function paginationSql(page, pageSize) {
  return `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
}

function sortSql(sortBy, sortOrder, columns, fallback) {
  const column = columns[sortBy] || columns[fallback];
  return `${column} ${sortOrder === "desc" ? "DESC" : "ASC"}`;
}

async function executePaged(databasePool, selectSql, countSql, parameters, filters) {
  const [[items], [countRows]] = await Promise.all([
    databasePool.execute(selectSql, parameters),
    databasePool.execute(countSql, parameters),
  ]);

  return {
    items,
    total: Number(countRows[0]?.total || 0),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

async function withTransaction(databasePool, action) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export function createCatalogRepository(pool) {
  const databases = getDatabaseNames();
  const getPool = () => pool || getDatabasePool();

  return {
    async getLookups(countryCode) {
      const databasePool = getPool();
      const queries = [
        databasePool.execute(`
          SELECT Codigo_Sucursal AS id,
                 CONCAT(Codigo_InternoSucursal, ' - ', Nombre_Sucursal) AS name
          FROM ${databases.people}.tblSucursales
          WHERE Codigo_Pais = ?
          ORDER BY OrdenSucursal, Nombre_Sucursal
        `, [countryCode]),
        databasePool.execute(`
          SELECT Codigo_Puesto AS id, Nombre_Puesto AS name
          FROM ${databases.people}.tblPuestos
          ORDER BY Nombre_Puesto
        `),
        databasePool.execute(`
          SELECT codigoCategoria AS id, nombreCategoria AS name
          FROM ${databases.documents}.tblCategoriaDocumentos
          WHERE codigoPais = ?
          ORDER BY nombreCategoria
        `, [countryCode]),
        databasePool.execute(`
          SELECT DISTINCT p.Codigo_Personas AS id,
                 TRIM(p.Nombre_Personas) AS name
          FROM ${databases.documents}.tblEntesGubernamentales e
          INNER JOIN ${databases.people}.tblPersonas p
            ON p.Codigo_Personas = e.codigoResponsable AND p.CodigoPais = e.codigoPais
          WHERE e.isActive = 1 AND e.codigoPais = ? AND p.isActivo = 1
          ORDER BY name
        `, [countryCode]),
        databasePool.execute(`
          SELECT codigoEnte AS id, nombreEnte AS name
          FROM ${databases.documents}.tblEntesGubernamentales
          WHERE isActive = 1 AND codigoPais = ?
          ORDER BY nombreEnte
        `, [countryCode]),
      ];
      const results = await Promise.all(queries);
      return {
        branches: results[0][0],
        positions: results[1][0],
        categories: results[2][0],
        responsibles: results[3][0],
        entities: results[4][0],
      };
    },

    async getUserPermissionLookups(countryCode) {
      const databasePool = getPool();
      const [[branches], [positions]] = await Promise.all([
        databasePool.execute(`
          SELECT Codigo_Sucursal AS id,
                 CONCAT(Codigo_InternoSucursal, ' - ', Nombre_Sucursal) AS name
          FROM ${databases.people}.tblSucursales
          WHERE Codigo_Pais = ?
          LIMIT 500
        `, [countryCode]),
        databasePool.execute(`
          SELECT Codigo_Puesto AS id, Nombre_Puesto AS name
          FROM ${databases.people}.tblPuestos
          LIMIT 1000
        `),
      ]);
      return { branches, positions };
    },

    async getDocumentCategoryLookups(countryCode) {
      const databasePool = getPool();
      const [[branches], [positions]] = await Promise.all([
        databasePool.execute(`
          SELECT Codigo_Sucursal AS id,
                 CONCAT(Codigo_InternoSucursal, ' - ', Nombre_Sucursal) AS name
          FROM ${databases.people}.tblSucursales
          WHERE Codigo_Pais = ?
          LIMIT 500
        `, [countryCode]),
        databasePool.execute(`
          SELECT Codigo_Puesto AS id, Nombre_Puesto AS name
          FROM ${databases.people}.tblPuestos
          LIMIT 1000
        `),
      ]);
      return { branches, positions };
    },

    async listUsers(countryCode, filters) {
      const databasePool = getPool();
      const conditions = ["p.CodigoPais = ?", "p.isActivo = 1"];
      const parameters = [countryCode];
      addFilter(conditions, parameters, filters.branchId, "p.Codigo_Sucursal = ?");
      addFilter(conditions, parameters, filters.positionId, "p.Codigo_Puesto = ?");
      if (filters.search) {
        conditions.push("p.Nombre_Personas LIKE CONCAT('%', ?, '%')");
        parameters.push(filters.search);
      }
      if (filters.onlyAllowed) conditions.push("p.isGenteCargo = 1");
      const where = `WHERE ${conditions.join(" AND ")}`;
      const from = `
        FROM ${databases.people}.tblPersonas p
        INNER JOIN ${databases.people}.tblPuestos j
          ON j.Codigo_Puesto = p.Codigo_Puesto
      `;
      return executePaged(databasePool, `
        SELECT p.Codigo_Personas AS id,
               TRIM(p.Nombre_Personas) AS name,
               j.Nombre_Puesto AS positionName,
               p.Correo_electronico AS email,
               p.Codigo_Sucursal AS branchId,
               p.Codigo_Puesto AS positionId,
               COALESCE(p.isGenteCargo, 0) AS accessAllowed
        ${from} ${where}
        ORDER BY p.Nombre_Personas ASC
        ${paginationSql(filters.page, filters.pageSize)}
      `, `SELECT COUNT(*) AS total ${from} ${where}`, parameters, filters);
    },

    async setUserAccess({ countryCode, userId, actorId, allowed, description, timestamp }) {
      return withTransaction(getPool(), async (connection) => {
        const [result] = await connection.execute(`
          UPDATE ${databases.people}.tblPersonas
          SET isGenteCargo = ?
          WHERE Codigo_Personas = ? AND CodigoPais = ? AND isActivo = 1
        `, [allowed ? 1 : 0, userId, countryCode]);
        if (result.affectedRows === 0) return false;
        await connection.execute(`
          INSERT INTO ${databases.documents}.tblBitacoraPermisos
            (codigoUsuario, codigoAsigno, Descripcion, codigoPais, fechaHora)
          VALUES (?, ?, ?, ?, ?)
        `, [userId, actorId, description, countryCode, timestamp]);
        return true;
      });
    },

    async listProviders(countryCode, filters) {
      const databasePool = getPool();
      const conditions = ["p.codPais = ?"];
      const parameters = [countryCode];
      if (filters.name) {
        conditions.push("p.Nombre_comercial LIKE CONCAT('%', ?, '%')");
        parameters.push(filters.name);
      }
      if (filters.taxNumber) {
        conditions.push("p.RTN LIKE CONCAT('%', ?, '%')");
        parameters.push(filters.taxNumber);
      }
      if (filters.onlyExternal) conditions.push("p.isInterno = 0");
      if (!filters.onlyActive) conditions.push("p.isactive = 0");
      const where = `WHERE ${conditions.join(" AND ")}`;
      const from = `
        FROM ${databases.providers}.tblProveedores p
        LEFT JOIN ${databases.people}.tblSucursales s
          ON s.Codigo_Sucursal = p.codigoInternoSAF
      `;
      const order = filters.sortBy
        ? `ORDER BY ${sortSql(filters.sortBy, filters.sortOrder, {
          commercialName: "p.Nombre_comercial",
          legalName: "p.Nombre_legal",
          taxNumber: "p.RTN",
          active: "p.isactive",
        }, filters.sortBy)}`
        : "";
      return executePaged(databasePool, `
        SELECT p.cod_Proveedor AS id,
               p.Nombre_comercial AS commercialName,
               p.Nombre_legal AS legalName,
               p.RTN AS taxNumber,
               COALESCE(p.isInterno, 0) AS internal,
               COALESCE(p.isactive, 0) AS active,
               COALESCE(p.\`isRet1%\`, 0) AS withholdingOne,
               COALESCE(p.\`is12.5%\`, 0) AS withholdingTwelve,
               p.codigoInternoSAF AS destinationId,
               CONCAT(s.Codigo_InternoSucursal, ' - ', s.Nombre_Sucursal) AS destinationName
        ${from} ${where}
        ${order}
        ${paginationSql(filters.page, filters.pageSize)}
      `, `SELECT COUNT(*) AS total ${from} ${where}`, parameters, filters);
    },

    async listProviderBranches(countryCode) {
      const [rows] = await getPool().execute(`
        SELECT Codigo_Sucursal AS id,
               CONCAT(Codigo_InternoSucursal, ' - ', Nombre_Sucursal) AS name
        FROM ${databases.people}.tblSucursales
        WHERE Codigo_Pais = ? AND isActivo = 1
        LIMIT 50
      `, [countryCode]);
      return rows;
    },

    async listProviderDestinations(countryCode, providerId) {
      const databasePool = getPool();
      const [[destinationRows], [countryRows]] = await Promise.all([
        databasePool.execute(`
          SELECT d.Cod_Destino AS id,
                 b.Nombre_Banco AS bankName,
                 d.NumeroCuenta AS accountNumber,
                 COALESCE(d.IsDolares, 0) AS isDollars
          FROM ${databases.providers}.tblDestinos d
          LEFT JOIN ${databases.providers}.tblBancos b
            ON d.Cod_Banco = b.Cod_Banco
          WHERE d.CodPais = ?
            AND d.codigoProveedor = ?
            AND d.Cod_Estado = 5
          LIMIT 500
        `, [countryCode, providerId]),
        databasePool.execute(`
          SELECT MonedaSimbolo AS currencySymbol
          FROM ${databases.people}.tblPaises
          WHERE Codigo_Pais = ?
          LIMIT 1
        `, [countryCode]),
      ]);
      return {
        items: destinationRows,
        currencySymbol: countryRows[0]?.currencySymbol || "",
      };
    },

    async findProviderByTaxNumber(countryCode, taxNumber, excludedId) {
      const parameters = [countryCode, taxNumber];
      let exclusion = "";
      if (excludedId) {
        exclusion = "AND cod_Proveedor <> ?";
        parameters.push(excludedId);
      }
      const [rows] = await getPool().execute(`
        SELECT cod_Proveedor AS id, Nombre_comercial AS commercialName
        FROM ${databases.providers}.tblProveedores
        WHERE codPais = ? AND RTN = ? ${exclusion}
        LIMIT 1
      `, parameters);
      return rows[0] || null;
    },

    async createProvider(countryCode, actorId, provider) {
      const [result] = await getPool().execute(`
        INSERT INTO ${databases.providers}.tblProveedores
          (Nombre_comercial, Nombre_legal, RTN, \`isRet1%\`, \`is12.5%\`, isactive,
           codPais, isInterno, codigoInternoSAF, fecharegistro, usuarioCreacion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `, [
        provider.commercialName,
        provider.legalName,
        provider.taxNumber,
        provider.withholdingOne ? 1 : 0,
        provider.withholdingTwelve ? 1 : 0,
        provider.active ? 1 : 0,
        countryCode,
        provider.internal ? 1 : 0,
        provider.destinationId,
        actorId,
      ]);
      return Number(result.insertId);
    },

    async updateProvider(countryCode, providerId, provider) {
      const [result] = await getPool().execute(`
        UPDATE ${databases.providers}.tblProveedores
        SET Nombre_comercial = ?, Nombre_legal = ?, RTN = ?,
            \`isRet1%\` = ?, \`is12.5%\` = ?, isactive = ?,
            isInterno = ?, codigoInternoSAF = ?
        WHERE cod_Proveedor = ? AND codPais = ?
      `, [
        provider.commercialName,
        provider.legalName,
        provider.taxNumber,
        provider.withholdingOne ? 1 : 0,
        provider.withholdingTwelve ? 1 : 0,
        provider.active ? 1 : 0,
        provider.internal ? 1 : 0,
        provider.destinationId,
        providerId,
        countryCode,
      ]);
      return result.affectedRows > 0;
    },

    async listCategories(countryCode, filters) {
      const databasePool = getPool();
      const conditions = ["c.codigoPais = ?"];
      const parameters = [countryCode];
      const where = `WHERE ${conditions.join(" AND ")}`;
      const from = `
        FROM ${databases.documents}.tblCategoriaDocumentos c
        INNER JOIN ${databases.documents}.tblSubcategoriaDocumentos sc
          ON sc.codigoCategoria = c.codigoCategoria
      `;
      return executePaged(databasePool, `
        SELECT sc.codigoSubcategoria AS id,
               c.codigoCategoria AS categoryId,
               c.nombreCategoria AS categoryName,
               sc.NombreSubcategoria AS subcategoryName,
               COALESCE(sc.isObligatorio, 0) AS required,
               COALESCE(sc.isDocSucursal, 0) AS branchDocument,
               COALESCE(sc.isActive, 0) AS accessAllowed
        ${from} ${where}
        ${paginationSql(filters.page, filters.pageSize)}
      `, `SELECT COUNT(*) AS total ${from} ${where}`, parameters, filters);
    },

    async setCategoryAccess({ countryCode, categoryId, actorId, allowed, description, timestamp }) {
      return withTransaction(getPool(), async (connection) => {
        const [result] = await connection.execute(`
          UPDATE ${databases.people}.tblPersonas
          SET isGenteCargo = ?
          WHERE Codigo_Personas = ?
        `, [allowed ? 1 : 0, categoryId]);
        if (result.affectedRows === 0) return false;
        await connection.execute(`
          INSERT INTO ${databases.documents}.tblBitacoraPermisos
            (codigoUsuario, codigoAsigno, Descripcion, codigoPais, fechaHora)
          VALUES (?, ?, ?, ?, ?)
        `, [categoryId, actorId, description, countryCode, timestamp]);
        return true;
      });
    },

    async getGovernmentEntityLookups() {
      const databasePool = getPool();
      const [[entities], [responsibles]] = await Promise.all([
        databasePool.execute(`
          SELECT codigoEnte AS id, nombreEnte AS name
          FROM ${databases.documents}.tblEntesGubernamentales
          LIMIT 50
        `),
        databasePool.execute(`
          SELECT p.Codigo_Personas AS id,
                 TRIM(p.Nombre_Personas) AS name
          FROM ${databases.documents}.tblEntesGubernamentales e
          LEFT JOIN ${databases.people}.tblPersonas p
            ON e.codigoResponsable = p.Codigo_Personas
          LIMIT 50
        `),
      ]);
      return { entities, responsibles };
    },

    async listEntities(filters) {
      const databasePool = getPool();
      const conditions = ["e.isActive = 1"];
      const parameters = [];
      addFilter(conditions, parameters, filters.entityId, "e.codigoEnte = ?");
      addFilter(conditions, parameters, filters.responsibleId, "e.codigoResponsable = ?");
      if (filters.area === "legal") conditions.push("e.isLegal = 1");
      if (filters.area === "regulatory") conditions.push("e.isRegulatorio = 1");
      const where = `WHERE ${conditions.join(" AND ")}`;
      const from = `
        FROM ${databases.documents}.tblEntesGubernamentales e
        LEFT JOIN ${databases.people}.tblPersonas p
          ON e.codigoResponsable = p.Codigo_Personas
      `;
      const [[items], [countRows]] = await Promise.all([
        databasePool.execute(`
        SELECT e.codigoEnte AS id,
               e.nombreEnte AS name,
               e.descripcion AS description,
               e.codigoResponsable AS responsibleId,
               TRIM(p.Nombre_Personas) AS responsibleName,
               COALESCE(e.isLegal, 0) AS legal,
               COALESCE(e.isRegulatorio, 0) AS regulatory
        ${from} ${where}
        LIMIT 50 OFFSET 0
        `, parameters),
        // The Pagination total is wired to the unfiltered master Aggregate,
        // including inactive rows and every country.
        databasePool.execute(`
          SELECT COUNT(*) AS total
          FROM ${databases.documents}.tblEntesGubernamentales
        `),
      ]);
      return {
        items,
        total: Number(countRows[0]?.total || 0),
        page: filters.page,
        pageSize: 500,
      };
    },

    async createEntity(countryCode, actorId, entity) {
      const [result] = await getPool().execute(`
        INSERT INTO ${databases.documents}.tblEntesGubernamentales
          (nombreEnte, descripcion, isActive, codigoPais, isRegulatorio, isLegal, codigoResponsable)
        VALUES (?, ?, 1, ?, ?, ?, ?)
      `, [entity.name, entity.description, countryCode, entity.regulatory ? 1 : 0, entity.legal ? 1 : 0, actorId]);
      return Number(result.insertId);
    },

    async updateEntity(entityId, entity) {
      const [result] = await getPool().execute(`
        UPDATE ${databases.documents}.tblEntesGubernamentales
        SET nombreEnte = ?, descripcion = ?, isRegulatorio = ?, isLegal = ?, codigoResponsable = ?
        WHERE codigoEnte = ?
      `, [entity.name, entity.description, entity.regulatory ? 1 : 0, entity.legal ? 1 : 0, entity.responsibleId, entityId]);
      return result.affectedRows > 0;
    },

    async deactivateEntity(entityId) {
      const [result] = await getPool().execute(`
        UPDATE ${databases.documents}.tblEntesGubernamentales
        SET isActive = 0
        WHERE codigoEnte = ?
      `, [entityId]);
      return result.affectedRows > 0;
    },

    async listLegalActions(filters) {
      const databasePool = getPool();
      const parameters = [];
      const from = `
        FROM ${databases.documents}.tblAcciones_Legal a
        LEFT JOIN ${databases.people}.tblPersonas p
          ON p.Codigo_Personas = CAST(a.UsuarioCreado AS UNSIGNED)
      `;
      const sortColumns = {
        name: "a.NombreAccion",
        createdAt: "a.FechaCreado",
        createdBy: "a.UsuarioCreado",
      };
      const order = filters.sortBy
        ? `ORDER BY ${sortColumns[filters.sortBy]} ${filters.sortOrder === "desc" ? "DESC" : "ASC"}`
        : "";
      return executePaged(databasePool, `
        SELECT a.codAccion AS id,
               a.NombreAccion AS name,
               DATE_FORMAT(a.FechaCreado, '%Y-%m-%d %H:%i:%s') AS createdAt,
               TRIM(p.Nombre_Personas) AS createdBy,
               COALESCE(a.IsActivo, 0) AS active
        ${from}
        ${order}
        ${paginationSql(filters.page, filters.pageSize)}
      `, `SELECT COUNT(*) AS total ${from}`, parameters, filters);
    },

    async getLegalAction(actionId) {
      const [rows] = await getPool().execute(`
        SELECT codAccion AS id,
               NombreAccion AS name,
               COALESCE(IsActivo, 0) AS active
        FROM ${databases.documents}.tblAcciones_Legal
        WHERE codAccion = ?
        LIMIT 50
      `, [actionId]);
      return rows[0] || null;
    },

    async createLegalAction(actorId, timestamp, action) {
      const [result] = await getPool().execute(`
        INSERT INTO ${databases.documents}.tblAcciones_Legal
          (NombreAccion, IsActivo, UsuarioCreado, FechaCreado)
        VALUES (?, ?, ?, ?)
      `, [action.name, action.active ? 1 : 0, String(actorId), timestamp]);
      return Number(result.insertId);
    },

    async updateLegalAction(actionId, action) {
      const [result] = await getPool().execute(`
        UPDATE ${databases.documents}.tblAcciones_Legal
        SET NombreAccion = ?, IsActivo = ?
        WHERE codAccion = ?
      `, [action.name, action.active ? 1 : 0, actionId]);
      return result.affectedRows > 0;
    },
  };
}

import { getDatabasePool } from "../config/database.js";
import { getDatabaseNames } from "../config/databaseNames.js";

export function createCorporateClientRepository(pool) {
  const databases = getDatabaseNames();

  async function getById(countryCode, clientId) {
    const databasePool = pool || getDatabasePool();
    const [rows] = await databasePool.execute(
      `SELECT CodClientesCorp AS id, CodigoFA AS faCode, Nombre_Cliente AS name,
              NombreContacto AS contactName, PuestoContacto AS contactPosition,
              TelefonoContacto AS contactPhone, CorreoContacto AS contactEmail,
              EstadoCliente AS isActive, IsSuspendido AS isSuspended, IsDescuento AS hasDiscount,
              DATE_FORMAT(FechaCreado, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM ${databases.documents}.tblClientesCorp
       WHERE CodClientesCorp = ? AND CodPais = ?`,
      [clientId, countryCode],
    );
    if (!rows[0]) return null;
    const [contacts] = await databasePool.execute(
      `SELECT CodContacto AS id, Nombre AS name, Puesto AS position, Telefono AS phone,
              Correo AS email, isActivo AS isActive
       FROM ${databases.documents}.tblContactosClientesCorp
       WHERE CodClienteCorp = ?
       ORDER BY CodContacto`,
      [clientId],
    );
    const normalizedContacts = contacts.map((contact) => ({
      ...contact,
      isActive: Boolean(contact.isActive),
    }));
    return {
      ...rows[0],
      isActive: Boolean(rows[0].isActive),
      isSuspended: Boolean(rows[0].isSuspended),
      hasDiscount: Boolean(rows[0].hasDiscount),
      contacts: normalizedContacts.filter((contact) => contact.isActive),
      allContacts: normalizedContacts,
    };
  }

  async function replaceContacts(connection, clientId, contacts) {
    await connection.execute(
      `UPDATE ${databases.documents}.tblContactosClientesCorp SET isActivo = 0 WHERE CodClienteCorp = ?`,
      [clientId],
    );
    for (const contact of contacts) {
      if (contact.id) {
        const [result] = await connection.execute(
          `UPDATE ${databases.documents}.tblContactosClientesCorp
           SET Nombre = ?, Puesto = ?, Telefono = ?, Correo = ?, isActivo = 1
           WHERE CodContacto = ? AND CodClienteCorp = ?`,
          [contact.name, contact.position || null, contact.phone || null, contact.email || null, contact.id, clientId],
        );
        if (result.affectedRows) continue;
      }
      await connection.execute(
        `INSERT INTO ${databases.documents}.tblContactosClientesCorp
           (CodClienteCorp, Nombre, Puesto, Telefono, Correo, isActivo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [clientId, contact.name, contact.position || null, contact.phone || null, contact.email || null],
      );
    }
  }

  return {
    async list(countryCode, filters) {
      const databasePool = pool || getDatabasePool();
      const conditions = ["CodPais = ?"];
      const parameters = [countryCode];
      if (filters.activeOnly) conditions.push("EstadoCliente = 1");
      if (filters.search) {
        conditions.push("(Nombre_Cliente LIKE CONCAT('%', ?, '%') OR CodigoFA LIKE CONCAT('%', ?, '%') OR NombreContacto LIKE CONCAT('%', ?, '%'))");
        parameters.push(filters.search, filters.search, filters.search);
      }
      const where = `WHERE ${conditions.join(" AND ")}`;
      const offset = (filters.page - 1) * filters.pageSize;
      const [[items], [countRows]] = await Promise.all([
        databasePool.execute(
          `SELECT CodClientesCorp AS id, CodigoFA AS faCode, Nombre_Cliente AS name,
                  NombreContacto AS contactName, PuestoContacto AS contactPosition,
                  TelefonoContacto AS contactPhone, CorreoContacto AS contactEmail,
                  EstadoCliente AS isActive
           FROM ${databases.documents}.tblClientesCorp
           ${where}
           ORDER BY Nombre_Cliente
           LIMIT ${filters.pageSize} OFFSET ${offset}`,
          parameters,
        ),
        databasePool.execute(
          `SELECT COUNT(*) AS total FROM ${databases.documents}.tblClientesCorp ${where}`,
          parameters,
        ),
      ]);
      return {
        items: items.map((item) => ({ ...item, isActive: Boolean(item.isActive) })),
        total: Number(countRows[0]?.total || 0),
        page: filters.page,
        pageSize: filters.pageSize,
      };
    },

    getById,

    async create(countryCode, userId, client) {
      const databasePool = pool || getDatabasePool();
      const connection = await databasePool.getConnection();
      try {
        await connection.beginTransaction();
        const [existing] = await connection.execute(
          `SELECT CodClientesCorp AS id FROM ${databases.documents}.tblClientesCorp
           WHERE CodPais = ? AND CodigoFA = ? LIMIT 1`,
          [countryCode, client.faCode],
        );
        if (existing[0]) {
          const error = new Error("Ya existe un cliente corporativo con ese CodigoFA.");
          error.status = 409;
          error.code = "CLIENT_CODE_EXISTS";
          error.field = "faCode";
          throw error;
        }
        const [result] = await connection.execute(
          `INSERT INTO ${databases.documents}.tblClientesCorp
             (Nombre_Cliente, EstadoCliente, CodPais, NombreContacto, PuestoContacto,
              TelefonoContacto, CorreoContacto, UsuarioCreado, FechaCreado, CodigoFA,
              IsSuspendido, IsDescuento)
           VALUES (?, 1, ?, ?, ?, ?, ?, ?, NOW(), ?, 0, 0)`,
          [
            client.name,
            countryCode,
            client.contactName || null,
            client.contactPosition || null,
            client.contactPhone || null,
            client.contactEmail || null,
            userId,
            client.faCode,
          ],
        );
        await replaceContacts(connection, result.insertId, client.contacts);
        await connection.commit();
        return getById(countryCode, result.insertId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async update(countryCode, userId, clientId, client) {
      const databasePool = pool || getDatabasePool();
      const connection = await databasePool.getConnection();
      try {
        await connection.beginTransaction();
        const [duplicate] = await connection.execute(
          `SELECT CodClientesCorp AS id FROM ${databases.documents}.tblClientesCorp
           WHERE CodPais = ? AND CodigoFA = ? AND CodClientesCorp <> ? LIMIT 1`,
          [countryCode, client.faCode, clientId],
        );
        if (duplicate[0]) {
          const error = new Error("Ya existe un cliente corporativo con ese CodigoFA.");
          error.status = 409;
          error.code = "CLIENT_CODE_EXISTS";
          error.field = "faCode";
          throw error;
        }
        const [result] = await connection.execute(
          `UPDATE ${databases.documents}.tblClientesCorp
           SET Nombre_Cliente = ?, NombreContacto = ?, PuestoContacto = ?,
               TelefonoContacto = ?, CorreoContacto = ?, UsuarioActualiza = ?,
               FechaActualiza = NOW(), CodigoFA = ?
           WHERE CodClientesCorp = ? AND CodPais = ?`,
          [
            client.name,
            client.contactName || null,
            client.contactPosition || null,
            client.contactPhone || null,
            client.contactEmail || null,
            userId,
            client.faCode,
            clientId,
            countryCode,
          ],
        );
        if (!result.affectedRows) {
          const error = new Error("El cliente corporativo solicitado no existe.");
          error.status = 404;
          error.code = "CORPORATE_CLIENT_NOT_FOUND";
          throw error;
        }
        await replaceContacts(connection, clientId, client.contacts);
        await connection.commit();
        return getById(countryCode, clientId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async setStatus(countryCode, userId, clientId, isActive) {
      const databasePool = pool || getDatabasePool();
      const [result] = await databasePool.execute(
        `UPDATE ${databases.documents}.tblClientesCorp
         SET EstadoCliente = ?, UsuarioActualiza = ?, FechaActualiza = NOW()
         WHERE CodClientesCorp = ? AND CodPais = ?`,
        [isActive, userId, clientId, countryCode],
      );
      if (!result.affectedRows) {
        const error = new Error("El cliente corporativo solicitado no existe.");
        error.status = 404;
        error.code = "CORPORATE_CLIENT_NOT_FOUND";
        throw error;
      }
      return getById(countryCode, clientId);
    },

    async bulkUpsert(countryCode, userId, clients) {
      const databasePool = pool || getDatabasePool();
      const connection = await databasePool.getConnection();
      let created = 0;
      let updated = 0;
      try {
        await connection.beginTransaction();
        for (const client of clients) {
          const [existing] = await connection.execute(
            `SELECT CodClientesCorp AS id FROM ${databases.documents}.tblClientesCorp
             WHERE CodPais = ? AND CodigoFA = ? LIMIT 1`,
            [countryCode, client.faCode],
          );
          if (existing[0]) {
            await connection.execute(
              `UPDATE ${databases.documents}.tblClientesCorp
               SET Nombre_Cliente = ?, NombreContacto = ?, PuestoContacto = ?,
                   TelefonoContacto = ?, CorreoContacto = ?, EstadoCliente = 1,
                   UsuarioActualiza = ?, FechaActualiza = NOW()
               WHERE CodClientesCorp = ?`,
              [
                client.name,
                client.contactName || null,
                client.contactPosition || null,
                client.contactPhone || null,
                client.contactEmail || null,
                userId,
                existing[0].id,
              ],
            );
            updated += 1;
          } else {
            await connection.execute(
              `INSERT INTO ${databases.documents}.tblClientesCorp
                 (Nombre_Cliente, EstadoCliente, CodPais, NombreContacto, PuestoContacto,
                  TelefonoContacto, CorreoContacto, UsuarioCreado, FechaCreado, CodigoFA,
                  IsSuspendido, IsDescuento)
               VALUES (?, 1, ?, ?, ?, ?, ?, ?, NOW(), ?, 0, 0)`,
              [
                client.name,
                countryCode,
                client.contactName || null,
                client.contactPosition || null,
                client.contactPhone || null,
                client.contactEmail || null,
                userId,
                client.faCode,
              ],
            );
            created += 1;
          }
        }
        await connection.commit();
        return { processed: clients.length, created, updated };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

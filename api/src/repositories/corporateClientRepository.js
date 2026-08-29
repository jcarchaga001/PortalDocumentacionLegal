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

  async function createContacts(connection, clientId, contacts) {
    for (const contact of contacts) {
      await connection.execute(
        `INSERT INTO ${databases.documents}.tblContactosClientesCorp
           (CodClienteCorp, Nombre, Puesto, Telefono, Correo, isActivo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [clientId, contact.name, contact.position, contact.phone, contact.email],
      );
    }
  }

  async function applyContactChanges(connection, clientId, contacts, removedContactIds) {
    await createContacts(connection, clientId, contacts.filter((contact) => !contact.id));
    for (const contactId of removedContactIds) {
      await connection.execute(
        `UPDATE ${databases.documents}.tblContactosClientesCorp
         SET isActivo = 0
         WHERE CodContacto = ? AND CodClienteCorp = ?`,
        [contactId, clientId],
      );
    }
  }

  return {
    async list(countryCode, filters) {
      const databasePool = pool || getDatabasePool();
      const conditions = ["CodPais = ?", "EstadoCliente = 1"];
      const parameters = [countryCode];
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

    async listContacts(countryCode, clientId) {
      const databasePool = pool || getDatabasePool();
      const [rows] = await databasePool.execute(
        `SELECT contact.CodContacto AS id,
                contact.CodClienteCorp AS clientId,
                contact.Nombre AS name,
                contact.Puesto AS position,
                contact.Telefono AS phone,
                contact.Correo AS email,
                contact.isActivo AS isActive
         FROM ${databases.documents}.tblContactosClientesCorp contact
         INNER JOIN ${databases.documents}.tblClientesCorp client
                 ON client.CodClientesCorp = contact.CodClienteCorp
                AND client.CodPais = ?
         WHERE contact.CodClienteCorp = ?
           AND contact.isActivo = 1
         LIMIT 500`,
        [countryCode, clientId],
      );
      return rows.map((contact) => ({
        ...contact,
        isActive: Boolean(contact.isActive),
      }));
    },

    async create(countryCode, userId, client) {
      const databasePool = pool || getDatabasePool();
      const connection = await databasePool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
          `INSERT INTO ${databases.documents}.tblClientesCorp
             (Nombre_Cliente, EstadoCliente, CodPais, NombreContacto, PuestoContacto,
              TelefonoContacto, CorreoContacto, UsuarioCreado, FechaCreado, CodigoFA,
              IsSuspendido, IsDescuento)
           VALUES (?, 1, ?, ?, ?, ?, ?, ?, CURDATE(), ?, 0, 0)`,
          [
            client.name,
            countryCode,
            client.contactName,
            client.contactPosition,
            client.contactPhone,
            client.contactEmail,
            userId,
            client.faCode,
          ],
        );
        await createContacts(connection, result.insertId, client.contacts);
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
        const [current] = await connection.execute(
          `SELECT CodClientesCorp AS id
           FROM ${databases.documents}.tblClientesCorp
           WHERE CodClientesCorp = ? AND CodPais = ?
           FOR UPDATE`,
          [clientId, countryCode],
        );
        if (!current[0]) {
          const error = new Error("El cliente corporativo solicitado no existe.");
          error.status = 404;
          error.code = "CORPORATE_CLIENT_NOT_FOUND";
          throw error;
        }
        await connection.execute(
          `UPDATE ${databases.documents}.tblClientesCorp
           SET Nombre_Cliente = ?, NombreContacto = ?, PuestoContacto = ?,
               TelefonoContacto = ?, CorreoContacto = ?, UsuarioActualiza = ?,
               FechaActualiza = CURDATE(), CodigoFA = ?
           WHERE CodClientesCorp = ? AND CodPais = ?`,
          [
            client.name,
            client.contactName,
            client.contactPosition,
            client.contactPhone,
            client.contactEmail,
            userId,
            client.faCode,
            clientId,
            countryCode,
          ],
        );
        await applyContactChanges(connection, clientId, client.contacts, client.removedContactIds);
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
      try {
        await connection.beginTransaction();
        for (const client of clients) {
          await connection.execute(
            `INSERT INTO ${databases.documents}.tblClientesCorp
               (Nombre_Cliente, EstadoCliente, CodPais, NombreContacto, PuestoContacto,
                TelefonoContacto, CorreoContacto, UsuarioCreado, FechaCreado, CodigoFA)
             VALUES (?, 1, ?, ?, ?, ?, ?, ?, CURDATE(), ?)`,
            [
              client.name,
              countryCode,
              client.contactName,
              client.contactPosition,
              client.contactPhone,
              client.contactEmail,
              userId,
              client.faCode,
            ],
          );
        }
        await connection.commit();
        return { processed: clients.length, created: clients.length, updated: 0 };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

import { normalizedFailure, normalizedSuccess } from "../services/serviceResult.js";

const INCIDENT_ACTION_QUERY_ERROR = "INCIDENT_ACTION_QUERY_ERROR";
const databaseConnectionErrorCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

function isDatabaseQueryFailure(error) {
  const code = String(error?.code || "");
  return Boolean(error?.sqlState)
    || code.startsWith("ER_")
    || code.startsWith("PROTOCOL_")
    || databaseConnectionErrorCodes.has(code);
}

export function createIncidentController(incidentService, { logError = console.error } = {}) {
  return {
    async catalogs(req, res, next) {
      try {
        const catalogs = await incidentService.catalogs(req.params.scope, req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Catalogos de incidentes consultados correctamente.", catalogs));
      } catch (error) {
        if (["internal-actions", "external-actions"].includes(req.params.scope)
          && isDatabaseQueryFailure(error)) {
          logError("Incident action catalog query failed.", {
            code: error.code || null,
            errno: error.errno || null,
            sqlState: error.sqlState || null,
          });
          res.status(500).json(normalizedFailure("Error executing query.", {
            code: INCIDENT_ACTION_QUERY_ERROR,
          }));
          return;
        }
        next(error);
      }
    },

    async incidents(req, res, next) {
      try {
        const data = await incidentService.listIncidents(req.params.scope, req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Incidentes consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async actions(req, res, next) {
      try {
        const data = await incidentService.listActions(req.params.scope, req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Acciones de incidentes consultadas correctamente.", data));
      } catch (error) {
        if (isDatabaseQueryFailure(error)) {
          logError("Incident action query failed.", {
            code: error.code || null,
            errno: error.errno || null,
            sqlState: error.sqlState || null,
          });
          res.status(500).json(normalizedFailure("Error executing query.", {
            code: INCIDENT_ACTION_QUERY_ERROR,
          }));
          return;
        }
        next(error);
      }
    },

    async laborCases(req, res, next) {
      try {
        const data = await incidentService.listLaborCases(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Casos laborales consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async laborActions(req, res, next) {
      try {
        const data = await incidentService.listLaborActions(req.auth.countryCode, req.auth.id, req.query);
        res.json(normalizedSuccess("Acciones de casos laborales consultadas correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async incident(req, res, next) {
      try {
        const data = await incidentService.getIncident(req.params.scope, req.auth.countryCode, req.params.incidentId);
        res.json(normalizedSuccess("Detalle del incidente consultado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async incidentAction(req, res, next) {
      try {
        const data = await incidentService.getIncidentAction(
          req.params.scope,
          req.auth.countryCode,
          req.params.incidentId,
          req.params.actionId,
        );
        res.json(normalizedSuccess("Detalle de la accion consultado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async createIncident(req, res, next) {
      try {
        const data = await incidentService.createIncident(
          req.params.scope,
          req.auth.countryCode,
          req.auth.id,
          req.body,
        );
        res.status(201).json(normalizedSuccess("Incidente registrado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async createIncidentAction(req, res, next) {
      try {
        const data = await incidentService.createIncidentAction(
          req.params.scope,
          req.auth.countryCode,
          req.auth.id,
          req.params.incidentId,
          req.body,
        );
        res.status(201).json(normalizedSuccess("Accion registrada correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async updateIncidentAction(req, res, next) {
      try {
        const data = await incidentService.updateIncidentAction(
          req.params.scope,
          req.auth.countryCode,
          req.auth.id,
          req.params.actionId,
          req.body,
        );
        res.json(normalizedSuccess("Accion actualizada correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async closeIncident(req, res, next) {
      try {
        const data = await incidentService.closeIncident(
          req.params.scope,
          req.auth.countryCode,
          req.auth.id,
          req.params.incidentId,
          req.body,
        );
        res.json(normalizedSuccess("Incidente cerrado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async addIncidentComment(req, res, next) {
      try {
        const data = await incidentService.addIncidentComment(
          req.params.scope,
          req.auth.countryCode,
          req.auth.id,
          req.params.incidentId,
          req.body,
        );
        res.status(201).json(normalizedSuccess("Comentario agregado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async laborCase(req, res, next) {
      try {
        const data = await incidentService.getLaborCase(req.auth.countryCode, req.params.caseId);
        res.json(normalizedSuccess("Detalle del caso laboral consultado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async createLaborAction(req, res, next) {
      try {
        const data = await incidentService.createLaborAction(
          req.auth.countryCode,
          req.auth.id,
          req.params.caseId,
          req.body,
        );
        res.status(201).json(normalizedSuccess("Accion laboral registrada correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async updateLaborAction(req, res, next) {
      try {
        const data = await incidentService.updateLaborAction(
          req.auth.countryCode,
          req.auth.id,
          req.params.actionId,
          req.body,
        );
        res.json(normalizedSuccess("Accion laboral actualizada correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async updateLaborCase(req, res, next) {
      try {
        const data = await incidentService.updateLaborCase(
          req.auth.countryCode,
          req.auth.id,
          req.params.caseId,
          req.body,
        );
        res.json(normalizedSuccess("Caso laboral actualizado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async addLaborComment(req, res, next) {
      try {
        const data = await incidentService.addLaborComment(
          req.auth.countryCode,
          req.auth.id,
          req.params.caseId,
          req.body,
        );
        res.status(201).json(normalizedSuccess("Comentario agregado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
  };
}

import { normalizedSuccess } from "../services/serviceResult.js";

export function createCorporateClientController(service) {
  return {
    async list(req, res, next) {
      try {
        const data = await service.list(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Clientes corporativos consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async get(req, res, next) {
      try {
        const data = await service.get(req.auth.countryCode, req.params.id);
        res.json(normalizedSuccess("Cliente corporativo consultado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async contacts(req, res, next) {
      try {
        const data = await service.contacts(req.auth.countryCode, req.params.id);
        res.json(normalizedSuccess("Contactos corporativos consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async create(req, res, next) {
      try {
        const data = await service.create(req.auth.countryCode, req.auth.id, req.body);
        res.status(201).json(normalizedSuccess("Cliente corporativo registrado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async update(req, res, next) {
      try {
        const data = await service.update(req.auth.countryCode, req.auth.id, req.params.id, req.body);
        res.json(normalizedSuccess("Cliente corporativo actualizado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async setStatus(req, res, next) {
      try {
        const data = await service.setStatus(req.auth.countryCode, req.auth.id, req.params.id, req.body);
        res.json(normalizedSuccess("Estado del cliente actualizado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async bulkUpsert(req, res, next) {
      try {
        const data = await service.bulkUpsert(req.auth.countryCode, req.auth.id, req.body);
        res.json(normalizedSuccess("Carga de clientes procesada correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
  };
}

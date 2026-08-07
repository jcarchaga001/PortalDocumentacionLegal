import { normalizedSuccess } from "../services/serviceResult.js";

export function createCatalogController(catalogService) {
  return {
    async lookups(req, res, next) {
      try {
        const data = await catalogService.lookups(req.auth.countryCode);
        res.json(normalizedSuccess("Catálogos auxiliares consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async listUsers(req, res, next) {
      try {
        const data = await catalogService.listUsers(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Usuarios consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async setUserAccess(req, res, next) {
      try {
        const data = await catalogService.setUserAccess(req.auth, req.params.id, req.body);
        res.json(normalizedSuccess("Permiso de usuario actualizado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async listProviders(req, res, next) {
      try {
        const data = await catalogService.listProviders(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Proveedores consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async createProvider(req, res, next) {
      try {
        const data = await catalogService.createProvider(req.auth, req.body);
        res.status(201).json(normalizedSuccess("Proveedor guardado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async updateProvider(req, res, next) {
      try {
        const data = await catalogService.updateProvider(req.auth, req.params.id, req.body);
        res.json(normalizedSuccess("Proveedor actualizado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async listCategories(req, res, next) {
      try {
        const data = await catalogService.listCategories(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Categorías documentales consultadas correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async setCategoryAccess(req, res, next) {
      try {
        const data = await catalogService.setCategoryAccess(req.auth, req.params.id, req.body);
        res.json(normalizedSuccess("Acceso de subcategoría actualizado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async listEntities(req, res, next) {
      try {
        const data = await catalogService.listEntities(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Entes gubernamentales consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async createEntity(req, res, next) {
      try {
        const data = await catalogService.createEntity(req.auth, req.body);
        res.status(201).json(normalizedSuccess("Ente gubernamental guardado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async updateEntity(req, res, next) {
      try {
        const data = await catalogService.updateEntity(req.auth, req.params.id, req.body);
        res.json(normalizedSuccess("Ente gubernamental actualizado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async deactivateEntity(req, res, next) {
      try {
        const data = await catalogService.deactivateEntity(req.auth, req.params.id);
        res.json(normalizedSuccess("Ente gubernamental inactivado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async listLegalActions(req, res, next) {
      try {
        const data = await catalogService.listLegalActions(req.query);
        res.json(normalizedSuccess("Acciones legales consultadas correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async createLegalAction(req, res, next) {
      try {
        const data = await catalogService.createLegalAction(req.auth, req.body);
        res.status(201).json(normalizedSuccess("Acción legal guardada correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async updateLegalAction(req, res, next) {
      try {
        const data = await catalogService.updateLegalAction(req.params.id, req.body);
        res.json(normalizedSuccess("Acción legal actualizada correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
  };
}

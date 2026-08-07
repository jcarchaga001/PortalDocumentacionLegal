import { normalizedSuccess } from "../services/serviceResult.js";

export function createAgreementController(agreementService) {
  return {
    async list(req, res, next) {
      try {
        const data = await agreementService.list(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Convenios consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async catalogs(req, res, next) {
      try {
        const data = await agreementService.catalogs(req.auth.countryCode);
        res.json(normalizedSuccess("Catalogos de convenios consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async get(req, res, next) {
      try {
        const data = await agreementService.get(req.auth.countryCode, req.params.id);
        res.json(normalizedSuccess("Convenio consultado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async create(req, res, next) {
      try {
        const data = await agreementService.create(req.auth.countryCode, req.auth.id, req.body);
        res.status(201).json(normalizedSuccess("Convenio registrado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async update(req, res, next) {
      try {
        const data = await agreementService.update(
          req.auth.countryCode,
          req.auth.id,
          req.params.id,
          req.body,
        );
        res.json(normalizedSuccess("Convenio actualizado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async addAttachment(req, res, next) {
      try {
        const data = await agreementService.addAttachment(
          req.auth.countryCode,
          req.auth.id,
          req.params.id,
          req.body,
        );
        res.status(201).json(normalizedSuccess("Adjunto registrado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async removeAttachment(req, res, next) {
      try {
        const data = await agreementService.removeAttachment(
          req.auth.countryCode,
          req.auth.id,
          req.params.id,
          req.params.attachmentId,
        );
        res.json(normalizedSuccess("Adjunto eliminado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
  };
}

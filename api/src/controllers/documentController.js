import { normalizedSuccess } from "../services/serviceResult.js";

function sendFile(res, file, download) {
  const disposition = download ? "attachment" : "inline";
  res.setHeader("Content-Type", file.contentType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename*=UTF-8''${encodeURIComponent(file.fileName || "archivo")}`,
  );
  res.send(file.buffer);
}

export function createDocumentController(documentService) {
  return {
    async list(req, res, next) {
      try {
        const documents = await documentService.list(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Documentos consultados correctamente.", documents));
      } catch (error) {
        next(error);
      }
    },
    async catalogs(req, res, next) {
      try {
        const catalogs = await documentService.catalogs(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Catalogos documentales consultados correctamente.", catalogs));
      } catch (error) {
        next(error);
      }
    },
    async get(req, res, next) {
      try {
        const document = await documentService.get(req.auth.countryCode, req.params.id);
        res.json(normalizedSuccess("Documento consultado correctamente.", document));
      } catch (error) {
        next(error);
      }
    },
    async create(req, res, next) {
      try {
        const document = await documentService.create(req.auth, req.body);
        res.status(201).json(normalizedSuccess("Registro exitoso", document));
      } catch (error) {
        next(error);
      }
    },
    async updateReference2(req, res, next) {
      try {
        const document = await documentService.updateReference2(req.auth, req.params.id, req.body);
        res.json(normalizedSuccess("Documento actualizado correctamente.", document));
      } catch (error) {
        next(error);
      }
    },
    async approve(req, res, next) {
      try {
        const document = await documentService.approve(req.auth, req.params.id);
        res.json(normalizedSuccess("El documento fue aprobado con exito", document));
      } catch (error) {
        next(error);
      }
    },
    async reject(req, res, next) {
      try {
        const document = await documentService.reject(req.auth, req.params.id);
        res.json(normalizedSuccess("El documento fue rechazado", document));
      } catch (error) {
        next(error);
      }
    },
    async remove(req, res, next) {
      try {
        const data = await documentService.remove(req.auth, req.params.id);
        res.json(normalizedSuccess("Registro eliminado exitosamente", data));
      } catch (error) {
        next(error);
      }
    },
    async attachment(req, res, next) {
      try {
        const file = await documentService.attachment(req.auth.countryCode, req.params.id);
        sendFile(res, file, req.query.download === "1" || req.query.download === "true");
      } catch (error) {
        next(error);
      }
    },
    async branch(req, res, next) {
      try {
        const data = await documentService.branch(req.auth.countryCode, req.params.branchId);
        res.json(normalizedSuccess("Detalle de sucursal consultado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async createBranchDocument(req, res, next) {
      try {
        const document = await documentService.createBranchDocument(req.auth, req.params.branchId, req.body);
        res.status(201).json(normalizedSuccess("Registro exitoso", document));
      } catch (error) {
        next(error);
      }
    },
    async addBookEvidence(req, res, next) {
      try {
        const evidence = await documentService.addBookEvidence(
          req.auth,
          req.params.branchId,
          req.params.assignmentId,
          req.body,
        );
        res.status(201).json(normalizedSuccess("Registro exitoso", evidence));
      } catch (error) {
        next(error);
      }
    },
    async updateBookRequired(req, res, next) {
      try {
        const data = await documentService.updateBookRequired(
          req.auth,
          req.params.branchId,
          req.params.assignmentId,
          req.body,
        );
        res.json(normalizedSuccess("Libro actualizado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async bookEvidence(req, res, next) {
      try {
        const file = await documentService.bookEvidence(
          req.auth.countryCode,
          req.params.branchId,
          req.params.evidenceId,
        );
        sendFile(res, file, req.query.download !== "0");
      } catch (error) {
        next(error);
      }
    },
    async removeBookEvidence(req, res, next) {
      try {
        const data = await documentService.removeBookEvidence(
          req.auth,
          req.params.branchId,
          req.params.evidenceId,
        );
        res.json(normalizedSuccess("Registro eliminado exitosamente", data));
      } catch (error) {
        next(error);
      }
    },
  };
}

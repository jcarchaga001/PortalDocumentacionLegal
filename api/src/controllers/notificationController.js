import { normalizedSuccess } from "../services/serviceResult.js";

export function createNotificationController(notificationService) {
  return {
    templates(_req, res) {
      res.json(normalizedSuccess(
        "Plantillas de correo legacy consultadas correctamente.",
        notificationService.listTemplates(),
      ));
    },

    preview(req, res, next) {
      try {
        const rendered = notificationService.preview(req.params.template, req.body?.data || req.body || {});
        res.json(normalizedSuccess("Vista previa generada correctamente.", rendered));
      } catch (error) {
        next(error);
      }
    },

    async send(req, res, next) {
      try {
        const result = await notificationService.sendTemplate(req.params.template, req.body);
        res.status(result.sent ? 202 : 200).json(normalizedSuccess(
          result.sent ? "Correo enviado al servicio TD correctamente." : "Vista previa de envío generada correctamente.",
          result,
        ));
      } catch (error) {
        next(error);
      }
    },

    async workflow(req, res, next) {
      try {
        const result = await notificationService.runWorkflow(req.params.workflow, req.body);
        res.status(result.sent ? 202 : 200).json(normalizedSuccess(
          result.skipped ? "La notificación no cumplió las condiciones de destinatario del legacy." : "Flujo de notificación ejecutado correctamente.",
          result,
        ));
      } catch (error) {
        next(error);
      }
    },

    async documentExpiration(req, res, next) {
      try {
        const result = await notificationService.sendDocumentExpiration({
          countryCode: req.auth.countryCode,
          documentId: req.params.documentId,
          dryRun: req.body?.dryRun,
        });
        res.status(result.sent ? 202 : 200).json(normalizedSuccess(
          result.sent
            ? "Correo enviado al servicio TD correctamente."
            : "Vista previa de envío generada correctamente.",
          result,
        ));
      } catch (error) {
        next(error);
      }
    },

    async documentExpirations(req, res, next) {
      try {
        const result = await notificationService.runDocumentExpirationProcess(req.body || {});
        res.status(result.dryRun ? 200 : 202).json(normalizedSuccess(
          result.dryRun
            ? "Simulación del proceso de vencimiento completada sin cambios ni correos."
            : "Proceso de vencimiento ejecutado correctamente.",
          result,
        ));
      } catch (error) {
        next(error);
      }
    },

    async agreementExpirations(req, res, next) {
      try {
        const result = await notificationService.runAgreementExpirationProcess(req.body || {});
        res.status(result.dryRun ? 200 : 202).json(normalizedSuccess(
          result.dryRun
            ? "Simulación de convenios por vencer completada sin cambios ni correos."
            : "Notificación de convenios por vencer ejecutada correctamente.",
          result,
        ));
      } catch (error) {
        next(error);
      }
    },
  };
}

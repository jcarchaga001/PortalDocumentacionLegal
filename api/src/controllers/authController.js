import { normalizedSuccess } from "../services/serviceResult.js";

function requireRecoveryService(passwordRecoveryService) {
  if (passwordRecoveryService) return passwordRecoveryService;
  const error = new Error("El servicio de recuperacion no esta disponible.");
  error.status = 503;
  error.code = "RECOVERY_UNAVAILABLE";
  throw error;
}

export function createAuthController({ authService, sessionService, passwordRecoveryService }) {
  return {
    async countries(_req, res, next) {
      try {
        const countries = await authService.listCountries();
        res.json(normalizedSuccess("Paises disponibles.", countries));
      } catch (error) {
        next(error);
      }
    },

    async login(req, res, next) {
      try {
        const profile = await authService.authenticate(req.body);
        const token = await sessionService.createToken(profile);
        sessionService.setCookie(res, token);
        res.json(normalizedSuccess("Sesion iniciada correctamente.", profile));
      } catch (error) {
        next(error);
      }
    },

    me(req, res) {
      res.json(normalizedSuccess("Sesion activa.", req.auth));
    },

    logout(_req, res) {
      sessionService.clearCookie(res);
      res.json(normalizedSuccess("Sesion cerrada correctamente."));
    },

    async requestPasswordRecovery(req, res, next) {
      try {
        const data = await requireRecoveryService(passwordRecoveryService).request(req.body);
        res.json(normalizedSuccess("Se ha enviado sus datos de ingreso al correo ingresado", data));
      } catch (error) {
        next(error);
      }
    },

    async resetPassword(req, res, next) {
      try {
        const data = await requireRecoveryService(passwordRecoveryService).reset(
          req.auth.id,
          req.body?.password,
        );
        sessionService.clearCookie(res);
        res.json(normalizedSuccess("Clave actualizada correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
  };
}

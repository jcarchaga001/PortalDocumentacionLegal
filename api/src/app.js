import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { createPersonRepository } from "./repositories/personRepository.js";
import { createCountryRepository } from "./repositories/countryRepository.js";
import { createDashboardRepository } from "./repositories/dashboardRepository.js";
import { createDocumentRepository } from "./repositories/documentRepository.js";
import { createAgreementRepository } from "./repositories/agreementRepository.js";
import { createCorporateClientRepository } from "./repositories/corporateClientRepository.js";
import { createIncidentRepository } from "./repositories/incidentRepository.js";
import { createNotificationRepository } from "./repositories/notificationRepository.js";
import { createCatalogRepository } from "./repositories/catalogRepository.js";
import { createRiskRepository } from "./repositories/riskRepository.js";
import { createRequireAuthentication } from "./middlewares/requireAuthentication.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createDashboardRouter } from "./routes/dashboardRoutes.js";
import { createDocumentRouter } from "./routes/documentRoutes.js";
import { createAgreementRouter } from "./routes/agreementRoutes.js";
import { createCorporateClientRouter } from "./routes/corporateClientRoutes.js";
import { createIncidentRouter } from "./routes/incidentRoutes.js";
import { createNotificationRouter } from "./routes/notificationRoutes.js";
import { createCatalogRouter } from "./routes/catalogRoutes.js";
import { createRiskRouter } from "./routes/riskRoutes.js";
import { createHealthRouter } from "./routes/healthRoutes.js";
import { createTdRouter } from "./routes/tdRoutes.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorMiddleware.js";
import { createAuthService } from "./services/authService.js";
import { createPasswordHashService } from "./services/passwordHashService.js";
import { createSessionService } from "./services/sessionService.js";
import { createDashboardService } from "./services/dashboardService.js";
import { createDocumentService } from "./services/documentService.js";
import { createAgreementService } from "./services/agreementService.js";
import { createCorporateClientService } from "./services/corporateClientService.js";
import { createIncidentService } from "./services/incidentService.js";
import { createNotificationService } from "./services/notificationService.js";
import { createCatalogService } from "./services/catalogService.js";
import { createPasswordRecoveryService } from "./services/passwordRecoveryService.js";
import { createRiskService } from "./services/riskService.js";

export function createApp({ basePath, authDependencies = {} }) {
  const app = express();
  app.set("trust proxy", "loopback");
  const apiBasePath = `${basePath}/api`;
  const personRepository = authDependencies.authService
    ? null
    : authDependencies.personRepository || createPersonRepository();
  const countryRepository = authDependencies.authService
    ? null
    : authDependencies.countryRepository || createCountryRepository();
  const passwordHashService = authDependencies.authService
    ? null
    : authDependencies.passwordHashService || createPasswordHashService();
  const authService = authDependencies.authService
    || createAuthService({ countryRepository, personRepository, passwordHashService });
  const passwordRecoveryService = authDependencies.passwordRecoveryService
    || (personRepository && passwordHashService
      ? createPasswordRecoveryService({ personRepository, passwordHashService })
      : null);
  const sessionService = authDependencies.sessionService || createSessionService({ basePath });
  const requireAuthentication = createRequireAuthentication(sessionService);
  const dashboardService = createDashboardService(createDashboardRepository());
  const documentService = createDocumentService(createDocumentRepository());
  const agreementService = createAgreementService(createAgreementRepository());
  const corporateClientService = createCorporateClientService(createCorporateClientRepository());
  const notificationService = createNotificationService({
    repository: createNotificationRepository(),
  });
  const incidentService = createIncidentService(createIncidentRepository(), { notificationService });
  const catalogService = createCatalogService(createCatalogRepository());
  const riskService = createRiskService(createRiskRepository());

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "50mb" }));

  app.use(`${apiBasePath}/health`, createHealthRouter());
  app.use(`${apiBasePath}/auth`, createAuthRouter({
    authService,
    sessionService,
    passwordRecoveryService,
  }));
  app.use(`${apiBasePath}/dashboard`, requireAuthentication, createDashboardRouter(dashboardService));
  app.use(`${apiBasePath}/documents`, requireAuthentication, createDocumentRouter(documentService));
  app.use(`${apiBasePath}/agreements`, requireAuthentication, createAgreementRouter(agreementService));
  app.use(
    `${apiBasePath}/corporate-clients`,
    requireAuthentication,
    createCorporateClientRouter(corporateClientService),
  );
  app.use(`${apiBasePath}/incidents`, requireAuthentication, createIncidentRouter(incidentService));
  app.use(
    `${apiBasePath}/notifications`,
    requireAuthentication,
    createNotificationRouter(notificationService),
  );
  app.use(`${apiBasePath}/catalogs`, requireAuthentication, createCatalogRouter(catalogService));
  app.use(`${apiBasePath}/risk`, requireAuthentication, createRiskRouter(riskService));
  app.use(`${apiBasePath}/td`, requireAuthentication, createTdRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

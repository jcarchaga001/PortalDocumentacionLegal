import { Redirect, Route, Switch } from "react-router-dom";
import { useAuth } from "../config/AuthContext.jsx";
import { PortalLayout } from "../layouts/PortalLayout.jsx";
import { DashboardPage } from "../pages/DashboardPage.jsx";
import { AdministrativeDocumentHistoryPage } from "../pages/AdministrativeDocumentHistoryPage.jsx";
import { ExpiringDocumentsPage } from "../pages/ExpiringDocumentsPage.jsx";
import { AgreementsPage } from "../pages/AgreementsPage.jsx";
import { AgreementFormPage } from "../pages/AgreementFormPage.jsx";
import { AgreementDetailPage } from "../pages/AgreementDetailPage.jsx";
import { CorporateClientsPage } from "../pages/CorporateClientsPage.jsx";
import { CorporateClientFormPage } from "../pages/CorporateClientFormPage.jsx";
import { CorporateClientBulkPage } from "../pages/CorporateClientBulkPage.jsx";
import { InternalIncidentsPage, ExternalIncidentsPage } from "../pages/IncidentListPage.jsx";
import { InternalIncidentActionsPage, ExternalIncidentActionsPage } from "../pages/IncidentActionsPage.jsx";
import {
  InternalIncidentRegistrationPage,
  ExternalIncidentRegistrationPage,
} from "../pages/IncidentRegistrationPage.jsx";
import { IncidentDetailPage } from "../pages/IncidentDetailPage.jsx";
import { LaborCasesPage } from "../pages/LaborCasesPage.jsx";
import { LaborActionsPage } from "../pages/LaborActionsPage.jsx";
import { LaborCaseDetailPage } from "../pages/LaborCaseDetailPage.jsx";
import { LegacyLaborCaseDetailPage } from "../pages/LegacyLaborCaseDetailPage.jsx";
import { UserPermissionsPage } from "../pages/UserPermissionsPage.jsx";
import { ProviderCatalogPage } from "../pages/ProviderCatalogPage.jsx";
import { DocumentCategoriesPage } from "../pages/DocumentCategoriesPage.jsx";
import { GovernmentEntitiesPage } from "../pages/GovernmentEntitiesPage.jsx";
import { LegalActionsCatalogPage } from "../pages/LegalActionsCatalogPage.jsx";
import { DocumentCreatePage } from "../pages/DocumentCreatePage.jsx";
import { DocumentHistoryPage } from "../pages/DocumentHistoryPage.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { PasswordResetPage } from "../pages/PasswordResetPage.jsx";
import { InvalidPermissionsPage } from "../pages/InvalidPermissionsPage.jsx";
import { MaintenancePage } from "../pages/MaintenancePage.jsx";
import { PortalLandingPage } from "../pages/PortalLandingPage.jsx";
import { BranchMonitoringPage } from "../pages/BranchMonitoringPage.jsx";
import { RiskHistoryPage } from "../pages/RiskHistoryPage.jsx";
import { RiskDetailPage } from "../pages/RiskDetailPage.jsx";
import { DocumentDetailPage } from "../pages/DocumentDetailPage.jsx";
import { BranchDocumentDetailPage } from "../pages/BranchDocumentDetailPage.jsx";
import { ProtectedRoute } from "./ProtectedRoute.jsx";
import { ROUTES } from "./routePaths.js";

export function AppRoutes() {
  const { user, loading } = useAuth();
  return (
    <Switch>
      <Route path={ROUTES.login} exact>
        {!loading && user
          ? <Redirect to={user.mustResetPassword ? ROUTES.passwordReset : ROUTES.dashboard} />
          : <LoginPage />}
      </Route>
      <Route path={ROUTES.maintenance} exact component={MaintenancePage} />
      <Route path={ROUTES.invalidPermissions} exact component={InvalidPermissionsPage} />
      <ProtectedRoute path="/">
        <PortalLayout>
          <Switch>
            <Route path={ROUTES.passwordReset} exact component={PasswordResetPage} />
            {user?.mustResetPassword ? <Redirect to={ROUTES.passwordReset} /> : null}
            <Route path={ROUTES.home} exact component={PortalLandingPage} />
            <Route path={ROUTES.branchMonitoring} exact component={BranchMonitoringPage} />
            <Route path={ROUTES.dashboard} exact component={DashboardPage} />
            <Route path={ROUTES.documentHistory} exact component={DocumentHistoryPage} />
            <Route path={ROUTES.documentCreate} exact component={DocumentCreatePage} />
            <Route path={ROUTES.documentDetail} exact component={DocumentDetailPage} />
            <Route path={ROUTES.branchDocumentDetail} exact component={BranchDocumentDetailPage} />
            <Route path={ROUTES.administrativeDocuments} exact component={AdministrativeDocumentHistoryPage} />
            <Route path={ROUTES.expiringDocuments} exact component={ExpiringDocumentsPage} />
            <Route path={ROUTES.agreements} exact component={AgreementsPage} />
            <Route path={ROUTES.agreementCreate} exact component={AgreementFormPage} />
            <Route path={ROUTES.agreementDetail} exact component={AgreementDetailPage} />
            <Route path={ROUTES.corporateClients} exact component={CorporateClientsPage} />
            <Route path={ROUTES.corporateClientCreate} exact component={CorporateClientFormPage} />
            <Route path={ROUTES.corporateClientBulk} exact component={CorporateClientBulkPage} />
            <Route path={ROUTES.internalIncidents} exact component={InternalIncidentsPage} />
            <Route path={ROUTES.internalIncidentActions} exact component={InternalIncidentActionsPage} />
            <Route path={ROUTES.internalIncidentCreate} exact component={InternalIncidentRegistrationPage} />
            <Route path={ROUTES.externalIncidents} exact component={ExternalIncidentsPage} />
            <Route path={ROUTES.externalIncidentActions} exact component={ExternalIncidentActionsPage} />
            <Route path={ROUTES.externalIncidentCreate} exact component={ExternalIncidentRegistrationPage} />
            <Route path={ROUTES.incidentDetail} exact component={IncidentDetailPage} />
            <Route path={ROUTES.laborCases} exact component={LaborCasesPage} />
            <Route path={ROUTES.myLaborActions} exact component={LaborActionsPage} />
            <Route path={ROUTES.laborCaseDetail} exact component={LaborCaseDetailPage} />
            <Route path={ROUTES.laborCaseDetailLegacy} exact component={LegacyLaborCaseDetailPage} />
            <ProtectedRoute path={ROUTES.users} exact allowedPositions={[7, 15]}>
              <UserPermissionsPage />
            </ProtectedRoute>
            <Route path={ROUTES.providers} exact component={ProviderCatalogPage} />
            <Route path={ROUTES.documentCategories} exact component={DocumentCategoriesPage} />
            <Route path={ROUTES.governmentEntities} exact component={GovernmentEntitiesPage} />
            <Route path={ROUTES.legalActions} exact component={LegalActionsCatalogPage} />
            <Route path={ROUTES.riskHistory} exact component={RiskHistoryPage} />
            <Route path={ROUTES.riskDetail} exact component={RiskDetailPage} />
            <Route path="/" exact><Redirect to={ROUTES.dashboard} /></Route>
            <Route><Redirect to={ROUTES.dashboard} /></Route>
          </Switch>
        </PortalLayout>
      </ProtectedRoute>
    </Switch>
  );
}

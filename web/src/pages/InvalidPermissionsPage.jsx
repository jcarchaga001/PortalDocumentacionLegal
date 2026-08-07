import { ArrowLeftOutlined, WarningFilled } from "@ant-design/icons";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";

export function InvalidPermissionsPage() {
  const history = useHistory();

  function goBack() {
    if (window.history.length > 1) history.goBack();
    else history.replace(ROUTES.login);
  }

  return (
    <main className="legacy-invalid-permissions">
      <WarningFilled className="legacy-invalid-permissions-icon" />
      <h1>No tiene permisos para ingresar a esta pantalla.</h1>
      <p>Contacte su administrador.</p>
      <button type="button" onClick={goBack}><ArrowLeftOutlined /> Regresar</button>
    </main>
  );
}

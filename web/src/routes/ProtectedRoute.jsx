import { Redirect, Route } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "../config/AuthContext.jsx";
import { ROUTES } from "./routePaths.js";

export function ProtectedRoute({ children, allowedPositions, ...routeProps }) {
  const { user, loading } = useAuth();

  return (
    <Route
      {...routeProps}
      render={({ location }) => {
        if (loading) {
          return (
            <div className="session-loader">
              <Spin size="large" />
            </div>
          );
        }

        if (!user) {
          return <Redirect to={{ pathname: ROUTES.login, state: { from: location } }} />;
        }

        if (
          allowedPositions
          && !allowedPositions.some((positionCode) => Number(positionCode) === Number(user.positionCode))
        ) {
          return <Redirect to={{ pathname: ROUTES.invalidPermissions, state: { from: location } }} />;
        }

        return children;
      }}
    />
  );
}

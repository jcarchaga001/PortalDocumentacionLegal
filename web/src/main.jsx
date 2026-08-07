import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "antd/dist/reset.css";
import { PortalThemeProvider } from "./config/ThemeContext.jsx";
import { AuthProvider } from "./config/AuthContext.jsx";
import { runtimeConfig } from "./config/runtime.js";
import { AppRoutes } from "./routes/AppRoutes.jsx";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={runtimeConfig.basePath}>
      <PortalThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </PortalThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

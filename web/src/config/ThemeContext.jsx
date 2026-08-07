import { App, ConfigProvider } from "antd";
import { portalTheme } from "./theme.js";

export function PortalThemeProvider({ children }) {
  return (
    <ConfigProvider theme={portalTheme}>
      <App>{children}</App>
    </ConfigProvider>
  );
}

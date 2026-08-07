import { theme } from "antd";

const systemFont =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";

export const portalTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#4d5c66",
    colorInfo: "#4d5c66",
    colorBgLayout: "#f5f5f5",
    colorBorderSecondary: "#dee2e6",
    borderRadius: 4,
    borderRadiusLG: 4,
    fontFamily: systemFont,
  },
  components: {
    Layout: { bodyBg: "#f5f5f5", headerBg: "#4d5c66", siderBg: "#ffffff" },
    Button: { controlHeight: 40 },
    Input: { controlHeight: 40 },
  },
};

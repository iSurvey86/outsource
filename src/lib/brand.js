import packageJson from "../../package.json";

export const APP_NAME = "OUTSRC";
export const APP_FULL_TITLE = "OUTSRC";
export const APP_DESCRIPTION =
  "Hệ thống quản lý dự án da đen: tiến độ, hồ sơ, tài chính A↔B, tài chính nội bộ B";
export const APP_SYSTEM_LABEL = "HỆ THỐNG";
export const APP_VERSION = packageJson.version;
export const APP_VERSION_LABEL = `Phiên bản ${APP_VERSION}`;
/** false = ẩn tab Dashboard (mở lại sau khi true) */
export const SHOW_DASHBOARD = false;
export const POST_LOGIN_ROUTE = SHOW_DASHBOARD ? "/" : "/du-an";

export const SESSION_USER_KEY = "outsrc_user";
export const SESSION_PERMS_KEY = "outsrc_perms";

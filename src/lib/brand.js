import packageJson from "../../package.json";

export const APP_NAME = "OUTSRC";
export const APP_FULL_TITLE = "OUTSRC";
export const APP_DESCRIPTION =
  "Hệ thống quản lý công việc, tiến độ dự án.";
export const APP_SYSTEM_LABEL = "HỆ THỐNG";
export const APP_VERSION = packageJson.version;
export const APP_VERSION_LABEL = `Phiên bản ${APP_VERSION}`;
/** Ảnh nền login — file trong public/; tăng REV khi đổi ảnh để tránh cache trình duyệt */
export const LOGIN_BG_PATH = "/login-bg.png";
export const LOGIN_BG_CACHE_REV = "2";
export const LOGIN_BG_URL = `${LOGIN_BG_PATH}?v=${LOGIN_BG_CACHE_REV}`;
/** false = ẩn tab Dashboard (mở lại sau khi true) */
export const SHOW_DASHBOARD = false;
export const POST_LOGIN_ROUTE = SHOW_DASHBOARD ? "/" : "/du-an";

export const SESSION_USER_KEY = "outsrc_user";
export const SESSION_PERMS_KEY = "outsrc_perms";

/**
 * 为 public 目录中的静态资源补上 Vite 部署基础路径。
 *
 * GitHub Pages 项目站点不位于域名根目录，而是位于
 * `/PTJ_Prototype/`。统一经过此函数后，本地开发和线上部署都能
 * 得到正确地址，避免演示图片在线上出现 404。
 *
 * @param path public 目录内的相对路径，可带或不带开头斜杠。
 * @returns 包含当前 Vite BASE_URL 的可访问资源地址。
 */
export function assetPath(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

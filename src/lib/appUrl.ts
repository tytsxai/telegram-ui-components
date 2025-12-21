type BuildAppUrlOptions = {
  base?: string;
  origin?: string;
};

export const normalizeBasePath = (base?: string) => {
  if (!base) return "/";
  const withLeading = base.startsWith("/") ? base : `/${base}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
};

export const buildAppUrl = (path: string, options: BuildAppUrlOptions = {}) => {
  const basePath = normalizeBasePath(options.base ?? import.meta.env.BASE_URL);
  const origin =
    options.origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const trimmedPath = path.replace(/^\//, "");
  return `${origin}${basePath}${trimmedPath}`;
};

export const getAppBaseUrl = (options?: BuildAppUrlOptions) =>
  buildAppUrl("", options);

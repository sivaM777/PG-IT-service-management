import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from "axios";

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
});

export const getApiErrorMessage = (
  error: unknown,
  fallbackMessage: string
): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  return fallbackMessage;
};

export const isCanceledError = (error: unknown): boolean => {
  return axios.isCancel(error);
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as (InternalAxiosRequestConfig & { __isRetryRequest?: boolean }) | undefined;

    const url = String(original?.url || "");
    const isAuthEndpoint = url.includes("/auth/");

    if (status === 401 && original && !original.__isRetryRequest && !isAuthEndpoint) {
      original.__isRetryRequest = true;

      try {
        if (!refreshPromise) {
          refreshPromise = api
            .post("/auth/refresh")
            .then((res) => {
              const rawToken = (res.data as { token?: unknown } | undefined)?.token ?? null;
              const token = typeof rawToken === "string" ? rawToken : null;
              setAccessToken(token);
              return token;
            })
            .catch(() => {
              setAccessToken(null);
              return null;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const nextToken = await refreshPromise;
        if (!nextToken) {
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
          return Promise.reject(error);
        }

        if (!original.headers) {
          original.headers = new AxiosHeaders();
        }
        const headers = AxiosHeaders.from(original.headers);
        headers.set("Authorization", `Bearer ${nextToken}`);
        original.headers = headers;
        return api(original);
      } catch {
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

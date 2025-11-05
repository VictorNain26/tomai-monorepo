export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface IApiErrorResponse {
  success: false;
  error: string;
  message?: string;
}

export interface IApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface IPaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IHealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    ai: 'healthy' | 'degraded' | 'unhealthy';
    rag: 'healthy' | 'degraded' | 'unhealthy';
  };
}

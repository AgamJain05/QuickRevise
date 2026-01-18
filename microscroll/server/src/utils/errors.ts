// Custom API Error class
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factory functions
export const errors = {
  badRequest: (message: string, code = 'BAD_REQUEST') =>
    new ApiError(400, message, code),

  unauthorized: (message = 'Unauthorized', code = 'UNAUTHORIZED') =>
    new ApiError(401, message, code),

  forbidden: (message = 'Forbidden', code = 'FORBIDDEN') =>
    new ApiError(403, message, code),

  notFound: (resource = 'Resource', code = 'NOT_FOUND') =>
    new ApiError(404, `${resource} not found`, code),

  conflict: (message: string, code = 'CONFLICT') =>
    new ApiError(409, message, code),

  tooManyRequests: (message = 'Too many requests', code = 'RATE_LIMIT') =>
    new ApiError(429, message, code),

  internal: (message = 'Internal server error', code = 'INTERNAL_ERROR') =>
    new ApiError(500, message, code),

  validation: (message: string, code = 'VALIDATION_ERROR') =>
    new ApiError(400, message, code),
};

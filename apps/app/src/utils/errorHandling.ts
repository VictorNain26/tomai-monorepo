import smartToast from './toastUtils';
/**
 * Centralized Error Handling Utilities - UX Optimized
 * Standardizes error processing with perfect user experience
 */

interface IApiError extends Error {
  status?: number;
  code?: string;
  response?: {
    status: number;
    data?: {
      _error?: string;
      message?: string;
    };
  };
}

interface IErrorContext {
  operation?: string;
  component?: string;
  silent?: boolean; // Don't show toast
  logOnly?: boolean; // Only log error, no toast
  duration?: number; // Toast duration in ms
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Toast styling configurations for different contexts
const TOAST_CONFIGS = {
  auth: {
    duration: 4000,
    className: 'bg-destructive/10 border-destructive/20 text-destructive'
  },
  validation: {
    duration: 5000,
    className: 'bg-warning/10 border-warning/20 text-warning'
  },
  network: {
    duration: 6000,
    className: 'bg-destructive/10 border-destructive/20 text-destructive'
  },
  success: {
    duration: 3000,
    className: 'bg-success/10 border-success/20 text-success'
  }
} as const;

/**
 * Extracts user-friendly error message from various error types
 */
export const extractErrorMessage = (error: unknown, fallbackMessage = 'Une erreur inattendue s\'est produite'): string => {
  // Handle API errors from our apiClient
  if (error instanceof Error) {
    const apiError = error as IApiError;

    // Server provided error message from response data
    const responseData = apiError.response?.data;
    if (responseData?._error) return responseData._error;
    if (responseData?.message) return responseData.message;

    // HTTP status-based messages (UX optimized)
    const status = apiError.status ?? apiError.response?.status;
    if (status === 401) {
      return 'Votre session a expiré. Reconnectez-vous pour continuer.';
    }
    if (status === 403) {
      return 'Cette action n\'est pas autorisée pour votre compte.';
    }
    if (status === 404) {
      return 'L\'information demandée n\'a pas été trouvée.';
    }
    if (status === 422) {
      return 'Les données envoyées ne sont pas valides.';
    }
    if (status === 500) {
      return 'Notre serveur rencontre un problème. Réessayez dans un moment.';
    }
    if (status === 429) {
      return 'Trop de tentatives. Attendez un peu avant de réessayer.';
    }
    if (status === 400) {
      return 'Les informations envoyées sont incorrectes.';
    }
    if (apiError.code === 'NETWORK_ERROR') {
      return 'Problème de connexion. Vérifiez votre internet.';
    }
    if (apiError.code === 'ECONNABORTED') {
      return 'La connexion a pris trop de temps. Réessayez.';
    }

    return apiError.message ?? fallbackMessage;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  return fallbackMessage;
};

/**
 * Enhanced error handler with UX-optimized toast messaging
 */
export const handleError = (error: unknown, context: IErrorContext = {}): string => {
  const { operation, component, silent = false, logOnly = false, duration, action } = context;
  const errorMessage = extractErrorMessage(error);

  // Build context for logging
  const _logContext = [operation, component].filter(Boolean).join(' - ');
  const _logPrefix = _logContext ? `[${_logContext}]` : '';

  // Enhanced logging with error classification
  const apiError = error instanceof Error ? error as IApiError : null;
  const _isNetworkError = apiError && (apiError.code === 'NETWORK_ERROR' || !apiError.response);
  const _isServerError = apiError?.response?.status && apiError.response.status >= 500;
  const _isAuthError = apiError && apiError.response?.status === 401;

  // Show enhanced toast unless silenced
  if (!silent && !logOnly) {
    // Determine toast configuration based on error type
    const _config = _isAuthError ? TOAST_CONFIGS.auth
      : (apiError && apiError.response?.status === 400) ? TOAST_CONFIGS.validation
      : TOAST_CONFIGS.network;

    smartToast.error(errorMessage, {
      duration: duration ?? _config.duration,
      className: _config.className,
      action: action ? {
        label: action.label,
        onClick: action.onClick
      } : undefined
    });
  }

  return errorMessage;
};

/**
 * Authentication-specific error handler
 * Provides user-friendly messages for authentication errors
 */
export const handleAuthError = (error: unknown, context: IErrorContext = {}): string => {
  // Utiliser extractErrorMessage qui gère déjà l'erreur 422 pour signup
  const errorMessage = extractErrorMessage(error);

  // Pour les erreurs 422 avec email exists, utiliser le message déjà optimisé
  const apiError = error instanceof Error ? error as IApiError : null;
  if (apiError && apiError.response?.status === 422) {
    // extractErrorMessage a déjà traité l'erreur 422 signup
    return handleError(error, { ...context, silent: false });
  }

  // Messages d'erreur UX-friendly pour l'authentification
  let userMessage = 'Identifiants incorrects. Veuillez vérifier votre email/nom d\'utilisateur et mot de passe.';

  if (errorMessage.includes('network') || errorMessage.includes('Network Error')) {
    userMessage = 'Problème de connexion. Vérifiez votre connexion internet.';
  } else if (errorMessage.includes('timeout')) {
    userMessage = 'Connexion trop lente. Veuillez réessayer.';
  } else if (errorMessage.includes('server') || errorMessage.includes('500')) {
    userMessage = 'Problème serveur temporaire. Veuillez réessayer dans quelques instants.';
  } else if (errorMessage.includes('404')) {
    userMessage = 'Service d\'authentification indisponible. Contactez le support.';
  }

  // Toujours logger l'erreur complète pour le debug
  handleError(error, { ...context, logOnly: true });

  // Afficher le message UX-friendly
  if (!context.silent) {
    smartToast.error(userMessage, {
      duration: 5000,
      position: 'top-center'
    });
  }

  return userMessage;
};

/**
 * Chat-specific error handler (backward compatibility)
 * Note: Gradually replace direct usage with handleError when refactoring
 */
export const handleChatError = (error: unknown): string => {
  return extractErrorMessage(error, 'Erreur de chat');
};

/**
 * UX-optimized success message handler
 */
export const showSuccess = (message: string, options: {
  duration?: number;
  action?: { label: string; onClick: () => void };
} = {}): void => {
  smartToast.success(message, {
    duration: options.duration ?? TOAST_CONFIGS.success.duration,
    className: TOAST_CONFIGS.success.className,
    action: options.action
  });
};

/**
 * Form validation error handler with enhanced UX
 */
export const handleValidationError = (error: unknown, context: IErrorContext = {}): string => {
  return handleError(error, {
    ...context,
    operation: 'Validation',
    duration: TOAST_CONFIGS.validation.duration
  });
};

/**
 * Network/API error handler with retry capability
 */
export const handleApiError = (_error: unknown, context: IErrorContext = {}, retryFn?: () => void): string => {
  const enhancedContext: IErrorContext = {
    ...context,
    operation: 'API'
  };

  if (retryFn) {
    enhancedContext.action = {
      label: 'Réessayer',
      onClick: retryFn
    };
  }

  return handleError(_error, enhancedContext);
};

/**
 * Enhanced info and warning toast helpers
 */
export const showInfo = (message: string, duration = 4000): void => {
  smartToast.info(message, {
    duration,
    className: 'bg-primary/10 border-primary/20 text-primary'
  });
};

export const showWarning = (message: string, duration = 5000): void => {
  smartToast.warning(message, {
    duration,
    className: TOAST_CONFIGS.validation.className
  });
};

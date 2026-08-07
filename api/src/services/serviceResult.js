export function normalizedSuccess(message, data = null) {
  return {
    success: true,
    message,
    data,
    error: null,
  };
}

export function normalizedFailure(message, error, data = null) {
  return {
    success: false,
    message,
    data,
    error: error || { code: "UNKNOWN_ERROR" },
  };
}

export function validationFailure(message, field) {
  return normalizedFailure(message, {
    code: "VALIDATION_ERROR",
    field,
  });
}


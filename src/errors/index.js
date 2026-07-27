/**
 * GoalThread Custom Error Hierarchy
 */

export class GoalThreadError extends Error {
  constructor(message, { code = 'GOALTHREAD_ERROR', runId, taskId, retryable = false, cause } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.runId = runId;
    this.taskId = taskId;
    this.retryable = retryable;
    this.cause = cause;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ConfigInvalidError extends GoalThreadError {
  constructor(message, options = {}) {
    super(message, { code: 'CONFIG_INVALID', retryable: false, ...options });
  }
}

export class ProviderAuthError extends GoalThreadError {
  constructor(message, options = {}) {
    super(message, { code: 'PROVIDER_AUTH_FAILED', retryable: false, ...options });
  }
}

export class ProviderError extends GoalThreadError {
  constructor(message, options = {}) {
    super(message, { code: 'PROVIDER_FAILURE', retryable: true, ...options });
  }
}

export class SchemaValidationError extends GoalThreadError {
  constructor(message, options = {}) {
    super(message, { code: 'SCHEMA_VALIDATION_FAILED', retryable: true, ...options });
  }
}

export class TaskRetryExhaustedError extends GoalThreadError {
  constructor(message, options = {}) {
    super(message, { code: 'TASK_RETRY_EXHAUSTED', retryable: false, ...options });
  }
}

export class BudgetExceededError extends GoalThreadError {
  constructor(message, options = {}) {
    super(message, { code: 'BUDGET_EXCEEDED', retryable: false, ...options });
  }
}

export class UserInputRequiredError extends GoalThreadError {
  constructor(message, options = {}) {
    super(message, { code: 'USER_INPUT_REQUIRED', retryable: false, ...options });
  }
}

export class InvalidStateTransitionError extends GoalThreadError {
  constructor(message, options = {}) {
    super(message, { code: 'INVALID_STATE_TRANSITION', retryable: false, ...options });
  }
}

export class ToolPermissionDeniedError extends GoalThreadError {
  constructor(message, options = {}) {
    super(message, { code: 'TOOL_PERMISSION_DENIED', retryable: false, ...options });
  }
}

export class StorageError extends GoalThreadError {
  constructor(message, options = {}) {
    super(message, { code: 'STORAGE_FAILURE', retryable: false, ...options });
  }
}

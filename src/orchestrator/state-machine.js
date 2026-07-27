import { InvalidStateTransitionError } from '../errors/index.js';

export const RUN_STATUSES = [
  'created',
  'planning',
  'working',
  'waiting_for_worker',
  'reviewing',
  'waiting_for_user',
  'paused',
  'finalizing',
  'completed',
  'failed',
  'cancelled',
];

export const VALID_TRANSITIONS = {
  created: ['planning', 'cancelled', 'failed'],
  planning: ['working', 'waiting_for_user', 'failed', 'cancelled'],
  working: ['waiting_for_worker', 'reviewing', 'finalizing', 'waiting_for_user', 'failed', 'paused', 'cancelled'],
  waiting_for_worker: ['reviewing', 'failed', 'paused', 'cancelled'],
  reviewing: ['working', 'finalizing', 'waiting_for_user', 'failed', 'paused', 'cancelled'],
  waiting_for_user: ['working', 'planning', 'cancelled', 'failed'],
  paused: ['working', 'planning', 'cancelled', 'failed'],
  finalizing: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export class RunStateMachine {
  constructor(initialStatus = 'created') {
    this.status = initialStatus;
  }

  transitionTo(nextStatus) {
    if (!RUN_STATUSES.includes(nextStatus)) {
      throw new InvalidStateTransitionError(`Unknown status: "${nextStatus}"`);
    }

    const allowedNext = VALID_TRANSITIONS[this.status] || [];
    if (!allowedNext.includes(nextStatus)) {
      throw new InvalidStateTransitionError(
        `Invalid state transition from "${this.status}" to "${nextStatus}". Allowed: ${allowedNext.join(', ')}`
      );
    }

    this.status = nextStatus;
    return this.status;
  }

  getStatus() {
    return this.status;
  }
}

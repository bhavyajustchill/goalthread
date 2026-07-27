import test from 'node:test';
import assert from 'node:assert';
import { RunStateMachine } from '../src/orchestrator/state-machine.js';
import { InvalidStateTransitionError } from '../src/errors/index.js';

test('RunStateMachine handles valid transitions', () => {
  const sm = new RunStateMachine('created');
  assert.strictEqual(sm.getStatus(), 'created');

  sm.transitionTo('planning');
  assert.strictEqual(sm.getStatus(), 'planning');

  sm.transitionTo('working');
  assert.strictEqual(sm.getStatus(), 'working');

  sm.transitionTo('reviewing');
  assert.strictEqual(sm.getStatus(), 'reviewing');

  sm.transitionTo('finalizing');
  assert.strictEqual(sm.getStatus(), 'finalizing');

  sm.transitionTo('completed');
  assert.strictEqual(sm.getStatus(), 'completed');
});

test('RunStateMachine rejects invalid state transitions', () => {
  const sm = new RunStateMachine('created');
  assert.throws(() => {
    sm.transitionTo('completed');
  }, InvalidStateTransitionError);
});

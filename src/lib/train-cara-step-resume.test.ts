import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTrainCaraStepIndex } from '../app/(onboarding)/onboarding/knowledge/train-cara-step-resume';
import { TRAIN_CARA_STEPS } from '../app/(onboarding)/onboarding/knowledge/train-cara-constants';

describe('parseTrainCaraStepIndex', () => {
  it('maps legacy exclusions step to hours', () => {
    const hoursIndex = TRAIN_CARA_STEPS.findIndex((step) => step.id === 'hours');
    assert.equal(parseTrainCaraStepIndex('exclusions'), hoursIndex);
  });

  it('maps legacy capture step to faqs', () => {
    const faqsIndex = TRAIN_CARA_STEPS.findIndex((step) => step.id === 'faqs');
    assert.equal(parseTrainCaraStepIndex('capture'), faqsIndex);
  });

  it('does not include exclusions in current steps', () => {
    assert.equal(
      TRAIN_CARA_STEPS.some((step) => String(step.id) === "exclusions"),
      false,
    );
  });
});

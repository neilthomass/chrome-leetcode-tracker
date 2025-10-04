export const domElements = {
  submitButton: 'button[data-e2e-locator="console-submit-button"]',
  // Alternative submit button selectors if the main one fails
  submitButtonAlternatives: [
    'button[data-e2e-locator="console-submit-button"]',
    'button:has-text("Submit")',
    'button[class*="submit"]',
    'button:contains("Submit")',
    '[data-cy="submit-code-btn"]',
    'button.submit-button'
  ],
  submissionResult: 'span[data-e2e-locator="submission-result"]',
  // Alternative result selectors
  submissionResultAlternatives: [
    'span[data-e2e-locator="submission-result"]',
    '[class*="submission-result"]',
    'span:contains("Accepted")',
    '[data-cy="submission-result"]'
  ],
  submissionStats: {
    runtime: '[data-e2e-locator="submission-runtime"]',
    memory: '[data-e2e-locator="submission-memory"]',
    runtimePercentile: '[data-e2e-locator="submission-runtime-percentile"]',
    memoryPercentile: '[data-e2e-locator="submission-memory-percentile"]',
    // Alternative selectors for extracting stats
    statsPanel: '[class*="submission-result"], [class*="result-state"]',
    metricsContainer: '[class*="metrics"], [class*="stats"], [class*="performance"]'
  }
};

export const domElements = {
  submitButton: 'button[data-e2e-locator="console-submit-button"]',
  submissionResult: 'span[data-e2e-locator="submission-result"]',
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

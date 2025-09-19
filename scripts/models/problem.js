import LanguageUtils from "../utils/language-utils.js";

export default class Problem {
  constructor() {
    this.slug = "";
    this.difficulty = "";
    this.problemUrl = "";
    this.code = "";
    this.language = {};
    this.runtime = "";
    this.memory = "";
    this.runtimePercentile = "";
    this.memoryPercentile = "";
    this.submissionDate = new Date();
    this.submissionId = "";
    this.apiData = null;
  }

  loadProblemFromDOM() {
    // Try to extract ID from current page first
    this.extractIdFromCurrentPage();

    // Set the problem URL from the current page
    this.setProblemUrlFromCurrentPage();
  }

  extractIdFromCurrentPage() {
    // Note: Problem ID will be extracted from submission API data
    // This method is kept for any additional page-based extraction if needed
    console.log('🔍 LeetCode Tracker: Problem ID will be extracted from submission API data');
  }

  setProblemUrlFromCurrentPage() {
    const url = window.location.href;

    if (url.includes("leetcode.com/problems/")) {
      const problemName = url
        .replace("https://leetcode.com/problems/", "")
        .split("/")[0];

      this.problemUrl = `/problems/${problemName}/`;
      this.slug = problemName; // Set the slug for GitHub file path
    }
  }

  extractLanguageFromDOM() {
    try {
      let language = null;

      // Try multiple methods to extract language

      // Method 1: Local storage
      try {
        const storedLang = window.localStorage.getItem("global_lang");
        if (storedLang) {
          language = JSON.parse(storedLang);
          console.log('🔍 LeetCode Tracker: Found language in localStorage:', language);
        }
      } catch (e) {
        console.log('Could not parse language from localStorage:', e);
      }

      // Method 2: UI button selector (fallback)
      if (!language) {
        const buttonSelectors = [
          "#headlessui-popover-button-\\:r1s\\: button",
          '[data-cy="lang-select-button"]',
          '.lang-select button',
          'button[class*="lang"]',
          'button[class*="language"]'
        ];

        for (const selector of buttonSelectors) {
          try {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
              language = element.textContent.trim();
              console.log(`🔍 LeetCode Tracker: Found language from selector ${selector}:`, language);
              break;
            }
          } catch (e) {
            console.log(`Error with selector ${selector}:`, e);
          }
        }
      }

      // Method 3: Extract from code element classes
      if (!language) {
        const codeElements = document.querySelectorAll('code[class*="language-"]');
        if (codeElements.length > 0) {
          const className = codeElements[0].className;
          const langMatch = className.match(/language-(\w+)/);
          if (langMatch) {
            language = langMatch[1];
            console.log('🔍 LeetCode Tracker: Found language from code element class:', language);
          }
        }
      }

      // Convert language string to language info
      if (language) {
        console.log('🔍 LeetCode Tracker: Raw language detected:', language);
        this.language = LanguageUtils.getLanguageInfo(language);
        if (this.language) {
          console.log('✅ LeetCode Tracker: Successfully mapped language:', language, '→', this.language);
        } else {
          console.log('❌ LeetCode Tracker: Could not map language:', language);
          // Set a default fallback
          this.language = { langName: 'unknown', extension: '.txt' };
        }
      } else {
        console.log('❌ LeetCode Tracker: No language found, using default');
        this.language = { langName: 'unknown', extension: '.txt' };
      }
    } catch (error) {
      console.log('❌ LeetCode Tracker: Error extracting language from DOM:', error);
      this.language = { langName: 'unknown', extension: '.txt' };
    }
  }

  extractCodeFromDOM() {
    try {
      let codeElements = null;

      // Try to use language-specific selector if language is available
      if (this.language && this.language.langName) {
        codeElements = document.querySelectorAll(
          `code.language-${this.language.langName}`
        );
        console.log(`🔍 LeetCode Tracker: Found ${codeElements.length} code elements for language: ${this.language.langName}`);
      }

      // Fallback: if no language-specific elements found, try common code selectors
      if (!codeElements || codeElements.length === 0) {
        console.log('🔍 LeetCode Tracker: No language-specific code found, trying fallback selectors');

        // Try common code element selectors
        const fallbackSelectors = [
          'code[class*="language-"]',  // Any language class
          'pre code',                  // Code inside pre tags
          '.CodeMirror-code .CodeMirror-line', // CodeMirror editor
          '[data-track-load="editor_content"] code', // LeetCode editor content
          '.monaco-editor .view-line',  // Monaco editor
          'textarea[data-cy="code-editor"]' // Direct textarea fallback
        ];

        for (const selector of fallbackSelectors) {
          codeElements = document.querySelectorAll(selector);
          if (codeElements.length > 0) {
            console.log(`🔍 LeetCode Tracker: Found ${codeElements.length} code elements with selector: ${selector}`);
            break;
          }
        }
      }

      // Extract code from the last (most recent) element
      if (codeElements && codeElements.length > 0) {
        const lastElement = codeElements[codeElements.length - 1];
        this.code = lastElement.textContent || lastElement.value || '';
        console.log(`✅ LeetCode Tracker: Extracted code (${this.code.length} characters)`);
      } else {
        console.log('❌ LeetCode Tracker: No code elements found with any selector');
        this.code = '';
      }
    } catch (error) {
      console.log('❌ LeetCode Tracker: Error extracting code from DOM:', error);
      this.code = '';
    }
  }

  /**
   * Extract submission ID from current URL and fetch submission data from API.
   * This is called when on a submission page like /problems/two-sum/submissions/1774457019/
   */
  async extractSubmissionStatsFromURL() {
    try {
      const submissionId = this.getSubmissionIdFromURL();
      if (!submissionId) {
        console.log('No submission ID found in URL, falling back to DOM extraction');
        this.extractSubmissionStatsFromDOM();
        return;
      }

      console.log('🔍 LeetCode Tracker: Found submission ID:', submissionId);

      // Wait 2 seconds to ensure submission is processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Poll for submission data until it's ready
      const submissionData = await this.pollForSubmissionData(submissionId);
      if (submissionData) {
        this.extractSubmissionStatsFromAPI(submissionData);
      } else {
        console.log('Failed to fetch submission data, falling back to DOM extraction');
        this.extractSubmissionStatsFromDOM();
      }
    } catch (error) {
      console.log('Error extracting submission stats from URL:', error);
      this.extractSubmissionStatsFromDOM();
    }
  }

  /**
   * Extract submission ID from the current URL.
   * @returns {string|null} Submission ID or null if not found
   */
  getSubmissionIdFromURL() {
    const url = window.location.href;
    const match = url.match(/\/submissions\/(\d+)\//);
    return match ? match[1] : null;
  }

  /**
   * Poll for submission data until it's ready (not PENDING).
   * @param {string} submissionId - The submission ID
   * @returns {Promise<Object|null>} Complete submission data or null if failed
   */
  async pollForSubmissionData(submissionId) {
    const maxAttempts = 10; // Maximum polling attempts
    const pollInterval = 1000; // 1 second between polls

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔄 LeetCode Tracker: Polling attempt ${attempt}/${maxAttempts}`);

      const data = await this.fetchSubmissionData(submissionId);

      if (!data) {
        console.log('❌ LeetCode Tracker: No data received, stopping polling');
        return null;
      }

      if (data.state === 'PENDING') {
        console.log(`⏳ LeetCode Tracker: Submission still pending, waiting ${pollInterval}ms...`);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        } else {
          console.log('⏰ LeetCode Tracker: Max polling attempts reached, submission still pending');
          return null;
        }
      }

      // Check if we have complete submission data
      if (data.status_msg === "Accepted" && data.finished) {
        console.log('✅ LeetCode Tracker: Submission completed successfully!');
        return data;
      }

      // Handle other states (Runtime Error, Wrong Answer, etc.)
      if (data.finished) {
        console.log(`🔴 LeetCode Tracker: Submission finished with status: ${data.status_msg}`);
        return data; // Return even if not accepted, might have some stats
      }

      console.log(`🔄 LeetCode Tracker: Submission state: ${data.state}, waiting...`);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    console.log('⏰ LeetCode Tracker: Polling timeout, returning null');
    return null;
  }

  /**
   * Fetch submission data from LeetCode API using submission ID.
   * @param {string} submissionId - The submission ID
   * @returns {Promise<Object|null>} Submission data or null if failed
   */
  async fetchSubmissionData(submissionId) {
    try {
      const apiUrl = `https://leetcode.com/submissions/detail/${submissionId}/check/`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Include cookies for authentication
      });

      if (!response.ok) {
        console.log('API response not ok:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('📊 LeetCode Tracker: Fetched submission data:', data);

      return data;
    } catch (error) {
      console.log('Error fetching submission data:', error);
      return null;
    }
  }

  /**
   * Extract submission statistics from LeetCode API response data.
   * This is more reliable than DOM parsing as it uses the actual API data.
   */
  extractSubmissionStatsFromAPI(apiData) {
    this.submissionDate = new Date();
    this.apiData = apiData;

    try {
      if (apiData) {
        // Extract runtime - API provides display_runtime and status_runtime
        if (apiData.display_runtime !== undefined) {
          this.runtime = apiData.display_runtime + " ms";
        } else if (apiData.status_runtime) {
          // Remove " ms" if it's already included, then add it back
          const runtimeValue = apiData.status_runtime.replace(/\s*ms$/i, '');
          this.runtime = runtimeValue + " ms";
        }

        // Extract memory - API provides status_memory
        if (apiData.status_memory) {
          this.memory = apiData.status_memory;
        } else if (apiData.memory) {
          // Convert bytes to MB if needed
          const memoryMB = (apiData.memory / (1024 * 1024)).toFixed(1);
          this.memory = memoryMB + " MB";
        }

        // Extract percentiles - API provides exact percentile values
        if (apiData.runtime_percentile !== undefined) {
          this.runtimePercentile = Math.round(apiData.runtime_percentile * 100) / 100 + "%";
        }

        if (apiData.memory_percentile !== undefined) {
          this.memoryPercentile = Math.round(apiData.memory_percentile * 100) / 100 + "%";
        }

        // Extract language if available
        if (apiData.pretty_lang && !this.language.langName) {
          this.language = LanguageUtils.getLanguageInfo(apiData.pretty_lang);
        }

        // Store submission ID for reference
        if (apiData.submission_id) {
          this.submissionId = apiData.submission_id;
        }

        // Extract problem ID from submission data
        if (apiData.question_id) {
          this.id = apiData.question_id.toString();
          console.log('🔍 LeetCode Tracker: Extracted problem ID from submission API:', this.id);
        }

        console.log('Extracted submission stats from API:', {
          runtime: this.runtime,
          memory: this.memory,
          runtimePercentile: this.runtimePercentile,
          memoryPercentile: this.memoryPercentile,
          submissionId: this.submissionId
        });
      }
    } catch (error) {
      console.log('Could not extract submission stats from API:', error);
      // Fallback to DOM extraction if API data fails
      this.extractSubmissionStatsFromDOM();
    }
  }

  extractSubmissionStatsFromDOM() {
    this.submissionDate = new Date();

    // Extract runtime and memory stats from LeetCode submission result panel
    try {
      // Look for Runtime section - find elements containing "Runtime" text
      const runtimeSection = Array.from(document.querySelectorAll('div')).find(div =>
        div.textContent.includes('Runtime') && div.querySelector('*')
      );

      if (runtimeSection) {
        // Extract runtime value (e.g., "0 ms")
        const runtimeText = runtimeSection.textContent;
        const runtimeMatch = runtimeText.match(/(\d+)\s*ms/);
        if (runtimeMatch) {
          this.runtime = runtimeMatch[1] + " ms";
        }

        // Extract runtime percentile (e.g., "Beats 100.00%")
        const runtimePercentileMatch = runtimeText.match(/Beats\s+(\d+\.?\d*)%/);
        if (runtimePercentileMatch) {
          this.runtimePercentile = runtimePercentileMatch[1] + "%";
        }
      }

      // Look for Memory section - find elements containing "Memory" text
      const memorySection = Array.from(document.querySelectorAll('div')).find(div =>
        div.textContent.includes('Memory') && div.querySelector('*')
      );

      if (memorySection) {
        // Extract memory value (e.g., "18.85 MB")
        const memoryText = memorySection.textContent;
        const memoryMatch = memoryText.match(/(\d+\.?\d*)\s*MB/);
        if (memoryMatch) {
          this.memory = memoryMatch[1] + " MB";
        }

        // Extract memory percentile (e.g., "Beats 50.78%")
        const memoryPercentileMatch = memoryText.match(/Beats\s+(\d+\.?\d*)%/);
        if (memoryPercentileMatch) {
          this.memoryPercentile = memoryPercentileMatch[1] + "%";
        }
      }

      // Alternative approach: look for elements containing "Beats" with context
      if (!this.runtime || !this.memory || !this.runtimePercentile || !this.memoryPercentile) {
        const beatsElements = Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent.includes('Beats') && el.textContent.includes('%')
        );

        beatsElements.forEach(element => {
          const text = element.textContent;
          const parentText = element.parentElement?.textContent || '';
          const containerText = text + ' ' + parentText;

          // Extract percentile value
          const beatsMatch = text.match(/Beats\s+(\d+\.?\d*)%/);
          if (beatsMatch) {
            const percentile = beatsMatch[1] + "%";

            // Determine if this is runtime or memory based on surrounding context
            if (containerText.toLowerCase().includes('runtime') ||
                element.closest('*')?.textContent.toLowerCase().includes('runtime')) {
              if (!this.runtimePercentile) {
                this.runtimePercentile = percentile;
              }
            } else if (containerText.toLowerCase().includes('memory') ||
                       element.closest('*')?.textContent.toLowerCase().includes('memory')) {
              if (!this.memoryPercentile) {
                this.memoryPercentile = percentile;
              }
            }
          }
        });
      }

      // Fallback: search for runtime and memory values independently
      if (!this.runtime || !this.memory) {
        const allText = document.body.textContent;

        if (!this.runtime) {
          const runtimeMatch = allText.match(/(\d+)\s*ms/);
          if (runtimeMatch) {
            this.runtime = runtimeMatch[1] + " ms";
          }
        }

        if (!this.memory) {
          const memoryMatch = allText.match(/(\d+\.?\d*)\s*MB/);
          if (memoryMatch) {
            this.memory = memoryMatch[1] + " MB";
          }
        }
      }

      console.log('Extracted submission stats from DOM:', {
        runtime: this.runtime,
        memory: this.memory,
        runtimePercentile: this.runtimePercentile,
        memoryPercentile: this.memoryPercentile
      });

    } catch (error) {
      console.log('Could not extract submission stats:', error);
    }
  }



}

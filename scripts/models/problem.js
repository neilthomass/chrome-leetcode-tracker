import LanguageUtils from "../utils/language-utils.js";

export default class Problem {
  constructor() {
    this.slug = "";
    this.difficulty = "";
    this.description = "";
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
    const url = this.getDescriptionUrl();

    // Try to extract ID from current page first
    this.extractIdFromCurrentPage();

    if (url) {
      this.extractProblemInfos(url);
    }
  }

  extractIdFromCurrentPage() {
    // Try to extract ID from page title or DOM
    try {
      // Look for the problem title in the main content area
      const titleElements = document.querySelectorAll('h1, h2, h3, [data-cy="question-title"], .css-v3d350, .mr-2');

      for (const element of titleElements) {
        if (element && element.textContent) {
          const text = element.textContent.trim();
          const idMatch = text.match(/^(\d+)\./);
          if (idMatch) {
            this.id = idMatch[1];
            console.log('🔍 LeetCode Tracker: Extracted problem ID from page:', this.id);
            break;
          }
        }
      }

      // Fallback: extract from URL if it contains the pattern
      if (!this.id) {
        const urlMatch = window.location.pathname.match(/\/problems\/(\d+)-/);
        if (urlMatch) {
          this.id = urlMatch[1];
          console.log('🔍 LeetCode Tracker: Extracted problem ID from URL:', this.id);
        }
      }
    } catch (error) {
      console.log('Could not extract problem ID from current page:', error);
    }
  }

  getDescriptionUrl() {
    const url = window.location.href;

    if (url.includes("leetcode.com/problems/")) {
      const problemName = url
        .replace("https://leetcode.com/problems/", "")
        .split("/")[0];

      this.problemUrl = `/problems/${problemName}/`;
      return `https://leetcode.com/problems/${problemName}/description/`;
    }

    return "";
  }

  extractLanguageFromDOM() {
    const language =
      JSON.parse(window.localStorage.getItem("global_lang")) ||
      document.querySelector("#headlessui-popover-button-\\:r1s\\: button")
        ?.textContent;

    this.language = LanguageUtils.getLanguageInfo(language);
  }

  extractCodeFromDOM() {
    const codeElements = document.querySelectorAll(
      `code.language-${this.language.langName}`
    );

    this.code = codeElements[codeElements.length - 1].textContent;
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

      // Wait 1 second to ensure submission is processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      const submissionData = await this.fetchSubmissionData(submissionId);
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

  extractProblemInfos(url) {
    const iframe = document.createElement("iframe");

    // Invisible iframe
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    iframe.src = url;

    // Observer to retrieve data from the iframe
    iframe.onload = () => {
      const iframeDocument =
        iframe.contentDocument || iframe.contentWindow.document;

      const observer = new MutationObserver((mutations, obs) => {
        // Extract data from the iframe
        this.extractDifficultyFromDOM(iframeDocument);
        this.extractDescriptionFromDOM(iframeDocument);
        this.extractSlugFromDOM(iframeDocument);

        // If all data is extracted, stop the observer
        if (this.difficulty && this.description && this.slug) {
          obs.disconnect();
          document.body.removeChild(iframe);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Stop the observer after 3 seconds and remove the iframe
      setTimeout(() => {
        observer.disconnect();
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    };

    document.body.appendChild(iframe);
  }

  async extractSlugFromDOM(iframeContent) {
    const problemNameSelector = iframeContent.querySelector(
      `a[href='${this.problemUrl}']`
    );

    if (problemNameSelector) {
      const problemText = problemNameSelector.textContent;
      this.slug = this.formatProblemName(problemText);

      // Extract problem ID from the title (e.g., "1. Two Sum" -> id = "1")
      const idMatch = problemText.match(/^(\d+)\./);
      if (idMatch) {
        this.id = idMatch[1];
      }
    }
  }

  async extractDifficultyFromDOM(iframeDocument) {
    const easy = iframeDocument.querySelector("div.text-difficulty-easy");
    const medium = iframeDocument.querySelector("div.text-difficulty-medium");
    const hard = iframeDocument.querySelector("div.text-difficulty-hard");

    if (easy) {
      this.difficulty = "easy";
    } else if (medium) {
      this.difficulty = "medium";
    } else if (hard) {
      this.difficulty = "hard";
    } else {
      this.difficulty = "";
    }
  }

  async extractDescriptionFromDOM(iframeDocument) {
    const problemDescription = iframeDocument.querySelector(
      'div[data-track-load="description_content"]'
    );
    if (problemDescription) {
      this.description = problemDescription.textContent;
    }
  }

  formatProblemName(problemName) {
    return problemName.replace(".", "-").split(" ").join("");
  }
}

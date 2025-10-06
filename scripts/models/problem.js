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
    this.topicTags = [];
  }

  loadProblemFromURL() {
    const url = window.location.href;

    if (url.includes("leetcode.com/problems/")) {
      const problemName = url
        .replace("https://leetcode.com/problems/", "")
        .split("/")[0];

      this.problemUrl = `/problems/${problemName}/`;
      this.slug = problemName; // Set the slug for GitHub file path
      console.log('🔍 LeetCode Tracker: Problem loaded from URL:', this.slug);
    }
  }


  /**
   * Extract submission ID from current URL and fetch submission data from API.
   * This is called when on a submission page like /problems/two-sum/submissions/1774457019/
   */
  async extractSubmissionStatsFromURL() {
    try {
      // Wait for URL to change to submission URL (max 10 seconds)
      const submissionId = await this.waitForSubmissionURL();

      if (!submissionId) {
        console.log('❌ No submission ID found in URL after waiting');
        throw new Error('No submission ID in URL');
      }

      console.log('🔍 LeetCode Tracker: Found submission ID:', submissionId);

      // Wait 2 seconds to ensure submission is processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Poll for submission data until it's ready
      const submissionData = await this.pollForSubmissionData(submissionId);
      if (submissionData) {
        this.extractSubmissionStatsFromAPI(submissionData);
      } else {
        console.log('❌ Failed to fetch submission data from API');
        throw new Error('Failed to fetch submission data');
      }
    } catch (error) {
      console.log('❌ Error extracting submission stats from URL:', error);
      throw error;
    }
  }

  /**
   * Wait for the URL to change to a submission URL.
   * Polls the URL every 500ms for up to 10 seconds.
   * @returns {Promise<string|null>} Submission ID or null if timeout
   */
  async waitForSubmissionURL() {
    const maxAttempts = 20; // 20 attempts * 500ms = 10 seconds
    const pollInterval = 500;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const submissionId = this.getSubmissionIdFromURL();

      if (submissionId) {
        console.log(`✅ LeetCode Tracker: Found submission URL on attempt ${attempt}`);
        return submissionId;
      }

      if (attempt < maxAttempts) {
        console.log(`⏳ LeetCode Tracker: Waiting for submission URL... (attempt ${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    console.log('⏰ LeetCode Tracker: Timeout waiting for submission URL');
    return null;
  }

  /**
   * Extract submission ID from the current URL.
   * @returns {string|null} Submission ID or null if not found
   */
  getSubmissionIdFromURL() {
    const url = window.location.href;
    const match = url.match(/\/submissions\/(\d+)/);
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
   * Uses GraphQL API to get complete data including topic tags.
   * @param {string} submissionId - The submission ID
   * @returns {Promise<Object|null>} Submission data or null if failed
   */
  async fetchSubmissionData(submissionId) {
    try {
      const response = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: `
            query submissionDetails($submissionId: Int!) {
              submissionDetails(submissionId: $submissionId) {
                runtime
                runtimeDisplay
                runtimePercentile
                memory
                memoryDisplay
                memoryPercentile
                code
                timestamp
                statusCode
                lang {
                  name
                  verboseName
                }
                question {
                  questionId
                  titleSlug
                }
                topicTags {
                  tagId
                  slug
                  name
                }
              }
            }
          `,
          variables: {
            submissionId: parseInt(submissionId),
          },
        }),
      });

      if (!response.ok) {
        console.log('API response not ok:', response.status);
        return null;
      }

      const result = await response.json();

      if (result.errors) {
        console.log('GraphQL errors:', result.errors);
        return null;
      }

      if (!result.data || !result.data.submissionDetails) {
        console.log('No submission details in response');
        return null;
      }

      const details = result.data.submissionDetails;

      // Transform to match expected format
      const data = {
        code: details.code,
        status_msg: details.statusCode === 10 ? "Accepted" : "Not Accepted",
        status_runtime: details.runtimeDisplay,
        display_runtime: parseInt(details.runtime),
        status_memory: details.memoryDisplay,
        memory: parseInt(details.memory),
        runtime_percentile: details.runtimePercentile,
        memory_percentile: details.memoryPercentile,
        pretty_lang: details.lang.verboseName,
        submission_id: submissionId,
        question_id: details.question.questionId,
        topic_tags: details.topicTags,
        finished: true,
        state: 'SUCCESS'
      };

      console.log('📊 LeetCode Tracker: Fetched submission data from GraphQL:', data);

      return data;
    } catch (error) {
      console.log('Error fetching submission data:', error);
      return null;
    }
  }

  /**
   * Extract submission statistics from LeetCode API response data.
   * All data comes from API - no DOM parsing.
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

        // Extract language from API
        if (apiData.pretty_lang) {
          this.language = LanguageUtils.getLanguageInfo(apiData.pretty_lang);
        }

        // Extract code from API
        if (apiData.code) {
          this.code = apiData.code;
          console.log('✅ LeetCode Tracker: Code extracted from API:', this.code.length, 'characters');
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

        // Extract topic tags if available
        if (apiData.topic_tags && Array.isArray(apiData.topic_tags)) {
          this.topicTags = apiData.topic_tags;
          console.log('🏷️ LeetCode Tracker: Extracted topic tags:', this.topicTags.map(t => t.name).join(', '));
        }

        console.log('✅ Extracted all data from API:', {
          language: this.language?.langName,
          runtime: this.runtime,
          memory: this.memory,
          runtimePercentile: this.runtimePercentile,
          memoryPercentile: this.memoryPercentile,
          submissionId: this.submissionId,
          codeLength: this.code?.length,
          topicTagsCount: this.topicTags?.length
        });
      }
    } catch (error) {
      console.log('❌ Could not extract submission stats from API:', error);
      throw error;
    }
  }



}

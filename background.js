import { ENV } from "./environment.js";
import LeetCodeService from "./scripts/services/leetcode-service.js";
import SyncService from "./scripts/services/sync-service.js";

/**
 * Manages LeetCode problem statistics and synchronization state.
 * Centralized state management for difficulty counters and sync progress tracking.
 */
class LeetCodeStateManager {
  /**
   * Initialize the state manager with default values.
   * Sets up difficulty counters and tracking flags.
   */
  constructor() {
    this.state = {
      counter: {
        easy: 0,
        medium: 0,
        hard: 0,
      },
      isCountingComplete: false,
      lastUpdate: null,
      loading: true,
    };
  }

  /**
   * Increment the counter for a specific difficulty level.
   * Used for real-time updates when new problems are solved.
   *
   * @param {string} difficulty - The difficulty level to increment (Easy, Medium, Hard)
   * @returns {boolean} True if increment was successful, false if invalid difficulty
   */
  incrementCounter(difficulty) {
    if (!difficulty) return;
    const normalizedDifficulty = difficulty.toLowerCase();
    if (normalizedDifficulty in this.state.counter) {
      this.state.counter[normalizedDifficulty] += 1;
      this.state.lastUpdate = new Date();
      this.broadcastState();
      return true;
    }
    return false;
  }

  /**
   * Update statistics with a complete set of difficulty data.
   * Used for bulk updates during synchronization or initialization.
   *
   * Algorithm:
   * 1. Reset all counters to zero
   * 2. Process each difficulty value and increment appropriate counter
   * 3. Update completion status and loading state
   * 4. Broadcast the updated state to all listeners
   *
   * @param {Array<string>} difficulties - Array of difficulty strings to count
   */
  updateStats(difficulties) {
    this.state.counter = { easy: 0, medium: 0, hard: 0 };

    difficulties.forEach((difficulty) => {
      if (difficulty) {
        const normalizedDifficulty = difficulty.toLowerCase();
        if (normalizedDifficulty in this.state.counter) {
          this.state.counter[normalizedDifficulty] += 1;
        }
      }
    });

    this.state.lastUpdate = new Date();
    this.state.loading = false;
    this.state.isCountingComplete = true;

    this.broadcastState();
  }

  /**
   * Get the current statistics state.
   * Returns a copy of the current state for external consumption.
   *
   * @returns {Object} Current statistics with counters and metadata
   */
  getStats() {
    return {
      ...this.state.counter,
      isCountingComplete: this.state.isCountingComplete,
      lastUpdate: this.state.lastUpdate,
      loading: this.state.loading,
    };
  }

  /**
   * Reset all counters and state flags to initial values.
   * Used when starting fresh counting or handling errors.
   */
  reset() {
    this.state.counter = { easy: 0, medium: 0, hard: 0 };
    this.state.isCountingComplete = false;
    this.state.lastUpdate = null;
    this.state.loading = true;
  }

  /**
   * Broadcast current state to all connected UI components.
   * Uses Chrome messaging API to update popup and other interfaces.
   * Handles messaging errors gracefully to prevent state corruption.
   */
  broadcastState() {
    chrome.runtime
      .sendMessage({
        type: "statsUpdate",
        data: this.getStats(),
      })
      .catch(() => {
        // Check for runtime.lastError to clear it
        if (chrome.runtime.lastError) {
          // Silently handle messaging errors (e.g., when popup is closed)
        }
      });
  }
}

/**
 * Service for interacting with GitHub repositories to fetch problem data.
 * Handles repository communication and data transformation for statistics.
 */
class GitHubService {
  /**
   * Initialize GitHub service with environment configuration.
   *
   * @param {Object} env - Environment configuration with API endpoints
   */
  constructor(env) {
    this.env = env;
  }

  /**
   * Build the base GitHub API URL for the connected repository.
   * Constructs URL from stored user credentials and repository name.
   *
   * @returns {Promise<string>} Complete GitHub API URL for repository contents
   */
  /**
   * Parse repository string to extract username and repository name.
   * @param {string} repoString - Repository string in format "username/repo" or just "repo"
   * @param {string} fallbackUsername - Username to use if repoString is just repo name
   * @returns {Object} Object with username and repositoryName
   */
  parseRepositoryString(repoString, fallbackUsername) {
    if (!repoString) {
      return null;
    }

    if (repoString.includes('/')) {
      const [username, repositoryName] = repoString.split('/');
      return {
        username: username.trim(),
        repositoryName: repositoryName.trim()
      };
    } else {
      // Legacy format: just repo name, use fallback username
      return {
        username: fallbackUsername,
        repositoryName: repoString.trim()
      };
    }
  }

  async buildBasicGithubUrl() {
    const result = await chrome.storage.local.get([
      "leetcode_tracker_username",
      "leetcode_tracker_repo",
    ]);

    // Parse repository string to get username and repo name
    const parsedRepo = this.parseRepositoryString(result.leetcode_tracker_repo, result.leetcode_tracker_username);
    if (!parsedRepo) {
      throw new Error("Invalid repository configuration");
    }

    return `${this.env.REPOSITORY_URL}${parsedRepo.username}/${parsedRepo.repositoryName}/contents/`;
  }

  /**
   * Fetch all LeetCode problems from the connected GitHub repository.
   * Searches through language folders to identify valid problem files.
   *
   * Algorithm:
   * 1. Build GitHub API URL for repository contents
   * 2. Fetch repository folder list via GitHub API
   * 3. For each language folder, fetch the files inside
   * 4. Filter files matching new LeetCode naming pattern (e.g., "0001 two-sum.py")
   * 5. Extract problem IDs and return structured problem data for statistics calculation
   *
   * @returns {Promise<Array<Object>>} Array of problem objects with IDs
   */
  async getAllLeetCodeProblems() {
    try {
      const url = await this.buildBasicGithubUrl();
      console.log('🔍 LeetCode Tracker: Fetching problems from URL:', url);

      const response = await fetch(url);
      console.log('📊 LeetCode Tracker: GitHub API response status:', response.status);

      if (!response.ok) {
        console.error('❌ LeetCode Tracker: GitHub API error:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      console.log('📁 LeetCode Tracker: Found repository contents:', data.length, 'items');

      const allProblems = [];

      // Look for language folders (directories)
      const languageFolders = data.filter(item => item.type === 'dir');
      console.log('🔍 LeetCode Tracker: Found language folders:', languageFolders.map(f => f.name));

      // Fetch problems from each language folder
      for (const folder of languageFolders) {
        try {
          const folderUrl = `${url}${folder.name}`;
          const folderResponse = await fetch(folderUrl);

          if (folderResponse.ok) {
            const folderData = await folderResponse.json();
            const problems = folderData
              .filter((file) => file.type === 'file' && /^\d{4}\s+.+\..+$/.test(file.name))
              .map((file) => ({
                originalName: file.name,
                questionId: this.convertGithubToLeetCodeSlug(file.name),
                language: folder.name,
              }));

            allProblems.push(...problems);
            console.log(`📁 LeetCode Tracker: Found ${problems.length} problems in ${folder.name}`);
          }
        } catch (error) {
          console.error(`❌ LeetCode Tracker: Error fetching ${folder.name} folder:`, error);
        }
      }

      console.log('✅ LeetCode Tracker: Total problems found:', allProblems.length);
      return allProblems;
    } catch (error) {
      console.error('❌ LeetCode Tracker: Error fetching problems:', error);
      return [];
    }
  }

  /**
   * Convert GitHub filename to LeetCode problem ID.
   * Extracts the numeric problem ID from the new filename format.
   *
   * @param {string} githubFileName - GitHub file name (e.g., "0001 two-sum.py")
   * @returns {string} LeetCode problem ID (e.g., "1")
   */
  convertGithubToLeetCodeSlug(githubFileName) {
    // Extract the 4-digit number from the beginning of the filename
    const match = githubFileName.match(/^(\d{4})\s+/);
    if (match) {
      // Convert to number to remove leading zeros, then back to string
      return parseInt(match[1], 10).toString();
    }
    return "";
  }
}

/**
 * Main controller for the LeetCode Tracker background script.
 * Orchestrates all background services and handles Chrome extension messaging.
 */
class LeetCodeTrackerController {
  /**
   * Initialize the controller with all required services and configuration.
   * Sets up state management, GitHub integration, and Chrome storage defaults.
   */
  constructor() {
    this.stateManager = new LeetCodeStateManager();
    this.githubService = new GitHubService(ENV);
    this.leetCodeService = new LeetCodeService();
    this.syncService = new SyncService();

    // Store environment configuration for other components
    chrome.storage.local.set({ leetcode_tracker_data_config: ENV });

    // Initialize sync status tracking
    chrome.storage.local.set({
      leetcode_tracker_last_sync_status: "",
      leetcode_tracker_sync_in_progress: false,
      leetcode_tracker_last_sync_message: "",
      leetcode_tracker_last_sync_date: null,
    });

    this.initializeMessageListeners();
  }

  /**
   * Set up Chrome extension message listeners for UI communication.
   * Handles all message types from popup, content scripts, and other components.
   *
   * Message Types:
   * - updateDifficultyStats: Real-time counter updates when problems are solved
   * - getDataConfig: Environment configuration requests
   * - saveUserInfos: Authentication data storage
   * - syncSolvedProblems: Manual synchronization triggers
   * - requestInitialStats: Statistics data requests (triggers recalculation)
   */
  initializeMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const handlers = {
        updateDifficultyStats: () => {
          const success = this.stateManager.incrementCounter(
            request.difficulty
          );
          sendResponse({ success });
        },
        getDataConfig: () => {
          sendResponse(ENV);
        },
        saveUserInfos: () => {
          this.saveUserInfos(request);
          sendResponse({ success: true });
        },
        syncSolvedProblems: async () => {
          try {
            await this.startSync();
            sendResponse({ status: "completed" });
          } catch (error) {
            sendResponse({ status: "failed", error: error.message });
          }
        },
        requestInitialStats: async () => {
          try {
            // Always recalculate counter when popup requests stats
            await this.initCounter();
            sendResponse(null); // Send null initially, updated stats will be broadcast
          } catch (error) {
            sendResponse({ status: "failed", error: error.message });
          }
        },
      };

      if (handlers[request.type]) {
        const result = handlers[request.type]();
        // If the handler returns a promise, wait for it
        if (result instanceof Promise) {
          result.catch((error) => {
            sendResponse({ status: "failed", error: error.message });
          });
          return true; // Keep message channel open for async responses
        }
      }

      return true; // Keep message channel open for async responses
    });
  }

  /**
   * Save user authentication information to Chrome storage.
   * Stores GitHub username and access token for API authentication.
   *
   * @param {Object} request - Request object containing username and token
   */
  saveUserInfos(request) {
    chrome.storage.local.set({
      leetcode_tracker_username: request.username,
      leetcode_tracker_token: request.token,
    });
  }

  /**
   * Start the synchronization process and track progress.
   * Coordinates with SyncService and updates storage with results.
   *
   * Algorithm:
   * 1. Delegate synchronization to SyncService
   * 2. Monitor sync progress and handle results
   * 3. Update Chrome storage with sync status and messages
   * 4. Trigger counter recalculation on successful sync
   * 5. Handle errors gracefully and update status accordingly
   *
   * @returns {Promise<Object>} Sync result with success status and message
   */
  async startSync() {
    try {
      const result = await this.syncService.startSync();

      await chrome.storage.local.set({
        leetcode_tracker_last_sync_status: result.success
          ? "success"
          : "failed",
        leetcode_tracker_sync_in_progress: false,
        leetcode_tracker_last_sync_message: result.message,
        leetcode_tracker_last_sync_date: new Date().toISOString(),
      });

      if (result.success) {
        this.initCounter();
      }

      return result;
    } catch (error) {
      await chrome.storage.local.set({
        leetcode_tracker_last_sync_status: "failed",
        leetcode_tracker_sync_in_progress: false,
        leetcode_tracker_last_sync_message: error.message,
        leetcode_tracker_last_sync_date: new Date().toISOString(),
      });

      return {
        success: false,
        message: "Error during synchronization: " + error.message,
      };
    }
  }

  /**
   * Initialize or recalculate problem counters by fetching current repository state.
   * Combines GitHub repository data with LeetCode difficulty information.
   *
   * Algorithm:
   * 1. Validate user authentication and repository configuration
   * 2. Reset state manager to loading state
   * 3. Fetch problem list from GitHub repository in parallel with LeetCode difficulty data
   * 4. Create difficulty mapping from LeetCode API data
   * 5. Map repository problems to their difficulty levels
   * 6. Update state manager with calculated statistics
   * 7. Handle errors gracefully and ensure UI remains responsive
   *
   * This method is called:
   * - On extension startup if user is fully configured
   * - When repository configuration changes
   * - When popup requests initial statistics (ensures fresh data)
   * - After successful synchronization
   */
  async initCounter() {
    try {
      const {
        leetcode_tracker_token,
        leetcode_tracker_username,
        leetcode_tracker_repo,
      } = await chrome.storage.local.get([
        "leetcode_tracker_token",
        "leetcode_tracker_username",
        "leetcode_tracker_repo",
      ]);

      // Exit early if not fully configured
      if (
        !leetcode_tracker_token ||
        !leetcode_tracker_username ||
        !leetcode_tracker_repo
      ) {
        this.stateManager.state.loading = false;
        this.stateManager.state.isCountingComplete = true;
        this.stateManager.broadcastState();
        return;
      }

      this.stateManager.reset();

      // Fetch data in parallel for better performance
      const [problems, allQuestions] = await Promise.all([
        this.getAllLeetCodeProblems(),
        this.leetCodeService.fetchAllQuestionsDifficulty(),
      ]);

      // Create efficient lookup map for difficulty information
      const difficultyMap = new Map(
        allQuestions.map((q) => [q.questionId, q.difficulty])
      );

      // Map problems to their difficulties
      const difficulties = problems.map((problem) =>
        difficultyMap.get(problem.questionId)
      );

      this.stateManager.updateStats(difficulties);
    } catch (error) {
      // Ensure UI shows completed state even on error
      this.stateManager.state.loading = false;
      this.stateManager.state.isCountingComplete = true;
      this.stateManager.broadcastState();
    }
  }
}

/**
 * Extension installation and update handler.
 * Sets up default settings for new installations and updates.
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
    // Initialize default settings only if they don't exist
    chrome.storage.local.get("leetcode_tracker_code_submit", (result) => {
      if (result.leetcode_tracker_code_submit === undefined) {
        chrome.storage.local.set({
          leetcode_tracker_code_submit: true,
        });
      }
    });

    // Always set multiple submissions to false
    chrome.storage.local.set({
      leetcode_tracker_sync_multiple_submission: false,
    });

    // Always set comment submission to false
    chrome.storage.local.set({
      leetcode_tracker_comment_submission: false,
    });

    chrome.storage.local.get("leetcode_tracker_auto_sync", (result) => {
      if (result.leetcode_tracker_auto_sync === undefined) {
        chrome.storage.local.set({
          leetcode_tracker_auto_sync: true,
        });
      }
    });
  }
});

// Initialize the main controller
const controller = new LeetCodeTrackerController();

/**
 * Initialize counter on startup if user is fully configured.
 * Ensures statistics are available immediately when extension starts.
 */
chrome.runtime.onStartup.addListener(async () => {
  try {
    const {
      leetcode_tracker_token,
      leetcode_tracker_username,
      leetcode_tracker_repo,
      leetcode_tracker_mode,
    } = await chrome.storage.local.get([
      "leetcode_tracker_token",
      "leetcode_tracker_username",
      "leetcode_tracker_repo",
      "leetcode_tracker_mode",
    ]);

    if (
      leetcode_tracker_token &&
      leetcode_tracker_username &&
      leetcode_tracker_repo &&
      leetcode_tracker_mode
    ) {
      controller.initCounter();
    }
  } catch (error) {
    // Handle initialization errors gracefully
  }
});

/**
 * Listen for storage changes and recalculate counters when repository configuration changes.
 * Ensures statistics stay synchronized with repository changes.
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.leetcode_tracker_repo || changes.leetcode_tracker_mode) {
      controller.initCounter();
    }
  }
});

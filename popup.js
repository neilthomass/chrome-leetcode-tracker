/**
 * DOM element references for the extension popup interface.
 * Centralizes all DOM queries for better maintainability and performance.
 */
const DOM = {
  authenticate: document.getElementById("authenticate"),
  authenticateButton: document.getElementById("github-authenticate-button"),
  hookRepo: document.getElementById("hook-repo"),
  authenticated: document.getElementById("authenticated"),
  repoName: document.getElementById("repo-name"),
  repoNameError: document.getElementById("repo-name-error"),
  hookButton: document.getElementById("hook-button"),
  unlinkButton: document.getElementById("unlink-button"),
  repositoryName: document.getElementById("repository-name"),
  repositoryLink: document.getElementById("repository-link"),
  githubUsername: document.getElementById("github-username"),
  logoutButton: document.getElementById("logout-button"),
  changeAccountButton: document.getElementById("change-account-button"),
  checkboxCodeSubmitSetting: document.getElementById("submit-code-checkbox"),
  syncButton: document.getElementById("sync-button"),
  manualPushButton: document.getElementById("manual-push-button"),
  syncStatus: document.getElementById("sync-status"),
  syncTime: document.getElementById("sync-time"),
  stats: {
    easy: document.getElementById("easy"),
    medium: document.getElementById("medium"),
    hard: document.getElementById("hard"),
  },
};

/**
 * Main controller class for the browser extension popup interface.
 * Manages authentication flow, repository linking, settings, and synchronization status.
 */
class PopupManager {
  /**
   * Initialize the popup manager with all required components.
   * Sets up statistics display, event listeners, settings synchronization,
   * and starts background sync status monitoring.
   */
  constructor() {
    this.initializeStats();
    this.initializeEventListeners();
    this.initializeSetting();

    this.updateSyncStatus();
    this.syncStatusInterval = setInterval(() => this.updateSyncStatus(), 2000);
  }

  /**
   * Load and synchronize all user settings from Chrome storage to UI controls.
   * Ensures the popup displays current setting states correctly.
   */
  initializeSetting() {
    chrome.storage.local.get("leetcode_tracker_code_submit", (result) => {
      const codeSubmit = result.leetcode_tracker_code_submit;
      DOM.checkboxCodeSubmitSetting.checked = codeSubmit;
    });


  }


  /**
   * Toggle the code submission setting with dependent setting management.
   * When disabled, automatically disables multiple submissions and comments
   * to maintain logical consistency.
   *
   * Algorithm:
   * 1. Get current code submit setting state
   * 2. Invert the setting value
   * 3. If disabling code submit, also disable dependent features
   * 4. Update storage and refresh UI
   */
  toggleCodeSubmitSetting() {
    chrome.storage.local.get("leetcode_tracker_code_submit", (result) => {
      const codeSubmit = result.leetcode_tracker_code_submit;
      chrome.storage.local.set({
        leetcode_tracker_code_submit: !codeSubmit,
      });


      this.initializeSetting();
    });
  }



  /**
   * Set up all event listeners for the popup interface.
   * Includes DOM event handlers and Chrome extension message listeners.
   */
  initializeEventListeners() {
    document.addEventListener("DOMContentLoaded", this.setupLinks.bind(this));
    DOM.authenticateButton.addEventListener(
      "click",
      this.handleAuthentication.bind(this)
    );
    DOM.hookButton.addEventListener("click", this.handleHookRepo.bind(this));
    DOM.unlinkButton.addEventListener("click", this.unlinkRepo.bind(this));
    DOM.logoutButton.addEventListener("click", this.logout.bind(this));
    DOM.changeAccountButton.addEventListener("click", this.logout.bind(this));
    DOM.checkboxCodeSubmitSetting.addEventListener(
      "click",
      this.toggleCodeSubmitSetting.bind(this)
    );
    DOM.syncButton.addEventListener("click", this.startManualSync.bind(this));
    DOM.manualPushButton.addEventListener("click", this.handleManualPush.bind(this));

    // Listen for statistics updates from background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "statsUpdate") {
        this.updateStatsDisplay(message.data);
      }
    });
  }

  /**
   * Initiate manual synchronization of all solved problems.
   * Updates UI to show progress and sends sync command to background script.
   *
   * Algorithm:
   * 1. Disable sync button to prevent multiple concurrent syncs
   * 2. Replace button content with animated loading indicator
   * 3. Inject CSS animation for loading spinner
   * 4. Send sync message to background script
   * 5. Update sync status display
   */
  startManualSync() {
    DOM.syncButton.disabled = true;
    DOM.syncButton.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="spin" viewBox="0 0 16 16"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg><span style="margin-left: 5px">Syncing...</span>';

    // Inject CSS animation for loading spinner
    const style = document.createElement("style");
    style.textContent = `
  .spin {
    animation: spin 1.5s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
    document.head.appendChild(style);

    chrome.runtime.sendMessage({ type: "syncSolvedProblems" }, (response) => {
      if (chrome.runtime.lastError) {
        // Handle messaging errors gracefully
      }
    });

    this.updateSyncStatus();
  }

  /**
   * Update the synchronization status display with current progress and results.
   * Monitors background sync process and updates UI accordingly.
   *
   * Algorithm:
   * 1. Fetch sync status data from Chrome storage
   * 2. Update button state based on sync progress
   * 3. Display appropriate status message and styling
   * 4. Show formatted timestamp of last sync operation
   * 5. Handle error cases and edge states gracefully
   */
  async updateSyncStatus() {
    try {
      const result = await chrome.storage.local.get([
        "leetcode_tracker_sync_in_progress",
        "leetcode_tracker_last_sync_status",
        "leetcode_tracker_last_sync_message",
        "leetcode_tracker_last_sync_date",
      ]);

      const inProgress = result.leetcode_tracker_sync_in_progress || false;
      const lastStatus = result.leetcode_tracker_last_sync_status || "";
      const lastMessage = result.leetcode_tracker_last_sync_message || "";
      const lastDate = result.leetcode_tracker_last_sync_date
        ? new Date(result.leetcode_tracker_last_sync_date)
        : null;

      if (inProgress) {
        DOM.syncButton.disabled = true;
        DOM.syncButton.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="spin" viewBox="0 0 16 16"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg><span style="margin-left: 5px">Syncing...</span>';
        DOM.syncStatus.textContent = "Synchronization in progress...";
      } else {
        DOM.syncButton.disabled = false;
        DOM.syncButton.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg><span style="margin-left: 5px">Sync</span>';

        // Update status message based on last sync result
        if (lastStatus === "success") {
          DOM.syncStatus.textContent = "Last sync: Successful";
          DOM.syncStatus.className = "text-success";
        } else if (lastStatus === "failed") {
          DOM.syncStatus.textContent = "Last sync: Failed";
          DOM.syncStatus.className = "text-danger";

          if (lastMessage) {
            DOM.syncStatus.textContent = `Last sync: Failed - ${lastMessage}`;
          }
        } else if (!lastStatus) {
          DOM.syncStatus.textContent = "";
          DOM.syncStatus.className = "";
        }
      }

      // Display formatted timestamp
      if (lastDate) {
        const formattedDate = this.formatDate(lastDate);
        DOM.syncTime.textContent = `${formattedDate}`;
        DOM.syncTime.className = "text-muted";
      } else {
        DOM.syncTime.textContent = "";
      }
    } catch (error) {
      // Handle errors silently to prevent popup disruption
    }
  }

  /**
   * Format a date object into a human-readable relative time string.
   * Provides intuitive time descriptions (e.g., "2 minutes ago", "Just now").
   *
   * @param {Date} date - The date to format
   * @returns {string} Human-readable relative time string
   */
  formatDate(date) {
    if (!date) return "";

    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) {
      return "Just now";
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
    } else if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    } else {
      return date.toLocaleString();
    }
  }

  /**
   * Configure external links to open in new tabs.
   * Prevents navigation away from the popup interface.
   */
  setupLinks() {
    document.querySelectorAll("a.link").forEach((link) => {
      link.onclick = () => chrome.tabs.create({ active: true, url: link.href });
    });
  }

  /**
   * Check the current authentication status and display appropriate UI state.
   * Determines which section of the popup should be visible based on user progress.
   *
   * State Machine:
   * - No token/username → Show authentication section
   * - Has token but no repo → Show repository setup section
   * - Fully configured → Show main authenticated interface
   */
  async checkAuthStatus() {
    const result = await chrome.storage.local.get([
      "leetcode_tracker_token",
      "leetcode_tracker_username",
      "leetcode_tracker_mode",
      "leetcode_tracker_repo",
    ]);

    if (!result.leetcode_tracker_token || !result.leetcode_tracker_username) {
      DOM.authenticate.style.display = "block";
    } else if (!result.leetcode_tracker_repo || !result.leetcode_tracker_mode) {
      DOM.hookRepo.style.display = "block";
    } else {
      DOM.authenticated.style.display = "block";
    }

    this.updateUserInfos();
  }

  /**
   * Log out the user by clearing all stored data and resetting UI state.
   * Provides complete cleanup for account switching or privacy.
   */
  async logout() {
    try {
      await chrome.storage.local.clear();

      DOM.authenticate.style.display = "block";
      DOM.hookRepo.style.display = "none";
      DOM.authenticated.style.display = "none";
    } catch (error) {
      // Handle logout errors gracefully
    }
  }

  /**
   * Update the user information display with current GitHub username and repository.
   * Constructs the repository link for easy access to the GitHub repository.
   */
  async updateUserInfos() {
    const { leetcode_tracker_repo, leetcode_tracker_username } =
      await chrome.storage.local.get([
        "leetcode_tracker_repo",
        "leetcode_tracker_username",
      ]);

    if (leetcode_tracker_username) {
      DOM.githubUsername.textContent = leetcode_tracker_username;
    }

    if (leetcode_tracker_repo) {
      // Check if repo is stored as "username/repo" format
      const parsedRepo = this.parseRepositoryString(leetcode_tracker_repo);

      if (parsedRepo) {
        // New format: username/repo
        DOM.repositoryName.textContent = `/${leetcode_tracker_repo}`;
        DOM.repositoryLink.href = `https://github.com/${leetcode_tracker_repo}`;
      } else if (leetcode_tracker_username) {
        // Legacy format: just repo name (fallback for existing users)
        DOM.repositoryName.textContent = `/${leetcode_tracker_username}/${leetcode_tracker_repo}`;
        DOM.repositoryLink.href = `https://github.com/${leetcode_tracker_username}/${leetcode_tracker_repo}`;
      }
    }
  }

  /**
   * Initialize the statistics display by requesting current data from background script.
   * Shows loading state while fetching and updates display when data arrives.
   */
  async initializeStats() {
    try {
      this.startLoading();

      const initialStats = await this.getInitialStats();
      if (initialStats) {
        this.updateStatsDisplay(initialStats);
      }
    } catch (error) {
      // Handle stats loading errors gracefully
    }
  }

  /**
   * Request initial statistics data from the background script.
   * Uses Chrome messaging API to communicate with background processes.
   *
   * @returns {Promise<Object>} Promise resolving to statistics object
   */
  getInitialStats() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "requestInitialStats" },
        (response) => {
          if (chrome.runtime.lastError) {
            // Handle messaging errors gracefully
            resolve(null);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Update the statistics display with new data from background script.
   * Handles both initial load and real-time updates during synchronization.
   *
   * @param {Object} stats - Statistics object with easy, medium, hard counts
   */
  updateStatsDisplay(stats) {
    if (!stats) return;

    this.stopLoading();

    Object.keys(DOM.stats).forEach((key) => {
      if (DOM.stats[key]) {
        DOM.stats[key].textContent = stats[key] || 0;
      }
    });
  }

  /**
   * Show loading animation for statistics section.
   * Provides visual feedback during data fetching.
   */
  startLoading() {
    document.getElementById("loading-container").style.display = "flex";
    document.getElementById("stats").classList.add("loading");
  }

  /**
   * Hide loading animation and show statistics content.
   * Called when data loading completes successfully.
   */
  stopLoading() {
    document.getElementById("loading-container").style.display = "none";
    document.getElementById("stats").classList.remove("loading");
  }

  /**
   * Handle GitHub authentication by opening OAuth flow in new tab.
   * Constructs proper OAuth URL with required parameters and scopes.
   */
  async handleAuthentication() {
    try {
      const data = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "getDataConfig" }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      const url = `${data.URL}?client_id=${data.CLIENT_ID}&redirect_uri${
        data.REDIRECT_URL
      }&scope=${data.SCOPES.join(" ")}`;
      chrome.tabs.create({ url, active: true });
    } catch (error) {
      // Handle authentication errors gracefully
    }
  }

  /**
   * Parse a repository string (username/repo) to extract components.
   * @param {string} repoString - Repository string in format "username/repo"
   * @returns {Object} Object with username and repositoryName, or null if invalid
   */
  parseRepositoryString(repoString) {
    if (!repoString || !repoString.includes('/')) {
      return null;
    }

    const [username, repositoryName] = repoString.split('/');
    return {
      username: username.trim(),
      repositoryName: repositoryName.trim()
    };
  }

  /**
   * Parse GitHub repository URL to extract username and repository name.
   * @param {string} input - GitHub URL or repository name
   * @returns {Object} Object with username and repositoryName, or null if invalid
   */
  parseGitHubRepository(input) {
    if (!input || !input.trim()) {
      return null;
    }

    const trimmedInput = input.trim();

    // Check if it's a GitHub URL
    const githubUrlPattern = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/;
    const match = trimmedInput.match(githubUrlPattern);

    if (match) {
      return {
        username: match[1],
        repositoryName: match[2]
      };
    }

    // Check if it's a slug format like "username/repo"
    const slugPattern = /^([^\/]+)\/([^\/]+)$/;
    const slugMatch = trimmedInput.match(slugPattern);

    if (slugMatch) {
      return {
        username: slugMatch[1],
        repositoryName: slugMatch[2]
      };
    }

    // Fallback: assume it's just a repository name for the current user
    return {
      username: null, // Will use current user's username
      repositoryName: trimmedInput
    };
  }

  /**
   * Handle repository setup and validation process.
   * Validates user input and attempts to link the specified repository.
   */
  async handleHookRepo() {
    const repositoryInput = DOM.repoName.value;
    DOM.repoNameError.textContent = "";

    if (!repositoryInput) {
      DOM.repoNameError.textContent = "Please enter a repository URL or name";
      return;
    }

    const parsedRepo = this.parseGitHubRepository(repositoryInput);

    if (!parsedRepo) {
      DOM.repoNameError.textContent = "Please enter a valid GitHub repository URL or name";
      return;
    }

    try {
      const result = await chrome.storage.local.get([
        "leetcode_tracker_token",
        "leetcode_tracker_username",
      ]);

      if (result) {
        // Use parsed username or fall back to current user's username
        const targetUsername = parsedRepo.username || result.leetcode_tracker_username;
        const repositoryName = parsedRepo.repositoryName;

        await this.linkRepo(result, repositoryName, targetUsername);
      }
    } catch (error) {
      DOM.repoNameError.textContent =
        "An error occurred while linking the repository";
    }
  }

  /**
   * Link and validate a GitHub repository for synchronization.
   * Verifies repository exists and user has appropriate access permissions.
   *
   * Algorithm:
   * 1. Extract authentication data and repository name
   * 2. Get API configuration from background script
   * 3. Make authenticated request to GitHub API to verify repository
   * 4. Handle authentication errors by logging out user
   * 5. Store repository configuration on successful validation
   * 6. Update UI to show authenticated state
   *
   * @param {Object} githubAuthData - Authentication data with token and username
   * @param {string} repositoryName - Name of repository to link
   * @param {string} targetUsername - Username of the repository owner (may differ from authenticated user)
   */
  async linkRepo(githubAuthData, repositoryName, targetUsername) {
    const { leetcode_tracker_token, leetcode_tracker_username } =
      githubAuthData;
    const dataConfig = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "getDataConfig" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    try {
      const response = await fetch(
        `${dataConfig.REPOSITORY_URL}${targetUsername}/${repositoryName}`,
        {
          method: "GET",
          headers: {
            ...dataConfig.HEADERS,
            Authorization: `token ${leetcode_tracker_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
        }

        throw new Error(result.message);
      }

      await chrome.storage.local.set({
        leetcode_tracker_mode: "commit",
        leetcode_tracker_repo: `${targetUsername}/${repositoryName}`,
      });

      DOM.hookRepo.style.display = "none";
      DOM.authenticated.style.display = "block";
    } catch (error) {
      DOM.repoNameError.textContent = error.message;
    }
  }

  /**
   * Unlink the current repository and return to repository setup state.
   * Allows users to change repositories without full logout.
   */
  async unlinkRepo() {
    try {
      await chrome.storage.local.remove([
        "leetcode_tracker_mode",
        "leetcode_tracker_repo",
      ]);
      DOM.authenticated.style.display = "none";
      DOM.hookRepo.style.display = "block";
    } catch (error) {
      // Handle unlink errors gracefully
    }
  }

  /**
   * Send message to content script with fallback injection if script not loaded.
   * @param {number} tabId - The tab ID to send message to
   * @param {Object} message - The message to send
   * @param {Function} callback - Callback to execute after successful message
   */
  async sendMessageWithFallback(tabId, message, callback) {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message || '';

          if (errorMessage.includes('Could not establish connection') ||
              errorMessage.includes('Receiving end does not exist')) {
            console.log('🔄 LeetCode Tracker: Content script not found, injecting...');
            this.injectContentScript(tabId, message, callback);
          } else {
            console.error('Manual push failed:', chrome.runtime.lastError.message || chrome.runtime.lastError);
          }
        } else {
          console.log('✅ LeetCode Tracker: Message sent successfully');
          callback();
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      this.injectContentScript(tabId, message, callback);
    }
  }

  /**
   * Inject content script and retry sending message.
   * @param {number} tabId - The tab ID to inject script into
   * @param {Object} message - The message to send after injection
   * @param {Function} callback - Callback to execute after successful message
   */
  async injectContentScript(tabId, message, callback) {
    try {
      console.log('🔧 LeetCode Tracker: Injecting content script...');

      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['scripts/loader.js']
      });

      // Wait a moment for script to initialize
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Manual push failed after injection:', chrome.runtime.lastError.message || chrome.runtime.lastError);
          } else {
            console.log('✅ LeetCode Tracker: Message sent successfully after injection');
            callback();
          }
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to inject content script:', error);
    }
  }

  /**
   * Handle manual push of current LeetCode solution to GitHub.
   * Sends a message to the active tab to trigger manual submission handling.
   */
  async handleManualPush() {
    try {
      DOM.manualPushButton.disabled = true;
      DOM.manualPushButton.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="spin" viewBox="0 0 16 16"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg><span style="margin-left: 5px">Pushing...</span>';

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url || !tab.url.includes('leetcode.com')) {
        throw new Error('Please navigate to a LeetCode problem page first');
      }

      // Try to send message to content script, with fallback injection
      this.sendMessageWithFallback(tab.id, { type: "manualPush" }, () => {
        setTimeout(() => {
          DOM.manualPushButton.disabled = false;
          DOM.manualPushButton.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/></svg><span style="margin-left: 5px">Push</span>';
        }, 2000);
      });
    } catch (error) {
      DOM.manualPushButton.disabled = false;
      DOM.manualPushButton.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/></svg><span style="margin-left: 5px">Push</span>';
      console.error('Manual push error:', error.message || error);
    }
  }
}

// Initialize the popup manager and check authentication status
const popupManager = new PopupManager();
popupManager.checkAuthStatus();

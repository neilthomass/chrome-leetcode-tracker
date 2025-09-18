(async () => {
  try {
    // Only initialize LeetCode Tracker on LeetCode pages
    if (window.location.hostname === 'leetcode.com') {
      const src = chrome.runtime.getURL("scripts/leetcode.js");
      const mainModule = await import(src);

      // Initialize LeetcodeTracker
      new mainModule.default();
      console.log('🚀 LeetCode Tracker: Initialized successfully');
    }
  } catch (error) {
    console.error("Error loading LeetCode Tracker modules:", error);
  }
})();

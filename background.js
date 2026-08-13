// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage with empty arrays
  chrome.storage.local.set({
    registeredCourses: []
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveCourse') {
    chrome.storage.local.get(['registeredCourses'], function(result) {
      const courses = result.registeredCourses || [];
      courses.push(request.course);
      chrome.storage.local.set({ registeredCourses: courses });
    });
  }
}); 
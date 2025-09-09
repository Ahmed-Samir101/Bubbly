// DOM Inspector script - helps identify UI issues
(function() {
  function inspectDOM() {
    console.log('%c[DOM INSPECTOR] Starting DOM inspection', 'color: blue; font-weight: bold');
    
    // Check main elements
    const elements = {
      'chatWindow': document.getElementById('chat-window'),
      'messageForm': document.getElementById('message-form'),
      'messageInput': document.getElementById('message-input'),
      'sendLocationBtn': document.querySelector('#send-location'),
      'addFriendBtn': document.getElementById('add-friend-btn'),
      'friendNameInput': document.getElementById('friend-name-input'),
      'friendsList': document.getElementById('friends-list'),
      'chatHeader': document.querySelector('.chat-header'),
      'sidebar': document.querySelector('.sidebar'),
      'sidebarHeader': document.querySelector('.sidebar h2'),
      'userInfo': document.querySelector('.user-info')
    };
    
    // Log results
    for (const [name, element] of Object.entries(elements)) {
      console.log(
        `%c[DOM INSPECTOR] ${name}: ${element ? 'Found ✓' : 'NOT FOUND ✗'}`, 
        element ? 'color: green' : 'color: red; font-weight: bold'
      );
    }
    
    // Check sidebar structure
    if (elements.sidebar) {
      console.log('%c[DOM INSPECTOR] Sidebar children:', 'color: blue');
      Array.from(elements.sidebar.children).forEach((child, index) => {
        console.log(`%c[DOM INSPECTOR] Child ${index}:`, 'color: blue', child.tagName, child.className);
      });
    }
    
    return elements;
  }
  
  // Run after a short delay to ensure DOM is loaded
  setTimeout(inspectDOM, 1000);
})();
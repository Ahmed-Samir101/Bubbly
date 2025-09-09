// Configure socket.io with better connection options
const socket = io({
  reconnectionAttempts: 5,  // Try to reconnect 5 times
  reconnectionDelay: 1000,  // Start with 1 second delay
  reconnectionDelayMax: 5000, // Maximum delay of 5 seconds
  timeout: 20000, // Longer timeout before giving up
  transports: ['websocket', 'polling'], // Try websocket first, then polling
  forceNew: false,
  autoConnect: true
});

const chatWindow = document.getElementById('chat-window');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendLocationBtn = document.querySelector('#send-location');
const addFriendBtn = document.getElementById('add-friend-btn');
const friendNameInput = document.getElementById('friend-name-input');
const friendsList = document.getElementById('friends-list');
const chatHeader = document.querySelector('.chat-header');

let currentUser = null;
let myId = null;
let currentRoom = 'general';
let currentFriend = null;
let friends = [];

// Debug helper with enhanced information
function debug(message, object = null) {
  const timestamp = new Date().toISOString().substring(11, 19);
  if (object) {
    console.log(`[Bubbly Debug ${timestamp}] ${message}`, object);
  } else {
    console.log(`[Bubbly Debug ${timestamp}] ${message}`);
  }
  
  // Also add to debug log element if it exists
  const debugLog = document.getElementById('debug-log');
  if (debugLog) {
    const entry = document.createElement('div');
    entry.textContent = `${timestamp}: ${message}`;
    entry.classList.add('debug-entry');
    debugLog.appendChild(entry);
    debugLog.scrollTop = debugLog.scrollHeight;
  }
}

// Show notification in chat window
function showNotification(message) {
  const notification = document.createElement('div');
  notification.classList.add('notification');
  notification.textContent = message;
  chatWindow.appendChild(notification);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Render text message
function renderMessage({ sender, text, isOwn, timestamp }) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.classList.add(isOwn ? 'user' : 'bianca');
  div.dataset.sender = sender; // Add data attributes for potential filtering
  
  // Add message text
  const messageText = document.createElement('div');
  messageText.classList.add('message-text');
  messageText.textContent = text;
  div.appendChild(messageText);
  
  // Add timestamp
  const timeDisplay = document.createElement('div');
  timeDisplay.classList.add('message-time');
  
  // Use provided timestamp or current time
  const messageTime = timestamp ? new Date(timestamp) : new Date();
  timeDisplay.textContent = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.appendChild(timeDisplay);
  
  // Add to chat window and scroll
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  
  debug(`Message rendered: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''} from ${sender} (${isOwn ? 'me' : 'other'})`);
}

// Render location message
function renderLocation({ sender, url, isOwn }) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.classList.add(isOwn ? 'user' : 'bianca');
  
  // Add location link
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-text');
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.textContent = 'My location 📍';
  messageContent.appendChild(a);
  div.appendChild(messageContent);
  
  // Add timestamp
  const timestamp = document.createElement('div');
  timestamp.classList.add('message-time');
  timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.appendChild(timestamp);
  
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Keep track of registration status
let isRegistered = false;

// Get own socket id and register user
socket.on('connect', () => {
  // We'll use user ID from localStorage instead of socket.id
  // This ensures consistent ID across reconnects
  if (currentUser) {
    myId = currentUser.id;
    
    // Register with server
    socket.emit('registerUser', { 
      userId: myId, 
      username: currentUser.username 
    });
    
    isRegistered = true;
    debug(`Connected as ${currentUser.username} (${myId})`);
    
    // Only show notification on first connect, not reconnects
    if (!connectionStable) {
      showNotification('Connected to server');
    }
    
    // If we have a current friend/room, rejoin it
    if (currentFriend && currentRoom) {
      debug(`Rejoining room on connect: ${currentRoom}`);
      socket.emit('joinRoom', { 
        room: currentRoom, 
        userId: myId, 
        username: currentUser.username 
      });
    }
  }
});

// Connection status tracking
let lastConnectionEvent = Date.now();
let disconnectTimer = null;
let connectionStable = true;

// Handle disconnection - with debounce to avoid rapid reconnect messages
socket.on('disconnect', () => {
  debug('Disconnected from server');
  
  // Clear any pending timer
  if (disconnectTimer) clearTimeout(disconnectTimer);
  
  // Only show notification if disconnection lasts more than 2 seconds
  disconnectTimer = setTimeout(() => {
    // Only show if we haven't reconnected in the meantime
    if (!socket.connected) {
      connectionStable = false;
      showNotification('Disconnected from server. Trying to reconnect...');
    }
  }, 2000);
  
  lastConnectionEvent = Date.now();
});

// Handle reconnection
socket.on('reconnect', () => {
  debug('Reconnected to server');
  
  // Clear any disconnect timer
  if (disconnectTimer) clearTimeout(disconnectTimer);
  
  // Only show notification if we previously showed a disconnect
  // or if it's been a while since we disconnected
  const timeDisconnected = Date.now() - lastConnectionEvent;
  if (!connectionStable || timeDisconnected > 3000) {
    showNotification('Reconnected to server');
  }
  
  connectionStable = true;
  
  // Rejoin current room if any
  if (currentRoom && currentFriend) {
    socket.emit('joinRoom', { 
      room: currentRoom, 
      userId: myId, 
      username: currentUser.username 
    });
    debug(`Rejoined room: ${currentRoom}`);
  }
  
  lastConnectionEvent = Date.now();
});

// Add socket.io error handling
socket.on('connect_error', (error) => {
  debug(`Socket connection error: ${error.message}`);
});

socket.on('connect_timeout', () => {
  debug('Socket connection timeout');
});

socket.on('error', (error) => {
  debug(`Socket error: ${error.message}`);
});

socket.on('errorMessage', (data) => {
  debug(`Error from server: ${data.error}`, data.details);
  showNotification(`Server error: ${data.error}`);
});

// Send message
messageForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !currentRoom || !currentFriend) {
    debug('Cannot send message: text, room, or friend is missing');
    return;
  }
  
  debug(`Sending message to ${currentFriend.username} in room ${currentRoom}: ${text}`);
  
  // Create message object with timestamp and message ID
  const timestamp = new Date().getTime();
  const messageId = 'msg_' + Math.random().toString(36).substr(2, 9);
  const messageObj = { 
    text, 
    sender: myId, 
    senderUsername: currentUser.username,
    room: currentRoom,
    timestamp,
    type: 'text',
    messageId
  };
  
  // Add a message sending visual indicator
  const messageSending = document.createElement('div');
  messageSending.classList.add('message-sending-indicator');
  messageSending.id = `sending-${messageId}`;
  messageSending.textContent = 'Sending...';
  chatWindow.appendChild(messageSending);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  
  // Send message through socket with acknowledgment
  socket.emit('chatMessage', messageObj, (delivery) => {
    // Remove the sending indicator
    const indicator = document.getElementById(`sending-${messageId}`);
    if (indicator) {
      indicator.remove();
    }
    
    if (delivery && delivery.success) {
      debug(`Message ${messageId} delivered successfully`);
    } else {
      debug(`Message ${messageId} delivery issue: ${delivery ? delivery.error : 'No acknowledgment'}`);
      showNotification('Message may not have been delivered');
    }
  });
  
  // Immediately render the message locally as well for better UX
  renderMessage({ 
    sender: myId, 
    text, 
    isOwn: true,
    timestamp
  });
  
  // Also update friend preview
  if (currentFriend) {
    updateFriendPreview(currentFriend.id, text);
  }
  
  // Clear the input field immediately
  messageInput.value = '';
});

// Receive text message
socket.on('chatMessage', function({ text, sender, senderUsername, room, timestamp }) {
  debug(`Message received: ${text} from ${senderUsername} in room ${room}`);
  
  // Skip system messages if not relevant
  if (sender === 'system' && senderUsername === 'System' && friends.length > 0) {
    debug('Skipping system message for user with friends');
    return;
  }
  
  // Handle both own and other users' messages
  const isOwn = sender === myId;
  debug(`Message is ${isOwn ? 'mine' : 'from someone else'}, current room: ${currentRoom}`);
  
  // Only show message if in the correct room
  if (room === currentRoom || !room) { // System messages might not have a room
    debug(`Rendering message in current room`);
    renderMessage({ sender, text, isOwn });
  } else {
    debug(`Message is for room ${room}, but we're in ${currentRoom}`);
  }
  
  // Update friend preview if this is from a friend or ourselves
  if (sender !== 'system') {
    if (!isOwn) {
      const friend = friends.find(f => f.id === sender);
      if (friend) {
        debug(`Updating preview for friend ${friend.username}`);
        updateFriendPreview(friend.id, text);
      } else {
        debug(`Friend not found for sender ${sender}`);
      }
    } else if (currentFriend) {
      debug(`Updating preview for my message to ${currentFriend.username}`);
      updateFriendPreview(currentFriend.id, text);
    }
  }
});

// Send location
sendLocationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    return alert('Geolocation is not supported by your browser.');
  }
  
  if (!currentRoom || !currentFriend) {
    return alert('Please select a friend to chat with first.');
  }
  
  sendLocationBtn.setAttribute('disabled', 'disabled');
  sendLocationBtn.textContent = 'Sending...';
  
  navigator.geolocation.getCurrentPosition((position) => {
    const url = `https://google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
    const timestamp = new Date().getTime();
    
    // Create location object
    const locationObj = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      sender: myId,
      senderUsername: currentUser.username,
      room: currentRoom,
      timestamp,
      url
    };
    
    // Send to server
    socket.emit('sendLocation', locationObj);
    
    // Re-enable button
    sendLocationBtn.removeAttribute('disabled');
    sendLocationBtn.textContent = '📍 Location';
  }, (error) => {
    alert(`Unable to get location: ${error.message}`);
    sendLocationBtn.removeAttribute('disabled');
    sendLocationBtn.textContent = '📍 Location';
  });
});

// Receive location message
socket.on('locationMessage', function({ url, sender, senderUsername, room, timestamp }) {
  // Handle both own and other users' messages
  const isOwn = sender === myId;
  
  // Only show location if in the correct room
  if (room === currentRoom) {
    renderLocation({ sender, url, isOwn });
  }
  
  // Update friend preview
  if (!isOwn) {
    const friend = friends.find(f => f.id === sender);
    if (friend) {
      updateFriendPreview(friend.id, 'Shared a location');
    }
  } else if (currentFriend) {
    updateFriendPreview(currentFriend.id, 'Shared a location');
  }
});

// Load friends from current user object
function loadFriends() {
  // Friends are already in the currentUser object from login
  if (currentUser) {
    friends = currentUser.friends || [];
    renderFriendsList();
  }
}

// Update current user data
async function refreshUserData() {
  try {
    debug(`Refreshing user data for ${currentUser.username} (${currentUser.id})`);
    const response = await fetch(`/api/users/${currentUser.id}`);
    const data = await response.json();
    
    if (data.success) {
      const previousFriends = friends.length;
      currentUser = data.user;
      localStorage.setItem('bubbly_current_user', JSON.stringify(currentUser));
      friends = currentUser.friends || [];
      
      debug(`User data refreshed. Friends: ${previousFriends} -> ${friends.length}`);
      if (friends.length > previousFriends) {
        debug(`New friends found!`);
      }
      
      renderFriendsList();
      return true;
    } else {
      debug(`Failed to refresh user data: ${data.error}`);
      return false;
    }
  } catch (error) {
    console.error('Error refreshing user data:', error);
    return false;
  }
}

// Add new friend
async function addFriend(input) {
  if (!input) return;
  
  try {
    debug(`Attempting to add friend with identifier: ${input}`);
    
    // Call server API to add friend
    const response = await fetch('/api/users/add-friend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        userId: currentUser.id, 
        friendIdentifier: input 
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      console.error('Error adding friend:', data);
      alert(`Could not add friend: ${data.error}`);
      return;
    }
    
    // Update current user with new friend list
    currentUser = data.user;
    localStorage.setItem('bubbly_current_user', JSON.stringify(currentUser));
    
    // Update friends list
    friends = currentUser.friends || [];
    renderFriendsList();
    
    // Find the new friend
    const newFriend = friends.find(f => f.username === data.friendUsername);
    
    if (newFriend) {
      // Alert successful add
      alert(`${newFriend.username} was added to your friends list!`);
      
      // Switch to chat with new friend
      joinPrivateRoom(newFriend);
    } else {
      // Refresh the page to ensure everything is up to date
      window.location.reload();
    }
    
  } catch (error) {
    console.error('Error adding friend:', error);
    alert(`An error occurred: ${error.message}`);
  }
}

// Update friend's preview text with latest message
function updateFriendPreview(friendId, text) {
  const friendIndex = friends.findIndex(f => f.id === friendId);
  if (friendIndex >= 0) {
    friends[friendIndex].preview = text;
    // Update UI only, no need to save to server for preview text
    renderFriendsList();
  }
}

// Render friends list in sidebar
function renderFriendsList() {
  // Clear all existing entries
  friendsList.innerHTML = '';
  
  // Add friends from our array
  friends.forEach(friend => {
    const li = document.createElement('li');
    li.dataset.friendId = friend.id;
    li.dataset.friendName = friend.username;
    
    if (currentFriend && currentFriend.id === friend.id) {
      li.classList.add('active');
    }
    
    li.innerHTML = `
      <div class="chat-avatar">
        <img src="${friend.avatar}" alt="${friend.username}" onerror="this.src='./assets/default-avatar.png'">
      </div>
      <div class="chat-info">
        <div class="chat-name">${friend.username}</div>
        <div class="chat-preview">${friend.preview || 'Say hello!'}</div>
      </div>
    `;
    
    li.addEventListener('click', () => {
      joinPrivateRoom(friend);
    });
    
    friendsList.appendChild(li);
  });
}

// Join private room with friend
function joinPrivateRoom(friend) {
  debug(`Joining private room with friend: ${friend.username} (${friend.id})`);
  
  // Remove active class from all chat items
  document.querySelectorAll('.chat-list li').forEach(item => {
    item.classList.remove('active');
  });
  
  // Add active class to selected friend - using more reliable method
  const friendElement = Array.from(friendsList.children).find(
    li => li.dataset.friendId === friend.id
  );
  
  if (friendElement) {
    friendElement.classList.add('active');
  }
  
  // Update chat header
  chatHeader.innerHTML = `
    <div class="avatar">
      <img src="${friend.avatar}" alt="${friend.username}">
    </div>
    <div class="chat-name">${friend.username}</div>
  `;
  
  // Clear chat window
  chatWindow.innerHTML = '';
  
  // Leave current room if any
  if (currentRoom && currentRoom !== 'general') {
    debug(`Leaving current room: ${currentRoom}`);
    socket.emit('leaveRoom', { room: currentRoom });
  }
  
  // Create a sorted room ID to ensure both users end up in the same room
  // This means room ID is the same regardless of who initiates the chat
  const ids = [myId, friend.id].sort();
  currentRoom = `private_${ids[0]}_${ids[1]}`;
  currentFriend = friend;
  
  debug(`Joining new room: ${currentRoom}`);
  
  // First check if socket is connected
  if (!socket.connected) {
    debug('Socket not connected! Reconnecting...');
    socket.connect();
  }
  
  // Join the new room
  socket.emit('joinRoom', { 
    room: currentRoom, 
    userId: myId, 
    username: currentUser.username 
  });
  
  // Load chat history
  loadChatHistory(currentRoom)
    .then(historyLoaded => {
      // If no history was loaded, display welcome message
      if (!historyLoaded && chatWindow.children.length === 0) {
        chatWindow.innerHTML = `
          <div class="message bianca">
            You are now chatting with ${friend.username}
          </div>
        `;
      }
    });
}

// Chat messages are now saved on the server
// We don't need this function anymore

// Load chat history from server
async function loadChatHistory(room) {
  try {
    debug(`Loading chat history for room: ${room}`);
    
    // First try to load from server
    const response = await fetch(`/api/chat/${room}`);
    const data = await response.json();
    
    if (data.success && data.history && data.history.length > 0) {
      debug(`Received ${data.history.length} messages from history`);
      chatWindow.innerHTML = ''; // Clear welcome message
      
      // Sort messages by timestamp
      const chatHistory = data.history.sort((a, b) => a.timestamp - b.timestamp);
      
      chatHistory.forEach(msg => {
        if (msg.type === 'text') {
          renderMessage({
            sender: msg.sender,
            text: msg.text,
            isOwn: msg.sender === myId,
            timestamp: msg.timestamp
          });
        } else if (msg.type === 'location') {
          renderLocation({
            sender: msg.sender,
            url: msg.url,
            isOwn: msg.sender === myId,
            timestamp: msg.timestamp
          });
        }
      });
      
      // Scroll to bottom
      chatWindow.scrollTop = chatWindow.scrollHeight;
      debug('Chat history loaded and displayed');
      return true;
    } else {
      debug(`No chat history found for room ${room}`);
      return false;
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
    debug(`Error loading chat history: ${error.message}`);
    showNotification('Failed to load chat history. Please try again.');
    return false;
  }
}

// Socket event to receive chat history
socket.on('chatHistory', function({ room, history }) {
  if (room === currentRoom && history && history.length > 0) {
    chatWindow.innerHTML = ''; // Clear welcome message
    
    // Sort messages by timestamp
    history.sort((a, b) => a.timestamp - b.timestamp);
    
    history.forEach(msg => {
      if (msg.type === 'text') {
        renderMessage({
          sender: msg.sender,
          text: msg.text,
          isOwn: msg.sender === myId
        });
      } else if (msg.type === 'location') {
        renderLocation({
          sender: msg.sender,
          url: msg.url,
          isOwn: msg.sender === myId
        });
      }
    });
    
    // Scroll to bottom
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
});

// Event listener for add friend button
addFriendBtn.addEventListener('click', async () => {
  const friendIdentifier = friendNameInput.value.trim();
  if (!friendIdentifier) return;
  
  // Disable button during operation
  addFriendBtn.disabled = true;
  addFriendBtn.textContent = 'Adding...';
  
  try {
    await addFriend(friendIdentifier);
  } catch (error) {
    console.error('Error in add friend handler:', error);
    showNotification(`Failed to add friend: ${error.message}`);
  } finally {
    // Re-enable button
    addFriendBtn.disabled = false;
    addFriendBtn.textContent = 'Add Friend';
    friendNameInput.value = '';
  }
});

// Handle friend added notification
socket.on('friendAdded', function({ addedByUserId, addedByUsername, message }) {
  // Show notification
  showNotification(message);
  
  console.log(`Friend notification received: ${message}`);
  
  // Play sound if supported
  try {
    const notificationSound = new Audio('/assets/notification.mp3');
    notificationSound.play();
  } catch (e) {
    console.log('Notification sound not supported');
  }
  
  // Refresh user data to get the updated friend list
  refreshUserData().then(() => {
    // If we have no active chat, select this new friend
    if (!currentFriend) {
      const newFriend = friends.find(f => f.id === addedByUserId);
      if (newFriend) {
        joinPrivateRoom(newFriend);
      }
    }
  });
});

// Set up periodic refresh of user data to catch new friends
setInterval(() => {
  if (currentUser) {
    refreshUserData();
  }
}, 30000); // Every 30 seconds

// Only check connection health if disconnected for a while
let connectionCheckTimer = null;

// Function to check connection only when needed
function setupConnectionCheck() {
  // Clear any existing timer
  if (connectionCheckTimer) {
    clearInterval(connectionCheckTimer);
  }
  
  // Start a new check timer only if we're currently disconnected
  if (!socket.connected && currentUser) {
    connectionCheckTimer = setInterval(() => {
      debug('Connection check - trying to reconnect...');
      
      if (!socket.connected) {
        socket.connect();
      } else {
        // If we're connected, stop the timer
        clearInterval(connectionCheckTimer);
        connectionCheckTimer = null;
      }
    }, 5000); // Check every 5 seconds when disconnected
  }
}

// Set up check when disconnected
socket.on('disconnect', setupConnectionCheck);

// Check for common issues and try to fix them
function diagnoseAndFix() {
  console.log('Starting diagnosis...');
  
  try {
    // Check for user data in localStorage
    const storedUser = localStorage.getItem('bubbly_current_user');
    if (!storedUser) {
      console.error('No user data in localStorage');
      return false;
    }
    
    try {
      // Verify user data format
      const userData = JSON.parse(storedUser);
      if (!userData || !userData.id || !userData.username) {
        console.error('Invalid user data format:', userData);
        return false;
      }
      
      // Set global variables if they're not set
      if (!currentUser) {
        console.warn('currentUser not set, fixing...');
        currentUser = userData;
      }
      
      if (!myId) {
        console.warn('myId not set, fixing...');
        myId = userData.id;
      }
    } catch (e) {
      console.error('Error parsing user data:', e);
      return false;
    }
    
    // Check DOM elements
    const elementsToCheck = [
      { name: 'sidebar', selector: '.sidebar' },
      { name: 'sidebarHeader', selector: '.sidebar h2' },
      { name: 'chatHeader', selector: '.chat-header' },
      { name: 'chatWindow', selector: '#chat-window' },
      { name: 'messageForm', selector: '#message-form' },
      { name: 'messageInput', selector: '#message-input' },
      { name: 'friendsList', selector: '#friends-list' },
      { name: 'addFriendBtn', selector: '#add-friend-btn' },
      { name: 'friendNameInput', selector: '#friend-name-input' }
    ];
    
    let allElementsFound = true;
    elementsToCheck.forEach(item => {
      const element = document.querySelector(item.selector);
      if (!element) {
        console.error(`${item.name} not found (selector: ${item.selector})`);
        allElementsFound = false;
      }
    });
    
    if (!allElementsFound) {
      console.error('Some UI elements are missing. DOM may be incorrect.');
      return false;
    }
    
    // Check for user info display
    const userInfo = document.querySelector('.user-info');
    if (!userInfo) {
      console.warn('User info display not found, adding it...');
      
      const sidebarHeader = document.querySelector('.sidebar h2');
      if (sidebarHeader && currentUser) {
        const usernameDisplay = document.createElement('div');
        usernameDisplay.classList.add('user-info');
        usernameDisplay.innerHTML = `
          <div class="user-details">
            <span class="username">${currentUser.username}</span>
            <span class="user-id">ID: ${currentUser.id}</span>
          </div>
          <button id="logout-btn">Logout</button>
        `;
        sidebarHeader.insertAdjacentElement('afterend', usernameDisplay);
        
        // Add logout functionality
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('bubbly_current_user');
            window.location.href = '/login';
          });
        }
        
        console.log('User info display added');
      }
    }
    
    // Reload friends list if empty
    if (friends.length === 0 && currentUser && currentUser.friends && currentUser.friends.length > 0) {
      console.warn('Friends list is empty but user has friends, reloading...');
      friends = currentUser.friends;
      renderFriendsList();
    }
    
    // Check socket connection
    if (!socket.connected) {
      console.warn('Socket not connected, reconnecting...');
      socket.connect();
      
      // Re-register with socket server
      if (currentUser) {
        socket.emit('registerUser', { 
          userId: currentUser.id, 
          username: currentUser.username 
        });
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error in diagnosis:', error);
    return false;
  }
}

// Initialize with enhanced debugging
window.addEventListener('load', () => {
  // Check if user is logged in
  const storedUser = localStorage.getItem('bubbly_current_user');
  
  console.log('Initializing chat app, stored user:', storedUser ? 'exists' : 'not found');
  
  if (!storedUser) {
    // Redirect to login if not logged in
    console.log('No stored user, redirecting to login');
    window.location.href = '/login';
    return;
  }
  
  try {
    // Set current user
    currentUser = JSON.parse(storedUser);
    console.log('Current user data:', currentUser);
    
    if (!currentUser || !currentUser.id || !currentUser.username) {
      console.error('Invalid user data in localStorage:', currentUser);
      alert('Your session is invalid. Please login again.');
      localStorage.removeItem('bubbly_current_user');
      window.location.href = '/login';
      return;
    }
    
    myId = currentUser.id;
    console.log(`User ID set to ${myId}`);
    
    // Update header with user info - make this more robust
    const sidebarHeader = document.querySelector('.sidebar h2');
    if (!sidebarHeader) {
      console.error('Could not find sidebar header!');
      alert('UI elements not found. Please refresh the page.');
      return;
    }
    
    // Remove any existing user info to prevent duplicates
    const existingInfo = document.querySelector('.user-info');
    if (existingInfo) {
      existingInfo.remove();
    }
    
    const usernameDisplay = document.createElement('div');
    usernameDisplay.classList.add('user-info');
    usernameDisplay.innerHTML = `
      <div class="user-details">
        <span class="username">${currentUser.username}</span>
        <span class="user-id">ID: ${currentUser.id}</span>
      </div>
      <button id="logout-btn">Logout</button>
    `;
    
    sidebarHeader.insertAdjacentElement('afterend', usernameDisplay);
    console.log('Username display added to sidebar');
    
    // Add logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('bubbly_current_user');
        window.location.href = '/login';
      });
    } else {
      console.error('Logout button not found!');
    }
    
    // Load friends from localStorage
    console.log('Loading friends list');
    loadFriends();
    
    // Display welcome message if no friends
    if (friends.length === 0) {
      console.log('No friends found, showing welcome message');
      chatWindow.innerHTML = `
        <div class="message bianca">
          Welcome to Bubbly, ${currentUser.username}! Add a friend to start chatting.
        </div>
      `;
    } else {
      console.log(`Found ${friends.length} friends`);
    }
    
    // Select first friend by default
    if (friends.length > 0 && !currentFriend) {
      console.log('Selecting first friend by default');
      joinPrivateRoom(friends[0]);
    }
    
    // Verify socket connection
    if (!socket.connected) {
      console.warn('Socket not connected! Trying to connect...');
      socket.connect();
    } else {
      console.log('Socket is connected');
      
      // Re-register with socket server
      socket.emit('registerUser', { 
        userId: myId, 
        username: currentUser.username 
      });
    }
    
  } catch (error) {
    console.error('Error during initialization:', error);
    alert('There was an error initializing the app. Please try refreshing the page.');
  }
  
  // Run the diagnostic check shortly after page load
  setTimeout(() => {
    if (document.readyState === 'complete') {
      console.log('Running diagnostic check...');
      diagnoseAndFix();
    }
  }, 1000); // 1 second delay
});
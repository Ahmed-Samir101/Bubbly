// Socket.io connection
const socket = io();

// DOM Elements
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const chatWindow = document.getElementById('chat-window');
const chatHeader = document.querySelector('.chat-header');
const locationButton = document.getElementById('send-location');
const friendNameInput = document.getElementById('friend-name-input');
const addFriendBtn = document.getElementById('add-friend-btn');
const friendsList = document.getElementById('friends-list');

// Group chat elements
const createGroupBtn = document.getElementById('create-group-btn');
const createGroupModal = document.getElementById('create-group-modal');
const closeGroupModal = document.getElementById('close-group-modal');
const groupNameInput = document.getElementById('group-name');
const friendSelectList = document.getElementById('friend-select-list');
const confirmCreateGroupBtn = document.getElementById('confirm-create-group');
const groupsList = document.getElementById('groups-list');
const friendsTab = document.getElementById('friends-tab');
const groupsTab = document.getElementById('groups-tab');
const friendsContainer = document.getElementById('friends-container');
const groupsContainer = document.getElementById('groups-container');
const groupInfoModal = document.getElementById('group-info-modal');
const closeGroupInfoModal = document.getElementById('close-group-info-modal');
const groupInfoContent = document.getElementById('group-info-content');
const addGroupMemberInput = document.getElementById('add-group-member-input');
const addGroupMemberBtn = document.getElementById('add-group-member-btn');

// Current user and chat state
let currentUser = null;
let currentChatRoom = null;
let currentChatType = null; // 'private' or 'group'
let currentGroupId = null;
let friends = [];
let groups = [];

// Tab switching
friendsTab.addEventListener('click', () => {
    friendsTab.classList.add('active');
    groupsTab.classList.remove('active');
    friendsContainer.style.display = '';
    groupsContainer.style.display = 'none';
});

groupsTab.addEventListener('click', () => {
    groupsTab.classList.add('active');
    friendsTab.classList.remove('active');
    groupsContainer.style.display = '';
    friendsContainer.style.display = 'none';
});

// Check if user is logged in
function checkAuth() {
    const userJSON = localStorage.getItem('bubbly_current_user');
    if (!userJSON) {
        window.location.href = '/login';
        return;
    }
    
    try {
        currentUser = JSON.parse(userJSON);
        if (!currentUser || !currentUser.id || !currentUser.username) {
            console.error('Invalid user data in localStorage:', userJSON);
            localStorage.removeItem('bubbly_current_user');
            window.location.href = '/login';
            return;
        }
        
        // Register user with socket.io
        socket.emit('registerUser', { 
            userId: currentUser.id, 
            username: currentUser.username 
        });
        
        // Update UI with user info
        updateUserInfo();
        
        // Load friends list
        loadFriends();
        
        // Load groups list
        loadGroups();
        
        // Show empty state message in chat window
        showEmptyState();
        
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('bubbly_current_user');
        window.location.href = '/login';
    }
}

// Show empty state message
function showEmptyState() {
    chatHeader.innerHTML = `<div class="chat-title">Welcome to Bubbly Chat</div>`;
    chatWindow.innerHTML = `
        <div class="empty-state">
            <h3>Start chatting!</h3>
            <p>Select a friend from the sidebar or create a group chat.</p>
        </div>
    `;
}

// Update UI with user info
function updateUserInfo() {
    const userInfoHTML = `
        <div class="user-info">
            <div class="username">${currentUser.username}</div>
            <div class="user-id">ID: ${currentUser.id}</div>
            <button id="logout-btn">Logout</button>
        </div>
    `;
    
    // Insert before the tabs
    const tabs = document.querySelector('.tabs');
    const userInfoDiv = document.createElement('div');
    userInfoDiv.innerHTML = userInfoHTML;
    tabs.parentNode.insertBefore(userInfoDiv.firstElementChild, tabs);
    
    // Add logout functionality
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('bubbly_current_user');
        window.location.href = '/login';
    });
}

// Load friends list
async function loadFriends() {
    try {
        const response = await fetch(`/api/users/${currentUser.id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.user && data.user.friends) {
            // Check if the friends list actually changed
            const oldFriendsIds = friends.map(f => f.id).sort().join(',');
            const newFriendsIds = data.user.friends.map(f => f.id).sort().join(',');
            
            if (oldFriendsIds !== newFriendsIds) {
                console.log("Friends list changed, updating UI");
                friends = data.user.friends;
                updateFriendsList();
            }
        } else {
            console.error('Failed to load friends:', data);
        }
    } catch (error) {
        console.error('Error loading friends:', error);
    }
}

// Load groups list
async function loadGroups() {
    try {
        const response = await fetch(`/api/users/${currentUser.id}/groups`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.groups) {
            // Check if the groups list actually changed
            const oldGroupIds = groups.map(g => g.id).sort().join(',');
            const newGroupIds = data.groups.map(g => g.id).sort().join(',');
            
            if (oldGroupIds !== newGroupIds) {
                console.log("Groups list changed, updating UI");
                groups = data.groups;
                updateGroupsList();
            }
        } else {
            console.error('Failed to load groups:', data);
        }
    } catch (error) {
        console.error('Error loading groups:', error);
    }
}

// Update friends list in UI
function updateFriendsList() {
    friendsList.innerHTML = '';
    
    if (friends.length === 0) {
        friendsList.innerHTML = `
            <li class="empty-state">
                No friends yet. Add friends using the form above.
            </li>
        `;
        return;
    }
    
    friends.forEach(friend => {
        const listItem = document.createElement('li');
        listItem.className = 'friend-item';
        listItem.innerHTML = `
            <div class="friend-avatar">👤</div>
            <div class="friend-info">
                <div class="friend-name">${friend.username}</div>
                <div class="friend-preview">${friend.preview || 'Click to start chatting'}</div>
            </div>
        `;
        listItem.addEventListener('click', () => startPrivateChat(friend));
        friendsList.appendChild(listItem);
    });
}

// Update groups list in UI
function updateGroupsList() {
    groupsList.innerHTML = '';
    
    if (groups.length === 0) {
        groupsList.innerHTML = `
            <li class="empty-state">
                No groups yet. Create a group using the button above.
            </li>
        `;
        return;
    }
    
    groups.forEach(group => {
        const listItem = document.createElement('li');
        listItem.className = 'group-list-item';
        listItem.innerHTML = `
            <div class="group-icon">${group.name.charAt(0).toUpperCase()}</div>
            <div class="group-info">
                <div class="group-name">${group.name}</div>
                <div class="group-member-count">${group.members.length} members</div>
            </div>
        `;
        listItem.addEventListener('click', () => startGroupChat(group));
        groupsList.appendChild(listItem);
    });
}

// Start private chat with a friend
// CRITICAL FIX: Improve the way we join rooms
function startPrivateChat(friend) {
    // Leave current room if any
    if (currentChatRoom) {
        console.log(`Leaving room: ${currentChatRoom}`);
        socket.emit('leaveRoom', { room: currentChatRoom });
    }
    
    // Create room ID (sorted user IDs to ensure consistency)
    const userIds = [currentUser.id, friend.id].sort();
    const room = `private_${userIds[0]}_${userIds[1]}`;
    currentChatRoom = room;
    currentChatType = 'private';
    currentGroupId = null;
    
    console.log(`Starting private chat in room: ${room}`);
    
    // Update chat header
    chatHeader.innerHTML = `
        <div class="chat-header">
            <div class="chat-title">${friend.username} </div>
        </div>
    `;
    
    // Force reconnect to ensure clean room joining
    socket.disconnect().connect();
    
    // Join room with a slight delay to ensure reconnection is complete
    setTimeout(() => {
        socket.emit('joinRoom', { 
            room, 
            userId: currentUser.id,
            username: currentUser.username
        });
        console.log(`Joined room: ${room}`);
    }, 300);
    
    // Clear chat window and show loading
    chatWindow.innerHTML = '<div class="notification">Loading messages...</div>';
    
    // Enable message input
    messageInput.disabled = false;
    messageInput.placeholder = "Type a message...";
}

// Start group chat
function startGroupChat(group) {
    // Leave current room if any
    if (currentChatRoom) {
        console.log(`Leaving room: ${currentChatRoom}`);
        socket.emit('leaveRoom', { room: currentChatRoom });
    }
    
    // Create room ID
    const room = `group_${group.id}`;
    currentChatRoom = room;
    currentChatType = 'group';
    currentGroupId = group.id;
    
    // Update chat header with group info and actions
    chatHeader.innerHTML = `
        <div class="group-header">
            <div class="group-title">${group.name}</div>
            <div class="group-members">${group.members.length} members</div>
            <div class="group-actions">
                <button id="view-group-info">Info</button>
            </div>
        </div>
    `;
    
    // Add event listener for group info button
    document.getElementById('view-group-info').addEventListener('click', () => showGroupInfo(group));
    
    // Force reconnect to ensure clean room joining
    socket.disconnect().connect();
    
    // Join group room with a slight delay to ensure reconnection is complete
    setTimeout(() => {
        socket.emit('joinGroupRoom', { 
            groupId: group.id, 
            userId: currentUser.id,
            username: currentUser.username
        });
        console.log(`Joined group room: ${room}`);
    }, 300);
    
    // Clear chat window and show loading
    chatWindow.innerHTML = '<div class="notification">Loading messages...</div>';
    
    // Enable message input
    messageInput.disabled = false;
    messageInput.placeholder = "Type a message to the group...";
}

// Show group info modal
function showGroupInfo(group) {
    // Get fresh data for the group
    fetch(`/api/groups/${group.id}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const group = data.group;
                
                // Create HTML for group members
                let membersHTML = '<ul class="group-members-list">';
                
                // Fetch member details
                const memberPromises = group.members.map(memberId => 
                    fetch(`/api/users/${memberId}`)
                        .then(res => res.json())
                        .then(userData => userData.success ? userData.user : null)
                );
                
                Promise.all(memberPromises)
                    .then(members => {
                        members.forEach(member => {
                            if (member) {
                                membersHTML += `<li>${member.username} ${member.id === group.creatorId ? '(Creator)' : ''}</li>`;
                            }
                        });
                        
                        membersHTML += '</ul>';
                        
                        // Display group info
                        groupInfoContent.innerHTML = `
                            <div class="group-info-name"><strong>Group Name:</strong> ${group.name}</div>
                            <div class="group-info-created"><strong>Created:</strong> ${new Date(group.createdAt).toLocaleString()}</div>
                            <div class="group-info-members">
                                <h4>Members:</h4>
                                ${membersHTML}
                            </div>
                        `;
                        
                        // Store current group ID for adding members
                        addGroupMemberBtn.dataset.groupId = group.id;
                        
                        // Show the modal
                        groupInfoModal.style.display = 'block';
                    });
            }
        })
        .catch(err => {
            console.error('Error fetching group info:', err);
        });
}

// Create new group
createGroupBtn.addEventListener('click', () => {
    // Check if we have friends to add to a group
    if (friends.length === 0) {
        alert('You need to add friends before creating a group.');
        return;
    }
    
    // Populate friend select list
    friendSelectList.innerHTML = '';
    friends.forEach(friend => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'friend-checkbox';
        checkboxDiv.innerHTML = `
            <input type="checkbox" id="friend-${friend.id}" value="${friend.id}">
            <label for="friend-${friend.id}">${friend.username}</label>
        `;
        friendSelectList.appendChild(checkboxDiv);
    });
    
    // Show modal
    createGroupModal.style.display = 'block';
    groupNameInput.focus();
});

// Close create group modal
closeGroupModal.addEventListener('click', () => {
    createGroupModal.style.display = 'none';
});

// Close group info modal
closeGroupInfoModal.addEventListener('click', () => {
    groupInfoModal.style.display = 'none';
});

// Confirm create group
confirmCreateGroupBtn.addEventListener('click', async () => {
    const groupName = groupNameInput.value.trim();
    if (!groupName) {
        alert('Please enter a group name');
        return;
    }
    
    // Get selected friends
    const selectedFriends = [];
    document.querySelectorAll('#friend-select-list input[type="checkbox"]:checked').forEach(checkbox => {
        selectedFriends.push(checkbox.value);
    });
    
    if (selectedFriends.length === 0) {
        alert('Please select at least one friend to add to the group');
        return;
    }
    
    // Disable button while creating
    confirmCreateGroupBtn.disabled = true;
    confirmCreateGroupBtn.textContent = 'Creating...';
    
    // Create group
    try {
        const response = await fetch('/api/groups/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: groupName,
                creatorId: currentUser.id,
                members: selectedFriends
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Add to groups list
            groups.push(data.group);
            updateGroupsList();
            
            // Close modal
            createGroupModal.style.display = 'none';
            
            // Reset form
            groupNameInput.value = '';
            
            // Start chat with this group
            startGroupChat(data.group);
            
            // Switch to groups tab
            groupsTab.click();
        } else {
            alert(`Failed to create group: ${data.error}`);
        }
    } catch (error) {
        console.error('Error creating group:', error);
        alert('Failed to create group: ' + error.message);
    } finally {
        // Re-enable button
        confirmCreateGroupBtn.disabled = false;
        confirmCreateGroupBtn.textContent = 'Create Group';
    }
});

// Add member to group
addGroupMemberBtn.addEventListener('click', async () => {
    const memberId = addGroupMemberInput.value.trim();
    const groupId = addGroupMemberBtn.dataset.groupId;
    
    if (!memberId || !groupId) {
        alert('Please enter a valid username or ID');
        return;
    }
    
    // Disable button
    addGroupMemberBtn.disabled = true;
    addGroupMemberBtn.textContent = 'Adding...';
    
    try {
        const response = await fetch(`/api/groups/${groupId}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                memberId,
                addedBy: currentUser.id
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update group in local list
            const groupIndex = groups.findIndex(g => g.id === groupId);
            if (groupIndex !== -1) {
                groups[groupIndex] = data.group;
            }
            
            // Refresh group info modal
            showGroupInfo(data.group);
            
            // Clear input
            addGroupMemberInput.value = '';
            
            alert('Member added successfully');
        } else {
            alert(`Failed to add member: ${data.error}`);
        }
    } catch (error) {
        console.error('Error adding member:', error);
        alert('Failed to add member: ' + error.message);
    } finally {
        // Re-enable button
        addGroupMemberBtn.disabled = false;
        addGroupMemberBtn.textContent = 'Add';
    }
});

// Handle adding a friend
addFriendBtn.addEventListener('click', async function() {
    const friendIdentifier = friendNameInput.value.trim();
    if (!friendIdentifier) {
        alert('Please enter a username or user ID');
        return;
    }
    if (friendIdentifier === currentUser.username || friendIdentifier === currentUser.id) {
        alert('You cannot add yourself as a friend.');
        return;
    }
    addFriendBtn.disabled = true;
    addFriendBtn.textContent = 'Adding...';
    try {
        const response = await fetch('/api/users/add-friend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                friendIdentifier
            })
        });
        const data = await response.json();
        if (data.success) {
            alert(`You are now friends with ${data.friendUsername}!`);
            friendNameInput.value = '';
            currentUser = data.user;
            localStorage.setItem('bubbly_current_user', JSON.stringify(currentUser));
            loadFriends();
        } else {
            alert(`Failed to add friend: ${data.error}`);
        }
    } catch (error) {
        console.error('Error adding friend:', error);
        alert('Failed to add friend: ' + error.message);
    } finally {
        addFriendBtn.disabled = false;
        addFriendBtn.textContent = 'Add Friend';
    }
});

// Handle form submission
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentChatRoom) {
        alert('Please select a chat first');
        return;
    }
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Create message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Show sending indicator
    const sendingIndicator = document.createElement('div');
    sendingIndicator.className = 'message-sending-indicator';
    sendingIndicator.id = `sending-${messageId}`;
    sendingIndicator.textContent = 'Sending...';
    chatWindow.appendChild(sendingIndicator);
    
    // Scroll to bottom
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    // Clear input
    messageInput.value = '';
    messageInput.focus();
    
    try {
        // Add debug logging
        console.log(`Sending message to room: ${currentChatRoom}`, messageId);
        
        // Emit message based on chat type
        if (currentChatType === 'group') {
            socket.emit('groupChatMessage', {
                text: message,
                sender: currentUser.id,
                senderUsername: currentUser.username,
                groupId: currentGroupId,
                messageId
            }, (response) => {
                // Log the acknowledgment for debugging
                console.log('Group message acknowledgment:', response);
                
                // Remove sending indicator
                const indicator = document.getElementById(`sending-${messageId}`);
                if (indicator) indicator.remove();
                
                if (!response.success) {
                    console.error('Failed to send message:', response.error);
                    displayErrorMessage('Failed to deliver message');
                }
            });
        } else {
            // Regular private chat message
            socket.emit('chatMessage', {
                text: message,
                sender: currentUser.id,
                senderUsername: currentUser.username,
                room: currentChatRoom,
                messageId
            }, (response) => {
                // Log the acknowledgment for debugging
                console.log('Private message acknowledgment:', response);
                
                // Remove sending indicator
                const indicator = document.getElementById(`sending-${messageId}`);
                if (indicator) indicator.remove();
                
                if (!response.success) {
                    console.error('Failed to send message:', response.error);
                    displayErrorMessage('Failed to deliver message');
                }
            });
        }
    } catch (error) {
        console.error('Error sending message:', error);
        displayErrorMessage('Failed to send message');
        
        // Remove sending indicator
        const indicator = document.getElementById(`sending-${messageId}`);
        if (indicator) indicator.remove();
    }
});

// Location button handler
locationButton.addEventListener('click', () => {
    if (!currentChatRoom) {
        alert('Please select a chat first');
        return;
    }
    
    if (!navigator.geolocation) {
        return alert('Geolocation is not supported by your browser');
    }
    
    locationButton.disabled = true;
    locationButton.textContent = 'Sending...';
    
    navigator.geolocation.getCurrentPosition((position) => {
        const url = `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
        
        socket.emit('sendLocation', {
            url,
            sender: currentUser.id,
            senderUsername: currentUser.username,
            room: currentChatRoom,
            timestamp: new Date().getTime(),
        });
        
        locationButton.disabled = false;
        locationButton.textContent = '📍 Location';
    }, (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location');
        locationButton.disabled = false;
        locationButton.textContent = '📍 Location';
    });
});

// Handle incoming messages
socket.on('chatMessage', (message) => {
    console.log('Received message:', message);
    
    // Only process messages for the current room
    if (message.room !== currentChatRoom) {
        console.log(`Message room (${message.room}) doesn't match current room (${currentChatRoom})`);
        return;
    }

    // Remove any sending indicators for this message
    if (message.messageId) {
        const indicator = document.getElementById(`sending-${message.messageId}`);
        if (indicator) {
            console.log(`Removing sending indicator for ${message.messageId}`);
            indicator.remove();
        }
    }

    // Check for duplicate messages (might happen with two-step emission)
    const existingMessage = document.getElementById(`message-${message.messageId}`);
    if (existingMessage) {
        console.log(`Message ${message.messageId} already exists, not duplicating`);
        return;
    }

    // Always display the message (even if not sent by current user)
    console.log('Displaying message in UI:', message.text);
    displayMessage(message);
});

// Handle incoming location messages
socket.on('locationMessage', (message) => {
    // Only process messages for the current room
    if (message.room !== currentChatRoom) return;

    displayLocationMessage(message);
});

// Handle chat history
socket.on('chatHistory', ({ room, history }) => {
    // Only process history for the current room
    if (room !== currentChatRoom) return;
    
    // Clear chat window
    chatWindow.innerHTML = '';
    
    if (history.length === 0) {
        chatWindow.innerHTML = `
            <div class="notification">
                No messages yet. Send the first message to start the conversation!
            </div>
        `;
    } else {
        // Display each message
        history.forEach(msg => {
            if (msg.type === 'location') {
                displayLocationMessage(msg);
            } else {
                displayMessage(msg);
            }
        });
    }
    
    // Scroll to bottom
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

// Update socket.on handlers for better auto-refresh functionality

// Handle group created notification - improved to automatically switch to groups tab
socket.on('groupCreated', ({ group }) => {
    // Add group to our local list
    groups.push(group);
    updateGroupsList();
    
    // Display notification
    displaySystemNotification(`You were added to a new group: ${group.name}`);
    
    // Switch to groups tab automatically to show the new group
    if (friendsTab.classList.contains('active')) {
        setTimeout(() => {
            groupsTab.click(); // Automatically switch to groups tab
        }, 1000);
    }
});

// Handle added to group notification - improved to automatically switch to groups tab
socket.on('addedToGroup', ({ group, addedBy }) => {
    // Add group to our list
    groups.push(group);
    updateGroupsList();
    
    // Display notification
    displaySystemNotification(`${addedBy} added you to the group: ${group.name}`);
    
    // Switch to groups tab automatically to show the new group
    if (friendsTab.classList.contains('active')) {
        setTimeout(() => {
            groupsTab.click(); // Automatically switch to groups tab
        }, 1000);
    }
});

// Handle member added to group notification - with improved group data refresh
socket.on('memberAddedToGroup', ({ group, newMemberId, newMemberUsername }) => {
    // Update group in local list
    const groupIndex = groups.findIndex(g => g.id === group.id);
    if (groupIndex !== -1) {
        groups[groupIndex] = group;
        updateGroupsList();
    }
    
    // If currently in this group chat, display notification
    if (currentChatType === 'group' && currentGroupId === group.id) {
        displaySystemNotification(`${newMemberUsername} was added to the group`);
    }
});

// Handle friend added notification - with improved refresh
socket.on('friendAdded', ({ addedByUserId, addedByUsername, message }) => {
    displaySystemNotification(message);
    
    // Reload friends list immediately
    loadFriends();
});

// Add a periodic refresh for friends and groups lists
function setupAutoRefresh() {
    // Refresh every 30 seconds (adjust as needed)
    setInterval(() => {
        if (currentUser) {
            loadFriends();
            loadGroups();
        }
    }, 30000); // 30 seconds
}

// Enhanced loadFriends and loadGroups functions with better error handling
async function loadFriends() {
    try {
        const response = await fetch(`/api/users/${currentUser.id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.user && data.user.friends) {
            // Check if the friends list actually changed
            const oldFriendsIds = friends.map(f => f.id).sort().join(',');
            const newFriendsIds = data.user.friends.map(f => f.id).sort().join(',');
            
            if (oldFriendsIds !== newFriendsIds) {
                console.log("Friends list changed, updating UI");
                friends = data.user.friends;
                updateFriendsList();
            }
        } else {
            console.error('Failed to load friends:', data);
        }
    } catch (error) {
        console.error('Error loading friends:', error);
    }
}

async function loadGroups() {
    try {
        const response = await fetch(`/api/users/${currentUser.id}/groups`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.groups) {
            // Check if the groups list actually changed
            const oldGroupIds = groups.map(g => g.id).sort().join(',');
            const newGroupIds = data.groups.map(g => g.id).sort().join(',');
            
            if (oldGroupIds !== newGroupIds) {
                console.log("Groups list changed, updating UI");
                groups = data.groups;
                updateGroupsList();
            }
        } else {
            console.error('Failed to load groups:', data);
        }
    } catch (error) {
        console.error('Error loading groups:', error);
    }
}

// Initialize when page loads - with auto-refresh setup
window.addEventListener('load', () => {
    checkAuth();
    setupAutoRefresh();
});

// Initially disable message input until a chat is selected
messageInput.disabled = true;
messageInput.placeholder = "Select a chat to start messaging";

// Add reconnection handling
socket.on('connect', () => {
    console.log('Socket connected with ID:', socket.id);
    
    // If we were in a room before, rejoin it
    if (currentUser && currentChatRoom) {
        if (currentChatType === 'group' && currentGroupId) {
            console.log(`Reconnecting to group room: ${currentChatRoom}`);
            socket.emit('joinGroupRoom', { 
                groupId: currentGroupId, 
                userId: currentUser.id,
                username: currentUser.username
            });
        } else {
            console.log(`Reconnecting to room: ${currentChatRoom}`);
            socket.emit('joinRoom', { 
                room: currentChatRoom, 
                userId: currentUser.id,
                username: currentUser.username
            });
        }
    }
});

socket.on('disconnect', () => {
    console.log('Socket disconnected');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    displayErrorMessage('Connection lost. Attempting to reconnect...');
});
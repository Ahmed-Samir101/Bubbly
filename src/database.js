import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the users database file
const usersDbPath = path.join(__dirname, '../data/users.json');
const chatHistoryPath = path.join(__dirname, '../data/chatHistory');
const groupsDbPath = path.join(__dirname, '../data/groups.json');

// In-memory cache
let usersCache = null;
let groupsCache = null;
const chatHistoryCache = {};

// Ensure directories exist
function ensureDirectoriesExist() {
  const dataDir = path.join(__dirname, '../data');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  
  if (!fs.existsSync(chatHistoryPath)) {
    fs.mkdirSync(chatHistoryPath);
  }
  
  if (!fs.existsSync(usersDbPath)) {
    fs.writeFileSync(usersDbPath, JSON.stringify([]));
  }
  
  if (!fs.existsSync(groupsDbPath)) {
    fs.writeFileSync(groupsDbPath, JSON.stringify([]));
  }
}

// Load users from the JSON file
function loadUsers() {
  try {
    ensureDirectoriesExist();
    if (usersCache) return usersCache;
    
    const data = fs.readFileSync(usersDbPath, 'utf8');
    usersCache = JSON.parse(data);
    return usersCache;
  } catch (error) {
    console.error('Error loading users database:', error);
    usersCache = [];
    return usersCache;
  }
}

// Save users to the JSON file
function saveUsers(users) {
  try {
    ensureDirectoriesExist();
    fs.writeFileSync(usersDbPath, JSON.stringify(users, null, 2));
    usersCache = users;
    return true;
  } catch (error) {
    console.error('Error saving users database:', error);
    return false;
  }
}

// Load groups from the JSON file
function loadGroups() {
  try {
    ensureDirectoriesExist();
    if (groupsCache) return groupsCache;
    
    const data = fs.readFileSync(groupsDbPath, 'utf8');
    groupsCache = JSON.parse(data);
    return groupsCache;
  } catch (error) {
    console.error('Error loading groups database:', error);
    groupsCache = [];
    return groupsCache;
  }
}

// Save groups to the JSON file
function saveGroups(groups) {
  try {
    ensureDirectoriesExist();
    fs.writeFileSync(groupsDbPath, JSON.stringify(groups, null, 2));
    groupsCache = groups;
    return true;
  } catch (error) {
    console.error('Error saving groups database:', error);
    return false;
  }
}

// Find a user by ID
function findUserById(id) {
  const users = loadUsers();
  return users.find(user => user.id === id);
}

// Find a user by username
function findUserByUsername(username) {
  const users = loadUsers();
  return users.find(user => user.username === username);
}

// Get all users
function getAllUsers() {
  return loadUsers();
}

// Add a new user
function addUser(user) {
  const users = loadUsers();
  if (users.some(u => u.username === user.username)) {
    return { success: false, error: 'Username already exists' };
  }
  
  users.push(user);
  if (saveUsers(users)) {
    return { success: true, user };
  } else {
    return { success: false, error: 'Failed to save user' };
  }
}

// Update a user
function updateUser(user) {
  const users = loadUsers();
  const index = users.findIndex(u => u.id === user.id);
  
  if (index === -1) {
    return { success: false, error: 'User not found' };
  }
  
  users[index] = { ...users[index], ...user };
  if (saveUsers(users)) {
    return { success: true, user: users[index] };
  } else {
    return { success: false, error: 'Failed to update user' };
  }
}

// Add friend relationship
function addFriendship(userId, friendId) {
  const users = loadUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  const friendIndex = users.findIndex(u => u.id === friendId);
  
  console.log(`Adding friendship between ${userId} and ${friendId}`);
  console.log(`User index: ${userIndex}, Friend index: ${friendIndex}`);
  
  if (userIndex === -1 || friendIndex === -1) {
    return { 
      success: false, 
      error: 'User or friend not found',
      details: {
        userFound: userIndex !== -1,
        friendFound: friendIndex !== -1,
        userId,
        friendId,
        userIds: users.map(u => u.id) // For debugging
      }
    };
  }
  
  // Initialize friends array if it doesn't exist
  if (!users[userIndex].friends) {
    users[userIndex].friends = [];
  }
  
  if (!users[friendIndex].friends) {
    users[friendIndex].friends = [];
  }
  
  // Check if already friends
  if (users[userIndex].friends.some(f => f.id === friendId)) {
    return { success: false, error: 'Already friends' };
  }
  
  // Add friend to user
  users[userIndex].friends.push({
    id: users[friendIndex].id,
    username: users[friendIndex].username,
    avatar: './assets/avatar.png',
    preview: 'Say hello!'
  });
  
  // Add user to friend
  users[friendIndex].friends.push({
    id: users[userIndex].id,
    username: users[userIndex].username,
    avatar: './assets/avatar.png',
    preview: 'Say hello!'
  });
  
  console.log(`User ${users[userIndex].username} now has ${users[userIndex].friends.length} friends`);
  console.log(`User ${users[friendIndex].username} now has ${users[friendIndex].friends.length} friends`);
  
  if (saveUsers(users)) {
    return { 
      success: true, 
      user: users[userIndex],
      friend: users[friendIndex]
    };
  } else {
    return { success: false, error: 'Failed to save friendship' };
  }
}

// Save chat message
function saveChatMessage(roomId, message) {
  try {
    ensureDirectoriesExist();
    const roomFilePath = path.join(chatHistoryPath, `${roomId}.json`);
    
    // Use cache first if available
    let chatHistory = chatHistoryCache[roomId] || [];
    
    // If not in cache, load from file
    if (!chatHistoryCache[roomId] && fs.existsSync(roomFilePath)) {
      const data = fs.readFileSync(roomFilePath, 'utf8');
      chatHistory = JSON.parse(data);
    }
    
    chatHistory.push(message);
    
    // Keep only last 1000 messages
    if (chatHistory.length > 1000) {
      chatHistory = chatHistory.slice(-1000);
    }
    
    // Update cache
    chatHistoryCache[roomId] = chatHistory;
    
    // Save to file
    fs.writeFileSync(roomFilePath, JSON.stringify(chatHistory, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving chat message for room ${roomId}:`, error);
    return false;
  }
}

// Load chat history
function loadChatHistory(roomId) {
  try {
    ensureDirectoriesExist();
    
    // Use cache if available
    if (chatHistoryCache[roomId]) {
      return chatHistoryCache[roomId];
    }
    
    const roomFilePath = path.join(chatHistoryPath, `${roomId}.json`);
    
    if (!fs.existsSync(roomFilePath)) {
      chatHistoryCache[roomId] = [];
      return [];
    }
    
    const data = fs.readFileSync(roomFilePath, 'utf8');
    chatHistoryCache[roomId] = JSON.parse(data);
    return chatHistoryCache[roomId];
  } catch (error) {
    console.error(`Error loading chat history for room ${roomId}:`, error);
    chatHistoryCache[roomId] = [];
    return [];
  }
}

// Group operations
function createGroup(group) {
  try {
    const groups = loadGroups();
    groups.push(group);
    
    if (saveGroups(groups)) {
      return { success: true, group };
    } else {
      return { success: false, error: 'Failed to save group' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getGroupById(groupId) {
  const groups = loadGroups();
  return groups.find(group => group.id === groupId);
}

function getUserGroups(userId) {
  const groups = loadGroups();
  return groups.filter(group => group.members && group.members.includes(userId));
}

function addGroupMember(groupId, memberId) {
  try {
    const groups = loadGroups();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return { success: false, error: 'Group not found' };
    }
    
    const group = groups[groupIndex];
    
    if (!group.members) {
      group.members = [];
    }
    
    if (group.members.includes(memberId)) {
      return { success: false, error: 'User is already a member of this group' };
    }
    
    // Check if user exists
    const user = findUserById(memberId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    // Add member to group
    group.members.push(memberId);
    
    if (saveGroups(groups)) {
      return { success: true, group };
    } else {
      return { success: false, error: 'Failed to save group' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default {
  findUserById,
  findUserByUsername,
  addUser,
  updateUser,
  getAllUsers,
  addFriendship,
  saveChatMessage,
  loadChatHistory,
  createGroup,
  getGroupById,
  getUserGroups,
  addGroupMember
};
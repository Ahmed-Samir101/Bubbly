import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the users database file
const usersDbPath = path.join(__dirname, '../data/users.json');
const chatHistoryPath = path.join(__dirname, '../data/chatHistory');

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
}

// Load users from the JSON file
function loadUsers() {
  try {
    ensureDirectoriesExist();
    const data = fs.readFileSync(usersDbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading users database:', error);
    return [];
  }
}

// Save users to the JSON file
function saveUsers(users) {
  try {
    ensureDirectoriesExist();
    fs.writeFileSync(usersDbPath, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving users database:', error);
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
    
    let chatHistory = [];
    if (fs.existsSync(roomFilePath)) {
      const data = fs.readFileSync(roomFilePath, 'utf8');
      chatHistory = JSON.parse(data);
    }
    
    chatHistory.push(message);
    
    // Keep only last 100 messages
    if (chatHistory.length > 100) {
      chatHistory = chatHistory.slice(-100);
    }
    
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
    const roomFilePath = path.join(chatHistoryPath, `${roomId}.json`);
    
    if (!fs.existsSync(roomFilePath)) {
      return [];
    }
    
    const data = fs.readFileSync(roomFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading chat history for room ${roomId}:`, error);
    return [];
  }
}

// Get all users (for debugging only)
function getAllUsers() {
  return loadUsers();
}

export default {
  findUserById,
  findUserByUsername,
  addUser,
  updateUser,
  addFriendship,
  saveChatMessage,
  loadChatHistory,
  getAllUsers
};
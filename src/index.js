import express from 'express'
import path from 'path'
import http from 'http'
import {Server} from 'socket.io'
import {fileURLToPath} from 'url'
import database from './database.js'

const app = express()
const PORT = process.env.PORT || 3000
const server = http.createServer(app)

// Socket.io configuration for better stability
const io = new Server(server, {
  pingTimeout: 30000,            // Timeout for client pings
  pingInterval: 25000,           // How often to ping clients
  upgradeTimeout: 30000,         // Timeout for upgrade
  maxHttpBufferSize: 1e8,        // Increased buffer size (100MB)
  transports: ["websocket", "polling"], // Use websocket first, then polling
  cors: {
    origin: "*",                 // Allow all origins (customize in production)
    methods: ["GET", "POST"],
    credentials: true
  }
});

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pathToPublic = path.join(__dirname, '../public')

app.use(express.static(pathToPublic))

// Parse JSON requests
app.use(express.json());

// API routes for users
app.post('/api/users/register', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Username and password are required'
    });
  }
  
  // Check if user exists
  const existingUser = database.findUserByUsername(username);
  if (existingUser) {
    return res.status(409).json({ 
      success: false, 
      error: 'Username already exists'
    });
  }
  
  // Generate unique ID
  const userId = 'user_' + Math.random().toString(36).substr(2, 9);
  
  // Create new user
  const newUser = {
    id: userId,
    username,
    password,  // In production, you should hash this
    friends: []
  };
  
  // Add user to database
  const result = database.addUser(newUser);
  
  if (result.success) {
    // Don't return password in response
    const { password, ...userWithoutPassword } = result.user;
    return res.status(201).json({ 
      success: true, 
      user: userWithoutPassword
    });
  } else {
    return res.status(500).json({ 
      success: false, 
      error: result.error || 'Failed to create user'
    });
  }
});

// Login endpoint
app.post('/api/users/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Username and password are required'
    });
  }
  
  // Find user
  const user = database.findUserByUsername(username);
  
  // Check credentials
  if (!user || user.password !== password) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid username or password'
    });
  }
  
  // Don't return password in response
  const { password: pwd, ...userWithoutPassword } = user;
  
  return res.json({ 
    success: true, 
    user: userWithoutPassword
  });
});

// Add friend endpoint
app.post('/api/users/add-friend', (req, res) => {
  const { userId, friendIdentifier } = req.body;
  
  console.log(`Add friend request: User ${userId} adding friend ${friendIdentifier}`);
  
  if (!userId || !friendIdentifier) {
    return res.status(400).json({ 
      success: false, 
      error: 'User ID and friend identifier are required'
    });
  }
  
  // Find the user
  const user = database.findUserById(userId);
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found',
      details: { userId }
    });
  }
  
  // Find the friend by ID or username
  let friend;
  if (friendIdentifier.startsWith('user_')) {
    friend = database.findUserById(friendIdentifier);
    console.log(`Looking up friend by ID: ${friendIdentifier}, found:`, friend ? 'yes' : 'no');
  } else {
    friend = database.findUserByUsername(friendIdentifier);
    console.log(`Looking up friend by username: ${friendIdentifier}, found:`, friend ? 'yes' : 'no');
  }
  
  if (!friend) {
    // For debugging, get all users
    const allUsers = database.getAllUsers();
    console.log('Available users:', allUsers.map(u => ({ id: u.id, username: u.username })));
    
    return res.status(404).json({ 
      success: false, 
      error: 'Friend not found',
      details: { friendIdentifier }
    });
  }
  
  // Can't add yourself
  if (user.id === friend.id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Cannot add yourself as a friend'
    });
  }
  
  console.log(`Adding friendship between ${user.username} (${user.id}) and ${friend.username} (${friend.id})`);
  
  // Add friendship
  const result = database.addFriendship(user.id, friend.id);
  
  if (result.success) {
    // Don't return passwords in response
    const { password: pwd1, ...userWithoutPassword } = result.user;
    
    console.log(`Friendship added successfully between ${user.username} and ${friend.username}`);
    
    // Try to notify the other user via socket
    try {
      // Directly use the socket connection if available
      if (userSockets[friend.id]) {
        userSockets[friend.id].emit('friendAdded', { 
          addedByUserId: user.id, 
          addedByUsername: user.username,
          message: `${user.username} added you as a friend!`
        });
        console.log(`Directly notified ${friend.username} about new friendship`);
      } else {
        console.log(`Friend ${friend.username} not currently connected`);
      }
    } catch (notifyError) {
      console.error('Error sending friend notification:', notifyError);
    }
    
    return res.json({ 
      success: true, 
      user: userWithoutPassword,
      friendUsername: friend.username
    });
  } else {
    console.log(`Failed to add friendship:`, result.error, result.details);
    
    return res.status(500).json({ 
      success: false, 
      error: result.error,
      details: result.details || {}
    });
  }
});

// Get user profile
app.get('/api/users/:id', (req, res) => {
  const user = database.findUserById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found'
    });
  }
  
  // Don't return password
  const { password, ...userWithoutPassword } = user;
  
  return res.json({ 
    success: true, 
    user: userWithoutPassword
  });
});

// Get all users (for debugging)
app.get('/api/users', (req, res) => {
  const users = database.getAllUsers().map(user => {
    // Don't return passwords
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });
  
  return res.json({ 
    success: true, 
    users
  });
});

// Get chat history for a room
app.get('/api/chat/:roomId', (req, res) => {
  const history = database.loadChatHistory(req.params.roomId);
  
  return res.json({ 
    success: true, 
    history
  });
});

// Create a new group chat
app.post('/api/groups/create', (req, res) => {
  const { name, creatorId, members } = req.body;
  
  if (!name || !creatorId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Group name and creator ID are required'
    });
  }
  
  // Create new group
  const groupId = 'group_' + Math.random().toString(36).substr(2, 9);
  
  // Initialize member list with creator
  const memberList = [creatorId];
  
  // Add other members if provided
  if (members && Array.isArray(members)) {
    // Filter out duplicates and add valid members
    members.forEach(memberId => {
      if (memberId !== creatorId && !memberList.includes(memberId)) {
        const user = database.findUserById(memberId);
        if (user) {
          memberList.push(memberId);
        }
      }
    });
  }
  
  const newGroup = {
    id: groupId,
    name,
    creatorId,
    members: memberList,
    createdAt: new Date().toISOString()
  };
  
  // Add group to database
  const result = database.createGroup(newGroup);
  
  if (result.success) {
    // Notify all members about new group
    memberList.forEach(memberId => {
      if (userSockets[memberId]) {
        userSockets[memberId].emit('groupCreated', {
          group: result.group
        });
      }
    });
    
    return res.status(201).json({ 
      success: true, 
      group: result.group
    });
  } else {
    return res.status(500).json({ 
      success: false, 
      error: result.error || 'Failed to create group'
    });
  }
});

// Add member to group
app.post('/api/groups/:groupId/members', (req, res) => {
  const { groupId } = req.params;
  const { memberId, addedBy } = req.body;
  
  if (!memberId || !addedBy) {
    return res.status(400).json({ 
      success: false, 
      error: 'Member ID and adder ID are required'
    });
  }
  
  // Check if group exists
  const group = database.getGroupById(groupId);
  if (!group) {
    return res.status(404).json({ 
      success: false, 
      error: 'Group not found'
    });
  }
  
  // Check if user exists
  const user = database.findUserById(memberId);
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found'
    });
  }
  
  // Add member to group
  const result = database.addGroupMember(groupId, memberId);
  
  if (result.success) {
    // Notify the added user
    if (userSockets[memberId]) {
      const adder = database.findUserById(addedBy);
      userSockets[memberId].emit('addedToGroup', {
        group: result.group,
        addedBy: adder ? adder.username : 'Someone'
      });
    }
    
    // Notify other group members
    group.members.forEach(existingMemberId => {
      if (existingMemberId !== memberId && userSockets[existingMemberId]) {
        userSockets[existingMemberId].emit('memberAddedToGroup', {
          group: result.group,
          newMemberId: memberId,
          newMemberUsername: user.username
        });
      }
    });
    
    return res.json({ 
      success: true, 
      group: result.group
    });
  } else {
    return res.status(400).json({ 
      success: false, 
      error: result.error || 'Failed to add member to group'
    });
  }
});

// Get group details
app.get('/api/groups/:groupId', (req, res) => {
  const group = database.getGroupById(req.params.groupId);
  
  if (!group) {
    return res.status(404).json({ 
      success: false, 
      error: 'Group not found'
    });
  }
  
  return res.json({ 
    success: true, 
    group
  });
});

// Get all groups for a user
app.get('/api/users/:userId/groups', (req, res) => {
  const groups = database.getUserGroups(req.params.userId);
  
  return res.json({ 
    success: true, 
    groups
  });
});

// Friend notification system - track user sockets
const userSockets = {}; // Map of userId to socket

io.on('connection', (socket) => {
    // Associate socket with user ID for direct messaging
    socket.on('registerUser', ({ userId, username }) => {
        socket.userId = userId;
        socket.username = username;
        userSockets[userId] = socket;
        console.log(`User registered: ${username} (${userId})`);
        
        // Welcome message only to this user
        socket.emit('chatMessage', { 
            text: 'Welcome to Bubbly!', 
            sender: 'system',
            senderUsername: 'System'
        });
    });

    // Join room
    socket.on('joinRoom', ({ room, userId, username }) => {
        // Store user info
        socket.userId = userId;
        socket.username = username;
        
        // Store socket reference for notifications
        if (userId) {
            userSockets[userId] = socket;
        }
        
        // Join the room
        socket.join(room);
        console.log(`${username} (${userId}) joined room: ${room}`);
        
        // Check if the socket successfully joined
        const isInRoom = socket.rooms.has(room);
        console.log(`Socket ${socket.id} successfully joined room ${room}: ${isInRoom}`);
        
        // Get all rooms this socket is in
        console.log(`Socket ${socket.id} is in rooms:`, Array.from(socket.rooms));
        
        // Log all sockets in the room
        const socketsInRoom = io.sockets.adapter.rooms.get(room);
        console.log(`Number of sockets in room ${room}:`, socketsInRoom ? socketsInRoom.size : 0);
        
        // Send chat history to user
        const history = database.loadChatHistory(room);
        if (history && history.length > 0) {
            console.log(`Sending chat history for room ${room}: ${history.length} messages`);
            socket.emit('chatHistory', { room, history });
        } else {
            console.log(`No chat history found for room ${room}`);
        }
    });

    // Leave room
    socket.on('leaveRoom', ({ room }) => {
        socket.leave(room);
        console.log(`User left room: ${room}`);
    });

    socket.on('chatMessage', function({ text, sender, senderUsername, room, timestamp, messageId }, callback) {
        console.log(`Message in room ${room}: ${text} from ${senderUsername}`);
        
        try {
            if (room) {
                // Create message object
                const message = { 
                    type: 'text',
                    text, 
                    sender, 
                    senderUsername,
                    timestamp: timestamp || new Date().getTime(),
                    messageId: messageId || `auto_${Date.now()}`
                };
                
                // Save to database
                database.saveChatMessage(room, message);
                
                // CRITICAL FIX: Use io.to(room) instead of socket.to(room)
                // This ensures ALL clients in the room (including sender) receive the message
                io.to(room).emit('chatMessage', { 
                    ...message,
                    room
                });
                
                console.log(`Message broadcasted to ALL sockets in room ${room}`);
                
                // Send acknowledgment if callback exists
                if (typeof callback === 'function') {
                    callback({ 
                        success: true,
                        messageId: message.messageId
                    });
                }
            } else if (typeof callback === 'function') {
                callback({ success: false, error: 'No room specified' });
            }
        } catch (error) {
            console.error('Error handling chat message:', error);
            socket.emit('errorMessage', { error: 'Failed to process message', details: error.message });
            
            // Send error via acknowledgment if callback exists
            if (typeof callback === 'function') {
                callback({ success: false, error: error.message });
            }
        }
    });

    socket.on('sendLocation', ({ latitude, longitude, sender, senderUsername, room, timestamp, url }) => {
        console.log(`Location in room ${room} from ${senderUsername}`);
        
        try {
            if (room) {
                // Create location message object
                const message = {
                    type: 'location',
                    url,
                    sender,
                    senderUsername,
                    timestamp: timestamp || new Date().getTime(),
                    messageId: `loc_${Date.now()}`
                };
                
                // Save to database
                database.saveChatMessage(room, message);
                
                // CRITICAL FIX: Use io.to(room) to send to ALL clients including sender
                io.to(room).emit('locationMessage', { 
                    ...message,
                    room
                });
            }
        } catch (error) {
            console.error('Error handling location message:', error);
            socket.emit('errorMessage', { error: 'Failed to process location', details: error.message });
        }
    });

    // Join group chat
    socket.on('joinGroupRoom', ({ groupId, userId, username }) => {
        // Store user info
        socket.userId = userId;
        socket.username = username;
        
        // Create room ID for the group
        const room = `group_${groupId}`;
        
        // Join the room
        socket.join(room);
        console.log(`${username} (${userId}) joined group room: ${room}`);
        
        // Send chat history to user
        const history = database.loadChatHistory(room);
        if (history && history.length > 0) {
            console.log(`Sending chat history for group ${groupId}: ${history.length} messages`);
            socket.emit('chatHistory', { room, history });
        } else {
            console.log(`No chat history found for group ${groupId}`);
        }
    });

    socket.on('groupChatMessage', function({ text, sender, senderUsername, groupId, timestamp, messageId }, callback) {
        const room = `group_${groupId}`;
        console.log(`Group message in ${room}: ${text} from ${senderUsername}`);
        
        try {
            // Create message object
            const message = { 
                type: 'text',
                text, 
                sender, 
                senderUsername,
                timestamp: timestamp || new Date().getTime(),
                messageId: messageId || `auto_${Date.now()}`
            };
            
            // Save to database
            database.saveChatMessage(room, message);
            
            // CRITICAL FIX: Use io.to(room) instead of the two-step approach
            io.to(room).emit('chatMessage', { 
                ...message,
                room
            });
            
            console.log(`Message broadcasted to ALL sockets in group room ${room}`);
            
            // Send acknowledgment if callback exists
            if (typeof callback === 'function') {
                callback({ 
                    success: true,
                    messageId: message.messageId
                });
            }
        } catch (error) {
            console.error('Error handling group chat message:', error);
            
            // Send error via acknowledgment if callback exists
            if (typeof callback === 'function') {
                callback({ success: false, error: error.message });
            }
        }
    });

    // Voice message handling
    socket.on('voiceMessage', function({ audio, sender, senderUsername, room, timestamp, messageId, duration }, callback) {
        console.log(`Voice message in room ${room} from ${senderUsername}`);
        
        try {
            if (room) {
                // Create message object
                const message = { 
                    type: 'voice',
                    audio, 
                    sender, 
                    senderUsername,
                    timestamp: timestamp || new Date().getTime(),
                    messageId: messageId || `audio_${Date.now()}`,
                    duration: duration || 0
                };
                
                // Save to database
                database.saveChatMessage(room, message);
                
                // Send to all clients in room
                io.to(room).emit('voiceMessage', { 
                    ...message,
                    room
                });
                
                console.log(`Voice message broadcasted to ALL sockets in room ${room}`);
                
                // Send acknowledgment if callback exists
                if (typeof callback === 'function') {
                    callback({ 
                        success: true,
                        messageId: message.messageId
                    });
                }
            } else if (typeof callback === 'function') {
                callback({ success: false, error: 'No room specified' });
            }
        } catch (error) {
            console.error('Error handling voice message:', error);
            
            // Send error via acknowledgment if callback exists
            if (typeof callback === 'function') {
                callback({ success: false, error: error.message });
            }
        }
    });
    
    // Group voice message handling
    socket.on('groupVoiceMessage', function({ audio, sender, senderUsername, groupId, timestamp, messageId, duration }, callback) {
        const room = `group_${groupId}`;
        console.log(`Group voice message in ${room} from ${senderUsername}`);
        
        try {
            // Create message object
            const message = { 
                type: 'voice',
                audio, 
                sender, 
                senderUsername,
                timestamp: timestamp || new Date().getTime(),
                messageId: messageId || `audio_${Date.now()}`,
                duration: duration || 0
            };
            
            // Save to database
            database.saveChatMessage(room, message);
            
            // Send to all clients in group room
            io.to(room).emit('voiceMessage', { 
                ...message,
                room
            });
            
            console.log(`Voice message broadcasted to ALL sockets in group room ${room}`);
            
            // Send acknowledgment if callback exists
            if (typeof callback === 'function') {
                callback({ 
                    success: true,
                    messageId: message.messageId
                });
            }
        } catch (error) {
            console.error('Error handling group voice message:', error);
            
            // Send error via acknowledgment if callback exists
            if (typeof callback === 'function') {
                callback({ success: false, error: error.message });
            }
        }
    });

    socket.on('disconnect', () => {
        // Only notify if we have user info
        if (socket.username) {
            console.log(`User disconnected: ${socket.username} (${socket.userId})`);
            
            // Remove from active users
            if (socket.userId && userSockets[socket.userId] === socket) {
                delete userSockets[socket.userId];
                console.log(`Removed user ${socket.userId} from active users. Remaining: ${Object.keys(userSockets).length}`);
            }
        }
    });
})

app.get('/', (req, res) => {
    res.sendFile(path.join(pathToPublic, 'index.html'))
})

app.get('/login', (req, res) => {
    res.sendFile(path.join(pathToPublic, 'login.html'))
})

// Friend notification event
app.post('/api/users/notify-friend-added', (req, res) => {
    const { userId, addedByUserId, addedByUsername } = req.body;
    
    if (!userId || !addedByUserId || !addedByUsername) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    // Find the user's socket
    const userSocket = userSockets[userId];
    if (userSocket) {
        // Send notification
        userSocket.emit('friendAdded', { 
            addedByUserId, 
            addedByUsername,
            message: `${addedByUsername} added you as a friend!`
        });
        console.log(`Sent friend notification to ${userId} about ${addedByUsername}`);
    } else {
        console.log(`User ${userId} not connected, can't send friend notification`);
    }
    
    return res.json({ success: true });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

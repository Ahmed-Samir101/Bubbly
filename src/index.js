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
                
                // Get all connected socket IDs in this room
                const socketsInRoom = io.sockets.adapter.rooms.get(room);
                console.log(`Sockets in room ${room}:`, socketsInRoom ? socketsInRoom.size : 0);
                
                let directDeliverySuccess = false;
                
                // Identify recipient user ID (in private chats)
                if (room.startsWith('private_')) {
                    const userIds = room.replace('private_', '').split('_');
                    const recipientId = userIds.find(id => id !== sender);
                    
                    if (recipientId) {
                        console.log(`Direct message to recipient: ${recipientId}`);
                        
                        // Try direct delivery to recipient socket if available
                        const recipientSocket = userSockets[recipientId];
                        if (recipientSocket) {
                            console.log(`Sending directly to recipient's socket`);
                            recipientSocket.emit('chatMessage', {
                                ...message,
                                room
                            });
                            directDeliverySuccess = true;
                        }
                    }
                }
                
                // Also broadcast to the room (this ensures delivery even if direct fails)
                io.in(room).emit('chatMessage', { 
                    ...message,
                    room
                });
                
                // Log the event for debugging
                console.log(`Message broadcasted to room ${room}`);
                
                // Send acknowledgment if callback exists
                if (typeof callback === 'function') {
                    callback({ 
                        success: true,
                        directDelivery: directDeliverySuccess
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
                    timestamp: timestamp || new Date().getTime()
                };
                
                // Save to database
                database.saveChatMessage(room, message);
                
                // Identify recipient user ID (in private chats)
                if (room.startsWith('private_')) {
                    const userIds = room.replace('private_', '').split('_');
                    const recipientId = userIds.find(id => id !== sender);
                    
                    if (recipientId) {
                        console.log(`Direct location message to recipient: ${recipientId}`);
                        
                        // Try direct delivery to recipient socket if available
                        const recipientSocket = userSockets[recipientId];
                        if (recipientSocket) {
                            console.log(`Sending location directly to recipient's socket`);
                            recipientSocket.emit('locationMessage', {
                                ...message,
                                room
                            });
                        }
                    }
                }
                
                // Also broadcast to the room (this ensures delivery even if direct fails)
                io.in(room).emit('locationMessage', { 
                    ...message,
                    room
                });
            }
        } catch (error) {
            console.error('Error handling location message:', error);
            socket.emit('errorMessage', { error: 'Failed to process location', details: error.message });
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

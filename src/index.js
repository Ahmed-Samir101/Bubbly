import express from 'express'
import path from 'path'
import http from 'http'
import {Server} from 'socket.io'
import {fileURLToPath} from 'url'

const app = express()
const PORT = process.env.PORT || 3000
const server = http.createServer(app)
const io = new Server(server)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pathToPublic = path.join(__dirname, '../public')

app.use(express.static(pathToPublic))

io.on('connection', (socket) => {
    socket.emit('chatMessage', { text: 'Welcome!', sender: 'system' });
    socket.broadcast.emit('chatMessage', { text: 'A new user has joined!', sender: 'system' });

    socket.on('chatMessage', ({ text, sender }) => {
        io.emit('chatMessage', { text, sender });
    });

    socket.on('sendLocation', ({ latitude, longitude, sender }) => {
        io.emit('locationMessage', { url: `https://google.com/maps?q=${latitude},${longitude}`, sender });
    });

    socket.on('disconnect', () => {
        io.emit('chatMessage', { text: 'A user has left!', sender: 'system' });
    });
})

app.get('/', (req, res) => {
    res.sendFile(path.join(pathToPublic, 'index.html'))
})

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

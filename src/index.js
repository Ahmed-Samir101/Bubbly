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
    socket.emit('message', 'Welcome!')
    socket.broadcast.emit('message', 'A new user has joined!')

    socket.on('sendMessage', (message, callback) => {
        console.log("Message received: " + message)
        io.emit('sendMessage', message)
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        io.emit('sendMessage', `https://google.com/maps?q=${coords.latitude},${coords.longitude}`)
        callback()
    })

    socket.on('disconnect', () => {
        io.emit('sendMessage', 'A user has left!')
    })
})

app.get('/', (req, res) => {
    res.sendFile(path.join(pathToPublic, 'index.html'))
})

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

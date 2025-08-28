const socket = io()
const messages = document.getElementById('messages')

socket.on('connect', () => {
    console.log('Connected to server')
})

socket.on('sendMessage', (msg) => {
    const messageElement = document.createElement('li')
    messageElement.textContent = msg
    messages.appendChild(messageElement)
})

document.getElementById('message-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const input = document.getElementById('message-input');
    const message = input.value;
    input.value = ''
    socket.emit('sendMessage', message, (err)=>{
        if(err){
            return console.log(err)
        }
        console.log('Message delivered!')
    })
})

document.querySelector('#send-location').addEventListener('click', () => {
    if (!navigator.geolocation) {
        return alert('Geolocation is not supported by your browser.')
    }

    navigator.geolocation.getCurrentPosition((position) => {
        socket.emit('sendLocation', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        }, () => {
            console.log('Location shared!')  
        })
    })
})
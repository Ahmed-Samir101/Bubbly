const socket = io();

const chatWindow = document.getElementById('chat-window');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendLocationBtn = document.querySelector('#send-location');

let myId = null;

// Render text message
function renderMessage({ sender, text, isOwn }) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.classList.add(isOwn ? 'user' : 'bianca');
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Render location message
function renderLocation({ sender, url, isOwn }) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.classList.add(isOwn ? 'user' : 'bianca');
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.textContent = 'My location';
  div.appendChild(a);
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Get own socket id
socket.on('connect', () => {
  myId = socket.id;
});

// Send message
messageForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit('chatMessage', { text, sender: myId });
  renderMessage({ sender: myId, text, isOwn: true });
  messageInput.value = '';
});

// Receive text message
socket.on('chatMessage', function({ text, sender }) {
  if (sender === myId) return; // Already rendered own message
  renderMessage({ sender, text, isOwn: false });
});

// Send location
sendLocationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    return alert('Geolocation is not supported by your browser.');
  }
  navigator.geolocation.getCurrentPosition((position) => {
    socket.emit('sendLocation', {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      sender: myId
    });
    renderLocation({ sender: myId, url: `https://google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`, isOwn: true });
  });
});

// Receive location message
socket.on('locationMessage', function({ url, sender }) {
  if (sender === myId) return; // Already rendered own location
  renderLocation({ sender, url, isOwn: false });
});
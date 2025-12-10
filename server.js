const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

app.get('/rooms', (req, res) => {
  try {
    const files = fs.readdirSync('rooms');
    res.json(files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')));
  } catch (e) {
    res.json([]);
  }
});

const rooms = {};

function loadRoom(name) {
  const file = path.join('rooms', name + '.json');
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file)); } catch (e) {}
  }
  return { members: [], history: [], spotlights: {} };
}

function saveRoom(name) {
  if (rooms[name]) {
    fs.writeFileSync(path.join('rooms', name + '.json'), JSON.stringify(rooms[name]));
  }
}

io.on('connection', (socket) => {
  socket.on('join', ({ room }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = loadRoom(room);

    rooms[room].members = rooms[room].members.filter(m => m.id !== socket.id);
    rooms[room].members.push({ id: socket.id });

    socket.emit('members', rooms[room].members);
    socket.emit('history', rooms[room].history);

    socket.on('post', (data) => {
      const p = { data, from: socket.id, ts: Date.now() };
      rooms[room].history.push(p);
      io.to(room).emit('post', p);
      saveRoom(room);
    });

    socket.on('dm', ({ to, data }) => {
      socket.to(to).emit('dm', { from: socket.id, data });
    });

    socket.on('save-spotlight', (post) => {
      if (!rooms[room].spotlights[socket.id]) rooms[room].spotlights[socket.id] = [];
      rooms[room].spotlights[socket.id].push(post);
      saveRoom(room);
    });

    socket.on('disconnect', () => {
      if (rooms[room]) {
        rooms[room].members = rooms[room].members.filter(m => m.id !== socket.id);
        io.to(room).emit('members', rooms[room].members);
        if (rooms[room].members.length === 0) saveRoom(room);
      }
    });
  });

  socket.on('browser-log', ({ method, args }) => {
    console[method]('BROWSER:', ...args);
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('\nLXNEWSXL-NINJA RUNNING');
  console.log('http://localhost:3000\n');
});

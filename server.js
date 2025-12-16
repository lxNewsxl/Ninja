const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

app.use(express.static('public'));

server.listen(3000, '0.0.0.0', () => {
  console.log('\nLXNEWSXL-NINJA RUNNING');
  console.log('http://localhost:3000\n');
});

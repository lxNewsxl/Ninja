import { loadProfiles, saveProfile } from './db.js';
import { setKey } from './crypto.js';
import { socket } from './socket.js';
import { initSidebar } from './sidebars.js';
import { renderMessage } from './messageUi.js';
import { showModal } from './ui.js';

window.app = window.app || { profile: { name: 'Ninja', pic: '', bio: '' }, room: '' };  // Fix: define if undefined

const root = document.getElementById('root');

export async function showLauncher() {
  const profiles = await loadProfiles();
  const res = await fetch('/rooms');
  const hosted = await res.json();

  root.innerHTML = `
  <div class="min-h-screen bg-black flex items-center justify-center p-8">
    <div class="w-full max-w-4xl">
      <h1 class="text-8xl font-black text-center mb-16 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">LXNEWSXL-NINJA</h1>

      ${profiles.length ? `<div class="mb-12"><h2 class="text-3xl mb-6">Profiles</h2><div class="grid grid-cols-3 gap-6">${profiles.map((p,i)=>`<button onclick="selectProfile(${i})" class="p-8 bg-gray-900 rounded-2xl"><img src="${p.pic||'https://api.dicebear.com/7.x/identicon/svg?seed='+p.name}" class="w-24 h-24 rounded-full mx-auto mb-4"><div class="font-bold">${p.name}</div></button>`).join('')}</div></div>` : ''}

      ${hosted.length ? `<div class="mb-12"><h2 class="text-3xl mb-6">Hosted Rooms</h2>${hosted.map(r=>`<button onclick="joinRoom('${r}') " class="block p-6 bg-gray-900 rounded-xl mb-4">${r}</button>`).join('')}</div>` : ''}

      <button onclick="newRoom()" class="w-full py-8 text-5xl font-bold bg-gradient-to-r from-red-600 to-orange-600 rounded-3xl">NEW ROOM</button>
    </div>
  </div>`;

  window.selectProfile = i => { window.app.profile = profiles[i]; newRoom(); };
  window.joinRoom = r => { window.app.room = r; showJoinForm(); };
  window.newRoom = () => {
    window.app.profile = { name: '', pic: '', bio: '' };
    window.app.room = '';
    showJoinForm(true);
  };
}

function showJoinForm(isNew = false) {
  showModal('ENTER ROOM', `
  <form id="join-form">
    <input id="room-in" value="${window.app.room}" placeholder="Room name" class="w-full px-6 py-4 bg-gray-900 rounded-2xl mb-4">
    <input id="name-in" value="${window.app.profile.name}" placeholder="Name" class="w-full px-6 py-4 bg-gray-900 rounded-2xl mb-4">
    <textarea id="bio-in" placeholder="Bio" class="w-full px-6 py-4 bg-gray-900 rounded-2xl mb-4">${window.app.profile.bio}</textarea>
    <input id="pass-in" type="password" placeholder="Passphrase = key" class="w-full px-6 py-4 bg-gray-900 rounded-2xl mb-4">
    <button type="submit" class="w-full py-5 text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl">ENTER</button>
  </form>
  `);

  document.getElementById('join-form').onsubmit = async (e) => {
    e.preventDefault();
    window.app.room = document.getElementById('room-in').value.trim();
    window.app.profile.name = document.getElementById('name-in').value.trim() || "Ninja";
    window.app.profile.bio = document.getElementById('bio-in').value.trim();
    const pass = document.getElementById('pass-in').value;

    if (!window.app.room || !pass) return alert("Room + passphrase required");

    await setKey(pass);
    if (isNew) await saveProfile(window.app.profile);

    document.querySelector('.fixed').remove();
    showChat();
  };
}

function showChat() {
  root.innerHTML = `
  <div class="flex h-screen">
    <div id="sidebar" class="w-80 bg-gray-950 border-r border-gray-800 p-6">
      <h2 class="text-2xl font-bold text-red-500 mb-6">LXNEWSXL</h2>
      <div id="members"></div>
    </div>
    <div class="flex-1 flex flex-col">
      <div class="h-16 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-6">
        <div class="font-bold text-xl">${window.app.room}</div>
        <button onclick="location.reload()" class="px-6 py-2 bg-red-700 rounded">Leave</button>
      </div>
      <div id="messages" class="flex-1 overflow-y-auto p-6 space-y-6"></div>
      <div class="p-6 border-t border-gray-800">
        <textarea id="input" rows="3" placeholder="Type..." class="w-full p-4 bg-gray-900 rounded-xl mb-4"></textarea>
        <div id="preview"></div>
        <div class="flex gap-4 mt-4">
          <label class="flex-1 py-3 bg-gray-800 rounded-xl text-center cursor-pointer">
            Attach <input type="file" id="files" multiple class="hidden">
          </label>
          <button id="send" class="px-10 py-3 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl font-bold">SEND</button>
        </div>
      </div>
    </div>
  </div>`;

  socket.emit('join', { room: window.app.room });
  initSidebar();

  document.getElementById('send').onclick = async () => {
    const text = document.getElementById('input').value.trim();
    const files = document.getElementById('files').files;
    if (!text && files.length===0) return;

    const atts = [];
    for (const f of files) {
      const b = await f.arrayBuffer();
      atts.push({ name: f.name, type: f.type, data: await encrypt(b) });
    }

    const payload = { text, author: window.app.profile.name, pic: window.app.profile.pic, attachments: atts };
    const enc = await encrypt(new TextEncoder().encode(JSON.stringify(payload)));
    socket.emit('post', { room: window.app.room, data: enc });

    renderMessage(payload, true);
    document.getElementById('input').value = '';
    document.getElementById('files').value = '';
    document.getElementById('preview').innerHTML = '';
  };

  socket.on('post', async p => {
    const d = await decrypt(p.data);
    if (d) renderMessage(JSON.parse(new TextDecoder().decode(d)));
  });

  socket.on('history', async list => {
    document.getElementById('messages').innerHTML = '';
    for (const p of list) {
      const d = await decrypt(p.data);
      if (d) renderMessage(JSON.parse(new TextDecoder().decode(d)));
    }
  });
}

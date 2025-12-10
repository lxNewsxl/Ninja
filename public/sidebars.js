import { socket } from './socket.js';
import { encrypt, decrypt } from './crypto.js';

let currentDM = null;

export function initSidebar() {
  socket.on('members', list => {
    const div = document.getElementById('members');
    div.innerHTML = '';
    list.forEach(m => {
      if (m.id === socket.id) return;
      const btn = document.createElement('button');
      btn.className = "w-full text-left p-3 hover:bg-gray-800 rounded flex items-center gap-3";
      btn.innerHTML = `<img src="${m.pic || 'https://api.dicebear.com/7.x/identicon/svg?seed='+m.name}" class="w-10 h-10 rounded-full">
                       <div class="font-medium">${m.name}</div>`;
      btn.onclick = () => {
        currentDM = m.id;
        showDMModal(m.name);
      };
      div.appendChild(btn);
    });
  });
}

function showDMModal(name) {
  const modal = document.createElement('div');
  modal.className = "fixed inset-0 bg-black/80 flex items-center justify-center z-50";
  modal.innerHTML = `
  <div class="w-full max-w-md p-8 bg-gray-950 rounded-3xl border border-gray-800 space-y-6">
    <h2 class="text-3xl font-bold text-center">DM with ${name}</h2>
    <div id="dm-chat" class="h-64 overflow-y-auto p-4 bg-gray-900 rounded-2xl"></div>
    <input id="dm-input" placeholder="Type message..." class="w-full px-6 py-4 bg-gray-900 rounded-2xl">
    <button id="dm-send" class="w-full py-5 text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl">SEND</button>
    <button onclick="this.parentElement.parentElement.remove()" class="w-full py-3 text-xl bg-gray-800 rounded-2xl">Close</button>
  </div>`;
  root.appendChild(modal);

  document.getElementById('dm-send').onclick = async () => {
    const text = document.getElementById('dm-input').value.trim();
    if (!text) return;
    const enc = await encrypt(new TextEncoder().encode(text));
    socket.emit('dm', { to: currentDM, data: enc });
    document.getElementById('dm-input').value = '';
  };

  socket.on('dm', async msg => {
    if (msg.from !== currentDM) return;
    const d = await decrypt(msg.data);
    if (d) {
      const text = new TextDecoder().decode(d);
      const div = document.createElement('div');
      div.textContent = text;
      div.className = "p-3 bg-gray-800 rounded-lg max-w-xs";
      document.getElementById('dm-chat').appendChild(div);
      div.scrollIntoView();
    }
  });
}

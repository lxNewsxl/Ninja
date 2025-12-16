// src/components/RoomCreator.js
export class RoomCreator {
  constructor(onCreateRoom, onJoinRoom) {
    this.onCreateRoom = onCreateRoom;
    this.onJoinRoom = onJoinRoom;
    this.mode = 'create'; // 'create' or 'join'
  }

  render() {
    const container = document.createElement('div');
    container.className = 'w-full max-w-4xl bg-gray-800 rounded-lg p-6 shadow-lg';

    // Mode tabs
    const tabs = document.createElement('div');
    tabs.className = 'flex gap-4 mb-6 border-b border-gray-700';

    const createTab = document.createElement('button');
    createTab.className = `pb-3 px-4 font-semibold transition ${
      this.mode === 'create' 
        ? 'text-purple-400 border-b-2 border-purple-400' 
        : 'text-gray-400 hover:text-gray-300'
    }`;
    createTab.textContent = 'Create Room';
    createTab.onclick = () => {
      this.mode = 'create';
      container.replaceWith(this.render());
    };

    const joinTab = document.createElement('button');
    joinTab.className = `pb-3 px-4 font-semibold transition ${
      this.mode === 'join' 
        ? 'text-purple-400 border-b-2 border-purple-400' 
        : 'text-gray-400 hover:text-gray-300'
    }`;
    joinTab.textContent = 'Join Room';
    joinTab.onclick = () => {
      this.mode = 'join';
      container.replaceWith(this.render());
    };

    tabs.appendChild(createTab);
    tabs.appendChild(joinTab);

    // Form
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.onsubmit = (e) => {
      e.preventDefault();
      this.handleSubmit(form);
    };

    if (this.mode === 'create') {
      // Room name input
      const nameGroup = document.createElement('div');
      nameGroup.innerHTML = `
        <label class="block text-sm font-medium text-gray-300 mb-2">Room Name</label>
        <input 
          type="text" 
          name="roomName" 
          required
          placeholder="Enter room name"
          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 text-white"
        />
      `;

      // Passphrase input
      const passphraseGroup = document.createElement('div');
      passphraseGroup.innerHTML = `
        <label class="block text-sm font-medium text-gray-300 mb-2">Passphrase</label>
        <input 
          type="password" 
          name="passphrase" 
          required
          placeholder="Enter secure passphrase"
          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 text-white"
        />
        <p class="text-xs text-gray-400 mt-1">This passphrase encrypts all messages</p>
      `;

      form.appendChild(nameGroup);
      form.appendChild(passphraseGroup);
    } else {
      // Room ID input
      const idGroup = document.createElement('div');
      idGroup.innerHTML = `
        <label class="block text-sm font-medium text-gray-300 mb-2">Room ID</label>
        <input 
          type="text" 
          name="roomId" 
          required
          placeholder="Enter room ID"
          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 text-white font-mono"
        />
      `;

      // Passphrase input
      const passphraseGroup = document.createElement('div');
      passphraseGroup.innerHTML = `
        <label class="block text-sm font-medium text-gray-300 mb-2">Passphrase</label>
        <input 
          type="password" 
          name="passphrase" 
          required
          placeholder="Enter room passphrase"
          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 text-white"
        />
      `;

      form.appendChild(idGroup);
      form.appendChild(passphraseGroup);
    }

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition';
    submitBtn.textContent = this.mode === 'create' ? 'Create Room' : 'Join Room';

    form.appendChild(submitBtn);

    container.appendChild(tabs);
    container.appendChild(form);

    return container;
  }

  handleSubmit(form) {
    const formData = new FormData(form);

    if (this.mode === 'create') {
      const roomName = formData.get('roomName');
      const passphrase = formData.get('passphrase');
      this.onCreateRoom(roomName, passphrase);
    } else {
      const roomId = formData.get('roomId');
      const passphrase = formData.get('passphrase');
      this.onJoinRoom(roomId, passphrase);
    }
  }
}

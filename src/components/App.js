// src/components/App.js
import { WebRTCManager } from '../core/WebRTCManager.js';
import { ChatRoom } from './ChatRoom.js';
import { RoomCreator } from './RoomCreator.js';
import { SettingsSidebar } from './SettingsSidebar.js';
import { CryptoUtils } from '../utils/crypto.js';

export class App {
  constructor(root, db) {
    this.root = root;
    this.db = db;
    this.profile = null;
    this.currentRoom = null;
    this.webrtc = null;
    this.settingsOpen = false;
    
    this.state = {
      view: 'home', // 'home', 'room'
      rooms: []
    };
  }

  async render() {
    // Load or create profile
    this.profile = await this.db.getProfile();
    
    if (!this.profile) {
      this.profile = {
        id: CryptoUtils.generateId(),
        username: `User${Math.floor(Math.random() * 10000)}`,
        avatar: null,
        createdAt: Date.now()
      };
      await this.db.saveProfile(this.profile);
    }

    // Initialize WebRTC
    this.webrtc = new WebRTCManager(
      this.profile.id,
      (message) => this.handleMessage(message),
      (peerId) => this.handlePeerJoined(peerId),
      (peerId) => this.handlePeerLeft(peerId),
      (peerId, stream) => this.handleStream(peerId, stream)
    );

    // Load saved rooms
    this.state.rooms = await this.db.getRooms();

    this.renderView();
  }

  renderView() {
    this.root.innerHTML = '';
    this.root.className = 'w-full h-screen bg-gray-900 text-white flex';

    if (this.state.view === 'home') {
      this.renderHome();
    } else if (this.state.view === 'room') {
      this.renderRoom();
    }

    // Settings sidebar
    if (this.settingsOpen) {
      const sidebar = new SettingsSidebar(
        this.profile,
        () => this.closeSettings(),
        (profile) => this.updateProfile(profile)
      );
      this.root.appendChild(sidebar.render());
    }
  }

  renderHome() {
    const container = document.createElement('div');
    container.className = 'flex-1 flex flex-col items-center justify-center p-8';

    // Header
    const header = document.createElement('div');
    header.className = 'w-full max-w-4xl mb-8 flex justify-between items-center';
    
    const title = document.createElement('h1');
    title.className = 'text-4xl font-bold text-purple-400';
    title.textContent = 'Ninja Chat';
    
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition';
    settingsBtn.textContent = 'Settings';
    settingsBtn.onclick = () => this.openSettings();
    
    header.appendChild(title);
    header.appendChild(settingsBtn);

    // Room creator
    const creator = new RoomCreator(
      (roomName, passphrase) => this.createRoom(roomName, passphrase),
      (roomId, passphrase) => this.joinRoom(roomId, passphrase)
    );

    // Saved rooms
    const savedRooms = document.createElement('div');
    savedRooms.className = 'w-full max-w-4xl mt-8';
    
    if (this.state.rooms.length > 0) {
      const roomsTitle = document.createElement('h2');
      roomsTitle.className = 'text-2xl font-semibold mb-4 text-gray-300';
      roomsTitle.textContent = 'Saved Rooms';
      savedRooms.appendChild(roomsTitle);

      const roomsList = document.createElement('div');
      roomsList.className = 'grid gap-4 grid-cols-1 md:grid-cols-2';
      
      this.state.rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'bg-gray-800 p-4 rounded-lg hover:bg-gray-700 cursor-pointer transition';
        roomCard.onclick = () => {
          const passphrase = prompt('Enter room passphrase:');
          if (passphrase) {
            this.joinRoom(room.id, passphrase);
          }
        };

        const roomName = document.createElement('h3');
        roomName.className = 'text-lg font-semibold text-purple-300';
        roomName.textContent = room.name;

        const roomId = document.createElement('p');
        roomId.className = 'text-sm text-gray-400 mt-2 font-mono';
        roomId.textContent = `ID: ${room.id.substring(0, 12)}...`;

        roomCard.appendChild(roomName);
        roomCard.appendChild(roomId);
        roomsList.appendChild(roomCard);
      });

      savedRooms.appendChild(roomsList);
    }

    container.appendChild(header);
    container.appendChild(creator.render());
    container.appendChild(savedRooms);
    this.root.appendChild(container);
  }

  renderRoom() {
    const chatRoom = new ChatRoom(
      this.currentRoom,
      this.profile,
      this.webrtc,
      () => this.leaveRoom()
    );
    this.root.appendChild(chatRoom.render());
  }

  async createRoom(roomName, passphrase) {
    const roomId = CryptoUtils.generateId();
    
    const roomData = await this.webrtc.createRoom(roomId, roomName, passphrase);
    
    await this.db.saveRoom({
      id: roomId,
      name: roomName,
      salt: roomData.salt,
      hostId: this.profile.id,
      createdAt: Date.now()
    });

    this.currentRoom = {
      id: roomId,
      name: roomName,
      isHost: true
    };

    this.state.view = 'room';
    this.state.rooms = await this.db.getRooms();
    this.renderView();
  }

  async joinRoom(roomId, passphrase) {
    const room = this.state.rooms.find(r => r.id === roomId);
    
    if (!room) {
      alert('Room not found');
      return;
    }

    try {
      await this.webrtc.joinRoom(room, passphrase);

      this.currentRoom = {
        id: room.id,
        name: room.name,
        isHost: false
      };

      this.state.view = 'room';
      this.renderView();
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Failed to join room. Check passphrase.');
    }
  }

  leaveRoom() {
    this.webrtc.leaveRoom();
    this.currentRoom = null;
    this.state.view = 'home';
    this.renderView();
  }

  handleMessage(message) {
    // Messages are handled by ChatRoom component
    if (this.state.view === 'room') {
      window.dispatchEvent(new CustomEvent('ninja-message', { detail: message }));
    }
  }

  handlePeerJoined(peerId) {
    window.dispatchEvent(new CustomEvent('ninja-peer-joined', { detail: peerId }));
  }

  handlePeerLeft(peerId) {
    window.dispatchEvent(new CustomEvent('ninja-peer-left', { detail: peerId }));
  }

  handleStream(peerId, stream) {
    window.dispatchEvent(new CustomEvent('ninja-stream', { 
      detail: { peerId, stream } 
    }));
  }

  openSettings() {
    this.settingsOpen = true;
    this.renderView();
  }

  closeSettings() {
    this.settingsOpen = false;
    this.renderView();
  }

  async updateProfile(profile) {
    this.profile = { ...this.profile, ...profile };
    await this.db.saveProfile(this.profile);
    this.closeSettings();
  }
}

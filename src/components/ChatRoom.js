// src/components/ChatRoom.js
import { MessageFeed } from './MessageFeed.js';
import { VideoGrid } from './VideoGrid.js';
import { DMPanel } from './DMPanel.js';

export class ChatRoom {
  constructor(room, profile, webrtc, onLeave) {
    this.room = room;
    this.profile = profile;
    this.webrtc = webrtc;
    this.onLeave = onLeave;
    
    this.messages = [];
    this.peers = new Map(); // peerId -> username
    this.streams = new Map(); // peerId -> stream
    this.videoEnabled = false;
    this.dmPanelOpen = false;
    this.selectedDMPeer = null;
    
    this.container = null;
    this.messageFeed = null;
    this.videoGrid = null;
    this.dmPanel = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('ninja-message', (e) => {
      this.handleNewMessage(e.detail);
    });

    window.addEventListener('ninja-peer-joined', (e) => {
      this.handlePeerJoined(e.detail);
    });

    window.addEventListener('ninja-peer-left', (e) => {
      this.handlePeerLeft(e.detail);
    });

    window.addEventListener('ninja-stream', (e) => {
      this.handleStream(e.detail.peerId, e.detail.stream);
    });
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'flex-1 flex flex-col h-screen';

    // Header
    const header = this.renderHeader();

    // Main content area
    const mainContent = document.createElement('div');
    mainContent.className = 'flex-1 flex overflow-hidden';

    // Chat area
    const chatArea = document.createElement('div');
    chatArea.className = 'flex-1 flex flex-col';

    // Video grid (if enabled)
    if (this.videoEnabled) {
      this.videoGrid = new VideoGrid(this.streams, this.profile.id);
      chatArea.appendChild(this.videoGrid.render());
    }

    // Message feed
    this.messageFeed = new MessageFeed(
      this.messages,
      this.profile,
      (text) => this.sendMessage(text)
    );
    chatArea.appendChild(this.messageFeed.render());

    mainContent.appendChild(chatArea);

    // DM Panel
    if (this.dmPanelOpen && this.selectedDMPeer) {
      this.dmPanel = new DMPanel(
        this.selectedDMPeer,
        this.profile,
        (text) => this.sendDM(this.selectedDMPeer, text),
        () => this.closeDMPanel()
      );
      mainContent.appendChild(this.dmPanel.render());
    }

    this.container.appendChild(header);
    this.container.appendChild(mainContent);

    return this.container;
  }

  renderHeader() {
    const header = document.createElement('div');
    header.className = 'bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center';

    const leftSection = document.createElement('div');
    leftSection.className = 'flex items-center gap-4';

    const roomInfo = document.createElement('div');
    const roomName = document.createElement('h2');
    roomName.className = 'text-xl font-bold text-purple-400';
    roomName.textContent = this.room.name;

    const roomId = document.createElement('p');
    roomId.className = 'text-xs text-gray-400 font-mono';
    roomId.textContent = `ID: ${this.room.id.substring(0, 16)}...`;

    roomInfo.appendChild(roomName);
    roomInfo.appendChild(roomId);

    const peerCount = document.createElement('div');
    peerCount.className = 'flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full';
    peerCount.innerHTML = `
      <div class="w-2 h-2 bg-green-500 rounded-full"></div>
      <span class="text-sm text-gray-300">${this.webrtc.getPeerCount()} online</span>
    `;

    leftSection.appendChild(roomInfo);
    leftSection.appendChild(peerCount);

    const rightSection = document.createElement('div');
    rightSection.className = 'flex items-center gap-3';

    // Video toggle button
    const videoBtn = document.createElement('button');
    videoBtn.className = `px-4 py-2 rounded-lg transition ${
      this.videoEnabled 
        ? 'bg-purple-600 hover:bg-purple-700' 
        : 'bg-gray-700 hover:bg-gray-600'
    }`;
    videoBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
      </svg>
    `;
    videoBtn.onclick = () => this.toggleVideo();

    // Copy room ID button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition';
    copyBtn.textContent = 'Copy ID';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(this.room.id);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy ID', 2000);
    };

    // Leave button
    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition';
    leaveBtn.textContent = 'Leave';
    leaveBtn.onclick = () => this.onLeave();

    rightSection.appendChild(videoBtn);
    rightSection.appendChild(copyBtn);
    rightSection.appendChild(leaveBtn);

    header.appendChild(leftSection);
    header.appendChild(rightSection);

    return header;
  }

  handleNewMessage(message) {
    this.messages.push(message);
    if (this.messageFeed) {
      this.messageFeed.addMessage(message);
    }
  }

  handlePeerJoined(peerId) {
    // Add peer to list
    this.peers.set(peerId, `User${peerId.substring(0, 4)}`);
    this.updatePeerCount();
  }

  handlePeerLeft(peerId) {
    this.peers.delete(peerId);
    this.streams.delete(peerId);
    this.updatePeerCount();
    
    if (this.videoGrid) {
      this.videoGrid.removeStream(peerId);
    }
  }

  handleStream(peerId, stream) {
    this.streams.set(peerId, stream);
    
    if (this.videoGrid) {
      this.videoGrid.addStream(peerId, stream);
    }
  }

  async sendMessage(text) {
    const message = await this.webrtc.sendMessage(text, this.profile.username);
    this.messages.push(message);
    
    if (this.messageFeed) {
      this.messageFeed.addMessage(message);
    }
  }

  async sendDM(peerId, text) {
    const message = await this.webrtc.sendDM(peerId, text, this.profile.username);
    
    if (this.dmPanel) {
      this.dmPanel.addMessage(message);
    }
  }

  async toggleVideo() {
    if (this.videoEnabled) {
      this.webrtc.disableVideo();
      this.videoEnabled = false;
    } else {
      try {
        const stream = await this.webrtc.enableVideo();
        this.streams.set(this.profile.id, stream);
        this.videoEnabled = true;
      } catch (error) {
        alert('Failed to enable video. Please check permissions.');
        return;
      }
    }

    // Re-render
    this.container.replaceWith(this.render());
  }

  openDMPanel(peerId) {
    this.selectedDMPeer = peerId;
    this.dmPanelOpen = true;
    this.container.replaceWith(this.render());
  }

  closeDMPanel() {
    this.dmPanelOpen = false;
    this.selectedDMPeer = null;
    this.container.replaceWith(this.render());
  }

  updatePeerCount() {
    const peerCountEl = this.container.querySelector('.peer-count');
    if (peerCountEl) {
      peerCountEl.textContent = `${this.webrtc.getPeerCount()} online`;
    }
  }
}

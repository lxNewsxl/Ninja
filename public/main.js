(() => {
  // src/core/PeerConnection.js
  var PeerConnection = class {
    constructor(peerId, initiator, onMessage, onStream, onClose) {
      this.peerId = peerId;
      this.initiator = initiator;
      this.onMessage = onMessage;
      this.onStream = onStream;
      this.onClose = onClose;
      this.pc = null;
      this.dataChannel = null;
      this.remoteStream = null;
      this.init();
    }
    init() {
      const config = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      };
      this.pc = new RTCPeerConnection(config);
      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({ type: "ice-candidate", candidate: event.candidate });
        }
      };
      this.pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          if (this.onStream) {
            this.onStream(this.remoteStream);
          }
        }
      };
      this.pc.onconnectionstatechange = () => {
        if (this.pc.connectionState === "disconnected" || this.pc.connectionState === "failed" || this.pc.connectionState === "closed") {
          this.close();
        }
      };
      if (this.initiator) {
        this.createDataChannel();
      } else {
        this.pc.ondatachannel = (event) => {
          this.dataChannel = event.channel;
          this.setupDataChannel();
        };
      }
    }
    createDataChannel() {
      this.dataChannel = this.pc.createDataChannel("chat", {
        ordered: true
      });
      this.setupDataChannel();
    }
    setupDataChannel() {
      this.dataChannel.onopen = () => {
        console.log("Data channel opened with", this.peerId);
      };
      this.dataChannel.onmessage = (event) => {
        if (this.onMessage) {
          this.onMessage(JSON.parse(event.data));
        }
      };
      this.dataChannel.onerror = (error) => {
        console.error("Data channel error:", error);
      };
      this.dataChannel.onclose = () => {
        console.log("Data channel closed");
      };
    }
    async createOffer() {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      return offer;
    }
    async createAnswer() {
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      return answer;
    }
    async handleOffer(offer) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      return await this.createAnswer();
    }
    async handleAnswer(answer) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
    async handleIceCandidate(candidate) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    }
    async addLocalStream(stream) {
      stream.getTracks().forEach((track) => {
        this.pc.addTrack(track, stream);
      });
    }
    sendMessage(message) {
      if (this.dataChannel && this.dataChannel.readyState === "open") {
        this.dataChannel.send(JSON.stringify(message));
      }
    }
    sendSignal(signal) {
    }
    close() {
      if (this.dataChannel) {
        this.dataChannel.close();
      }
      if (this.pc) {
        this.pc.close();
      }
      if (this.onClose) {
        this.onClose();
      }
    }
  };

  // src/utils/crypto.js
  var CryptoUtils = class {
    static async deriveKey(passphrase, salt) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(passphrase),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
      );
      return crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt,
          iterations: 1e5,
          hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
    }
    static async encrypt(text, key) {
      const enc = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        enc.encode(text)
      );
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      return btoa(String.fromCharCode(...combined));
    }
    static async decrypt(encryptedData, key) {
      const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data
      );
      return new TextDecoder().decode(decrypted);
    }
    static generateSalt() {
      return crypto.getRandomValues(new Uint8Array(16));
    }
    static generateId() {
      return crypto.randomUUID();
    }
    static async hashPassphrase(passphrase) {
      const enc = new TextEncoder();
      const data = enc.encode(passphrase);
      const hash = await crypto.subtle.digest("SHA-256", data);
      return btoa(String.fromCharCode(...new Uint8Array(hash)));
    }
  };

  // src/core/EncryptionManager.js
  var EncryptionManager = class {
    constructor() {
      this.keys = /* @__PURE__ */ new Map();
      this.salts = /* @__PURE__ */ new Map();
    }
    async initRoom(roomId, passphrase) {
      const salt = CryptoUtils.generateSalt();
      const key = await CryptoUtils.deriveKey(passphrase, salt);
      this.keys.set(roomId, key);
      this.salts.set(roomId, salt);
      return { salt: Array.from(salt), key };
    }
    async joinRoom(roomId, passphrase, saltArray) {
      const salt = new Uint8Array(saltArray);
      const key = await CryptoUtils.deriveKey(passphrase, salt);
      this.keys.set(roomId, key);
      this.salts.set(roomId, salt);
      return key;
    }
    async encryptMessage(roomId, message) {
      const key = this.keys.get(roomId);
      if (!key) throw new Error("No encryption key for room");
      return await CryptoUtils.encrypt(JSON.stringify(message), key);
    }
    async decryptMessage(roomId, encryptedData) {
      const key = this.keys.get(roomId);
      if (!key) throw new Error("No encryption key for room");
      const decrypted = await CryptoUtils.decrypt(encryptedData, key);
      return JSON.parse(decrypted);
    }
    hasKey(roomId) {
      return this.keys.has(roomId);
    }
    removeRoom(roomId) {
      this.keys.delete(roomId);
      this.salts.delete(roomId);
    }
    getSalt(roomId) {
      const salt = this.salts.get(roomId);
      return salt ? Array.from(salt) : null;
    }
  };

  // src/core/WebRTCManager.js
  var WebRTCManager = class {
    constructor(userId, onMessage, onPeerJoined, onPeerLeft, onStream) {
      this.userId = userId;
      this.onMessage = onMessage;
      this.onPeerJoined = onPeerJoined;
      this.onPeerLeft = onPeerLeft;
      this.onStream = onStream;
      this.peers = /* @__PURE__ */ new Map();
      this.isHost = false;
      this.roomId = null;
      this.encryption = new EncryptionManager();
      this.localStream = null;
      this.signalingQueue = [];
    }
    async createRoom(roomId, roomName, passphrase) {
      this.roomId = roomId;
      this.isHost = true;
      const { salt } = await this.encryption.initRoom(roomId, passphrase);
      return {
        roomId,
        name: roomName,
        salt,
        hostId: this.userId,
        peers: [this.userId]
      };
    }
    async joinRoom(roomData, passphrase) {
      this.roomId = roomData.roomId;
      this.isHost = false;
      await this.encryption.joinRoom(roomData.roomId, passphrase, roomData.salt);
      if (roomData.hostId) {
        await this.connectToPeer(roomData.hostId, true);
      }
    }
    async connectToPeer(peerId, initiator) {
      if (this.peers.has(peerId)) return;
      const peer = new PeerConnection(
        peerId,
        initiator,
        (message) => this.handlePeerMessage(peerId, message),
        (stream) => this.handlePeerStream(peerId, stream),
        () => this.handlePeerClose(peerId)
      );
      peer.sendSignal = (signal) => {
        this.sendToPeer(peerId, {
          type: "signal",
          from: this.userId,
          signal
        });
      };
      this.peers.set(peerId, peer);
      if (this.localStream) {
        await peer.addLocalStream(this.localStream);
      }
      if (initiator) {
        const offer = await peer.createOffer();
        this.sendToPeer(peerId, {
          type: "signal",
          from: this.userId,
          signal: { type: "offer", offer }
        });
      }
      if (this.onPeerJoined) {
        this.onPeerJoined(peerId);
      }
    }
    async handleSignal(fromPeerId, signal) {
      let peer = this.peers.get(fromPeerId);
      if (!peer && signal.type === "offer") {
        await this.connectToPeer(fromPeerId, false);
        peer = this.peers.get(fromPeerId);
      }
      if (!peer) return;
      if (signal.type === "offer") {
        const answer = await peer.handleOffer(signal.offer);
        this.sendToPeer(fromPeerId, {
          type: "signal",
          from: this.userId,
          signal: { type: "answer", answer }
        });
      } else if (signal.type === "answer") {
        await peer.handleAnswer(signal.answer);
      } else if (signal.type === "ice-candidate") {
        await peer.handleIceCandidate(signal.candidate);
      }
    }
    async handlePeerMessage(fromPeerId, message) {
      if (message.type === "chat") {
        try {
          const decrypted = await this.encryption.decryptMessage(
            this.roomId,
            message.encrypted
          );
          if (this.onMessage) {
            this.onMessage({
              ...decrypted,
              from: fromPeerId
            });
          }
          if (this.isHost) {
            this.broadcastMessage(message, fromPeerId);
          }
        } catch (error) {
          console.error("Error decrypting message:", error);
        }
      } else if (message.type === "signal") {
        await this.handleSignal(message.from, message.signal);
      } else if (message.type === "peer-joined") {
        if (this.isHost && !this.peers.has(message.peerId)) {
          await this.connectToPeer(message.peerId, true);
        }
      }
    }
    handlePeerStream(peerId, stream) {
      if (this.onStream) {
        this.onStream(peerId, stream);
      }
    }
    handlePeerClose(peerId) {
      this.peers.delete(peerId);
      if (this.onPeerLeft) {
        this.onPeerLeft(peerId);
      }
    }
    async sendMessage(text, username) {
      const message = {
        text,
        username,
        userId: this.userId,
        timestamp: Date.now()
      };
      const encrypted = await this.encryption.encryptMessage(this.roomId, message);
      const packet = {
        type: "chat",
        encrypted,
        from: this.userId
      };
      this.broadcastMessage(packet);
      return message;
    }
    async sendDM(peerId, text, username) {
      const message = {
        text,
        username,
        userId: this.userId,
        timestamp: Date.now(),
        isDM: true
      };
      const encrypted = await this.encryption.encryptMessage(this.roomId, message);
      this.sendToPeer(peerId, {
        type: "chat",
        encrypted,
        from: this.userId
      });
      return message;
    }
    broadcastMessage(message, excludePeer = null) {
      this.peers.forEach((peer, peerId) => {
        if (peerId !== excludePeer) {
          peer.sendMessage(message);
        }
      });
    }
    sendToPeer(peerId, message) {
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.sendMessage(message);
      }
    }
    async enableVideo() {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        this.peers.forEach(async (peer) => {
          await peer.addLocalStream(this.localStream);
        });
        return this.localStream;
      } catch (error) {
        console.error("Error accessing media devices:", error);
        throw error;
      }
    }
    disableVideo() {
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
      }
    }
    leaveRoom() {
      this.peers.forEach((peer) => peer.close());
      this.peers.clear();
      this.disableVideo();
      this.encryption.removeRoom(this.roomId);
      this.roomId = null;
      this.isHost = false;
    }
    getPeerCount() {
      return this.peers.size + 1;
    }
    getPeerIds() {
      return Array.from(this.peers.keys());
    }
  };

  // src/utils/helpers.js
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = /* @__PURE__ */ new Date();
    const diff = now - date;
    if (diff < 6e4) return "Just now";
    if (diff < 36e5) return `${Math.floor(diff / 6e4)}m ago`;
    if (diff < 864e5) return `${Math.floor(diff / 36e5)}h ago`;
    return date.toLocaleDateString();
  }
  function generateColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 70%, 60%)`;
  }

  // src/components/MessageFeed.js
  var MessageFeed = class {
    constructor(messages, profile, onSendMessage) {
      this.messages = messages;
      this.profile = profile;
      this.onSendMessage = onSendMessage;
      this.container = null;
      this.feedContainer = null;
    }
    render() {
      this.container = document.createElement("div");
      this.container.className = "flex-1 flex flex-col bg-gray-900";
      this.feedContainer = document.createElement("div");
      this.feedContainer.className = "flex-1 overflow-y-auto p-4 space-y-3";
      this.messages.forEach((msg) => {
        this.feedContainer.appendChild(this.renderMessage(msg));
      });
      setTimeout(() => this.scrollToBottom(), 0);
      const inputArea = this.renderInputArea();
      this.container.appendChild(this.feedContainer);
      this.container.appendChild(inputArea);
      return this.container;
    }
    renderMessage(message) {
      const messageEl = document.createElement("div");
      const isOwnMessage = message.userId === this.profile.id;
      messageEl.className = `flex ${isOwnMessage ? "justify-end" : "justify-start"}`;
      const bubble = document.createElement("div");
      bubble.className = `max-w-xl px-4 py-2 rounded-lg ${isOwnMessage ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-100"}`;
      if (!isOwnMessage) {
        const username = document.createElement("div");
        username.className = "text-xs font-semibold mb-1";
        username.style.color = generateColor(message.username);
        username.textContent = message.username;
        bubble.appendChild(username);
      }
      const text = document.createElement("div");
      text.className = "break-words";
      text.textContent = message.text;
      bubble.appendChild(text);
      const timestamp = document.createElement("div");
      timestamp.className = `text-xs mt-1 ${isOwnMessage ? "text-purple-200" : "text-gray-500"}`;
      timestamp.textContent = formatTimestamp(message.timestamp);
      bubble.appendChild(timestamp);
      messageEl.appendChild(bubble);
      return messageEl;
    }
    renderInputArea() {
      const inputArea = document.createElement("div");
      inputArea.className = "border-t border-gray-800 p-4 bg-gray-800";
      const form = document.createElement("form");
      form.className = "flex gap-2";
      form.onsubmit = (e) => {
        e.preventDefault();
        this.handleSendMessage(form);
      };
      const input = document.createElement("input");
      input.type = "text";
      input.name = "message";
      input.placeholder = "Type a message...";
      input.className = "flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 text-white";
      input.required = true;
      const sendBtn = document.createElement("button");
      sendBtn.type = "submit";
      sendBtn.className = "px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition";
      sendBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
      </svg>
    `;
      form.appendChild(input);
      form.appendChild(sendBtn);
      inputArea.appendChild(form);
      return inputArea;
    }
    handleSendMessage(form) {
      const formData = new FormData(form);
      const message = formData.get("message");
      if (message.trim()) {
        this.onSendMessage(message.trim());
        form.reset();
      }
    }
    addMessage(message) {
      const messageEl = this.renderMessage(message);
      this.feedContainer.appendChild(messageEl);
      this.scrollToBottom();
    }
    scrollToBottom() {
      if (this.feedContainer) {
        this.feedContainer.scrollTop = this.feedContainer.scrollHeight;
      }
    }
  };

  // src/components/VideoGrid.js
  var VideoGrid = class {
    constructor(streams, localUserId) {
      this.streams = streams;
      this.localUserId = localUserId;
      this.container = null;
      this.videoElements = /* @__PURE__ */ new Map();
    }
    render() {
      this.container = document.createElement("div");
      this.container.className = "bg-gray-950 border-b border-gray-800";
      const streamCount = this.streams.size;
      const gridClass = this.getGridClass(streamCount);
      const grid = document.createElement("div");
      grid.className = `${gridClass} gap-2 p-4 h-64`;
      this.streams.forEach((stream, peerId) => {
        const videoContainer = this.renderVideoElement(peerId, stream);
        grid.appendChild(videoContainer);
      });
      this.container.appendChild(grid);
      return this.container;
    }
    renderVideoElement(peerId, stream) {
      const container = document.createElement("div");
      container.className = "relative bg-gray-900 rounded-lg overflow-hidden";
      container.dataset.peerId = peerId;
      const video = document.createElement("video");
      video.className = "w-full h-full object-cover";
      video.autoplay = true;
      video.playsInline = true;
      video.muted = peerId === this.localUserId;
      video.srcObject = stream;
      const label = document.createElement("div");
      label.className = "absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-60 rounded text-xs text-white";
      label.textContent = peerId === this.localUserId ? "You" : `User ${peerId.substring(0, 4)}`;
      const audioIndicator = document.createElement("div");
      audioIndicator.className = "absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full";
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        audioIndicator.classList.add("hidden");
      }
      container.appendChild(video);
      container.appendChild(label);
      container.appendChild(audioIndicator);
      this.videoElements.set(peerId, container);
      return container;
    }
    getGridClass(count) {
      if (count === 1) return "grid grid-cols-1";
      if (count === 2) return "grid grid-cols-2";
      if (count <= 4) return "grid grid-cols-2 md:grid-cols-4";
      if (count <= 6) return "grid grid-cols-3 md:grid-cols-6";
      return "grid grid-cols-4 md:grid-cols-6";
    }
    addStream(peerId, stream) {
      if (!this.container) return;
      const grid = this.container.querySelector("div");
      const videoContainer = this.renderVideoElement(peerId, stream);
      grid.appendChild(videoContainer);
      grid.className = `${this.getGridClass(this.streams.size)} gap-2 p-4 h-64`;
    }
    removeStream(peerId) {
      const element = this.videoElements.get(peerId);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.videoElements.delete(peerId);
      if (this.container) {
        const grid = this.container.querySelector("div");
        grid.className = `${this.getGridClass(this.streams.size)} gap-2 p-4 h-64`;
      }
    }
  };

  // src/components/DMPanel.js
  var DMPanel = class {
    constructor(peerId, profile, onSendMessage, onClose) {
      this.peerId = peerId;
      this.profile = profile;
      this.onSendMessage = onSendMessage;
      this.onClose = onClose;
      this.messages = [];
      this.container = null;
      this.messagesContainer = null;
    }
    render() {
      this.container = document.createElement("div");
      this.container.className = "w-80 bg-gray-800 border-l border-gray-700 flex flex-col";
      const header = document.createElement("div");
      header.className = "px-4 py-3 border-b border-gray-700 flex justify-between items-center";
      const title = document.createElement("h3");
      title.className = "font-semibold text-purple-400";
      title.textContent = `DM: User${this.peerId.substring(0, 4)}`;
      const closeBtn = document.createElement("button");
      closeBtn.className = "text-gray-400 hover:text-white transition";
      closeBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    `;
      closeBtn.onclick = () => this.onClose();
      header.appendChild(title);
      header.appendChild(closeBtn);
      this.messagesContainer = document.createElement("div");
      this.messagesContainer.className = "flex-1 overflow-y-auto p-4 space-y-3";
      const inputArea = this.renderInputArea();
      this.container.appendChild(header);
      this.container.appendChild(this.messagesContainer);
      this.container.appendChild(inputArea);
      return this.container;
    }
    renderInputArea() {
      const inputArea = document.createElement("div");
      inputArea.className = "border-t border-gray-700 p-3";
      const form = document.createElement("form");
      form.className = "flex gap-2";
      form.onsubmit = (e) => {
        e.preventDefault();
        this.handleSendMessage(form);
      };
      const input = document.createElement("input");
      input.type = "text";
      input.name = "message";
      input.placeholder = "Send DM...";
      input.className = "flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-purple-500 text-white";
      input.required = true;
      const sendBtn = document.createElement("button");
      sendBtn.type = "submit";
      sendBtn.className = "px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition";
      sendBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
      </svg>
    `;
      form.appendChild(input);
      form.appendChild(sendBtn);
      inputArea.appendChild(form);
      return inputArea;
    }
    renderMessage(message) {
      const messageEl = document.createElement("div");
      const isOwnMessage = message.userId === this.profile.id;
      messageEl.className = `flex ${isOwnMessage ? "justify-end" : "justify-start"}`;
      const bubble = document.createElement("div");
      bubble.className = `max-w-[200px] px-3 py-2 rounded-lg ${isOwnMessage ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-100"}`;
      const text = document.createElement("div");
      text.className = "text-sm break-words";
      text.textContent = message.text;
      const timestamp = document.createElement("div");
      timestamp.className = `text-xs mt-1 ${isOwnMessage ? "text-purple-200" : "text-gray-400"}`;
      timestamp.textContent = formatTimestamp(message.timestamp);
      bubble.appendChild(text);
      bubble.appendChild(timestamp);
      messageEl.appendChild(bubble);
      return messageEl;
    }
    handleSendMessage(form) {
      const formData = new FormData(form);
      const message = formData.get("message");
      if (message.trim()) {
        this.onSendMessage(message.trim());
        form.reset();
      }
    }
    addMessage(message) {
      this.messages.push(message);
      const messageEl = this.renderMessage(message);
      this.messagesContainer.appendChild(messageEl);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  };

  // src/components/ChatRoom.js
  var ChatRoom = class {
    constructor(room, profile, webrtc, onLeave) {
      this.room = room;
      this.profile = profile;
      this.webrtc = webrtc;
      this.onLeave = onLeave;
      this.messages = [];
      this.peers = /* @__PURE__ */ new Map();
      this.streams = /* @__PURE__ */ new Map();
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
      window.addEventListener("ninja-message", (e) => {
        this.handleNewMessage(e.detail);
      });
      window.addEventListener("ninja-peer-joined", (e) => {
        this.handlePeerJoined(e.detail);
      });
      window.addEventListener("ninja-peer-left", (e) => {
        this.handlePeerLeft(e.detail);
      });
      window.addEventListener("ninja-stream", (e) => {
        this.handleStream(e.detail.peerId, e.detail.stream);
      });
    }
    render() {
      this.container = document.createElement("div");
      this.container.className = "flex-1 flex flex-col h-screen";
      const header = this.renderHeader();
      const mainContent = document.createElement("div");
      mainContent.className = "flex-1 flex overflow-hidden";
      const chatArea = document.createElement("div");
      chatArea.className = "flex-1 flex flex-col";
      if (this.videoEnabled) {
        this.videoGrid = new VideoGrid(this.streams, this.profile.id);
        chatArea.appendChild(this.videoGrid.render());
      }
      this.messageFeed = new MessageFeed(
        this.messages,
        this.profile,
        (text) => this.sendMessage(text)
      );
      chatArea.appendChild(this.messageFeed.render());
      mainContent.appendChild(chatArea);
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
      const header = document.createElement("div");
      header.className = "bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center";
      const leftSection = document.createElement("div");
      leftSection.className = "flex items-center gap-4";
      const roomInfo = document.createElement("div");
      const roomName = document.createElement("h2");
      roomName.className = "text-xl font-bold text-purple-400";
      roomName.textContent = this.room.name;
      const roomId = document.createElement("p");
      roomId.className = "text-xs text-gray-400 font-mono";
      roomId.textContent = `ID: ${this.room.id.substring(0, 16)}...`;
      roomInfo.appendChild(roomName);
      roomInfo.appendChild(roomId);
      const peerCount = document.createElement("div");
      peerCount.className = "flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full";
      peerCount.innerHTML = `
      <div class="w-2 h-2 bg-green-500 rounded-full"></div>
      <span class="text-sm text-gray-300">${this.webrtc.getPeerCount()} online</span>
    `;
      leftSection.appendChild(roomInfo);
      leftSection.appendChild(peerCount);
      const rightSection = document.createElement("div");
      rightSection.className = "flex items-center gap-3";
      const videoBtn = document.createElement("button");
      videoBtn.className = `px-4 py-2 rounded-lg transition ${this.videoEnabled ? "bg-purple-600 hover:bg-purple-700" : "bg-gray-700 hover:bg-gray-600"}`;
      videoBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
      </svg>
    `;
      videoBtn.onclick = () => this.toggleVideo();
      const copyBtn = document.createElement("button");
      copyBtn.className = "px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition";
      copyBtn.textContent = "Copy ID";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(this.room.id);
        copyBtn.textContent = "Copied!";
        setTimeout(() => copyBtn.textContent = "Copy ID", 2e3);
      };
      const leaveBtn = document.createElement("button");
      leaveBtn.className = "px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition";
      leaveBtn.textContent = "Leave";
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
          alert("Failed to enable video. Please check permissions.");
          return;
        }
      }
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
      const peerCountEl = this.container.querySelector(".peer-count");
      if (peerCountEl) {
        peerCountEl.textContent = `${this.webrtc.getPeerCount()} online`;
      }
    }
  };

  // src/components/RoomCreator.js
  var RoomCreator = class {
    constructor(onCreateRoom, onJoinRoom) {
      this.onCreateRoom = onCreateRoom;
      this.onJoinRoom = onJoinRoom;
      this.mode = "create";
    }
    render() {
      const container = document.createElement("div");
      container.className = "w-full max-w-4xl bg-gray-800 rounded-lg p-6 shadow-lg";
      const tabs = document.createElement("div");
      tabs.className = "flex gap-4 mb-6 border-b border-gray-700";
      const createTab = document.createElement("button");
      createTab.className = `pb-3 px-4 font-semibold transition ${this.mode === "create" ? "text-purple-400 border-b-2 border-purple-400" : "text-gray-400 hover:text-gray-300"}`;
      createTab.textContent = "Create Room";
      createTab.onclick = () => {
        this.mode = "create";
        container.replaceWith(this.render());
      };
      const joinTab = document.createElement("button");
      joinTab.className = `pb-3 px-4 font-semibold transition ${this.mode === "join" ? "text-purple-400 border-b-2 border-purple-400" : "text-gray-400 hover:text-gray-300"}`;
      joinTab.textContent = "Join Room";
      joinTab.onclick = () => {
        this.mode = "join";
        container.replaceWith(this.render());
      };
      tabs.appendChild(createTab);
      tabs.appendChild(joinTab);
      const form = document.createElement("form");
      form.className = "space-y-4";
      form.onsubmit = (e) => {
        e.preventDefault();
        this.handleSubmit(form);
      };
      if (this.mode === "create") {
        const nameGroup = document.createElement("div");
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
        const passphraseGroup = document.createElement("div");
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
        const idGroup = document.createElement("div");
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
        const passphraseGroup = document.createElement("div");
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
      const submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.className = "w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition";
      submitBtn.textContent = this.mode === "create" ? "Create Room" : "Join Room";
      form.appendChild(submitBtn);
      container.appendChild(tabs);
      container.appendChild(form);
      return container;
    }
    handleSubmit(form) {
      const formData = new FormData(form);
      if (this.mode === "create") {
        const roomName = formData.get("roomName");
        const passphrase = formData.get("passphrase");
        this.onCreateRoom(roomName, passphrase);
      } else {
        const roomId = formData.get("roomId");
        const passphrase = formData.get("passphrase");
        this.onJoinRoom(roomId, passphrase);
      }
    }
  };

  // src/components/SettingsSidebar.js
  var SettingsSidebar = class {
    constructor(profile, onClose, onUpdateProfile) {
      this.profile = profile;
      this.onClose = onClose;
      this.onUpdateProfile = onUpdateProfile;
    }
    render() {
      const overlay = document.createElement("div");
      overlay.className = "fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end";
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          this.onClose();
        }
      };
      const sidebar = document.createElement("div");
      sidebar.className = "w-96 bg-gray-800 h-full shadow-2xl flex flex-col";
      sidebar.onclick = (e) => e.stopPropagation();
      const header = document.createElement("div");
      header.className = "px-6 py-4 border-b border-gray-700 flex justify-between items-center";
      const title = document.createElement("h2");
      title.className = "text-2xl font-bold text-purple-400";
      title.textContent = "Settings";
      const closeBtn = document.createElement("button");
      closeBtn.className = "text-gray-400 hover:text-white transition";
      closeBtn.innerHTML = `
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    `;
      closeBtn.onclick = () => this.onClose();
      header.appendChild(title);
      header.appendChild(closeBtn);
      const content = document.createElement("div");
      content.className = "flex-1 overflow-y-auto p-6 space-y-6";
      const profileSection = this.renderProfileSection();
      const aboutSection = this.renderAboutSection();
      content.appendChild(profileSection);
      content.appendChild(aboutSection);
      sidebar.appendChild(header);
      sidebar.appendChild(content);
      overlay.appendChild(sidebar);
      return overlay;
    }
    renderProfileSection() {
      const section = document.createElement("div");
      section.className = "space-y-4";
      const sectionTitle = document.createElement("h3");
      sectionTitle.className = "text-lg font-semibold text-gray-200 mb-4";
      sectionTitle.textContent = "Profile";
      const form = document.createElement("form");
      form.className = "space-y-4";
      form.onsubmit = (e) => {
        e.preventDefault();
        this.handleUpdateProfile(form);
      };
      const usernameGroup = document.createElement("div");
      usernameGroup.innerHTML = `
      <label class="block text-sm font-medium text-gray-300 mb-2">Username</label>
      <input 
        type="text" 
        name="username" 
        value="${this.profile.username}"
        required
        class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 text-white"
      />
    `;
      const userIdGroup = document.createElement("div");
      userIdGroup.innerHTML = `
      <label class="block text-sm font-medium text-gray-300 mb-2">User ID</label>
      <input 
        type="text" 
        value="${this.profile.id}"
        readonly
        class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-400 font-mono text-sm cursor-not-allowed"
      />
      <p class="text-xs text-gray-500 mt-1">This is your unique identifier</p>
    `;
      const saveBtn = document.createElement("button");
      saveBtn.type = "submit";
      saveBtn.className = "w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition";
      saveBtn.textContent = "Save Changes";
      form.appendChild(usernameGroup);
      form.appendChild(userIdGroup);
      form.appendChild(saveBtn);
      section.appendChild(sectionTitle);
      section.appendChild(form);
      return section;
    }
    renderAboutSection() {
      const section = document.createElement("div");
      section.className = "space-y-4 pt-6 border-t border-gray-700";
      const sectionTitle = document.createElement("h3");
      sectionTitle.className = "text-lg font-semibold text-gray-200 mb-4";
      sectionTitle.textContent = "About";
      const info = document.createElement("div");
      info.className = "space-y-3 text-sm text-gray-400";
      info.innerHTML = `
      <div>
        <p class="font-semibold text-purple-400 mb-1">Ninja Chat</p>
        <p>Encrypted P2P chat with WebRTC</p>
      </div>
      <div>
        <p class="font-semibold text-gray-300 mb-1">Features:</p>
        <ul class="list-disc list-inside space-y-1 ml-2">
          <li>End-to-end encrypted messaging</li>
          <li>Peer-to-peer video calls</li>
          <li>Direct messaging</li>
          <li>No server storage</li>
        </ul>
      </div>
      <div class="pt-2">
        <p class="text-xs text-gray-500">
          All communications are encrypted and transmitted directly between peers.
          Messages are not stored on any server.
        </p>
      </div>
    `;
      section.appendChild(sectionTitle);
      section.appendChild(info);
      return section;
    }
    handleUpdateProfile(form) {
      const formData = new FormData(form);
      const username = formData.get("username");
      if (username.trim()) {
        this.onUpdateProfile({ username: username.trim() });
      }
    }
  };

  // src/components/App.js
  var App = class {
    constructor(root, db) {
      this.root = root;
      this.db = db;
      this.profile = null;
      this.currentRoom = null;
      this.webrtc = null;
      this.settingsOpen = false;
      this.state = {
        view: "home",
        // 'home', 'room'
        rooms: []
      };
    }
    async render() {
      this.profile = await this.db.getProfile();
      if (!this.profile) {
        this.profile = {
          id: CryptoUtils.generateId(),
          username: `User${Math.floor(Math.random() * 1e4)}`,
          avatar: null,
          createdAt: Date.now()
        };
        await this.db.saveProfile(this.profile);
      }
      this.webrtc = new WebRTCManager(
        this.profile.id,
        (message) => this.handleMessage(message),
        (peerId) => this.handlePeerJoined(peerId),
        (peerId) => this.handlePeerLeft(peerId),
        (peerId, stream) => this.handleStream(peerId, stream)
      );
      this.state.rooms = await this.db.getRooms();
      this.renderView();
    }
    renderView() {
      this.root.innerHTML = "";
      this.root.className = "w-full h-screen bg-gray-900 text-white flex";
      if (this.state.view === "home") {
        this.renderHome();
      } else if (this.state.view === "room") {
        this.renderRoom();
      }
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
      const container = document.createElement("div");
      container.className = "flex-1 flex flex-col items-center justify-center p-8";
      const header = document.createElement("div");
      header.className = "w-full max-w-4xl mb-8 flex justify-between items-center";
      const title = document.createElement("h1");
      title.className = "text-4xl font-bold text-purple-400";
      title.textContent = "Ninja Chat";
      const settingsBtn = document.createElement("button");
      settingsBtn.className = "px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition";
      settingsBtn.textContent = "Settings";
      settingsBtn.onclick = () => this.openSettings();
      header.appendChild(title);
      header.appendChild(settingsBtn);
      const creator = new RoomCreator(
        (roomName, passphrase) => this.createRoom(roomName, passphrase),
        (roomId, passphrase) => this.joinRoom(roomId, passphrase)
      );
      const savedRooms = document.createElement("div");
      savedRooms.className = "w-full max-w-4xl mt-8";
      if (this.state.rooms.length > 0) {
        const roomsTitle = document.createElement("h2");
        roomsTitle.className = "text-2xl font-semibold mb-4 text-gray-300";
        roomsTitle.textContent = "Saved Rooms";
        savedRooms.appendChild(roomsTitle);
        const roomsList = document.createElement("div");
        roomsList.className = "grid gap-4 grid-cols-1 md:grid-cols-2";
        this.state.rooms.forEach((room) => {
          const roomCard = document.createElement("div");
          roomCard.className = "bg-gray-800 p-4 rounded-lg hover:bg-gray-700 cursor-pointer transition";
          roomCard.onclick = () => {
            const passphrase = prompt("Enter room passphrase:");
            if (passphrase) {
              this.joinRoom(room.id, passphrase);
            }
          };
          const roomName = document.createElement("h3");
          roomName.className = "text-lg font-semibold text-purple-300";
          roomName.textContent = room.name;
          const roomId = document.createElement("p");
          roomId.className = "text-sm text-gray-400 mt-2 font-mono";
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
      this.state.view = "room";
      this.state.rooms = await this.db.getRooms();
      this.renderView();
    }
    async joinRoom(roomId, passphrase) {
      const room = this.state.rooms.find((r) => r.id === roomId);
      if (!room) {
        alert("Room not found");
        return;
      }
      try {
        await this.webrtc.joinRoom(room, passphrase);
        this.currentRoom = {
          id: room.id,
          name: room.name,
          isHost: false
        };
        this.state.view = "room";
        this.renderView();
      } catch (error) {
        console.error("Error joining room:", error);
        alert("Failed to join room. Check passphrase.");
      }
    }
    leaveRoom() {
      this.webrtc.leaveRoom();
      this.currentRoom = null;
      this.state.view = "home";
      this.renderView();
    }
    handleMessage(message) {
      if (this.state.view === "room") {
        window.dispatchEvent(new CustomEvent("ninja-message", { detail: message }));
      }
    }
    handlePeerJoined(peerId) {
      window.dispatchEvent(new CustomEvent("ninja-peer-joined", { detail: peerId }));
    }
    handlePeerLeft(peerId) {
      window.dispatchEvent(new CustomEvent("ninja-peer-left", { detail: peerId }));
    }
    handleStream(peerId, stream) {
      window.dispatchEvent(new CustomEvent("ninja-stream", {
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
  };

  // src/storage/IndexedDBManager.js
  var IndexedDBManager = class {
    constructor() {
      this.dbName = "NinjaChatDB";
      this.version = 1;
      this.db = null;
    }
    async init() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains("profile")) {
            const profileStore = db.createObjectStore("profile", { keyPath: "id" });
            profileStore.createIndex("username", "username", { unique: false });
          }
          if (!db.objectStoreNames.contains("rooms")) {
            const roomsStore = db.createObjectStore("rooms", { keyPath: "id" });
            roomsStore.createIndex("name", "name", { unique: false });
          }
          if (!db.objectStoreNames.contains("messages")) {
            const messagesStore = db.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
            messagesStore.createIndex("roomId", "roomId", { unique: false });
            messagesStore.createIndex("timestamp", "timestamp", { unique: false });
          }
          if (!db.objectStoreNames.contains("dms")) {
            const dmsStore = db.createObjectStore("dms", { keyPath: "id", autoIncrement: true });
            dmsStore.createIndex("conversationId", "conversationId", { unique: false });
          }
        };
      });
    }
    async getProfile() {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["profile"], "readonly");
        const store = transaction.objectStore("profile");
        const request = store.get("main");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async saveProfile(profile) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["profile"], "readwrite");
        const store = transaction.objectStore("profile");
        const request = store.put({ ...profile, id: "main" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async saveRoom(room) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["rooms"], "readwrite");
        const store = transaction.objectStore("rooms");
        const request = store.put(room);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async getRooms() {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["rooms"], "readonly");
        const store = transaction.objectStore("rooms");
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async saveMessage(message) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["messages"], "readwrite");
        const store = transaction.objectStore("messages");
        const request = store.add(message);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async getMessages(roomId, limit = 100) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["messages"], "readonly");
        const store = transaction.objectStore("messages");
        const index = store.index("roomId");
        const request = index.getAll(roomId);
        request.onsuccess = () => {
          const messages = request.result.sort((a, b) => a.timestamp - b.timestamp);
          resolve(messages.slice(-limit));
        };
        request.onerror = () => reject(request.error);
      });
    }
    async saveDM(dm) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["dms"], "readwrite");
        const store = transaction.objectStore("dms");
        const request = store.add(dm);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async getDMs(conversationId) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["dms"], "readonly");
        const store = transaction.objectStore("dms");
        const index = store.index("conversationId");
        const request = index.getAll(conversationId);
        request.onsuccess = () => {
          const dms = request.result.sort((a, b) => a.timestamp - b.timestamp);
          resolve(dms);
        };
        request.onerror = () => reject(request.error);
      });
    }
  };

  // src/main.js
  var NinjaChat = class {
    constructor(rootElement) {
      this.root = rootElement;
      this.db = null;
      this.app = null;
    }
    async init() {
      this.db = new IndexedDBManager();
      await this.db.init();
      this.app = new App(this.root, this.db);
      await this.app.render();
    }
  };
  var main_default = NinjaChat;
  if (typeof window !== "undefined") {
    window.NinjaChat = NinjaChat;
    const root = document.getElementById("ninja-chat-root");
    if (root) {
      const ninja = new NinjaChat(root);
      ninja.init();
    }
  }
})();

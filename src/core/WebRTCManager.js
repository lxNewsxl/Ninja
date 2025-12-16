// src/core/WebRTCManager.js
import { PeerConnection } from './PeerConnection.js';
import { EncryptionManager } from './EncryptionManager.js';

export class WebRTCManager {
  constructor(userId, onMessage, onPeerJoined, onPeerLeft, onStream) {
    this.userId = userId;
    this.onMessage = onMessage;
    this.onPeerJoined = onPeerJoined;
    this.onPeerLeft = onPeerLeft;
    this.onStream = onStream;
    
    this.peers = new Map(); // peerId -> PeerConnection
    this.isHost = false;
    this.roomId = null;
    this.encryption = new EncryptionManager();
    this.localStream = null;
    
    // Signaling queue for when we're joining as non-host
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
    
    // If host is available, signal join
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

    // Override sendSignal to route through this manager
    peer.sendSignal = (signal) => {
      this.sendToPeer(peerId, {
        type: 'signal',
        from: this.userId,
        signal
      });
    };

    this.peers.set(peerId, peer);

    // Add local stream if available
    if (this.localStream) {
      await peer.addLocalStream(this.localStream);
    }

    // If initiator, create offer
    if (initiator) {
      const offer = await peer.createOffer();
      this.sendToPeer(peerId, {
        type: 'signal',
        from: this.userId,
        signal: { type: 'offer', offer }
      });
    }

    if (this.onPeerJoined) {
      this.onPeerJoined(peerId);
    }
  }

  async handleSignal(fromPeerId, signal) {
    let peer = this.peers.get(fromPeerId);

    if (!peer && signal.type === 'offer') {
      // Create peer connection for incoming offer
      await this.connectToPeer(fromPeerId, false);
      peer = this.peers.get(fromPeerId);
    }

    if (!peer) return;

    if (signal.type === 'offer') {
      const answer = await peer.handleOffer(signal.offer);
      this.sendToPeer(fromPeerId, {
        type: 'signal',
        from: this.userId,
        signal: { type: 'answer', answer }
      });
    } else if (signal.type === 'answer') {
      await peer.handleAnswer(signal.answer);
    } else if (signal.type === 'ice-candidate') {
      await peer.handleIceCandidate(signal.candidate);
    }
  }

  async handlePeerMessage(fromPeerId, message) {
    if (message.type === 'chat') {
      // Decrypt and forward
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

        // If host, broadcast to other peers
        if (this.isHost) {
          this.broadcastMessage(message, fromPeerId);
        }
      } catch (error) {
        console.error('Error decrypting message:', error);
      }
    } else if (message.type === 'signal') {
      await this.handleSignal(message.from, message.signal);
    } else if (message.type === 'peer-joined') {
      // New peer announcement
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
      type: 'chat',
      encrypted,
      from: this.userId
    };

    this.broadcastMessage(packet);

    // Return unencrypted for local display
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
      type: 'chat',
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

      // Add stream to all existing peers
      this.peers.forEach(async (peer) => {
        await peer.addLocalStream(this.localStream);
      });

      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  disableVideo() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  leaveRoom() {
    this.peers.forEach(peer => peer.close());
    this.peers.clear();
    this.disableVideo();
    this.encryption.removeRoom(this.roomId);
    this.roomId = null;
    this.isHost = false;
  }

  getPeerCount() {
    return this.peers.size + 1; // +1 for self
  }

  getPeerIds() {
    return Array.from(this.peers.keys());
  }
}

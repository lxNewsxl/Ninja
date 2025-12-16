// src/core/PeerConnection.js
export class PeerConnection {
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
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.pc = new RTCPeerConnection(config);

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ type: 'ice-candidate', candidate: event.candidate });
      }
    };

    // Handle incoming tracks (video/audio)
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onStream) {
          this.onStream(this.remoteStream);
        }
      }
    };

    // Handle connection state
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'disconnected' || 
          this.pc.connectionState === 'failed' ||
          this.pc.connectionState === 'closed') {
        this.close();
      }
    };

    // Setup data channel
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
    this.dataChannel = this.pc.createDataChannel('chat', {
      ordered: true
    });
    this.setupDataChannel();
  }

  setupDataChannel() {
    this.dataChannel.onopen = () => {
      console.log('Data channel opened with', this.peerId);
    };

    this.dataChannel.onmessage = (event) => {
      if (this.onMessage) {
        this.onMessage(JSON.parse(event.data));
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
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
      console.error('Error adding ICE candidate:', error);
    }
  }

  async addLocalStream(stream) {
    stream.getTracks().forEach(track => {
      this.pc.addTrack(track, stream);
    });
  }

  sendMessage(message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    }
  }

  sendSignal(signal) {
    // This should be implemented by the WebRTCManager
    // to route signals through the signaling mechanism
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
}

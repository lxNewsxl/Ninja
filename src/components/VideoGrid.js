// src/components/VideoGrid.js
export class VideoGrid {
  constructor(streams, localUserId) {
    this.streams = streams;
    this.localUserId = localUserId;
    this.container = null;
    this.videoElements = new Map();
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'bg-gray-950 border-b border-gray-800';
    
    // Calculate grid layout based on number of streams
    const streamCount = this.streams.size;
    const gridClass = this.getGridClass(streamCount);
    
    const grid = document.createElement('div');
    grid.className = `${gridClass} gap-2 p-4 h-64`;

    // Render all streams
    this.streams.forEach((stream, peerId) => {
      const videoContainer = this.renderVideoElement(peerId, stream);
      grid.appendChild(videoContainer);
    });

    this.container.appendChild(grid);
    return this.container;
  }

  renderVideoElement(peerId, stream) {
    const container = document.createElement('div');
    container.className = 'relative bg-gray-900 rounded-lg overflow-hidden';
    container.dataset.peerId = peerId;

    const video = document.createElement('video');
    video.className = 'w-full h-full object-cover';
    video.autoplay = true;
    video.playsInline = true;
    video.muted = peerId === this.localUserId; // Mute own video
    video.srcObject = stream;

    // Label
    const label = document.createElement('div');
    label.className = 'absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-60 rounded text-xs text-white';
    label.textContent = peerId === this.localUserId ? 'You' : `User ${peerId.substring(0, 4)}`;

    // Audio indicator
    const audioIndicator = document.createElement('div');
    audioIndicator.className = 'absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full';
    
    // Check if audio is active
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      audioIndicator.classList.add('hidden');
    }

    container.appendChild(video);
    container.appendChild(label);
    container.appendChild(audioIndicator);

    this.videoElements.set(peerId, container);

    return container;
  }

  getGridClass(count) {
    if (count === 1) return 'grid grid-cols-1';
    if (count === 2) return 'grid grid-cols-2';
    if (count <= 4) return 'grid grid-cols-2 md:grid-cols-4';
    if (count <= 6) return 'grid grid-cols-3 md:grid-cols-6';
    return 'grid grid-cols-4 md:grid-cols-6';
  }

  addStream(peerId, stream) {
    if (!this.container) return;

    const grid = this.container.querySelector('div');
    const videoContainer = this.renderVideoElement(peerId, stream);
    grid.appendChild(videoContainer);

    // Update grid class
    grid.className = `${this.getGridClass(this.streams.size)} gap-2 p-4 h-64`;
  }

  removeStream(peerId) {
    const element = this.videoElements.get(peerId);
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
    this.videoElements.delete(peerId);

    // Update grid class
    if (this.container) {
      const grid = this.container.querySelector('div');
      grid.className = `${this.getGridClass(this.streams.size)} gap-2 p-4 h-64`;
    }
  }
}

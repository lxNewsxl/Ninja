// src/core/EncryptionManager.js
import { CryptoUtils } from '../utils/crypto.js';

export class EncryptionManager {
  constructor() {
    this.keys = new Map(); // roomId -> key
    this.salts = new Map(); // roomId -> salt
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
    if (!key) throw new Error('No encryption key for room');
    
    return await CryptoUtils.encrypt(JSON.stringify(message), key);
  }

  async decryptMessage(roomId, encryptedData) {
    const key = this.keys.get(roomId);
    if (!key) throw new Error('No encryption key for room');
    
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
}

let key = null;

export async function setKey(pass) {
  const d = new TextEncoder().encode(pass.padEnd(32).substring(0,32));
  key = await crypto.subtle.importKey("raw", d, "AES-GCM", false, ["encrypt","decrypt"]);
}

export async function encrypt(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, data);
  const a = new Uint8Array(iv.byteLength + c.byteLength);
  a.set(iv,0); a.set(new Uint8Array(c),12);
  return btoa(String.fromCharCode(...a));
}

export async function decrypt(b64) {
  try {
    const a = Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    const iv = a.slice(0,12);
    const c = a.slice(12);
    return await crypto.subtle.decrypt({name:"AES-GCM",iv}, key, c);
  } catch { return null; }
}

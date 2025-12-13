/* ---------- FIREBASE INIT ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyD1Ec6vBbwgPsp6LW6hRe5L3h-0StS_0Qo",
  authDomain: "messageapp-dfab5.firebaseapp.com",
  databaseURL: "https://messageapp-dfab5-default-rtdb.firebaseio.com",
  projectId: "messageapp-dfab5",
  storageBucket: "messageapp-dfab5.firebasestorage.app",
  messagingSenderId: "92698351032",
  appId: "1:92698351032:web:3aca8af02c1eb3a23e2b4d"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentChatId = null;
let currentFriendId = null;
let currentFriendName = null;

// Notification sound
const notificationSound = new Audio('/static/notify.mp3');

// Browser notification permission
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

function notify() {
  notificationSound.play();
  if (Notification.permission === "granted") {
    new Notification("Varta", { body: "New message from " + currentFriendName, icon: "/static/logo.png" });
  }
}

// ENTER APP
function showLogin() {
  document.getElementById('landing').classList.add('d-none');
  document.getElementById('login-container').classList.remove('d-none');
}

// LOGIN
function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) return;

  auth.signInWithEmailAndPassword(email, password)
    .catch(err => {
      if (err.code === 'auth/user-not-found') {
        auth.createUserWithEmailAndPassword(email, password);
      } else {
        alert(err.message);
      }
    });
}

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById('landing').classList.add('d-none');
    document.getElementById('login-container').classList.add('d-none');
    document.getElementById('app-container').classList.remove('d-none');
    loadRecentChats();
  } else {
    document.getElementById('landing').classList.remove('d-none');
    document.getElementById('app-container').classList.add('d-none');
  }
});

document.getElementById('logoutBtn').onclick = () => auth.signOut();

// SAVE PROFILE
function saveProfile() {
  const name = document.getElementById('profile-name').value.trim() || "User";
  const dob = document.getElementById('profile-dob').value;
  const about = document.getElementById('profile-about').value.trim();

  db.ref('profiles/' + currentUser.uid).set({
    name: name,
    dob: dob,
    about: about,
    email: currentUser.email
  }).then(() => {
    alert("Profile saved!");
    bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
  });
}

// GET UID FROM EMAIL
function getUidByEmail(email) {
  return db.ref('profiles').orderByChild('email').equalTo(email).once('value')
    .then(snap => {
      let uid = null;
      snap.forEach(child => uid = child.key);
      return uid;
    });
}

// LOAD RECENT CHATS
function loadRecentChats() {
  const list = document.getElementById('chats-list');
  db.ref('userChats/' + currentUser.uid).on('value', snap => {
    list.innerHTML = '';
    snap.forEach(child => {
      const chatId = child.key;
      const data = child.val();
      const friendId = data.friendUid;

      db.ref('profiles/' + friendId).once('value').then(s => {
        const name = (s.val() || {}).name || "User";
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action p-3';
        li.innerHTML = `<strong>${name}</strong><br><small>${data.lastMsg || "No messages"}</small>`;
        li.onclick = () => openChat(chatId, name, friendId);
        list.appendChild(li);
      });
    });
  });
}

// START NEW CHAT
function startNewChat() {
  const email = document.getElementById('new-chat-email').value.trim();
  if (!email) return alert("Email daal bhai");

  getUidByEmail(email).then(friendId => {
    if (!friendId) return alert("User nahi mila");

    const chatId = [currentUser.uid, friendId].sort().join('_');
    const now = new Date().toISOString();

    db.ref(`userChats/${currentUser.uid}/${chatId}`).set({ lastMsg: "Hi!", timestamp: now, friendUid: friendId });
    db.ref(`userChats/${friendId}/${chatId}`).set({ lastMsg: "Hi!", timestamp: now, friendUid: currentUser.uid });

    bootstrap.Modal.getInstance(document.getElementById('newChatModal')).hide();
    openChat(chatId, email.split('@')[0], friendId);
  });
}

// OPEN CHAT
function openChat(chatId, name, friendId) {
  currentChatId = chatId;
  currentFriendId = friendId;
  currentFriendName = name;
  document.getElementById('chat-title').textContent = name;
  document.getElementById('chat-actions').classList.remove('d-none');

  const box = document.getElementById('messages');
  box.innerHTML = '';

  db.ref('messages/' + chatId).orderByChild('timestamp').on('child_added', snap => {
    const m = snap.val();
    const mine = m.userId === currentUser.uid;

    if (!mine) {
      notify();
    }

    const div = document.createElement('div');
    div.className = mine ? 'message sent' : 'message received';
    div.innerHTML = mine
      ? `<strong>You</strong><br>${m.text}`
      : `<strong>${name}</strong><br>${m.text}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  });
}

// VIEW FRIEND PROFILE (read-only)
function viewFriendProfile() {
  db.ref('profiles/' + currentFriendId).once('value').then(s => {
    const p = s.val() || {};
    alert(`Name: ${p.name || "Not set"}\nDOB: ${p.dob || "Not set"}\nAbout: ${p.about || "No about"}`);
  });
}

// DELETE CURRENT CHAT
function deleteCurrentChat() {
  if (confirm("Delete this chat? (Only from your side)")) {
    db.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove();
    document.getElementById('messages').innerHTML = '';
    document.getElementById('chat-title').textContent = "Select a chat";
    document.getElementById('chat-actions').classList.add('d-none');
  }
}

// SEND MESSAGE
function sendMessage() {
  const text = document.getElementById('message-input').value.trim();
  if (!text || !currentChatId) return;

  db.ref('messages/' + currentChatId).push({
    text,
    userId: currentUser.uid,
    timestamp: new Date().toISOString()
  });

  db.ref('userChats/' + currentUser.uid + '/' + currentChatId).update({ lastMsg: text });
  document.getElementById('message-input').value = '';
}

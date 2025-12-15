// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyD1Ec6vBbwgPsp6LW6hRe5L3h-0StS_0Qo",
  authDomain: "messageapp-dfab5.firebaseapp.com",
  databaseURL: "https://messageapp-dfab5-default-rtdb.firebaseio.com",
  projectId: "messageapp-dfab5",
  storageBucket: "messageapp-dfab5.appspot.com",
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

// ================= NOTIFICATIONS =================
const notificationSound = new Audio('/static/notify.mp3');

if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

function notify(name) {
  notificationSound.play();
  if (Notification.permission === "granted") {
    new Notification("Varta", { body: "New message from " + name });
  }
}

// ================= LOGIN =================
function showLogin() {
  document.getElementById('landing').classList.add('d-none');
  document.getElementById('login-container').classList.remove('d-none');
}

function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) return;

  auth.signInWithEmailAndPassword(email, password)
    .catch(err => {
      if (err.code === 'auth/user-not-found') {
        auth.createUserWithEmailAndPassword(email, password).then(userCred => {
          // auto-create profile entry
          db.ref('profiles/' + userCred.user.uid).set({
            name: "User",
            email: userCred.user.email
          });
        });
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

// ================= PROFILE =================
function saveProfile() {
  const name = document.getElementById('profile-name').value.trim() || "User";
  const dob = document.getElementById('profile-dob').value;
  const about = document.getElementById('profile-about').value.trim();

  db.ref('profiles/' + currentUser.uid).set({
    name, dob, about, email: currentUser.email
  }).then(() => {
    alert("Profile saved!");
    bootstrap.Modal.getInstance(
      document.getElementById('profileModal')
    ).hide();
  });
}

// ✅ VIEW OWN PROFILE
function viewMyProfile() {
  db.ref('profiles/' + currentUser.uid).once('value').then(s => {
    const p = s.val() || {};
    alert(
      `Your Profile\n\n` +
      `Name: ${p.name || "Not set"}\n` +
      `Email: ${p.email || "Not set"}\n` +
      `DOB: ${p.dob || "Not set"}\n` +
      `About: ${p.about || "Not set"}`
    );
  });
}

// ================= UTIL =================
function getUidByEmail(email) {
  return db.ref('profiles')
    .orderByChild('email')
    .equalTo(email)
    .once('value')
    .then(snap => {
      let uid = null;
      snap.forEach(c => uid = c.key);
      return uid;
    });
}

// ================= CHAT LIST =================
function loadRecentChats() {
  const list = document.getElementById('chats-list');

  db.ref('userChats/' + currentUser.uid).on('value', snap => {
    list.innerHTML = '';

    snap.forEach(child => {
      const chatId = child.key;
      const data = child.val();
      const friendId = data.friendUid;

      db.ref('profiles/' + friendId).once('value').then(pSnap => {
        const name = (pSnap.val() || {}).name || "User";

        const unread =
          data.lastMsg &&
          data.lastSeen &&
          data.timestamp > data.lastSeen;

        // format last message time
        const time = data.timestamp
          ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : "";

        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action p-3 d-flex justify-content-between align-items-center';

        li.innerHTML = `
          <div>
            <strong>${name}</strong><br>
            <small>${data.lastMsg || "No messages"} ${time}</small>
          </div>
          ${unread ? `<span class="badge bg-danger rounded-pill">●</span>` : ``}
        `;

        li.onclick = () => openChat(chatId, name, friendId);
        list.appendChild(li);
      });
    });
  });
}

// ================= START CHAT =================
function startNewChat() {
  const email = document.getElementById('new-chat-email').value.trim();
  if (!email) return alert("Enter email");

  getUidByEmail(email).then(friendId => {
    if (!friendId) return alert("User not found");

    const chatId = [currentUser.uid, friendId].sort().join('_');
    const now = new Date().toISOString();

    db.ref(`userChats/${currentUser.uid}/${chatId}`).set({
      friendUid: friendId,
      lastMsg: "Chat started",
      timestamp: now,
      lastSeen: now
    });

    db.ref(`userChats/${friendId}/${chatId}`).set({
      friendUid: currentUser.uid,
      lastMsg: "Chat started",
      timestamp: now,
      lastSeen: now
    });

    bootstrap.Modal.getInstance(
      document.getElementById('newChatModal')
    ).hide();

    openChat(chatId, email.split('@')[0], friendId);
  });
}

// ================= OPEN CHAT =================
function openChat(chatId, name, friendId) {
  currentChatId = chatId;
  currentFriendId = friendId;
  currentFriendName = name;

  document.getElementById('chat-title').textContent = name;
  document.getElementById('chat-actions').classList.remove('d-none');

  const box = document.getElementById('messages');
  box.innerHTML = '';

  const now = new Date().toISOString();
  db.ref(`userChats/${currentUser.uid}/${chatId}`).update({
    lastSeen: now
  });

  db.ref('messages/' + chatId).off();

  db.ref('messages/' + chatId)
    .orderByChild('timestamp')
    .on('child_added', snap => {
      const m = snap.val();
      const mine = m.userId === currentUser.uid;

      if (!mine) notify(name);

      // format timestamp
      const time = new Date(m.timestamp).toLocaleString([], {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
      });

      const div = document.createElement('div');
      div.className = mine ? 'message sent' : 'message received';
      div.innerHTML = `
        <strong>${mine ? "You" : name}</strong><br>
        ${m.text}
        <div class="text-muted" style="font-size:0.8em; margin-top:4px;">${time}</div>
      `;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    });
}

// ================= FRIEND PROFILE =================
function viewFriendProfile() {
  db.ref('profiles/' + currentFriendId).once('value').then(s => {
    const p = s.val() || {};
    alert(
      `Name: ${p.name || "Not set"}\n` +
      `DOB: ${p.dob || "Not set"}\n` +
      `About: ${p.about || "Not set"}`
    );
  });
}

// ================= DELETE CHAT =================
function deleteCurrentChat() {
  if (!currentChatId) return;

  if (confirm("Delete this chat?")) {
    db.ref(`userChats/${currentUser.uid}/${currentChatId}`).remove();
    document.getElementById('messages').innerHTML = '';
    document.getElementById('chat-title').textContent = "Select a chat";
    document.getElementById('chat-actions').classList.add('d-none');
  }
}

// ================= SEND MESSAGE =================
function sendMessage() {
  const text = document.getElementById('message-input').value.trim();}

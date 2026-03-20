// ===========================
// UniMarket — app.js
// Firebase: Auth + Firestore + Storage
// ===========================

const firebaseConfig = {
  apiKey: "AIzaSyBkrVCmvxgDu-OGbfx_QYmbVzoB3UHdUns",
  authDomain: "martket-digital.firebaseapp.com",
  projectId: "martket-digital",
  storageBucket: "martket-digital.firebasestorage.app",
  messagingSenderId: "525639613105",
  appId: "1:525639613105:web:ca106003a61b9125784090",
  measurementId: "G-HLW0N1DTE5"
};

firebase.initializeApp(firebaseConfig);
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// === STATE ===
let currentUser      = null;
let currentUserData  = null;
let allProducts      = [];
let filteredProducts = [];
let activeFaculty    = 'all';
let activeCategory   = 'all';
let activeConversation = null;
let msgUnsubscribe   = null;
let postImages       = [];   // { file, dataUrl }

// ============================
// AUTH
// ============================
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    const snap = await db.collection('users').doc(user.uid).get();
    currentUserData = snap.data() || {};
    showApp();
    loadProducts();
    listenUnreadMessages();
    updateNavAvatar();
  } else {
    currentUser = null;
    currentUserData = {};
    showAuthOverlay();
  }
});

function showAuthOverlay() {
  document.getElementById('auth-overlay').classList.add('active');
  document.getElementById('app').classList.add('hidden');
}
function showApp() {
  document.getElementById('auth-overlay').classList.remove('active');
  document.getElementById('app').classList.remove('hidden');
  openSection('home');
}

async function login() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  setAuthMsg('');
  if (!email || !password) return setAuthMsg('กรุณากรอกข้อมูลให้ครบ', 'error');
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (e) {
    setAuthMsg(translateFirebaseError(e.code), 'error');
  }
}

async function signup() {
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const faculty  = document.getElementById('signup-faculty').value;
  const password = document.getElementById('signup-password').value;
  setAuthMsg('');
  if (!name || !email || !faculty || !password) return setAuthMsg('กรุณากรอกข้อมูลให้ครบ', 'error');
  if (password.length < 6) return setAuthMsg('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    await db.collection('users').doc(cred.user.uid).set({
      name, email, faculty,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    setAuthMsg('สมัครสมาชิกสำเร็จ! 🎉', 'success');
  } catch (e) {
    setAuthMsg(translateFirebaseError(e.code), 'error');
  }
}

async function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const user   = result.user;
    const snap   = await db.collection('users').doc(user.uid).get();
    if (!snap.exists) {
      await db.collection('users').doc(user.uid).set({
        name: user.displayName || '',
        email: user.email || '',
        faculty: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (e) {
    setAuthMsg(translateFirebaseError(e.code), 'error');
  }
}

async function logout() {
  await auth.signOut();
  showToast('ออกจากระบบแล้ว');
  toggleProfileMenu(false);
}

function setAuthMsg(msg, type = '') {
  const el = document.getElementById('auth-message');
  el.textContent = msg;
  el.className = 'auth-msg' + (type ? ' ' + type : '');
}

function switchTab(tab) {
  document.getElementById('login-form').classList.toggle('active', tab === 'login');
  document.getElementById('signup-form').classList.toggle('active', tab === 'signup');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  setAuthMsg('');
}

function togglePassword(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

function translateFirebaseError(code) {
  const map = {
    'auth/user-not-found':    'ไม่พบบัญชีผู้ใช้นี้',
    'auth/wrong-password':    'รหัสผ่านไม่ถูกต้อง',
    'auth/email-already-in-use': 'อีเมลนี้ถูกใช้งานแล้ว',
    'auth/invalid-email':     'รูปแบบอีเมลไม่ถูกต้อง',
    'auth/weak-password':     'รหัสผ่านต้องมีอย่างน้อย 6 ตัว',
    'auth/too-many-requests': 'ลองใหม่อีกครั้งภายหลัง',
    'auth/popup-closed-by-user': 'ยกเลิกการเข้าสู่ระบบ',
  };
  return map[code] || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

function updateNavAvatar() {
  if (!currentUser) return;
  const img  = document.getElementById('nav-avatar-img');
  const fb   = document.getElementById('nav-avatar-fallback');
  const pdName    = document.getElementById('pd-name');
  const pdFaculty = document.getElementById('pd-faculty');
  if (currentUser.photoURL) {
    img.src = currentUser.photoURL;
    img.style.display = 'block';
    fb.style.display  = 'none';
  } else {
    img.style.display = 'none';
    fb.style.display  = 'flex';
  }
  pdName.textContent    = currentUserData?.name || currentUser.displayName || 'ผู้ใช้';
  pdFaculty.textContent = currentUserData?.faculty || '';
}

function toggleProfileMenu(force) {
  const dd = document.getElementById('profile-dropdown');
  if (force === false) { dd.classList.remove('open'); return; }
  dd.classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-avatar')) toggleProfileMenu(false);
});

// ============================
// NAVIGATION
// ============================
function openSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('section-' + name);
  if (target) target.classList.add('active');
  toggleProfileMenu(false);
  if (name === 'myitems') loadMyProducts();
  if (name === 'chat')    loadChatList();
}

// ============================
// PRODUCTS
// ============================
async function loadProducts() {
  try {
    const snap = await db.collection('products')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(80)
      .get();
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    applyFilters();
    updateStats();
  } catch (e) {
    document.getElementById('products-grid').innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>โหลดสินค้าไม่สำเร็จ</p></div>';
  }
}

async function updateStats() {
  document.getElementById('stat-products').textContent = allProducts.length;
  try {
    const usersSnap = await db.collection('users').get();
    document.getElementById('stat-users').textContent = usersSnap.size;
  } catch (_) {}
}

function applyFilters() {
  let list = [...allProducts];
  if (activeFaculty !== 'all') list = list.filter(p => p.faculty === activeFaculty);
  if (activeCategory !== 'all') list = list.filter(p => p.category === activeCategory);
  const q = document.getElementById('search-input')?.value.toLowerCase() || '';
  if (q) list = list.filter(p =>
    p.title?.toLowerCase().includes(q) ||
    p.description?.toLowerCase().includes(q) ||
    p.category?.toLowerCase().includes(q)
  );
  filteredProducts = list;
  renderProducts(filteredProducts, 'products-grid');
}

function renderProducts(products, containerId) {
  const grid = document.getElementById(containerId);
  if (!products.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>ไม่มีสินค้าในขณะนี้</p></div>';
    return;
  }
  grid.innerHTML = products.map(p => productCardHTML(p)).join('');
}

function productCardHTML(p) {
  const imgHTML = p.images && p.images.length
    ? `<img src="${p.images[0]}" alt="${p.title}" loading="lazy" />`
    : `<i class="fa-solid fa-image no-img"></i>`;
  const price = formatPrice(p.price);
  return `
    <div class="product-card" onclick="openProductDetail('${p.id}')">
      <div class="product-card-img">${imgHTML}</div>
      <div class="product-card-body">
        <div class="product-card-title">${esc(p.title)}</div>
        <div class="product-card-price">${price}</div>
        <div class="product-card-meta">
          <span class="product-card-tag">${esc(p.category || '')}</span>
          <span class="product-card-condition">${esc(p.condition || '')}</span>
        </div>
        <div class="product-card-faculty"><i class="fa-solid fa-graduation-cap"></i> ${esc(p.faculty || '')}</div>
        <div class="product-card-seller"><i class="fa-solid fa-user-circle"></i> ${esc(p.sellerName || '')}</div>
      </div>
    </div>`;
}

async function openProductDetail(productId) {
  openSection('detail');
  const container = document.getElementById('product-detail-content');
  container.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...</div>';
  try {
    const snap = await db.collection('products').doc(productId).get();
    if (!snap.exists) { container.innerHTML = '<p>ไม่พบสินค้า</p>'; return; }
    const p = { id: snap.id, ...snap.data() };
    const isOwner = currentUser && p.sellerId === currentUser.uid;
    const imgs = p.images && p.images.length ? p.images : [];
    const thumbsHTML = imgs.map((url, i) =>
      `<img class="detail-thumb ${i===0?'active':''}" src="${url}" onclick="switchDetailImg(this, '${url}')" />`
    ).join('');
    container.innerHTML = `
      <div class="detail-layout">
        <div class="detail-imgs">
          ${imgs.length
            ? `<img id="detail-main-img" class="detail-main-img" src="${imgs[0]}" />`
            : `<div style="height:300px;background:var(--bg);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:60px;color:#ddd"><i class="fa-solid fa-image"></i></div>`
          }
          ${imgs.length > 1 ? `<div class="detail-thumb-row">${thumbsHTML}</div>` : ''}
        </div>
        <div class="detail-info">
          <h1>${esc(p.title)}</h1>
          <div class="detail-price">${formatPrice(p.price)}</div>
          <div class="detail-badges">
            <span class="detail-badge"><i class="fa-solid fa-tag"></i> ${esc(p.category||'')}</span>
            <span class="detail-badge"><i class="fa-solid fa-star"></i> ${esc(p.condition||'')}</span>
            <span class="detail-badge"><i class="fa-solid fa-graduation-cap"></i> ${esc(p.faculty||'')}</span>
          </div>
          <p class="detail-desc">${esc(p.description||'ไม่มีรายละเอียด')}</p>
          <div class="detail-seller">
            <div class="seller-avatar-sm"><i class="fa-solid fa-user"></i></div>
            <div>
              <div style="font-weight:600">${esc(p.sellerName||'ผู้ขาย')}</div>
              ${p.contact ? `<div class="detail-contact"><i class="fa-solid fa-phone"></i> ${esc(p.contact)}</div>` : ''}
            </div>
          </div>
          <div class="detail-actions">
            ${!isOwner
              ? `<button class="btn-chat" onclick="startChat('${p.id}','${p.sellerId}','${esc(p.sellerName||'')}','${esc(p.title)}')">
                   <i class="fa-solid fa-comment-dots"></i> ติดต่อผู้ขาย
                 </button>`
              : `<button class="btn-delete" onclick="deleteProduct('${p.id}')">
                   <i class="fa-solid fa-trash"></i> ลบประกาศ
                 </button>`
            }
            <button class="btn-outline" onclick="openSection('home')">
              <i class="fa-solid fa-arrow-left"></i> กลับหน้าหลัก
            </button>
          </div>
        </div>
      </div>`;
  } catch (e) {
    container.innerHTML = '<p>โหลดสินค้าไม่สำเร็จ</p>';
  }
}

function switchDetailImg(el, url) {
  document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('detail-main-img').src = url;
}

function filterFaculty(faculty, btn) {
  activeFaculty = faculty;
  document.querySelectorAll('.fac-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function filterCategory(cat, btn) {
  activeCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function searchProducts() { applyFilters(); }

// ============================
// POST PRODUCT
// ============================
function previewImages(event) {
  const files = Array.from(event.target.files);
  const preview = document.getElementById('img-preview-list');
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      postImages.push({ file, dataUrl: e.target.result });
      renderPreview(preview);
    };
    reader.readAsDataURL(file);
  });
}

function renderPreview(container) {
  container.innerHTML = postImages.map((img, i) => `
    <div class="img-preview-item">
      <img src="${img.dataUrl}" />
      <button class="rm-img" onclick="removePreviewImg(${i})"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');
}

function removePreviewImg(i) {
  postImages.splice(i, 1);
  renderPreview(document.getElementById('img-preview-list'));
}

async function postProduct() {
  if (!currentUser) return showToast('กรุณาเข้าสู่ระบบก่อน', 'error');
  const title     = document.getElementById('post-title').value.trim();
  const price     = parseFloat(document.getElementById('post-price').value);
  const category  = document.getElementById('post-category').value;
  const faculty   = document.getElementById('post-faculty').value;
  const condition = document.querySelector('input[name="condition"]:checked')?.value || 'ดี';
  const desc      = document.getElementById('post-desc').value.trim();
  const contact   = document.getElementById('post-contact').value.trim();

  if (!title || isNaN(price) || !category || !faculty)
    return showToast('กรุณากรอกข้อมูลให้ครบ *', 'error');

  const btn = document.querySelector('#section-post .btn-primary.large');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังลง...';

  try {
    let imageUrls = [];
    for (const imgObj of postImages) {
      const ref = storage.ref(`products/${currentUser.uid}/${Date.now()}_${imgObj.file.name}`);
      await ref.put(imgObj.file);
      const url = await ref.getDownloadURL();
      imageUrls.push(url);
    }
    await db.collection('products').add({
      title, price, category, faculty, condition,
      description: desc, contact,
      images:      imageUrls,
      sellerId:    currentUser.uid,
      sellerName:  currentUserData?.name || currentUser.displayName || 'ผู้ขาย',
      status:      'active',
      createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('ลงประกาศสำเร็จ! 🎉', 'success');
    // Reset form
    ['post-title','post-price','post-desc','post-contact'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('post-category').value = '';
    document.getElementById('post-faculty').value = '';
    postImages = [];
    document.getElementById('img-preview-list').innerHTML = '';
    openSection('home');
    loadProducts();
  } catch (e) {
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ลงประกาศสินค้า';
  }
}

async function deleteProduct(productId) {
  if (!confirm('ต้องการลบประกาศนี้?')) return;
  try {
    await db.collection('products').doc(productId).update({ status: 'deleted' });
    showToast('ลบประกาศแล้ว');
    openSection('home');
    loadProducts();
  } catch (e) {
    showToast('เกิดข้อผิดพลาด', 'error');
  }
}

async function loadMyProducts() {
  if (!currentUser) return;
  const grid = document.getElementById('my-products-grid');
  grid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...</div>';
  try {
    const snap = await db.collection('products')
      .where('sellerId', '==', currentUser.uid)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .get();
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts(products, 'my-products-grid');
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>โหลดไม่สำเร็จ</p></div>';
  }
}

// ============================
// CHAT
// ============================
function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

async function startChat(productId, sellerId, sellerName, productTitle) {
  if (!currentUser) return;
  if (sellerId === currentUser.uid) {
    showToast('ไม่สามารถแชทกับตัวเองได้', 'error'); return;
  }
  const chatId = getChatId(currentUser.uid, sellerId);
  // Create or update chat doc
  await db.collection('chats').doc(chatId).set({
    participants: [currentUser.uid, sellerId],
    participantNames: {
      [currentUser.uid]: currentUserData?.name || currentUser.displayName || 'ผู้ใช้',
      [sellerId]: sellerName
    },
    productId, productTitle,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  openSection('chat');
  loadChatList();
  setTimeout(() => openChatWindow(chatId, sellerName), 300);
}

async function loadChatList() {
  if (!currentUser) return;
  const list = document.getElementById('chat-list');
  try {
    const snap = await db.collection('chats')
      .where('participants', 'array-contains', currentUser.uid)
      .orderBy('updatedAt', 'desc')
      .get();
    if (snap.empty) {
      list.innerHTML = '<p class="empty-chat">ยังไม่มีการสนทนา</p>';
      return;
    }
    list.innerHTML = snap.docs.map(d => {
      const c    = d.data();
      const other = c.participants.find(id => id !== currentUser.uid);
      const name  = c.participantNames?.[other] || 'ผู้ใช้';
      const preview = c.lastMessage || c.productTitle || '—';
      const time    = c.updatedAt?.toDate ? timeAgo(c.updatedAt.toDate()) : '';
      return `<div class="chat-item" onclick="openChatWindow('${d.id}', '${esc(name)}')">
        <div class="chat-avatar-sm"><i class="fa-solid fa-user"></i></div>
        <div class="chat-item-info">
          <div class="chat-item-name">${esc(name)}</div>
          <div class="chat-item-preview">${esc(preview)}</div>
        </div>
        <div class="chat-item-time">${time}</div>
      </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = '<p class="empty-chat">โหลดไม่สำเร็จ</p>';
  }
}

function openChatWindow(chatId, otherName) {
  activeConversation = chatId;
  document.querySelectorAll('.chat-item').forEach(el => {
    el.classList.toggle('active', el.onclick?.toString().includes(chatId));
  });
  const main = document.getElementById('chat-main');
  main.innerHTML = `
    <div class="chat-window">
      <div class="chat-window-header">
        <div class="chat-avatar-sm"><i class="fa-solid fa-user"></i></div>
        <span>${esc(otherName)}</span>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-bar">
        <input type="text" id="msg-input" placeholder="พิมพ์ข้อความ..." onkeydown="if(event.key==='Enter')sendMessage()" />
        <button class="send-btn" onclick="sendMessage()"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    </div>`;
  if (msgUnsubscribe) msgUnsubscribe();
  msgUnsubscribe = db.collection('chats').doc(chatId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      const container = document.getElementById('chat-messages');
      if (!container) return;
      container.innerHTML = snap.docs.map(d => {
        const m  = d.data();
        const me = m.senderId === currentUser.uid;
        const ts = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '';
        return `<div class="msg-bubble ${me ? 'me' : 'other'}">
          ${esc(m.text)}
          <div class="msg-time">${ts}</div>
        </div>`;
      }).join('');
      container.scrollTop = container.scrollHeight;
    });
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text || !activeConversation || !currentUser) return;
  input.value = '';
  try {
    await db.collection('chats').doc(activeConversation).collection('messages').add({
      text,
      senderId:   currentUser.uid,
      senderName: currentUserData?.name || currentUser.displayName || 'ผู้ใช้',
      createdAt:  firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('chats').doc(activeConversation).update({
      lastMessage: text,
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    showToast('ส่งข้อความไม่สำเร็จ', 'error');
  }
}

function listenUnreadMessages() {
  if (!currentUser) return;
  db.collection('chats')
    .where('participants', 'array-contains', currentUser.uid)
    .onSnapshot(snap => {
      const badge = document.getElementById('msg-badge');
      const count = snap.size;
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    });
}

// ============================
// CALCULATOR
// ============================
function addCalcItem() {
  const list = document.getElementById('calc-items-list');
  const row  = document.createElement('div');
  row.className = 'calc-item-row';
  row.innerHTML = `
    <input type="text" placeholder="รายการ" class="calc-item-name" />
    <input type="number" placeholder="จำนวน" class="calc-item-qty" value="1" min="1" />
    <input type="number" placeholder="ราคา/หน่วย" class="calc-item-price" />
    <button class="calc-remove-btn" onclick="removeCalcItem(this)"><i class="fa-solid fa-trash"></i></button>`;
  list.appendChild(row);
}

function removeCalcItem(btn) {
  btn.closest('.calc-item-row').remove();
  updateCalc();
}

function updateCalc() {
  let subtotal = 0;
  document.querySelectorAll('.calc-item-row').forEach(row => {
    const qty   = parseFloat(row.querySelector('.calc-item-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.calc-item-price')?.value) || 0;
    subtotal += qty * price;
  });
  const shipping = parseFloat(document.getElementById('calc-shipping').value) || 0;
  const discount = parseFloat(document.getElementById('calc-discount').value) || 0;
  const discounted = subtotal * (1 - discount / 100);
  const total      = discounted + shipping;
  document.getElementById('calc-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('calc-total').textContent    = formatPrice(total);
}

function clearCalc() {
  const list = document.getElementById('calc-items-list');
  list.innerHTML = `
    <div class="calc-item-row">
      <input type="text" placeholder="รายการ" class="calc-item-name" />
      <input type="number" placeholder="จำนวน" class="calc-item-qty" value="1" min="1" />
      <input type="number" placeholder="ราคา/หน่วย" class="calc-item-price" />
      <button class="calc-remove-btn" onclick="removeCalcItem(this)"><i class="fa-solid fa-trash"></i></button>
    </div>`;
  document.getElementById('calc-shipping').value = 0;
  document.getElementById('calc-discount').value = 0;
  document.getElementById('calc-subtotal').textContent = '฿0';
  document.getElementById('calc-total').textContent    = '฿0';
}

// ============================
// UTILS
// ============================
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(n) {
  if (n === undefined || n === null || isNaN(n)) return '฿—';
  return '฿' + Number(n).toLocaleString('th-TH');
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)   return 'เมื่อกี้';
  if (diff < 3600) return Math.floor(diff/60)   + ' น.ที่แล้ว';
  if (diff < 86400)return Math.floor(diff/3600)  + ' ชม.ที่แล้ว';
  return Math.floor(diff/86400) + ' วันที่แล้ว';
}

let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

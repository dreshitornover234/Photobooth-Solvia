
// =================================================================
// PHOTOBOUTH SOlVIA 2.0 - Full script with Firebase Storage + Firestore
// =================================================================

// ----------------- FIREBASE (IMPORT + INIT) -----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getStorage, ref as sRef, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";
import { getFirestore, collection, addDoc, query, orderBy, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ---------- THAY BẰNG CẤU HÌNH FIREBASE CỦA BẠN -------------
const firebaseConfig = {
  apiKey: "AIzaSyDhTpzZw4kWvlNjPag1CguFmQy-XoRQl_4",
    authDomain: "chat-3407.firebaseapp.com",
    databaseURL: "https://chat-3407-default-rtdb.firebaseio.com",
    projectId: "chat-3407",
    storageBucket: "chat-3407.appspot.com",
    messagingSenderId: "645134241923",
    appId: "1:645134241923:web:3479bed824394302aa4bb6",
    measurementId: "G-X3EL784VPT"
};

// Khởi tạo Firebase (try/catch để không crash nếu chưa cấu hình)
let storage = null, db = null;
try {
  const app = initializeApp(firebaseConfig);
  storage = getStorage(app);
  db = getFirestore(app);
  console.log("Firebase initialized.");
} catch (err) {
  console.warn("Firebase initialization failed or not configured. Falling back to localStorage. Error:", err);
}

// Helper: upload base64 dataURL -> Firebase Storage
async function uploadImageToStorage(base64DataUrl, storagePath) {
  if (!storage) throw new Error("Firebase Storage not initialized");
  const ref = sRef(storage, storagePath);
  await uploadString(ref, base64DataUrl, 'data_url');
  const url = await getDownloadURL(ref);
  return { url, fullPath: ref.fullPath };
}

// Helper: add metadata to Firestore
async function addGalleryRecordToFirestore({ storagePath, downloadURL, layout }) {
  if (!db) throw new Error("Firestore not initialized");
  const col = collection(db, 'solviaGallery');
  const doc = await addDoc(col, {
    storagePath,
    src: downloadURL,
    layout,
    createdAt: serverTimestamp()
  });
  return doc.id;
}

// Helper: fetch gallery from Firestore
async function fetchGalleryFromFirestore() {
  if (!db) throw new Error("Firestore not initialized");
  const col = collection(db, 'solviaGallery');
  const q = query(col, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const items = [];
  snap.forEach(doc => {
    const data = doc.data();
    items.push({
      id: doc.id,
      src: data.src,
      layout: data.layout || '4_VERTICAL'
    });
  });
  return items;
}

// Expose firebase helpers for debug if needed
window.__firebaseHelpers = {
  uploadImageToStorage,
  addGalleryRecordToFirestore,
  fetchGalleryFromFirestore,
  storageInitialized: !!storage,
  firestoreInitialized: !!db
};

// ----------------- APPLICATION STATE -----------------------------
const state = {
    currentScreen: 'homeScreen',
    settings: {
        layout: '4_VERTICAL',
        timer: 5,
        frame: 'classic_pink',
    },
    capturedPhotos: [],
    stream: null,
    gallery: {
        scale: 0.5, panX: 0, panY: 0,
        targetScale: 0.5, targetPanX: 0, targetPanY: 0,
        isPanning: false,
        hasDragged: false,
        startX: 0,
        startY: 0,
    }
};

// ----------------- DOM ELEMENTS -----------------------------
const screens = {
  home: document.getElementById('homeScreen'),
  settings: document.getElementById('settingsScreen'),
  capture: document.getElementById('captureScreen'),
  edit: document.getElementById('editScreen'),
  gallery: document.getElementById('galleryScreen'),
};
const videoEl = document.getElementById('video');
const videoContainer = document.getElementById('videoContainer');
const hiddenCanvas = document.getElementById('hiddenCanvas');
const finalCanvas = document.getElementById('finalCanvasPreview');
const loadingOverlay = document.getElementById('loadingOverlay');
const galleryGrid = document.getElementById('galleryGrid');
const lightboxOverlay = document.getElementById('lightboxOverlay');
const lightboxImage = document.getElementById('lightboxImage');
const closeLightbox = document.getElementById('closeLightbox');

// ----------------- NAVIGATION -----------------------------
async function showScreen(screenId) {
    console.log(`Chuyển màn hình sang: ${screenId}`);
    window.showScreen = showScreen;
    if (state.currentScreen === 'galleryScreen') {
        screens.gallery.removeEventListener('wheel', handleZoom);
        screens.gallery.removeEventListener('mousedown', handlePanStart);
        window.removeEventListener('mousemove', handlePanMove);
        window.removeEventListener('mouseup', handlePanEnd);
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
    }
    if (state.currentScreen === 'captureScreen' || state.currentScreen === 'editScreen') {
        if (state.stream) { state.stream.getTracks().forEach(track => track.stop()); state.stream = null; }
    }
    Object.values(screens).forEach(screen => screen?.classList?.add('hidden'));
    document.getElementById(screenId)?.classList.remove('hidden');
    state.currentScreen = screenId;

    if (screenId === 'captureScreen') startCamera();
    if (screenId === 'galleryScreen') await initGallery();
}

// ----------------- CONFIG DATA -----------------------------
const layouts = [
  { id: '1_PHOTO', name: '1 Ảnh đơn', count: 1 },
  { id: '4_VERTICAL', name: '4 Ảnh dọc', count: 4 },
  { id: '4_GRID', name: '4 Ảnh lưới', count: 4 },
  { id: '8_VERTICAL', name: '8 Ảnh (2 dải)', count: 8 },
];
const frames = [
  { id: 'classic_pink', name: 'Hồng cổ điển' }, { id: 'polaroid', name: 'Polaroid' }, { id: 'film_strip', name: 'Dải phim' },
  { id: 'neon_pink', name: 'Hồng Neon' }, { id: 'sunset_orange', name: 'Cam hoàng hôn' }, { id: 'dreamy_purple', name: 'Tím mộng mơ' },
  { id: 'confetti', name: 'Pháo hoa giấy' }, { id: 'starlight', name: 'Bầu trời sao' }, { id: 'minimalist', name: 'Tối giản' },
];
const filters = [
  { id: 'none', name: 'Gốc' }, { id: 'cool', name: 'Tông lạnh' }, { id: 'warm', name: 'Tông ấm' },
  { id: 'vibrant', name: 'Rực rỡ' }, { id: 'mono', name: 'Đơn sắc' }, { id: 'dreamy', name: 'Mơ màng' }
];

// ----------------- UI INIT -----------------------------
function initializeUI() {
    console.log("Khởi tạo UI...");
    const layoutContainer = document.getElementById('layoutSelection');
    layoutContainer.innerHTML = '';
    layouts.forEach((layout, index) => {
        const isChecked = index === 1 ? 'checked' : '';
        let previewHTML = '';
        switch(layout.id) {
            case '1_PHOTO': previewHTML = `<div class="layout-preview preview-1_PHOTO"><div class="photo"></div></div>`; break;
            case '4_VERTICAL': previewHTML = `<div class="layout-preview preview-4_VERTICAL"><div class="photo"></div><div class="photo"></div><div class="photo"></div><div class="photo"></div></div>`; break;
            case '4_GRID': previewHTML = `<div class="layout-preview preview-4_GRID"><div class="photo"></div><div class="photo"></div><div class="photo"></div><div class="photo"></div></div>`; break;
            case '8_VERTICAL': previewHTML = `<div class="layout-preview preview-8_VERTICAL"><div class="strip"><div class="photo"></div><div class="photo"></div><div class="photo"></div><div class="photo"></div></div><div class="strip"><div class="photo"></div><div class="photo"></div><div class="photo"></div><div class="photo"></div></div></div>`; break;
        }
        layoutContainer.innerHTML += `<label class="cursor-pointer p-4 border-4 border-transparent rounded-xl has-[:checked]:border-pink-500 has-[:checked]:bg-pink-50 transition text-center flex flex-col items-center"><input type="radio" name="layout" value="${layout.id}" class="sr-only" ${isChecked}>${previewHTML}<p class="font-bold text-lg mt-3">${layout.name}</p></label>`;
    });

    const floatingContainer = document.getElementById('floatingFramesContainer');
    if (floatingContainer) {
        for (let i = 0; i < 10; i++) {
            const frame = document.createElement('div');
            frame.className = 'floating-frame';
            const size = Math.random() * 100 + 50;
            frame.style.width = `${size * 1.5}px`; frame.style.height = `${size}px`;
            frame.style.top = `${Math.random() * 100}%`; frame.style.left = `${Math.random() * 100}%`;
            frame.style.animationDelay = `${Math.random() * 6}s`; frame.style.animationDuration = `${Math.random() * 5 + 5}s`;
            floatingContainer.appendChild(frame);
        }
    }
    console.log("Khởi tạo UI xong.");
}

// ----------------- PHOTOBOOTH -----------------------------
async function startCamera() {
    state.settings.layout = document.querySelector('input[name="layout"]:checked').value;
    state.capturedPhotos = [];
    const startBtn = document.getElementById('startCaptureBtn');
    if (startBtn) startBtn.disabled = false;
    try {
        if (state.stream) state.stream.getTracks().forEach(track => track.stop());
        const constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false };
        state.stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoEl.srcObject = state.stream;
        await videoEl.play();
    } catch (err) { console.error("Camera error:", err); alert("Không thể truy cập camera. Vui lòng cấp quyền và thử lại."); showScreen('settingsScreen'); }
}
function setTimer(seconds) { state.settings.timer = seconds; document.querySelectorAll('.timer-btn').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active'); }

window.setTimer = setTimer; 
 

document.getElementById('startCaptureBtn').onclick = () => { document.getElementById('startCaptureBtn').disabled = true; runCaptureSequence(0); };
function runCaptureSequence(index) {
    const layoutInfo = layouts.find(l => l.id === state.settings.layout);
    if (index >= layoutInfo.count) { processAndEdit(); return; }
    document.getElementById('captureProgress').innerText = `${index + 1} / ${layoutInfo.count}`;
    const countdownOverlay = document.getElementById('countdownOverlay');
    let count = state.settings.timer;
    countdownOverlay.textContent = count;
    countdownOverlay.style.display = 'flex';
    const interval = setInterval(() => {
        count--;
        countdownOverlay.textContent = count;
        if (count < 0) { clearInterval(interval); countdownOverlay.style.display = 'none'; capturePhoto(index); }
    }, 1000);
}
function capturePhoto(index) {
    const flashEffect = document.getElementById('flashEffect');
    if (flashEffect) flashEffect.classList.add('flash');
    if (videoContainer) videoContainer.classList.add('capturing');
    const context = hiddenCanvas.getContext('2d');
    const video = videoEl;
    const targetAspectRatio = 3 / 2;
    const videoWidth = video.videoWidth, videoHeight = video.videoHeight;
    const videoAspectRatio = videoWidth / videoHeight;
    let sX, sY, sWidth, sHeight;
    if (videoAspectRatio > targetAspectRatio) { sHeight = videoHeight; sWidth = videoHeight * targetAspectRatio; sX = (videoWidth - sWidth) / 2; sY = 0; }
    else { sWidth = videoWidth; sHeight = videoWidth / targetAspectRatio; sX = 0; sY = (videoHeight - sHeight) / 2; }
    hiddenCanvas.width = sWidth; hiddenCanvas.height = sHeight;
    context.translate(sWidth, 0); context.scale(-1, 1);
    context.drawImage(video, sX, sY, sWidth, sHeight, 0, 0, sWidth, sHeight);
    state.capturedPhotos.push(hiddenCanvas.toDataURL('image/jpeg'));
    setTimeout(() => { if (flashEffect) flashEffect.classList.remove('flash'); if (videoContainer) videoContainer.classList.remove('capturing'); runCaptureSequence(index + 1); }, 500);
}

// ----------------- EDIT & FINALIZE -----------------------------
async function processAndEdit() {
    loadingOverlay.classList.remove('hidden'); showScreen('editScreen');
    const frameContainer = document.getElementById('frameSelection');
    frameContainer.innerHTML = '';
    frames.forEach((frame, index) => {
        const isChecked = index === 0 ? 'checked' : '';
        // onchange sử dụng redrawFinalImage() — hàm sẽ được expose ra window ở cuối file
        frameContainer.innerHTML += `<label class="cursor-pointer"><input type="radio" name="frame" value="${frame.id}" class="sr-only" ${isChecked} onchange="redrawFinalImage()"><div class="p-2 border-4 border-gray-200 rounded-xl has-[:checked]:border-pink-500 text-center"><p class="font-bold text-sm">${frame.name}</p></div></label>`;
    });
    const filterContainer = document.getElementById('filterContainer');
    filterContainer.innerHTML = '';
    filters.forEach((filter, index) => {
        const isActive = index === 0 ? 'active' : '';
        const btn = document.createElement('button');
        btn.className = `filter-btn p-2 border-2 rounded-lg text-sm ${isActive}`;
        btn.textContent = filter.name;
        btn.dataset.filterId = filter.id;
        btn.onclick = () => applyFilter(filter.id);
        filterContainer.appendChild(btn);
    });
    await redrawFinalImage();
    loadingOverlay.classList.add('hidden');
}
async function redrawFinalImage() {
    loadingOverlay.classList.remove('hidden');
    state.settings.frame = document.querySelector('input[name="frame"]:checked').value;
    await drawGenericFrame(finalCanvas, state.capturedPhotos, state.settings.layout, state.settings.frame);
    const activeFilterId = document.querySelector('.filter-btn.active')?.dataset.filterId || 'none';
    await applyFilter(activeFilterId, true);
    loadingOverlay.classList.add('hidden');
}
// Expose redrawFinalImage for inline onchange handler
window.redrawFinalImage = redrawFinalImage;

async function applyFilter(filterId, isRedrawing = false) {
    if (!isRedrawing) { document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); document.querySelector(`[data-filter-id="${filterId}"]`)?.classList.add('active'); }
    if (!isRedrawing) await drawGenericFrame(finalCanvas, state.capturedPhotos, state.settings.layout, state.settings.frame);
    if (filterId === 'none') return;
    const ctx = finalCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        let newR=r, newG=g, newB=b;
        switch(filterId) {
            case 'cool': newB = b * 1.2; newR = r * 0.9; break;
            case 'warm': newR = r * 1.2; newB = b * 0.9; break;
            case 'vibrant': const avg = (r+g+b)/3; newR = Math.min(255, avg + (r-avg) * 1.5); newG = Math.min(255, avg + (g-avg) * 1.5); newB = Math.min(255, avg + (b-avg) * 1.5); break;
            case 'mono': newR = newG = newB = 0.299 * r + 0.587 * g + 0.114 * b; break;
            case 'dreamy': newR = Math.min(255, r * 1.1 + 10); newG = Math.min(255, g * 0.95 + 5); newB = Math.min(255, b * 1.2 + 15); break;
        }
        data[i] = Math.max(0, Math.min(255, newR));
        data[i + 1] = Math.max(0, Math.min(255, newG));
        data[i + 2] = Math.max(0, Math.min(255, newB));
    }
    ctx.putImageData(imageData, 0, 0);
}

async function drawGenericFrame(canvas, photos, layoutId, frameId) {
    const ctx = canvas.getContext('2d');
    const P_W = 900, P_H = 600;
    const PAD = 40, SPACE = 20;
    const TOP_BANNER_HEIGHT = 120;
    let finalCanvasWidth, finalCanvasHeight, photoGridCols, photoGridRows;
    switch(layoutId) {
        case '1_PHOTO': photoGridCols = 1; photoGridRows = 1; break;
        case '4_VERTICAL': photoGridCols = 1; photoGridRows = 4; break;
        case '4_GRID': photoGridCols = 2; photoGridRows = 2; break;
        case '8_VERTICAL': photoGridCols = 2; photoGridRows = 4; break;
        default: photoGridCols = 1; photoGridRows = 1;
    }
    finalCanvasWidth = (P_W * photoGridCols) + (SPACE * (photoGridCols - 1)) + (PAD * 2);
    finalCanvasHeight = TOP_BANNER_HEIGHT + (P_H * photoGridRows) + (SPACE * (photoGridRows - 1)) + PAD;
    canvas.width = finalCanvasWidth; canvas.height = finalCanvasHeight;
    ctx.save();
    switch(frameId) {
        case 'classic_pink': ctx.fillStyle = '#f9a8d4'; break;
        case 'polaroid': ctx.fillStyle = '#f5e8d8'; break;
        case 'film_strip': ctx.fillStyle = '#111827'; break;
        case 'neon_pink': ctx.fillStyle = '#1f1f1f'; break;
        case 'sunset_orange': {
            const gradO = ctx.createLinearGradient(0,0,0,canvas.height); gradO.addColorStop(0, '#fdba74'); gradO.addColorStop(1, '#f97316'); ctx.fillStyle = gradO;
        } break;
        case 'dreamy_purple': {
            const gradP = ctx.createLinearGradient(0,0,0,canvas.height); gradP.addColorStop(0, '#c4b5fd'); gradP.addColorStop(1, '#7c3aed'); ctx.fillStyle = gradP;
        } break;
        case 'confetti': ctx.fillStyle = '#fffbeb'; break;
        case 'starlight': {
            const gradS = ctx.createLinearGradient(0,0,0,canvas.height); gradS.addColorStop(0, '#0f172a'); gradS.addColorStop(1, '#334155'); ctx.fillStyle = gradS;
        } break;
        case 'minimalist': ctx.fillStyle = '#f9fafb'; break;
        default: ctx.fillStyle = '#ffffff';
    }
    ctx.fillRect(0,0,canvas.width,canvas.height);
    if (frameId === 'confetti') {
        for(let i=0; i<150; i++) { ctx.fillStyle = `hsla(${Math.random() * 360}, 90%, 70%, 0.9)`; ctx.beginPath(); if (Math.random() > 0.5) ctx.rect(Math.random()*canvas.width, Math.random()*canvas.height, 10, 10); else ctx.arc(Math.random()*canvas.width, Math.random()*canvas.height, 6, 0, Math.PI*2); ctx.fill(); }
    } else if (frameId === 'starlight') {
        ctx.fillStyle = 'white'; for(let i=0; i<250; i++) { ctx.beginPath(); ctx.arc(Math.random()*canvas.width, Math.random()*canvas.height, Math.random()*2 + 0.5, 0, Math.PI*2); ctx.fill(); }
    }
    ctx.restore();
    let bannerOpacity = (frameId === 'confetti' || frameId === 'starlight' || frameId === 'sunset_orange' || frameId === 'dreamy_purple') ? 0.6 : 0.8;
    ctx.fillStyle = `rgba(0, 0, 0, ${bannerOpacity})`;
    ctx.fillRect(0, 0, canvas.width, TOP_BANNER_HEIGHT);
    // Lưu ý: cần có CSS --font-heading và --font-body trên :root
    ctx.font = `bold 60px ${getComputedStyle(document.body).getPropertyValue('--font-heading') || 'sans-serif'}`;
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Solvia', PAD, TOP_BANNER_HEIGHT / 2);
    const today = new Date();
    const dateString = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
    ctx.font = `bold 28px ${getComputedStyle(document.body).getPropertyValue('--font-body') || 'sans-serif'}`;
    ctx.textAlign = 'right';
    ctx.fillText(dateString, canvas.width - PAD, TOP_BANNER_HEIGHT / 2);
    for (let i = 0; i < photos.length; i++) {
        const col = Math.floor(i / photoGridRows);
        const row = i % photoGridRows;
        const x = PAD + col * (P_W + SPACE);
        const y = TOP_BANNER_HEIGHT + row * (P_H + SPACE);
        const img = new Image();
        img.src = photos[i];
        await new Promise(resolve => img.onload = resolve);
        if (frameId === 'film_strip' || frameId === 'neon_pink' || frameId === 'starlight') { ctx.fillStyle = '#ffffff'; ctx.fillRect(x-5, y-5, P_W+10, P_H+10); }
        ctx.drawImage(img, x, y, P_W, P_H);
    }
    ctx.save();
    switch(frameId) {
        case 'film_strip': {
            ctx.fillStyle = '#111827';
            const holeH = 30, holeW = 25;
            const totalPhotoGridHeight = (P_H * photoGridRows) + (SPACE * (photoGridRows - 1));
            const numHolesPerSide = Math.ceil(totalPhotoGridHeight / (holeH + 10));
            for(let i = 0; i < numHolesPerSide; i++){
                let yPos = TOP_BANNER_HEIGHT + (totalPhotoGridHeight / numHolesPerSide * i) + (holeH / 2) - (holeH / 2);
                ctx.fillRect(PAD/2 - holeW/2, yPos, holeW, holeH);
                ctx.fillRect(canvas.width - PAD/2 - holeW/2, yPos, holeW, holeH);
                if(photoGridCols > 1) { const centerX = PAD + P_W + SPACE/2; ctx.fillRect(centerX - holeW/2, yPos, holeW, holeH); }
            }
        } break;
        case 'neon_pink':
            ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 15;
            ctx.shadowColor = '#ec4899'; ctx.shadowBlur = 30;
            ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
            break;
    }
    ctx.restore();
}

// ----------------- SAVE & PUBLISH -----------------------------
function saveImage() { const link = document.createElement('a'); link.download = 'photobooth-solvia.jpg'; link.href = finalCanvas.toDataURL('image/jpeg', 0.9); link.click(); }
// Expose saveImage for potential inline handlers
window.saveImage = saveImage;

async function publishImage() {
    try {
        const imageData = finalCanvas.toDataURL('image/jpeg', 0.8);
        const ts = Date.now();
        const storagePath = `solviaGallery/${ts}.jpg`;

        // Fallback: nếu Firebase không khởi tạo -> lưu localStorage
        if (!storage || !db) {
            let gallery = JSON.parse(localStorage.getItem('solviaGallery') || '[]');
            gallery.unshift({ id: ts, src: imageData, layout: state.settings.layout });
            localStorage.setItem('solviaGallery', JSON.stringify(gallery));
            alert('Ảnh của bạn đã được đăng (lưu local).');
            await showScreen('galleryScreen');
            return;
        }

        loadingOverlay.classList.remove('hidden');

        // Upload lên Storage
        const uploadResp = await uploadImageToStorage(imageData, storagePath);

        // Lưu metadata lên Firestore
        await addGalleryRecordToFirestore({
            storagePath: uploadResp.fullPath,
            downloadURL: uploadResp.url,
            layout: state.settings.layout
        });

        loadingOverlay.classList.add('hidden');

        alert('Ảnh của bạn đã được đăng công khai!');
        await showScreen('galleryScreen');
    } catch (err) {
        console.error("Lỗi khi publishImage:", err);
        loadingOverlay.classList.add('hidden');
        alert('Không thể đăng ảnh (Firebase lỗi). Ảnh được lưu tạm vào localStorage.');
        let gallery = JSON.parse(localStorage.getItem('solviaGallery') || '[]');
        gallery.unshift({ id: Date.now(), src: finalCanvas.toDataURL('image/jpeg', 0.8), layout: state.settings.layout });
        localStorage.setItem('solviaGallery', JSON.stringify(gallery));
        await showScreen('galleryScreen');
    }
}
// Expose publishImage globally if needed by UI
window.publishImage = publishImage;

// ----------------- GALLERY (pan/zoom/loaded from Firestore or local) -----------------------------
let animationFrameId = null;

async function initGallery() {
    console.log("Bắt đầu initGallery...");
    await loadGallery();

    state.gallery = {
        scale: 0.4,
        panX: 50,
        panY: 50,
        targetScale: 0.4,
        targetPanX: 50,
        targetPanY: 50,
        isPanning: false, hasDragged: false,
        startX: 0, startY: 0,
    };

    console.log("Gắn event listeners...");
    screens.gallery.addEventListener('wheel', handleZoom, { passive: false });
    screens.gallery.addEventListener('mousedown', handlePanStart);
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    smoothUpdate();
    console.log("initGallery xong.");
}

function smoothUpdate() {
    const { gallery } = state;
    const easing = 0.15;
    gallery.scale += (gallery.targetScale - gallery.scale) * easing;
    gallery.panX += (gallery.targetPanX - gallery.panX) * easing;
    gallery.panY += (gallery.targetPanY - gallery.panY) * easing;
    galleryGrid.style.transform = `translate(${gallery.panX}px, ${gallery.panY}px) scale(${gallery.scale})`;
    animationFrameId = requestAnimationFrame(smoothUpdate);
}

async function loadGallery() {
    console.log("Bắt đầu loadGallery...");
    galleryGrid.innerHTML = '';

    let galleryData = [];

    // Nếu Firestore có sẵn -> lấy từ Firestore
    if (db) {
        try {
            galleryData = await fetchGalleryFromFirestore();
            console.log("Lấy gallery từ Firestore, items:", galleryData.length);
        } catch (err) {
            console.error("Lỗi lấy gallery từ Firestore:", err);
            galleryData = JSON.parse(localStorage.getItem('solviaGallery') || '[]');
            console.log("Fallback localStorage, items:", galleryData.length);
        }
    } else {
        galleryData = JSON.parse(localStorage.getItem('solviaGallery') || '[]');
        console.log("Dùng localStorage (firebase chưa khởi tạo). items:", galleryData.length);
    }

    if (!galleryData || galleryData.length === 0) {
        galleryGrid.innerHTML = `<p class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-500 text-xl">Chưa có ảnh nào được đăng. Hãy là người đầu tiên!</p>`;
        console.log("loadGallery: Không có ảnh.");
        return;
    }

    const numCols = 6;
    const colWidth = window.innerWidth / numCols * 1.5;
    const colHeights = Array(numCols).fill(0);
    const margin = 40;

    for (const [index, item] of galleryData.entries()) {
        console.log(`Đang xử lý ảnh ${index + 1}...`);
        const img = new Image();
        img.src = item.src;
        try {
             await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
             });
        } catch (error) {
            console.error(`Lỗi tải ảnh ${index + 1}:`, item.src, error);
            continue;
        }

        const isWide = item.layout === '4_GRID' || item.layout === '8_VERTICAL';
        const itemWidth = isWide ? colWidth * 2 - margin : colWidth - margin;
        const itemHeight = img.height * (itemWidth / (img.width || 1));

        let targetCol = 0;
        let topPosition = 0;

        if (isWide) {
            let minH = Infinity;
            for (let i = 0; i < numCols - 1; i++) {
                const h = Math.max(colHeights[i], colHeights[i+1]);
                if (h < minH) { minH = h; targetCol = i; }
            }
            topPosition = Math.max(colHeights[targetCol], colHeights[targetCol + 1]);
        } else {
            targetCol = colHeights.indexOf(Math.min(...colHeights));
            topPosition = colHeights[targetCol];
        }

        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        galleryItem.style.width = `${itemWidth}px`;
        galleryItem.style.height = `${itemHeight}px`;
        galleryItem.style.left = `${targetCol * colWidth + margin / 2}px`;
        galleryItem.style.top = `${topPosition + margin}px`;

        const randomRotate = (Math.random() - 0.5) * 6;
        galleryItem.style.transform = `rotate(${randomRotate}deg)`;

        img.dataset.src = item.src;
        galleryItem.appendChild(img);
        galleryGrid.appendChild(galleryItem);

        const newHeight = topPosition + itemHeight + margin;
        if(isWide) {
            colHeights[targetCol] = newHeight;
            colHeights[targetCol+1] = newHeight;
        } else {
            colHeights[targetCol] = newHeight;
        }
    }
    console.log("loadGallery xong.");
}

// ----------------- PAN & ZOOM -----------------------------
function handleZoom(e) {
    e.preventDefault();
    const { gallery } = state;
    const zoomIntensity = 0.001;
    const { clientX, clientY } = e;

    const oldScale = gallery.targetScale;
    const delta = -e.deltaY * zoomIntensity;
    gallery.targetScale = Math.max(0.1, Math.min(oldScale * (1 + delta), 5));

    const mouseX = clientX - gallery.targetPanX;
    const mouseY = clientY - gallery.targetPanY;

    const newMouseX = mouseX * (gallery.targetScale / oldScale);
    const newMouseY = mouseY * (gallery.targetScale / oldScale);

    gallery.targetPanX += mouseX - newMouseX;
    gallery.targetPanY += mouseY - newMouseY;
}

function handlePanStart(e) {
   console.log("handlePanStart triggered");
   e.preventDefault();
    state.gallery.isPanning = true;
    state.gallery.hasDragged = false;
    state.gallery.startX = e.clientX - state.gallery.targetPanX;
    state.gallery.startY = e.clientY - state.gallery.targetPanY;
    screens.gallery.classList.add('panning');
}

function handlePanMove(e) {
    if (!state.gallery.isPanning) return;
    e.preventDefault();

    if (!state.gallery.hasDragged) {
        const dx = e.clientX - (state.gallery.panX + state.gallery.startX);
        const dy = e.clientY - (state.gallery.panY + state.gallery.startY);
        if (Math.sqrt(dx*dx + dy*dy) > 5) {
            state.gallery.hasDragged = true;
        }
    }

    const potentialNewTargetPanX = e.clientX - state.gallery.startX;
    const potentialNewTargetPanY = e.clientY - state.gallery.startY;

    const hrElement = screens.gallery?.querySelector('hr');
    if (hrElement && galleryGrid.children.length > 0 && galleryGrid.children[0].tagName !== 'P') {
        const boundaryY = hrElement.getBoundingClientRect().bottom;
        const firstItem = galleryGrid.querySelector('.gallery-item');
        const headerOffset = firstItem ? firstItem.offsetTop : 50;
        const currentScale = state.gallery.scale;
        const minPanY = boundaryY - (headerOffset * currentScale);
        state.gallery.targetPanY = Math.max(potentialNewTargetPanY, minPanY);
    } else {
        state.gallery.targetPanY = potentialNewTargetPanY;
    }

    state.gallery.targetPanX = potentialNewTargetPanX;

    if (!animationFrameId) {
        smoothUpdate();
    }
}

function handlePanEnd(e) {
    console.log("handlePanEnd triggered. isPanning:", state.gallery.isPanning, "hasDragged:", state.gallery.hasDragged);
    if (state.gallery.isPanning && !state.gallery.hasDragged) {
        const clickedItem = e.target.closest('.gallery-item');
        console.log("Tìm thấy clickedItem:", clickedItem);

        if (clickedItem) {
            const targetImage = clickedItem.querySelector('img');
            console.log("Tìm thấy targetImage bên trong clickedItem:", targetImage);

            if (targetImage && targetImage.dataset.src) {
                console.log("Có targetImage và dataset.src, gọi openLightbox...");
                openLightbox(targetImage.dataset.src);
            } else {
                console.log("Không tìm thấy img hoặc data-src bên trong clickedItem:", clickedItem);
            }
        } else {
            console.log("Điểm click không nằm trong gallery-item nào.");
        }

    } else if (state.gallery.isPanning && state.gallery.hasDragged) {
        console.log("Đã kéo thả, không mở lightbox.");
    }
    state.gallery.isPanning = false;
    screens.gallery.classList.remove('panning');
}

// ----------------- LIGHTBOX -----------------------------
function openLightbox(src) {
   console.log("Đang mở Lightbox với src:", src);
   lightboxImage.src = src;
   lightboxOverlay.style.display = 'flex';
   console.log("Trạng thái display của lightboxOverlay:", lightboxOverlay.style.display);
}
function closeLightboxFunc() {
    console.log("Đóng Lightbox");
    lightboxOverlay.style.display = 'none';
    lightboxImage.src = '';
}
closeLightbox.onclick = closeLightboxFunc;
lightboxOverlay.onclick = (e) => { if (e.target === lightboxOverlay) closeLightboxFunc(); };

// expose some functions to window (keeps inline handlers working)
window.publishImage = publishImage;
window.saveImage = saveImage;
window.openLightbox = openLightbox;
window.closeLightboxFunc = closeLightboxFunc;

// ----------------- BOOT -----------------------------
window.onload = () => {
    console.log("window.onload triggered");
    initializeUI();
    showScreen('homeScreen');
    document.getElementById('scrollToBottomBtn')?.addEventListener('click', scrollToFooter);
};

function scrollToFooter() {
    const footerElement = document.getElementById('pageFooter');

    if (footerElement) {
        // Cuộn mượt mà tới cái footer
        footerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        // Nếu không tìm thấy footer, cuộn xuống đáy trang
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    }
};

console.log("Script photobooth solvia 2.0 đã được tải.");


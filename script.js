// ----------------- FIREBASE (IMPORT + INIT) -----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getStorage, ref as sRef, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";
import { getFirestore, collection, addDoc, query, orderBy, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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

// Khởi tạo Firebase
let storage = null, db = null;
try {
    const app = initializeApp(firebaseConfig);
    storage = getStorage(app);
    db = getFirestore(app);
    console.log("Firebase initialized.");
} catch (err) {
    console.warn("Firebase initialization failed or not configured. Falling back to localStorage. Error:", err);
}

async function uploadImageToStorage(base64DataUrl, storagePath) {
    if (!storage) throw new Error("Firebase Storage not initialized");
    const ref = sRef(storage, storagePath);
    await uploadString(ref, base64DataUrl, 'data_url');
    const url = await getDownloadURL(ref);
    return { url, fullPath: ref.fullPath };
}

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

window.__firebaseHelpers = {
    uploadImageToStorage,
    addGalleryRecordToFirestore,
    fetchGalleryFromFirestore,
    storageInitialized: !!storage,
    firestoreInitialized: !!db
};

const state = {
    currentScreen: 'homeScreen',
    settings: {
        layout: '4_VERTICAL',
        timer: 5,
        frame: 'classic_pink',
    },
    capturedPhotos: [],
    stream: null,
    // [MỚI] Thêm trạng thái camera (user: trước, environment: sau)
    cameraFacingMode: 'user', 
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

async function showScreen(screenId) {
    console.log(`Chuyển màn hình sang: ${screenId}`);
    window.showScreen = showScreen;

    if (state.currentScreen === 'galleryScreen') {
        screens.gallery.onwheel = null;
        screens.gallery.onmousedown = null;
        window.onmousemove = null;
        window.onmouseup = null;
        screens.gallery.ontouchstart = null;
        screens.gallery.ontouchmove = null;
        screens.gallery.ontouchend = null;
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

const layouts = [
    { id: '1_PHOTO', name: '1 Ảnh đơn', count: 1 },
    { id: '4_VERTICAL', name: '4 Ảnh dọc', count: 4 },
    { id: '4_GRID', name: '4 Ảnh lưới', count: 4 },
    { id: '4_GRID_V', name: '4 Lưới Dọc', count: 4 }, 
    { id: '8_VERTICAL', name: '8 Ảnh (2 dải)', count: 8 },
];

const frames = [
    { id: 'classic_pink', name: 'Khung hồng' }, 
    { id: 'polaroid', name: 'Khung kem' }, 
    { id: 'film_strip', name: 'Khung tối' },
    { id: 'neon_pink', name: 'Khung viền hồng neon' }, 
    { id: 'sunset_orange', name: 'Khung cam' }, 
    { id: 'dreamy_purple', name: 'Khung tím' },
    { id: 'starlight', name: 'Khung tối chấm trắng' }, 
    { id: 'minimalist', name: 'Tối trắng' },

    // --------Khung ảnh mới ---------
    {
        id: 'noen',      
        name: 'Noen 1',   
        type: 'image',       
        src: {
            '1_PHOTO': 'noen11anh.png',
            '4_VERTICAL': 'noen1.png', 
            '4_GRID': 'noen14lanh.png',
            // Nếu bạn thiết kế khung cho lưới dọc thì thêm vào đây
            '4_GRID_V': 'noen14lanhdoc.png', 
            '8_VERTICAL': 'noen18anh.png'
        }
    },
    {
        id: 'hellokitty',      
        name: 'Hello Kitty',   
        type: 'image',       
        src: {
            '1_PHOTO': 'khung_tet_1_don.png',
            '4_VERTICAL': 'hellokitty14anh.png', 
            '4_GRID': 'hellokitty14lanh.png',
            '4_GRID_V': 'hellokitty1.png', 
            '8_VERTICAL': 'khung_tet_8_doc.png'
        }
    }
];

const filters = [
    { id: 'none', name: 'Gốc' }, { id: 'cool', name: 'Tông lạnh' }, { id: 'warm', name: 'Tông ấm' },
    { id: 'vibrant', name: 'Rực rỡ' }, { id: 'mono', name: 'Đơn sắc' }, { id: 'dreamy', name: 'Mơ màng' }
];

function initializeUI() {
    console.log("Khởi tạo UI...");
    const layoutContainer = document.getElementById('layoutSelection');
    layoutContainer.innerHTML = '';
    layouts.forEach((layout, index) => {
        const isChecked = index === 1 ? 'checked' : '';
        let previewHTML = '';
        switch (layout.id) {
            case '1_PHOTO': previewHTML = `<div class="layout-preview preview-1_PHOTO"><div class="photo"></div></div>`; break;
            case '4_VERTICAL': previewHTML = `<div class="layout-preview preview-4_VERTICAL"><div class="photo"></div><div class="photo"></div><div class="photo"></div><div class="photo"></div></div>`; break;
            case '4_GRID': previewHTML = `<div class="layout-preview preview-4_GRID"><div class="photo"></div><div class="photo"></div><div class="photo"></div><div class="photo"></div></div>`; break;
            case '4_GRID_V': previewHTML = `<div class="layout-preview preview-4_GRID_V"><div class="photo"></div><div class="photo"></div><div class="photo"></div><div class="photo"></div></div>`; break;
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

// [MỚI] Hàm xoay camera
async function toggleCamera() {
    state.cameraFacingMode = (state.cameraFacingMode === 'user') ? 'environment' : 'user';
    await startCamera();
}
window.toggleCamera = toggleCamera;

async function startCamera() {
    state.settings.layout = document.querySelector('input[name="layout"]:checked').value;
    state.capturedPhotos = [];
    const startBtn = document.getElementById('startCaptureBtn');
    if (startBtn) startBtn.disabled = false;

    // Logic xoay khung camera dọc
    if (state.settings.layout === '4_GRID_V') {
        videoContainer.classList.add('vertical-mode');
    } else {
        videoContainer.classList.remove('vertical-mode');
    }

    try {
        if (state.stream) state.stream.getTracks().forEach(track => track.stop());
        
        // [MỚI] Dùng biến cameraFacingMode thay vì fix cứng 'user'
        const constraints = { 
            video: { 
                width: { ideal: 1280 }, 
                height: { ideal: 720 }, 
                facingMode: state.cameraFacingMode 
            }, 
            audio: false 
        };
        state.stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoEl.srcObject = state.stream;
        
        // [MỚI] Xử lý lật video (Mirror): Cam trước thì lật, Cam sau thì không
        if (state.cameraFacingMode === 'user') {
            videoEl.style.transform = 'scaleX(-1)';
        } else {
            videoEl.style.transform = 'none';
        }

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

    const isVerticalLayout = state.settings.layout === '4_GRID_V';
    const targetAspectRatio = isVerticalLayout ? (2 / 3) : (3 / 2);

    const videoWidth = video.videoWidth, videoHeight = video.videoHeight;
    const videoAspectRatio = videoWidth / videoHeight;
    let sX, sY, sWidth, sHeight;

    if (videoAspectRatio > targetAspectRatio) { 
        sHeight = videoHeight; 
        sWidth = videoHeight * targetAspectRatio; 
        sX = (videoWidth - sWidth) / 2; 
        sY = 0; 
    } else { 
        sWidth = videoWidth; 
        sHeight = videoWidth / targetAspectRatio; 
        sX = 0; 
        sY = (videoHeight - sHeight) / 2; 
    }
    hiddenCanvas.width = sWidth; hiddenCanvas.height = sHeight;
    
    // [MỚI] Xử lý lật ảnh khi chụp (Canvas Mirror)
    // Nếu cam trước -> Lật (-1, 1). Nếu cam sau -> Giữ nguyên (1, 1)
    if (state.cameraFacingMode === 'user') {
        context.translate(sWidth, 0); 
        context.scale(-1, 1);
    } else {
        context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    }

    context.drawImage(video, sX, sY, sWidth, sHeight, 0, 0, sWidth, sHeight);
    state.capturedPhotos.push(hiddenCanvas.toDataURL('image/jpeg'));
    setTimeout(() => { if (flashEffect) flashEffect.classList.remove('flash'); if (videoContainer) videoContainer.classList.remove('capturing'); runCaptureSequence(index + 1); }, 500);
}

async function processAndEdit() {
    loadingOverlay.classList.remove('hidden'); showScreen('editScreen');
    const frameContainer = document.getElementById('frameSelection');
    frameContainer.innerHTML = '';
    frames.forEach((frame, index) => {
        const isChecked = index === 0 ? 'checked' : '';
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
    const activeFilterId = document.querySelector('.filter-btn.active')?.dataset.filterId || 'none';
    await drawGenericFrame(finalCanvas, state.capturedPhotos, state.settings.layout, state.settings.frame, activeFilterId);
    loadingOverlay.classList.add('hidden');
}

window.redrawFinalImage = redrawFinalImage;

async function applyFilter(filterId) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-filter-id="${filterId}"]`)?.classList.add('active');
    await redrawFinalImage();
}

async function drawGenericFrame(canvas, photos, layoutId, frameId, filterId = 'none') {
    const ctx = canvas.getContext('2d');

    const isVerticalLayout = layoutId === '4_GRID_V';
    const P_W = isVerticalLayout ? 600 : 900;
    const P_H = isVerticalLayout ? 900 : 600;

    const PAD = 40, SPACE = 20;
    const TOP_BANNER_HEIGHT = 120;

    let finalCanvasWidth, finalCanvasHeight, photoGridCols, photoGridRows;
    switch (layoutId) {
        case '1_PHOTO': photoGridCols = 1; photoGridRows = 1; break;
        case '4_VERTICAL': photoGridCols = 1; photoGridRows = 4; break;
        case '4_GRID': photoGridCols = 2; photoGridRows = 2; break;
        case '4_GRID_V': photoGridCols = 2; photoGridRows = 2; break; 
        case '8_VERTICAL': photoGridCols = 2; photoGridRows = 4; break;
        default: photoGridCols = 1; photoGridRows = 1;
    }

    finalCanvasWidth = (P_W * photoGridCols) + (SPACE * (photoGridCols - 1)) + (PAD * 2);
    finalCanvasHeight = TOP_BANNER_HEIGHT + (P_H * photoGridRows) + (SPACE * (photoGridRows - 1)) + PAD;

    canvas.width = finalCanvasWidth;
    canvas.height = finalCanvasHeight;

    const currentFrameObj = frames.find(f => f.id === frameId);
    const isImageFrame = currentFrameObj && currentFrameObj.type === 'image';
    const fontHeading = getComputedStyle(document.body).getPropertyValue('--font-heading') || 'sans-serif';
    const fontBody = getComputedStyle(document.body).getPropertyValue('--font-body') || 'sans-serif';

    // 1. VẼ NỀN (CHO KHUNG CŨ)
    if (!isImageFrame) {
        ctx.save();
        switch (frameId) {
            case 'classic_pink': ctx.fillStyle = '#f9a8d4'; break;
            case 'polaroid': ctx.fillStyle = '#f5e8d8'; break;
            case 'film_strip': ctx.fillStyle = '#111827'; break;
            case 'neon_pink': ctx.fillStyle = '#1f1f1f'; break;
            case 'sunset_orange': { const grad = ctx.createLinearGradient(0, 0, 0, canvas.height); grad.addColorStop(0, '#fdba74'); grad.addColorStop(1, '#f97316'); ctx.fillStyle = grad; } break;
            case 'dreamy_purple': { const grad = ctx.createLinearGradient(0, 0, 0, canvas.height); grad.addColorStop(0, '#c4b5fd'); grad.addColorStop(1, '#7c3aed'); ctx.fillStyle = grad; } break;
            case 'confetti': ctx.fillStyle = '#fffbeb'; break;
            case 'starlight': { const grad = ctx.createLinearGradient(0, 0, 0, canvas.height); grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#334155'); ctx.fillStyle = grad; } break;
            case 'minimalist': ctx.fillStyle = '#f9fafb'; break;
            default: ctx.fillStyle = '#ffffff';
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (frameId === 'confetti') {
            for (let i = 0; i < 150; i++) { ctx.fillStyle = `hsla(${Math.random() * 360}, 90%, 70%, 0.9)`; ctx.beginPath(); if (Math.random() > 0.5) ctx.rect(Math.random() * canvas.width, Math.random() * canvas.height, 10, 10); else ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 6, 0, Math.PI * 2); ctx.fill(); }
        } else if (frameId === 'starlight') {
            ctx.fillStyle = 'white'; for (let i = 0; i < 250; i++) { ctx.beginPath(); ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2 + 0.5, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // 2. VẼ ẢNH NGƯỜI DÙNG
    for (let i = 0; i < photos.length; i++) {
        const col = Math.floor(i / photoGridRows);
        const row = i % photoGridRows;
        const x = PAD + col * (P_W + SPACE);
        const y = TOP_BANNER_HEIGHT + row * (P_H + SPACE);

        const img = new Image();
        img.src = photos[i];
        await new Promise(resolve => img.onload = resolve);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(img, 0, 0);

        if (filterId && filterId !== 'none') {
            const imageData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageData.data;
            for (let j = 0; j < data.length; j += 4) {
                const [r, g, b] = [data[j], data[j + 1], data[j + 2]];
                let newR = r, newG = g, newB = b;
                switch (filterId) {
                    case 'cool': newB = b * 1.2; newR = r * 0.9; break;
                    case 'warm': newR = r * 1.2; newB = b * 0.9; break;
                    case 'vibrant': const avg = (r + g + b) / 3; newR = Math.min(255, avg + (r - avg) * 1.5); newG = Math.min(255, avg + (g - avg) * 1.5); newB = Math.min(255, avg + (b - avg) * 1.5); break;
                    case 'mono': newR = newG = newB = 0.299 * r + 0.587 * g + 0.114 * b; break;
                    case 'dreamy': newR = Math.min(255, r * 1.1 + 10); newG = Math.min(255, g * 0.95 + 5); newB = Math.min(255, b * 1.2 + 15); break;
                }
                data[j] = Math.max(0, Math.min(255, newR));
                data[j + 1] = Math.max(0, Math.min(255, newG));
                data[j + 2] = Math.max(0, Math.min(255, newB));
            }
            tCtx.putImageData(imageData, 0, 0);
        }

        if (!isImageFrame && ['film_strip', 'neon_pink', 'starlight'].includes(frameId)) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - 5, y - 5, P_W + 10, P_H + 10);
        }
        ctx.drawImage(tempCanvas, x, y, P_W, P_H);
    }

    // 3. VẼ KHUNG
    if (isImageFrame) {
        let overlaySrc = (typeof currentFrameObj.src === 'object') ? currentFrameObj.src[layoutId] : currentFrameObj.src;
        if (overlaySrc) {
            const frameImg = new Image();
            frameImg.src = overlaySrc;
            try {
                await new Promise((resolve, reject) => { frameImg.onload = resolve; frameImg.onerror = reject; });
                ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
            } catch (err) { console.warn("Lỗi khung ảnh:", err); }
        }
    } else {
        ctx.save();
        if (frameId === 'film_strip') {
            ctx.fillStyle = '#111827';
            const holeH = 30, holeW = 25;
            const totalHeight = (P_H * photoGridRows) + (SPACE * (photoGridRows - 1));
            const numHoles = Math.ceil(totalHeight / (holeH + 10));
            for (let i = 0; i < numHoles; i++) {
                let yPos = TOP_BANNER_HEIGHT + (totalHeight / numHoles * i);
                ctx.fillRect(PAD / 2 - holeW / 2, yPos, holeW, holeH);
                ctx.fillRect(canvas.width - PAD / 2 - holeW / 2, yPos, holeW, holeH);
                if (photoGridCols > 1) { const cX = PAD + P_W + SPACE / 2; ctx.fillRect(cX - holeW / 2, yPos, holeW, holeH); }
            }
        } else if (frameId === 'neon_pink') {
            ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 15; ctx.shadowColor = '#ec4899'; ctx.shadowBlur = 30;
            ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        }
        ctx.restore();
    }

    // 4. HEADER & CHỮ
    let bannerOpacity = (['confetti', 'starlight', 'sunset_orange', 'dreamy_purple'].includes(frameId)) ? 0.6 : 0.8;
    if (isImageFrame) bannerOpacity = 0;

    if (bannerOpacity > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${bannerOpacity})`;
        ctx.fillRect(0, 0, canvas.width, TOP_BANNER_HEIGHT);
    }

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.font = `bold 60px ${fontHeading}`;
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Solvia', PAD, TOP_BANNER_HEIGHT / 2);

    const today = new Date();
    const dateString = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
    ctx.font = `bold 28px ${fontBody}`;
    ctx.textAlign = 'right';
    ctx.fillText(dateString, canvas.width - PAD, TOP_BANNER_HEIGHT / 2);
    ctx.restore();
}

function saveImage() { const link = document.createElement('a'); link.download = 'photobooth-solvia.jpg'; link.href = finalCanvas.toDataURL('image/jpeg', 0.9); link.click(); }
window.saveImage = saveImage;

async function publishImage() {
    try {
        const imageData = finalCanvas.toDataURL('image/jpeg', 0.8);
        const ts = Date.now();
        const storagePath = `solviaGallery/${ts}.jpg`;

        if (!storage || !db) {
            let gallery = JSON.parse(localStorage.getItem('solviaGallery') || '[]');
            gallery.unshift({ id: ts, src: imageData, layout: state.settings.layout });
            localStorage.setItem('solviaGallery', JSON.stringify(gallery));
            alert('Ảnh của bạn đã được đăng (lưu local).');
            await showScreen('galleryScreen');
            return;
        }

        loadingOverlay.classList.remove('hidden');
        const uploadResp = await uploadImageToStorage(imageData, storagePath);
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
window.publishImage = publishImage;
let animationFrameId = null;

// --- GALLERY INTERACTION ---
let touchState = {
    isDragging: false,
    lastX: 0, lastY: 0,
    initialDist: 0,
    initialScale: 1
};

async function initGallery() {
    console.log("Bắt đầu initGallery...");
    await loadGallery();

    state.gallery = {
        scale: window.innerWidth < 768 ? 0.8 : 0.4,
        panX: 0, panY: 0,
        targetScale: window.innerWidth < 768 ? 0.8 : 0.4,
        targetPanX: 0, targetPanY: 0,
    };

    screens.gallery.onwheel = handleWheel;
    screens.gallery.onmousedown = handleMouseDown;
    window.onmousemove = handleMouseMove;
    window.onmouseup = handleMouseUp;

    screens.gallery.ontouchstart = handleTouchStart;
    screens.gallery.ontouchmove = handleTouchMove;
    screens.gallery.ontouchend = handleTouchEnd;

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    smoothUpdate();
}

function handleWheel(e) {
    e.preventDefault();
    const zoomIntensity = 0.001;
    const { clientX, clientY } = e;
    const oldScale = state.gallery.targetScale;
    const delta = -e.deltaY * zoomIntensity;
    let newScale = Math.max(0.1, Math.min(oldScale * (1 + delta), 5));
    state.gallery.targetScale = newScale;

    const mouseX = clientX - state.gallery.targetPanX;
    const mouseY = clientY - state.gallery.targetPanY;
    state.gallery.targetPanX += mouseX - (mouseX * (newScale / oldScale));
    state.gallery.targetPanY += mouseY - (mouseY * (newScale / oldScale));
}

function handleMouseDown(e) {
    if (e.target.closest('button') || e.target.closest('.gallery-controls')) return;
    touchState.isDragging = true;
    touchState.hasDragged = false;
    touchState.lastX = e.clientX;
    touchState.lastY = e.clientY;
    screens.gallery.classList.add('panning');
}

function handleMouseMove(e) {
    if (!touchState.isDragging) return;
    e.preventDefault();
    const dx = e.clientX - touchState.lastX;
    const dy = e.clientY - touchState.lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) touchState.hasDragged = true;
    state.gallery.targetPanX += dx;
    state.gallery.targetPanY += dy;
    touchState.lastX = e.clientX;
    touchState.lastY = e.clientY;
}

function handleMouseUp(e) {
    if (!touchState.isDragging) return;
    touchState.isDragging = false;
    screens.gallery.classList.remove('panning');
    if (!touchState.hasDragged) {
        checkClickItem(e.target);
    }
}

function handleTouchStart(e) {
    if (e.target.closest('button') || e.target.closest('.gallery-controls')) return;

    if (e.touches.length === 1) {
        touchState.isDragging = true;
        touchState.hasDragged = false;
        touchState.lastX = e.touches[0].clientX;
        touchState.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        touchState.isDragging = false;
        touchState.initialDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        touchState.initialScale = state.gallery.targetScale;
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && touchState.isDragging) {
        const dx = e.touches[0].clientX - touchState.lastX;
        const dy = e.touches[0].clientY - touchState.lastY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) touchState.hasDragged = true;
        state.gallery.targetPanX += dx;
        state.gallery.targetPanY += dy;
        touchState.lastX = e.touches[0].clientX;
        touchState.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchState.initialDist > 0) {
            const scaleFactor = dist / touchState.initialDist;
            let newScale = touchState.initialScale * scaleFactor;
            state.gallery.targetScale = Math.max(0.2, Math.min(newScale, 4));
        }
    }
}

function handleTouchEnd(e) {
    if (touchState.isDragging && !touchState.hasDragged && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        checkClickItem(target);
    }
    if (e.touches.length === 0) {
        touchState.isDragging = false;
    }
}

function checkClickItem(target) {
    const item = target?.closest('.gallery-item');
    if (item) {
        const img = item.querySelector('img');
        if (img && img.dataset.src) openLightbox(img.dataset.src);
    }
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

    if (db) {
        try {
            galleryData = await fetchGalleryFromFirestore();
        } catch (err) {
            galleryData = JSON.parse(localStorage.getItem('solviaGallery') || '[]');
        }
    } else {
        galleryData = JSON.parse(localStorage.getItem('solviaGallery') || '[]');
    }

    if (!galleryData || galleryData.length === 0) {
        galleryGrid.innerHTML = `<p class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-500 text-xl">Chưa có ảnh nào được đăng. Hãy là người đầu tiên!</p>`;
        return;
    }

    const isMobile = window.innerWidth < 768;
    const numCols = isMobile ? 2 : 6;
    const colWidth = isMobile ? (window.innerWidth / numCols - 20) : (window.innerWidth / numCols * 1.5);
    const colHeights = Array(numCols).fill(0);
    const margin = 40;

    for (const [index, item] of galleryData.entries()) {
        const img = new Image();
        img.src = item.src;
        try { await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; }); } 
        catch (error) { continue; }

        const isWide = item.layout === '4_GRID' || item.layout === '8_VERTICAL';
        const itemWidth = isWide ? colWidth * 2 - margin : colWidth - margin;
        const itemHeight = img.height * (itemWidth / (img.width || 1));

        let targetCol = 0;
        let topPosition = 0;

        if (isWide) {
            let minH = Infinity;
            for (let i = 0; i < numCols - 1; i++) {
                const h = Math.max(colHeights[i], colHeights[i + 1]);
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
        if (isWide) {
            colHeights[targetCol] = newHeight;
            colHeights[targetCol + 1] = newHeight;
        } else {
            colHeights[targetCol] = newHeight;
        }
    }
    console.log("loadGallery xong.");
}

function openLightbox(src) {
    lightboxImage.src = src;
    lightboxOverlay.style.display = 'flex';
}
function closeLightboxFunc() {
    lightboxOverlay.style.display = 'none';
    lightboxImage.src = '';
}
closeLightbox.onclick = closeLightboxFunc;
lightboxOverlay.onclick = (e) => { if (e.target === lightboxOverlay) closeLightboxFunc(); };

window.publishImage = publishImage;
window.saveImage = saveImage;
window.openLightbox = openLightbox;
window.closeLightboxFunc = closeLightboxFunc;

window.onload = () => {
    console.log("window.onload triggered");
    initializeUI();
    showScreen('homeScreen');
    document.getElementById('scrollToBottomBtn')?.addEventListener('click', scrollToFooter);
};

function scrollToFooter() {
    const footerElement = document.getElementById('pageFooter');
    if (footerElement) {
        footerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
};

console.log("Script photobooth solvia 2.0 đã được tải.");

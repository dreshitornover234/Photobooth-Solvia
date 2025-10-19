document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 1. LẤY CÁC PHẦN TỬ HTML (DOM ELEMENTS)
    // =================================================================
    const gameBoard = document.getElementById('gameBoard');
    const playerToken = document.getElementById('playerToken');
    const rollDiceBtn = document.getElementById('rollDiceBtn');
    const dice = document.getElementById('dice');
    const giftModal = document.getElementById('giftModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalIcon = document.getElementById('modalIcon');
    const closeButton = document.querySelector('.close-button');

    // =================================================================
    // 2. CẤU HÌNH VÀ TRẠNG THÁI TRÒ CHƠI (GAME CONFIG & STATE)
    // =================================================================
    let currentPlayerPosition = 0;
    const totalCells = 20;
    const cellCoordinates = [
        { row: 5, col: 1 }, { row: 4, col: 1 }, { row: 3, col: 1 }, { row: 2, col: 1 }, { row: 1, col: 1 },
        { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 3 }, { row: 3, col: 4 },
        { row: 3, col: 5 }, { row: 2, col: 5 }, { row: 1, col: 5 }, { row: 1, col: 6 }, { row: 1, col: 7 },
        { row: 2, col: 7 }, { row: 3, col: 7 }, { row: 4, col: 7 }, { row: 5, col: 7 }, { row: 5, col: 6 }
    ];
    const boardData = [
        { type: 'start', title: "Xuất phát!", message: "Hành trình yêu thương bắt đầu. Chúc bạn một ngày 20/10 thật tuyệt vời!", icon: "🚀" },
        { type: 'gift', title: "Nụ cười rạng rỡ", message: "Nụ cười của em là điều anh thấy đẹp đẽ nhất trên đời này, mỗi khi em cười, cả thế giới dường như ngừng lại ngắm nhìn sự dễ thương ấy đáng iu ấy, và anh rất thích được thấy những lúc ấy, nên là mong em lúc nào cũng vui vẻ và hạnh phúc như thế nhá  ", icon: "😊" },
        { type: 'normal', title: "Một điều tốt lành", message: "Chúc em luôn tự tin tiến về phía trước, vì chỉ cần em tin vào chính mình, chẳng có điều gì là không thể. Cố lên em nhé", icon: "🐾" },
        { type: 'gift', title: "Voucher trà sữa", message: "Tặng em một ly trà sữa ngọt ngào nhá, hãy chụp màn hình lại và nói anh biết nhá", icon: "🧋" },
        { type: 'normal', title: "Cố gắng để thành công", message: "Thành công không đến từ may mắn, mà từ sự cố gắng mỗi ngày. Chúc em luôn có đủ kiên nhẫn, dũng cảm và một tâm hồn mạnh mẽ để đi thực giấc mơ nha", icon: "👍" },
        { type: 'gift', title: "Ai rồi cũng sẽ rực rỡ", message: "Không ai hoàn hảo, nhưng mỗi ngày ta đều có thể trở nên tốt hơn. Chúc em luôn mạnh mẽ vượt qua giới hạn của chính mình — vì em xứng đáng với điều tuyệt vời nhất.", icon: "💐" },
        { type: 'normal', title: "Niềm tin", message: "Cuộc sống xa nhà đôi khi khiến ta chênh vênh, nhưng đừng quên: em đã vượt qua được bao nhiêu điều khó để đến được đây rồi đấy! Chúc em luôn tin vào chính mình, dù có mệt mỏi, hãy cứ bước tiếp – vì sau cơn mưa, trời luôn sáng.", icon: "✨" },
        { type: 'gift', title: "Nghỉ ngơi và chữa lành", message: "Đôi khi, dừng lại một chút không phải là yếu đuối, mà là để lấy lại năng lượng. Chúc em biết yêu thương chính mình, cho phép bản thân được nghỉ ngơi, được thở, và cười thật tươi giữa cuộc sống đầy áp lực", icon: "🎁" },
        { type: 'normal', title: "Sự mạnh mẽ", message: "Không ai sinh ra đã mạnh mẽ, nhưng em đang dần trở thành người như thế — từng ngày một. Chúc em đủ dũng cảm để đối diện với mọi thử thách, và đủ dịu dàng để vẫn mỉm cười giữa áp lực", icon: "☕" },
        { type: 'gift', title: "Em không hề cô đơn", message: "Xa nhà đôi khi khiến lòng trống trải, nhưng em không hề một mình đâu. Có biết bao người luôn đồng hành cùng em, tin em, và đang dõi theo em từng bước. Chúc em luôn cảm nhận được sự ấm áp ấy, để không cảm thấy tủi thân giữa một thành phố xa lạ ", icon: "🎵" },
        { type: 'normal', title: "Anh luôn tự hào em", message: "Đừng so sánh mình với ai cả. Em đã đi xa hơn rất nhiều so với ngày đầu tiên rồi. Chúc em luôn tự hào về bản thân, về hành trình của mình – vì mỗi bước đi, dù nhỏ bé, đều đáng trân trọng vô cùng", icon: "☀️" },
        { type: 'gift', title: "Gia đình", message: "Dù cách xa bao nhiêu, tình yêu thương từ gia đình vẫn luôn bên em. Hãy để những ký ức ấm áp đó là điểm tựa mỗi khi em thấy yếu lòng. Chúc em luôn vững vàng, và nhớ rằng – ở nhà, vẫn có người tự hào về em từng ngày.", icon: "🎟️" },
        { type: 'normal', title: "Kiên trì", message: "Không có hành trình nào dễ dàng, nhưng mỗi bước đi của em đều đáng giá. Chúc em kiên trì với ước mơ của mình, bởi điều tuyệt vời chỉ đến với những ai không bỏ cuộc.", icon: "🌟" },
        { type: 'gift', title: "Ly trà sữa", message: "Tặng em một ly trà sữa nhá, chụp màn hình lại và gửi cho anh nì ", icon: "📚" },
        { type: 'normal', title: "Niềm hy vọng", message: "Chúc em luôn giữ hy vọng trong tim – vì dù hôm nay mệt mỏi, ngày mai vẫn có thể tươi sáng hơn. Hãy tin rằng mọi điều tốt đẹp đang đến gần hơn mỗi ngày.", icon: "❤️" },
        { type: 'gift', title: "Bình yên nhỏ", message: "Chúc em luôn giữ hy vọng trong tim – vì dù hôm nay mệt mỏi, ngày mai vẫn có thể tươi sáng hơn. Hãy tin rằng mọi điều tốt đẹp đang đến gần hơn mỗi ngày.", icon: "💖" },
        { type: 'gift', title: "Tô mì cay", message: "Tặng em một tô mì cay nhá, chụp màn hình lại và gửi cho anh nì ", icon: "📚" },
        { type: 'gift', title: "Niềm vui nhỏ", message: "Đừng chờ những điều to lớn mới gọi là hạnh phúc. Chúc em nhận ra rằng niềm vui đôi khi chỉ là một bữa cơm ngon, một ngày nắng đẹp, hay một lời hỏi thăm, động viên, an ủi từ những người quan trọng", icon: "✈️" },
        { type: 'normal', title: "Yêu thương", message: "Đích đến hôm nay không chỉ là chiến thắng, mà là hiểu rằng: em xứng đáng được yêu thương, được hạnh phúc, và được nghỉ ngơi trong bình yên.", icon: "🐾" },
        { type: 'finish', title: "VỀ ĐÍCH!", message: "Chúc mừng bạn đã hoàn thành hành trình! Phần thưởng lớn nhất là niềm vui và hạnh phúc. Happy 20/10!", icon: "🏆" }
    ];

    // =================================================================
    // 3. CÁC HÀM XỬ LÝ CHÍNH CỦA TRÒ CHƠI (CORE GAME FUNCTIONS)
    // =================================================================
    function createBoard() { boardData.forEach((data, index) => { const cell = document.createElement('div'); cell.className = `cell ${data.type}`; cell.dataset.index = index; const { row, col } = cellCoordinates[index]; cell.style.gridArea = `${row} / ${col}`; const cellText = index === 0 ? 'Start' : (index === totalCells - 1 ? 'End' : index + 1); cell.innerHTML = `<span class="cell-number">${cellText}</span>`; gameBoard.appendChild(cell); }); updatePlayerPosition(true); }
    function updatePlayerPosition(isInitial = false) { document.querySelectorAll('.cell.current').forEach(c => c.classList.remove('current')); if (currentPlayerPosition < cellCoordinates.length) { const { row, col } = cellCoordinates[currentPlayerPosition]; playerToken.style.gridArea = `${row} / ${col}`; if (!isInitial) { setTimeout(() => { const currentCell = document.querySelector(`.cell[data-index="${currentPlayerPosition}"]`); if (currentCell) { currentCell.classList.add('current'); } }, 350); } else { const currentCell = document.querySelector(`.cell[data-index="0"]`); currentCell.classList.add('current'); } } }
    function movePlayer(steps) { let currentStep = 0; const moveInterval = setInterval(() => { currentPlayerPosition++; if (currentPlayerPosition >= totalCells) { currentPlayerPosition = totalCells - 1; } updatePlayerPosition(); currentStep++; if (currentStep >= steps || currentPlayerPosition === totalCells - 1) { clearInterval(moveInterval); setTimeout(() => { showGift(currentPlayerPosition); if (currentPlayerPosition < totalCells - 1) { rollDiceBtn.disabled = false; } }, 400); } }, 400); }
    function closeModal() { giftModal.classList.remove('show'); }

    // =================================================================
    // 4. LẮNG NGHE SỰ KIỆN (EVENT LISTENERS)
    // =================================================================
    rollDiceBtn.addEventListener('click', () => { rollDiceBtn.disabled = true; const rollValue = Math.floor(Math.random() * 6) + 1; const faceClasses = { 1: 'show-1', 2: 'show-2', 3: 'show-3', 4: 'show-4', 5: 'show-5', 6: 'show-6', }; dice.className = 'dice tumble'; setTimeout(() => { dice.className = 'dice ' + faceClasses[rollValue]; setTimeout(() => { movePlayer(rollValue); }, 1500); }, 1500); });
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => { if (event.target === giftModal) { closeModal(); } });

    // =================================================================
    // 5. CÁC HÀM HIỆU ỨNG (VISUAL EFFECTS)
    // =================================================================
    function launchConfetti() { confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, zIndex: 1001 }); }
    particlesJS("particles-js", { particles: { number: { value: 80, density: { enable: true, value_area: 800 } }, color: { value: "#ffffff" }, shape: { type: "circle" }, opacity: { value: 0.5, random: true }, size: { value: 3, random: true }, move: { enable: true, speed: 1, direction: "none", random: true, out_mode: "out" } }, interactivity: { events: { onhover: { enable: true, mode: "repulse" } } } });
    
    // =================================================================
    // 6. LOGIC NÂNG CẤP CHO PHOTOBOOTH
    // =================================================================
    const photoboothModal = document.getElementById('photoboothModal');
    const video = document.getElementById('photoboothVideo');
    const hiddenCanvas = document.getElementById('hiddenCanvas');
    const countdownOverlay = document.getElementById('countdownOverlay');
    const flashEffect = document.getElementById('flashEffect');

    const startScreen = document.getElementById('startScreen');
    const cameraScreen = document.getElementById('cameraScreen');
    const reviewScreen = document.getElementById('reviewScreen');
    const resultScreen = document.getElementById('resultScreen');

    const startCaptureBtn = document.getElementById('startCaptureBtn');
    const captureBtn = document.getElementById('captureBtn');
    const photoPreviews = document.getElementById('photoPreviews');
    const confirmPhotosBtn = document.getElementById('confirmPhotosBtn');
    const retakeAllBtn = document.getElementById('retakeAllBtn');
    const finalCanvas = document.getElementById('finalCanvas');
    const saveBtn = document.getElementById('saveBtn');
    const closePhotoboothBtn = document.getElementById('closePhotoboothBtn');

    let stream;
    let capturedPhotos = [];
    const TOTAL_PHOTOS = 4;
    const COUNTDOWN_SECONDS = 10;

    function initPhotobooth() {
        capturedPhotos = [];
        startScreen.style.display = 'block';
        cameraScreen.style.display = 'none';
        reviewScreen.style.display = 'none';
        resultScreen.style.display = 'none';
        photoboothModal.classList.add('show');
    }

    startCaptureBtn.onclick = async () => {
        startScreen.style.display = 'none';
        cameraScreen.style.display = 'block';
        captureBtn.disabled = false;
        try {
            if (stream) stream.getTracks().forEach(track => track.stop());
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = stream;
            await video.play();
        } catch (err) {
            console.error("Lỗi camera: ", err);
            alert("Không thể truy cập camera. Vui lòng cấp quyền và thử lại.");
            closePhotobooth();
        }
    };
    
    captureBtn.onclick = () => {
        captureBtn.disabled = true;
        startCaptureSequence(0);
    };

    function startCaptureSequence(photoIndex) {
        if (photoIndex >= TOTAL_PHOTOS) {
            displayReviewScreen();
            return;
        }
        let count = COUNTDOWN_SECONDS;
        countdownOverlay.textContent = count;
        countdownOverlay.classList.add('show');
        const countdownInterval = setInterval(() => {
            count--;
            countdownOverlay.textContent = count > 0 ? count : '📸';
            if (count < 0) {
                clearInterval(countdownInterval);
                countdownOverlay.classList.remove('show');
                capturePhoto(photoIndex);
            }
        }, 1000);
    }

    function capturePhoto(photoIndex) {
        flashEffect.classList.add('flash');
        const context = hiddenCanvas.getContext('2d');
        hiddenCanvas.width = video.videoWidth;
        hiddenCanvas.height = video.videoHeight;
        context.translate(video.videoWidth, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        capturedPhotos[photoIndex] = hiddenCanvas.toDataURL('image/jpeg');
        setTimeout(() => {
            flashEffect.classList.remove('flash');
            startCaptureSequence(photoIndex + 1);
        }, 500);
    }

    function displayReviewScreen() {
        cameraScreen.style.display = 'none';
        reviewScreen.style.display = 'block';
        photoPreviews.innerHTML = '';
        capturedPhotos.forEach((photo, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            const img = document.createElement('img');
            img.src = photo;
            const retakeBtn = document.createElement('button');
            retakeBtn.className = 'retake-button';
            retakeBtn.innerHTML = '🔄';
            retakeBtn.onclick = () => retakeSinglePhoto(index);
            previewItem.appendChild(img);
            previewItem.appendChild(retakeBtn);
            photoPreviews.appendChild(previewItem);
        });
    }

    function retakeSinglePhoto(index) { alert("Tính năng đang phát triển! Vui lòng sử dụng 'Chụp lại tất cả'."); }
    retakeAllBtn.onclick = () => { startCaptureBtn.onclick(); };

    confirmPhotosBtn.onclick = async () => {
        reviewScreen.style.display = 'none';
        resultScreen.style.display = 'block';

        const ctx = finalCanvas.getContext('2d');
        const photoWidth = 640;
        const photoHeight = 480;
        const framePadding = 30;
        const innerSpacing = 15;
        const topBannerHeight = 100;
        const bottomBannerHeight = 80;

        finalCanvas.width = photoWidth + framePadding * 2;
        finalCanvas.height = topBannerHeight + (photoHeight + innerSpacing) * TOTAL_PHOTOS - innerSpacing + bottomBannerHeight + framePadding;

        ctx.fillStyle = '#fce4ec';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        ctx.fillStyle = '#ffc0cb';
        ctx.fillRect(0, 0, finalCanvas.width, topBannerHeight);

        ctx.font = 'bold 40px ' + getComputedStyle(document.body).getPropertyValue('--font-heading');
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText('20 / 10', framePadding, topBannerHeight / 2 + 15);
        
        ctx.font = '24px ' + getComputedStyle(document.body).getPropertyValue('--font-body');
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.fillText('Chúc bạn luôn xinh đẹp!', finalCanvas.width - framePadding, topBannerHeight / 2 + 10);

        for (let i = 0; i < capturedPhotos.length; i++) {
            const img = new Image();
            img.src = capturedPhotos[i];
            await new Promise(resolve => img.onload = resolve);
            const yPos = topBannerHeight + framePadding / 2 + i * (photoHeight + innerSpacing);
            ctx.drawImage(img, framePadding, yPos, photoWidth, photoHeight);
        }

        ctx.fillStyle = '#ffc0cb';
        ctx.fillRect(0, finalCanvas.height - bottomBannerHeight, finalCanvas.width, bottomBannerHeight);
        
        ctx.font = 'bold 32px ' + getComputedStyle(document.body).getPropertyValue('--font-heading');
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('Happy Day!', finalCanvas.width / 2, finalCanvas.height - bottomBannerHeight / 2 + 10);

        if (stream) stream.getTracks().forEach(track => track.stop());
    };

    function closePhotobooth() { if (stream) { stream.getTracks().forEach(track => track.stop()); } photoboothModal.classList.remove('show'); }
    closePhotoboothBtn.onclick = closePhotobooth;

    saveBtn.onclick = () => {
        const link = document.createElement('a');
        link.download = 'Ky-niem-20-10.jpg';
        link.href = finalCanvas.toDataURL('image/jpeg', 0.9);
        link.click();
    };

    function showGift(position) {
        const data = boardData[position];
        if (data.type === 'finish') {
            initPhotobooth();
        } else {
            modalTitle.textContent = data.title;
            modalMessage.textContent = data.message;
            modalIcon.textContent = data.icon;
            giftModal.classList.add('show');
            launchConfetti();
        }
    }

    // =================================================================
    // 7. KHỞI TẠO TRÒ CHƠI (INITIALIZE GAME)
    // =================================================================
    createBoard();
});
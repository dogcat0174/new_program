// === 앱스 스크립트 웹 앱 URL을 아래에 붙여넣으세요 ===
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyLlw9ilIG-7f0KDcCJkiah9GdWWI72mOKk3u4dWi9RuNDKF3OhaEZmJGaaiRs9VZ3h/exec';
// ===============================================

const canvas = document.getElementById('signaturePad');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clearBtn');
const form = document.getElementById('signatureForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.querySelector('.btn-text');
const loader = document.querySelector('.loader');
const statusMessage = document.getElementById('statusMessage');
const initialLoader = document.getElementById('initialLoader');

let isDrawing = false;
let hasSigned = false;
let globalTopicsMap = {};

// 초기화: 드롭다운 데이터 로드
document.addEventListener('DOMContentLoaded', async () => {
    if (GOOGLE_APP_SCRIPT_URL === 'YOUR_WEB_APP_URL_HERE') {
        initialLoader.innerHTML = '<p style="color:var(--error);">Google Apps Script URL이 설정되지 않았습니다.<br>app.js 및 admin.js 파일을 수정해주세요.</p>';
        return;
    }

    try {
        const response = await fetch(GOOGLE_APP_SCRIPT_URL);
        const data = await response.json();
        
        // 서버에서 전달해준 연수별 주제 저장
        globalTopicsMap = data.topicsMap || {};

        // 연수 목록 세팅
        const trainingSelect = document.getElementById('trainingList');
        data.sheets.forEach(sheetName => {
            const option = document.createElement('option');
            option.value = sheetName;
            option.textContent = sheetName;
            trainingSelect.appendChild(option);
        });

        // 부서 목록 세팅
        const deptSelect = document.getElementById('department');
        data.departments.forEach(deptName => {
            const option = document.createElement('option');
            option.value = deptName;
            option.textContent = deptName;
            deptSelect.appendChild(option);
        });

        // 로더 숨기고 폼 보여주기
        initialLoader.classList.add('hidden');
        form.classList.remove('hidden');
        submitBtn.disabled = false;

        // 캔버스 사이즈 재조정
        resizeCanvas();

    } catch (error) {
        console.error('Failed to load initial data:', error);
        initialLoader.innerHTML = '<p style="color:var(--error);">데이터를 불러오는데 실패했습니다. 네트워크 혹은 URL을 확인해주세요.</p>';
    }
});

// Canvas Setup
function resizeCanvas() {
    if (form.classList.contains('hidden')) return;

    const wrapper = document.querySelector('.canvas-wrapper');
    const width = wrapper.clientWidth;
    const height = 200;

    // 모바일 브라우저 세로 스크롤 시 URL창 숨김에 따른 세로 사이즈 변경만 일어날 경우 캔버스 닦임 방지
    if (canvas.style.width === width + 'px') {
        return; 
    }

    // 작성 중이던 서명이 날아가지 않도록 안전하게 백업
    let tempImgData = null;
    if (hasSigned) {
        tempImgData = canvas.toDataURL();
    }

    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    var scale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);

    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';

    // 백업이 있다면 크기에 맞추어 다시 그려넣기
    if (tempImgData) {
        const img = new Image();
        img.onload = () => {
             ctx.drawImage(img, 0, 0, width, height);
        };
        img.src = tempImgData;
    }
}

window.addEventListener('resize', resizeCanvas);

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / window.devicePixelRatio / rect.width;
    const scaleY = canvas.height / window.devicePixelRatio / rect.height;

    let clientX = evt.clientX;
    let clientY = evt.clientY;

    if (evt.touches && evt.touches.length > 0) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function startPosition(e) {
    e.preventDefault();
    isDrawing = true;
    hasSigned = true;
    draw(e);
}

function endPosition() {
    isDrawing = false;
    ctx.beginPath();
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const pos = getMousePos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

// Events
canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('mouseup', endPosition);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseleave', endPosition);

canvas.addEventListener('touchstart', startPosition, { passive: false });
canvas.addEventListener('touchend', endPosition);
canvas.addEventListener('touchmove', draw, { passive: false });

clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSigned = false;
    ctx.beginPath();
});

// 연수 선택시 동적 주제 렌더링
const trainingListSelect = document.getElementById('trainingList');
const topicDisplay = document.getElementById('topicDisplay');
const topicText = document.getElementById('topicText');

trainingListSelect.addEventListener('change', (e) => {
    const selectedTraining = e.target.value;
    const topics = globalTopicsMap[selectedTraining];
    
    if (topics && topics.trim().length > 0) {
        topicText.innerHTML = topics.replace(/\n/g, '<br>');
        topicDisplay.classList.remove('hidden');
    } else {
        topicDisplay.classList.add('hidden');
        topicText.innerHTML = "";
    }
});

// Submit Form
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!hasSigned) {
        showStatus('서명을 그려주세요.', 'error');
        return;
    }

    const trainingName = document.getElementById('trainingList').value;
    const department = document.getElementById('department').value;
    const name = document.getElementById('name').value.trim();

    // 엑셀 규격에 맞게 프론트엔드에서 강제로 사이즈를 축소하여 저장
    const targetWidth = 180;
    const targetHeight = 72;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 흰색 배경 채우기 (투명도 방지용 옵션)
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, targetWidth, targetHeight);
    // 원본 캔버스 그림을 축소하여 그림
    tempCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
    
    // 축소된 데이터 추출
    const signatureData = tempCanvas.toDataURL('image/png');

    const payload = {
        action: 'submit_signature',
        trainingName: trainingName,
        department: department,
        name: name,
        signature: signatureData
    };

    setLoadingState(true);
    hideStatus();

    try {
        const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            }
        });

        const result = await response.json();

        if (result.result === 'success') {
            showStatus('성공적으로 저장되었습니다.', 'success');
            // reset fields
            document.getElementById('name').value = '';
            clearBtn.click();
        } else {
            throw new Error(result.error || 'Server returned error');
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        showStatus('저장에 실패했습니다. 관리자에게 문의하세요.', 'error');
    } finally {
        setLoadingState(false);
    }
});

function setLoadingState(isLoading) {
    if (isLoading) {
        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
    } else {
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
}

function showStatus(text, type) {
    statusMessage.textContent = text;
    statusMessage.className = `hidden`;
    void statusMessage.offsetWidth;
    statusMessage.classList.add(type === 'success' ? 'success-message' : 'error-message');
    statusMessage.classList.remove('hidden');
}

function hideStatus() {
    statusMessage.classList.add('hidden');
}

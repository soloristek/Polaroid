// ================= 設定區 =================
const LIFF_ID = '你的_LIFF_ID'; // [必填] 替換成你的 LIFF ID
const IMGUR_CLIENT_ID = '你的_IMGUR_CLIENT_ID'; // [必填] 替換成你的 Imgur Client ID
const FRAME_URL = 'frame.png'; // 預設的透明相框圖檔路徑

let canvas;
let frameImage;

// 1. 初始化 LIFF
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        // 如果是在外部瀏覽器開啟，要求登入
        if (!liff.isLoggedIn() && !liff.isInClient()) {
            liff.login();
        }
    } catch (err) {
        console.error('LIFF 初始化失敗', err);
    }
}

// 2. 初始化 Fabric.js 畫布
function initCanvas() {
    // 建立 300x300 的畫布
    canvas = new fabric.Canvas('canvas', {
        width: 300,
        height: 300,
        backgroundColor: '#ffffff'
    });

    // 載入透明相框 (設定為不可選取、不阻擋下方事件)
    fabric.Image.fromURL(FRAME_URL, function(img) {
        img.set({
            left: 0,
            top: 0,
            scaleX: canvas.width / img.width,
            scaleY: canvas.height / img.height,
            selectable: false, // 禁止使用者移動相框
            evented: false     // 讓滑鼠/觸控事件穿透相框，才能拉動下方的照片
        });
        frameImage = img;
        canvas.add(img);
    });
}

// 3. 處理使用者選擇照片
document.getElementById('imageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(f) {
        const data = f.target.result;
        fabric.Image.fromURL(data, function(img) {
            // 自動縮放圖片以適應畫布大小
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            img.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center',
                scaleX: scale,
                scaleY: scale,
                cornerColor: '#00B900',
                borderColor: '#00B900',
                transparentCorners: false
            });

            canvas.add(img);
            
            // 重要：每次加入新照片後，要把相框拉到最上層
            if (frameImage) {
                canvas.bringToFront(frameImage);
            }

            // 啟用送出按鈕
            document.getElementById('sendBtn').disabled = false;
        });
    };
    reader.readAsDataURL(file);
});

// 4. 合成圖片並上傳至 Imgur
document.getElementById('sendBtn').addEventListener('click', async function() {
    // 取消選取框線，避免被截圖進去
    canvas.discardActiveObject();
    canvas.renderAll();

    // 將畫布轉為 Base64 (JPEG 格式)
    const base64Image = canvas.toDataURL({
        format: 'jpeg',
        quality: 0.9
    }).split(',')[1];

    // UI 狀態切換
    document.getElementById('sendBtn').disabled = true;
    document.getElementById('loading').classList.remove('hidden');

    try {
        // 呼叫 Imgur API
        const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: {
                'Authorization': 'Client-ID ' + IMGUR_CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: base64Image,
                type: 'base64'
            })
        });

        const result = await response.json();
        
        if (result.success) {
            const imageUrl = result.data.link; // 取得 Imgur 圖片網址
            sendToLine(imageUrl);
        } else {
            alert('上傳圖片失敗，請檢查 Imgur Client ID');
            resetBtn();
        }
    } catch (error) {
        console.error('上傳發生錯誤', error);
        alert('網路錯誤或上傳失敗');
        resetBtn();
    }
});

// 5. 透過 LIFF 傳送訊息至聊天室
function sendToLine(imageUrl) {
    // 確認是在 LINE App 內部執行
    if (liff.isInClient()) {
        liff.sendMessages([
            {
                type: 'image',
                originalContentUrl: imageUrl,
                previewImageUrl: imageUrl // 預覽圖使用同一張
            }
        ]).then(() => {
            // 傳送成功後關閉視窗
            liff.closeWindow();
        }).catch((err) => {
            console.error('LIFF 發送失敗', err);
            alert('發送訊息失敗');
            resetBtn();
        });
    } else {
        // 若在一般瀏覽器測試，直接顯示網址
        alert('合成成功！圖片網址：\n' + imageUrl);
        resetBtn();
    }
}

// 復原按鈕狀態
function resetBtn() {
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('loading').classList.add('hidden');
}

// 網頁載入後啟動
window.onload = () => {
    initializeLiff();
    initCanvas();
};

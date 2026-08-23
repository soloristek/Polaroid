// ================= 設定區 =================
const LIFF_ID = '2011209422-rgTsz9k9'; // [必填] 替換成你的 LIFF ID
const IMGBB_API_KEY = 'd7e564d52eb7afd37bf4b8693b2be802'; // [必填] 替換成你的 ImgBB API Key
const FRAME_URL = 'frame.png'; // 預設的透明相框圖檔路徑

let canvas;
let frameImage;

// 1. 初始化 LIFF
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        // 若在外部瀏覽器開啟，引導登入
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

    // 載入透明相框 (設定不可點選、事件穿透)
    fabric.Image.fromURL(FRAME_URL, function(img) {
        img.set({
            left: 0,
            top: 0,
            scaleX: canvas.width / img.width,
            scaleY: canvas.height / img.height,
            selectable: false, // 禁止移動相框
            evented: false     // 穿透相框以操控下方照片
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
            // 自動縮放以適應畫布
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
            
            // 每次載入新照片，確保相框在最上層
            if (frameImage) {
                canvas.bringToFront(frameImage);
            }

            // 啟用合成按鈕
            document.getElementById('sendBtn').disabled = false;
        });
    };
    reader.readAsDataURL(file);
});

// 4. 合成圖片並上傳至 ImgBB
document.getElementById('sendBtn').addEventListener('click', async function() {
    // 取消選取框線
    canvas.discardActiveObject();
    canvas.renderAll();

    // 取得畫布 Base64 (去除 header 前綴)
    const base64Image = canvas.toDataURL({
        format: 'jpeg',
        quality: 0.9
    }).split(',')[1];

    // 切換按鈕狀態
    document.getElementById('sendBtn').disabled = true;
    document.getElementById('loading').classList.remove('hidden');

    try {
        // 使用 FormData 傳送至 ImgBB API
        const formData = new FormData();
        formData.append('image', base64Image);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            const imageUrl = result.data.url; // 取得 ImgBB 的公開 HTTPS 網址
            sendToLine(imageUrl);
        } else {
            alert('上傳圖片失敗，請檢查 ImgBB API Key');
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
    if (liff.isInClient()) {
        liff.sendMessages([
            {
                type: 'image',
                originalContentUrl: imageUrl,
                previewImageUrl: imageUrl
            }
        ]).then(() => {
            liff.closeWindow(); // 成功後關閉視窗
        }).catch((err) => {
            console.error('LIFF 發送失敗', err);
            alert('發送訊息至 LINE 失敗');
            resetBtn();
        });
    } else {
        alert('合成成功！圖片網址：\n' + imageUrl);
        resetBtn();
    }
}

// 復原按鈕狀態
function resetBtn() {
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('loading').classList.add('hidden');
}

// 啟動
window.onload = () => {
    initializeLiff();
    initCanvas();
};

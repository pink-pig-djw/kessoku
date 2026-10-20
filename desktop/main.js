// 孤独摇滚！ 第五条音轨 —— Windows 桌面版（Electron）
// 游戏本体在 www/（由 tools/build_win.sh 从 app/www 复制过来：图片是 WebP、不需要联网）
const { app, BrowserWindow, screen, shell } = require('electron');
const path = require('path');

// 音乐不需要先点一下才能播放
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
function createWindow() {
  // 窗口：屏幕可用区域的 80%，保持 16:9
  const wa = screen.getPrimaryDisplay().workAreaSize;
  let w = Math.round(wa.width * 0.8), h = Math.round(w * 9 / 16);
  if (h > wa.height * 0.85) { h = Math.round(wa.height * 0.85); w = Math.round(h * 16 / 9); }
  win = new BrowserWindow({
    width: w, height: h, minWidth: 960, minHeight: 540, useContentSize: true,
    title: '孤独摇滚！第五条音轨', backgroundColor: '#05070d', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'www', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  win.setMenu(null);
  win.setAspectRatio(16 / 9);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'www', 'index.html'));

  // F11 / Alt+Enter：切换全屏
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
  });
  // 全屏时不锁比例，退出全屏后恢复 16:9
  win.on('enter-full-screen', () => win.setAspectRatio(0));
  win.on('leave-full-screen', () => win.setAspectRatio(16 / 9));
  // 不在窗口里打开别的网页
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

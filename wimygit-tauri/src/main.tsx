import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import './index.css'
import App from './App.tsx'

// Tauri WebView2에서 기본 우클릭 컨텍스트 메뉴가 JavaScript의
// e.preventDefault()보다 먼저 렌더링되는 문제 방지.
// input/textarea는 제외하여 텍스트 선택 메뉴는 유지.
document.addEventListener('contextmenu', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
    e.preventDefault();
  }
}, { capture: true });

const WINDOW_STATE_KEY = 'window_state';

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

// 최대화되지 않은 상태의 크기/위치를 추적 (최대화 중에는 갱신하지 않음)
let lastNormalBounds: { x: number; y: number; width: number; height: number } | null = null;
let lastMaximized = false;

async function restoreWindowState() {
  const win = getCurrentWindow();
  try {
    const raw = localStorage.getItem(WINDOW_STATE_KEY);
    if (!raw) return;
    const state: WindowState = JSON.parse(raw);
    if (state.width > 0 && state.height > 0) {
      await win.setSize(new PhysicalSize(state.width, state.height));
      await win.setPosition(new PhysicalPosition(state.x, state.y));
      lastNormalBounds = { x: state.x, y: state.y, width: state.width, height: state.height };
      if (state.maximized) {
        await win.maximize();
        lastMaximized = true;
      }
    }
  } catch {
    // ignore — use default size
  }
}

async function trackNormalBounds() {
  const win = getCurrentWindow();
  const maximized = await win.isMaximized();
  lastMaximized = maximized;
  if (!maximized) {
    const size = await win.outerSize();
    const pos = await win.outerPosition();
    lastNormalBounds = { x: pos.x, y: pos.y, width: size.width, height: size.height };
  }
}

// 앱 시작 시 윈도우 크기/위치 복원 후 렌더링
restoreWindowState().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // 콘텐츠가 렌더링된 후 윈도우를 표시하여 빈 프레임이 먼저 보이는 문제 방지
  requestAnimationFrame(() => {
    getCurrentWindow().show();
  });

  // 리사이즈/이동 시 일반 상태 크기를 추적
  const win = getCurrentWindow();
  win.onResized(() => { trackNormalBounds(); });
  win.onMoved(() => { trackNormalBounds(); });
});

// 앱 종료 시 윈도우 상태를 동기적으로 저장 (async 사용 안 함)
window.addEventListener('beforeunload', () => {
  if (!lastNormalBounds) return;
  const state: WindowState = { ...lastNormalBounds, maximized: lastMaximized };
  localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(state));
});

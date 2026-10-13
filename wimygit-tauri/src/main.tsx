import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
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

// 윈도우 크기/위치 저장·복원은 Rust 측 tauri-plugin-window-state가 담당한다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 콘텐츠가 렌더링된 후 윈도우를 표시하여 빈 프레임이 먼저 보이는 문제 방지
setTimeout(() => {
  getCurrentWindow().show();
}, 10);

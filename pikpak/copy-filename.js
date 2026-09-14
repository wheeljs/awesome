// ==UserScript==
// @name         PikPak 中键复制标题
// @namespace    http://tampermonkey.net/
// @version      0.5.1
// @description  中键点击Pikpak中的文件名即可复制
// @author       Wheeljs
// @match        https://mypikpak.com/*
// @match        https://*.mypikpak.com/*
// @grant        GM_setClipboard
// @license      GPL-3.0
// ==/UserScript==

(function () {
  'use strict';

  // 阻止中键触发自动滚动
  window.addEventListener(
    'mousedown',
    function (e) {
      if (e.button === 1) {
        e.preventDefault();
      }
    },
    true,
  );

  function findText(node) {
    let cur = node;
    while (cur && cur !== document.documentElement) {
      if (
        cur.matches?.('span.ellipsis') ||
        cur.matches?.('.file-info .name-box .name')
      ) {
        return cur.textContent.trim();
      }
      if (cur.matches?.('li[aria-label]')) {
        return (cur.getAttribute('aria-label') || cur.textContent).trim();
      }

      const span = cur.querySelector('span.ellipsis');
      if (span) return span.textContent.trim();

      const li = cur.querySelector('li[aria-label]');
      if (li) return (li.getAttribute('aria-label') || li.textContent).trim();

      cur = cur.parentElement;
    }
    return null;
  }

  // 简单气泡提示
  function showToast(text) {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.75);
      color: #fff;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 999999;
      opacity: 0;
      transition: opacity .2s ease;
    `;
    document.body.appendChild(div);

    requestAnimationFrame(() => (div.style.opacity = 1));

    setTimeout(() => {
      div.style.opacity = 0;
      setTimeout(() => div.remove(), 200);
    }, 1000);
  }

  // 中键松开时复制
  window.addEventListener(
    'mouseup',
    function (e) {
      if (e.button !== 1) return;

      const text = findText(e.target);
      if (text) {
        GM_setClipboard(text);
        showToast('已复制：' + text);
      }
    },
    { capture: true, }
  );
})();

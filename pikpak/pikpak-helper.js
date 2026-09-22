// ==UserScript==
// @name         PikPak 中键复制标题和更新检查
// @namespace    https://github.com/wheeljs
// @version      0.6.1
// @description  中键点击Pikpak中的文件名即可复制；更新的目录会高亮显示，需要先完整保存一次快照
// @author       wheeljs
// @require      https://unpkg.com/umd-lodash@1.2.0/dist/debounce.min.js
// @match        https://mypikpak.com/*
// @match        https://*.mypikpak.com/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @license      GPL-3.0
// ==/UserScript==

(function () {
  'use strict';

  const ScriptPrefix = '__pikpak-helper';

  // 阻止中键触发自动滚动
  window.addEventListener(
    'mousedown',
    function (e) {
      if (e.button === 1) {
        e.preventDefault();
      }
    },
    { capture: true, },
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
    div.classList.add(`${ScriptPrefix}-message`);
    div.textContent = text;
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
  
  const getPageId = () => location.pathname;
  const saveSnapshotBtn = document.createElement('button');
  saveSnapshotBtn.classList.add(`${ScriptPrefix}-save-snapshot-btn`);
  saveSnapshotBtn.textContent = '保存快照';

  saveSnapshotBtn.addEventListener('click', () => {
    const $fileListItems = document.querySelectorAll('ol.file-list > li');
    const snapshots = Object.fromEntries(
      Array.from($fileListItems)
        .map(($fileItem) => {
          const $thumb = $fileItem.querySelector('.folder-cover .cover .el-image img');
          if (!$thumb) {
            return;
          }

          return [
            $fileItem.id,
            {
              thumb: $thumb.src,
            },
          ];
        })
        .filter(x => x)
    );

    localStorage.setItem(`snapshot-${getPageId()}`, JSON.stringify(snapshots));
    showToast('快照更新成功！');

    document.querySelectorAll(`.${ScriptPrefix}-has-update`).forEach(($fileItem) => {
      $fileItem.classList.remove(`${ScriptPrefix}-has-update`);
    });
  });

  window.addEventListener('load', () => {
    document.body.appendChild(saveSnapshotBtn);
    const tmp = localStorage.getItem(`snapshot-${getPageId()}`);
    if (!tmp) {
      return;
    }
    const snapshots = JSON.parse(tmp);

    GM_addStyle(`
      .${ScriptPrefix}-message {
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
      }

      .${ScriptPrefix}-save-snapshot-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 4px 8px;
        border: none;
        border-radius: 6px;
        background: rgb(0, 123, 255, 0.8);
        color: #fff;
        cursor: pointer;
        z-index: 2000;
      }

      .${ScriptPrefix}-save-snapshot-btn:hover {
        background: rgb(0, 123, 255);
      }

      .file-item.grid {
        transition: background-color 0.25s ease;
      }

      .${ScriptPrefix}-has-update .file-item {
        background-color: #c3d2f1;        
      }
    `);

    const diffThumb = _.debounce((snapshots) => {
      Object.entries(snapshots).forEach(([id, { thumb }]) => {
        const $fileItem = document.querySelector(`li#${id}`);
        if (!$fileItem) {
          return;
        }

        const $thumb = $fileItem.querySelector('.folder-cover .cover .el-image img');
        if (!$thumb) {
          return;
        }

        if ($thumb.src === thumb) {
          return;
        }
        
        $fileItem.classList.add(`${ScriptPrefix}-has-update`);
      });
    }, 1200);

    const fileListObserver = new MutationObserver(() => {
      diffThumb(snapshots);
    });
    fileListObserver.observe(document.querySelector('.drive-layout'), {
      childList: true,
      subtree: true,
    });

    diffThumb(snapshots);

    console.log('Pikpak 中键复制标题和更新检查已加载');
  });
})();

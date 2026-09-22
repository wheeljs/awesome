// ==UserScript==
// @name         Decode Base64
// @namespace    https://github.com/wheeljs
// @version      1.0.0
// @description  右键菜单（Tampermonkey 分组）"Decode Base64"：解码选中文字并弹窗展示结果
// @author       wheeljs
// @match        *://*/*
// @run-at       context-menu
// @grant        GM_registerMenuCommand
// @license      GPL-3.0
// ==/UserScript==

/*
 * 用法：在页面上选中任意文字，右键 -> Tampermonkey -> "Decode Base64"，
 *      或点击 Tampermonkey 工具栏弹窗菜单里的同名命令，弹窗展示解码结果。
 *
 * 说明：
 * 1. @run-at context-menu 表示脚本不在页面加载时注入，
 *    只有用户点击本脚本注册的菜单命令时才注入执行（官方文档：
 *    "The script will be injected if it is clicked at the browser context menu
 *    or at the popup menu"，且 @include/@exclude 会被忽略）；
 * 2. 菜单命令由 GM_registerMenuCommand 注册，桌面 Chrome 系浏览器中
 *    Tampermonkey 会把它列进页面原生右键菜单的 "Tampermonkey" 分组，
 *    同时也会出现在扩展弹窗菜单里；
 * 3. 按要求不校验选中内容是否为"标准 Base64"：选中什么就解码什么，
 *    无法解码时在弹窗里说明原因；但仍做宽松化处理
 *    （去空白、去 data URL 前缀、还原 URL-safe 字符、补齐 "="）。
 */

(() => {
  'use strict';

  const MENU_LABEL = 'Decode Base64';
  // UTF-8 解码失败时的替换字符
  const REPLACEMENT_CHAR = '\uFFFD';
  // UI 实例挂在 documentElement 上：每次点击菜单都会重新注入脚本，复用同一个弹窗宿主
  const UI_KEY = '__decodeBase64Ui';

  /* ------------------------------ 解码 ------------------------------ */

  /** 解码失败时抛出，消息可直接展示给用户 */
  class Base64Error extends Error {}

  const DATA_URL_RE = /^data:[^,]*;base64,/i;

  /** 去掉 data URL 前缀和空白字符，并把 URL-safe 字符还原成标准字符 */
  const normalize = (text) =>
    text
      .replace(DATA_URL_RE, '')
      .replace(/\s+/g, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');

  /** 取不含尾部补位的有效字符 */
  const stripPadding = (text) => normalize(text).replace(/=+$/, '');

  /** 重新补齐 "="，兼容省略补位的写法 */
  const pad = (text) => {
    const body = stripPadding(text);
    return body + '='.repeat((4 - (body.length % 4)) % 4);
  };

  /** 除制表符和换行外，是否还有不可见控制字符 */
  const hasControlChar = (text) => {
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) return true;
    }
    return false;
  };

  /** Base64 -> 字节数组 */
  const decodeBytes = (raw) => {
    let binary;
    try {
      binary = atob(pad(raw));
    } catch (error) {
      throw new Base64Error('选中内容不是合法的 Base64，无法解码');
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  /**
   * Base64 -> 字节 -> UTF-8 文本
   * @returns text 解码文本、bytes 解码字节、notes 需要提醒用户的问题
   */
  const decode = (raw) => {
    const bytes = decodeBytes(raw);
    // 容错解码：非法字节被替换成 U+FFFD，据此判断原文是不是合法 UTF-8
    const text = new TextDecoder('utf-8').decode(bytes);
    const validUtf8 = !text.includes(REPLACEMENT_CHAR);
    const hasInvisible = hasControlChar(text);

    const notes = [];
    if (!validUtf8) {
      notes.push('内容不是合法 UTF-8，无法映射的字节已显示为替换字符');
    }
    if (hasInvisible) {
      notes.push('解码结果包含不可见字符，原始内容可能是图片等二进制数据');
    }
    return { text, bytes, notes, validUtf8, hasInvisible };
  };

  /* ---------------------------- 选区文字 ---------------------------- */

  /** 读取当前选中的文字，输入框 / 文本域里的选区也算 */
  const getSelectedText = () => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      const start = active.selectionStart;
      const end = active.selectionEnd;
      if (typeof start === 'number' && typeof end === 'number' && end > start) {
        return active.value.slice(start, end);
      }
    }
    const selection = window.getSelection();
    return selection ? selection.toString() : '';
  };

  /* ------------------------------- UI ------------------------------- */

  /** 创建弹窗宿主（Shadow DOM，避免和宿主页面的样式互相污染） */
  const createUi = () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    document.documentElement.appendChild(host);

    const FONT = '13px/1.5 -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';

    const style = document.createElement('style');
    style.textContent = [
      '.mask { position: fixed; inset: 0; z-index: 2147483647; display: flex;',
      '  align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.4); font: ' + FONT + '; }',
      '.dialog { display: flex; flex-direction: column; width: min(560px, 90vw); max-height: 80vh;',
      '  background: #fff; border-radius: 8px; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28); overflow: hidden; }',
      '.dialog h2 { margin: 0; padding: 12px 16px; font-size: 14px; font-weight: 600; color: #222;',
      '  border-bottom: 1px solid #eee; }',
      '.dialog .meta { margin-left: 8px; font-size: 12px; font-weight: 400; color: #888; }',
      '.dialog pre { flex: 1; margin: 0; padding: 14px 16px; overflow: auto; white-space: pre-wrap;',
      '  word-break: break-all; background: #fafafa; color: #333; outline: none;',
      '  font: 12px/1.6 Consolas, Menlo, monospace; }',
      '.dialog pre.error { color: #c0392b; }',
      '.dialog .note { padding: 10px 16px; font-size: 12px; color: #b26a00; border-top: 1px solid #eee; }',
      '.dialog footer { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 16px;',
      '  border-top: 1px solid #eee; }',
      '.dialog footer button { padding: 5px 14px; font: inherit; border: 1px solid #ccc; border-radius: 5px;',
      '  background: #fff; color: #333; cursor: pointer; }',
      '.dialog footer button.primary { border-color: #2d6cdf; background: #2d6cdf; color: #fff; }',
      '.dialog footer button:disabled { opacity: 0.5; cursor: not-allowed; }'
    ].join('\n');
    shadow.appendChild(style);

    let maskEl = null;

    const closeDialog = () => {
      if (maskEl) {
        maskEl.remove();
        maskEl = null;
      }
    };

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') closeDialog();
      },
      true
    );

    /**
     * @param {string} text 展示内容（正常时是解码结果，出错时是错误消息）
     * @param {string[]} notes 附加提示
     * @param {number|null} byteCount 解码后的字节数，为 null 表示这是一条错误/提示消息
     */
    const showDialog = (text, notes, byteCount) => {
      closeDialog();

      const mask = document.createElement('div');
      mask.className = 'mask';
      mask.addEventListener('mousedown', (event) => {
        if (event.target === mask) closeDialog();
      });

      const dialog = document.createElement('div');
      dialog.className = 'dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-label', MENU_LABEL);

      const title = document.createElement('h2');
      title.textContent = MENU_LABEL;
      if (byteCount !== null) {
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = byteCount + ' 字节';
        title.appendChild(meta);
      }

      const body = document.createElement('pre');
      body.textContent = text === '' ? '(空字符串)' : text;
      if (byteCount === null) body.className = 'error';
      body.tabIndex = -1;

      const footer = document.createElement('footer');

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'primary';
      copyButton.textContent = '复制结果';
      copyButton.disabled = byteCount === null;
      copyButton.addEventListener('click', async () => {
        const label = copyButton.textContent;
        try {
          await navigator.clipboard.writeText(text);
          copyButton.textContent = '已复制';
        } catch (error) {
          // 非安全上下文或用户未授权时剪贴板不可用，提示手动复制
          copyButton.textContent = '复制失败，请手动选中';
        }
        setTimeout(() => {
          copyButton.textContent = label;
        }, 1200);
      });

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = '关闭';
      closeButton.addEventListener('click', closeDialog);

      footer.append(copyButton, closeButton);
      dialog.append(title, body);
      notes.forEach((note) => {
        const el = document.createElement('div');
        el.className = 'note';
        el.textContent = note;
        dialog.appendChild(el);
      });
      dialog.appendChild(footer);

      mask.appendChild(dialog);
      shadow.appendChild(mask);
      maskEl = mask;
      body.focus();
    };

    return { showDialog };
  };

  // 菜单每次点击都会重新注入脚本，弹窗宿主只创建一次
  const root = document.documentElement;
  const ui = root[UI_KEY] || (root[UI_KEY] = createUi());

  /* ---------------------------- 菜单命令 ---------------------------- */

  GM_registerMenuCommand(MENU_LABEL, () => {
    const selected = getSelectedText();
    if (!selected) {
      ui.showDialog('没有选中文字，请先在页面上选中要解码的内容。', [], null);
      return;
    }
    try {
      const result = decode(selected);
      ui.showDialog(result.text, result.notes, result.bytes.length);
    } catch (error) {
      if (error instanceof Base64Error) {
        ui.showDialog(error.message, [], null);
      } else {
        throw error;
      }
    }
  });
})();

import { BrowserDetector } from '../lib/browserDetector.js';
import { Cookie } from '../lib/cookie.js';
import { GenericStorageHandler } from '../lib/genericStorageHandler.js';
import { JsonFormat } from '../lib/jsonFormat.js';
import { NetscapeFormat } from '../lib/netscapeFormat.js';
import { OptionsHandler } from '../lib/optionsHandler.js';
import { PermissionHandler } from '../lib/permissionHandler.js';
import { ThemeHandler } from '../lib/themeHandler.js';
import { CookieHandlerPopup } from '../popup/cookieHandlerPopup.js';

document.addEventListener('DOMContentLoaded', async (event) => {
  const browserDetector = new BrowserDetector();
  const storageHandler = new GenericStorageHandler(browserDetector);
  const optionHandler = new OptionsHandler(browserDetector, storageHandler);
  const themeHandler = new ThemeHandler(optionHandler);
  const cookieHandler = new CookieHandlerPopup(browserDetector);
  const permissionHandler = new PermissionHandler(browserDetector);
  const advancedCookieInput = document.getElementById('advanced-cookie');
  const animationsEnabledInput = document.getElementById('animations-enabled');
  const exportFormatInput = document.getElementById('export-format');
  const extraInfoInput = document.getElementById('extra-info');
  const themeInput = document.getElementById('theme');
  const buttonBarTopInput = document.getElementById('button-bar-top');


  await optionHandler.loadOptions();
  themeHandler.updateTheme();
  setFormValues();
  optionHandler.on('optionsChanged', setFormValues);
  setInputEvents();

  
  function setFormValues() {
    
    handleAnimationsEnabled();
    advancedCookieInput.checked = optionHandler.getCookieAdvanced();
    animationsEnabledInput.checked = optionHandler.getAnimationsEnabled();
    exportFormatInput.value = optionHandler.getExportFormat();
    extraInfoInput.value = optionHandler.getExtraInfo();
    themeInput.value = optionHandler.getTheme();
    buttonBarTopInput.checked = optionHandler.getButtonBarTop();

    if (!browserDetector.isSafari()) {
      document
        .querySelectorAll('.github-sponsor')
        .forEach((el) => el.classList.remove('hidden'));
    }
  }

  
  function setInputEvents() {
    advancedCookieInput.addEventListener('change', (event) => {
      if (!event.isTrusted) {
        return;
      }
      optionHandler.setCookieAdvanced(advancedCookieInput.checked);
    });
    animationsEnabledInput.addEventListener('change', (event) => {
      if (!event.isTrusted) {
        return;
      }
      optionHandler.setAnimationsEnabled(animationsEnabledInput.checked);
      handleAnimationsEnabled();
    });
    exportFormatInput.addEventListener('change', (event) => {
      if (!event.isTrusted) {
        return;
      }
      optionHandler.setExportFormat(exportFormatInput.value);
    });
    extraInfoInput.addEventListener('change', (event) => {
      if (!event.isTrusted) {
        return;
      }
      optionHandler.setExtraInfo(extraInfoInput.value);
    });
    themeInput.addEventListener('change', (event) => {
      if (!event.isTrusted) {
        return;
      }
      optionHandler.setTheme(themeInput.value);
      themeHandler.updateTheme();
    });
    buttonBarTopInput.addEventListener('change', (event) => {
      if (!event.isTrusted) {
        return;
      }
      optionHandler.setButtonBarTop(buttonBarTopInput.checked);
    });
    
    document
      .getElementById('delete-all')
      .addEventListener('click', async (event) => {
        await deleteAllCookies();
      });
    document
      .getElementById('export-all-json')
      .addEventListener('click', async (event) => {
        await exportCookiesAsJson();
      });

    document
      .getElementById('export-all-netscape')
      .addEventListener('click', async (event) => {
        await exportCookiesAsNetscape();
      });
  }

  async function getAllPermissions() {
    const hasPermissions =
      await permissionHandler.checkPermissions('<all_urls>');
    if (!hasPermissions) {
      await permissionHandler.requestPermission('<all_urls>');
    }
  }

  
  async function getAllCookies() {
    await getAllPermissions();
    return new Promise((resolve, reject) => {
      cookieHandler.getAllCookiesInBrowser(function (cookies) {
        const loadedCookies = [];
        for (const cookie of cookies) {
          const id = Cookie.hashCode(cookie);
          loadedCookies[id] = new Cookie(id, cookie, optionHandler);
        }
        resolve(loadedCookies);
      });
    });
  }

  
  async function deleteAllCookies() {
    const deleteAll = confirm(
      'Are you sure you want to delete ALL your cookies?',
    );
    if (!deleteAll) {
      return;
    }
    const cookies = await getAllCookies();
    for (const cookieId in cookies) {
      if (!Object.prototype.hasOwnProperty.call(cookies, cookieId)) {
        continue;
      }
      const exportedCookie = cookies[cookieId].cookie;
      const url = 'https://' + exportedCookie.domain + exportedCookie.path;
      cookieHandler.removeCookie(exportedCookie.name, url);
    }
    alert('All your cookies were deleted');
  }
  
  async function exportCookiesAsJson() {
    const cookies = await getAllCookies();
    copyText(JsonFormat.format(cookies));
    alert('Done!');
  }

  
  async function exportCookiesAsNetscape() {
    const cookies = await getAllCookies();
    copyText(NetscapeFormat.format(cookies));
    alert('Done!');
  }

  

  function copyText(text) {
    const fakeText = document.createElement('textarea');
    fakeText.classList.add('clipboardCopier');
    fakeText.textContent = text;
    document.body.appendChild(fakeText);
    fakeText.focus();
    fakeText.select();
    
    document.execCommand('Copy');
    document.body.removeChild(fakeText);
  }

  
  function handleAnimationsEnabled() {
    if (optionHandler.getAnimationsEnabled()) {
      document.body.classList.remove('notransition');
    } else {
      document.body.classList.add('notransition');
    }
  }
});

import { CookieHandlerDevtools } from '../devtools/cookieHandlerDevtools.js';
import { Animate } from '../lib/animate.js';
import { BrowserDetector } from '../lib/browserDetector.js';
import { Cookie } from '../lib/cookie.js';
import { GenericStorageHandler } from '../lib/genericStorageHandler.js';
import { HeaderstringFormat } from '../lib/headerstringFormat.js';
import { JsonFormat } from '../lib/jsonFormat.js';
import { NetscapeFormat } from '../lib/netscapeFormat.js';
import { ExportFormats } from '../lib/options/exportFormats.js';
import { OptionsHandler } from '../lib/optionsHandler.js';
import { PermissionHandler } from '../lib/permissionHandler.js';
import { ThemeHandler } from '../lib/themeHandler.js';
import { CookieHandlerPopup } from './cookieHandlerPopup.js';

(function () {
  ('use strict');

  let containerCookie;
  let cookiesListHtml;
  let pageTitleContainer;
  let notificationElement;
  let loadedCookies = {};
  let disableButtons = false;

  const notificationQueue = [];
  let notificationTimeout;

  const browserDetector = new BrowserDetector();
  const permissionHandler = new PermissionHandler(browserDetector);
  const storageHandler = new GenericStorageHandler(browserDetector);
  const optionHandler = new OptionsHandler(browserDetector, storageHandler);
  const themeHandler = new ThemeHandler(optionHandler);
  const cookieHandler = window.isDevtools
    ? new CookieHandlerDevtools(browserDetector)
    : new CookieHandlerPopup(browserDetector);

  document.addEventListener('DOMContentLoaded', async function () {
    containerCookie = document.getElementById('cookie-container');
    notificationElement = document.getElementById('notification');
    pageTitleContainer = document.getElementById('pageTitle');

    await initWindow();

    function expandCookie(e) {
      const parent = e.target.closest('li');
      const header = parent.querySelector('.header');
      const expando = parent.querySelector('.expando');

      Animate.toggleSlide(expando);
      header.classList.toggle('active');
      header.ariaExpanded = header.classList.contains('active');
      expando.ariaHidden = !header.classList.contains('active');
    }

    function deleteButton(e) {
      e.preventDefault();
      const listElement = e.target.closest('li');
      removeCookie(listElement.dataset.name);
      return false;
    }

    function saveCookieForm(form) {
      const isCreateForm = form.classList.contains('create');

      const id = form.dataset.id;
      const name = form.querySelector('input[name="name"]').value;
      const value = form.querySelector('textarea[name="value"]').value;

      let domain;
      let path;
      let expiration;
      let sameSite;
      let hostOnly;
      let session;
      let secure;
      let httpOnly;

      if (!isCreateForm) {
        domain = form.querySelector('input[name="domain"]').value;
        path = form.querySelector('input[name="path"]').value;
        expiration = form.querySelector('input[name="expiration"]').value;
        sameSite = form.querySelector('select[name="sameSite"]').value;
        hostOnly = form.querySelector('input[name="hostOnly"]').checked;
        session = form.querySelector('input[name="session"]').checked;
        secure = form.querySelector('input[name="secure"]').checked;
        httpOnly = form.querySelector('input[name="httpOnly"]').checked;
      }
      saveCookie(
        id,
        name,
        value,
        domain,
        path,
        expiration,
        sameSite,
        hostOnly,
        session,
        secure,
        httpOnly,
      );

      if (form.classList.contains('create')) {
        showCookiesForTab();
      }

      return false;
    }

    function saveCookie(
      id,
      name,
      value,
      domain,
      path,
      expiration,
      sameSite,
      hostOnly,
      session,
      secure,
      httpOnly,
    ) {
      const cookieContainer = loadedCookies[id];
      let cookie = cookieContainer ? cookieContainer.cookie : null;
      let oldName;
      let oldHostOnly;

      if (cookie) {
        oldName = cookie.name;
        oldHostOnly = cookie.hostOnly;
      } else {
        cookie = {};
        oldName = name;
        oldHostOnly = hostOnly;
      }

      cookie.name = name;
      cookie.value = value;

      if (domain !== undefined) {
        cookie.domain = domain;
      }
      if (path !== undefined) {
        cookie.path = path;
      }
      if (sameSite !== undefined) {
        cookie.sameSite = sameSite;
      }
      if (hostOnly !== undefined) {
        cookie.hostOnly = hostOnly;
      }
      if (session !== undefined) {
        cookie.session = session;
      }
      if (secure !== undefined) {
        cookie.secure = secure;
      }
      if (httpOnly !== undefined) {
        cookie.httpOnly = httpOnly;
      }

      if (cookie.session) {
        cookie.expirationDate = null;
      } else {
        cookie.expirationDate = new Date(expiration).getTime() / 1000;
        if (!cookie.expirationDate) {
          cookie.expirationDate = null;
          cookie.session = true;
        }
      }

      if (oldName !== name || oldHostOnly !== hostOnly) {
        cookieHandler.removeCookie(oldName, getCurrentTabUrl(), function () {
          cookieHandler.saveCookie(
            cookie,
            getCurrentTabUrl(),
            function (error, cookie) {
              if (error) {
                sendNotification(error);
                return;
              }
              if (browserDetector.isSafari()) {
                onCookiesChanged();
              }
              if (cookieContainer) {
                cookieContainer.showSuccessAnimation();
              }
            },
          );
        });
      } else {
        cookieHandler.saveCookie(
          cookie,
          getCurrentTabUrl(),
          function (error, cookie) {
            if (error) {
              sendNotification(error);
              return;
            }
            if (browserDetector.isSafari()) {
              onCookiesChanged();
            }

            if (cookieContainer) {
              cookieContainer.showSuccessAnimation();
            }
          },
        );
      }
    }

    if (containerCookie) {
      containerCookie.addEventListener('click', (e) => {
        let target = e.target;
        if (target.nodeName === 'path') {
          target = target.parentNode;
        }
        if (target.nodeName === 'svg') {
          target = target.parentNode;
        }

        if (
          target.classList.contains('header') ||
          target.classList.contains('header-name') ||
          target.classList.contains('header-extra-info')
        ) {
          return expandCookie(e);
        }
        if (target.classList.contains('delete')) {
          return deleteButton(e);
        }
        if (target.classList.contains('save')) {
          return saveCookieForm(e.target.closest('li').querySelector('form'));
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          const target = e.target;
          if (target.classList.contains('header')) {
            e.preventDefault();
            return expandCookie(e);
          }
        }
      });
    }

    document.getElementById('create-cookie').addEventListener('click', () => {
      if (disableButtons) {
        return;
      }

      setPageTitle('Cookie Checker - Add a Cookie');

      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        createHtmlFormCookie(),
        'left',
        () => {
          disableButtons = false;
        },
        optionHandler.getAnimationsEnabled(),
      );

      document.getElementById('button-bar-default').classList.remove('active');
      document.getElementById('button-bar-add').classList.add('active');
      document.getElementById('name-create').focus();
      return false;
    });

    document
      .getElementById('delete-all-cookies')
      .addEventListener('click', () => {
        const buttonIcon = document
          .getElementById('delete-all-cookies')
          .querySelector('use');
        if (buttonIcon.getAttribute('href') === '../sprites/solid.svg#check') {
          return;
        }
        if (loadedCookies && Object.keys(loadedCookies).length) {
          for (const cookieId in loadedCookies) {
            if (Object.prototype.hasOwnProperty.call(loadedCookies, cookieId)) {
              removeCookie(loadedCookies[cookieId].cookie.name);
            }
          }
        }
        sendNotification('All cookies were deleted');
        buttonIcon.setAttribute('href', '../sprites/solid.svg#check');
        setTimeout(() => {
          buttonIcon.setAttribute('href', '../sprites/solid.svg#trash');
        }, 1500);
      });

    document.getElementById('export-cookies').addEventListener('click', () => {
      if (disableButtons) {
        hideExportMenu();
        return;
      }
      handleExportButtonClick();
    });

    document.getElementById('import-cookies').addEventListener('click', () => {
      if (disableButtons) {
        return;
      }

      setPageTitle('Cookie Checker - Import');

      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        createHtmlFormImport(),
        'left',
        () => {
          disableButtons = false;
        },
        optionHandler.getAnimationsEnabled(),
      );

      document.getElementById('button-bar-default').classList.remove('active');
      document.getElementById('button-bar-import').classList.add('active');

      document.getElementById('content-import').focus();
      return false;
    });

    document.getElementById('return-list-add').addEventListener('click', () => {
      showCookiesForTab();
    });
    document
      .getElementById('return-list-import')
      .addEventListener('click', () => {
        showCookiesForTab();
      });

    containerCookie.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCookieForm(e.target);
      return false;
    });

    document
      .getElementById('save-create-cookie')
      .addEventListener('click', () => {
        saveCookieForm(document.querySelector('form'));
      });

    document
      .getElementById('save-import-cookie')
      .addEventListener('click', (e) => {
        const buttonIcon = document
          .getElementById('save-import-cookie')
          .querySelector('use');
        if (
          buttonIcon.getAttribute('href') !== '../sprites/solid.svg#file-import'
        ) {
          return;
        }

        const json = document.querySelector('textarea').value;
        if (!json) {
          return;
        }
        let cookies;
        try {
          cookies = JsonFormat.parse(json);
        } catch (error) {
          try {
            cookies = HeaderstringFormat.parse(json);
          } catch (error) {
            try {
              cookies = NetscapeFormat.parse(json);
            } catch (error) {
              sendNotification('The input is not in a valid format.');
              buttonIcon.setAttribute('href', '../sprites/solid.svg#times');
              setTimeout(() => {
                buttonIcon.setAttribute(
                  'href',
                  '../sprites/solid.svg#file-import',
                );
              }, 1500);
              return;
            }
          }
        }

        if (!isArray(cookies) || cookies.length === 0) {
          sendNotification('No cookies were imported. Verify your input.');
          buttonIcon.setAttribute('href', '../sprites/solid.svg#times');
          setTimeout(() => {
            buttonIcon.setAttribute('href', '../sprites/solid.svg#file-import');
          }, 1500);
          return;
        }

        for (const cookie of cookies) {
          cookie.storeId = cookieHandler.currentTab.cookieStoreId;

          if (cookie.sameSite && cookie.sameSite === 'unspecified') {
            cookie.sameSite = null;
          }

          try {
            cookieHandler.saveCookie(
              cookie,
              getCurrentTabUrl(),
              function (error, cookie) {
                if (error) {
                  sendNotification(error);
                }
              },
            );
          } catch (error) {
            sendNotification(error);
          }
        }

        sendNotification(`Cookies were imported`);
        showCookiesForTab();
      });

    const mainMenuContent = document.querySelector('#main-menu-content');
    document
      .querySelector('#main-menu-button')
      .addEventListener('click', function (e) {
        mainMenuContent.classList.toggle('visible');
      });

    document.addEventListener('click', function (e) {
      if (
        document.querySelector('#main-menu').contains(e.target) ||
        !mainMenuContent.classList.contains('visible')
      ) {
        return;
      }
      mainMenuContent.classList.remove('visible');
    });

    document.addEventListener('click', function (e) {
      const exportMenu = document.querySelector('#export-menu');
      if (!exportMenu || exportMenu.contains(e.target)) {
        return;
      }

      const exportButton = document.querySelector('#export-cookies');
      if (!exportButton || exportButton.contains(e.target)) {
        return;
      }

      hideExportMenu();
    });

    document
      .querySelector('#advanced-toggle-all')
      .addEventListener('change', function (e) {
        optionHandler.setCookieAdvanced(e.target.checked);
        showCookiesForTab();
      });

    document
      .querySelector('#menu-all-options')
      .addEventListener('click', function (e) {
        if (browserDetector.getApi().runtime.openOptionsPage) {
          browserDetector.getApi().runtime.openOptionsPage();
        } else {
          window.open(
            browserDetector
              .getApi()
              .runtime.getURL('interface/options/options.html'),
          );
        }
      });

    notificationElement.addEventListener('animationend', (e) => {
      if (notificationElement.classList.contains('fadeInUp')) {
        return;
      }

      triggerNotification();
    });

    document
      .getElementById('notification-dismiss')
      .addEventListener('click', (e) => {
        hideNotification();
      });

    adjustWidthIfSmaller();

    if (chrome && chrome.runtime && chrome.runtime.getBrowserInfo) {
      chrome.runtime.getBrowserInfo(function (info) {
        const mainVersion = info.version.split('.')[0];
        if (mainVersion < 57) {
          containerCookie.style.height = '600px';
        }
      });
    }
  });


  async function showCookiesForTab() {
    if (!cookieHandler.currentTab) {
      return;
    }
    if (disableButtons) {
      return;
    }

    setPageTitle('Cookie Checker');
    document.getElementById('button-bar-add').classList.remove('active');
    document.getElementById('button-bar-import').classList.remove('active');
    document.getElementById('button-bar-default').classList.add('active');
    document.myThing = 'DarkSide';
    const domain = getDomainFromUrl(cookieHandler.currentTab.url);
    const subtitleLine = document.querySelector('.titles h2');
    if (subtitleLine) {
      subtitleLine.textContent = domain || cookieHandler.currentTab.url;
    }

    if (!permissionHandler.canHavePermissions(cookieHandler.currentTab.url)) {
      showPermissionImpossible();
      return;
    }
    if (!cookieHandler.currentTab) {
      showNoCookies();
      return;
    }
    const hasPermissions = await permissionHandler.checkPermissions(
      cookieHandler.currentTab.url,
    );
    if (!hasPermissions) {
      showNoPermission();
      return;
    }

    cookieHandler.getAllCookies(function (cookies) {
      cookies = cookies.sort(sortCookiesByName);

      loadedCookies = {};

      if (cookies.length === 0) {
        showNoCookies();
        return;
      }

      cookiesListHtml = document.createElement('ul');
      cookiesListHtml.appendChild(generateSearchBar());
      cookies.forEach(function (cookie) {
        const id = Cookie.hashCode(cookie);
        loadedCookies[id] = new Cookie(id, cookie, optionHandler);
        cookiesListHtml.appendChild(loadedCookies[id].html);
      });

      if (containerCookie.firstChild) {
        disableButtons = true;
        Animate.transitionPage(
          containerCookie,
          containerCookie.firstChild,
          cookiesListHtml,
          'right',
          () => {
            disableButtons = false;
          },
          optionHandler.getAnimationsEnabled(),
        );
      } else {
        containerCookie.appendChild(cookiesListHtml);
      }
    });
  }

  function showNoCookies() {
    if (disableButtons) {
      return;
    }
    cookiesListHtml = null;
    const html = document
      .importNode(document.getElementById('tmp-empty').content, true)
      .querySelector('p');
    if (containerCookie.firstChild) {
      if (containerCookie.firstChild.id === 'no-cookie') {
        return;
      }
      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        html,
        'right',
        () => {
          disableButtons = false;
        },
        optionHandler.getAnimationsEnabled(),
      );
    } else {
      containerCookie.appendChild(html);
    }
  }

  function showNoPermission() {
    if (disableButtons) {
      return;
    }
    cookiesListHtml = null;
    const html = document
      .importNode(document.getElementById('tmp-no-permission').content, true)
      .querySelector('div');

    document.getElementById('button-bar-add').classList.remove('active');
    document.getElementById('button-bar-import').classList.remove('active');
    document.getElementById('button-bar-default').classList.remove('active');

    if (
      browserDetector.isFirefox() &&
      typeof browserDetector.getApi().devtools !== 'undefined'
    ) {
      html.querySelector('div').textContent =
        "Go to your settings (about:addons) or open the extension's popup to " +
        'adjust your permissions.';
    }

    if (containerCookie.firstChild) {
      if (containerCookie.firstChild.id === 'no-permission') {
        return;
      }
      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        html,
        'right',
        () => {
          disableButtons = false;
        },
        optionHandler.getAnimationsEnabled(),
      );
    } else {
      containerCookie.appendChild(html);
    }
    document.getElementById('request-permission').focus();
    document
      .getElementById('request-permission')
      .addEventListener('click', async (event) => {
        const isPermissionGranted = await permissionHandler.requestPermission(
          cookieHandler.currentTab.url,
        );
        if (isPermissionGranted) {
          showCookiesForTab();
        }
      });
    document
      .getElementById('request-permission-all')
      .addEventListener('click', async (event) => {
        const isPermissionGranted =
          await permissionHandler.requestPermission('<all_urls>');
        if (isPermissionGranted) {
          showCookiesForTab();
        }
      });
  }

  function showPermissionImpossible() {
    if (disableButtons) {
      return;
    }
    cookiesListHtml = null;
    const html = document
      .importNode(
        document.getElementById('tmp-permission-impossible').content,
        true,
      )
      .querySelector('div');

    document.getElementById('button-bar-add').classList.remove('active');
    document.getElementById('button-bar-import').classList.remove('active');
    document.getElementById('button-bar-default').classList.remove('active');
    if (containerCookie.firstChild) {
      if (containerCookie.firstChild.id === 'permission-impossible') {
        return;
      }
      disableButtons = true;
      Animate.transitionPage(
        containerCookie,
        containerCookie.firstChild,
        html,
        'right',
        () => {
          disableButtons = false;
        },
        optionHandler.getAnimationsEnabled(),
      );
    } else {
      containerCookie.appendChild(html);
    }
  }

  function showVersion() {
    const version = browserDetector.getApi().runtime.getManifest().version;
    document.getElementById('version').textContent = 'v' + version;
  }

  function handleAnimationsEnabled() {
    if (optionHandler.getAnimationsEnabled()) {
      document.body.classList.remove('notransition');
    } else {
      document.body.classList.add('notransition');
    }
  }

  function createHtmlForCookie(name, value, id) {
    const cookie = new Cookie(
      id,
      {
        name: name,
        value: value,
      },
      optionHandler,
    );

    return cookie.html;
  }

  function createHtmlFormCookie() {
    const template = document.importNode(
      document.getElementById('tmp-create').content,
      true,
    );
    return template.querySelector('form');
  }

  function createHtmlFormImport() {
    const template = document.importNode(
      document.getElementById('tmp-import').content,
      true,
    );
    return template.querySelector('form');
  }

  function handleExportButtonClick() {
    const exportOption = optionHandler.getExportFormat();
    switch (exportOption) {
      case ExportFormats.Ask:
        toggleExportMenu();
        break;
      case ExportFormats.JSON:
        exportToJson();
        break;
      case ExportFormats.HeaderString:
        exportToHeaderstring();
        break;
      case ExportFormats.Netscape:
        exportToNetscape();
        break;
    }
  }

  function toggleExportMenu() {
    if (document.getElementById('export-menu')) {
      hideExportMenu();
    } else {
      showExportMenu();
    }
  }

  function showExportMenu() {
    const template = document.importNode(
      document.getElementById('tmp-export-options').content,
      true,
    );
    containerCookie.appendChild(template.getElementById('export-menu'));

    document.getElementById('export-json').focus();
    document
      .getElementById('export-json')
      .addEventListener('click', (event) => {
        exportToJson();
      });
    document
      .getElementById('export-headerstring')
      .addEventListener('click', (event) => {
        exportToHeaderstring();
      });
    document
      .getElementById('export-netscape')
      .addEventListener('click', (event) => {
        exportToNetscape();
      });
  }

  function hideExportMenu() {
    const exportMenu = document.getElementById('export-menu');
    if (exportMenu) {
      containerCookie.removeChild(exportMenu);
      document.activeElement.blur();
    }
  }

  if (typeof createHtmlFormCookie === 'undefined') {
    createHtmlFormCookie = createHtmlForCookie;
  }

  function exportToJson() {
    hideExportMenu();
    const buttonIcon = document
      .getElementById('export-cookies')
      .querySelector('use');
    if (buttonIcon.getAttribute('href') === '../sprites/solid.svg#check') {
      return;
    }

    buttonIcon.setAttribute('href', '../sprites/solid.svg#check');
    copyText(JsonFormat.format(loadedCookies));

    sendNotification('Cookies exported to clipboard as JSON');
    setTimeout(() => {
      buttonIcon.setAttribute('href', '../sprites/solid.svg#file-export');
    }, 1500);
  }

  function exportToHeaderstring() {
    hideExportMenu();
    const buttonIcon = document
      .getElementById('export-cookies')
      .querySelector('use');
    if (buttonIcon.getAttribute('href') === '../sprites/solid.svg#check') {
      return;
    }

    buttonIcon.setAttribute('href', '../sprites/solid.svg#check');
    copyText(HeaderstringFormat.format(loadedCookies));

    sendNotification('Cookies exported to clipboard as Header String');
    setTimeout(() => {
      buttonIcon.setAttribute('href', '../sprites/solid.svg#file-export');
    }, 1500);
  }

  function exportToNetscape() {
    hideExportMenu();
    const buttonIcon = document
      .getElementById('export-cookies')
      .querySelector('use');
    if (buttonIcon.getAttribute('href') === '../sprites/solid.svg#check') {
      return;
    }

    buttonIcon.setAttribute('href', '../sprites/solid.svg#check');
    copyText(NetscapeFormat.format(loadedCookies));

    sendNotification('Cookies exported to clipboard as Netscape format');
    setTimeout(() => {
      buttonIcon.setAttribute('href', '../sprites/solid.svg#file-export');
    }, 1500);
  }

  function removeCookie(name, url, callback) {
    cookieHandler.removeCookie(name, url || getCurrentTabUrl(), function (e) {
      if (callback) {
        callback();
      }
      if (browserDetector.isSafari()) {
        onCookiesChanged();
      }
    });
  }

  function onCookiesChanged(changeInfo) {
    if (!changeInfo) {
      showCookiesForTab();
      return;
    }

    const id = Cookie.hashCode(changeInfo.cookie);

    if (changeInfo.cause === 'overwrite') {
      return;
    }

    if (changeInfo.removed) {
      if (loadedCookies[id]) {
        loadedCookies[id].removeHtml(() => {
          if (!Object.keys(loadedCookies).length) {
            showNoCookies();
          }
        });
        delete loadedCookies[id];
      }
      return;
    }

    if (loadedCookies[id]) {
      loadedCookies[id].updateHtml(changeInfo.cookie);
      return;
    }

    const newCookie = new Cookie(id, changeInfo.cookie, optionHandler);
    loadedCookies[id] = newCookie;

    if (!cookiesListHtml && document.getElementById('no-cookies')) {
      clearChildren(containerCookie);
      cookiesListHtml = document.createElement('ul');
      cookiesListHtml.appendChild(generateSearchBar());
      containerCookie.appendChild(cookiesListHtml);
    }

    if (cookiesListHtml) {
      cookiesListHtml.appendChild(newCookie.html);
    }
  }

  function sortCookiesByName(a, b) {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    return aName < bName ? -1 : aName > bName ? 1 : 0;
  }

  async function initWindow(_tab) {
    await optionHandler.loadOptions();
    themeHandler.updateTheme();
    moveButtonBar();
    handleAnimationsEnabled();
    optionHandler.on('optionsChanged', onOptionsChanged);
    cookieHandler.on('cookiesChanged', onCookiesChanged);
    cookieHandler.on('ready', showCookiesForTab);
    document.querySelector('#advanced-toggle-all').checked =
      optionHandler.getCookieAdvanced();
    if (cookieHandler.isReady) {
      showCookiesForTab();
    }
    showVersion();
  }

  function getCurrentTabUrl() {
    if (cookieHandler.currentTab) {
      return cookieHandler.currentTab.url;
    }
    return '';
  }

  function getDomainFromUrl(url) {
    const matches = url.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
    return matches && matches[1];
  }

  function sendNotification(message) {
    notificationQueue.push(message);
    triggerNotification();
  }

  function generateSearchBar() {
    const searchBarContainer = document.importNode(
      document.getElementById('tmp-search-bar').content,
      true,
    );
    searchBarContainer
      .getElementById('searchField')
      .addEventListener('keyup', (e) =>
        filterCookies(e.target, e.target.value),
      );
    return searchBarContainer;
  }

  function triggerNotification() {
    if (!notificationQueue || !notificationQueue.length) {
      return;
    }
    if (notificationTimeout) {
      return;
    }
    if (notificationElement.classList.contains('fadeInUp')) {
      return;
    }

    showNotification();
  }

  function showNotification() {
    if (notificationTimeout) {
      return;
    }

    notificationElement.parentElement.style.display = 'block';
    notificationElement.querySelector('#notification-dismiss').style.display =
      'block';
    notificationElement.querySelector('span').textContent =
      notificationQueue.shift();
    notificationElement.querySelector('span').setAttribute('role', 'alert');
    notificationElement.classList.add('fadeInUp');
    notificationElement.classList.remove('fadeOutDown');

    notificationTimeout = setTimeout(() => {
      hideNotification();
    }, 2500);
  }

  function hideNotification() {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      notificationTimeout = null;
    }

    notificationElement.querySelector('span').setAttribute('role', '');
    notificationElement.classList.remove('fadeInUp');
    notificationElement.classList.add('fadeOutDown');
    notificationElement.querySelector('#notification-dismiss').style.display =
      'none';
  }

  function setPageTitle(title) {
    if (!pageTitleContainer) {
      return;
    }

    pageTitleContainer.querySelector('h1').textContent = title;
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

  function isArray(value) {
    return value && typeof value === 'object' && value.constructor === Array;
  }

  function clearChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function adjustWidthIfSmaller() {
    const realWidth = document.documentElement.clientWidth;
    if (realWidth < 500) {
      document.body.style.minWidth = '100%';
      document.body.style.width = realWidth + 'px';
    }
  }

  function filterCookies(target, filterText) {
    const cookies = cookiesListHtml.querySelectorAll('.cookie');
    filterText = filterText.toLowerCase();

    if (filterText) {
      target.classList.add('content');
    } else {
      target.classList.remove('content');
    }

    for (let i = 0; i < cookies.length; i++) {
      const cookieElement = cookies[i];
      const cookieName = cookieElement.children[0]
        .getElementsByTagName('span')[0]
        .textContent.toLocaleLowerCase();
      if (!filterText || cookieName.indexOf(filterText) > -1) {
        cookieElement.classList.remove('hide');
      } else {
        cookieElement.classList.add('hide');
      }
    }
  }


  function onOptionsChanged(oldOptions) {
    handleAnimationsEnabled();
    moveButtonBar();
    if (oldOptions.advancedCookies != optionHandler.getCookieAdvanced()) {
      document.querySelector('#advanced-toggle-all').checked =
        optionHandler.getCookieAdvanced();
      showCookiesForTab();
    }

    if (oldOptions.extraInfo != optionHandler.getExtraInfo()) {
      showCookiesForTab();
    }
  }

  function moveButtonBar() {
    const siblingElement = optionHandler.getButtonBarTop()
      ? document.getElementById('pageTitle').nextSibling
      : document.body.lastChild;
    document.querySelectorAll('.button-bar').forEach((bar) => {
      siblingElement.parentNode.insertBefore(bar, siblingElement);
      if (optionHandler.getButtonBarTop()) {
        document.body.classList.add('button-bar-top');
      } else {
        document.body.classList.remove('button-bar-top');
      }
    });
  }
})();
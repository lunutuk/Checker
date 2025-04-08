import { BrowserDetector } from './interface/lib/browserDetector.js';
import { PermissionHandler } from './interface/lib/permissionHandler.js';

(function () {
  const connections = {};
  const browserDetector = new BrowserDetector();
  const permissionHandler = new PermissionHandler(browserDetector);

  browserDetector.getApi().runtime.onConnect.addListener(onConnect);
  browserDetector.getApi().runtime.onMessage.addListener(handleMessage);
  browserDetector.getApi().tabs.onUpdated.addListener(onTabsChanged);

  if (!browserDetector.isSafari()) {
    browserDetector.getApi().cookies.onChanged.addListener(onCookiesChanged);
  }

  isFirefoxAndroid(function (response) {
    if (response) {
      const popupOptions = {
        popup: '/interface/popup-mobile/cookie-list.html',
      };
      browserDetector.getApi().action.setPopup(popupOptions);
    }
  });
  isSafariIos(function (response) {
    if (response) {
      const popupOptions = {
        popup: '/interface/popup-mobile/cookie-list.html',
      };
      browserDetector.getApi().action.setPopup(popupOptions);
    }
  });

  if (browserDetector.supportsSidePanel()) {
    browserDetector
      .getApi()
      .sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
      .catch((error) => {
        
      });
  }

  function handleMessage(request, sender, sendResponse) {
    switch (request.type) {
      case 'getTabs': {
        browserDetector.getApi().tabs.query({}, function (tabs) {
          sendResponse(tabs);
        });
        return true;
      }
      case 'getCurrentTab': {
        browserDetector
          .getApi()
          .tabs.query(
            { active: true, currentWindow: true },
            function (tabInfo) {
              sendResponse(tabInfo);
            },
          );
        return true;
      }
      case 'getAllCookies': {
        const getAllCookiesParams = {
          url: request.params.url,
        };
        if (browserDetector.supportsPromises()) {
          browserDetector
            .getApi()
            .cookies.getAll(getAllCookiesParams)
            .then(sendResponse);
        } else {
          browserDetector
            .getApi()
            .cookies.getAll(getAllCookiesParams, sendResponse);
        }
        return true;
      }
      case 'saveCookie': {
        if (browserDetector.supportsPromises()) {
          browserDetector
            .getApi()
            .cookies.set(request.params.cookie)
            .then(
              (cookie) => {
                sendResponse(null, cookie);
              },
              (error) => {
                sendResponse(error.message, null);
              },
            );
        } else {
          browserDetector
            .getApi()
            .cookies.set(request.params.cookie, (cookie) => {
              if (cookie) {
                sendResponse(null, cookie);
              } else {
                const error = browserDetector.getApi().runtime.lastError;
                sendResponse(error.message, cookie);
              }
            });
        }
        return true;
      }
      case 'removeCookie': {
        const removeParams = {
          name: request.params.name,
          url: request.params.url,
        };
        if (browserDetector.supportsPromises()) {
          browserDetector
            .getApi()
            .cookies.remove(removeParams)
            .then(sendResponse);
        } else {
          browserDetector.getApi().cookies.remove(removeParams, sendResponse);
        }
        return true;
      }
      case 'permissionsContains': {
        permissionHandler.checkPermissions(request.params).then(sendResponse);
        return true;
      }
      case 'permissionsRequest': {
        permissionHandler.requestPermission(request.params).then(sendResponse);
        return true;
      }
      case 'optionsChanged': {
        sendMessageToAllTabs('optionsChanged', {
          from: request.params.from,
        });
        return true;
      }
    }
  }

  function onConnect(port) {
    const extensionListener = function (request, port) {
      switch (request.type) {
        case 'init_cookieHandler':
          connections[request.tabId] = port;
          return;
        case 'init_optionsHandler':
          connections[port.name] = port;
          return;
      }
    };

    port.onMessage.addListener(extensionListener);

    port.onDisconnect.addListener(function (port) {
      port.onMessage.removeListener(extensionListener);
      const tabs = Object.keys(connections);
      for (let i = 0; i < tabs.length; i++) {
        if (connections[tabs[i]] === port) {
          delete connections[tabs[i]];
          break;
        }
      }
    });
  }

  function sendMessageToTab(tabId, type, data) {
    if (tabId in connections) {
      connections[tabId].postMessage({
        type: type,
        data: data,
      });
    }
  }

  function sendMessageToAllTabs(type, data) {
    const tabs = Object.keys(connections);
    for (let i = 0; i < tabs.length; i++) {
      sendMessageToTab(tabs[i], type, data);
    }
  }

  function onCookiesChanged(changeInfo) {
    sendMessageToAllTabs('cookiesChanged', changeInfo);
  }

  function onTabsChanged(tabId, changeInfo, _tab) {
    sendMessageToTab(tabId, 'tabsChanged', changeInfo);
  }

  function isFirefoxAndroid(callback) {
    if (!browserDetector.isFirefox()) {
      callback(false);
      return;
    }

    browserDetector
      .getApi()
      .runtime.getPlatformInfo()
      .then((info) => {
        callback(info.os === 'android');
      });
  }

  function isSafariIos(callback) {
    if (!browserDetector.isSafari()) {
      callback(false);
      return;
    }

    browserDetector
      .getApi()
      .runtime.getPlatformInfo()
      .then((info) => {
        callback(info.os === 'ios');
      });
  }
})();
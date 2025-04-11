import { EventEmitter } from './eventEmitter.js';
import { GUID } from './guid.js';
import { ExportFormats } from './options/exportFormats.js';
import { ExtraInfos } from './options/extraInfos.js';
import { Options } from './options/options.js';
import { Themes } from './options/themes.js';

const optionsKey = 'all_options';


export class OptionsHandler extends EventEmitter {
  
  constructor(browserDetector, genericStorageHandler) {
    super();
    
    this.browserDetector = browserDetector;
    this.storageHandler = genericStorageHandler;
    this.isReady = false;
    this.options = null;
    this.guid = GUID.get();

    this.backgroundPageConnection = this.browserDetector
      .getApi()
      .runtime.connect({ name: this.guid });
    this.backgroundPageConnection.onMessage.addListener(this.onMessage);
    this.backgroundPageConnection.postMessage({
      type: 'init_optionsHandler',
    });
  }

  
  getCookieAdvanced() {
    return this.options.advancedCookies;
  }
  
  setCookieAdvanced(isAdvanced) {
    this.options.advancedCookies = isAdvanced;
    this.saveOptions();
  }

  
  getDevtoolsEnabled() {
    return this.options.devtoolsEnabled;
  }
  
  setDevtoolsEnabled(devtoolsEnabled) {
    this.options.devtoolsEnabled = devtoolsEnabled;
    this.saveOptions();
  }

  
  getAnimationsEnabled() {
    
    return this.options.animationsEnabled !== false;
  }
  
  setAnimationsEnabled(animationsEnabled) {
    this.options.animationsEnabled = animationsEnabled;
    this.saveOptions();
  }

  
  getExportFormat() {
    let exportFormat = this.options.exportFormat;
    if (!this.isExportFormatValid(exportFormat)) {
      
      exportFormat = ExportFormats.Ask;
      this.setExportFormat(exportFormat);
    }
    return exportFormat;
  }
  
  setExportFormat(exportFormat) {
    if (!this.isExportFormatValid(exportFormat)) {
      
      return;
    }
    this.options.exportFormat = exportFormat;
    this.saveOptions();
  }
  
  isExportFormatValid(exportFormat) {
    for (const allowedFormat in ExportFormats) {
      if (Object.prototype.hasOwnProperty.call(ExportFormats, allowedFormat)) {
        if (exportFormat === ExportFormats[allowedFormat]) {
          return true;
        }
      }
    }
    return false;
  }

 
  getExtraInfo() {
    let extraInfo = this.options.extraInfo;
    if (!this.isExtraInfoValid(extraInfo)) {
      
      extraInfo = ExtraInfos.Nothing;
      this.setExtraInfo(extraInfo);
    }
    return extraInfo;
  }
  
  setExtraInfo(extraInfo) {
    if (!this.isExtraInfoValid(extraInfo)) {
      
      return;
    }
    this.options.extraInfo = extraInfo;
    this.saveOptions();
  }
  
  isExtraInfoValid(extraInfo) {
    for (const allowedValue in ExtraInfos) {
      if (Object.prototype.hasOwnProperty.call(ExtraInfos, allowedValue)) {
        if (extraInfo === ExtraInfos[allowedValue]) {
          return true;
        }
      }
    }
    return false;
  }

 
  getTheme() {
    let theme = this.options.theme;
    if (!this.isThemeValid(theme)) {
      
      theme = Themes.Auto;
      this.setTheme(theme);
    }
    return theme;
  }
  
  setTheme(theme) {
    if (!this.isThemeValid(theme)) {
      
      return;
    }
    this.options.theme = theme;
    this.saveOptions();
  }
  
  isThemeValid(theme) {
    for (const allowedTheme in Themes) {
      if (Object.prototype.hasOwnProperty.call(Themes, allowedTheme)) {
        if (theme === Themes[allowedTheme]) {
          return true;
        }
      }
    }
    return false;
  }

  
  getButtonBarTop() {
    return this.options.buttonBarTop;
  }
  
  setButtonBarTop(buttonBarTop) {
    this.options.buttonBarTop = buttonBarTop;
    this.saveOptions();
  }

  
  async loadOptions() {
    
    this.options = await this.storageHandler.getLocal(optionsKey);
    if (this.options == null) {
      
      this.options = new Options();
      await this.saveOptions();
    }
  }

  
  async saveOptions() {
    
    await this.storageHandler.setLocal(optionsKey, this.options);
    this.notifyBackgroundOfChanges();
  }

  
  notifyBackgroundOfChanges() {
    this.sendMessage('optionsChanged', { from: this.guid });
  }

  
  sendMessage(type, params, callback, errorCallback) {
    if (this.browserDetector.supportsPromises()) {
      this.browserDetector
        .getApi()
        .runtime.sendMessage({ type: type, params: params })
        .then(callback, errorCallback);
    } else {
      this.browserDetector
        .getApi()
        .runtime.sendMessage({ type: type, params: params }, callback);
    }
  }

  
  onMessage = async (request) => {
    
    switch (request.type) {
      case 'optionsChanged': {
        if (request.data.from == this.guid) {
          return;
        }
        const oldOptions = this.options;
        await this.loadOptions();
        this.emit('optionsChanged', oldOptions);
        return;
      }
    }
  };
}

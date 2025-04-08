
export class JsonFormat {
  
  static parse(cookieString) {
    return JSON.parse(cookieString);
  }

  
  static format(cookies) {
    const exportedCookies = [];
    for (const cookieId in cookies) {
      if (!Object.prototype.hasOwnProperty.call(cookies, cookieId)) {
        continue;
      }
      const exportedCookie = cookies[cookieId].cookie;
      exportedCookie.storeId = null;
      if (exportedCookie.sameSite === 'unspecified') {
        exportedCookie.sameSite = null;
      }
      exportedCookies.push(exportedCookie);
    }
    return JSON.stringify(exportedCookies, null, 4);
  }
}

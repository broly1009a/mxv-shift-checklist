import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

const USERNAME = process.env.CAST_USER || '';
const PASSWORD = process.env.CAST_PASS || '';
const LOGIN_URL = 'https://www.cqgtrader.com/CAST/Logon/Logon.asp';

const DEBUG_DIR = path.join(__dirname, '../temp/debug/cast');
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

function log(msg: string) {
  const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
  console.log(`[${time}] ${msg}`);
}

// IE Mock Script to make modern browsers behave like IE11
const IE_MOCK_SCRIPT = `
  // Mock localeinfoproviderObj (IE ActiveX COM object)
  Object.defineProperty(window, 'localeinfoproviderObj', {
    value: {
      ShortDateFormat:   'MM/dd/yyyy',
      TimeFormat:        'hh:mm:ss tt',
      DecimalPoint:      '.',
      ThousandSeparator: ',',
      DigitsGrouping:    '3;0',
      DigitsAfterDecimal: 2
    },
    writable: true,
    configurable: true
  });

  // Mock window.event (IE-specific global event object) to track active events
  (function() {
    let currentEvent = null;

    function wrapEvent(e) {
      if (!e) return { keyCode: 0, srcElement: null, cancelBubble: false };
      // Already wrapped
      if (e.__ieWrapped) return e;
      return new Proxy(e, {
        get: function(target, prop) {
          if (prop === '__ieWrapped') return true;
          if (prop === 'srcElement') return target.target || target.srcElement || null;
          if (prop === 'cancelBubble') return target.cancelBubble || false;
          if (prop === 'returnValue') return target.returnValue !== undefined ? target.returnValue : true;
          if (prop === 'fromElement') return target.relatedTarget || null;
          if (prop === 'toElement') return target.target || null;
          var val = target[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        },
        set: function(target, prop, value) {
          if (prop === 'cancelBubble' && value) {
            target.stopPropagation && target.stopPropagation();
          }
          if (prop === 'returnValue' && value === false) {
            target.preventDefault && target.preventDefault();
          }
          target[prop] = value;
          return true;
        }
      });
    }

    Object.defineProperty(window, 'event', {
      get: function() { return wrapEvent(currentEvent); },
      set: function(val) { currentEvent = val; },
      configurable: true
    });
    const updateEvent = (e) => { currentEvent = e; };
    // Track common user and programmatic events
    const eventTypes = ['click', 'mouseover', 'mouseout', 'keydown', 'keyup', 'mousedown', 'mouseup', 'contextmenu'];
    for (const type of eventTypes) {
      window.addEventListener(type, updateEvent, true);
    }
  })();

  // Mock HTMLFrameElement/HTMLIFrameElement document property for IE compatibility
  if (window.HTMLFrameElement && !('document' in window.HTMLFrameElement.prototype)) {
    Object.defineProperty(window.HTMLFrameElement.prototype, 'document', {
      get: function() {
        try {
          return this.contentDocument || (this.contentWindow ? this.contentWindow.document : null);
        } catch (e) {
          return null;
        }
      },
      configurable: true
    });
  }
  if (window.HTMLIFrameElement && !('document' in window.HTMLIFrameElement.prototype)) {
    Object.defineProperty(window.HTMLIFrameElement.prototype, 'document', {
      get: function() {
        try {
          return this.contentDocument || (this.contentWindow ? this.contentWindow.document : null);
        } catch (e) {
          return null;
        }
      },
      configurable: true
    });
  }

  // Emulate IE case-insensitive frame access on Window objects
  if (typeof window.Window !== 'undefined' && window.Window.prototype) {
    const frameNames = ['searchFrame', 'innerFrame', 'dataFrame', 'masthead', 'userIndex'];
    frameNames.forEach(name => {
      if (!(name in window.Window.prototype)) {
        Object.defineProperty(window.Window.prototype, name, {
          get: function() {
            const lowerName = name.toLowerCase();
            // 1. Search in frames by name case-insensitively
            try {
              for (let i = 0; i < this.frames.length; i++) {
                const f = this.frames[i];
                if (f && f.name && f.name.toLowerCase() === lowerName) {
                  return f;
                }
              }
            } catch (e) {}
            // 2. Search in document elements by name/id
            try {
              const el = this.document.getElementById(name) || this.document.getElementsByName(name)[0];
              if (el) {
                return el.contentWindow || el;
              }
            } catch (e) {}
            return undefined;
          },
          configurable: true
        });
      }
    });
  }

  // Override document.getElementById to emulate IE's behavior of matching 'name' when 'id' is not found
  const originalGetElementById = document.getElementById;
  document.getElementById = function(id) {
    let el = originalGetElementById.call(document, id);
    if (!el) {
      const elements = document.getElementsByName(id);
      if (elements.length > 0) {
        el = elements[0];
      }
    }
    return el;
  };

  // Mock ActiveXObject for modern browsers to support XML parsing and HTTP requests
  if (typeof window.ActiveXObject === 'undefined') {
    window.ActiveXObject = function(progId) {
      console.log('[IE-MOCK] ActiveXObject instantiated:', progId);
      var prog = progId.toLowerCase();
      if (prog.indexOf('xmlhttp') >= 0) {
        return new XMLHttpRequest();
      }
      if (prog.indexOf('xmldom') >= 0) {
        var doc = document.implementation.createDocument('', '', null);
        
        doc.parseError = {
          errorCode: 0,
          reason: '',
          filepos: 0,
          line: 0,
          linepos: 0,
          srcText: '',
          url: ''
        };

        doc.load = function(url) {
          try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false); // Synchronous XML/XSL fetch
            xhr.send();
            var trimmedXml = xhr.responseText.replace(/^\s+/, '').trimStart();
            var parser = new DOMParser();
            var parsedDoc = parser.parseFromString(trimmedXml, 'text/xml');
            
            var parseErrorEl = parsedDoc.querySelector('parsererror');
            if (parseErrorEl) {
              doc.parseError.errorCode = -1;
              doc.parseError.reason = parseErrorEl.textContent;
              return false;
            }
            
            while (doc.firstChild) {
              doc.removeChild(doc.firstChild);
            }
            if (parsedDoc.documentElement) {
              var importedNode = doc.importNode(parsedDoc.documentElement, true);
              doc.appendChild(importedNode);
            }
            doc.parseError.errorCode = 0;
            return true;
          } catch (e) {
            doc.parseError.errorCode = -1;
            doc.parseError.reason = e.message;
            return false;
          }
        };

        doc.loadXML = function(xmlString) {
          try {
            var trimmedXml = xmlString.replace(/^\s+/, '').trimStart();
            var parser = new DOMParser();
            var parsedDoc = parser.parseFromString(trimmedXml, 'text/xml');
            
            var parseErrorEl = parsedDoc.querySelector('parsererror');
            if (parseErrorEl) {
              doc.parseError.errorCode = -1;
              doc.parseError.reason = parseErrorEl.textContent;
              return false;
            }
            
            while (doc.firstChild) {
              doc.removeChild(doc.firstChild);
            }
            if (parsedDoc.documentElement) {
              var importedNode = doc.importNode(parsedDoc.documentElement, true);
              doc.appendChild(importedNode);
            }
            doc.parseError.errorCode = 0;
            return true;
          } catch (e) {
            doc.parseError.errorCode = -1;
            doc.parseError.reason = e.message;
            return false;
          }
        };

        Object.defineProperty(doc, 'xml', {
          get: function() {
            return new XMLSerializer().serializeToString(doc);
          }
        });

        doc.selectSingleNode = function(xpath) {
          try {
            var result = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue;
          } catch (e) { return null; }
        };

        doc.selectNodes = function(xpath) {
          try {
            var result = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
            var nodes = [];
            var n = result.iterateNext();
            while (n) { nodes.push(n); n = result.iterateNext(); }
            nodes.item = function(i) { return nodes[i]; };
            return nodes;
          } catch (e) { return []; }
        };

        return doc;
      }
      return {};
    };
  }

  // Emulate IE's Node.xml property
  if (!('xml' in Node.prototype)) {
    Object.defineProperty(Node.prototype, 'xml', {
      get: function() {
        return new XMLSerializer().serializeToString(this);
      },
      configurable: true
    });
  }

  // Emulate IE's Node.text property
  if (!('text' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'text', {
      get: function() { return this.textContent; },
      set: function(val) { this.textContent = val; },
      configurable: true
    });
  }
  if (!('text' in Attr.prototype)) {
    Object.defineProperty(Attr.prototype, 'text', {
      get: function() { return this.value; },
      set: function(val) { this.value = val; },
      configurable: true
    });
  }

  // Emulate selectSingleNode / selectNodes on elements
  if (!Element.prototype.selectSingleNode) {
    Element.prototype.selectSingleNode = function(xpath) {
      try {
        var doc = this.ownerDocument || this;
        var result = doc.evaluate(xpath, this, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
      } catch (e) { return null; }
    };
  }
  if (!Element.prototype.selectNodes) {
    Element.prototype.selectNodes = function(xpath) {
      try {
        var doc = this.ownerDocument || this;
        var result = doc.evaluate(xpath, this, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        var nodes = [];
        var n = result.iterateNext();
        while (n) { nodes.push(n); n = result.iterateNext(); }
        nodes.item = function(i) { return nodes[i]; };
        return nodes;
      } catch (e) { return []; }
    };
  }

  // Emulate selectSingleNode / selectNodes on Document
  if (!Document.prototype.selectSingleNode) {
    Document.prototype.selectSingleNode = function(xpath) {
      try {
        var result = this.evaluate(xpath, this, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
      } catch (e) { return null; }
    };
  }
  if (!Document.prototype.selectNodes) {
    Document.prototype.selectNodes = function(xpath) {
      try {
        var result = this.evaluate(xpath, this, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        var nodes = [];
        var n = result.iterateNext();
        while (n) { nodes.push(n); n = result.iterateNext(); }
        nodes.item = function(i) { return nodes[i]; };
        return nodes;
      } catch (e) { return []; }
    };
  }

  // Emulate transformNode on Document and Element using XSLTProcessor
  const mockTransformNode = function(xsltDoc) {
    try {
      console.log('[IE-MOCK] transformNode called. xsltDoc:', xsltDoc, 'type:', typeof xsltDoc, 'isNode:', xsltDoc instanceof Node);
      if (!xsltDoc) {
        return "";
      }
      const processor = new XSLTProcessor();
      processor.importStylesheet(xsltDoc);
      const resultDoc = processor.transformToDocument(this);
      if (!resultDoc) return "";
      return new XMLSerializer().serializeToString(resultDoc);
    } catch (e) {
      console.error('[IE-MOCK] transformNode error:', e);
      return "";
    }
  };

  if (typeof Document !== 'undefined' && !Document.prototype.transformNode) {
    Document.prototype.transformNode = mockTransformNode;
  }
  if (typeof Element !== 'undefined' && !Element.prototype.transformNode) {
    Element.prototype.transformNode = mockTransformNode;
  }

  // Override XMLHttpRequest.prototype.responseXML to handle leading whitespace/BOM in server XML responses
  var originalResponseXML = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseXML').get;
  Object.defineProperty(XMLHttpRequest.prototype, 'responseXML', {
    get: function() {
      var doc = originalResponseXML.call(this);
      if (doc && doc.querySelector('parsererror')) {
        try {
          var rawText = this.responseText;
          var trimmed = rawText.replace(/^\s+/, '');
          var parser = new DOMParser();
          var newDoc = parser.parseFromString(trimmed, 'text/xml');
          if (!newDoc.querySelector('parsererror')) {
            return newDoc;
          }
        } catch (e) {}
      }
      return doc;
    },
    configurable: true
  });

  // Emulate IE document.XMLDocument property
  if (typeof Document !== 'undefined' && !('XMLDocument' in Document.prototype)) {
    Object.defineProperty(Document.prototype, 'XMLDocument', {
      get: function() {
        if (window.__originalXMLText) {
          if (!window.__originalXMLDoc) {
            try {
              var parser = new DOMParser();
              var parsedDoc = parser.parseFromString(window.__originalXMLText, 'text/xml');
              parsedDoc.selectSingleNode = Document.prototype.selectSingleNode;
              parsedDoc.selectNodes = Document.prototype.selectNodes;
              window.__originalXMLDoc = parsedDoc;
            } catch (e) {
              console.error('[IE-MOCK] Failed to parse XMLDocument:', e);
            }
          }
          return window.__originalXMLDoc;
        }
        return undefined;
      },
      configurable: true
    });
  }

  // Emulate IE Element.prototype.filters
  if (typeof Element !== 'undefined' && !('filters' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'filters', {
      get: function() {
        return {
          item: function(name) {
            return {
              opacity: 1,
              enabled: true
            };
          }
        };
      },
      configurable: true
    });
  }

  // Emulate IE's callable HTML collections: collection(index)
  function makeCallableCollection(collection) {
    if (!collection) return collection;
    var callable = function(index) {
      return collection.item(index) || collection[index];
    };
    for (var i = 0; i < collection.length; i++) {
      (function(idx) {
        Object.defineProperty(callable, idx, {
          get: function() { return collection[idx]; },
          enumerable: true,
          configurable: true
        });
      })(i);
    }
    Object.defineProperty(callable, 'length', {
      get: function() { return collection.length; },
      configurable: true
    });
    callable.item = function(index) {
      return collection.item(index);
    };
    for (var prop in collection) {
      if (isNaN(prop) && !(prop in callable)) {
        try {
          (function(p) {
            Object.defineProperty(callable, p, {
              get: function() { return collection[p]; },
              configurable: true
            });
          })(prop);
        } catch (e) {}
      }
    }
    return callable;
  }

  if (typeof HTMLTableElement !== 'undefined') {
    var descRows = Object.getOwnPropertyDescriptor(HTMLTableElement.prototype, 'rows');
    if (descRows) {
      Object.defineProperty(HTMLTableElement.prototype, 'rows', {
        get: function() { return makeCallableCollection(descRows.get.call(this)); },
        configurable: true
      });
    }
  }
  if (typeof HTMLTableRowElement !== 'undefined') {
    var descCells = Object.getOwnPropertyDescriptor(HTMLTableRowElement.prototype, 'cells');
    if (descCells) {
      Object.defineProperty(HTMLTableRowElement.prototype, 'cells', {
        get: function() { return makeCallableCollection(descCells.get.call(this)); },
        configurable: true
      });
    }
  }
  if (typeof HTMLSelectElement !== 'undefined') {
    var descOptions = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'options');
    if (descOptions) {
      Object.defineProperty(HTMLSelectElement.prototype, 'options', {
        get: function() { return makeCallableCollection(descOptions.get.call(this)); },
        configurable: true
      });
    }
  }

  // Emulate IE's whitespace-ignoring DOM traversal behavior
  if (typeof Node !== 'undefined') {
    var descFirstChild = Object.getOwnPropertyDescriptor(Node.prototype, 'firstChild');
    if (descFirstChild) {
      Object.defineProperty(Node.prototype, 'firstChild', {
        get: function() {
          var node = descFirstChild.get.call(this);
          while (node && node.nodeType === 3 && !/\S/.test(node.nodeValue)) {
            node = node.nextSibling;
          }
          return node;
        },
        configurable: true
      });
    }

    var descLastChild = Object.getOwnPropertyDescriptor(Node.prototype, 'lastChild');
    if (descLastChild) {
      Object.defineProperty(Node.prototype, 'lastChild', {
        get: function() {
          var node = descLastChild.get.call(this);
          while (node && node.nodeType === 3 && !/\S/.test(node.nodeValue)) {
            node = node.previousSibling;
          }
          return node;
        },
        configurable: true
      });
    }

    var descNextSibling = Object.getOwnPropertyDescriptor(Node.prototype, 'nextSibling');
    if (descNextSibling) {
      Object.defineProperty(Node.prototype, 'nextSibling', {
        get: function() {
          var node = descNextSibling.get.call(this);
          while (node && node.nodeType === 3 && !/\S/.test(node.nodeValue)) {
            node = descNextSibling.get.call(node);
          }
          return node;
        },
        configurable: true
      });
    }

    var descPreviousSibling = Object.getOwnPropertyDescriptor(Node.prototype, 'previousSibling');
    if (descPreviousSibling) {
      Object.defineProperty(Node.prototype, 'previousSibling', {
        get: function() {
          var node = descPreviousSibling.get.call(this);
          while (node && node.nodeType === 3 && !/\S/.test(node.nodeValue)) {
            node = descPreviousSibling.get.call(node);
          }
          return node;
        },
        configurable: true
      });
    }

    // Polyfill IE filters collection for transition effect compatibility
    Object.defineProperty(Element.prototype, 'filters', {
      get: function() {
        const self = this;
        return {
          item: function(name) {
            if (name.indexOf('Alpha') !== -1) {
              return {
                get opacity() {
                  return parseFloat(self.style.opacity || '1') * 100;
                },
                set opacity(val) {
                  self.style.opacity = (Number(val) / 100).toString();
                }
              };
            }
            return { opacity: 100 };
          }
        };
      },
      configurable: true
    });

    // Inject standard CSS opacity rules to hide the utility/help menus by default
    function injectOpacityStyles() {
      if (document.getElementById('ie-mock-filter-styles')) return;
      const style = document.createElement('style');
      style.id = 'ie-mock-filter-styles';
      style.textContent = '.masthead-utility-ifrm, .masthead-help-ifrm,' +
        '#utilityMenuSearchID, #utilityMenuDataID, #helpMenuSearchID, #helpMenuDataID {' +
        'opacity: 0; }';
      (document.head || document.documentElement).appendChild(style);
    }
    if (document.head || document.documentElement) {
      injectOpacityStyles();
    } else {
      document.addEventListener('DOMContentLoaded', injectOpacityStyles);
    }
  }
`;

async function main() {
  console.log('============================================================');
  console.log('🚀 TEST ĐĂNG NHẬP CQG CAST');
  console.log(`👤 User: ${USERNAME || '(chưa cung cấp)'}`);
  console.log('============================================================');

  if (!USERNAME || !PASSWORD) {
    console.error('❌ Thiếu CAST_USER hoặc CAST_PASS trong biến môi trường!');
    return;
  }

  // Khởi chạy trình duyệt Edge có giao diện
  const msEdgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const launchOptions: any = {
    headless: false,
    args: ['--start-maximized']
  };

  if (fs.existsSync(msEdgePath)) {
    launchOptions.executablePath = msEdgePath;
    log('✅ Sử dụng trình duyệt Microsoft Edge');
  } else {
    log('⚠️ Không tìm thấy Edge, sử dụng Chromium mặc định');
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko', // Giả lập User-Agent của IE11
  });

  // Đăng ký Mock Script
  await context.addInitScript({ content: IE_MOCK_SCRIPT });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // Pipe browser console messages and errors to terminal
  page.on('console', msg => {
    console.log(`[Browser Console] [${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`[Browser PageError] ${err.message}`);
  });

  let searchFrameXmlText = '';
  let userIndexXmlText = '';

  // Intercept XML/XSL/ASP requests to clean leading whitespace/BOM characters before the browser engine parses them
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url().toLowerCase();
    
    if (url.includes('.xml') || url.includes('.xsl') || url.includes('.asp')) {
      try {
        const response = await route.fetch();
        const contentType = (response.headers()['content-type'] || '').toLowerCase();
        
        if (contentType.includes('xml') || contentType.includes('xsl') || contentType.includes('text') || url.includes('.asp')) {
          const rawBody = await response.text();
          let cleanedBody = rawBody.replace(/^\s+/, '').trimStart();
          
          if (url.includes('searchframe.xml.asp')) {
            searchFrameXmlText = cleanedBody;
          }
          if (url.includes('userindex.asp') && !url.includes('userindex.xsl.asp') && !url.includes('userindex.js.asp')) {
            userIndexXmlText = cleanedBody;
          }

          // Translate obsolete Microsoft WD-xsl to standard W3C XSLT 1.0
          if (url.includes('.xsl') || cleanedBody.includes('http://www.w3.org/TR/WD-xsl')) {
            cleanedBody = cleanedBody.replace(/http:\/\/www\.w3\.org\/TR\/WD-xsl/g, 'http://www.w3.org/1999/XSL/Transform');
            // Fix legacy WD-xsl style node/attribute test .[@attr='val'] -> @attr='val'
            cleanedBody = cleanedBody.replace(/\.\[@([^\]]+)\]/g, '@$1');
          }

          // Inject the source XML text of SearchFrame.xml.asp into SearchFrame.xsl.asp so the JS inside the page can access it under document.XMLDocument getter
          if (url.includes('searchframe.xsl.asp') && searchFrameXmlText) {
            const b64 = Buffer.from(searchFrameXmlText).toString('base64');
            cleanedBody = cleanedBody.replace(
              `<script type='text/javascript' src='/CAST/Script/DataScripts.js.asp'></script>`,
              `<script type='text/javascript'>window.__originalXMLText = atob('${b64}');</script>\n<script type='text/javascript' src='/CAST/Script/DataScripts.js.asp'></script>`
            );
          }

          // Inject the source XML text of UserIndex.xml.asp into UserIndex.xsl.asp
          if (url.includes('userindex.xsl.asp') && userIndexXmlText) {
            const b64 = Buffer.from(userIndexXmlText).toString('base64');
            cleanedBody = cleanedBody.replace(
              /<script\s+language=["']JScript["']\s+src=["']UserIndex\.js\.asp\?language=EN["']\s+charset=["']UTF-8["']>/i,
              `<SCRIPT TYPE="text/javascript">window.__originalXMLText = atob('${b64}');</SCRIPT>\n<SCRIPT LANGUAGE="JScript" SRC="UserIndex.js.asp?language=EN" charset="UTF-8">`
            );
          }
          
          if (url.includes('datascripts.js.asp')) {
            const fs = require('fs');
            const debugFilePath = path.join(DEBUG_DIR, 'DataScripts.js.asp');
            fs.writeFileSync(debugFilePath, cleanedBody);
            console.log(`[DEBUG] Saved dynamic DataScripts.js.asp to ${debugFilePath}`);
          }
          if (url.includes('helpmenu.asp') || url.includes('utilitymenu.asp')) {
            const fs = require('fs');
            const basename = url.substring(url.lastIndexOf('/') + 1);
            const debugFilePath = path.join(DEBUG_DIR, basename);
            fs.writeFileSync(debugFilePath, cleanedBody);
            console.log(`[DEBUG] Saved dynamic ${basename} to ${debugFilePath}`);
          }
          if (url.includes('.xsl') || url.includes('searchframe.xml.asp')) {
            const fs = require('fs');
            const basename = url.includes('?') ? url.substring(url.lastIndexOf('/') + 1, url.indexOf('?')) : url.substring(url.lastIndexOf('/') + 1);
            const debugFilePath = path.join(DEBUG_DIR, basename);
            fs.writeFileSync(debugFilePath, cleanedBody);
            console.log(`[DEBUG] Saved dynamic ${basename} to ${debugFilePath}`);
          }
          if (url.includes('searchframe.js.asp')) {
            const fs = require('fs');
            const basename = 'SearchFrame.js.asp';
            const debugFilePath = path.join(DEBUG_DIR, basename);
            fs.writeFileSync(debugFilePath, cleanedBody);
            console.log(`[DEBUG] Saved dynamic ${basename} to ${debugFilePath}`);
          }

          if (url.includes('searchframe.js.asp')) {
            const fs = require('fs');
            const basename = 'SearchFrame.js.asp';
            const debugFilePath = path.join(DEBUG_DIR, basename);
            fs.writeFileSync(debugFilePath, cleanedBody);
            console.log(`[DEBUG] Saved dynamic ${basename} to ${debugFilePath}`);
          }
          if (url.includes('innerframe.asp')) {
            const fs = require('fs');
            const basename = 'InnerFrame.asp';
            const debugFilePath = path.join(DEBUG_DIR, basename);
            fs.writeFileSync(debugFilePath, cleanedBody);
            console.log(`[DEBUG] Saved dynamic ${basename} to ${debugFilePath}`);
          }
          if (url.includes('userindex.js.asp')) {
            // Fix event handler parameter
            cleanedBody = cleanedBody.replace(/function anonymous\s*\(\s*\)/g, 'function anonymous(event)');
            
            // Fix jumpToLink event srcElement resolution
            cleanedBody = cleanedBody.replace(
              /if\s*\(\s*obj\s*==\s*null\s*\)\s*\r?\n?\s*obj\s*=\s*event\.srcElement\s*;/g,
              `var event = window.event;
              if (obj == null) obj = event ? (event.srcElement || event.target) : null;
              if (!obj) return;`
            );
            
            // Add null guards to all obj.tagName and obj.pageLink checks
            cleanedBody = cleanedBody.replace(/if\s*\(\s*obj\.tagName/g, 'if (obj && obj.tagName');
            cleanedBody = cleanedBody.replace(/if\s*\(\s*event\s*!=\s*null/g, 'if (typeof event !== "undefined" && event != null');

            // Fix IE document.all(id) -> document.getElementById(id) (IE method call syntax)
            cleanedBody = cleanedBody.replace(
              /dataFrameLink\.document\.all\(([^)]+)\)/g,
              'dataFrameLink.document.getElementById($1)'
            );

            // Fix &amp; literal check — HTML parser converts &amp; to & in attributes,
            // so obj.pageLink ends with "&" not "&amp;"
            cleanedBody = cleanedBody.replace(
              /obj\.pageLink\.slice\(-5\) == "&amp;"/g,
              '(obj.pageLink.slice(-5) === "&amp;" || obj.pageLink.slice(-1) === "&")'
            );

            // Wrap searchFrameLink.show() in try/catch to prevent frame-not-ready crashes
            cleanedBody = cleanedBody.replace(
              /searchFrameLink\.show\(/g,
              'try { searchFrameLink.show('
            );
            cleanedBody = cleanedBody.replace(
              /(searchFrameLink\.show\([^;]+;)/g,
              '$1 } catch(e) { console.warn("[IE-MOCK] searchFrameLink.show failed:", e.message); }'
            );
          }

          if (url.includes('userindex.')) {
            const fs = require('fs');
            const basename = url.includes('?') ? url.substring(url.lastIndexOf('/') + 1, url.indexOf('?')) : url.substring(url.lastIndexOf('/') + 1);
            const debugFilePath = path.join(DEBUG_DIR, basename);
            fs.writeFileSync(debugFilePath, cleanedBody);
            console.log(`[DEBUG] Saved dynamic ${basename} to ${debugFilePath}`);
          }

          console.log(`[XML-ROUTE] Cleaned leading whitespace/BOM for: ${request.url()}`);
          
          await route.fulfill({
            response,
            body: cleanedBody,
            headers: {
              ...response.headers(),
              'content-type': url.includes('xsl') ? 'text/xml' : response.headers()['content-type']
            }
          });
          return;
        }
      } catch (e: any) {
        console.log(`[XML-ROUTE-ERROR] Failed to clean ${request.url()}: ${e.message}`);
      }
    }
    
    await route.continue().catch(() => {});
  });

  try {
    log('⚡ Mở trang đăng nhập CAST...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    log('⚡ Điền thông tin đăng nhập...');
    await page.locator('#userNameInput').fill(USERNAME);
    await page.locator('#passwordInput').fill(PASSWORD);

    log('⚡ Gọi doLogon() trực tiếp để đăng nhập...');
    await page.waitForFunction(() => typeof (window as any).doLogon === 'function');
    await page.evaluate(() => {
      (window as any).doLogon();
    });

    log('⚡ Chờ đăng nhập và chuyển hướng...');
    await page.waitForURL('**/CastMain.asp', { timeout: 30000 });
    log('🎉 ĐĂNG NHẬP THÀNH CÔNG!');
    
    // Đợi thêm 5 giây để frameset và menu XML tải hoàn toàn
    log('⚡ Đợi 5 giây để menu tải...');
    await page.waitForTimeout(5000);

    // Chụp màn hình thành công
    const successPath = path.join(DEBUG_DIR, 'login-success.png');
    await page.screenshot({ path: successPath });
    log(`📸 Đã chụp ảnh màn hình thành công lưu tại: ${successPath}`);

    // ── AUTO-NAVIGATE TEST ────────────────────────────────────────────
    log('🖱️ Đang tự động test click vào "Reporting Tool"...');
    await page.waitForTimeout(2000);

    // Tìm frame userIndex (menu frame bên trái)
    const allFrames = page.frames();
    log(`[FRAMES] Tổng số frames: ${allFrames.length}`);
    allFrames.forEach((f, i) => log(`  [${i}] name=${f.name()} url=${f.url()}`));

    // Tìm frame có tên userIndex hoặc URL chứa UserIndex.asp
    let userIndexFrame = allFrames.find(f => f.name() === 'userIndex' || f.url().includes('UserIndex.asp'));
    if (!userIndexFrame) {
      log('⚠️ Không tìm thấy frame userIndex trực tiếp, thử tìm trong nested frames...');
      for (const f of allFrames) {
        const childFrames = f.childFrames();
        const found = childFrames.find(cf => cf.name() === 'userIndex' || cf.url().includes('UserIndex.asp'));
        if (found) { userIndexFrame = found; break; }
      }
    }

    if (userIndexFrame) {
      log(`✅ Tìm thấy userIndex frame: ${userIndexFrame.url()}`);

      // Tìm span LEAFITEM "Reporting Tool" và gọi jumpToLink trực tiếp
      const result = await userIndexFrame.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span.LEAFITEM'));
        const target = spans.find(s => s.textContent && s.textContent.trim() === 'Reporting Tool');
        if (!target) {
          return { found: false, items: spans.map(s => s.textContent?.trim()) };
        }
        const pageLink = (target as any).getAttribute('pageLink') || (target as any).pageLink;
        const win = window as any;

        // Diagnostic: check frame chain
        const diag: any = {
          hasParent: !!win.parent,
          hasParentParent: !!(win.parent && win.parent.parent),
          innerFrame: !!(win.parent && win.parent.parent && win.parent.parent.innerFrame),
          dataFrame: !!(win.parent && win.parent.parent && win.parent.parent.innerFrame && win.parent.parent.innerFrame.dataFrame),
          jumpToLinkExists: typeof win.jumpToLink === 'function',
          dataFrameLinkVar: !!(win.dataFrameLink),
          searchFrameLinkVar: !!(win.searchFrameLink),
        };
        
        // Try to navigate dataFrame directly without going through jumpToLink
        try {
          const df = win.parent && win.parent.parent && win.parent.parent.innerFrame && win.parent.parent.innerFrame.dataFrame;
          if (df) {
            diag.dfUrl = df.location ? df.location.href : 'no location';
            df.location.href = pageLink;
            diag.navigated = true;
          }
        } catch(e: any) {
          diag.navError = e.message;
        }
        
        return { found: true, pageLink, diag };
      });

      log(`[CLICK-TEST] Kết quả: ${JSON.stringify(result)}`);
      await page.waitForTimeout(3000);
      const afterClickPath = path.join(DEBUG_DIR, 'after-reporting-tool-click.png');
      await page.screenshot({ path: afterClickPath });
      log(`📸 Chụp ảnh sau click: ${afterClickPath}`);

      // Tìm lại dataFrame sau khi navigate
      let dataFrame = page.frames().find(f => f.name() === 'dataFrame' || f.url().includes('ReportingTool'));
      if (dataFrame) {
        log(`✅ dataFrame URL: ${dataFrame.url()}`);

        if (dataFrame.url().includes('ReportingTool')) {
          log('🔧 Đang tự động chọn template "Accounts: Balances" và submit form...');
          await dataFrame.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(2000);

          // Bước 1: Chọn template "Accounts: Balances"
          const selectResult = await dataFrame.evaluate(() => {
            const doc = document as any;
            const win = window as any;

            // Tìm template dropdown
            const templateSelect = doc.getElementById('ctl00_mainContent_ddlTemplates') ||
              doc.querySelector('select[name*="Template"]') ||
              doc.querySelector('select[id*="Template"]') ||
              Array.from(doc.querySelectorAll('select')).find((s: any) =>
                Array.from(s.options).some((o: any) => o.text.includes('Balances'))
              );

            if (!templateSelect) {
              const allSelects = Array.from(doc.querySelectorAll('select')).map((s: any) => ({
                id: s.id, name: s.name, options: Array.from(s.options).map((o: any) => o.text).slice(0, 5)
              }));
              return { error: 'Template select not found', allSelects };
            }

            // Tìm option có text "Balances"
            const balancesOption = Array.from(templateSelect.options).find((o: any) =>
              o.text.includes('Balances')
            ) as any;

            if (!balancesOption) {
              const allOptions = Array.from(templateSelect.options).map((o: any) => ({ text: o.text, value: o.value }));
              return { error: 'Balances option not found', allOptions };
            }

            // Chọn template
            templateSelect.value = balancesOption.value;

            // Tìm hidden selectedReport field
            const selectedReport = doc.getElementById('ctl00_mainContent_selectedReport') ||
              doc.querySelector('input[name*="selectedReport"]');

            // Gọi reportTemplateChanged để trigger postback
            if (typeof win.reportTemplateChanged === 'function') {
              win.reportTemplateChanged(templateSelect, selectedReport || { value: '' });
              return { triggered: 'reportTemplateChanged', value: balancesOption.value, text: balancesOption.text };
            }

            // Fallback: trigger change event
            templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
            return { triggered: 'change event', value: balancesOption.value, text: balancesOption.text };
          });

          log(`[SELECT-TEMPLATE] ${JSON.stringify(selectResult)}`);

          // Bước 2: Chờ postback reload
          if ((selectResult as any).triggered) {
            log('⏳ Chờ postback/reload sau khi chọn template...');
            try {
              await dataFrame.waitForNavigation({ timeout: 15000, waitUntil: 'domcontentloaded' });
            } catch(e) {
              await page.waitForTimeout(3000);
            }
          }

          // Bước 3: Lấy lại dataFrame sau reload
          dataFrame = page.frames().find(f => f.name() === 'dataFrame' || f.url().includes('ReportingTool')) || dataFrame;
          await page.waitForTimeout(2000);

          // Bước 4: Dump HTML để debug saveButton onclick
          const htmlDump = await dataFrame.content();
          const htmlPath = path.join(DEBUG_DIR, 'reporting-tool-frame.html');
          require('fs').writeFileSync(htmlPath, htmlDump);
          log(`📄 Saved dataFrame HTML: ${htmlPath}`);

          // Tìm saveButton onclick từ HTML
          const saveButtonMatch = htmlDump.match(/id="saveButton"[^>]*>|saveButton[^}]{0,200}/g);
          log(`[SAVE-BUTTON-HTML] ${JSON.stringify(saveButtonMatch?.slice(0, 3))}`);

          // Intercept network request và submit form
          log('🔍 Bắt đầu monitor network requests...');


          // Lắng nghe tất cả responses trong dataFrame
          const reportResponses: string[] = [];
          const responseHandler = async (response: any) => {
            const url = response.url();
            const status = response.status();
            const contentType = response.headers()['content-type'] || '';
            if (!url.includes('titleBarMenus') && !url.includes('utilitymenu') && !url.includes('helpmenu')) {
              log(`[NET] ${status} ${contentType.slice(0, 40)} ${url.slice(0, 100)}`);
            }
            if (contentType.includes('excel') || contentType.includes('csv') || contentType.includes('application/octet') || contentType.includes('vnd.ms')) {
              log(`🎯 Phát hiện file download: ${url}`);
              try {
                const buffer = await response.body();
                const downloadPath = path.join(DEBUG_DIR, `report-${Date.now()}.csv`);
                require('fs').writeFileSync(downloadPath, buffer);
                log(`✅ ĐÃ TẢI FILE THÀNH CÔNG: ${downloadPath}`);
                reportResponses.push(downloadPath);
              } catch(e: any) {
                log(`⚠️ Không thể lấy body: ${e.message}`);
              }
            }
          };
          page.on('response', responseHandler);

          // Patch checkPage và click saveButton
          await dataFrame.evaluate(() => {
            const win = window as any;
            win.checkPage = function() {
              const rows = document.getElementsByName('reportDetailName');
              let hasSelected = false;
              for (let i = 0; i < rows.length; i++) {
                const cb = rows[i].children[1]?.firstElementChild as HTMLInputElement;
                if (cb && cb.checked) { hasSelected = true; break; }
              }
              if (!hasSelected) { alert('No selected fields'); return false; }
              try {
                if (typeof win.removeHiddenSortOrderDDLs === 'function') win.removeHiddenSortOrderDDLs();
                if (typeof win.unformatAllLocalFilterValues === 'function') win.unformatAllLocalFilterValues(rows);
                if (typeof win.startWaitingForDownload === 'function') win.startWaitingForDownload();
              } catch(e) {}
              return true;
            };
          });

          const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
          await dataFrame.locator('#saveButton').click({ timeout: 5000 });
          log('✅ Đã click saveButton');

          // Chờ 30 giây xem có download event hoặc network response
          log('⏳ Chờ download (30 giây)...');
          const download = await downloadPromise;
          if (download) {
            const downloadPath = path.join(DEBUG_DIR, `report-${Date.now()}.csv`);
            await download.saveAs(downloadPath);
            log(`✅ ĐÃ TẢI FILE THÀNH CÔNG (event): ${downloadPath}`);
          } else {
            await page.waitForTimeout(5000);
            log(`⚠️ Không có download event. Network responses: ${reportResponses.length}`);
          }

          page.off('response', responseHandler);

          await page.waitForTimeout(3000);
          const screenshotPath = path.join(DEBUG_DIR, 'after-create-report.png');
          await page.screenshot({ path: screenshotPath });
          log(`📸 Screenshot sau Create Report: ${screenshotPath}`);
        }
      } else {
        log(`⚠️ dataFrame chưa navigate tới ReportingTool`);
        page.frames().forEach((f, i) => log(`  [${i}] name=${f.name()} url=${f.url()}`));
      }
    } else {
      log('❌ Không tìm thấy frame userIndex. Thử click trực tiếp qua Playwright selector...');
      try {
        const span = page.frameLocator('frame[name="userIndex"], iframe[name="userIndex"]')
          .locator('span.LEAFITEM', { hasText: 'Reporting Tool' });
        await span.click({ timeout: 5000 });
        log('✅ Đã click Reporting Tool qua Playwright locator');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(DEBUG_DIR, 'after-reporting-tool-click.png') });
      } catch(e: any) {
        log(`❌ Fallback click cũng thất bại: ${e.message}`);
      }
    }

    log('⏳ Giữ trình duyệt mở trong 5 phút để bạn kiểm tra...');
    await page.waitForTimeout(300000);


  } catch (error: any) {
    log(`❌ Lỗi trong quá trình chạy: ${error.message}`);
    const errorPath = path.join(DEBUG_DIR, 'login-error.png');
    await page.screenshot({ path: errorPath }).catch(() => {});
    log(`📸 Đã chụp ảnh lỗi lưu tại: ${errorPath}`);
    await page.waitForTimeout(10000);
  } finally {
    await browser.close();
    log('👋 Đã đóng trình duyệt.');
  }
}

main().catch(console.error);

/**
 * IE11 Polyfill / Mock Script for Modern Headless Browsers (Playwright / Puppeteer)
 * 
 * Mục đích:
 * - Giả lập các ActiveX COM objects, IE global events, case-insensitive frames access,
 *   DOM XML parser (MSXML2.DOMDocument, XMLHTTP), XSLTProcessor, và các thuộc tính đặc thù của IE11
 *   để các hệ thống nghiệp vụ legacy (như Core CCP / M-System cũ) chạy trơn tru trên Chromium.
 * - Được tách riêng thành helper độc lập để giữ cho các Service gọn gàng, đúng chuẩn SRP.
 */
export const IE_MOCK_SCRIPT = `
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
            try {
              for (let i = 0; i < this.frames.length; i++) {
                const f = this.frames[i];
                if (f && f.name && f.name.toLowerCase() === lowerName) {
                  return f;
                }
              }
            } catch (e) {}
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

  // Override document.getElementsByName to emulate IE's behavior of matching by 'id' as well
  const originalGetElementsByName = document.getElementsByName;
  document.getElementsByName = function(name) {
    const list = Array.from(originalGetElementsByName.call(document, name));
    const byId = Array.from(document.querySelectorAll('[id="' + name + '"]'));
    const merged = [...list];
    for (var i = 0; i < byId.length; i++) {
      var el = byId[i];
      if (merged.indexOf(el) === -1) {
        merged.push(el);
      }
    }
    merged.item = function(index) {
      return merged[index];
    };
    return merged;
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
            xhr.open('GET', url, false);
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
      if (!xsltDoc) return "";
      const processor = new XSLTProcessor();
      processor.importStylesheet(xsltDoc);
      const resultDoc = processor.transformToDocument(this);
      if (!resultDoc) return "";
      return new XMLSerializer().serializeToString(resultDoc);
    } catch (e) {
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
  if (typeof Element !== 'undefined') {
    const ieCustomAttrs = ['pageLink', 'iscentraldb', 'selectedids', 'hiddenfieldid', 'columntype', 'selectedReport'];
    ieCustomAttrs.forEach(function(attr) {
      if (!(attr in Element.prototype)) {
        Object.defineProperty(Element.prototype, attr, {
          get: function() {
            return this.getAttribute(attr) || undefined;
          },
          set: function(val) {
            this.setAttribute(attr, val);
          },
          configurable: true
        });
      }
    });
  }
`;

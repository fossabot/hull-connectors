/* eslint-disable */
// jsonata-es5.min.js is prepended to this file as part of the Grunt build

(function(window) {
  if (typeof window.window !== "undefined" && window.document) return;
  if (window.require && window.define) return;

  if (!window.console) {
    window.console = function() {
      const msgs = Array.prototype.slice.call(arguments, 0);
      postMessage({ type: "log", data: msgs });
    };
    window.console.error = window.console.warn = window.console.log = window.console.trace =
      window.console;
  }
  window.window = window;
  window.ace = window;
  window.onerror = function(message, file, line, col, err) {
    postMessage({
      type: "error",
      data: {
        message,
        data: err.data,
        file,
        line,
        col,
        stack: err.stack
      }
    });
  };

  window.normalizeModule = function(parentId, moduleName) {
    // normalize plugin requires
    if (moduleName.indexOf("!") !== -1) {
      const chunks = moduleName.split("!");
      return `${window.normalizeModule(
        parentId,
        chunks[0]
      )}!${window.normalizeModule(parentId, chunks[1])}`;
    }
    // normalize relative requires
    if (moduleName.charAt(0) == ".") {
      const base = parentId
        .split("/")
        .slice(0, -1)
        .join("/");
      moduleName = (base ? `${base}/` : "") + moduleName;

      while (moduleName.indexOf(".") !== -1 && previous != moduleName) {
        var previous = moduleName;
        moduleName = moduleName
          .replace(/^\.\//, "")
          .replace(/\/\.\//, "/")
          .replace(/[^\/]+\/\.\.\//, "");
      }
    }

    return moduleName;
  };

  window.require = function require(parentId, id) {
    if (!id) {
      id = parentId;
      parentId = null;
    }
    if (!id.charAt)
      throw new Error(
        "worker.js require() accepts only (parentId, id) as arguments"
      );

    id = window.normalizeModule(parentId, id);

    const module = window.require.modules[id];
    if (module) {
      if (!module.initialized) {
        module.initialized = true;
        module.exports = module.factory().exports;
      }
      return module.exports;
    }

    if (!window.require.tlns) return console.log(`unable to load ${id}`);

    let path = resolveModuleId(id, window.require.tlns);
    if (path.slice(-3) != ".js") path += ".js";

    window.require.id = id;
    window.require.modules[id] = {}; // prevent infinite loop on broken modules
    importScripts(path);
    return window.require(parentId, id);
  };
  function resolveModuleId(id, paths) {
    let testPath = id;
    let tail = "";
    while (testPath) {
      const alias = paths[testPath];
      if (typeof alias === "string") {
        return alias + tail;
      }
      if (alias) {
        return (
          alias.location.replace(/\/*$/, "/") +
          (tail || alias.main || alias.name)
        );
      }
      if (alias === false) {
        return "";
      }
      const i = testPath.lastIndexOf("/");
      if (i === -1) break;
      tail = testPath.substr(i) + tail;
      testPath = testPath.slice(0, i);
    }
    return id;
  }
  window.require.modules = {};
  window.require.tlns = {};

  window.define = function(id, deps, factory) {
    if (arguments.length == 2) {
      factory = deps;
      if (typeof id !== "string") {
        deps = id;
        id = window.require.id;
      }
    } else if (arguments.length == 1) {
      factory = id;
      deps = [];
      id = window.require.id;
    }

    if (typeof factory !== "function") {
      window.require.modules[id] = {
        exports: factory,
        initialized: true
      };
      return;
    }

    if (!deps.length)
      // If there is no dependencies, we inject "require", "exports" and
      // "module" as dependencies, to provide CommonJS compatibility.
      deps = ["require", "exports", "module"];

    const req = function(childId) {
      return window.require(id, childId);
    };

    window.require.modules[id] = {
      exports: {},
      factory() {
        const module = this;
        const returnExports = factory.apply(
          this,
          deps.map(function(dep) {
            switch (dep) {
              // Because "require", "exports" and "module" aren't actual
              // dependencies, we must handle them seperately.
              case "require":
                return req;
              case "exports":
                return module.exports;
              case "module":
                return module;
              // But for all other dependencies, we can just go ahead and
              // require them.
              default:
                return req(dep);
            }
          })
        );
        if (returnExports) module.exports = returnExports;
        return module;
      }
    };
  };
  window.define.amd = {};
  require.tlns = {};
  window.initBaseUrls = function initBaseUrls(topLevelNamespaces) {
    for (const i in topLevelNamespaces) require.tlns[i] = topLevelNamespaces[i];
  };

  window.initSender = function initSender() {
    const EventEmitter = window.require("ace/lib/event_emitter").EventEmitter;
    const oop = window.require("ace/lib/oop");

    const Sender = function() {};

    (function() {
      oop.implement(this, EventEmitter);

      this.callback = function(data, callbackId) {
        postMessage({
          type: "call",
          id: callbackId,
          data
        });
      };

      this.emit = function(name, data) {
        postMessage({
          type: "event",
          name,
          data
        });
      };
    }.call(Sender.prototype));

    return new Sender();
  };

  let main = (window.main = null);
  let sender = (window.sender = null);

  window.onmessage = function(e) {
    const msg = e.data;
    if (msg.event && sender) {
      sender._signal(msg.event, msg.data);
    } else if (msg.command) {
      if (main[msg.command]) main[msg.command].apply(main, msg.args);
      else if (window[msg.command]) window[msg.command].apply(window, msg.args);
      else throw new Error(`Unknown command:${msg.command}`);
    } else if (msg.init) {
      window.initBaseUrls(msg.tlns);
      // require("ace/lib/es5-shim");
      sender = window.sender = window.initSender();
      const clazz = require(msg.module)[msg.classname];
      main = window.main = new clazz(sender);
    }
  };
})(this);

define("ace/lib/oop", ["require", "exports", "module"], function(
  require,
  exports,
  module
) {
  exports.inherits = function(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };

  exports.mixin = function(obj, mixin) {
    for (const key in mixin) {
      obj[key] = mixin[key];
    }
    return obj;
  };

  exports.implement = function(proto, mixin) {
    exports.mixin(proto, mixin);
  };
});

define("ace/range", ["require", "exports", "module"], function(
  require,
  exports,
  module
) {
  const comparePoints = function(p1, p2) {
    return p1.row - p2.row || p1.column - p2.column;
  };
  const Range = function(startRow, startColumn, endRow, endColumn) {
    this.start = {
      row: startRow,
      column: startColumn
    };

    this.end = {
      row: endRow,
      column: endColumn
    };
  };

  (function() {
    this.isEqual = function(range) {
      return (
        this.start.row === range.start.row &&
        this.end.row === range.end.row &&
        this.start.column === range.start.column &&
        this.end.column === range.end.column
      );
    };
    this.toString = function() {
      return `Range: [${this.start.row}/${this.start.column}] -> [${this.end.row}/${this.end.column}]`;
    };

    this.contains = function(row, column) {
      return this.compare(row, column) == 0;
    };
    this.compareRange = function(range) {
      let cmp;
      const end = range.end;
      const start = range.start;

      cmp = this.compare(end.row, end.column);
      if (cmp == 1) {
        cmp = this.compare(start.row, start.column);
        if (cmp == 1) {
          return 2;
        }
        if (cmp == 0) {
          return 1;
        }
        return 0;
      }
      if (cmp == -1) {
        return -2;
      }
      cmp = this.compare(start.row, start.column);
      if (cmp == -1) {
        return -1;
      }
      if (cmp == 1) {
        return 42;
      }
      return 0;
    };
    this.comparePoint = function(p) {
      return this.compare(p.row, p.column);
    };
    this.containsRange = function(range) {
      return (
        this.comparePoint(range.start) == 0 && this.comparePoint(range.end) == 0
      );
    };
    this.intersects = function(range) {
      const cmp = this.compareRange(range);
      return cmp == -1 || cmp == 0 || cmp == 1;
    };
    this.isEnd = function(row, column) {
      return this.end.row == row && this.end.column == column;
    };
    this.isStart = function(row, column) {
      return this.start.row == row && this.start.column == column;
    };
    this.setStart = function(row, column) {
      if (typeof row === "object") {
        this.start.column = row.column;
        this.start.row = row.row;
      } else {
        this.start.row = row;
        this.start.column = column;
      }
    };
    this.setEnd = function(row, column) {
      if (typeof row === "object") {
        this.end.column = row.column;
        this.end.row = row.row;
      } else {
        this.end.row = row;
        this.end.column = column;
      }
    };
    this.inside = function(row, column) {
      if (this.compare(row, column) == 0) {
        if (this.isEnd(row, column) || this.isStart(row, column)) {
          return false;
        }
        return true;
      }
      return false;
    };
    this.insideStart = function(row, column) {
      if (this.compare(row, column) == 0) {
        if (this.isEnd(row, column)) {
          return false;
        }
        return true;
      }
      return false;
    };
    this.insideEnd = function(row, column) {
      if (this.compare(row, column) == 0) {
        if (this.isStart(row, column)) {
          return false;
        }
        return true;
      }
      return false;
    };
    this.compare = function(row, column) {
      if (!this.isMultiLine()) {
        if (row === this.start.row) {
          return column < this.start.column
            ? -1
            : column > this.end.column
            ? 1
            : 0;
        }
      }

      if (row < this.start.row) return -1;

      if (row > this.end.row) return 1;

      if (this.start.row === row) return column >= this.start.column ? 0 : -1;

      if (this.end.row === row) return column <= this.end.column ? 0 : 1;

      return 0;
    };
    this.compareStart = function(row, column) {
      if (this.start.row == row && this.start.column == column) {
        return -1;
      }
      return this.compare(row, column);
    };
    this.compareEnd = function(row, column) {
      if (this.end.row == row && this.end.column == column) {
        return 1;
      }
      return this.compare(row, column);
    };
    this.compareInside = function(row, column) {
      if (this.end.row == row && this.end.column == column) {
        return 1;
      }
      if (this.start.row == row && this.start.column == column) {
        return -1;
      }
      return this.compare(row, column);
    };
    this.clipRows = function(firstRow, lastRow) {
      if (this.end.row > lastRow) var end = { row: lastRow + 1, column: 0 };
      else if (this.end.row < firstRow) var end = { row: firstRow, column: 0 };

      if (this.start.row > lastRow) var start = { row: lastRow + 1, column: 0 };
      else if (this.start.row < firstRow)
        var start = { row: firstRow, column: 0 };

      return Range.fromPoints(start || this.start, end || this.end);
    };
    this.extend = function(row, column) {
      const cmp = this.compare(row, column);

      if (cmp == 0) return this;
      if (cmp == -1) var start = { row, column };
      else var end = { row, column };

      return Range.fromPoints(start || this.start, end || this.end);
    };

    this.isEmpty = function() {
      return (
        this.start.row === this.end.row && this.start.column === this.end.column
      );
    };
    this.isMultiLine = function() {
      return this.start.row !== this.end.row;
    };
    this.clone = function() {
      return Range.fromPoints(this.start, this.end);
    };
    this.collapseRows = function() {
      if (this.end.column == 0)
        return new Range(
          this.start.row,
          0,
          Math.max(this.start.row, this.end.row - 1),
          0
        );
      return new Range(this.start.row, 0, this.end.row, 0);
    };
    this.toScreenRange = function(session) {
      const screenPosStart = session.documentToScreenPosition(this.start);
      const screenPosEnd = session.documentToScreenPosition(this.end);

      return new Range(
        screenPosStart.row,
        screenPosStart.column,
        screenPosEnd.row,
        screenPosEnd.column
      );
    };
    this.moveBy = function(row, column) {
      this.start.row += row;
      this.start.column += column;
      this.end.row += row;
      this.end.column += column;
    };
  }.call(Range.prototype));
  Range.fromPoints = function(start, end) {
    return new Range(start.row, start.column, end.row, end.column);
  };
  Range.comparePoints = comparePoints;

  Range.comparePoints = function(p1, p2) {
    return p1.row - p2.row || p1.column - p2.column;
  };

  exports.Range = Range;
});

define("ace/apply_delta", ["require", "exports", "module"], function(
  require,
  exports,
  module
) {
  function throwDeltaError(delta, errorText) {
    console.log("Invalid Delta:", delta);
    throw `Invalid Delta: ${errorText}`;
  }

  function positionInDocument(docLines, position) {
    return (
      position.row >= 0 &&
      position.row < docLines.length &&
      position.column >= 0 &&
      position.column <= docLines[position.row].length
    );
  }

  function validateDelta(docLines, delta) {
    if (delta.action != "insert" && delta.action != "remove")
      throwDeltaError(delta, "delta.action must be 'insert' or 'remove'");
    if (!(delta.lines instanceof Array))
      throwDeltaError(delta, "delta.lines must be an Array");
    if (!delta.start || !delta.end)
      throwDeltaError(delta, "delta.start/end must be an present");
    const start = delta.start;
    if (!positionInDocument(docLines, delta.start))
      throwDeltaError(delta, "delta.start must be contained in document");
    const end = delta.end;
    if (delta.action == "remove" && !positionInDocument(docLines, end))
      throwDeltaError(
        delta,
        "delta.end must contained in document for 'remove' actions"
      );
    const numRangeRows = end.row - start.row;
    const numRangeLastLineChars =
      end.column - (numRangeRows == 0 ? start.column : 0);
    if (
      numRangeRows != delta.lines.length - 1 ||
      delta.lines[numRangeRows].length != numRangeLastLineChars
    )
      throwDeltaError(delta, "delta.range must match delta lines");
  }

  exports.applyDelta = function(docLines, delta, doNotValidate) {
    const row = delta.start.row;
    const startColumn = delta.start.column;
    const line = docLines[row] || "";
    switch (delta.action) {
      case "insert":
        var lines = delta.lines;
        if (lines.length === 1) {
          docLines[row] =
            line.substring(0, startColumn) +
            delta.lines[0] +
            line.substring(startColumn);
        } else {
          const args = [row, 1].concat(delta.lines);
          docLines.splice.apply(docLines, args);
          docLines[row] = line.substring(0, startColumn) + docLines[row];
          docLines[row + delta.lines.length - 1] += line.substring(startColumn);
        }
        break;
      case "remove":
        var endColumn = delta.end.column;
        var endRow = delta.end.row;
        if (row === endRow) {
          docLines[row] =
            line.substring(0, startColumn) + line.substring(endColumn);
        } else {
          docLines.splice(
            row,
            endRow - row + 1,
            line.substring(0, startColumn) +
              docLines[endRow].substring(endColumn)
          );
        }
        break;
    }
  };
});

define("ace/lib/event_emitter", ["require", "exports", "module"], function(
  require,
  exports,
  module
) {
  const EventEmitter = {};
  const stopPropagation = function() {
    this.propagationStopped = true;
  };
  const preventDefault = function() {
    this.defaultPrevented = true;
  };

  EventEmitter._emit = EventEmitter._dispatchEvent = function(eventName, e) {
    this._eventRegistry || (this._eventRegistry = {});
    this._defaultHandlers || (this._defaultHandlers = {});

    let listeners = this._eventRegistry[eventName] || [];
    const defaultHandler = this._defaultHandlers[eventName];
    if (!listeners.length && !defaultHandler) return;

    if (typeof e !== "object" || !e) e = {};

    if (!e.type) e.type = eventName;
    if (!e.stopPropagation) e.stopPropagation = stopPropagation;
    if (!e.preventDefault) e.preventDefault = preventDefault;

    listeners = listeners.slice();
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](e, this);
      if (e.propagationStopped) break;
    }

    if (defaultHandler && !e.defaultPrevented) return defaultHandler(e, this);
  };

  EventEmitter._signal = function(eventName, e) {
    let listeners = (this._eventRegistry || {})[eventName];
    if (!listeners) return;
    listeners = listeners.slice();
    for (let i = 0; i < listeners.length; i++) listeners[i](e, this);
  };

  EventEmitter.once = function(eventName, callback) {
    const _self = this;
    callback &&
      this.addEventListener(eventName, function newCallback() {
        _self.removeEventListener(eventName, newCallback);
        callback.apply(null, arguments);
      });
  };

  EventEmitter.setDefaultHandler = function(eventName, callback) {
    let handlers = this._defaultHandlers;
    if (!handlers) handlers = this._defaultHandlers = { _disabled_: {} };

    if (handlers[eventName]) {
      const old = handlers[eventName];
      let disabled = handlers._disabled_[eventName];
      if (!disabled) handlers._disabled_[eventName] = disabled = [];
      disabled.push(old);
      const i = disabled.indexOf(callback);
      if (i != -1) disabled.splice(i, 1);
    }
    handlers[eventName] = callback;
  };
  EventEmitter.removeDefaultHandler = function(eventName, callback) {
    const handlers = this._defaultHandlers;
    if (!handlers) return;
    const disabled = handlers._disabled_[eventName];

    if (handlers[eventName] == callback) {
      const old = handlers[eventName];
      if (disabled) this.setDefaultHandler(eventName, disabled.pop());
    } else if (disabled) {
      const i = disabled.indexOf(callback);
      if (i != -1) disabled.splice(i, 1);
    }
  };

  EventEmitter.on = EventEmitter.addEventListener = function(
    eventName,
    callback,
    capturing
  ) {
    this._eventRegistry = this._eventRegistry || {};

    let listeners = this._eventRegistry[eventName];
    if (!listeners) listeners = this._eventRegistry[eventName] = [];

    if (listeners.indexOf(callback) == -1)
      listeners[capturing ? "unshift" : "push"](callback);
    return callback;
  };

  EventEmitter.off = EventEmitter.removeListener = EventEmitter.removeEventListener = function(
    eventName,
    callback
  ) {
    this._eventRegistry = this._eventRegistry || {};

    const listeners = this._eventRegistry[eventName];
    if (!listeners) return;

    const index = listeners.indexOf(callback);
    if (index !== -1) listeners.splice(index, 1);
  };

  EventEmitter.removeAllListeners = function(eventName) {
    if (this._eventRegistry) this._eventRegistry[eventName] = [];
  };

  exports.EventEmitter = EventEmitter;
});

define("ace/anchor", [
  "require",
  "exports",
  "module",
  "ace/lib/oop",
  "ace/lib/event_emitter"
], function(require, exports, module) {
  const oop = require("./lib/oop");
  const EventEmitter = require("./lib/event_emitter").EventEmitter;

  const Anchor = (exports.Anchor = function(doc, row, column) {
    this.$onChange = this.onChange.bind(this);
    this.attach(doc);

    if (typeof column === "undefined") this.setPosition(row.row, row.column);
    else this.setPosition(row, column);
  });

  (function() {
    oop.implement(this, EventEmitter);
    this.getPosition = function() {
      return this.$clipPositionToDocument(this.row, this.column);
    };
    this.getDocument = function() {
      return this.document;
    };
    this.$insertRight = false;
    this.onChange = function(delta) {
      if (delta.start.row == delta.end.row && delta.start.row != this.row)
        return;

      if (delta.start.row > this.row) return;

      const point = $getTransformedPoint(
        delta,
        { row: this.row, column: this.column },
        this.$insertRight
      );
      this.setPosition(point.row, point.column, true);
    };

    function $pointsInOrder(point1, point2, equalPointsInOrder) {
      const bColIsAfter = equalPointsInOrder
        ? point1.column <= point2.column
        : point1.column < point2.column;
      return (
        point1.row < point2.row || (point1.row == point2.row && bColIsAfter)
      );
    }

    function $getTransformedPoint(delta, point, moveIfEqual) {
      const deltaIsInsert = delta.action == "insert";
      const deltaRowShift =
        (deltaIsInsert ? 1 : -1) * (delta.end.row - delta.start.row);
      const deltaColShift =
        (deltaIsInsert ? 1 : -1) * (delta.end.column - delta.start.column);
      const deltaStart = delta.start;
      const deltaEnd = deltaIsInsert ? deltaStart : delta.end; // Collapse insert range.
      if ($pointsInOrder(point, deltaStart, moveIfEqual)) {
        return {
          row: point.row,
          column: point.column
        };
      }
      if ($pointsInOrder(deltaEnd, point, !moveIfEqual)) {
        return {
          row: point.row + deltaRowShift,
          column: point.column + (point.row == deltaEnd.row ? deltaColShift : 0)
        };
      }

      return {
        row: deltaStart.row,
        column: deltaStart.column
      };
    }
    this.setPosition = function(row, column, noClip) {
      let pos;
      if (noClip) {
        pos = {
          row,
          column
        };
      } else {
        pos = this.$clipPositionToDocument(row, column);
      }

      if (this.row == pos.row && this.column == pos.column) return;

      const old = {
        row: this.row,
        column: this.column
      };

      this.row = pos.row;
      this.column = pos.column;
      this._signal("change", {
        old,
        value: pos
      });
    };
    this.detach = function() {
      this.document.removeEventListener("change", this.$onChange);
    };
    this.attach = function(doc) {
      this.document = doc || this.document;
      this.document.on("change", this.$onChange);
    };
    this.$clipPositionToDocument = function(row, column) {
      const pos = {};

      if (row >= this.document.getLength()) {
        pos.row = Math.max(0, this.document.getLength() - 1);
        pos.column = this.document.getLine(pos.row).length;
      } else if (row < 0) {
        pos.row = 0;
        pos.column = 0;
      } else {
        pos.row = row;
        pos.column = Math.min(
          this.document.getLine(pos.row).length,
          Math.max(0, column)
        );
      }

      if (column < 0) pos.column = 0;

      return pos;
    };
  }.call(Anchor.prototype));
});

define("ace/document", [
  "require",
  "exports",
  "module",
  "ace/lib/oop",
  "ace/apply_delta",
  "ace/lib/event_emitter",
  "ace/range",
  "ace/anchor"
], function(require, exports, module) {
  const oop = require("./lib/oop");
  const applyDelta = require("./apply_delta").applyDelta;
  const EventEmitter = require("./lib/event_emitter").EventEmitter;
  const Range = require("./range").Range;
  const Anchor = require("./anchor").Anchor;

  const Document = function(textOrLines) {
    this.$lines = [""];
    if (textOrLines.length === 0) {
      this.$lines = [""];
    } else if (Array.isArray(textOrLines)) {
      this.insertMergedLines({ row: 0, column: 0 }, textOrLines);
    } else {
      this.insert({ row: 0, column: 0 }, textOrLines);
    }
  };

  (function() {
    oop.implement(this, EventEmitter);
    this.setValue = function(text) {
      const len = this.getLength() - 1;
      this.remove(new Range(0, 0, len, this.getLine(len).length));
      this.insert({ row: 0, column: 0 }, text);
    };
    this.getValue = function() {
      return this.getAllLines().join(this.getNewLineCharacter());
    };
    this.createAnchor = function(row, column) {
      return new Anchor(this, row, column);
    };
    if ("aaa".split(/a/).length === 0) {
      this.$split = function(text) {
        return text.replace(/\r\n|\r/g, "\n").split("\n");
      };
    } else {
      this.$split = function(text) {
        return text.split(/\r\n|\r|\n/);
      };
    }

    this.$detectNewLine = function(text) {
      const match = text.match(/^.*?(\r\n|\r|\n)/m);
      this.$autoNewLine = match ? match[1] : "\n";
      this._signal("changeNewLineMode");
    };
    this.getNewLineCharacter = function() {
      switch (this.$newLineMode) {
        case "windows":
          return "\r\n";
        case "unix":
          return "\n";
        default:
          return this.$autoNewLine || "\n";
      }
    };

    this.$autoNewLine = "";
    this.$newLineMode = "auto";
    this.setNewLineMode = function(newLineMode) {
      if (this.$newLineMode === newLineMode) return;

      this.$newLineMode = newLineMode;
      this._signal("changeNewLineMode");
    };
    this.getNewLineMode = function() {
      return this.$newLineMode;
    };
    this.isNewLine = function(text) {
      return text == "\r\n" || text == "\r" || text == "\n";
    };
    this.getLine = function(row) {
      return this.$lines[row] || "";
    };
    this.getLines = function(firstRow, lastRow) {
      return this.$lines.slice(firstRow, lastRow + 1);
    };
    this.getAllLines = function() {
      return this.getLines(0, this.getLength());
    };
    this.getLength = function() {
      return this.$lines.length;
    };
    this.getTextRange = function(range) {
      return this.getLinesForRange(range).join(this.getNewLineCharacter());
    };
    this.getLinesForRange = function(range) {
      let lines;
      if (range.start.row === range.end.row) {
        lines = [
          this.getLine(range.start.row).substring(
            range.start.column,
            range.end.column
          )
        ];
      } else {
        lines = this.getLines(range.start.row, range.end.row);
        lines[0] = (lines[0] || "").substring(range.start.column);
        const l = lines.length - 1;
        if (range.end.row - range.start.row == l)
          lines[l] = lines[l].substring(0, range.end.column);
      }
      return lines;
    };
    this.insertLines = function(row, lines) {
      console.warn(
        "Use of document.insertLines is deprecated. Use the insertFullLines method instead."
      );
      return this.insertFullLines(row, lines);
    };
    this.removeLines = function(firstRow, lastRow) {
      console.warn(
        "Use of document.removeLines is deprecated. Use the removeFullLines method instead."
      );
      return this.removeFullLines(firstRow, lastRow);
    };
    this.insertNewLine = function(position) {
      console.warn(
        "Use of document.insertNewLine is deprecated. Use insertMergedLines(position, ['', '']) instead."
      );
      return this.insertMergedLines(position, ["", ""]);
    };
    this.insert = function(position, text) {
      if (this.getLength() <= 1) this.$detectNewLine(text);

      return this.insertMergedLines(position, this.$split(text));
    };
    this.insertInLine = function(position, text) {
      const start = this.clippedPos(position.row, position.column);
      const end = this.pos(position.row, position.column + text.length);

      this.applyDelta(
        {
          start,
          end,
          action: "insert",
          lines: [text]
        },
        true
      );

      return this.clonePos(end);
    };

    this.clippedPos = function(row, column) {
      const length = this.getLength();
      if (row === undefined) {
        row = length;
      } else if (row < 0) {
        row = 0;
      } else if (row >= length) {
        row = length - 1;
        column = undefined;
      }
      const line = this.getLine(row);
      if (column == undefined) column = line.length;
      column = Math.min(Math.max(column, 0), line.length);
      return { row, column };
    };

    this.clonePos = function(pos) {
      return { row: pos.row, column: pos.column };
    };

    this.pos = function(row, column) {
      return { row, column };
    };

    this.$clipPosition = function(position) {
      const length = this.getLength();
      if (position.row >= length) {
        position.row = Math.max(0, length - 1);
        position.column = this.getLine(length - 1).length;
      } else {
        position.row = Math.max(0, position.row);
        position.column = Math.min(
          Math.max(position.column, 0),
          this.getLine(position.row).length
        );
      }
      return position;
    };
    this.insertFullLines = function(row, lines) {
      row = Math.min(Math.max(row, 0), this.getLength());
      let column = 0;
      if (row < this.getLength()) {
        lines = lines.concat([""]);
        column = 0;
      } else {
        lines = [""].concat(lines);
        row--;
        column = this.$lines[row].length;
      }
      this.insertMergedLines({ row, column }, lines);
    };
    this.insertMergedLines = function(position, lines) {
      const start = this.clippedPos(position.row, position.column);
      const end = {
        row: start.row + lines.length - 1,
        column:
          (lines.length == 1 ? start.column : 0) +
          lines[lines.length - 1].length
      };

      this.applyDelta({
        start,
        end,
        action: "insert",
        lines
      });

      return this.clonePos(end);
    };
    this.remove = function(range) {
      const start = this.clippedPos(range.start.row, range.start.column);
      const end = this.clippedPos(range.end.row, range.end.column);
      this.applyDelta({
        start,
        end,
        action: "remove",
        lines: this.getLinesForRange({ start, end })
      });
      return this.clonePos(start);
    };
    this.removeInLine = function(row, startColumn, endColumn) {
      const start = this.clippedPos(row, startColumn);
      const end = this.clippedPos(row, endColumn);

      this.applyDelta(
        {
          start,
          end,
          action: "remove",
          lines: this.getLinesForRange({ start, end })
        },
        true
      );

      return this.clonePos(start);
    };
    this.removeFullLines = function(firstRow, lastRow) {
      firstRow = Math.min(Math.max(0, firstRow), this.getLength() - 1);
      lastRow = Math.min(Math.max(0, lastRow), this.getLength() - 1);
      const deleteFirstNewLine =
        lastRow == this.getLength() - 1 && firstRow > 0;
      const deleteLastNewLine = lastRow < this.getLength() - 1;
      const startRow = deleteFirstNewLine ? firstRow - 1 : firstRow;
      const startCol = deleteFirstNewLine ? this.getLine(startRow).length : 0;
      const endRow = deleteLastNewLine ? lastRow + 1 : lastRow;
      const endCol = deleteLastNewLine ? 0 : this.getLine(endRow).length;
      const range = new Range(startRow, startCol, endRow, endCol);
      const deletedLines = this.$lines.slice(firstRow, lastRow + 1);

      this.applyDelta({
        start: range.start,
        end: range.end,
        action: "remove",
        lines: this.getLinesForRange(range)
      });
      return deletedLines;
    };
    this.removeNewLine = function(row) {
      if (row < this.getLength() - 1 && row >= 0) {
        this.applyDelta({
          start: this.pos(row, this.getLine(row).length),
          end: this.pos(row + 1, 0),
          action: "remove",
          lines: ["", ""]
        });
      }
    };
    this.replace = function(range, text) {
      if (!(range instanceof Range))
        range = Range.fromPoints(range.start, range.end);
      if (text.length === 0 && range.isEmpty()) return range.start;
      if (text == this.getTextRange(range)) return range.end;

      this.remove(range);
      let end;
      if (text) {
        end = this.insert(range.start, text);
      } else {
        end = range.start;
      }

      return end;
    };
    this.applyDeltas = function(deltas) {
      for (let i = 0; i < deltas.length; i++) {
        this.applyDelta(deltas[i]);
      }
    };
    this.revertDeltas = function(deltas) {
      for (let i = deltas.length - 1; i >= 0; i--) {
        this.revertDelta(deltas[i]);
      }
    };
    this.applyDelta = function(delta, doNotValidate) {
      const isInsert = delta.action == "insert";
      if (
        isInsert
          ? delta.lines.length <= 1 && !delta.lines[0]
          : !Range.comparePoints(delta.start, delta.end)
      ) {
        return;
      }

      if (isInsert && delta.lines.length > 20000)
        this.$splitAndapplyLargeDelta(delta, 20000);
      applyDelta(this.$lines, delta, doNotValidate);
      this._signal("change", delta);
    };

    this.$splitAndapplyLargeDelta = function(delta, MAX) {
      const lines = delta.lines;
      const l = lines.length;
      const row = delta.start.row;
      let column = delta.start.column;
      let from = 0;
      let to = 0;
      do {
        from = to;
        to += MAX - 1;
        const chunk = lines.slice(from, to);
        if (to > l) {
          delta.lines = chunk;
          delta.start.row = row + from;
          delta.start.column = column;
          break;
        }
        chunk.push("");
        this.applyDelta(
          {
            start: this.pos(row + from, column),
            end: this.pos(row + to, (column = 0)),
            action: delta.action,
            lines: chunk
          },
          true
        );
      } while (true);
    };
    this.revertDelta = function(delta) {
      this.applyDelta({
        start: this.clonePos(delta.start),
        end: this.clonePos(delta.end),
        action: delta.action == "insert" ? "remove" : "insert",
        lines: delta.lines.slice()
      });
    };
    this.indexToPosition = function(index, startRow) {
      const lines = this.$lines || this.getAllLines();
      const newlineLength = this.getNewLineCharacter().length;
      for (var i = startRow || 0, l = lines.length; i < l; i++) {
        index -= lines[i].length + newlineLength;
        if (index < 0)
          return { row: i, column: index + lines[i].length + newlineLength };
      }
      return { row: l - 1, column: lines[l - 1].length };
    };
    this.positionToIndex = function(pos, startRow) {
      const lines = this.$lines || this.getAllLines();
      const newlineLength = this.getNewLineCharacter().length;
      let index = 0;
      const row = Math.min(pos.row, lines.length);
      for (let i = startRow || 0; i < row; ++i)
        index += lines[i].length + newlineLength;

      return index + pos.column;
    };
  }.call(Document.prototype));

  exports.Document = Document;
});

define("ace/lib/lang", ["require", "exports", "module"], function(
  require,
  exports,
  module
) {
  exports.last = function(a) {
    return a[a.length - 1];
  };

  exports.stringReverse = function(string) {
    return string
      .split("")
      .reverse()
      .join("");
  };

  exports.stringRepeat = function(string, count) {
    let result = "";
    while (count > 0) {
      if (count & 1) result += string;

      if ((count >>= 1)) string += string;
    }
    return result;
  };

  const trimBeginRegexp = /^\s\s*/;
  const trimEndRegexp = /\s\s*$/;

  exports.stringTrimLeft = function(string) {
    return string.replace(trimBeginRegexp, "");
  };

  exports.stringTrimRight = function(string) {
    return string.replace(trimEndRegexp, "");
  };

  exports.copyObject = function(obj) {
    const copy = {};
    for (const key in obj) {
      copy[key] = obj[key];
    }
    return copy;
  };

  exports.copyArray = function(array) {
    const copy = [];
    for (let i = 0, l = array.length; i < l; i++) {
      if (array[i] && typeof array[i] === "object")
        copy[i] = this.copyObject(array[i]);
      else copy[i] = array[i];
    }
    return copy;
  };

  exports.deepCopy = function deepCopy(obj) {
    if (typeof obj !== "object" || !obj) return obj;
    let copy;
    if (Array.isArray(obj)) {
      copy = [];
      for (var key = 0; key < obj.length; key++) {
        copy[key] = deepCopy(obj[key]);
      }
      return copy;
    }
    if (Object.prototype.toString.call(obj) !== "[object Object]") return obj;

    copy = {};
    for (var key in obj) copy[key] = deepCopy(obj[key]);
    return copy;
  };

  exports.arrayToMap = function(arr) {
    const map = {};
    for (let i = 0; i < arr.length; i++) {
      map[arr[i]] = 1;
    }
    return map;
  };

  exports.createMap = function(props) {
    const map = Object.create(null);
    for (const i in props) {
      map[i] = props[i];
    }
    return map;
  };
  exports.arrayRemove = function(array, value) {
    for (let i = 0; i <= array.length; i++) {
      if (value === array[i]) {
        array.splice(i, 1);
      }
    }
  };

  exports.escapeRegExp = function(str) {
    return str.replace(/([.*+?^${}()|[\]\/\\])/g, "\\$1");
  };

  exports.escapeHTML = function(str) {
    return str
      .replace(/&/g, "&#38;")
      .replace(/"/g, "&#34;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&#60;");
  };

  exports.getMatchOffsets = function(string, regExp) {
    const matches = [];

    string.replace(regExp, function(str) {
      matches.push({
        offset: arguments[arguments.length - 2],
        length: str.length
      });
    });

    return matches;
  };
  exports.deferredCall = function(fcn) {
    let timer = null;
    const callback = function() {
      timer = null;
      fcn();
    };

    var deferred = function(timeout) {
      deferred.cancel();
      timer = setTimeout(callback, timeout || 0);
      return deferred;
    };

    deferred.schedule = deferred;

    deferred.call = function() {
      this.cancel();
      fcn();
      return deferred;
    };

    deferred.cancel = function() {
      clearTimeout(timer);
      timer = null;
      return deferred;
    };

    deferred.isPending = function() {
      return timer;
    };

    return deferred;
  };

  exports.delayedCall = function(fcn, defaultTimeout) {
    let timer = null;
    const callback = function() {
      timer = null;
      fcn();
    };

    const _self = function(timeout) {
      if (timer == null)
        timer = setTimeout(callback, timeout || defaultTimeout);
    };

    _self.delay = function(timeout) {
      timer && clearTimeout(timer);
      timer = setTimeout(callback, timeout || defaultTimeout);
    };
    _self.schedule = _self;

    _self.call = function() {
      this.cancel();
      fcn();
    };

    _self.cancel = function() {
      timer && clearTimeout(timer);
      timer = null;
    };

    _self.isPending = function() {
      return timer;
    };

    return _self;
  };
});

define("ace/worker/mirror", [
  "require",
  "exports",
  "module",
  "ace/range",
  "ace/document",
  "ace/lib/lang"
], function(require, exports, module) {
  const Range = require("../range").Range;
  const Document = require("../document").Document;
  const lang = require("../lib/lang");

  const Mirror = (exports.Mirror = function(sender) {
    this.sender = sender;
    const doc = (this.doc = new Document(""));

    const deferredUpdate = (this.deferredUpdate = lang.delayedCall(
      this.onUpdate.bind(this)
    ));

    const _self = this;
    sender.on("change", function(e) {
      const data = e.data;
      if (data[0].start) {
        doc.applyDeltas(data);
      } else {
        for (let i = 0; i < data.length; i += 2) {
          if (Array.isArray(data[i + 1])) {
            var d = { action: "insert", start: data[i], lines: data[i + 1] };
          } else {
            var d = { action: "remove", start: data[i], end: data[i + 1] };
          }
          doc.applyDelta(d, true);
        }
      }
      if (_self.$timeout) return deferredUpdate.schedule(_self.$timeout);
      _self.onUpdate();
    });
  });

  (function() {
    this.$timeout = 500;

    this.setTimeout = function(timeout) {
      this.$timeout = timeout;
    };

    this.setValue = function(value) {
      this.doc.setValue(value);
      this.deferredUpdate.schedule(this.$timeout);
    };

    this.getValue = function(callbackId) {
      this.sender.callback(this.doc.getValue(), callbackId);
    };

    this.onUpdate = function() {};

    this.isPending = function() {
      return this.deferredUpdate.isPending();
    };
  }.call(Mirror.prototype));
});

define("ace/lib/es5-shim", ["require", "exports", "module"], function(
  require,
  exports,
  module
) {
  function Empty() {}

  if (!Function.prototype.bind) {
    Function.prototype.bind = function bind(that) {
      // .length is 1
      const target = this;
      if (typeof target !== "function") {
        throw new TypeError(
          `Function.prototype.bind called on incompatible ${target}`
        );
      }
      const args = slice.call(arguments, 1); // for normal call
      var bound = function() {
        if (this instanceof bound) {
          const result = target.apply(this, args.concat(slice.call(arguments)));
          if (Object(result) === result) {
            return result;
          }
          return this;
        }
        return target.apply(that, args.concat(slice.call(arguments)));
      };
      if (target.prototype) {
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
      }
      return bound;
    };
  }
  const call = Function.prototype.call;
  const prototypeOfArray = Array.prototype;
  const prototypeOfObject = Object.prototype;
  var slice = prototypeOfArray.slice;
  const _toString = call.bind(prototypeOfObject.toString);
  const owns = call.bind(prototypeOfObject.hasOwnProperty);
  let defineGetter;
  let defineSetter;
  let lookupGetter;
  let lookupSetter;
  let supportsAccessors;
  if ((supportsAccessors = owns(prototypeOfObject, "__defineGetter__"))) {
    defineGetter = call.bind(prototypeOfObject.__defineGetter__);
    defineSetter = call.bind(prototypeOfObject.__defineSetter__);
    lookupGetter = call.bind(prototypeOfObject.__lookupGetter__);
    lookupSetter = call.bind(prototypeOfObject.__lookupSetter__);
  }
  if ([1, 2].splice(0).length != 2) {
    if (
      (function() {
        // test IE < 9 to splice bug - see issue #138
        function makeArray(l) {
          const a = new Array(l + 2);
          a[0] = a[1] = 0;
          return a;
        }
        const array = [];
        let lengthBefore;

        array.splice.apply(array, makeArray(20));
        array.splice.apply(array, makeArray(26));

        lengthBefore = array.length; // 46
        array.splice(5, 0, "XXX"); // add one element

        lengthBefore + 1 == array.length;

        if (lengthBefore + 1 == array.length) {
          return true; // has right splice implementation without bugs
        }
      })()
    ) {
      // IE 6/7
      const array_splice = Array.prototype.splice;
      Array.prototype.splice = function(start, deleteCount) {
        if (!arguments.length) {
          return [];
        }
        return array_splice.apply(
          this,
          [
            start === void 0 ? 0 : start,
            deleteCount === void 0 ? this.length - start : deleteCount
          ].concat(slice.call(arguments, 2))
        );
      };
    } else {
      // IE8
      Array.prototype.splice = function(pos, removeCount) {
        const length = this.length;
        if (pos > 0) {
          if (pos > length) pos = length;
        } else if (pos == void 0) {
          pos = 0;
        } else if (pos < 0) {
          pos = Math.max(length + pos, 0);
        }

        if (!(pos + removeCount < length)) removeCount = length - pos;

        const removed = this.slice(pos, pos + removeCount);
        const insert = slice.call(arguments, 2);
        const add = insert.length;
        if (pos === length) {
          if (add) {
            this.push.apply(this, insert);
          }
        } else {
          const remove = Math.min(removeCount, length - pos);
          const tailOldPos = pos + remove;
          const tailNewPos = tailOldPos + add - remove;
          const tailCount = length - tailOldPos;
          const lengthAfterRemove = length - remove;

          if (tailNewPos < tailOldPos) {
            // case A
            for (var i = 0; i < tailCount; ++i) {
              this[tailNewPos + i] = this[tailOldPos + i];
            }
          } else if (tailNewPos > tailOldPos) {
            // case B
            for (i = tailCount; i--; ) {
              this[tailNewPos + i] = this[tailOldPos + i];
            }
          } // else, add == remove (nothing to do)

          if (add && pos === lengthAfterRemove) {
            this.length = lengthAfterRemove; // truncate array
            this.push.apply(this, insert);
          } else {
            this.length = lengthAfterRemove + add; // reserves space
            for (i = 0; i < add; ++i) {
              this[pos + i] = insert[i];
            }
          }
        }
        return removed;
      };
    }
  }
  if (!Array.isArray) {
    Array.isArray = function isArray(obj) {
      return _toString(obj) == "[object Array]";
    };
  }
  const boxedString = Object("a");
  const splitString = boxedString[0] != "a" || !(0 in boxedString);

  if (!Array.prototype.forEach) {
    Array.prototype.forEach = function forEach(fun /* , thisp*/) {
      const object = toObject(this);
      const self =
        splitString && _toString(this) == "[object String]"
          ? this.split("")
          : object;
      const thisp = arguments[1];
      let i = -1;
      const length = self.length >>> 0;
      if (_toString(fun) != "[object Function]") {
        throw new TypeError(); // TODO message
      }

      while (++i < length) {
        if (i in self) {
          fun.call(thisp, self[i], i, object);
        }
      }
    };
  }
  if (!Array.prototype.map) {
    Array.prototype.map = function map(fun /* , thisp*/) {
      const object = toObject(this);
      const self =
        splitString && _toString(this) == "[object String]"
          ? this.split("")
          : object;
      const length = self.length >>> 0;
      const result = Array(length);
      const thisp = arguments[1];
      if (_toString(fun) != "[object Function]") {
        throw new TypeError(`${fun} is not a function`);
      }

      for (let i = 0; i < length; i++) {
        if (i in self) result[i] = fun.call(thisp, self[i], i, object);
      }
      return result;
    };
  }
  if (!Array.prototype.filter) {
    Array.prototype.filter = function filter(fun /* , thisp */) {
      const object = toObject(this);
      const self =
        splitString && _toString(this) == "[object String]"
          ? this.split("")
          : object;
      const length = self.length >>> 0;
      const result = [];
      let value;
      const thisp = arguments[1];
      if (_toString(fun) != "[object Function]") {
        throw new TypeError(`${fun} is not a function`);
      }

      for (let i = 0; i < length; i++) {
        if (i in self) {
          value = self[i];
          if (fun.call(thisp, value, i, object)) {
            result.push(value);
          }
        }
      }
      return result;
    };
  }
  if (!Array.prototype.every) {
    Array.prototype.every = function every(fun /* , thisp */) {
      const object = toObject(this);
      const self =
        splitString && _toString(this) == "[object String]"
          ? this.split("")
          : object;
      const length = self.length >>> 0;
      const thisp = arguments[1];
      if (_toString(fun) != "[object Function]") {
        throw new TypeError(`${fun} is not a function`);
      }

      for (let i = 0; i < length; i++) {
        if (i in self && !fun.call(thisp, self[i], i, object)) {
          return false;
        }
      }
      return true;
    };
  }
  if (!Array.prototype.some) {
    Array.prototype.some = function some(fun /* , thisp */) {
      const object = toObject(this);
      const self =
        splitString && _toString(this) == "[object String]"
          ? this.split("")
          : object;
      const length = self.length >>> 0;
      const thisp = arguments[1];
      if (_toString(fun) != "[object Function]") {
        throw new TypeError(`${fun} is not a function`);
      }

      for (let i = 0; i < length; i++) {
        if (i in self && fun.call(thisp, self[i], i, object)) {
          return true;
        }
      }
      return false;
    };
  }
  if (!Array.prototype.reduce) {
    Array.prototype.reduce = function reduce(fun /* , initial*/) {
      const object = toObject(this);
      const self =
        splitString && _toString(this) == "[object String]"
          ? this.split("")
          : object;
      const length = self.length >>> 0;
      if (_toString(fun) != "[object Function]") {
        throw new TypeError(`${fun} is not a function`);
      }
      if (!length && arguments.length == 1) {
        throw new TypeError("reduce of empty array with no initial value");
      }

      let i = 0;
      let result;
      if (arguments.length >= 2) {
        result = arguments[1];
      } else {
        do {
          if (i in self) {
            result = self[i++];
            break;
          }
          if (++i >= length) {
            throw new TypeError("reduce of empty array with no initial value");
          }
        } while (true);
      }

      for (; i < length; i++) {
        if (i in self) {
          result = fun.call(void 0, result, self[i], i, object);
        }
      }

      return result;
    };
  }
  if (!Array.prototype.reduceRight) {
    Array.prototype.reduceRight = function reduceRight(fun /* , initial*/) {
      const object = toObject(this);
      const self =
        splitString && _toString(this) == "[object String]"
          ? this.split("")
          : object;
      const length = self.length >>> 0;
      if (_toString(fun) != "[object Function]") {
        throw new TypeError(`${fun} is not a function`);
      }
      if (!length && arguments.length == 1) {
        throw new TypeError("reduceRight of empty array with no initial value");
      }

      let result;
      let i = length - 1;
      if (arguments.length >= 2) {
        result = arguments[1];
      } else {
        do {
          if (i in self) {
            result = self[i--];
            break;
          }
          if (--i < 0) {
            throw new TypeError(
              "reduceRight of empty array with no initial value"
            );
          }
        } while (true);
      }

      do {
        if (i in this) {
          result = fun.call(void 0, result, self[i], i, object);
        }
      } while (i--);

      return result;
    };
  }
  if (!Array.prototype.indexOf || [0, 1].indexOf(1, 2) != -1) {
    Array.prototype.indexOf = function indexOf(sought /* , fromIndex */) {
      const self =
        splitString && _toString(this) == "[object String]"
          ? this.split("")
          : toObject(this);
      const length = self.length >>> 0;

      if (!length) {
        return -1;
      }

      let i = 0;
      if (arguments.length > 1) {
        i = toInteger(arguments[1]);
      }
      i = i >= 0 ? i : Math.max(0, length + i);
      for (; i < length; i++) {
        if (i in self && self[i] === sought) {
          return i;
        }
      }
      return -1;
    };
  }
  if (!Array.prototype.lastIndexOf || [0, 1].lastIndexOf(0, -3) != -1) {
    Array.prototype.lastIndexOf = function lastIndexOf(
      sought /* , fromIndex */
    ) {
      const self =
        splitString && _toString(this) == "[object String]"
          ? this.split("")
          : toObject(this);
      const length = self.length >>> 0;

      if (!length) {
        return -1;
      }
      let i = length - 1;
      if (arguments.length > 1) {
        i = Math.min(i, toInteger(arguments[1]));
      }
      i = i >= 0 ? i : length - Math.abs(i);
      for (; i >= 0; i--) {
        if (i in self && sought === self[i]) {
          return i;
        }
      }
      return -1;
    };
  }
  if (!Object.getPrototypeOf) {
    Object.getPrototypeOf = function getPrototypeOf(object) {
      return (
        object.__proto__ ||
        (object.constructor ? object.constructor.prototype : prototypeOfObject)
      );
    };
  }
  if (!Object.getOwnPropertyDescriptor) {
    const ERR_NON_OBJECT =
      "Object.getOwnPropertyDescriptor called on a " + "non-object: ";
    Object.getOwnPropertyDescriptor = function getOwnPropertyDescriptor(
      object,
      property
    ) {
      if (
        (typeof object !== "object" && typeof object !== "function") ||
        object === null
      )
        throw new TypeError(ERR_NON_OBJECT + object);
      if (!owns(object, property)) return;

      let descriptor;
      var getter;
      var setter;
      descriptor = { enumerable: true, configurable: true };
      if (supportsAccessors) {
        const prototype = object.__proto__;
        object.__proto__ = prototypeOfObject;

        var getter = lookupGetter(object, property);
        var setter = lookupSetter(object, property);
        object.__proto__ = prototype;

        if (getter || setter) {
          if (getter) descriptor.get = getter;
          if (setter) descriptor.set = setter;
          return descriptor;
        }
      }
      descriptor.value = object[property];
      return descriptor;
    };
  }
  if (!Object.getOwnPropertyNames) {
    Object.getOwnPropertyNames = function getOwnPropertyNames(object) {
      return Object.keys(object);
    };
  }
  if (!Object.create) {
    let createEmpty;
    if (Object.prototype.__proto__ === null) {
      createEmpty = function() {
        return { __proto__: null };
      };
    } else {
      createEmpty = function() {
        const empty = {};
        for (const i in empty) empty[i] = null;
        empty.constructor = empty.hasOwnProperty = empty.propertyIsEnumerable = empty.isPrototypeOf = empty.toLocaleString = empty.toString = empty.valueOf = empty.__proto__ = null;
        return empty;
      };
    }

    Object.create = function create(prototype, properties) {
      let object;
      if (prototype === null) {
        object = createEmpty();
      } else {
        if (typeof prototype !== "object")
          throw new TypeError(
            `typeof prototype[${typeof prototype}] != 'object'`
          );
        const Type = function() {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
      }
      if (properties !== void 0) Object.defineProperties(object, properties);
      return object;
    };
  }

  function doesDefinePropertyWork(object) {
    try {
      Object.defineProperty(object, "sentinel", {});
      return "sentinel" in object;
    } catch (exception) {}
  }
  if (Object.defineProperty) {
    const definePropertyWorksOnObject = doesDefinePropertyWork({});
    const definePropertyWorksOnDom =
      typeof document === "undefined" ||
      doesDefinePropertyWork(document.createElement("div"));
    if (!definePropertyWorksOnObject || !definePropertyWorksOnDom) {
      var definePropertyFallback = Object.defineProperty;
    }
  }

  if (!Object.defineProperty || definePropertyFallback) {
    const ERR_NON_OBJECT_DESCRIPTOR =
      "Property description must be an object: ";
    const ERR_NON_OBJECT_TARGET =
      "Object.defineProperty called on non-object: ";
    const ERR_ACCESSORS_NOT_SUPPORTED =
      "getters & setters can not be defined " + "on this javascript engine";

    Object.defineProperty = function defineProperty(
      object,
      property,
      descriptor
    ) {
      if (
        (typeof object !== "object" && typeof object !== "function") ||
        object === null
      )
        throw new TypeError(ERR_NON_OBJECT_TARGET + object);
      if (
        (typeof descriptor !== "object" && typeof descriptor !== "function") ||
        descriptor === null
      )
        throw new TypeError(ERR_NON_OBJECT_DESCRIPTOR + descriptor);
      if (definePropertyFallback) {
        try {
          return definePropertyFallback.call(
            Object,
            object,
            property,
            descriptor
          );
        } catch (exception) {}
      }
      if (owns(descriptor, "value")) {
        if (
          supportsAccessors &&
          (lookupGetter(object, property) || lookupSetter(object, property))
        ) {
          const prototype = object.__proto__;
          object.__proto__ = prototypeOfObject;
          delete object[property];
          object[property] = descriptor.value;
          object.__proto__ = prototype;
        } else {
          object[property] = descriptor.value;
        }
      } else {
        if (!supportsAccessors)
          throw new TypeError(ERR_ACCESSORS_NOT_SUPPORTED);
        if (owns(descriptor, "get"))
          defineGetter(object, property, descriptor.get);
        if (owns(descriptor, "set"))
          defineSetter(object, property, descriptor.set);
      }

      return object;
    };
  }
  if (!Object.defineProperties) {
    Object.defineProperties = function defineProperties(object, properties) {
      for (const property in properties) {
        if (owns(properties, property))
          Object.defineProperty(object, property, properties[property]);
      }
      return object;
    };
  }
  if (!Object.seal) {
    Object.seal = function seal(object) {
      return object;
    };
  }
  if (!Object.freeze) {
    Object.freeze = function freeze(object) {
      return object;
    };
  }
  try {
    Object.freeze(function() {});
  } catch (exception) {
    Object.freeze = (function freeze(freezeObject) {
      return function freeze(object) {
        if (typeof object === "function") {
          return object;
        }
        return freezeObject(object);
      };
    })(Object.freeze);
  }
  if (!Object.preventExtensions) {
    Object.preventExtensions = function preventExtensions(object) {
      return object;
    };
  }
  if (!Object.isSealed) {
    Object.isSealed = function isSealed(object) {
      return false;
    };
  }
  if (!Object.isFrozen) {
    Object.isFrozen = function isFrozen(object) {
      return false;
    };
  }
  if (!Object.isExtensible) {
    Object.isExtensible = function isExtensible(object) {
      if (Object(object) === object) {
        throw new TypeError(); // TODO message
      }
      let name = "";
      while (owns(object, name)) {
        name += "?";
      }
      object[name] = true;
      const returnValue = owns(object, name);
      delete object[name];
      return returnValue;
    };
  }
  if (!Object.keys) {
    let hasDontEnumBug = true;
    const dontEnums = [
      "toString",
      "toLocaleString",
      "valueOf",
      "hasOwnProperty",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "constructor"
    ];
    const dontEnumsLength = dontEnums.length;

    for (const key in { toString: null }) {
      hasDontEnumBug = false;
    }

    Object.keys = function keys(object) {
      if (
        (typeof object !== "object" && typeof object !== "function") ||
        object === null
      ) {
        throw new TypeError("Object.keys called on a non-object");
      }

      const keys = [];
      for (const name in object) {
        if (owns(object, name)) {
          keys.push(name);
        }
      }

      if (hasDontEnumBug) {
        for (let i = 0, ii = dontEnumsLength; i < ii; i++) {
          const dontEnum = dontEnums[i];
          if (owns(object, dontEnum)) {
            keys.push(dontEnum);
          }
        }
      }
      return keys;
    };
  }
  if (!Date.now) {
    Date.now = function now() {
      return new Date().getTime();
    };
  }
  let ws =
    "\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003" +
    "\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028" +
    "\u2029\uFEFF";
  if (!String.prototype.trim || ws.trim()) {
    ws = `[${ws}]`;
    const trimBeginRegexp = new RegExp(`^${ws}${ws}*`);
    const trimEndRegexp = new RegExp(`${ws + ws}*$`);
    String.prototype.trim = function trim() {
      return String(this)
        .replace(trimBeginRegexp, "")
        .replace(trimEndRegexp, "");
    };
  }

  function toInteger(n) {
    n = +n;
    if (n !== n) {
      // isNaN
      n = 0;
    } else if (n !== 0 && n !== 1 / 0 && n !== -(1 / 0)) {
      n = (n > 0 || -1) * Math.floor(Math.abs(n));
    }
    return n;
  }

  function isPrimitive(input) {
    const type = typeof input;
    return (
      input === null ||
      type === "undefined" ||
      type === "boolean" ||
      type === "number" ||
      type === "string"
    );
  }

  function toPrimitive(input) {
    let val;
    let valueOf;
    let toString;
    if (isPrimitive(input)) {
      return input;
    }
    valueOf = input.valueOf;
    if (typeof valueOf === "function") {
      val = valueOf.call(input);
      if (isPrimitive(val)) {
        return val;
      }
    }
    toString = input.toString;
    if (typeof toString === "function") {
      val = toString.call(input);
      if (isPrimitive(val)) {
        return val;
      }
    }
    throw new TypeError();
  }
  var toObject = function(o) {
    if (o == null) {
      // this matches both null and undefined
      throw new TypeError(`can't convert ${o} to object`);
    }
    return Object(o);
  };
});
define("ace/mode/jsonata_worker", [
  "require",
  "exports",
  "ace/lib/oop",
  "ace/worker/mirror"
], function(require, exports) {
  const oop = require("../lib/oop");
  const Mirror = require("../worker/mirror").Mirror;

  const JSONataWorker = (exports.JSONataWorker = function(sender) {
    Mirror.call(this, sender);
    this.setTimeout(200);
  });

  oop.inherits(JSONataWorker, Mirror);

  (function() {
    this.onUpdate = function() {
      const value = this.doc.getValue();
      const errors = [];
      try {
        if (value) {
          jsonata(value);
        }
      } catch (e) {
        const pos = this.doc.indexToPosition(e.position - 1);
        let msg = e.message;
        msg = msg.replace(/ at column \d+/, "");
        errors.push({
          row: pos.row,
          column: pos.column,
          text: msg,
          type: "error"
        });
      }
      this.sender.emit("annotate", errors);
    };
  }.call(JSONataWorker.prototype));
});

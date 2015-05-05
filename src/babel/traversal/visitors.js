import * as virtualTypes from "./path/virtual-types";
import * as messages from "../messages";
import * as t from "../types";

export function explode(visitor, mergeConflicts) {
  // make sure there's no __esModule type since this is because we're using loose mode
  // and it sets __esModule to be enumerable on all modules :(
  delete visitor.__esModule;

  // ensure visitors are objects
  for (let nodeType in visitor) {
    if (shouldIgnoreKey(nodeType)) continue;

    var fns = visitor[nodeType];

    if (typeof fns === "function") {
      visitor[nodeType] = { enter: fns };
    }
  }

  // add type wrappers
  for (let nodeType in visitor) {
    if (shouldIgnoreKey(nodeType)) continue;

    var wrapper = virtualTypes[nodeType];
    if (!wrapper) continue;

    // wrap all the functions
    var fns = visitor[nodeType];
    for (var type in fns) {
      fns[type] = wrapCheck(wrapper, fns[type]);
    }

    // clear it from the visitor
    delete visitor[nodeType];

    if (wrapper.type) {
      // merge the visitor if necessary or just put it back in
      if (visitor[wrapper.type]) {
        merge(visitor[wrapper.type], fns);
      } else {
        visitor[wrapper.type] = fns;
      }
    } else {
      merge(visitor, fns);
    }
  }

  // add aliases
  for (let nodeType in visitor) {
    if (shouldIgnoreKey(nodeType)) continue;

    var fns = visitor[nodeType];

    var aliases = t.FLIPPED_ALIAS_KEYS[nodeType];
    if (!aliases) continue;

    // clear it form the visitor
    delete visitor[nodeType];

    for (var alias of (aliases: Array)) {
      var existing = visitor[alias];
      if (existing) {
        if (mergeConflicts) {
          merge(fns, existing);
        }
      } else {
        visitor[alias] = fns;
      }
    }
  }

  return visitor;
}

export function verify(visitor) {
  if (visitor._verified) return;

  if (typeof visitor === "function") {
    throw new Error(messages.get("traverseVerifyRootFunction"));
  }

  if (!visitor.enter) visitor.enter = function () { };
  if (!visitor.exit) visitor.exit = function () { };
  if (!visitor.shouldSkip) visitor.shouldSkip = function () { return false; };

  for (var nodeType in visitor) {
    if (shouldIgnoreKey(nodeType)) continue;

    if (t.TYPES.indexOf(nodeType) < 0) {
      throw new Error(messages.get("traverseVerifyNodeType", nodeType));
    }

    var visitors = visitor[nodeType];

    if (typeof visitors === "function") {
      throw new Error(messages.get("traverseVerifyVisitorFunction", nodeType));
    } else if (typeof visitors === "object") {
      for (var visitorKey in visitors) {
        if (visitorKey === "enter" || visitorKey === "exit") continue;
        throw new Error(messages.get("traverseVerifyVisitorProperty", nodeType, visitorKey));
      }
    }
  }

  visitor._verified = true;
}

function wrapCheck(wrapper, fn) {
  return function () {
    if (wrapper.checkPath(this)) {
      return fn.apply(this, arguments);
    }
  };
}

function shouldIgnoreKey(key) {
  // internal/hidden key
  if (key[0] === "_") return true;

  // ignore function keys
  if (key === "enter" || key === "exit" || key === "shouldSkip") return true;

  // ignore other options
  if (key === "blacklist" || key === "noScope") return true;

  return false;
}

function merge(visitor1, visitor2) {
  for (var key in visitor1) {
    visitor2[key] = (visitor2[alias] || []).concat(visitor1[key]);
  }
}

(function(swiftSet) { 
'use strict';
function version() { return 'swiftSet v0.10.1 MIT License © 2014 James Abney http://github.com/jabney/swiftSet'; }

// ---------------------------------------------------------------
// swiftSet.js - Store unique items and perform fast set operations.
// (union, intersection, difference, complement)
// 
// http://github.com/jabney/swiftSet
// ---------------------------------------------------------------
//
// ---------------------------------------------------------------
// Set - produces a set of unique items that can be queried for its
// properties. It supports five common set operations (union,
// intersection, difference, complement, equals) as well as some
// useful utility methods. The set operations are quite fast, as are
// set creation and querying. 
//
// Example usage: 
//
// var set = new Set([1, 1, 2, 3, 3, 3]); // (1, 2, 3)
// set.has(2); // => true
// set.size(); // => 3
// set.add(4, 5); // (1, 2, 3, 4, 5)
// set.remove(3, 4) // (1, 2, 5)
// 
// Set Operations Example:
// 
// var set = new Set([1, 1, 2, 3, 3, 3]); // (1, 2, 3)
// set.intersection([2, 2, 3, 3, 4]); // => [2, 3]
// 
// Arrays of objects can also be processed as sets, but they must
// have a way to return a unique value. One option is to add a
// toString method to your objects which returns some unique id; this
// gets converted into a key implicitly when the object is added to
// the set. Alternately a global key-retrieving function can be
// passed to the constructor.
//
// Examples:
//
// var toStr = function() { return this.id; },
// t1 = {id: 1, toString: toStr}, t2 = {id:2, toString: toStr},
// set = new Set([t1, t2]); // (t1, t2) 
//
// set.items(); // => [t1, t2]
// 
// var o1 = {id: 1}, o2 = {id: 2}, o3 = {id: 3},
// hashFn = function() { return this.id; },
// set = new Set([o1, o2, o3], hashFn); // (o1, o2, o3)
//
// set.items(); // => [o1, o2, o3]
//
// ---------------------------------------------------------------

function Set(a, hashFn) {
  var mutable = false;

  // Create the set's backing object.
  this.hist = Object.create(null);

  // Return either the identity function, or the 
  // given hash function passed to the constructor.
  this.uid = (function() {
    return typeof hashFn === 'undefined' ?
      // The identity function.
      function() {
        return this;
      } :
      // User-specified global key retriever.
      function() {
        return hashFn.call(this);
      };
  })();

  // Initialize with array if supplied in constructor.
  a && this.add.apply(this, a);

  // Process set operations. Calls into Set.process.
  this.process = function(b, evaluator) {
    var b = (b instanceof Set) ? b.items() : b, result;
    hashFn && Set.pushUid(hashFn);
    result = Set.process(this.items(), b, evaluator);
    hashFn && Set.popUid();
    mutable && typeOf(result) === 'Array' && this.clear(result);
    return result;
  }

  // Create a clone of this set.
  this.clone = function() {
    return new Set(this.items(), hashFn);
  };

  // Make this set mutable.
  this.mutable = function() {
    mutable = true;
    return this;
  };
}

// Helpers
Set.wrapObj = wrapObj;
Set.isWrapped = isWrapped;

Set.prototype = {

  // Add one or more items to the set. add('a', 'b', 'c')
  add: function() {
    slice.call(arguments, 0).forEach(function(arg) {
      var key = this.uid.call(arg), entry = this.hist[key];
      if (!entry) {
        entry = Object.create(null);
        entry.item = arg;
        entry.freq = 1;
        this.hist[key] = entry;
      }
    }, this);
    return this;
  },

  // Remove one or more items from the set. remove('b', 'c')
  remove: function() {
    slice.call(arguments, 0).forEach(function(arg) {
      var key = this.uid.call(arg);
      if (this.hist[key]) {
        delete this.hist[key];
      }
    }, this);
    return this;
  },

  // Add multiple item to the histogram via an array of item.
  addItems: function(a) {
    this.add.apply(this, a);
    return this;
  },

  // Remove multiple items from the histogram via an array of items.
  removeItems: function(a) {
    this.remove.apply(this, a);
    return this;
  },

  // Clear items from this set. Optionally initialize
  // with an array of items.
  clear: function(a) {
    this.hist = Object.create(null);
    a && this.addItems(a);
    return this;
  },

  // Iterate over items in the set. Return true to exit early.
  each: function(action, context) {
    for (var key in this.hist) {
      if (action.call(
        context, this.hist[key].item
     )) break;
    }
    return this;
  },

  // Map items in this set to another array of the same length.
  map: function(action, context) {
    var map = [];
    this.each(function(item) {
      map.push(action.call(this, item));
    }, context);
    return map;
  },

  // Return the items in this set.
  items: function() {
    return this.map(function(item) {
      return item;
    });
  },

  // Encodes key/type pairs for each element in the set.
  keyify: function() {
    var keys = [], typeCode;
    this.each(function(item) {
      var key = this.uid.call(item);
      keys.push(key + ':' + encodeObjType(item) + ',');
    }, this);
    return '{' + keys.sort().join('').slice(0, -1) + '}';
  },

  // An array of unwrapped items.
  unwrap: function() {
    return this.map(function(item) {
      return isWrapped(item) ? item.item : item;
    }, this);
  },

  // Conversion of this set to a representative string.
  toString: function() {
    return this.keyify();
  },

  // The number of unique elements in the set.
  size: function() {
    return this.items().length;
  },

  // Determines if an item is present in the set.
  has: function(item) {
    var key = this.uid.call(item),
    item = this.hist[key] && this.hist[key].item;
    return item && true || false;
  },

  // ---------------------------------------------------------------
  // Set operations - these operatons make use of sets 'a' (the set based
  // on the array given in the constructor) and 'b', based on the
  // array passed to the set operation method below.
  // ---------------------------------------------------------------

  // The set of items from each set (a or b).
  union: function(b) {
    return this.process(b, function(freq) {
      return true;
    });
  },

  // The set of items that are common to both sets (a and b).
  intersection: function(b) {
    return this.process(b, function(freq) {
      return freq === 3;
    });
  },

  // Symmetric difference. The set of items from both sets
  // that are unique to each set (union minus intersection).
  // Note that for disjoint sets, this is the same as the 
  // union of 'a' and 'b'.
  difference: function(b) {
    return this.process(b, function(freq) {
      return freq < 3;
    });
  },

  // Relative complement. The set of items from 'a' except where
  // the item is also in 'b' (a minus b).
  complement: function(b) {
    return this.process(b, function(freq) {
      return freq == 1;
    });
  },

  // Returns true if given set is equivalent to this set. 
  equals: function(b) {
    var h = this.process(b), k,
    max = 0, min = Infinity;
    for (k in h) {
      max = Math.max(max, h[k].freq);
      min = Math.min(min, h[k].freq);
    }
    return min === 3 && max === 3;
  },

  constructor: Set
};

// ---------------------------------------------------------------
// Faster Set Operations - these are set operations that are 
// perfromed on two given arrays. They are class methods,
// can be called directly and do not requre a Set object to be 
// specifically constructed, and are generally faster than their
// Set.prototye equivalents.
//
// Example usage: Set.intersection([1, 2, 3], [2, 3, 4]) => [2, 3]
//
// Arrays of objects can be used as well, but each object must
// have a toString() method which returns a unique value, or the
// objects must be wrapped. 
// 
// See the documentation for more information.
// http://github.com/jabney/swiftSet
// ---------------------------------------------------------------
(function() {
  var uidList = [], uid;

  // Create and push the uid identity method.
  uidList.push(uid = function() {
    return this;
  });

  // Push a new uid method onto the stack. Call this and
  // supply a unique key generator for sets of objects.
  Set.pushUid = function(method) {
    uidList.push(method);
    uid = method;
    return method;
  };

  // Pop the previously pushed uid method off the stack and
  // assign top of stack to uid. Return the 
  Set.popUid = function() {
    var prev;
    uidList.length > 1 && (prev = uidList.pop());
    uid = uidList[uidList.length-1];
    return prev || null;
  };

  // Processes a histogram consructed from two arrays, 'a' and 'b'.
  // This function is used generically by the below set operation 
  // methods, a.k.a, 'evaluators', to return some subset of
  // a set union, based on frequencies in the histogram. 
  Set.process = function(a, b, evaluator) {
    var hist = Object.create(null), out = [], ukey, k;
    a.forEach(function(item) {
      ukey = uid.call(item);
      if(!hist[ukey]) {
        hist[ukey] = { item: item, freq: 1 };
      }
    });
    // Merge b into the histogram.
    b.forEach(function(item) {
      ukey = uid.call(item);
      if (hist[ukey]) {
        if (hist[ukey].freq === 1)
          hist[ukey].freq = 3;
      } else {
        hist[ukey] = { item: item, freq: 2 };
      }
    });
    // Call the given evaluator.
    if (evaluator) {
      for (k in hist) {
        if (evaluator(hist[k].freq)) out.push(hist[k].item);
      }
      return out;
    } else {
      return hist;
    }
  };

  // Join two sets together.
  // Set.union([1, 2, 2], [2, 3]) => [1, 2, 3]
  Set.union = function(a, b) {
    return Set.process(a, b, function(freq) {
      return true;
    });
  };

  // Return items common to both sets. 
  // Set.intersection([1, 1, 2], [2, 2, 3]) => [2]
  Set.intersection = function(a, b) {
    return Set.process(a, b, function(freq) {
      return freq === 3;
    });
  };

  // Symmetric difference. Items from either set that
  // are not in both sets.
  // Set.difference([1, 1, 2], [2, 3, 3]) => [1, 3]
  Set.difference = function(a, b) {
    return Set.process(a, b, function(freq) {
      return freq < 3;
    });
  };

  // Relative complement. Items from 'a' which are
  // not also in 'b'.
  // Set.complement([1, 2, 2], [2, 2, 3]) => [3]
  Set.complement = function(a, b) {
    return Set.process(a, b, function(freq) {
      return freq === 1;
    });
  };

  // Returns true if both sets are equivalent, false otherwise.
  // Set.equals([1, 1, 2], [1, 2, 2]) => true
  // Set.equals([1, 1, 2], [1, 2, 3]) => false
  Set.equals = function(a, b) {
    var max = 0, min = Infinity, key,
      hist = Set.process(a, b);
    for (var key in hist) {
      max = Math.max(max, hist[key].freq);
      min = Math.min(min, hist[key].freq);
    }
    return min === 3 && max === 3;
  };
})();

var
// Shortcuts
slice = Array.prototype.slice,

// Return the type of built-in objects via toString.
typeOf = (function() {
  var reType = /\[object (\w+)\]/; 
  return function(obj) {
    return reType.exec(toString.call(obj))[1];
  };
})(),

// Encode object type for key generation.
encodeObjType = (function() {

  var toString = Object.prototype.toString,

  // A list of built-in types.
  types = ['Null','Undefined','Array','Boolean','Number','String','Object',
    'Function','Date','Error','RegExp','Arguments','Math','JSON'],

  // Build dictionary for converting type strings to unique codes.
  codes = Object.create(null);
  types.forEach(function(type, index) {
    codes[type] = index;
  });

  // Encode an object's type as a unique number. If the type code
  // is not defined, return the type name.
  return function encodeObjType(obj) {
    var type = typeOf(obj),
    code = codes[type];
    return code === undefined ? type : code;
  }

})();

// Wrap a built-in type and give it a unique key generator.
function Wrapper(obj, toStr) {
  this.item = obj;
  this.toString = toStr ? toStr : function() {
    return '(' + obj + ':' + encodeObjType(obj) + ')';
  };
}

// Wrap an object so that it kas a key according to its type and value.
// Use: var wrap = wrapObj(); wrap(1); => {item: 1, toString: function(){...}}
function wrapObj(toStr) {
  return function(obj) {
    return new Wrapper(obj, toStr);
  }
}

// Returns true if obj is an instance of Wrapper, false otherwise.
function isWrapped(obj) {
  return obj instanceof Wrapper;
}

// Export
swiftSet.Set = Set;
})(window.swiftSet = window.swiftSet || {});


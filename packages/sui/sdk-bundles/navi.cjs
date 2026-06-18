var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../node_modules/.pnpm/lodash.camelcase@4.3.0/node_modules/lodash.camelcase/index.js
var require_lodash = __commonJS({
  "../../node_modules/.pnpm/lodash.camelcase@4.3.0/node_modules/lodash.camelcase/index.js"(exports2, module2) {
    var INFINITY = 1 / 0;
    var symbolTag = "[object Symbol]";
    var reAsciiWord = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g;
    var reLatin = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g;
    var rsAstralRange = "\\ud800-\\udfff";
    var rsComboMarksRange = "\\u0300-\\u036f\\ufe20-\\ufe23";
    var rsComboSymbolsRange = "\\u20d0-\\u20f0";
    var rsDingbatRange = "\\u2700-\\u27bf";
    var rsLowerRange = "a-z\\xdf-\\xf6\\xf8-\\xff";
    var rsMathOpRange = "\\xac\\xb1\\xd7\\xf7";
    var rsNonCharRange = "\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf";
    var rsPunctuationRange = "\\u2000-\\u206f";
    var rsSpaceRange = " \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000";
    var rsUpperRange = "A-Z\\xc0-\\xd6\\xd8-\\xde";
    var rsVarRange = "\\ufe0e\\ufe0f";
    var rsBreakRange = rsMathOpRange + rsNonCharRange + rsPunctuationRange + rsSpaceRange;
    var rsApos = "['\u2019]";
    var rsAstral = "[" + rsAstralRange + "]";
    var rsBreak = "[" + rsBreakRange + "]";
    var rsCombo = "[" + rsComboMarksRange + rsComboSymbolsRange + "]";
    var rsDigits = "\\d+";
    var rsDingbat = "[" + rsDingbatRange + "]";
    var rsLower = "[" + rsLowerRange + "]";
    var rsMisc = "[^" + rsAstralRange + rsBreakRange + rsDigits + rsDingbatRange + rsLowerRange + rsUpperRange + "]";
    var rsFitz = "\\ud83c[\\udffb-\\udfff]";
    var rsModifier = "(?:" + rsCombo + "|" + rsFitz + ")";
    var rsNonAstral = "[^" + rsAstralRange + "]";
    var rsRegional = "(?:\\ud83c[\\udde6-\\uddff]){2}";
    var rsSurrPair = "[\\ud800-\\udbff][\\udc00-\\udfff]";
    var rsUpper = "[" + rsUpperRange + "]";
    var rsZWJ = "\\u200d";
    var rsLowerMisc = "(?:" + rsLower + "|" + rsMisc + ")";
    var rsUpperMisc = "(?:" + rsUpper + "|" + rsMisc + ")";
    var rsOptLowerContr = "(?:" + rsApos + "(?:d|ll|m|re|s|t|ve))?";
    var rsOptUpperContr = "(?:" + rsApos + "(?:D|LL|M|RE|S|T|VE))?";
    var reOptMod = rsModifier + "?";
    var rsOptVar = "[" + rsVarRange + "]?";
    var rsOptJoin = "(?:" + rsZWJ + "(?:" + [rsNonAstral, rsRegional, rsSurrPair].join("|") + ")" + rsOptVar + reOptMod + ")*";
    var rsSeq = rsOptVar + reOptMod + rsOptJoin;
    var rsEmoji = "(?:" + [rsDingbat, rsRegional, rsSurrPair].join("|") + ")" + rsSeq;
    var rsSymbol = "(?:" + [rsNonAstral + rsCombo + "?", rsCombo, rsRegional, rsSurrPair, rsAstral].join("|") + ")";
    var reApos = RegExp(rsApos, "g");
    var reComboMark = RegExp(rsCombo, "g");
    var reUnicode = RegExp(rsFitz + "(?=" + rsFitz + ")|" + rsSymbol + rsSeq, "g");
    var reUnicodeWord = RegExp([
      rsUpper + "?" + rsLower + "+" + rsOptLowerContr + "(?=" + [rsBreak, rsUpper, "$"].join("|") + ")",
      rsUpperMisc + "+" + rsOptUpperContr + "(?=" + [rsBreak, rsUpper + rsLowerMisc, "$"].join("|") + ")",
      rsUpper + "?" + rsLowerMisc + "+" + rsOptLowerContr,
      rsUpper + "+" + rsOptUpperContr,
      rsDigits,
      rsEmoji
    ].join("|"), "g");
    var reHasUnicode = RegExp("[" + rsZWJ + rsAstralRange + rsComboMarksRange + rsComboSymbolsRange + rsVarRange + "]");
    var reHasUnicodeWord = /[a-z][A-Z]|[A-Z]{2,}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/;
    var deburredLetters = {
      // Latin-1 Supplement block.
      "\xC0": "A",
      "\xC1": "A",
      "\xC2": "A",
      "\xC3": "A",
      "\xC4": "A",
      "\xC5": "A",
      "\xE0": "a",
      "\xE1": "a",
      "\xE2": "a",
      "\xE3": "a",
      "\xE4": "a",
      "\xE5": "a",
      "\xC7": "C",
      "\xE7": "c",
      "\xD0": "D",
      "\xF0": "d",
      "\xC8": "E",
      "\xC9": "E",
      "\xCA": "E",
      "\xCB": "E",
      "\xE8": "e",
      "\xE9": "e",
      "\xEA": "e",
      "\xEB": "e",
      "\xCC": "I",
      "\xCD": "I",
      "\xCE": "I",
      "\xCF": "I",
      "\xEC": "i",
      "\xED": "i",
      "\xEE": "i",
      "\xEF": "i",
      "\xD1": "N",
      "\xF1": "n",
      "\xD2": "O",
      "\xD3": "O",
      "\xD4": "O",
      "\xD5": "O",
      "\xD6": "O",
      "\xD8": "O",
      "\xF2": "o",
      "\xF3": "o",
      "\xF4": "o",
      "\xF5": "o",
      "\xF6": "o",
      "\xF8": "o",
      "\xD9": "U",
      "\xDA": "U",
      "\xDB": "U",
      "\xDC": "U",
      "\xF9": "u",
      "\xFA": "u",
      "\xFB": "u",
      "\xFC": "u",
      "\xDD": "Y",
      "\xFD": "y",
      "\xFF": "y",
      "\xC6": "Ae",
      "\xE6": "ae",
      "\xDE": "Th",
      "\xFE": "th",
      "\xDF": "ss",
      // Latin Extended-A block.
      "\u0100": "A",
      "\u0102": "A",
      "\u0104": "A",
      "\u0101": "a",
      "\u0103": "a",
      "\u0105": "a",
      "\u0106": "C",
      "\u0108": "C",
      "\u010A": "C",
      "\u010C": "C",
      "\u0107": "c",
      "\u0109": "c",
      "\u010B": "c",
      "\u010D": "c",
      "\u010E": "D",
      "\u0110": "D",
      "\u010F": "d",
      "\u0111": "d",
      "\u0112": "E",
      "\u0114": "E",
      "\u0116": "E",
      "\u0118": "E",
      "\u011A": "E",
      "\u0113": "e",
      "\u0115": "e",
      "\u0117": "e",
      "\u0119": "e",
      "\u011B": "e",
      "\u011C": "G",
      "\u011E": "G",
      "\u0120": "G",
      "\u0122": "G",
      "\u011D": "g",
      "\u011F": "g",
      "\u0121": "g",
      "\u0123": "g",
      "\u0124": "H",
      "\u0126": "H",
      "\u0125": "h",
      "\u0127": "h",
      "\u0128": "I",
      "\u012A": "I",
      "\u012C": "I",
      "\u012E": "I",
      "\u0130": "I",
      "\u0129": "i",
      "\u012B": "i",
      "\u012D": "i",
      "\u012F": "i",
      "\u0131": "i",
      "\u0134": "J",
      "\u0135": "j",
      "\u0136": "K",
      "\u0137": "k",
      "\u0138": "k",
      "\u0139": "L",
      "\u013B": "L",
      "\u013D": "L",
      "\u013F": "L",
      "\u0141": "L",
      "\u013A": "l",
      "\u013C": "l",
      "\u013E": "l",
      "\u0140": "l",
      "\u0142": "l",
      "\u0143": "N",
      "\u0145": "N",
      "\u0147": "N",
      "\u014A": "N",
      "\u0144": "n",
      "\u0146": "n",
      "\u0148": "n",
      "\u014B": "n",
      "\u014C": "O",
      "\u014E": "O",
      "\u0150": "O",
      "\u014D": "o",
      "\u014F": "o",
      "\u0151": "o",
      "\u0154": "R",
      "\u0156": "R",
      "\u0158": "R",
      "\u0155": "r",
      "\u0157": "r",
      "\u0159": "r",
      "\u015A": "S",
      "\u015C": "S",
      "\u015E": "S",
      "\u0160": "S",
      "\u015B": "s",
      "\u015D": "s",
      "\u015F": "s",
      "\u0161": "s",
      "\u0162": "T",
      "\u0164": "T",
      "\u0166": "T",
      "\u0163": "t",
      "\u0165": "t",
      "\u0167": "t",
      "\u0168": "U",
      "\u016A": "U",
      "\u016C": "U",
      "\u016E": "U",
      "\u0170": "U",
      "\u0172": "U",
      "\u0169": "u",
      "\u016B": "u",
      "\u016D": "u",
      "\u016F": "u",
      "\u0171": "u",
      "\u0173": "u",
      "\u0174": "W",
      "\u0175": "w",
      "\u0176": "Y",
      "\u0177": "y",
      "\u0178": "Y",
      "\u0179": "Z",
      "\u017B": "Z",
      "\u017D": "Z",
      "\u017A": "z",
      "\u017C": "z",
      "\u017E": "z",
      "\u0132": "IJ",
      "\u0133": "ij",
      "\u0152": "Oe",
      "\u0153": "oe",
      "\u0149": "'n",
      "\u017F": "ss"
    };
    var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    function arrayReduce(array, iteratee, accumulator, initAccum) {
      var index = -1, length = array ? array.length : 0;
      if (initAccum && length) {
        accumulator = array[++index];
      }
      while (++index < length) {
        accumulator = iteratee(accumulator, array[index], index, array);
      }
      return accumulator;
    }
    function asciiToArray(string) {
      return string.split("");
    }
    function asciiWords(string) {
      return string.match(reAsciiWord) || [];
    }
    function basePropertyOf(object) {
      return function(key) {
        return object == null ? void 0 : object[key];
      };
    }
    var deburrLetter = basePropertyOf(deburredLetters);
    function hasUnicode(string) {
      return reHasUnicode.test(string);
    }
    function hasUnicodeWord(string) {
      return reHasUnicodeWord.test(string);
    }
    function stringToArray(string) {
      return hasUnicode(string) ? unicodeToArray(string) : asciiToArray(string);
    }
    function unicodeToArray(string) {
      return string.match(reUnicode) || [];
    }
    function unicodeWords(string) {
      return string.match(reUnicodeWord) || [];
    }
    var objectProto = Object.prototype;
    var objectToString = objectProto.toString;
    var Symbol2 = root.Symbol;
    var symbolProto = Symbol2 ? Symbol2.prototype : void 0;
    var symbolToString = symbolProto ? symbolProto.toString : void 0;
    function baseSlice(array, start, end) {
      var index = -1, length = array.length;
      if (start < 0) {
        start = -start > length ? 0 : length + start;
      }
      end = end > length ? length : end;
      if (end < 0) {
        end += length;
      }
      length = start > end ? 0 : end - start >>> 0;
      start >>>= 0;
      var result = Array(length);
      while (++index < length) {
        result[index] = array[index + start];
      }
      return result;
    }
    function baseToString(value) {
      if (typeof value == "string") {
        return value;
      }
      if (isSymbol(value)) {
        return symbolToString ? symbolToString.call(value) : "";
      }
      var result = value + "";
      return result == "0" && 1 / value == -INFINITY ? "-0" : result;
    }
    function castSlice(array, start, end) {
      var length = array.length;
      end = end === void 0 ? length : end;
      return !start && end >= length ? array : baseSlice(array, start, end);
    }
    function createCaseFirst(methodName) {
      return function(string) {
        string = toString(string);
        var strSymbols = hasUnicode(string) ? stringToArray(string) : void 0;
        var chr = strSymbols ? strSymbols[0] : string.charAt(0);
        var trailing = strSymbols ? castSlice(strSymbols, 1).join("") : string.slice(1);
        return chr[methodName]() + trailing;
      };
    }
    function createCompounder(callback) {
      return function(string) {
        return arrayReduce(words(deburr(string).replace(reApos, "")), callback, "");
      };
    }
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
    }
    function toString(value) {
      return value == null ? "" : baseToString(value);
    }
    var camelCase = createCompounder(function(result, word, index) {
      word = word.toLowerCase();
      return result + (index ? capitalize(word) : word);
    });
    function capitalize(string) {
      return upperFirst(toString(string).toLowerCase());
    }
    function deburr(string) {
      string = toString(string);
      return string && string.replace(reLatin, deburrLetter).replace(reComboMark, "");
    }
    var upperFirst = createCaseFirst("toUpperCase");
    function words(string, pattern, guard) {
      string = toString(string);
      pattern = guard ? void 0 : pattern;
      if (pattern === void 0) {
        return hasUnicodeWord(string) ? unicodeWords(string) : asciiWords(string);
      }
      return string.match(pattern) || [];
    }
    module2.exports = camelCase;
  }
});

// ../../node_modules/.pnpm/@naviprotocol+lending@2.0.0-beta.0_@mysten+sui@2.18.0_typescript@5.9.3_/node_modules/@naviprotocol/lending/dist/index.esm.js
var index_esm_exports = {};
__export(index_esm_exports, {
  Address: () => Z,
  DEFAULT_CACHE_TIME: () => b,
  DEFAULT_MARKET_IDENTITY: () => O,
  FlashLoanAssetConfig: () => rt,
  IncentiveAPYInfo: () => et,
  IncentivePoolInfo: () => we,
  IncentivePoolInfoByPhase: () => tt,
  MARKETS: () => U,
  Market: () => Ue,
  OracleInfo: () => ot,
  PoolOperator: () => N,
  ReserveDataInfo: () => ve,
  SuiPriceServiceConnection: () => te,
  SuiPythClient: () => $e,
  UserPositions: () => D,
  UserStateInfo: () => be,
  borrowCoinPTB: () => ct,
  claimLendingRewardsPTB: () => St,
  createAccountCapPTB: () => De,
  createEModeCapPTB: () => dt,
  createNaviSuiClient: () => Ce,
  depositCoinPTB: () => Ee,
  emodeIdentityId: () => mt,
  enterEModePTB: () => Ne,
  exitEModePTB: () => pt,
  filterPriceFeeds: () => Ge,
  flashloanPTB: () => It,
  getAccountCapOwnerPTB: () => Fe,
  getAllFlashLoanAssets: () => Y,
  getBorrowFee: () => lt,
  getCoins: () => vt,
  getConfig: () => _,
  getFees: () => at,
  getFlashLoanAsset: () => jt,
  getHealthFactor: () => gt,
  getHealthFactorPTB: () => Re,
  getLendingPositions: () => qe,
  getLendingState: () => yt,
  getMarket: () => ut,
  getMarketConfig: () => C,
  getMarkets: () => Oe,
  getPool: () => $,
  getPools: () => R,
  getPriceFeeds: () => se,
  getPythStalePriceFeedId: () => kt,
  getPythStalePriceFeedIdV2: () => He,
  getSimulatedHealthFactor: () => ht,
  getSimulatedHealthFactorPTB: () => ae,
  getStats: () => nt,
  getTransactions: () => wt,
  getUserAvailableLendingRewards: () => Pt,
  getUserClaimedRewardHistory: () => $t,
  getUserEModeCaps: () => ne,
  getUserTotalClaimedReward: () => At,
  liquidatePTB: () => Tt,
  mergeCoinsPTB: () => ft,
  normalizeCoinType: () => k,
  parsePoolUID: () => Me,
  parseTxValue: () => g,
  repayCoinPTB: () => st,
  repayFlashLoanPTB: () => Ct,
  summaryLendingRewards: () => Bt,
  updateOraclePriceBeforeUserOperationPTB: () => _t,
  updateOraclePricesPTB: () => ze,
  updatePythPriceFeeds: () => We,
  verifyHealthFactorPTB: () => bt,
  withCache: () => S,
  withSingleton: () => A,
  withdrawCoinPTB: () => it
});
module.exports = __toCommonJS(index_esm_exports);
var import_transactions = require("@mysten/sui/transactions");
var import_bcs = require("@mysten/sui/bcs");
var import_utils = require("@mysten/sui/utils");
var import_lodash = __toESM(require_lodash(), 1);

// ../../node_modules/.pnpm/bignumber.js@9.1.2/node_modules/bignumber.js/bignumber.mjs
var isNumeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
var mathceil = Math.ceil;
var mathfloor = Math.floor;
var bignumberError = "[BigNumber Error] ";
var tooManyDigits = bignumberError + "Number primitive has more than 15 significant digits: ";
var BASE = 1e14;
var LOG_BASE = 14;
var MAX_SAFE_INTEGER = 9007199254740991;
var POWS_TEN = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13];
var SQRT_BASE = 1e7;
var MAX = 1e9;
function clone(configObject) {
  var div, convertBase, parseNumeric, P = BigNumber2.prototype = { constructor: BigNumber2, toString: null, valueOf: null }, ONE = new BigNumber2(1), DECIMAL_PLACES = 20, ROUNDING_MODE = 4, TO_EXP_NEG = -7, TO_EXP_POS = 21, MIN_EXP = -1e7, MAX_EXP = 1e7, CRYPTO = false, MODULO_MODE = 1, POW_PRECISION = 0, FORMAT = {
    prefix: "",
    groupSize: 3,
    secondaryGroupSize: 0,
    groupSeparator: ",",
    decimalSeparator: ".",
    fractionGroupSize: 0,
    fractionGroupSeparator: "\xA0",
    // non-breaking space
    suffix: ""
  }, ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz", alphabetHasNormalDecimalDigits = true;
  function BigNumber2(v, b2) {
    var alphabet, c, caseChanged, e, i, isNum, len, str, x2 = this;
    if (!(x2 instanceof BigNumber2)) return new BigNumber2(v, b2);
    if (b2 == null) {
      if (v && v._isBigNumber === true) {
        x2.s = v.s;
        if (!v.c || v.e > MAX_EXP) {
          x2.c = x2.e = null;
        } else if (v.e < MIN_EXP) {
          x2.c = [x2.e = 0];
        } else {
          x2.e = v.e;
          x2.c = v.c.slice();
        }
        return;
      }
      if ((isNum = typeof v == "number") && v * 0 == 0) {
        x2.s = 1 / v < 0 ? (v = -v, -1) : 1;
        if (v === ~~v) {
          for (e = 0, i = v; i >= 10; i /= 10, e++) ;
          if (e > MAX_EXP) {
            x2.c = x2.e = null;
          } else {
            x2.e = e;
            x2.c = [v];
          }
          return;
        }
        str = String(v);
      } else {
        if (!isNumeric.test(str = String(v))) return parseNumeric(x2, str, isNum);
        x2.s = str.charCodeAt(0) == 45 ? (str = str.slice(1), -1) : 1;
      }
      if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
      if ((i = str.search(/e/i)) > 0) {
        if (e < 0) e = i;
        e += +str.slice(i + 1);
        str = str.substring(0, i);
      } else if (e < 0) {
        e = str.length;
      }
    } else {
      intCheck(b2, 2, ALPHABET.length, "Base");
      if (b2 == 10 && alphabetHasNormalDecimalDigits) {
        x2 = new BigNumber2(v);
        return round(x2, DECIMAL_PLACES + x2.e + 1, ROUNDING_MODE);
      }
      str = String(v);
      if (isNum = typeof v == "number") {
        if (v * 0 != 0) return parseNumeric(x2, str, isNum, b2);
        x2.s = 1 / v < 0 ? (str = str.slice(1), -1) : 1;
        if (BigNumber2.DEBUG && str.replace(/^0\.0*|\./, "").length > 15) {
          throw Error(tooManyDigits + v);
        }
      } else {
        x2.s = str.charCodeAt(0) === 45 ? (str = str.slice(1), -1) : 1;
      }
      alphabet = ALPHABET.slice(0, b2);
      e = i = 0;
      for (len = str.length; i < len; i++) {
        if (alphabet.indexOf(c = str.charAt(i)) < 0) {
          if (c == ".") {
            if (i > e) {
              e = len;
              continue;
            }
          } else if (!caseChanged) {
            if (str == str.toUpperCase() && (str = str.toLowerCase()) || str == str.toLowerCase() && (str = str.toUpperCase())) {
              caseChanged = true;
              i = -1;
              e = 0;
              continue;
            }
          }
          return parseNumeric(x2, String(v), isNum, b2);
        }
      }
      isNum = false;
      str = convertBase(str, b2, 10, x2.s);
      if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
      else e = str.length;
    }
    for (i = 0; str.charCodeAt(i) === 48; i++) ;
    for (len = str.length; str.charCodeAt(--len) === 48; ) ;
    if (str = str.slice(i, ++len)) {
      len -= i;
      if (isNum && BigNumber2.DEBUG && len > 15 && (v > MAX_SAFE_INTEGER || v !== mathfloor(v))) {
        throw Error(tooManyDigits + x2.s * v);
      }
      if ((e = e - i - 1) > MAX_EXP) {
        x2.c = x2.e = null;
      } else if (e < MIN_EXP) {
        x2.c = [x2.e = 0];
      } else {
        x2.e = e;
        x2.c = [];
        i = (e + 1) % LOG_BASE;
        if (e < 0) i += LOG_BASE;
        if (i < len) {
          if (i) x2.c.push(+str.slice(0, i));
          for (len -= LOG_BASE; i < len; ) {
            x2.c.push(+str.slice(i, i += LOG_BASE));
          }
          i = LOG_BASE - (str = str.slice(i)).length;
        } else {
          i -= len;
        }
        for (; i--; str += "0") ;
        x2.c.push(+str);
      }
    } else {
      x2.c = [x2.e = 0];
    }
  }
  BigNumber2.clone = clone;
  BigNumber2.ROUND_UP = 0;
  BigNumber2.ROUND_DOWN = 1;
  BigNumber2.ROUND_CEIL = 2;
  BigNumber2.ROUND_FLOOR = 3;
  BigNumber2.ROUND_HALF_UP = 4;
  BigNumber2.ROUND_HALF_DOWN = 5;
  BigNumber2.ROUND_HALF_EVEN = 6;
  BigNumber2.ROUND_HALF_CEIL = 7;
  BigNumber2.ROUND_HALF_FLOOR = 8;
  BigNumber2.EUCLID = 9;
  BigNumber2.config = BigNumber2.set = function(obj) {
    var p, v;
    if (obj != null) {
      if (typeof obj == "object") {
        if (obj.hasOwnProperty(p = "DECIMAL_PLACES")) {
          v = obj[p];
          intCheck(v, 0, MAX, p);
          DECIMAL_PLACES = v;
        }
        if (obj.hasOwnProperty(p = "ROUNDING_MODE")) {
          v = obj[p];
          intCheck(v, 0, 8, p);
          ROUNDING_MODE = v;
        }
        if (obj.hasOwnProperty(p = "EXPONENTIAL_AT")) {
          v = obj[p];
          if (v && v.pop) {
            intCheck(v[0], -MAX, 0, p);
            intCheck(v[1], 0, MAX, p);
            TO_EXP_NEG = v[0];
            TO_EXP_POS = v[1];
          } else {
            intCheck(v, -MAX, MAX, p);
            TO_EXP_NEG = -(TO_EXP_POS = v < 0 ? -v : v);
          }
        }
        if (obj.hasOwnProperty(p = "RANGE")) {
          v = obj[p];
          if (v && v.pop) {
            intCheck(v[0], -MAX, -1, p);
            intCheck(v[1], 1, MAX, p);
            MIN_EXP = v[0];
            MAX_EXP = v[1];
          } else {
            intCheck(v, -MAX, MAX, p);
            if (v) {
              MIN_EXP = -(MAX_EXP = v < 0 ? -v : v);
            } else {
              throw Error(bignumberError + p + " cannot be zero: " + v);
            }
          }
        }
        if (obj.hasOwnProperty(p = "CRYPTO")) {
          v = obj[p];
          if (v === !!v) {
            if (v) {
              if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
                CRYPTO = v;
              } else {
                CRYPTO = !v;
                throw Error(bignumberError + "crypto unavailable");
              }
            } else {
              CRYPTO = v;
            }
          } else {
            throw Error(bignumberError + p + " not true or false: " + v);
          }
        }
        if (obj.hasOwnProperty(p = "MODULO_MODE")) {
          v = obj[p];
          intCheck(v, 0, 9, p);
          MODULO_MODE = v;
        }
        if (obj.hasOwnProperty(p = "POW_PRECISION")) {
          v = obj[p];
          intCheck(v, 0, MAX, p);
          POW_PRECISION = v;
        }
        if (obj.hasOwnProperty(p = "FORMAT")) {
          v = obj[p];
          if (typeof v == "object") FORMAT = v;
          else throw Error(bignumberError + p + " not an object: " + v);
        }
        if (obj.hasOwnProperty(p = "ALPHABET")) {
          v = obj[p];
          if (typeof v == "string" && !/^.?$|[+\-.\s]|(.).*\1/.test(v)) {
            alphabetHasNormalDecimalDigits = v.slice(0, 10) == "0123456789";
            ALPHABET = v;
          } else {
            throw Error(bignumberError + p + " invalid: " + v);
          }
        }
      } else {
        throw Error(bignumberError + "Object expected: " + obj);
      }
    }
    return {
      DECIMAL_PLACES,
      ROUNDING_MODE,
      EXPONENTIAL_AT: [TO_EXP_NEG, TO_EXP_POS],
      RANGE: [MIN_EXP, MAX_EXP],
      CRYPTO,
      MODULO_MODE,
      POW_PRECISION,
      FORMAT,
      ALPHABET
    };
  };
  BigNumber2.isBigNumber = function(v) {
    if (!v || v._isBigNumber !== true) return false;
    if (!BigNumber2.DEBUG) return true;
    var i, n, c = v.c, e = v.e, s = v.s;
    out: if ({}.toString.call(c) == "[object Array]") {
      if ((s === 1 || s === -1) && e >= -MAX && e <= MAX && e === mathfloor(e)) {
        if (c[0] === 0) {
          if (e === 0 && c.length === 1) return true;
          break out;
        }
        i = (e + 1) % LOG_BASE;
        if (i < 1) i += LOG_BASE;
        if (String(c[0]).length == i) {
          for (i = 0; i < c.length; i++) {
            n = c[i];
            if (n < 0 || n >= BASE || n !== mathfloor(n)) break out;
          }
          if (n !== 0) return true;
        }
      }
    } else if (c === null && e === null && (s === null || s === 1 || s === -1)) {
      return true;
    }
    throw Error(bignumberError + "Invalid BigNumber: " + v);
  };
  BigNumber2.maximum = BigNumber2.max = function() {
    return maxOrMin(arguments, -1);
  };
  BigNumber2.minimum = BigNumber2.min = function() {
    return maxOrMin(arguments, 1);
  };
  BigNumber2.random = (function() {
    var pow2_53 = 9007199254740992;
    var random53bitInt = Math.random() * pow2_53 & 2097151 ? function() {
      return mathfloor(Math.random() * pow2_53);
    } : function() {
      return (Math.random() * 1073741824 | 0) * 8388608 + (Math.random() * 8388608 | 0);
    };
    return function(dp) {
      var a, b2, e, k2, v, i = 0, c = [], rand = new BigNumber2(ONE);
      if (dp == null) dp = DECIMAL_PLACES;
      else intCheck(dp, 0, MAX);
      k2 = mathceil(dp / LOG_BASE);
      if (CRYPTO) {
        if (crypto.getRandomValues) {
          a = crypto.getRandomValues(new Uint32Array(k2 *= 2));
          for (; i < k2; ) {
            v = a[i] * 131072 + (a[i + 1] >>> 11);
            if (v >= 9e15) {
              b2 = crypto.getRandomValues(new Uint32Array(2));
              a[i] = b2[0];
              a[i + 1] = b2[1];
            } else {
              c.push(v % 1e14);
              i += 2;
            }
          }
          i = k2 / 2;
        } else if (crypto.randomBytes) {
          a = crypto.randomBytes(k2 *= 7);
          for (; i < k2; ) {
            v = (a[i] & 31) * 281474976710656 + a[i + 1] * 1099511627776 + a[i + 2] * 4294967296 + a[i + 3] * 16777216 + (a[i + 4] << 16) + (a[i + 5] << 8) + a[i + 6];
            if (v >= 9e15) {
              crypto.randomBytes(7).copy(a, i);
            } else {
              c.push(v % 1e14);
              i += 7;
            }
          }
          i = k2 / 7;
        } else {
          CRYPTO = false;
          throw Error(bignumberError + "crypto unavailable");
        }
      }
      if (!CRYPTO) {
        for (; i < k2; ) {
          v = random53bitInt();
          if (v < 9e15) c[i++] = v % 1e14;
        }
      }
      k2 = c[--i];
      dp %= LOG_BASE;
      if (k2 && dp) {
        v = POWS_TEN[LOG_BASE - dp];
        c[i] = mathfloor(k2 / v) * v;
      }
      for (; c[i] === 0; c.pop(), i--) ;
      if (i < 0) {
        c = [e = 0];
      } else {
        for (e = -1; c[0] === 0; c.splice(0, 1), e -= LOG_BASE) ;
        for (i = 1, v = c[0]; v >= 10; v /= 10, i++) ;
        if (i < LOG_BASE) e -= LOG_BASE - i;
      }
      rand.e = e;
      rand.c = c;
      return rand;
    };
  })();
  BigNumber2.sum = function() {
    var i = 1, args = arguments, sum = new BigNumber2(args[0]);
    for (; i < args.length; ) sum = sum.plus(args[i++]);
    return sum;
  };
  convertBase = /* @__PURE__ */ (function() {
    var decimal = "0123456789";
    function toBaseOut(str, baseIn, baseOut, alphabet) {
      var j, arr = [0], arrL, i = 0, len = str.length;
      for (; i < len; ) {
        for (arrL = arr.length; arrL--; arr[arrL] *= baseIn) ;
        arr[0] += alphabet.indexOf(str.charAt(i++));
        for (j = 0; j < arr.length; j++) {
          if (arr[j] > baseOut - 1) {
            if (arr[j + 1] == null) arr[j + 1] = 0;
            arr[j + 1] += arr[j] / baseOut | 0;
            arr[j] %= baseOut;
          }
        }
      }
      return arr.reverse();
    }
    return function(str, baseIn, baseOut, sign, callerIsToString) {
      var alphabet, d, e, k2, r, x2, xc, y, i = str.indexOf("."), dp = DECIMAL_PLACES, rm = ROUNDING_MODE;
      if (i >= 0) {
        k2 = POW_PRECISION;
        POW_PRECISION = 0;
        str = str.replace(".", "");
        y = new BigNumber2(baseIn);
        x2 = y.pow(str.length - i);
        POW_PRECISION = k2;
        y.c = toBaseOut(
          toFixedPoint(coeffToString(x2.c), x2.e, "0"),
          10,
          baseOut,
          decimal
        );
        y.e = y.c.length;
      }
      xc = toBaseOut(str, baseIn, baseOut, callerIsToString ? (alphabet = ALPHABET, decimal) : (alphabet = decimal, ALPHABET));
      e = k2 = xc.length;
      for (; xc[--k2] == 0; xc.pop()) ;
      if (!xc[0]) return alphabet.charAt(0);
      if (i < 0) {
        --e;
      } else {
        x2.c = xc;
        x2.e = e;
        x2.s = sign;
        x2 = div(x2, y, dp, rm, baseOut);
        xc = x2.c;
        r = x2.r;
        e = x2.e;
      }
      d = e + dp + 1;
      i = xc[d];
      k2 = baseOut / 2;
      r = r || d < 0 || xc[d + 1] != null;
      r = rm < 4 ? (i != null || r) && (rm == 0 || rm == (x2.s < 0 ? 3 : 2)) : i > k2 || i == k2 && (rm == 4 || r || rm == 6 && xc[d - 1] & 1 || rm == (x2.s < 0 ? 8 : 7));
      if (d < 1 || !xc[0]) {
        str = r ? toFixedPoint(alphabet.charAt(1), -dp, alphabet.charAt(0)) : alphabet.charAt(0);
      } else {
        xc.length = d;
        if (r) {
          for (--baseOut; ++xc[--d] > baseOut; ) {
            xc[d] = 0;
            if (!d) {
              ++e;
              xc = [1].concat(xc);
            }
          }
        }
        for (k2 = xc.length; !xc[--k2]; ) ;
        for (i = 0, str = ""; i <= k2; str += alphabet.charAt(xc[i++])) ;
        str = toFixedPoint(str, e, alphabet.charAt(0));
      }
      return str;
    };
  })();
  div = /* @__PURE__ */ (function() {
    function multiply(x2, k2, base) {
      var m, temp, xlo, xhi, carry = 0, i = x2.length, klo = k2 % SQRT_BASE, khi = k2 / SQRT_BASE | 0;
      for (x2 = x2.slice(); i--; ) {
        xlo = x2[i] % SQRT_BASE;
        xhi = x2[i] / SQRT_BASE | 0;
        m = khi * xlo + xhi * klo;
        temp = klo * xlo + m % SQRT_BASE * SQRT_BASE + carry;
        carry = (temp / base | 0) + (m / SQRT_BASE | 0) + khi * xhi;
        x2[i] = temp % base;
      }
      if (carry) x2 = [carry].concat(x2);
      return x2;
    }
    function compare2(a, b2, aL, bL) {
      var i, cmp;
      if (aL != bL) {
        cmp = aL > bL ? 1 : -1;
      } else {
        for (i = cmp = 0; i < aL; i++) {
          if (a[i] != b2[i]) {
            cmp = a[i] > b2[i] ? 1 : -1;
            break;
          }
        }
      }
      return cmp;
    }
    function subtract(a, b2, aL, base) {
      var i = 0;
      for (; aL--; ) {
        a[aL] -= i;
        i = a[aL] < b2[aL] ? 1 : 0;
        a[aL] = i * base + a[aL] - b2[aL];
      }
      for (; !a[0] && a.length > 1; a.splice(0, 1)) ;
    }
    return function(x2, y, dp, rm, base) {
      var cmp, e, i, more, n, prod, prodL, q, qc, rem, remL, rem0, xi, xL, yc0, yL, yz, s = x2.s == y.s ? 1 : -1, xc = x2.c, yc = y.c;
      if (!xc || !xc[0] || !yc || !yc[0]) {
        return new BigNumber2(
          // Return NaN if either NaN, or both Infinity or 0.
          !x2.s || !y.s || (xc ? yc && xc[0] == yc[0] : !yc) ? NaN : (
            // Return ±0 if x is ±0 or y is ±Infinity, or return ±Infinity as y is ±0.
            xc && xc[0] == 0 || !yc ? s * 0 : s / 0
          )
        );
      }
      q = new BigNumber2(s);
      qc = q.c = [];
      e = x2.e - y.e;
      s = dp + e + 1;
      if (!base) {
        base = BASE;
        e = bitFloor(x2.e / LOG_BASE) - bitFloor(y.e / LOG_BASE);
        s = s / LOG_BASE | 0;
      }
      for (i = 0; yc[i] == (xc[i] || 0); i++) ;
      if (yc[i] > (xc[i] || 0)) e--;
      if (s < 0) {
        qc.push(1);
        more = true;
      } else {
        xL = xc.length;
        yL = yc.length;
        i = 0;
        s += 2;
        n = mathfloor(base / (yc[0] + 1));
        if (n > 1) {
          yc = multiply(yc, n, base);
          xc = multiply(xc, n, base);
          yL = yc.length;
          xL = xc.length;
        }
        xi = yL;
        rem = xc.slice(0, yL);
        remL = rem.length;
        for (; remL < yL; rem[remL++] = 0) ;
        yz = yc.slice();
        yz = [0].concat(yz);
        yc0 = yc[0];
        if (yc[1] >= base / 2) yc0++;
        do {
          n = 0;
          cmp = compare2(yc, rem, yL, remL);
          if (cmp < 0) {
            rem0 = rem[0];
            if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
            n = mathfloor(rem0 / yc0);
            if (n > 1) {
              if (n >= base) n = base - 1;
              prod = multiply(yc, n, base);
              prodL = prod.length;
              remL = rem.length;
              while (compare2(prod, rem, prodL, remL) == 1) {
                n--;
                subtract(prod, yL < prodL ? yz : yc, prodL, base);
                prodL = prod.length;
                cmp = 1;
              }
            } else {
              if (n == 0) {
                cmp = n = 1;
              }
              prod = yc.slice();
              prodL = prod.length;
            }
            if (prodL < remL) prod = [0].concat(prod);
            subtract(rem, prod, remL, base);
            remL = rem.length;
            if (cmp == -1) {
              while (compare2(yc, rem, yL, remL) < 1) {
                n++;
                subtract(rem, yL < remL ? yz : yc, remL, base);
                remL = rem.length;
              }
            }
          } else if (cmp === 0) {
            n++;
            rem = [0];
          }
          qc[i++] = n;
          if (rem[0]) {
            rem[remL++] = xc[xi] || 0;
          } else {
            rem = [xc[xi]];
            remL = 1;
          }
        } while ((xi++ < xL || rem[0] != null) && s--);
        more = rem[0] != null;
        if (!qc[0]) qc.splice(0, 1);
      }
      if (base == BASE) {
        for (i = 1, s = qc[0]; s >= 10; s /= 10, i++) ;
        round(q, dp + (q.e = i + e * LOG_BASE - 1) + 1, rm, more);
      } else {
        q.e = e;
        q.r = +more;
      }
      return q;
    };
  })();
  function format(n, i, rm, id) {
    var c0, e, ne2, len, str;
    if (rm == null) rm = ROUNDING_MODE;
    else intCheck(rm, 0, 8);
    if (!n.c) return n.toString();
    c0 = n.c[0];
    ne2 = n.e;
    if (i == null) {
      str = coeffToString(n.c);
      str = id == 1 || id == 2 && (ne2 <= TO_EXP_NEG || ne2 >= TO_EXP_POS) ? toExponential(str, ne2) : toFixedPoint(str, ne2, "0");
    } else {
      n = round(new BigNumber2(n), i, rm);
      e = n.e;
      str = coeffToString(n.c);
      len = str.length;
      if (id == 1 || id == 2 && (i <= e || e <= TO_EXP_NEG)) {
        for (; len < i; str += "0", len++) ;
        str = toExponential(str, e);
      } else {
        i -= ne2;
        str = toFixedPoint(str, e, "0");
        if (e + 1 > len) {
          if (--i > 0) for (str += "."; i--; str += "0") ;
        } else {
          i += e - len;
          if (i > 0) {
            if (e + 1 == len) str += ".";
            for (; i--; str += "0") ;
          }
        }
      }
    }
    return n.s < 0 && c0 ? "-" + str : str;
  }
  function maxOrMin(args, n) {
    var k2, y, i = 1, x2 = new BigNumber2(args[0]);
    for (; i < args.length; i++) {
      y = new BigNumber2(args[i]);
      if (!y.s || (k2 = compare(x2, y)) === n || k2 === 0 && x2.s === n) {
        x2 = y;
      }
    }
    return x2;
  }
  function normalise(n, c, e) {
    var i = 1, j = c.length;
    for (; !c[--j]; c.pop()) ;
    for (j = c[0]; j >= 10; j /= 10, i++) ;
    if ((e = i + e * LOG_BASE - 1) > MAX_EXP) {
      n.c = n.e = null;
    } else if (e < MIN_EXP) {
      n.c = [n.e = 0];
    } else {
      n.e = e;
      n.c = c;
    }
    return n;
  }
  parseNumeric = /* @__PURE__ */ (function() {
    var basePrefix = /^(-?)0([xbo])(?=\w[\w.]*$)/i, dotAfter = /^([^.]+)\.$/, dotBefore = /^\.([^.]+)$/, isInfinityOrNaN = /^-?(Infinity|NaN)$/, whitespaceOrPlus = /^\s*\+(?=[\w.])|^\s+|\s+$/g;
    return function(x2, str, isNum, b2) {
      var base, s = isNum ? str : str.replace(whitespaceOrPlus, "");
      if (isInfinityOrNaN.test(s)) {
        x2.s = isNaN(s) ? null : s < 0 ? -1 : 1;
      } else {
        if (!isNum) {
          s = s.replace(basePrefix, function(m, p1, p2) {
            base = (p2 = p2.toLowerCase()) == "x" ? 16 : p2 == "b" ? 2 : 8;
            return !b2 || b2 == base ? p1 : m;
          });
          if (b2) {
            base = b2;
            s = s.replace(dotAfter, "$1").replace(dotBefore, "0.$1");
          }
          if (str != s) return new BigNumber2(s, base);
        }
        if (BigNumber2.DEBUG) {
          throw Error(bignumberError + "Not a" + (b2 ? " base " + b2 : "") + " number: " + str);
        }
        x2.s = null;
      }
      x2.c = x2.e = null;
    };
  })();
  function round(x2, sd, rm, r) {
    var d, i, j, k2, n, ni, rd, xc = x2.c, pows10 = POWS_TEN;
    if (xc) {
      out: {
        for (d = 1, k2 = xc[0]; k2 >= 10; k2 /= 10, d++) ;
        i = sd - d;
        if (i < 0) {
          i += LOG_BASE;
          j = sd;
          n = xc[ni = 0];
          rd = mathfloor(n / pows10[d - j - 1] % 10);
        } else {
          ni = mathceil((i + 1) / LOG_BASE);
          if (ni >= xc.length) {
            if (r) {
              for (; xc.length <= ni; xc.push(0)) ;
              n = rd = 0;
              d = 1;
              i %= LOG_BASE;
              j = i - LOG_BASE + 1;
            } else {
              break out;
            }
          } else {
            n = k2 = xc[ni];
            for (d = 1; k2 >= 10; k2 /= 10, d++) ;
            i %= LOG_BASE;
            j = i - LOG_BASE + d;
            rd = j < 0 ? 0 : mathfloor(n / pows10[d - j - 1] % 10);
          }
        }
        r = r || sd < 0 || // Are there any non-zero digits after the rounding digit?
        // The expression  n % pows10[d - j - 1]  returns all digits of n to the right
        // of the digit at j, e.g. if n is 908714 and j is 2, the expression gives 714.
        xc[ni + 1] != null || (j < 0 ? n : n % pows10[d - j - 1]);
        r = rm < 4 ? (rd || r) && (rm == 0 || rm == (x2.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || r || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
        (i > 0 ? j > 0 ? n / pows10[d - j] : 0 : xc[ni - 1]) % 10 & 1 || rm == (x2.s < 0 ? 8 : 7));
        if (sd < 1 || !xc[0]) {
          xc.length = 0;
          if (r) {
            sd -= x2.e + 1;
            xc[0] = pows10[(LOG_BASE - sd % LOG_BASE) % LOG_BASE];
            x2.e = -sd || 0;
          } else {
            xc[0] = x2.e = 0;
          }
          return x2;
        }
        if (i == 0) {
          xc.length = ni;
          k2 = 1;
          ni--;
        } else {
          xc.length = ni + 1;
          k2 = pows10[LOG_BASE - i];
          xc[ni] = j > 0 ? mathfloor(n / pows10[d - j] % pows10[j]) * k2 : 0;
        }
        if (r) {
          for (; ; ) {
            if (ni == 0) {
              for (i = 1, j = xc[0]; j >= 10; j /= 10, i++) ;
              j = xc[0] += k2;
              for (k2 = 1; j >= 10; j /= 10, k2++) ;
              if (i != k2) {
                x2.e++;
                if (xc[0] == BASE) xc[0] = 1;
              }
              break;
            } else {
              xc[ni] += k2;
              if (xc[ni] != BASE) break;
              xc[ni--] = 0;
              k2 = 1;
            }
          }
        }
        for (i = xc.length; xc[--i] === 0; xc.pop()) ;
      }
      if (x2.e > MAX_EXP) {
        x2.c = x2.e = null;
      } else if (x2.e < MIN_EXP) {
        x2.c = [x2.e = 0];
      }
    }
    return x2;
  }
  function valueOf(n) {
    var str, e = n.e;
    if (e === null) return n.toString();
    str = coeffToString(n.c);
    str = e <= TO_EXP_NEG || e >= TO_EXP_POS ? toExponential(str, e) : toFixedPoint(str, e, "0");
    return n.s < 0 ? "-" + str : str;
  }
  P.absoluteValue = P.abs = function() {
    var x2 = new BigNumber2(this);
    if (x2.s < 0) x2.s = 1;
    return x2;
  };
  P.comparedTo = function(y, b2) {
    return compare(this, new BigNumber2(y, b2));
  };
  P.decimalPlaces = P.dp = function(dp, rm) {
    var c, n, v, x2 = this;
    if (dp != null) {
      intCheck(dp, 0, MAX);
      if (rm == null) rm = ROUNDING_MODE;
      else intCheck(rm, 0, 8);
      return round(new BigNumber2(x2), dp + x2.e + 1, rm);
    }
    if (!(c = x2.c)) return null;
    n = ((v = c.length - 1) - bitFloor(this.e / LOG_BASE)) * LOG_BASE;
    if (v = c[v]) for (; v % 10 == 0; v /= 10, n--) ;
    if (n < 0) n = 0;
    return n;
  };
  P.dividedBy = P.div = function(y, b2) {
    return div(this, new BigNumber2(y, b2), DECIMAL_PLACES, ROUNDING_MODE);
  };
  P.dividedToIntegerBy = P.idiv = function(y, b2) {
    return div(this, new BigNumber2(y, b2), 0, 1);
  };
  P.exponentiatedBy = P.pow = function(n, m) {
    var half, isModExp, i, k2, more, nIsBig, nIsNeg, nIsOdd, y, x2 = this;
    n = new BigNumber2(n);
    if (n.c && !n.isInteger()) {
      throw Error(bignumberError + "Exponent not an integer: " + valueOf(n));
    }
    if (m != null) m = new BigNumber2(m);
    nIsBig = n.e > 14;
    if (!x2.c || !x2.c[0] || x2.c[0] == 1 && !x2.e && x2.c.length == 1 || !n.c || !n.c[0]) {
      y = new BigNumber2(Math.pow(+valueOf(x2), nIsBig ? n.s * (2 - isOdd(n)) : +valueOf(n)));
      return m ? y.mod(m) : y;
    }
    nIsNeg = n.s < 0;
    if (m) {
      if (m.c ? !m.c[0] : !m.s) return new BigNumber2(NaN);
      isModExp = !nIsNeg && x2.isInteger() && m.isInteger();
      if (isModExp) x2 = x2.mod(m);
    } else if (n.e > 9 && (x2.e > 0 || x2.e < -1 || (x2.e == 0 ? x2.c[0] > 1 || nIsBig && x2.c[1] >= 24e7 : x2.c[0] < 8e13 || nIsBig && x2.c[0] <= 9999975e7))) {
      k2 = x2.s < 0 && isOdd(n) ? -0 : 0;
      if (x2.e > -1) k2 = 1 / k2;
      return new BigNumber2(nIsNeg ? 1 / k2 : k2);
    } else if (POW_PRECISION) {
      k2 = mathceil(POW_PRECISION / LOG_BASE + 2);
    }
    if (nIsBig) {
      half = new BigNumber2(0.5);
      if (nIsNeg) n.s = 1;
      nIsOdd = isOdd(n);
    } else {
      i = Math.abs(+valueOf(n));
      nIsOdd = i % 2;
    }
    y = new BigNumber2(ONE);
    for (; ; ) {
      if (nIsOdd) {
        y = y.times(x2);
        if (!y.c) break;
        if (k2) {
          if (y.c.length > k2) y.c.length = k2;
        } else if (isModExp) {
          y = y.mod(m);
        }
      }
      if (i) {
        i = mathfloor(i / 2);
        if (i === 0) break;
        nIsOdd = i % 2;
      } else {
        n = n.times(half);
        round(n, n.e + 1, 1);
        if (n.e > 14) {
          nIsOdd = isOdd(n);
        } else {
          i = +valueOf(n);
          if (i === 0) break;
          nIsOdd = i % 2;
        }
      }
      x2 = x2.times(x2);
      if (k2) {
        if (x2.c && x2.c.length > k2) x2.c.length = k2;
      } else if (isModExp) {
        x2 = x2.mod(m);
      }
    }
    if (isModExp) return y;
    if (nIsNeg) y = ONE.div(y);
    return m ? y.mod(m) : k2 ? round(y, POW_PRECISION, ROUNDING_MODE, more) : y;
  };
  P.integerValue = function(rm) {
    var n = new BigNumber2(this);
    if (rm == null) rm = ROUNDING_MODE;
    else intCheck(rm, 0, 8);
    return round(n, n.e + 1, rm);
  };
  P.isEqualTo = P.eq = function(y, b2) {
    return compare(this, new BigNumber2(y, b2)) === 0;
  };
  P.isFinite = function() {
    return !!this.c;
  };
  P.isGreaterThan = P.gt = function(y, b2) {
    return compare(this, new BigNumber2(y, b2)) > 0;
  };
  P.isGreaterThanOrEqualTo = P.gte = function(y, b2) {
    return (b2 = compare(this, new BigNumber2(y, b2))) === 1 || b2 === 0;
  };
  P.isInteger = function() {
    return !!this.c && bitFloor(this.e / LOG_BASE) > this.c.length - 2;
  };
  P.isLessThan = P.lt = function(y, b2) {
    return compare(this, new BigNumber2(y, b2)) < 0;
  };
  P.isLessThanOrEqualTo = P.lte = function(y, b2) {
    return (b2 = compare(this, new BigNumber2(y, b2))) === -1 || b2 === 0;
  };
  P.isNaN = function() {
    return !this.s;
  };
  P.isNegative = function() {
    return this.s < 0;
  };
  P.isPositive = function() {
    return this.s > 0;
  };
  P.isZero = function() {
    return !!this.c && this.c[0] == 0;
  };
  P.minus = function(y, b2) {
    var i, j, t, xLTy, x2 = this, a = x2.s;
    y = new BigNumber2(y, b2);
    b2 = y.s;
    if (!a || !b2) return new BigNumber2(NaN);
    if (a != b2) {
      y.s = -b2;
      return x2.plus(y);
    }
    var xe = x2.e / LOG_BASE, ye2 = y.e / LOG_BASE, xc = x2.c, yc = y.c;
    if (!xe || !ye2) {
      if (!xc || !yc) return xc ? (y.s = -b2, y) : new BigNumber2(yc ? x2 : NaN);
      if (!xc[0] || !yc[0]) {
        return yc[0] ? (y.s = -b2, y) : new BigNumber2(xc[0] ? x2 : (
          // IEEE 754 (2008) 6.3: n - n = -0 when rounding to -Infinity
          ROUNDING_MODE == 3 ? -0 : 0
        ));
      }
    }
    xe = bitFloor(xe);
    ye2 = bitFloor(ye2);
    xc = xc.slice();
    if (a = xe - ye2) {
      if (xLTy = a < 0) {
        a = -a;
        t = xc;
      } else {
        ye2 = xe;
        t = yc;
      }
      t.reverse();
      for (b2 = a; b2--; t.push(0)) ;
      t.reverse();
    } else {
      j = (xLTy = (a = xc.length) < (b2 = yc.length)) ? a : b2;
      for (a = b2 = 0; b2 < j; b2++) {
        if (xc[b2] != yc[b2]) {
          xLTy = xc[b2] < yc[b2];
          break;
        }
      }
    }
    if (xLTy) {
      t = xc;
      xc = yc;
      yc = t;
      y.s = -y.s;
    }
    b2 = (j = yc.length) - (i = xc.length);
    if (b2 > 0) for (; b2--; xc[i++] = 0) ;
    b2 = BASE - 1;
    for (; j > a; ) {
      if (xc[--j] < yc[j]) {
        for (i = j; i && !xc[--i]; xc[i] = b2) ;
        --xc[i];
        xc[j] += BASE;
      }
      xc[j] -= yc[j];
    }
    for (; xc[0] == 0; xc.splice(0, 1), --ye2) ;
    if (!xc[0]) {
      y.s = ROUNDING_MODE == 3 ? -1 : 1;
      y.c = [y.e = 0];
      return y;
    }
    return normalise(y, xc, ye2);
  };
  P.modulo = P.mod = function(y, b2) {
    var q, s, x2 = this;
    y = new BigNumber2(y, b2);
    if (!x2.c || !y.s || y.c && !y.c[0]) {
      return new BigNumber2(NaN);
    } else if (!y.c || x2.c && !x2.c[0]) {
      return new BigNumber2(x2);
    }
    if (MODULO_MODE == 9) {
      s = y.s;
      y.s = 1;
      q = div(x2, y, 0, 3);
      y.s = s;
      q.s *= s;
    } else {
      q = div(x2, y, 0, MODULO_MODE);
    }
    y = x2.minus(q.times(y));
    if (!y.c[0] && MODULO_MODE == 1) y.s = x2.s;
    return y;
  };
  P.multipliedBy = P.times = function(y, b2) {
    var c, e, i, j, k2, m, xcL, xlo, xhi, ycL, ylo, yhi, zc, base, sqrtBase, x2 = this, xc = x2.c, yc = (y = new BigNumber2(y, b2)).c;
    if (!xc || !yc || !xc[0] || !yc[0]) {
      if (!x2.s || !y.s || xc && !xc[0] && !yc || yc && !yc[0] && !xc) {
        y.c = y.e = y.s = null;
      } else {
        y.s *= x2.s;
        if (!xc || !yc) {
          y.c = y.e = null;
        } else {
          y.c = [0];
          y.e = 0;
        }
      }
      return y;
    }
    e = bitFloor(x2.e / LOG_BASE) + bitFloor(y.e / LOG_BASE);
    y.s *= x2.s;
    xcL = xc.length;
    ycL = yc.length;
    if (xcL < ycL) {
      zc = xc;
      xc = yc;
      yc = zc;
      i = xcL;
      xcL = ycL;
      ycL = i;
    }
    for (i = xcL + ycL, zc = []; i--; zc.push(0)) ;
    base = BASE;
    sqrtBase = SQRT_BASE;
    for (i = ycL; --i >= 0; ) {
      c = 0;
      ylo = yc[i] % sqrtBase;
      yhi = yc[i] / sqrtBase | 0;
      for (k2 = xcL, j = i + k2; j > i; ) {
        xlo = xc[--k2] % sqrtBase;
        xhi = xc[k2] / sqrtBase | 0;
        m = yhi * xlo + xhi * ylo;
        xlo = ylo * xlo + m % sqrtBase * sqrtBase + zc[j] + c;
        c = (xlo / base | 0) + (m / sqrtBase | 0) + yhi * xhi;
        zc[j--] = xlo % base;
      }
      zc[j] = c;
    }
    if (c) {
      ++e;
    } else {
      zc.splice(0, 1);
    }
    return normalise(y, zc, e);
  };
  P.negated = function() {
    var x2 = new BigNumber2(this);
    x2.s = -x2.s || null;
    return x2;
  };
  P.plus = function(y, b2) {
    var t, x2 = this, a = x2.s;
    y = new BigNumber2(y, b2);
    b2 = y.s;
    if (!a || !b2) return new BigNumber2(NaN);
    if (a != b2) {
      y.s = -b2;
      return x2.minus(y);
    }
    var xe = x2.e / LOG_BASE, ye2 = y.e / LOG_BASE, xc = x2.c, yc = y.c;
    if (!xe || !ye2) {
      if (!xc || !yc) return new BigNumber2(a / 0);
      if (!xc[0] || !yc[0]) return yc[0] ? y : new BigNumber2(xc[0] ? x2 : a * 0);
    }
    xe = bitFloor(xe);
    ye2 = bitFloor(ye2);
    xc = xc.slice();
    if (a = xe - ye2) {
      if (a > 0) {
        ye2 = xe;
        t = yc;
      } else {
        a = -a;
        t = xc;
      }
      t.reverse();
      for (; a--; t.push(0)) ;
      t.reverse();
    }
    a = xc.length;
    b2 = yc.length;
    if (a - b2 < 0) {
      t = yc;
      yc = xc;
      xc = t;
      b2 = a;
    }
    for (a = 0; b2; ) {
      a = (xc[--b2] = xc[b2] + yc[b2] + a) / BASE | 0;
      xc[b2] = BASE === xc[b2] ? 0 : xc[b2] % BASE;
    }
    if (a) {
      xc = [a].concat(xc);
      ++ye2;
    }
    return normalise(y, xc, ye2);
  };
  P.precision = P.sd = function(sd, rm) {
    var c, n, v, x2 = this;
    if (sd != null && sd !== !!sd) {
      intCheck(sd, 1, MAX);
      if (rm == null) rm = ROUNDING_MODE;
      else intCheck(rm, 0, 8);
      return round(new BigNumber2(x2), sd, rm);
    }
    if (!(c = x2.c)) return null;
    v = c.length - 1;
    n = v * LOG_BASE + 1;
    if (v = c[v]) {
      for (; v % 10 == 0; v /= 10, n--) ;
      for (v = c[0]; v >= 10; v /= 10, n++) ;
    }
    if (sd && x2.e + 1 > n) n = x2.e + 1;
    return n;
  };
  P.shiftedBy = function(k2) {
    intCheck(k2, -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER);
    return this.times("1e" + k2);
  };
  P.squareRoot = P.sqrt = function() {
    var m, n, r, rep, t, x2 = this, c = x2.c, s = x2.s, e = x2.e, dp = DECIMAL_PLACES + 4, half = new BigNumber2("0.5");
    if (s !== 1 || !c || !c[0]) {
      return new BigNumber2(!s || s < 0 && (!c || c[0]) ? NaN : c ? x2 : 1 / 0);
    }
    s = Math.sqrt(+valueOf(x2));
    if (s == 0 || s == 1 / 0) {
      n = coeffToString(c);
      if ((n.length + e) % 2 == 0) n += "0";
      s = Math.sqrt(+n);
      e = bitFloor((e + 1) / 2) - (e < 0 || e % 2);
      if (s == 1 / 0) {
        n = "5e" + e;
      } else {
        n = s.toExponential();
        n = n.slice(0, n.indexOf("e") + 1) + e;
      }
      r = new BigNumber2(n);
    } else {
      r = new BigNumber2(s + "");
    }
    if (r.c[0]) {
      e = r.e;
      s = e + dp;
      if (s < 3) s = 0;
      for (; ; ) {
        t = r;
        r = half.times(t.plus(div(x2, t, dp, 1)));
        if (coeffToString(t.c).slice(0, s) === (n = coeffToString(r.c)).slice(0, s)) {
          if (r.e < e) --s;
          n = n.slice(s - 3, s + 1);
          if (n == "9999" || !rep && n == "4999") {
            if (!rep) {
              round(t, t.e + DECIMAL_PLACES + 2, 0);
              if (t.times(t).eq(x2)) {
                r = t;
                break;
              }
            }
            dp += 4;
            s += 4;
            rep = 1;
          } else {
            if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
              round(r, r.e + DECIMAL_PLACES + 2, 1);
              m = !r.times(r).eq(x2);
            }
            break;
          }
        }
      }
    }
    return round(r, r.e + DECIMAL_PLACES + 1, ROUNDING_MODE, m);
  };
  P.toExponential = function(dp, rm) {
    if (dp != null) {
      intCheck(dp, 0, MAX);
      dp++;
    }
    return format(this, dp, rm, 1);
  };
  P.toFixed = function(dp, rm) {
    if (dp != null) {
      intCheck(dp, 0, MAX);
      dp = dp + this.e + 1;
    }
    return format(this, dp, rm);
  };
  P.toFormat = function(dp, rm, format2) {
    var str, x2 = this;
    if (format2 == null) {
      if (dp != null && rm && typeof rm == "object") {
        format2 = rm;
        rm = null;
      } else if (dp && typeof dp == "object") {
        format2 = dp;
        dp = rm = null;
      } else {
        format2 = FORMAT;
      }
    } else if (typeof format2 != "object") {
      throw Error(bignumberError + "Argument not an object: " + format2);
    }
    str = x2.toFixed(dp, rm);
    if (x2.c) {
      var i, arr = str.split("."), g1 = +format2.groupSize, g2 = +format2.secondaryGroupSize, groupSeparator = format2.groupSeparator || "", intPart = arr[0], fractionPart = arr[1], isNeg = x2.s < 0, intDigits = isNeg ? intPart.slice(1) : intPart, len = intDigits.length;
      if (g2) {
        i = g1;
        g1 = g2;
        g2 = i;
        len -= i;
      }
      if (g1 > 0 && len > 0) {
        i = len % g1 || g1;
        intPart = intDigits.substr(0, i);
        for (; i < len; i += g1) intPart += groupSeparator + intDigits.substr(i, g1);
        if (g2 > 0) intPart += groupSeparator + intDigits.slice(i);
        if (isNeg) intPart = "-" + intPart;
      }
      str = fractionPart ? intPart + (format2.decimalSeparator || "") + ((g2 = +format2.fractionGroupSize) ? fractionPart.replace(
        new RegExp("\\d{" + g2 + "}\\B", "g"),
        "$&" + (format2.fractionGroupSeparator || "")
      ) : fractionPart) : intPart;
    }
    return (format2.prefix || "") + str + (format2.suffix || "");
  };
  P.toFraction = function(md) {
    var d, d0, d1, d2, e, exp, n, n0, n1, q, r, s, x2 = this, xc = x2.c;
    if (md != null) {
      n = new BigNumber2(md);
      if (!n.isInteger() && (n.c || n.s !== 1) || n.lt(ONE)) {
        throw Error(bignumberError + "Argument " + (n.isInteger() ? "out of range: " : "not an integer: ") + valueOf(n));
      }
    }
    if (!xc) return new BigNumber2(x2);
    d = new BigNumber2(ONE);
    n1 = d0 = new BigNumber2(ONE);
    d1 = n0 = new BigNumber2(ONE);
    s = coeffToString(xc);
    e = d.e = s.length - x2.e - 1;
    d.c[0] = POWS_TEN[(exp = e % LOG_BASE) < 0 ? LOG_BASE + exp : exp];
    md = !md || n.comparedTo(d) > 0 ? e > 0 ? d : n1 : n;
    exp = MAX_EXP;
    MAX_EXP = 1 / 0;
    n = new BigNumber2(s);
    n0.c[0] = 0;
    for (; ; ) {
      q = div(n, d, 0, 1);
      d2 = d0.plus(q.times(d1));
      if (d2.comparedTo(md) == 1) break;
      d0 = d1;
      d1 = d2;
      n1 = n0.plus(q.times(d2 = n1));
      n0 = d2;
      d = n.minus(q.times(d2 = d));
      n = d2;
    }
    d2 = div(md.minus(d0), d1, 0, 1);
    n0 = n0.plus(d2.times(n1));
    d0 = d0.plus(d2.times(d1));
    n0.s = n1.s = x2.s;
    e = e * 2;
    r = div(n1, d1, e, ROUNDING_MODE).minus(x2).abs().comparedTo(
      div(n0, d0, e, ROUNDING_MODE).minus(x2).abs()
    ) < 1 ? [n1, d1] : [n0, d0];
    MAX_EXP = exp;
    return r;
  };
  P.toNumber = function() {
    return +valueOf(this);
  };
  P.toPrecision = function(sd, rm) {
    if (sd != null) intCheck(sd, 1, MAX);
    return format(this, sd, rm, 2);
  };
  P.toString = function(b2) {
    var str, n = this, s = n.s, e = n.e;
    if (e === null) {
      if (s) {
        str = "Infinity";
        if (s < 0) str = "-" + str;
      } else {
        str = "NaN";
      }
    } else {
      if (b2 == null) {
        str = e <= TO_EXP_NEG || e >= TO_EXP_POS ? toExponential(coeffToString(n.c), e) : toFixedPoint(coeffToString(n.c), e, "0");
      } else if (b2 === 10 && alphabetHasNormalDecimalDigits) {
        n = round(new BigNumber2(n), DECIMAL_PLACES + e + 1, ROUNDING_MODE);
        str = toFixedPoint(coeffToString(n.c), n.e, "0");
      } else {
        intCheck(b2, 2, ALPHABET.length, "Base");
        str = convertBase(toFixedPoint(coeffToString(n.c), e, "0"), 10, b2, s, true);
      }
      if (s < 0 && n.c[0]) str = "-" + str;
    }
    return str;
  };
  P.valueOf = P.toJSON = function() {
    return valueOf(this);
  };
  P._isBigNumber = true;
  P[Symbol.toStringTag] = "BigNumber";
  P[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = P.valueOf;
  if (configObject != null) BigNumber2.set(configObject);
  return BigNumber2;
}
function bitFloor(n) {
  var i = n | 0;
  return n > 0 || n === i ? i : i - 1;
}
function coeffToString(a) {
  var s, z2, i = 1, j = a.length, r = a[0] + "";
  for (; i < j; ) {
    s = a[i++] + "";
    z2 = LOG_BASE - s.length;
    for (; z2--; s = "0" + s) ;
    r += s;
  }
  for (j = r.length; r.charCodeAt(--j) === 48; ) ;
  return r.slice(0, j + 1 || 1);
}
function compare(x2, y) {
  var a, b2, xc = x2.c, yc = y.c, i = x2.s, j = y.s, k2 = x2.e, l2 = y.e;
  if (!i || !j) return null;
  a = xc && !xc[0];
  b2 = yc && !yc[0];
  if (a || b2) return a ? b2 ? 0 : -j : i;
  if (i != j) return i;
  a = i < 0;
  b2 = k2 == l2;
  if (!xc || !yc) return b2 ? 0 : !xc ^ a ? 1 : -1;
  if (!b2) return k2 > l2 ^ a ? 1 : -1;
  j = (k2 = xc.length) < (l2 = yc.length) ? k2 : l2;
  for (i = 0; i < j; i++) if (xc[i] != yc[i]) return xc[i] > yc[i] ^ a ? 1 : -1;
  return k2 == l2 ? 0 : k2 > l2 ^ a ? 1 : -1;
}
function intCheck(n, min, max, name) {
  if (n < min || n > max || n !== mathfloor(n)) {
    throw Error(bignumberError + (name || "Argument") + (typeof n == "number" ? n < min || n > max ? " out of range: " : " not an integer: " : " not a primitive number: ") + String(n));
  }
}
function isOdd(n) {
  var k2 = n.c.length - 1;
  return bitFloor(n.e / LOG_BASE) == k2 && n.c[k2] % 2 != 0;
}
function toExponential(str, e) {
  return (str.length > 1 ? str.charAt(0) + "." + str.slice(1) : str) + (e < 0 ? "e" : "e+") + e;
}
function toFixedPoint(str, e, z2) {
  var len, zs;
  if (e < 0) {
    for (zs = z2 + "."; ++e; zs += z2) ;
    str = zs + str;
  } else {
    len = str.length;
    if (++e > len) {
      for (zs = z2, e -= len; --e; zs += z2) ;
      str += zs;
    } else if (e < len) {
      str = str.slice(0, e) + "." + str.slice(e);
    }
  }
  return str;
}
var BigNumber = clone();
var bignumber_default = BigNumber;

// ../../node_modules/.pnpm/@naviprotocol+lending@2.0.0-beta.0_@mysten+sui@2.18.0_typescript@5.9.3_/node_modules/@naviprotocol/lending/dist/index.esm.js
var import_jsonRpc = require("@mysten/sui/jsonRpc");
var Z = import_bcs.bcs.bytes(32).transform({
  // To change the input type, you need to provide a type definition for the input
  input: (e) => (0, import_utils.fromHex)(e),
  output: (e) => (0, import_utils.toHex)(e)
});
var et = import_bcs.bcs.struct("IncentiveAPYInfo", {
  /** Asset identifier */
  asset_id: import_bcs.bcs.u8(),
  /** Annual Percentage Yield as a 256-bit integer */
  apy: import_bcs.bcs.u256(),
  /** List of supported coin types for this incentive */
  coin_types: import_bcs.bcs.vector(import_bcs.bcs.string())
});
var we = import_bcs.bcs.struct("IncentivePoolInfo", {
  /** Unique pool identifier */
  pool_id: Z,
  /** Address holding the incentive funds */
  funds: Z,
  /** Current phase of the incentive program */
  phase: import_bcs.bcs.u64(),
  /** Timestamp when the incentive started */
  start_at: import_bcs.bcs.u64(),
  /** Timestamp when the incentive ends */
  end_at: import_bcs.bcs.u64(),
  /** Timestamp when the incentive was closed */
  closed_at: import_bcs.bcs.u64(),
  /** Total supply of incentive tokens */
  total_supply: import_bcs.bcs.u64(),
  /** Asset identifier for the incentive */
  asset_id: import_bcs.bcs.u8(),
  /** Option type for the incentive */
  option: import_bcs.bcs.u8(),
  /** Factor used in incentive calculations */
  factor: import_bcs.bcs.u256(),
  /** Amount of incentives already distributed */
  distributed: import_bcs.bcs.u64(),
  /** Amount of incentives currently available */
  available: import_bcs.bcs.u256(),
  /** Total amount of incentives */
  total: import_bcs.bcs.u256()
});
var tt = import_bcs.bcs.struct("IncentivePoolInfoByPhase", {
  /** Phase number */
  phase: import_bcs.bcs.u64(),
  /** List of incentive pools in this phase */
  pools: import_bcs.bcs.vector(we)
});
var ot = import_bcs.bcs.struct("OracleInfo", {
  /** Oracle identifier */
  oracle_id: import_bcs.bcs.u8(),
  /** Current price as a 256-bit integer */
  price: import_bcs.bcs.u256(),
  /** Number of decimal places for the price */
  decimals: import_bcs.bcs.u8(),
  /** Whether the oracle data is valid */
  valid: import_bcs.bcs.bool()
});
var rt = import_bcs.bcs.struct("FlashLoanAssetConfig", {
  /** Unique identifier for the flash loan asset */
  id: import_bcs.bcs.string(),
  /** Asset identifier */
  asset_id: import_bcs.bcs.u8(),
  /** Coin type for the asset */
  coin_type: import_bcs.bcs.string(),
  /** Pool identifier for the flash loan */
  pool_id: import_bcs.bcs.string(),
  /** Rate paid to suppliers for flash loans */
  rate_to_supplier: import_bcs.bcs.u64(),
  /** Rate paid to treasury for flash loans */
  rate_to_treasury: import_bcs.bcs.u64(),
  /** Maximum flash loan amount */
  max: import_bcs.bcs.u64(),
  /** Minimum flash loan amount */
  min: import_bcs.bcs.u64()
});
var ve = import_bcs.bcs.struct("ReserveDataInfo", {
  /** Reserve identifier */
  id: import_bcs.bcs.u8(),
  /** Oracle identifier for price feeds */
  oracle_id: import_bcs.bcs.u8(),
  /** Coin type for the reserve */
  coin_type: import_bcs.bcs.string(),
  /** Maximum supply capacity */
  supply_cap: import_bcs.bcs.u256(),
  /** Maximum borrow capacity */
  borrow_cap: import_bcs.bcs.u256(),
  /** Current supply interest rate */
  supply_rate: import_bcs.bcs.u256(),
  /** Current borrow interest rate */
  borrow_rate: import_bcs.bcs.u256(),
  /** Current supply index for interest calculation */
  supply_index: import_bcs.bcs.u256(),
  /** Current borrow index for interest calculation */
  borrow_index: import_bcs.bcs.u256(),
  /** Total amount supplied to the reserve */
  total_supply: import_bcs.bcs.u256(),
  /** Total amount borrowed from the reserve */
  total_borrow: import_bcs.bcs.u256(),
  /** Timestamp of last update */
  last_update_at: import_bcs.bcs.u64(),
  /** Loan-to-Value ratio for collateral */
  ltv: import_bcs.bcs.u256(),
  /** Treasury factor for fee calculations */
  treasury_factor: import_bcs.bcs.u256(),
  /** Current treasury balance */
  treasury_balance: import_bcs.bcs.u256(),
  /** Base interest rate */
  base_rate: import_bcs.bcs.u256(),
  /** Interest rate multiplier */
  multiplier: import_bcs.bcs.u256(),
  /** Jump rate multiplier for high utilization */
  jump_rate_multiplier: import_bcs.bcs.u256(),
  /** Reserve factor for protocol fees */
  reserve_factor: import_bcs.bcs.u256(),
  /** Optimal utilization rate */
  optimal_utilization: import_bcs.bcs.u256(),
  /** Liquidation ratio threshold */
  liquidation_ratio: import_bcs.bcs.u256(),
  /** Liquidation bonus for liquidators */
  liquidation_bonus: import_bcs.bcs.u256(),
  /** Liquidation threshold */
  liquidation_threshold: import_bcs.bcs.u256()
});
var be = import_bcs.bcs.struct("UserStateInfo", {
  /** Asset identifier */
  asset_id: import_bcs.bcs.u8(),
  /** User's current borrow balance */
  borrow_balance: import_bcs.bcs.u256(),
  /** User's current supply balance */
  supply_balance: import_bcs.bcs.u256()
});
var ke = "2.0.0-beta.0";
var M = {
  version: ke
};
var _e = M.version;
var je = () => {
  if (typeof process < "u" && process.versions && process.versions.node) {
    const e = process.version;
    return `Node.js ${e.startsWith("v") ? e.substring(1) : e}`;
  }
  return "Node/Unknown";
};
var Ie = () => {
  let e = "";
  return typeof process < "u" && process.versions && process.versions.node && (e = `lending/${_e} (${je()})`), e;
};
var X = Ie();
function Ce(e = (0, import_jsonRpc.getJsonRpcFullnodeUrl)("mainnet"), t = "mainnet") {
  return new import_jsonRpc.SuiJsonRpcClient({
    network: t,
    url: e
  });
}
var Te = 16 * 1024;
function J(e) {
  return e.replace(/^0x/i, "");
}
function Pe(e) {
  const t = J(e), r = new Uint8Array(t.length / 2);
  for (let n = 0; n < r.length; n += 1)
    r[n] = parseInt(t.slice(n * 2, n * 2 + 2), 16);
  return r;
}
function Be(e, t) {
  return (e[t] << 8) + e[t + 1];
}
function Q(e) {
  return import_bcs.bcs.vector(import_bcs.bcs.U8).serialize(Array.from(e), {
    maxSize: Te
  });
}
function Ae(e) {
  return Uint8Array.from(atob(e), (t) => t.charCodeAt(0));
}
var te = class {
  constructor(t, r) {
    this.endpoint = t.replace(/\/$/, ""), this.timeout = r?.timeout ?? 1e4;
  }
  async getLatestPriceFeeds(t) {
    return (await this.get("/api/latest_price_feeds", t)).map((n) => ({
      id: n.id,
      getPriceUnchecked: () => ({
        price: n.price.price,
        conf: n.price.conf,
        expo: n.price.expo,
        publishTime: n.price.publish_time
      })
    }));
  }
  async getPriceFeedsUpdateData(t) {
    const r = await this.get(
      "/v2/updates/price/latest",
      t,
      {
        encoding: "base64",
        parsed: "false"
      }
    ), n = r.binary?.encoding, o = r.binary?.data ?? [];
    if (n && n !== "base64")
      throw new Error(`Unsupported Hermes price update encoding: ${n}`);
    if (o.length === 0)
      throw new Error("Hermes price update response did not include binary update data");
    return o.map(Ae);
  }
  async get(t, r, n) {
    const o = new AbortController(), a = setTimeout(() => o.abort(), this.timeout), c = new URL(`${this.endpoint}${t}`);
    for (const [i, s] of Object.entries(n ?? {}))
      c.searchParams.set(i, s);
    for (const i of r)
      c.searchParams.append("ids[]", J(i));
    try {
      const i = await fetch(c, {
        signal: o.signal
      });
      if (!i.ok)
        throw new Error(`Hermes request failed: ${i.status} ${i.statusText}`);
      return await i.json();
    } finally {
      clearTimeout(a);
    }
  }
};
var $e = class {
  constructor(t, r, n) {
    this.provider = t, this.pythStateId = r, this.wormholeStateId = n, this.priceFeedObjectIdCache = /* @__PURE__ */ new Map();
  }
  async updatePriceFeeds(t, r, n) {
    const o = await this.getPythPackageId(), a = await this.verifyVaasAndGetHotPotato(t, r, o), c = await this.getBaseUpdateFee(), i = t.splitCoins(
      t.gas,
      n.map(() => t.pure.u64(c))
    );
    return this.executePriceFeedUpdates(t, o, n, a, i);
  }
  async getBaseUpdateFee() {
    if (this.baseUpdateFee === void 0) {
      const t = await this.provider.getObject({
        id: this.pythStateId,
        options: { showContent: true }
      });
      if (!t.data || !t.data.content || t.data.content.dataType !== "moveObject")
        throw new Error("Unable to fetch pyth state object");
      this.baseUpdateFee = Number(t.data.content.fields.base_update_fee);
    }
    return this.baseUpdateFee;
  }
  async getPackageId(t) {
    const r = await this.provider.getObject({
      id: t,
      options: { showContent: true }
    });
    if (r.data?.content?.dataType === "moveObject") {
      const n = r.data.content.fields;
      if ("upgrade_cap" in n)
        return n.upgrade_cap.fields.package;
    }
    throw new Error(`Cannot fetch package id for object ${t}`);
  }
  async verifyVaas(t, r) {
    const n = await this.getWormholePackageId();
    return t.map((o) => {
      const [a] = r.moveCall({
        target: `${n}::vaa::parse_and_verify`,
        arguments: [
          r.object(this.wormholeStateId),
          r.pure(Q(o)),
          r.object(import_utils.SUI_CLOCK_OBJECT_ID)
        ]
      });
      return a;
    });
  }
  async verifyVaasAndGetHotPotato(t, r, n) {
    if (r.length > 1)
      throw new Error(
        "SDK does not support sending multiple accumulator messages in a single transaction"
      );
    const o = this.extractVaaBytesFromAccumulatorMessage(r[0]), [a] = await this.verifyVaas([o], t), [c] = t.moveCall({
      target: `${n}::pyth::create_authenticated_price_infos_using_accumulator`,
      arguments: [
        t.object(this.pythStateId),
        t.pure(Q(r[0])),
        a,
        t.object(import_utils.SUI_CLOCK_OBJECT_ID)
      ]
    });
    return c;
  }
  async executePriceFeedUpdates(t, r, n, o, a) {
    const c = [];
    for (const [i, s] of n.entries()) {
      const p = await this.getPriceFeedObjectId(s);
      if (!p)
        throw new Error(`Price feed ${s} not found, please create it first`);
      c.push(p), [o] = t.moveCall({
        target: `${r}::pyth::update_single_price_feed`,
        arguments: [
          t.object(this.pythStateId),
          o,
          t.object(p),
          a[i],
          t.object(import_utils.SUI_CLOCK_OBJECT_ID)
        ]
      });
    }
    return t.moveCall({
      target: `${r}::hot_potato_vector::destroy`,
      arguments: [o],
      typeArguments: [`${r}::price_info::PriceInfo`]
    }), c;
  }
  async getWormholePackageId() {
    return this.wormholePackageId || (this.wormholePackageId = await this.getPackageId(this.wormholeStateId)), this.wormholePackageId;
  }
  async getPythPackageId() {
    return this.pythPackageId || (this.pythPackageId = await this.getPackageId(this.pythStateId)), this.pythPackageId;
  }
  async getPriceFeedObjectId(t) {
    const r = J(t);
    if (!this.priceFeedObjectIdCache.has(r)) {
      const { id: n, fieldType: o } = await this.getPriceTableInfo(), a = await this.provider.getDynamicFieldObject({
        parentId: n,
        name: {
          type: `${o}::price_identifier::PriceIdentifier`,
          value: {
            bytes: Array.from(Pe(r))
          }
        }
      });
      if (!a.data || !a.data.content)
        this.priceFeedObjectIdCache.set(r, void 0);
      else {
        if (a.data.content.dataType !== "moveObject")
          throw new Error("Price feed type mismatch");
        this.priceFeedObjectIdCache.set(r, a.data.content.fields.value);
      }
    }
    return this.priceFeedObjectIdCache.get(r);
  }
  async getPriceTableInfo() {
    if (!this.priceTableInfo) {
      const t = await this.provider.getDynamicFieldObject({
        parentId: this.pythStateId,
        name: {
          type: "vector<u8>",
          value: "price_info"
        }
      });
      if (!t.data || !t.data.type)
        throw new Error("Price Table not found, contract may not be initialized");
      let r = t.data.type.replace("0x2::table::Table<", "");
      r = r.replace("::price_identifier::PriceIdentifier, 0x2::object::ID>", ""), this.priceTableInfo = {
        id: t.data.objectId,
        fieldType: r
      };
    }
    return this.priceTableInfo;
  }
  extractVaaBytesFromAccumulatorMessage(t) {
    const n = 7 + t[6] + 1, o = Be(t, n), a = n + 2;
    return t.subarray(a, a + o);
  }
};
var V = Ce();
function oe(e) {
  const t = [];
  return e.forEach((r, n) => {
    const o = n === e.length - 1;
    if (typeof r == "object" && r !== null && o) {
      const { client: a, disableCache: c, cacheTime: i, ...s } = r;
      t.push(s);
    } else
      t.push(r);
  }), JSON.stringify(t);
}
function A(e) {
  const t = {};
  return (...r) => {
    const n = oe(r);
    return t[n] || (t[n] = e(...r).finally(() => {
      delete t[n];
    })), t[n];
  };
}
function S(e) {
  let t = {};
  return (...r) => {
    const n = r[r.length - 1], o = oe(r), a = t[o];
    return !n?.disableCache && typeof a?.data < "u" && (typeof n?.cacheTime > "u" || n.cacheTime > Date.now() - a.cacheAt) ? Promise.resolve(a.data) : e(...r).then((c) => (t[o] = {
      data: c,
      cacheAt: Date.now()
    }, c));
  };
}
function G(e) {
  return Array.isArray(e) ? e.map((t) => G(t)) : e != null && typeof e == "object" ? Object.keys(e).reduce(
    (t, r) => ({
      ...t,
      [(0, import_lodash.default)(r)]: G(e[r])
    }),
    {}
  ) : e;
}
function g(e, t) {
  if (typeof e > "u")
    throw new Error("Transaction value is required");
  return typeof e == "object" ? e : t(e);
}
function Se(e, t) {
  return typeof t == "string" ? e.object(t) : typeof t == "object" && t.$kind ? t : e.object(t.contract.pool);
}
function H(e, t, r) {
  if (e.results && e.results.length > 0) {
    if (e.results[0].returnValues && e.results[0].returnValues.length > 0)
      return e.results[0].returnValues.map((n, o) => (t[o] || t[0]).parse(Uint8Array.from(n[0])));
  } else if (e.error)
    return console.log(`Get an error, msg: ${e.error}`), [];
  return [];
}
function k(e) {
  return (0, import_utils.normalizeStructTag)(e);
}
function re(e) {
  const t = (e || 0) / Math.pow(10, 27);
  return t > Math.pow(10, 5) ? 1 / 0 : t;
}
new te("https://hermes.pyth.network", {
  timeout: 2e4
});
var Ve = 27;
var x = (e, t) => {
  if (!Number(e) || !Number(t)) return new bignumber_default(0);
  const r = new bignumber_default(1).shiftedBy(1 * Ve), n = r.multipliedBy(new bignumber_default(0.5));
  return new bignumber_default(e).multipliedBy(new bignumber_default(t)).plus(n).dividedBy(r).integerValue(bignumber_default.ROUND_DOWN);
};
var E = X ? {
  "User-Agent": X
} : {};
function K(e, t = "uniqueId") {
  return e.reduce(
    (r, n) => (r[n[t]] = n, r),
    {}
  );
}
function ee(e, t = "uniqueId") {
  return e.reduce(
    (r, n) => (r[n[t]] = n, r),
    {}
  );
}
function L(e, t) {
  const r = e.emodes.find((o) => o.emodeId === t.emodeId);
  if (!r)
    throw new Error("EMode not found in pool");
  const n = r.assets.find((o) => o.assetId === e.id);
  return {
    ...e,
    emode: {
      ...n,
      emodeId: r.emodeId
    },
    isEMode: true
  };
}
function Me(e) {
  const [t, r] = e.split("-");
  return !t || !r ? null : {
    marketKey: t,
    poolId: parseInt(r)
  };
}
function B() {
  return typeof crypto < "u" && typeof crypto.randomUUID == "function" ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
var N = /* @__PURE__ */ ((e) => (e[e.Supply = 1] = "Supply", e[e.Withdraw = 2] = "Withdraw", e[e.Borrow = 3] = "Borrow", e[e.Repay = 4] = "Repay", e))(N || {});
var R = S(
  A(
    async (e) => {
      const t = (e?.markets || [U.main]).map((o) => C(o)), r = `https://open-api.naviprotocol.io/api/navi/pools?env=${e?.env || "prod"}&sdk=${M.version}&market=${t.map(
        (o) => o.key
      )}`, n = await fetch(r, { headers: E }).then((o) => o.json());
      return n.data.forEach((o) => {
        const c = n.meta.emodes.filter((f) => {
          const v = C(f.marketId);
          return o.market === v.key && f.isActive;
        }).filter((f) => !!f.assets.find((v) => v.assetId === o.id));
        o.emodes = c;
        const i = bignumber_default(o.totalSupplyAmount).div(Math.pow(10, 9)).decimalPlaces(o.token.decimals, bignumber_default.ROUND_DOWN).toString(), s = bignumber_default(o.borrowedAmount).shiftedBy(-9).decimalPlaces(o.token.decimals, bignumber_default.ROUND_DOWN).toString(), p = bignumber_default(i).multipliedBy(o.oracle.price).toString(), m = bignumber_default(s).multipliedBy(o.oracle.price).toString(), h = bignumber_default(o.supplyCapCeiling).shiftedBy(-27).decimalPlaces(o.token.decimals, bignumber_default.ROUND_DOWN).toString(), w = bignumber_default.max(
          bignumber_default(o.borrowedAmount),
          bignumber_default(o.validBorrowAmount)
        ).shiftedBy(-9).decimalPlaces(o.token.decimals, bignumber_default.ROUND_DOWN).toString(), y = bignumber_default(h).multipliedBy(o.oracle.price).toString(), u = bignumber_default(w).multipliedBy(o.oracle.price).toString();
        o.poolSupplyAmount = i, o.poolBorrowAmount = s, o.poolSupplyValue = p, o.poolBorrowValue = m, o.poolSupplyCapAmount = h, o.poolBorrowCapAmount = w, o.poolSupplyCapValue = y, o.poolBorrowCapValue = u;
      }), n.data;
    }
  )
);
async function $(e, t) {
  let r = t?.market;
  if (typeof e == "string") {
    const a = Me(e);
    a && (r = a.marketKey, e = a.poolId);
  }
  const n = await R({
    ...t,
    markets: [r || O],
    cacheTime: b
  });
  if (typeof e == "object")
    return e;
  const o = n.find((a) => typeof e == "string" ? k(a.suiCoinType) === k(e) : typeof e == "number" ? a.id === e : false);
  if (!o)
    throw new Error("Pool not found");
  return o.isDeprecated && console.log(`The lending pool for coinType ${o.suiCoinType} is going to be deprecated.`), o;
}
var nt = S(
  A(async (e) => {
    const t = `https://open-api.naviprotocol.io/api/navi/stats?sdk=${M.version}`;
    return (await fetch(t, { headers: E }).then((n) => n.json())).data;
  })
);
var at = S(
  A(
    async (e) => {
      const t = `https://open-api.naviprotocol.io/api/navi/fee?sdk=${M.version}`;
      return await fetch(t, { headers: E }).then((n) => n.json());
    }
  )
);
async function Ee(e, t, r, n) {
  const o = await _({
    ...n,
    cacheTime: b
  }), a = await $(t, n), c = n?.market || O, i = n?.env || "prod";
  if (a?.deprecatedAt && Date.now() > a.deprecatedAt)
    throw new Error(`The lending pool for coinType ${a.suiCoinType} has been deprecated.`);
  if (k(a.suiCoinType) === k("0x2::sui::SUI") && typeof r == "object" && r?.$kind === "GasCoin") {
    if (!n?.amount)
      throw new Error("Amount is required for sui coin");
    r = e.splitCoins(r, [n.amount]);
  }
  let s;
  return typeof n?.amount < "u" ? s = g(n.amount, e.pure.u64) : s = e.moveCall({
    target: "0x2::coin::value",
    arguments: [g(r, e.object)],
    typeArguments: [a.suiCoinType]
  }), n?.accountCap ? e.moveCall({
    target: `${o.package}::incentive_v3::deposit_with_account_cap`,
    arguments: [
      e.object("0x06"),
      e.object(o.storage),
      e.object(a.contract.pool),
      e.pure.u8(a.id),
      g(r, e.object),
      e.object(o.incentiveV2),
      e.object(o.incentiveV3),
      g(n.accountCap, e.object)
    ],
    typeArguments: [a.suiCoinType]
  }) : e.moveCall({
    target: `${o.package}::incentive_v3::entry_deposit`,
    arguments: [
      e.object("0x06"),
      e.object(o.storage),
      e.object(a.contract.pool),
      e.pure.u8(a.id),
      g(r, e.object),
      s,
      e.object(o.incentiveV2),
      e.object(o.incentiveV3)
    ],
    typeArguments: [a.suiCoinType]
  }), o.version === 2 && a.token.symbol === "SUI" && i === "prod" && c === "main" && e.moveCall({
    target: `${o.package}::pool::refresh_stake`,
    arguments: [e.object(a.contract.pool), e.object("0x05")]
  }), e;
}
async function it(e, t, r, n) {
  const o = await _({
    ...n,
    cacheTime: b
  }), a = await $(t, n), c = g(r, e.pure.u64);
  let i;
  if (o.version === 1)
    if (n?.accountCap) {
      const [p] = e.moveCall({
        target: `${o.package}::incentive_v3::withdraw_with_account_cap`,
        arguments: [
          e.object("0x06"),
          e.object(o.priceOracle),
          e.object(o.storage),
          e.object(a.contract.pool),
          e.pure.u8(a.id),
          c,
          e.object(o.incentiveV2),
          e.object(o.incentiveV3),
          g(n.accountCap, e.object)
        ],
        typeArguments: [a.suiCoinType]
      });
      i = p;
    } else {
      const [p] = e.moveCall({
        target: `${o.package}::incentive_v3::withdraw`,
        arguments: [
          e.object("0x06"),
          e.object(o.priceOracle),
          e.object(o.storage),
          e.object(a.contract.pool),
          e.pure.u8(a.id),
          c,
          e.object(o.incentiveV2),
          e.object(o.incentiveV3)
        ],
        typeArguments: [a.suiCoinType]
      });
      i = p;
    }
  else if (n?.accountCap) {
    const [p] = e.moveCall({
      target: `${o.package}::incentive_v3::withdraw_with_account_cap_v2`,
      arguments: [
        e.object("0x06"),
        e.object(o.priceOracle),
        e.object(o.storage),
        e.object(a.contract.pool),
        e.pure.u8(a.id),
        c,
        e.object(o.incentiveV2),
        e.object(o.incentiveV3),
        g(n.accountCap, e.object),
        e.object("0x05")
      ],
      typeArguments: [a.suiCoinType]
    });
    i = p;
  } else {
    const [p] = e.moveCall({
      target: `${o.package}::incentive_v3::withdraw_v2`,
      arguments: [
        e.object("0x06"),
        e.object(o.priceOracle),
        e.object(o.storage),
        e.object(a.contract.pool),
        e.pure.u8(a.id),
        c,
        e.object(o.incentiveV2),
        e.object(o.incentiveV3),
        e.object("0x05")
      ],
      typeArguments: [a.suiCoinType]
    });
    i = p;
  }
  return e.moveCall({
    target: "0x2::coin::from_balance",
    arguments: [i],
    typeArguments: [a.suiCoinType]
  });
}
async function ct(e, t, r, n) {
  const o = await _({
    ...n,
    cacheTime: b
  }), a = await $(t, n);
  if (a?.deprecatedAt && Date.now() > a.deprecatedAt)
    throw new Error(`The lending pool for coinType ${a.suiCoinType} has been deprecated.`);
  const c = g(r, e.pure.u64);
  let i;
  if (o.version === 1)
    if (n?.accountCap) {
      const [p] = e.moveCall({
        target: `${o.package}::incentive_v3::borrow_with_account_cap`,
        arguments: [
          e.object("0x06"),
          e.object(o.priceOracle),
          e.object(o.storage),
          e.object(a.contract.pool),
          e.pure.u8(a.id),
          c,
          e.object(o.incentiveV2),
          e.object(o.incentiveV3),
          g(n.accountCap, e.object)
        ],
        typeArguments: [a.suiCoinType]
      });
      i = p;
    } else {
      const [p] = e.moveCall({
        target: `${o.package}::incentive_v3::borrow`,
        arguments: [
          e.object("0x06"),
          e.object(o.priceOracle),
          e.object(o.storage),
          e.object(a.contract.pool),
          e.pure.u8(a.id),
          c,
          e.object(o.incentiveV2),
          e.object(o.incentiveV3)
        ],
        typeArguments: [a.suiCoinType]
      });
      i = p;
    }
  else if (n?.accountCap) {
    const [p] = e.moveCall({
      target: `${o.package}::incentive_v3::borrow_with_account_cap_v2`,
      arguments: [
        e.object("0x06"),
        e.object(o.priceOracle),
        e.object(o.storage),
        e.object(a.contract.pool),
        e.pure.u8(a.id),
        c,
        e.object(o.incentiveV2),
        e.object(o.incentiveV3),
        g(n.accountCap, e.object),
        e.object("0x05")
      ],
      typeArguments: [a.suiCoinType]
    });
    i = p;
  } else {
    const [p] = e.moveCall({
      target: `${o.package}::incentive_v3::borrow_v2`,
      arguments: [
        e.object("0x06"),
        e.object(o.priceOracle),
        e.object(o.storage),
        e.object(a.contract.pool),
        e.pure.u8(a.id),
        c,
        e.object(o.incentiveV2),
        e.object(o.incentiveV3),
        e.object("0x05")
      ],
      typeArguments: [a.suiCoinType]
    });
    i = p;
  }
  return e.moveCall({
    target: "0x2::coin::from_balance",
    arguments: [e.object(i)],
    typeArguments: [a.suiCoinType]
  });
}
async function st(e, t, r, n) {
  const o = await _({
    ...n,
    cacheTime: b
  }), a = await $(t, n);
  if (k(a.suiCoinType) === k("0x2::sui::SUI") && typeof r == "object" && r?.$kind === "GasCoin") {
    if (!n?.amount)
      throw new Error("Amount is required for sui coin");
    r = e.splitCoins(r, [n.amount]);
  }
  let c;
  if (typeof n?.amount < "u" ? c = g(n.amount, e.pure.u64) : c = e.moveCall({
    target: "0x2::coin::value",
    arguments: [g(r, e.object)],
    typeArguments: [a.suiCoinType]
  }), n?.accountCap) {
    const [i] = e.moveCall({
      target: `${o.package}::incentive_v3::repay_with_account_cap`,
      arguments: [
        e.object("0x06"),
        e.object(o.priceOracle),
        e.object(o.storage),
        e.object(a.contract.pool),
        e.pure.u8(a.id),
        g(r, e.object),
        e.object(o.incentiveV2),
        e.object(o.incentiveV3),
        g(n.accountCap, e.object)
      ],
      typeArguments: [a.suiCoinType]
    });
    return e.moveCall({
      target: "0x2::coin::from_balance",
      arguments: [i],
      typeArguments: [a.suiCoinType]
    });
  } else
    return e.moveCall({
      target: `${o.package}::incentive_v3::entry_repay`,
      arguments: [
        e.object("0x06"),
        e.object(o.priceOracle),
        e.object(o.storage),
        e.object(a.contract.pool),
        e.pure.u8(a.id),
        g(r, e.object),
        c,
        e.object(o.incentiveV2),
        e.object(o.incentiveV3)
      ],
      typeArguments: [a.suiCoinType]
    }), e;
}
var lt = S(
  A(
    async (e) => {
      const t = await _({
        ...e
      });
      if (e?.address && typeof e?.asset < "u")
        try {
          const o = await $(e.asset, e), a = e?.client ?? V, c = new import_transactions.Transaction();
          c.moveCall({
            target: `${t.package}::incentive_v3::get_borrow_fee_v2`,
            arguments: [
              c.object(t.incentiveV3),
              c.pure.address(e.address),
              c.pure.u8(o.id),
              c.pure.u64(1e4)
            ],
            typeArguments: []
          });
          const i = await a.devInspectTransactionBlock({
            transactionBlock: c,
            sender: e.address
          }), s = H(i, [import_bcs.bcs.u64()]);
          return (Number(s[0]) || 0) / 100;
        } catch (o) {
          console.error(o);
        }
      const n = (await V.getObject({
        id: t.incentiveV3,
        options: { showType: true, showOwner: true, showContent: true }
      })).data.content.fields.borrow_fee_rate;
      return Number(n) / 100;
    }
  )
);
var O = "main";
var U = {
  main: {
    id: 0,
    key: "main",
    name: "Main Market"
  },
  ember: {
    id: 1,
    key: "ember",
    name: "Ember Market"
  },
  rwa: {
    id: 2,
    key: "rwa",
    name: "Matrixdock Market"
  },
  "sui-eco": {
    id: 3,
    key: "sui-eco",
    name: "Sui Eco Market"
  }
};
var Ue = class {
  constructor(t, r) {
    this.poolMap = {}, this.emodeMap = {}, this.pools = [], this.emodes = [], this.emodePools = [], this.emodeBorrowablePools = [], this.emodeSupplyablePools = [], this._overview = {
      marketTotalSupplyValue: "0",
      marketTotalBorrowValue: "0"
    }, this.config = C(t), this.initPools(r);
  }
  get overview() {
    return this._overview;
  }
  initPools(t) {
    const r = K(this.pools), n = ee(this.emodes), o = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set();
    let c = bignumber_default(0), i = bignumber_default(0);
    t.forEach((s) => {
      if (!this.checkMarket(s.market)) {
        console.warn(`Pool is not in market ${this.config.name}`, s);
        return;
      }
      r[s.uniqueId] || this.pools.push(s), s?.emodes?.forEach((m) => {
        n[m.uniqueId] || this.emodes.push(m), m.assets.forEach((h) => {
          h.isDebt && m.assets.find(
            (y) => y.isCollateral && y.ltv > 0 && y.assetId !== s.id
          ) && o.add(s.uniqueId), h.isCollateral && m.assets.find((y) => y.isDebt && y.assetId !== s.id) && a.add(s.uniqueId);
        });
      }), i = i.plus(s.poolBorrowValue), c = c.plus(s.poolSupplyValue);
    }), this.poolMap = K(this.pools, "id"), this.emodeMap = ee(this.emodes, "emodeId"), this.emodes.forEach((s) => {
      const p = this.getEModePools(s.emodeId);
      this.emodePools.push(...p);
    }), this._overview = {
      marketTotalSupplyValue: c.toString(),
      marketTotalBorrowValue: i.toString()
    }, this.emodeBorrowablePools = this.pools.filter((s) => o.has(s.uniqueId)), this.emodeSupplyablePools = this.pools.filter((s) => a.has(s.uniqueId));
  }
  getEMode(t) {
    return this.emodeMap[t] || null;
  }
  getEModeRelatePools(t, r) {
    const { collateral: n, debt: o, emodeId: a } = r || {}, c = [];
    return t.emodes.forEach((i) => {
      typeof a == "number" && a !== i.emodeId || i.assets.forEach((s) => {
        typeof n == "boolean" && n && s.isCollateral && s.assetId === t.id && c.push(this.poolMap[s.assetId]), typeof o == "boolean" && o && s.isDebt && s.assetId === t.id && c.push(this.poolMap[s.assetId]);
      });
    }), c;
  }
  getEModePools(t) {
    const r = this.getEMode(t);
    return r ? r.assets.map((o) => o.assetId).map((o) => this.poolMap[o]).filter((o) => !!o).map((o) => {
      const a = r.assets.find((c) => c.assetId === o.id);
      return {
        ...o,
        emode: {
          ...a,
          emodeId: r.emodeId
        },
        isEMode: true
      };
    }) : [];
  }
  checkMarket(t) {
    let r = false;
    return typeof t == "number" && t === this.config.id && (r = true), typeof t == "string" && t === this.config.key && (r = true), typeof t == "object" && t.id === this.config.id && (r = true), r;
  }
};
var C = (e) => {
  const r = Object.values(U).find((n) => typeof e == "number" ? n.id === e : typeof e == "string" ? n.key === e : n.id === e.id);
  if (!r)
    throw new Error("Market not found");
  return r;
};
var Oe = S(
  A(
    async (e, t) => {
      const r = await R({
        cacheTime: 6e4,
        ...t,
        markets: e
      });
      return e.map((n) => {
        const o = C(n), a = r.filter((c) => c.market === o.key);
        return new Ue(n, a);
      });
    }
  )
);
var ut = S(
  A(
    async (e, t) => (await Oe([e], t))[0]
  )
);
var _ = S(
  A(
    async (e) => {
      const t = C(e?.market || O), r = `https://open-api.naviprotocol.io/api/navi/config?env=${e?.env || "prod"}&sdk=${M.version}&market=${t.key}`;
      return (await fetch(r, { headers: E }).then((o) => o.json())).data;
    }
  )
);
var b = 1e3 * 60 * 5;
async function De(e, t) {
  const r = await _({
    cacheTime: b,
    ...t
  });
  return e.moveCall({
    target: `${r.package}::lending::create_account`,
    arguments: []
  });
}
async function Fe(e, t, r) {
  const n = await _({
    cacheTime: b,
    ...r
  });
  return e.moveCall({
    target: `${n.package}::account::account_owner`,
    arguments: [t]
  });
}
async function Ne(e, t, r) {
  const n = await _({
    ...r,
    cacheTime: b
  });
  return r?.accountCap ? e.moveCall({
    target: `${n.package}::lending::enter_emode_with_account_cap`,
    arguments: [
      e.object(n.storage),
      g(t, e.pure.u64),
      g(r.accountCap, e.object)
    ]
  }) : e.moveCall({
    target: `${n.package}::lending::enter_emode`,
    arguments: [e.object(n.storage), g(t, e.pure.u64)]
  }), e;
}
async function pt(e, t) {
  const r = await _({
    ...t,
    cacheTime: b
  });
  return t?.accountCap ? e.moveCall({
    target: `${r.package}::lending::exit_emode_with_account_cap`,
    arguments: [e.object(r.storage), g(t.accountCap, e.object)]
  }) : e.moveCall({
    target: `${r.package}::lending::exit_emode`,
    arguments: [e.object(r.storage)]
  }), e;
}
async function dt(e, t, r) {
  const n = await _({
    cacheTime: b,
    ...r
  }), o = await De(e, r);
  await Ne(e, t, {
    ...r,
    accountCap: o
  });
  const a = await C(r?.market || O), c = await Fe(e, o, r);
  return e.moveCall({
    target: `${n.emode.contract.registryPackage}::registry::register_emode_for_account_cap`,
    arguments: [
      e.object(n.emode.contract.registryObject),
      c,
      g(a.id, e.pure.u64),
      g(t, e.pure.u64)
    ]
  }), o;
}
var ne = S(
  A(
    async (e, t) => {
      const r = await _({
        cacheTime: b,
        ...t
      }), n = new import_transactions.Transaction(), o = t?.client ?? V;
      n.moveCall({
        target: `${r.emode.contract.registryPackage}::registry::find_user_emode_account_caps`,
        arguments: [n.object(r.emode.contract.registryObject), n.pure.address(e)]
      });
      const c = (await o.devInspectTransactionBlock({
        transactionBlock: n,
        sender: e
      })).results[0].returnValues, i = import_bcs.bcs.vector(import_bcs.bcs.u64()).parse(Uint8Array.from(c[0][0])), s = import_bcs.bcs.vector(import_bcs.bcs.u64()).parse(Uint8Array.from(c[1][0])), p = import_bcs.bcs.vector(import_bcs.bcs.Address).parse(Uint8Array.from(c[2][0]));
      return i.map((m, h) => ({
        marketId: Number(m),
        emodeId: Number(s[h]),
        accountCap: p[h].toString()
      }));
    }
  )
);
function mt(e) {
  return `${C(e.marketId).key}-${e.emodeId}`;
}
function ft(e, t, r) {
  const n = typeof r?.balance == "number", o = n ? r.balance : 0;
  let a = 0;
  const c = [];
  let i = "";
  if (t.sort((s, p) => Number(p.balance) - Number(s.balance)).forEach((s) => {
    if (!(n && a >= o) && Number(s.balance) !== 0) {
      if (i || (i = s.coinType), i !== s.coinType)
        throw new Error("All coins must be of the same type");
      a += Number(s.balance), c.push(s.coinObjectId);
    }
  }), c.length === 0)
    throw new Error("No coins to merge");
  if (n && a < o)
    throw new Error(
      `Balance is less than the specified balance: ${a} < ${o}`
    );
  return k(i) === k("0x2::sui::SUI") && r?.useGasCoin ? n ? e.splitCoins(e.gas, [e.pure.u64(o)]) : e.gas : (c.length === 1 ? e.object(c[0]) : e.mergeCoins(c[0], c.slice(1)), n ? e.splitCoins(c[0], [e.pure.u64(o)]) : c[0]);
}
async function ae(e, t, r, n, o, a, c) {
  const i = await _({
    ...c,
    cacheTime: b
  }), s = await $(r, c);
  return e.moveCall({
    target: `${i.uiGetter}::calculator_unchecked::dynamic_health_factor`,
    arguments: [
      e.object("0x06"),
      e.object(i.storage),
      e.object(i.oracle.priceOracle),
      Se(e, s),
      g(t, e.pure.address),
      g(s.id, e.pure.u8),
      g(n, e.pure.u64),
      g(o, e.pure.u64),
      g(a, e.pure.bool)
    ],
    typeArguments: [s.suiCoinType]
  });
}
async function Re(e, t, r) {
  return ae(e, t, 0, 0, 0, false, r);
}
async function ie(e, t, r) {
  const n = new import_transactions.Transaction(), o = r?.client ?? V, a = await R({
    ...r,
    markets: Object.values(U)
  }), c = K(a), s = Array.from(new Set(t.map((u) => u.market))).map((u) => C(u));
  for (const u of s) {
    const f = await _({
      ...r,
      cacheTime: b,
      market: u.key
    });
    n.moveCall({
      target: `${f.uiGetter}::getter::get_reserve_data`,
      arguments: [n.object(f.storage)]
    });
  }
  for (let u of t) {
    const f = await _({
      ...r,
      cacheTime: b,
      market: u.market
    });
    n.moveCall({
      target: `${f.uiGetter}::getter_unchecked::get_user_state`,
      arguments: [n.object(f.storage), n.pure.address(u.address)]
    });
  }
  const m = (await o.devInspectTransactionBlock({
    transactionBlock: n,
    sender: e
  })).results || [], h = {};
  s.forEach((u, f) => {
    try {
      const v = m[f]?.returnValues?.map((T) => import_bcs.bcs.vector(ve).parse(Uint8Array.from(T[0])))[0] || [], I = {};
      for (const T of v)
        I[T.id] = {
          supplyIndex: T.supply_index,
          borrowIndex: T.borrow_index
        };
      h[u.key] = I;
    } catch (v) {
      console.warn(
        `[@naviprotocol/lending] Failed to decode reserve data for market "${u.key}", falling back to open-api pool indices`,
        v
      );
    }
  });
  const w = m.slice(s.length).map((u) => u.returnValues?.map((f) => import_bcs.bcs.vector(be).parse(Uint8Array.from(f[0])))[0] || []), y = [];
  return w.forEach((u, f) => {
    const v = t[f], I = C(v.market), T = h[I.key] || {};
    u.forEach((j) => {
      if (j.supply_balance === "0" && j.borrow_balance === "0" && (v.emodeId === void 0 || !r?.includeZeroBalanceEmodePositions))
        return;
      const P = c[`${I.key}-${j.asset_id}`];
      if (!P)
        return;
      const q = T[j.asset_id], W = q?.supplyIndex ?? P.currentSupplyIndex, le = q?.borrowIndex ?? P.currentBorrowIndex, ue = x(j.supply_balance, W).toString(), pe = x(j.borrow_balance, le).toString();
      y.push({
        supplyBalance: ue,
        borrowBalance: pe,
        assetId: j.asset_id,
        market: I.key,
        pool: P,
        emodeId: v.emodeId
      });
    });
  }), y;
}
var yt = S(
  async (e, t) => {
    const n = (t?.markets || Object.keys(U)).map((o) => C(o)).map((o) => ({
      address: e,
      market: o.key
    }));
    return await ie(e, n, t);
  }
);
async function gt(e, t) {
  const r = t?.client ?? V, n = new import_transactions.Transaction();
  await Re(n, e, t);
  const o = await r.devInspectTransactionBlock({
    transactionBlock: n,
    sender: e
  }), a = H(o, [import_bcs.bcs.u256()]);
  return re(Number(a[0]) || 0);
}
async function ht(e, t, r, n) {
  const o = n?.client ?? V, a = new import_transactions.Transaction();
  let c = 0, i = 0;
  const s = await $(t, n);
  if (r.forEach((w) => {
    w.type === N.Supply ? c += w.amount : w.type === N.Withdraw ? c -= w.amount : w.type === N.Borrow ? i += w.amount : w.type === N.Repay && (i -= w.amount);
  }), c * i < 0)
    throw new Error("Invalid operations");
  const p = c > 0 || i > 0;
  await ae(
    a,
    e,
    s,
    Math.abs(c),
    Math.abs(i),
    p,
    n
  );
  const m = await o.devInspectTransactionBlock({
    transactionBlock: a,
    sender: e
  }), h = H(m, [import_bcs.bcs.u256()]);
  return re(Number(h[0]) || 0);
}
var wt = A(
  async (e, t) => {
    const r = new URLSearchParams();
    t?.cursor && r.set("cursor", t.cursor), r.set("userAddress", e);
    const n = `https://open-api.naviprotocol.io/api/navi/user/transactions?${r.toString()}&sdk=${M.version}`;
    return (await fetch(n, { headers: E }).then((a) => a.json())).data;
  }
);
async function vt(e, t) {
  let r = null;
  const n = [], o = t?.client ?? V;
  do {
    let a;
    if (t?.coinType ? a = await o.getCoins({
      owner: e,
      coinType: t?.coinType,
      cursor: r,
      limit: 100
    }) : a = await o.getAllCoins({
      owner: e,
      cursor: r,
      limit: 100
    }), !a.data || !a.data.length)
      break;
    n.push(...a.data), r = a.nextCursor;
  } while (r);
  return n;
}
var qe = S(
  async (e, t) => {
    const r = [], n = (t?.markets || Object.keys(U)).map((i) => C(i));
    let o = [];
    try {
      o = await ne(e, t);
    } catch (i) {
      console.error(i);
    }
    const a = n.map((i) => ({
      address: e,
      market: i.key
    })).concat(
      o.filter((i) => !!n.find((s) => s.id === i.marketId)).map((i) => ({
        address: i.accountCap,
        market: C(i.marketId).key,
        emodeId: i.emodeId
      }))
    );
    return (await ie(e, a, t)).forEach((i) => {
      const s = typeof i.emodeId == "number" ? o.find((p) => {
        const m = C(i.market);
        return p.emodeId === i.emodeId && p.marketId === m.id;
      }) : void 0;
      if (s) {
        if (!i.pool.emodes.find((m) => m.emodeId === s.emodeId))
          return;
        if (bignumber_default(i.supplyBalance).gte(0)) {
          const m = bignumber_default(i.supplyBalance).shiftedBy(-9).decimalPlaces(i.pool.token.decimals, bignumber_default.ROUND_DOWN), h = L(i.pool, s);
          if (m.gt(0) || h.emode.isCollateral)
            try {
              r.push({
                id: `${i.pool.uniqueId}_${s.emodeId}_navi-lending-emode-supply-${B()}`,
                wallet: e,
                protocol: "navi",
                market: i.market,
                type: "navi-lending-emode-supply",
                "navi-lending-emode-supply": {
                  amount: m.toString(),
                  pool: L(i.pool, s),
                  token: i.pool.token,
                  valueUSD: m.multipliedBy(i.pool.oracle.price).toString(),
                  emodeCap: s
                }
              });
            } catch (w) {
              console.error(w);
            }
        }
        if (bignumber_default(i.borrowBalance).gte(0)) {
          const m = bignumber_default(i.borrowBalance).shiftedBy(-9).decimalPlaces(i.pool.token.decimals, bignumber_default.ROUND_DOWN), h = L(i.pool, s);
          if (m.gt(0) || h.emode.isDebt)
            try {
              r.push({
                id: `${i.pool.uniqueId}_${s.emodeId}_navi-lending-emode-borrow-${B()}`,
                wallet: e,
                protocol: "navi",
                market: i.market,
                type: "navi-lending-emode-borrow",
                "navi-lending-emode-borrow": {
                  amount: m.toString(),
                  pool: L(i.pool, s),
                  token: i.pool.token,
                  valueUSD: m.multipliedBy(i.pool.oracle.price).toString(),
                  emodeCap: s
                }
              });
            } catch (w) {
              console.error(w);
            }
        }
      } else {
        if (bignumber_default(i.supplyBalance).gt(0)) {
          const p = bignumber_default(i.supplyBalance).shiftedBy(-9).decimalPlaces(i.pool.token.decimals, bignumber_default.ROUND_DOWN);
          r.push({
            id: `${i.pool.uniqueId}_navi-lending-supply-${B()}`,
            wallet: e,
            protocol: "navi",
            type: "navi-lending-supply",
            market: i.market,
            "navi-lending-supply": {
              amount: p.toString(),
              pool: i.pool,
              token: i.pool.token,
              valueUSD: p.multipliedBy(i.pool.oracle.price).toString()
            }
          });
        }
        if (bignumber_default(i.borrowBalance).gt(0)) {
          const p = bignumber_default(i.borrowBalance).shiftedBy(-9).decimalPlaces(i.pool.token.decimals, bignumber_default.ROUND_DOWN);
          r.push({
            id: `${i.pool.uniqueId}_navi-lending-borrow-${B()}`,
            wallet: e,
            protocol: "navi",
            market: i.market,
            type: "navi-lending-borrow",
            "navi-lending-borrow": {
              amount: p.toString(),
              pool: i.pool,
              token: i.pool.token,
              valueUSD: p.multipliedBy(i.pool.oracle.price).toString()
            }
          });
        }
      }
    }), r;
  }
);
var D = class _D {
  constructor(t, r) {
    this._positions = [], this._priceMap = {}, this._overview = {
      hf: 1 / 0,
      netVaule: "0",
      netWorthApr: "0",
      totalSupplyValue: "0",
      totalBorrowValue: "0",
      totalsupplyApy: "0",
      totalBorrowApy: "0",
      maxLiquidationValue: "0",
      maxLoanToVaule: "0",
      supply: {},
      borrow: {}
    }, this._priceMap = r || {}, this.positions = t;
  }
  get positions() {
    return this._positions;
  }
  get overview() {
    return this._overview;
  }
  get priceMap() {
    return this._priceMap;
  }
  set positions(t) {
    this._positions = t, this._overview = this.getPositionsOverview(t);
  }
  updatePriceMap(t) {
    return this._priceMap = t, this._overview = this.getPositionsOverview(this._positions), this;
  }
  getPrice(t) {
    const r = k(t.suiCoinType);
    if (this._priceMap[r] !== void 0)
      return this._priceMap[r].toString();
    const n = t.suiCoinType;
    return this._priceMap[n] !== void 0 ? this._priceMap[n].toString() : t.oracle.price;
  }
  filterPositionsByPool(t) {
    const n = !!t.isEMode ? ["navi-lending-emode-supply", "navi-lending-emode-borrow"] : ["navi-lending-supply", "navi-lending-borrow"];
    return new _D(
      this.positions.filter((o) => {
        const a = o[o.type];
        return n.includes(o.type) && a.pool.uniqueId === t.uniqueId;
      }),
      this._priceMap
    );
  }
  deposit(t, r) {
    const n = !!t.isEMode, o = this.getPrice(t);
    let a;
    return n ? a = {
      id: B(),
      wallet: "",
      protocol: "navi",
      market: "",
      type: "navi-lending-emode-supply",
      "navi-lending-emode-supply": {
        amount: r.toString(),
        valueUSD: bignumber_default(r).multipliedBy(o).toString(),
        token: t.token,
        pool: t,
        emodeCap: {}
      }
    } : a = {
      id: B(),
      wallet: "",
      protocol: "navi",
      market: "",
      type: "navi-lending-supply",
      "navi-lending-supply": {
        amount: r.toString(),
        valueUSD: bignumber_default(r).multipliedBy(o).toString(),
        token: t.token,
        pool: t
      }
    }, new _D([...this.positions, a], this._priceMap);
  }
  withdraw(t, r) {
    const n = !!t.isEMode, o = this.getPrice(t);
    let a;
    return n ? a = {
      id: B(),
      wallet: "",
      protocol: "navi",
      market: "",
      type: "navi-lending-emode-supply",
      "navi-lending-emode-supply": {
        amount: (-r).toString(),
        valueUSD: bignumber_default(-r).multipliedBy(o).toString(),
        token: t.token,
        pool: t,
        emodeCap: {}
      }
    } : a = {
      id: B(),
      wallet: "",
      protocol: "navi",
      market: "",
      type: "navi-lending-supply",
      "navi-lending-supply": {
        amount: (-r).toString(),
        valueUSD: bignumber_default(-r).multipliedBy(o).toString(),
        token: t.token,
        pool: t
      }
    }, new _D([...this.positions, a], this._priceMap);
  }
  borrow(t, r) {
    const n = !!t.isEMode, o = this.getPrice(t);
    let a;
    return n ? a = {
      id: B(),
      wallet: "",
      protocol: "navi",
      market: "",
      type: "navi-lending-emode-borrow",
      "navi-lending-emode-borrow": {
        amount: r.toString(),
        valueUSD: bignumber_default(r).multipliedBy(o).toString(),
        token: t.token,
        pool: t,
        emodeCap: {}
      }
    } : a = {
      id: B(),
      wallet: "",
      protocol: "navi",
      market: "",
      type: "navi-lending-borrow",
      "navi-lending-borrow": {
        amount: r.toString(),
        valueUSD: bignumber_default(r).multipliedBy(o).toString(),
        token: t.token,
        pool: t
      }
    }, new _D([...this.positions, a], this._priceMap);
  }
  repay(t, r) {
    const n = !!t.isEMode, o = this.getPrice(t);
    let a;
    return n ? a = {
      id: B(),
      wallet: "",
      protocol: "navi",
      market: "",
      type: "navi-lending-emode-borrow",
      "navi-lending-emode-borrow": {
        amount: (-r).toString(),
        valueUSD: bignumber_default(-r).multipliedBy(o).toString(),
        token: t.token,
        pool: t,
        emodeCap: {}
      }
    } : a = {
      id: B(),
      wallet: "",
      protocol: "navi",
      market: "",
      type: "navi-lending-borrow",
      "navi-lending-borrow": {
        amount: (-r).toString(),
        valueUSD: bignumber_default(-r).multipliedBy(o).toString(),
        token: t.token,
        pool: t
      }
    }, new _D([...this.positions, a], this._priceMap);
  }
  resolveValueUSD(t) {
    return Object.keys(this._priceMap).length > 0 ? bignumber_default(t.amount).multipliedBy(this.getPrice(t.pool)).toString() : t.valueUSD;
  }
  getPositionsOverview(t) {
    const r = {}, n = {};
    let o = new bignumber_default(0), a = new bignumber_default(0), c = new bignumber_default(0), i = new bignumber_default(0), s = new bignumber_default(0), p = new bignumber_default(0);
    t.forEach((y) => {
      if (y.type === "navi-lending-supply") {
        const u = y["navi-lending-supply"], f = this.resolveValueUSD(u);
        o = o.plus(f), s = s.plus(
          new bignumber_default(f).multipliedBy(u.pool.liquidationFactor.threshold)
        ), p = p.plus(
          new bignumber_default(f).multipliedBy(u.pool.ltvValue)
        );
      } else if (y.type === "navi-lending-borrow") {
        const u = y["navi-lending-borrow"];
        a = a.plus(this.resolveValueUSD(u));
      } else if (y.type === "navi-lending-emode-supply") {
        const u = y["navi-lending-emode-supply"], f = this.resolveValueUSD(u);
        o = o.plus(f);
        const v = u.pool.emode;
        s = s.plus(
          new bignumber_default(f).multipliedBy(v.lt)
        ), p = p.plus(
          new bignumber_default(f).multipliedBy(v.ltv)
        );
      } else if (y.type === "navi-lending-emode-borrow") {
        const u = y["navi-lending-emode-borrow"];
        a = a.plus(this.resolveValueUSD(u));
      }
    }), a = bignumber_default.max(a, 0), o = bignumber_default.max(o, 0), s = bignumber_default.max(s, 0), p = bignumber_default.max(p, 0), t.forEach((y) => {
      if (y.type === "navi-lending-supply") {
        const u = y["navi-lending-supply"], f = this.resolveValueUSD(u), v = u.pool.supplyIncentiveApyInfo.apy;
        o.gt(0) && (c = c.plus(
          new bignumber_default(f).dividedBy(o).multipliedBy(new bignumber_default(v).dividedBy(100))
        )), r[u.pool.suiCoinType] = bignumber_default(r[u.pool.suiCoinType] || 0).plus(u.amount).toString();
      } else if (y.type === "navi-lending-borrow") {
        const u = y["navi-lending-borrow"], f = this.resolveValueUSD(u), v = u.pool.borrowIncentiveApyInfo.apy;
        a.gt(0) && (i = i.plus(
          new bignumber_default(f).dividedBy(a).multipliedBy(new bignumber_default(v).dividedBy(100))
        )), n[u.pool.suiCoinType] = bignumber_default(n[u.pool.suiCoinType] || 0).plus(u.amount).toString();
      } else if (y.type === "navi-lending-emode-supply") {
        const u = y["navi-lending-emode-supply"], f = this.resolveValueUSD(u), v = u.pool.supplyIncentiveApyInfo.apy;
        o.gt(0) && (c = c.plus(
          new bignumber_default(f).dividedBy(o).multipliedBy(new bignumber_default(v).dividedBy(100))
        )), r[u.pool.suiCoinType] = bignumber_default(r[u.pool.suiCoinType] || 0).plus(u.amount).toString();
      } else if (y.type === "navi-lending-emode-borrow") {
        const u = y["navi-lending-emode-borrow"], f = this.resolveValueUSD(u), v = u.pool.borrowIncentiveApyInfo.apy;
        a.gt(0) && (i = i.plus(
          new bignumber_default(f).dividedBy(a).multipliedBy(new bignumber_default(v).dividedBy(100))
        )), n[u.pool.suiCoinType] = bignumber_default(n[u.pool.suiCoinType] || 0).plus(u.amount).toString();
      }
    });
    const m = o.minus(a), h = o.minus(a).eq(0) ? new bignumber_default(0) : o.multipliedBy(c).minus(a.multipliedBy(i)).div(o.minus(a));
    return {
      hf: a.toNumber() !== 0 ? s.dividedBy(a).toNumber() : 1 / 0,
      netVaule: m.toString(),
      netWorthApr: h.toString(),
      totalSupplyValue: o.toString(),
      totalBorrowValue: a.toString(),
      totalsupplyApy: c.toString(),
      totalBorrowApy: i.toString(),
      maxLiquidationValue: s.toString(),
      maxLoanToVaule: p.toString(),
      supply: r,
      borrow: n
    };
  }
};
async function bt(e, t, r, n) {
  const o = await _({
    ...n,
    cacheTime: b
  });
  o.limter && e.moveCall({
    target: `${o.limter}::navi_adaptor::verify_navi_position_healthy`,
    arguments: [
      e.object("0x06"),
      e.object(o.storage),
      e.object(o.priceOracle),
      g(t, e.pure.address),
      e.pure.u256(new bignumber_default(r).shiftedBy(27).toNumber())
    ]
  });
}
var ce = new te("https://hermes.pyth.network", {
  timeout: 1e4
});
async function kt(e) {
  try {
    const t = [], r = await ce.getLatestPriceFeeds(e);
    if (!r) return t;
    const n = Math.floor((/* @__PURE__ */ new Date()).valueOf() / 1e3);
    for (const o of r) {
      const a = o.getPriceUnchecked();
      if (a.publishTime > n) {
        console.warn(
          `pyth price feed is invalid, id: ${o.id}, publish time: ${a.publishTime}, current timestamp: ${n}`
        );
        continue;
      }
      n - o.getPriceUnchecked().publishTime > 30 && (console.info(
        `stale price feed, id: ${o.id}, publish time: ${a.publishTime}, current timestamp: ${n}`
      ), t.push(o.id));
    }
    return t;
  } catch (t) {
    throw new Error(`failed to get pyth stale price feed id, msg: ${t.message}`);
  }
}
async function Le(e, t) {
  try {
    const r = [], n = t?.client ?? V, o = e.map((c) => c.priceInfoObject), a = await n.multiGetObjects({
      ids: Array.from(new Set(o)),
      options: { showContent: true }
    });
    for (const c of a) {
      const i = c.data;
      if (!i || !i.content || i.content.dataType !== "moveObject") {
        console.warn(`fetched object ${i?.objectId} datatype should be moveObject`);
        continue;
      }
      const s = e.find((u) => u.priceInfoObject == i.objectId);
      if (!s) {
        console.warn(`unable to find pyth info from array, priceInfoObject: ${i.objectId}`);
        continue;
      }
      const p = i.content.fields.price_info.fields.price_feed.fields.price.fields, { magnitude: m, negative: h } = p.price.fields, w = p.conf, y = p.timestamp;
      r.push({
        priceFeedId: s.priceFeedId,
        priceInfoObject: s.priceInfoObject,
        price: h ? "-" + m : m,
        conf: w,
        publishTime: Number(y),
        expiration: s.expiration
      });
    }
    return r;
  } catch (r) {
    console.error(r, `Polling Sui on-chain price for ${e} failed.`);
    return;
  }
}
async function He(e, t) {
  try {
    const r = [], n = await Le(e, t);
    if (!n) return r;
    const o = Math.floor((/* @__PURE__ */ new Date()).valueOf() / 1e3);
    for (const a of n) {
      if (a.publishTime > o) {
        console.warn(
          `pyth price feed is invalid, id: ${a.priceFeedId}, publish time: ${a.publishTime}, current timestamp: ${o}`
        );
        continue;
      }
      const c = a.expiration || 60;
      o - a.publishTime > c && (console.info(
        `stale price feed, id: ${a.priceFeedId}, publish time: ${a.publishTime}, current timestamp: ${o}`
      ), r.push(a.priceFeedId));
    }
    return r;
  } catch (r) {
    throw new Error(`failed to get pyth stale price feed id, msg: ${r.message}`);
  }
}
async function We(e, t, r) {
  const n = r?.client ?? V, o = await _({
    ...r,
    cacheTime: b
  });
  try {
    const a = await ce.getPriceFeedsUpdateData(t);
    return await new $e(
      n,
      o.oracle.pythStateId,
      o.oracle.wormholeStateId
    ).updatePriceFeeds(e, a, t);
  } catch (a) {
    throw new Error(`failed to update pyth price feeds, msg: ${a.message}`);
  }
}
async function ze(e, t, r) {
  const n = await _({
    ...r,
    cacheTime: b
  });
  if (r?.updatePythPriceFeeds) {
    const o = t.filter((a) => !!a.pythPriceFeedId && !!a.pythPriceInfoObject).map((a) => ({
      priceFeedId: a.pythPriceFeedId,
      priceInfoObject: a.pythPriceInfoObject,
      expiration: 30
    }));
    try {
      const a = await He(o, r);
      a.length > 0 && await We(e, a, r);
    } catch {
      console.error("Failed to update Pyth price feeds");
    }
  }
  for (const o of t)
    r?.env === "dev" ? e.moveCall({
      target: `${n.oracle.packageId}::oracle_pro::update_single_price`,
      arguments: [
        e.object("0x6"),
        // Clock object
        e.object(n.oracle.oracleConfig),
        // Oracle configuration
        e.object(n.oracle.priceOracle),
        // Price oracle contract
        e.object(n.oracle.supraOracleHolder),
        // Supra oracle holder
        e.object(o.pythPriceInfoObject),
        // Pyth price info object
        e.pure.address(o.feedId)
        // Price feed ID
      ]
    }) : e.moveCall({
      target: `${n.oracle.packageId}::oracle_pro::update_single_price_v2`,
      arguments: [
        e.object("0x6"),
        // Clock object
        e.object(n.oracle.oracleConfig),
        // Oracle configuration
        e.object(n.oracle.priceOracle),
        // Price oracle contract
        e.object(n.oracle.supraOracleHolder),
        // Supra oracle holder
        e.object(o.pythPriceInfoObject),
        // Pyth price info object
        e.object(n.oracle.switchboardAggregator),
        e.pure.address(o.feedId)
        // Price feed ID
      ]
    });
  return e;
}
async function se(e) {
  return (await _({
    ...e,
    cacheTime: b
  })).oracle.feeds;
}
function Ge(e, t) {
  return e.filter((r) => !!(t?.lendingState && t.lendingState.find((o) => r.oracleId === o.pool.oracleId) || t?.lendingPositions && t.lendingPositions.find((o) => {
    if (![
      "navi-lending-supply",
      "navi-lending-borrow",
      "navi-lending-emode-supply",
      "navi-lending-emode-borrow"
    ].includes(o.type))
      return false;
    const c = o[o.type]?.pool;
    return r.oracleId === c?.oracleId;
  }) || t?.pools && t.pools.find((o) => r.oracleId === o.oracleId)));
}
async function _t(e, t, r, n) {
  try {
    const o = await se({
      ...n
    }), a = [];
    r.forEach((p) => {
      a.includes(p.market) || a.push(p.market);
    });
    const c = await qe(t, {
      ...n,
      markets: a
    }), i = Ge(o, {
      lendingPositions: c,
      pools: r
    });
    return await ze(e, i, {
      updatePythPriceFeeds: true,
      ...n
    });
  } catch (o) {
    if (n?.throws)
      throw o;
    return console.error(o), e;
  }
}
var Y = S(
  A(
    async (e) => {
      const t = `https://open-api.naviprotocol.io/api/navi/flashloan?env=${e?.env || "prod"}&sdk=${M.version}&market=${e?.market || O}`, r = await fetch(t, { headers: E }).then((n) => n.json());
      return Object.keys(r.data).map((n) => ({
        ...r.data[n],
        coinType: n
      }));
    }
  )
);
async function jt(e, t) {
  return (await Y(t)).find((n) => typeof e == "string" ? k(n.coinType) === k(e) : typeof e == "number" ? n.assetId === e : n.assetId === e.id) || null;
}
async function It(e, t, r, n) {
  const o = await _({
    ...n,
    cacheTime: b
  }), a = await $(t, n);
  if (!(await Y({
    ...n,
    cacheTime: b
  })).some(
    (s) => k(s.coinType) === k(a.suiCoinType)
  ))
    throw new Error("Pool does not support flashloan");
  if (o.version === 1) {
    const [s, p] = e.moveCall({
      target: `${o.package}::lending::flash_loan_with_ctx`,
      arguments: [
        e.object(o.flashloanConfig),
        e.object(a.contract.pool),
        g(r, e.pure.u64)
      ],
      typeArguments: [a.suiCoinType]
    });
    return [s, p];
  } else {
    const [s, p] = e.moveCall({
      target: `${o.package}::lending::flash_loan_with_ctx_v2`,
      arguments: [
        e.object(o.flashloanConfig),
        e.object(a.contract.pool),
        g(r, e.pure.u64),
        e.object("0x05")
      ],
      typeArguments: [a.suiCoinType]
    });
    return [s, p];
  }
}
async function Ct(e, t, r, n, o) {
  const a = await _({
    ...o,
    cacheTime: b
  }), c = await $(t, o);
  if (!(await Y({
    ...o,
    cacheTime: b
  })).some(
    (m) => k(m.coinType) === k(c.suiCoinType)
  ))
    throw new Error("Pool does not support flashloan");
  const [p] = e.moveCall({
    target: `${a.package}::lending::flash_repay_with_ctx`,
    arguments: [
      e.object("0x06"),
      e.object(a.storage),
      e.object(c.contract.pool),
      g(r, e.object),
      g(n, e.object)
    ],
    typeArguments: [c.suiCoinType]
  });
  return [p];
}
async function Tt(e, t, r, n, o, a) {
  const c = {
    ...a,
    cacheTime: b
  }, i = await _(c), s = await $(t, c), p = await $(n, c);
  if (i.version === 1) {
    const [m, h] = e.moveCall({
      target: `${i.package}::incentive_v3::liquidation`,
      arguments: [
        e.object("0x06"),
        // Clock object
        e.object(i.priceOracle),
        // Price oracle for asset pricing
        e.object(i.storage),
        // Protocol storage
        e.pure.u8(s.id),
        // Pay asset ID
        e.object(s.contract.pool),
        // Pay asset pool contract
        g(r, e.object),
        // Debt repayment amount
        e.pure.u8(p.id),
        // Collateral asset ID
        e.object(p.contract.pool),
        // Collateral asset pool contract
        g(o, e.pure.address),
        // Borrower address
        e.object(i.incentiveV2),
        // Incentive V2 contract
        e.object(i.incentiveV3)
        // Incentive V3 contract
      ],
      typeArguments: [s.suiCoinType, p.suiCoinType]
    });
    return [m, h];
  } else {
    const [m, h] = e.moveCall({
      target: `${i.package}::incentive_v3::liquidation_v2`,
      arguments: [
        e.object("0x06"),
        // Clock object
        e.object(i.priceOracle),
        // Price oracle for asset pricing
        e.object(i.storage),
        // Protocol storage
        e.pure.u8(s.id),
        // Pay asset ID
        e.object(s.contract.pool),
        // Pay asset pool contract
        g(r, e.object),
        // Debt repayment amount
        e.pure.u8(p.id),
        // Collateral asset ID
        e.object(p.contract.pool),
        // Collateral asset pool contract
        g(o, e.pure.address),
        // Borrower address
        e.object(i.incentiveV2),
        // Incentive V2 contract
        e.object(i.incentiveV3),
        // Incentive V3 contract
        e.object("0x05")
        // SuiSystemState object
      ],
      typeArguments: [s.suiCoinType, p.suiCoinType]
    });
    return [m, h];
  }
}
async function Ke(e, t, r) {
  const n = r?.client ?? V, o = new import_transactions.Transaction(), a = await R({
    ...r,
    markets: Object.values(U),
    cacheTime: b
  }), c = await se(r);
  for (let m of t) {
    const h = await _({
      ...r,
      cacheTime: b,
      market: m.market
    });
    o.moveCall({
      target: `${h.uiGetter}::incentive_v3_getter::get_user_atomic_claimable_rewards`,
      arguments: [
        o.object("0x06"),
        // Clock object
        o.object(h.storage),
        // Protocol storage
        o.object(h.incentiveV3),
        // Incentive V3 contract
        o.pure.address(m.address)
        // User address
      ]
    });
  }
  const i = await n.devInspectTransactionBlock({
    transactionBlock: o,
    sender: e
  }), s = [];
  i?.results?.forEach((m) => {
    s.push(
      H(
        {
          results: [m]
        },
        [
          import_bcs.bcs.vector(import_bcs.bcs.string()),
          // Asset coin types
          import_bcs.bcs.vector(import_bcs.bcs.string()),
          // Reward coin types
          import_bcs.bcs.vector(import_bcs.bcs.u8()),
          // Reward options
          import_bcs.bcs.vector(import_bcs.bcs.Address),
          // Rule IDs
          import_bcs.bcs.vector(import_bcs.bcs.u256())
          // Claimable amounts
        ]
      )
    );
  });
  const p = [];
  return s.forEach((m, h) => {
    const w = t[h];
    if (m.length === 5 && Array.isArray(m[0])) {
      const y = m[0].length;
      for (let u = 0; u < y; u++) {
        const f = c.find(
          (I) => k(I.coinType) === k(m[1][u])
        ), v = a.find(
          (I) => k(I.coinType) === k(m[0][u]) && I.market === w.market
        );
        !f || !v || p.push({
          assetId: v.id,
          assetCoinType: k(m[0][u]),
          rewardCoinType: k(m[1][u]),
          option: Number(m[2][u]),
          userClaimableReward: Number(m[4][u]) / Math.pow(10, f.priceDecimal),
          ruleIds: Array.isArray(m[3][u]) ? m[3][u] : [m[3][u]],
          market: w.market,
          owner: w.owner,
          address: w.address,
          emodeId: w.emodeId
        });
      }
    }
  }), p;
}
async function Pt(e, t) {
  const r = (t?.markets || [U.main]).map((a) => C(a));
  let n = [];
  try {
    n = await ne(e, t);
  } catch (a) {
    console.error(a);
  }
  const o = r.map((a) => ({
    address: e,
    owner: e,
    market: a.key
  })).concat(
    n.filter((a) => !!r.find((c) => c.id === a.marketId)).map((a) => {
      const c = C(a.marketId);
      return {
        address: a.accountCap,
        owner: e,
        market: c.key,
        emodeId: a.emodeId
      };
    })
  );
  return await Ke(e, o, t);
}
function Bt(e) {
  const t = /* @__PURE__ */ new Map();
  e.forEach((n) => {
    const o = n.assetId, a = n.option, c = `${o}-${a}-${n.rewardCoinType}-${n.market}`;
    t.has(c) ? t.get(c).total += n.userClaimableReward : t.set(c, {
      assetId: o,
      rewardType: a,
      coinType: n.rewardCoinType,
      total: Number(n.userClaimableReward),
      market: n.market
    });
  });
  const r = /* @__PURE__ */ new Map();
  for (const { assetId: n, rewardType: o, coinType: a, total: c, market: i } of t.values()) {
    const s = `${n}-${o}-${i}`;
    r.has(s) || r.set(s, { assetId: n, rewardType: o, market: i, rewards: /* @__PURE__ */ new Map() });
    const p = r.get(s);
    p.rewards.set(a, (p.rewards.get(a) || 0) + c);
  }
  return Array.from(r.values()).map((n) => ({
    assetId: n.assetId,
    rewardType: n.rewardType,
    market: n.market,
    rewards: Array.from(n.rewards.entries()).map(([o, a]) => ({
      coinType: o,
      available: a.toFixed(6)
    }))
  }));
}
var At = A(
  async (e, t) => {
    const r = `https://open-api.naviprotocol.io/api/navi/user/total_claimed_reward?userAddress=${e}&sdk=${M.version}&market=${t?.market || O}`;
    return (await fetch(r, { headers: E }).then((o) => o.json())).data;
  }
);
var $t = A(
  async (e, t) => {
    const r = `https://open-api.naviprotocol.io/api/navi/user/rewards?userAddress=${e}&page=${t?.page || 1}&pageSize=${t?.size || 400}&sdk=${M.version}&market=${t?.market || O}`, n = await fetch(r, { headers: E }).then((o) => o.json());
    return G({
      data: n.data.rewards
    });
  }
);
async function St(e, t, r) {
  const n = await R({
    ...r,
    markets: Object.values(U),
    cacheTime: b
  }), o = /* @__PURE__ */ new Map();
  for (const c of t) {
    const { rewardCoinType: i, ruleIds: s, market: p, owner: m, address: h, emodeId: w } = c, y = `${i}___${h}__${p}`;
    for (const u of s) {
      o.has(y) || o.set(y, {
        assetIds: [],
        ruleIds: [],
        amount: 0,
        market: p,
        owner: m,
        address: h,
        isEMode: typeof w < "u"
      });
      const f = o.get(y);
      f.assetIds.push(c.assetCoinType.replace("0x", "")), f.ruleIds.push(u), f.amount += c.userClaimableReward;
    }
  }
  const a = [];
  for (const [
    c,
    { assetIds: i, ruleIds: s, amount: p, market: m, owner: h, address: w, isEMode: y }
  ] of o) {
    const u = await _({
      ...r,
      cacheTime: b,
      market: m
    }), f = c.split("___")[0], v = n.filter(
      (j) => k(j.suiCoinType) === k(f)
    );
    v.sort((j, P) => j.market === m ? -1 : 1);
    const I = v[0], T = u.rewardFunds[k(f)];
    if (!T)
      throw new Error(`No matching rewardFund found for reward coin: ${f} ${m}`);
    if (r?.accountCap && !r.customCoinReceive)
      throw new Error("customCoinReceive is required when accountCap is provided");
    if (r?.customCoinReceive) {
      let j;
      r.accountCap ? j = e.moveCall({
        target: `${u.package}::incentive_v3::claim_reward_with_account_cap`,
        arguments: [
          e.object("0x06"),
          // Clock object
          e.object(u.incentiveV3),
          // Incentive V3 contract
          e.object(u.storage),
          // Protocol storage
          e.object(T),
          // Reward fund
          e.pure.vector("string", i),
          // Asset IDs
          e.pure.vector("address", s),
          // Rule IDs
          g(r.accountCap, e.object)
          // Account capability
        ],
        typeArguments: [f]
      }) : y ? j = e.moveCall({
        target: `${u.package}::incentive_v3::claim_reward_with_account_cap`,
        arguments: [
          e.object("0x06"),
          // Clock object
          e.object(u.incentiveV3),
          // Incentive V3 contract
          e.object(u.storage),
          // Protocol storage
          e.object(T),
          // Reward fund
          e.pure.vector("string", i),
          // Asset IDs
          e.pure.vector("address", s),
          // Rule IDs
          g(w, e.object)
          // Account capability
        ],
        typeArguments: [f]
      }) : j = e.moveCall({
        target: `${u.package}::incentive_v3::claim_reward`,
        arguments: [
          e.object("0x06"),
          // Clock object
          e.object(u.incentiveV3),
          // Incentive V3 contract
          e.object(u.storage),
          // Protocol storage
          e.object(T),
          // Reward fund
          e.pure.vector("string", i),
          // Asset IDs
          e.pure.vector("address", s)
          // Rule IDs
        ],
        typeArguments: [f]
      });
      const [P] = e.moveCall({
        target: "0x2::coin::from_balance",
        arguments: [j],
        typeArguments: [f]
      });
      if (r?.customCoinReceive.type === "transfer") {
        if (!r.customCoinReceive.transfer)
          throw new Error("customCoinReceive.transfer is required");
        e.transferObjects(
          [P],
          g(r.customCoinReceive.transfer, e.pure.address)
        );
      }
      if (r?.customCoinReceive.type === "depositNAVI") {
        const q = bignumber_default(I.totalSupplyAmount).shiftedBy(-9), W = bignumber_default(I.supplyCapCeiling).shiftedBy(-27);
        q.plus(p).isGreaterThan(W) && r?.customCoinReceive.depositNAVI?.fallbackReceiveAddress ? e.transferObjects(
          [P],
          e.pure.address(r.customCoinReceive.depositNAVI.fallbackReceiveAddress)
        ) : await Ee(e, I, P, {
          ...r,
          market: I.market
        });
      } else
        a.push({
          coin: P,
          identifier: I,
          owner: h,
          isEMode: y
        });
    } else if (r?.accountCap || y) {
      const j = e.moveCall({
        target: `${u.package}::incentive_v3::claim_reward_with_account_cap`,
        arguments: [
          e.object("0x06"),
          // Clock object
          e.object(u.incentiveV3),
          // Incentive V3 contract
          e.object(u.storage),
          // Protocol storage
          e.object(T),
          // Reward fund
          e.pure.vector("string", i),
          // Asset IDs
          e.pure.vector("address", s),
          // Rule IDs
          g(r?.accountCap || w, e.object)
          // Account capability
        ],
        typeArguments: [f]
      }), [P] = e.moveCall({
        target: "0x2::coin::from_balance",
        arguments: [j],
        typeArguments: [f]
      });
      e.transferObjects(
        [P],
        g(r?.accountCap || h, e.pure.address)
      );
    } else
      e.moveCall({
        target: `${u.package}::incentive_v3::claim_reward_entry`,
        arguments: [
          e.object("0x06"),
          // Clock object
          e.object(u.incentiveV3),
          // Incentive V3 contract
          e.object(u.storage),
          // Protocol storage
          e.object(T),
          // Reward fund
          e.pure.vector("string", i),
          // Asset IDs
          e.pure.vector("address", s)
          // Rule IDs
        ],
        typeArguments: [f]
      });
  }
  return a;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Address,
  DEFAULT_CACHE_TIME,
  DEFAULT_MARKET_IDENTITY,
  FlashLoanAssetConfig,
  IncentiveAPYInfo,
  IncentivePoolInfo,
  IncentivePoolInfoByPhase,
  MARKETS,
  Market,
  OracleInfo,
  PoolOperator,
  ReserveDataInfo,
  SuiPriceServiceConnection,
  SuiPythClient,
  UserPositions,
  UserStateInfo,
  borrowCoinPTB,
  claimLendingRewardsPTB,
  createAccountCapPTB,
  createEModeCapPTB,
  createNaviSuiClient,
  depositCoinPTB,
  emodeIdentityId,
  enterEModePTB,
  exitEModePTB,
  filterPriceFeeds,
  flashloanPTB,
  getAccountCapOwnerPTB,
  getAllFlashLoanAssets,
  getBorrowFee,
  getCoins,
  getConfig,
  getFees,
  getFlashLoanAsset,
  getHealthFactor,
  getHealthFactorPTB,
  getLendingPositions,
  getLendingState,
  getMarket,
  getMarketConfig,
  getMarkets,
  getPool,
  getPools,
  getPriceFeeds,
  getPythStalePriceFeedId,
  getPythStalePriceFeedIdV2,
  getSimulatedHealthFactor,
  getSimulatedHealthFactorPTB,
  getStats,
  getTransactions,
  getUserAvailableLendingRewards,
  getUserClaimedRewardHistory,
  getUserEModeCaps,
  getUserTotalClaimedReward,
  liquidatePTB,
  mergeCoinsPTB,
  normalizeCoinType,
  parsePoolUID,
  parseTxValue,
  repayCoinPTB,
  repayFlashLoanPTB,
  summaryLendingRewards,
  updateOraclePriceBeforeUserOperationPTB,
  updateOraclePricesPTB,
  updatePythPriceFeeds,
  verifyHealthFactorPTB,
  withCache,
  withSingleton,
  withdrawCoinPTB
});

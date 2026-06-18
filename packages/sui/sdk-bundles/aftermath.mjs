import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// ../../node_modules/.pnpm/aftermath-ts-sdk@2.1.0_@mysten+sui@2.18.0_typescript@5.9.3_/node_modules/aftermath-ts-sdk/dist/index.js
import {
  Transaction
} from "@mysten/sui/transactions";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { Transaction as Transaction2 } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import {
  Transaction as Transaction3
} from "@mysten/sui/transactions";
import {
  Transaction as Transaction4
} from "@mysten/sui/transactions";
import {
  Transaction as Transaction5
} from "@mysten/sui/transactions";
import { Transaction as Transaction6 } from "@mysten/sui/transactions";

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/constants.js
var daysInYear = 365.2425;
var maxTime = Math.pow(10, 8) * 24 * 60 * 60 * 1e3;
var minTime = -maxTime;
var millisecondsInWeek = 6048e5;
var millisecondsInDay = 864e5;
var secondsInHour = 3600;
var secondsInDay = secondsInHour * 24;
var secondsInWeek = secondsInDay * 7;
var secondsInYear = secondsInDay * daysInYear;
var secondsInMonth = secondsInYear / 12;
var secondsInQuarter = secondsInMonth * 3;
var constructFromSymbol = /* @__PURE__ */ Symbol.for("constructDateFrom");

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/constructFrom.js
function constructFrom(date, value) {
  if (typeof date === "function") return date(value);
  if (date && typeof date === "object" && constructFromSymbol in date)
    return date[constructFromSymbol](value);
  if (date instanceof Date) return new date.constructor(value);
  return new Date(value);
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/toDate.js
function toDate(argument, context) {
  return constructFrom(context || argument, argument);
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/_lib/defaultOptions.js
var defaultOptions = {};
function getDefaultOptions() {
  return defaultOptions;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/startOfWeek.js
function startOfWeek(date, options) {
  const defaultOptions2 = getDefaultOptions();
  const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
  const _date = toDate(date, options?.in);
  const day = _date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  _date.setDate(_date.getDate() - diff);
  _date.setHours(0, 0, 0, 0);
  return _date;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/startOfISOWeek.js
function startOfISOWeek(date, options) {
  return startOfWeek(date, { ...options, weekStartsOn: 1 });
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/getISOWeekYear.js
function getISOWeekYear(date, options) {
  const _date = toDate(date, options?.in);
  const year = _date.getFullYear();
  const fourthOfJanuaryOfNextYear = constructFrom(_date, 0);
  fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
  fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfISOWeek(fourthOfJanuaryOfNextYear);
  const fourthOfJanuaryOfThisYear = constructFrom(_date, 0);
  fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
  fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfISOWeek(fourthOfJanuaryOfThisYear);
  if (_date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (_date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/_lib/getTimezoneOffsetInMilliseconds.js
function getTimezoneOffsetInMilliseconds(date) {
  const _date = toDate(date);
  const utcDate = new Date(
    Date.UTC(
      _date.getFullYear(),
      _date.getMonth(),
      _date.getDate(),
      _date.getHours(),
      _date.getMinutes(),
      _date.getSeconds(),
      _date.getMilliseconds()
    )
  );
  utcDate.setUTCFullYear(_date.getFullYear());
  return +date - +utcDate;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/_lib/normalizeDates.js
function normalizeDates(context, ...dates) {
  const normalize = constructFrom.bind(
    null,
    context || dates.find((date) => typeof date === "object")
  );
  return dates.map(normalize);
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/startOfDay.js
function startOfDay(date, options) {
  const _date = toDate(date, options?.in);
  _date.setHours(0, 0, 0, 0);
  return _date;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/differenceInCalendarDays.js
function differenceInCalendarDays(laterDate, earlierDate, options) {
  const [laterDate_, earlierDate_] = normalizeDates(
    options?.in,
    laterDate,
    earlierDate
  );
  const laterStartOfDay = startOfDay(laterDate_);
  const earlierStartOfDay = startOfDay(earlierDate_);
  const laterTimestamp = +laterStartOfDay - getTimezoneOffsetInMilliseconds(laterStartOfDay);
  const earlierTimestamp = +earlierStartOfDay - getTimezoneOffsetInMilliseconds(earlierStartOfDay);
  return Math.round((laterTimestamp - earlierTimestamp) / millisecondsInDay);
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/startOfISOWeekYear.js
function startOfISOWeekYear(date, options) {
  const year = getISOWeekYear(date, options);
  const fourthOfJanuary = constructFrom(options?.in || date, 0);
  fourthOfJanuary.setFullYear(year, 0, 4);
  fourthOfJanuary.setHours(0, 0, 0, 0);
  return startOfISOWeek(fourthOfJanuary);
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/isDate.js
function isDate(value) {
  return value instanceof Date || typeof value === "object" && Object.prototype.toString.call(value) === "[object Date]";
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/isValid.js
function isValid(date) {
  return !(!isDate(date) && typeof date !== "number" || isNaN(+toDate(date)));
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/startOfYear.js
function startOfYear(date, options) {
  const date_ = toDate(date, options?.in);
  date_.setFullYear(date_.getFullYear(), 0, 1);
  date_.setHours(0, 0, 0, 0);
  return date_;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/locale/en-US/_lib/formatDistance.js
var formatDistanceLocale = {
  lessThanXSeconds: {
    one: "less than a second",
    other: "less than {{count}} seconds"
  },
  xSeconds: {
    one: "1 second",
    other: "{{count}} seconds"
  },
  halfAMinute: "half a minute",
  lessThanXMinutes: {
    one: "less than a minute",
    other: "less than {{count}} minutes"
  },
  xMinutes: {
    one: "1 minute",
    other: "{{count}} minutes"
  },
  aboutXHours: {
    one: "about 1 hour",
    other: "about {{count}} hours"
  },
  xHours: {
    one: "1 hour",
    other: "{{count}} hours"
  },
  xDays: {
    one: "1 day",
    other: "{{count}} days"
  },
  aboutXWeeks: {
    one: "about 1 week",
    other: "about {{count}} weeks"
  },
  xWeeks: {
    one: "1 week",
    other: "{{count}} weeks"
  },
  aboutXMonths: {
    one: "about 1 month",
    other: "about {{count}} months"
  },
  xMonths: {
    one: "1 month",
    other: "{{count}} months"
  },
  aboutXYears: {
    one: "about 1 year",
    other: "about {{count}} years"
  },
  xYears: {
    one: "1 year",
    other: "{{count}} years"
  },
  overXYears: {
    one: "over 1 year",
    other: "over {{count}} years"
  },
  almostXYears: {
    one: "almost 1 year",
    other: "almost {{count}} years"
  }
};
var formatDistance = (token, count, options) => {
  let result;
  const tokenValue = formatDistanceLocale[token];
  if (typeof tokenValue === "string") {
    result = tokenValue;
  } else if (count === 1) {
    result = tokenValue.one;
  } else {
    result = tokenValue.other.replace("{{count}}", count.toString());
  }
  if (options?.addSuffix) {
    if (options.comparison && options.comparison > 0) {
      return "in " + result;
    } else {
      return result + " ago";
    }
  }
  return result;
};

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/locale/_lib/buildFormatLongFn.js
function buildFormatLongFn(args) {
  return (options = {}) => {
    const width = options.width ? String(options.width) : args.defaultWidth;
    const format2 = args.formats[width] || args.formats[args.defaultWidth];
    return format2;
  };
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/locale/en-US/_lib/formatLong.js
var dateFormats = {
  full: "EEEE, MMMM do, y",
  long: "MMMM do, y",
  medium: "MMM d, y",
  short: "MM/dd/yyyy"
};
var timeFormats = {
  full: "h:mm:ss a zzzz",
  long: "h:mm:ss a z",
  medium: "h:mm:ss a",
  short: "h:mm a"
};
var dateTimeFormats = {
  full: "{{date}} 'at' {{time}}",
  long: "{{date}} 'at' {{time}}",
  medium: "{{date}}, {{time}}",
  short: "{{date}}, {{time}}"
};
var formatLong = {
  date: buildFormatLongFn({
    formats: dateFormats,
    defaultWidth: "full"
  }),
  time: buildFormatLongFn({
    formats: timeFormats,
    defaultWidth: "full"
  }),
  dateTime: buildFormatLongFn({
    formats: dateTimeFormats,
    defaultWidth: "full"
  })
};

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/locale/en-US/_lib/formatRelative.js
var formatRelativeLocale = {
  lastWeek: "'last' eeee 'at' p",
  yesterday: "'yesterday at' p",
  today: "'today at' p",
  tomorrow: "'tomorrow at' p",
  nextWeek: "eeee 'at' p",
  other: "P"
};
var formatRelative = (token, _date, _baseDate, _options) => formatRelativeLocale[token];

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/locale/_lib/buildLocalizeFn.js
function buildLocalizeFn(args) {
  return (value, options) => {
    const context = options?.context ? String(options.context) : "standalone";
    let valuesArray;
    if (context === "formatting" && args.formattingValues) {
      const defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
      const width = options?.width ? String(options.width) : defaultWidth;
      valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
    } else {
      const defaultWidth = args.defaultWidth;
      const width = options?.width ? String(options.width) : args.defaultWidth;
      valuesArray = args.values[width] || args.values[defaultWidth];
    }
    const index = args.argumentCallback ? args.argumentCallback(value) : value;
    return valuesArray[index];
  };
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/locale/en-US/_lib/localize.js
var eraValues = {
  narrow: ["B", "A"],
  abbreviated: ["BC", "AD"],
  wide: ["Before Christ", "Anno Domini"]
};
var quarterValues = {
  narrow: ["1", "2", "3", "4"],
  abbreviated: ["Q1", "Q2", "Q3", "Q4"],
  wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]
};
var monthValues = {
  narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
  abbreviated: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ],
  wide: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ]
};
var dayValues = {
  narrow: ["S", "M", "T", "W", "T", "F", "S"],
  short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  wide: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ]
};
var dayPeriodValues = {
  narrow: {
    am: "a",
    pm: "p",
    midnight: "mi",
    noon: "n",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  },
  abbreviated: {
    am: "AM",
    pm: "PM",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  },
  wide: {
    am: "a.m.",
    pm: "p.m.",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  }
};
var formattingDayPeriodValues = {
  narrow: {
    am: "a",
    pm: "p",
    midnight: "mi",
    noon: "n",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  },
  abbreviated: {
    am: "AM",
    pm: "PM",
    midnight: "midnight",
    noon: "noon",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  },
  wide: {
    am: "a.m.",
    pm: "p.m.",
    midnight: "midnight",
    noon: "noon",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  }
};
var ordinalNumber = (dirtyNumber, _options) => {
  const number = Number(dirtyNumber);
  const rem100 = number % 100;
  if (rem100 > 20 || rem100 < 10) {
    switch (rem100 % 10) {
      case 1:
        return number + "st";
      case 2:
        return number + "nd";
      case 3:
        return number + "rd";
    }
  }
  return number + "th";
};
var localize = {
  ordinalNumber,
  era: buildLocalizeFn({
    values: eraValues,
    defaultWidth: "wide"
  }),
  quarter: buildLocalizeFn({
    values: quarterValues,
    defaultWidth: "wide",
    argumentCallback: (quarter) => quarter - 1
  }),
  month: buildLocalizeFn({
    values: monthValues,
    defaultWidth: "wide"
  }),
  day: buildLocalizeFn({
    values: dayValues,
    defaultWidth: "wide"
  }),
  dayPeriod: buildLocalizeFn({
    values: dayPeriodValues,
    defaultWidth: "wide",
    formattingValues: formattingDayPeriodValues,
    defaultFormattingWidth: "wide"
  })
};

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/locale/_lib/buildMatchFn.js
function buildMatchFn(args) {
  return (string, options = {}) => {
    const width = options.width;
    const matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
    const matchResult = string.match(matchPattern);
    if (!matchResult) {
      return null;
    }
    const matchedString = matchResult[0];
    const parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
    const key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, (pattern) => pattern.test(matchedString)) : (
      // [TODO] -- I challenge you to fix the type
      findKey(parsePatterns, (pattern) => pattern.test(matchedString))
    );
    let value;
    value = args.valueCallback ? args.valueCallback(key) : key;
    value = options.valueCallback ? (
      // [TODO] -- I challenge you to fix the type
      options.valueCallback(value)
    ) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}
function findKey(object, predicate) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key) && predicate(object[key])) {
      return key;
    }
  }
  return void 0;
}
function findIndex(array, predicate) {
  for (let key = 0; key < array.length; key++) {
    if (predicate(array[key])) {
      return key;
    }
  }
  return void 0;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/locale/_lib/buildMatchPatternFn.js
function buildMatchPatternFn(args) {
  return (string, options = {}) => {
    const matchResult = string.match(args.matchPattern);
    if (!matchResult) return null;
    const matchedString = matchResult[0];
    const parseResult = string.match(args.parsePattern);
    if (!parseResult) return null;
    let value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
    value = options.valueCallback ? options.valueCallback(value) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/locale/en-US/_lib/match.js
var matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
var parseOrdinalNumberPattern = /\d+/i;
var matchEraPatterns = {
  narrow: /^(b|a)/i,
  abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
  wide: /^(before christ|before common era|anno domini|common era)/i
};
var parseEraPatterns = {
  any: [/^b/i, /^(a|c)/i]
};
var matchQuarterPatterns = {
  narrow: /^[1234]/i,
  abbreviated: /^q[1234]/i,
  wide: /^[1234](th|st|nd|rd)? quarter/i
};
var parseQuarterPatterns = {
  any: [/1/i, /2/i, /3/i, /4/i]
};
var matchMonthPatterns = {
  narrow: /^[jfmasond]/i,
  abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
};
var parseMonthPatterns = {
  narrow: [
    /^j/i,
    /^f/i,
    /^m/i,
    /^a/i,
    /^m/i,
    /^j/i,
    /^j/i,
    /^a/i,
    /^s/i,
    /^o/i,
    /^n/i,
    /^d/i
  ],
  any: [
    /^ja/i,
    /^f/i,
    /^mar/i,
    /^ap/i,
    /^may/i,
    /^jun/i,
    /^jul/i,
    /^au/i,
    /^s/i,
    /^o/i,
    /^n/i,
    /^d/i
  ]
};
var matchDayPatterns = {
  narrow: /^[smtwf]/i,
  short: /^(su|mo|tu|we|th|fr|sa)/i,
  abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
  wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
};
var parseDayPatterns = {
  narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
  any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
};
var matchDayPeriodPatterns = {
  narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
  any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
};
var parseDayPeriodPatterns = {
  any: {
    am: /^a/i,
    pm: /^p/i,
    midnight: /^mi/i,
    noon: /^no/i,
    morning: /morning/i,
    afternoon: /afternoon/i,
    evening: /evening/i,
    night: /night/i
  }
};
var match = {
  ordinalNumber: buildMatchPatternFn({
    matchPattern: matchOrdinalNumberPattern,
    parsePattern: parseOrdinalNumberPattern,
    valueCallback: (value) => parseInt(value, 10)
  }),
  era: buildMatchFn({
    matchPatterns: matchEraPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseEraPatterns,
    defaultParseWidth: "any"
  }),
  quarter: buildMatchFn({
    matchPatterns: matchQuarterPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseQuarterPatterns,
    defaultParseWidth: "any",
    valueCallback: (index) => index + 1
  }),
  month: buildMatchFn({
    matchPatterns: matchMonthPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseMonthPatterns,
    defaultParseWidth: "any"
  }),
  day: buildMatchFn({
    matchPatterns: matchDayPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseDayPatterns,
    defaultParseWidth: "any"
  }),
  dayPeriod: buildMatchFn({
    matchPatterns: matchDayPeriodPatterns,
    defaultMatchWidth: "any",
    parsePatterns: parseDayPeriodPatterns,
    defaultParseWidth: "any"
  })
};

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/locale/en-US.js
var enUS = {
  code: "en-US",
  formatDistance,
  formatLong,
  formatRelative,
  localize,
  match,
  options: {
    weekStartsOn: 0,
    firstWeekContainsDate: 1
  }
};

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/getDayOfYear.js
function getDayOfYear(date, options) {
  const _date = toDate(date, options?.in);
  const diff = differenceInCalendarDays(_date, startOfYear(_date));
  const dayOfYear = diff + 1;
  return dayOfYear;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/getISOWeek.js
function getISOWeek(date, options) {
  const _date = toDate(date, options?.in);
  const diff = +startOfISOWeek(_date) - +startOfISOWeekYear(_date);
  return Math.round(diff / millisecondsInWeek) + 1;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/getWeekYear.js
function getWeekYear(date, options) {
  const _date = toDate(date, options?.in);
  const year = _date.getFullYear();
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const firstWeekOfNextYear = constructFrom(options?.in || date, 0);
  firstWeekOfNextYear.setFullYear(year + 1, 0, firstWeekContainsDate);
  firstWeekOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfWeek(firstWeekOfNextYear, options);
  const firstWeekOfThisYear = constructFrom(options?.in || date, 0);
  firstWeekOfThisYear.setFullYear(year, 0, firstWeekContainsDate);
  firstWeekOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfWeek(firstWeekOfThisYear, options);
  if (+_date >= +startOfNextYear) {
    return year + 1;
  } else if (+_date >= +startOfThisYear) {
    return year;
  } else {
    return year - 1;
  }
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/startOfWeekYear.js
function startOfWeekYear(date, options) {
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const year = getWeekYear(date, options);
  const firstWeek = constructFrom(options?.in || date, 0);
  firstWeek.setFullYear(year, 0, firstWeekContainsDate);
  firstWeek.setHours(0, 0, 0, 0);
  const _date = startOfWeek(firstWeek, options);
  return _date;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/getWeek.js
function getWeek(date, options) {
  const _date = toDate(date, options?.in);
  const diff = +startOfWeek(_date, options) - +startOfWeekYear(_date, options);
  return Math.round(diff / millisecondsInWeek) + 1;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/_lib/addLeadingZeros.js
function addLeadingZeros(number, targetLength) {
  const sign = number < 0 ? "-" : "";
  const output = Math.abs(number).toString().padStart(targetLength, "0");
  return sign + output;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/_lib/format/lightFormatters.js
var lightFormatters = {
  // Year
  y(date, token) {
    const signedYear = date.getFullYear();
    const year = signedYear > 0 ? signedYear : 1 - signedYear;
    return addLeadingZeros(token === "yy" ? year % 100 : year, token.length);
  },
  // Month
  M(date, token) {
    const month = date.getMonth();
    return token === "M" ? String(month + 1) : addLeadingZeros(month + 1, 2);
  },
  // Day of the month
  d(date, token) {
    return addLeadingZeros(date.getDate(), token.length);
  },
  // AM or PM
  a(date, token) {
    const dayPeriodEnumValue = date.getHours() / 12 >= 1 ? "pm" : "am";
    switch (token) {
      case "a":
      case "aa":
        return dayPeriodEnumValue.toUpperCase();
      case "aaa":
        return dayPeriodEnumValue;
      case "aaaaa":
        return dayPeriodEnumValue[0];
      case "aaaa":
      default:
        return dayPeriodEnumValue === "am" ? "a.m." : "p.m.";
    }
  },
  // Hour [1-12]
  h(date, token) {
    return addLeadingZeros(date.getHours() % 12 || 12, token.length);
  },
  // Hour [0-23]
  H(date, token) {
    return addLeadingZeros(date.getHours(), token.length);
  },
  // Minute
  m(date, token) {
    return addLeadingZeros(date.getMinutes(), token.length);
  },
  // Second
  s(date, token) {
    return addLeadingZeros(date.getSeconds(), token.length);
  },
  // Fraction of second
  S(date, token) {
    const numberOfDigits = token.length;
    const milliseconds = date.getMilliseconds();
    const fractionalSeconds = Math.trunc(
      milliseconds * Math.pow(10, numberOfDigits - 3)
    );
    return addLeadingZeros(fractionalSeconds, token.length);
  }
};

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/_lib/format/formatters.js
var dayPeriodEnum = {
  am: "am",
  pm: "pm",
  midnight: "midnight",
  noon: "noon",
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  night: "night"
};
var formatters = {
  // Era
  G: function(date, token, localize2) {
    const era = date.getFullYear() > 0 ? 1 : 0;
    switch (token) {
      // AD, BC
      case "G":
      case "GG":
      case "GGG":
        return localize2.era(era, { width: "abbreviated" });
      // A, B
      case "GGGGG":
        return localize2.era(era, { width: "narrow" });
      // Anno Domini, Before Christ
      case "GGGG":
      default:
        return localize2.era(era, { width: "wide" });
    }
  },
  // Year
  y: function(date, token, localize2) {
    if (token === "yo") {
      const signedYear = date.getFullYear();
      const year = signedYear > 0 ? signedYear : 1 - signedYear;
      return localize2.ordinalNumber(year, { unit: "year" });
    }
    return lightFormatters.y(date, token);
  },
  // Local week-numbering year
  Y: function(date, token, localize2, options) {
    const signedWeekYear = getWeekYear(date, options);
    const weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear;
    if (token === "YY") {
      const twoDigitYear = weekYear % 100;
      return addLeadingZeros(twoDigitYear, 2);
    }
    if (token === "Yo") {
      return localize2.ordinalNumber(weekYear, { unit: "year" });
    }
    return addLeadingZeros(weekYear, token.length);
  },
  // ISO week-numbering year
  R: function(date, token) {
    const isoWeekYear = getISOWeekYear(date);
    return addLeadingZeros(isoWeekYear, token.length);
  },
  // Extended year. This is a single number designating the year of this calendar system.
  // The main difference between `y` and `u` localizers are B.C. years:
  // | Year | `y` | `u` |
  // |------|-----|-----|
  // | AC 1 |   1 |   1 |
  // | BC 1 |   1 |   0 |
  // | BC 2 |   2 |  -1 |
  // Also `yy` always returns the last two digits of a year,
  // while `uu` pads single digit years to 2 characters and returns other years unchanged.
  u: function(date, token) {
    const year = date.getFullYear();
    return addLeadingZeros(year, token.length);
  },
  // Quarter
  Q: function(date, token, localize2) {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    switch (token) {
      // 1, 2, 3, 4
      case "Q":
        return String(quarter);
      // 01, 02, 03, 04
      case "QQ":
        return addLeadingZeros(quarter, 2);
      // 1st, 2nd, 3rd, 4th
      case "Qo":
        return localize2.ordinalNumber(quarter, { unit: "quarter" });
      // Q1, Q2, Q3, Q4
      case "QQQ":
        return localize2.quarter(quarter, {
          width: "abbreviated",
          context: "formatting"
        });
      // 1, 2, 3, 4 (narrow quarter; could be not numerical)
      case "QQQQQ":
        return localize2.quarter(quarter, {
          width: "narrow",
          context: "formatting"
        });
      // 1st quarter, 2nd quarter, ...
      case "QQQQ":
      default:
        return localize2.quarter(quarter, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Stand-alone quarter
  q: function(date, token, localize2) {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    switch (token) {
      // 1, 2, 3, 4
      case "q":
        return String(quarter);
      // 01, 02, 03, 04
      case "qq":
        return addLeadingZeros(quarter, 2);
      // 1st, 2nd, 3rd, 4th
      case "qo":
        return localize2.ordinalNumber(quarter, { unit: "quarter" });
      // Q1, Q2, Q3, Q4
      case "qqq":
        return localize2.quarter(quarter, {
          width: "abbreviated",
          context: "standalone"
        });
      // 1, 2, 3, 4 (narrow quarter; could be not numerical)
      case "qqqqq":
        return localize2.quarter(quarter, {
          width: "narrow",
          context: "standalone"
        });
      // 1st quarter, 2nd quarter, ...
      case "qqqq":
      default:
        return localize2.quarter(quarter, {
          width: "wide",
          context: "standalone"
        });
    }
  },
  // Month
  M: function(date, token, localize2) {
    const month = date.getMonth();
    switch (token) {
      case "M":
      case "MM":
        return lightFormatters.M(date, token);
      // 1st, 2nd, ..., 12th
      case "Mo":
        return localize2.ordinalNumber(month + 1, { unit: "month" });
      // Jan, Feb, ..., Dec
      case "MMM":
        return localize2.month(month, {
          width: "abbreviated",
          context: "formatting"
        });
      // J, F, ..., D
      case "MMMMM":
        return localize2.month(month, {
          width: "narrow",
          context: "formatting"
        });
      // January, February, ..., December
      case "MMMM":
      default:
        return localize2.month(month, { width: "wide", context: "formatting" });
    }
  },
  // Stand-alone month
  L: function(date, token, localize2) {
    const month = date.getMonth();
    switch (token) {
      // 1, 2, ..., 12
      case "L":
        return String(month + 1);
      // 01, 02, ..., 12
      case "LL":
        return addLeadingZeros(month + 1, 2);
      // 1st, 2nd, ..., 12th
      case "Lo":
        return localize2.ordinalNumber(month + 1, { unit: "month" });
      // Jan, Feb, ..., Dec
      case "LLL":
        return localize2.month(month, {
          width: "abbreviated",
          context: "standalone"
        });
      // J, F, ..., D
      case "LLLLL":
        return localize2.month(month, {
          width: "narrow",
          context: "standalone"
        });
      // January, February, ..., December
      case "LLLL":
      default:
        return localize2.month(month, { width: "wide", context: "standalone" });
    }
  },
  // Local week of year
  w: function(date, token, localize2, options) {
    const week = getWeek(date, options);
    if (token === "wo") {
      return localize2.ordinalNumber(week, { unit: "week" });
    }
    return addLeadingZeros(week, token.length);
  },
  // ISO week of year
  I: function(date, token, localize2) {
    const isoWeek = getISOWeek(date);
    if (token === "Io") {
      return localize2.ordinalNumber(isoWeek, { unit: "week" });
    }
    return addLeadingZeros(isoWeek, token.length);
  },
  // Day of the month
  d: function(date, token, localize2) {
    if (token === "do") {
      return localize2.ordinalNumber(date.getDate(), { unit: "date" });
    }
    return lightFormatters.d(date, token);
  },
  // Day of year
  D: function(date, token, localize2) {
    const dayOfYear = getDayOfYear(date);
    if (token === "Do") {
      return localize2.ordinalNumber(dayOfYear, { unit: "dayOfYear" });
    }
    return addLeadingZeros(dayOfYear, token.length);
  },
  // Day of week
  E: function(date, token, localize2) {
    const dayOfWeek = date.getDay();
    switch (token) {
      // Tue
      case "E":
      case "EE":
      case "EEE":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      // T
      case "EEEEE":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      // Tu
      case "EEEEEE":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      // Tuesday
      case "EEEE":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Local day of week
  e: function(date, token, localize2, options) {
    const dayOfWeek = date.getDay();
    const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
    switch (token) {
      // Numerical value (Nth day of week with current locale or weekStartsOn)
      case "e":
        return String(localDayOfWeek);
      // Padded numerical value
      case "ee":
        return addLeadingZeros(localDayOfWeek, 2);
      // 1st, 2nd, ..., 7th
      case "eo":
        return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
      case "eee":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      // T
      case "eeeee":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      // Tu
      case "eeeeee":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      // Tuesday
      case "eeee":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Stand-alone local day of week
  c: function(date, token, localize2, options) {
    const dayOfWeek = date.getDay();
    const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
    switch (token) {
      // Numerical value (same as in `e`)
      case "c":
        return String(localDayOfWeek);
      // Padded numerical value
      case "cc":
        return addLeadingZeros(localDayOfWeek, token.length);
      // 1st, 2nd, ..., 7th
      case "co":
        return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
      case "ccc":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "standalone"
        });
      // T
      case "ccccc":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "standalone"
        });
      // Tu
      case "cccccc":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "standalone"
        });
      // Tuesday
      case "cccc":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "standalone"
        });
    }
  },
  // ISO day of week
  i: function(date, token, localize2) {
    const dayOfWeek = date.getDay();
    const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    switch (token) {
      // 2
      case "i":
        return String(isoDayOfWeek);
      // 02
      case "ii":
        return addLeadingZeros(isoDayOfWeek, token.length);
      // 2nd
      case "io":
        return localize2.ordinalNumber(isoDayOfWeek, { unit: "day" });
      // Tue
      case "iii":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      // T
      case "iiiii":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      // Tu
      case "iiiiii":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      // Tuesday
      case "iiii":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // AM or PM
  a: function(date, token, localize2) {
    const hours = date.getHours();
    const dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
    switch (token) {
      case "a":
      case "aa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "aaa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        }).toLowerCase();
      case "aaaaa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "aaaa":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // AM, PM, midnight, noon
  b: function(date, token, localize2) {
    const hours = date.getHours();
    let dayPeriodEnumValue;
    if (hours === 12) {
      dayPeriodEnumValue = dayPeriodEnum.noon;
    } else if (hours === 0) {
      dayPeriodEnumValue = dayPeriodEnum.midnight;
    } else {
      dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
    }
    switch (token) {
      case "b":
      case "bb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "bbb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        }).toLowerCase();
      case "bbbbb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "bbbb":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // in the morning, in the afternoon, in the evening, at night
  B: function(date, token, localize2) {
    const hours = date.getHours();
    let dayPeriodEnumValue;
    if (hours >= 17) {
      dayPeriodEnumValue = dayPeriodEnum.evening;
    } else if (hours >= 12) {
      dayPeriodEnumValue = dayPeriodEnum.afternoon;
    } else if (hours >= 4) {
      dayPeriodEnumValue = dayPeriodEnum.morning;
    } else {
      dayPeriodEnumValue = dayPeriodEnum.night;
    }
    switch (token) {
      case "B":
      case "BB":
      case "BBB":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "BBBBB":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "BBBB":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Hour [1-12]
  h: function(date, token, localize2) {
    if (token === "ho") {
      let hours = date.getHours() % 12;
      if (hours === 0) hours = 12;
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return lightFormatters.h(date, token);
  },
  // Hour [0-23]
  H: function(date, token, localize2) {
    if (token === "Ho") {
      return localize2.ordinalNumber(date.getHours(), { unit: "hour" });
    }
    return lightFormatters.H(date, token);
  },
  // Hour [0-11]
  K: function(date, token, localize2) {
    const hours = date.getHours() % 12;
    if (token === "Ko") {
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return addLeadingZeros(hours, token.length);
  },
  // Hour [1-24]
  k: function(date, token, localize2) {
    let hours = date.getHours();
    if (hours === 0) hours = 24;
    if (token === "ko") {
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return addLeadingZeros(hours, token.length);
  },
  // Minute
  m: function(date, token, localize2) {
    if (token === "mo") {
      return localize2.ordinalNumber(date.getMinutes(), { unit: "minute" });
    }
    return lightFormatters.m(date, token);
  },
  // Second
  s: function(date, token, localize2) {
    if (token === "so") {
      return localize2.ordinalNumber(date.getSeconds(), { unit: "second" });
    }
    return lightFormatters.s(date, token);
  },
  // Fraction of second
  S: function(date, token) {
    return lightFormatters.S(date, token);
  },
  // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
  X: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    if (timezoneOffset === 0) {
      return "Z";
    }
    switch (token) {
      // Hours and optional minutes
      case "X":
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      // Hours, minutes and optional seconds without `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `XX`
      case "XXXX":
      case "XX":
        return formatTimezone(timezoneOffset);
      // Hours, minutes and optional seconds with `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `XXX`
      case "XXXXX":
      case "XXX":
      // Hours and minutes with `:` delimiter
      default:
        return formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
  x: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      // Hours and optional minutes
      case "x":
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      // Hours, minutes and optional seconds without `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `xx`
      case "xxxx":
      case "xx":
        return formatTimezone(timezoneOffset);
      // Hours, minutes and optional seconds with `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `xxx`
      case "xxxxx":
      case "xxx":
      // Hours and minutes with `:` delimiter
      default:
        return formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (GMT)
  O: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      // Short
      case "O":
      case "OO":
      case "OOO":
        return "GMT" + formatTimezoneShort(timezoneOffset, ":");
      // Long
      case "OOOO":
      default:
        return "GMT" + formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (specific non-location)
  z: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      // Short
      case "z":
      case "zz":
      case "zzz":
        return "GMT" + formatTimezoneShort(timezoneOffset, ":");
      // Long
      case "zzzz":
      default:
        return "GMT" + formatTimezone(timezoneOffset, ":");
    }
  },
  // Seconds timestamp
  t: function(date, token, _localize) {
    const timestamp = Math.trunc(+date / 1e3);
    return addLeadingZeros(timestamp, token.length);
  },
  // Milliseconds timestamp
  T: function(date, token, _localize) {
    return addLeadingZeros(+date, token.length);
  }
};
function formatTimezoneShort(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = Math.trunc(absOffset / 60);
  const minutes = absOffset % 60;
  if (minutes === 0) {
    return sign + String(hours);
  }
  return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
}
function formatTimezoneWithOptionalMinutes(offset, delimiter) {
  if (offset % 60 === 0) {
    const sign = offset > 0 ? "-" : "+";
    return sign + addLeadingZeros(Math.abs(offset) / 60, 2);
  }
  return formatTimezone(offset, delimiter);
}
function formatTimezone(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = addLeadingZeros(Math.trunc(absOffset / 60), 2);
  const minutes = addLeadingZeros(absOffset % 60, 2);
  return sign + hours + delimiter + minutes;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/_lib/format/longFormatters.js
var dateLongFormatter = (pattern, formatLong2) => {
  switch (pattern) {
    case "P":
      return formatLong2.date({ width: "short" });
    case "PP":
      return formatLong2.date({ width: "medium" });
    case "PPP":
      return formatLong2.date({ width: "long" });
    case "PPPP":
    default:
      return formatLong2.date({ width: "full" });
  }
};
var timeLongFormatter = (pattern, formatLong2) => {
  switch (pattern) {
    case "p":
      return formatLong2.time({ width: "short" });
    case "pp":
      return formatLong2.time({ width: "medium" });
    case "ppp":
      return formatLong2.time({ width: "long" });
    case "pppp":
    default:
      return formatLong2.time({ width: "full" });
  }
};
var dateTimeLongFormatter = (pattern, formatLong2) => {
  const matchResult = pattern.match(/(P+)(p+)?/) || [];
  const datePattern = matchResult[1];
  const timePattern = matchResult[2];
  if (!timePattern) {
    return dateLongFormatter(pattern, formatLong2);
  }
  let dateTimeFormat;
  switch (datePattern) {
    case "P":
      dateTimeFormat = formatLong2.dateTime({ width: "short" });
      break;
    case "PP":
      dateTimeFormat = formatLong2.dateTime({ width: "medium" });
      break;
    case "PPP":
      dateTimeFormat = formatLong2.dateTime({ width: "long" });
      break;
    case "PPPP":
    default:
      dateTimeFormat = formatLong2.dateTime({ width: "full" });
      break;
  }
  return dateTimeFormat.replace("{{date}}", dateLongFormatter(datePattern, formatLong2)).replace("{{time}}", timeLongFormatter(timePattern, formatLong2));
};
var longFormatters = {
  p: timeLongFormatter,
  P: dateTimeLongFormatter
};

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/_lib/protectedTokens.js
var dayOfYearTokenRE = /^D+$/;
var weekYearTokenRE = /^Y+$/;
var throwTokens = ["D", "DD", "YY", "YYYY"];
function isProtectedDayOfYearToken(token) {
  return dayOfYearTokenRE.test(token);
}
function isProtectedWeekYearToken(token) {
  return weekYearTokenRE.test(token);
}
function warnOrThrowProtectedError(token, format2, input) {
  const _message = message(token, format2, input);
  console.warn(_message);
  if (throwTokens.includes(token)) throw new RangeError(_message);
}
function message(token, format2, input) {
  const subject = token[0] === "Y" ? "years" : "days of the month";
  return `Use \`${token.toLowerCase()}\` instead of \`${token}\` (in \`${format2}\`) for formatting ${subject} to the input \`${input}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`;
}

// ../../node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/format.js
var formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;
var longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
var escapedStringRegExp = /^'([^]*?)'?$/;
var doubleQuoteRegExp = /''/g;
var unescapedLatinCharacterRegExp = /[a-zA-Z]/;
function format(date, formatStr, options) {
  const defaultOptions2 = getDefaultOptions();
  const locale = options?.locale ?? defaultOptions2.locale ?? enUS;
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
  const originalDate = toDate(date, options?.in);
  if (!isValid(originalDate)) {
    throw new RangeError("Invalid time value");
  }
  let parts = formatStr.match(longFormattingTokensRegExp).map((substring) => {
    const firstCharacter = substring[0];
    if (firstCharacter === "p" || firstCharacter === "P") {
      const longFormatter = longFormatters[firstCharacter];
      return longFormatter(substring, locale.formatLong);
    }
    return substring;
  }).join("").match(formattingTokensRegExp).map((substring) => {
    if (substring === "''") {
      return { isToken: false, value: "'" };
    }
    const firstCharacter = substring[0];
    if (firstCharacter === "'") {
      return { isToken: false, value: cleanEscapedString(substring) };
    }
    if (formatters[firstCharacter]) {
      return { isToken: true, value: substring };
    }
    if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
      throw new RangeError(
        "Format string contains an unescaped latin alphabet character `" + firstCharacter + "`"
      );
    }
    return { isToken: false, value: substring };
  });
  if (locale.localize.preprocessor) {
    parts = locale.localize.preprocessor(originalDate, parts);
  }
  const formatterOptions = {
    firstWeekContainsDate,
    weekStartsOn,
    locale
  };
  return parts.map((part) => {
    if (!part.isToken) return part.value;
    const token = part.value;
    if (!options?.useAdditionalWeekYearTokens && isProtectedWeekYearToken(token) || !options?.useAdditionalDayOfYearTokens && isProtectedDayOfYearToken(token)) {
      warnOrThrowProtectedError(token, formatStr, String(date));
    }
    const formatter = formatters[token[0]];
    return formatter(originalDate, token, locale.localize, formatterOptions);
  }).join("");
}
function cleanEscapedString(input) {
  const matched = input.match(escapedStringRegExp);
  if (!matched) {
    return input;
  }
  return matched[1].replace(doubleQuoteRegExp, "'");
}

// ../../node_modules/.pnpm/aftermath-ts-sdk@2.1.0_@mysten+sui@2.18.0_typescript@5.9.3_/node_modules/aftermath-ts-sdk/dist/index.js
import { Transaction as Transaction7 } from "@mysten/sui/transactions";
import {
  Transaction as Transaction8
} from "@mysten/sui/transactions";
import {
  Transaction as Transaction9
} from "@mysten/sui/transactions";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { MultiSigPublicKey } from "@mysten/sui/multisig";
import {
  Transaction as Transaction10
} from "@mysten/sui/transactions";
import { bcs as bcs2 } from "@mysten/sui/bcs";
import {
  Transaction as Transaction11
} from "@mysten/sui/transactions";
import { fromBase64, normalizeSuiObjectId } from "@mysten/sui/utils";
import { bcs as bcs3 } from "@mysten/sui/bcs";
import { Transaction as Transaction12 } from "@mysten/sui/transactions";
import {
  Transaction as Transaction13
} from "@mysten/sui/transactions";
import {
  Transaction as Transaction14
} from "@mysten/sui/transactions";
import { bcs as bcs4 } from "@mysten/sui/bcs";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var _DynamicFieldsApiHelpers;
var DynamicFieldsApiHelpers;
var init_dynamicFieldsApiHelpers = __esm({
  "src/general/apiHelpers/dynamicFieldsApiHelpers.ts"() {
    "use strict";
    _DynamicFieldsApiHelpers = class _DynamicFieldsApiHelpers2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchCastDynamicFieldsOfTypeWithCursor = async (inputs) => {
          const { dynamicFields, nextCursor } = await this.fetchDynamicFieldsOfTypeWithCursor(inputs);
          const dynamicFieldObjectIds = dynamicFields.map((field) => field.objectId);
          const dynamicFieldObjects = await inputs.objectsFromObjectIds(
            dynamicFieldObjectIds
          );
          return {
            dynamicFieldObjects,
            nextCursor
          };
        };
        this.fetchAllDynamicFieldsOfType = async (inputs) => {
          let allDynamicFields = [];
          let cursor;
          do {
            const dynamicFieldsWithCursor = await this.fetchDynamicFieldsOfTypeWithCursor({
              ...inputs,
              cursor,
              limit: inputs.limitStepSize ?? _DynamicFieldsApiHelpers2.constants.defaultLimitStepSize
            });
            const dynamicFields = dynamicFieldsWithCursor.dynamicFields;
            allDynamicFields = [...allDynamicFields, ...dynamicFields];
            if (dynamicFields.length === 0 || dynamicFieldsWithCursor.nextCursor === null) {
              return allDynamicFields;
            }
            cursor = dynamicFieldsWithCursor.nextCursor;
          } while (true);
        };
        this.fetchCastAllDynamicFieldsOfType = async (inputs) => {
          const dynamicFields = await this.fetchAllDynamicFieldsOfType(inputs);
          const dynamicFieldObjectIds = dynamicFields.map((field) => field.objectId);
          const dynamicFieldObjects = await inputs.objectsFromObjectIds(
            dynamicFieldObjectIds
          );
          return dynamicFieldObjects;
        };
        this.fetchDynamicFieldsUntil = async (inputs) => {
          const { fetchFunc, isComplete, cursor, limitStepSize } = inputs;
          let allDynamicFields = [];
          let currentCursor = cursor ?? null;
          do {
            const dynamicFieldsWithCursor = await fetchFunc({
              cursor: currentCursor ?? void 0,
              limit: limitStepSize ?? _DynamicFieldsApiHelpers2.constants.defaultLimitStepSize
            });
            const fetchedDynamicFields = dynamicFieldsWithCursor.dynamicFieldObjects;
            const nextCursor = dynamicFieldsWithCursor.nextCursor;
            allDynamicFields = [...allDynamicFields, ...fetchedDynamicFields];
            if (fetchedDynamicFields.length === 0 || nextCursor === null) {
              return {
                dynamicFieldObjects: allDynamicFields,
                nextCursor
              };
            }
            if (isComplete(allDynamicFields)) {
              return {
                dynamicFieldObjects: allDynamicFields,
                nextCursor
              };
            }
            currentCursor = dynamicFieldsWithCursor.nextCursor;
          } while (true);
        };
        this.fetchDynamicFieldsOfTypeWithCursor = async (inputs) => {
          const { parentObjectId, dynamicFieldType } = inputs;
          const dynamicFieldsResponse = await this.api.client.getDynamicFields({
            ...inputs,
            limit: inputs.limit ?? _DynamicFieldsApiHelpers2.constants.defaultLimitStepSize,
            parentId: parentObjectId
          });
          const dynamicFields = dynamicFieldType === void 0 ? dynamicFieldsResponse.data : dynamicFieldsResponse.data.filter(
            (dynamicField) => typeof dynamicFieldType === "string" ? dynamicField.objectType === dynamicFieldType : dynamicFieldType(dynamicField.objectType)
          );
          const nextCursor = dynamicFieldsResponse.nextCursor;
          return {
            dynamicFields,
            nextCursor
          };
        };
        this.fetchDynamicFieldObject = (inputs) => {
          return this.api.client.getDynamicFieldObject(inputs);
        };
      }
    };
    _DynamicFieldsApiHelpers.constants = {
      defaultLimitStepSize: 256
    };
    DynamicFieldsApiHelpers = _DynamicFieldsApiHelpers;
  }
});
var _EventsApiHelpers;
var EventsApiHelpers;
var init_eventsApiHelpers = __esm({
  "src/general/apiHelpers/eventsApiHelpers.ts"() {
    "use strict";
    _EventsApiHelpers = class _EventsApiHelpers2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchSubscribeToUserEvents = async (_inputs) => {
          throw new Error(
            "fetchSubscribeToUserEvents is not supported in @mysten/sui v2. subscribeEvent was removed from SuiJsonRpcClient. Poll queryEvents instead or use a WebSocket transport."
          );
        };
        this.fetchCastEventsWithCursor = async (inputs) => {
          const { query, eventFromEventOnChain, cursor, limit } = inputs;
          const fetchedEvents = await this.api.client.queryEvents({
            query,
            cursor: cursor ? { ...cursor, eventSeq: cursor.eventSeq.toString() } : void 0,
            limit
          });
          const events = fetchedEvents.data.map(
            eventFromEventOnChain
          );
          return { events, nextCursor: fetchedEvents.nextCursor ?? null };
        };
        this.fetchEventsWithinTime = async (inputs) => {
          const { fetchEventsFunc, timeMs, limitStepSize } = inputs;
          const limit = limitStepSize ?? _EventsApiHelpers2.constants.defaultLimitStepSize;
          const eventsWithinTime = [];
          let cursor;
          for (let loopCount = 0; loopCount < _EventsApiHelpers2.constants.maxLoops; loopCount++) {
            const { events, nextCursor } = await fetchEventsFunc({
              cursor,
              limit
            });
            const now = Date.now();
            const endIndex = events.findIndex(
              (event) => event.timestamp !== void 0 && now - event.timestamp > timeMs
            );
            eventsWithinTime.push(
              ...endIndex < 0 ? events : events.slice(0, endIndex)
            );
            if (events.length === 0 || nextCursor === null || endIndex >= 0) {
              return eventsWithinTime;
            }
            cursor = nextCursor;
          }
          return eventsWithinTime;
        };
        this.fetchAllEvents = async (inputs) => {
          const { fetchEventsFunc, limitStepSize } = inputs;
          const limit = limitStepSize ?? _EventsApiHelpers2.constants.defaultLimitStepSize;
          const allEvents = [];
          let cursor;
          let done = false;
          while (!done) {
            const { events, nextCursor } = await fetchEventsFunc({
              cursor,
              limit
            });
            allEvents.push(...events);
            if (events.length === 0 || nextCursor === null) {
              done = true;
            } else {
              cursor = nextCursor;
            }
          }
          return allEvents;
        };
      }
    };
    _EventsApiHelpers.constants = {
      defaultLimitStepSize: 256,
      maxLoops: 20
    };
    _EventsApiHelpers.resolveEventType = (eventType) => typeof eventType === "string" ? eventType : eventType();
    _EventsApiHelpers.suiEventOfTypeOrUndefined = (event, eventType) => event.type.includes(_EventsApiHelpers.resolveEventType(eventType)) ? event : void 0;
    _EventsApiHelpers.castEventOfTypeOrUndefined = (event, eventType, castFunction, exactMatch) => {
      const resolved = _EventsApiHelpers.resolveEventType(eventType);
      const matches = exactMatch ? event.type === resolved : event.type.includes(resolved);
      if (!matches) {
        return void 0;
      }
      return castFunction(event);
    };
    _EventsApiHelpers.findCastEventsOrUndefined = (inputs) => {
      const { events, eventType, castFunction } = inputs;
      const resolved = _EventsApiHelpers.resolveEventType(eventType);
      return events.filter((event) => event.type.includes(resolved)).map((event) => castFunction(event));
    };
    _EventsApiHelpers.findCastEventOrUndefined = (inputs) => {
      return _EventsApiHelpers.findCastEventsOrUndefined(inputs)[0];
    };
    _EventsApiHelpers.findCastEventInTransactionOrUndefined = (transaction, eventType, castFunction) => {
      return _EventsApiHelpers.findCastEventOrUndefined({
        events: transaction.events ?? [],
        eventType,
        castFunction
      });
    };
    _EventsApiHelpers.findCastEventInTransactionsOrUndefined = (transactions, eventType, castFunction) => {
      for (const transaction of transactions) {
        const event = _EventsApiHelpers.findCastEventInTransactionOrUndefined(
          transaction,
          eventType,
          castFunction
        );
        if (event !== void 0) {
          return event;
        }
      }
      return void 0;
    };
    _EventsApiHelpers.createEventType = (packageAddress, packageName, eventType, wrapperType) => {
      const innerType = `${packageAddress}::${packageName}::${eventType}`;
      return wrapperType ? `${wrapperType}<${innerType}>` : innerType;
    };
    EventsApiHelpers = _EventsApiHelpers;
  }
});
var _InspectionsApiHelpers;
var InspectionsApiHelpers;
var init_inspectionsApiHelpers = __esm({
  "src/general/apiHelpers/inspectionsApiHelpers.ts"() {
    "use strict";
    _InspectionsApiHelpers = class _InspectionsApiHelpers2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchFirstBytesFromTxOutput = async (inputs) => {
          return (await this.fetchAllBytesFromTxOutput(inputs))[0];
        };
        this.fetchAllBytesFromTxOutput = async (inputs) => {
          const { allBytes } = await this.fetchAllBytesFromTx(inputs);
          return allBytes[allBytes.length - 1];
        };
        this.fetchAllBytesFromTx = async (inputs) => {
          const sender = inputs.sender ?? _InspectionsApiHelpers2.constants.devInspectSigner;
          const response = await this.api.client.devInspectTransactionBlock({
            sender,
            transactionBlock: inputs.tx
          });
          if (response.effects.status.status === "failure") {
            throw new Error(
              response.effects.status.error ?? response.error ?? "dev inspect failed"
            );
          }
          if (!response.results) {
            throw new Error("dev inspect move call returned no results");
          }
          const resultBytes = response.results.map(
            (result) => result.returnValues?.map((val) => val[0]) ?? []
          );
          return {
            events: response.events,
            effects: response.effects,
            allBytes: resultBytes
          };
        };
      }
    };
    _InspectionsApiHelpers.constants = {
      devInspectSigner: "0xacb7cb045c3afac61381cdf272cd24ebe115f86361c9f06490482c238765aeb5"
    };
    InspectionsApiHelpers = _InspectionsApiHelpers;
  }
});
var _ObjectsApiHelpers;
var ObjectsApiHelpers;
var init_objectsApiHelpers = __esm({
  "src/general/apiHelpers/objectsApiHelpers.ts"() {
    "use strict";
    init_helpers();
    _ObjectsApiHelpers = class _ObjectsApiHelpers2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchDoesObjectExist = async (objectId) => {
          const object = await this.api.client.getObject({ id: objectId });
          return object.error === void 0;
        };
        this.fetchIsObjectOwnedByAddress = async (inputs) => {
          const { objectId, walletAddress } = inputs;
          const object = await this.fetchObject({ objectId });
          const objectOwner = object.data?.owner;
          if (!objectOwner || typeof objectOwner !== "object") {
            return false;
          }
          if ("AddressOwner" in objectOwner && objectOwner.AddressOwner === walletAddress) {
            return true;
          }
          if ("ObjectOwner" in objectOwner && objectOwner.ObjectOwner === walletAddress) {
            return true;
          }
          return false;
        };
        this.fetchObjectsOfTypeOwnedByAddress = async (inputs) => {
          return this.fetchOwnedObjects({
            ...inputs,
            filter: {
              StructType: Helpers.stripLeadingZeroesFromType(inputs.objectType)
            }
          });
        };
        this.fetchOwnedObjects = async (inputs) => {
          const { walletAddress, withDisplay, filter } = inputs;
          let allObjectData = [];
          let cursor;
          do {
            const paginatedObjects = await this.api.client.getOwnedObjects({
              owner: walletAddress,
              options: inputs.options ?? {
                showContent: true,
                showDisplay: withDisplay,
                showOwner: true,
                showType: true
              },
              limit: _ObjectsApiHelpers2.constants.maxObjectFetchingLimit,
              cursor,
              filter
            });
            const objectData = paginatedObjects.data;
            allObjectData = [...allObjectData, ...objectData];
            if (paginatedObjects.data.length === 0 || !paginatedObjects.hasNextPage || !paginatedObjects.nextCursor) {
              return allObjectData;
            }
            cursor = paginatedObjects.nextCursor;
          } while (true);
        };
        this.fetchObject = async (inputs) => {
          const { objectId, withDisplay } = inputs;
          return await this.fetchObjectGeneral({
            objectId,
            options: {
              showContent: true,
              showDisplay: withDisplay,
              showOwner: true,
              showType: true
            }
          });
        };
        this.fetchObjectGeneral = async (inputs) => {
          const { objectId, options } = inputs;
          const object = await this.api.client.getObject({
            id: objectId,
            options
          });
          if (object.error !== void 0) {
            throw new Error(
              `an error occured fetching object: ${object.error?.code}`
            );
          }
          return object;
        };
        this.fetchCastObject = async (inputs) => {
          return inputs.objectFromSuiObjectResponse(await this.fetchObject(inputs));
        };
        this.fetchCastObjectGeneral = async (inputs) => {
          const { objectId, objectFromSuiObjectResponse, options } = inputs;
          return objectFromSuiObjectResponse(
            await this.fetchObjectGeneral({ objectId, options })
          );
        };
        this.fetchObjectBatch = async (inputs) => {
          const { objectIds, options } = inputs;
          const objectIdsBatches = [];
          let endIndex = 0;
          while (true) {
            const newEndIndex = endIndex + _ObjectsApiHelpers2.constants.maxObjectFetchingLimit;
            if (newEndIndex >= objectIds.length) {
              objectIdsBatches.push(objectIds.slice(endIndex, objectIds.length));
              break;
            }
            objectIdsBatches.push(objectIds.slice(endIndex, newEndIndex));
            endIndex = newEndIndex;
          }
          const objectBatches = await Promise.all(
            objectIdsBatches.map(
              (objectIds2) => this.api.client.multiGetObjects({
                ids: objectIds2,
                options: options === void 0 ? {
                  showContent: true,
                  showOwner: true,
                  showType: true
                } : options
              })
            )
          );
          const objectBatch = objectBatches.reduce(
            (acc, objects) => [...acc, ...objects],
            []
          );
          return objectBatch;
        };
        this.fetchCastObjectBatch = async (inputs) => {
          return (await this.fetchObjectBatch(inputs)).map(
            (SuiObjectResponse) => {
              return inputs.objectFromSuiObjectResponse(SuiObjectResponse);
            }
          );
        };
        this.fetchCastObjectsOwnedByAddressOfType = async (inputs) => {
          const objects = (await this.fetchObjectsOfTypeOwnedByAddress(inputs)).map(
            (SuiObjectResponse) => {
              return inputs.objectFromSuiObjectResponse(SuiObjectResponse);
            }
          );
          return objects;
        };
        this.fetchObjectBcs = async (objectId) => {
          const objectResponse = await this.api.client.getObject({
            id: objectId,
            options: { showBcs: true }
          });
          if (objectResponse.error !== void 0) {
            throw new Error(
              `an error occured fetching object: ${objectResponse.error?.code}`
            );
          }
          return objectResponse;
        };
        this.fetchCastObjectBcs = async (inputs) => {
          const { objectId } = inputs;
          const suiObjectResponse = await this.api.Objects().fetchObjectBcs(objectId);
          const { Casting: Casting2 } = await Promise.resolve().then(() => (init_casting(), casting_exports));
          return Casting2.castObjectBcs({
            ...inputs,
            suiObjectResponse
          });
        };
        this.burnObjectTx = async (inputs) => {
          const { tx, object } = inputs;
          return tx.transferObjects(
            [object],
            // not using constants because of strange build bug on frontend otherwise
            // tx.pure(Sui.constants.addresses.zero)
            "0x0"
          );
        };
        this.publicShareObjectTx = async (inputs) => {
          const { tx, object, objectType } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              // not using constants because of strange build bug on frontend otherwise
              // Sui.constants.addresses.suiPackageId,
              "0x2",
              "transfer",
              "public_share_object"
            ),
            typeArguments: [objectType],
            arguments: [object]
          });
        };
      }
    };
    _ObjectsApiHelpers.constants = {
      maxObjectFetchingLimit: 50
    };
    ObjectsApiHelpers = _ObjectsApiHelpers;
  }
});
var _TransactionsApiHelpers;
var TransactionsApiHelpers;
var init_transactionsApiHelpers = __esm({
  "src/general/apiHelpers/transactionsApiHelpers.ts"() {
    "use strict";
    init_helpers();
    _TransactionsApiHelpers = class _TransactionsApiHelpers2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchTransactionsWithCursor = async (inputs) => {
          const { query, cursor, limit } = inputs;
          const transactionsWithCursor = await this.api.client.queryTransactionBlocks(
            {
              ...query,
              cursor,
              limit,
              options: {
                showEvents: true,
                showBalanceChanges: true,
                showEffects: true,
                showObjectChanges: true,
                showInput: true
              }
            }
          );
          return {
            transactions: transactionsWithCursor.data,
            nextCursor: transactionsWithCursor.nextCursor ?? null
          };
        };
        this.fetchSetGasBudgetForTx = async (inputs) => {
          const { tx } = inputs;
          const [txResponse, referenceGasPrice] = await Promise.all([
            this.api.client.dryRunTransactionBlock({
              transactionBlock: await tx.build({
                client: this.api.client
              })
            }),
            this.api.client.getReferenceGasPrice()
          ]);
          const gasData = txResponse.effects.gasUsed;
          const gasUsed = BigInt(gasData.computationCost) + BigInt(gasData.storageCost);
          const safeGasBudget = gasUsed + gasUsed / BigInt(10);
          tx.setGasBudget(safeGasBudget);
          tx.setGasPrice(BigInt(referenceGasPrice));
          return tx;
        };
        this.fetchSetGasBudgetAndSerializeTx = async (inputs) => {
          const { tx, isSponsoredTx } = inputs;
          if (isSponsoredTx) {
            return (await tx).toJSON();
          }
          return (await this.fetchSetGasBudgetForTx({ tx: await tx })).toJSON();
        };
        this.fetchBase64TxKindFromTx = async (inputs) => {
          const { tx } = inputs;
          if (!tx) {
            return;
          }
          const txBytes = await tx.build({
            client: this.api?.client,
            onlyTransactionKind: true
          });
          return Buffer.from(txBytes).toString("base64");
        };
      }
      static splitCoinTx(inputs) {
        const { tx, coinType, coinId, amount } = inputs;
        return tx.moveCall({
          target: _TransactionsApiHelpers2.createTxTarget(
            // Sui.constants.addresses.suiPackageId,
            "0x2",
            "coin",
            "split"
          ),
          typeArguments: [coinType],
          arguments: [
            typeof coinId === "string" ? tx.object(coinId) : coinId,
            // Coin,
            tx.pure.u64(amount)
            // split_amount
          ]
        });
      }
    };
    _TransactionsApiHelpers.createTxTarget = (packageAddress, packageName, functionName) => `${packageAddress}::${packageName}::${functionName}`;
    _TransactionsApiHelpers.createBuildTxFunc = (func) => {
      const builderFunc = (someInputs) => {
        const tx = new Transaction();
        tx.setSender(someInputs.walletAddress);
        func({
          tx,
          ...someInputs
        });
        return tx;
      };
      return builderFunc;
    };
    _TransactionsApiHelpers.serviceCoinDataFromCoinTxArg = (inputs) => {
      const { coinTxArg } = inputs;
      if (typeof coinTxArg === "string") {
        return { Coin: Helpers.addLeadingZeroesToType(coinTxArg) };
      }
      if (!("$kind" in coinTxArg)) {
        if (typeof coinTxArg === "function" || "GasCoin" in coinTxArg) {
          throw new Error("unable to convert gas coin arg to service coin data");
        }
        return coinTxArg;
      }
      if (coinTxArg.$kind === "NestedResult") {
        return {
          [coinTxArg.$kind]: coinTxArg.NestedResult
        };
      }
      if (coinTxArg.$kind === "Result") {
        return { [coinTxArg.$kind]: coinTxArg.Result };
      }
      if (coinTxArg.$kind === "GasCoin") {
        throw new Error("unable to convert gas coin arg to service coin data");
      }
      if (coinTxArg.$kind === "Input") {
        return { Input: coinTxArg.Input };
      }
      throw new Error(`unexpected coinTxArg.$kind: ${coinTxArg.$kind}`);
    };
    _TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg = (inputs) => {
      const { coinTxArg } = inputs;
      if (!("$kind" in coinTxArg)) {
        if ("Result" in coinTxArg) {
          return { Result: coinTxArg.Result };
        }
        if ("NestedResult" in coinTxArg) {
          return { NestedResult: coinTxArg.NestedResult };
        }
        if ("GasCoin" in coinTxArg) {
          return "Gas";
        }
        if ("Input" in coinTxArg) {
          return { Input: coinTxArg.Input };
        }
        throw new Error(`coinTxArg in format ${coinTxArg} not supported`);
      }
      if (coinTxArg.$kind === "NestedResult") {
        return {
          NestedResult: coinTxArg.NestedResult
        };
      }
      if (coinTxArg.$kind === "Result") {
        return { Result: coinTxArg.Result };
      }
      if (coinTxArg.$kind === "GasCoin") {
        return "Gas";
      }
      if (coinTxArg.$kind === "Input") {
        return { Input: coinTxArg.Input };
      }
      throw new Error(`unexpected coinTxArg.$kind: ${coinTxArg.$kind}`);
    };
    _TransactionsApiHelpers.coinTxArgFromServiceCoinData = (inputs) => {
      const { serviceCoinData } = inputs;
      const key = Object.keys(serviceCoinData)[0];
      if (key === "Coin") {
        throw new Error(
          "serviceCoinData in format { Coin: ObjectId } not supported"
        );
      }
      const kind = key;
      if (kind === "NestedResult") {
        return {
          NestedResult: Object.values(serviceCoinData)[0]
        };
      }
      if (kind === "Input") {
        return {
          Input: Object.values(serviceCoinData)[0]
        };
      }
      return {
        Result: Object.values(serviceCoinData)[0]
      };
    };
    _TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2 = (inputs) => {
      const { serviceCoinDataV2 } = inputs;
      if (typeof serviceCoinDataV2 === "string") {
        return { GasCoin: true };
      }
      const key = Object.keys(serviceCoinDataV2)[0];
      const value = Object.values(serviceCoinDataV2)[0];
      const kind = key;
      if (kind === "Result" && typeof value === "number") {
        return {
          Result: value
        };
      }
      if (kind === "NestedResult" && typeof value !== "number") {
        return {
          NestedResult: value
        };
      }
      if (kind === "Input" && typeof value === "number") {
        return {
          Input: value
        };
      }
      throw new Error(
        `serviceCoinDataV2 format ${JSON.stringify(
          serviceCoinDataV2
        )} not supported`
      );
    };
    _TransactionsApiHelpers.transferTxMetadata = (inputs) => {
      const { initTx, newTx } = inputs;
      const sender = initTx.getData().sender;
      if (sender) {
        newTx.setSender(sender);
      }
      const expiration = initTx.getData().expiration;
      if (expiration) {
        newTx.setExpiration(expiration);
      }
      const gasData = initTx.getData().gasData;
      if (gasData.budget && typeof gasData.budget !== "string") {
        newTx.setGasBudget(gasData.budget);
      }
      if (gasData.owner) {
        newTx.setGasOwner(gasData.owner);
      }
      if (gasData.payment) {
        newTx.setGasPayment(gasData.payment);
      }
      if (gasData.price && typeof gasData.price !== "string") {
        newTx.setGasPrice(gasData.price);
      }
    };
    TransactionsApiHelpers = _TransactionsApiHelpers;
  }
});
var NUMERIC_STRING_REGEX;
var BIGINT_STRING_REGEX;
var HEX_STRING_REGEX;
var _Helpers;
var Helpers;
var init_helpers = __esm({
  "src/general/utils/helpers.ts"() {
    "use strict";
    init_dynamicFieldsApiHelpers();
    init_eventsApiHelpers();
    init_inspectionsApiHelpers();
    init_objectsApiHelpers();
    init_transactionsApiHelpers();
    NUMERIC_STRING_REGEX = /^\d*\.?\d*$/;
    BIGINT_STRING_REGEX = /^-?\d+n$/;
    HEX_STRING_REGEX = /^(0x)?[0-9A-F]+$/i;
    _Helpers = class _Helpers2 {
      static uniqueObjectArray(arr) {
        const seen = /* @__PURE__ */ new Set();
        return arr.filter((obj) => {
          const str = JSON.stringify(obj);
          if (seen.has(str)) {
            return false;
          }
          seen.add(str);
          return true;
        });
      }
      /**
       * Combines two arrays into a single array of pairs. The result length is the
       * minimum of the two input arrays' lengths.
       *
       * @param firstCollection - The first array.
       * @param lastCollection - The second array.
       * @returns An array of `[firstCollection[i], lastCollection[i]]` pairs.
       */
      static zip(firstCollection, lastCollection) {
        const length = Math.min(firstCollection.length, lastCollection.length);
        const zipped = [];
        for (let index = 0; index < length; index++) {
          zipped.push([firstCollection[index], lastCollection[index]]);
        }
        return zipped;
      }
      /**
       * Removes circular references from an object or array, returning a JSON-safe structure.
       * Any cyclic references are replaced with `undefined`.
       *
       * @param obj - The object or array to remove circular references from.
       * @param seen - Internal usage to track references that have already been visited.
       * @returns A structure that can be safely JSON-stringified.
       */
      static removeCircularReferences(obj, seen = /* @__PURE__ */ new WeakSet()) {
        if (obj && typeof obj === "object") {
          if (seen.has(obj)) {
            return void 0;
          }
          seen.add(obj);
          if (Array.isArray(obj)) {
            return obj.map(
              (item) => _Helpers2.removeCircularReferences(item, seen)
            );
          }
          const entries = Object.entries(obj).map(
            ([key, value]) => [key, _Helpers2.removeCircularReferences(value, seen)]
          );
          return Object.fromEntries(entries);
        }
        return obj;
      }
      // =========================================================================
      //  Type Checking
      // =========================================================================
      /**
       * Checks if an unknown value is an array of strings.
       *
       * @param value - The value to check.
       * @returns `true` if `value` is a string array, otherwise `false`.
       */
      static isArrayOfStrings(value) {
        return Array.isArray(value) && value.every((item) => typeof item === "string");
      }
      // =========================================================================
      //  Sui Object Parsing
      // =========================================================================
      /**
       * Extracts the fully qualified type (e.g., "0x2::coin::Coin<...>") from a `SuiObjectResponse`,
       * normalizing it with leading zeroes if necessary.
       *
       * @param data - The object response from Sui.
       * @returns The normalized object type string.
       * @throws If the type is not found.
       */
      static getObjectType(data) {
        const objectType = data.data?.type;
        if (objectType) {
          return _Helpers2.addLeadingZeroesToType(objectType);
        }
        throw new Error(`no object type found on ${data.data?.objectId}`);
      }
      /**
       * Extracts the object ID from a `SuiObjectResponse`, normalizing it with leading zeroes.
       *
       * @param data - The object response from Sui.
       * @returns A zero-padded `ObjectId`.
       * @throws If the objectId is not found.
       */
      static getObjectId(data) {
        const objectId = data.data?.objectId;
        if (objectId) {
          return _Helpers2.addLeadingZeroesToType(objectId);
        }
        throw new Error(`no object id found on ${data.data?.type}`);
      }
      /**
       * Retrieves the fields of a Move object from a `SuiObjectResponse`.
       *
       * @param data - The Sui object response containing a Move object.
       * @returns A record of fields for that object.
       * @throws If no fields are found.
       */
      // biome-ignore lint/suspicious/noExplicitAny: Move fields are dynamic — callers access nested properties directly; typing as `unknown` would cascade casts through dozens of call sites
      static getObjectFields(data) {
        try {
          const content = data.data?.content;
          return content.fields;
        } catch (_e) {
          throw new Error(`no object fields found on ${data.data?.objectId}`);
        }
      }
      /**
       * Retrieves display metadata from a Sui object response, if present.
       *
       * @param data - The Sui object response.
       * @returns The display fields for that object.
       * @throws If display fields are not found.
       */
      static getObjectDisplay(data) {
        const display = data.data?.display;
        if (display) {
          return display;
        }
        throw new Error(`no object display found on ${data.data?.objectId}`);
      }
      // =========================================================================
      //  Error Parsing
      // =========================================================================
      /**
       * Parses a MoveAbort error message from Sui into a possible `(errorCode, packageId, module)`,
       * if the message follows a known pattern. Otherwise returns undefined.
       *
       * @param inputs - The object containing the raw `errorMessage` from Sui.
       * @returns A partial structure of the error details or undefined.
       */
      static parseMoveErrorMessage(inputs) {
        const { errorMessage } = inputs;
        if (!errorMessage.toLowerCase().includes("moveabort")) {
          return void 0;
        }
        const moveErrorCode = (errorMsg) => {
          const startIndex = errorMsg.lastIndexOf(",");
          const endIndex = errorMsg.lastIndexOf(")");
          if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex) {
            return void 0;
          }
          try {
            const errorCode2 = Number.parseInt(
              errorMsg.slice(startIndex + 1, endIndex),
              10
            );
            if (Number.isNaN(errorCode2)) {
              return void 0;
            }
            return errorCode2;
          } catch {
            return void 0;
          }
        };
        const moveErrorPackageId = (errorMsg) => {
          const startIndex = errorMsg.toLowerCase().indexOf("address:");
          const endIndex = errorMsg.indexOf(", name:");
          if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex) {
            return void 0;
          }
          try {
            const pkgStr = errorMsg.slice(startIndex + 8, endIndex).trim().replaceAll("0x", "");
            const packageId2 = _Helpers2.addLeadingZeroesToType(`0x${pkgStr}`);
            if (!_Helpers2.isValidHex(packageId2)) {
              return void 0;
            }
            return packageId2;
          } catch {
            return void 0;
          }
        };
        const moveErrorModule = (errorMsg) => {
          const startIndex = errorMsg.toLowerCase().indexOf('identifier("');
          const endIndex = errorMsg.indexOf('")');
          if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex) {
            return void 0;
          }
          try {
            return errorMsg.slice(startIndex + 12, endIndex).trim();
          } catch {
            return void 0;
          }
        };
        const errorCode = moveErrorCode(errorMessage);
        const packageId = moveErrorPackageId(errorMessage);
        const module = moveErrorModule(errorMessage);
        if (errorCode === void 0 || !packageId || !module) {
          return void 0;
        }
        return { errorCode, packageId, module };
      }
      /**
       * Translates a Move abort error message into a known error string if it matches
       * entries in a given `moveErrors` table. This is used to map on-chain error codes
       * to user-friendly messages.
       *
       * @param inputs - Includes the raw `errorMessage` and a `moveErrors` object keyed by package, module, and code.
       * @returns A structure with `errorCode`, `packageId`, `module`, and a human-readable `error` string, or `undefined`.
       */
      static translateMoveErrorMessage(inputs) {
        const { errorMessage, moveErrors } = inputs;
        const parsed = _Helpers2.parseMoveErrorMessage({ errorMessage });
        if (!(parsed && parsed.packageId in moveErrors)) {
          return void 0;
        }
        let error;
        if (parsed.module in moveErrors[parsed.packageId] && parsed.errorCode in moveErrors[parsed.packageId][parsed.module]) {
          error = moveErrors[parsed.packageId][parsed.module][parsed.errorCode];
        } else if ("ANY" in moveErrors[parsed.packageId] && parsed.errorCode in moveErrors[parsed.packageId].ANY) {
          error = moveErrors[parsed.packageId].ANY[parsed.errorCode];
        } else {
          return void 0;
        }
        return {
          ...parsed,
          error
        };
      }
    };
    _Helpers.dynamicFields = DynamicFieldsApiHelpers;
    _Helpers.events = EventsApiHelpers;
    _Helpers.inspections = InspectionsApiHelpers;
    _Helpers.objects = ObjectsApiHelpers;
    _Helpers.transactions = TransactionsApiHelpers;
    _Helpers.stripLeadingZeroesFromType = (type) => type.replaceAll(/x0+/g, "x");
    _Helpers.addLeadingZeroesToType = (type) => {
      const EXPECTED_TYPE_LENGTH = 64;
      let strippedType = type.replace("0x", "");
      let typeSuffix = "";
      if (strippedType.includes("::")) {
        const splitType = strippedType.replace("0x", "").split("::");
        typeSuffix = splitType.slice(1).reduce((acc, str) => `${acc}::${str}`, "");
        strippedType = splitType[0];
      }
      const typeLength = strippedType.length;
      if (typeLength > EXPECTED_TYPE_LENGTH) {
        throw new Error("invalid type length");
      }
      const zerosNeeded = EXPECTED_TYPE_LENGTH - typeLength;
      const zeroString = "0".repeat(zerosNeeded);
      const newType = `0x${zeroString}${strippedType}`;
      return newType + typeSuffix;
    };
    _Helpers.splitNonSuiCoinType = (coin) => {
      const [uncastChain, coinType] = coin.split(":");
      if (!(uncastChain && coinType)) {
        return { coinType: coin, chain: "sui" };
      }
      const chain = uncastChain;
      return { chain, coinType };
    };
    _Helpers.isNumber = (str) => NUMERIC_STRING_REGEX.test(str);
    _Helpers.sum = (arr) => arr.reduce((prev, cur) => prev + cur, 0);
    _Helpers.sumBigInt = (arr) => arr.reduce((prev, cur) => prev + cur, BigInt(0));
    _Helpers.closeEnough = (a, b, tolerance) => Math.abs(a - b) <= tolerance * Math.max(a, b);
    _Helpers.closeEnoughBigInt = (a, b, tolerance) => _Helpers.closeEnough(Number(a), Number(b), tolerance);
    _Helpers.veryCloseInt = (a, b, fixedOne) => Math.abs(Math.floor(a / fixedOne) - Math.floor(b / fixedOne)) <= 1;
    _Helpers.blendedOperations = {
      /**
       * Multiply two floating-point numbers.
       */
      mulNNN: (a, b) => a * b,
      /**
       * Multiply a float and a bigint, returning a bigint (floor).
       */
      mulNNB: (a, b) => BigInt(Math.floor(a * b)),
      /**
       * Multiply a float and a bigint, returning a float.
       */
      mulNBN: (a, b) => a * Number(b),
      /**
       * Multiply a float and a bigint, returning a bigint (floor).
       */
      mulNBB: (a, b) => BigInt(Math.floor(a * Number(b))),
      /**
       * Multiply two bigints, returning a float.
       */
      mulBBN: (a, b) => Number(a * b),
      /**
       * Multiply two bigints, returning a bigint.
       */
      mulBBB: (a, b) => a * b
    };
    _Helpers.maxBigInt = (...args) => args.reduce((m, e) => e > m ? e : m);
    _Helpers.minBigInt = (...args) => args.reduce((m, e) => e < m ? e : m);
    _Helpers.absBigInt = (num) => num < BigInt(0) ? -num : num;
    _Helpers.capitalizeOnlyFirstLetter = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    _Helpers.parseJsonWithBigint = (json, unsafeStringNumberConversion = false) => JSON.parse(json, (_key, value) => {
      if (value === null) {
        return void 0;
      }
      if (typeof value === "string" && BIGINT_STRING_REGEX.test(value)) {
        return BigInt(value.slice(0, -1));
      }
      if (unsafeStringNumberConversion && typeof value === "string" && _Helpers.isNumber(value)) {
        return BigInt(value);
      }
      return value;
    });
    _Helpers.deepCopy = (target) => {
      if (target === null) {
        return target;
      }
      if (target instanceof Date) {
        return new Date(target.getTime());
      }
      if (Array.isArray(target)) {
        return target.map((v) => _Helpers.deepCopy(v));
      }
      if (typeof target === "object") {
        const cp = {};
        for (const k of Object.keys(target)) {
          cp[k] = _Helpers.deepCopy(target[k]);
        }
        return cp;
      }
      return target;
    };
    _Helpers.indexOfMax = (arr) => {
      if (arr.length === 0) {
        return -1;
      }
      let maxIndex = 0;
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] > arr[maxIndex]) {
          maxIndex = i;
        }
      }
      return maxIndex;
    };
    _Helpers.uniqueArray = (arr) => {
      if (arr.length === 0) {
        return [];
      }
      if (typeof arr[0] === "object") {
        return _Helpers.uniqueObjectArray(arr);
      }
      return [...new Set(arr)];
    };
    _Helpers.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    _Helpers.createUid = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
    _Helpers.bifilter = (array, func) => {
      const trues = [];
      const falses = [];
      for (let index = 0; index < array.length; index++) {
        const item = array[index];
        if (func(item, index, array)) {
          trues[trues.length] = item;
        } else {
          falses[falses.length] = item;
        }
      }
      return [trues, falses];
    };
    _Helpers.bifilterAsync = async (array, func) => {
      const predicates = await Promise.all(array.map(func));
      return _Helpers.bifilter(array, (_, index) => predicates[index]);
    };
    _Helpers.filterObject = (obj, predicate) => Object.fromEntries(
      Object.entries(obj).filter(([key, value]) => predicate(key, value))
    );
    _Helpers.applySlippageBigInt = (amount, slippage) => {
      return amount - BigInt(Math.floor(slippage / 100 * Number(amount)));
    };
    _Helpers.applySlippage = (amount, slippage) => {
      return amount - slippage / 100 * amount;
    };
    _Helpers.isValidType = (str) => {
      const trimmedStr = str.trim();
      return trimmedStr.startsWith("0x") && trimmedStr.length >= 9 && trimmedStr.indexOf("::") >= 3 && trimmedStr.lastIndexOf("::") >= 6 && !trimmedStr.endsWith(":");
    };
    _Helpers.isValidHex = (hexString) => HEX_STRING_REGEX.test(hexString);
    _Helpers.addTxObject = (tx, object) => {
      return typeof object === "string" ? tx.object(object) : object;
    };
    _Helpers.isValidSuiAddress = (address) => isValidSuiAddress(
      (() => {
        if (!address.startsWith("0x") || address.length < 3) {
          return "";
        }
        try {
          return _Helpers.addLeadingZeroesToType(address);
        } catch {
          return "";
        }
      })()
    );
    _Helpers.keypairFromPrivateKey = (privateKey) => {
      const parsedKeypair = decodeSuiPrivateKey(privateKey);
      switch (parsedKeypair.scheme) {
        case "ED25519":
          return Ed25519Keypair.fromSecretKey(parsedKeypair.secretKey);
        case "Secp256k1":
          return Secp256k1Keypair.fromSecretKey(parsedKeypair.secretKey);
        case "Secp256r1":
          return Secp256r1Keypair.fromSecretKey(parsedKeypair.secretKey);
        default:
          throw new Error(`unsupported scheme \`${parsedKeypair.scheme}\``);
      }
    };
    Helpers = _Helpers;
  }
});
function bigIntReplacer(_key, value) {
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }
  return value;
}
var _Caller;
var Caller;
var init_caller = __esm({
  "src/general/utils/caller.ts"() {
    "use strict";
    init_helpers();
    _Caller = class _Caller2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(config = {}, apiUrlPrefix = "") {
        this.urlForApiCall = (url) => {
          if (this.apiBaseUrl === void 0) {
            throw new Error("no apiBaseUrl: unable to fetch data");
          }
          const safeUrl = this.apiBaseUrl.slice(-1) === "/" ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
          return `${safeUrl}/${this.apiEndpoint}/${this.apiUrlPrefix + (url === "" ? "" : "/")}${url}`;
        };
        this.setAccessToken = (accessToken) => {
          this.config.accessToken = accessToken;
        };
        this.config = config;
        this.apiUrlPrefix = apiUrlPrefix;
        this.apiBaseUrl = this.config.baseUrl ?? (this.config.network === void 0 ? void 0 : _Caller2.apiBaseUrlForNetwork(this.config.network));
        this.apiEndpoint = this.config.apiEndpoint ?? "api";
      }
      // =========================================================================
      //  Private Methods
      // =========================================================================
      static async fetchResponseToType(response, disableBigIntJsonParsing) {
        if (!response.ok) {
          const status = response.status;
          const body = await response.text();
          throw new Error(`HTTP ${status} ${response.statusText}: ${body}`);
        }
        const text = await response.text();
        const output = disableBigIntJsonParsing ? JSON.parse(text, (_key, value) => value === null ? void 0 : value) : Helpers.parseJsonWithBigint(text);
        return output ?? void 0;
      }
      /**
       * Resolves the canonical Aftermath API base URL for a given network.
       * To target a non-canonical host (custom deployment, local backend, etc.)
       * pass `baseUrl` on `CallerConfig` instead.
       */
      static apiBaseUrlForNetwork(network) {
        return _Caller2.NETWORK_API_BASE_URLS[network];
      }
      /**
       * Resolves the canonical Sui fullnode URL for a given network. Falls back
       * to the mainnet fullnode when `network` is undefined.
       */
      static defaultFullnodeUrl(network) {
        return _Caller2.NETWORK_FULLNODE_URLS[network ?? "MAINNET"];
      }
      // =========================================================================
      //  Protected Methods
      // =========================================================================
      // =========================================================================
      //  Api Calling
      // =========================================================================
      async fetchApi(url, body, signal, options) {
        const apiCallUrl = this.urlForApiCall(url);
        const headers = {
          "Content-Type": "application/json",
          ...this.config.accessToken ? { Authorization: `Bearer ${this.config.accessToken}` } : {}
        };
        const uncastResponse = await (body === void 0 ? fetch(apiCallUrl, { headers, signal }) : fetch(apiCallUrl, {
          method: "POST",
          body: JSON.stringify(body, bigIntReplacer),
          headers,
          signal
        }));
        return _Caller2.fetchResponseToType(
          uncastResponse,
          !!options?.disableBigIntJsonParsing
        );
      }
      async fetchApiTransaction(url, body, signal, options) {
        const txKind = await this.fetchApi(
          url,
          body,
          signal,
          options
        );
        const tx = options?.txKind ? Transaction2.fromKind(txKind) : Transaction2.from(txKind);
        if (body?.walletAddress) {
          tx.setSender(body.walletAddress);
        }
        return tx;
      }
      async fetchApiTxObject(url, body, signal, options) {
        const response = await this.fetchApi(
          url,
          body,
          signal,
          options
        );
        const tx = response.sponsorSignature ? Transaction2.from(response.txKind) : Transaction2.fromKind(response.txKind);
        const { txKind, ...rest } = response;
        return { ...rest, tx };
      }
      fetchApiEvents(url, body, signal, options) {
        return this.fetchApi(
          url,
          body,
          signal,
          options
        );
      }
      async fetchApiIndexerEvents(url, body, signal, options) {
        const events = await this.fetchApi(
          url,
          body,
          signal,
          options
        );
        return {
          events,
          nextCursor: events.length < (body.limit ?? 1) ? void 0 : events.length + (body.cursor ?? 0)
        };
      }
      /**
       * Open a generic websocket stream.
       * - Automatically parses inbound JSON via `Helpers.parseJsonWithBigint`.
       * - Automatically enables BigInt -> "123n" serialization (same one-liner as `fetchApi`).
       */
      openWsStream(args) {
        const { path, onMessage, onOpen, onError, onClose } = args;
        const buildWsUrl = (path2) => {
          if (this.apiBaseUrl === void 0) {
            throw new Error("no apiBaseUrl: unable to open websocket");
          }
          const baseHttp = this.apiBaseUrl.replace(
            _Caller2.TRAILING_SLASHES_REGEX,
            ""
          );
          const baseWs = baseHttp.replace(_Caller2.HTTP_PROTOCOL_REGEX, "ws$1://");
          const prefix = `${this.apiEndpoint}/${this.apiUrlPrefix}`;
          const normalizedPrefix = prefix.replace(
            _Caller2.TRAILING_SLASHES_REGEX,
            ""
          );
          const normalizedPath = path2.startsWith("/") ? path2.slice(1) : path2;
          return `${baseWs}/${normalizedPrefix}${normalizedPath ? `/${normalizedPath}` : ""}`;
        };
        const url = buildWsUrl(path);
        const ws = new WebSocket(url);
        ws.addEventListener("open", (ev) => onOpen?.(ev));
        ws.addEventListener("error", (ev) => onError?.(ev));
        ws.addEventListener("close", (ev) => onClose?.(ev));
        ws.addEventListener("message", (ev) => {
          try {
            const data = Helpers.parseJsonWithBigint(
              ev.data
            );
            onMessage?.(data);
          } catch (error) {
            args.onError?.(
              new ErrorEvent("message-parse-error", {
                error,
                message: error instanceof Error ? error.message : "Failed to parse WebSocket message"
              })
            );
          }
        });
        const send = (value) => {
          if (ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not open");
          }
          ws.send(JSON.stringify(value, bigIntReplacer));
        };
        const close = () => ws.close();
        return { ws, send, close };
      }
    };
    _Caller.TRAILING_SLASHES_REGEX = /\/+$/;
    _Caller.HTTP_PROTOCOL_REGEX = /^http(s?):\/\//;
    _Caller.NETWORK_API_BASE_URLS = {
      MAINNET: "https://aftermath.finance",
      TESTNET: "https://testnet.aftermath.finance",
      DEVNET: "https://devnet.aftermath.finance",
      LOCAL: "http://localhost:3000"
    };
    _Caller.NETWORK_FULLNODE_URLS = {
      MAINNET: "https://fullnode.mainnet.sui.io:443",
      TESTNET: "https://fullnode.testnet.sui.io:443",
      DEVNET: "https://fullnode.devnet.sui.io:443",
      LOCAL: "http://127.0.0.1:9000"
    };
    Caller = _Caller;
  }
});
var Prices;
var init_prices = __esm({
  "src/general/prices/prices.ts"() {
    "use strict";
    init_caller();
    Prices = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new `Prices` instance for retrieving coin price data from
       * Aftermath's backend or other data sources.
       *
       * @param config - Optional configuration, including network and access token.
       */
      constructor(config) {
        super(config, "price-info");
      }
      // =========================================================================
      //  Prices
      // =========================================================================
      /**
       * Retrieves detailed price information (including current price and 24h change)
       * for a single coin.
       *
       * @param inputs - Contains the `coin` type (e.g., "0x2::sui::SUI").
       * @returns A promise resolving to a `CoinPriceInfo` object.
       *
       * @example
       * ```typescript
       *
       * const afSdk = await Aftermath.create({ network: "MAINNET" });
       *
       * const prices = afSdk.Prices();
       *
       * const suiPriceInfo = await prices.getCoinPriceInfo({
       *   coin: "0x2::sui::SUI"
       * });
       * console.log(suiPriceInfo.price, suiPriceInfo.priceChange24HoursPercentage);
       * ```
       */
      async getCoinPriceInfo(inputs) {
        const coinsToPriceInfo = await this.getCoinsToPriceInfo({
          coins: [inputs.coin]
        });
        return Object.values(coinsToPriceInfo)[0];
      }
      /**
       * Retrieves detailed price information for multiple coins simultaneously,
       * returning a record keyed by `CoinType`.
       *
       * @param inputs - An object containing an array of `coins`.
       * @returns A promise resolving to a `CoinsToPriceInfo` mapping each coin type to its price info.
       *
       * @example
       * ```typescript
       * const prices = new Prices();
       * const info = await prices.getCoinsToPriceInfo({
       *   coins: ["0x2::sui::SUI", "0x<some_other_coin>"]
       * });
       * console.log(info);
       * ```
       */
      async getCoinsToPriceInfo(inputs) {
        return this.fetchApi("", inputs);
      }
      /**
       * Fetches only the current price in USD for a single coin.
       *
       * @param inputs - Contains the `coin` type.
       * @returns A promise resolving to a `number` representing the price in USD.
       *
       * @example
       * ```typescript
       * const prices = new Prices();
       * const suiPrice = await prices.getCoinPrice({ coin: "0x2::sui::SUI" });
       * console.log("SUI price in USD:", suiPrice);
       * ```
       */
      async getCoinPrice(inputs) {
        const priceInfo = await this.getCoinPriceInfo(inputs);
        return priceInfo.price;
      }
      /**
       * Fetches current prices in USD for multiple coins, returning a record keyed by `CoinType`.
       *
       * @param inputs - Contains an array of `coins`.
       * @returns A promise resolving to a `CoinsToPrice` object mapping coin types to their prices in USD.
       *
       * @example
       * ```typescript
       * const prices = new Prices();
       * const multiPrices = await prices.getCoinsToPrice({ coins: ["0x2::sui::SUI", "0x<other>"] });
       * console.log(multiPrices["0x2::sui::SUI"]); // e.g. 1.23
       * ```
       */
      async getCoinsToPrice(inputs) {
        const coinsToPriceInfo = await this.getCoinsToPriceInfo(inputs);
        const coinsToPrice = Object.entries(coinsToPriceInfo).reduce(
          (acc, [coinType, info]) => ({
            ...acc,
            [coinType]: info.price
          }),
          {}
        );
        return coinsToPrice;
      }
    };
  }
});
var _Coin;
var Coin;
var init_coin = __esm({
  "src/packages/coin/coin.ts"() {
    "use strict";
    init_prices();
    init_caller();
    init_helpers();
    _Coin = class _Coin2 extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new instance of `Coin`.
       *
       * @param coinType - The coin's type string (e.g., "0x2::sui::SUI"). If omitted, methods that require a type will need it passed in manually.
       * @param config - Optional caller configuration (network, access token).
       * @param api - An optional `AftermathApi` instance for coin-specific API calls.
       */
      constructor(coinType = void 0, config, api) {
        super(config, "coins");
        this.coinType = coinType;
        this.api = api;
        this.coinType = coinType;
        this.coinTypePackageName = this.coinType ? _Coin2.getCoinTypePackageName(this.coinType) : "";
        this.coinTypeSymbol = this.coinType ? _Coin2.getCoinTypeSymbol(this.coinType) : "";
        this.innerCoinType = this.coinType ? _Coin2.getInnerCoinType(this.coinType) : "";
      }
      // =========================================================================
      //  Public Methods
      // =========================================================================
      // =========================================================================
      //  Inspections
      // =========================================================================
      /**
       * Retrieves the decimals for multiple coins by calling the Aftermath API for metadata
       * and extracting the `decimals` property.
       *
       * @param inputs - An object containing an array of coin types.
       * @returns An object mapping each coin type to a numeric decimal count.
       *
       * @example
       * ```typescript
       * const decimals = await coin.getCoinsToDecimals({ coins: ["0x2::sui::SUI", "0x<...>"] });
       * console.log(decimals); // { "0x2::sui::SUI": 9, "0x<...>": 6 }
       * ```
       */
      async getCoinsToDecimals(inputs) {
        const { coins } = inputs;
        const metadatas = await this.getCoinMetadatas(inputs);
        const coinsToDecimals = metadatas.map((data) => data.decimals).reduce((acc, decimals, index) => {
          return { ...acc, [coins[index]]: decimals };
        }, {});
        return coinsToDecimals;
      }
      /**
       * Fetches the metadata (name, symbol, decimals) for this coin type or a provided one,
       * caching it if already requested.
       *
       * @param coin - Optionally override the constructor coinType.
       * @returns The `CoinMetadaWithInfo` object containing metadata and optional external references.
       * @throws If neither constructor nor argument coinType is available.
       *
       * @example
       * ```typescript
       * const metadata = await coin.getCoinMetadata("0x2::sui::SUI");
       * console.log(metadata.name, metadata.symbol, metadata.decimals);
       * ```
       */
      async getCoinMetadata(coin) {
        if (this.metadata) {
          return this.metadata;
        }
        const coinType = this.coinType ?? coin;
        if (!coinType) {
          throw new Error("no valid coin type");
        }
        const [metadata] = await this.getCoinMetadatas({ coins: [coinType] });
        this.setCoinMetadata(metadata);
        return metadata;
      }
      /**
       * Fetches metadata for multiple coins at once, returning an array in the same order
       * as the coin types requested.
       *
       * @param inputs - An object with `coins`, an array of coin types.
       * @returns An array of `CoinMetadaWithInfo` with length matching `coins`.
       *
       * @example
       * ```typescript
       * const metas = await coin.getCoinMetadatas({
       *   coins: ["0x2::sui::SUI", "0x<custom::TOKEN>"]
       * });
       * console.log(metas[0].symbol, metas[1].symbol);
       * ```
       */
      async getCoinMetadatas(inputs) {
        return this.fetchApi(
          "metadata",
          {
            coins: inputs.coins.map((coin) => Helpers.addLeadingZeroesToType(coin))
          }
        );
      }
      /**
       * Manually sets the metadata in this Coin instance, storing it in `this.metadata`.
       *
       * @param metadata - A `CoinMetadaWithInfo` object to cache in this instance.
       */
      setCoinMetadata(metadata) {
        this.metadata = metadata;
      }
      /**
       * Retrieves price information (including current price and 24h change) for this coin or a provided coin.
       * If already fetched, it returns the cached data.
       *
       * @param coin - Optionally override the constructor coinType.
       * @returns A `CoinPriceInfo` with `price` and `priceChange24HoursPercentage`.
       * @throws If no valid coin type is present.
       *
       * @example
       * ```typescript
       * const priceInfo = await coin.getPrice("0x2::sui::SUI");
       * console.log(priceInfo.price, priceInfo.priceChange24HoursPercentage);
       * ```
       */
      async getPrice(coin) {
        if (this.priceInfo !== void 0) {
          return this.priceInfo;
        }
        const coinType = this.coinType ?? coin;
        if (!coinType) {
          throw new Error("no valid coin type");
        }
        const priceInfo = await new Prices(this.config).getCoinPriceInfo({
          coin: coinType
        });
        this.setPriceInfo(priceInfo);
        return priceInfo;
      }
      /**
       * Manually sets the price info in this Coin instance, storing it in `this.priceInfo`.
       *
       * @param priceInfo - A `CoinPriceInfo` object to cache in this instance.
       */
      setPriceInfo(priceInfo) {
        this.priceInfo = priceInfo;
      }
      /**
       * Fetches a list of "verified" coin types from the Aftermath backend. Verified coins
       * typically pass certain safety or liquidity checks.
       *
       * @returns An array of `CoinType` strings that are considered verified.
       *
       * @example
       * ```typescript
       * const verified = await coin.getVerifiedCoins();
       * console.log(verified); // e.g. ["0x2::sui::SUI", "0x...::MYCOIN", ...]
       * ```
       */
      async getVerifiedCoins() {
        return this.fetchApi("verified");
      }
    };
    _Coin.constants = {
      /**
       * The canonical coin type string for SUI.
       */
      suiCoinType: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
      /**
       * The default number of decimals for SUI (9).
       */
      suiCoinDecimals: 9,
      /**
       * The canonical coin object type path for Sui's Move module, used in verifying coin objects.
       */
      coinObjectType: "0x0000000000000000000000000000000000000000000000000000000000000002::coin::Coin",
      /**
       * The maximum number of decimals
       */
      maxCoinDecimals: 18,
      /**
       * Default decimals for various blockchains or ecosystems. For instance,
       * "sui" => 9, "evm" => 18, etc.
       */
      defaultCoinDecimals: {
        sui: 9,
        evm: 18,
        svm: 9
      }
    };
    _Coin.getCoinTypePackageName = (coin) => {
      const splitCoin = coin.split("::");
      if (splitCoin.length !== 3) {
        return "";
      }
      const packageName = splitCoin[splitCoin.length - 2];
      if (!packageName) {
        return "";
      }
      return packageName;
    };
    _Coin.getCoinTypeSymbol = (coin) => {
      const startIndex = coin.lastIndexOf("::") + 2;
      if (startIndex <= 1) {
        return "";
      }
      const foundEndIndex = coin.indexOf(">");
      const endIndex = foundEndIndex < 0 ? coin.length : foundEndIndex;
      const displayType = coin.slice(startIndex, endIndex);
      return displayType;
    };
    _Coin.getInnerCoinType = (coin) => coin.includes("<") ? coin.split("<")[1].slice(0, -1) : "";
    _Coin.coinTypeFromKeyType = (keyType) => {
      const startIndex = keyType.lastIndexOf("<") + 1;
      const endIndex = keyType.indexOf(">", startIndex);
      return keyType.slice(startIndex, endIndex);
    };
    _Coin.isSuiCoin = (coin) => Helpers.stripLeadingZeroesFromType(coin) === Helpers.stripLeadingZeroesFromType(_Coin.constants.suiCoinType);
    _Coin.isCoinObjectType = (objectType) => Helpers.stripLeadingZeroesFromType(objectType).startsWith(
      Helpers.stripLeadingZeroesFromType(_Coin.constants.coinObjectType)
    );
    _Coin.coinsAndAmountsOverZero = (coinAmounts) => {
      const coins = Object.keys(coinAmounts).filter(
        (key) => coinAmounts[key] > 0
      );
      const amounts = Object.values(coinAmounts).filter((amount) => amount > 0);
      return { coins, amounts };
    };
    _Coin.coinsAndBalancesOverZero = (coinsToBalance) => {
      const coins = Object.keys(coinsToBalance).filter(
        (key) => BigInt(coinsToBalance[key]) > BigInt(0)
      );
      const balances = Object.values(coinsToBalance).map(BigInt).filter((amount) => amount > BigInt(0));
      return { coins, balances };
    };
    _Coin.filterCoinsByType = (inputs) => {
      const filter = inputs.filter.toLowerCase().trim();
      return inputs.coinTypes?.filter((coinType) => {
        try {
          return Helpers.stripLeadingZeroesFromType(coinType).toLowerCase().includes(Helpers.stripLeadingZeroesFromType(filter)) || coinType.toLowerCase().includes(Helpers.addLeadingZeroesToType(filter));
        } catch (_e) {
        }
        return Helpers.stripLeadingZeroesFromType(coinType).toLowerCase().includes(filter) || coinType.toLowerCase().includes(filter);
      });
    };
    _Coin.filterCoinsByMetadata = (inputs) => {
      return Object.entries(inputs.coinMetadatas)?.filter(([coin, metadata]) => {
        const cleanInput = inputs.filter.toLowerCase().trim();
        return coin.startsWith(cleanInput) || [metadata.name, metadata.symbol].some(
          (str) => str.toLowerCase().includes(cleanInput)
        );
      }).map(([coin]) => coin);
    };
    _Coin.normalizeBalance = (balance, decimals) => BigInt(Math.floor(balance * 10 ** decimals));
    _Coin.balanceWithDecimals = (amount, decimals) => {
      return Number(amount) / Number(10 ** decimals);
    };
    _Coin.balanceWithDecimalsUsd = (amount, decimals, price) => {
      return _Coin.balanceWithDecimals(amount, decimals) * price;
    };
    _Coin.coinSymbolForCoinType = (inputs) => {
      const { coinType, coinSymbolToCoinTypes } = inputs;
      try {
        const fullCoinType = Helpers.addLeadingZeroesToType(coinType);
        const foundCoinData = Object.entries(coinSymbolToCoinTypes).find(
          ([, coinsTypes]) => coinsTypes.map(Helpers.addLeadingZeroesToType).includes(fullCoinType)
        );
        const foundCoinSymbol = foundCoinData?.[0];
        return foundCoinSymbol;
      } catch {
        return void 0;
      }
    };
    Coin = _Coin;
  }
});
var FarmsApiCasting;
var init_farmsApiCasting = __esm({
  "src/packages/farms/api/farmsApiCasting.ts"() {
    "use strict";
    init_utils();
    init_coin();
    FarmsApiCasting = class {
    };
    FarmsApiCasting.partialStakedPositionObjectFromSuiObjectResponseV1 = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      const stakeCoinType = Helpers.addLeadingZeroesToType(
        Coin.getInnerCoinType(objectType)
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        stakeCoinType,
        stakingPoolObjectId: fields.afterburner_vault_id,
        stakedAmount: BigInt(fields.balance),
        stakedAmountWithMultiplier: BigInt(fields.multiplier_staked_amount),
        lockStartTimestamp: Number(fields.lock_start_timestamp_ms),
        lockDurationMs: Number(fields.lock_duration_ms),
        lockMultiplier: BigInt(fields.lock_multiplier),
        lastHarvestRewardsTimestamp: Number(fields.last_reward_timestamp_ms),
        rewardCoins: fields.base_rewards_accumulated.map(
          (baseRewardsAccumulated, index) => ({
            baseRewardsAccumulated: BigInt(baseRewardsAccumulated),
            baseRewardsDebt: BigInt(fields.base_rewards_debt[index]),
            multiplierRewardsAccumulated: BigInt(
              fields.multiplier_rewards_accumulated[index]
            ),
            multiplierRewardsDebt: BigInt(fields.multiplier_rewards_debt[index])
          })
        ),
        version: 1
      };
    };
    FarmsApiCasting.partialStakedPositionObjectFromSuiObjectResponseV2 = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      const stakeCoinType = Helpers.addLeadingZeroesToType(
        Coin.getInnerCoinType(objectType)
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        stakeCoinType,
        stakingPoolObjectId: fields.vault_id,
        stakedAmount: BigInt(fields.balance),
        stakedAmountWithMultiplier: BigInt(fields.multiplier_staked_amount),
        lockStartTimestamp: Number(fields.lock_start_timestamp_ms),
        lockDurationMs: Number(fields.lock_duration_ms),
        lockMultiplier: BigInt(fields.lock_multiplier),
        lastHarvestRewardsTimestamp: Number(fields.last_reward_timestamp_ms),
        rewardCoins: fields.base_rewards_accumulated.map(
          (baseRewardsAccumulated, index) => ({
            baseRewardsAccumulated: BigInt(baseRewardsAccumulated),
            baseRewardsDebt: BigInt(fields.base_rewards_debt[index]),
            multiplierRewardsAccumulated: BigInt(
              fields.multiplier_rewards_accumulated[index]
            ),
            multiplierRewardsDebt: BigInt(fields.multiplier_rewards_debt[index])
          })
        ),
        version: 2
      };
    };
    FarmsApiCasting.stakingPoolOwnerCapObjectFromSuiObjectResponseV1 = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        stakingPoolId: fields.afterburner_vault_id
      };
    };
    FarmsApiCasting.stakingPoolOwnerCapObjectFromSuiObjectResponseV2 = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        stakingPoolId: fields.for
      };
    };
    FarmsApiCasting.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV1 = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        stakingPoolId: fields.afterburner_vault_id
      };
    };
    FarmsApiCasting.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV2 = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        stakingPoolId: fields.cap.fields.for
      };
    };
    FarmsApiCasting.addedRewardEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        vaultId: fields.vault_id,
        rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
        rewardAmount: BigInt(fields.reward_amount),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.addedRewardEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        vaultId: fields.vault_id,
        rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
        rewardAmount: BigInt(fields.reward_amount),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.createdVaultEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        vaultId: fields.vault_id,
        stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
        minLockDurationMs: Number(fields.min_lock_duration_ms),
        maxLockDurationMs: Number(fields.max_lock_duration_ms),
        maxLockMultiplier: BigInt(fields.max_lock_multiplier),
        minStakeAmount: BigInt(fields.min_stake_amount),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.createdVaultEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        vaultId: fields.vault_id,
        stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
        minLockDurationMs: Number(fields.min_lock_duration_ms),
        maxLockDurationMs: Number(fields.max_lock_duration_ms),
        maxLockMultiplier: BigInt(fields.max_lock_multiplier),
        minStakeAmount: BigInt(fields.min_stake_amount),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.depositedPrincipalEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        amount: BigInt(fields.amount),
        stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.depositedPrincipalEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        amount: BigInt(fields.amount),
        stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.destroyedStakedPositionEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        stakedPositionId: fields.staked_position_id,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.destroyedStakedPositionEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        stakedPositionId: fields.staked_position_id,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.harvestedRewardsEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        vaultId: fields.afterburner_vault_id,
        rewardTypes: fields.reward_types.map(
          (rewardType) => Helpers.addLeadingZeroesToType(`0x${rewardType}`)
        ),
        rewardAmounts: fields.reward_amounts.map((amount) => BigInt(amount)),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.harvestedRewardsEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        vaultId: fields.afterburner_vault_id,
        rewardTypes: fields.reward_types.map(
          (rewardType) => Helpers.addLeadingZeroesToType(`0x${rewardType}`)
        ),
        rewardAmounts: fields.reward_amounts.map((amount) => BigInt(amount)),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.increasedEmissionsEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        vaultId: fields.vault_id,
        rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
        emissionScheduleMs: Number(fields.emission_schedule_ms),
        emissionRate: BigInt(fields.emission_rate),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.updatedEmissionsEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        vaultId: fields.vault_id,
        rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
        emissionScheduleMs: Number(fields.emission_schedule_ms),
        emissionRate: BigInt(fields.emission_rate),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.initializedRewardEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        vaultId: fields.vault_id,
        rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
        rewardAmount: BigInt(fields.reward_amount),
        emissionRate: BigInt(fields.emission_rate),
        emissionStartMs: Number(fields.emission_start_ms),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.initializedRewardEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        vaultId: fields.vault_id,
        rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
        rewardAmount: BigInt(fields.reward_amount),
        emissionRate: BigInt(fields.emission_rate),
        emissionStartMs: Number(fields.emission_start_ms),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.joinedEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        stakedPositionId: fields.staked_position_id,
        otherStakedPositionId: fields.other_staked_position_id,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.joinedEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        stakedPositionId: fields.staked_position_id,
        otherStakedPositionId: fields.other_staked_position_id,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.lockedEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
        stakedAmount: BigInt(fields.staked_amount),
        lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
        lockDurationMs: Number(fields.lock_duration_ms),
        lockMultiplier: BigInt(fields.lock_multiplier),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.lockedEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
        stakedAmount: BigInt(fields.staked_amount),
        lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
        lockDurationMs: Number(fields.lock_duration_ms),
        lockMultiplier: BigInt(fields.lock_multiplier),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.splitEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        stakedPositionId: fields.staked_position_id,
        splitStakedPositionId: fields.split_staked_position_id,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.splitEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        stakedPositionId: fields.staked_position_id,
        splitStakedPositionId: fields.split_staked_position_id,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.stakedEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
        stakedAmount: BigInt(fields.staked_amount),
        multipliedStakedAmount: BigInt(fields.multiplied_staked_amount),
        lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
        lockDurationMs: Number(fields.lock_duration_ms),
        lockMultiplier: BigInt(fields.lock_multiplier),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.stakedEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
        stakedAmount: BigInt(fields.staked_amount),
        multipliedStakedAmount: BigInt(fields.multiplier_staked_amount),
        lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
        lockDurationMs: Number(fields.lock_duration_ms),
        lockMultiplier: BigInt(fields.lock_multiplier),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.stakedRelaxedEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
        stakedAmount: BigInt(fields.staked_amount),
        lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
        lockEndTimestampMs: Number(fields.lock_end_timestamp_ms),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.unlockedEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
        stakedAmount: BigInt(fields.staked_amount),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.unlockedEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
        stakedAmount: BigInt(fields.staked_amount),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.withdrewPrincipalEventFromOnChainV1 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        amount: BigInt(fields.amount),
        stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FarmsApiCasting.withdrewPrincipalEventFromOnChainV2 = (eventOnChain) => {
      const fields = eventOnChain.parsedJson.pos0;
      return {
        stakedPositionId: fields.staked_position_id,
        vaultId: fields.vault_id,
        amount: BigInt(fields.amount),
        stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
  }
});
var init_coin2 = __esm({
  "src/packages/coin/index.ts"() {
    "use strict";
    init_coin();
  }
});
var FaucetApiCasting;
var init_faucetApiCasting = __esm({
  "src/packages/faucet/api/faucetApiCasting.ts"() {
    "use strict";
    init_utils();
    init_coin2();
    FaucetApiCasting = class {
    };
    FaucetApiCasting.faucetMintCoinEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      const coinType = Helpers.addLeadingZeroesToType(
        new Coin(eventOnChain.type).innerCoinType
      );
      return {
        coinType,
        minter: Helpers.addLeadingZeroesToType(fields.user),
        amount: BigInt(fields.amount),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    FaucetApiCasting.faucetAddCoinEventFromOnChain = (eventOnChain) => {
      const _fields = eventOnChain.parsedJson;
      const coinType = Helpers.addLeadingZeroesToType(
        new Coin(eventOnChain.type).innerCoinType
      );
      return {
        coinType,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
  }
});
var PoolsApiCasting;
var init_poolsApiCasting = __esm({
  "src/packages/pools/api/poolsApiCasting.ts"() {
    "use strict";
    init_utils();
    init_coin2();
    PoolsApiCasting = class {
    };
    PoolsApiCasting.poolObjectFromSuiObject = (suiObject) => {
      const objectId = Helpers.getObjectId(suiObject);
      const objectType = Helpers.getObjectType(suiObject);
      const poolFieldsOnChain = Helpers.getObjectFields(
        suiObject
      );
      const lpCoinType = Helpers.addLeadingZeroesToType(
        Coin.getInnerCoinType(poolFieldsOnChain.lp_supply.type)
      );
      const coins = poolFieldsOnChain.type_names.reduce(
        (acc, cur, index) => ({
          ...acc,
          [Helpers.addLeadingZeroesToType(`0x${cur}`)]: {
            weight: BigInt(poolFieldsOnChain.weights[index]),
            balance: BigInt(poolFieldsOnChain.normalized_balances[index]) / BigInt(poolFieldsOnChain.decimal_scalars[index]),
            tradeFeeIn: BigInt(poolFieldsOnChain.fees_swap_in[index]),
            tradeFeeOut: BigInt(poolFieldsOnChain.fees_swap_out[index]),
            depositFee: BigInt(poolFieldsOnChain.fees_deposit[index]),
            withdrawFee: BigInt(poolFieldsOnChain.fees_withdraw[index]),
            normalizedBalance: BigInt(
              poolFieldsOnChain.normalized_balances[index]
            ),
            decimalsScalar: BigInt(poolFieldsOnChain.decimal_scalars[index]),
            ...poolFieldsOnChain.coin_decimals ? {
              decimals: Number(poolFieldsOnChain.coin_decimals[index])
            } : {}
          }
        }),
        {}
      );
      return {
        objectType,
        objectId,
        lpCoinType,
        name: poolFieldsOnChain.name,
        creator: poolFieldsOnChain.creator,
        lpCoinSupply: BigInt(poolFieldsOnChain.lp_supply.fields.value),
        illiquidLpCoinSupply: BigInt(poolFieldsOnChain.illiquid_lp_supply),
        flatness: BigInt(poolFieldsOnChain.flatness),
        lpCoinDecimals: Number(poolFieldsOnChain.lp_decimals),
        coins
      };
    };
    PoolsApiCasting.daoFeePoolOwnerCapObjectFromSuiObjectResponse = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        daoFeePoolId: Helpers.addLeadingZeroesToType(fields.dao_fee_pool_id)
      };
    };
    PoolsApiCasting.poolObjectIdfromPoolCreateEventOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return fields.pool_id;
    };
    PoolsApiCasting.poolTradeEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        poolId: fields.pool_id,
        trader: fields.issuer,
        typesIn: fields.types_in.map(
          (type) => Helpers.addLeadingZeroesToType(`0x${type}`)
        ),
        amountsIn: fields.amounts_in.map((amount) => BigInt(amount)),
        typesOut: fields.types_out.map(
          (type) => Helpers.addLeadingZeroesToType(`0x${type}`)
        ),
        amountsOut: fields.amounts_out.map((amount) => BigInt(amount)),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PoolsApiCasting.poolDepositEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        poolId: fields.pool_id,
        depositor: fields.issuer,
        types: fields.types.map(
          (type) => Helpers.addLeadingZeroesToType(`0x${type}`)
        ),
        deposits: fields.deposits.map((deposit) => BigInt(deposit)),
        lpMinted: BigInt(fields.lp_coins_minted),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PoolsApiCasting.poolWithdrawEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        poolId: fields.pool_id,
        withdrawer: fields.issuer,
        types: fields.types.map(
          (type) => Helpers.addLeadingZeroesToType(`0x${type}`)
        ),
        withdrawn: fields.withdrawn.map((withdraw) => BigInt(withdraw)),
        lpBurned: BigInt(fields.lp_coins_burned),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
  }
});
var NftAmmApiCasting;
var init_nftAmmApiCasting = __esm({
  "src/packages/nftAmm/api/nftAmmApiCasting.ts"() {
    "use strict";
    init_utils();
    init_coin2();
    init_poolsApiCasting();
    NftAmmApiCasting = class {
    };
    NftAmmApiCasting.marketObjectFromSuiObject = (suiObject) => {
      const objectId = Helpers.getObjectId(suiObject);
      const marketType = Helpers.getObjectType(suiObject);
      if (!marketType) {
        throw new Error("no object type found");
      }
      const fields = Helpers.getObjectFields(
        suiObject
      );
      const pool = PoolsApiCasting.poolObjectFromSuiObject(fields.pool);
      const fractionalizedCoinType = Coin.getInnerCoinType(fields.supply.type);
      const innerMarketTypes = Coin.getInnerCoinType(marketType);
      const genericTypes = innerMarketTypes.replaceAll(" ", "").split(",");
      const assetCoinType = genericTypes[2];
      const nftType = genericTypes[3];
      return {
        objectId,
        pool,
        objectType: marketType,
        nftsTable: {
          objectId: fields.nfts.fields.id.id,
          size: BigInt(fields.nfts.fields.size)
        },
        fractionalizedSupply: BigInt(fields.supply.fields.value),
        fractionalizedCoinAmount: BigInt(fields.fractions_amount),
        fractionalizedCoinType,
        assetCoinType,
        lpCoinType: pool.lpCoinType,
        nftType
      };
    };
  }
});
var PerpetualsOrderSide;
var PerpetualsOrderType;
var PerpetualsStopOrderType;
var isUpdatedMarketVersion;
var isWithdrewCollateralEvent;
var isDepositedCollateralEvent;
var isDeallocatedCollateralEvent;
var isAllocatedCollateralEvent;
var isSettledFundingEvent;
var isLiquidatedEvent;
var isCanceledOrderEvent;
var isPostedOrderEvent;
var isFilledMakerOrdersEvent;
var isFilledTakerOrderEvent;
var isReducedOrderEvent;
var isUpdatedPremiumTwapEvent;
var isUpdatedSpreadTwapEvent;
var isUpdatedFundingEvent;
var init_perpetualsTypes = __esm({
  "src/packages/perpetuals/perpetualsTypes.ts"() {
    "use strict";
    PerpetualsOrderSide = /* @__PURE__ */ ((PerpetualsOrderSide2) => {
      PerpetualsOrderSide2[PerpetualsOrderSide2["Ask"] = 1] = "Ask";
      PerpetualsOrderSide2[PerpetualsOrderSide2["Bid"] = 0] = "Bid";
      return PerpetualsOrderSide2;
    })(PerpetualsOrderSide || {});
    PerpetualsOrderType = /* @__PURE__ */ ((PerpetualsOrderType2) => {
      PerpetualsOrderType2[PerpetualsOrderType2["Standard"] = 0] = "Standard";
      PerpetualsOrderType2[PerpetualsOrderType2["FillOrKill"] = 1] = "FillOrKill";
      PerpetualsOrderType2[PerpetualsOrderType2["PostOnly"] = 2] = "PostOnly";
      PerpetualsOrderType2[PerpetualsOrderType2["ImmediateOrCancel"] = 3] = "ImmediateOrCancel";
      return PerpetualsOrderType2;
    })(PerpetualsOrderType || {});
    PerpetualsStopOrderType = /* @__PURE__ */ ((PerpetualsStopOrderType2) => {
      PerpetualsStopOrderType2[PerpetualsStopOrderType2["SlTp"] = 0] = "SlTp";
      PerpetualsStopOrderType2[PerpetualsStopOrderType2["Standalone"] = 1] = "Standalone";
      return PerpetualsStopOrderType2;
    })(PerpetualsStopOrderType || {});
    isUpdatedMarketVersion = (event) => {
      return event.type.toLowerCase().endsWith("::updatedclearinghouseversion");
    };
    isWithdrewCollateralEvent = (event) => {
      return event.type.toLowerCase().includes("::withdrewcollateral");
    };
    isDepositedCollateralEvent = (event) => {
      return event.type.toLowerCase().includes("::depositedcollateral");
    };
    isDeallocatedCollateralEvent = (event) => {
      return event.type.toLowerCase().endsWith("::deallocatedcollateral");
    };
    isAllocatedCollateralEvent = (event) => {
      return event.type.toLowerCase().endsWith("::allocatedcollateral");
    };
    isSettledFundingEvent = (event) => {
      return event.type.toLowerCase().endsWith("::settledfunding");
    };
    isLiquidatedEvent = (event) => {
      return event.type.toLowerCase().endsWith("::liquidatedposition");
    };
    isCanceledOrderEvent = (event) => {
      return event.type.toLowerCase().endsWith("::canceledorder");
    };
    isPostedOrderEvent = (event) => {
      return event.type.toLowerCase().endsWith("::postedorder");
    };
    isFilledMakerOrdersEvent = (event) => {
      return event.type.toLowerCase().endsWith("::filledmakerorders");
    };
    isFilledTakerOrderEvent = (event) => {
      return event.type.toLowerCase().endsWith("::filledtakerorder");
    };
    isReducedOrderEvent = (event) => {
      return event.type.toLowerCase().endsWith("::reducedorder");
    };
    isUpdatedPremiumTwapEvent = (event) => {
      return event.type.toLowerCase().endsWith("::updatedpremiumtwap");
    };
    isUpdatedSpreadTwapEvent = (event) => {
      return event.type.toLowerCase().endsWith("::updatedspreadtwap");
    };
    isUpdatedFundingEvent = (event) => {
      return event.type.toLowerCase().endsWith("::updatedfunding");
    };
  }
});
var PerpetualsApiCasting;
var init_perpetualsApiCasting = __esm({
  "src/packages/perpetuals/api/perpetualsApiCasting.ts"() {
    "use strict";
    init_utils();
    init_packages();
    init_perpetualsTypes();
    PerpetualsApiCasting = class {
    };
    PerpetualsApiCasting.UpdatedMarketVersionEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        version: BigInt(fields.version),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.withdrewCollateralEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        accountId: BigInt(fields.account_id),
        collateralDelta: BigInt(fields.collateral),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.depositedCollateralEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        accountId: BigInt(fields.account_id),
        collateralDelta: BigInt(fields.collateral),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.settledFundingEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        accountId: BigInt(fields.account_id),
        collateralDeltaUsd: Casting.IFixed.numberFromIFixed(
          BigInt(fields.collateral_change_usd)
        ),
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        marketFundingRateLong: Casting.IFixed.numberFromIFixed(
          BigInt(fields.mkt_funding_rate_long)
        ),
        marketFundingRateShort: Casting.IFixed.numberFromIFixed(
          BigInt(fields.mkt_funding_rate_short)
        ),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.allocatedCollateralEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        accountId: BigInt(fields.account_id),
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        collateralDelta: BigInt(fields.collateral),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.deallocatedCollateralEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        accountId: BigInt(fields.account_id),
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        collateralDelta: BigInt(fields.collateral),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.liquidatedEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        accountId: BigInt(fields.liqee_account_id),
        collateralDeltaUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.liqee_pnl)) - Casting.IFixed.numberFromIFixed(BigInt(fields.liquidation_fees)) - Casting.IFixed.numberFromIFixed(BigInt(fields.force_cancel_fees)) - Casting.IFixed.numberFromIFixed(BigInt(fields.insurance_fund_fees)),
        liqorAccountId: BigInt(fields.liqor_account_id),
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        baseLiquidated: Casting.IFixed.numberFromIFixed(
          BigInt(fields.base_liquidated)
        ),
        quoteLiquidated: Casting.IFixed.numberFromIFixed(
          BigInt(fields.quote_liquidated)
        ),
        liqeePnlUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.liqee_pnl)),
        liquidationFeesUsd: Casting.IFixed.numberFromIFixed(
          BigInt(fields.liquidation_fees)
        ),
        forceCancelFeesUsd: Casting.IFixed.numberFromIFixed(
          BigInt(fields.force_cancel_fees)
        ),
        insuranceFundFeesUsd: Casting.IFixed.numberFromIFixed(
          BigInt(fields.insurance_fund_fees)
        ),
        side: fields.is_liqee_long ? 0 : 1,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.createdAccountEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        user: Helpers.addLeadingZeroesToType(fields.user),
        accountId: BigInt(fields.account_id),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.SetPositionInitialMarginRatioEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        accountId: BigInt(fields.account_id),
        initialMarginRatio: Casting.IFixed.numberFromIFixed(
          BigInt(fields.initial_margin_ratio)
        ),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.canceledOrderEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        accountId: BigInt(fields.account_id),
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        side: Perpetuals.orderIdToSide(BigInt(fields.order_id)),
        size: BigInt(fields.size),
        orderId: BigInt(fields.order_id),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.filledMakerOrdersEventFromOnChain = (eventOnChain) => {
      return {
        events: eventOnChain.parsedJson.events.map((fields) => ({
          accountId: BigInt(fields.maker_account_id),
          takerAccountId: BigInt(fields.taker_account_id),
          collateralDeltaUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.pnl)) - Casting.IFixed.numberFromIFixed(BigInt(fields.fees)),
          pnlUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.pnl)),
          feesUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.fees)),
          marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
          orderId: BigInt(fields.order_id),
          side: Perpetuals.orderIdToSide(BigInt(fields.order_id)),
          size: BigInt(fields.filled_size),
          dropped: BigInt(fields.remaining_size) === BigInt(0),
          sizeRemaining: BigInt(fields.remaining_size),
          canceledSize: BigInt(fields.canceled_size)
        })),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.filledTakerOrderEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      const baseAssetDelta = Casting.IFixed.numberFromIFixed(BigInt(fields.base_asset_delta_bid)) - Casting.IFixed.numberFromIFixed(BigInt(fields.base_asset_delta_ask));
      return {
        baseAssetDelta,
        accountId: BigInt(fields.taker_account_id),
        collateralDeltaUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.taker_pnl)) - Casting.IFixed.numberFromIFixed(BigInt(fields.taker_fees)),
        takerPnlUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.taker_pnl)),
        takerFeesUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.taker_fees)),
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        side: Perpetuals.positionSide({ baseAssetAmount: baseAssetDelta }),
        quoteAssetDelta: Casting.IFixed.numberFromIFixed(BigInt(fields.quote_asset_delta_bid)) - Casting.IFixed.numberFromIFixed(BigInt(fields.quote_asset_delta_ask)),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.postedOrderEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        accountId: BigInt(fields.account_id),
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        size: BigInt(fields.order_size),
        orderId: BigInt(fields.order_id),
        side: Perpetuals.orderIdToSide(BigInt(fields.order_id)),
        reduceOnly: fields.reduce_only,
        expiryTimestamp: fields.expiration_timestamp_ms ? BigInt(fields.expiration_timestamp_ms) : void 0,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.reducedOrderEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        accountId: BigInt(fields.account_id),
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        sizeChange: BigInt(fields.size_change),
        orderId: BigInt(fields.order_id),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.createdStopOrderTicketEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        ticketId: Helpers.addLeadingZeroesToType(fields.ticket_id),
        accountId: BigInt(fields.account_id),
        executors: fields.executors.map(
          (executor) => Helpers.addLeadingZeroesToType(executor)
        ),
        gas: BigInt(fields.gas),
        stopOrderType: Number(fields.stop_order_type),
        encryptedDetails: fields.encrypted_details,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.executedStopOrderTicketEventFromOnChain = (eventOnChain) => {
      const f = eventOnChain.parsedJson;
      return {
        ticketId: Helpers.addLeadingZeroesToType(f.ticket_id),
        executor: Helpers.addLeadingZeroesToType(f.executor),
        accountId: BigInt(f.account_id),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.deletedStopOrderTicketEventFromOnChain = (eventOnChain) => {
      const f = eventOnChain.parsedJson;
      return {
        ticketId: Helpers.addLeadingZeroesToType(f.ticket_id),
        executor: Helpers.addLeadingZeroesToType(f.executor),
        accountId: BigInt(f.account_id),
        subAccountId: f.subaccount_id ? Helpers.addLeadingZeroesToType(f.subaccount_id) : void 0,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.editedStopOrderTicketDetailsEventFromOnChain = (eventOnChain) => {
      const f = eventOnChain.parsedJson;
      return {
        ticketId: Helpers.addLeadingZeroesToType(f.ticket_id),
        stopOrderType: Number(f.stop_order_type),
        accountId: BigInt(f.account_id),
        subAccountId: f.subaccount_id ? Helpers.addLeadingZeroesToType(f.subaccount_id) : void 0,
        encryptedDetails: f.encrypted_details,
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.editedStopOrderTicketExecutorEventFromOnChain = (eventOnChain) => {
      const f = eventOnChain.parsedJson;
      return {
        ticketId: Helpers.addLeadingZeroesToType(f.ticket_id),
        accountId: BigInt(f.account_id),
        subAccountId: f.subaccount_id ? Helpers.addLeadingZeroesToType(f.subaccount_id) : void 0,
        executors: f.executors.map(
          (executor) => Helpers.addLeadingZeroesToType(executor)
        ),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.updatedPremiumTwapEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        indexPrice: Casting.IFixed.numberFromIFixed(BigInt(fields.index_price)),
        bookPrice: Casting.IFixed.numberFromIFixed(BigInt(fields.book_price)),
        premiumTwap: Casting.IFixed.numberFromIFixed(BigInt(fields.premium_twap)),
        premiumTwapLastUpdateMs: Number(fields.premium_twap_last_upd_ms),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.updatedSpreadTwapEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        bookPrice: Casting.IFixed.numberFromIFixed(BigInt(fields.book_price)),
        indexPrice: Casting.IFixed.numberFromIFixed(BigInt(fields.index_price)),
        spreadTwap: Casting.IFixed.numberFromIFixed(BigInt(fields.spread_twap)),
        spreadTwapLastUpdateMs: Number(fields.spread_twap_last_upd_ms),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    PerpetualsApiCasting.updatedFundingEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
        cumFundingRateLong: Casting.IFixed.numberFromIFixed(
          BigInt(fields.cum_funding_rate_long)
        ),
        cumFundingRateShort: Casting.IFixed.numberFromIFixed(
          BigInt(fields.cum_funding_rate_short)
        ),
        fundingLastUpdateMs: Number(fields.funding_last_upd_ms),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
  }
});
var RouterApiCasting;
var init_routerApiCasting = __esm({
  "src/packages/router/api/routerApiCasting.ts"() {
    "use strict";
    RouterApiCasting = class {
    };
    RouterApiCasting.routerTradeEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        trader: fields.swapper,
        coinInType: fields.type_in,
        coinInAmount: BigInt(fields.amount_in),
        coinOutType: fields.type_out,
        coinOutAmount: BigInt(fields.amount_out),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
  }
});
var _FixedUtils;
var FixedUtils;
var init_fixedUtils = __esm({
  "src/general/utils/fixedUtils.ts"() {
    "use strict";
    _FixedUtils = class _FixedUtils {
    };
    _FixedUtils.fixedOneN = 1e18;
    _FixedUtils.fixedOneB = BigInt("1000000000000000000");
    _FixedUtils.fixedOneN9 = 1e9;
    _FixedUtils.fixedOneB9 = BigInt(1e9);
    _FixedUtils.convertFromInt = (n) => Number(n);
    _FixedUtils.convertToInt = (n) => BigInt(Math.floor(n));
    _FixedUtils.directCast = (n) => Number(n) / _FixedUtils.fixedOneN;
    _FixedUtils.directUncast = (n) => BigInt(Math.floor(n * _FixedUtils.fixedOneN));
    _FixedUtils.complement = (n) => Math.max(0, 1 - Math.max(0, n));
    _FixedUtils.normalizeAmount = (decimalsScalar, amount) => amount * decimalsScalar;
    _FixedUtils.unnormalizeAmount = (decimalsScalar, normalizedAmount) => normalizedAmount / decimalsScalar;
    _FixedUtils.castAndNormalize = (decimalsScalar, amount) => _FixedUtils.directCast(_FixedUtils.normalizeAmount(decimalsScalar, amount));
    _FixedUtils.uncastAndUnnormalize = (decimalsScalar, normalizedAmount) => _FixedUtils.unnormalizeAmount(
      decimalsScalar,
      _FixedUtils.directUncast(normalizedAmount)
    );
    FixedUtils = _FixedUtils;
  }
});
var StakingApiCasting;
var init_stakingApiCasting = __esm({
  "src/packages/staking/api/stakingApiCasting.ts"() {
    "use strict";
    init_utils();
    init_fixedUtils();
    StakingApiCasting = class {
    };
    StakingApiCasting.validatorOperationCapObjectFromSuiObjectResponse = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        authorizerValidatorAddress: Helpers.addLeadingZeroesToType(
          fields.authorizer_validator_address
        )
      };
    };
    StakingApiCasting.stakedSuiVaultStateObjectFromSuiObjectResponse = (data) => {
      const objectId = Helpers.getObjectId(data);
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      return {
        objectId,
        objectType,
        atomicUnstakeSuiReservesTargetValue: BigInt(
          fields.protocol_config.fields.atomic_unstake_sui_reserves_target_value
        ),
        atomicUnstakeSuiReserves: BigInt(fields.atomic_unstake_sui_reserves),
        minAtomicUnstakeFee: BigInt(
          fields.protocol_config.fields.atomic_unstake_protocol_fee.fields.min_fee
        ),
        maxAtomicUnstakeFee: BigInt(
          fields.protocol_config.fields.atomic_unstake_protocol_fee.fields.max_fee
        ),
        totalSuiAmount: BigInt(fields.total_sui_amount),
        totalRewardsAmount: BigInt(fields.total_rewards_amount),
        activeEpoch: BigInt(fields.active_epoch)
      };
    };
    StakingApiCasting.stakedEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        suiId: Helpers.addLeadingZeroesToType(fields.sui_id),
        stakedSuiId: Helpers.addLeadingZeroesToType(fields.staked_sui_id),
        staker: Helpers.addLeadingZeroesToType(fields.staker),
        validatorAddress: Helpers.addLeadingZeroesToType(fields.validator),
        epoch: BigInt(fields.epoch),
        suiStakeAmount: BigInt(fields.sui_amount),
        validatorFee: FixedUtils.directCast(BigInt(fields.validator_fee)),
        isRestaked: fields.is_restaked,
        referrer: fields.referrer ? fields.referrer : void 0,
        afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
        afSuiAmount: BigInt(fields.afsui_amount),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    StakingApiCasting.unstakedEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
        suiId: Helpers.addLeadingZeroesToType(fields.sui_id),
        requester: Helpers.addLeadingZeroesToType(fields.requester),
        epoch: BigInt(fields.epoch),
        providedAfSuiAmount: BigInt(fields.provided_afsui_amount),
        returnedSuiAmount: BigInt(fields.returned_sui_amount),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    StakingApiCasting.unstakeRequestedEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
        providedAfSuiAmount: BigInt(fields.provided_afsui_amount),
        requester: Helpers.addLeadingZeroesToType(fields.requester),
        epoch: BigInt(fields.epoch),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
  }
});
var _SuiFrensApiCasting;
var SuiFrensApiCasting;
var init_suiFrensApiCasting = __esm({
  "src/packages/suiFrens/api/suiFrensApiCasting.ts"() {
    "use strict";
    init_utils();
    _SuiFrensApiCasting = class _SuiFrensApiCasting {
    };
    _SuiFrensApiCasting.capyLabsAppObjectFromSuiObjectResponse = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(data);
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        mixingLimit: BigInt(fields.mixing_limit),
        coolDownPeriodEpochs: BigInt(fields.cool_down_period),
        mixingPrice: BigInt(fields.mixing_price),
        suiProfits: BigInt(fields.profits)
      };
    };
    _SuiFrensApiCasting.partialSuiFrenObjectFromSuiObjectResponse = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(data);
      const display = Helpers.getObjectDisplay(data).data;
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        generation: BigInt(fields.generation),
        birthdate: Number(fields.birthdate),
        cohort: BigInt(fields.cohort),
        genes: fields.genes.map((gene) => BigInt(gene)),
        attributes: {
          skin: fields.attributes[0],
          main: fields.attributes[1],
          secondary: fields.attributes[2],
          expression: fields.attributes[3],
          ears: fields.attributes[4]
        },
        birthLocation: fields.birth_location,
        display: {
          link: display.link,
          imageUrl: display.image_url,
          description: display.description,
          projectUrl: display.project_url
        }
      };
    };
    _SuiFrensApiCasting.partialSuiFrenObjectFromStakedSuiFrenMetadataV1ObjectSuiObjectResponse = (data) => {
      const fields = Helpers.getObjectFields(
        data
      );
      const display = Helpers.getObjectDisplay(data).data;
      return {
        objectType: fields.suifren_type,
        objectId: Helpers.addLeadingZeroesToType(fields.suifren_id),
        generation: BigInt(fields.generation),
        birthdate: Number(fields.birthdate),
        cohort: BigInt(fields.cohort),
        genes: fields.genes.map((gene) => BigInt(gene)),
        attributes: {
          skin: fields.attributes[0],
          main: fields.attributes[1],
          secondary: fields.attributes[2],
          expression: fields.attributes[3],
          ears: fields.attributes[4]
        },
        birthLocation: fields.birth_location,
        display: {
          link: display.link,
          imageUrl: display.image_url.replace("mainnet", "testnet"),
          description: display.description,
          projectUrl: display.project_url
        }
      };
    };
    _SuiFrensApiCasting.stakedSuiFrenMetadataV1ObjectFromSuiObjectResponse = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        suiFrenId: Helpers.addLeadingZeroesToType(fields.suifren_id),
        collectedFees: BigInt(fields.collected_fees),
        autoStakeFees: fields.auto_stake_fees,
        mixFee: BigInt(fields.mix_fee),
        feeIncrementPerMix: BigInt(fields.fee_increment_per_mix),
        minRemainingMixesToKeep: BigInt(fields.min_remaining_mixes_to_keep)
      };
    };
    _SuiFrensApiCasting.partialSuiFrenAndStakedSuiFrenMetadataV1ObjectFromSuiObjectResponse = (data) => {
      return {
        stakedSuiFrenMetadata: _SuiFrensApiCasting.stakedSuiFrenMetadataV1ObjectFromSuiObjectResponse(data),
        partialSuiFren: _SuiFrensApiCasting.partialSuiFrenObjectFromStakedSuiFrenMetadataV1ObjectSuiObjectResponse(
          data
        )
      };
    };
    _SuiFrensApiCasting.stakedSuiFrenPositionFromSuiObjectResponse = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        suiFrenId: Helpers.addLeadingZeroesToType(fields.suifren_id)
      };
    };
    _SuiFrensApiCasting.suiFrenVaultStateV1ObjectFromSuiObjectResponse = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        totalMixes: BigInt(fields.mixed),
        stakedSuiFrens: BigInt(fields.suifrens_metadata.fields.size)
      };
    };
    _SuiFrensApiCasting.accessoryObjectFromSuiObjectResponse = (data) => {
      const objectType = Helpers.getObjectType(data);
      const fields = Helpers.getObjectFields(
        data
      );
      const display = Helpers.getObjectDisplay(data).data;
      return {
        objectType,
        objectId: Helpers.getObjectId(data),
        name: fields.name,
        type: fields.type,
        imageUrl: display.image_url
      };
    };
    _SuiFrensApiCasting.harvestSuiFrenFeesEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        harvester: Helpers.addLeadingZeroesToType(fields.issuer),
        fees: BigInt(fields.fees),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    _SuiFrensApiCasting.mixSuiFrensEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        mixer: Helpers.addLeadingZeroesToType(fields.issuer),
        parentOneId: Helpers.addLeadingZeroesToType(fields.parent_one_id),
        parentTwoId: Helpers.addLeadingZeroesToType(fields.parent_two_id),
        childId: Helpers.addLeadingZeroesToType(fields.suifren_id),
        fee: BigInt(fields.fee),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    _SuiFrensApiCasting.stakeSuiFrenEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        staker: Helpers.addLeadingZeroesToType(fields.issuer),
        suiFrenId: Helpers.addLeadingZeroesToType(fields.suifren_id),
        // TODO: generalize casting of event types with passing of
        // timestamp and txnDigest (create wrapper)
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    _SuiFrensApiCasting.unstakeSuiFrenEventFromOnChain = (eventOnChain) => {
      const fields = eventOnChain.parsedJson;
      return {
        unstaker: Helpers.addLeadingZeroesToType(fields.issuer),
        suiFrenId: Helpers.addLeadingZeroesToType(fields.suifren_id),
        fees: BigInt(fields.fees),
        timestamp: Number(eventOnChain.timestampMs),
        txnDigest: eventOnChain.id.txDigest,
        type: eventOnChain.type
      };
    };
    SuiFrensApiCasting = _SuiFrensApiCasting;
  }
});
var _NftsApiCasting;
var NftsApiCasting;
var init_nftsApiCasting = __esm({
  "src/general/nfts/nftsApiCasting.ts"() {
    "use strict";
    init_helpers();
    _NftsApiCasting = class _NftsApiCasting {
    };
    _NftsApiCasting.nftsFromSuiObjects = (objects) => {
      const nfts = objects.filter((object) => object.data?.display);
      return nfts.map((nft) => _NftsApiCasting.nftFromSuiObject(nft)).filter(
        (nft) => Object.keys(nft.display.suggested).length > 0 || Object.keys(nft.display.other).length > 0
      );
    };
    _NftsApiCasting.nftFromSuiObject = (object) => {
      const info = _NftsApiCasting.nftInfoFromSuiObject(object);
      const displayFields = Helpers.getObjectDisplay(object);
      const display = _NftsApiCasting.nftDisplayFromDisplayFields(displayFields);
      return {
        info,
        display
      };
    };
    _NftsApiCasting.kioskOwnerCapFromSuiObject = (object) => {
      const fields = Helpers.getObjectFields(object);
      const objectId = Helpers.getObjectId(object);
      const objectType = Helpers.getObjectType(object);
      return {
        objectId,
        objectType,
        kioskObjectId: Helpers.addLeadingZeroesToType(fields.for)
      };
    };
    _NftsApiCasting.kioskOwnerCapFromPersonalKioskCapSuiObject = (object) => {
      const fields = Helpers.getObjectFields(object);
      const objectId = Helpers.getObjectId(object);
      const objectType = Helpers.getObjectType(object);
      return {
        objectId,
        objectType,
        kioskObjectId: Helpers.addLeadingZeroesToType(fields.cap.fields.for)
      };
    };
    _NftsApiCasting.nftInfoFromSuiObject = (object) => {
      const objectType = Helpers.getObjectType(object);
      const objectId = Helpers.getObjectId(object);
      if (!(objectId && objectType)) {
        throw new Error("unable to obtain object info from sui object response");
      }
      return {
        objectId,
        objectType
      };
    };
    _NftsApiCasting.nftDisplayFromDisplayFields = (displayFields) => {
      const fields = displayFields.data;
      if (fields === null || fields === void 0 || displayFields.error !== null) {
        return {
          suggested: {},
          other: {}
        };
      }
      const suggestedFields = [
        {
          onChain: "name",
          offChain: "name"
        },
        {
          onChain: "link",
          offChain: "link"
        },
        {
          onChain: "image_url",
          offChain: "imageUrl"
        },
        {
          onChain: "description",
          offChain: "description"
        },
        {
          onChain: "project_url",
          offChain: "projectUrl"
        },
        {
          onChain: "creator",
          offChain: "creator"
        }
      ];
      const suggested = {};
      const other = Helpers.deepCopy(fields);
      for (const field of suggestedFields) {
        if (!(field.onChain in other)) {
          continue;
        }
        suggested[field.offChain] = other[field.onChain];
        delete other[field.onChain];
      }
      return {
        suggested,
        other
      };
    };
    NftsApiCasting = _NftsApiCasting;
  }
});
var _IFixedUtils;
var IFixedUtils;
var init_iFixedUtils = __esm({
  "src/general/utils/iFixedUtils.ts"() {
    "use strict";
    init_casting();
    _IFixedUtils = class _IFixedUtils {
    };
    _IFixedUtils.ONE = BigInt(1e18);
    _IFixedUtils.GREATEST_BIT = BigInt(1) << BigInt(255);
    _IFixedUtils.NOT_GREATEST_BIT = (BigInt(1) << BigInt(255)) - BigInt(1);
    _IFixedUtils.numberFromIFixed = (value) => {
      const absVal = _IFixedUtils.abs(value);
      const integerPart = Number(absVal / _IFixedUtils.ONE);
      const decimalPart = Number(absVal % _IFixedUtils.ONE) / Number(_IFixedUtils.ONE);
      return _IFixedUtils.sign(value) * (integerPart + decimalPart);
    };
    _IFixedUtils.iFixedFromNumber = (value) => {
      const newValue = BigInt(Math.floor(Math.abs(value) * Number(_IFixedUtils.ONE)));
      if (value < 0) {
        return _IFixedUtils.neg(newValue);
      }
      return newValue;
    };
    _IFixedUtils.abs = (value) => {
      if (value >= _IFixedUtils.GREATEST_BIT) {
        return _IFixedUtils.neg(value);
      }
      return value;
    };
    _IFixedUtils.sign = (value) => {
      if (value >= _IFixedUtils.GREATEST_BIT) {
        return -1;
      }
      if (value === BigInt(0)) {
        return 0;
      }
      return 1;
    };
    _IFixedUtils.neg = (value) => {
      return (value ^ _IFixedUtils.NOT_GREATEST_BIT) + BigInt(1) ^ _IFixedUtils.GREATEST_BIT;
    };
    _IFixedUtils.iFixedFromBytes = (bytes) => {
      return Casting.bigIntFromBytes(bytes);
    };
    _IFixedUtils.iFixedFromStringBytes = (bytes) => {
      return _IFixedUtils.iFixedFromBytes(Casting.bytesFromStringBytes(bytes));
    };
    IFixedUtils = _IFixedUtils;
  }
});
var casting_exports = {};
__export(casting_exports, {
  Casting: () => Casting
});
var _Casting;
var Casting;
var init_casting = __esm({
  "src/general/utils/casting.ts"() {
    "use strict";
    init_index();
    init_farmsApiCasting();
    init_faucetApiCasting();
    init_nftAmmApiCasting();
    init_perpetualsApiCasting();
    init_poolsApiCasting();
    init_routerApiCasting();
    init_stakingApiCasting();
    init_suiFrensApiCasting();
    init_nftsApiCasting();
    init_fixedUtils();
    init_iFixedUtils();
    _Casting = class _Casting {
      // =========================================================================
      //  Percentage <-> Bps
      // =========================================================================
      /**
       * Converts a decimal percentage into basis points (bps), returned as a bigint.
       * For example, 0.05 => 500 bps.
       *
       * @param percentage - The decimal percentage to convert (e.g., 0.05 for 5%).
       * @returns A bigint representing basis points.
       */
      static percentageToBps(percentage) {
        const bps = percentage * 1e4;
        return BigInt(Math.round(bps));
      }
      /**
       * Converts a bigint basis points value back to a decimal percentage.
       * For example, 500n => 0.05 (5%).
       *
       * @param bps - The bigint basis points to convert (e.g., 500n).
       * @returns The decimal percentage (0.05).
       */
      static bpsToPercentage(bps) {
        const bpsNumber = Number(bps);
        const percentage = bpsNumber / 1e4;
        return percentage;
      }
      /**
       * Extracts base64 BCS bytes from a `SuiObjectResponse` if present. Throws an error otherwise.
       *
       * @param suiObjectResponse - The Sui object response containing `bcsBytes`.
       * @returns A base64 string representing the object's BCS data.
       * @throws If the object response does not contain `bcsBytes`.
       */
      static bcsBytesFromSuiObjectResponse(suiObjectResponse) {
        const rawData = suiObjectResponse.data?.bcs;
        if (rawData && "bcsBytes" in rawData) {
          return rawData.bcsBytes;
        }
        throw new Error(
          `no bcs bytes found on object: ${suiObjectResponse.data?.objectId}`
        );
      }
    };
    _Casting.pools = PoolsApiCasting;
    _Casting.suiFrens = SuiFrensApiCasting;
    _Casting.faucet = FaucetApiCasting;
    _Casting.staking = StakingApiCasting;
    _Casting.nftAmm = NftAmmApiCasting;
    _Casting.router = RouterApiCasting;
    _Casting.perpetuals = PerpetualsApiCasting;
    _Casting.farms = FarmsApiCasting;
    _Casting.nfts = NftsApiCasting;
    _Casting.Fixed = FixedUtils;
    _Casting.IFixed = IFixedUtils;
    _Casting.u64MaxBigInt = BigInt("0xFFFFFFFFFFFFFFFF");
    _Casting.i64MaxBigInt = BigInt("9223372036854775807");
    _Casting.numberToFixedBigInt = (a) => BigInt(Math.floor(a * _Casting.Fixed.fixedOneN));
    _Casting.bigIntToFixedNumber = (a) => Number(a) / _Casting.Fixed.fixedOneN;
    _Casting.scaleNumberByBigInt = (scalar, int) => BigInt(Math.floor(scalar * Number(int)));
    _Casting.stringFromBytes = (bytes) => String.fromCharCode.apply(null, bytes);
    _Casting.bigIntFromBytes = (bytes) => BigInt(
      "0x" + bytes.reverse().map((byte) => byte.toString(16).padStart(2, "0")).join("")
    );
    _Casting.addressFromBcsBytes = (bytes) => Helpers.addLeadingZeroesToType(bcs.Address.parse(new Uint8Array(bytes)));
    _Casting.addressFromBytes = (bytes) => Helpers.addLeadingZeroesToType(
      "0x" + bytes.map((byte) => {
        const hex = byte.toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
      }).join("")
    );
    _Casting.addressFromStringBytes = (bytes) => _Casting.addressFromBytes(_Casting.bytesFromStringBytes(bytes));
    _Casting.bytesFromStringBytes = (bytes) => bytes.map((byte) => Number(byte));
    _Casting.unwrapDeserializedOption = (deserializedData) => {
      return "Some" in deserializedData ? deserializedData.Some : void 0;
    };
    _Casting.u8VectorFromString = (str) => {
      const textEncode = new TextEncoder();
      const encodedStr = textEncode.encode(str);
      const uint8s = [];
      for (const uint8 of encodedStr.values()) {
        uint8s.push(uint8);
      }
      return uint8s;
    };
    _Casting.normalizeSlippageTolerance = (slippageTolerance) => {
      return slippageTolerance / 100;
    };
    _Casting.castObjectBcs = (inputs) => {
      const { suiObjectResponse, bcsType, fromDeserialized } = inputs;
      const deserialized = bcsType.fromBase64(
        _Casting.bcsBytesFromSuiObjectResponse(suiObjectResponse)
      );
      return fromDeserialized(deserialized);
    };
    Casting = _Casting;
  }
});
var init_utils = __esm({
  "src/general/utils/index.ts"() {
    "use strict";
    init_casting();
    init_helpers();
  }
});
var Auth;
var init_auth = __esm({
  "src/packages/auth/auth.ts"() {
    "use strict";
    init_utils();
    init_caller();
    Auth = class _Auth extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new `Auth` instance for token-based rate limit increases.
       *
       * @param config - Optional caller configuration, including network and access token.
       */
      constructor(config) {
        super(config, "auth");
        this.refreshTimer = null;
        this.isCanceled = false;
      }
      // =========================================================================
      //  User-Facing
      // =========================================================================
      /**
       * Initializes the auth system by fetching an access token for the provided wallet address.
       * After obtaining the token, it automatically schedules periodic refresh calls until stopped.
       *
       * @param inputs - An object containing the user's `walletAddress` and a `signMessageCallback` function
       *  for cryptographically signing messages.
       *
       * @returns A function that, when called, cancels further token refresh attempts.
       *
       * @example
       * ```typescript
       * const auth = new Auth();
       * const stopAuth = await auth.init({
       *   walletAddress: "0x<address>",
       *   signMessageCallback: async ({ message }) => {
       *     // sign the message with your private key / keypair
       *   },
       * });
       *
       * // ... make authorized calls ...
       *
       * stopAuth(); // Cancel further token refreshes
       * ```
       */
      async init(inputs) {
        this.isCanceled = false;
        const startRefresh = async () => {
          if (this.isCanceled) {
            return;
          }
          const { accessToken, expirationTimestamp } = await this.getAccessToken(inputs);
          this.setAccessToken(accessToken);
          if (this.isCanceled) {
            return;
          }
          const TIMEOUT_REDUCTION_RATIO = 0.9;
          const interval = (expirationTimestamp - Date.now()) * TIMEOUT_REDUCTION_RATIO;
          this.refreshTimer = setTimeout(startRefresh, interval);
        };
        await startRefresh();
        return () => {
          this.isCanceled = true;
          if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
          }
        };
      }
      /**
       * Initializes the auth system by reading a local Sui keystore file (on the server side),
       * using the private keys matching a provided address to sign messages for token creation.
       * After the token is obtained, it automatically schedules periodic refresh calls until stopped.
       *
       * @param inputs - An object containing the target `walletAddress` and an optional path to the `.keystore`.
       *  If `path` is not provided, it defaults to `~/.sui/sui_config/sui.keystore`.
       * @returns A function that, when called, cancels further token refresh attempts.
       *
       * @throws If this method is called in a browser environment (client-side).
       *
       * @example
       * ```typescript
       * // On server:
       * const stopAuth = await auth.initFromSuiKeystore({
       *   walletAddress: "0x<address>",
       *   path: "/custom/path/to/keystore.json",
       * });
       * // authorized calls...
       * stopAuth();
       * ```
       */
      // public async initFromSuiKeystore(inputs: {
      // 	walletAddress: SuiAddress;
      // 	path?: string;
      // }): Promise<() => void> {
      // 	const { walletAddress, path: pathStr } = inputs;
      // 	if (typeof window === "undefined") {
      // 		// Node environment, proceed with reading a keystore
      // 		const fs = require("fs");
      // 		const path = require("path");
      // 		const os = require("os");
      // 		const keystorePath = pathStr
      // 			? path.join(pathStr)
      // 			: (() => {
      // 					// Default to ~/.sui/sui_config/sui.keystore
      // 					const homeDir = os.homedir();
      // 					if (!homeDir) {
      // 						throw new Error(
      // 							"cannot obtain home directory path"
      // 						);
      // 					}
      // 					return path.join(
      // 						homeDir,
      // 						".sui",
      // 						"sui_config",
      // 						"sui.keystore"
      // 					);
      // 			  })();
      // 		// Read JSON with an array of private keys
      // 		let privateKeys: string[];
      // 		try {
      // 			const fileContent = fs.readFileSync(keystorePath, "utf-8");
      // 			privateKeys = JSON.parse(fileContent);
      // 			if (!Array.isArray(privateKeys)) {
      // 				throw new Error(
      // 					"Invalid keystore format: Expected an array of private keys"
      // 				);
      // 			}
      // 		} catch (error) {
      // 			throw new Error(`Failed to read keystore file: ${error}`);
      // 		}
      // 		if (privateKeys.length <= 0) {
      // 			throw new Error(`Empty keystore file`);
      // 		}
      // 		// Find the matching key for the requested walletAddress
      // 		const foundKeypair = privateKeys
      // 			.map((privateKey) => Helpers.keypairFromPrivateKey(privateKey))
      // 			.find(
      // 				(keypair) =>
      // 					Helpers.addLeadingZeroesToType(
      // 						keypair.toSuiAddress()
      // 					) === Helpers.addLeadingZeroesToType(walletAddress)
      // 			);
      // 		if (!foundKeypair) {
      // 			throw new Error(
      // 				`No private key found in keystore file for ${walletAddress}`
      // 			);
      // 		}
      // 		// Initialize with sign callback
      // 		return this.init({
      // 			walletAddress,
      // 			signMessageCallback: async ({ message }) =>
      // 				foundKeypair.signPersonalMessage(message),
      // 		});
      // 	}
      // 	throw new Error("`initFromSuiKeystore` must be called on server-side");
      // }
      // =========================================================================
      //  Admin
      // =========================================================================
      /**
       * **Admin-only**: Creates a new auth account with specific rate limits for a given
       * `accountWalletAddress`. The `walletAddress` performing this action must have
       * admin privileges, or the call will fail. Use this to create custom sub-accounts
       * with limited scope or usage rates.
       *
       * @param inputs - Contains:
       *  - `walletAddress`: The admin's wallet address
       *  - `signMessageCallback`: The admin's signing callback
       *  - `accountName`: A short name or identifier for the account
       *  - `accountWalletAddress`: The Sui address representing this sub-account
       *  - `rateLimits`: An array specifying the rate limits (method-based) for the sub-account
       * @returns A promise resolving to `true` if successful, otherwise throws or returns `false`.
       */
      async adminCreateAuthAccount(inputs) {
        const {
          walletAddress,
          signMessageCallback,
          accountName,
          accountWalletAddress,
          rateLimits
        } = inputs;
        const serializedJson = _Auth.createSerializedJson("AccountCreate", {
          sub: accountName,
          wallet_address: Helpers.addLeadingZeroesToType(accountWalletAddress),
          rate_limits: rateLimits
        });
        const message2 = new TextEncoder().encode(serializedJson);
        const { signature } = await signMessageCallback({ message: message2 });
        return this.fetchApi("create-account", {
          signature,
          serializedJson,
          walletAddress: Helpers.addLeadingZeroesToType(walletAddress)
        });
      }
      // =========================================================================
      //  Private
      // =========================================================================
      /**
       * Requests a new access token from the API by sending a signed message
       * indicating the user wants a token.
       *
       * @param inputs - Contains the user's `walletAddress` and `signMessageCallback`.
       * @returns A response object that includes the `accessToken` and an `expirationTimestamp`.
       */
      async getAccessToken(inputs) {
        const { walletAddress, signMessageCallback } = inputs;
        const serializedJson = _Auth.createSerializedJson("GetAccessToken", {});
        const message2 = new TextEncoder().encode(serializedJson);
        const { signature } = await signMessageCallback({ message: message2 });
        return this.fetchApi(
          "access-token",
          {
            signature,
            serializedJson,
            walletAddress: Helpers.addLeadingZeroesToType(walletAddress)
          }
        );
      }
      // =========================================================================
      //  Private Static
      // =========================================================================
      /**
       * Creates a JSON string with a standard format:
       * ```json
       * {
       *   "date": <epoch-seconds>,
       *   "nonce": <random_number>,
       *   "method": <method_string>,
       *   "value": <passed_value>
       * }
       * ```
       *
       * @param method - A short method name describing the action ("GetAccessToken", "AccountCreate", etc.).
       * @param value - The data object to embed under the `value` field.
       * @returns A JSON-serialized string for signing.
       */
      static createSerializedJson(method, value) {
        const timestampSeconds = Math.floor(Date.now() / 1e3);
        const random = Math.floor(Math.random() * 1024 * 1024);
        const data = {
          date: timestampSeconds,
          nonce: random,
          method,
          value
        };
        return JSON.stringify(data);
      }
    };
  }
});
var init_auth2 = __esm({
  "src/packages/auth/index.ts"() {
    "use strict";
    init_auth();
  }
});
var FarmsStakingPool;
var init_farmsStakingPool = __esm({
  "src/packages/farms/farmsStakingPool.ts"() {
    "use strict";
    init_utils();
    init_caller();
    init_fixedUtils();
    init_coin();
    init_farms();
    FarmsStakingPool = class extends Caller {
      /**
       * Creates a `FarmsStakingPool` instance based on on-chain pool data.
       *
       * @param stakingPool - The on-chain data object describing the pool.
       * @param config - An optional `CallerConfig` for network settings.
       * @param api - An optional `AftermathApi` for transaction building.
       */
      constructor(stakingPool, config, api) {
        super(config, "farms");
        this.stakingPool = stakingPool;
        this.api = api;
        this.version = () => {
          return this.stakingPool.version;
        };
        this.isStrictLockEnforcement = () => {
          return this.stakingPool.lockEnforcement === "Strict";
        };
        this.isRelaxedLockEnforcement = () => {
          return this.stakingPool.lockEnforcement === "Relaxed";
        };
        this.rewardCoinTypes = () => {
          return this.stakingPool.rewardCoins.map((coin) => coin.coinType);
        };
        this.nonZeroRewardCoinTypes = () => {
          return this.stakingPool.rewardCoins.filter(
            (coin) => coin.emissionRate <= coin.actualRewards && coin.actualRewards > BigInt(0)
          ).map((coin) => coin.coinType);
        };
        this.rewardCoin = (inputs) => {
          const foundCoin = this.stakingPool.rewardCoins.find(
            (coin) => coin.coinType === inputs.coinType
          );
          if (!foundCoin) {
            throw new Error("Invalid coin type");
          }
          return foundCoin;
        };
        this.maxLockDurationMs = () => {
          return Math.max(
            Math.min(
              this.stakingPool.maxLockDurationMs,
              this.stakingPool.emissionEndTimestamp - Date.now()
            ),
            0
          );
        };
        this.emitRewards = () => {
          const currentTimestamp = Date.now();
          if (this.stakingPool.stakedAmount === BigInt(0)) {
            return;
          }
          const rewardCoins = Helpers.deepCopy(this.stakingPool.rewardCoins);
          for (const [rewardCoinIndex, rewardCoin] of rewardCoins.entries()) {
            if (currentTimestamp < rewardCoin.lastRewardTimestamp + rewardCoin.emissionSchedulesMs) {
              continue;
            }
            const rewardsToEmit = this.calcRewardsToEmit({ rewardCoin });
            if (rewardsToEmit === BigInt(0)) {
              continue;
            }
            this.increaseRewardsAccumulatedPerShare({
              rewardsToEmit,
              rewardCoinIndex
            });
            const numberOfEmissions = (currentTimestamp - rewardCoin.lastRewardTimestamp) / rewardCoin.emissionSchedulesMs;
            this.stakingPool.rewardCoins[rewardCoinIndex].lastRewardTimestamp = rewardCoin.lastRewardTimestamp + numberOfEmissions * rewardCoin.emissionSchedulesMs;
          }
        };
        this.calcApr = (inputs) => {
          const { coinType, price, decimals, tvlUsd } = inputs;
          if (price <= 0 || tvlUsd <= 0) {
            return 0;
          }
          const rewardCoin = this.rewardCoin({ coinType });
          const currentTimestamp = Date.now();
          if (rewardCoin.emissionRate > rewardCoin.actualRewards) {
            return 0;
          }
          if (rewardCoin.emissionStartTimestamp > currentTimestamp || currentTimestamp > this.stakingPool.emissionEndTimestamp) {
            return 0;
          }
          const emissionRateTokens = rewardCoin.emissionRate;
          const emissionRateUsd = Coin.balanceWithDecimals(emissionRateTokens, decimals) * price;
          const oneYearMs = 365 * 24 * 60 * 60 * 1e3;
          const rewardsUsdOneYear = emissionRateUsd * (oneYearMs / rewardCoin.emissionSchedulesMs);
          const apr = rewardsUsdOneYear / tvlUsd / Casting.bigIntToFixedNumber(this.stakingPool.maxLockMultiplier);
          return apr < 0 ? 0 : Number.isNaN(apr) ? 0 : apr;
        };
        this.calcTotalApr = (inputs) => {
          const { coinsToPrice, coinsToDecimals, tvlUsd } = inputs;
          const aprs = this.rewardCoinTypes().map(
            (coinType) => this.calcApr({
              coinType,
              price: coinsToPrice[coinType],
              decimals: coinsToDecimals[coinType],
              tvlUsd
            })
          );
          return Helpers.sum(aprs);
        };
        this.calcMultiplier = (inputs) => {
          const lockDurationMs = inputs.lockDurationMs > this.stakingPool.maxLockDurationMs ? this.stakingPool.maxLockDurationMs : inputs.lockDurationMs < this.stakingPool.minLockDurationMs ? this.stakingPool.minLockDurationMs : inputs.lockDurationMs;
          const totalPossibleLockDurationMs = this.stakingPool.maxLockDurationMs - this.stakingPool.minLockDurationMs;
          const newMultiplier = 1 + (lockDurationMs - this.stakingPool.minLockDurationMs) / (totalPossibleLockDurationMs <= 0 ? 1 : totalPossibleLockDurationMs) * (Casting.bigIntToFixedNumber(this.stakingPool.maxLockMultiplier) - 1);
          const multiplier = Casting.numberToFixedBigInt(newMultiplier);
          return multiplier < FixedUtils.fixedOneB ? FixedUtils.fixedOneB : Helpers.minBigInt(multiplier, this.stakingPool.maxLockMultiplier);
        };
        this.farmsApi = () => {
          const farms = this.api?.Farms();
          if (!farms) {
            throw new Error("missing AftermathApi instance");
          }
          return farms;
        };
        this.stakingPool = stakingPool;
      }
      // =========================================================================
      //  Public
      // =========================================================================
      // =========================================================================
      //  Stats
      // =========================================================================
      /**
       * Fetches the total value locked (TVL) for this staking pool alone.
       *
       * @returns A `number` representing this pool's TVL in USD (or another currency).
       *
       * @example
       * ```typescript
       * const poolTvl = await someFarmsPool.getTVL();
       * console.log(poolTvl);
       * ```
       */
      async getTVL() {
        return new Farms(this.config, this.api).getTVL({
          farmIds: [this.stakingPool.objectId]
        });
      }
      /**
       * Fetches the total value locked (TVL) of the reward coins in this specific staking pool.
       *
       * @returns A `number` representing this pool's reward TVL.
       *
       * @example
       * ```typescript
       * const rewardTvl = await someFarmsPool.getRewardsTVL();
       * console.log(rewardTvl);
       * ```
       */
      async getRewardsTVL() {
        return new Farms(this.config, this.api).getRewardsTVL({
          farmIds: [this.stakingPool.objectId]
        });
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      // =========================================================================
      //  Staking Transactions
      // =========================================================================
      /**
       * Builds a transaction to stake tokens into this pool, optionally locking them.
       *
       * @param inputs - Contains `stakeAmount`, `lockDurationMs`, `walletAddress`, and optional sponsorship.
       * @returns A transaction object (or bytes) that can be signed and executed to create a staked position.
       */
      async getStakeTransaction(inputs) {
        const args = {
          ...inputs,
          stakeCoinType: this.stakingPool.stakeCoinType,
          stakingPoolId: this.stakingPool.objectId
        };
        return this.version() === 1 ? this.farmsApi().fetchBuildStakeTxV1(args) : this.farmsApi().fetchBuildStakeTxV2({
          ...args
        });
      }
      // =========================================================================
      //  Reward Harvesting Transactions
      // =========================================================================
      /**
       * Builds a transaction to harvest rewards from multiple staked positions in this pool.
       *
       * @param inputs - Contains `stakedPositionIds`, the `walletAddress`, and optionally any others.
       * @returns A transaction that can be signed and executed to claim rewards from multiple positions.
       */
      async getHarvestRewardsTransaction(inputs) {
        const args = {
          ...inputs,
          stakeCoinType: this.stakingPool.stakeCoinType,
          stakingPoolId: this.stakingPool.objectId,
          rewardCoinTypes: this.nonZeroRewardCoinTypes()
        };
        return this.version() === 1 ? this.farmsApi().buildHarvestRewardsTxV1(args) : this.farmsApi().buildHarvestRewardsTxV2(args);
      }
      // =========================================================================
      //  Mutation/Creation Transactions (Owner Only)
      // =========================================================================
      /**
       * Builds a transaction to increase the emission rate (or schedule) for specific reward coins.
       *
       * @param inputs - Contains the `ownerCapId` that authorizes changes, plus an array of `rewards` with new emission details.
       * @returns A transaction to be signed and executed by the owner cap holder.
       */
      async getIncreaseRewardsEmissionsTransaction(inputs) {
        const args = {
          ...inputs,
          stakeCoinType: this.stakingPool.stakeCoinType,
          stakingPoolId: this.stakingPool.objectId
        };
        return this.version() === 1 ? this.farmsApi().buildIncreaseStakingPoolRewardsEmissionsTxV1(args) : this.farmsApi().buildIncreaseStakingPoolRewardsEmissionsTxV2(args);
      }
      /**
       * Builds a transaction to update the pool's minimum stake amount, only authorized by the `ownerCapId`.
       *
       * @param inputs - Contains the new `minStakeAmount`, the `ownerCapId`, and the calling `walletAddress`.
       * @returns A transaction that can be signed and executed to change the minimum stake requirement.
       */
      async getUpdateMinStakeAmountTransaction(inputs) {
        const args = {
          ...inputs,
          stakeCoinType: this.stakingPool.stakeCoinType,
          stakingPoolId: this.stakingPool.objectId
        };
        return this.version() === 1 ? this.farmsApi().buildSetStakingPoolMinStakeAmountTxV1(args) : this.farmsApi().buildSetStakingPoolMinStakeAmountTxV2(args);
      }
      /**
       * Builds a transaction granting a one-time admin cap to another address, allowing them to perform specific
       * one-time administrative actions (like initializing a reward).
       *
       * @param inputs - Body containing the `ownerCapId`, the `recipientAddress`, and the `rewardCoinType`.
       * @returns A transaction to be executed by the current pool owner.
       */
      getGrantOneTimeAdminCapTransaction(inputs) {
        return this.version() === 1 ? this.farmsApi().buildGrantOneTimeAdminCapTxV1(inputs) : this.farmsApi().buildGrantOneTimeAdminCapTxV2(inputs);
      }
      // =========================================================================
      //  Mutation Transactions (Owner/Admin Only)
      // =========================================================================
      /**
       * Builds a transaction to initialize a new reward coin in this pool, specifying the amount, emission rate,
       * and schedule parameters. This can be done by either the `ownerCapId` or a `oneTimeAdminCapId`.
       *
       * @param inputs - Contains emission info (rate, schedule) and which cap is used (`ownerCapId` or `oneTimeAdminCapId`).
       * @returns A transaction object for the reward initialization.
       */
      async getInitializeRewardTransaction(inputs) {
        const args = {
          ...inputs,
          stakeCoinType: this.stakingPool.stakeCoinType,
          stakingPoolId: this.stakingPool.objectId
        };
        return this.version() === 1 ? this.farmsApi().fetchBuildInitializeStakingPoolRewardTxV1(args) : this.farmsApi().fetchBuildInitializeStakingPoolRewardTxV2(args);
      }
      /**
       * Builds a transaction to add more reward coins (top-up) to an existing reward
       * coin configuration, either as the owner or via a one-time admin cap.
       *
       * @param inputs - Contains an array of reward objects, each specifying amount and coin type.
       * @returns A transaction that can be signed and executed to increase the reward distribution pool.
       */
      async getTopUpRewardsTransaction(inputs) {
        const args = {
          ...inputs,
          stakeCoinType: this.stakingPool.stakeCoinType,
          stakingPoolId: this.stakingPool.objectId
        };
        return this.version() === 1 ? this.farmsApi().fetchBuildTopUpStakingPoolRewardsTxV1(args) : this.farmsApi().fetchBuildTopUpStakingPoolRewardsTxV2(args);
      }
      /**
       * Builds a transaction to **remove (withdraw) undistributed reward coins** from the
       * staking pool for **one or more reward coin types** in a single call.
       *
       * Only the **pool owner** (via `ownerCapId`) can remove rewards. One-time admin caps
       * are **not** permitted for removals. This operation reduces the pool’s remaining
       * undistributed reward balances; it does **not** affect rewards already accrued/claimed
       * by stakers.
       *
       * Versioning:
       * - V1 → calls `buildRemoveStakingPoolRewardTxV1`
       * - V2 → calls `buildRemoveStakingPoolRewardTxV2`
       *
       * Notes:
       * - The effective `stakingPoolId` and `stakeCoinType` are taken from this instance’s
       *   `this.stakingPool` and override any values passed in `inputs`.
       *
       * @param inputs Parameters for reward removal.
       * @param inputs.rewards Array of removal entries. Each entry specifies:
       *   - `rewardCoinType`: Coin type to withdraw.
       *   - `rewardAmount`: Amount to withdraw (base units).
       * @param inputs.ownerCapId Object ID of the pool OwnerCap that authorizes the removal.
       * @param inputs.walletAddress Address that will sign/submit the transaction.
       * @returns A transaction object ready to sign and execute that removes the specified
       *          undistributed rewards for each entry in `inputs.rewards`.
       */
      getRemoveRewardsTransaction(inputs) {
        const args = {
          ...inputs,
          stakeCoinType: this.stakingPool.stakeCoinType,
          stakingPoolId: this.stakingPool.objectId
        };
        return this.version() === 1 ? this.farmsApi().buildRemoveStakingPoolRewardTxV1(args) : this.farmsApi().buildRemoveStakingPoolRewardTxV2(args);
      }
      // =========================================================================
      //  Private
      // =========================================================================
      // =========================================================================
      //  Calculations
      // =========================================================================
      /**
       * Updates `rewardsAccumulatedPerShare` by distributing `rewardsToEmit` among
       * the total staked amount with multiplier. This mimics on-chain distribution logic.
       *
       * @param inputs - Contains the `rewardsToEmit` and which `rewardCoinIndex` to update.
       */
      increaseRewardsAccumulatedPerShare(inputs) {
        const { rewardsToEmit, rewardCoinIndex } = inputs;
        const stakedWithMultiplier = this.stakingPool.stakedAmountWithMultiplier;
        if (stakedWithMultiplier === BigInt(0)) {
          return;
        }
        const newRewardsAccumulatedPerShare = rewardsToEmit * BigInt(1e18) / stakedWithMultiplier;
        if (newRewardsAccumulatedPerShare === BigInt(0)) {
          return;
        }
        this.stakingPool.rewardCoins[rewardCoinIndex].rewardsAccumulatedPerShare += newRewardsAccumulatedPerShare;
      }
      /**
       * Computes how many rewards to emit based on the time since `lastRewardTimestamp` and
       * the pool's emission schedule, clamped by the total `rewardsRemaining`.
       */
      calcRewardsToEmit(inputs) {
        const { rewardCoin } = inputs;
        const currentTimestamp = Date.now();
        const rewardsToEmit = this.calcRewardsEmittedFromTimeTmToTn({
          timestampTm: rewardCoin.lastRewardTimestamp,
          timestampTn: currentTimestamp,
          rewardCoin
        });
        const { rewardsRemaining } = rewardCoin;
        return rewardsRemaining < rewardsToEmit ? rewardsRemaining : rewardsToEmit;
      }
      /**
       * Calculates how many tokens were emitted between two timestamps (Tm and Tn) for a given reward coin,
       * based on the discrete `emissionRate` and `emissionSchedulesMs`.
       *
       * @param inputs - Contains `timestampTm`, `timestampTn`, and the relevant `rewardCoin`.
       * @returns The total number of tokens emitted in that time window.
       */
      calcRewardsEmittedFromTimeTmToTn(inputs) {
        const { timestampTm, timestampTn, rewardCoin } = inputs;
        const numberOfEmissionsFromTimeTmToTn = rewardCoin.emissionSchedulesMs === 0 ? 0 : (timestampTn - timestampTm) / rewardCoin.emissionSchedulesMs;
        return BigInt(Math.floor(numberOfEmissionsFromTimeTmToTn)) * rewardCoin.emissionRate;
      }
    };
  }
});
var FarmsStakedPosition;
var init_farmsStakedPosition = __esm({
  "src/packages/farms/farmsStakedPosition.ts"() {
    "use strict";
    init_utils();
    init_caller();
    init_fixedUtils();
    init_farms();
    init_farmsStakingPool();
    FarmsStakedPosition = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a `FarmsStakedPosition` instance for a user's staked position in a farm.
       *
       * @param stakedPosition - The on-chain data object representing the user's staked position.
       * @param trueLastHarvestRewardsTimestamp - Optionally overrides the last harvest time from the on-chain data.
       * @param config - Optional configuration for the underlying `Caller`.
       * @param api - Optional `AftermathApi` instance for transaction building.
       */
      constructor(stakedPosition, trueLastHarvestRewardsTimestamp = void 0, config, api) {
        super(config, "farms");
        this.stakedPosition = stakedPosition;
        this.api = api;
        this.version = () => {
          return this.stakedPosition.version;
        };
        this.isLocked = (inputs) => {
          return !this.isUnlocked(inputs);
        };
        this.isStrictlyLocked = (inputs) => {
          const { stakingPool } = inputs;
          return this.isLocked({ stakingPool }) && stakingPool.isStrictLockEnforcement();
        };
        this.isRelaxedLocked = (inputs) => {
          const { stakingPool } = inputs;
          return this.isLocked({ stakingPool }) && stakingPool.isRelaxedLockEnforcement();
        };
        this.isLockDuration = () => {
          return this.stakedPosition.lockDurationMs > 0;
        };
        this.unlockTimestamp = () => {
          return this.stakedPosition.lockStartTimestamp + this.stakedPosition.lockDurationMs;
        };
        this.rewardCoinsToClaimableBalance = (inputs) => {
          return this.stakedPosition.rewardCoins.reduce(
            (acc, coin) => ({
              ...acc,
              [coin.coinType]: this.rewardsEarned({
                ...inputs,
                coinType: coin.coinType
              })
            }),
            {}
          );
        };
        this.rewardCoinTypes = () => {
          return this.stakedPosition.rewardCoins.map((coin) => coin.coinType);
        };
        this.nonZeroRewardCoinTypes = (inputs) => {
          return Object.entries(this.rewardCoinsToClaimableBalance(inputs)).filter(([, val]) => val > BigInt(0)).map(([key]) => key);
        };
        this.rewardCoin = (inputs) => {
          const foundCoin = this.stakedPosition.rewardCoins.find(
            (coin) => coin.coinType === inputs.coinType
          );
          if (!foundCoin) {
            throw new Error("Invalid coin type");
          }
          return foundCoin;
        };
        this.hasClaimableRewards = (inputs) => {
          const { stakingPool } = inputs;
          return Helpers.sumBigInt(
            this.rewardCoinTypes().map(
              (coinType) => this.rewardsEarned({
                coinType,
                stakingPool
              })
            )
          ) > BigInt(0);
        };
        this.rewardsEarned = (inputs) => {
          if (inputs.stakingPool.rewardCoin(inputs).actualRewards === BigInt(0)) {
            return BigInt(0);
          }
          const rewardCoin = this.rewardCoin(inputs);
          const totalRewards = rewardCoin.multiplierRewardsAccumulated + rewardCoin.baseRewardsAccumulated;
          if (totalRewards < Farms.constants.minRewardsToClaim) {
            return BigInt(0);
          }
          return totalRewards > inputs.stakingPool.rewardCoin(inputs).actualRewards ? BigInt(0) : totalRewards;
        };
        this.updatePosition = (inputs) => {
          const stakingPool = new FarmsStakingPool(
            Helpers.deepCopy(inputs.stakingPool.stakingPool),
            this.config
          );
          if (this.stakedPosition.lockDurationMs <= stakingPool.stakingPool.maxLockDurationMs && this.stakedPosition.lockMultiplier <= stakingPool.stakingPool.maxLockMultiplier) {
          } else {
            stakingPool.stakingPool.stakedAmountWithMultiplier -= this.stakedPosition.stakedAmountWithMultiplier;
            this.stakedPosition.lockDurationMs = stakingPool.stakingPool.maxLockDurationMs;
            this.stakedPosition.lockMultiplier = stakingPool.stakingPool.maxLockMultiplier;
            this.stakedPosition.stakedAmountWithMultiplier = this.stakedPosition.stakedAmount * (this.stakedPosition.lockMultiplier - FixedUtils.fixedOneB) / FixedUtils.fixedOneB;
            this.stakedPosition.rewardCoins = [
              ...this.stakedPosition.rewardCoins.map((rewardCoin) => {
                const currentDebtPerShare = stakingPool.rewardCoin({
                  coinType: rewardCoin.coinType
                }).rewardsAccumulatedPerShare;
                return {
                  ...rewardCoin,
                  multiplierRewardsDebt: this.stakedPosition.stakedAmountWithMultiplier * currentDebtPerShare / FixedUtils.fixedOneB
                };
              })
            ];
            stakingPool.stakingPool.stakedAmountWithMultiplier += this.stakedPosition.stakedAmountWithMultiplier;
          }
          const currentTimestamp = Date.now();
          stakingPool.emitRewards();
          for (const [
            rewardCoinIndex,
            rewardCoin
          ] of stakingPool.stakingPool.rewardCoins.entries()) {
            if (rewardCoinIndex >= this.stakedPosition.rewardCoins.length) {
              this.stakedPosition.rewardCoins.push({
                coinType: rewardCoin.coinType,
                baseRewardsAccumulated: BigInt(0),
                baseRewardsDebt: BigInt(0),
                multiplierRewardsAccumulated: BigInt(0),
                multiplierRewardsDebt: BigInt(0)
              });
            }
            const stakedPositionRewardCoin = this.stakedPosition.rewardCoins[rewardCoinIndex];
            const [totalBaseRewardsFromTimeT0, totalMultiplierRewardsFromTimeT0] = this.calcTotalRewardsFromTimeT0({
              rewardsAccumulatedPerShare: rewardCoin.rewardsAccumulatedPerShare,
              multiplierRewardsDebt: stakedPositionRewardCoin.multiplierRewardsDebt,
              emissionEndTimestamp: stakingPool.stakingPool.emissionEndTimestamp
            });
            this.stakedPosition.rewardCoins[rewardCoinIndex].baseRewardsAccumulated = totalBaseRewardsFromTimeT0 - stakedPositionRewardCoin.baseRewardsDebt + stakedPositionRewardCoin.baseRewardsAccumulated;
            this.stakedPosition.rewardCoins[rewardCoinIndex].multiplierRewardsAccumulated = totalMultiplierRewardsFromTimeT0 - stakedPositionRewardCoin.multiplierRewardsDebt + stakedPositionRewardCoin.multiplierRewardsAccumulated;
            this.stakedPosition.rewardCoins[rewardCoinIndex].baseRewardsDebt = totalBaseRewardsFromTimeT0;
            this.stakedPosition.rewardCoins[rewardCoinIndex].multiplierRewardsDebt = totalMultiplierRewardsFromTimeT0;
          }
          this.stakedPosition.lastHarvestRewardsTimestamp = currentTimestamp;
        };
        this.isUnlocked = (inputs) => {
          const { stakingPool } = inputs;
          const currentTime = Date.now();
          return this.unlockTimestamp() <= currentTime || stakingPool.stakingPool.emissionEndTimestamp <= currentTime || stakingPool.stakingPool.isUnlocked;
        };
        this.farmsApi = () => {
          const farms = this.api?.Farms();
          if (!farms) {
            throw new Error("missing AftermathApi instance");
          }
          return farms;
        };
        this.stakedPosition = stakedPosition;
        this.trueLastHarvestRewardsTimestamp = trueLastHarvestRewardsTimestamp ?? stakedPosition.lastHarvestRewardsTimestamp;
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      // =========================================================================
      //  Staking Transactions
      // =========================================================================
      /**
       * Builds a transaction to deposit additional principal into this staked position.
       *
       * @param inputs - Contains `depositAmount`, the `walletAddress` performing the deposit, and optional sponsorship.
       * @returns A transaction object (or bytes) that can be signed and executed to increase stake.
       */
      async getDepositPrincipalTransaction(inputs) {
        const args = {
          ...inputs,
          stakedPositionId: this.stakedPosition.objectId,
          stakeCoinType: this.stakedPosition.stakeCoinType,
          stakingPoolId: this.stakedPosition.stakingPoolObjectId
        };
        return this.version() === 1 ? this.farmsApi().fetchBuildDepositPrincipalTxV1(args) : this.farmsApi().fetchBuildDepositPrincipalTxV2(args);
      }
      /**
       * Builds a transaction to unstake this entire position, optionally claiming SUI as afSUI.
       *
       * @param inputs - Contains `walletAddress`, the `FarmsStakingPool` reference, and optional `claimSuiAsAfSui`.
       * @returns A transaction that can be signed and executed to fully withdraw principal and possibly rewards.
       */
      async getUnstakeTransaction(inputs) {
        const args = {
          ...inputs,
          stakedPositionId: this.stakedPosition.objectId,
          stakeCoinType: this.stakedPosition.stakeCoinType,
          stakingPoolId: this.stakedPosition.stakingPoolObjectId,
          withdrawAmount: this.stakedPosition.stakedAmount,
          rewardCoinTypes: this.nonZeroRewardCoinTypes(inputs)
        };
        return this.version() === 1 ? this.farmsApi().buildUnstakeTxV1(args) : this.farmsApi().buildUnstakeTxV2(args);
      }
      /**
       * Builds a transaction to withdraw a partial amount of principal from this staked position.
       * Unlike `getUnstakeTransaction`, this does NOT destroy the position.
       *
       * @param inputs - Contains `walletAddress`, `withdrawAmount`, and the `FarmsStakingPool` reference.
       * @returns A transaction that can be signed and executed to withdraw principal without destroying the position.
       */
      async getWithdrawPrincipalTransaction(inputs) {
        const args = {
          ...inputs,
          stakedPositionId: this.stakedPosition.objectId,
          stakeCoinType: this.stakedPosition.stakeCoinType,
          stakingPoolId: this.stakedPosition.stakingPoolObjectId
        };
        return this.version() === 1 ? this.farmsApi().buildWithdrawPrincipalTxV1(args) : this.farmsApi().buildWithdrawPrincipalTxV2(args);
      }
      // =========================================================================
      //  Locking Transactions
      // =========================================================================
      /**
       * Builds a transaction to lock this position for a specified duration, increasing its lock multiplier (if any).
       *
       * @param inputs - Contains the `lockDurationMs` and the `walletAddress`.
       * @returns A transaction that can be signed and executed to lock the position.
       */
      async getLockTransaction(inputs) {
        const args = {
          ...inputs,
          stakedPositionId: this.stakedPosition.objectId,
          stakeCoinType: this.stakedPosition.stakeCoinType,
          stakingPoolId: this.stakedPosition.stakingPoolObjectId
        };
        return this.version() === 1 ? this.farmsApi().buildLockTxV1(args) : this.farmsApi().buildLockTxV2(args);
      }
      /**
       * Builds a transaction to re-lock this position (renew lock duration) at the current multiplier.
       *
       * @param inputs - Contains the `walletAddress`.
       * @returns A transaction that can be signed and executed to extend or refresh the lock.
       */
      async getRenewLockTransaction(inputs) {
        const args = {
          ...inputs,
          stakedPositionId: this.stakedPosition.objectId,
          stakeCoinType: this.stakedPosition.stakeCoinType,
          stakingPoolId: this.stakedPosition.stakingPoolObjectId
        };
        return this.version() === 1 ? this.farmsApi().buildRenewLockTxV1(args) : this.farmsApi().buildRenewLockTxV2(args);
      }
      /**
       * Builds a transaction to unlock this position, removing any lock-based multiplier.
       *
       * @param inputs - Contains the `walletAddress`.
       * @returns A transaction that can be signed and executed to unlock the position immediately.
       */
      async getUnlockTransaction(inputs) {
        const args = {
          ...inputs,
          stakedPositionId: this.stakedPosition.objectId,
          stakeCoinType: this.stakedPosition.stakeCoinType,
          stakingPoolId: this.stakedPosition.stakingPoolObjectId
        };
        return this.version() === 1 ? this.farmsApi().buildUnlockTxV1(args) : this.farmsApi().buildUnlockTxV2(args);
      }
      // =========================================================================
      //  Reward Harvesting Transactions
      // =========================================================================
      /**
       * Builds a transaction to harvest (claim) the rewards from this position,
       * optionally receiving SUI as afSUI.
       *
       * @param inputs - Includes the `walletAddress`, the `FarmsStakingPool`, and optional `claimSuiAsAfSui`.
       * @returns A transaction that can be signed and executed to claim accrued rewards.
       */
      async getHarvestRewardsTransaction(inputs) {
        const args = {
          ...inputs,
          stakedPositionIds: [this.stakedPosition.objectId],
          stakeCoinType: this.stakedPosition.stakeCoinType,
          stakingPoolId: this.stakedPosition.stakingPoolObjectId,
          rewardCoinTypes: this.nonZeroRewardCoinTypes(inputs)
        };
        return this.version() === 1 ? this.farmsApi().buildHarvestRewardsTxV1(args) : this.farmsApi().buildHarvestRewardsTxV2(args);
      }
      // =========================================================================
      //  Private
      // =========================================================================
      // =========================================================================
      //  Calculations
      // =========================================================================
      /**
       * Calculates the total base + multiplier rewards from time t0 for this position,
       * ensuring that multiplier rewards only apply during the locked period.
       *
       * @param inputs - Contains updated `rewardsAccumulatedPerShare`, the position’s `multiplierRewardsDebt`, and the pool’s `emissionEndTimestamp`.
       * @returns A tuple `[baseRewards, multiplierRewards]`.
       */
      calcTotalRewardsFromTimeT0(inputs) {
        const {
          rewardsAccumulatedPerShare,
          multiplierRewardsDebt,
          emissionEndTimestamp
        } = inputs;
        const lastRewardTimestamp = this.stakedPosition.lastHarvestRewardsTimestamp;
        const lockEndTimestamp = this.unlockTimestamp();
        const principalStakedAmount = this.stakedPosition.stakedAmount;
        const baseRewards = principalStakedAmount * rewardsAccumulatedPerShare / FixedUtils.fixedOneB;
        const multiplierEndTimestamp = Math.min(
          lockEndTimestamp,
          emissionEndTimestamp
        );
        const multiplierRewards = (() => {
          if (lastRewardTimestamp <= multiplierEndTimestamp) {
            return rewardsAccumulatedPerShare * this.stakedPosition.stakedAmountWithMultiplier / FixedUtils.fixedOneB;
          }
          return multiplierRewardsDebt;
        })();
        return [baseRewards, multiplierRewards];
      }
    };
  }
});
var Farms;
var init_farms = __esm({
  "src/packages/farms/farms.ts"() {
    "use strict";
    init_caller();
    init_farmsStakedPosition();
    init_farmsStakingPool();
    Farms = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new `Farms` instance for fetching staking pool data and building
       * farm-related transactions.
       *
       * @param config - Optional configuration, including network and access token.
       * @param api - An optional `AftermathApi` instance for advanced transaction building.
       */
      constructor(config, api) {
        super(config, "farms");
        this.api = api;
        this.farmsApi = () => {
          const farms = this.api?.Farms();
          if (!farms) {
            throw new Error("missing AftermathApi instance");
          }
          return farms;
        };
      }
      // =========================================================================
      //  Public
      // =========================================================================
      // =========================================================================
      //  Class Objects
      // =========================================================================
      /**
       * Fetches a single staking pool by its `objectId` from the farm API/indexer.
       *
       * @param inputs - An object containing the `objectId` of the staking pool.
       * @returns A `FarmsStakingPool` object representing the staking pool.
       *
       * @example
       * ```typescript
       * const pool = await farms.getStakingPool({ objectId: "0x<pool_id>" });
       * console.log(pool.stakingPool);
       * ```
       */
      async getStakingPool(inputs) {
        const stakingPool = await this.fetchApi(
          inputs.objectId
        );
        return new FarmsStakingPool(stakingPool, this.config, this.api);
      }
      /**
       * Fetches multiple staking pools by their `objectIds`.
       *
       * @param inputs - An object containing an array of `objectIds`.
       * @returns An array of `FarmsStakingPool` instances corresponding to each `objectId`.
       *
       * @example
       * ```typescript
       * const pools = await farms.getStakingPools({
       *   objectIds: ["0x<id1>", "0x<id2>"]
       * });
       * console.log(pools[0].stakingPool, pools[1].stakingPool);
       * ```
       */
      async getStakingPools(inputs) {
        const stakingPools = await this.fetchApi("", {
          farmIds: inputs.objectIds
        });
        return stakingPools.map(
          (stakingPool) => new FarmsStakingPool(stakingPool, this.config, this.api)
        );
      }
      /**
       * Fetches all existing staking pools registered within the indexer or farm API.
       *
       * @returns An array of `FarmsStakingPool` objects.
       *
       * @example
       * ```typescript
       * const allPools = await farms.getAllStakingPools();
       * console.log(allPools.map(pool => pool.stakingPool));
       * ```
       */
      async getAllStakingPools() {
        const stakingPools = await this.fetchApi("", {});
        return stakingPools.map(
          (pool) => new FarmsStakingPool(pool, this.config, this.api)
        );
      }
      /**
       * Fetches all staked positions owned by a given user.
       *
       * @param inputs - An object containing the user's `walletAddress`.
       * @returns An array of `FarmsStakedPosition` objects representing each of the user's staked positions.
       *
       * @example
       * ```typescript
       * const positions = await farms.getOwnedStakedPositions({
       *   walletAddress: "0x<user_address>"
       * });
       * console.log(positions);
       * ```
       */
      async getOwnedStakedPositions(inputs) {
        const positions = await this.fetchApi("owned-staked-positions", inputs);
        return positions.map(
          (pool) => new FarmsStakedPosition(pool, void 0, this.config, this.api)
        );
      }
      /**
       * Fetches all `StakingPoolOwnerCapObject`s that a given address owns.
       * These caps grant the owner the ability to modify staking pool parameters.
       *
       * @param inputs - An object containing the owner's `walletAddress`.
       * @returns An array of `StakingPoolOwnerCapObject`s.
       *
       * @example
       * ```typescript
       * const ownerCaps = await farms.getOwnedStakingPoolOwnerCaps({
       *   walletAddress: "0x<user_address>"
       * });
       * console.log(ownerCaps);
       * ```
       */
      async getOwnedStakingPoolOwnerCaps(inputs) {
        return this.fetchApi("owned-staking-pool-owner-caps", inputs);
      }
      /**
       * Fetches all `StakingPoolOneTimeAdminCapObject`s that a given address owns.
       * These caps grant one-time admin privileges, typically for initializing reward coins.
       *
       * @param inputs - An object containing the admin's `walletAddress`.
       * @returns An array of `StakingPoolOneTimeAdminCapObject`s.
       *
       * @example
       * ```typescript
       * const adminCaps = await farms.getOwnedStakingPoolOneTimeAdminCaps({
       *   walletAddress: "0x<user_address>"
       * });
       * console.log(adminCaps);
       * ```
       */
      async getOwnedStakingPoolOneTimeAdminCaps(inputs) {
        return this.fetchApi("owned-staking-pool-one-time-admin-caps", inputs);
      }
      // =========================================================================
      //  Stats
      // =========================================================================
      /**
       * Retrieves the total value locked (TVL) in the specified farm IDs or in all farms if none are specified.
       *
       * @param inputs - An optional object containing an array of `farmIds` to filter TVL by. If not provided, returns global TVL.
       * @returns A promise that resolves to a `number` representing the TVL in USD (or another relevant currency).
       *
       * @example
       * ```typescript
       * const tvl = await farms.getTVL();
       * console.log("All farms' TVL:", tvl);
       *
       * const tvlForSpecificFarm = await farms.getTVL({ farmIds: ["0x<farm_id>"] });
       * console.log("Specific farm's TVL:", tvlForSpecificFarm);
       * ```
       */
      async getTVL(inputs) {
        return this.fetchApi("tvl", inputs ?? {});
      }
      /**
       * Retrieves the total value locked (TVL) of reward coins across specified farm IDs or all farms if none are specified.
       *
       * @param inputs - An optional object containing an array of `farmIds`. If not provided, returns global reward TVL.
       * @returns A promise that resolves to a `number` representing the total rewards TVL in USD (or another relevant currency).
       *
       * @example
       * ```typescript
       * const rewardsTvl = await farms.getRewardsTVL();
       * console.log("All farms' rewards TVL:", rewardsTvl);
       *
       * const singleFarmRewardsTvl = await farms.getRewardsTVL({ farmIds: ["0x<farm_id>"] });
       * console.log("Single farm's rewards TVL:", singleFarmRewardsTvl);
       * ```
       */
      async getRewardsTVL(inputs) {
        return this.fetchApi("rewards-tvl", inputs ?? {});
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      /**
       * **Deprecated**: Use `getCreateStakingPoolTransactionV2()` instead.
       *
       * Builds a transaction to create a new staking pool (farming vault) on version 1 of the farm system.
       *
       * @param inputs - Contains pool creation parameters such as `minLockDurationMs`, `maxLockDurationMs`, etc.
       * @returns A transaction object (or bytes) that can be signed and submitted.
       *
       * @deprecated Please use `getCreateStakingPoolTransactionV2`.
       */
      async getCreateStakingPoolTransactionV1(inputs) {
        return this.farmsApi().buildCreateStakingPoolTxV1(inputs);
      }
      /**
       * Builds a transaction to create a new staking pool (farming vault) on version 2 of the farm system.
       *
       * @param inputs - Contains pool creation parameters such as `minLockDurationMs`, `maxLockDurationMs`, etc.
       * @returns A transaction object (or bytes) that can be signed and submitted.
       *
       * @example
       * ```typescript
       * const tx = await farms.getCreateStakingPoolTransactionV2({
       *   minLockDurationMs: 604800000, // 1 week
       *   maxLockDurationMs: 31536000000, // 1 year
       *   maxLockMultiplier: BigInt("2000000000"), // e.g. 2.0x
       *   minStakeAmount: BigInt("1000000"),
       *   stakeCoinType: "0x<coin_type>",
       *   walletAddress: "0x<admin_address>"
       * });
       * // sign and submit the transaction
       * ```
       */
      async getCreateStakingPoolTransactionV2(inputs) {
        return this.farmsApi().buildCreateStakingPoolTxV2(inputs);
      }
      // =========================================================================
      //  Events
      // =========================================================================
      /**
       * Fetches user-specific farm interaction events (e.g., staked, unlocked, withdrew) with optional pagination.
       *
       * @param inputs - Includes the user's `walletAddress`, along with `cursor` and `limit` for pagination.
       * @returns A paginated set of events of type `FarmUserEvent`.
       *
       * @example
       * ```typescript
       * const userEvents = await farms.getInteractionEvents({
       *   walletAddress: "0x<user_address>",
       *   cursor: 0,
       *   limit: 10
       * });
       * console.log(userEvents);
       * ```
       */
      async getInteractionEvents(inputs) {
        return this.fetchApiIndexerEvents("events-by-user", inputs);
      }
    };
    Farms.constants = {
      /**
       * The minimum number of rewards (in smallest units) that can be claimed.
       */
      minRewardsToClaim: BigInt(10),
      /**
       * The maximum lock multiplier that can be applied when locking a staked position.
       */
      maxLockMultiplier: 2
    };
  }
});
var init_farms2 = __esm({
  "src/packages/farms/index.ts"() {
    "use strict";
    init_farms();
    init_farmsStakedPosition();
    init_farmsStakingPool();
  }
});
var Faucet;
var init_faucet = __esm({
  "src/packages/faucet/faucet.ts"() {
    "use strict";
    init_caller();
    Faucet = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(config, api) {
        super(config, "faucet");
        this.api = api;
        this.faucetApi = () => {
          const faucet = this.api?.Faucet();
          if (!faucet) {
            throw new Error("missing AftermathApi instance");
          }
          return faucet;
        };
      }
      // =========================================================================
      //  Inspections
      // =========================================================================
      async getSupportedCoins() {
        return this.fetchApi("supported-coins");
      }
      // =========================================================================
      //  Events
      // =========================================================================
      // TODO: add mint coin event getter ?
      // =========================================================================
      //  Transactions
      // =========================================================================
      async getRequestCoinTransaction(inputs) {
        return this.faucetApi().buildRequestCoinTx(inputs);
      }
      async getMintSuiFrenTransaction(inputs) {
        return this.faucetApi().fetchBuildMintSuiFrenTx(inputs);
      }
    };
    Faucet.constants = {
      defaultRequestAmountUsd: 10
    };
  }
});
var init_faucet2 = __esm({
  "src/packages/faucet/index.ts"() {
    "use strict";
    init_faucet();
  }
});
var GasPools;
var init_gasPools = __esm({
  "src/packages/gasPools/gasPools.ts"() {
    "use strict";
    init_caller();
    GasPools = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(config, api) {
        super(config, "gas-pool");
        this.api = api;
      }
      // =========================================================================
      //  Pool
      // =========================================================================
      /**
       * Fetches the gas pool details for a given wallet address.
       *
       * @param inputs - {@link ApiGasPoolBody}
       * @returns {@link ApiGasPoolResponse} containing pool ID, balance, and whitelisted addresses.
       */
      async getPool(inputs) {
        return this.fetchApi("pool", inputs);
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      /**
       * Builds a transaction to create a new gas pool for the given wallet.
       *
       * When `deferShare` is `true`, the response includes `gasPoolArg` and
       * `sharePolicyArg` so you can compose additional commands (e.g. deposit,
       * grant) before calling {@link getShareTx} to finalize.
       *
       * @param inputs.walletAddress - Wallet address to create the gas pool for.
       * @param inputs.initialDepositAmount - Optional initial deposit amount in MIST.
       * @param inputs.deferShare - When true, returns args without sharing yet.
       * @param inputs.tx - Optional transaction to extend.
       * @returns `tx` plus optional `gasPoolArg` and `sharePolicyArg` when deferred.
       */
      async getCreateTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "transactions/create",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Builds a transaction to deposit into the gas pool.
       *
       * Supports SUI and non-SUI deposits. For non-SUI deposits, the input coin
       * is swapped into SUI via the Aftermath router before depositing.
       *
       * @param inputs.walletAddress - Wallet address submitting the deposit.
       * @param inputs.isSponsoredTx - Whether to build the transaction for sponsored gas. Defaults to false.
       * @param inputs.coinType - Coin type to deposit. Defaults to SUI.
       * @param inputs.amount - Amount to deposit (required when sourcing from wallet or for non-SUI).
       * @param inputs.coinArg - PTB coin argument to use as input (if omitted, sourced from wallet).
       * @param inputs.slippage - Slippage tolerance for non-SUI swaps (defaults to 0.01).
       * @param inputs.gasPoolArg - Optional gas pool argument from a previously-built PTB command.
       * @param inputs.tx - Optional transaction to extend.
       * @returns {@link SdkTransactionResponse} with `tx`.
       */
      async getDepositTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "transactions/deposit",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Builds a transaction to withdraw SUI from the gas pool.
       *
       * When `deferTransfer` is `true`, the withdrawn coin is not transferred.
       * Instead, `withdrawnCoinArg` is returned for further PTB composition.
       *
       * @param inputs.walletAddress - Wallet address submitting the withdrawal.
       * @param inputs.amount - Amount of SUI to withdraw in MIST.
       * @param inputs.recipientAddress - Optional recipient (defaults to `walletAddress`).
       * @param inputs.deferTransfer - When true, returns the withdrawn coin arg instead of transferring.
       * @param inputs.gasPoolArg - Optional gas pool argument from a previously-built PTB command.
       * @param inputs.tx - Optional transaction to extend.
       * @returns `tx` plus optional `withdrawnCoinArg` when deferred.
       */
      async getWithdrawTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "transactions/withdraw",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Builds a transaction to sponsor (rebate) the transaction sender
       * using SUI from the gas pool.
       *
       * @param inputs.walletAddress - Wallet address submitting the sponsor transaction.
       * @param inputs.amount - Amount of SUI to rebate in MIST.
       * @param inputs.tx - Optional transaction to extend.
       * @returns {@link SdkTransactionResponse} with `tx`.
       */
      async getSponsorTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "transactions/sponsor",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Builds a transaction to grant another wallet access to the gas pool.
       *
       * @param inputs.walletAddress - Owner wallet address.
       * @param inputs.targetWalletAddress - Wallet address to grant access to.
       * @param inputs.gasPoolArg - Optional gas pool argument from a previously-built PTB command.
       * @param inputs.tx - Optional transaction to extend.
       * @returns {@link SdkTransactionResponse} with `tx`.
       */
      async getGrantTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "transactions/grant",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Builds a transaction to revoke another wallet's access to the gas pool.
       *
       * @param inputs.walletAddress - Owner wallet address.
       * @param inputs.targetWalletAddress - Wallet address to revoke access from.
       * @param inputs.tx - Optional transaction to extend.
       * @returns {@link SdkTransactionResponse} with `tx`.
       */
      async getRevokeTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "transactions/revoke",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Builds a transaction to share a gas pool that was created with `deferShare: true`.
       *
       * Use this after composing additional commands (deposit, grant, etc.) with
       * the `gasPoolArg` returned by {@link getCreateTx}.
       *
       * @param inputs.gasPoolArg - Gas pool argument from a deferred create.
       * @param inputs.sharePolicyArg - Share policy argument from a deferred create.
       * @param inputs.tx - Optional transaction to extend.
       * @returns {@link SdkTransactionResponse} with `tx`.
       */
      async getShareTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "transactions/share",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          { txKind: true }
        );
      }
    };
  }
});
var init_gasPools2 = __esm({
  "src/packages/gasPools/index.ts"() {
    "use strict";
    init_gasPools();
  }
});
var _CmmmCalculations;
var CmmmCalculations;
var init_cmmmCalculations = __esm({
  "src/packages/pools/utils/cmmmCalculations.ts"() {
    "use strict";
    init_utils();
    init_fixedUtils();
    _CmmmCalculations = class _CmmmCalculations {
    };
    _CmmmCalculations.maxNewtonAttempts = 255;
    _CmmmCalculations.convergenceBound = 1e-9;
    _CmmmCalculations.tolerance = 1e-13;
    _CmmmCalculations.validityTolerance = 1e-6;
    _CmmmCalculations.calcInvariant = (pool) => {
      const flatness = FixedUtils.directCast(pool.flatness);
      let sum = 0;
      let prod = 0;
      let balance;
      let weight;
      for (const coin of Object.values(pool.coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        weight = FixedUtils.directCast(coin.weight);
        sum += weight * balance;
        prod += weight * Math.log(balance);
      }
      prod = Math.exp(prod);
      return _CmmmCalculations.calcInvariantQuadratic(prod, sum, flatness);
    };
    _CmmmCalculations.calcInvariantQuadratic = (prod, sum, flatness) => (Math.sqrt(
      prod * (prod * (flatness * flatness + (1 - flatness) * 4) + flatness * sum * 8)
    ) - flatness * prod) / 2;
    _CmmmCalculations.calcInvariantComponents = (pool, index) => {
      const flatness = FixedUtils.directCast(pool.flatness);
      let prod = 0;
      let sum = 0;
      let p0 = 0;
      let s0 = 0;
      let balance;
      let weight;
      let p;
      let s;
      for (const [coinType, coin] of Object.entries(pool.coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        weight = FixedUtils.directCast(coin.weight);
        p = weight * Math.log(balance);
        s = weight * balance;
        prod += p;
        sum += s;
        if (coinType !== index) {
          p0 += p;
          s0 += s;
        }
      }
      prod = Math.exp(prod);
      p0 = Math.exp(p0);
      return [
        prod,
        sum,
        p0,
        s0,
        _CmmmCalculations.calcInvariantQuadratic(prod, sum, flatness)
      ];
    };
    _CmmmCalculations.calcSpotPrice = (pool, coinTypeIn, coinTypeOut) => _CmmmCalculations.calcSpotPriceWithFees(pool, coinTypeIn, coinTypeOut, true);
    _CmmmCalculations.calcSpotPriceWithFees = (pool, coinTypeIn, coinTypeOut, ignoreFees) => {
      const a = FixedUtils.directCast(pool.flatness);
      const part1 = _CmmmCalculations.calcSpotPriceBody(pool);
      const coinIn = pool.coins[coinTypeIn];
      const coinOut = pool.coins[coinTypeOut];
      const balanceIn = FixedUtils.directCast(coinIn.normalizedBalance);
      const balanceOut = FixedUtils.directCast(coinOut.normalizedBalance);
      const weightIn = FixedUtils.directCast(coinIn.weight);
      const weightOut = FixedUtils.directCast(coinOut.weight);
      const swapFeeIn = ignoreFees ? 0 : FixedUtils.directCast(coinIn.tradeFeeIn);
      const swapFeeOut = ignoreFees ? 0 : FixedUtils.directCast(coinIn.tradeFeeOut);
      const sbi = weightOut * balanceIn;
      const sbo = (1 - (ignoreFees ? 0 : Casting.bpsToPercentage(
        pool.daoFeePoolObject?.feeBps ?? BigInt(0)
      ))) * (1 - swapFeeIn) * (1 - swapFeeOut) * weightIn * balanceOut;
      return sbi * (part1 + 2 * a * balanceOut) / (sbo * (part1 + 2 * a * balanceIn));
    };
    _CmmmCalculations.calcSpotPriceBody = (pool) => {
      const a = FixedUtils.directCast(pool.flatness);
      const ac = 1 - a;
      let prod = 0;
      let sum = 0;
      let balance;
      let weight;
      for (const coin of Object.values(pool.coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        weight = FixedUtils.directCast(coin.weight);
        prod += weight * Math.log(balance);
        sum += weight * balance;
      }
      prod = Math.exp(prod);
      const invarnt = _CmmmCalculations.calcInvariantQuadratic(prod, sum, a);
      return invarnt * invarnt / prod + ac * prod;
    };
    _CmmmCalculations.calcOutGivenIn = (pool, coinTypeIn, coinTypeOut, amountIn) => {
      if (coinTypeIn === coinTypeOut) {
        throw new Error("in and out must be different coins");
      }
      const coinIn = pool.coins[coinTypeIn];
      const coinOut = pool.coins[coinTypeOut];
      const swapFeeIn = FixedUtils.directCast(coinIn.tradeFeeIn);
      const swapFeeOut = FixedUtils.directCast(coinOut.tradeFeeOut);
      if (swapFeeIn >= 1 || swapFeeOut >= 1) {
        return BigInt(0);
      }
      const flatness = FixedUtils.directCast(pool.flatness);
      const oldIn = FixedUtils.directCast(coinIn.normalizedBalance);
      const oldOut = FixedUtils.directCast(coinOut.normalizedBalance);
      const wIn = FixedUtils.directCast(coinIn.weight);
      const wOut = FixedUtils.directCast(coinOut.weight);
      const [prod, , p0, s0, h] = _CmmmCalculations.calcInvariantComponents(
        pool,
        coinTypeOut
      );
      const feedAmountIn = (1 - swapFeeIn) * FixedUtils.castAndNormalize(coinIn.decimalsScalar, amountIn);
      const newIn = oldIn + feedAmountIn;
      const prodRatio = (newIn / oldIn) ** wIn;
      const newP0 = p0 * prodRatio;
      const xi = (prod / newP0) ** (1 / wOut);
      const newS0 = s0 + wIn * feedAmountIn;
      const tokenAmountOut = _CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
        flatness,
        wOut,
        h,
        xi,
        // initial estimate -- default can be (P(X) / p0)^n
        newP0,
        // P(B) / xi^(1/n) (everything but the missing part)
        newS0
        // S(B) - xi / n (everything but the missing part)
      );
      const amountOut = FixedUtils.uncastAndUnnormalize(
        coinOut.decimalsScalar,
        (oldOut - tokenAmountOut) * (1 - swapFeeOut)
      );
      if (!_CmmmCalculations.checkValid1dSwap(
        pool,
        coinTypeIn,
        coinTypeOut,
        amountIn,
        amountOut
      )) {
        throw new Error("invalid 1d swap");
      }
      return amountOut;
    };
    _CmmmCalculations.calcInGivenOut = (pool, coinTypeIn, coinTypeOut, amountOut) => {
      if (coinTypeIn === coinTypeOut) {
        throw new Error("in and out must be different coins");
      }
      const coinIn = pool.coins[coinTypeIn];
      const coinOut = pool.coins[coinTypeOut];
      const swapFeeIn = FixedUtils.directCast(coinIn.tradeFeeIn);
      const swapFeeOut = FixedUtils.directCast(coinOut.tradeFeeOut);
      if (swapFeeIn >= 1 || swapFeeOut >= 1) {
        if (amountOut === BigInt(0)) {
          return BigInt(0);
        }
        throw new Error("this swap is disabled");
      }
      const flatness = FixedUtils.directCast(pool.flatness);
      const oldIn = FixedUtils.directCast(coinIn.normalizedBalance);
      const oldOut = FixedUtils.directCast(coinOut.normalizedBalance);
      const wOut = FixedUtils.directCast(coinOut.weight);
      const wIn = FixedUtils.directCast(coinIn.weight);
      const [prod, , p0, s0, h] = _CmmmCalculations.calcInvariantComponents(
        pool,
        coinTypeIn
      );
      const feedAmountOut = FixedUtils.castAndNormalize(coinIn.decimalsScalar, amountOut) / (1 - swapFeeOut);
      const newOut = oldOut - feedAmountOut;
      const prodRatio = (newOut / oldOut) ** wOut;
      const newP0 = p0 * prodRatio;
      const xi = (prod / newP0) ** (1 / wIn);
      const newS0 = s0 - wOut * feedAmountOut;
      const tokenAmountIn = _CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
        flatness,
        wIn,
        h,
        xi,
        // initial estimate -- default can be (P(X) / p0)^n
        newP0,
        // P(B) / xi^(1/n) (everything but the missing part)
        newS0
        // S(B) - xi / n (everything but the missing part)
      );
      const amountIn = FixedUtils.uncastAndUnnormalize(
        coinOut.decimalsScalar,
        (tokenAmountIn - oldIn) / (1 - swapFeeIn)
      );
      if (!_CmmmCalculations.checkValid1dSwap(
        pool,
        coinTypeIn,
        coinTypeOut,
        amountIn,
        amountOut
      )) {
        throw new Error("invalid 1d swap");
      }
      return amountIn;
    };
    _CmmmCalculations.calcSwapFixedIn = (pool, amountsIn, amountsOutDirection) => {
      const coins = pool.coins;
      const invariant = _CmmmCalculations.calcInvariant(pool);
      const a = FixedUtils.directCast(pool.flatness);
      const ac = 1 - a;
      let t = 1;
      let prevT = t;
      let balance;
      let weight;
      let amountIn;
      let amountOut;
      let feeIn;
      let feeOut;
      let prod;
      let prod1;
      let sum;
      let sum1;
      let part1;
      let part2;
      let part3;
      let part4;
      let _skip;
      let drainT = Number.POSITIVE_INFINITY;
      let shifter = 1;
      for (const [coinType, coin] of Object.entries(coins)) {
        amountOut = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsOutDirection[coinType] || BigInt(0)
        );
        feeOut = FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeOut));
        if (amountOut > 0) {
          if (feeOut === 0) {
            throw new Error("this trade is disabled");
          }
          t = (FixedUtils.directCast(coin.normalizedBalance) + FixedUtils.castAndNormalize(
            coin.decimalsScalar,
            amountsIn[coinType] || BigInt(0)
          ) * FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeIn))) / amountOut * feeOut;
          drainT = Math.min(drainT, t);
        }
      }
      if (drainT === 0) {
        return BigInt(0);
      }
      while (shifter >= drainT) {
        shifter /= 2;
      }
      t = 1;
      for (let i = 0; i < _CmmmCalculations.maxNewtonAttempts; ++i) {
        prod = 0;
        prod1 = 0;
        sum = 0;
        sum1 = 0;
        _skip = false;
        for (const [coinType, coin] of Object.entries(coins)) {
          balance = FixedUtils.directCast(coin.normalizedBalance);
          weight = FixedUtils.directCast(coin.weight);
          amountIn = FixedUtils.castAndNormalize(
            coin.decimalsScalar,
            amountsIn[coinType] || BigInt(0)
          );
          amountOut = FixedUtils.castAndNormalize(
            coin.decimalsScalar,
            amountsOutDirection[coinType] || BigInt(0)
          );
          feeIn = FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeIn));
          feeOut = FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeOut));
          part1 = feeIn * amountIn;
          part2 = t * amountOut / feeOut;
          if (part2 >= balance + part1 + 1) {
            _skip = true;
            break;
          }
          part3 = balance + part1 - part2;
          part4 = weight * amountOut / feeOut;
          prod += weight * Math.log(part3);
          prod1 += part4 / part3;
          sum += weight * part3;
          sum1 += part4;
        }
        prod = Math.exp(prod);
        part1 = a * sum;
        part2 = ac * prod;
        part3 = part1 + part2;
        part4 = a * invariant * prod1;
        t = (a * (sum + 2 * t * sum1) + part3 + 2 * prod1 * t * part3 - (t * part4 + invariant * (a + invariant / prod))) / (2 * (prod1 * part3 + a * sum1) - part4);
        if (Helpers.closeEnough(t, prevT, _CmmmCalculations.convergenceBound)) {
          if (!_CmmmCalculations.checkValidSwap(
            pool,
            amountsIn,
            1,
            amountsOutDirection,
            t
          )) {
            throw new Error("invalid swap");
          }
          return FixedUtils.directUncast(t);
        }
        prevT = t;
      }
      throw new Error("Newton diverged");
    };
    _CmmmCalculations.calcSwapFixedOut = (pool, amountsInDirection, amountsOut) => {
      const coins = pool.coins;
      const invariant = _CmmmCalculations.calcInvariant(pool);
      const a = FixedUtils.directCast(pool.flatness);
      const ac = 1 - a;
      let t = 1;
      let prevT = 0;
      let balance;
      let weight;
      let amountIn;
      let amountOut;
      let feeIn;
      let feeOut;
      let prod;
      let prod1;
      let sum;
      let sum1;
      let part1;
      let part2;
      let part3;
      let part4;
      for (const [coinType, coin] of Object.entries(coins)) {
        if (coin.tradeFeeOut >= FixedUtils.fixedOneB && (amountsOut[coinType] || BigInt(0)) > BigInt(0)) {
          throw new Error("this trade is disabled");
        }
      }
      for (let i = 0; i < _CmmmCalculations.maxNewtonAttempts; ++i) {
        prod = 0;
        prod1 = 0;
        sum = 0;
        sum1 = 0;
        for (const [coinType, coin] of Object.entries(coins)) {
          balance = FixedUtils.directCast(coin.normalizedBalance);
          weight = FixedUtils.directCast(coin.weight);
          amountIn = FixedUtils.castAndNormalize(
            coin.decimalsScalar,
            amountsInDirection[coinType] || BigInt(0)
          );
          amountOut = FixedUtils.castAndNormalize(
            coin.decimalsScalar,
            amountsOut[coinType] || BigInt(0)
          );
          feeIn = 1 - FixedUtils.directCast(coin.tradeFeeIn);
          feeOut = 1 - FixedUtils.directCast(coin.tradeFeeOut);
          part1 = feeIn * amountIn;
          part2 = amountOut === 0 ? 0 : amountOut / feeOut;
          part3 = balance + t * part1 - part2;
          part4 = weight * part1;
          prod += weight * Math.log(part3);
          prod1 += part4 / part3;
          sum += weight * part3;
          sum1 += part4;
        }
        prod = Math.exp(prod);
        part1 = 2 * a * sum;
        part2 = ac * prod;
        part3 = part1 + part2;
        part4 = (part3 + part2) * prod1 + 2 * a * sum1 - a * invariant * prod1;
        t = (t * part4 + invariant * (a + invariant / prod) - part3) / part4;
        if (Helpers.closeEnough(t, prevT, _CmmmCalculations.convergenceBound)) {
          if (!_CmmmCalculations.checkValidSwap(
            pool,
            amountsInDirection,
            1,
            amountsOut,
            t
          )) {
            throw new Error("invalid swap");
          }
          return FixedUtils.directUncast(t);
        }
        prevT = t;
      }
      throw new Error("Newton diverged");
    };
    _CmmmCalculations.calcDepositFixedAmounts = (pool, amountsIn) => {
      const invariant = _CmmmCalculations.calcInvariant(pool);
      const coins = pool.coins;
      const a = FixedUtils.directCast(pool.flatness);
      const ac = 1 - a;
      let balance;
      let weight;
      let amount;
      let prod = 0;
      let sum = 0;
      let r = _CmmmCalculations.calcDepositFixedAmountsInitialEstimate(
        pool,
        amountsIn
      );
      let prevR = r;
      const fees = {};
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        amount = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsIn[coinType] || BigInt(0)
        );
        fees[coinType] = r * (balance + amount) >= balance ? 1 - FixedUtils.directCast(coin.tradeFeeIn) : 1 / (1 - FixedUtils.directCast(coin.tradeFeeOut));
      }
      let i = 0;
      let prod1;
      let sum1;
      let fee;
      let part1;
      let part2;
      let part3;
      let part4;
      while (i < _CmmmCalculations.maxNewtonAttempts) {
        prod = 0;
        prod1 = 0;
        sum = 0;
        sum1 = 0;
        for (const [coinType, coin] of Object.entries(coins)) {
          balance = FixedUtils.directCast(coin.normalizedBalance);
          weight = FixedUtils.directCast(coin.weight);
          amount = FixedUtils.castAndNormalize(
            coin.decimalsScalar,
            amountsIn[coinType] || BigInt(0)
          );
          fee = fees[coinType];
          part1 = balance + amount;
          part2 = fee * r * part1 + balance - fee * balance;
          part3 = weight * fee * part1;
          prod += weight * Math.log(part2);
          prod1 += part3 / part2;
          sum += weight * part2;
          sum1 += part3;
        }
        prod = Math.exp(prod);
        part3 = a * invariant * prod1;
        part4 = 2 * prod1 * (a * sum + ac * prod) + 2 * a * sum1;
        r = (r * part4 + invariant * (1 + invariant / prod) - (r * part3 + 2 * a * sum + ac * (prod + invariant))) / (part4 - part3);
        if (Helpers.closeEnough(r, prevR, _CmmmCalculations.convergenceBound)) {
          const scalar = FixedUtils.directUncast(r);
          if (!_CmmmCalculations.checkValidDeposit(pool, amountsIn, scalar)) {
            throw new Error("invalid deposit");
          }
          return scalar;
        }
        prevR = r;
        i += 1;
      }
      throw new Error("Newton diverged");
    };
    _CmmmCalculations.calcDepositFixedAmountsInitialEstimate = (pool, amountsIn) => {
      const invariant = _CmmmCalculations.calcInvariant(pool);
      const coins = pool.coins;
      const a = FixedUtils.directCast(pool.flatness);
      const ac = 1 - a;
      let balance;
      let amount;
      let weight;
      let r;
      let rMin = 0;
      let cfMin = 0;
      let prod = 0;
      let sum = 0;
      let part1;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        amount = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsIn[coinType] || BigInt(0)
        );
        weight = FixedUtils.directCast(coin.weight);
        part1 = balance + (1 - FixedUtils.directCast(coin.tradeFeeIn)) * amount;
        prod += weight * Math.log(part1);
        sum += weight * part1;
        r = FixedUtils.directCast(coin.tradeFeeOut) * balance / (balance + amount);
        rMin = Math.max(r, rMin);
      }
      prod = Math.exp(prod);
      let cfMax = 2 * a * prod * sum / (prod + invariant) + ac * prod;
      let rMax = 1;
      let cf;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        weight = FixedUtils.directCast(coin.weight);
        amount = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsIn[coinType] || BigInt(0)
        );
        r = balance / (balance + amount);
        if (r <= rMin) {
          continue;
        }
        prod = 0;
        sum = 0;
        for (const [coinType2, coin2] of Object.entries(coins)) {
          balance = FixedUtils.directCast(coin2.normalizedBalance);
          weight = FixedUtils.directCast(coin2.weight);
          amount = FixedUtils.castAndNormalize(
            coin2.decimalsScalar,
            amountsIn[coinType2] || BigInt(0)
          );
          part1 = r * (balance + amount);
          if (part1 >= balance) {
            part1 = balance + (1 - FixedUtils.directCast(coin2.tradeFeeIn)) * (part1 - balance);
          } else {
            part1 = balance - (balance - part1) / FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeOut));
          }
          prod += weight * Math.log(part1);
          sum += weight * part1;
        }
        prod = Math.exp(prod);
        cf = 2 * a * prod * sum / (prod + invariant) + ac * prod;
        if (cf <= invariant) {
          if (cf >= cfMin) {
            rMin = r;
            cfMin = cf;
          }
        }
        if (cf >= invariant) {
          if (cf <= cfMax) {
            rMax = r;
            cfMax = cf;
          }
        }
      }
      r = cfMin === cfMax ? rMin : (rMin * cfMax + (rMax - rMin) * invariant - rMax * cfMin) / (cfMax - cfMin);
      return r;
    };
    _CmmmCalculations.calcWithdrawFlpAmountsOut = (pool, amountsOutDirection, lpRatio) => {
      const invariant = _CmmmCalculations.calcInvariant(pool);
      const coins = pool.coins;
      const lpr = lpRatio;
      const lpc = 1 - lpr;
      const scaledInvariant = invariant * lpr;
      const a = FixedUtils.directCast(pool.flatness);
      const ac = 1 - a;
      let i;
      let prevR = 0;
      let balance;
      let weight;
      let amountOut;
      let fee;
      let prod;
      let prod1;
      let sum;
      let sum1;
      let part1;
      let part2;
      let part3;
      let part4;
      let skip;
      let shrinker = 1;
      let [r, rDrain] = _CmmmCalculations.calcWithdrawFlpAmountsOutInitialEstimate(
        pool,
        amountsOutDirection,
        lpRatio
      );
      while (shrinker >= rDrain) {
        shrinker /= 2;
      }
      const fees = {};
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        amountOut = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsOutDirection[coinType] || BigInt(0)
        );
        fees[coinType] = balance * lpc >= r * amountOut ? 1 - FixedUtils.directCast(coin.tradeFeeIn) : 1 / (1 - FixedUtils.directCast(coin.tradeFeeOut));
      }
      i = 0;
      while (i < _CmmmCalculations.maxNewtonAttempts) {
        prod = 0;
        prod1 = 0;
        sum = 0;
        sum1 = 0;
        skip = false;
        for (const [coinType, coin] of Object.entries(coins)) {
          balance = FixedUtils.directCast(coin.normalizedBalance);
          weight = FixedUtils.directCast(coin.weight);
          amountOut = FixedUtils.castAndNormalize(
            coin.decimalsScalar,
            amountsOutDirection[coinType] || BigInt(0)
          );
          fee = fees[coinType];
          part1 = balance * (lpr + lpc * fee);
          part2 = fee * r * amountOut;
          if (part2 + 1 >= part1) {
            skip = true;
            break;
          }
          part1 -= part2;
          part2 = weight * fee * amountOut;
          prod += weight * Math.log(part1);
          prod1 += part2 / part1;
          sum += weight * part1;
          sum1 += part2;
        }
        if (skip) {
          r = rDrain - shrinker / 2 ** i;
          i += 1;
          continue;
        }
        prod = Math.exp(prod);
        part1 = prod / scaledInvariant;
        part2 = 2 * a * sum;
        part3 = ac * (prod * part1 + 2 * prod + scaledInvariant) + part2;
        part4 = part3 * prod1 + 2 * a * (part1 + 1) * sum1;
        r = (r * part4 + part3 + part1 * part2 - prod - scaledInvariant * (2 + scaledInvariant / prod)) / part4;
        if (Helpers.closeEnough(r, prevR, _CmmmCalculations.convergenceBound)) {
          const returner = {};
          for (const coinType of Object.keys(coins)) {
            returner[coinType] = FixedUtils.directUncast(
              r * FixedUtils.directCast(amountsOutDirection[coinType] || BigInt(0))
            );
          }
          if (!_CmmmCalculations.checkValidWithdraw(pool, returner, lpRatio)) {
            throw new Error("invalid withdraw");
          }
          return returner;
        }
        prevR = r;
        i += 1;
      }
      throw new Error("Newton diverged");
    };
    _CmmmCalculations.calcWithdrawFlpAmountsOutInitialEstimate = (pool, amountsOutDirection, lpRatio) => {
      const invariant = _CmmmCalculations.calcInvariant(pool);
      const coins = pool.coins;
      const lpr = lpRatio;
      const lpc = 1 - lpr;
      const scaledInvariant = invariant * lpr;
      const a = FixedUtils.directCast(pool.flatness);
      const ac = 1 - a;
      let keepT;
      let tDrain;
      let t;
      let cf;
      let tMin;
      let cfMin;
      let tMax;
      let cfMax;
      let balance;
      let weight;
      let amountOut;
      let fee;
      let prod;
      let sum;
      let part1;
      let part2;
      let part3;
      tMax = 0;
      prod = 0;
      sum = 0;
      for (const coin of Object.values(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        weight = FixedUtils.directCast(coin.weight);
        fee = FixedUtils.directCast(coin.tradeFeeIn);
        part1 = balance * (1 + lpr * fee - fee);
        prod += weight * Math.log(part1);
        sum += weight * part1;
      }
      prod = Math.exp(prod);
      cfMax = 2 * a * prod * sum / (prod + scaledInvariant) + ac * prod;
      cfMin = 0;
      tMin = Number.POSITIVE_INFINITY;
      for (const [coinType, coin] of Object.entries(coins)) {
        amountOut = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsOutDirection[coinType] || BigInt(0)
        );
        if (amountOut === 0) {
          continue;
        }
        t = FixedUtils.directCast(coin.normalizedBalance) * FixedUtils.complement(
          FixedUtils.directCast(coin.tradeFeeOut) * lpRatio
        ) / amountOut;
        if (t < tMin) {
          tMin = t;
        }
      }
      tDrain = tMin;
      for (const [coinTypeT, coinT] of Object.entries(coins)) {
        amountOut = FixedUtils.castAndNormalize(
          coinT.decimalsScalar,
          amountsOutDirection[coinTypeT] || BigInt(0)
        );
        if (amountOut === 0) {
          continue;
        }
        balance = FixedUtils.directCast(coinT.normalizedBalance);
        t = balance * lpc / amountOut;
        prod = 0;
        sum = 0;
        keepT = true;
        for (const [coinType, coin] of Object.entries(coins)) {
          balance = FixedUtils.directCast(coin.normalizedBalance);
          weight = FixedUtils.directCast(coin.weight);
          amountOut = FixedUtils.castAndNormalize(
            coin.decimalsScalar,
            amountsOutDirection[coinType] || BigInt(0)
          );
          part1 = t * amountOut;
          if (part1 >= balance) {
            keepT = false;
            break;
          }
          part1 = balance - part1;
          part2 = lpr * balance;
          part3 = part1 >= part2 ? part2 + FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeIn)) * (part1 - part2) : part2 - (part2 - part1) / FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeOut));
          prod += weight * Math.log(part3);
          sum += weight * part3;
        }
        if (keepT) {
          prod = Math.exp(prod);
          cf = 2 * a * prod * sum / (prod + scaledInvariant) + ac * prod;
          if (cf >= scaledInvariant) {
            if (cf <= cfMax) {
              tMax = t;
              cfMax = cf;
            }
          }
          if (cf <= scaledInvariant) {
            if (cf >= cfMin) {
              tMin = t;
              cfMin = cf;
            }
          }
        }
      }
      t = cfMax === cfMin ? tMin : (tMin * cfMax + tMax * scaledInvariant - tMax * cfMin - tMin * scaledInvariant) / (cfMax - cfMin);
      return [t, tDrain];
    };
    _CmmmCalculations.calcAllCoinDeposit = (pool, amountsIn) => {
      const coins = pool.coins;
      let balance;
      let amountIn;
      let s;
      let sMin = Number.POSITIVE_INFINITY;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        amountIn = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsIn[coinType] || BigInt(0)
        );
        s = amountIn / balance;
        if (s < sMin) {
          sMin = s;
        }
      }
      const returner = {};
      for (const coinType of Object.keys(coins)) {
        returner[coinType] = Helpers.blendedOperations.mulNBB(
          sMin,
          amountsIn[coinType] || BigInt(0)
        );
      }
      return returner;
    };
    _CmmmCalculations.calcAllCoinWithdraw = (pool, amountsOut) => {
      const coins = pool.coins;
      let balance;
      let amountOut;
      let s;
      let sMax = 0;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        amountOut = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsOut[coinType] || BigInt(0)
        );
        s = amountOut / balance;
        if (s > sMax) {
          sMax = s;
        }
      }
      const returner = {};
      for (const coinType of Object.keys(coins)) {
        returner[coinType] = Helpers.blendedOperations.mulNBB(
          sMax,
          amountsOut[coinType] || BigInt(0)
        );
      }
      return returner;
    };
    _CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances = (flatness, w, h, xi, p0, s0) => {
      if (Number.isNaN(xi)) {
        throw new Error("initial estimate is not a number");
      }
      const ac = 1 - flatness;
      const aw = flatness * w;
      const acw = ac * w;
      const as0 = flatness * s0;
      const ah = flatness * h;
      const c1 = 2 * aw * w;
      const c2 = 2 * acw * p0;
      const c3 = 2 * w * as0 + ah;
      const c4 = h * h / p0;
      const c5 = ac * p0;
      const c6 = 2 * as0 + w * ah;
      const c7 = 2 * aw * (w + 1);
      const c8 = 2 * acw * p0;
      const c9 = 2 * aw * s0;
      const c10 = aw * h;
      let x = xi;
      let xw;
      let topPos;
      let topNeg;
      let bottomPos;
      let prevX = x;
      let i = 0;
      while (i < _CmmmCalculations.maxNewtonAttempts) {
        xw = x ** w;
        topPos = x * (xw * (c1 * x + c2 * xw + c3) + c4);
        topNeg = x * (xw * (c5 * xw + c6));
        bottomPos = c7 * x + c8 * xw + c9;
        if (topPos < topNeg || bottomPos < c10) {
          x = 1 / 2 ** i;
          i += 1;
          continue;
        }
        x = (topPos - topNeg) / (xw * (bottomPos - c10));
        if (Helpers.closeEnough(x, prevX, _CmmmCalculations.convergenceBound)) {
          return x;
        }
        prevX = x;
        i += 1;
      }
      throw new Error("Newton diverged");
    };
    _CmmmCalculations.checkValidSwap = (pool, amountsIn, amountsInScalar, amountsOut, amountsOutScalar) => {
      const coins = pool.coins;
      const flatness = FixedUtils.directCast(pool.flatness);
      let balance;
      let pseudobalance;
      let postbalance;
      let weight;
      let amountIn;
      let amountOut;
      let feedAmountIn;
      let feedAmountOut;
      let preprod = 0;
      let presum = 0;
      let pseudoprod = 0;
      let pseudosum = 0;
      let postprod = 0;
      let postsum = 0;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        weight = FixedUtils.directCast(coin.weight);
        amountIn = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsIn[coinType] || BigInt(0)
        ) * amountsInScalar;
        amountOut = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsOut[coinType] || BigInt(0)
        ) * amountsOutScalar;
        if (amountIn > 0 && amountOut > 0) {
          return false;
        }
        feedAmountIn = amountIn * (1 - FixedUtils.directCast(coin.tradeFeeIn));
        feedAmountOut = amountOut === 0 ? 0 : amountOut / (1 - FixedUtils.directCast(coin.tradeFeeOut));
        postbalance = balance + amountIn;
        if (amountOut > postbalance + 1) {
          return false;
        }
        postbalance -= -amountOut;
        pseudobalance = balance + feedAmountIn;
        if (feedAmountOut > pseudobalance + 1) {
          return false;
        }
        pseudobalance -= -feedAmountOut;
        preprod += weight * Math.log(balance);
        presum += weight * balance;
        postprod += weight * Math.log(postbalance);
        postsum += weight * postbalance;
        pseudoprod += weight * Math.log(pseudobalance);
        pseudosum += weight * pseudobalance;
      }
      preprod = Math.exp(preprod);
      postprod = Math.exp(postprod);
      pseudoprod = Math.exp(pseudoprod);
      const preinvariant = _CmmmCalculations.calcInvariantQuadratic(
        preprod,
        presum,
        flatness
      );
      const postinvariant = _CmmmCalculations.calcInvariantQuadratic(
        postprod,
        postsum,
        flatness
      );
      const pseudoinvariant = _CmmmCalculations.calcInvariantQuadratic(
        pseudoprod,
        pseudosum,
        flatness
      );
      return postinvariant * (1 + _CmmmCalculations.tolerance) >= preinvariant && (Helpers.veryCloseInt(
        preinvariant,
        pseudoinvariant,
        FixedUtils.fixedOneN
      ) || Helpers.closeEnough(
        preinvariant,
        pseudoinvariant,
        _CmmmCalculations.validityTolerance
      ));
    };
    _CmmmCalculations.checkValid1dSwap = (pool, coinTypeIn, coinTypeOut, amountInB, amountOutB) => {
      if (coinTypeIn === coinTypeOut) {
        return false;
      }
      const coins = pool.coins;
      const coinIn = coins[coinTypeIn];
      const coinOut = coins[coinTypeOut];
      const flatness = FixedUtils.directCast(pool.flatness);
      let balance;
      let pseudobalance;
      let postbalance;
      let weight;
      const amountIn = FixedUtils.castAndNormalize(
        coinIn.decimalsScalar,
        amountInB
      );
      const amountOut = FixedUtils.castAndNormalize(
        coinOut.decimalsScalar,
        amountOutB
      );
      const feedAmountIn = amountIn * (1 - FixedUtils.directCast(coinIn.tradeFeeIn));
      const feedAmountOut = amountOut === 0 ? 0 : amountOut / (1 - FixedUtils.directCast(coinOut.tradeFeeOut));
      let preprod = 0;
      let presum = 0;
      let pseudoprod = 0;
      let pseudosum = 0;
      let postprod = 0;
      let postsum = 0;
      let p;
      let s;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        weight = FixedUtils.directCast(coin.weight);
        p = weight * Math.log(balance);
        s = weight * balance;
        preprod += p;
        presum += s;
        if (coinType === coinTypeIn) {
          pseudobalance = balance + feedAmountIn;
          postbalance = balance + amountIn;
          pseudoprod += weight * Math.log(pseudobalance);
          pseudosum += weight * pseudobalance;
          postprod += weight * Math.log(postbalance);
          postsum += weight * postbalance;
        } else if (coinType === coinTypeOut) {
          if (feedAmountOut > balance + 1 || amountOut > balance + 1) {
            return false;
          }
          pseudobalance = balance - feedAmountOut;
          postbalance = balance - amountOut;
          pseudoprod += weight * Math.log(pseudobalance);
          pseudosum += weight * pseudobalance;
          postprod += weight * Math.log(postbalance);
          postsum += weight * postbalance;
        } else {
          pseudoprod += p;
          pseudosum += s;
          postprod += p;
          postsum += s;
        }
      }
      preprod = Math.exp(preprod);
      postprod = Math.exp(postprod);
      pseudoprod = Math.exp(pseudoprod);
      const preinvariant = _CmmmCalculations.calcInvariantQuadratic(
        preprod,
        presum,
        flatness
      );
      const postinvariant = _CmmmCalculations.calcInvariantQuadratic(
        postprod,
        postsum,
        flatness
      );
      const pseudoinvariant = _CmmmCalculations.calcInvariantQuadratic(
        pseudoprod,
        pseudosum,
        flatness
      );
      return postinvariant * (1 + _CmmmCalculations.tolerance) >= preinvariant && (Helpers.veryCloseInt(
        preinvariant,
        pseudoinvariant,
        FixedUtils.fixedOneN
      ) || Helpers.closeEnough(
        preinvariant,
        pseudoinvariant,
        _CmmmCalculations.validityTolerance
      ));
    };
    _CmmmCalculations.checkValidDeposit = (pool, amountsIn, lpRatioRaw) => {
      const coins = pool.coins;
      const lpRatio = FixedUtils.directCast(lpRatioRaw);
      if (lpRatio > 1) {
        return false;
      }
      const flatness = FixedUtils.directCast(pool.flatness);
      let balance;
      let weight;
      let amount;
      let postbalance;
      let pseudobalance;
      let diff;
      let pseudodiff;
      let preprod = 0;
      let presum = 0;
      let pseudoprod = 0;
      let pseudosum = 0;
      let postprod = 0;
      let postsum = 0;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        weight = FixedUtils.directCast(coin.weight);
        amount = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsIn[coinType] || BigInt(0)
        );
        postbalance = lpRatio * (balance + amount);
        if (postbalance >= balance) {
          diff = postbalance - balance;
          pseudodiff = diff * (1 - FixedUtils.directCast(coin.tradeFeeIn));
          pseudobalance = balance + pseudodiff;
        } else {
          diff = balance - postbalance;
          pseudodiff = diff === 0 ? 0 : diff / (1 - FixedUtils.directCast(coin.tradeFeeOut));
          if (pseudodiff >= balance + 1) {
            return false;
          }
          pseudobalance = balance - pseudodiff;
        }
        preprod += weight * Math.log(balance);
        presum += weight * balance;
        postprod += weight * Math.log(postbalance);
        postsum += weight * postbalance;
        pseudoprod += weight * Math.log(pseudobalance);
        pseudosum += weight * pseudobalance;
      }
      preprod = Math.exp(preprod);
      postprod = Math.exp(postprod);
      pseudoprod = Math.exp(pseudoprod);
      const preinvariant = _CmmmCalculations.calcInvariantQuadratic(
        preprod,
        presum,
        flatness
      );
      const postinvariant = _CmmmCalculations.calcInvariantQuadratic(
        postprod,
        postsum,
        flatness
      );
      const pseudoinvariant = _CmmmCalculations.calcInvariantQuadratic(
        pseudoprod,
        pseudosum,
        flatness
      );
      return postinvariant * (1 + _CmmmCalculations.tolerance) >= preinvariant && (Helpers.veryCloseInt(
        preinvariant,
        pseudoinvariant,
        FixedUtils.fixedOneN
      ) || Helpers.closeEnough(
        preinvariant,
        pseudoinvariant,
        _CmmmCalculations.validityTolerance
      ));
    };
    _CmmmCalculations.checkValidWithdraw = (pool, amountsOutSrc, lpRatio) => {
      const coins = pool.coins;
      if (lpRatio > 1) {
        return false;
      }
      const flatness = FixedUtils.directCast(pool.flatness);
      let balance;
      let weight;
      let amount;
      let scaledBalance;
      let postbalance;
      let pseudobalance;
      let diff;
      let pseudodiff;
      let preprod = 0;
      let presum = 0;
      let pseudoprod = 0;
      let pseudosum = 0;
      let postprod = 0;
      let postsum = 0;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        scaledBalance = lpRatio * balance;
        weight = FixedUtils.directCast(coin.weight);
        amount = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsOutSrc[coinType] || BigInt(0)
        );
        if (amount > scaledBalance + 1) {
          return false;
        }
        postbalance = balance - amount;
        if (postbalance >= scaledBalance) {
          diff = postbalance - scaledBalance;
          pseudodiff = diff * FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeIn));
          pseudobalance = scaledBalance + pseudodiff;
        } else {
          diff = scaledBalance - postbalance;
          pseudodiff = diff === 0 ? 0 : diff / FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeOut));
          if (pseudodiff > scaledBalance + 1) {
            return false;
          }
          pseudobalance = scaledBalance - pseudodiff;
        }
        preprod += weight * Math.log(scaledBalance);
        presum += weight * scaledBalance;
        postprod += weight * Math.log(postbalance);
        postsum += weight * postbalance;
        pseudoprod += weight * Math.log(pseudobalance);
        pseudosum += weight * pseudobalance;
      }
      preprod = Math.exp(preprod);
      postprod = Math.exp(postprod);
      pseudoprod = Math.exp(pseudoprod);
      const preinvariant = _CmmmCalculations.calcInvariantQuadratic(
        preprod,
        presum,
        flatness
      );
      const postinvariant = _CmmmCalculations.calcInvariantQuadratic(
        postprod,
        postsum,
        flatness
      );
      const pseudoinvariant = _CmmmCalculations.calcInvariantQuadratic(
        pseudoprod,
        pseudosum,
        flatness
      );
      return postinvariant * (1 + _CmmmCalculations.tolerance) >= preinvariant && (Helpers.veryCloseInt(
        preinvariant,
        pseudoinvariant,
        FixedUtils.fixedOneN
      ) || Helpers.closeEnough(
        preinvariant,
        pseudoinvariant,
        _CmmmCalculations.validityTolerance
      ));
    };
    _CmmmCalculations.getEstimateOutGivenIn = (pool, coinTypeIn, coinTypeOut, amountIn) => Helpers.blendedOperations.mulNBB(
      _CmmmCalculations.calcSpotPriceWithFees(pool, coinTypeIn, coinTypeOut),
      amountIn
    );
    _CmmmCalculations.getEstimateInGivenOut = (pool, coinTypeIn, coinTypeOut, amountOut) => Helpers.blendedOperations.mulNBB(
      1 / _CmmmCalculations.calcSpotPriceWithFees(pool, coinTypeIn, coinTypeOut),
      amountOut
    );
    _CmmmCalculations.getEstimateSwapFixedIn = (pool, amountsIn, amountsOutDirection) => {
      const coins = pool.coins;
      const spotBody = _CmmmCalculations.calcSpotPriceBody(pool);
      const a = FixedUtils.directCast(pool.flatness);
      let balance;
      let grad;
      let amountIn;
      let amountOut;
      let inDotGrad = 0;
      let outDotGrad = 0;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        amountIn = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsIn[coinType] || BigInt(0)
        );
        amountOut = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsOutDirection[coinType] || BigInt(0)
        );
        grad = amountIn === 0 ? FixedUtils.directCast(coin.weight) * (spotBody + 2 * a * balance) / (balance * (1 - FixedUtils.directCast(coin.tradeFeeOut))) : FixedUtils.directCast(coin.weight) * (1 - FixedUtils.directCast(coin.tradeFeeIn)) * (spotBody + 2 * a * balance) / balance;
        inDotGrad += amountIn * grad;
        outDotGrad += amountOut * grad;
      }
      return inDotGrad / outDotGrad;
    };
    _CmmmCalculations.getEstimateSwapFixedOut = (pool, amountsInDirection, amountsOut) => {
      const coins = pool.coins;
      const spotBody = _CmmmCalculations.calcSpotPriceBody(pool);
      const a = FixedUtils.directCast(pool.flatness);
      let balance;
      let grad;
      let amountIn;
      let amountOut;
      let inDotGrad = 0;
      let outDotGrad = 0;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        amountIn = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsInDirection[coinType] || BigInt(0)
        );
        amountOut = FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsOut[coinType] || BigInt(0)
        );
        grad = amountIn === 0 ? FixedUtils.directCast(coin.weight) * (spotBody + 2 * a * balance) / (balance * (1 - FixedUtils.directCast(coin.tradeFeeOut))) : FixedUtils.directCast(coin.weight) * (1 - FixedUtils.directCast(coin.tradeFeeIn)) * (spotBody + 2 * a * balance) / balance;
        inDotGrad += amountIn * grad;
        outDotGrad += amountOut * grad;
      }
      return outDotGrad / inDotGrad;
    };
    _CmmmCalculations.getEstimateDepositFixedAmounts = (pool, amountsIn) => {
      const r0 = _CmmmCalculations.calcDepositFixedAmountsInitialEstimate(
        pool,
        amountsIn
      );
      const coins = pool.coins;
      const spotBody = _CmmmCalculations.calcSpotPriceBody(pool);
      const a = FixedUtils.directCast(pool.flatness);
      let d1 = 0;
      let d2 = 0;
      let balance;
      let weight;
      let amount;
      let grad;
      let scaledAmount;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        weight = FixedUtils.directCast(coin.weight);
        amount = balance + FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsIn[coinType] || BigInt(0)
        );
        scaledAmount = amount * r0;
        grad = scaledAmount < balance ? (
          // use amount out
          weight * (spotBody + 2 * a * balance) / (balance * (1 - FixedUtils.directCast(coin.tradeFeeOut)))
        ) : (
          // use amount in
          weight * (1 - FixedUtils.directCast(coin.tradeFeeIn)) * (spotBody + 2 * a * balance) / balance
        );
        d1 += balance * grad;
        d2 += amount * grad;
      }
      return d1 / d2;
    };
    _CmmmCalculations.getEstimateWithdrawFlpAmountsOut = (pool, amountsOutDirection, lpRatio) => {
      const [r0, _rDrain] = _CmmmCalculations.calcWithdrawFlpAmountsOutInitialEstimate(
        pool,
        amountsOutDirection,
        lpRatio
      );
      const coins = pool.coins;
      const spotBody = _CmmmCalculations.calcSpotPriceBody(pool) * lpRatio;
      const a = FixedUtils.directCast(pool.flatness);
      let d1 = 0;
      let d2 = 0;
      let balance;
      let scaledAmount;
      let weight;
      let amount;
      let grad;
      for (const [coinType, coin] of Object.entries(coins)) {
        balance = FixedUtils.directCast(coin.normalizedBalance);
        weight = FixedUtils.directCast(coin.weight);
        amount = balance + FixedUtils.castAndNormalize(
          coin.decimalsScalar,
          amountsOutDirection[coinType] || BigInt(0)
        );
        scaledAmount = amount * r0;
        grad = scaledAmount < balance ? (
          // use amount out
          weight * (spotBody + 2 * a * balance) / (balance * (1 - FixedUtils.directCast(coin.tradeFeeOut)))
        ) : (
          // use amount in
          weight * (1 - FixedUtils.directCast(coin.tradeFeeIn)) * (spotBody + 2 * a * balance) / balance
        );
        d1 += balance * grad;
        d2 += amount * grad;
      }
      return (1 - lpRatio) * d1 / d2;
    };
    CmmmCalculations = _CmmmCalculations;
  }
});
var _Pool;
var Pool;
var init_pool = __esm({
  "src/packages/pools/pool.ts"() {
    "use strict";
    init_utils();
    init_caller();
    init_pools2();
    init_cmmmCalculations();
    _Pool = class _Pool2 extends Caller {
      /**
       * Creates a new instance of the `Pool` class for on-chain interaction.
       *
       * @param pool - The fetched `PoolObject` from Aftermath API or on-chain query.
       * @param config - Optional caller configuration (e.g., network, access token).
       * @param api - An optional `AftermathApi` instance for advanced transaction usage.
       */
      constructor(pool, config, api) {
        super(config, `pools/${pool.objectId}`);
        this.pool = pool;
        this.api = api;
        this.getVolume24hrs = async () => {
          return this.fetchApi("volume-24hrs");
        };
        this.getSpotPrice = (inputs) => {
          const spotPriceWithDecimals = CmmmCalculations.calcSpotPriceWithFees(
            Helpers.deepCopy(this.pool),
            inputs.coinInType,
            inputs.coinOutType,
            !inputs.withFees
          );
          return spotPriceWithDecimals * Number(this.pool.coins[inputs.coinOutType].decimalsScalar) / Number(this.pool.coins[inputs.coinInType].decimalsScalar);
        };
        this.getTradeAmountOut = (inputs) => {
          const pool2 = Helpers.deepCopy(this.pool);
          const coinInPoolBalance = pool2.coins[inputs.coinInType].balance;
          const coinOutPoolBalance = pool2.coins[inputs.coinOutType].balance;
          const coinInAmountWithFees = this.getAmountWithDAOFee({
            amount: Pools.getAmountWithProtocolFees({
              amount: inputs.coinInAmount
            })
          });
          if (Number(coinInAmountWithFees) / Number(coinInPoolBalance) >= Pools.constants.bounds.maxTradePercentageOfPoolBalance - _Pool2.constants.percentageBoundsMarginOfError) {
            throw new Error(
              "coinInAmountWithFees / coinInPoolBalance >= maxTradePercentageOfPoolBalance"
            );
          }
          const coinOutAmount = CmmmCalculations.calcOutGivenIn(
            pool2,
            inputs.coinInType,
            inputs.coinOutType,
            coinInAmountWithFees
          );
          if (coinOutAmount <= 0) {
            throw new Error("coinOutAmount <= 0");
          }
          if (Number(coinOutAmount) / Number(coinOutPoolBalance) >= Pools.constants.bounds.maxTradePercentageOfPoolBalance - _Pool2.constants.percentageBoundsMarginOfError) {
            throw new Error(
              "coinOutAmount / coinOutPoolBalance >= maxTradePercentageOfPoolBalance"
            );
          }
          return coinOutAmount;
        };
        this.getTradeAmountIn = (inputs) => {
          const pool2 = Helpers.deepCopy(this.pool);
          const coinInPoolBalance = pool2.coins[inputs.coinInType].balance;
          const coinOutPoolBalance = pool2.coins[inputs.coinOutType].balance;
          if (Number(inputs.coinOutAmount) / Number(coinOutPoolBalance) >= Pools.constants.bounds.maxTradePercentageOfPoolBalance - _Pool2.constants.percentageBoundsMarginOfError) {
            throw new Error(
              "coinOutAmount / coinOutPoolBalance >= maxTradePercentageOfPoolBalance"
            );
          }
          const coinInAmount = CmmmCalculations.calcInGivenOut(
            pool2,
            inputs.coinInType,
            inputs.coinOutType,
            inputs.coinOutAmount
          );
          if (coinInAmount <= 0) {
            throw new Error("coinInAmount <= 0");
          }
          if (Number(coinInAmount) / Number(coinInPoolBalance) >= Pools.constants.bounds.maxTradePercentageOfPoolBalance - _Pool2.constants.percentageBoundsMarginOfError) {
            throw new Error(
              "coinInAmount / coinInPoolBalance >= maxTradePercentageOfPoolBalance"
            );
          }
          const coinInAmountWithoutFees = this.getAmountWithoutDAOFee({
            amount: Pools.getAmountWithoutProtocolFees({
              amount: coinInAmount
            })
          });
          return coinInAmountWithoutFees;
        };
        this.getDepositLpAmountOut = (inputs) => {
          const calcedLpRatio = CmmmCalculations.calcDepositFixedAmounts(
            this.pool,
            Object.entries(inputs.amountsIn).reduce(
              (acc, [coin, amount]) => ({
                ...acc,
                [coin]: this.getAmountWithDAOFee({ amount })
              }),
              {}
            )
          );
          if (calcedLpRatio >= Casting.Fixed.fixedOneB) {
            throw new Error("lpRatio >= 1");
          }
          const lpRatio = Casting.bigIntToFixedNumber(calcedLpRatio);
          const lpAmountOut = BigInt(
            Math.floor(Number(this.pool.lpCoinSupply) * (1 / lpRatio - 1))
          );
          return {
            lpAmountOut,
            lpRatio
          };
        };
        this.getWithdrawAmountsOut = (inputs) => {
          const amountsOut = CmmmCalculations.calcWithdrawFlpAmountsOut(
            this.pool,
            inputs.amountsOutDirection,
            inputs.lpRatio
          );
          for (const coin of Object.keys(amountsOut)) {
            if (!(coin in inputs.amountsOutDirection) || inputs.amountsOutDirection[coin] <= BigInt(0)) {
              continue;
            }
            const amountOut = amountsOut[coin];
            if (amountOut <= 0) {
              throw new Error(`amountsOut[${coin}] <= 0`);
            }
            if (Number(amountOut) / Number(this.pool.coins[coin].balance) >= Pools.constants.bounds.maxWithdrawPercentageOfPoolBalance) {
              throw new Error(
                "coinOutAmount / coinOutPoolBalance >= maxWithdrawPercentageOfPoolBalance"
              );
            }
            amountsOut[coin] = this.getAmountWithDAOFee({ amount: amountOut });
          }
          return amountsOut;
        };
        this.getWithdrawAmountsOutSimple = (inputs) => {
          const { lpCoinAmountIn, coinTypesOut, referral } = inputs;
          const lpCoinSupply = this.pool.lpCoinSupply;
          const withdrawAmountsEstimates = {};
          coinTypesOut.forEach((poolCoin) => {
            const poolCoinAmountInPool = this.pool.coins[Helpers.addLeadingZeroesToType(poolCoin)].balance;
            const poolCoinAmount = Number(poolCoinAmountInPool) * (Number(lpCoinAmountIn) / Number(lpCoinSupply));
            withdrawAmountsEstimates[Helpers.addLeadingZeroesToType(poolCoin)] = BigInt(Math.floor(poolCoinAmount));
          });
          const lpRatio = this.getMultiCoinWithdrawLpRatio({
            lpCoinAmountIn
          });
          const amountsOut = this.getWithdrawAmountsOut({
            lpRatio,
            amountsOutDirection: withdrawAmountsEstimates,
            referral
          });
          for (const coin of Object.keys(amountsOut)) {
            if (!coinTypesOut.map((coinOut) => Helpers.addLeadingZeroesToType(coinOut)).includes(coin)) {
              continue;
            }
            const amountOut = amountsOut[coin];
            if (amountOut <= BigInt(0)) {
              throw new Error(`amountsOut[${coin}] <= 0 `);
            }
            if (amountOut / this.pool.coins[coin].balance >= Pools.constants.bounds.maxWithdrawPercentageOfPoolBalance) {
              throw new Error(
                "coinOutAmount / coinOutPoolBalance >= maxWithdrawPercentageOfPoolBalance"
              );
            }
            amountsOut[coin] = this.getAmountWithDAOFee({
              amount: amountOut
            });
          }
          return amountsOut;
        };
        this.getAllCoinWithdrawAmountsOut = (inputs) => {
          if (inputs.lpRatio >= 1) {
            throw new Error("lpRatio >= 1");
          }
          const amountsOut = Object.entries(this.pool.coins).reduce(
            (acc, [coin, info]) => {
              return {
                ...acc,
                [coin]: this.getAmountWithDAOFee({
                  amount: BigInt(Math.floor(Number(info.balance) * inputs.lpRatio))
                })
              };
            },
            {}
          );
          return amountsOut;
        };
        this.getMultiCoinWithdrawLpRatio = (inputs) => Number(this.pool.lpCoinSupply - inputs.lpCoinAmountIn) / Number(this.pool.lpCoinSupply);
        this.getAllCoinWithdrawLpRatio = (inputs) => Number(inputs.lpCoinAmountIn) / Number(this.pool.lpCoinSupply);
        this.coins = () => {
          return Object.keys(this.pool.coins).sort((a, b) => a.localeCompare(b));
        };
        this.poolCoins = () => {
          return Object.entries(this.pool.coins).sort((a, b) => a[0].localeCompare(b[0])).map((data) => data[1]);
        };
        this.poolCoinEntries = () => {
          return Object.entries(this.pool.coins).sort(
            (a, b) => a[0].localeCompare(b[0])
          );
        };
        this.daoFeePercentage = () => {
          return this.pool.daoFeePoolObject ? Casting.bpsToPercentage(this.pool.daoFeePoolObject.feeBps) : void 0;
        };
        this.daoFeeRecipient = () => {
          return this.pool.daoFeePoolObject?.feeRecipient;
        };
        this.getAmountWithDAOFee = (inputs) => {
          const daoFeePercentage = this.daoFeePercentage();
          if (!daoFeePercentage) {
            return inputs.amount;
          }
          return BigInt(Math.floor(Number(inputs.amount) * (1 - daoFeePercentage)));
        };
        this.getAmountWithoutDAOFee = (inputs) => {
          const daoFeePercentage = this.daoFeePercentage();
          if (!daoFeePercentage) {
            return inputs.amount;
          }
          return BigInt(
            Math.floor(Number(inputs.amount) * (1 / (1 - daoFeePercentage)))
          );
        };
        this.poolsApi = () => {
          const pools = this.api?.Pools();
          if (!pools) {
            throw new Error("missing AftermathApi instance");
          }
          return pools;
        };
        this.pool = pool;
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      /**
       * Builds or fetches a deposit transaction to add liquidity to this pool.
       * The resulting `Transaction` can be signed and submitted by the user.
       *
       * @param inputs - The deposit parameters including coin amounts, slippage, etc.
       * @returns A `Transaction` to deposit funds into the pool.
       *
       * @example
       * ```typescript
       * const depositTx = await pool.getDepositTransaction({
       *   walletAddress: "0x...",
       *   amountsIn: { "0x<coin>": BigInt(1000000) },
       *   slippage: 0.01,
       * });
       * ```
       */
      async getDepositTransaction(inputs) {
        return this.poolsApi().fetchBuildDepositTx({
          ...inputs,
          pool: this
        });
      }
      /**
       * Builds or fetches a withdrawal transaction to remove liquidity from this pool.
       *
       * @param inputs - The parameters specifying how much LP is burned, desired coins out, slippage, etc.
       * @returns A `Transaction` to withdraw funds from the pool.
       *
       * @example
       * ```typescript
       * const withdrawTx = await pool.getWithdrawTransaction({
       *   walletAddress: "0x...",
       *   amountsOutDirection: {
       *     "0x<coin>": BigInt(500000),
       *   },
       *   lpCoinAmount: BigInt(1000000),
       *   slippage: 0.01,
       * });
       * ```
       */
      async getWithdrawTransaction(inputs) {
        return this.poolsApi().fetchBuildWithdrawTx({
          ...inputs,
          pool: this
        });
      }
      /**
       * Builds or fetches a transaction to withdraw all coin types from this pool,
       * effectively "burning" an LP position in exchange for multiple coin outputs.
       *
       * @param inputs - The parameters specifying how much LP to burn.
       * @returns A `Transaction` to withdraw all coins from the pool in proportion.
       *
       * @example
       * ```typescript
       * const allCoinWithdrawTx = await pool.getAllCoinWithdrawTransaction({
       *   walletAddress: "0x...",
       *   lpCoinAmount: BigInt(500000),
       * });
       * ```
       */
      async getAllCoinWithdrawTransaction(inputs) {
        return this.poolsApi().fetchBuildAllCoinWithdrawTx({
          ...inputs,
          pool: this
        });
      }
      /**
       * Builds or fetches a trade transaction to swap between two coin types in this pool.
       *
       * @param inputs - The trade parameters including coin in/out, amounts, slippage, etc.
       * @returns A `Transaction` that can be signed and executed for the swap.
       *
       * @example
       * ```typescript
       * const tradeTx = await pool.getTradeTransaction({
       *   walletAddress: "0x...",
       *   coinInType: "0x<coinA>",
       *   coinInAmount: BigInt(1000000),
       *   coinOutType: "0x<coinB>",
       *   slippage: 0.005,
       * });
       * ```
       */
      async getTradeTransaction(inputs) {
        return this.poolsApi().fetchBuildTradeTx({
          ...inputs,
          pool: this
        });
      }
      /**
       * Builds a transaction to update the DAO fee percentage for this pool,
       * if it has a DAO fee configured. The user must own the appropriate
       * `daoFeePoolOwnerCap`.
       *
       * @param inputs - Includes user wallet, `daoFeePoolOwnerCapId`, and the new fee percentage.
       * @returns A `Transaction` that can be signed to update the DAO fee on chain.
       * @throws If this pool has no DAO fee configuration.
       *
       * @example
       * ```typescript
       * const tx = await pool.getUpdateDaoFeeTransaction({
       *   walletAddress: "0x...",
       *   daoFeePoolOwnerCapId: "0x<capId>",
       *   newFeePercentage: 0.01, // 1%
       * });
       * ```
       */
      async getUpdateDaoFeeTransaction(inputs) {
        const daoFeePoolId = this.pool.daoFeePoolObject?.objectId;
        if (!daoFeePoolId) {
          throw new Error("this pool has no DAO fee");
        }
        return this.poolsApi().buildDaoFeePoolUpdateFeeBpsTx({
          ...inputs,
          daoFeePoolId,
          lpCoinType: this.pool.lpCoinType,
          newFeeBps: Casting.percentageToBps(inputs.newFeePercentage)
        });
      }
      /**
       * Builds a transaction to update the DAO fee recipient for this pool,
       * if it has a DAO fee configured. The user must own the appropriate
       * `daoFeePoolOwnerCap`.
       *
       * @param inputs - Includes user wallet, `daoFeePoolOwnerCapId`, and the new fee recipient.
       * @returns A `Transaction` that can be signed to update the DAO fee recipient on chain.
       * @throws If this pool has no DAO fee configuration.
       *
       * @example
       * ```typescript
       * const tx = await pool.getUpdateDaoFeeRecipientTransaction({
       *   walletAddress: "0x...",
       *   daoFeePoolOwnerCapId: "0x<capId>",
       *   newFeeRecipient: "0x<recipient>",
       * });
       * ```
       */
      async getUpdateDaoFeeRecipientTransaction(inputs) {
        const daoFeePoolId = this.pool.daoFeePoolObject?.objectId;
        if (!daoFeePoolId) {
          throw new Error("this pool has no DAO fee");
        }
        return this.poolsApi().buildDaoFeePoolUpdateFeeRecipientTx({
          ...inputs,
          daoFeePoolId,
          lpCoinType: this.pool.lpCoinType,
          newFeeRecipient: Helpers.addLeadingZeroesToType(inputs.newFeeRecipient)
        });
      }
      // =========================================================================
      //  Inspections
      // =========================================================================
      /**
       * Fetches comprehensive pool statistics (volume, TVL, fees, APR, etc.) from the Aftermath API.
       * Also caches the result in `this.stats`.
       *
       * @returns A promise resolving to `PoolStats` object.
       *
       * @example
       * ```typescript
       * const stats = await pool.getStats();
       * console.log(stats.volume, stats.fees, stats.apr);
       * ```
       */
      async getStats() {
        const stats = await this.fetchApi("stats");
        this.setStats(stats);
        return stats;
      }
      /**
       * Caches the provided stats object into `this.stats`.
       *
       * @param stats - The `PoolStats` object to store.
       */
      setStats(stats) {
        this.stats = stats;
      }
      /**
       * Fetches an array of volume data points for a specified timeframe.
       * This is often used for charting or historical references.
       *
       * @param inputs - Contains a `timeframe` key, such as `"1D"` or `"1W"`.
       * @returns A promise resolving to an array of `PoolDataPoint`.
       *
       * @example
       * ```typescript
       * const volumeData = await pool.getVolumeData({ timeframe: "1D" });
       * console.log(volumeData); // e.g. [{ time: 1686000000, value: 123.45 }, ...]
       * ```
       */
      async getVolumeData(inputs) {
        return this.fetchApi(`volume/${inputs.timeframe}`);
      }
      /**
       * Fetches an array of fee data points for a specified timeframe.
       *
       * @param inputs - Contains a `timeframe` key, e.g., `"1D"` or `"1W"`.
       * @returns A promise resolving to an array of `PoolDataPoint`.
       *
       * @example
       * ```typescript
       * const feeData = await pool.getFeeData({ timeframe: "1D" });
       * console.log(feeData);
       * ```
       */
      async getFeeData(inputs) {
        return this.fetchApi(`fees/${inputs.timeframe}`);
      }
      // =========================================================================
      //  Events
      // =========================================================================
      /**
       * Fetches user interaction events (deposit/withdraw) with this pool, optionally paginated.
       *
       * @param inputs - Includes user `walletAddress` and optional pagination fields.
       * @returns A promise that resolves to `PoolDepositEvent | PoolWithdrawEvent` objects with a cursor if more exist.
       *
       * @example
       * ```typescript
       * const events = await pool.getInteractionEvents({ walletAddress: "0x...", limit: 10 });
       * console.log(events.events, events.nextCursor);
       * ```
       */
      async getInteractionEvents(inputs) {
        return this.fetchApiIndexerEvents("interaction-events-by-user", inputs);
      }
    };
    _Pool.constants = {
      percentageBoundsMarginOfError: 1e-3
      // 0.1%
    };
    Pool = _Pool;
  }
});
var _Pools;
var Pools;
var init_pools = __esm({
  "src/packages/pools/pools.ts"() {
    "use strict";
    init_caller();
    init_fixedUtils();
    init_helpers();
    init_coin();
    init_pool();
    _Pools = class _Pools extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new `Pools` instance for querying and managing AMM pools on Aftermath.
       *
       * @param config - Optional configuration object specifying network or access token.
       * @param api - An optional `AftermathApi` instance providing advanced transaction building.
       */
      constructor(config, api) {
        super(config, "pools");
        this.api = api;
        this.getPoolObjectIdForLpCoinType = (inputs) => {
          return this.getPoolObjectIdsForLpCoinTypes({
            lpCoinTypes: [inputs.lpCoinType]
          });
        };
        this.isLpCoinType = async (inputs) => {
          const result = await this.getPoolObjectIdForLpCoinType(inputs);
          return result.some((id) => id !== void 0);
        };
        this.getTotalVolume24hrs = async () => {
          return this.fetchApi("volume-24hrs");
        };
        this.poolsApi = () => {
          const pools = this.api?.Pools();
          if (!pools) {
            throw new Error("missing AftermathApi instance");
          }
          return pools;
        };
      }
      // =========================================================================
      //  Class Objects
      // =========================================================================
      // =========================================================================
      //  Pool Class
      // =========================================================================
      /**
       * Fetches a single pool by its on-chain `objectId` and returns a new `Pool` instance.
       *
       * @param inputs - An object containing `objectId`.
       * @returns A promise that resolves to a `Pool` instance.
       *
       * @example
       * ```typescript
       * const pool = await pools.getPool({ objectId: "0x<poolId>" });
       * console.log(pool.pool.lpCoinType, pool.pool.name);
       * ```
       */
      async getPool(inputs) {
        const pool = await this.fetchApi(inputs.objectId);
        return new Pool(pool, this.config, this.api);
      }
      /**
       * Fetches multiple pools by their on-chain `objectIds` and returns an array of `Pool` instances.
       *
       * @param inputs - An object containing an array of `objectIds`.
       * @returns A promise that resolves to an array of `Pool` instances.
       *
       * @example
       * ```typescript
       * const poolArray = await pools.getPools({ objectIds: ["0x<id1>", "0x<id2>"] });
       * console.log(poolArray.length);
       * ```
       */
      async getPools(inputs) {
        const pools = await this.fetchApi("", {
          poolIds: inputs.objectIds
        });
        return pools.map((pool) => new Pool(pool, this.config, this.api));
      }
      /**
       * Retrieves all pools recognized by the Aftermath API, returning an array of `Pool` objects.
       *
       * @returns An array of `Pool` instances.
       *
       * @example
       * ```typescript
       * const allPools = await pools.getAllPools();
       * console.log(allPools.map(p => p.pool.name));
       * ```
       */
      async getAllPools() {
        const pools = await this.fetchApi("", {});
        return pools.map((pool) => new Pool(pool, this.config, this.api));
      }
      /**
       * Fetches information about all owned LP coins for a given wallet address.
       * This indicates the user's liquidity positions across multiple pools.
       *
       * @param inputs - An object containing the `walletAddress`.
       * @returns An array of `PoolLpInfo` objects summarizing the user's LP balances.
       *
       * @example
       * ```typescript
       * const lpCoins = await pools.getOwnedLpCoins({ walletAddress: "0x<address>" });
       * console.log(lpCoins);
       * ```
       */
      async getOwnedLpCoins(inputs) {
        return this.fetchApi("owned-lp-coins", inputs);
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      /**
       * Constructs or fetches a transaction to publish a new LP coin package,
       * typically used by advanced users or devs establishing new liquidity pools.
       *
       * @param inputs - Includes the user `walletAddress` and the `lpCoinDecimals`.
       * @returns A transaction object (or data) that can be signed and published to Sui.
       *
       * @example
       * ```typescript
       * const publishTx = await pools.getPublishLpCoinTransaction({
       *   walletAddress: "0x<address>",
       *   lpCoinDecimals: 9
       * });
       * ```
       */
      async getPublishLpCoinTransaction(inputs) {
        return this.poolsApi().buildPublishLpCoinTx(inputs);
      }
      /**
       * Constructs a transaction to create a brand new pool on-chain, given coin types,
       * initial weights, fees, and possible DAO fee info.
       *
       * @param inputs - The body describing how to form the new pool.
       * @returns A transaction object that can be signed and executed.
       *
       * @example
       * ```typescript
       * const createPoolTx = await pools.getCreatePoolTransaction({
       *   walletAddress: "0x<address>",
       *   lpCoinType: "0x<lpCoin>",
       *   lpCoinMetadata: {
       *     name: "MyPool LP",
       *     symbol: "MYPLP"
       *   },
       *   coinsInfo: [
       *     {
       *       coinType: "0x<coinA>",
       *       weight: 0.5,
       *       decimals: 9,
       *       tradeFeeIn: 0.003,
       *       initialDeposit: 1_000_000_000n
       *     },
       *     // ...
       *   ],
       *   poolName: "My Weighted Pool",
       *   createPoolCapId: "0x<capId>",
       *   respectDecimals: true,
       * });
       * ```
       */
      async getCreatePoolTransaction(inputs) {
        return this.fetchApiTransaction("transactions/create-pool", inputs);
      }
      /**
       * Retrieves multiple pool object IDs given an array of LP coin types.
       * If a given LP coin type has no associated pool, it might return `undefined`.
       *
       * @param inputs - Contains an array of `lpCoinTypes`.
       * @returns An array of `ObjectId | undefined` of matching length.
       *
       * @example
       * ```typescript
       * const poolIds = await pools.getPoolObjectIdsForLpCoinTypes({
       *   lpCoinTypes: ["0x<lpCoinA>", "0x<lpCoinB>"]
       * });
       * console.log(poolIds);
       * ```
       */
      async getPoolObjectIdsForLpCoinTypes(inputs) {
        return this.fetchApi("pool-object-ids", inputs);
      }
      /**
       * Retrieves the total value locked (TVL) across all or specific pool IDs.
       *
       * @param inputs - Optionally provide an array of specific `poolIds`. If omitted, returns global TVL.
       * @returns A promise resolving to a numeric TVL (e.g., in USD).
       *
       * @example
       * ```typescript
       * const allTvl = await pools.getTVL();
       * const subsetTvl = await pools.getTVL({ poolIds: ["0x<id1>", "0x<id2>"] });
       * ```
       */
      async getTVL(inputs) {
        return this.fetchApi("tvl", inputs ?? {});
      }
      /**
       * Fetches an array of `PoolStats` objects for a given set of pools,
       * including volume, fees, TVL, and other metrics.
       *
       * @param inputs - Must include an array of `poolIds`.
       * @returns An array of `PoolStats` in matching order.
       *
       * @example
       * ```typescript
       * const stats = await pools.getPoolsStats({ poolIds: ["0x<id1>", "0x<id2>"] });
       * console.log(stats[0].volume, stats[1].tvl);
       * ```
       */
      async getPoolsStats(inputs) {
        return this.fetchApi("stats", inputs);
      }
      /**
       * Returns all DAO fee pool owner capabilities owned by a particular user.
       * This is used to see which pools' DAO fees the user can update.
       *
       * @param inputs - An object with user `walletAddress`.
       * @returns Data about each `DaoFeePoolOwnerCapObject` the user owns.
       *
       * @example
       * ```typescript
       * const daoCaps = await pools.getOwnedDaoFeePoolOwnerCaps({
       *   walletAddress: "0x<address>"
       * });
       * console.log(daoCaps);
       * ```
       */
      async getOwnedDaoFeePoolOwnerCaps(inputs) {
        return this.poolsApi().fetchOwnedDaoFeePoolOwnerCaps(inputs);
      }
      // =========================================================================
      //  Events
      // =========================================================================
      /**
       * Fetches user-specific interaction events (deposits, withdrawals) across pools,
       * optionally with pagination.
       *
       * @param inputs - An object containing `walletAddress`, plus optional pagination (`cursor`, `limit`).
       * @returns An event set with a cursor for further queries if available.
       *
       * @example
       * ```typescript
       * const userEvents = await pools.getInteractionEvents({
       *   walletAddress: "0x...",
       *   limit: 10,
       * });
       * console.log(userEvents.events, userEvents.nextCursor);
       * ```
       */
      async getInteractionEvents(inputs) {
        return this.fetchApiIndexerEvents("interaction-events-by-user", inputs);
      }
    };
    _Pools.constants = {
      /**
       * Protocol fee structure: `totalProtocol` is the fraction of trades
       * that is taken as a fee, which is split among `treasury`, `insuranceFund`,
       * and `devWallet` in the given proportions.
       */
      feePercentages: {
        /**
         * The total fraction (as a decimal) of trades charged by the protocol.
         * e.g., 0.00005 => 0.005%.
         */
        totalProtocol: 5e-5,
        /**
         * The fraction of `totalProtocol` allocated to the treasury.
         */
        treasury: 0.5,
        /**
         * The fraction of `totalProtocol` allocated to the insurance fund.
         */
        insuranceFund: 0.3,
        /**
         * The fraction of `totalProtocol` allocated to the dev wallet.
         */
        devWallet: 0.2
      },
      /**
       * Referral fee structures, applying a discount/rebate to the user and
       * referrer, taken from the treasury portion of protocol fees.
       */
      referralPercentages: {
        /**
         * The fraction of the treasury portion that discounts the user's fee.
         */
        discount: 0.05,
        /**
         * The fraction of the treasury portion that acts as a rebate to the referrer.
         */
        rebate: 0.05
      },
      /**
       * Various bounds used to prevent extreme trades or invalid pool configurations.
       */
      bounds: {
        /**
         * Maximum number of distinct coins allowed in a single pool.
         */
        maxCoinsInPool: 8,
        /**
         * Maximum fraction (decimal) of a pool's balance that can be traded at once.
         */
        maxTradePercentageOfPoolBalance: 0.3,
        /**
         * Maximum fraction (decimal) of a pool's balance that can be withdrawn at once.
         */
        maxWithdrawPercentageOfPoolBalance: 0.3,
        /**
         * Minimum and maximum swap fees (0.01% to 10%).
         */
        minSwapFee: 1e-4,
        maxSwapFee: 0.1,
        /**
         * Minimum and maximum coin weight for weighted pools (1% to 99%).
         */
        minWeight: 0.01,
        maxWeight: 0.99,
        /**
         * Minimum and maximum DAO fee (0% to 100%).
         */
        minDaoFee: 0,
        maxDaoFee: 1
      },
      /**
       * Default parameter(s) used in the absence of explicit user or code settings.
       */
      defaults: {
        /**
         * Default decimals for LP coins if none are specified.
         */
        lpCoinDecimals: 9
      }
    };
    _Pools.getAmountWithProtocolFees = (inputs) => {
      const referralDiscount = inputs.withReferral ? _Pools.constants.feePercentages.totalProtocol * _Pools.constants.feePercentages.treasury * _Pools.constants.referralPercentages.discount : 0;
      return BigInt(
        Math.floor(
          Number(inputs.amount) * (1 - (_Pools.constants.feePercentages.totalProtocol - referralDiscount))
        )
      );
    };
    _Pools.getAmountWithoutProtocolFees = (inputs) => {
      const referralDiscount = inputs.withReferral ? _Pools.constants.feePercentages.totalProtocol * _Pools.constants.feePercentages.treasury * _Pools.constants.referralPercentages.discount : 0;
      return BigInt(
        Math.floor(
          Number(inputs.amount) * (1 / (1 - (_Pools.constants.feePercentages.totalProtocol - referralDiscount)))
        )
      );
    };
    _Pools.normalizeInvertSlippage = (slippage) => FixedUtils.directUncast(1 - slippage);
    _Pools.displayLpCoinType = (lpCoinType) => `${Coin.getCoinTypeSymbol(lpCoinType).toLowerCase().replace("af_lp_", "").split("_").map((word) => Helpers.capitalizeOnlyFirstLetter(word)).join(" ")} LP`;
    _Pools.isPossibleLpCoinType = (inputs) => {
      const { lpCoinType } = inputs;
      return lpCoinType.split("::").length === 3 && lpCoinType.split("::")[1].includes("af_lp") && lpCoinType.split("::")[2].includes("AF_LP");
    };
    Pools = _Pools;
  }
});
var init_pools2 = __esm({
  "src/packages/pools/index.ts"() {
    "use strict";
    init_pool();
    init_pools();
  }
});
var NftAmmMarket;
var init_nftAmmMarket = __esm({
  "src/packages/nftAmm/nftAmmMarket.ts"() {
    "use strict";
    init_caller();
    init_pools2();
    NftAmmMarket = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(market, config, api) {
        super(config, `nft-amm/markets/${market.objectId}`);
        this.market = market;
        this.api = api;
        this.getNftSpotPriceInAssetCoin = (inputs) => {
          const assetToFractionalizedSpotPrice = this.getAssetCoinToFractionalizeCoinSpotPrice(inputs);
          return BigInt(
            assetToFractionalizedSpotPrice * Number(this.market.fractionalizedCoinAmount)
          );
        };
        this.getFractionalizedCoinToAssetCoinSpotPrice = (inputs) => {
          return this.pool.getSpotPrice({
            coinInType: this.market.fractionalizedCoinType,
            coinOutType: this.market.assetCoinType,
            withFees: inputs?.withFees
          });
        };
        this.getAssetCoinToFractionalizeCoinSpotPrice = (inputs) => {
          return this.pool.getSpotPrice({
            coinInType: this.market.assetCoinType,
            coinOutType: this.market.fractionalizedCoinType,
            withFees: inputs?.withFees
          });
        };
        this.getBuyAssetCoinAmountIn = (inputs) => {
          return this.pool.getTradeAmountIn({
            coinOutAmount: BigInt(inputs.nftsCount) * this.market.fractionalizedCoinAmount,
            coinInType: this.market.assetCoinType,
            coinOutType: this.market.fractionalizedCoinType,
            referral: inputs.referral
          });
        };
        this.getSellAssetCoinAmountOut = (inputs) => {
          return this.pool.getTradeAmountOut({
            coinInAmount: BigInt(inputs.nftsCount) * this.market.fractionalizedCoinAmount,
            coinInType: this.market.fractionalizedCoinType,
            coinOutType: this.market.assetCoinType,
            referral: inputs.referral
          });
        };
        this.getDepositLpCoinAmountOut = (inputs) => {
          return this.pool.getDepositLpAmountOut({
            amountsIn: {
              [this.market.assetCoinType]: inputs.assetCoinAmountIn
            },
            referral: inputs.referral
          });
        };
        this.getWithdrawFractionalizedCoinAmountOut = (inputs) => {
          const lpRatio = this.pool.getMultiCoinWithdrawLpRatio({
            lpCoinAmountIn: inputs.lpCoinAmount
          });
          const amountsOut = this.pool.getWithdrawAmountsOut({
            lpRatio,
            amountsOutDirection: {
              [this.market.fractionalizedCoinType]: this.market.fractionalizedCoinAmount
            },
            referral: inputs.referral
          });
          const fractionalizedCoinAmountOut = amountsOut[0];
          return fractionalizedCoinAmountOut;
        };
        this.getWithdrawNftsCountOut = (inputs) => {
          const fractionalizedCoinAmountOut = this.getWithdrawFractionalizedCoinAmountOut(inputs);
          const minNftsCountOut = fractionalizedCoinAmountOut / this.market.fractionalizedCoinAmount;
          return minNftsCountOut;
        };
        this.nftAmmApi = () => {
          const nftAmm = this.api?.NftAmm();
          if (!nftAmm) {
            throw new Error("missing AftermathApi instance");
          }
          return nftAmm;
        };
        this.market = market;
        this.pool = new Pool(market.pool, config);
      }
      // =========================================================================
      //  Objects
      // =========================================================================
      async getNfts(inputs) {
        const { cursor, limit } = inputs;
        return this.nftAmmApi().fetchNftsInMarketTable({
          marketTableObjectId: this.market.objectId,
          limit: limit ?? 25,
          cursor
        });
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      async getBuyTransaction(inputs) {
        return this.nftAmmApi().fetchBuildBuyTx({
          ...inputs,
          market: this
        });
      }
      async getSellTransaction(inputs) {
        return this.nftAmmApi().fetchBuildSellTx({
          ...inputs,
          market: this
        });
      }
      async getDepositTransaction(inputs) {
        const { nftObjectIds: nfts, ...otherInputs } = inputs;
        return this.nftAmmApi().fetchBuildDepositTx({
          ...otherInputs,
          nfts,
          market: this
        });
      }
      async getWithdrawTransaction(inputs) {
        return this.nftAmmApi().fetchBuildWithdrawTx({
          ...inputs,
          market: this
        });
      }
    };
  }
});
var NftAmm;
var init_nftAmm = __esm({
  "src/packages/nftAmm/nftAmm.ts"() {
    "use strict";
    init_caller();
    init_nftAmmMarket();
    NftAmm = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(config, api) {
        super(config, "nft-amm");
        this.api = api;
      }
      // =========================================================================
      //  Class Objects
      // =========================================================================
      // =========================================================================
      //  Market Class
      // =========================================================================
      async getMarket(inputs) {
        const market = await this.fetchApi(
          `markets/${inputs.objectId}`
        );
        return new NftAmmMarket(market, this.config);
      }
      async getMarkets(inputs) {
        const markets = await Promise.all(
          inputs.objectIds.map((objectId) => this.getMarket({ objectId }))
        );
        return markets;
      }
      async getAllMarkets() {
        const markets = await this.fetchApi("markets");
        return markets.map((pool) => new NftAmmMarket(pool, this.config));
      }
    };
    NftAmm.constants = {};
  }
});
var init_nftAmm2 = __esm({
  "src/packages/nftAmm/index.ts"() {
    "use strict";
    init_nftAmm();
  }
});
var init_dynamicGasTypes = __esm({
  "src/general/dynamicGas/dynamicGasTypes.ts"() {
    "use strict";
  }
});
var init_nftsTypes = __esm({
  "src/general/nfts/nftsTypes.ts"() {
    "use strict";
  }
});
var init_coinGeckoTypes = __esm({
  "src/general/prices/coinGeckoTypes.ts"() {
    "use strict";
  }
});
var init_configTypes = __esm({
  "src/general/types/configTypes.ts"() {
    "use strict";
  }
});
var init_generalTypes = __esm({
  "src/general/types/generalTypes.ts"() {
    "use strict";
  }
});
var init_moveErrorsInterface = __esm({
  "src/general/types/moveErrorsInterface.ts"() {
    "use strict";
  }
});
var init_suiTypes = __esm({
  "src/general/types/suiTypes.ts"() {
    "use strict";
  }
});
var init_types = __esm({
  "src/general/types/index.ts"() {
    "use strict";
    init_dynamicGasTypes();
    init_nftsTypes();
    init_coinGeckoTypes();
    init_configTypes();
    init_generalTypes();
    init_moveErrorsInterface();
    init_suiTypes();
  }
});
var init_authTypes = __esm({
  "src/packages/auth/authTypes.ts"() {
    "use strict";
  }
});
var init_coinTypes = __esm({
  "src/packages/coin/coinTypes.ts"() {
    "use strict";
  }
});
var isFarmsDepositedPrincipalEvent;
var isFarmsHarvestedRewardsEvent;
var isFarmsLockedEvent;
var isFarmsStakedEvent;
var isFarmsUnlockedEvent;
var isFarmsWithdrewPrincipalEvent;
var init_farmsTypes = __esm({
  "src/packages/farms/farmsTypes.ts"() {
    "use strict";
    isFarmsDepositedPrincipalEvent = (event) => {
      return event.type.toLowerCase().includes("::depositedprincipalevent");
    };
    isFarmsHarvestedRewardsEvent = (event) => {
      return event.type.toLowerCase().includes("::harvestedrewardsevent");
    };
    isFarmsLockedEvent = (event) => {
      return event.type.toLowerCase().includes("::lockedevent");
    };
    isFarmsStakedEvent = (event) => {
      return event.type.toLowerCase().includes("::stakedevent");
    };
    isFarmsUnlockedEvent = (event) => {
      return event.type.toLowerCase().includes("::unlockedevent");
    };
    isFarmsWithdrewPrincipalEvent = (event) => {
      return event.type.toLowerCase().includes("::withdrewprincipalevent");
    };
  }
});
var init_faucetTypes = __esm({
  "src/packages/faucet/faucetTypes.ts"() {
    "use strict";
  }
});
var init_nftAmmTypes = __esm({
  "src/packages/nftAmm/nftAmmTypes.ts"() {
    "use strict";
  }
});
var init_gasPoolsTypes = __esm({
  "src/packages/gasPools/gasPoolsTypes.ts"() {
    "use strict";
  }
});
var init_poolsTypes = __esm({
  "src/packages/pools/poolsTypes.ts"() {
    "use strict";
  }
});
var init_referralsTypes = __esm({
  "src/packages/referrals/referralsTypes.ts"() {
    "use strict";
  }
});
var init_rewardsTypes = __esm({
  "src/packages/rewards/rewardsTypes.ts"() {
    "use strict";
  }
});
var init_routerTypes = __esm({
  "src/packages/router/routerTypes.ts"() {
    "use strict";
  }
});
var isSuiDelegatedStake;
var isStakeEvent;
var isUnstakeEvent;
var isStakePosition;
var isUnstakePosition;
var init_stakingTypes = __esm({
  "src/packages/staking/stakingTypes.ts"() {
    "use strict";
    isSuiDelegatedStake = (stake) => {
      return "stakeRequestEpoch" in stake && "stakeActiveEpoch" in stake && "principal" in stake && "stakingPool" in stake;
    };
    isStakeEvent = (event) => {
      return "staker" in event;
    };
    isUnstakeEvent = (event) => {
      return !isStakeEvent(event);
    };
    isStakePosition = (position) => {
      return "stakedSuiId" in position;
    };
    isUnstakePosition = (position) => {
      return !isStakePosition(position);
    };
  }
});
var SuiFrensSortOption;
var init_suiFrensTypes = __esm({
  "src/packages/suiFrens/suiFrensTypes.ts"() {
    "use strict";
    SuiFrensSortOption = /* @__PURE__ */ ((SuiFrensSortOption2) => {
      SuiFrensSortOption2["PriceLowToHigh"] = "Price (low to high)";
      SuiFrensSortOption2["PriceHighToLow"] = "Price (high to low)";
      return SuiFrensSortOption2;
    })(SuiFrensSortOption || {});
  }
});
var init_types2 = __esm({
  "src/types.ts"() {
    "use strict";
    init_types();
    init_authTypes();
    init_coinTypes();
    init_farmsTypes();
    init_faucetTypes();
    init_nftAmmTypes();
    init_perpetualsTypes();
    init_gasPoolsTypes();
    init_poolsTypes();
    init_referralsTypes();
    init_rewardsTypes();
    init_routerTypes();
    init_stakingTypes();
    init_suiFrensTypes();
  }
});
var PerpetualsAccount;
var init_perpetualsAccount = __esm({
  "src/packages/perpetuals/perpetualsAccount.ts"() {
    "use strict";
    init_utils();
    init_caller();
    init_perpetuals();
    PerpetualsAccount = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Create a new {@link PerpetualsAccount} wrapper.
       *
       * @param account - Raw account object with positions and equity data.
       * @param accountCap - Account cap or partial vault cap object containing
       *   ownership and collateral metadata.
       * @param config - Optional {@link CallerConfig} (network, auth, etc.).
       * @param api - Optional shared {@link AftermathApi} provider instance
       *   used to derive serialized transaction kinds (`txKind`) from
       *   {@link Transaction} objects.
       */
      constructor(account, accountCap, config, api) {
        const vaultId = "vaultId" in accountCap ? accountCap.vaultId : void 0;
        super(config, "perpetuals");
        this.account = account;
        this.accountCap = accountCap;
        this.api = api;
        this.vaultId = vaultId;
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      // =========================================================================
      //  Collateral Txs
      // =========================================================================
      /**
       * Build a `deposit-collateral` transaction for this account.
       *
       * For non-vault accounts, this endpoint constructs a transaction that:
       * - Optionally extends an existing {@link Transaction}, and
       * - Deposits collateral into the Perpetuals account.
       *
       * **Note:** Vault accounts are currently not supported and will throw.
       *
       * @param inputs.tx - Optional existing transaction to extend. If omitted,
       *   a new {@link Transaction} is created under the hood.
       * @param inputs.isSponsoredTx - Optional flag indicating whether the
       *   transaction is gas-sponsored.
       * @param inputs.depositAmount - Amount of collateral to deposit, if paying
       *   directly from the wallet.
       * @param inputs.depositCoinArg - Transaction object argument referencing a
       *   coin to deposit (mutually exclusive with `depositAmount`).
       *
       * @returns Transaction response containing a `tx`.
       *
       * @example
       * ```ts
       * const { tx } = await account.getDepositCollateralTx({
       *   depositAmount: BigInt("1000000000"),
       * });
       * ```
       */
      async getDepositCollateralTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        if ("vaultId" in this.accountCap) {
          throw new Error(
            "`getDepositCollateralTx` not supported by vault accounts, please use method `getAdminDepositTx` on class `PerpetualsVault` instead"
          );
        }
        return this.fetchApiTxObject(
          "account/transactions/deposit-collateral",
          {
            ...otherInputs,
            walletAddress: this.ownerAddress(),
            collateralCoinType: this.accountCap.collateralCoinType,
            accountId: this.accountCap.accountId,
            accountCapId: this.accountCap.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction3()
            })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `withdraw-collateral` transaction for this account.
       *
       * For non-vault accounts, this endpoint constructs a transaction to:
       * - Withdraw collateral from the Perpetuals account, and
       * - Optionally transfer it to a `recipientAddress` (otherwise coin is left
       *   as a transaction argument).
       *
       * **Note:** Vault accounts are currently not supported and will throw.
       *
       * @param inputs.withdrawAmount - Amount of collateral to withdraw.
       * @param inputs.recipientAddress - Optional address to receive the withdrawn
       *   coins directly.
       * @param inputs.tx - Optional transaction to extend (defaults to new `Transaction()`).
       *
       * @returns A response containing `tx` and the `coinOutArg` where the
       *   withdrawn coins end up if `recipientAddress` is not used.
       *
       * @example
       * ```ts
       * const { tx, coinOutArg } = await account.getWithdrawCollateralTx({
       *   withdrawAmount: BigInt("1000000000"),
       * });
       * ```
       */
      async getWithdrawCollateralTx(inputs) {
        const { tx: txFromInputs, ...otherInputs } = inputs;
        if (this.vaultId) {
          throw new Error(
            "this method is not supported for vaults, please use method `getAdminWithdrawTx` on class `PerpetualsVault` instead"
          );
        }
        return this.fetchApiTxObject(
          "account/transactions/withdraw-collateral",
          {
            ...otherInputs,
            walletAddress: this.ownerAddress(),
            accountId: this.accountCap.accountId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: txFromInputs ?? new Transaction3()
            })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build an `allocate-collateral` transaction, moving collateral from this
       * account into a specific market (clearing house).
       *
       * Works for both account-backed and vault-backed accounts.
       *
       * @param inputs.marketId - Market to allocate collateral to.
       * @param inputs.allocateAmount - Amount of collateral to allocate.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing a `tx`.
       */
      async getAllocateCollateralTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/allocate-collateral`,
          {
            ...otherInputs,
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            },
            walletAddress: this.ownerAddress(),
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx: tx ?? new Transaction3() })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `deallocate-collateral` transaction, moving collateral from a
       * specific market back to this account.
       *
       * Works for both account-backed and vault-backed accounts.
       *
       * @param inputs.marketId - Market to deallocate collateral from.
       * @param inputs.deallocateAmount - Amount of collateral to deallocate.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing a `tx`.
       */
      async getDeallocateCollateralTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/deallocate-collateral`,
          {
            ...otherInputs,
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            },
            walletAddress: this.ownerAddress(),
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx: tx ?? new Transaction3() })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `transfer-collateral` transaction between two Perpetuals accounts.
       *
       * Only supported for direct accounts, **not** vault-backed accounts.
       *
       * @param inputs.transferAmount - Amount of collateral to transfer.
       * @param inputs.toAccountId - Destination account ID.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing a `tx`.
       */
      async getTransferCollateralTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        if ("vaultId" in this.accountCap) {
          throw new Error(
            "`getTransferCollateralTx` not supported by vault accounts"
          );
        }
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/transfer-collateral`,
          {
            ...otherInputs,
            walletAddress: this.ownerAddress(),
            fromAccountId: this.accountCap.accountId,
            fromAccountCapId: this.accountCap.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx: tx ?? new Transaction3() })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      // =========================================================================
      //  Order Txs
      // =========================================================================
      /**
       * Build a `place-market-order` transaction for this account.
       *
       * This is the primary entrypoint for opening/closing positions via market orders.
       * It automatically:
       * - Injects the account/vault identity into the payload.
       * - Derives `hasPosition` based on the current account state for the given market.
       * - Optionally attaches SL/TP stop orders via the `slTp` input.
       *
       * Important behavioral notes:
       * - `hasPosition` is derived from the local {@link PerpetualsAccountObject} snapshot.
       *   If the snapshot is stale, consider re-fetching the account first.
       * - For vault-backed accounts, the API routes to `/perpetuals/vault/...` and uses
       *   `vaultId` as the identity discriminator. For direct accounts, it uses `accountId`.
       *
       * @param inputs - See {@link SdkPerpetualsPlaceMarketOrderInputs} for details.
       *   Notably:
       *   - `marketId`, `side`, `size`, `collateralChange`, `reduceOnly`
       *   - Optional `leverage`
       *   - Optional `slTp` params
       *   - Optional `tx` to extend
       *
       * @returns Transaction response containing `tx`.
       *
       * @example
       * ```ts
       * const { tx } = await account.getPlaceMarketOrderTx({
       *   marketId: "0x...",
       *   side: PerpetualsOrderSide.Bid,
       *   size: BigInt("1000000000"),
       *   collateralChange: 10,
       *   reduceOnly: false,
       * });
       * ```
       */
      async getPlaceMarketOrderTx(inputs) {
        const { tx: txFromInputs, ...otherInputs } = inputs;
        const tx = txFromInputs ?? new Transaction3();
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/place-market-order`,
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
            walletAddress: this.ownerAddress(),
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
            // hasPosition:
            // 	this.positionForMarketId(otherInputs) !== undefined,
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `place-limit-order` transaction for this account.
       *
       * Similar to {@link getPlaceMarketOrderTx}, but uses limit order semantics:
       * - Requires `price` and `orderType`.
       * - Supports reduce-only flags, expiry, optional leverage, and SL/TP stop orders.
       *
       * Notes:
       * - `hasPosition` is derived from local account state; refresh the account if needed.
       * - This method does not validate tick/lot sizing locally; the API/on-chain
       *   will enforce market constraints.
       *
       * @param inputs - See {@link SdkPerpetualsPlaceLimitOrderInputs}.
       *
       * @returns Transaction response containing `tx`.
       */
      async getPlaceLimitOrderTx(inputs) {
        const { tx: txFromInputs, ...otherInputs } = inputs;
        const tx = txFromInputs ?? new Transaction3();
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/place-limit-order`,
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
            walletAddress: this.ownerAddress(),
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
            // hasPosition:
            // 	this.positionForMarketId(otherInputs) !== undefined,
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `place-scale-order` transaction for this account.
       *
       * A scale order distributes a total size across multiple limit orders
       * evenly spaced between a start and end price. An optional `sizeSkew`
       * parameter controls whether the distribution is uniform or weighted.
       *
       * @param inputs - See {@link SdkPerpetualsPlaceScaleOrderInputs}.
       *
       * @returns Transaction response containing `tx`.
       */
      async getPlaceScaleOrderTx(inputs) {
        const { tx: txFromInputs, ...otherInputs } = inputs;
        const tx = txFromInputs ?? new Transaction3();
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/place-scale-order`,
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
            walletAddress: this.ownerAddress(),
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `cancel-and-place-orders` transaction for this account.
       *
       * Atomically cancels existing orders and places new ones in a single
       * transaction. Useful for rebalancing order grids or replacing stale
       * orders without intermediate exposure.
       *
       * @param inputs - See {@link SdkPerpetualsCancelAndPlaceOrdersInputs}.
       *
       * @returns Transaction response containing `tx`.
       */
      async getCancelAndPlaceOrdersTx(inputs) {
        const { tx: txFromInputs, ...otherInputs } = inputs;
        const tx = txFromInputs ?? new Transaction3();
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/cancel-and-place-orders`,
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
            walletAddress: this.ownerAddress(),
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `cancel-orders` transaction for this account.
       *
       * Each market in `marketIdsToData` supplies:
       * - `orderIds`: the orders to cancel in that market
       * - `collateralChange`: collateral adjustment to apply alongside cancellation
       * - `leverage`: leverage context used for estimating/validating constraints server-side
       *
       * Notes:
       * - Cancels are applied per market; some markets may succeed while others fail
       *   depending on API/on-chain validation (returned as a transaction failure at execution).
       * - If you need to understand the effect prior to building a tx, use
       *   {@link getCancelOrdersPreview}.
       *
       * @param inputs.tx - Optional transaction to extend.
       * @param inputs.marketIdsToData - Mapping from market IDs to cancel payloads.
       *
       * @returns Transaction response containing `tx`.
       */
      async getCancelOrdersTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/cancel-orders`,
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
            walletAddress: this.ownerAddress(),
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `cancel-stop-orders` transaction for this account.
       *
       * This cancels stop-order *objects/tickets* by their object IDs. These IDs are
       * returned by stop-order query endpoints (see {@link getStopOrderDatas}).
       *
       * @param inputs.tx - Optional transaction to extend.
       * @param inputs.stopOrderIds - Array of stop-order ticket IDs to cancel.
       *
       * @returns Transaction response containing `tx`.
       */
      async getCancelStopOrdersTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/cancel-stop-orders`,
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
            walletAddress: this.ownerAddress(),
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `place-stop-orders` transaction for this account.
       *
       * This allows placing one or more stop orders in a single transaction,
       * optionally with a dedicated gas coin and a sponsored gas flag.
       *
       * Typical usage:
       * - Construct stop order payload(s) client-side
       * - Call this method to build a transaction kind
       * - Sign/execute the transaction via Sui
       *
       * @param inputs - See {@link SdkPerpetualsPlaceStopOrdersInputs}.
       *
       * @returns Transaction response containing `tx`.
       */
      async getPlaceStopOrdersTx(inputs) {
        const { tx: txFromInputs, ...otherInputs } = inputs;
        const tx = txFromInputs ?? new Transaction3();
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/place-stop-orders`,
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
            walletAddress: this.ownerAddress(),
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `place-sl-tp-orders` transaction for this account.
       *
       * This helper constructs SL/TP stop orders for an **existing** position
       * in a given market. If the account has no position for `marketId`, this
       * throws an error.
       *
       * Implementation details:
       * - Determines the current position side from the account snapshot.
       * - Sets `positionSide` for the API so SL/TP orders are bound to closing logic
       *   (i.e. they should trigger on the opposite side of the open position).
       *
       * @param inputs - See {@link SdkPerpetualsPlaceSlTpOrdersInputs}.
       *
       * @returns Transaction response containing `tx`.
       */
      async getPlaceSlTpOrdersTx(inputs) {
        const { tx: txFromInputs, marketId, ...otherInputs } = inputs;
        const position = this.positionForMarketId({ marketId });
        if (!position) {
          throw new Error("you have no position for this market");
        }
        const tx = txFromInputs ?? new Transaction3();
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/place-sl-tp-orders`,
          {
            ...otherInputs,
            marketId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
            walletAddress: this.ownerAddress(),
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            },
            positionSide: Perpetuals.positionSide({
              baseAssetAmount: position.baseAssetAmount
            })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build an `edit-stop-orders` transaction for this account.
       *
       * This endpoint lets you update existing stop orders in batch.
       *
       * Notes:
       * - You must provide the full updated stop-order objects (including object IDs).
       * - This is typically used to adjust trigger prices, sizes, expiries, or the
       *   embedded limit-order parameters.
       *
       * @param inputs.stopOrders - Full updated stop-order payloads to apply.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing `tx`.
       */
      async getEditStopOrdersTx(inputs) {
        const { tx: txFromInputs, ...otherInputs } = inputs;
        const tx = txFromInputs ?? new Transaction3();
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/edit-stop-orders`,
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
            walletAddress: this.ownerAddress(),
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      // public async getReduceOrderTx(inputs: {
      // 	tx?: Transaction;
      // 	collateralChange: number;
      // 	marketId: PerpetualsMarketId;
      // 	orderId: PerpetualsOrderId;
      // 	sizeToSubtract: bigint;
      // 	leverage?: number;
      // }) {
      // 	const { tx, ...otherInputs } = inputs;
      // 	return this.fetchApiTxObject<
      // 		ApiPerpetualsReduceOrderBody,
      // 		ApiTransactionResponse
      // 	>(
      // 		`${this.vaultId ? "vault" : "account"}/` +
      // 			"transactions/reduce-order",
      // 		{
      // 			...otherInputs,
      // 			txKind: await this.api?.Transactions().fetchBase64TxKindFromTx(
      // 				{ tx }
      // 			),
      // 			walletAddress: this.ownerAddress(),
      // 			...("vaultId" in this.accountCap
      // 				? {
      // 						vaultId: this.accountCap.vaultId,
      // accountId: undefined,
      // 				  }
      // 				: {
      // 						accountId: this.accountCap.accountId,
      // vaultId: undefined,
      // 				  }),
      // 		},
      // 		undefined,
      // 		{
      // 			txKind: true,
      // 		}
      // 	);
      // }
      /**
       * Build a `set-leverage` transaction for a given market.
       *
       * This updates the effective leverage for the position (or potential position)
       * in `marketId`, and optionally adjusts collateral in tandem.
       *
       * Notes:
       * - Leverage changes may be constrained by protocol risk limits and current
       *   position state.
       * - If you want to understand the effect first, use {@link getSetLeveragePreview}.
       *
       * @param inputs.tx - Optional transaction to extend.
       * @param inputs.leverage - Target leverage value.
       * @param inputs.collateralChange - Net collateral change to apply alongside
       *   the leverage update.
       * @param inputs.marketId - Market whose leverage to adjust.
       *
       * @returns Transaction response containing `tx`.
       */
      async getSetLeverageTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          `${this.vaultId ? "vault" : "account"}/transactions/set-leverage`,
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
            walletAddress: this.ownerAddress(),
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      // =========================================================================
      //  Position Txs
      // =========================================================================
      // public async getClosePositionTx(inputs: {
      // 	size: bigint;
      // 	market: PerpetualsMarket;
      // 	orderDatas: PerpetualsOrderData[];
      // 	indexPrice: number;
      // 	collateralPrice: number;
      // }) {
      // 	throw new Error("TODO");
      // 	// return this.getPlaceMarketOrderTx({
      // 	// 	...this.closePositionTxInputs(inputs),
      // 	// });
      // }
      // =========================================================================
      //  Interactions
      // =========================================================================
      /**
       * Build a deterministic message payload to sign when querying stop orders
       * from the backend.
       *
       * This payload is intended to be signed off-chain and then submitted to
       * `getStopOrderDatas` as a proof of account ownership.
       *
       * Important:
       * - The returned payload is *not* a Sui transaction; it is an off-chain
       *   “authentication” message.
       * - The backend expects `account_id` to be a decimal string. This code
       *   normalizes the bigint `accountId` by stripping the trailing `n`.
       *
       * @param inputs.marketIds - Optional list of market IDs to scope the query.
       *
       * @returns An object describing the action and account/market IDs, suitable
       *   for message signing.
       *
       * @example
       * ```ts
       * const message = account.getStopOrdersMessageToSign({ marketIds: ["0x..."] });
       * const { signature } = await wallet.signMessage({
       *   message: new TextEncoder().encode(JSON.stringify(message)),
       * });
       * ```
       */
      getStopOrdersMessageToSign(inputs) {
        return {
          action: "GET_STOP_ORDERS",
          account_id: this.accountCap.accountId.toString().replaceAll("n", ""),
          clearing_house_ids: inputs?.marketIds ?? []
        };
      }
      // public async getPlaceOrderPreview(
      // 	inputs: SdkPerpetualsPlaceOrderPreviewInputs,
      // 	abortSignal?: AbortSignal
      // ): Promise<
      // 	| {
      // 			error: string;
      // 	  }
      // 	| {
      // 			updatedPosition: PerpetualsPosition;
      // 			priceSlippage: number;
      // 			percentSlippage: Percentage;
      // 			filledSize: number;
      // 			filledSizeUsd: number;
      // 			postedSize: number;
      // 			postedSizeUsd: number;
      // 			collateralChange: number;
      // 			executionPrice: number;
      // 	  }
      // > {
      // 	return this.fetchApi<
      // 		ApiPerpetualsPreviewOrderResponse,
      // 		ApiPerpetualsPreviewOrderBody
      // 	>(
      // 		`${this.vaultId ? "vault" : "account"}/` +"previews/place-order",
      // 		{
      // 			...inputs,
      // 			accountId: this.accountCap.accountId,
      // 			collateralCoinType: this.accountCap.collateralCoinType,
      // 		},
      // 		abortSignal
      // 	);
      // }
      /**
       * Preview the effects of placing a market order (without building a tx).
       *
       * This is a read-only API call that runs the protocol’s pricing / margin /
       * slippage logic against the current market state and your account/vault context.
       *
       * @param inputs - See {@link SdkPerpetualsPlaceMarketOrderPreviewInputs}.
       * @param abortSignal - Optional `AbortSignal` to cancel the request.
       *
       * @returns Either an error message or a preview including:
       * - `updatedPosition`
       * - `priceSlippage`, `percentSlippage`
       * - `filledSize`, `filledSizeUsd`
       * - `postedSize`, `postedSizeUsd`
       * - `collateralChange`
       * - `executionPrice`
       */
      async getPlaceMarketOrderPreview(inputs, abortSignal) {
        return this.fetchApi(
          `${this.vaultId ? "vault" : "account"}/previews/place-market-order`,
          {
            ...inputs,
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          abortSignal
        );
      }
      /**
       * Preview the effects of placing a limit order (without building a tx).
       *
       * The preview simulates:
       * - How much size would execute immediately vs post to the book
       * - Expected slippage and execution price
       * - Resulting position and margin impact
       *
       * @param inputs - See {@link SdkPerpetualsPlaceLimitOrderPreviewInputs}.
       * @param abortSignal - Optional `AbortSignal` to cancel the request.
       *
       * @returns Either an error message or a preview object similar to
       *   {@link getPlaceMarketOrderPreview}.
       */
      async getPlaceLimitOrderPreview(inputs, abortSignal) {
        return this.fetchApi(
          `${this.vaultId ? "vault" : "account"}/previews/place-limit-order`,
          {
            ...inputs,
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          abortSignal
        );
      }
      /**
       * Preview the effects of placing a scale order (without building a tx).
       *
       * A scale order distributes total size across multiple limit orders
       * spaced between a start and end price. The preview simulates:
       * - How much size would execute immediately vs post to the book
       * - Expected slippage and execution price
       * - Resulting position and margin impact
       *
       * @param inputs - See {@link SdkPerpetualsPlaceScaleOrderPreviewInputs}.
       * @param abortSignal - Optional `AbortSignal` to cancel the request.
       *
       * @returns Either an error message or a preview object similar to
       *   {@link getPlaceMarketOrderPreview}.
       */
      async getPlaceScaleOrderPreview(inputs, abortSignal) {
        return this.fetchApi(
          `${this.vaultId ? "vault" : "account"}/previews/place-scale-order`,
          {
            ...inputs,
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          abortSignal
        );
      }
      /**
       * Preview the effects of canceling orders across one or more markets.
       *
       * This is commonly used to:
       * - Validate that cancels are allowed under current margin constraints
       * - Estimate how collateral/margin would change after canceling (and applying
       *   the associated `collateralChange` values)
       *
       * If `marketIdsToData` is empty, this returns a trivial preview with:
       * - `marketIdsToData: {}`
       *
       * @param inputs - See {@link SdkPerpetualsCancelOrdersPreviewInputs}.
       * @param abortSignal - Optional `AbortSignal` to cancel the request.
       *
       * @returns Either:
       * - `{ marketIdsToData }`, or
       * - `{ error }`.
       */
      async getCancelOrdersPreview(inputs, abortSignal) {
        if (Object.keys(inputs.marketIdsToData).length <= 0) {
          return {
            marketIdsToData: {}
          };
        }
        return this.fetchApi(
          `${this.vaultId ? "vault" : "account"}/previews/cancel-orders`,
          {
            ...inputs,
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          abortSignal
        );
      }
      // public async getReduceOrderPreview(
      // 	inputs: {
      // 		marketId: PerpetualsMarketId;
      // 		orderId: PerpetualsOrderId;
      // 		sizeToSubtract: bigint;
      // 		leverage?: number;
      // 	},
      // 	abortSignal?: AbortSignal
      // ): Promise<
      // 	| {
      // 			positionAfterReduceOrder: PerpetualsPosition;
      // 			collateralChange: number;
      // 	  }
      // 	| {
      // 			error: string;
      // 	  }
      // > {
      // 	return this.fetchApi<
      // 		ApiPerpetualsPreviewReduceOrderResponse,
      // 		ApiPerpetualsPreviewReduceOrderBody
      // 	>(
      // 		`${this.vaultId ? "vault" : "account"}/` + "previews/reduce-order",
      // 		{
      // 			...inputs,
      // 			...("vaultId" in this.accountCap
      // 				? {
      // 						vaultId: this.accountCap.vaultId,
      //						accountId: undefined,
      // 				  }
      // 				: {
      // 						accountId: this.accountCap.accountId,
      //						vaultId: undefined,
      // 				  }),
      // 		},
      // 		abortSignal
      // 	);
      // }
      /**
       * Preview the effects of setting leverage for a given market.
       *
       * The preview returns:
       * - The position after the leverage change (`updatedPosition`)
       * - The collateral delta required/produced (`collateralChange`)
       *
       * @param inputs.marketId - Market whose leverage you want to adjust.
       * @param inputs.leverage - Target leverage value.
       * @param abortSignal - Optional `AbortSignal` to cancel the request.
       *
       * @returns Either:
       * - `{ updatedPosition, collateralChange }`, or
       * - `{ error }`.
       */
      async getSetLeveragePreview(inputs, abortSignal) {
        const { marketId, leverage } = inputs;
        return this.fetchApi(
          `${this.vaultId ? "vault" : "account"}/previews/set-leverage`,
          {
            marketId,
            leverage,
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          abortSignal
        );
      }
      /**
       * Preview the effects of allocating/deallocating collateral for the position in
       * a given market.
       *
       * Semantics:
       * - Positive `collateralChange` previews allocation (moving collateral into the market).
       * - Negative `collateralChange` previews deallocation (moving collateral out of the market).
       *
       * @param inputs.marketId - Market of whose position you want to allocate/deallocate
       * collateral to/from.
       * @param inputs.collateralChange - The target collateral change (a positive number
       * for allocating collateral, negative for deallocating collateral).
       * @param abortSignal - Optional `AbortSignal` to cancel the request.
       *
       * @returns Either:
       * - `{ updatedPosition, collateralChange }`, or
       * - `{ error }`.
       */
      async getEditCollateralPreview(inputs, abortSignal) {
        const { marketId, collateralChange } = inputs;
        return this.fetchApi(
          `${this.vaultId ? "vault" : "account"}/previews/edit-collateral`,
          {
            marketId,
            collateralChange,
            ..."vaultId" in this.accountCap ? {
              vaultId: this.accountCap.vaultId,
              accountId: void 0
            } : {
              accountId: this.accountCap.accountId,
              accountCapId: this.accountCap.objectId,
              vaultId: void 0
            }
          },
          abortSignal
        );
      }
      // public getPlaceClosePositionOrderPreview = async (
      // 	inputs: {
      // 		size: bigint;
      // 		marketId: PerpetualsMarketId;
      // 		leverage?: number;
      // 	} & (
      // 		| {
      // 				accountId: PerpetualsAccountId;
      // 		  }
      // 		| {
      // 				vaultId: ObjectId;
      // 		  }
      // 	),
      // 	abortSignal?: AbortSignal
      // ): Promise<ReturnType<PerpetualsAccount["getPlaceMarketOrderPreview"]>> => {
      // 	// TODO: make this fetch instead ?
      // 	const position = this.positionForMarketId({
      // 		marketId: inputs.marketId,
      // 	});
      // 	if (!position)
      // 		throw new Error(
      // 			`Account has no position for market id: ${inputs.marketId}`
      // 		);
      // 	return this.getPlaceMarketOrderPreview(
      // 		{
      // 			...inputs,
      // 			reduceOnly: true,
      // 			side:
      // 				Perpetuals.positionSide(position) ===
      // 				PerpetualsOrderSide.Ask
      // 					? PerpetualsOrderSide.Bid
      // 					: PerpetualsOrderSide.Ask,
      // 		},
      // 		abortSignal
      // 	);
      // };
      /**
       * Fetch stop-order ticket data for this account, using an off-chain signed
       * payload.
       *
       * Typical flow:
       * 1) Call {@link getStopOrdersMessageToSign} to construct a deterministic payload
       * 2) Sign the payload with the wallet
       * 3) Provide the signed payload to this method to fetch stop order data
       *
       * @param inputs.bytes - Serialized message that was signed (e.g. JSON string).
       * @param inputs.signature - Signature over `bytes`.
       * @param inputs.marketIds - Optional subset of markets to filter results by.
       *
       * @returns {@link ApiPerpetualsStopOrderDatasResponse} containing `stopOrderDatas`.
       */
      async getStopOrderDatas(inputs) {
        const { bytes, signature, marketIds } = inputs;
        return this.fetchApi(`${this.vaultId ? "vault" : "account"}/stop-order-datas`, {
          bytes,
          signature,
          walletAddress: this.ownerAddress(),
          marketIds: marketIds ?? [],
          ..."vaultId" in this.accountCap ? {
            vaultId: this.accountCap.vaultId,
            accountId: void 0
          } : {
            accountId: this.accountCap.accountId,
            accountCapId: this.accountCap.objectId,
            vaultId: void 0
          }
        });
      }
      /**
       * Fetch paginated collateral-change history for this account, including
       * deposits, withdrawals, funding settlements, liquidations, etc.
       *
       * Pagination:
       * - Use `beforeTimestampCursor` to fetch older entries.
       * - The API returns a `nextBeforeTimestampCursor` to continue pagination.
       *
       * @param inputs.beforeTimestampCursor - Optional cursor for pagination.
       * @param inputs.limit - Optional limit per page.
       *
       * @returns {@link ApiPerpetualsAccountCollateralHistoryResponse} containing
       * an array of changes and a `nextBeforeTimestampCursor`.
       */
      async getCollateralHistory(inputs) {
        return this.fetchApi("account/collateral-history", {
          ...inputs,
          accountId: this.accountCap.accountId
        });
      }
      /**
       * Fetch paginated order history for this account.
       *
       * This endpoint is distinct from {@link getOrderDatas}:
       * - `getOrderDatas` resolves current/pending orders based on the snapshot.
       * - `getOrderHistory` returns historical order events (fills, cancels, etc.)
       *   over time with cursor-based pagination.
       *
       * @param inputs.beforeTimestampCursor - Optional cursor for pagination.
       * @param inputs.limit - Optional limit per page.
       *
       * @returns {@link ApiPerpetualsAccountOrderHistoryResponse} containing a list of
       * orders and a `nextBeforeTimestampCursor`.
       */
      async getOrderHistory(inputs) {
        return this.fetchApi("account/order-history", {
          ...inputs,
          accountId: this.accountCap.accountId
        });
      }
      /**
       * Fetch historical margin snapshots for this account over a time range.
       *
       * This endpoint returns time-series margin data suitable for charting UI
       * such as equity and available collateral over time.
       *
       * Notes:
       * - This is an account-level view (aggregated across markets).
       *
       * @param inputs - {@link ApiPerpetualsAccountMarginHistoryBody} without `accountId`.
       * @returns {@link ApiPerpetualsAccountMarginHistoryResponse} containing `marginHistoryDatas`.
       */
      async getMarginHistory(inputs) {
        return this.fetchApi("account/margin-history", {
          ...inputs,
          accountId: this.accountCap.accountId
        });
      }
      // public async getOwnedWithdrawRequests() {
      // 	return new Perpetuals(
      // 		this.config,
      // 		this.api
      // 	).getOwnedWithdrawRequests({
      // 		walletAddress: this.ownerAddress(),
      // 	});
      // }
      /**
       * Build a transaction that grants an Agent Wallet (assistant permissions) for this perpetuals account.
       *
       * The returned transaction must be signed and submitted by the **account admin** wallet.
       * After execution, `recipientAddress` can execute supported trading actions on behalf of this account.
       *
       * Agent wallets can perform all supported actions **except**:
       * - withdrawing collateral, and
       * - granting or revoking other agent wallets.
       *
       * @param inputs.recipientAddress Wallet address to receive agent permissions.
       * @param inputs.tx Optional existing {@link Transaction} to append to. If omitted, a new Transaction is used.
       * @throws If this instance represents a vault account (agent wallets are account-only).
       */
      async getGrantAgentWalletTx(inputs) {
        const { tx, recipientAddress } = inputs;
        if ("vaultId" in this.accountCap) {
          throw new Error(
            "`getGrantAgentWalletTx` not supported by vault accounts"
          );
        }
        return this.fetchApiTxObject(
          "account/transactions/grant-agent-wallet",
          {
            recipientAddress,
            accountId: this.accountCap.accountId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction3()
            })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a transaction that revokes an Agent Wallet (assistant capability) from this perpetuals account.
       *
       * The returned transaction must be signed and submitted by the **account admin** wallet.
       * After execution, the revoked wallet immediately loses its delegated permissions.
       *
       * @param inputs.accountCapId Object ID of the assistant capability to revoke.
       * @param inputs.tx Optional existing {@link Transaction} to append to. If omitted, a new Transaction is used.
       * @throws If this instance represents a vault account (agent wallets are account-only).
       */
      async getRevokeAgentWalletTx(inputs) {
        const { tx, accountCapId } = inputs;
        if ("vaultId" in this.accountCap) {
          throw new Error(
            "`getRevokeAgentWalletTx` not supported by vault accounts"
          );
        }
        return this.fetchApiTxObject(
          "account/transactions/revoke-agent-wallet",
          {
            accountCapId,
            accountId: this.accountCap.accountId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction3()
            })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      // =========================================================================
      //  Helpers
      // =========================================================================
      /**
       * Find the current position for a given market ID, if any.
       *
       * @param inputs.marketId - Market ID to search for.
       * @returns {@link PerpetualsPosition} if found, otherwise `undefined`.
       */
      positionForMarketId(inputs) {
        try {
          return this.account.positions.find(
            (pos) => pos.marketId === inputs.marketId
          );
        } catch (_e) {
          return void 0;
        }
      }
      /**
       * Filter a list of stop orders to only include non-SL/TP orders.
       *
       * A stop order is considered SL/TP if it appears in the combined set of
       * SL/TP orders across **all** markets (see {@link slTpStopOrderDatas}).
       *
       * Note:
       * - This implementation uses JSON string equality to compare objects.
       *   This is pragmatic but assumes stable field ordering and identical shapes.
       *
       * @param inputs.stopOrderDatas - Full array of stop-order ticket data.
       * @returns An array of non-SL/TP stop orders, or `undefined` if none exist.
       */
      nonSlTpStopOrderDatas(inputs) {
        const { stopOrderDatas } = inputs;
        const slTpOrders = this.slTpStopOrderDatas(inputs);
        const stopOrders = stopOrderDatas.filter(
          (stopOrder) => !(slTpOrders ?? []).map((slTpOrder) => JSON.stringify(slTpOrder)).includes(JSON.stringify(stopOrder))
        );
        return stopOrders.length <= 0 ? void 0 : stopOrders;
      }
      /**
       * Extract all SL/TP-style stop orders across **all** markets for this
       * account.
       *
       * SL/TP orders are stop orders which:
       * - Have an `slTp` payload, and
       * - Target the opposite side of the current position.
       *
       * This combines:
       * - "Full" SL/TP orders (size >= `i64MaxBigInt`)
       * - "Partial" SL/TP orders (size < `i64MaxBigInt`)
       *
       * The "full vs partial" distinction is a protocol convention: some systems
       * encode “close entire position” using a sentinel max size.
       *
       * @param inputs.stopOrderDatas - Full list of stop-order tickets.
       * @returns Array of SL/TP stop orders, or `undefined` if none exist.
       */
      slTpStopOrderDatas(inputs) {
        const { stopOrderDatas } = inputs;
        let slTpOrders = [];
        for (const { marketId } of this.account.positions) {
          const { fullSlTpOrder, partialSlTpOrders } = this.slTpStopOrderDatasForPosition({
            marketId,
            stopOrderDatas
          });
          slTpOrders = [
            ...slTpOrders,
            ...fullSlTpOrder ? [fullSlTpOrder] : [],
            ...partialSlTpOrders ?? []
          ];
        }
        for (const limitOrderId of Helpers.uniqueArray(
          stopOrderDatas.map((stopOrder) => stopOrder.slTp?.limitOrderId)
        )) {
          if (limitOrderId === void 0) {
            continue;
          }
          const { fullSlTpOrder, partialSlTpOrders } = this.slTpStopOrderDatasForLimitOrder({
            limitOrderId,
            stopOrderDatas
          });
          slTpOrders = [
            ...slTpOrders,
            ...fullSlTpOrder ? [fullSlTpOrder] : [],
            ...partialSlTpOrders ?? []
          ];
        }
        return slTpOrders.length <= 0 ? void 0 : slTpOrders;
      }
      /**
       * Filter stop orders for a single market to only include non-SL/TP orders.
       *
       * Uses {@link slTpStopOrderDatasForPosition} under the hood.
       *
       * @param inputs.marketId - Market ID to filter for.
       * @param inputs.stopOrderDatas - Full list of stop orders.
       * @returns Non-SL/TP stop orders for the given market, or `undefined` if none exist.
       */
      nonSlTpStopOrderDatasForPosition(inputs) {
        const { marketId, stopOrderDatas } = inputs;
        const position = this.positionForMarketId({ marketId });
        if (!position) {
          return void 0;
        }
        const { fullSlTpOrder, partialSlTpOrders } = this.slTpStopOrderDatasForPosition(inputs);
        const stopOrders = stopOrderDatas.filter(
          (stopOrder) => !(stopOrder.limitOrder || [
            ...fullSlTpOrder ? [fullSlTpOrder] : [],
            ...partialSlTpOrders ?? []
          ].map((slTpOrder) => JSON.stringify(slTpOrder)).includes(JSON.stringify(stopOrder)))
        );
        return stopOrders.length <= 0 ? void 0 : stopOrders;
      }
      /**
       * Categorize stop orders for a specific market into:
       * - A "full" SL/TP order (size >= `i64MaxBigInt`) if any.
       * - A set of "partial" SL/TP orders (size < `i64MaxBigInt`).
       *
       * SL/TP stop orders are defined as:
       * - Market ID matches the input market.
       * - `slTp` field is present.
       * - Order side is opposite of the position side.
       * - At least a `stopLossIndexPrice` or `takeProfitIndexPrice` is set.
       *
       * Notes on matching:
       * - The side comparison uses the current position side derived from the account snapshot.
       * - If `baseAssetAmount === 0` (no effective position), the method returns no SL/TP orders.
       *
       * @param inputs.marketId - Market to categorize stop orders for.
       * @param inputs.stopOrderDatas - Full list of stop orders.
       *
       * @returns Object containing:
       * - `fullSlTpOrder` (if any)
       * - `partialSlTpOrders` (if any, otherwise `undefined`)
       */
      slTpStopOrderDatasForPosition(inputs) {
        const { marketId, stopOrderDatas } = inputs;
        const position = this.positionForMarketId({ marketId });
        if (!position || position.baseAssetAmount === 0) {
          return {
            fullSlTpOrder: void 0,
            partialSlTpOrders: void 0
          };
        }
        const side = position ? Perpetuals.positionSide(position) : void 0;
        const fullSlTpOrder = stopOrderDatas.find(
          (order) => order.marketId === marketId && order.slTp && order.side !== side && (order.slTp.stopLossIndexPrice || order.slTp.takeProfitIndexPrice) && order.size >= Casting.i64MaxBigInt && !order.limitOrder
        );
        const partialSlTpOrders = stopOrderDatas.filter(
          (order) => order.marketId === marketId && order.slTp && order.side !== side && (order.slTp.stopLossIndexPrice || order.slTp.takeProfitIndexPrice) && order.size < Casting.i64MaxBigInt && !order.limitOrder
        );
        return {
          fullSlTpOrder,
          partialSlTpOrders: partialSlTpOrders.length <= 0 ? void 0 : partialSlTpOrders
        };
      }
      slTpStopOrderDatasForLimitOrder(inputs) {
        const { stopOrderDatas, limitOrderId } = inputs;
        const fullSlTpOrder = stopOrderDatas.find(
          (order) => order.slTp && order.slTp.limitOrderId === limitOrderId && (order.slTp.stopLossIndexPrice || order.slTp.takeProfitIndexPrice) && order.size >= Casting.i64MaxBigInt
        );
        const partialSlTpOrders = stopOrderDatas.filter(
          (order) => order.slTp && order.slTp.limitOrderId === limitOrderId && (order.slTp.stopLossIndexPrice || order.slTp.takeProfitIndexPrice) && order.size < Casting.i64MaxBigInt
        );
        return {
          fullSlTpOrder,
          partialSlTpOrders: partialSlTpOrders.length <= 0 ? void 0 : partialSlTpOrders
        };
      }
      orderDatas() {
        return this.account.positions.reduce(
          (acc, position) => [
            ...acc,
            ...position.pendingOrders.map((order) => ({
              orderId: order.orderId,
              currentSize: order.currentSize,
              initialSize: order.initialSize,
              side: Perpetuals.orderIdToSide(order.orderId),
              marketId: position.marketId
            }))
          ],
          []
        );
      }
      /**
       * Convenience accessor for the account's available collateral (in coin units).
       *
       * This is the amount of collateral not currently locked/allocated across markets,
       * as represented by the backend response.
       *
       * @returns Available collateral as a `number`.
       */
      collateral() {
        return this.account.availableCollateral;
      }
      // public collateralDecimals(): CoinDecimal {
      // 	return this.accountCap.collateralDecimals;
      // }
      // public collateralBalance(): Balance {
      // 	return Coin.normalizeBalance(
      // 		this.collateral(),
      // 		this.collateralDecimals()
      // 	);
      // }
      /**
       * Check whether this {@link PerpetualsAccount} is vault-backed.
       *
       * @returns `true` if the underlying `accountCap` is a vault cap; otherwise `false`.
       */
      isVault() {
        return "vaultId" in this.accountCap;
      }
      /**
       * Resolve the owner wallet address of this account or vault.
       *
       * - For direct accounts, returns the cap's `walletAddress` field.
       * - For vault-backed accounts, returns the vault cap's `ownerAddress`.
       *
       * Naming note:
       * - Some types use `walletAddress` for direct ownership. For vault-backed accounts
       *   the analogous field is `ownerAddress`.
       *
       * @returns Owner wallet {@link SuiAddress}.
       */
      ownerAddress() {
        return "walletAddress" in this.accountCap ? (
          // NOTE: direct accounts expose `walletAddress`; vault accounts expose `ownerAddress`.
          this.accountCap.walletAddress
        ) : this.accountCap.ownerAddress;
      }
      /**
       * Get the underlying account object ID.
       *
       * This is the on-chain object that holds the account's state and positions.
       *
       * @returns {@link ObjectId} of the account object.
       */
      accountObjectId() {
        return this.accountCap.accountObjectId;
      }
      /**
       * Get the numeric perpetuals account ID.
       *
       * This is the protocol-level identifier (bigint-derived) used across API calls.
       *
       * @returns {@link PerpetualsAccountId} for this account.
       */
      accountId() {
        return this.accountCap.accountId;
      }
      /**
       * Get the account cap object ID, if this is a direct account.
       *
       * Direct accounts are controlled via an on-chain “cap” object. Vault-backed
       * accounts are controlled via vault caps and do not expose a direct account-cap ID.
       *
       * @throws If called for a vault-backed account.
       *
       * @returns {@link ObjectId} of the account cap.
       */
      accountCapId() {
        if ("vaultId" in this.accountCap) {
          throw new Error("not account cap id present on vault owned account");
        }
        return this.accountCap.objectId;
      }
      // public closePositionTxInputs = (inputs: {
      // 	size: bigint;
      // 	market: PerpetualsMarket;
      // 	orderDatas: PerpetualsOrderData[];
      // 	indexPrice: number;
      // 	collateralPrice: number;
      // }): SdkPerpetualsPlaceMarketOrderInputs => {
      // 	const { size, market, orderDatas, collateralPrice } = inputs;
      //
      // 	const marketId = market.marketId;
      // 	const position =
      // 		this.positionForMarketId({ marketId }) ?? market.emptyPosition();
      //
      // 	// TODO: move conversion to helper function, since used often
      // 	const ordersCollateral = Helpers.sum(
      // 		orderDatas
      // 			.filter((orderData) => orderData.marketId === market.marketId)
      // 			.map(
      // 				(orderData) =>
      // 					market.calcCollateralUsedForOrder({
      // 						...inputs,
      // 						orderData,
      // 						leverage: position.leverage,
      // 					}).collateral
      // 			)
      // 	);
      //
      // 	const fullPositionCollateralChange =
      // 		Math.max(
      // 			this.calcFreeMarginUsdForPosition(inputs) / collateralPrice -
      // 				ordersCollateral *
      // 					(1 -
      // 						PerpetualsAccount.constants
      // 							.closePositionMarginOfError),
      // 			0
      // 		) * -1;
      //
      // 	// NOTE: is this safe / correct ?
      // 	const collateralChange =
      // 		Number(fullPositionCollateralChange) *
      // 		(Number(size) /
      // 			Casting.Fixed.fixedOneN9 /
      // 			position.baseAssetAmount);
      //
      // 	const positionSide = Perpetuals.positionSide(position);
      // 	return {
      // 		size,
      // 		marketId,
      // 		collateralChange,
      // 		// leverage: position.leverage || 1,
      // 		// leverage: undefined,
      // 		side:
      // 			positionSide === PerpetualsOrderSide.Bid
      // 				? PerpetualsOrderSide.Ask
      // 				: PerpetualsOrderSide.Bid,
      // 		// hasPosition: this.positionForMarketId({ marketId }) !== undefined,
      // 		reduceOnly: true,
      // 	};
      // };
    };
  }
});
var PerpetualsMarket;
var init_perpetualsMarket = __esm({
  "src/packages/perpetuals/perpetualsMarket.ts"() {
    "use strict";
    init_index();
    init_caller();
    init_perpetuals();
    PerpetualsMarket = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Create a new {@link PerpetualsMarket} wrapper from raw market data.
       *
       * @param marketData - Snapshot of market configuration and state.
       * @param config - Optional {@link CallerConfig} (network, base URL, etc.).
       * @param api - Optional shared {@link AftermathApi} provider instance.
       *
       * @remarks
       * This class extends {@link Caller} with the `"perpetuals"` route prefix, meaning
       * all HTTP requests resolve under `/perpetuals/...`.
       */
      constructor(marketData, config, api) {
        super(config, "perpetuals");
        this.marketData = marketData;
        this.api = api;
        this.getMaxOrderSize = async (inputs) => {
          return this.fetchApi("account/max-order-size", {
            ...inputs,
            marketId: this.marketId
          });
        };
        this.timeUntilNextFundingMs = () => {
          return this.nextFundingTimeMs() - Date.now();
        };
        this.nextFundingTimeMs = () => {
          return this.marketData.nextFundingTimestampMs > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(this.marketData.nextFundingTimestampMs);
        };
        this.estimatedFundingRate = () => {
          return this.marketData.estimatedFundingRate;
        };
        this.calcCollateralUsedForOrder = (inputs) => {
          const { leverage, orderData, indexPrice, collateralPrice } = inputs;
          const imr = 1 / (leverage || 1);
          const collateralUsd = Number(orderData.currentSize) / Casting.Fixed.fixedOneN9 * indexPrice * imr;
          const collateral = collateralUsd / collateralPrice;
          return {
            collateralUsd,
            collateral
          };
        };
        this.roundToValidPrice = (inputs) => {
          const ticks = inputs.price / this.tickSize();
          return (inputs.floor ? Math.floor(ticks) : inputs.ceil ? Math.ceil(ticks) : Math.round(ticks)) * this.tickSize();
        };
        this.roundToValidPriceBigInt = (inputs) => {
          const scaledPrice = Number(inputs.price * Casting.Fixed.fixedOneN9);
          return BigInt(
            inputs.floor ? Math.floor(scaledPrice) : inputs.ceil ? Math.ceil(scaledPrice) : Math.round(scaledPrice)
          ) / this.marketParams.tickSize * this.marketParams.tickSize;
        };
        this.roundToValidSize = (inputs) => {
          const lots = inputs.size / this.lotSize();
          return (inputs.floor ? Math.floor(lots) : inputs.ceil ? Math.ceil(lots) : Math.round(lots)) * this.lotSize();
        };
        this.roundToValidSizeBigInt = (inputs) => {
          const scaledSize = Number(inputs.size * Casting.Fixed.fixedOneN9);
          return BigInt(
            inputs.floor ? Math.floor(scaledSize) : inputs.ceil ? Math.ceil(scaledSize) : Math.round(scaledSize)
          ) / this.marketParams.lotSize * this.marketParams.lotSize;
        };
        this.emptyPosition = () => {
          return {
            marketId: this.marketId,
            collateral: 0,
            collateralUsd: 0,
            baseAssetAmount: 0,
            quoteAssetNotionalAmount: 0,
            cumFundingRateLong: this.marketData.marketState.cumFundingRateLong,
            cumFundingRateShort: this.marketData.marketState.cumFundingRateShort,
            asksQuantity: 0,
            bidsQuantity: 0,
            pendingOrders: [],
            makerFee: 1,
            // 100% (placeholder default)
            takerFee: 1,
            // 100% (placeholder default)
            leverage: 1,
            entryPrice: 0,
            freeCollateral: 0,
            freeMarginUsd: 0,
            liquidationPrice: 0,
            marginRatio: 1,
            unrealizedFundingsUsd: 0,
            unrealizedPnlUsd: 0
          };
        };
        this.marketId = marketData.objectId;
        this.indexPrice = marketData.indexPrice;
        this.collateralPrice = marketData.collateralPrice;
        this.collateralCoinType = marketData.collateralCoinType;
        this.marketParams = marketData.marketParams;
        this.marketState = marketData.marketState;
      }
      // =========================================================================
      //  Inspections
      // =========================================================================
      /**
       * Fetch the 24-hour volume and price change statistics for this market.
       *
       * Under the hood, this calls {@link Perpetuals.getMarkets24hrStats} and
       * returns the first (and only) entry.
       *
       * @returns {@link PerpetualsMarket24hrStats}.
       *
       * @remarks
       * This method creates a new {@link Perpetuals} instance using `this.config`.
       * If you need shared api behavior, prefer calling `perps.getMarkets24hrStats`
       * directly with the same api you initialized.
       */
      async get24hrStats() {
        const res = await new Perpetuals(this.config).getMarkets24hrStats({
          marketIds: [this.marketId]
        });
        return res.marketsStats[0];
      }
      /**
       * Fetch the full orderbook snapshot for this market.
       *
       * @returns Object containing `orderbook`.
       *
       * @example
       * ```ts
       * const { orderbook } = await market.getOrderbook();
       * console.log(orderbook.bids[0], orderbook.asks[0]);
       * ```
       */
      // TODO: move to `Perpetuals` class ?
      async getOrderbook() {
        const { orderbooks } = await this.fetchApi("markets/orderbooks", {
          marketIds: [this.marketId]
        });
        return {
          orderbook: orderbooks[0].orderbook
        };
      }
      /**
       * Market-level preview of placing a market order.
       *
       * Unlike {@link PerpetualsAccount.getPlaceMarketOrderPreview}, this version:
       * - Calls `account/previews/place-market-order`
       * - Explicitly sets `accountId: undefined`, allowing a “generic” preview that
       *   doesn’t rely on a specific account’s on-chain positions/collateral.
       *
       * @param inputs - {@link SdkPerpetualsPlaceMarketOrderPreviewInputs}.
       * @param abortSignal - Optional abort signal to cancel the request.
       *
       * @returns Either `{ error }` or a preview containing the simulated updated position,
       * slippage, filled/posted sizes, collateral change, and execution price.
       */
      async getPlaceMarketOrderPreview(inputs, abortSignal) {
        return this.fetchApi(
          "account/previews/place-market-order",
          {
            ...inputs,
            accountId: void 0
          },
          abortSignal
        );
      }
      /**
       * Market-level preview of placing a limit order.
       *
       * Similar to {@link getPlaceMarketOrderPreview}, this uses:
       * - `account/previews/place-limit-order`
       * - `accountId: undefined`
       *
       * @param inputs - {@link SdkPerpetualsPlaceLimitOrderPreviewInputs}.
       * @param abortSignal - Optional abort signal to cancel the request.
       *
       * @returns Either `{ error }` or a preview describing the simulated post-order state.
       */
      async getPlaceLimitOrderPreview(inputs, abortSignal) {
        return this.fetchApi(
          "account/previews/place-limit-order",
          {
            ...inputs,
            accountId: void 0
          },
          abortSignal
        );
      }
      /**
       * Market-level preview of placing a scale order.
       *
       * Similar to {@link getPlaceLimitOrderPreview}, this uses:
       * - `account/previews/place-scale-order`
       * - `accountId: undefined`
       *
       * @param inputs - {@link SdkPerpetualsPlaceScaleOrderPreviewInputs}.
       * @param abortSignal - Optional abort signal to cancel the request.
       *
       * @returns Either `{ error }` or a preview describing the simulated post-order state.
       */
      async getPlaceScaleOrderPreview(inputs, abortSignal) {
        return this.fetchApi(
          "account/previews/place-scale-order",
          {
            ...inputs,
            accountId: void 0
          },
          abortSignal
        );
      }
      // =========================================================================
      //  Order History
      // =========================================================================
      /**
       * Fetch paginated order history for this market.
       *
       * This is market-wide (public) history, not scoped to any account.
       *
       * @param inputs.beforeTimestampCursor - Optional pagination cursor.
       * @param inputs.limit - Optional page size.
       *
       * @returns {@link ApiPerpetualsMarketOrderHistoryResponse} containing:
       * - `orders`
       * - `nextBeforeTimestampCursor`
       */
      async getOrderHistory(inputs) {
        return this.fetchApi("market/order-history", {
          ...inputs,
          marketId: this.marketId
        });
      }
      // =========================================================================
      //  Prices
      // =========================================================================
      /**
       * Fetch the current prices for this market.
       *
       * Internally calls {@link Perpetuals.getPrices} and returns the first result.
       *
       * @returns `{ marketId, basePrice, collateralPrice, midPrice, markPrice }`.
       *
       * @remarks
       * This method instantiates a new {@link Perpetuals} client using `this.config`.
       * If you rely on a shared api, call `perps.getPrices(...)` directly instead.
       */
      async getPrices() {
        return (await new Perpetuals(this.config).getPrices({
          marketIds: [this.marketId]
        })).marketsPrices[0];
      }
      // =========================================================================
      //  Value Conversions
      // =========================================================================
      /**
       * Get the base-asset lot size for this market as a `number`.
       *
       * Order sizes must be multiples of this lot size.
       *
       * @returns Lot size in base asset units.
       */
      lotSize() {
        return Perpetuals.lotOrTickSizeToNumber(this.marketParams.lotSize);
      }
      /**
       * Get the minimal price tick size for this market as a `number`.
       *
       * Limit prices must be multiples of this tick size.
       *
       * @returns Tick size in quote units (e.g. USD).
       */
      tickSize() {
        return Perpetuals.lotOrTickSizeToNumber(this.marketParams.tickSize);
      }
      /**
       * Get the maximum theoretical leverage for this market.
       *
       * Computed as:
       * ```ts
       * 1 / marginRatioInitial
       * ```
       *
       * @returns Maximum leverage.
       */
      maxLeverage() {
        return 1 / this.marketParams.marginRatioInitial;
      }
      /**
       * Get the initial margin ratio for this market.
       *
       * This is the minimum margin required when opening a position.
       *
       * @returns Initial margin ratio as a fraction (e.g. 0.05 = 20x).
       */
      initialMarginRatio() {
        return this.marketParams.marginRatioInitial;
      }
      /**
       * Get the maintenance margin ratio for this market.
       *
       * Falling below this ratio may trigger liquidation.
       *
       * @returns Maintenance margin ratio as a fraction.
       */
      maintenanceMarginRatio() {
        return this.marketParams.marginRatioMaintenance;
      }
    };
  }
});
var PerpetualsVault;
var init_perpetualsVault = __esm({
  "src/packages/perpetuals/perpetualsVault.ts"() {
    "use strict";
    init_caller();
    init_perpetuals();
    PerpetualsVault = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Create a new {@link PerpetualsVault} wrapper.
       *
       * @param vaultObject - Raw on-chain vault object snapshot.
       * @param config - Optional {@link CallerConfig} (network, auth, base URL).
       * @param api - Optional shared {@link AftermathApi} provider. When provided,
       *   transaction builders will serialize {@link Transaction}s into `txKind`.
       */
      constructor(vaultObject, config, api) {
        super(config, "perpetuals");
        this.vaultObject = vaultObject;
        this.api = api;
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      // =========================================================================
      //  Withdraw Request Txs
      // =========================================================================
      /**
       * Build a `process-force-withdraw-request` transaction.
       *
       * Force-withdraw is a mechanism that closes required positions and processes
       * a withdraw request after a delay window (see vault params).
       *
       * @param inputs.walletAddress - User wallet that owns the withdraw request.
       * @param inputs.sizesToClose - Mapping of marketId -> size (base units) to close.
       * @param inputs.recipientAddress - Optional recipient of the withdrawn collateral.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing `tx` (and any additional outputs
       *   provided by the backend response type).
       */
      async getProcessForceWithdrawRequestTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/process-force-withdraw-request",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      // TODO: docs
      async getPauseVaultForForceWithdrawRequestTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/pause-vault-for-force-withdraw-request",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Build an `update-withdraw-request-slippage` transaction.
       *
       * This updates the user's minimum acceptable collateral output amount
       * for an existing withdraw request.
       *
       * @param inputs.minCollateralAmountOut - New minimum collateral amount out.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing `tx`.
       */
      async getUpdateWithdrawRequestSlippageTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/update-withdraw-request-slippage",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      // =========================================================================
      //  Owner Settings Txs
      // =========================================================================
      /**
       * Build an owner transaction to update the vault's force withdraw delay.
       *
       * @param inputs.forceWithdrawDelayMs - New delay (ms). Should be <= {@link constants.maxForceWithdrawDelayMs}.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing `tx`.
       */
      async getOwnerUpdateForceWithdrawDelayTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/owner/update-force-withdraw-delay",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Build an owner transaction to update the vault's lock period.
       *
       * @param inputs.lockPeriodMs - New lock period (ms). Should be <= {@link constants.maxLockPeriodMs}.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing `tx`.
       */
      async getOwnerUpdateLockPeriodTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/owner/update-lock-period",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Build an owner transaction to update the vault performance fee.
       *
       * @param inputs.performanceFeePercentage - New fee as a fraction (e.g. `0.2` = 20%).
       *   Should be <= {@link constants.maxPerformanceFeePercentage}.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing `tx`.
       */
      async getOwnerUpdatePerformanceFeeTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/owner/update-performance-fee",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      // =========================================================================
      //  Owner Interactions Txs
      // =========================================================================
      /**
       * Build an owner transaction to process one or more users' withdraw requests.
       *
       * This is the normal (non-force) processing path for withdrawals. The owner
       * batches users and settles their requests in a single transaction.
       *
       * @param inputs.userAddresses - Users whose requests should be processed.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing `tx`.
       */
      async getOwnerProcessWithdrawRequestsTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/owner/process-withdraw-requests",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Build an owner transaction to withdraw accrued performance fees.
       *
       * @param inputs.withdrawAmount - Amount of collateral to withdraw as fees.
       * @param inputs.recipientAddress - Optional recipient address for the withdrawn fees.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Response containing `tx` and any extra outputs described by
       * {@link ApiPerpetualsVaultOwnerWithdrawPerformanceFeesTxResponse}.
       */
      async getOwnerWithdrawPerformanceFeesTx(inputs) {
        const { tx: txFromInputs, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/owner/withdraw-performance-fees",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: txFromInputs ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Build an owner transaction to withdraw vault collateral by redeeming LP.
       *
       * @param inputs.lpWithdrawAmount - Amount of LP to redeem.
       * @param inputs.minCollateralAmountOut - Minimum collateral out to protect from slippage.
       * @param inputs.recipientAddress - Optional recipient address for withdrawn collateral.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Response containing `tx` and any extra outputs described by
       * {@link ApiPerpetualsVaultOwnerWithdrawCollateralTxResponse}.
       */
      async getOwnerWithdrawCollateralTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/owner/withdraw-collateral",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Build an owner transaction to withdraw locked liquidity from the vault.
       *
       * Owner-locked liquidity is LP that was locked at vault creation time.
       * This flow allows the owner to withdraw a portion without going through
       * the standard withdraw-request lifecycle. Owner-locked withdrawals are
       * exempt from performance fees.
       *
       * @param inputs.amount - Amount of locked LP to withdraw (native units).
       * @param inputs.minCollateralAmountOut - Minimum collateral out to protect from slippage.
       * @param inputs.recipientAddress - Optional recipient address for withdrawn collateral.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Response containing `tx` and any extra outputs described by
       * {@link ApiPerpetualsVaultOwnerWithdrawLockedLiquidityTxResponse}.
       */
      async getOwnerWithdrawLockedLiquidityTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/owner/withdraw-locked-liquidity",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      // =========================================================================
      //  User Interactions Txs
      // =========================================================================
      /**
       * Build a user transaction to create a vault withdraw request.
       *
       * Withdrawals are request-based: the user specifies how much LP to redeem
       * and a minimum collateral output amount.
       *
       * @param inputs.walletAddress - Wallet creating the request.
       * @param inputs.lpWithdrawAmount - Amount of LP to withdraw.
       * @param inputs.minCollateralAmountOut - Minimum collateral out (slippage guard).
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing `tx`.
       */
      async getCreateWithdrawRequestTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/create-withdraw-request",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Build a user transaction to cancel an existing vault withdraw request.
       *
       * @param inputs.walletAddress - Wallet canceling the request.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing `tx`.
       */
      async getCancelWithdrawRequestTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/cancel-withdraw-request",
          {
            ...otherInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      /**
       * Build a user transaction to deposit collateral into the vault in exchange for LP.
       *
       * You can specify the deposit as:
       * - `depositAmount` (wallet pays directly), OR
       * - `depositCoinArg` (use an existing transaction argument)
       *
       * @param inputs.walletAddress - Depositor wallet.
       * @param inputs.minLpAmountOut - Minimum LP out (slippage guard).
       * @param inputs.isSponsoredTx - Whether the tx is sponsored (gas paid by another party).
       * @param inputs.depositAmount - Amount of collateral to deposit (mutually exclusive with `depositCoinArg`).
       * @param inputs.depositCoinArg - Transaction argument referencing collateral coin.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing `tx`.
       *
       * @example
       * ```ts
       * const { txKind } = await vault.getDepositTx({
       *   walletAddress: "0x...",
       *   depositAmount: 1_000_000_000n,
       *   minLpAmountOut: 0n,
       * });
       * ```
       */
      // TODO: make return lp coin out ?
      async getDepositTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        const depositInputs = "depositAmount" in otherInputs ? {
          depositAmount: otherInputs.depositAmount,
          collateralCoinType: this.vaultObject.collateralCoinType
        } : { depositCoinArg: otherInputs.depositCoinArg };
        return this.fetchApiTxObject(
          "vault/transactions/deposit",
          {
            ...otherInputs,
            ...depositInputs,
            vaultId: this.vaultObject.objectId,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction4()
            })
          },
          void 0,
          { txKind: true }
        );
      }
      // =========================================================================
      //  Objects
      // =========================================================================
      /**
       * Fetch all withdraw requests for this vault.
       *
       * @returns {@link ApiPerpetualsVaultsWithdrawRequestsResponse} containing requests
       * scoped to `this.vaultObject.objectId`.
       *
       * @remarks
       * This currently calls the `vaults/withdraw-requests` endpoint with a single vault ID.
       * This may be moved to {@link Perpetuals} as a shared helper.
       */
      // TODO: move to `Perpetuals` (as well) ?
      getAllWithdrawRequests() {
        return this.fetchApi("vaults/withdraw-requests", {
          vaultIds: [this.vaultObject.objectId]
        });
      }
      // =========================================================================
      //  Owner Previews
      // =========================================================================
      /**
       * Preview the results of an owner processing one or more withdraw requests.
       *
       * @param inputs.userAddresses - Users to process.
       * @returns Preview response with expected effects.
       */
      async getPreviewOwnerProcessWithdrawRequests(inputs) {
        return this.fetchApi("vault/previews/owner/process-withdraw-requests", {
          ...inputs,
          vaultId: this.vaultObject.objectId
        });
      }
      /**
       * Preview the amount available for the owner to withdraw as performance fees.
       *
       * @returns Preview response including withdrawable fees and related metadata.
       */
      async getPreviewOwnerWithdrawPerformanceFees() {
        return this.fetchApi("vault/previews/owner/withdraw-performance-fees", {
          vaultId: this.vaultObject.objectId
        });
      }
      /**
       * Preview an owner collateral withdrawal (LP redemption).
       *
       * @param inputs.lpWithdrawAmount - LP amount to redeem.
       * @returns Preview response including estimated collateral out.
       */
      async getPreviewOwnerWithdrawCollateral(inputs) {
        return this.fetchApi("vault/previews/owner/withdraw-collateral", {
          ...inputs,
          vaultId: this.vaultObject.objectId
        });
      }
      /**
       * Preview an owner locked liquidity withdrawal.
       *
       * Returns the estimated collateral output for withdrawing a given amount
       * of the owner's locked LP tokens. Owner-locked withdrawals are exempt
       * from performance fees.
       *
       * @param inputs.amount - Amount of locked LP to withdraw (native units).
       * @returns Preview response including estimated collateral out and price.
       */
      async getPreviewOwnerWithdrawLockedLiquidity(inputs) {
        return this.fetchApi("vault/previews/owner/withdraw-locked-liquidity", {
          ...inputs,
          vaultId: this.vaultObject.objectId
        });
      }
      // =========================================================================
      //  User Previews
      // =========================================================================
      /**
       * Preview creating a withdraw request.
       *
       * @param inputs.walletAddress - Requesting wallet.
       * @param inputs.lpWithdrawAmount - LP amount to withdraw.
       * @returns Preview response including estimated collateral out and constraints.
       */
      async getPreviewCreateWithdrawRequest(inputs) {
        return this.fetchApi("vault/previews/create-withdraw-request", {
          ...inputs,
          vaultId: this.vaultObject.objectId
        });
      }
      /**
       * Preview depositing into the vault.
       *
       * @param inputs.depositAmount - Deposit amount in collateral coin units.
       * @returns Preview response including estimated LP out.
       */
      async getPreviewDeposit(inputs) {
        return this.fetchApi("vault/previews/deposit", {
          ...inputs,
          vaultId: this.vaultObject.objectId
        });
      }
      /**
       * Preview processing a force withdraw request for a user.
       *
       * This is useful to determine what positions/sizes must be closed or what
       * the expected outputs are prior to building the actual transaction.
       *
       * @param inputs.walletAddress - User wallet with a pending force-withdraw.
       * @returns Preview response describing expected processing effects.
       */
      async getPreviewProcessForceWithdrawRequest(inputs) {
        return this.fetchApi("vault/previews/process-force-withdraw-request", {
          ...inputs,
          vaultId: this.vaultObject.objectId
        });
      }
      // TODO: docs
      async getPreviewPauseVaultForForceWithdrawRequest(inputs) {
        return this.fetchApi("vault/previews/pause-vault-for-force-withdraw-request", {
          ...inputs,
          vaultId: this.vaultObject.objectId
        });
      }
      // =========================================================================
      //  Inspections
      // =========================================================================
      /**
       * Fetch the current LP coin price for this vault (in collateral units).
       *
       * Internally calls {@link Perpetuals.getLpCoinPrices} and returns the first price.
       *
       * @returns LP coin price as a `number`.
       */
      async getLpCoinPrice() {
        return (await new Perpetuals(this.config, this.api).getLpCoinPrices({
          vaultIds: [this.vaultObject.objectId]
        })).lpCoinPrices[0];
      }
      // =========================================================================
      //  Account
      // =========================================================================
      /**
       * Build a lightweight “cap-like” object for the vault’s underlying account.
       *
       * @returns {@link PerpetualsPartialVaultCap} suitable for account fetch helpers
       * such as {@link Perpetuals.getAccount}.
       */
      partialVaultCap() {
        return {
          vaultId: this.vaultObject.objectId,
          ownerAddress: this.vaultObject.ownerAddress,
          accountId: this.vaultObject.accountId,
          accountObjectId: this.vaultObject.accountObjectId,
          collateralCoinType: this.vaultObject.collateralCoinType
        };
      }
      /**
       * Fetch the underlying perpetuals account object for this vault.
       *
       * @returns `{ account }` where `account` is the on-chain {@link PerpetualsAccountObject}.
       */
      async getAccountObject() {
        return {
          account: (await new Perpetuals(this.config, this.api).getAccountObjects({
            accountIds: [this.vaultObject.accountId]
          })).accounts[0]
        };
      }
      /**
       * Fetch a {@link PerpetualsAccount} wrapper for the vault’s underlying account.
       *
       * @returns `{ account }` where `account` is a high-level {@link PerpetualsAccount}.
       */
      async getAccount() {
        return new Perpetuals(this.config, this.api).getAccount({
          accountCap: this.partialVaultCap()
        });
      }
      // =========================================================================
      //  Getters
      // =========================================================================
      // TODO: docs
      isPaused() {
        return !!(this.vaultObject.pausedUntilTimestamp && this.vaultObject.pausedUntilTimestamp > BigInt(Date.now()));
      }
    };
    PerpetualsVault.constants = {
      /**
       * Maximum lock period in milliseconds.
       */
      maxLockPeriodMs: 5184e6,
      // 2 months
      /**
       * Maximum period for force withdraw delay in milliseconds.
       */
      maxForceWithdrawDelayMs: 864e5,
      // 1 day
      /**
       * Maximum vault fee (performance fee).
       */
      maxPerformanceFeePercentage: 0.2,
      // 20%
      /**
       * Minimum USD value required for user deposits.
       */
      minDepositUsd: 1,
      /**
       * Minimum USD value required to be locked by vault owner during vault creation.
       */
      minOwnerLockUsd: 1,
      /**
       * The maximum number of distinct markets (`ClearingHouse`s) the vault can trade.
       */
      maxMarketsInVault: 12,
      /**
       * The maximum number of pending orders allowed for a single position in the vault.
       */
      maxPendingOrdersPerPosition: 70
    };
    PerpetualsVault.isValidLpCoinName = (value) => {
      return /^[\x00-\x7F]+$/.test(value);
    };
    PerpetualsVault.isValidLpCoinTypeSymbol = (value) => {
      return /^[A-Z_]+$/.test(value);
    };
    PerpetualsVault.calcWithdrawRequestSlippage = (inputs) => {
      const { withdrawRequest } = inputs;
      return withdrawRequest.lpAmountInUsd ? (withdrawRequest.lpAmountInUsd - withdrawRequest.minCollateralAmountOutUsd) / withdrawRequest.lpAmountInUsd : 0;
    };
  }
});
var MASK_64;
var MASK_128;
var ASK_THRESHOLD;
var _PerpetualsOrderUtils;
var PerpetualsOrderUtils;
var init_perpetualsOrderUtils = __esm({
  "src/packages/perpetuals/utils/perpetualsOrderUtils.ts"() {
    "use strict";
    init_types2();
    init_perpetuals2();
    MASK_64 = (BigInt(1) << BigInt(64)) - BigInt(1);
    MASK_128 = (BigInt(1) << BigInt(128)) - BigInt(1);
    ASK_THRESHOLD = BigInt(1) << BigInt(127);
    _PerpetualsOrderUtils = class _PerpetualsOrderUtils {
    };
    _PerpetualsOrderUtils.orderId = (price, counter, side) => {
      if (side) {
        return _PerpetualsOrderUtils.orderIdAsk(price, counter);
      }
      return _PerpetualsOrderUtils.orderIdBid(price, counter);
    };
    _PerpetualsOrderUtils.orderIdAsk = (price, counter) => {
      return price << BigInt(64) | counter;
    };
    _PerpetualsOrderUtils.orderIdBid = (price, counter) => {
      return (price ^ MASK_64) << BigInt(64) | counter;
    };
    _PerpetualsOrderUtils.price = (orderId) => {
      const side = Perpetuals.orderIdToSide(orderId);
      if (side === 1) {
        return _PerpetualsOrderUtils.priceAsk(orderId);
      }
      return _PerpetualsOrderUtils.priceBid(orderId);
    };
    _PerpetualsOrderUtils.priceAsk = (orderId) => {
      return orderId >> BigInt(64);
    };
    _PerpetualsOrderUtils.priceBid = (orderId) => {
      return orderId >> BigInt(64) ^ MASK_64;
    };
    _PerpetualsOrderUtils.counter = (orderId) => {
      return orderId & MASK_128;
    };
    _PerpetualsOrderUtils.isAsk = (orderId) => {
      return orderId < ASK_THRESHOLD;
    };
    PerpetualsOrderUtils = _PerpetualsOrderUtils;
  }
});
var init_utils2 = __esm({
  "src/packages/perpetuals/utils/index.ts"() {
    "use strict";
    init_perpetualsOrderUtils();
  }
});
var _Perpetuals;
var Perpetuals;
var init_perpetuals = __esm({
  "src/packages/perpetuals/perpetuals.ts"() {
    "use strict";
    init_caller();
    init_fixedUtils();
    init_types2();
    init_perpetualsAccount();
    init_perpetualsMarket();
    init_perpetualsVault();
    init_utils2();
    _Perpetuals = class _Perpetuals2 extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new Perpetuals client.
       *
       * @param config - Optional caller configuration (network, auth token, etc.).
       * @param api - Optional shared {@link AftermathApi} provider instance. When
       *   provided, transaction-building helpers can derive serialized `txKind`
       *   from a {@link Transaction} object via `api.Transactions().fetchBase64TxKindFromTx`.
       *
       * @remarks
       * This class extends {@link Caller} with the `"perpetuals"` route prefix, meaning:
       * - HTTP calls resolve under `/perpetuals/...`
       * - Websocket calls resolve under `/perpetuals/ws/...`
       */
      constructor(config, api) {
        super(config, "perpetuals");
        this.api = api;
      }
      // =========================================================================
      //  Markets
      // =========================================================================
      /**
       * Fetch all perpetual markets for a given collateral coin type.
       *
       * This method returns *wrapped* {@link PerpetualsMarket} instances, not the raw
       * market structs. Each instance provides additional helpers for pricing, margin,
       * and order parsing.
       *
       * @param inputs.collateralCoinType - Coin type used as collateral, e.g. `"0x2::sui::SUI"`.
       * @returns Object containing `markets`.
       *
       * @example
       * ```ts
       * const { markets } = await perps.getAllMarkets({
       *   collateralCoinType: "0x2::sui::SUI",
       * });
       * ```
       */
      async getAllMarkets(inputs) {
        const res = await this.fetchApi("all-markets", inputs);
        return {
          markets: res.markets.map(
            (marketData) => new PerpetualsMarket(marketData, this.config, this.api)
          )
        };
      }
      /**
       * Fetch a single market by ID.
       *
       * Internally calls {@link getMarkets} and returns the first entry.
       *
       * @param inputs.marketId - The market (clearing house) object ID.
       * @returns Object containing `market`.
       *
       * @throws If the backend returns an empty list for the given `marketId`,
       * this will still attempt to return `markets[0]` (which would be `undefined`).
       * Callers may want to validate the result.
       *
       * @example
       * ```ts
       * const { market } = await perps.getMarket({ marketId: "0x..." });
       * ```
       */
      async getMarket(inputs) {
        const { markets } = await this.getMarkets({
          marketIds: [inputs.marketId]
        });
        return {
          market: markets[0]
        };
      }
      /**
       * Fetch multiple markets by ID.
       *
       * Backend note:
       * - The API supports returning orderbooks. This SDK currently constructs
       *  {@link PerpetualsMarket} from the returned `marketDatas[].market`.
       *
       * @param inputs.marketIds - Array of market object IDs to fetch.
       * @returns Object containing `markets` in the same order as `marketIds`.
       *
       * @example
       * ```ts
       * const { markets } = await perps.getMarkets({
       *   marketIds: ["0x..A", "0x..B"],
       * });
       * ```
       */
      async getMarkets(inputs) {
        const res = await this.fetchApi("markets", inputs);
        return {
          markets: res.marketDatas.map(
            (marketData) => new PerpetualsMarket(marketData.market, this.config, this.api)
          )
        };
      }
      // =========================================================================
      //  Vaults
      // =========================================================================
      /**
       * Fetch all vaults on the current network.
       *
       * Vaults are managed accounts that can hold positions; LPs deposit collateral
       * and receive an LP coin (see pricing helpers like {@link getLpCoinPrices}).
       *
       * @returns Object containing `vaults`.
       *
       * @example
       * ```ts
       * const { vaults } = await perps.getAllVaults();
       * ```
       */
      async getAllVaults() {
        const res = await this.fetchApi("vaults", {});
        return {
          vaults: res.vaults.map(
            (vaultObject) => new PerpetualsVault(vaultObject, this.config, this.api)
          )
        };
      }
      /**
       * Fetch a single vault by ID.
       *
       * Internally calls {@link getVaults} and returns the first entry.
       *
       * @param inputs.vaultId - Vault object ID.
       * @returns Object containing `vault`.
       */
      async getVault(inputs) {
        const { vaults } = await this.getVaults({
          vaultIds: [inputs.vaultId]
        });
        return {
          vault: vaults[0]
        };
      }
      /**
       * Fetch multiple vaults by ID.
       *
       * @param inputs.vaultIds - Array of vault object IDs.
       * @returns Object containing `vaults` in the same order as `vaultIds`.
       */
      async getVaults(inputs) {
        const res = await this.fetchApi("vaults", inputs);
        return {
          vaults: res.vaults.map(
            (vaultObject) => new PerpetualsVault(vaultObject, this.config, this.api)
          )
        };
      }
      // =========================================================================
      //  Accounts
      // =========================================================================
      /**
       * Convenience helper to fetch a single account (positions + account object) from an account cap.
       *
       * Internally calls {@link getAccounts} and returns the first entry.
       *
       * @param inputs.accountCap - Account cap or partial vault cap object to derive account metadata from.
       * @param inputs.marketIds - Optional list of markets to filter positions by.
       * @returns Object containing `account`.
       *
       * @example
       * ```ts
       * const [accountCap] = await perps.getOwnedAccountCaps({ walletAddress: "0x..." });
       * const { account } = await perps.getAccount({ accountCap });
       * ```
       */
      // TODO: merge this with `getAccountObjects` as an option ?
      async getAccount(inputs) {
        const { accountCap, marketIds } = inputs;
        return {
          account: (await this.getAccounts({
            accountCaps: [accountCap],
            marketIds
          })).accounts[0]
        };
      }
      /**
       * Fetch one or more accounts (positions + account objects) from account caps.
       *
       * This composes:
       * 1) {@link getAccountObjects} to fetch {@link PerpetualsAccountObject}s by account ID
       * 2) Local pairing of returned account objects with `accountCaps`
       *
       * The returned {@link PerpetualsAccount} instances encapsulate:
       * - The account snapshot (positions, balances, etc.)
       * - The ownership/cap metadata (accountId, collateral type, vaultId, etc.)
       *
       * @param inputs.accountCaps - Array of account caps or partial vault cap objects.
       * @param inputs.marketIds - Optional list of market IDs to filter positions by.
       * @returns Object containing `accounts` in the same order as `accountCaps`.
       *
       * @remarks
       * If `accountCaps` is empty, this returns `{ accounts: [] }` without making an API call.
       */
      async getAccounts(inputs) {
        const { accountCaps, marketIds } = inputs;
        if (accountCaps.length <= 0) {
          return {
            accounts: []
          };
        }
        const accountObjects = (await this.getAccountObjects({
          accountIds: accountCaps.map((accountCap) => accountCap.accountId),
          marketIds
        })).accounts;
        return {
          accounts: accountObjects.map(
            (account, index) => new PerpetualsAccount(
              account,
              accountCaps[index],
              this.config,
              this.api
            )
          )
        };
      }
      /**
       * Fetch raw account objects (including positions) for one or more account IDs.
       *
       * This is the lower-level primitive used by {@link getAccounts}.
       *
       * @param inputs.accountIds - List of account IDs to query.
       * @param inputs.marketIds - Optional list of market IDs to filter positions by.
       *
       * @returns {@link ApiPerpetualsAccountPositionsResponse} containing `accounts`.
       *
       * @remarks
       * If `accountIds` is empty, this returns `{ accounts: [] }` without making an API call.
       */
      async getAccountObjects(inputs) {
        const { accountIds, marketIds } = inputs;
        if (accountIds.length <= 0) {
          return {
            accounts: []
          };
        }
        return this.fetchApi("accounts/positions", {
          accountIds,
          marketIds
        });
      }
      // =========================================================================
      //  Ownership Queries
      // =========================================================================
      /**
       * Fetch all account caps (perpetuals accounts) owned by a wallet, optionally
       * filtered by collateral coin types.
       *
       * Returned values are “caps” (ownership objects), not full account snapshots.
       * To fetch account positions, use {@link getAccount} or {@link getAccounts}.
       *
       * @param inputs.walletAddress - Owner wallet address.
       * @param inputs.collateralCoinTypes - Optional list of collateral coin types to filter by.
       * @returns {@link ApiPerpetualsOwnedAccountCapsResponse} containing `accounts`.
       *
       * @example
       * ```ts
       * const { accounts } = await perps.getOwnedAccountCaps({
       *   walletAddress: "0x...",
       *   collateralCoinTypes: ["0x2::sui::SUI"],
       * });
       * ```
       */
      async getOwnedAccountCaps(inputs) {
        const { walletAddress, collateralCoinTypes } = inputs;
        return this.fetchApi("accounts/owned", {
          walletAddress,
          collateralCoinTypes
        });
      }
      /**
       * Fetch all vault caps owned by a wallet.
       *
       * Vault caps represent ownership/administrative authority over a vault.
       *
       * @param inputs.walletAddress - Owner wallet address.
       * @returns {@link ApiPerpetualsOwnedVaultCapsResponse} containing vault caps.
       */
      async getOwnedVaultCaps(inputs) {
        return this.fetchApi("vaults/owned-vault-caps", inputs);
      }
      /**
       * Fetch all vault **assistant** caps owned by a wallet.
       *
       * Assistant caps grant a non-owner wallet the ability to operate a vault
       * on behalf of the owner. The returned caps are structurally identical to
       * regular vault caps ({@link PerpetualsVaultCap}) and can be used to
       * construct a {@link PerpetualsAccount} that signs vault transactions with
       * the assistant's wallet.
       *
       * @param inputs.walletAddress - Assistant wallet address.
       * @returns {@link ApiPerpetualsOwnedVaultAssistantCapsResponse} containing
       *   assistant caps.
       */
      async getOwnedVaultAssistantCaps(inputs) {
        return this.fetchApi("vaults/owned-vault-assistant-caps", inputs);
      }
      /**
       * Fetch all pending vault withdrawal requests created by a given wallet.
       *
       * Withdraw requests are typically created when LPs request to exit a vault
       * and may be subject to lock periods / delays depending on vault configuration.
       *
       * @param inputs.walletAddress - Wallet address that created the withdraw requests.
       * @returns {@link ApiPerpetualsVaultOwnedWithdrawRequestsResponse} containing requests.
       */
      async getOwnedVaultWithdrawRequests(inputs) {
        return this.fetchApi("vaults/owned-withdraw-requests", {
          ...inputs
          // vaultIds: undefined,
        });
      }
      /**
       * Fetch all Perpetuals vault LP coins owned by a wallet.
       *
       * This returns coin objects (or summaries) representing LP token holdings.
       * Use {@link getLpCoinPrices} to value them in collateral units.
       *
       * @param inputs - {@link ApiPerpetualsVaultOwnedLpCoinsBody}.
       * @returns {@link ApiPerpetualsVaultOwnedLpCoinsResponse}.
       */
      async getOwnedVaultLpCoins(inputs) {
        return this.fetchApi("vaults/owned-lp-coins", inputs);
      }
      /**
       * Fetch account caps by their account IDs.
       *
       * @param inputs.accountCapIds - List of account IDs.
       * @returns {@link ApiPerpetualsAccountCapsResponse} containing caps.
       */
      async getAdminAccountCaps(inputs) {
        return this.fetchApi("accounts", inputs);
      }
      // =========================================================================
      //  Historical Data & Stats
      // =========================================================================
      /**
       * Fetch historical OHLCV candle data for a single market.
       *
       * @param inputs.marketId - Market ID to query.
       * @param inputs.fromTimestamp - Start timestamp (inclusive).
       * @param inputs.toTimestamp - End timestamp (exclusive).
       * @param inputs.intervalMs - Candle interval in milliseconds.
       *
       * @returns {@link ApiPerpetualsMarketCandleHistoryResponse} containing candle points.
       *
       * @remarks
       * This is currently implemented on the Perpetuals root client, but it may be
       * relocated to {@link PerpetualsMarket} in the future.
       */
      // TODO: move to market class ?
      getMarketCandleHistory(inputs) {
        const { marketId, fromTimestamp, toTimestamp, intervalMs } = inputs;
        return this.fetchApi("market/candle-history", {
          marketId,
          fromTimestamp,
          toTimestamp,
          intervalMs
        });
      }
      /**
       * Fetch historical funding rate data for a single market.
       *
       * @param inputs.marketId - Market ID to query.
       * @param inputs.fromTimestamp - Start timestamp (inclusive).
       * @param inputs.toTimestamp - End timestamp (exclusive).
       * @param inputs.limit - Optional cap on the number of points returned.
       *
       * @returns {@link ApiPerpetualsMarketFundingHistoryResponse} containing
       * funding history points.
       */
      getMarketFundingHistory(inputs) {
        return this.fetchApi("market/funding-history", inputs);
      }
      /**
       * Fetch 24-hour volume and price change stats for multiple markets.
       *
       * Returns volume, price change, and the latest base, collateral,
       * mid, and mark prices for each requested market.
       *
       * @param inputs.marketIds - Market IDs to query.
       * @returns {@link ApiPerpetualsMarkets24hrStatsResponse}.
       */
      getMarkets24hrStats(inputs) {
        return this.fetchApi("markets/24hr-stats", inputs);
      }
      // =========================================================================
      //  Prices
      // =========================================================================
      /**
       * Fetch the latest prices for one or more markets.
       *
       * Returns base, collateral, order book mid, and mark prices for each
       * requested market.
       *
       * @param inputs.marketIds - List of market IDs to query.
       * @returns {@link ApiPerpetualsMarketsPricesResponse} containing `marketsPrices`.
       *
       * @remarks
       * If `marketIds` is empty, returns `{ marketsPrices: [] }` without making an API call.
       */
      async getPrices(inputs) {
        if (inputs.marketIds.length <= 0) {
          return {
            marketsPrices: []
          };
        }
        return this.fetchApi("markets/prices", inputs);
      }
      /**
       * Fetch LP coin prices (in collateral units) for a set of vaults.
       *
       * @param inputs.vaultIds - List of vault IDs to query.
       * @returns {@link ApiPerpetualsVaultLpCoinPricesResponse} containing `lpCoinPrices`.
       *
       * @remarks
       * If `vaultIds` is empty, returns `{ lpCoinPrices: [] }` without making an API call.
       */
      async getLpCoinPrices(inputs) {
        if (inputs.vaultIds.length <= 0) {
          return {
            lpCoinPrices: []
          };
        }
        return this.fetchApi("vaults/lp-coin-prices", inputs);
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      /**
       * Build a transaction to transfer a Perpetuals capability object (cap) to another wallet.
       *
       * Supports two methods:
       * - **Method 1**: Provide `capObjectId` to transfer an existing on-chain object.
       * - **Method 2**: Provide `composed` with the PTB argument and capability type
       *   from a deferred PTB composition (e.g., from `getCreateAccountTx` with `deferShare=true`).
       *
       * @param inputs.recipientAddress - Recipient wallet address that should receive the cap.
       * @param inputs.capObjectId - Object ID of the capability to transfer (Method 1).
       * @param inputs.composed - Composed PTB argument + capability type (Method 2).
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing a `tx`.
       */
      async getTransferCapTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "transactions/transfer-cap",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction5()
            })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `create-account` transaction for Aftermath Perpetuals.
       *
       * When `deferShare` is `true`, the response includes a `deferred` object with
       * `accountArg`, `sharePolicyArg`, `adminCapArg`, and `collateralCoinType` so you
       * can compose additional commands (grant-agent-wallet, transfer-cap) before calling
       * {@link getShareAccountTx} to finalize.
       *
       * @param inputs.walletAddress - Wallet address that will own the new account.
       * @param inputs.collateralCoinType - Collateral coin type used by the account.
       * @param inputs.deferShare - When true, returns `deferred` args without sharing yet.
       * @param inputs.tx - Optional {@link Transaction} to extend.
       * @returns `tx` plus optional `deferred` containing argument references when deferred.
       */
      async getCreateAccountTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "transactions/create-account",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a transaction that grants an Agent Wallet permission on a Perpetuals account.
       *
       * Supports two methods:
       * - **Method 1 (existing account)**: Provide `accountId` to look up an existing shared account.
       * - **Method 2 (composed flow)**: Provide `deferred` with the argument references
       *   from a deferred `getCreateAccountTx` call.
       *
       * @param inputs.recipientAddress - Wallet address to receive agent permissions.
       * @param inputs.accountId - Perpetuals account ID (Method 1).
       * @param inputs.deferred - Deferred account args from `getCreateAccountTx` (Method 2).
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing a `tx`.
       */
      async getGrantAgentWalletTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "account/transactions/grant-agent-wallet",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction5()
            })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a transaction to share a Perpetuals account that was created with deferred sharing.
       *
       * This finalizes the account creation flow by consuming the `AccountSharePolicy`
       * and sharing the `Account` object. Call this after composing additional commands
       * (grant-agent-wallet, transfer-cap) with the args returned by {@link getCreateAccountTx}.
       *
       * Pass the deferred fields (`accountArg`, `sharePolicyArg`, `adminCapArg`,
       * `collateralCoinType`) from the `deferred` object returned by `getCreateAccountTx`.
       *
       * @param inputs.accountArg - Account argument from deferred create.
       * @param inputs.sharePolicyArg - Share policy argument from deferred create.
       * @param inputs.adminCapArg - Admin cap argument from deferred create.
       * @param inputs.collateralCoinType - Collateral type for the account.
       * @param inputs.sponsor - Optional sponsorship config.
       * @param inputs.tx - Optional transaction to extend.
       *
       * @returns Transaction response containing a `tx`.
       */
      async getShareAccountTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "account/transactions/share",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction5()
            })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a `create-vault-cap` transaction.
       *
       * A vault cap is an ownership/admin object for interacting with vault management
       * flows. This method returns a transaction kind that mints/creates that cap.
       *
       * @param inputs - {@link ApiPerpetualsCreateVaultCapBody}.
       * @returns {@link SdkTransactionResponse} with `tx`.
       */
      async getCreateVaultCapTx(inputs) {
        return this.fetchApiTxObject("vault/transactions/create-vault-cap", inputs, void 0, {
          txKind: true
        });
      }
      /**
       * Build a `create-vault` transaction.
       *
       * This creates a new vault plus its on-chain metadata and initial LP supply
       * seeded by the initial deposit.
       *
       * Deposit input:
       * - Use `initialDepositAmount` to have the API select/merge coins as needed, OR
       * - Use `initialDepositCoinArg` if you already have a coin argument in a larger tx.
       *
       * Metadata:
       * - Stored on-chain (or in a referenced object) as part of vault creation.
       * - `extraFields` allows forward-compatible additions (e.g. social links).
       *
       * @param inputs.walletAddress - Address of vault owner/curator.
       * @param inputs.metadata - Vault display metadata (name, description, curator info).
       * @param inputs.metadata - Vault display metadata (name, description, curator info).
       * @param inputs.coinMetadataId - Coin metadata object id obtained from create vault cap tx
       * @param inputs.treasuryCapId - Treasury cap object id obtained from create vault cap tx
       * @param inputs.collateralCoinType - Collateral coin type for deposits.
       * @param inputs.lockPeriodMs - Lock-in period for deposits in milliseconds.
       * @param inputs.performanceFeePercentage - Fraction of profits taken as curator fee.
       * @param inputs.forceWithdrawDelayMs - Delay before forced withdrawals can be processed.
       * @param inputs.isSponsoredTx - Whether this tx is sponsored (gas paid by another party).
       * @param inputs.initialDepositAmount - Initial deposit amount (mutually exclusive with `initialDepositCoinArg`).
       * @param inputs.initialDepositCoinArg - Transaction object argument referencing the deposit coin.
       * @param inputs.tx - Optional {@link Transaction} to extend.
       *
       * @returns {@link SdkTransactionResponse} with `tx`.
       */
      async getCreateVaultTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "vault/transactions/create-vault",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      // =========================================================================
      //  Rebates
      // =========================================================================
      /**
       * Calculate rewards and rebates for one or more perpetuals accounts.
       *
       * Computes per-account maker and taker reward allocations, fee-tier rebates,
       * and volume-based metrics. When `accountIds` is omitted or empty, all eligible
       * accounts are included.
       *
       * **Note:** All data returned is for the current epoch only.
       *
       * @param inputs.totalMakerRewards - Total maker reward pool to distribute.
       * @param inputs.totalTakerRewards - Total taker reward pool to distribute.
       * @param inputs.accountIds - Optional list of account IDs.
       * @returns {@link ApiPerpetualsCurrentRebateRewardsResponse} with per-account reward and rebate data.
       *
       * @example
       * ```ts
       * const { totalQScoreFinal, rewards } = await perps.getCurrentRebateRewards({
       *   totalMakerRewards: 10000,
       *   totalTakerRewards: 5000,
       * });
       * ```
       */
      async getCurrentRebateRewards(inputs) {
        return this.fetchApi("rebates/rewards", inputs);
      }
      /**
       * Generate a CSV-formatted rebate report for perpetuals market makers.
       *
       * Computes per-account reward allocations and fee-tier rebate adjustments,
       * returning the result as a CSV string. When `aggregated` is true, the CSV
       * groups rewards by owner address instead of per-account.
       *
       * **Note:** All data returned is for the current epoch only.
       *
       * @param inputs - {@link ApiPerpetualsCreateCsvRebatesBody}.
       * @returns {@link ApiPerpetualsCreateCsvRebatesResponse} containing the CSV string.
       */
      async getCsvRebates(inputs) {
        return this.fetchApi("rebates/create-csv-rebates", inputs);
      }
      /**
       * Generate a CSV-formatted referral rebate report.
       *
       * Calculates referrer commissions and referee discounts based on trading
       * fees within the specified epoch, returning the result as a CSV string.
       *
       * @param inputs - {@link ApiPerpetualsCreateReferralCsvRebatesBody}.
       * @returns {@link ApiPerpetualsCreateReferralCsvRebatesResponse} containing the CSV string.
       */
      async getReferralCsvRebates(inputs) {
        return this.fetchApi("rebates/create-referral-csv-rebates", inputs);
      }
      // =========================================================================
      //  Builder Codes Transactions
      // =========================================================================
      /**
       * Build a transaction to create an integrator configuration.
       *
       * This endpoint creates a transaction that allows a user to grant permission to an
       * integrator to receive fees on orders placed on their behalf. The user specifies
       * a maximum taker fee that the integrator can charge. The integrator can then
       * include their address and fee (up to the maximum) when placing orders for the user.
       *
       * The resulting transaction must be signed by the account owner and executed on-chain.
       *
       * @param inputs - {@link ApiPerpetualsBuilderCodesCreateIntegratorConfigTxBody}.
       * @returns {@link SdkTransactionResponse} with `tx`.
       *
       * @example
       * ```ts
       * const tx = await perps.getCreateBuilderCodeIntegratorConfigTx({
       *   accountId: 123n,
       *   integratorAddress: "0x...",
       *   maxTakerFee: 0.001, // 0.1% max fee
       * });
       * ```
       */
      async getCreateBuilderCodeIntegratorConfigTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "builder-codes/transactions/create-integrator-config",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a transaction to remove an integrator configuration.
       *
       * This endpoint creates a transaction that removes an integrator's approval to
       * collect fees on orders placed on behalf of the user. Once revoked, the integrator
       * will no longer be able to submit orders with integrator fees for this account.
       * The user can re-approve the integrator at any time by calling
       * {@link getCreateIntegratorConfigTx} again.
       *
       * The resulting transaction must be signed by the account owner and executed on-chain.
       *
       * @param inputs - {@link ApiPerpetualsBuilderCodesRemoveIntegratorConfigTxBody}.
       * @returns {@link SdkTransactionResponse} with `tx`.
       *
       * @example
       * ```ts
       * const tx = await perps.getRemoveBuilderCodeIntegratorConfigTx({
       *   accountId: 123n,
       *   integratorAddress: "0x...",
       * });
       * ```
       */
      async getRemoveBuilderCodeIntegratorConfigTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "builder-codes/transactions/remove-integrator-config",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a transaction to initialize an integrator fee vault for a specific market.
       *
       * This endpoint creates a transaction that initializes a vault where an integrator's
       * fees will accumulate for a specific market (clearing house). This is a one-time
       * setup operation that must be performed before the integrator can claim fees from
       * that market. Once created, the vault will automatically collect fees as the
       * integrator submits orders on behalf of users in that market.
       *
       * The resulting transaction must be signed by the integrator and executed on-chain.
       *
       * @param inputs - {@link ApiPerpetualsBuilderCodesCreateIntegratorVaultTxBody}.
       * @returns {@link SdkTransactionResponse} with `tx`.
       *
       * @example
       * ```ts
       * const tx = await perps.getCreateBuilderCodeIntegratorVaultTx({
       *   marketId: "0x...",
       *   integratorAddress: "0x...",
       * });
       * ```
       */
      async getCreateBuilderCodeIntegratorVaultTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "builder-codes/transactions/create-integrator-vault",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      /**
       * Build a transaction to claim accumulated integrator fees from a vault.
       *
       * This endpoint creates a transaction that allows an integrator to claim the fees
       * they have earned from orders placed on behalf of users. Fees accumulate in a vault
       * specific to each market (clearing house) and can be claimed at any moment by the
       * integrator. The fees are proportional to the taker volume generated by the users'
       * orders that the integrator submitted.
       *
       * If a `recipientAddress` is provided, the claimed fees will be automatically
       * transferred to that address. Otherwise, the coin output is exposed as a transaction
       * argument for further use in the transaction.
       *
       * The resulting transaction must be signed by the integrator and executed on-chain.
       *
       * @param inputs - {@link ApiPerpetualsBuilderCodesClaimIntegratorVaultFeesTxBody}.
       * @returns {@link ApiPerpetualsBuilderCodesClaimIntegratorVaultFeesTxResponse} containing
       *   `txKind` and optionally `coinOutArg`.
       *
       * @example
       * ```ts
       * // Claim with automatic transfer to recipient
       * const response = await perps.getClaimBuilderCodeIntegratorVaultFeesTx({
       *   marketId: "0x...",
       *   integratorAddress: "0x...",
       *   recipientAddress: "0x...",
       * });
       *
       * // Claim with coin output for further use
       * const response = await perps.getClaimBuilderCodeIntegratorVaultFeesTx({
       *   marketId: "0x...",
       *   integratorAddress: "0x...",
       * });
       * // response.coinOutArg can be used in subsequent transaction commands
       * ```
       */
      async getClaimBuilderCodeIntegratorVaultFeesTx(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "builder-codes/transactions/claim-integrator-vault-fees",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
          },
          void 0,
          {
            txKind: true
          }
        );
      }
      // =========================================================================
      //  Builder Codes Inspections
      // =========================================================================
      /**
       * Fetch integrator configuration for a specific account and integrator.
       *
       * This endpoint queries whether an integrator has been approved by an account to collect
       * fees on orders placed on behalf of the account. If approved, it returns the maximum
       * taker fee the integrator is authorized to charge. This information is useful for:
       * - Verifying integrator permissions before placing orders
       * - Displaying authorized integrators and their fee limits in UIs
       * - Validating that an integrator's requested fee doesn't exceed the approved maximum
       *
       * @param inputs - {@link ApiPerpetualsBuilderCodesIntegratorConfigBody}.
       * @returns {@link ApiPerpetualsBuilderCodesIntegratorConfigResponse} containing
       *   `maxTakerFee` and `exists` flag.
       *
       * @example
       * ```ts
       * const config = await perps.getBuilderCodeIntegratorConfig({
       *   accountId: 123n,
       *   integratorAddress: "0x...",
       * });
       *
       * if (config.exists) {
       *   console.log(`Integrator is approved with max fee: ${config.maxTakerFee}`);
       * } else {
       *   console.log("Integrator is not approved for this account");
       * }
       * ```
       */
      async getBuilderCodeIntegratorConfig(inputs) {
        return this.fetchApi("builder-codes/integrator-config", inputs);
      }
      /**
       * Fetch accumulated integrator vault fees across multiple markets.
       *
       * This endpoint queries the total fees an integrator has earned and accumulated in their
       * vaults across one or more markets (clearing houses). Integrators earn fees proportional
       * to the taker volume generated by orders they submit on behalf of users. These fees
       * accumulate in per-market vaults and can be claimed at any time using
       * {@link getClaimIntegratorVaultFeesTx}.
       *
       * This information is useful for:
       * - Displaying total claimable fees to integrators in dashboards
       * - Monitoring fee accrual across different markets
       * - Determining which markets have fees ready to be claimed
       *
       * @param inputs - {@link ApiPerpetualsBuilderCodesIntegratorVaultsBody}.
       * @returns {@link ApiPerpetualsBuilderCodesIntegratorVaultsResponse} containing
       *   a vector of market vault data with accumulated fees.
       *
       * @example
       * ```ts
       * const vaultFees = await perps.getBuilderCodeIntegratorVaults({
       *   marketIds: ["0x...BTCUSD", "0x...SUIUSD"],
       *   integratorAddress: "0x...",
       * });
       *
       * for (const vault of vaultFees.integratorVaults) {
       *   console.log(`Market ${vault.marketId}: ${vault.fees} collateral units claimable`);
       * }
       *
       * const totalFees = vaultFees.integratorVaults.reduce((sum, vault) => sum + vault.fees, 0);
       * console.log(`Total claimable: ${totalFees}`);
       * ```
       */
      async getBuilderCodeIntegratorVaults(inputs) {
        return this.fetchApi("builder-codes/integrator-vaults", inputs);
      }
      // =========================================================================
      //  Public Static Helpers
      // =========================================================================
      /**
       * Determine the logical order side (Bid/Ask) from a signed base asset amount.
       *
       * @param inputs.baseAssetAmount - Position base size. Positive/zero => Bid (long), negative => Ask (short).
       * @returns {@link PerpetualsOrderSide}.
       */
      static positionSide(inputs) {
        const baseAmount = inputs.baseAssetAmount;
        const isLong = Math.sign(baseAmount);
        const side = isLong >= 0 ? 0 : 1;
        return side;
      }
      /**
       * Compute the effective trade price from a {@link FilledTakerOrderEvent}.
       *
       * Uses the ratio: `quoteAssetDelta / baseAssetDelta`.
       *
       * @param inputs.orderEvent - Filled taker order event.
       * @returns Trade price.
       */
      static orderPriceFromEvent(inputs) {
        const { orderEvent } = inputs;
        return orderEvent.quoteAssetDelta / orderEvent.baseAssetDelta;
      }
      /**
       * Extract the floating-point price from an encoded order ID.
       *
       * Internally uses {@link PerpetualsOrderUtils.price} and converts the fixed-point
       * {@link PerpetualsOrderPrice} into a `number`.
       *
       * @param inputs.orderId - Encoded order ID.
       * @returns Price as a `number`.
       */
      static orderPriceFromOrderId(inputs) {
        const { orderId } = inputs;
        const orderPrice = PerpetualsOrderUtils.price(orderId);
        return _Perpetuals2.orderPriceToPrice({ orderPrice });
      }
      /**
       * Convert a fixed-point lot/tick size (9 decimals) to a `number`.
       *
       * @param lotOrTickSize - Fixed-point size as `bigint`.
       * @returns Floating-point size.
       */
      static lotOrTickSizeToNumber(lotOrTickSize) {
        return Number(lotOrTickSize) / FixedUtils.fixedOneN9;
      }
      /**
       * Convert a floating-point lot/tick size to its fixed-point representation (9 decimals).
       *
       * @param lotOrTickSize - Floating-point size.
       * @returns Fixed-point size as `bigint`.
       */
      static lotOrTickSizeToBigInt(lotOrTickSize) {
        return BigInt(Math.round(lotOrTickSize * FixedUtils.fixedOneN9));
      }
      // =========================================================================
      //  Websocket
      // =========================================================================
      /**
       * Open the main updates websocket: `/perpetuals/ws/updates`.
       *
       * The stream emits {@link PerpetualsWsUpdatesResponseMessage} envelopes and supports
       * multiple subscription types. This method returns a small controller with
       * convenience subscribe/unsubscribe functions.
       *
       * Subscription types supported by the controller:
       * - `market`: market state updates
       * - `user`: user account updates (optionally including stop orders)
       * - `oracle`: oracle price updates
       * - `orderbook`: orderbook deltas
       * - `marketOrders`: public market trades/orders
       * - `userOrders`: user trade/order events
       * - `userCollateralChanges`: user collateral change events
       * - `topOfOrderbook`: bucketed orderbook snapshots (top of orderbook)
       *
       * @param args.onMessage - Handler for parsed messages from the websocket.
       * @param args.onOpen - Optional handler for the `open` event.
       * @param args.onError - Optional handler for the `error` event.
       * @param args.onClose - Optional handler for the `close` event.
       *
       * @returns A controller object containing:
       * - `ws`: underlying {@link WebSocket}
       * - subscribe/unsubscribe helpers for each subscription type
       * - `close()`: closes the websocket
       */
      openUpdatesWebsocketStream(args) {
        const { onMessage, onOpen, onError, onClose } = args;
        const ctl = this.openWsStream({
          path: "ws/updates",
          onMessage,
          onOpen,
          onError,
          onClose
        });
        const subscribeMarket = ({ marketId }) => ctl.send({
          action: "subscribe",
          subscriptionType: { market: { marketId } }
        });
        const unsubscribeMarket = ({
          marketId
        }) => ctl.send({
          action: "unsubscribe",
          subscriptionType: { market: { marketId } }
        });
        const subscribeUser = ({
          accountId,
          withStopOrders
        }) => ctl.send({
          action: "subscribe",
          subscriptionType: { user: { accountId, withStopOrders } }
        });
        const unsubscribeUser = ({
          accountId,
          withStopOrders
        }) => ctl.send({
          action: "unsubscribe",
          subscriptionType: { user: { accountId, withStopOrders } }
        });
        const subscribeOracle = ({ marketId }) => ctl.send({
          action: "subscribe",
          subscriptionType: { oracle: { marketId } }
        });
        const unsubscribeOracle = ({
          marketId
        }) => ctl.send({
          action: "unsubscribe",
          subscriptionType: { oracle: { marketId } }
        });
        const subscribeOrderbook = ({
          marketId
        }) => ctl.send({
          action: "subscribe",
          subscriptionType: { orderbook: { marketId } }
        });
        const unsubscribeOrderbook = ({
          marketId
        }) => ctl.send({
          action: "unsubscribe",
          subscriptionType: { orderbook: { marketId } }
        });
        const subscribeMarketOrders = ({
          marketId
        }) => ctl.send({
          action: "subscribe",
          subscriptionType: { marketOrders: { marketId } }
        });
        const unsubscribeMarketOrders = ({
          marketId
        }) => ctl.send({
          action: "unsubscribe",
          subscriptionType: { marketOrders: { marketId } }
        });
        const subscribeUserOrders = ({
          accountId
        }) => ctl.send({
          action: "subscribe",
          subscriptionType: { userOrders: { accountId } }
        });
        const unsubscribeUserOrders = ({
          accountId
        }) => ctl.send({
          action: "unsubscribe",
          subscriptionType: { userOrders: { accountId } }
        });
        const subscribeUserCollateralChanges = ({
          accountId
        }) => ctl.send({
          action: "subscribe",
          subscriptionType: { userCollateralChanges: { accountId } }
        });
        const unsubscribeUserCollateralChanges = ({
          accountId
        }) => ctl.send({
          action: "unsubscribe",
          subscriptionType: { userCollateralChanges: { accountId } }
        });
        const subscribeTopOfOrderbook = ({
          marketId,
          priceBucketSize,
          bucketsNumber
        }) => ctl.send({
          action: "subscribe",
          subscriptionType: {
            topOfOrderbook: {
              marketId,
              priceBucketSize,
              bucketsNumber
            }
          }
        });
        const unsubscribeTopOfOrderbook = ({
          marketId,
          priceBucketSize,
          bucketsNumber
        }) => ctl.send({
          action: "unsubscribe",
          subscriptionType: {
            topOfOrderbook: {
              marketId,
              priceBucketSize,
              bucketsNumber
            }
          }
        });
        return {
          ws: ctl.ws,
          subscribeMarket,
          unsubscribeMarket,
          subscribeUser,
          unsubscribeUser,
          subscribeOracle,
          unsubscribeOracle,
          subscribeOrderbook,
          unsubscribeOrderbook,
          subscribeMarketOrders,
          unsubscribeMarketOrders,
          subscribeUserOrders,
          unsubscribeUserOrders,
          subscribeUserCollateralChanges,
          unsubscribeUserCollateralChanges,
          subscribeTopOfOrderbook,
          unsubscribeTopOfOrderbook,
          close: ctl.close
        };
      }
      /**
       * Open a market-candles websocket stream for a single market/interval:
       * `/perpetuals/ws/market-candles/{market_id}/{interval_ms}`.
       *
       * The stream emits {@link PerpetualsWsCandleResponseMessage} messages,
       * typically containing the latest candle for the specified interval.
       *
       * @param args.marketId - Market ID to subscribe to.
       * @param args.intervalMs - Candle interval in milliseconds.
       * @param args.onMessage - Handler for incoming candle updates.
       * @param args.onOpen - Optional hook called when the websocket opens.
       * @param args.onError - Optional hook called on websocket error.
       * @param args.onClose - Optional hook called when the websocket closes.
       *
       * @returns A controller containing the raw websocket and a `close()` helper.
       *
       * @example
       * ```ts
       * const stream = perps.openMarketCandlesWebsocketStream({
       *   marketId: "0x...",
       *   intervalMs: 60_000,
       *   onMessage: ({ lastCandle }) => console.log(lastCandle),
       * });
       * ```
       */
      openMarketCandlesWebsocketStream(args) {
        const { marketId, intervalMs, onMessage, onOpen, onError, onClose } = args;
        const path = `ws/market-candles/${encodeURIComponent(
          marketId
        )}/${intervalMs}`;
        const ctl = this.openWsStream(
          {
            path,
            onMessage,
            onOpen,
            onError,
            onClose
          }
        );
        return {
          ws: ctl.ws,
          close: ctl.close
        };
      }
    };
    _Perpetuals.OrderUtils = PerpetualsOrderUtils;
    _Perpetuals.priceToOrderPrice = (inputs) => {
      const { price } = inputs;
      return BigInt(Math.round(price * FixedUtils.fixedOneN9));
    };
    _Perpetuals.orderPriceToPrice = (inputs) => {
      const { orderPrice } = inputs;
      return Number(orderPrice) / FixedUtils.fixedOneN9;
    };
    _Perpetuals.orderIdToSide = (orderId) => {
      return _Perpetuals.OrderUtils.isAsk(orderId) ? 1 : 0;
    };
    _Perpetuals.eventTypeForCollateral = (inputs) => {
      return `${inputs.eventType}<${inputs.collateralCoinType}>`;
    };
    Perpetuals = _Perpetuals;
  }
});
var init_perpetuals2 = __esm({
  "src/packages/perpetuals/index.ts"() {
    "use strict";
    init_perpetuals();
    init_perpetualsAccount();
    init_perpetualsMarket();
    init_perpetualsVault();
  }
});
var ReferralVault;
var init_referralVault = __esm({
  "src/packages/referralVault/referralVault.ts"() {
    "use strict";
    init_caller();
    ReferralVault = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new instance of `ReferralVault` to interact with referral-related
       * features in the Aftermath protocol.
       *
       * @deprecated Use `Referral` class instead
       * @param config - Optional caller configuration, including Sui network and access token.
       * @param api - An optional `AftermathApi` provider instance for referral-specific methods.
       */
      constructor(config) {
        super(config, "referral-vault");
      }
      // =========================================================================
      //  Inspections
      // =========================================================================
      /**
       * Retrieves the referrer address for a specified referee (user).
       *
       * @deprecated Use `Referral` class instead
       * @param inputs - An object containing the `referee` Sui address.
       * @returns A promise that resolves to either the referrer's `SuiAddress` or the string `"None"` if no referrer exists.
       *
       * @example
       * ```typescript
       * const afSdk = await Aftermath.create({ network: "MAINNET" });
       *
       * const referralVault = afSdk.ReferralVault();
       *
       * const referrer = await referralVault.getReferrer({ referee: "0x<user_address>" });
       * console.log("Referrer address:", referrer);
       * ```
       */
      async getReferrer(inputs) {
        return this.fetchApi(`${inputs.referee}/referrer`);
      }
    };
    ReferralVault.constants = {};
  }
});
var init_referralVault2 = __esm({
  "src/packages/referralVault/index.ts"() {
    "use strict";
    init_referralVault();
  }
});
var Router;
var init_router = __esm({
  "src/packages/router/router.ts"() {
    "use strict";
    init_caller();
    Router = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new `Router` instance to perform router-related calls on the
       * Aftermath platform.
       *
       * @param config - Optional configuration settings, including network and access token.
       * @returns A new `Router` instance.
       *
       * @example
       * ```typescript
       * const afSdk = await Aftermath.create({ network: "MAINNET" });
       *
       * const router = afSdk.Router();
       * ```
       */
      constructor(config) {
        super(config, "router");
        this.getVolume24hrs = async () => {
          return this.fetchApi("volume-24hrs");
        };
      }
      /**
       * Fetches a list of all coin types that are supported for trading through the router.
       *
       * @returns A promise that resolves to an array of coin types (`CoinType[]`).
       *
       * @example
       * ```typescript
       * const supportedCoins = await router.getSupportedCoins();
       * console.log(supportedCoins); // ["0x2::sui::SUI", "0x<...>::coin::TOKEN", ...]
       * ```
       */
      async getSupportedCoins() {
        return this.fetchApi("supported-coins");
      }
      /**
       * Searches the supported coins by applying a filter string.
       *
       * @param inputs - An object containing a `filter` string to match against supported coins.
       * @param abortSignal - An optional `AbortSignal` to cancel the request if needed.
       * @returns A promise that resolves to an array of coin types matching the filter.
       *
       * @example
       * ```typescript
       * const searchResult = await router.searchSupportedCoins({ filter: "SUI" });
       * console.log(searchResult); // e.g. ["0x2::sui::SUI"]
       * ```
       */
      async searchSupportedCoins(inputs, abortSignal) {
        return this.fetchApi(
          `supported-coins/${inputs.filter}`,
          void 0,
          abortSignal
        );
      }
      /**
       * Creates an optimal trade route for a given token input (`coinInType`) with a
       * specified input amount (`coinInAmount`). This route may consist of multiple
       * swaps across different DEX protocols to achieve the best price.
       *
       * @param inputs - Details required to construct the trade route, including `coinInType`, `coinOutType`, and `coinInAmount`.
       * @param abortSignal - An optional signal to abort the request if needed.
       * @returns A promise resolving to a `RouterCompleteTradeRoute` object containing the full route details.
       *
       * @example
       * ```typescript
       * const route = await router.getCompleteTradeRouteGivenAmountIn({
       *   coinInType: "0x2::sui::SUI",
       *   coinOutType: "0x<...>::coin::TOKEN",
       *   coinInAmount: BigInt(10_000_000_000),
       *   // optional fields:
       *   referrer: "0x<referrer_address>",
       *   externalFee: {
       *     recipient: "0x<fee_collector>",
       *     feePercentage: 0.01
       *   },
       *   protocolBlacklist: ["Cetus", "BlueMove"],
       *   poolBlacklist: ["0x<pool_id>"]
       * });
       * console.log(route);
       * ```
       */
      async getCompleteTradeRouteGivenAmountIn(inputs, abortSignal) {
        return this.fetchApi("trade-route", inputs, abortSignal);
      }
      /**
       * Creates an optimal trade route for a given token output (`coinOutType`) with a
       * specified output amount (`coinOutAmount`). This route may consist of multiple
       * swaps to achieve the target output amount, factoring in slippage.
       *
       * @param inputs - Details required to construct the trade route, including `coinInType`, `coinOutType`, `coinOutAmount`, and `slippage`.
       * @param abortSignal - An optional signal to abort the request if needed.
       * @returns A promise resolving to a `RouterCompleteTradeRoute` object containing the full route details.
       *
       * @example
       * ```typescript
       * const route = await router.getCompleteTradeRouteGivenAmountOut({
       *   coinInType: "0x2::sui::SUI",
       *   coinOutType: "0x<...>::coin::TOKEN",
       *   coinOutAmount: BigInt(20_000_000),
       *   slippage: 0.01, // 1%
       *   protocolWhitelist: ["Aftermath", "Cetus"],
       *   poolWhitelist: ["0x<pool_id>"]
       * });
       * console.log(route);
       * ```
       */
      async getCompleteTradeRouteGivenAmountOut(inputs, abortSignal) {
        return this.fetchApi("trade-route", inputs, abortSignal);
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      /**
       * Generates a transaction to execute a previously calculated complete trade route.
       * This transaction can then be signed and executed by the user.
       *
       * @param inputs - An object containing the wallet address, the complete trade route, slippage tolerance, and optional sponsorship settings.
       * @returns A promise resolving to a `Uint8Array` representing the serialized transaction.
       *
       * @example
       * ```typescript
       * const route = await router.getCompleteTradeRouteGivenAmountIn({ ... });
       * const transactionBytes = await router.getTransactionForCompleteTradeRoute({
       *   walletAddress: "0x<your_address>",
       *   completeRoute: route,
       *   slippage: 0.01
       * });
       * // The returned bytes can now be signed and executed using your chosen wallet.
       * ```
       */
      async getTransactionForCompleteTradeRoute(inputs) {
        return this.fetchApiTransaction(
          "transactions/trade",
          inputs
        );
      }
      /**
       * Adds a trade route to an existing transaction, allowing you to build complex
       * transactions containing multiple actions (swaps, transfers, etc.) in a single
       * atomic transaction.
       *
       * @param inputs - Includes the existing `Transaction`, a complete route, slippage, wallet address, and an optional `coinInId`.
       * @returns An object containing:
       *  - `tx`: The updated `Transaction` including the route instructions
       *  - `coinOutId`: A `TransactionObjectArgument` referencing the output coin after the swap
       *
       * @example
       * ```typescript
       * // 1) Create a route
       * const route = await router.getCompleteTradeRouteGivenAmountIn({ ... });
       *
       * // 2) Initialize your transaction
       * const tx = new Transaction();
       *
       * // 3) Add router instructions
       * const { tx: updatedTx, coinOutId } =
       *   await router.addTransactionForCompleteTradeRoute({
       *     tx,
       *     completeRoute: route,
       *     slippage: 0.01,
       *     walletAddress: "0x<your_address>"
       * });
       *
       * // 4) Continue building your transaction with the resulting coinOutId, if desired
       * updatedTx.transferObjects([coinOutId!], "0x<your_address>");
       * ```
       */
      async addTransactionForCompleteTradeRoute(inputs) {
        const { tx, ...otherInputs } = inputs;
        const { tx: newTx, coinOutId } = await this.fetchApi("transactions/add-trade", {
          ...otherInputs,
          serializedTx: tx.serialize()
        });
        return {
          tx: Transaction6.from(newTx),
          coinOutId
        };
      }
      // =========================================================================
      //  Events
      // =========================================================================
      /**
       * Retrieves trade events (interactions) for a given user based on router usage.
       *
       * @param inputs - Includes a `walletAddress`, cursor pagination, and limit.
       * @returns A promise resolving to the user's `RouterTradeEvent`s, potentially paginated.
       *
       * @example
       * ```typescript
       * const events = await router.getInteractionEvents({
       *   walletAddress: "0x<your_address>",
       *   cursor: 0,
       *   limit: 10
       * });
       * console.log(events);
       * ```
       */
      async getInteractionEvents(inputs) {
        return this.fetchApiIndexerEvents("events-by-user", inputs);
      }
    };
    Router.constants = {
      /**
       * The maximum external fee percentage that a third party can charge on router trades.
       * @remarks 0.5 = 50%
       */
      maxExternalFeePercentage: 0.5
    };
  }
});
var init_router2 = __esm({
  "src/packages/router/index.ts"() {
    "use strict";
    init_router();
  }
});
var Staking;
var init_staking = __esm({
  "src/packages/staking/staking.ts"() {
    "use strict";
    init_utils();
    init_caller();
    Staking = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new instance of the `Staking` class for interacting with Aftermath
       * staking contracts.
       *
       * @param config - Optional configuration containing the Sui network and/or access token.
       * @param api - Optional instance of `AftermathApi` for building transactions.
       */
      constructor(config, api) {
        super(config, "staking");
        this.api = api;
        this.stakingApi = () => {
          const staking = this.api?.Staking();
          if (!staking) {
            throw new Error("missing AftermathApi instance");
          }
          return staking;
        };
      }
      // =========================================================================
      //  Objects
      // =========================================================================
      /**
       * Fetches the list of currently active validators on the Sui network.
       *
       * @returns A promise that resolves to an array of `SuiValidatorSummary` objects,
       * each describing a validator's on-chain metadata.
       *
       * @example
       * ```typescript
       * const validators = await staking.getActiveValidators();
       * console.log(validators);
       * ```
       */
      async getActiveValidators() {
        return this.fetchApi("active-validators");
      }
      /**
       * Fetches the current APYs for all validators, aggregated by the indexer.
       *
       * @returns A promise that resolves to a `ValidatorsApy` object, containing
       * APY data indexed by validator addresses.
       *
       * @example
       * ```typescript
       * const validatorApys = await staking.getValidatorApys();
       * console.log(validatorApys);
       * ```
       */
      async getValidatorApys() {
        return this.fetchApi("validator-apys");
      }
      /**
       * Fetches the configuration details for each validator, including fees and
       * operation caps.
       *
       * @returns A promise that resolves to an array of `ValidatorConfigObject`s.
       *
       * @example
       * ```typescript
       * const configs = await staking.getValidatorConfigs();
       * console.log(configs);
       * ```
       */
      async getValidatorConfigs() {
        return this.fetchApi("validator-configs");
      }
      /**
       * Retrieves a list of staking positions for the specified account.
       *
       * @param inputs - Contains the `walletAddress` to query, plus optional cursor
       * and limit for pagination.
       * @returns A promise that resolves to an array of `StakingPosition` objects
       * reflecting the user's active or pending stakes.
       *
       * @example
       * ```typescript
       * const positions = await staking.getStakingPositions({
       *   walletAddress: "0x...",
       *   cursor: 0,
       *   limit: 10
       * });
       * console.log(positions);
       * ```
       */
      async getStakingPositions(inputs) {
        return this.fetchApi("staking-positions", inputs);
      }
      /**
       * Fetches all delegated stakes for a specific wallet address. Delegated
       * stakes typically represent user funds staked to one or more validators.
       *
       * @param inputs - Contains the `walletAddress` for which to fetch delegated stakes.
       * @returns A promise resolving to an array of `SuiDelegatedStake` objects.
       *
       * @example
       * ```typescript
       * const delegatedStakes = await staking.getDelegatedStakes({
       *   walletAddress: "0x..."
       * });
       * console.log(delegatedStakes);
       * ```
       */
      async getDelegatedStakes(inputs) {
        return this.fetchApi("delegated-stakes", inputs);
      }
      /**
       * Retrieves validator operation caps for a specified address. Operation caps
       * typically govern who is authorized to adjust validator fees and settings.
       *
       * @param inputs - Contains the `walletAddress` for which to fetch validator
       * operation caps, plus optional pagination.
       * @returns A promise resolving to an array of `ValidatorOperationCapObject`s.
       *
       * @example
       * ```typescript
       * const caps = await staking.getValidatorOperationCaps({
       *   walletAddress: "0x...",
       *   cursor: 0,
       *   limit: 5
       * });
       * console.log(caps);
       * ```
       */
      async getValidatorOperationCaps(inputs) {
        return this.fetchApi("validator-operation-caps", inputs);
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      /**
       * Builds or fetches a staking transaction object, which can then be signed
       * and submitted to the network.
       *
       * @param inputs - Includes the `walletAddress`, the amount of SUI to stake, and
       * the validator address to stake with. Optionally includes a `referrer`, `externalFee`,
       * and a sponsored transaction flag.
       * @returns A promise resolving to a transaction that can be signed and executed.
       *
       * @example
       * ```typescript
       * const stakeTx = await staking.getStakeTransaction({
       *   walletAddress: "0x...",
       *   suiStakeAmount: BigInt("1000000000"), // 1 SUI
       *   validatorAddress: "0x..."
       * });
       * // sign and execute this transaction using your preferred Sui wallet
       * ```
       */
      async getStakeTransaction(inputs) {
        return this.stakingApi().fetchBuildStakeTx(inputs);
      }
      /**
       * Builds or fetches an unstaking transaction object, allowing a user to
       * convert their afSUI back into SUI (either atomically or via partial
       * liquidity).
       *
       * @param inputs - Contains the `walletAddress`, the afSUI amount to unstake,
       * and whether it's an atomic operation. Optionally includes a `referrer`,
       * `externalFee`, and a sponsored transaction flag.
       * @returns A promise resolving to a transaction that can be signed and executed.
       *
       * @example
       * ```typescript
       * const unstakeTx = await staking.getUnstakeTransaction({
       *   walletAddress: "0x...",
       *   afSuiUnstakeAmount: BigInt("1000000000"), // 1 afSUI
       *   isAtomic: true
       * });
       * // sign and execute this transaction to receive SUI
       * ```
       */
      async getUnstakeTransaction(inputs) {
        return this.stakingApi().fetchBuildUnstakeTx(inputs);
      }
      /**
       * Builds or fetches a transaction to stake an existing stakedSUI object
       * (e.g., re-staking funds that were already staked under a different
       * validator).
       *
       * @param inputs - Contains the `walletAddress`, an array of `stakedSuiIds`
       * to be re-staked, and the new `validatorAddress`. Optionally includes
       * a `referrer` and a sponsored transaction flag.
       * @returns A promise resolving to a transaction object that can be signed
       * and executed.
       *
       * @example
       * ```typescript
       * const stakeStakedTx = await staking.getStakeStakedSuiTransaction({
       *   walletAddress: "0x...",
       *   stakedSuiIds: ["0x<stakedSuiId1>", "0x<stakedSuiId2>"],
       *   validatorAddress: "0x..."
       * });
       * // sign and execute this transaction
       * ```
       */
      async getStakeStakedSuiTransaction(inputs) {
        return this.stakingApi().fetchBuildStakeStakedSuiTx(inputs);
      }
      /**
       * Builds or fetches a transaction to update the validator fee for a
       * validator in which the user has operation cap privileges.
       *
       * @param inputs - Contains the `walletAddress`, `validatorOperationCapId`,
       * and `newFeePercentage`. Optionally includes a sponsored transaction flag.
       * @returns A transaction object that can be signed and executed to
       * update the validator's fee on-chain.
       *
       * @example
       * ```typescript
       * const updateFeeTx = await staking.getUpdateValidatorFeeTransaction({
       *   walletAddress: "0x...",
       *   validatorOperationCapId: "0x...",
       *   newFeePercentage: 0.01,
       *   isSponsoredTx: false
       * });
       * // sign and execute to update the validator fee
       * ```
       */
      getUpdateValidatorFeeTransaction(inputs) {
        return this.stakingApi().buildUpdateValidatorFeeTx(inputs);
      }
      /**
       * Builds a "crank" transaction to update the epoch for afSUI. This can
       * trigger certain internal processes within the Aftermath protocol,
       * such as distributing rewards or rebalancing.
       *
       * @param inputs - Contains the `walletAddress` to sign the transaction.
       * @returns A transaction object that can be signed and submitted to
       * trigger an epoch update.
       *
       * @example
       * ```typescript
       * const crankTx = await staking.getCrankAfSuiTransaction({
       *   walletAddress: "0x..."
       * });
       * // sign and execute transaction
       * ```
       */
      getCrankAfSuiTransaction(inputs) {
        return this.stakingApi().buildEpochWasChangedTx(inputs);
      }
      // =========================================================================
      //  Inspections
      // =========================================================================
      /**
       * Retrieves the total value locked (TVL) in SUI across the Aftermath
       * staking systems.
       *
       * @returns A promise that resolves to a `Balance` representing the total
       * staked SUI in the protocol.
       *
       * @example
       * ```typescript
       * const tvl = await staking.getSuiTvl();
       * console.log("Total value locked in SUI:", tvl);
       * ```
       */
      async getSuiTvl() {
        return this.fetchApi("sui-tvl");
      }
      /**
       * Retrieves the current exchange rate between afSUI and SUI. This rate
       * is used to determine how much SUI a single afSUI token is worth.
       *
       * @returns A promise that resolves to a `number` representing the
       * afSUI-to-SUI rate.
       *
       * @example
       * ```typescript
       * const rate = await staking.getAfSuiToSuiExchangeRate();
       * console.log("1 afSUI =", rate, "SUI");
       * ```
       */
      async getAfSuiToSuiExchangeRate() {
        return this.fetchApi("afsui-exchange-rate");
      }
      /**
       * Retrieves the stakedSui vault state from the protocol, which holds
       * important values for calculating fees, reserves, and total active
       * stake.
       *
       * @returns A promise that resolves to a `StakedSuiVaultStateObject`,
       * containing details like atomic unstake reserves, fees, and total SUI.
       *
       * @example
       * ```typescript
       * const vaultState = await staking.getStakedSuiVaultState();
       * console.log("Vault State:", vaultState);
       * ```
       */
      async getStakedSuiVaultState() {
        return this.fetchApi("staked-sui-vault-state");
      }
      /**
       * Retrieves the current APY (Annual Percentage Yield) for staking SUI
       * through Aftermath.
       *
       * @returns A promise that resolves to a `number` representing the APY.
       *
       * @example
       * ```typescript
       * const apy = await staking.getApy();
       * console.log("Current staking APY:", apy);
       * ```
       */
      async getApy() {
        return this.fetchApi("apy");
      }
      /**
       * Retrieves historical APY data points over a specified timeframe.
       *
       * @param inputs - Contains a `timeframe` key, such as `"1W"`, `"1M"`, `"1Y"`, etc.
       * @returns A promise resolving to an array of `StakingApyDataPoint` objects,
       * each containing a timestamp and an APY value.
       *
       * @example
       * ```typescript
       * const historicalApy = await staking.getHistoricalApy({ timeframe: "1M" });
       * console.log(historicalApy); // e.g. [{ timestamp: 1686000000, apy: 0.045 }, ...]
       * ```
       */
      async getHistoricalApy(inputs) {
        return this.fetchApi("historical-apy", inputs);
      }
      // =========================================================================
      //  Public Static Methods
      // =========================================================================
      // =========================================================================
      //  Calculations
      // =========================================================================
      /**
       * Calculates the atomic unstake fee based on the current vault state. If
       * the `atomicUnstakeSuiReserves` remain above the target, the minimum fee
       * applies; otherwise, the fee adjusts proportionally up to the maximum
       * possible fee.
       *
       * @param inputs - Contains the `stakedSuiVaultState`, which holds data on
       * liquidity reserves, target values, and min/max fees.
       * @returns A `Percentage` representing the resulting fee (0.01 = 1%).
       *
       * @example
       * ```typescript
       * const vaultState = await staking.getStakedSuiVaultState();
       * const fee = Staking.calcAtomicUnstakeFee({ stakedSuiVaultState: vaultState });
       * console.log("Current atomic unstake fee:", fee);
       * ```
       */
      static calcAtomicUnstakeFee(inputs) {
        const { stakedSuiVaultState } = inputs;
        if (stakedSuiVaultState.atomicUnstakeSuiReserves >= stakedSuiVaultState.atomicUnstakeSuiReservesTargetValue) {
          return Casting.bigIntToFixedNumber(
            stakedSuiVaultState.minAtomicUnstakeFee
          );
        }
        const atomicFeeDelta = stakedSuiVaultState.maxAtomicUnstakeFee - stakedSuiVaultState.minAtomicUnstakeFee;
        return Casting.bigIntToFixedNumber(
          stakedSuiVaultState.maxAtomicUnstakeFee - atomicFeeDelta * stakedSuiVaultState.atomicUnstakeSuiReserves / stakedSuiVaultState.atomicUnstakeSuiReservesTargetValue
        );
      }
    };
    Staking.constants = {
      /**
       * Configuration for fees related to staking and unstaking operations.
       */
      fees: {
        /**
         * Protocol unstake fee (5%).
         */
        protocolUnstake: 0.05,
        /**
         * Default validator fee (0%).
         */
        defaultValidator: 0,
        /**
         * Maximum validator fee (5%).
         */
        maxValidator: 0.05
      },
      /**
       * Configuration for minimum stake/unstake amounts, and maximum external fee
       * percentage allowed.
       */
      bounds: {
        /**
         * Minimum SUI that can be staked. 1 SUI = 10^9 MIST.
         */
        minStake: BigInt("1000000000"),
        // 1 SUI
        /**
         * Minimum afSUI that can be unstaked. 1 afSUI = 10^9 MIST (mirroring SUI decimals).
         */
        minUnstake: BigInt("1000000000"),
        // 1 afSUI
        /**
         * Maximum external fee percentage that third parties can add on top
         * of protocol fees for staking or unstaking transactions.
         * @remarks 0.5 = 50%
         */
        maxExternalFeePercentage: 0.5
      },
      /**
       * The default validator fee (0%).
       */
      defaultValidatorFee: 0
    };
  }
});
var init_staking2 = __esm({
  "src/packages/staking/index.ts"() {
    "use strict";
    init_staking();
  }
});
var Sui;
var init_sui = __esm({
  "src/packages/sui/sui.ts"() {
    "use strict";
    init_caller();
    Sui = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new instance of the `Sui` class for fetching chain-level info.
       *
       * @param config - Optional configuration, including the Sui network and an access token.
       * @param api - An optional `AftermathApi` instance for advanced transaction building or data fetching.
       */
      constructor(config, api) {
        super(config, "sui");
        this.api = api;
      }
      // =========================================================================
      //  Chain Info
      // =========================================================================
      /**
       * Fetches the Sui system state summary object, which contains details
       * about the current epoch, validator set, and other protocol-level data.
       *
       * @returns A promise that resolves to a `SuiSystemStateSummary` instance.
       *
       * @example
       * ```typescript
       * const afSdk = await Aftermath.create({ network: "MAINNET" });
       *
       * const sui = afSdk.Sui();
       *
       * const systemState = await sui.getSystemState();
       * console.log(systemState.epoch, systemState.validators);
       * ```
       */
      async getSystemState() {
        return this.fetchApi("system-state");
      }
    };
    Sui.constants = {
      addresses: {
        zero: "0x0000000000000000000000000000000000000000000000000000000000000000",
        suiPackageId: "0x0000000000000000000000000000000000000000000000000000000000000002",
        suiSystemStateId: "0x0000000000000000000000000000000000000000000000000000000000000005",
        suiClockId: "0x0000000000000000000000000000000000000000000000000000000000000006"
      }
    };
  }
});
var init_sui2 = __esm({
  "src/packages/sui/index.ts"() {
    "use strict";
    init_sui();
  }
});
var SuiFren;
var init_suiFren = __esm({
  "src/packages/suiFrens/suiFren.ts"() {
    "use strict";
    init_caller();
    init_packages();
    SuiFren = class _SuiFren extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(suiFren, config, isStaked = false, isOwned = false, api) {
        super(config, "sui-frens");
        this.suiFren = suiFren;
        this.isStaked = isStaked;
        this.isOwned = isOwned;
        this.api = api;
        this.suiFrensApi = () => {
          const suiFrens = this.api?.SuiFrens();
          if (!suiFrens) {
            throw new Error("missing AftermathApi instance");
          }
          return suiFrens;
        };
      }
      // =========================================================================
      //  Getters
      // =========================================================================
      suiFrenType() {
        return Coin.getInnerCoinType(this.suiFren.objectType);
      }
      properties() {
        return {
          Skin: this.suiFren.attributes.skin,
          Ears: this.suiFren.attributes.ears,
          Expression: this.suiFren.attributes.expression,
          "Main Color": this.suiFren.attributes.main,
          "Secondary Color": this.suiFren.attributes.secondary,
          "Birth Location": this.suiFren.birthLocation,
          Birthday: format(this.suiFren.birthdate, "MMMM d, yyyy"),
          Cohort: this.suiFren.cohort.toString(),
          Generation: this.suiFren.generation.toString()
          // Genes: this.suiFren.genes.toString(),
        };
      }
      dynamicFields() {
        return {
          ...this.suiFren.mixLimit ? {
            "Mixes Remaining": this.suiFren.mixLimit.toString()
          } : {},
          ...this.suiFren.lastEpochMixed ? {
            "Last Epoch Mixed": this.suiFren.lastEpochMixed.toString()
          } : {}
        };
      }
      displayNumber() {
        return this.suiFren.objectId.slice(-5, -1).toUpperCase();
      }
      clone() {
        return new _SuiFren(this.suiFren, this.config, this.isStaked, this.isOwned);
      }
      // public asNft(): Nft {
      // 	return {
      // 		info: {
      // 			objectId: this.suiFren.objectId,
      // 			objectType: this.suiFren.objectType,
      // 		},
      // 		display: {
      // 			suggested: {
      // 				name: "SuiFren",
      // 				...this.suiFren.display,
      // 			},
      // 			other: {
      // 				Skin: this.suiFren.attributes.skin,
      // 				Ears: this.suiFren.attributes.ears,
      // 				Expression: this.suiFren.attributes.expression,
      // 				"Main Color": this.suiFren.attributes.main,
      // 				"Secondary Color": this.suiFren.attributes.secondary,
      // 				"Birth Location": this.suiFren.birthLocation,
      // 				Birthday: dayjs(this.suiFren.birthdate).format(
      // 					"MMMM D, YYYY"
      // 				),
      // 				Cohort: this.suiFren.cohort.toString(),
      // 				Generation: this.suiFren.generation.toString(),
      // 				...(this.suiFren.mixLimit
      // 					? {
      // 							"Mixes Remaining":
      // 								this.suiFren.mixLimit.toString(),
      // 					  }
      // 					: {}),
      // 				...(this.suiFren.lastEpochMixed
      // 					? {
      // 							"Last Epoch Mixed":
      // 								this.suiFren.lastEpochMixed.toString(),
      // 					  }
      // 					: {}),
      // 				// Genes: this.suiFren.genes.toString(),
      // 			},
      // 		},
      // 	};
      // }
      // =========================================================================
      //  Objects
      // =========================================================================
      async getAccessories() {
        return this.fetchApi("accessories", {
          suiFrenId: this.suiFren.objectId
        });
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      async getStakeTransaction(inputs) {
        if (this.isStaked)
          throw new Error("unable to stake already staked suiFren");
        return this.suiFrensApi().fetchStakeTx({
          ...inputs,
          suiFrenType: this.suiFrenType(),
          suiFrenId: this.suiFren.objectId
        });
      }
      async getAddAccessoryTransaction(inputs) {
        return this.suiFrensApi().fetchBuildAddAccessoryTx({
          ...inputs,
          isOwned: this.isOwned,
          suiFrenType: this.suiFrenType(),
          suiFrenId: this.suiFren.objectId
        });
      }
      async getRemoveAccessoryTransaction(inputs) {
        if (!this.isOwned)
          throw new Error(
            "unable to remove accessory from suiFren that is not owned by caller"
          );
        return this.suiFrensApi().fetchBuildRemoveAccessoryTx({
          ...inputs,
          suiFrenType: this.suiFrenType(),
          suiFrenId: this.suiFren.objectId
        });
      }
    };
  }
});
var StakedSuiFren;
var init_stakedSuiFren = __esm({
  "src/packages/suiFrens/stakedSuiFren.ts"() {
    "use strict";
    init_caller();
    init_suiFren();
    StakedSuiFren = class _StakedSuiFren extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(info, config, isOwned = false, api) {
        super(config, "sui-frens");
        this.info = info;
        this.isOwned = isOwned;
        this.api = api;
        this.suiFrensApi = () => {
          const suiFrens = this.api?.SuiFrens();
          if (!suiFrens) {
            throw new Error("missing AftermathApi instance");
          }
          return suiFrens;
        };
        this.suiFren = new SuiFren(info.suiFren, this.config, true, isOwned);
      }
      // =========================================================================
      //  Getters
      // =========================================================================
      mixFee() {
        return this.info.metadata.mixFee;
      }
      suiFrenId() {
        return this.suiFren.suiFren.objectId;
      }
      clone() {
        return new _StakedSuiFren(this.info, this.config, this.isOwned, this.api);
      }
      // =========================================================================
      //  Objects
      // =========================================================================
      async getAccessories() {
        return this.suiFren.getAccessories();
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      async getUnstakeTransaction(inputs) {
        if (!this.info.position) {
          throw new Error("no position found on suiFren");
        }
        return this.suiFrensApi().fetchUnstakeTx({
          ...inputs,
          suiFrenType: this.suiFren.suiFrenType(),
          stakedPositionId: this.info.position.objectId
        });
      }
      async getHarvestFeesTransaction(inputs) {
        if (!this.info.position) {
          throw new Error("no position found on suiFren");
        }
        if (!this.isOwned) {
          throw new Error(
            "unable to remove accessory from suiFren that is not owned by caller"
          );
        }
        return this.suiFrensApi().fetchBuildHarvestFeesTx({
          ...inputs,
          stakedPositionIds: [this.info.position.objectId]
        });
      }
      async getAddAccessoryTransaction(inputs) {
        return this.suiFren.getAddAccessoryTransaction(inputs);
      }
      async getRemoveAccessoryTransaction(inputs) {
        if (!this.info.position) {
          throw new Error("no position found on suiFren");
        }
        if (!this.isOwned) {
          throw new Error(
            "unable to remove accessory from suiFren that is not owned by caller"
          );
        }
        return this.suiFrensApi().fetchBuildRemoveAccessoryTx({
          ...inputs,
          suiFrenType: this.suiFren.suiFrenType(),
          stakedPositionId: this.info.position.objectId
        });
      }
    };
  }
});
var _SuiFrens;
var SuiFrens;
var init_suiFrens = __esm({
  "src/packages/suiFrens/suiFrens.ts"() {
    "use strict";
    init_suiFren();
    init_stakedSuiFren();
    init_caller();
    init_coin2();
    init_utils();
    _SuiFrens = class _SuiFrens2 extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(config, api) {
        super(config, "sui-frens");
        this.api = api;
        this.suiFrensApi = () => {
          const suiFrens = this.api?.SuiFrens();
          if (!suiFrens) {
            throw new Error("missing AftermathApi instance");
          }
          return suiFrens;
        };
      }
      // =========================================================================
      //  Public Methods
      // =========================================================================
      // =========================================================================
      //  Calculations
      // =========================================================================
      static calcTotalInternalMixFee(inputs) {
        const { mixFee1, mixFee2 } = inputs;
        if (mixFee1 === void 0 && mixFee2 === void 0)
          return this.constants.protocolFees.mixOwned;
        if (mixFee1 !== void 0 && mixFee2 !== void 0) {
          return this.calcMixFeeForStakedSuiFren({ mixFee: mixFee1 }) + this.calcMixFeeForStakedSuiFren({ mixFee: mixFee2 });
        }
        return mixFee1 !== void 0 ? this.calcMixFeeForStakedSuiFren({ mixFee: mixFee1 }) : mixFee2 !== void 0 ? this.calcMixFeeForStakedSuiFren({ mixFee: mixFee2 }) : (() => {
          throw new Error("unreachable");
        })();
      }
      static calcMixFeeForStakedSuiFren(inputs) {
        const { mixFee } = inputs;
        return mixFee + Helpers.maxBigInt(
          this.constants.protocolFees.minMixStaked,
          mixFee / BigInt(
            Math.floor(this.constants.protocolFees.mixStakedPercentage * 100)
          )
        );
      }
      // =========================================================================
      //  Class Objects
      // =========================================================================
      async getSuiFren(inputs) {
        const suiFrens = await this.getSuiFrens({
          suiFrenObjectIds: [inputs.suiFrenObjectId]
        });
        return suiFrens[0];
      }
      async getSuiFrens(inputs) {
        const suiFrens = await this.fetchApi(
          `${JSON.stringify(inputs.suiFrenObjectIds)}`
        );
        return suiFrens.map((suiFren) => new SuiFren(suiFren, this.config));
      }
      async getOwnedSuiFrens(inputs) {
        const ownedSuiFrens = await this.fetchApi(`owned-sui-frens`, inputs);
        return ownedSuiFrens.map(
          (suiFren) => new SuiFren(suiFren, this.config, false, true)
        );
      }
      async getOwnedStakedSuiFrens(inputs) {
        const stakesInfo = await this.fetchApi(`owned-staked-sui-frens`, inputs);
        return stakesInfo.map((info) => new StakedSuiFren(info, this.config, true));
      }
      async getAllStakedSuiFrens(inputs) {
        const stakesInfoWithCursor = await this.fetchApi(
          `filtered-staked-sui-frens/${_SuiFrens2.createStakedSuiFrensQueryString(
            inputs
          )}`,
          inputs
        );
        const suiFrens = stakesInfoWithCursor.dynamicFieldObjects.map(
          (info) => new StakedSuiFren(info, this.config)
        );
        return {
          dynamicFieldObjects: suiFrens,
          nextCursor: stakesInfoWithCursor.nextCursor
        };
      }
      async getStakedSuiFrens(inputs) {
        const suiFrenInfos = await this.fetchApi(
          `staked-sui-frens/${JSON.stringify(inputs.stakedSuiFrenIds)}`
        );
        return suiFrenInfos.map((info) => new StakedSuiFren(info, this.config));
      }
      // =========================================================================
      //  Objects
      // =========================================================================
      async getCapyLabsApp() {
        return this.fetchApi(`capy-labs-app`);
      }
      async getOwnedAccessories(inputs) {
        return this.fetchApi("owned-accessories", inputs);
      }
      // =========================================================================
      //  Events
      // =========================================================================
      async getHarvestFeesEvents(inputs) {
        return this.fetchApiEvents(
          "events/harvest-fees",
          inputs
        );
      }
      async getMixEvents(inputs) {
        return this.fetchApiEvents("events/mix", inputs);
      }
      async getStakeEvents(inputs) {
        return this.fetchApiEvents("events/stake", inputs);
      }
      async getUnstakeEvents(inputs) {
        return this.fetchApiEvents("events/unstake", inputs);
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      async getMixTransaction(inputs) {
        return this.suiFrensApi().fetchBuildMixTx(inputs);
      }
      async getHarvestFeesTransaction(inputs) {
        return this.suiFrensApi().fetchBuildHarvestFeesTx(inputs);
      }
      // =========================================================================
      //  Inspections
      // =========================================================================
      async getStats() {
        return this.fetchApi("stats");
      }
      // =========================================================================
      //  Public Static Methods
      // =========================================================================
      // =========================================================================
      //  Helpers
      // =========================================================================
      static suiFren(suiFren) {
        return suiFren instanceof SuiFren ? suiFren : suiFren?.suiFren;
      }
      static suiFrenId(suiFren) {
        return suiFren?.suiFren instanceof SuiFren ? suiFren?.suiFren?.suiFren.objectId : suiFren?.suiFren?.objectId;
      }
      static mixFee(suiFren) {
        return suiFren instanceof StakedSuiFren ? suiFren?.mixFee() : void 0;
      }
      // =========================================================================
      //  Private Static Methods
      // =========================================================================
      // =========================================================================
      //  Helpers
      // =========================================================================
      static createStakedSuiFrensQueryString(inputs) {
        const { attributes, sortBy } = inputs;
        const startStr = sortBy ? `?sort=${sortBy}` : "";
        return Object.keys(attributes).length === 0 ? startStr : (startStr === "" ? "?" : startStr) + Object.entries(attributes).map(
          ([key, val], i) => `${i === 0 && startStr === "" ? "" : "&"}${key}=${val}`
        ).reduce((acc, curr) => acc + curr, "");
      }
    };
    _SuiFrens.constants = {
      mixingFeeCoinType: Coin.constants.suiCoinType,
      protocolFees: {
        mint: BigInt(25e7),
        // 0.25 SUI
        mixOwned: BigInt(25e7),
        // 0.25 SUI
        minMixStaked: BigInt(25e7),
        // 0.25 SUI
        mixStakedPercentage: 0.1
        // 10%
      },
      suifrenFees: {
        mint: BigInt(8e9)
        // 8 SUI
      }
    };
    SuiFrens = _SuiFrens;
  }
});
var init_suiFrens2 = __esm({
  "src/packages/suiFrens/index.ts"() {
    "use strict";
    init_suiFren();
    init_suiFrens();
    init_stakedSuiFren();
  }
});
var init_packages = __esm({
  "src/packages/index.ts"() {
    "use strict";
    init_auth2();
    init_auth2();
    init_coin2();
    init_farms2();
    init_faucet2();
    init_gasPools2();
    init_nftAmm2();
    init_perpetuals2();
    init_pools2();
    init_referralVault2();
    init_router2();
    init_staking2();
    init_sui2();
    init_suiFrens2();
  }
});
var Dca;
var init_dca = __esm({
  "src/packages/dca/dca.ts"() {
    "use strict";
    init_caller();
    Dca = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new instance of the `Dca` class, responsible for
       * managing DCA orders (querying, creating, closing).
       *
       * @param config - Optional caller configuration, such as network and access token.
       */
      constructor(config) {
        super(config, "dca");
      }
      // =========================================================================
      //  Class Objects
      // =========================================================================
      /**
       * **Deprecated**. Fetches both active and past DCA orders for a given user in one response.
       * Use `getActiveDcaOrders` and `getPastDcaOrders` for a more explicit approach.
       *
       * @param inputs - Object containing the user's `walletAddress`.
       * @returns A `DcaOrdersObject` grouping active and past orders.
       *
       * @deprecated Please use `getActiveDcaOrders` & `getPastDcaOrders` instead.
       * @example
       * ```typescript
       * // Old usage:
       * const allOrders = await dca.getAllDcaOrders({ walletAddress: "0x..." });
       * console.log(allOrders.active, allOrders.past);
       * ```
       */
      async getAllDcaOrders(inputs) {
        return this.fetchApi("orders", inputs);
      }
      /**
       * Retrieves the currently active DCA orders for a specific user.
       *
       * @param inputs - An object containing the user's `walletAddress`.
       * @returns A promise that resolves to an array of `DcaOrderObject` for the active orders.
       *
       * @example
       * ```typescript
       * const activeOrders = await dca.getActiveDcaOrders({ walletAddress: "0x..." });
       * console.log(activeOrders); // Array of active DCA orders
       * ```
       */
      async getActiveDcaOrders(inputs) {
        return this.fetchApi("active", inputs);
      }
      /**
       * Retrieves the past (completed or canceled) DCA orders for a specific user.
       *
       * @param inputs - An object containing the user's `walletAddress`.
       * @returns A promise that resolves to an array of `DcaOrderObject` for the past orders.
       *
       * @example
       * ```typescript
       * const pastOrders = await dca.getPastDcaOrders({ walletAddress: "0x..." });
       * console.log(pastOrders); // Array of past DCA orders
       * ```
       */
      async getPastDcaOrders(inputs) {
        return this.fetchApi("past", inputs);
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      /**
       * Builds a transaction block on the Aftermath API to create a new DCA order.
       * The resulting `Transaction` can then be signed and executed by the user.
       *
       * @param inputs - The parameters describing the DCA order (coin types, amounts, frequency, etc.).
       * @returns A `Transaction` object that can be signed and submitted to the Sui network.
       *
       * @example
       * ```typescript
       * const createOrderTx = await dca.getCreateDcaOrderTx({
       *   walletAddress: "0x<user>",
       *   allocateCoinType: "0x2::sui::SUI",
       *   allocateCoinAmount: BigInt(1_000_000_000),
       *   buyCoinType: "0x<coin>",
       *   frequencyMs: 3600000, // Every hour
       *   tradesAmount: 5,
       *   // ...other fields...
       * });
       * // sign & send the transaction
       * ```
       */
      async getCreateDcaOrderTx(inputs) {
        return this.fetchApiTransaction(
          "transactions/create-order",
          inputs
        );
      }
      /**
       * Closes (cancels) an existing DCA order by sending a transaction with user signature.
       * Typically used after generating a message to sign with `closeDcaOrdersMessageToSign`.
       *
       * @param inputs - Contains the user's `walletAddress`, plus the `bytes` and `signature` from message signing.
       * @returns A boolean indicating success or failure (true if canceled).
       *
       * @example
       * ```typescript
       * const success = await dca.closeDcaOrder({
       *   walletAddress: "0x...",
       *   bytes: "0x<signed_bytes>",
       *   signature: "0x<signature>",
       * });
       * ```
       */
      async closeDcaOrder(inputs) {
        return this.fetchApi(
          "cancel",
          inputs
        );
      }
      // =========================================================================
      //  Interactions
      // =========================================================================
      /**
       * Generates a JSON object representing the message to sign for canceling one or more DCA orders.
       * The user can sign this message (converted to bytes) locally, then submit the signature to
       * `closeDcaOrder`.
       *
       * @param inputs - An object containing `orderIds`, an array of order object IDs to cancel.
       * @returns An object with `action: "CANCEL_DCA_ORDERS"` and the `order_object_ids`.
       *
       * @example
       * ```typescript
       * const msg = dca.closeDcaOrdersMessageToSign({ orderIds: ["0x<order1>", "0x<order2>"] });
       * console.log(msg);
       * // sign this as JSON or string-encode, then pass to closeDcaOrder
       * ```
       */
      closeDcaOrdersMessageToSign(inputs) {
        return {
          action: "CANCEL_DCA_ORDERS",
          order_object_ids: inputs.orderIds
        };
      }
      // =========================================================================
      //  Interactions - Deprecated
      // =========================================================================
      /**
       * **Deprecated**. Generates a message object used in older flows to create
       * a DCA user account. Use the `userData` package for user key storage or account creation.
       *
       * @deprecated Please use method from `userData` package instead.
       * @returns An object with `action: "CREATE_DCA_ACCOUNT"`.
       */
      createUserAccountMessageToSign() {
        return {
          action: "CREATE_DCA_ACCOUNT"
        };
      }
      // =========================================================================
      //  User Public Key
      // =========================================================================
      /**
       * **Deprecated**. Fetches the user's public key from the older DCA system.
       * Please use `getUserPublicKey` from the `userData` package instead.
       *
       * @deprecated Use `userData` package method instead
       * @param inputs - Contains the user's `walletAddress`.
       * @returns The public key as a string or `undefined`.
       */
      async getUserPublicKey(inputs) {
        return this.fetchApi("user/get", inputs);
      }
      /**
       * **Deprecated**. Creates the user's public key in the older DCA system.
       * Please use `createUserPublicKey` from the `userData` package instead.
       *
       * @deprecated Use `userData` package method instead
       * @param inputs - Body containing the user address, bytes, and signature.
       * @returns `true` if the public key was successfully stored, otherwise `false`.
       */
      async createUserPublicKey(inputs) {
        return this.fetchApi("/user/add", inputs);
      }
    };
    Dca.constants = {
      /**
       * The default gas budget for DCA-related transactions (50 SUI).
       */
      gasAmount: BigInt(5e7)
    };
  }
});
var LimitOrders;
var init_limitOrders = __esm({
  "src/packages/limitOrders/limitOrders.ts"() {
    "use strict";
    init_caller();
    LimitOrders = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new `LimitOrders` instance for interacting with limit order functionality
       * on Aftermath.
       *
       * @param config - Optional configuration, including network and access token.
       */
      constructor(config) {
        super(config, "limit-orders");
      }
      // =========================================================================
      //  Class Objects
      // =========================================================================
      /**
       * Fetches the list of **active** limit orders for a given user. The user must
       * provide a signature for identification.
       *
       * @param inputs - Contains the `walletAddress`, as well as `bytes` and `signature` if needed for auth.
       * @returns A promise resolving to an array of `LimitOrderObject`, representing the active orders.
       *
       * @example
       * ```typescript
       * const activeOrders = await limitOrders.getActiveLimitOrders({
       *   walletAddress: "0x<address>",
       *   bytes: "0x<signed_bytes>",
       *   signature: "0x<signature>"
       * });
       * ```
       */
      async getActiveLimitOrders(inputs) {
        return this.fetchApi("active", inputs);
      }
      /**
       * Fetches the list of **past** limit orders for a given user (e.g., completed, canceled, or expired).
       *
       * @param inputs - An object containing the `walletAddress`.
       * @returns A promise resolving to an array of `LimitOrderObject` representing past orders.
       *
       * @example
       * ```typescript
       * const pastOrders = await limitOrders.getPastLimitOrders({
       *   walletAddress: "0x<address>",
       * });
       * ```
       */
      async getPastLimitOrders(inputs) {
        return this.fetchApi(
          "past",
          inputs
        );
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      /**
       * Constructs a limit order creation transaction on the Aftermath API, returning a `Transaction`
       * object that can be signed and submitted to the network.
       *
       * @param inputs - The limit order details, including coin types, amounts, expiry, etc.
       * @returns A promise resolving to a `Transaction` that can be locally signed and executed.
       *
       * @example
       * ```typescript
       * const tx = await limitOrders.getCreateLimitOrderTx({
       *   walletAddress: "0x<address>",
       *   allocateCoinType: "0x<coin>",
       *   allocateCoinAmount: BigInt(1000),
       *   buyCoinType: "0x<other_coin>",
       *   expiryDurationMs: 3600000, // 1 hour
       *   outputToInputExchangeRate: 0.5,
       * });
       * // sign and execute the transaction
       * ```
       */
      async getCreateLimitOrderTx(inputs) {
        return this.fetchApiTransaction(
          "transactions/create-order",
          inputs
        );
      }
      /**
       * Cancels an existing limit order by sending a request to the Aftermath API
       * with the user's signed cancellation message.
       *
       * @param inputs - Contains the user's `walletAddress`, plus `bytes` and `signature`.
       * @returns A boolean indicating whether the cancellation was successful.
       *
       * @example
       * ```typescript
       * const success = await limitOrders.cancelLimitOrder({
       *   walletAddress: "0x<address>",
       *   bytes: "0x<signed_bytes>",
       *   signature: "0x<signature>",
       * });
       * ```
       */
      async cancelLimitOrder(inputs) {
        return this.fetchApi(
          "cancel",
          inputs
        );
      }
      // =========================================================================
      //  Interactions
      // =========================================================================
      /**
       * Generates the JSON message needed to cancel one or more limit orders. The user
       * signs this message (converted to bytes), and the resulting signature is passed
       * to `cancelLimitOrder`.
       *
       * @param inputs - Object with `orderIds`, an array of order object IDs to cancel.
       * @returns A JSON structure with the action and order IDs to be canceled.
       *
       * @example
       * ```typescript
       * const msg = limitOrders.cancelLimitOrdersMessageToSign({
       *   orderIds: ["0x<order1>", "0x<order2>"]
       * });
       * // user signs this JSON
       * ```
       */
      cancelLimitOrdersMessageToSign(inputs) {
        return {
          action: "CANCEL_LIMIT_ORDERS",
          order_object_ids: inputs.orderIds
        };
      }
      // =========================================================================
      //  Configuration
      // =========================================================================
      /**
       * Retrieves the minimum allowable order size (in USD) for limit orders on Aftermath.
       *
       * @returns A promise resolving to a `number` (USD value) or `undefined` if not configured.
       *
       * @example
       * ```typescript
       * const minSize = await limitOrders.getMinOrderSizeUsd();
       * console.log("Minimum order size in USD:", minSize);
       * ```
       */
      async getMinOrderSizeUsd() {
        return this.fetchApi("min-order-size-usd", {});
      }
    };
    LimitOrders.constants = {
      /**
       * The default gas budget for limit orders. This may be subject to change.
       */
      gasAmount: BigInt(5e7)
    };
  }
});
var Multisig;
var init_multisig = __esm({
  "src/packages/multisig/multisig.ts"() {
    "use strict";
    init_caller();
    Multisig = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new instance of `Multisig`.
       *
       * @param config - Optional configuration for the `Caller`, including network and access token.
       * @param api - An optional instance of `AftermathApi` to build or fetch multisig data.
       */
      constructor(config, api) {
        super(config, "multisig");
        this.api = api;
        this.multisigApi = () => {
          const multisig = this.api?.Multisig();
          if (!multisig) {
            throw new Error("missing AftermathApi instance");
          }
          return multisig;
        };
      }
      // =========================================================================
      //  API
      // =========================================================================
      /**
       * Retrieves a multisig address and corresponding public key for a user based on their
       * provided single public key.
       *
       * @param inputs - An object implementing `ApiMultisigUserBody`, containing the user's public key as a `Uint8Array`.
       * @returns A promise that resolves to an object containing both the multisig address and its public key.
       *
       * @example
       * ```typescript
       *
       * const afSdk = await Aftermath.create({ network: "MAINNET" });
       *
       * const multisig = afSdk.Multisig();
       *
       * const data = await multisig.getMultisigForUser({
       *   userPublicKey: myPublicKeyBytes
       * });
       * console.log(data.address, data.publicKey);
       * ```
       */
      getMultisigForUser(inputs) {
        return this.multisigApi().getMultisigForUser(inputs);
      }
    };
  }
});
var Referrals;
var init_referrals = __esm({
  "src/packages/referrals/referrals.ts"() {
    "use strict";
    init_caller();
    Referrals = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(config) {
        super(config, "referrals");
      }
      // =========================================================================
      //  Fetching
      // =========================================================================
      async getRefCode(inputs) {
        const res = await this.fetchApi("ref-code", inputs);
        return {
          ...res,
          refCode: res.refCode === null ? void 0 : res.refCode
        };
      }
      async getLinkedRefCode(inputs) {
        const res = await this.fetchApi("linked-ref-code", inputs);
        return {
          ...res,
          linkedRefCode: res.linkedRefCode === null ? void 0 : res.linkedRefCode,
          linkedAt: res.linkedAt === null ? void 0 : res.linkedAt
        };
      }
      async getReferees(inputs) {
        return this.fetchApi("query", inputs);
      }
      async isRefCodeTaken(inputs) {
        return this.fetchApi("availability", inputs);
      }
      // =========================================================================
      //  Actions
      // =========================================================================
      async createReferralLink(inputs) {
        return this.fetchApi("create", inputs);
      }
      async setReferrer(inputs) {
        return this.fetchApi("link", inputs);
      }
      // =========================================================================
      //  Messages to Sign
      // =========================================================================
      // public getRefCodeMessageToSign() {
      // 	return {
      // 		action: "GET_REF_CODE",
      // 		date: Date.now(),
      // 	};
      // }
      // public getLinkedRefCodeMessageToSign() {
      // 	return {
      // 		action: "GET_LINKED_REF_CODE",
      // 		date: Date.now(),
      // 	};
      // }
      createReferralLinkMessageToSign(inputs) {
        return {
          action: "CREATE_REFERRAL",
          ref_code: inputs.refCode,
          date: Math.round(Date.now() / 1e3)
        };
      }
      setReferrerMessageToSign(inputs) {
        return {
          action: "LINK_REFERRAL",
          ref_code: inputs.refCode,
          date: Math.round(Date.now() / 1e3)
        };
      }
    };
    Referrals.constants = {};
  }
});
var Rewards;
var init_rewards = __esm({
  "src/packages/rewards/rewards.ts"() {
    "use strict";
    init_caller();
    Rewards = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(config, api) {
        super(config, "rewards");
        this.api = api;
      }
      // =========================================================================
      //  Fetching
      // =========================================================================
      async getPoints(inputs) {
        return this.fetchApi(
          "points",
          inputs
        );
      }
      async getHistory(inputs) {
        return this.fetchApi("history", inputs);
      }
      async getClaimable(inputs) {
        return this.fetchApi("claimable", inputs);
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      async getClaimTransaction(inputs) {
        const { tx, ...otherInputs } = inputs;
        return this.fetchApiTxObject(
          "transactions/claim",
          {
            ...otherInputs,
            txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
              tx: tx ?? new Transaction7()
            })
          },
          void 0,
          { txKind: true }
        );
      }
    };
  }
});
var UserData;
var init_userData = __esm({
  "src/packages/userData/userData.ts"() {
    "use strict";
    init_caller();
    UserData = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new instance of the `UserData` class for interacting with user data endpoints.
       *
       * @param config - Optional configuration for the `Caller`, including network and access token.
       */
      constructor(config) {
        super(config, "user-data");
      }
      // =========================================================================
      //  API
      // =========================================================================
      /**
       * Retrieves the stored user public key (if any) for a given wallet address.
       *
       * @param inputs - An object implementing `ApiUserDataPublicKeyBody`, containing the user's wallet address.
       * @returns A promise that resolves to a string representation of the user's public key, or `undefined` if none is found.
       *
       * @example
       * ```typescript
       * const afSdk = await Aftermath.create({ network: "MAINNET" });
       *
       * const userData = afSdk.UserData();
       *
       * const pubkey = await userData.getUserPublicKey({
       *   walletAddress: "0x<address>"
       * });
       * console.log(pubkey); // "0x<hex_public_key>" or undefined
       * ```
       */
      async getUserPublicKey(inputs) {
        return this.fetchApi(
          `public-key`,
          inputs
        );
      }
      /**
       * Creates (or updates) the stored public key for a user on the backend, linking
       * it to their wallet address.
       *
       * @param inputs - Details required to create or update the user's public key, including signature data.
       * @returns A promise that resolves to `true` if the public key was successfully created/updated, otherwise `false` or an error.
       *
       * @example
       * ```typescript
       * const created = await userData.createUserPublicKey({
       *   walletAddress: "0x<address>",
       *   bytes: "0x<message_as_bytes>",
       *   signature: "0x<signature>"
       * });
       * console.log("Was public key created?", created);
       * ```
       */
      async createUserPublicKey(inputs) {
        return this.fetchApi(
          `save-public-key`,
          inputs
        );
      }
      /**
       * Generates a simple message object that the user should sign to prove their
       * intention to create or link an account in the Aftermath system.
       *
       * @returns An object with an `action` property, used as the data to sign.
       *
       * @example
       * ```typescript
       * const userData = new UserData();
       * const msgToSign = userData.createUserAccountMessageToSign();
       * console.log(msgToSign.action); // "CREATE_USER_ACCOUNT"
       * // The user can then sign msgToSign with their private key.
       * ```
       */
      createUserAccountMessageToSign() {
        return {
          action: `CREATE_USER_ACCOUNT`
        };
      }
      /**
       * Generates a simple message object that the user should sign to confirm their agreement
       * with the Terms and Conditions of the service.
       *
       * @returns An object with an `action` property set to "SIGN_TERMS_AND_CONDITIONS".
       *
       * @example
       * ```typescript
       * const userData = new UserData();
       * const termsMsg = userData.createSignTermsAndConditionsMessageToSign();
       * console.log(termsMsg.action); // "SIGN_TERMS_AND_CONDITIONS"
       * // The user can sign this to show acceptance of the T&C.
       * ```
       */
      createSignTermsAndConditionsMessageToSign() {
        return {
          action: `SIGN_TERMS_AND_CONDITIONS`
        };
      }
    };
  }
});
var DynamicGas;
var init_dynamicGas = __esm({
  "src/general/dynamicGas/dynamicGas.ts"() {
    "use strict";
    init_caller();
    DynamicGas = class extends Caller {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates a new `DynamicGas` instance for interacting with dynamic gas endpoints.
       *
       * @param config - Optional caller config, including the Sui network and an access token.
       */
      constructor(config) {
        super(config, "dynamic-gas");
      }
      // =========================================================================
      //  Tx Setup
      // =========================================================================
      /**
       * Requests the dynamic gas service to set up a transaction with an appropriate gas coin,
       * or sponsor signature if needed, based on the user's wallet and coin type preference.
       *
       * @param inputs - An object containing the `Transaction` to be adjusted, the `walletAddress`, and `gasCoinType`.
       * @returns A promise that resolves to an `ApiDynamicGasResponse`, which includes the new transaction bytes
       *  (`txBytes`) and possibly a `sponsoredSignature`.
       *
       * @example
       * ```typescript
       * const afSdk = await Aftermath.create({ network: "MAINNET" });
       *
       * const dynamicGas = afSdk.DynamicGas();
       *
       * const updatedTx = await dynamicGas.getUseDynamicGasForTx({
       *   tx: transactionBlock,
       *   walletAddress: "0x<user_address>",
       *   gasCoinType: "0x2::sui::SUI"
       * });
       * // updatedTx.txBytes and updatedTx.sponsoredSignature can now be used for signing/execution
       * ```
       */
      async getUseDynamicGasForTx(inputs) {
        const { tx, walletAddress, gasCoinType } = inputs;
        return this.fetchApi("", {
          serializedTx: tx.serialize(),
          walletAddress,
          gasCoinType
        });
      }
    };
  }
});
var Wallet;
var init_wallet = __esm({
  "src/general/wallet/wallet.ts"() {
    "use strict";
    init_caller();
    Wallet = class extends Caller {
      /**
       * Creates a new `Wallet` instance for a specific address.
       *
       * @param address - The Sui address for this wallet (e.g., "0x<address>").
       * @param config - An optional caller configuration including network and authentication.
       * @param api - An optional `AftermathApi` instance for wallet-specific methods.
       */
      constructor(address, config, api) {
        super(config, "wallet");
        this.address = address;
        this.api = api;
      }
      // =========================================================================
      //  Balances
      // =========================================================================
      /**
       * Fetches the balance for a single coin type in this wallet.
       *
       * @param inputs - An object containing the `coin` type to look up (e.g., "0x2::sui::SUI").
       * @returns A promise that resolves to the coin balance as a bigint.
       *
       * @example
       * ```typescript
       *
       * const afSdk = await Aftermath.create({ network: "MAINNET" });
       *
       * const wallet = afSdk.Wallet("0x<address>");
       *
       * const suiBalance = await wallet.getBalance({ coin: "0x2::sui::SUI" });
       * console.log("SUI Balance:", suiBalance.toString());
       * ```
       */
      async getBalance(inputs) {
        return (await this.getBalances({ coins: [inputs.coin] }))[0];
      }
      /**
       * Fetches the balances for multiple specified coin types in this wallet.
       * This method currently returns an array of balances in the same order
       * as the requested coins.
       *
       * @param inputs - An object containing an array of `coins` (coin types).
       * @returns A promise resolving to an array of `Balance`s, each matching the corresponding coin in `inputs.coins`.
       *
       * @example
       * ```typescript
       * const wallet = new Wallet("0x<address>");
       * const balances = await wallet.getBalances({ coins: ["0x2::sui::SUI", "0x<...>"] });
       * console.log(balances); // e.g. [1000000000n, 50000000000n]
       * ```
       */
      async getBalances(inputs) {
        return this.fetchApi("coin-balances", {
          ...inputs,
          walletAddress: this.address
        });
      }
      /**
       * Fetches all coin balances held by this wallet address, returning a record
       * keyed by coin type.
       *
       * @returns A promise resolving to an object mapping coin types to balances (bigints).
       *
       * @example
       * ```typescript
       * const wallet = new Wallet("0x<address>");
       * const allBalances = await wallet.getAllBalances();
       * console.log(allBalances); // { "0x2::sui::SUI": 1000000000n, "0x<other_coin>": 5000000000n, ... }
       * ```
       */
      async getAllBalances() {
        return this.fetchApi("all-coin-balances", {
          walletAddress: this.address
        });
      }
      // =========================================================================
      //  Transactions
      // =========================================================================
      /**
       * Fetches a paginated list of past transactions for this wallet address.
       *
       * @param inputs - An object implementing `ApiTransactionsBody`, which includes pagination parameters (`cursor`, `limit`) and an optional `order` or other fields.
       * @returns A promise that resolves to transaction details, including a cursor if more results exist.
       *
       * @example
       * ```typescript
       * const wallet = new Wallet("0x<address>");
       * const txHistory = await wallet.getPastTransactions({ cursor: "abc123", limit: 10 });
       * console.log(txHistory.transactions, txHistory.nextCursor);
       * ```
       */
      async getPastTransactions(inputs) {
        return this.fetchApi("past-transactions", {
          ...inputs,
          walletAddress: this.address
        });
      }
    };
  }
});
var _CoinApi;
var CoinApi;
var init_coinApi = __esm({
  "src/packages/coin/api/coinApi.ts"() {
    "use strict";
    init_transactionsApiHelpers();
    init_helpers();
    init_coin();
    _CoinApi = class _CoinApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchCoinWithAmountTx = async (inputs) => {
          const { tx, walletAddress, coinType, coinAmount, isSponsoredTx } = inputs;
          tx.setSender(walletAddress);
          const coinData = await this.fetchCoinsWithAtLeastAmount(inputs);
          return _CoinApi2.coinWithAmountTx({
            tx,
            coinData,
            coinAmount,
            coinType,
            isSponsoredTx
          });
        };
        this.fetchCoinsWithAmountTx = async (inputs) => {
          const { tx, walletAddress, coinTypes, coinAmounts, isSponsoredTx } = inputs;
          tx.setSender(walletAddress);
          const allCoinsData = await Promise.all(
            coinTypes.map(
              async (coinType, index) => this.fetchCoinsWithAtLeastAmount({
                ...inputs,
                coinAmount: coinAmounts[index],
                coinType
              })
            )
          );
          let coinArgs = [];
          for (const [index, coinData] of allCoinsData.entries()) {
            const coinArg = _CoinApi2.coinWithAmountTx({
              tx,
              coinData,
              coinAmount: coinAmounts[index],
              coinType: coinTypes[index],
              isSponsoredTx
            });
            coinArgs = [...coinArgs, coinArg];
          }
          return coinArgs;
        };
        this.fetchCoinsWithAtLeastAmount = async (inputs) => {
          let allCoinData = [];
          let cursor;
          do {
            const paginatedCoins = await this.api.client.getCoins({
              ...inputs,
              owner: inputs.walletAddress,
              cursor
            });
            const coinData = paginatedCoins.data;
            allCoinData = [...allCoinData, ...coinData];
            if (paginatedCoins.data.length === 0 || !paginatedCoins.hasNextPage || !paginatedCoins.nextCursor) {
              allCoinData.sort(
                (b, a) => Number(BigInt(a.balance) - BigInt(b.balance))
              );
              const coinDatas = [];
              let sum = BigInt(0);
              for (const coinData2 of allCoinData) {
                coinDatas.push(coinData2);
                sum += BigInt(coinData2.balance);
                if (sum >= inputs.coinAmount) {
                  return coinDatas;
                }
              }
              throw new Error("wallet does not have coins of sufficient balance");
            }
            cursor = paginatedCoins.nextCursor;
          } while (true);
        };
        this.fetchAllCoins = async (inputs) => {
          let allCoinData = [];
          let cursor;
          do {
            const paginatedCoins = await this.api.client.getCoins({
              ...inputs,
              owner: inputs.walletAddress,
              cursor
            });
            const coinData = paginatedCoins.data;
            allCoinData = [...allCoinData, ...coinData];
            if (paginatedCoins.data.length === 0 || !paginatedCoins.hasNextPage || !paginatedCoins.nextCursor) {
              return allCoinData.sort(
                (b, a) => Number(BigInt(b.coinObjectId) - BigInt(a.coinObjectId))
              );
            }
            cursor = paginatedCoins.nextCursor;
          } while (true);
        };
      }
    };
    _CoinApi.coinWithAmountTx = (inputs) => {
      const { tx, coinData, coinAmount, coinType, isSponsoredTx } = inputs;
      if (coinData.length <= 0) {
        throw new Error("wallet does not have coins of sufficient balance");
      }
      const isSuiCoin = Coin.isSuiCoin(coinData[0].coinType);
      const totalCoinBalance = Helpers.sumBigInt(
        coinData.map((data) => BigInt(data.balance))
      );
      if (totalCoinBalance < coinAmount) {
        throw new Error("wallet does not have coins of sufficient balance");
      }
      if (!isSponsoredTx && isSuiCoin) {
        tx.setGasPayment(
          coinData.map((obj) => {
            return {
              ...obj,
              objectId: obj.coinObjectId
            };
          })
        );
        return tx.splitCoins(tx.gas, [coinAmount]);
      }
      const coinObjectIds = coinData.map((data) => data.coinObjectId);
      const mergedCoinObjectId = coinObjectIds[0];
      if (coinObjectIds.length > 1) {
        if (isSponsoredTx) {
          tx.add({
            $kind: "MergeCoins",
            MergeCoins: {
              destination: tx.object(mergedCoinObjectId),
              sources: [
                ...coinObjectIds.slice(1).map((coinId) => tx.object(coinId))
              ]
            }
          });
        } else {
          tx.mergeCoins(tx.object(mergedCoinObjectId), [
            ...coinObjectIds.slice(1).map((coinId) => tx.object(coinId))
          ]);
        }
      }
      return isSponsoredTx ? TransactionsApiHelpers.splitCoinTx({
        tx,
        coinId: mergedCoinObjectId,
        amount: coinAmount,
        coinType
      }) : tx.splitCoins(mergedCoinObjectId, [coinAmount]);
    };
    CoinApi = _CoinApi;
  }
});
var _DcaApi;
var DcaApi;
var init_dcaApi = __esm({
  "src/packages/dca/api/dcaApi.ts"() {
    "use strict";
    init_eventsApiHelpers();
    init_utils();
    _DcaApi = class _DcaApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.createCloseOrderTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.dca,
              _DcaApi2.constants.moduleNames.dca,
              "close_order"
            ),
            typeArguments: [inputs.allocateCoinType, inputs.buyCoinType],
            arguments: [
              typeof inputs.orderId === "string" ? tx.object(inputs.orderId) : inputs.orderId,
              tx.object(this.addresses.objects.config)
            ]
          });
        };
        this.createdOrderEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.events,
          _DcaApi2.constants.moduleNames.events,
          _DcaApi2.constants.eventNames.createdOrder
        );
        this.createdOrderEventTypeV2 = () => EventsApiHelpers.createEventType(
          this.addresses.packages.eventsV2,
          _DcaApi2.constants.moduleNames.events,
          _DcaApi2.constants.eventNames.createdOrderV2
        );
        this.closedOrderEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.events,
          _DcaApi2.constants.moduleNames.events,
          _DcaApi2.constants.eventNames.closedOrder
        );
        this.executedOrderEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.events,
          _DcaApi2.constants.moduleNames.events,
          _DcaApi2.constants.eventNames.executedTrade
        );
        const addresses = this.api.addresses.dca;
        if (!addresses) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = addresses;
        this.eventTypes = {
          createdOrder: this.createdOrderEventType(),
          createdOrderV2: this.createdOrderEventTypeV2(),
          closedOrder: this.closedOrderEventType(),
          executedTrade: this.executedOrderEventType()
        };
      }
    };
    _DcaApi.constants = {
      moduleNames: {
        dca: "order",
        events: "events",
        config: "config"
      },
      eventNames: {
        createdOrder: "CreatedOrderEvent",
        createdOrderV2: "CreatedOrderEventV2",
        closedOrder: "ClosedOrderEvent",
        executedTrade: "ExecutedTradeEvent"
      }
    };
    DcaApi = _DcaApi;
  }
});
var _FarmsApi;
var FarmsApi;
var init_farmsApi = __esm({
  "src/packages/farms/api/farmsApi.ts"() {
    "use strict";
    init_eventsApiHelpers();
    init_utils();
    init_packages();
    init_sui2();
    _FarmsApi = class _FarmsApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Constructor for FarmsApi
       * @param api The AftermathApi provider instance
       * @throws Error if not all required addresses have been set in provider
       */
      constructor(api) {
        this.api = api;
        this.fetchOwnedStakingPoolOwnerCaps = async (inputs) => {
          const { walletAddress } = inputs;
          const [capsV1, capsV2] = await Promise.all([
            this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
              walletAddress,
              objectType: this.objectTypes.stakingPoolOwnerCapV1,
              objectFromSuiObjectResponse: Casting.farms.stakingPoolOwnerCapObjectFromSuiObjectResponseV1
            }),
            this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
              walletAddress,
              objectType: this.objectTypes.stakingPoolOwnerCapV2,
              objectFromSuiObjectResponse: Casting.farms.stakingPoolOwnerCapObjectFromSuiObjectResponseV2
            })
          ]);
          return [...capsV1, ...capsV2];
        };
        this.fetchOwnedStakingPoolOneTimeAdminCaps = async (inputs) => {
          const { walletAddress } = inputs;
          const [capsV1, capsV2] = await Promise.all([
            this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
              walletAddress,
              objectType: this.objectTypes.stakingPoolOneTimeAdminCapV1,
              objectFromSuiObjectResponse: Casting.farms.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV1
            }),
            this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
              walletAddress,
              objectType: this.objectTypes.stakingPoolOneTimeAdminCapV2,
              objectFromSuiObjectResponse: Casting.farms.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV2
            })
          ]);
          return [...capsV1, ...capsV2];
        };
        this.fetchOwnedPartialStakedPositions = async (inputs) => {
          const { walletAddress } = inputs;
          const [positionsV1, positionsV2] = await Promise.all([
            this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
              walletAddress,
              objectType: this.objectTypes.stakedPositionV1,
              objectFromSuiObjectResponse: Casting.farms.partialStakedPositionObjectFromSuiObjectResponseV1
            }),
            this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
              walletAddress,
              objectType: this.objectTypes.stakedPositionV2,
              objectFromSuiObjectResponse: Casting.farms.partialStakedPositionObjectFromSuiObjectResponseV2
            })
          ]);
          return [...positionsV1, ...positionsV2];
        };
        this.stakeTxV1 = (inputs) => {
          const { tx, stakeCoinId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "stake"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              typeof stakeCoinId === "string" ? tx.object(stakeCoinId) : stakeCoinId,
              // Coin
              tx.pure.u64(inputs.lockDurationMs)
            ]
          });
        };
        this.stakeTxV2 = (inputs) => {
          const { tx, stakeCoinId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "stake"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              typeof stakeCoinId === "string" ? tx.object(stakeCoinId) : stakeCoinId,
              // Coin
              tx.pure.u8(inputs.lockEnforcement === "Strict" ? 0 : 1),
              // lock_enforcement
              tx.pure.u64(inputs.lockDurationMs)
              // lock_duration_ms
            ]
          });
        };
        this.depositPrincipalTxV1 = (inputs) => {
          const { tx, stakeCoinId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "deposit_principal"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              typeof stakeCoinId === "string" ? tx.object(stakeCoinId) : stakeCoinId
              // Coin
            ]
          });
        };
        this.depositPrincipalTxV2 = (inputs) => {
          const { tx, stakeCoinId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "deposit_principal"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              typeof stakeCoinId === "string" ? tx.object(stakeCoinId) : stakeCoinId
              // Coin
            ]
          });
        };
        this.withdrawPrincipalTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "withdraw_principal"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              tx.pure.u64(inputs.withdrawAmount)
            ]
          });
        };
        this.withdrawPrincipalTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "withdraw_principal"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              tx.pure.u64(inputs.withdrawAmount)
            ]
          });
        };
        this.destroyStakedPositionTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "destroy"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.destroyStakedPositionTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "destroy"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(this.addresses.objects.version)
              // Version
            ]
          });
        };
        this.updatePositionTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "update_position"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.updatePositionTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "update_position"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.lockTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "lock"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              tx.pure.u64(inputs.lockDurationMs)
            ]
          });
        };
        this.lockTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "lock"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              tx.pure.u64(inputs.lockDurationMs)
            ]
          });
        };
        this.renewLockTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "renew_lock"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.renewLockTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "renew_lock"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              tx.object(this.addresses.objects.version)
              // Version
            ]
          });
        };
        this.unlockTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "unlock"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.unlockTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "unlock"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.beginHarvestTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "begin_harvest"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakingPoolId)
              // AfterburnerVault
            ]
          });
        };
        this.beginHarvestTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "begin_harvest_tx"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version)
              // Version
            ]
          });
        };
        this.harvestRewardsTxV1 = (inputs) => {
          const { tx, harvestedRewardsEventMetadataId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "harvest_rewards"
            ),
            typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
            arguments: [
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              typeof harvestedRewardsEventMetadataId === "string" ? tx.object(harvestedRewardsEventMetadataId) : harvestedRewardsEventMetadataId,
              // HarvestedRewardsEventMetadata
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.harvestRewardsTxV2 = (inputs) => {
          const { tx, harvestRewardsCap } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "harvest_rewards"
            ),
            typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
            arguments: [
              typeof harvestRewardsCap === "string" ? tx.object(harvestRewardsCap) : harvestRewardsCap,
              // HarvestRewardsCap
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.endHarvestTxV1 = (inputs) => {
          const { tx, harvestedRewardsEventMetadataId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "end_harvest"
            ),
            typeArguments: [],
            arguments: [
              typeof harvestedRewardsEventMetadataId === "string" ? tx.object(harvestedRewardsEventMetadataId) : harvestedRewardsEventMetadataId
              // HarvestedRewardsEventMetadata
            ]
          });
        };
        this.endHarvestTxV2 = (inputs) => {
          const { tx, harvestRewardsCap } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.stakedPosition,
              "end_harvest_tx"
            ),
            typeArguments: [],
            arguments: [
              typeof harvestRewardsCap === "string" ? tx.object(harvestRewardsCap) : harvestRewardsCap,
              // HarvestRewardsCap
              tx.object(this.addresses.objects.version)
              // Version
            ]
          });
        };
        this.newStakingPoolTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              "new"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.pure.u64(inputs.lockEnforcement === "Strict" ? 0 : 1),
              tx.pure.u64(inputs.minLockDurationMs),
              tx.pure.u64(inputs.maxLockDurationMs),
              tx.pure.u64(inputs.maxLockMultiplier),
              tx.pure.u64(inputs.minStakeAmount)
            ]
          });
        };
        this.newStakingPoolTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.vaultV2,
              "new"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(this.addresses.objects.version),
              tx.pure.vector(
                "u8",
                inputs.lockEnforcements.map(
                  (lockEnforcement) => lockEnforcement === "Strict" ? 0 : 1
                )
              ),
              tx.pure.u64(inputs.minLockDurationMs),
              tx.pure.u64(inputs.maxLockDurationMs),
              tx.pure.u64(inputs.maxLockMultiplier),
              tx.pure.u64(inputs.minStakeAmount)
            ]
          });
        };
        this.shareStakingPoolTxV1 = (inputs) => {
          const { tx, stakingPoolId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              "share_vault"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              typeof stakingPoolId === "string" ? tx.object(stakingPoolId) : stakingPoolId
              // AfterburnerVault
            ]
          });
        };
        this.shareStakingPoolTxV2 = (inputs) => {
          const { tx, stakingPoolId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.vaultV2,
              "share"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              typeof stakingPoolId === "string" ? tx.object(stakingPoolId) : stakingPoolId
              // AfterburnerVault
            ]
          });
        };
        this.transferOwnerCapTxV1 = (inputs) => {
          const { tx, ownerCapId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              "transfer_owner_cap"
            ),
            typeArguments: [],
            arguments: [
              typeof ownerCapId === "string" ? tx.object(ownerCapId) : ownerCapId,
              // OwnerCap
              tx.pure.address(inputs.recipientAddress)
            ]
          });
        };
        this.grantOneTimeAdminCapTxV1 = (inputs) => {
          const { tx, ownerCapId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              "grant_one_time_admin_cap"
            ),
            typeArguments: [inputs.rewardCoinType],
            arguments: [
              typeof ownerCapId === "string" ? tx.object(ownerCapId) : ownerCapId,
              // OwnerCap
              tx.pure.address(inputs.recipientAddress)
            ]
          });
        };
        this.grantOneTimeAdminCapTxV2 = (inputs) => {
          const { tx, ownerCapId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.vaultV2,
              "grant_one_time_admin_cap"
            ),
            typeArguments: [inputs.rewardCoinType],
            arguments: [
              typeof ownerCapId === "string" ? tx.object(ownerCapId) : ownerCapId,
              // OwnerCap
              tx.object(this.addresses.objects.version),
              // Version
              tx.pure.address(inputs.recipientAddress)
            ]
          });
        };
        this.initializeStakingPoolRewardTxV1 = (inputs) => {
          const { tx, rewardCoinId } = inputs;
          const isOneTimeAdminCap = _FarmsApi2.isFarmOneTimeAdminCapId(inputs);
          const capId = _FarmsApi2.farmCapId(inputs);
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              isOneTimeAdminCap ? "initialize_reward_and_consume_admin_cap" : "initialize_reward"
            ),
            typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
            arguments: [
              tx.object(capId),
              // OwnerCap / OneTimeAdminCap
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              typeof rewardCoinId === "string" ? tx.object(rewardCoinId) : rewardCoinId,
              // Coin
              tx.pure.u64(inputs.emissionScheduleMs),
              tx.pure.u64(inputs.emissionRate),
              tx.pure.u64(inputs.emissionDelayTimestampMs)
            ]
          });
        };
        this.initializeStakingPoolRewardTxV2 = (inputs) => {
          const { tx, rewardCoinId } = inputs;
          const isOneTimeAdminCap = _FarmsApi2.isFarmOneTimeAdminCapId(inputs);
          const capId = _FarmsApi2.farmCapId(inputs);
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.vaultV2,
              isOneTimeAdminCap ? "initialize_reward_and_consume_admin_cap" : "initialize_reward"
            ),
            typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
            arguments: [
              tx.object(capId),
              // OwnerCap / OneTimeAdminCap
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              typeof rewardCoinId === "string" ? tx.object(rewardCoinId) : rewardCoinId,
              // Coin
              tx.pure.u64(inputs.emissionScheduleMs),
              tx.pure.u64(inputs.emissionRate),
              tx.pure.u64(inputs.emissionDelayTimestampMs)
            ]
          });
        };
        this.topUpStakingPoolRewardTxV1 = (inputs) => {
          const { tx, rewardCoinId } = inputs;
          const isOneTimeAdminCap = _FarmsApi2.isFarmOneTimeAdminCapId(inputs);
          const capId = _FarmsApi2.farmCapId(inputs);
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              isOneTimeAdminCap ? "add_reward_and_consume_admin_cap" : "add_reward"
            ),
            typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
            arguments: [
              tx.object(capId),
              // OwnerCap / OneTimeAdminCap
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              typeof rewardCoinId === "string" ? tx.object(rewardCoinId) : rewardCoinId
              // Coin
            ]
          });
        };
        this.topUpStakingPoolRewardTxV2 = (inputs) => {
          const { tx, rewardCoinId } = inputs;
          const isOneTimeAdminCap = _FarmsApi2.isFarmOneTimeAdminCapId(inputs);
          const capId = _FarmsApi2.farmCapId(inputs);
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.vaultV2,
              isOneTimeAdminCap ? "add_reward_and_consume_admin_cap" : "add_reward"
            ),
            typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
            arguments: [
              tx.object(capId),
              // OwnerCap / OneTimeAdminCap
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              typeof rewardCoinId === "string" ? tx.object(rewardCoinId) : rewardCoinId
              // Coin
            ]
          });
        };
        this.increaseStakingPoolRewardEmissionsTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              "update_emissions_for"
            ),
            typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
            arguments: [
              tx.object(inputs.ownerCapId),
              // OwnerCap
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              tx.pure.u64(inputs.emissionScheduleMs),
              tx.pure.u64(inputs.emissionRate)
            ]
          });
        };
        this.increaseStakingPoolRewardEmissionsTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.vaultV2,
              "update_emission_schedule"
            ),
            typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
            arguments: [
              tx.object(inputs.ownerCapId),
              // OwnerCap
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              tx.pure.u64(inputs.emissionScheduleMs),
              tx.pure.u64(inputs.emissionRate)
            ]
          });
        };
        this.setStakingPoolMinStakeAmountTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              "set_min_stake_amount"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.ownerCapId),
              // OwnerCap
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.pure.u64(inputs.minStakeAmount)
            ]
          });
        };
        this.setStakingPoolMinStakeAmountTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.vaultV2,
              "set_min_stake_amount"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.ownerCapId),
              // OwnerCap
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.pure.u64(inputs.minStakeAmount)
            ]
          });
        };
        this.removeStakingPoolRewardTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              "remove_reward"
            ),
            typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
            arguments: [
              tx.object(inputs.ownerCapId),
              // OwnerCap
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.pure.u64(inputs.rewardAmount)
            ]
          });
        };
        this.removeStakingPoolRewardTxV2 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaultsV2,
              _FarmsApi2.constants.moduleNames.vaultV2,
              "remove_reward"
            ),
            typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
            arguments: [
              tx.object(inputs.ownerCapId),
              // OwnerCap
              tx.object(inputs.stakingPoolId),
              // AfterburnerVault
              tx.object(this.addresses.objects.version),
              // Version
              tx.pure.u64(inputs.rewardAmount)
            ]
          });
        };
        this.isVaultUnlockedTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              "is_vault_unlocked"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakingPoolId)
              // AfterburnerVault
            ]
          });
        };
        this.remainingRewardsTxV1 = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.vaults,
              _FarmsApi2.constants.moduleNames.vaultV1,
              "remaining_rewards"
            ),
            typeArguments: [inputs.stakeCoinType],
            arguments: [
              tx.object(inputs.stakingPoolId)
              // AfterburnerVault
            ]
          });
        };
        this.fetchBuildStakeTxV1 = async (inputs) => {
          const { walletAddress, isSponsoredTx } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          const stakeCoinId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: inputs.stakeCoinType,
            coinAmount: inputs.stakeAmount,
            isSponsoredTx
          });
          const stakedPosition = this.stakeTxV1({
            ...inputs,
            tx,
            stakeCoinId
          });
          tx.transferObjects([stakedPosition], walletAddress);
          return tx;
        };
        this.fetchBuildStakeTxV2 = async (inputs) => {
          const { walletAddress, isSponsoredTx } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          const stakeCoinId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: inputs.stakeCoinType,
            coinAmount: inputs.stakeAmount,
            isSponsoredTx
          });
          const stakedPosition = this.stakeTxV2({
            ...inputs,
            tx,
            stakeCoinId,
            lockEnforcement: "Strict"
          });
          tx.transferObjects([stakedPosition], walletAddress);
          return tx;
        };
        this.fetchBuildDepositPrincipalTxV1 = async (inputs) => {
          const { walletAddress, isSponsoredTx } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          const stakeCoinId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: inputs.stakeCoinType,
            coinAmount: inputs.depositAmount,
            isSponsoredTx
          });
          this.depositPrincipalTxV1({
            ...inputs,
            tx,
            stakeCoinId
          });
          return tx;
        };
        this.fetchBuildDepositPrincipalTxV2 = async (inputs) => {
          const { walletAddress, isSponsoredTx } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          const stakeCoinId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: inputs.stakeCoinType,
            coinAmount: inputs.depositAmount,
            isSponsoredTx
          });
          this.depositPrincipalTxV2({
            ...inputs,
            tx,
            stakeCoinId
          });
          return tx;
        };
        this.buildWithdrawPrincipalTxV1 = (inputs) => {
          const { walletAddress } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          const withdrawnCoin = this.withdrawPrincipalTxV1({
            ...inputs,
            tx
          });
          tx.transferObjects([withdrawnCoin], walletAddress);
          return tx;
        };
        this.buildWithdrawPrincipalTxV2 = (inputs) => {
          const { walletAddress } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          const withdrawnCoin = this.withdrawPrincipalTxV2({
            ...inputs,
            tx
          });
          tx.transferObjects([withdrawnCoin], walletAddress);
          return tx;
        };
        this.buildUnstakeTxV1 = (inputs) => {
          const { walletAddress } = inputs;
          let tx;
          if (inputs.rewardCoinTypes.length > 0) {
            tx = this.buildHarvestRewardsTxV1({
              ...inputs,
              stakedPositionIds: [inputs.stakedPositionId]
            });
          } else {
            tx = new Transaction8();
            tx.setSender(walletAddress);
          }
          const withdrawnCoin = this.withdrawPrincipalTxV1({
            ...inputs,
            tx
          });
          tx.transferObjects([withdrawnCoin], walletAddress);
          this.destroyStakedPositionTxV1({
            tx,
            stakingPoolId: inputs.stakingPoolId,
            stakedPositionId: inputs.stakedPositionId,
            stakeCoinType: inputs.stakeCoinType
          });
          return tx;
        };
        this.buildUnstakeTxV2 = (inputs) => {
          const { walletAddress } = inputs;
          let tx;
          if (inputs.rewardCoinTypes.length > 0) {
            tx = this.buildHarvestRewardsTxV2({
              ...inputs,
              stakedPositionIds: [inputs.stakedPositionId]
            });
          } else {
            tx = new Transaction8();
            tx.setSender(walletAddress);
          }
          const withdrawnCoin = this.withdrawPrincipalTxV2({
            ...inputs,
            tx
          });
          tx.transferObjects([withdrawnCoin], walletAddress);
          this.destroyStakedPositionTxV2({
            tx,
            stakedPositionId: inputs.stakedPositionId,
            stakeCoinType: inputs.stakeCoinType
          });
          return tx;
        };
        this.buildUpdatePositionTxV1 = Helpers.transactions.createBuildTxFunc(
          this.updatePositionTxV1
        );
        this.buildUpdatePositionTx2 = Helpers.transactions.createBuildTxFunc(
          this.updatePositionTxV2
        );
        this.buildLockTxV1 = Helpers.transactions.createBuildTxFunc(this.lockTxV1);
        this.buildLockTxV2 = Helpers.transactions.createBuildTxFunc(this.lockTxV2);
        this.buildRenewLockTxV1 = Helpers.transactions.createBuildTxFunc(
          this.renewLockTxV1
        );
        this.buildRenewLockTxV2 = Helpers.transactions.createBuildTxFunc(
          this.renewLockTxV2
        );
        this.buildUnlockTxV1 = Helpers.transactions.createBuildTxFunc(
          this.unlockTxV1
        );
        this.buildUnlockTxV2 = Helpers.transactions.createBuildTxFunc(
          this.unlockTxV2
        );
        this.buildHarvestRewardsTxV1 = (inputs) => {
          const { walletAddress, stakedPositionIds } = inputs;
          const tx = inputs.tx ?? new Transaction8();
          tx.setSender(walletAddress);
          const harvestRewardsCap = this.beginHarvestTxV1({
            ...inputs,
            tx
          });
          const harvestedCoins = {};
          for (const stakedPositionId of stakedPositionIds) {
            for (const rewardCoinType of inputs.rewardCoinTypes) {
              const harvestedCoin = this.harvestRewardsTxV1({
                ...inputs,
                tx,
                stakedPositionId,
                rewardCoinType,
                harvestedRewardsEventMetadataId: harvestRewardsCap
              });
              if (rewardCoinType in harvestedCoins) {
                harvestedCoins[rewardCoinType].push(harvestedCoin);
              } else {
                harvestedCoins[rewardCoinType] = [harvestedCoin];
              }
            }
          }
          this.endHarvestTxV1({
            tx,
            harvestedRewardsEventMetadataId: harvestRewardsCap
          });
          for (const [coinType, harvestedCoinIds] of Object.entries(harvestedCoins)) {
            const coinToTransfer = harvestedCoinIds[0];
            if (harvestedCoinIds.length > 1) {
              tx.mergeCoins(coinToTransfer, harvestedCoinIds.slice(1));
            }
            if (inputs.claimSuiAsAfSui && Coin.isCoinObjectType(coinType)) {
              this.api.Staking().stakeTx({
                tx,
                suiCoin: coinToTransfer,
                withTransfer: true,
                validatorAddress: this.api.Staking().addresses.objects.aftermathValidator
              });
            } else {
              tx.transferObjects([coinToTransfer], walletAddress);
            }
          }
          return tx;
        };
        this.buildHarvestRewardsTxV2 = (inputs) => {
          const { walletAddress, stakedPositionIds } = inputs;
          const tx = inputs.tx ?? new Transaction8();
          tx.setSender(walletAddress);
          const firstPositionId = stakedPositionIds[0];
          const harvestRewardsCap = this.beginHarvestTxV2({
            ...inputs,
            tx,
            stakedPositionId: firstPositionId
          });
          const harvestedCoins = {};
          for (const stakedPositionId of stakedPositionIds) {
            for (const rewardCoinType of inputs.rewardCoinTypes) {
              const harvestedCoin = this.harvestRewardsTxV2({
                ...inputs,
                tx,
                stakedPositionId,
                harvestRewardsCap,
                rewardCoinType
              });
              if (rewardCoinType in harvestedCoins) {
                harvestedCoins[rewardCoinType].push(harvestedCoin);
              } else {
                harvestedCoins[rewardCoinType] = [harvestedCoin];
              }
            }
          }
          this.endHarvestTxV2({ tx, harvestRewardsCap });
          for (const [coinType, harvestedCoinIds] of Object.entries(harvestedCoins)) {
            const coinToTransfer = harvestedCoinIds[0];
            if (harvestedCoinIds.length > 1) {
              tx.mergeCoins(coinToTransfer, harvestedCoinIds.slice(1));
            }
            if (inputs.claimSuiAsAfSui && Coin.isCoinObjectType(coinType)) {
              this.api.Staking().stakeTx({
                tx,
                suiCoin: coinToTransfer,
                withTransfer: true,
                validatorAddress: this.api.Staking().addresses.objects.aftermathValidator
              });
            } else {
              tx.transferObjects([coinToTransfer], walletAddress);
            }
          }
          return tx;
        };
        this.buildCreateStakingPoolTxV1 = (inputs) => {
          const { walletAddress } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          const [stakingPoolId, ownerCapId] = this.newStakingPoolTxV1({
            ...inputs,
            tx,
            lockEnforcement: "Strict"
          });
          this.shareStakingPoolTxV1({
            tx,
            stakingPoolId,
            stakeCoinType: inputs.stakeCoinType
          });
          this.transferOwnerCapTxV1({
            tx,
            ownerCapId,
            recipientAddress: walletAddress
          });
          return tx;
        };
        this.buildCreateStakingPoolTxV2 = (inputs) => {
          const { walletAddress } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          const [stakingPoolId, ownerCapId] = this.newStakingPoolTxV2({
            ...inputs,
            tx,
            lockEnforcements: ["Strict"]
          });
          this.shareStakingPoolTxV2({
            tx,
            stakingPoolId,
            stakeCoinType: inputs.stakeCoinType
          });
          tx.transferObjects([ownerCapId], walletAddress);
          return tx;
        };
        this.fetchBuildInitializeStakingPoolRewardTxV1 = async (inputs) => {
          const { walletAddress, isSponsoredTx } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          const rewardCoinId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: inputs.rewardCoinType,
            coinAmount: inputs.rewardAmount,
            isSponsoredTx
          });
          this.initializeStakingPoolRewardTxV1({ ...inputs, tx, rewardCoinId });
          return tx;
        };
        this.fetchBuildInitializeStakingPoolRewardTxV2 = async (inputs) => {
          const { walletAddress, isSponsoredTx } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          const rewardCoinId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: inputs.rewardCoinType,
            coinAmount: inputs.rewardAmount,
            isSponsoredTx
          });
          this.initializeStakingPoolRewardTxV2({ ...inputs, tx, rewardCoinId });
          return tx;
        };
        this.fetchBuildTopUpStakingPoolRewardsTxV1 = async (inputs) => {
          const { walletAddress, isSponsoredTx } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          for (const reward of inputs.rewards) {
            const rewardCoinId = await this.api.Coin().fetchCoinWithAmountTx({
              tx,
              walletAddress,
              coinType: reward.rewardCoinType,
              coinAmount: reward.rewardAmount,
              isSponsoredTx
            });
            this.topUpStakingPoolRewardTxV1({
              ...inputs,
              ...reward,
              tx,
              rewardCoinId
            });
          }
          return tx;
        };
        this.fetchBuildTopUpStakingPoolRewardsTxV2 = async (inputs) => {
          const { walletAddress, isSponsoredTx } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          for (const reward of inputs.rewards) {
            const rewardCoinId = await this.api.Coin().fetchCoinWithAmountTx({
              tx,
              walletAddress,
              coinType: reward.rewardCoinType,
              coinAmount: reward.rewardAmount,
              isSponsoredTx
            });
            this.topUpStakingPoolRewardTxV2({
              ...inputs,
              ...reward,
              tx,
              rewardCoinId
            });
          }
          return tx;
        };
        this.buildIncreaseStakingPoolRewardsEmissionsTxV1 = (inputs) => {
          const { walletAddress } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          for (const reward of inputs.rewards) {
            this.increaseStakingPoolRewardEmissionsTxV1({
              ...inputs,
              ...reward,
              tx
            });
          }
          return tx;
        };
        this.buildIncreaseStakingPoolRewardsEmissionsTxV2 = (inputs) => {
          const { walletAddress } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          for (const reward of inputs.rewards) {
            this.increaseStakingPoolRewardEmissionsTxV2({
              ...inputs,
              ...reward,
              tx
            });
          }
          return tx;
        };
        this.buildSetStakingPoolMinStakeAmountTxV1 = Helpers.transactions.createBuildTxFunc(
          this.setStakingPoolMinStakeAmountTxV1
        );
        this.buildSetStakingPoolMinStakeAmountTxV2 = Helpers.transactions.createBuildTxFunc(
          this.setStakingPoolMinStakeAmountTxV2
        );
        this.buildRemoveStakingPoolRewardTxV1 = (inputs) => {
          const { walletAddress } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          for (const reward of inputs.rewards) {
            this.removeStakingPoolRewardTxV1({
              ...inputs,
              ...reward,
              tx
            });
          }
          return tx;
        };
        this.buildRemoveStakingPoolRewardTxV2 = (inputs) => {
          const { walletAddress } = inputs;
          const tx = new Transaction8();
          tx.setSender(walletAddress);
          for (const reward of inputs.rewards) {
            this.removeStakingPoolRewardTxV2({
              ...inputs,
              ...reward,
              tx
            });
          }
          return tx;
        };
        this.buildGrantOneTimeAdminCapTxV1 = Helpers.transactions.createBuildTxFunc(
          this.grantOneTimeAdminCapTxV1
        );
        this.buildGrantOneTimeAdminCapTxV2 = Helpers.transactions.createBuildTxFunc(
          this.grantOneTimeAdminCapTxV2
        );
        this.eventWrapperType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          "Event"
        );
        this.createdVaultEventType = (version) => EventsApiHelpers.createEventType(
          version === 1 ? this.addresses.packages.vaultsInitial : this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.createdVault,
          version === 1 ? void 0 : this.eventWrapperType()
        );
        this.initializedRewardEventType = (version) => EventsApiHelpers.createEventType(
          version === 1 ? this.addresses.packages.vaultsInitial : this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.initializedReward,
          version === 1 ? void 0 : this.eventWrapperType()
        );
        this.addedRewardEventType = (version) => EventsApiHelpers.createEventType(
          version === 1 ? this.addresses.packages.vaultsInitial : this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.addedReward,
          version === 1 ? void 0 : this.eventWrapperType()
        );
        this.increasedEmissionsEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.vaultsInitial,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.increasedEmissions
        );
        this.updatedEmissionsEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.increasedEmissions,
          this.eventWrapperType()
        );
        this.stakedEventType = (version) => EventsApiHelpers.createEventType(
          version === 1 ? this.addresses.packages.vaultsInitial : this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.staked,
          version === 1 ? void 0 : this.eventWrapperType()
        );
        this.stakedRelaxedEventType = (version) => EventsApiHelpers.createEventType(
          version === 1 ? this.addresses.packages.vaultsInitial : this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.stakedRelaxed,
          version === 1 ? void 0 : this.eventWrapperType()
        );
        this.lockedEventType = (version) => EventsApiHelpers.createEventType(
          version === 1 ? this.addresses.packages.vaultsInitial : this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.locked,
          version === 1 ? void 0 : this.eventWrapperType()
        );
        this.unlockedEventType = (version) => EventsApiHelpers.createEventType(
          version === 1 ? this.addresses.packages.vaultsInitial : this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.unlocked,
          version === 1 ? void 0 : this.eventWrapperType()
        );
        this.depositedPrincipalEventType = (version) => EventsApiHelpers.createEventType(
          version === 1 ? this.addresses.packages.vaultsInitial : this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.depositedPrincipal,
          version === 1 ? void 0 : this.eventWrapperType()
        );
        this.withdrewPrincipalEventType = (version) => EventsApiHelpers.createEventType(
          version === 1 ? this.addresses.packages.vaultsInitial : this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.withdrewPrincipal,
          version === 1 ? void 0 : this.eventWrapperType()
        );
        this.harvestedRewardsEventType = (version) => EventsApiHelpers.createEventType(
          version === 1 ? this.addresses.packages.vaultsInitial : this.addresses.packages.eventsV2,
          _FarmsApi2.constants.moduleNames.events,
          _FarmsApi2.constants.eventNames.harvestedRewards,
          version === 1 ? void 0 : this.eventWrapperType()
        );
        const addresses = this.api.addresses.farms;
        if (!addresses) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = addresses;
        this.objectTypes = {
          stakedPositionV1: `${addresses.packages.vaultsInitial}::${_FarmsApi2.constants.moduleNames.stakedPosition}::StakedPosition`,
          stakingPoolOwnerCapV1: `${addresses.packages.vaultsInitial}::${_FarmsApi2.constants.moduleNames.vaultV1}::OwnerCap`,
          stakingPoolOneTimeAdminCapV1: `${addresses.packages.vaultsInitial}::${_FarmsApi2.constants.moduleNames.vaultV1}::OneTimeAdminCap`,
          stakedPositionV2: `${addresses.packages.eventsV2}::${_FarmsApi2.constants.moduleNames.stakedPosition}::StakedPosition`,
          stakingPoolOwnerCapV2: `${addresses.packages.eventsV2}::${_FarmsApi2.constants.moduleNames.authority}::AuthorityCap<${addresses.packages.eventsV2}::${_FarmsApi2.constants.moduleNames.authority}::VAULT<${addresses.packages.eventsV2}::${_FarmsApi2.constants.moduleNames.authority}::ADMIN>>`,
          // NOTE: will this work with `<phantom Role, phantom Reward>` ?
          stakingPoolOneTimeAdminCapV2: `${addresses.packages.eventsV2}::${_FarmsApi2.constants.moduleNames.vaultV2}::OneTime`
        };
        this.eventTypes = {
          // v1
          // staking pools
          // creation
          createdVaultV1: this.createdVaultEventType(1),
          // mutation
          initializedRewardV1: this.initializedRewardEventType(1),
          addedRewardV1: this.addedRewardEventType(1),
          increasedEmissionsV1: this.increasedEmissionsEventType(),
          // staking positions
          // creation
          stakedV1: this.stakedEventType(1),
          stakedRelaxedV1: this.stakedRelaxedEventType(1),
          // locking
          lockedV1: this.lockedEventType(1),
          unlockedV1: this.unlockedEventType(1),
          // staking
          depositedPrincipalV1: this.depositedPrincipalEventType(1),
          withdrewPrincipalV1: this.withdrewPrincipalEventType(1),
          // reward harvesting
          harvestedRewardsV1: this.harvestedRewardsEventType(1),
          // v2
          // staking pools
          // creation
          createdVaultV2: this.createdVaultEventType(2),
          // mutation
          initializedRewardV2: this.initializedRewardEventType(2),
          addedRewardV2: this.addedRewardEventType(2),
          updatedEmissionsV2: this.updatedEmissionsEventType(),
          // staking positions
          // creation
          stakedV2: this.stakedEventType(2),
          // locking
          lockedV2: this.lockedEventType(2),
          unlockedV2: this.unlockedEventType(2),
          // staking
          depositedPrincipalV2: this.depositedPrincipalEventType(2),
          withdrewPrincipalV2: this.withdrewPrincipalEventType(2),
          // reward harvesting
          harvestedRewardsV2: this.harvestedRewardsEventType(2)
        };
        this.moveErrors = {
          [this.addresses.packages.vaults]: {
            [_FarmsApi2.constants.moduleNames.vaultV1]: {
              /// A user attempts provides a `Coin` or `u64` with value zero.
              0: "Zero",
              /// A user provides a `StakedPosition` and a `AfterburnerVault` that don't correspond with one
              ///  another. This can only occur if two `AfterburnerVault` with the same underlying `STAKED` generic
              ///  are created.
              1: "Invalid Afterburner Vault",
              /// A user tries to create an `AfterburnerVault` where `min_lock_duration_ms` is strictly greater than
              ///  `max_lock_duration_ms`.
              2: "Invalid Min Max Lock Durations",
              /// The creator of a `AfterburnerVault` tries to update the vault's emission rate or add more rewards
              ///  without first initializing the emissions schedule.
              3: "Emissions Not Initialized",
              /// The creator of a `AfterburnerVault` tries to update the vault's emission schedule/rate but
              ///  provides a schedule/rate pair that will decrease emissions for the specified reward type.
              4: "Emissions Not Increasing",
              5: "Bad Type",
              /// A user attempts to stake into a `AfterburnerVault` below the vault's `min_stake_amount` or
              ///  an amount of principal that would bring their position below the vault's `min_stake_amount`.
              6: "Invalid Stake Amount",
              /// A user attempts to create an `AfterburnerVault` and provides a `lock_enforcement` that doesn't
              ///  match one of `STRICT_LOCK_ENFORCEMENT` or `RELAXED_LOCK_ENFORCEMENT`.
              7: "Invalid Lock Enforcement",
              /// A user tries to claim zero rewards
              8: "Zero Claim",
              /// A user provided invalid max lock multiplier (< 1)
              9: "Invalid Lock Multiplier",
              10: "Invalid Argument",
              11: "Deprecated",
              12: "Afterburner Vault Still Active"
            },
            [_FarmsApi2.constants.moduleNames.stakedPosition]: {
              /// A user attempts provides a `Coin` or `u64` with value zero.
              0: "Zero",
              /// A user attempts to withdraw funds from a `StakedPosition` that is still locked.
              1: "Locked",
              /// A user provides a `StakedPosition` and a `AfterburnerVault` that don't correspond with one another.
              ///  This can only occur if two `AfterburnerVault` with the same underlying `STAKED` generic are created.
              2: "Invalid Afterburner Vault",
              /// A user tries to lock the coins in a `AfterburnerVault` with a `lock_duration_ms` below the vault's
              ///  `min_lock_duration_ms`.
              3: "Invalid Lock Duration",
              /// A user attempts to destroy a `StakedPosition` that still holds rewards that can be harvested.
              4: "Harvest Rewards",
              /// A user attempts to stake into a `AfterburnerVault` below the vault's `min_stake_amount` or
              ///  an amount of principal that would bring their position below the vault's `min_stake_amount`.
              5: "Invalid Stake Amount",
              6: "Invalid Withdraw Amount",
              7: "Invalid Split Amount",
              8: "Uninitialized Vault Rewards",
              9: "Not Implemented",
              /// A user requested to harvest zero base rewards.
              10: "Zero Rewards"
            }
          },
          [this.addresses.packages.vaultsV2]: {
            [_FarmsApi2.constants.moduleNames.vaultV2]: {
              /// A user provides a `Coin` with value zero.
              0: "Zero",
              /// A user tries to create a `Vault` where `min_lock_duration_ms` is strictly greater than
              /// `max_lock_duration_ms`.
              1: "Invalid Min Max Lock Durations",
              /// A user tries to create a `Vault` and provides a `u8` that does not map to a valid lock
              /// enforcement policy.
              2: "Invalid Lock Enforcement",
              /// The creator of a `Vault` tries to update the emission schedule or add more of a specific
              /// reward type that has not yet been initialized into the `Vault`.
              3: "Emissions Not Initialized",
              /// A `Reward` `Coin` type was passed to a function and either the `Reward` type does not
              /// correspond to any of the `Vault`'s reward types--for the functions that act on the `Reward`
              /// type--or, for `initialize_reward`, the `Reward` type has already had its emissions initialized.
              4: "Invalid Reward Coin Type",
              /// A user attempts to withdraw an amount of principal that would bring their position below the
              /// `Vault`'s `min_stake_amount`.
              5: "Invalid Stake Amount",
              /// A user tries to claim zero rewards
              6: "Zero Claim",
              /// A user provided a max lock multiplier that was strictly less than the minimum lower bound.
              7: "Invalid Lock Multiplier"
            },
            [_FarmsApi2.constants.moduleNames.stakedPosition]: {
              /// A user attempts to perform a restricted action on a `StakedPosition` that is still locked. For
              /// example `unlock` can only be called on a `StakedPosition` that is no longer locked.
              0: "Locked",
              /// A user provides a `StakedPosition` and a `Vault` that don't correspond with one another.
              /// This can only occur if two `Vault`s with the same underlying `Stake` generic are created.
              1: "Invalid Vault",
              /// A user tries to stake into a `Vault` with a `lock_duration_ms` below the vault's
              /// `min_lock_duration_ms`.
              2: "Invalid Lock Duration",
              /// A user attempts to withdraw an amount of principal that would bring their position below the
              /// `Vault`'s `min_stake_amount`.
              3: "Invalid Stake Amount",
              /// A user attempts to withdraw more principal than their `StakedPosition` holds.
              4: "Invalid Withdraw Amount",
              /// A user attempts to split more principal than their `StakedPosition` holds.
              5: "Invalid Split Amount",
              /// A user attempts to stake into a `Vault` that has no rewards.
              6: "Vault Is Inactive",
              /// A user requested to harvest a reward type for which they've only accrued less than the minimal
              /// claim amount.
              7: "Zero Rewards",
              /// A user attempts to stake into a `Vault` with a `LockEnforcement` policy that the vault does
              /// not support.
              8: "Invalid Lock Enforcement",
              /// A user attempts to call `destroy` on a `StakedPosition` that has unharvested rewards.
              9: "Position Has Unclaimed Rewards"
            }
          }
        };
      }
    };
    _FarmsApi.constants = {
      moduleNames: {
        vaultV1: "afterburner_vault",
        vaultV2: "vault",
        stakedPosition: "staked_position",
        vaultRegistry: "vault_registry",
        events: "events",
        authority: "authority"
      },
      eventNames: {
        // staking pools
        // creation
        createdVault: "CreatedVaultEvent",
        // mutation
        initializedReward: "InitializedRewardEvent",
        addedReward: "AddedRewardEvent",
        increasedEmissions: "IncreasedEmissionsEvent",
        updatedEmissions: "UpdatedEmissionsEvent",
        // staking positions
        // creation
        staked: "StakedEvent",
        stakedRelaxed: "StakedEventRelaxed",
        // locking
        locked: "LockedEvent",
        unlocked: "UnlockedEvent",
        // mutation
        joined: "JoinedEvent",
        split: "SplitEvent",
        // staking
        depositedPrincipal: "DepositedPrincipalEvent",
        withdrewPrincipal: "WithdrewPrincipalEvent",
        // reward harvesting
        harvestedRewards: "HarvestedRewardsEvent",
        // destruction
        destroyedStakedPosition: "DestroyedStakedPositionEvent"
      }
    };
    _FarmsApi.isFarmOneTimeAdminCapId = (inputs) => "oneTimeAdminCapId" in inputs;
    _FarmsApi.farmCapId = (inputs) => "ownerCapId" in inputs ? inputs.ownerCapId : inputs.oneTimeAdminCapId;
    FarmsApi = _FarmsApi;
  }
});
var _FaucetApi;
var FaucetApi;
var init_faucetApi = __esm({
  "src/packages/faucet/api/faucetApi.ts"() {
    "use strict";
    init_eventsApiHelpers();
    init_transactionsApiHelpers();
    init_utils();
    init_coin2();
    init_sui2();
    init_faucetApiCasting();
    _FaucetApi = class _FaucetApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchSupportedCoins = async () => {
          const addCoinEvents = await this.fetchAddCoinEvents({});
          const coins = addCoinEvents.events.map((event) => `0x${event.coinType}`);
          return coins;
        };
        this.requestCoinTx = (inputs) => {
          const { tx, coinType } = inputs;
          return tx.moveCall({
            target: TransactionsApiHelpers.createTxTarget(
              this.addresses.packages.faucet,
              _FaucetApi2.constants.moduleNames.faucet,
              "request_default_amount"
            ),
            typeArguments: [coinType],
            arguments: [tx.object(this.addresses.objects.faucet)]
          });
        };
        this.mintSuiFrenTx = (inputs) => {
          const { tx, suiPaymentCoinId, suiFrenType } = inputs;
          return tx.moveCall({
            target: TransactionsApiHelpers.createTxTarget(
              this.addresses.packages.suiFrensGenesisWrapper,
              _FaucetApi2.constants.moduleNames.suiFrensGenesisWrapper,
              "mint_and_keep"
            ),
            typeArguments: [suiFrenType],
            arguments: [
              tx.object(this.addresses.objects.suiFrensMint),
              // Mint
              tx.object(Sui.constants.addresses.suiClockId),
              // Clock
              typeof suiPaymentCoinId === "string" ? tx.object(suiPaymentCoinId) : suiPaymentCoinId
              // Coin
            ]
          });
        };
        this.buildRequestCoinTx = Helpers.transactions.createBuildTxFunc(
          this.requestCoinTx
        );
        this.fetchBuildMintSuiFrenTx = async (inputs) => {
          const { walletAddress, mintFee, suiFrenType } = inputs;
          const tx = new Transaction9();
          tx.setSender(walletAddress);
          const suiPaymentCoinId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: Coin.constants.suiCoinType,
            coinAmount: mintFee
          });
          this.mintSuiFrenTx({ tx, suiPaymentCoinId, suiFrenType });
          return tx;
        };
        this.fetchMintCoinEvents = async (inputs) => await this.api.Events().fetchCastEventsWithCursor({
          ...inputs,
          query: {
            MoveEventType: this.eventTypes.mintCoin
          },
          eventFromEventOnChain: FaucetApiCasting.faucetMintCoinEventFromOnChain
        });
        this.fetchAddCoinEvents = async (inputs) => await this.api.Events().fetchCastEventsWithCursor(
          {
            ...inputs,
            query: {
              MoveEventType: this.eventTypes.addCoin
            },
            eventFromEventOnChain: FaucetApiCasting.faucetAddCoinEventFromOnChain
          }
        );
        this.mintCoinEventType = () => {
          return EventsApiHelpers.createEventType(
            this.addresses.packages.faucet,
            _FaucetApi2.constants.moduleNames.faucet,
            _FaucetApi2.constants.eventNames.mintCoin
          );
        };
        this.addCoinEventType = () => {
          return EventsApiHelpers.createEventType(
            this.addresses.packages.faucet,
            _FaucetApi2.constants.moduleNames.faucet,
            _FaucetApi2.constants.eventNames.addCoin
          );
        };
        const addresses = this.api.addresses.faucet;
        if (!addresses) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = addresses;
        this.eventTypes = {
          mintCoin: this.mintCoinEventType(),
          addCoin: this.addCoinEventType()
        };
      }
    };
    _FaucetApi.constants = {
      moduleNames: {
        faucet: "faucet",
        suiFrensGenesisWrapper: "genesis_wrapper"
      },
      eventNames: {
        mintCoin: "MintedCoin",
        addCoin: "AddedCoinEvent"
      }
    };
    FaucetApi = _FaucetApi;
  }
});
var LimitOrdersApi;
var init_limitOrdersApi = __esm({
  "src/packages/limitOrders/api/limitOrdersApi.ts"() {
    "use strict";
    init_eventsApiHelpers();
    LimitOrdersApi = class {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.createdOrderEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.events,
          "events",
          "CreatedOrderEventV1"
        );
        const addresses = this.api.addresses.limitOrders;
        if (!addresses) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = addresses;
        this.eventTypes = {
          createdOrder: this.createdOrderEventType()
        };
      }
    };
  }
});
var MultisigApi;
var init_multisigApi = __esm({
  "src/packages/multisig/api/multisigApi.ts"() {
    "use strict";
    MultisigApi = class {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        const sharedCustodyAddresses = this.api.addresses.sharedCustody;
        if (!sharedCustodyAddresses) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.sharedCustodyAddresses = sharedCustodyAddresses;
      }
      // =========================================================================
      //  Fetch
      // =========================================================================
      getMultisigForUser(inputs) {
        const afPublicKeyBuffer = Buffer.from(
          this.sharedCustodyAddresses.publicKey || "",
          "base64"
        );
        const afPublicKeyArray = new Uint8Array(afPublicKeyBuffer).subarray(1);
        const afPK = new Ed25519PublicKey(afPublicKeyArray);
        const userPublicKeyArray = new Uint8Array(inputs.userPublicKey);
        const userPK = new Ed25519PublicKey(
          userPublicKeyArray.length === 33 ? userPublicKeyArray.subarray(1) : userPublicKeyArray
        );
        const newMultiSigPublicKey = MultiSigPublicKey.fromPublicKeys({
          threshold: 1,
          publicKeys: [
            { publicKey: afPK, weight: 1 },
            { publicKey: userPK, weight: 1 }
          ]
        });
        return {
          publicKey: newMultiSigPublicKey,
          address: newMultiSigPublicKey.toSuiAddress()
        };
      }
    };
  }
});
var _NftAmmApi;
var NftAmmApi;
var init_nftAmmApi = __esm({
  "src/packages/nftAmm/api/nftAmmApi.ts"() {
    "use strict";
    init_utils();
    init_coin();
    init_pools();
    init_nftAmmApiCasting();
    _NftAmmApi = class _NftAmmApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchNftsInMarketTable = async (inputs) => {
          return await this.api.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor({
            ...inputs,
            parentObjectId: inputs.marketTableObjectId,
            objectsFromObjectIds: (objectIds) => this.api.Nfts().fetchNfts({ objectIds })
          });
        };
        this.fetchMarket = async (inputs) => {
          return this.api.Objects().fetchCastObject({
            ...inputs,
            objectFromSuiObjectResponse: NftAmmApiCasting.marketObjectFromSuiObject
          });
        };
        this.fetchMarkets = async (inputs) => {
          return this.api.Objects().fetchCastObjectBatch({
            ...inputs,
            objectFromSuiObjectResponse: NftAmmApiCasting.marketObjectFromSuiObject
          });
        };
        this.fetchBuildBuyTx = async (inputs) => {
          const tx = new Transaction10();
          tx.setSender(inputs.walletAddress);
          const { market } = inputs;
          const marketObject = market.market;
          const expectedAssetCoinAmountIn = market.getBuyAssetCoinAmountIn({
            nftsCount: inputs.nftObjectIds.length,
            referral: inputs.referrer !== void 0
          });
          const assetCoin = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress: inputs.walletAddress,
            coinType: marketObject.assetCoinType,
            coinAmount: expectedAssetCoinAmountIn
          });
          this.buyTx({
            tx,
            ...inputs,
            marketObjectId: marketObject.objectId,
            genericTypes: _NftAmmApi2.genericTypesForMarket({ market }),
            assetCoin,
            expectedAssetCoinAmountIn,
            withTransfer: true
          });
          return tx;
        };
        this.fetchBuildSellTx = async (inputs) => {
          const tx = new Transaction10();
          tx.setSender(inputs.walletAddress);
          const { market } = inputs;
          const marketObject = market.market;
          const expectedAssetCoinAmountOut = market.getSellAssetCoinAmountOut({
            nftsCount: inputs.nftObjectIds.length,
            referral: inputs.referrer !== void 0
          });
          this.sellTx({
            ...inputs,
            tx,
            nfts: inputs.nftObjectIds,
            marketObjectId: marketObject.objectId,
            genericTypes: _NftAmmApi2.genericTypesForMarket({ market }),
            expectedAssetCoinAmountOut,
            withTransfer: true
          });
          return tx;
        };
        this.fetchBuildDepositTx = async (inputs) => {
          const tx = new Transaction10();
          tx.setSender(inputs.walletAddress);
          const { market } = inputs;
          const marketObject = market.market;
          const { lpRatio } = market.getDepositLpCoinAmountOut({
            assetCoinAmountIn: inputs.assetCoinAmountIn,
            referral: inputs.referrer !== void 0
          });
          const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);
          const assetCoin = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress: inputs.walletAddress,
            coinType: marketObject.assetCoinType,
            coinAmount: inputs.assetCoinAmountIn
          });
          this.depositTx({
            tx,
            ...inputs,
            marketObjectId: marketObject.objectId,
            genericTypes: _NftAmmApi2.genericTypesForMarket({ market }),
            expectedLpRatio,
            assetCoin,
            withTransfer: true
          });
          return tx;
        };
        this.fetchBuildWithdrawTx = async (inputs) => {
          const tx = new Transaction10();
          tx.setSender(inputs.walletAddress);
          const { market } = inputs;
          const marketObject = market.market;
          const fractionalizedCoinAmountOut = market.getWithdrawFractionalizedCoinAmountOut({
            lpCoinAmount: inputs.lpCoinAmount,
            referral: inputs.referrer !== void 0
          });
          const { balances: coinAmountsOut } = Coin.coinsAndBalancesOverZero({
            [marketObject.fractionalizedCoinType]: fractionalizedCoinAmountOut
          });
          const expectedAssetCoinAmountOut = coinAmountsOut[0];
          const lpCoin = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress: inputs.walletAddress,
            coinType: marketObject.lpCoinType,
            coinAmount: inputs.lpCoinAmount
          });
          this.addWithdrawCommandToTransaction({
            tx,
            ...inputs,
            marketObjectId: marketObject.objectId,
            genericTypes: _NftAmmApi2.genericTypesForMarket({ market }),
            expectedAssetCoinAmountOut,
            lpCoin,
            withTransfer: true
          });
          return tx;
        };
        this.buyTx = (inputs) => {
          const { tx, assetCoin, genericTypes, nftObjectIds } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.nftAmm,
              inputs.withTransfer ? _NftAmmApi2.constants.moduleNames.interface : _NftAmmApi2.constants.moduleNames.actions,
              "buy"
            ),
            typeArguments: genericTypes,
            arguments: [
              tx.object(inputs.marketObjectId),
              tx.object(this.addresses.objects.protocolFeeVault),
              tx.object(this.addresses.objects.treasury),
              tx.object(this.addresses.objects.insuranceFund),
              tx.object(this.addresses.objects.referralVault),
              typeof assetCoin === "string" ? tx.object(assetCoin) : assetCoin,
              tx.makeMoveVec({
                elements: nftObjectIds.map((id) => tx.object(id)),
                type: "ID"
              }),
              tx.pure.u64(inputs.expectedAssetCoinAmountIn.toString()),
              tx.pure.u64(Pools.normalizeInvertSlippage(inputs.slippage))
            ]
          });
        };
        this.sellTx = (inputs) => {
          const { tx, genericTypes, nfts } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.nftAmm,
              inputs.withTransfer ? _NftAmmApi2.constants.moduleNames.interface : _NftAmmApi2.constants.moduleNames.actions,
              "sell"
            ),
            typeArguments: genericTypes,
            arguments: [
              tx.object(inputs.marketObjectId),
              tx.object(this.addresses.objects.protocolFeeVault),
              tx.object(this.addresses.objects.treasury),
              tx.object(this.addresses.objects.insuranceFund),
              tx.object(this.addresses.objects.referralVault),
              tx.makeMoveVec({
                elements: Helpers.isArrayOfStrings(nfts) ? nfts.map((nft) => tx.object(nft)) : nfts,
                type: genericTypes[3]
              }),
              tx.pure.u64(inputs.expectedAssetCoinAmountOut.toString()),
              tx.pure.u64(Pools.normalizeInvertSlippage(inputs.slippage))
            ]
          });
        };
        this.depositTx = (inputs) => {
          const { tx, assetCoin, genericTypes, nfts } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.nftAmm,
              inputs.withTransfer ? _NftAmmApi2.constants.moduleNames.interface : _NftAmmApi2.constants.moduleNames.actions,
              "deposit"
            ),
            typeArguments: genericTypes,
            arguments: [
              tx.object(inputs.marketObjectId),
              tx.object(this.addresses.objects.protocolFeeVault),
              tx.object(this.addresses.objects.treasury),
              tx.object(this.addresses.objects.insuranceFund),
              tx.object(this.addresses.objects.referralVault),
              typeof assetCoin === "string" ? tx.object(assetCoin) : assetCoin,
              tx.makeMoveVec({
                elements: Helpers.isArrayOfStrings(nfts) ? nfts.map((nft) => tx.object(nft)) : nfts,
                type: genericTypes[3]
              }),
              tx.pure.u64(inputs.expectedLpRatio.toString()),
              tx.pure.u64(Pools.normalizeInvertSlippage(inputs.slippage))
            ]
          });
        };
        this.addWithdrawCommandToTransaction = (inputs) => {
          const { tx, lpCoin, genericTypes, nftObjectIds } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.nftAmm,
              inputs.withTransfer ? _NftAmmApi2.constants.moduleNames.interface : _NftAmmApi2.constants.moduleNames.actions,
              "withdraw"
            ),
            typeArguments: genericTypes,
            arguments: [
              tx.object(inputs.marketObjectId),
              tx.object(this.addresses.objects.protocolFeeVault),
              tx.object(this.addresses.objects.treasury),
              tx.object(this.addresses.objects.insuranceFund),
              tx.object(this.addresses.objects.referralVault),
              typeof lpCoin === "string" ? tx.object(lpCoin) : lpCoin,
              tx.makeMoveVec({
                elements: nftObjectIds.map((id) => tx.object(id)),
                type: "ID"
              }),
              tx.pure.u64(inputs.expectedAssetCoinAmountOut.toString()),
              tx.pure.u64(Pools.normalizeInvertSlippage(inputs.slippage))
            ]
          });
        };
        const addresses = this.api.addresses.nftAmm;
        if (!addresses) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = addresses;
      }
    };
    _NftAmmApi.constants = {
      moduleNames: {
        interface: "interface",
        actions: "actions",
        market: "market"
      }
    };
    _NftAmmApi.genericTypesForMarket = (inputs) => {
      const marketObject = inputs.market.market;
      return [
        marketObject.lpCoinType,
        marketObject.fractionalizedCoinType,
        marketObject.assetCoinType,
        marketObject.nftType
      ];
    };
    NftAmmApi = _NftAmmApi;
  }
});
var _PerpetualsApi;
var PerpetualsApi;
var init_perpetualsApi = __esm({
  "src/packages/perpetuals/api/perpetualsApi.ts"() {
    "use strict";
    init_eventsApiHelpers();
    _PerpetualsApi = class _PerpetualsApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.getAccountCapType = (inputs) => {
          return `${this.addresses.packages.events}::${_PerpetualsApi2.constants.moduleNames.account}::Account<${inputs.collateralCoinType}>`;
        };
        this.eventType = (eventName) => EventsApiHelpers.createEventType(
          this.addresses.packages.events,
          _PerpetualsApi2.constants.moduleNames.events,
          eventName
        );
        const addresses = this.api.addresses.perpetuals;
        if (!addresses) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = addresses;
        this.eventTypes = {
          // Collateral
          withdrewCollateral: this.eventType("WithdrewCollateral"),
          depositedCollateral: this.eventType("DepositedCollateral"),
          settledFunding: this.eventType("SettledFunding"),
          allocatedCollateral: this.eventType("AllocatedCollateral"),
          deallocatedCollateral: this.eventType("DeallocatedCollateral"),
          // Liquidation
          liquidated: this.eventType("LiquidatedPosition"),
          filledTakerOrderLiquidator: this.eventType("FilledTakerOrderLiquidator"),
          performedLiquidation: this.eventType("PerformedLiquidation"),
          // Account
          createdAccount: this.eventType("CreatedAccount"),
          // Order
          canceledOrder: this.eventType("CanceledOrder"),
          filledMakerOrders: this.eventType("FilledMakerOrders"),
          filledMakerOrder: this.eventType("FilledMakerOrder"),
          filledTakerOrder: this.eventType("FilledTakerOrder"),
          reducedOrder: this.eventType("ReducedOrder"),
          postedOrder: this.eventType("PostedOrder"),
          // Twap
          updatedPremiumTwap: this.eventType("UpdatedPremiumTwap"),
          updatedSpreadTwap: this.eventType("UpdatedSpreadTwap"),
          // Funding
          updatedFunding: this.eventType("UpdatedFunding"),
          // Version
          updatedMarketVersion: this.eventType("UpdatedClearingHouseVersion"),
          // Stop Order
          createdStopOrderTicket: this.eventType("CreatedStopOrderTicket"),
          deletedStopOrderTicket: this.eventType("DeletedStopOrderTicket"),
          editedStopOrderTicketExecutor: this.eventType(
            "EditedStopOrderTicketExecutor"
          ),
          addedStopOrderTicketCollateral: this.eventType(
            "AddedStopOrderTicketCollateral"
          ),
          removedStopOrderTicketCollateral: this.eventType(
            "RemovedStopOrderTicketCollateral"
          ),
          editedStopOrderTicketDetails: this.eventType(
            "EditedStopOrderTicketDetails"
          ),
          executedStopOrderTicket: this.eventType("ExecutedStopOrderTicket"),
          // ADL
          performedAdl: this.eventType("PerformedADL")
        };
        this.moveErrors = {
          // TODO: add support for this back in some way ?
          // [this.addresses.packages.perpetuals]: {
          // 	["ANY"]: {
          // 		// ClearingHouse
          // 		/// Cannot deposit/withdraw zero coins to/from the account's collateral.
          // 		0: "Deposit Or Withdraw Amount Zero",
          // 		/// Orderbook size or price are invalid values
          // 		1: "Invalid Size Or Price",
          // 		/// Index price returned from oracle is 0 or invalid value
          // 		2: "Bad Index Price",
          // 		/// Order value in USD is too low
          // 		4: "Order Usd Value Too Low",
          // 		/// Passed a vector of invalid order ids to perform force cancellation during liquidation
          // 		5: "Invalid Force Cancel Ids",
          // 		/// Liquidate must be the first operation of the session, if performed.
          // 		6: "Liquidate Not First Operation",
          // 		/// Passed a vector of invalid order ids to cancel
          // 		7: "Invalid Cancel Order Ids",
          // 		/// Ticket has already passed `expire_timestamp` and can only be cancelled
          // 		8: "Stop Order Ticket Expired",
          // 		/// Index price is not at correct value to satisfy stop order conditions
          // 		9: "Stop Order Conditions Violated",
          // 		/// Index price is not at correct value to satisfy stop order conditions
          // 		10: "Wrong Order Details",
          // 		/// Invalid base price feed storage for the clearing house
          // 		11: "Invalid Base Price Feed Storage",
          // 		/// Same liquidator and liqee account ids
          // 		12: "Self Liquidation",
          // 		/// User trying to access the subaccount is not the one specified by parent
          // 		13: "Invalid Sub Account User",
          // 		/// The parent `Account` trying to delete the subaccount is not the correct one.
          // 		14: "Wrong Parent For Sub Account",
          // 		/// Raised when trying to delete a subaccount still containing collateral.
          // 		15: "Sub Account Contains Collateral",
          // 		/// Raised when trying to call a function with the wrong package's version
          // 		16: "Wrong Version",
          // 		/// Raised when trying to have a session composed by only `start_session` and `end_session`
          // 		17: "Empty Session",
          // 		/// Market already registered in the registry
          // 		18: "Market Already Registered",
          // 		/// Collateral is not registered in the registry
          // 		19: "Collateral Is Not Registered",
          // 		/// Market is not registered in the registry
          // 		20: "Market Is Not Registered",
          // 		/// Invalid collateral price feed storage for the clearing house
          // 		21: "Invalid Collateral Price Feed Storage",
          // 		/// Fees accrued are negative
          // 		22: "Negative Fees Accrued",
          // 		/// Reduce-only conditions are not respected for stop order execution
          // 		23: "Not Reduce Only Stop Order",
          // 		/// Stop order gas cost provided is not enough
          // 		24: "Not Enough Gas For Stop Order",
          // 		/// Stop order collateral to allocate provided is not enough
          // 		25: "Not Enough Collateral To Allocate For Stop Order",
          // 		/// Invalid account trying to perform an action on a StopOrderTicket
          // 		26: "Invalid Account For Stop Order",
          // 		/// Invalid executor trying to execute the StopOrderTicket
          // 		27: "Invalid Executor For Stop Order",
          // 		/// Raised when the market's max open interest is surpassed as a result of the session's actions
          // 		28: "Max Open Interest Surpassed",
          // 		/// Raised when a position would get a base amount higher than the allowed percentage of open interest
          // 		29: "Max Open Interest Position Percent Surpassed",
          // 		// Market
          // 		/// While creating ordered map with invalid parameters, or changing them improperly for an existent map.
          // 		1000: "Invalid Market Parameters",
          // 		/// Tried to call `update_funding` before enough time has passed since the last update.
          // 		1001: "Updating Funding Too Early",
          // 		/// Margin-ratio update proposal already exists for market
          // 		1002: "Proposal Already Exists",
          // 		/// Margin-ratio update proposal cannot be committed too early
          // 		1003: "Premature Proposal",
          // 		/// Margin-ratio update proposal delay is outside the valid range
          // 		1004: "Invalid Proposal Delay",
          // 		/// Margin-ratio update proposal does not exist for market
          // 		1005: "Proposal Does Not Exist",
          // 		/// Exchange has no available fees to withdraw
          // 		1006: "No Fees Accrued",
          // 		/// Tried to withdraw more insurance funds than the allowed amount
          // 		1007: "Insufficient Insurance Surplus",
          // 		/// Cannot create a market for which a price feed does not exist
          // 		1008: "No Price Feed For Market",
          // 		/// Cannot delete a proposal that already matured. It can only be committed.
          // 		1009: "Proposal Already Matured",
          // 		// Position
          // 		/// Tried placing a new pending order when the position already has the maximum allowed number of pending orders.
          // 		2000: "Max Pending Orders Exceeded",
          // 		/// Used for checking both liqee and liqor positions during liquidation
          // 		2001: "Position Below IMR",
          // 		///When leaving liqee's position with a margin ratio above tolerance,
          // 		/// meaning that liqor has overbought position
          // 		2002: "Position Above Tolerance",
          // 		/// An operation brought an account below initial margin requirements.
          // 		2003: "Initial Margin Requirement Violated",
          // 		/// Position is above MMR, so can't be liquidated.
          // 		2004: "Position Above MMR",
          // 		/// Cannot realize bad debt via means other than calling 'liquidate'.
          // 		2005: "Position Bad Debt",
          // 		/// Cannot withdraw more than the account's free collateral.
          // 		2006: "Insufficient Free Collateral",
          // 		/// Cannot have more than 1 position in a market.
          // 		2007: "Position Already Exists",
          // 		/// Cannot compute deallocate amount for a target MR < IMR.
          // 		2008: "Deallocate Target MR Too Low",
          // 		// Orderbook & OrderedMap
          // 		/// While creating ordered map with wrong parameters.
          // 		3000: "Invalid Map Parameters",
          // 		/// While searching for a key, but it doesn't exist.
          // 		3001: "Key Not Exist",
          // 		/// While inserting already existing key.
          // 		3002: "Key Already Exists",
          // 		/// When attempting to destroy a non-empty map
          // 		3003: "Destroy Not Empty",
          // 		/// Invalid user tries to modify an order
          // 		3004: "Invalid User For Order",
          // 		/// Orderbook flag requirements violated
          // 		3005: "Flag Requirements Violated",
          // 		/// Minimum size matched not reached
          // 		3006: "Not Enough Liquidity",
          // 		/// When trying to change a map configuration, but the map has length less than 4
          // 		3007: "Map Too Small",
          // 		/// When taker matches its own order
          // 		3008: "Self Trading",
          // 	},
          // },
        };
      }
      // =========================================================================
      //  Object Types
      // =========================================================================
      // private marketObjectType = (inputs: { collateralCoinType: CoinType }) =>
      // 	`${
      // 		inputs.packageId
      // 	}::clearing_house::ClearingHouse<${Helpers.addLeadingZeroesToType(
      // 		inputs.collateralCoinType
      // 	)}>`;
    };
    _PerpetualsApi.constants = {
      moduleNames: {
        interface: "interface",
        orderbook: "orderbook",
        events: "events",
        clearingHouse: "clearing_house",
        account: "account"
      }
    };
    PerpetualsApi = _PerpetualsApi;
  }
});
var _PoolsApi;
var PoolsApi;
var init_poolsApi = __esm({
  "src/packages/pools/api/poolsApi.ts"() {
    "use strict";
    init_eventsApiHelpers();
    init_utils();
    init_casting();
    init_coin2();
    init_pools();
    _PoolsApi = class _PoolsApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates an instance of PoolsApi.
       * @param {AftermathApi} api - An instance of AftermathApi.
       * @throws {Error} Throws an error if not all required addresses have been set in AfSdk
       */
      constructor(api) {
        this.api = api;
        this.fetchOwnedDaoFeePoolOwnerCaps = (inputs) => {
          const { walletAddress } = inputs;
          if (!this.objectTypes.daoFeePoolOwnerCap) {
            throw new Error("dao fee pool addresses have not been set in provider");
          }
          return this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
            walletAddress,
            objectType: this.objectTypes.daoFeePoolOwnerCap,
            objectFromSuiObjectResponse: Casting.pools.daoFeePoolOwnerCapObjectFromSuiObjectResponse
          });
        };
        this.tradeTx = (inputs) => {
          const {
            tx,
            poolId,
            coinInId,
            coinInType,
            expectedCoinOutAmount,
            coinOutType,
            lpCoinType,
            slippage,
            withTransfer
          } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              withTransfer ? this.addresses.pools.packages.ammInterface : this.addresses.pools.packages.amm,
              withTransfer ? _PoolsApi2.constants.moduleNames.interface : _PoolsApi2.constants.moduleNames.swap,
              "swap_exact_in"
            ),
            typeArguments: [lpCoinType, coinInType, coinOutType],
            arguments: [
              tx.object(poolId),
              tx.object(this.addresses.pools.objects.poolRegistry),
              tx.object(this.addresses.pools.objects.protocolFeeVault),
              tx.object(this.addresses.pools.objects.treasury),
              tx.object(this.addresses.pools.objects.insuranceFund),
              tx.object(this.addresses.referralVault.objects.referralVault),
              typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
              tx.pure.u64(expectedCoinOutAmount.toString()),
              tx.pure.u64(Pools.normalizeInvertSlippage(slippage))
            ]
          });
        };
        this.multiCoinDepositTx = (inputs) => {
          const {
            tx,
            poolId,
            coinIds,
            coinTypes,
            expectedLpRatio,
            lpCoinType,
            slippage,
            withTransfer
          } = inputs;
          const poolSize = coinTypes.length;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              withTransfer ? this.addresses.pools.packages.ammInterface : this.addresses.pools.packages.amm,
              withTransfer ? _PoolsApi2.constants.moduleNames.interface : _PoolsApi2.constants.moduleNames.deposit,
              `deposit_${poolSize}_coins`
            ),
            typeArguments: [lpCoinType, ...coinTypes],
            arguments: [
              tx.object(poolId),
              tx.object(this.addresses.pools.objects.poolRegistry),
              tx.object(this.addresses.pools.objects.protocolFeeVault),
              tx.object(this.addresses.pools.objects.treasury),
              tx.object(this.addresses.pools.objects.insuranceFund),
              tx.object(this.addresses.referralVault.objects.referralVault),
              ...coinIds.map(
                (coinId) => typeof coinId === "string" ? tx.object(coinId) : coinId
              ),
              tx.pure.u128(expectedLpRatio.toString()),
              tx.pure.u64(Pools.normalizeInvertSlippage(slippage))
            ]
          });
        };
        this.multiCoinWithdrawTx = (inputs) => {
          const {
            tx,
            poolId,
            lpCoinId,
            expectedAmountsOut,
            coinTypes,
            lpCoinType,
            slippage,
            withTransfer
          } = inputs;
          const poolSize = coinTypes.length;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              withTransfer ? this.addresses.pools.packages.ammInterface : this.addresses.pools.packages.amm,
              withTransfer ? _PoolsApi2.constants.moduleNames.interface : _PoolsApi2.constants.moduleNames.withdraw,
              `withdraw_${poolSize}_coins`
            ),
            typeArguments: [lpCoinType, ...coinTypes],
            arguments: [
              tx.object(poolId),
              tx.object(this.addresses.pools.objects.poolRegistry),
              tx.object(this.addresses.pools.objects.protocolFeeVault),
              tx.object(this.addresses.pools.objects.treasury),
              tx.object(this.addresses.pools.objects.insuranceFund),
              tx.object(this.addresses.referralVault.objects.referralVault),
              typeof lpCoinId === "string" ? tx.object(lpCoinId) : lpCoinId,
              tx.pure(
                bcs2.vector(bcs2.u64()).serialize(expectedAmountsOut.map((amount) => amount.toString()))
              ),
              tx.pure.u64(Pools.normalizeInvertSlippage(slippage))
            ]
          });
        };
        this.allCoinWithdrawTx = (inputs) => {
          const { tx, poolId, lpCoinId, coinTypes, lpCoinType, withTransfer } = inputs;
          const poolSize = coinTypes.length;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              withTransfer ? this.addresses.pools.packages.ammInterface : this.addresses.pools.packages.amm,
              withTransfer ? _PoolsApi2.constants.moduleNames.interface : _PoolsApi2.constants.moduleNames.withdraw,
              `all_coin_withdraw_${poolSize}_coins`
            ),
            typeArguments: [lpCoinType, ...coinTypes],
            arguments: [
              tx.object(poolId),
              tx.object(this.addresses.pools.objects.poolRegistry),
              tx.object(this.addresses.pools.objects.protocolFeeVault),
              tx.object(this.addresses.pools.objects.treasury),
              tx.object(this.addresses.pools.objects.insuranceFund),
              tx.object(this.addresses.referralVault.objects.referralVault),
              typeof lpCoinId === "string" ? tx.object(lpCoinId) : lpCoinId
            ]
          });
        };
        this.publishLpCoinTx = (inputs) => {
          const compilations = this.addresses.pools.other?.createLpCoinPackageCompilations;
          if (!compilations) {
            throw new Error(
              "not all required addresses have been set in provider for lp coin publishing (requires package compilations)"
            );
          }
          const { tx, lpCoinDecimals } = inputs;
          const compiledModulesAndDeps = JSON.parse(compilations[lpCoinDecimals]);
          return tx.publish({
            modules: compiledModulesAndDeps.modules.map(
              (m) => Array.from(fromBase64(m))
            ),
            dependencies: compiledModulesAndDeps.dependencies.map(
              (addr) => normalizeSuiObjectId(addr)
            )
          });
        };
        this.createPoolTx = (inputs) => {
          const {
            tx,
            lpCoinType,
            createPoolCapId,
            coinsInfo,
            lpCoinMetadata,
            lpCoinDescription,
            lpCoinIconUrl,
            withTransfer
          } = inputs;
          const poolSize = coinsInfo.length;
          const coinTypes = coinsInfo.map((coin) => coin.coinType);
          const decimals = coinsInfo.map((coin) => coin.decimals);
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              withTransfer ? this.addresses.pools.packages.ammInterface : this.addresses.pools.packages.amm,
              withTransfer ? _PoolsApi2.constants.moduleNames.interface : _PoolsApi2.constants.moduleNames.poolFactory,
              `create_pool_${poolSize}_coins`
            ),
            typeArguments: [lpCoinType, ...coinTypes],
            arguments: [
              typeof createPoolCapId === "string" ? tx.object(createPoolCapId) : createPoolCapId,
              tx.object(this.addresses.pools.objects.poolRegistry),
              tx.pure(
                bcs2.vector(bcs2.u8()).serialize(Casting.u8VectorFromString(inputs.poolName))
              ),
              tx.pure(
                bcs2.vector(bcs2.u8()).serialize(
                  Casting.u8VectorFromString(lpCoinMetadata.name.toString())
                )
              ),
              tx.pure(
                bcs2.vector(bcs2.u8()).serialize(
                  Casting.u8VectorFromString(
                    lpCoinMetadata.symbol.toString().toUpperCase()
                  )
                )
              ),
              tx.pure(
                bcs2.vector(bcs2.u8()).serialize(Casting.u8VectorFromString(lpCoinDescription))
              ),
              tx.pure(
                bcs2.vector(bcs2.u8()).serialize(Casting.u8VectorFromString(lpCoinIconUrl))
              ),
              // lp_icon_url
              tx.pure(
                bcs2.vector(bcs2.u64()).serialize(coinsInfo.map((coin) => coin.weight))
              ),
              tx.pure.u64(inputs.poolFlatness),
              tx.pure(
                bcs2.vector(bcs2.u64()).serialize(coinsInfo.map((coin) => coin.tradeFeeIn))
              ),
              tx.pure(
                bcs2.vector(bcs2.u64()).serialize(coinsInfo.map((coin) => coin.tradeFeeOut))
              ),
              tx.pure(
                bcs2.vector(bcs2.u64()).serialize(coinsInfo.map((coin) => coin.depositFee))
              ),
              tx.pure(
                bcs2.vector(bcs2.u64()).serialize(coinsInfo.map((coin) => coin.withdrawFee))
              ),
              ...coinsInfo.map(
                (coin) => typeof coin.coinId === "string" ? tx.object(coin.coinId) : coin.coinId
              ),
              tx.pure(
                bcs2.option(bcs2.vector(bcs2.u8())).serialize(
                  decimals.includes(void 0) ? void 0 : decimals
                )
              ),
              // decimals
              tx.pure.bool(inputs.respectDecimals),
              // respect_decimals
              tx.pure(bcs2.option(bcs2.u8()).serialize(inputs.forceLpDecimals))
              // force_lp_decimals
            ]
          });
        };
        this.poolObjectIdForLpCoinTypeTx = (inputs) => {
          const { tx, lpCoinType } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.pools.packages.amm,
              _PoolsApi2.constants.moduleNames.poolRegistry,
              "lp_type_to_pool_id"
            ),
            typeArguments: [lpCoinType],
            arguments: [tx.object(this.addresses.pools.objects.poolRegistry)]
          });
        };
        this.daoFeePoolNewTx = (inputs) => {
          const { tx, poolId } = inputs;
          if (!this.addresses.daoFeePools) {
            throw new Error("dao fee pool addresses have not been set in provider");
          }
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.daoFeePools.packages.amm,
              _PoolsApi2.constants.moduleNames.pool,
              "new"
            ),
            typeArguments: [inputs.lpCoinType],
            arguments: [
              typeof poolId === "string" ? tx.object(poolId) : poolId,
              // Pool
              tx.object(this.addresses.daoFeePools.objects.version),
              tx.pure.u16(Number(inputs.feeBps)),
              tx.pure.address(inputs.feeRecipient)
            ]
          });
        };
        this.daoFeePoolUpdateFeeBpsTx = (inputs) => {
          const { tx } = inputs;
          if (!this.addresses.daoFeePools) {
            throw new Error("dao fee pool addresses have not been set in provider");
          }
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.daoFeePools.packages.amm,
              _PoolsApi2.constants.moduleNames.pool,
              "update_fee_bps"
            ),
            typeArguments: [inputs.lpCoinType],
            arguments: [
              tx.object(inputs.daoFeePoolOwnerCapId),
              // OwnerCap
              tx.object(inputs.daoFeePoolId),
              // DaoFeePool
              tx.object(this.addresses.daoFeePools.objects.version),
              tx.pure.u16(Number(inputs.newFeeBps))
            ]
          });
        };
        this.daoFeePoolUpdateFeeRecipientTx = (inputs) => {
          const { tx } = inputs;
          if (!this.addresses.daoFeePools) {
            throw new Error("dao fee pool addresses have not been set in provider");
          }
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.daoFeePools.packages.amm,
              _PoolsApi2.constants.moduleNames.pool,
              "update_fee_recipient"
            ),
            typeArguments: [inputs.lpCoinType],
            arguments: [
              tx.object(inputs.daoFeePoolOwnerCapId),
              // OwnerCap
              tx.object(inputs.daoFeePoolId),
              // DaoFeePool
              tx.object(this.addresses.daoFeePools.objects.version),
              tx.pure.address(inputs.newFeeRecipient)
            ]
          });
        };
        this.daoFeePoolTradeTx = (inputs) => {
          const {
            tx,
            daoFeePoolId,
            coinInId,
            coinInType,
            expectedCoinOutAmount,
            coinOutType,
            lpCoinType,
            slippage
          } = inputs;
          if (!this.addresses.daoFeePools) {
            throw new Error("dao fee pool addresses have not been set in provider");
          }
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.daoFeePools.packages.amm,
              _PoolsApi2.constants.moduleNames.swap,
              "swap_exact_in"
            ),
            typeArguments: [lpCoinType, coinInType, coinOutType],
            arguments: [
              tx.object(daoFeePoolId),
              tx.object(this.addresses.daoFeePools.objects.version),
              tx.object(this.addresses.pools.objects.poolRegistry),
              tx.object(this.addresses.pools.objects.protocolFeeVault),
              tx.object(this.addresses.pools.objects.treasury),
              tx.object(this.addresses.pools.objects.insuranceFund),
              tx.object(this.addresses.referralVault.objects.referralVault),
              typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
              tx.pure.u64(expectedCoinOutAmount.toString()),
              tx.pure.u64(Pools.normalizeInvertSlippage(slippage))
            ]
          });
        };
        this.daoFeePoolMultiCoinDepositTx = (inputs) => {
          const {
            tx,
            daoFeePoolId,
            coinIds,
            coinTypes,
            expectedLpRatio,
            lpCoinType,
            slippage
          } = inputs;
          if (!this.addresses.daoFeePools) {
            throw new Error("dao fee pool addresses have not been set in provider");
          }
          const poolSize = coinTypes.length;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.daoFeePools.packages.amm,
              _PoolsApi2.constants.moduleNames.deposit,
              `deposit_${poolSize}_coins`
            ),
            typeArguments: [lpCoinType, ...coinTypes],
            arguments: [
              tx.object(daoFeePoolId),
              tx.object(this.addresses.daoFeePools.objects.version),
              tx.object(this.addresses.pools.objects.poolRegistry),
              tx.object(this.addresses.pools.objects.protocolFeeVault),
              tx.object(this.addresses.pools.objects.treasury),
              tx.object(this.addresses.pools.objects.insuranceFund),
              tx.object(this.addresses.referralVault.objects.referralVault),
              ...coinIds.map(
                (coinId) => typeof coinId === "string" ? tx.object(coinId) : coinId
              ),
              tx.pure.u128(expectedLpRatio.toString()),
              tx.pure.u64(Pools.normalizeInvertSlippage(slippage))
            ]
          });
        };
        this.daoFeePoolAllCoinWithdrawTx = (inputs) => {
          const { tx, daoFeePoolId, lpCoinId, coinTypes, lpCoinType } = inputs;
          if (!this.addresses.daoFeePools) {
            throw new Error("dao fee pool addresses have not been set in provider");
          }
          const poolSize = coinTypes.length;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.daoFeePools.packages.amm,
              _PoolsApi2.constants.moduleNames.withdraw,
              `all_coin_withdraw_${poolSize}_coins`
            ),
            typeArguments: [lpCoinType, ...coinTypes],
            arguments: [
              tx.object(daoFeePoolId),
              tx.object(this.addresses.daoFeePools.objects.version),
              tx.object(this.addresses.pools.objects.poolRegistry),
              tx.object(this.addresses.pools.objects.protocolFeeVault),
              tx.object(this.addresses.pools.objects.treasury),
              tx.object(this.addresses.pools.objects.insuranceFund),
              tx.object(this.addresses.referralVault.objects.referralVault),
              typeof lpCoinId === "string" ? tx.object(lpCoinId) : lpCoinId
            ]
          });
        };
        this.fetchBuildTradeTx = async (inputs) => {
          const {
            walletAddress,
            pool,
            coinInAmount,
            coinInType,
            coinOutType,
            slippage,
            referrer,
            isSponsoredTx
          } = inputs;
          const tx = new Transaction11();
          tx.setSender(walletAddress);
          if (referrer) {
            this.api.ReferralVault().updateReferrerTx({
              tx,
              referrer
            });
          }
          const amountOut = pool.getTradeAmountOut({
            coinInAmount,
            coinInType,
            coinOutType,
            referral: referrer !== void 0
          });
          const coinInId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: coinInType,
            coinAmount: coinInAmount,
            isSponsoredTx
          });
          if (pool.pool.daoFeePoolObject) {
            const coinOutId = this.daoFeePoolTradeTx({
              tx,
              coinInId,
              daoFeePoolId: pool.pool.daoFeePoolObject.objectId,
              expectedCoinOutAmount: amountOut,
              lpCoinType: pool.pool.lpCoinType,
              coinInType,
              coinOutType,
              slippage
            });
            tx.transferObjects([coinOutId], walletAddress);
          } else {
            this.tradeTx({
              tx,
              coinInId,
              poolId: pool.pool.objectId,
              expectedCoinOutAmount: amountOut,
              lpCoinType: pool.pool.lpCoinType,
              coinInType,
              coinOutType,
              slippage,
              withTransfer: true
            });
          }
          return tx;
        };
        this.fetchAddTradeTx = (inputs) => {
          const {
            tx,
            coinInId,
            coinInAmount,
            coinInType,
            coinOutType,
            slippage,
            pool,
            referrer
          } = inputs;
          const amountOut = pool.getTradeAmountOut({
            coinInAmount,
            coinInType,
            coinOutType,
            referral: referrer !== void 0
          });
          return this.tradeTx({
            tx,
            coinInId,
            poolId: pool.pool.objectId,
            expectedCoinOutAmount: amountOut,
            lpCoinType: pool.pool.lpCoinType,
            coinInType,
            coinOutType,
            slippage
          });
        };
        this.fetchBuildDepositTx = async (inputs) => {
          const {
            walletAddress,
            pool,
            amountsIn,
            slippage,
            referrer,
            isSponsoredTx
          } = inputs;
          const tx = new Transaction11();
          tx.setSender(walletAddress);
          if (referrer) {
            this.api.ReferralVault().updateReferrerTx({
              tx,
              referrer
            });
          }
          const { coins: coinTypes, balances: coinAmounts } = Coin.coinsAndBalancesOverZero(amountsIn);
          const { lpRatio } = pool.getDepositLpAmountOut({
            amountsIn,
            referral: referrer !== void 0
          });
          const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);
          const coinIds = await this.api.Coin().fetchCoinsWithAmountTx({
            ...inputs,
            tx,
            coinTypes,
            coinAmounts,
            isSponsoredTx
          });
          if (pool.pool.daoFeePoolObject) {
            const lpCoinId = this.daoFeePoolMultiCoinDepositTx({
              tx,
              daoFeePoolId: pool.pool.daoFeePoolObject.objectId,
              lpCoinType: pool.pool.lpCoinType,
              coinIds,
              coinTypes,
              expectedLpRatio,
              slippage
            });
            tx.transferObjects([lpCoinId], walletAddress);
          } else {
            this.multiCoinDepositTx({
              tx,
              poolId: pool.pool.objectId,
              lpCoinType: pool.pool.lpCoinType,
              coinIds,
              coinTypes,
              expectedLpRatio,
              slippage,
              withTransfer: true
            });
          }
          return tx;
        };
        this.fetchBuildWithdrawTx = async (inputs) => {
          const {
            walletAddress,
            pool,
            amountsOutDirection,
            lpCoinAmount,
            slippage,
            referrer
          } = inputs;
          const tx = new Transaction11();
          tx.setSender(walletAddress);
          if (referrer) {
            this.api.ReferralVault().updateReferrerTx({
              tx,
              referrer
            });
          }
          const lpRatio = pool.getMultiCoinWithdrawLpRatio({
            lpCoinAmountIn: lpCoinAmount
          });
          const amountsOut = pool.getWithdrawAmountsOut({
            lpRatio,
            amountsOutDirection,
            referral: referrer !== void 0
          });
          const { coins: coinTypes, balances: coinAmounts } = Coin.coinsAndBalancesOverZero(amountsOut);
          const lpCoinId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: pool.pool.lpCoinType,
            coinAmount: lpCoinAmount
          });
          if (pool.pool.daoFeePoolObject) {
          } else {
            this.multiCoinWithdrawTx({
              tx,
              poolId: pool.pool.objectId,
              lpCoinType: pool.pool.lpCoinType,
              expectedAmountsOut: coinAmounts,
              coinTypes,
              lpCoinId,
              slippage,
              withTransfer: true
            });
          }
          return tx;
        };
        this.fetchBuildAllCoinWithdrawTx = async (inputs) => {
          const { walletAddress, pool, lpCoinAmount, referrer } = inputs;
          const tx = new Transaction11();
          tx.setSender(walletAddress);
          if (referrer) {
            this.api.ReferralVault().updateReferrerTx({
              tx,
              referrer
            });
          }
          const lpCoinId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: pool.pool.lpCoinType,
            coinAmount: lpCoinAmount
          });
          const coinTypes = Object.keys(pool.pool.coins);
          if (pool.pool.daoFeePoolObject) {
            const withdrawnCoinIds = this.daoFeePoolAllCoinWithdrawTx({
              tx,
              daoFeePoolId: pool.pool.daoFeePoolObject.objectId,
              lpCoinType: pool.pool.lpCoinType,
              coinTypes,
              lpCoinId
            });
            tx.transferObjects(
              coinTypes.map((_, index) => withdrawnCoinIds[index]),
              walletAddress
            );
          } else {
            this.allCoinWithdrawTx({
              tx,
              poolId: pool.pool.objectId,
              lpCoinType: pool.pool.lpCoinType,
              coinTypes,
              lpCoinId,
              withTransfer: true
            });
          }
          return tx;
        };
        this.buildPublishLpCoinTx = (inputs) => {
          const { lpCoinDecimals } = inputs;
          const tx = new Transaction11();
          tx.setSender(inputs.walletAddress);
          const upgradeCap = this.publishLpCoinTx({ tx, lpCoinDecimals });
          tx.transferObjects([upgradeCap], inputs.walletAddress);
          return tx;
        };
        this.buildDaoFeePoolUpdateFeeBpsTx = Helpers.transactions.createBuildTxFunc(
          this.daoFeePoolUpdateFeeBpsTx
        );
        this.buildDaoFeePoolUpdateFeeRecipientTx = Helpers.transactions.createBuildTxFunc(
          this.daoFeePoolUpdateFeeRecipientTx
        );
        this.tradeEventType = () => EventsApiHelpers.createEventType(
          this.addresses.pools.packages.events,
          _PoolsApi2.constants.moduleNames.events,
          _PoolsApi2.constants.eventNames.swap
        );
        this.depositEventType = () => EventsApiHelpers.createEventType(
          this.addresses.pools.packages.events,
          _PoolsApi2.constants.moduleNames.events,
          _PoolsApi2.constants.eventNames.deposit
        );
        this.withdrawEventType = () => EventsApiHelpers.createEventType(
          this.addresses.pools.packages.events,
          _PoolsApi2.constants.moduleNames.events,
          _PoolsApi2.constants.eventNames.withdraw
        );
        this.tradeV2EventType = () => EventsApiHelpers.createEventType(
          this.addresses.pools.packages.eventsV2,
          _PoolsApi2.constants.moduleNames.events,
          _PoolsApi2.constants.eventNames.swapV2
        );
        this.depositV2EventType = () => EventsApiHelpers.createEventType(
          this.addresses.pools.packages.eventsV2,
          _PoolsApi2.constants.moduleNames.events,
          _PoolsApi2.constants.eventNames.depositV2
        );
        this.withdrawV2EventType = () => EventsApiHelpers.createEventType(
          this.addresses.pools.packages.eventsV2,
          _PoolsApi2.constants.moduleNames.events,
          _PoolsApi2.constants.eventNames.withdrawV2
        );
        const pools = api.addresses.pools;
        const referralVault = api.addresses.referralVault;
        const daoFeePools = api.addresses.daoFeePools;
        if (!(pools && referralVault)) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = {
          pools,
          referralVault,
          daoFeePools
        };
        this.objectTypes = {
          pool: `${pools.packages.events}::pool::Pool`,
          daoFeePool: daoFeePools ? `${daoFeePools.packages.events}::pool::DaoFeePool` : void 0,
          daoFeePoolOwnerCap: daoFeePools ? `${daoFeePools.packages.events}::pool::OwnerCap` : void 0
        };
        this.eventTypes = {
          trade: this.tradeEventType(),
          deposit: this.depositEventType(),
          withdraw: this.withdrawEventType(),
          tradeV2: this.tradeV2EventType(),
          depositV2: this.depositV2EventType(),
          withdrawV2: this.withdrawV2EventType()
        };
        this.moveErrors = {
          [this.addresses.pools.packages.amm]: {
            [_PoolsApi2.constants.moduleNames.pool]: {
              /// A user provides a input that should be between 0 and `FIXED_ONE` but isn't.
              0: "Flatness Not Normalized",
              /// A user attempts to create a Pool with a `flatness` parameter we do not support yet.
              1: "Flatness Not Supported",
              /// A user attempts to create a pool with weights that don't sum to `FIXED_ONE`.
              2: "Weights Not Normalized",
              /// A user attempts to create a Pool with an individual weight outside of the
              ///  range [MIN_WEIGHT, MAX_WEIGHT].
              3: "Invalid Weight",
              /// A user attempts to create a Pool with an individual fee outside of the
              ///  range [MIN_FEE, MAX_FEE].
              4: "Invalid Fee",
              /// A user provides an input vector (with length m != n) for a pool of size n.
              5: "Bad Vector Length",
              /// A user tries to create a Pool but provides an initial deposit that equates to less than
              ///  `MIN_LP_SUPPLY` worth of LP Coins.
              6: "Not Enough Initial Liquidity",
              /// A user attempts to create a Pool with an LP `TreasuryCap` that has already minted Coins.
              7: "Non Zero Total Supply",
              /// A user attempts to interact with the Pool and specifies a type that isn't in the Pool.
              8: "Bad Type",
              /// A user attempts to create a pool with invalid decimal scalars
              9: "Bad Decimals",
              /// A user attempts to create a pool with type names which are not sorted
              10: "Not Sorted"
            },
            [_PoolsApi2.constants.moduleNames.poolRegistry]: {
              /// A user tries to create a Pool and the generic parameters of `create_pool_n_coins` were
              ///  provided in nonlexicographical order.
              60: "Not Sorted",
              /// A user tries to create a Pool with exact parameters as an already active Pool.
              61: "Duplicate Pool",
              /// A user tries to upgrade the `PoolRegistry` to a value
              62: "Invalid Upgrade"
            },
            [_PoolsApi2.constants.moduleNames.deposit]: {
              /// A user attempts to perform a `deposit` with an older contract.
              20: "Invalid Protocol Version",
              /// A user attempts to perform `deposit-n-coins` on a Pool with a size `m` < `n`.
              21: "Invalid Pool Size",
              /// A user attempts to perform a deposit and provides a coin with a value of zero.
              22: "Zero Value",
              // A user calls `deposit_n_coins` or `all_coin_deposit_n_coins` and provides the same generic
              //  at least twice.
              23: "Duplicate Types"
            },
            [_PoolsApi2.constants.moduleNames.poolFactory]: {
              /// A user attempts to create a pool on an older contract.
              10: "Invalid Protocol Version",
              /// A user attempts to create a Pool and provides a coin with a value of zero.
              11: "Zero Value"
            },
            [_PoolsApi2.constants.moduleNames.price]: {
              /// A user attempts to query spot/oracle price using an old contract.
              10: "Invalid Protocol Version"
            },
            [_PoolsApi2.constants.moduleNames.swap]: {
              /// A user attempts to perform a `swap` with an older contract.
              40: "Invalid Protocol Version",
              /// A user attempts to perform `multi-swap-exact-in/out-n-to-m` on a Pool with a size
              ///  `s` < `n` + `m`.
              41: "Invalid Pool Size",
              /// A user attempts to perform swap and providing provides a coin with a
              ///  value of zero.
              42: "Zero Value",
              /// A user attempts to perform a multi-coin withdraw and provides an `amounts_out`
              ///  vector whose length does
              43: "Bad Vector Length",
              /// A user attempts to swap attempts to swap `Coin<CI>` for `amount_out` of `Coin<CO>`
              ///  but its value is insufficient.
              44: "Insufficient Coin In",
              // A user calls `multi_swap_exact_in_1_to_n` or `multi_swap_exact_out_1_to_n` and provides the same
              //  generic at least twice.
              45: "Duplicate Types",
              /// Something went wrong with the internal calculations
              46: "Internal Error",
              /// An external app is trying to call authorized functions without permission.
              47: "Not Authorized"
            },
            [_PoolsApi2.constants.moduleNames.withdraw]: {
              /// A user attempts to perform a `withdraw` with an older contract.
              30: "Invalid Protocol Version",
              /// A user attempts to perform `withdraw-n-coins` on a Pool with a size `m` < `n`.
              31: "Invalid PoolSize",
              /// A user attempts to perform a withdraw and provides an LP coin with a value of zero.
              32: "Zero Value",
              /// A user attempts to perform a multi-coin withdraw and provides an `amounts_out`
              ///  vector whose length does
              33: "Bad Vector Length",
              // A user calls `withdraw_n_coins` or `all_coin_withdraw_n_coins` and provides the same generic
              //  at least twice.
              34: "Duplicate Types"
            },
            [_PoolsApi2.constants.moduleNames.math]: {
              // TODO: change error code in move
              /// A user tries to create a Pool that would result in the Pool's invariant equalling zero.
              // 51: "ZeroInvariant",
              /// A user tries to perform an action with the Pool that results in too much slippage.
              51: "Slippage",
              /// A user tries to perform a swap that would result in more than `MAX_SWAP_AMOUNT_IN` worth of
              ///  one of the Pool's coins entering the Pool.
              52: "Invalid Swap Amount In",
              /// A user tries to perform a swap that would result in more than `MAX_SWAP_AMOUNT_OUT` worth of
              ///  one of the Pool's coins exiting the Pool.
              53: "Invalid Swap Amount Out",
              /// A user tries to perform a `swap_exact_out` with a value for `amount_out` that equates to
              ///  zero amount of `Coin<CI>`.
              54: "Zero Amount In",
              /// A user tries to perform a `swap_exact_in` with an amount of `Coin<CI>` that equates to
              ///  zero amount of `Coin<CO>`.
              55: "Zero Amount Out",
              /// A user tries to deposit into a Pool with a deposit that is worth zero LP coins.
              56: "Zero Lp Out",
              /// A user tries to invest with an lp ratio of 0
              57: "Zero Lp Ratio"
            },
            [_PoolsApi2.constants.moduleNames.geometricMeanCalculations]: {},
            [_PoolsApi2.constants.moduleNames.stableCalculations]: {}
          },
          ...this.addresses.daoFeePools ? {
            [this.addresses.daoFeePools.packages.amm]: {
              version: {
                /// A user tried to interact with an old contract.
                0: "Invalid Version",
                /// `init_package_version` has been called outside of this packages `init` function.
                1: "Version Object Already Created"
              }
            }
          } : {}
        };
      }
    };
    _PoolsApi.constants = {
      moduleNames: {
        interface: "amm_interface",
        pool: "pool",
        swap: "swap",
        deposit: "deposit",
        withdraw: "withdraw",
        events: "events",
        poolRegistry: "pool_registry",
        routerWrapper: "router",
        poolFactory: "pool_factory",
        math: "math",
        geometricMeanCalculations: "geometric_mean_calculations",
        stableCalculations: "stable_calculations",
        price: "price"
      },
      eventNames: {
        swap: "SwapEvent",
        deposit: "DepositEvent",
        withdraw: "WithdrawEvent",
        swapV2: "SwapEventV2",
        depositV2: "DepositEventV2",
        withdrawV2: "WithdrawEventV2"
      },
      defaultLpCoinIconImageUrl: "https://aftermath.finance/coins/lp/af_lp.svg"
    };
    PoolsApi = _PoolsApi;
  }
});
var _ReferralVaultApi;
var ReferralVaultApi;
var init_referralVaultApi = __esm({
  "src/packages/referralVault/api/referralVaultApi.ts"() {
    "use strict";
    init_utils();
    _ReferralVaultApi = class _ReferralVaultApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.updateReferrerTx = (inputs) => {
          try {
            const { tx, referrer } = inputs;
            const txData = tx.getData();
            if (txData.sender && Helpers.addLeadingZeroesToType(txData.sender) === Helpers.addLeadingZeroesToType(referrer)) {
              return;
            }
            return tx.moveCall({
              target: Helpers.transactions.createTxTarget(
                this.addresses.packages.referralVault,
                _ReferralVaultApi2.constants.moduleNames.referralVault,
                "update_referrer_address"
              ),
              typeArguments: [],
              arguments: [
                tx.object(this.addresses.objects.referralVault),
                tx.pure.address(referrer)
              ]
            });
          } catch (_e) {
          }
        };
        this.withdrawRebateTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.referralVault,
              _ReferralVaultApi2.constants.moduleNames.referralVault,
              inputs.withTransfer ? "withdraw_and_transfer" : "withdraw_rebate"
            ),
            typeArguments: [inputs.coinType],
            arguments: [tx.object(this.addresses.objects.referralVault)]
          });
        };
        this.balanceOfRebateTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.referralVault,
              _ReferralVaultApi2.constants.moduleNames.referralVault,
              "balance_of"
            ),
            typeArguments: [inputs.coinType],
            arguments: [
              tx.object(this.addresses.objects.referralVault),
              tx.pure.address(inputs.referrer)
            ]
          });
        };
        this.referrerForTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.referralVault,
              _ReferralVaultApi2.constants.moduleNames.referralVault,
              "referrer_for"
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.referralVault),
              tx.pure.address(inputs.referee)
            ]
          });
        };
        this.hasReffererTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.referralVault,
              _ReferralVaultApi2.constants.moduleNames.referralVault,
              "has_referrer"
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.referralVault),
              tx.pure.address(inputs.referee)
            ]
          });
        };
        this.fetchBalanceOfRebate = async (inputs) => {
          const tx = new Transaction12();
          this.balanceOfRebateTx({ ...inputs, tx });
          const bytes = await this.api.Inspections().fetchFirstBytesFromTxOutput({
            tx
          });
          return Casting.bigIntFromBytes(bytes);
        };
        this.fetchReferrer = async (inputs) => {
          const tx = new Transaction12();
          this.referrerForTx({ ...inputs, tx });
          const bytes = await this.api.Inspections().fetchFirstBytesFromTxOutput({
            tx
          });
          const unwrapped = bcs3.option(bcs3.Address).parse(new Uint8Array(bytes));
          return unwrapped ?? void 0;
        };
        const addresses = this.api.addresses.referralVault;
        if (!addresses) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = addresses;
      }
    };
    _ReferralVaultApi.constants = {
      moduleNames: {
        referralVault: "referral_vault"
      }
    };
    ReferralVaultApi = _ReferralVaultApi;
  }
});
var _RouterApi;
var RouterApi;
var init_routerApi = __esm({
  "src/packages/router/api/routerApi.ts"() {
    "use strict";
    init_eventsApiHelpers();
    _RouterApi = class _RouterApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Creates an instance of RouterApi.
       * @constructor
       * @param {AftermathApi} api - The Aftermath API instance.
       */
      constructor(api) {
        this.api = api;
        this.routerTradeEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.utils,
          _RouterApi2.constants.moduleNames.events,
          _RouterApi2.constants.eventNames.routerTrade
        );
        if (!this.api.addresses.router) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = this.api.addresses.router;
        this.eventTypes = {
          routerTrade: this.routerTradeEventType()
        };
        this.moveErrors = {
          [this.addresses.packages.utils]: {
            [_RouterApi2.constants.moduleNames.protocolFee]: {
              /// A non-one-time-witness type has been provided to the `ProtocolFeeConfig`'s `create` function.
              1: "Protocol Fee Config Already Created",
              /// Occurs when `change_fee` is called more than once during the same Epoch.
              2: "Bad Epoch",
              /// A user provided a new protocol fees that do not sum to one.
              3: "Not Normalized"
            },
            [_RouterApi2.constants.moduleNames.router]: {
              0: "Not Authorized",
              1: "Invalid Coin In",
              2: "Invalid Coin Out",
              4: "Invalid Previous Swap",
              5: "Invalid Slippage",
              /// A route is constructed that bypasses one of `begin_router_tx_and_pay_fees` or
              ///  `end_router_tx_and_pay_fees`.
              6: "No Fees Paid"
            },
            [_RouterApi2.constants.moduleNames.version]: {
              /// A user tries to interact with an old contract.
              0: "Invalid Version"
            },
            [_RouterApi2.constants.moduleNames.admin]: {
              /// Admin has not authorized the calling shared object to acess a permissioned function.
              0: "Not Authorized",
              /// Admin has already authorized the calling shared object to acess a permissioned function.
              1: "Already Authorized"
            }
          }
        };
      }
    };
    _RouterApi.constants = {
      moduleNames: {
        router: "router",
        events: "events",
        protocolFee: "protocol_fee",
        version: "version",
        admin: "admin"
      },
      eventNames: {
        routerTrade: "SwapCompletedEvent"
      }
    };
    RouterApi = _RouterApi;
  }
});
var _StakingApi;
var StakingApi;
var init_stakingApi = __esm({
  "src/packages/staking/api/stakingApi.ts"() {
    "use strict";
    init_eventsApiHelpers();
    init_aftermathApi();
    init_utils();
    init_packages();
    init_coin2();
    init_sui2();
    init_stakingTypes();
    _StakingApi = class _StakingApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.stakeTx = (inputs) => {
          const { tx, suiCoin, withTransfer } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              `request_stake${withTransfer ? "_and_keep" : ""}`
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.stakedSuiVault),
              // StakedSuiVault
              tx.object(this.addresses.objects.safe),
              // Safe
              tx.object(Sui.constants.addresses.suiSystemStateId),
              // SuiSystemState
              tx.object(this.addresses.objects.referralVault),
              // ReferralVault
              typeof suiCoin === "string" ? tx.object(suiCoin) : suiCoin,
              tx.pure.address(inputs.validatorAddress)
            ]
          });
        };
        this.unstakeTx = (inputs) => {
          const { tx, afSuiCoin } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              "request_unstake"
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.stakedSuiVault),
              // StakedSuiVault
              tx.object(this.addresses.objects.safe),
              // Safe
              typeof afSuiCoin === "string" ? tx.object(afSuiCoin) : afSuiCoin
            ]
          });
        };
        this.atomicUnstakeTx = (inputs) => {
          const { tx, afSuiCoin, withTransfer } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              `request_unstake_atomic${withTransfer ? "_and_keep" : ""}`
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.stakedSuiVault),
              // StakedSuiVault
              tx.object(this.addresses.objects.safe),
              // Safe
              tx.object(this.addresses.objects.referralVault),
              // ReferralVault
              tx.object(this.addresses.objects.treasury),
              // Treasury
              typeof afSuiCoin === "string" ? tx.object(afSuiCoin) : afSuiCoin
            ]
          });
        };
        this.requestStakeStakedSuiVecTx = (inputs) => {
          const { tx, stakedSuiIds, withTransfer } = inputs;
          const stakedSuiIdsVec = tx.makeMoveVec({
            elements: stakedSuiIds.map((id) => tx.object(id))
          });
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              `request_stake_staked_sui_vec${withTransfer ? "_and_keep" : ""}`
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.stakedSuiVault),
              // StakedSuiVault
              tx.object(this.addresses.objects.safe),
              // Safe
              tx.object(Sui.constants.addresses.suiSystemStateId),
              // SuiSystemState
              tx.object(this.addresses.objects.referralVault),
              // ReferralVault
              stakedSuiIdsVec,
              tx.pure.address(inputs.validatorAddress)
            ]
          });
        };
        this.epochWasChangedTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              "epoch_was_changed"
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.stakedSuiVault),
              // StakedSuiVault
              tx.object(this.addresses.objects.safe),
              // Safe
              tx.object(Sui.constants.addresses.suiSystemStateId),
              // SuiSystemState
              tx.object(this.addresses.objects.referralVault),
              // ReferralVault
              tx.object(this.addresses.objects.treasury),
              // Treasury
              tx.pure.u64(BigInt(1e3))
              // fields_requests_per_tx
            ]
          });
        };
        this.afSuiToSuiExchangeRateTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              "afsui_to_sui_exchange_rate"
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.stakedSuiVault),
              // StakedSuiVault
              tx.object(this.addresses.objects.safe)
              // Safe
            ]
          });
        };
        this.suiToAfSuiExchangeRateTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              "sui_to_afsui_exchange_rate"
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.stakedSuiVault),
              // StakedSuiVault
              tx.object(this.addresses.objects.safe)
              // Safe
            ]
          });
        };
        this.totalSuiAmountTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: AftermathApi.helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              "total_sui_amount"
            ),
            typeArguments: [],
            arguments: [tx.object(this.addresses.objects.stakedSuiVault)]
          });
        };
        this.afSuiToSuiTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              "afsui_to_sui"
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.stakedSuiVault),
              // StakedSuiVault
              tx.object(this.addresses.objects.safe),
              // Safe
              tx.pure.u64(inputs.afSuiAmount)
            ]
          });
        };
        this.suiToAfSuiTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              "sui_to_afsui"
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.stakedSuiVault),
              // StakedSuiVault
              tx.object(this.addresses.objects.safe),
              // Safe
              tx.pure.u64(inputs.suiAmount)
            ]
          });
        };
        this.updateValidatorFeeTx = (inputs) => {
          const { tx, validatorOperationCapId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.lsd,
              _StakingApi2.constants.moduleNames.stakedSuiVault,
              "update_validator_fee"
            ),
            typeArguments: [],
            arguments: [
              typeof validatorOperationCapId === "string" ? tx.object(validatorOperationCapId) : validatorOperationCapId,
              // UnverifiedValidatorOperationCap
              tx.object(this.addresses.objects.stakedSuiVault),
              // StakedSuiVault
              tx.pure.u64(inputs.newFee)
            ]
          });
        };
        this.fetchBuildStakeTx = async (inputs) => {
          const { referrer, externalFee } = inputs;
          if (externalFee) {
            _StakingApi2.assertValidExternalFee(externalFee);
          }
          const tx = new Transaction13();
          tx.setSender(inputs.walletAddress);
          if (referrer) {
            this.api.ReferralVault().updateReferrerTx({
              tx,
              referrer
            });
          }
          const suiCoin = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress: inputs.walletAddress,
            coinType: Coin.constants.suiCoinType,
            coinAmount: inputs.suiStakeAmount,
            isSponsoredTx: inputs.isSponsoredTx
          });
          if (externalFee) {
            const feeAmount = BigInt(
              Math.floor(Number(inputs.suiStakeAmount) * externalFee.feePercentage)
            );
            const suiFeeCoin = tx.splitCoins(suiCoin, [feeAmount]);
            tx.transferObjects([suiFeeCoin], externalFee.recipient);
          }
          const afSuiCoinId = this.stakeTx({
            tx,
            ...inputs,
            suiCoin
            // withTransfer: true,
          });
          tx.transferObjects([afSuiCoinId], inputs.walletAddress);
          return tx;
        };
        this.fetchBuildUnstakeTx = async (inputs) => {
          const { referrer, externalFee } = inputs;
          if (externalFee) {
            _StakingApi2.assertValidExternalFee(externalFee);
          }
          const tx = new Transaction13();
          tx.setSender(inputs.walletAddress);
          if (referrer) {
            this.api.ReferralVault().updateReferrerTx({
              tx,
              referrer
            });
          }
          const afSuiCoin = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress: inputs.walletAddress,
            coinType: this.coinTypes.afSui,
            coinAmount: inputs.afSuiUnstakeAmount
          });
          if (externalFee) {
            const feeAmount = BigInt(
              Math.floor(
                Number(inputs.afSuiUnstakeAmount) * externalFee.feePercentage
              )
            );
            const afSuiFeeCoin = tx.splitCoins(afSuiCoin, [feeAmount]);
            tx.transferObjects([afSuiFeeCoin], externalFee.recipient);
          }
          if (inputs.isAtomic) {
            const suiCoinId = this.atomicUnstakeTx({
              tx,
              ...inputs,
              afSuiCoin
              // withTransfer: true,
            });
            tx.transferObjects([suiCoinId], inputs.walletAddress);
          } else {
            this.unstakeTx({
              tx,
              ...inputs,
              afSuiCoin
            });
          }
          return tx;
        };
        this.fetchBuildStakeStakedSuiTx = async (inputs) => {
          const { referrer } = inputs;
          const tx = new Transaction13();
          tx.setSender(inputs.walletAddress);
          if (referrer) {
            this.api.ReferralVault().updateReferrerTx({
              tx,
              referrer
            });
          }
          const afSuiCoinId = this.requestStakeStakedSuiVecTx({
            tx,
            ...inputs
            // withTransfer: true,
          });
          tx.transferObjects([afSuiCoinId], inputs.walletAddress);
          return tx;
        };
        this.buildUpdateValidatorFeeTx = async (inputs) => {
          const tx = new Transaction13();
          tx.setSender(inputs.walletAddress);
          this.updateValidatorFeeTx({
            ...inputs,
            tx,
            newFee: Casting.numberToFixedBigInt(inputs.newFeePercentage)
          });
          return tx;
        };
        this.buildEpochWasChangedTx = Helpers.transactions.createBuildTxFunc(
          this.epochWasChangedTx
        );
        this.stakedEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.events,
          _StakingApi2.constants.moduleNames.events,
          _StakingApi2.constants.eventNames.staked
        );
        this.unstakeRequestedEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.events,
          _StakingApi2.constants.moduleNames.events,
          _StakingApi2.constants.eventNames.unstakeRequested
        );
        this.unstakedEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.events,
          _StakingApi2.constants.moduleNames.events,
          _StakingApi2.constants.eventNames.unstaked
        );
        this.epochWasChangedEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.events,
          _StakingApi2.constants.moduleNames.events,
          _StakingApi2.constants.eventNames.epochWasChanged
        );
        if (!this.api.addresses.staking) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = this.api.addresses.staking;
        this.eventTypes = {
          staked: this.stakedEventType(),
          unstakeRequested: this.unstakeRequestedEventType(),
          unstaked: this.unstakedEventType(),
          epochWasChanged: this.epochWasChangedEventType()
        };
        this.coinTypes = {
          afSui: `${this.addresses.packages.afsui}::afsui::AFSUI`
        };
        this.objectTypes = {
          unverifiedValidatorOperationCap: `${this.addresses.packages.events}::validator::UnverifiedValidatorOperationCap`
        };
        this.moveErrors = {
          [this.addresses.packages.lsd]: {
            [_StakingApi2.constants.moduleNames.stakedSuiVault]: {
              /// The admin calls `migrate` on an outdated package.
              0: "Version Incompatibility",
              /// A user tries to interact with the `StakedSuiVault` through an outdated package.
              1: "Wrong Package Version",
              /// One tries to call deprecated function.
              2: "Deprecated"
            },
            [_StakingApi2.constants.moduleNames.sort]: {
              /// One provided keys and values vectors of different lengths.
              1: "Different Inputs Length",
              /// Error for tests.
              2: "Dummy Error"
            },
            [_StakingApi2.constants.moduleNames.calculations]: {
              /// User provided a percentage value larger than 10^18 = 1 = 100%.
              0: "Invalid Percentage"
            },
            [_StakingApi2.constants.moduleNames.actions]: {
              /// Epoch advancement has not yet been processed.
              0: "Epoch Change Has Not Been Treated",
              /// Epoch advancement has already been processed.
              1: "Epoch Change Has Already Been Treated",
              /// User tried to delegate stake to a validator that is inactive.
              2: "Validator Is Not Active",
              /// User tried to delegate stake with value less than the minimum staking threshold.
              3: "Less Than Minimum Staking Threshold",
              /// User tried to delegate stake to a validator whose history of exchange rates is too short.
              4: "Insufficient Validator History",
              /// User provided an empty vector as input.
              5: "Empty Vector",
              /// User requested to unstake more SUI than held in the `atomic_unstake_sui_reserves`.
              6: "Insufficient Sui Reserves",
              /// User provided afSUI coin with insufficient balance.
              7: "Insufficient Balance afSUI Coin Provided"
            },
            [_StakingApi2.constants.moduleNames.receipt]: {
              0: "Not Enough Amount In Receipt",
              1: "Try To Burn Non Zero Receipt"
            },
            [_StakingApi2.constants.moduleNames.stakedSuiVaultState]: {
              /// One provided value larger than 1 (100%) when opposite is supposed.
              1: "Invalid Percentage",
              /// One provided min atomic unstake fee value larger than max atomic unstake fee value.
              2: "Invalid Atomic Unstake Fees Values",
              /// A `validator` address - that isn't recognized by the afSUI framework - is provided to a function
              ///  that requests a `ValidatorConfig`.
              3: "Invalid Validator",
              /// An address tries to create a `UnverifiedValidatorOperationCap` without being an active validator.
              4: "Validator Is Not Active",
              /// An authorized owner of an `UnverifiedValidatorOperationCap` object tries to perform a permissioned
              ///  function for another validator.
              5: "Invalid Operation Cap",
              /// An authorized owner of an `UnverifiedValidatorOperationCap` object tries to set a `validator_fee`
              ///  that is greater than the maximum allowed validator fee.
              6: "Invalid Validator Fee"
            }
          }
        };
      }
    };
    _StakingApi.constants = {
      moduleNames: {
        actions: "actions",
        events: "events",
        stakedSuiVault: "staked_sui_vault",
        stakedSuiVaultState: "staked_sui_vault_state",
        routerWrapper: "router",
        sort: "sort",
        receipt: "receipt",
        calculations: "calculations"
      },
      eventNames: {
        staked: "StakedEvent",
        unstaked: "UnstakedEvent",
        unstakeRequested: "UnstakeRequestedEvent",
        epochWasChanged: "EpochWasChangedEvent"
      }
    };
    _StakingApi.updateStakingPositionsFromEvent = (inputs) => {
      const positions = inputs.stakingPositions;
      const event = inputs.event;
      let newPositions = [];
      const unstakePositions = positions.filter(isUnstakePosition);
      const newUnstakes = isUnstakeEvent(event) ? _StakingApi.updateUnstakePositionsFromEvent({
        event,
        unstakePositions
      }) : unstakePositions;
      const stakePositions = positions.filter(isStakePosition);
      const newStakes = isStakeEvent(event) ? [...stakePositions, event] : stakePositions;
      newPositions = [...newUnstakes, ...newStakes];
      return newPositions.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    };
    _StakingApi.assertValidExternalFee = (externalFee) => {
      if (externalFee.feePercentage >= Staking.constants.bounds.maxExternalFeePercentage) {
        throw new Error(
          `external fee percentage exceeds max of ${Staking.constants.bounds.maxExternalFeePercentage * 100}%`
        );
      }
      if (externalFee.feePercentage <= 0) {
        throw new Error("external fee percentage must be greater than 0");
      }
    };
    _StakingApi.updateUnstakePositionsFromEvent = (inputs) => {
      const foundPositionIndex = inputs.unstakePositions.findIndex(
        (pos) => pos.afSuiId === inputs.event.afSuiId
      );
      if (foundPositionIndex < 0) {
        if (inputs.event.type.includes(_StakingApi.constants.eventNames.unstakeRequested)) {
          return [
            {
              ...inputs.event,
              state: "REQUEST"
            },
            ...inputs.unstakePositions
          ];
        }
        return [
          {
            ...inputs.event,
            state: "SUI_MINTED"
          },
          ...inputs.unstakePositions
        ];
      }
      const foundStakePosition = inputs.unstakePositions[foundPositionIndex];
      let position;
      if (inputs.event.type.includes(_StakingApi.constants.eventNames.unstaked)) {
        position = {
          ...inputs.event,
          state: "SUI_MINTED",
          epoch: foundStakePosition.epoch
        };
      }
      if (inputs.event.type.includes(_StakingApi.constants.eventNames.unstakeRequested)) {
        position = {
          ...inputs.event,
          state: "REQUEST",
          epoch: foundStakePosition.epoch
        };
      }
      if (!position) {
        return inputs.unstakePositions;
      }
      const newStakePositions = [...inputs.unstakePositions];
      newStakePositions[foundPositionIndex] = position;
      return newStakePositions;
    };
    StakingApi = _StakingApi;
  }
});
var SuiApi;
var init_suiApi = __esm({
  "src/packages/sui/api/suiApi.ts"() {
    "use strict";
    init_utils();
    SuiApi = class {
      // =========================================================================
      //  Class Members
      // =========================================================================
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchSystemState = async () => {
          const systemState = await this.api.client.getLatestSuiSystemState();
          const activeValidators = systemState.activeValidators.map((validator) => ({
            ...validator,
            suiAddress: Helpers.addLeadingZeroesToType(validator.suiAddress)
          }));
          return {
            ...systemState,
            activeValidators
          };
        };
      }
    };
  }
});
var _SuiFrensApi;
var SuiFrensApi;
var init_suiFrensApi = __esm({
  "src/packages/suiFrens/api/suiFrensApi.ts"() {
    "use strict";
    init_coin();
    init_helpers();
    init_utils();
    init_eventsApiHelpers();
    init_sui();
    init_suiFrens();
    _SuiFrensApi = class _SuiFrensApi2 {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchMixingLimitsAndLastEpochMixeds = async (inputs) => {
          const tx = new Transaction14();
          this.devInspectMixLimitAndLastEpochMixedMulTx({ ...inputs, tx });
          const [mixLimitBytes, lastEpochMixedBytes] = await this.api.Inspections().fetchAllBytesFromTxOutput({
            tx
          });
          const mixLimits = bcs4.vector(bcs4.option(bcs4.u8())).parse(new Uint8Array(mixLimitBytes));
          const lastEpochMixeds = bcs4.vector(bcs4.option(bcs4.u64())).parse(new Uint8Array(lastEpochMixedBytes));
          return mixLimits.map((mixLimit, index) => ({
            mixLimit: mixLimit === null || mixLimit === void 0 ? void 0 : BigInt(mixLimit),
            lastEpochMixed: lastEpochMixeds[index] === void 0 ? void 0 : BigInt(lastEpochMixeds[index])
          }));
        };
        this.fetchMixingLimit = async (inputs) => {
          if (inputs.suiFrenType === this.objectTypes.bullshark) return void 0;
          const tx = new Transaction14();
          this.mixingLimitTx({ tx, ...inputs });
          const bytes = await this.api.Inspections().fetchFirstBytesFromTxOutput(
            {
              tx
            }
          );
          const unwrapped = bcs4.option(bcs4.u8()).parse(new Uint8Array(bytes));
          return unwrapped === null || unwrapped === void 0 ? void 0 : BigInt(unwrapped);
        };
        this.fetchLastEpochMixed = async (inputs) => {
          if (inputs.suiFrenType === this.objectTypes.bullshark) return void 0;
          const tx = new Transaction14();
          this.lastEpochMixedTx({ tx, ...inputs });
          const bytes = await this.api.Inspections().fetchFirstBytesFromTxOutput(
            {
              tx
            }
          );
          const unwrapped = bcs4.option(bcs4.u64()).parse(new Uint8Array(bytes));
          return unwrapped === null || unwrapped === void 0 ? void 0 : BigInt(unwrapped);
        };
        this.fetchStakedSuiFrenMetadataIds = async (inputs) => {
          const { suiFrenIds } = inputs;
          const tx = new Transaction14();
          this.devInspectMetadataObjectIdMulTx({ tx, suiFrenIds });
          const idBytes = await this.api.Inspections().fetchFirstBytesFromTxOutput({
            tx
          });
          const stakedSuiFrenMetadataIds = bcs4.vector(bcs4.Address).parse(new Uint8Array(idBytes));
          return stakedSuiFrenMetadataIds;
        };
        this.fetchHarvestSuiFrenFeesEvents = (inputs) => this.api.Events().fetchCastEventsWithCursor({
          ...inputs,
          query: {
            MoveEventType: this.eventTypes.harvestSuiFrenFees
          },
          eventFromEventOnChain: Casting.suiFrens.harvestSuiFrenFeesEventFromOnChain
        });
        this.fetchMixSuiFrensEvents = (inputs) => this.api.Events().fetchCastEventsWithCursor({
          ...inputs,
          query: {
            MoveEventType: this.eventTypes.mixSuiFrens
          },
          eventFromEventOnChain: Casting.suiFrens.mixSuiFrensEventFromOnChain
        });
        this.fetchStakeSuiFrenEvents = (inputs) => this.api.Events().fetchCastEventsWithCursor({
          ...inputs,
          query: {
            MoveEventType: this.eventTypes.stakeSuiFren
          },
          eventFromEventOnChain: Casting.suiFrens.stakeSuiFrenEventFromOnChain
        });
        this.fetchUnstakeSuiFrenEvents = (inputs) => this.api.Events().fetchCastEventsWithCursor({
          ...inputs,
          query: {
            MoveEventType: this.eventTypes.unstakeSuiFren
          },
          eventFromEventOnChain: Casting.suiFrens.unstakeSuiFrenEventFromOnChain
        });
        this.fetchCapyLabsApp = async () => {
          return this.api.Objects().fetchCastObject({
            objectId: this.addresses.objects.capyLabsApp,
            objectFromSuiObjectResponse: Casting.suiFrens.capyLabsAppObjectFromSuiObjectResponse
          });
        };
        this.fetchSuiFrenVaultStateV1Object = async () => {
          return this.api.Objects().fetchCastObject({
            objectId: this.addresses.objects.suiFrensVaultStateV1,
            objectFromSuiObjectResponse: Casting.suiFrens.suiFrenVaultStateV1ObjectFromSuiObjectResponse
          });
        };
        this.fetchSuiFrens = async (inputs) => {
          const { suiFrenIds } = inputs;
          const partialSuiFrens = await this.api.Objects().fetchCastObjectBatch({
            objectIds: suiFrenIds,
            objectFromSuiObjectResponse: Casting.suiFrens.partialSuiFrenObjectFromSuiObjectResponse,
            options: {
              showDisplay: true,
              showType: true,
              showContent: true
            }
          });
          return this.fetchCompletePartialSuiFrenObjects({
            partialSuiFrens,
            isStaked: false
          });
        };
        this.fetchOwnedSuiFrens = async (inputs) => {
          const { walletAddress } = inputs;
          const [partialSuiFrenNonBullsharks, partialSuiFrenBullsharks] = await Promise.all([
            this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
              walletAddress,
              objectType: this.objectTypes.suiFren,
              objectFromSuiObjectResponse: Casting.suiFrens.partialSuiFrenObjectFromSuiObjectResponse,
              withDisplay: true
            }),
            this.fetchOwnedPartialSuiFrenBullsharks(inputs)
          ]);
          const suiFrens = await this.fetchCompletePartialSuiFrenObjects({
            partialSuiFrens: [
              ...partialSuiFrenNonBullsharks,
              ...partialSuiFrenBullsharks
            ],
            isStaked: false
          });
          return suiFrens;
        };
        this.fetchStakedSuiFrens = async (inputs) => {
          const { stakedSuiFrenIds } = inputs;
          const stakedSuiFrenData = await this.api.Objects().fetchCastObjectBatch({
            objectIds: stakedSuiFrenIds,
            objectFromSuiObjectResponse: Casting.suiFrens.partialSuiFrenAndStakedSuiFrenMetadataV1ObjectFromSuiObjectResponse,
            options: {
              showDisplay: true,
              showType: true,
              showContent: true
            }
          });
          const suiFrens = await this.fetchCompletePartialSuiFrenObjects({
            partialSuiFrens: stakedSuiFrenData.map((data) => data.partialSuiFren),
            isStaked: true
          });
          return suiFrens.map((suiFren, index) => ({
            suiFren,
            metadata: stakedSuiFrenData[index].stakedSuiFrenMetadata
          }));
        };
        this.fetchStakedSuiFrensDynamicFields = (inputs) => {
          return this.api.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
            {
              ...inputs,
              parentObjectId: this.addresses.objects.suiFrensVaultStateV1MetadataTable,
              objectsFromObjectIds: (stakedSuiFrenIds) => this.fetchStakedSuiFrens({ stakedSuiFrenIds }),
              dynamicFieldType: this.objectTypes.stakedSuiFrenMetadataV1
            }
          );
        };
        this.fetchAccessoriesForSuiFren = async (inputs) => {
          return await this.api.DynamicFields().fetchCastAllDynamicFieldsOfType({
            parentObjectId: inputs.suiFrenId,
            objectsFromObjectIds: (objectIds) => this.fetchAccessories({ objectIds }),
            dynamicFieldType: this.objectTypes.suiFrenAccessory
          });
        };
        this.fetchOwnedAccessories = async (inputs) => {
          const { walletAddress } = inputs;
          return await this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
            walletAddress,
            objectType: this.objectTypes.suiFrenAccessory,
            objectFromSuiObjectResponse: Casting.suiFrens.accessoryObjectFromSuiObjectResponse,
            withDisplay: true
          });
        };
        this.fetchAccessories = async (inputs) => {
          const { objectIds } = inputs;
          return this.api.Objects().fetchCastObjectBatch({
            objectIds,
            objectFromSuiObjectResponse: Casting.suiFrens.accessoryObjectFromSuiObjectResponse,
            options: {
              showDisplay: true,
              showType: true,
              showContent: true
            }
          });
        };
        this.fetchStakedSuiFrensDynamicFieldsWithFilters = async (inputs) => {
          const { attributes } = inputs;
          const defaultLimit = 25;
          const limit = inputs.limit ?? defaultLimit;
          const isComplete = (data) => {
            return this.filterSuiFrensWithAttributes({
              suiFrens: data.map((info) => info.suiFren),
              attributes
            }).length >= limit;
          };
          const suiFrensWithCursor = await this.api.DynamicFields().fetchDynamicFieldsUntil({
            ...inputs,
            fetchFunc: (data) => this.fetchStakedSuiFrensDynamicFields(data),
            isComplete
          });
          const filteredSuiFrens = this.filterSuiFrensWithAttributes({
            suiFrens: suiFrensWithCursor.dynamicFieldObjects.map(
              (data) => data.suiFren
            ),
            attributes
          });
          const dynamicFieldObjects = suiFrensWithCursor.dynamicFieldObjects.filter(
            (data) => filteredSuiFrens.slice(0, limit).some((suiFren) => suiFren.objectId === data.suiFren.objectId)
          );
          const resizedSuiFrensWithCursor = {
            nextCursor: limit < filteredSuiFrens.length ? filteredSuiFrens[limit].objectId : suiFrensWithCursor.nextCursor,
            dynamicFieldObjects
          };
          return resizedSuiFrensWithCursor;
        };
        this.fetchOwnedStakedSuiFrens = async (inputs) => {
          const { walletAddress } = inputs;
          const stakedPositions = await this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
            walletAddress,
            objectType: this.objectTypes.stakedSuiFrenPosition,
            objectFromSuiObjectResponse: Casting.suiFrens.stakedSuiFrenPositionFromSuiObjectResponse
          });
          const stakedSuiFrenIds = await this.fetchStakedSuiFrenMetadataIds({
            suiFrenIds: stakedPositions.map((position) => position.suiFrenId)
          });
          const stakedSuiFrens = await this.fetchStakedSuiFrens({
            stakedSuiFrenIds
          });
          return stakedSuiFrens.map((data, index) => ({
            ...data,
            position: stakedPositions[index]
          }));
        };
        this.devInspectMetadataObjectIdMulTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVault,
              _SuiFrensApi2.constants.moduleNames.suiFrensVault.vault,
              "dev_inspect_metadata_object_id_mul"
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.suiFrensVault),
              // SuiFrenVault
              tx.pure(bcs4.vector(bcs4.Address).serialize(inputs.suiFrenIds))
              // suifren_ids
            ]
          });
        };
        this.devInspectMixLimitAndLastEpochMixedMulTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVaultCapyLabsExtension,
              _SuiFrensApi2.constants.moduleNames.suiFrensVaultCapyLabsExtension.capyLabs,
              "dev_inspect_mixing_limit_and_last_epoch_mixed_mul"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension),
              // SuiFrensVaultCapyLabsExt
              tx.object(this.addresses.objects.suiFrensVault),
              // SuiFrenVault
              tx.pure(bcs4.vector(bcs4.Address).serialize(inputs.suiFrenIds))
              // suifren_ids
            ]
          });
        };
        this.mixingLimitTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrens,
              _SuiFrensApi2.constants.moduleNames.capyLabs.capyLabs,
              "mixing_limit"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(inputs.suiFrenId)
              // SuiFren
            ]
          });
        };
        this.lastEpochMixedTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrens,
              _SuiFrensApi2.constants.moduleNames.capyLabs.capyLabs,
              "last_epoch_mixed"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(inputs.suiFrenId)
              // SuiFren
            ]
          });
        };
        this.mixAndKeepTx = (inputs) => {
          const { tx, suiPaymentCoinId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVaultCapyLabsExtension,
              _SuiFrensApi2.constants.moduleNames.suiFrensVaultCapyLabsExtension.capyLabs,
              "mix_and_keep"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension),
              // SuiFrensVaultCapyLabsExt
              tx.object(this.addresses.objects.capyLabsApp),
              // CapyLabsApp
              tx.object(this.addresses.objects.suiFrensVault),
              // SuiFrenVault
              tx.object(inputs.parentOneId),
              // SuiFren
              tx.object(inputs.parentTwoId),
              // SuiFren
              typeof suiPaymentCoinId === "string" ? tx.object(suiPaymentCoinId) : suiPaymentCoinId,
              // Coin
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.mixWithStakedAndKeepTx = (inputs) => {
          const { tx, suiPaymentCoinId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVaultCapyLabsExtension,
              _SuiFrensApi2.constants.moduleNames.suiFrensVaultCapyLabsExtension.capyLabs,
              "mix_with_staked_and_keep"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension),
              // SuiFrensVaultCapyLabsExt
              tx.object(this.addresses.objects.capyLabsApp),
              // CapyLabsApp
              tx.object(this.addresses.objects.suiFrensVault),
              // SuiFrenVault
              tx.object(inputs.nonStakedParentId),
              // SuiFren
              tx.object(inputs.stakedParentId),
              // SuiFren
              typeof suiPaymentCoinId === "string" ? tx.object(suiPaymentCoinId) : suiPaymentCoinId,
              // Coin
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.mixStakedWithStakedAndKeepTx = (inputs) => {
          const { tx, suiPaymentCoinId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVaultCapyLabsExtension,
              _SuiFrensApi2.constants.moduleNames.suiFrensVaultCapyLabsExtension.capyLabs,
              "mix_staked_with_staked_and_keep"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension),
              // SuiFrensVaultCapyLabsExt
              tx.object(this.addresses.objects.capyLabsApp),
              // CapyLabsApp
              tx.object(this.addresses.objects.suiFrensVault),
              // SuiFrenVault
              tx.object(inputs.parentOneId),
              // SuiFren
              tx.object(inputs.parentTwoId),
              // SuiFren
              typeof suiPaymentCoinId === "string" ? tx.object(suiPaymentCoinId) : suiPaymentCoinId,
              // Coin
              tx.object(Sui.constants.addresses.suiClockId)
              // Clock
            ]
          });
        };
        this.stakeAndKeepTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVaultCapyLabsExtension,
              _SuiFrensApi2.constants.moduleNames.suiFrensVaultCapyLabsExtension.capyLabs,
              "stake_and_keep"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension),
              // SuiFrensVaultCapyLabsExt
              tx.object(this.addresses.objects.capyLabsApp),
              // CapyLabsApp
              tx.object(this.addresses.objects.suiFrensVault),
              // SuiFrenVault
              tx.object(inputs.suiFrenId),
              // SuiFren
              tx.pure.bool(inputs.autoStakeFees),
              tx.pure.u64(inputs.baseFee),
              tx.pure.u64(inputs.feeIncrementPerMix),
              tx.pure.u8(Number(inputs.minRemainingMixesToKeep))
            ]
          });
        };
        this.unstakeAndKeepTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVaultCapyLabsExtension,
              _SuiFrensApi2.constants.moduleNames.suiFrensVaultCapyLabsExtension.capyLabs,
              "unstake_and_keep"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(this.addresses.objects.suiFrensVaultCapyLabsExtension),
              // SuiFrensVaultCapyLabsExt
              tx.object(this.addresses.objects.suiFrensVault),
              // SuiFrenVault
              tx.object(inputs.stakedPositionId)
              // StakedPosition
            ]
          });
        };
        this.beginHarvestTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVault,
              _SuiFrensApi2.constants.moduleNames.suiFrensVault.vault,
              "begin_harvest"
            ),
            typeArguments: [],
            arguments: []
          });
        };
        this.harvestTx = (inputs) => {
          const { tx, harvestFeesEventMetadataId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVault,
              _SuiFrensApi2.constants.moduleNames.suiFrensVault.vault,
              "harvest"
            ),
            typeArguments: [],
            arguments: [
              tx.object(this.addresses.objects.suiFrensVault),
              // SuiFrenVault
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              typeof harvestFeesEventMetadataId === "string" ? tx.object(harvestFeesEventMetadataId) : harvestFeesEventMetadataId
              // HarvestedFeesEventMetadata
            ]
          });
        };
        this.endHarvestTx = (inputs) => {
          const { tx, harvestFeesEventMetadataId } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVault,
              _SuiFrensApi2.constants.moduleNames.suiFrensVault.vault,
              "end_harvest"
            ),
            typeArguments: [],
            arguments: [
              typeof harvestFeesEventMetadataId === "string" ? tx.object(harvestFeesEventMetadataId) : harvestFeesEventMetadataId
              // HarvestedFeesEventMetadata
            ]
          });
        };
        this.addAccessoryTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVault,
              _SuiFrensApi2.constants.moduleNames.suiFrensVault.vault,
              "add_accessory"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(this.addresses.objects.suiFrensVault),
              // SuiFrenVault
              tx.object(inputs.suiFrenId),
              // suifren_id
              tx.object(inputs.accessoryId)
              // Accessory
            ]
          });
        };
        this.addAccessoryToOwnedSuiFrenTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVault,
              _SuiFrensApi2.constants.moduleNames.suiFrensVault.vault,
              "add_accessory_to_owned_suifren"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(inputs.suiFrenId),
              // suifren_id
              tx.object(inputs.accessoryId)
              // Accessory
            ]
          });
        };
        this.removeAccessoryAndKeepTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVault,
              _SuiFrensApi2.constants.moduleNames.suiFrensVault.vault,
              "remove_accessory_and_keep"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(this.addresses.objects.suiFrensVault),
              // SuiFrenVault
              tx.object(inputs.stakedPositionId),
              // StakedPosition
              tx.object(inputs.accessoryType)
              // String
            ]
          });
        };
        this.removeAccessoryFromOwnedSuiFrenAndKeepTx = (inputs) => {
          const { tx } = inputs;
          return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
              this.addresses.packages.suiFrensVault,
              _SuiFrensApi2.constants.moduleNames.suiFrensVault.vault,
              "remove_accessory_from_owned_suifren_and_keep"
            ),
            typeArguments: [inputs.suiFrenType],
            arguments: [
              tx.object(inputs.suiFrenId),
              // SuiFren
              tx.object(inputs.accessoryType)
              // String
            ]
          });
        };
        this.fetchStakeTx = Helpers.transactions.createBuildTxFunc(
          (inputs) => this.stakeAndKeepTx({ ...inputs, autoStakeFees: true })
        );
        this.fetchUnstakeTx = Helpers.transactions.createBuildTxFunc(
          this.unstakeAndKeepTx
        );
        this.fetchBuildMixTx = async (inputs) => {
          const {
            walletAddress,
            suiFrenParentOne,
            suiFrenParentTwo,
            suiFrenType,
            baseFee,
            isSponsoredTx
          } = inputs;
          const tx = new Transaction14();
          tx.setSender(walletAddress);
          const totalFee = baseFee + SuiFrens.calcTotalInternalMixFee({
            mixFee1: suiFrenParentOne.mixFee,
            mixFee2: suiFrenParentTwo.mixFee
          });
          const suiPaymentCoinId = await this.api.Coin().fetchCoinWithAmountTx({
            tx,
            walletAddress,
            coinType: Coin.constants.suiCoinType,
            coinAmount: totalFee,
            isSponsoredTx
          });
          const isParentOneStaked = suiFrenParentOne.mixFee !== void 0;
          const isParentTwoStaked = suiFrenParentTwo.mixFee !== void 0;
          const parentOneId = suiFrenParentOne.objectId;
          const parentTwoId = suiFrenParentTwo.objectId;
          if (isParentOneStaked && isParentTwoStaked) {
            this.mixStakedWithStakedAndKeepTx({
              tx,
              parentOneId,
              parentTwoId,
              suiPaymentCoinId,
              suiFrenType
            });
          } else if (!isParentOneStaked && !isParentTwoStaked) {
            this.mixAndKeepTx({
              tx,
              parentOneId,
              parentTwoId,
              suiPaymentCoinId,
              suiFrenType
            });
          } else {
            const [nonStakedParentId, stakedParentId] = isParentOneStaked ? [parentTwoId, parentOneId] : [parentOneId, parentTwoId];
            this.mixWithStakedAndKeepTx({
              tx,
              nonStakedParentId,
              stakedParentId,
              suiPaymentCoinId,
              suiFrenType
            });
          }
          return tx;
        };
        this.fetchBuildHarvestFeesTx = async (inputs) => {
          const { stakedPositionIds } = inputs;
          const tx = new Transaction14();
          tx.setSender(inputs.walletAddress);
          const harvestFeesEventMetadataId = this.beginHarvestTx({ tx });
          let harvestedCoins = [];
          for (const stakedPositionId of stakedPositionIds) {
            const harvestedCoin = this.harvestTx({
              tx,
              stakedPositionId,
              harvestFeesEventMetadataId
            });
            harvestedCoins.push(harvestedCoin);
          }
          const coinToTransfer = harvestedCoins[0];
          if (harvestedCoins.length > 1)
            tx.mergeCoins(coinToTransfer, harvestedCoins.slice(1));
          tx.transferObjects([coinToTransfer], inputs.walletAddress);
          this.endHarvestTx({ tx, harvestFeesEventMetadataId });
          return tx;
        };
        this.fetchBuildAddAccessoryTx = (inputs) => {
          if (inputs.isOwned) {
            return Helpers.transactions.createBuildTxFunc(
              this.addAccessoryToOwnedSuiFrenTx
            )(inputs);
          }
          return Helpers.transactions.createBuildTxFunc(this.addAccessoryTx)(inputs);
        };
        this.fetchBuildRemoveAccessoryTx = (inputs) => {
          if ("suiFrenId" in inputs) {
            return Helpers.transactions.createBuildTxFunc(
              this.removeAccessoryFromOwnedSuiFrenAndKeepTx
            )(inputs);
          }
          return Helpers.transactions.createBuildTxFunc(
            this.removeAccessoryAndKeepTx
          )(inputs);
        };
        this.fetchSuiFrenStats = async () => {
          const [suiFrenVault, mixSuiFrenEventsWithinTime] = await Promise.all([
            this.fetchSuiFrenVaultStateV1Object(),
            this.api.Events().fetchEventsWithinTime({
              fetchEventsFunc: this.fetchMixSuiFrensEvents,
              timeMs: 24 * 60 * 60 * 1e3
            })
          ]);
          const mixingFees24hr = Helpers.sumBigInt(
            mixSuiFrenEventsWithinTime.map((event) => event.fee)
          );
          return {
            totalMixes: suiFrenVault.totalMixes,
            currentTotalStaked: suiFrenVault.stakedSuiFrens,
            mixingVolume24hr: mixSuiFrenEventsWithinTime.length,
            mixingFees24hr
          };
        };
        this.filterSuiFrensWithAttributes = (inputs) => {
          const { suiFrens, attributes } = inputs;
          if (Object.keys(attributes).length <= 0) return suiFrens;
          return suiFrens.filter(
            (suiFren) => Object.entries(attributes).every(
              ([key1, val1]) => Object.entries(suiFren.attributes).some(
                ([key2, val2]) => key1.toLowerCase() === key2.toLowerCase() && val1.toLowerCase() === val2.toLowerCase()
              )
            )
          );
        };
        this.fetchCompletePartialSuiFrenObjects = async (inputs) => {
          const { partialSuiFrens, isStaked } = inputs;
          if (!isStaked) {
            return Promise.all(
              partialSuiFrens.map(
                (partialSuiFren) => this.fetchNonStakedCompletePartialSuiFrenObject({
                  partialSuiFren
                })
              )
            );
          }
          if (partialSuiFrens.length <= 0) return [];
          const [partialSuiFrenBullsharks, partialSuiFrenNonBullsharks] = Helpers.bifilter(
            partialSuiFrens,
            (partialSuiFren) => partialSuiFren.objectType.includes(this.objectTypes.bullshark)
          );
          const bullsharkDynamicFields = partialSuiFrenBullsharks.map(() => ({
            mixLimit: void 0,
            lastEpochMixed: void 0
          }));
          const nonBullsharkDynamicFields = await this.fetchMixingLimitsAndLastEpochMixeds({
            suiFrenIds: partialSuiFrenNonBullsharks.map(
              (suiFren) => suiFren.objectId
            ),
            suiFrenType: Coin.getInnerCoinType(
              partialSuiFrenNonBullsharks[0].objectType
            )
          });
          const suiFrenBullsharks = bullsharkDynamicFields.map((data, index) => ({
            ...partialSuiFrenBullsharks[index],
            ...data
          }));
          const suiFrenNonBullsharks = nonBullsharkDynamicFields.map(
            (data, index) => ({
              ...partialSuiFrenNonBullsharks[index],
              ...data
            })
          );
          return [...suiFrenBullsharks, ...suiFrenNonBullsharks];
        };
        this.fetchNonStakedCompletePartialSuiFrenObject = async (inputs) => {
          const { partialSuiFren } = inputs;
          const suiFrenId = partialSuiFren.objectId;
          const suiFrenType = Coin.getInnerCoinType(partialSuiFren.objectType);
          const [mixLimit, lastEpochMixed] = await Promise.all([
            this.fetchMixingLimit({ suiFrenId, suiFrenType }),
            this.fetchLastEpochMixed({ suiFrenId, suiFrenType })
          ]);
          return {
            ...partialSuiFren,
            mixLimit,
            lastEpochMixed
          };
        };
        this.fetchOwnedPartialSuiFrenBullsharks = async (inputs) => {
          const kioskOwnerCaps = await this.api.Nfts().fetchOwnedKioskOwnerCaps(inputs);
          const allBullsharks = await Promise.all(
            kioskOwnerCaps.map(
              (kioskOwnerCap) => this.api.DynamicFields().fetchCastAllDynamicFieldsOfType({
                parentObjectId: kioskOwnerCap.kioskObjectId,
                objectsFromObjectIds: (suiFrenIds) => this.fetchSuiFrens({ suiFrenIds }),
                dynamicFieldType: (fieldType) => fieldType.includes(this.objectTypes.suiFren) && fieldType.includes(this.objectTypes.bullshark)
              })
            )
          );
          const bullsharks = allBullsharks.reduce(
            (acc, bullsharks2) => [...acc, ...bullsharks2],
            []
          );
          return bullsharks;
        };
        this.harvestSuiFrenFeesEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.suiFrensVault,
          _SuiFrensApi2.constants.moduleNames.suiFrensVault.events,
          _SuiFrensApi2.constants.eventNames.suiFrensVault.harvestSuiFrenFees
        );
        this.mixSuiFrensEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.suiFrensVault,
          _SuiFrensApi2.constants.moduleNames.suiFrensVault.events,
          _SuiFrensApi2.constants.eventNames.suiFrensVault.mixSuiFrens
        );
        this.stakeSuiFrenEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.suiFrensVault,
          _SuiFrensApi2.constants.moduleNames.suiFrensVault.events,
          _SuiFrensApi2.constants.eventNames.suiFrensVault.stakeSuiFren
        );
        this.unstakeSuiFrenEventType = () => EventsApiHelpers.createEventType(
          this.addresses.packages.suiFrensVault,
          _SuiFrensApi2.constants.moduleNames.suiFrensVault.events,
          _SuiFrensApi2.constants.eventNames.suiFrensVault.unstakeSuiFren
        );
        const addresses = this.api.addresses.suiFrens;
        if (!addresses)
          throw new Error("not all required addresses have been set in provider");
        this.addresses = addresses;
        this.objectTypes = {
          // suiFrens
          suiFren: `${addresses.packages.suiFrens}::${_SuiFrensApi2.constants.moduleNames.suiFrens.suiFrens}::SuiFren`,
          capy: `${addresses.packages.suiFrens}::capy::Capy`,
          bullshark: `${addresses.packages.suiFrensBullshark}::bullshark::Bullshark`,
          // accessories
          suiFrenAccessory: `${addresses.packages.accessories}::${_SuiFrensApi2.constants.moduleNames.accessories.accessories}::Accessory`,
          // staking
          stakedSuiFrenPosition: `${addresses.packages.suiFrensVault}::${_SuiFrensApi2.constants.moduleNames.suiFrensVault.stakedPosition}::StakedPosition`,
          stakedSuiFrenMetadataV1: `${addresses.packages.suiFrensVault}::${_SuiFrensApi2.constants.moduleNames.suiFrensVault.vaultState}::StakedSuiFrenMetadataV1`
        };
        this.eventTypes = {
          harvestSuiFrenFees: this.harvestSuiFrenFeesEventType(),
          mixSuiFrens: this.mixSuiFrensEventType(),
          stakeSuiFren: this.stakeSuiFrenEventType(),
          unstakeSuiFren: this.unstakeSuiFrenEventType()
        };
      }
    };
    _SuiFrensApi.constants = {
      moduleNames: {
        suiFrens: {
          suiFrens: "suifrens"
        },
        accessories: {
          accessories: "accessories"
        },
        capyLabs: {
          capyLabs: "capy_labs"
        },
        suiFrensVault: {
          vault: "vault",
          vaultState: "vault_state",
          events: "events",
          stakedPosition: "staked_position"
        },
        suiFrensVaultCapyLabsExtension: {
          capyLabs: "capy_labs"
        }
      },
      eventNames: {
        suiFrensVault: {
          mixSuiFrens: "MixedSuiFrenEvent",
          stakeSuiFren: "StakedSuiFrenEvent",
          unstakeSuiFren: "UnstakedSuiFrenEvent",
          harvestSuiFrenFees: "HarvestedFeesEvent"
        }
      }
    };
    SuiFrensApi = _SuiFrensApi;
  }
});
var NftsApi;
var init_nftsApi = __esm({
  "src/general/nfts/nftsApi.ts"() {
    "use strict";
    init_utils();
    NftsApi = class {
      constructor(api) {
        this.api = api;
        this.fetchOwnedNfts = async (inputs) => {
          const objects = await this.api.Objects().fetchOwnedObjects({
            ...inputs,
            options: {
              // NOTE: do we need all of this ?
              showContent: true,
              showOwner: true,
              showType: true,
              showDisplay: true
            }
          });
          return Casting.nfts.nftsFromSuiObjects(objects);
        };
        this.fetchNfts = async (inputs) => {
          const objects = await this.api.Objects().fetchObjectBatch({
            ...inputs,
            options: {
              // NOTE: do we need all of this ?
              showContent: true,
              showOwner: true,
              showType: true,
              showDisplay: true
            }
          });
          return Casting.nfts.nftsFromSuiObjects(objects);
        };
        this.fetchOwnedKioskOwnerCaps = async (inputs) => {
          const { walletAddress } = inputs;
          const [kioskOwnerCaps, personalKioskOwnerCaps] = await Promise.all([
            this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
              walletAddress,
              objectType: "0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::KioskOwnerCap",
              objectFromSuiObjectResponse: Casting.nfts.kioskOwnerCapFromSuiObject
            }),
            this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
              walletAddress,
              objectType: this.objectTypes.personalKioskCap,
              objectFromSuiObjectResponse: Casting.nfts.kioskOwnerCapFromPersonalKioskCapSuiObject
            })
          ]);
          return [...kioskOwnerCaps, ...personalKioskOwnerCaps];
        };
        this.fetchNftsInKiosk = async (inputs) => {
          const { kioskObjectId } = inputs;
          return this.api.DynamicFields().fetchCastAllDynamicFieldsOfType({
            parentObjectId: kioskObjectId,
            objectsFromObjectIds: (objectIds) => this.fetchNfts({ objectIds })
          });
        };
        this.fetchKioskOwnerCaps = async (inputs) => {
          const { kioskOwnerCapIds } = inputs;
          return this.api.Objects().fetchCastObjectBatch({
            objectIds: kioskOwnerCapIds,
            objectFromSuiObjectResponse: (response) => response.data?.type && Helpers.addLeadingZeroesToType(response.data?.type) === this.objectTypes.personalKioskCap ? Casting.nfts.kioskOwnerCapFromPersonalKioskCapSuiObject(response) : Casting.nfts.kioskOwnerCapFromSuiObject(response)
          });
        };
        this.fetchKiosks = async (inputs) => {
          const { kioskOwnerCaps } = inputs;
          const nfts = await Promise.all(
            kioskOwnerCaps.map(
              (kioskOwnerCap) => this.fetchNftsInKiosk({
                kioskObjectId: kioskOwnerCap.kioskObjectId
              })
            )
          );
          return kioskOwnerCaps.map((kioskOwnerCap, index) => ({
            objectId: kioskOwnerCap.kioskObjectId,
            objectType: "0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk",
            kioskOwnerCapId: kioskOwnerCap.objectId,
            nfts: nfts[index],
            isPersonal: kioskOwnerCap.objectType === this.objectTypes.personalKioskCap
          }));
        };
        this.fetchKiosksFromOwnerCaps = async (inputs) => {
          const kioskOwnerCaps = await this.fetchKioskOwnerCaps(inputs);
          return this.fetchKiosks({ kioskOwnerCaps });
        };
        this.fetchOwnedKiosks = async (inputs) => {
          const kioskOwnerCaps = await this.fetchOwnedKioskOwnerCaps(inputs);
          const nfts = await Promise.all(
            kioskOwnerCaps.map(
              (kioskOwnerCap) => this.fetchNftsInKiosk({
                kioskObjectId: kioskOwnerCap.kioskObjectId
              })
            )
          );
          return kioskOwnerCaps.map((kioskOwnerCap, index) => ({
            objectId: kioskOwnerCap.kioskObjectId,
            objectType: "0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk",
            kioskOwnerCapId: kioskOwnerCap.objectId,
            nfts: nfts[index],
            isPersonal: kioskOwnerCap.objectType === this.objectTypes.personalKioskCap
          }));
        };
        if (!this.api.addresses.nfts) {
          throw new Error("not all required addresses have been set in provider");
        }
        this.addresses = this.api.addresses.nfts;
        this.objectTypes = {
          personalKioskCap: `${this.addresses.packages.mystenTransferPolicy}::personal_kiosk::PersonalKioskCap`
        };
      }
    };
  }
});
var WalletApi;
var init_walletApi = __esm({
  "src/general/wallet/walletApi.ts"() {
    "use strict";
    init_helpers();
    WalletApi = class {
      // =========================================================================
      //  Constructor
      // =========================================================================
      constructor(api) {
        this.api = api;
        this.fetchCoinBalance = async (inputs) => {
          const { walletAddress, coin } = inputs;
          const coinBalance = await this.api.client.getBalance({
            owner: walletAddress,
            coinType: Helpers.stripLeadingZeroesFromType(coin)
          });
          return BigInt(coinBalance.totalBalance);
        };
        this.fetchAllCoinBalances = async (inputs) => {
          const { walletAddress } = inputs;
          const allBalances = await this.api.client.getAllBalances({
            owner: walletAddress
          });
          const coinsToBalance = allBalances.reduce(
            (acc, balance) => {
              return {
                ...acc,
                [Helpers.addLeadingZeroesToType(balance.coinType)]: BigInt(
                  balance.totalBalance
                )
              };
            },
            {}
          );
          return coinsToBalance;
        };
        this.fetchPastTransactions = async (inputs) => {
          const { walletAddress, cursor, limit } = inputs;
          const transactionsWithCursor = await this.api.Transactions().fetchTransactionsWithCursor({
            query: {
              filter: {
                FromAddress: walletAddress
              }
            },
            cursor,
            limit
          });
          return transactionsWithCursor;
        };
      }
    };
  }
});
var AftermathApi;
var init_aftermathApi = __esm({
  "src/general/providers/aftermathApi.ts"() {
    "use strict";
    init_coinApi();
    init_dcaApi();
    init_farmsApi();
    init_faucetApi();
    init_limitOrdersApi();
    init_multisigApi();
    init_nftAmmApi();
    init_perpetualsApi();
    init_poolsApi();
    init_referralVaultApi();
    init_routerApi();
    init_stakingApi();
    init_suiApi();
    init_suiFrensApi();
    init_dynamicFieldsApiHelpers();
    init_eventsApiHelpers();
    init_inspectionsApiHelpers();
    init_objectsApiHelpers();
    init_transactionsApiHelpers();
    init_nftsApi();
    init_utils();
    init_walletApi();
    AftermathApi = class {
      // =========================================================================
      //  Constructor
      // =========================================================================
      /**
       * Constructs a new instance of the `AftermathApi`, binding the given Sui client
       * to the known `addresses`.
       *
       * @param client - A `SuiJsonRpcClient` for on-chain queries and transactions.
       * @param addresses - The config addresses (object IDs, package IDs, etc.) for the Aftermath protocol.
       */
      constructor(client, addresses) {
        this.client = client;
        this.addresses = addresses;
        this.DynamicFields = () => new DynamicFieldsApiHelpers(this);
        this.Events = () => new EventsApiHelpers(this);
        this.Inspections = () => new InspectionsApiHelpers(this);
        this.Objects = () => new ObjectsApiHelpers(this);
        this.Transactions = () => new TransactionsApiHelpers(this);
        this.Wallet = () => new WalletApi(this);
        this.Nfts = () => new NftsApi(this);
        this.Coin = () => new CoinApi(this);
        this.Sui = () => new SuiApi(this);
        this.Pools = () => new PoolsApi(this);
        this.Faucet = () => new FaucetApi(this);
        this.SuiFrens = () => new SuiFrensApi(this);
        this.Staking = () => new StakingApi(this);
        this.NftAmm = () => new NftAmmApi(this);
        this.ReferralVault = () => new ReferralVaultApi(this);
        this.Perpetuals = () => new PerpetualsApi(this);
        this.Farms = () => new FarmsApi(this);
        this.Dca = () => new DcaApi(this);
        this.Multisig = () => new MultisigApi(this);
        this.LimitOrders = () => new LimitOrdersApi(this);
        this.Router = () => new RouterApi(this);
      }
      // =========================================================================
      //  Helpers
      // =========================================================================
      /**
       * Attempts to decode a Move error message into a structured error code,
       * package ID, module name, and descriptive error string.
       *
       * @param inputs - An object containing the raw `errorMessage`.
       * @returns An object with `errorCode`, `packageId`, `module`, and `error` if translation is successful, or `undefined`.
       *
       * @example
       * ```typescript
       * const errorDecoded = afApi.translateMoveErrorMessage({ errorMessage: "MoveAbort at ..." });
       * if (errorDecoded) {
       *   console.log(errorDecoded.errorCode, errorDecoded.error);
       * }
       * ```
       */
      translateMoveErrorMessage(inputs) {
        const sources = [
          this.Pools(),
          this.Staking(),
          this.Perpetuals(),
          this.Farms(),
          this.Router()
        ];
        for (const source of sources) {
          const translation = Helpers.translateMoveErrorMessage({
            errorMessage: inputs.errorMessage,
            moveErrors: source.moveErrors
          });
          if (translation) {
            return translation;
          }
        }
        return void 0;
      }
    };
    AftermathApi.helpers = {
      // =========================================================================
      //  General
      // =========================================================================
      /** Helpers for accessing or iterating over dynamic fields in Sui objects. */
      dynamicFields: DynamicFieldsApiHelpers,
      /** Helpers for working with Sui events and pagination. */
      events: EventsApiHelpers,
      /** Helpers for reading on-chain data in an "inspection" manner (designed for Summaries). */
      inspections: InspectionsApiHelpers,
      /** Helpers for retrieving and parsing Sui objects by ID or type. */
      objects: ObjectsApiHelpers,
      /** Helpers for reading transaction data (by digest, query, etc.). */
      transactions: TransactionsApiHelpers,
      // =========================================================================
      //  Utils
      // =========================================================================
      /** Helper for wallet-based operations, separate from the main `Wallet` classes. */
      wallet: WalletApi,
      // =========================================================================
      //  General Packages
      // =========================================================================
      /** Low-level direct coin operations, separate from the higher-level `Coin` class. */
      coin: CoinApi,
      /** Low-level Sui chain data ops, separate from the higher-level `Sui` class. */
      sui: SuiApi
    };
  }
});
var _Aftermath;
var Aftermath;
var init_aftermath = __esm({
  "src/general/providers/aftermath.ts"() {
    "use strict";
    init_packages();
    init_coin();
    init_dca();
    init_farms();
    init_faucet();
    init_gasPools2();
    init_limitOrders();
    init_multisig();
    init_perpetuals2();
    init_pools();
    init_referrals();
    init_rewards();
    init_staking();
    init_suiFrens();
    init_userData();
    init_dynamicGas();
    init_prices();
    init_caller();
    init_casting();
    init_helpers();
    init_wallet();
    init_aftermathApi();
    _Aftermath = class _Aftermath2 extends Caller {
      constructor(options) {
        super({
          network: options.network ?? "MAINNET",
          baseUrl: options.baseUrl,
          apiEndpoint: options.apiEndpoint,
          accessToken: void 0
        });
        this.Pools = () => new Pools(this.config, this.api);
        this.Staking = () => new Staking(this.config, this.api);
        this.SuiFrens = () => new SuiFrens(this.config, this.api);
        this.Faucet = () => new Faucet(this.config, this.api);
        this.Router = () => new Router(this.config);
        this.NftAmm = () => new NftAmm(this.config, this.api);
        this.ReferralVault = () => new ReferralVault(this.config);
        this.Referrals = () => new Referrals(this.config);
        this.GasPools = () => new GasPools(this.config, this.api);
        this.Perpetuals = () => new Perpetuals(this.config, this.api);
        this.Rewards = () => new Rewards(this.config, this.api);
        this.Farms = () => new Farms(this.config, this.api);
        this.Dca = () => new Dca(this.config);
        this.Multisig = () => new Multisig(this.config, this.api);
        this.LimitOrders = () => new LimitOrders(this.config);
        this.UserData = () => new UserData(this.config);
        this.Sui = () => new Sui(this.config, this.api);
        this.Prices = () => new Prices(this.config);
        this.Wallet = (address) => new Wallet(address, this.config, this.api);
        this.Coin = (coinType) => new Coin(coinType, this.config, this.api);
        this.DynamicGas = () => new DynamicGas(this.config);
        this.Auth = () => new Auth(this.config);
        this.options = options;
      }
      // =========================================================================
      //  Factory
      // =========================================================================
      /**
       * Constructs and fully initializes an `Aftermath` instance.
       *
       * Resolves on-chain addresses, configures the Sui fullnode client, and
       * returns a ready-to-use instance. Pass `addresses` or `api` to skip
       * the corresponding bootstrap steps.
       */
      static async create(options = {}) {
        const af = new _Aftermath2(options);
        await af.bootstrap();
        return af;
      }
      /**
       * Resolves addresses and wires up the internal `AftermathApi`. Called
       * exactly once by the {@link Aftermath.create} factory.
       */
      async bootstrap() {
        if (this.options.api) {
          this.api = this.options.api;
          return;
        }
        const network = this.network;
        const addresses = this.options.addresses ?? await this.getAddresses();
        const fullnodeUrl = this.options.fullnodeUrl ?? Caller.defaultFullnodeUrl(network);
        const client = new SuiJsonRpcClient({
          url: fullnodeUrl,
          network: network.toLowerCase()
        });
        this.api = new AftermathApi(client, addresses);
      }
      // =========================================================================
      //  Public Accessors
      // =========================================================================
      /**
       * The Sui network this provider is configured for (e.g. "MAINNET").
       */
      get network() {
        return this.config.network ?? "MAINNET";
      }
      /**
       * The resolved API base URL for this instance.
       */
      getApiBaseUrl() {
        return this.apiBaseUrl;
      }
      /**
       * Fetches the Aftermath on-chain addresses (object IDs, packages, etc.)
       * directly from the API. Typically you don't need to call this — the
       * `create` factory handles it. Useful for cache warmers or tooling.
       */
      getAddresses() {
        return this.fetchApi("addresses");
      }
      /**
       * Attempts to decode a raw Move abort/error string into a structured
       * error code, package ID, module name, and human-readable message.
       * Returns `undefined` when no registered package recognizes the error.
       *
       * Thin pass-through to the underlying {@link AftermathApi} so consumers
       * don't need to reach into the private `api` field.
       */
      translateMoveErrorMessage(inputs) {
        return this.api.translateMoveErrorMessage(inputs);
      }
    };
    _Aftermath.helpers = Helpers;
    _Aftermath.casting = Casting;
    Aftermath = _Aftermath;
  }
});
var init_providers = __esm({
  "src/general/providers/index.ts"() {
    "use strict";
    init_aftermath();
    init_aftermathApi();
  }
});
var init_index = __esm({
  "src/index.ts"() {
    init_providers();
    init_utils();
    init_packages();
    init_types2();
  }
});
init_index();
export {
  Aftermath,
  AftermathApi,
  Auth,
  Casting,
  Coin,
  Farms,
  FarmsStakedPosition,
  FarmsStakingPool,
  Faucet,
  GasPools,
  Helpers,
  NftAmm,
  Perpetuals,
  PerpetualsAccount,
  PerpetualsMarket,
  PerpetualsOrderSide,
  PerpetualsOrderType,
  PerpetualsStopOrderType,
  PerpetualsVault,
  Pool,
  Pools,
  ReferralVault,
  Router,
  StakedSuiFren,
  Staking,
  Sui,
  SuiFren,
  SuiFrens,
  SuiFrensSortOption,
  isAllocatedCollateralEvent,
  isCanceledOrderEvent,
  isDeallocatedCollateralEvent,
  isDepositedCollateralEvent,
  isFarmsDepositedPrincipalEvent,
  isFarmsHarvestedRewardsEvent,
  isFarmsLockedEvent,
  isFarmsStakedEvent,
  isFarmsUnlockedEvent,
  isFarmsWithdrewPrincipalEvent,
  isFilledMakerOrdersEvent,
  isFilledTakerOrderEvent,
  isLiquidatedEvent,
  isPostedOrderEvent,
  isReducedOrderEvent,
  isSettledFundingEvent,
  isStakeEvent,
  isStakePosition,
  isSuiDelegatedStake,
  isUnstakeEvent,
  isUnstakePosition,
  isUpdatedFundingEvent,
  isUpdatedMarketVersion,
  isUpdatedPremiumTwapEvent,
  isUpdatedSpreadTwapEvent,
  isWithdrewCollateralEvent
};

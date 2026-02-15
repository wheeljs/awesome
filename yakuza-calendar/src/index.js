import { createEvents } from 'ics';

const CalendarSource = 'https://calendar.ryu-ga-gotoku.com/_next/static/chunks/app/%5Blocale%5D/page-0538fd4a9926c5bb.js';

const JSONParseRegex = /JSON\.parse\(["'](?<json>.+?)["']\)/g;

const Regexs = [
    [/\\xae/g, '®'], // copyright
    [/™/g, ''], // trademark
    [/\\'/g, '\''],
    [/\\xb7/g, '·'],
]

function processLanguageMatch(match, langOptions) {
    let jsonText = match.groups.json;
    Regexs.forEach(([regex, replacement]) => {
        jsonText = jsonText.replaceAll(regex, replacement);
    });

    const calendar = JSON.parse(jsonText);
    const [anniversary, birthday] = langOptions?.subTypeIndicator ?? [];

    return calendar.map(x => {
        let subType;

        if (langOptions?.subTypeIndicator) {
            if (x.title.endsWith(anniversary)) {
                subType = 'anniversary';
            } else if (x.title.endsWith(birthday)) {
                subType = 'birthday';
            }
        }

        return {
            ...x,
            calendar_sub_type: subType,
        };
    });
}

function extractJSON(jsText) {
    const matches = jsText.matchAll(JSONParseRegex)
        .filter(match => match.groups.json.includes('calendar_'))
        .toArray();

    return {
        ja: processLanguageMatch(matches[0], {
            subTypeIndicator: [' 発売記念日', ' 誕生日'],
        }),
        en: processLanguageMatch(matches[1], {
            subTypeIndicator: [' Anniversary', ' Birthday'],
        }),
        'zh-cn': processLanguageMatch(matches[2], {
            subTypeIndicator: [' 发售纪念日', ' 生日'],
        }),
        'zh-tw': processLanguageMatch(matches[3], {
            subTypeIndicator: [' 發售紀念日', ' 生日'],
        }),
        ko: processLanguageMatch(matches[4], {
            subTypeIndicator: [' 발매기념일', ' 생일'],
        }),
    };
}

async function fetchCalendar() {
    const resp = await fetch(CalendarSource, {
        cf: {
            cacheTtl: 3600,
        },
    });
    if (!resp.ok) {
        throw new Error('Source fetch failed');
    }

    return resp.text();
}


function cleanText(str = '') {
  return str.replace(/<br\s*\/?>/gi, '\n')
    .trim();
}

function calendarToEvents(calendar, {
    createdAt,
}) {
    return calendar.map((x) => {
        const [month, day] = x.calendar_start.split("-").map(Number);

        const event = {
            uid: `yakuza-calendar-${x.id}`,
            start: [2025, month, day],
            duration: { days: 1 },
            title: x.title,
            description: cleanText(x.calendar_subtitle),
            categories: x.calendar_sub_type ? [x.calendar_sub_type] : undefined,
            url: x.external_url,
            recurrenceRule: 'FREQ=YEARLY',
            created: createdAt,
            calName: 'Like a Dragon Calendar',
        };

        return event;
    });
}

function getWeeklyCreatedAt() {
    const weeklyCreatedAt = new Date();
    weeklyCreatedAt.setHours(0);
    weeklyCreatedAt.setMinutes(0);
    weeklyCreatedAt.setSeconds(0);
    weeklyCreatedAt.setMilliseconds(0);
    weeklyCreatedAt.setDate(weeklyCreatedAt.getDate() - weeklyCreatedAt.getDay()); // Set to last Monday

    return weeklyCreatedAt;
}

async function generateETag(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return `"${hashHex}"`;
}

async function start({ ifNoneMatch, lang, subTypes, reminder }) {
    const calendarResp = await fetchCalendar();

    const multiLanguagesCalendar = extractJSON(calendarResp);
    let filteredCalendar = multiLanguagesCalendar[lang];
    if (Array.isArray(subTypes) && subTypes.length > 0) {
        filteredCalendar = filteredCalendar.filter(x => subTypes.includes(x.calendar_sub_type));
    }

    const eventList = calendarToEvents(filteredCalendar, {
        createdAt: getWeeklyCreatedAt().getTime(),
    }); 

    const { error, value: events } = createEvents(eventList);
    if (error) {
        throw error;
    }

    const etag = await generateETag(JSON.stringify(eventList));
    if (ifNoneMatch && ifNoneMatch === etag) {
        return new Response(null, {
            status: 304,
            headers: {
                'ETag': etag,
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }

    return new Response(events, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'ETag': etag,
        },
    });
}

export default {
    async fetch(request, env) {
        const requestURL = new URL(request.url);
        const lang = requestURL.searchParams.get('lang') || 'zh-cn';
        let subTypes = requestURL.searchParams.getAll('subTypes');
        if (subTypes.length === 0) {
            subTypes = null;
        }

        const isDev = env.ENVIRONMENT === 'development';

        try {
            return await start({
                ifNoneMatch: request.headers.get('If-None-Match'),
                lang: lang,
                subTypes,
            });
        } catch (err) {
            console.error(err);
            return new Response(isDev ? err.message : 'Internal Server Error', { status: 500 });
        }
    }
}

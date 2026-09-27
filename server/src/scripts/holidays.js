import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

/**
 * Helper to convert '15-Jan-2026' into '2026-01-15'
 */
function parseTradingDate(dateStr) {
    if (!dateStr) return '';
    const monthMap = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const parts = String(dateStr).trim().split('-');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = monthMap[parts[1]] || parts[1];
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    return dateStr;
}

/**
 * Global Precious Metals (XAUUSD=X, XAGUSD=X) 2026 Trading Holidays & Schedule
 * Source: CME Globex / COMEX & LBMA Market Schedule
 */
export const METALS_HOLIDAYS_2026 = [
    {
        srNo: 1,
        date: '2026-01-01',
        tradingDate: '01-Jan-2026',
        weekDay: 'Thursday',
        holiday: "New Year's Day",
        status: 'Full Market Closure',
        sessionNotes: 'Market closed all day',
    },
    {
        srNo: 2,
        date: '2026-01-19',
        tradingDate: '19-Jan-2026',
        weekDay: 'Monday',
        holiday: 'Martin Luther King Jr. Day',
        status: 'Early Close',
        sessionNotes: 'Trading halts early at 13:00 CT / 14:30 ET',
    },
    {
        srNo: 3,
        date: '2026-02-16',
        tradingDate: '16-Feb-2026',
        weekDay: 'Monday',
        holiday: "Presidents' Day / Washington's Birthday",
        status: 'Early Close',
        sessionNotes: 'Trading halts early at 13:00 CT / 14:30 ET',
    },
    {
        srNo: 4,
        date: '2026-04-03',
        tradingDate: '03-Apr-2026',
        weekDay: 'Good Friday',
        holiday: 'Good Friday',
        status: 'Full Market Closure',
        sessionNotes: 'Market closed all day',
    },
    {
        srNo: 5,
        date: '2026-05-25',
        tradingDate: '25-May-2026',
        weekDay: 'Monday',
        holiday: 'Memorial Day',
        status: 'Early Close',
        sessionNotes: 'Trading halts early at 13:00 CT / 14:30 ET',
    },
    {
        srNo: 6,
        date: '2026-06-19',
        tradingDate: '19-Jun-2026',
        weekDay: 'Friday',
        holiday: 'Juneteenth National Independence Day',
        status: 'Early Close',
        sessionNotes: 'Trading halts early at 13:00 CT / 14:30 ET',
    },
    {
        srNo: 7,
        date: '2026-07-03',
        tradingDate: '03-Jul-2026',
        weekDay: 'Friday',
        holiday: 'US Independence Day (Observed)',
        status: 'Early Close',
        sessionNotes: 'Trading halts early at 13:00 CT / 14:30 ET',
    },
    {
        srNo: 8,
        date: '2026-09-07',
        tradingDate: '07-Sep-2026',
        weekDay: 'Monday',
        holiday: 'Labor Day',
        status: 'Early Close',
        sessionNotes: 'Trading halts early at 13:00 CT / 14:30 ET',
    },
    {
        srNo: 9,
        date: '2026-11-26',
        tradingDate: '26-Nov-2026',
        weekDay: 'Thursday',
        holiday: 'Thanksgiving Day',
        status: 'Early Close',
        sessionNotes: 'Trading halts early at 13:00 CT / 14:30 ET',
    },
    {
        srNo: 10,
        date: '2026-11-27',
        tradingDate: '27-Nov-2026',
        weekDay: 'Friday',
        holiday: 'Day After Thanksgiving',
        status: 'Early Close',
        sessionNotes: 'Trading halts early at 12:45 CT / 13:45 ET',
    },
    {
        srNo: 11,
        date: '2026-12-25',
        tradingDate: '25-Dec-2026',
        weekDay: 'Friday',
        holiday: 'Christmas Day',
        status: 'Full Market Closure',
        sessionNotes: 'Market closed all day',
    },
];

/**
 * Fetch trading holidays from NSE, BSE & Global Markets (Metals & Crypto) and save to holidays.json
 */
export async function fetchAndSaveHolidays() {
    const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
    };

    let rawData = null;

    // Method 1: Try Axios with complete browser headers
    try {
        const baseResponse = await axios.get('https://www.nseindia.com', {
            headers: browserHeaders,
            timeout: 8000,
        });

        const rawCookies = baseResponse.headers['set-cookie'] || [];
        const cookies = rawCookies.map(c => c.split(';')[0]).join('; ');

        const holidayResponse = await axios.get('https://www.nseindia.com/api/holiday-master?type=trading', {
            headers: {
                ...browserHeaders,
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.nseindia.com/',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Cookie': cookies,
                'X-Requested-With': 'XMLHttpRequest',
            },
            timeout: 8000,
        });

        if (holidayResponse?.data && (holidayResponse.data.CM || holidayResponse.data.FO)) {
            rawData = holidayResponse.data;
        }
    } catch (_) {
        // Fall back to curl session
    }

    // Method 2: Resilient cURL session fallback
    if (!rawData) {
        try {
            const cookieJarPath = path.resolve('/tmp', `nse_cookies_${Date.now()}.txt`);
            const curlCmd = `curl -s -c "${cookieJarPath}" -b "${cookieJarPath}" \
                -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" \
                -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8" \
                -H "Accept-Language: en-US,en;q=0.9" \
                "https://www.nseindia.com" > /dev/null && \
                curl -s -c "${cookieJarPath}" -b "${cookieJarPath}" \
                -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" \
                -H "Accept: application/json, text/plain, */*" \
                -H "Referer: https://www.nseindia.com/" \
                -H "Accept-Language: en-US,en;q=0.9" \
                "https://www.nseindia.com/api/holiday-master?type=trading"`;

            const { stdout } = await execAsync(curlCmd);
            if (fs.existsSync(cookieJarPath)) {
                try { fs.unlinkSync(cookieJarPath); } catch (_) {}
            }

            if (stdout && stdout.trim().startsWith('{')) {
                rawData = JSON.parse(stdout);
            }
        } catch (err) {
            console.error('Error fetching trading holidays:', err.message);
            throw err;
        }
    }

    if (!rawData) {
        throw new Error('Unable to retrieve trading holidays from exchange APIs.');
    }

    // Format and normalize the holiday lists for NSE & BSE
    const mapHolidays = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map((item, idx) => ({
            srNo: item.Sr_no || idx + 1,
            date: parseTradingDate(item.tradingDate),
            tradingDate: item.tradingDate,
            weekDay: item.weekDay,
            description: item.description,
            morningSession: item.morning_session || null,
            eveningSession: item.evening_session || null,
        }));
    };

    const nseCM = mapHolidays(rawData.CM);
    const nseFO = mapHolidays(rawData.FO);
    const nseCD = mapHolidays(rawData.CD);
    const nseCommodity = mapHolidays(rawData.COM);

    // BSE equity and derivatives share the identical SEBI holiday schedule
    const bseEquity = nseCM;
    const bseDerivatives = nseFO;
    const bseCurrency = nseCD;

    // Unique list of all holiday ISO date strings (YYYY-MM-DD) for equities
    const allEquityHolidayDates = Array.from(new Set(nseCM.map(h => h.date).filter(Boolean))).sort();

    // Global assets (Metals & Crypto)
    const cryptoAssets = [
        { symbol: 'BTC-USD', name: 'Bitcoin / USD' },
        { symbol: 'ETH-USD', name: 'Ethereum / USD' },
        { symbol: 'SOL-USD', name: 'Solana / USD' },
        { symbol: 'XRP-USD', name: 'XRP / USD' },
    ];

    const metalsAssets = [
        { symbol: 'XAUUSD=X', name: 'Gold Spot / US Dollar' },
        { symbol: 'XAGUSD=X', name: 'Silver Spot / US Dollar' },
    ];

    const outputPayload = {
        lastUpdated: new Date().toISOString(),
        year: 2026,
        summary: {
            totalIndianEquitiesHolidays: nseCM.length,
            totalMetalsHolidaysAndEarlyCloses: METALS_HOLIDAYS_2026.length,
            cryptoStatus: '24/7/365 Continuous Trading (0 Holidays)',
            exchangesCovered: ['NSE', 'BSE', 'CME_COMEX', 'CRYPTO_GLOBAL'],
        },
        NSE: {
            equities: nseCM,
            derivatives: nseFO,
            currency: nseCD,
            commodity: nseCommodity,
            rawSegments: Object.keys(rawData),
        },
        BSE: {
            equities: bseEquity,
            derivatives: bseDerivatives,
            currency: bseCurrency,
        },
        GLOBAL_METALS: {
            symbols: metalsAssets.map(m => m.symbol),
            market: 'CME Globex / COMEX & Global Spot OTC',
            tradingHours: 'Sunday 18:00 ET - Friday 17:00 ET (Daily break: 17:00 - 18:00 ET)',
            holidays: METALS_HOLIDAYS_2026,
            fullClosureDates: METALS_HOLIDAYS_2026.filter(h => h.status === 'Full Market Closure').map(h => h.date),
        },
        CRYPTO: {
            symbols: cryptoAssets.map(c => c.symbol),
            tradingHours: '24/7/365 Continuous',
            isAlwaysOpen: true,
            holidays: [],
            note: 'Cryptocurrencies (BTC, ETH, SOL, XRP) trade continuously without market holidays or weekend closures.',
        },
        symbolHolidayMap: {
            'XAUUSD=X': {
                symbol: 'XAUUSD=X',
                name: 'Gold Spot / US Dollar',
                type: 'METALS',
                market: 'CME Globex / LBMA Spot',
                is24x7: false,
                holidays: METALS_HOLIDAYS_2026,
            },
            'XAGUSD=X': {
                symbol: 'XAGUSD=X',
                name: 'Silver Spot / US Dollar',
                type: 'METALS',
                market: 'CME Globex / LBMA Spot',
                is24x7: false,
                holidays: METALS_HOLIDAYS_2026,
            },
            'BTC-USD': {
                symbol: 'BTC-USD',
                name: 'Bitcoin / US Dollar',
                type: 'CRYPTO',
                is24x7: true,
                tradingHours: '24/7/365 Continuous',
                holidays: [],
            },
            'ETH-USD': {
                symbol: 'ETH-USD',
                name: 'Ethereum / US Dollar',
                type: 'CRYPTO',
                is24x7: true,
                tradingHours: '24/7/365 Continuous',
                holidays: [],
            },
            'SOL-USD': {
                symbol: 'SOL-USD',
                name: 'Solana / US Dollar',
                type: 'CRYPTO',
                is24x7: true,
                tradingHours: '24/7/365 Continuous',
                holidays: [],
            },
            'XRP-USD': {
                symbol: 'XRP-USD',
                name: 'XRP / US Dollar',
                type: 'CRYPTO',
                is24x7: true,
                tradingHours: '24/7/365 Continuous',
                holidays: [],
            },
        },
        equityHolidayDates: allEquityHolidayDates,
    };

    // Save to data directory and scripts directory
    const targetDirs = [
        path.resolve(__dirname, '../data'),
        path.resolve(__dirname, './'),
    ];

    for (const dir of targetDirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, 'holidays.json');
        fs.writeFileSync(filePath, JSON.stringify(outputPayload, null, 2), 'utf8');
        console.log(`Saved holidays to: ${filePath}`);
    }

    console.log('\n--- NSE & BSE Trading Holidays (Equities) ---');
    console.table(
        nseCM.map(h => ({
            'Sr': h.srNo,
            'Date': h.date,
            'Day': h.weekDay,
            'Holiday Description': h.description,
        }))
    );

    console.log('\n--- Global Metals Trading Holidays (XAUUSD=X, XAGUSD=X) ---');
    console.table(
        METALS_HOLIDAYS_2026.map(h => ({
            'Sr': h.srNo,
            'Date': h.date,
            'Day': h.weekDay,
            'Holiday': h.holiday,
            'Status': h.status,
        }))
    );

    console.log('\n--- Crypto Assets (BTC-USD, ETH-USD, SOL-USD, XRP-USD) ---');
    console.log('Cryptocurrencies operate 24/7/365 without exchange holidays.');

    return outputPayload;
}

// Execute directly if run via CLI
if (process.argv[1]?.endsWith('holidays.js')) {
    fetchAndSaveHolidays().catch(err => {
        console.error('Script failed:', err.message);
        process.exit(1);
    });
}
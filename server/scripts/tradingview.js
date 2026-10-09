import { getCandles } from '@mathieuc/tradingview/data';
import fs from 'fs';

const CSV_FILE = 'tradingview_exact_data.csv';

const TV_SYMBOLS = [
    'DELTAIN:BTCUSD.P',
    'DELTAIN:ETHUSD.P',
    'DELTAIN:XRPUSD.P',
    'DELTAIN:SOLUSD.P',
    'DELTAIN:XAUTUSD.P'
];

async function fetchTVData() {
    fs.writeFileSync(
        CSV_FILE,
        'symbol,date,open,high,low,close,volume\n'
    );

    for (const symbol of TV_SYMBOLS) {
        console.log(`Fetching TradingView data for ${symbol}...`);

        try {
            const candles = await getCandles({
                symbol,
                timeframe: 'D',
                count: 20
            });

            const records = candles.map(p => {
                const dateStr = new Date(p.time * 1000)
                    .toISOString()
                    .split('T')[0];

                return `${symbol},${dateStr},${p.open},${p.high},${p.low},${p.close},${p.volume ?? 0}`;
            });

            fs.appendFileSync(
                CSV_FILE,
                records.join('\n') + '\n'
            );

            console.log(`✓ Fetched ${records.length} records for ${symbol}`);
        } catch (err) {
            console.error(`✗ Error fetching ${symbol}:`, err.message);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\nExport complete. Check ${CSV_FILE}`);
}

fetchTVData();
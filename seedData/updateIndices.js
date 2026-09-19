import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'market_data'
};

function parseCsvLine(str) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(cur.trim().replace(/^"|"$/g, ''));
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
}

async function processIndices() {
    console.log("Connecting to MySQL Database...");
    const pool = await mysql.createPool(dbConfig);
    
    // Target the folder where index CSV files are placed
    let folderPath = path.join(process.cwd(), 'index_csvs');
    if (!fs.existsSync(folderPath)) {
        folderPath = path.join(__dirname, 'index_csvs');
    }
    if (!fs.existsSync(folderPath)) {
        folderPath = __dirname;
    }
    if (!fs.existsSync(folderPath)) {
        folderPath = path.join(process.cwd(), 'seedData');
    }

    console.log(`Searching for Index CSVs in: ${folderPath}`);

    // Read all CSV files in the folder (excluding Equity.csv)
    const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.csv') && file !== 'Equity.csv');

    if (files.length === 0) {
        console.log("No Index CSV files found.");
        await pool.end();
        return;
    }

    console.log(`Found ${files.length} index CSV files to process.\n`);

    let totalUpdatedRows = 0;

    for (const file of files) {
        // Dynamically create the index name: "Nifty_Private_Bank.csv" -> "Nifty Private Bank"
        const indexName = path.parse(file).name.replace(/_/g, ' ');
        console.log(`Processing file: ${file} -> Mapped Index Name: '${indexName}'`);

        const filePath = path.join(folderPath, file);
        const csvData = fs.readFileSync(filePath, 'utf-8');
        const lines = csvData.split('\n').filter(line => line.trim() !== '');

        if (lines.length < 2) continue;

        // Extract headers to find the 'Symbol' column dynamically
        const headers = parseCsvLine(lines[0]);
        const symbolColIndex = headers.findIndex(h => h.toLowerCase() === 'symbol');

        if (symbolColIndex === -1) {
            console.log(`✗ Skipped: Could not find 'Symbol' column in ${file}`);
            continue;
        }

        let updateCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const columns = parseCsvLine(lines[i]);
            
            if (columns && columns.length > symbolColIndex) {
                const rawSymbol = columns[symbolColIndex].trim();
                
                if (rawSymbol && rawSymbol !== '-' && rawSymbol.toLowerCase() !== 'symbol') {
                    const targetSymbolNS = `${rawSymbol}.NS`;
                    const targetSymbolPlain = rawSymbol;

                    // Update the indice column for this specific symbol (.NS or plain)
                    const query = `
                        UPDATE historical_candles 
                        SET indice = ? 
                        WHERE symbol = ? OR symbol = ?
                    `;
                    
                    const [result] = await pool.query(query, [indexName, targetSymbolNS, targetSymbolPlain]);
                    
                    if (result.affectedRows > 0) {
                        updateCount += result.affectedRows;
                    }
                }
            }
        }
        
        console.log(`✓ Updated ${updateCount} historical candle records with '${indexName}'.\n`);
        totalUpdatedRows += updateCount;
    }

    console.log(`\nFinished! Successfully updated ${totalUpdatedRows} total historical candle records across all indices.`);
    await pool.end();
}

processIndices();
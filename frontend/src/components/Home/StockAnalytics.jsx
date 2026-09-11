import React, { useState } from "react";
import "./StockAnalytics.css";

const rows = [
    {
        no: "01",
        date: "06-Sep-2024",
        open: "2,980.50",
        high: "3,025.00",
        low: "2,972.10",
        close: "3,018.40",
        avg: "3,005.15",
        range: "52.90",
        status: "HLCH",
        statusType: "bullish",
        pointer: "Y3",
        pointerType: "orange",
    },
    {
        no: "02",
        date: "05-Sep-2024",
        open: "2,995.00",
        high: "3,004.80",
        low: "2,960.00",
        close: "2,975.20",
        avg: "2,982.40",
        range: "44.80",
        status: "HLCL",
        statusType: "bearish",
        pointer: "R2",
        pointerType: "red",
    },
    {
        no: "03",
        date: "04-Sep-2024",
        open: "2,940.00",
        high: "3,002.50",
        low: "2,935.00",
        close: "2,998.10",
        avg: "2,968.75",
        range: "67.50",
        status: "HLCH",
        statusType: "bullish",
        pointer: "G-BUY",
        pointerType: "green",
    },
    {
        no: "04",
        date: "03-Sep-2024",
        open: "2,925.00",
        high: "2,950.00",
        low: "2,918.00",
        close: "2,945.30",
        avg: "2,934.00",
        range: "32.00",
        status: "HLCH",
        statusType: "bullish",
        pointer: "Y1",
        pointerType: "orange",
    },
    {
        no: "05",
        date: "02-Sep-2024",
        open: "2,960.00",
        high: "2,965.00",
        low: "2,915.20",
        close: "2,921.00",
        avg: "2,940.10",
        range: "49.80",
        status: "HLCL",
        statusType: "bearish",
        pointer: "R1",
        pointerType: "red",
    },
    {
        no: "06",
        date: "30-Aug-2024",
        open: "2,920.00",
        high: "2,975.00",
        low: "2,910.00",
        close: "2,968.45",
        avg: "2,942.50",
        range: "65.00",
        status: "HLCH",
        statusType: "bullish",
        pointer: "Y6",
        pointerType: "orange",
    },
    {
        no: "07",
        date: "29-Aug-2024",
        open: "2,945.00",
        high: "2,952.10",
        low: "2,905.00",
        close: "2,912.80",
        avg: "2,928.55",
        range: "47.10",
        status: "HLCL",
        statusType: "bearish",
        pointer: "R4",
        pointerType: "red",
    },
    {
        no: "08",
        date: "28-Aug-2024",
        open: "2,910.00",
        high: "2,955.00",
        low: "2,902.00",
        close: "2,949.60",
        avg: "2,928.50",
        range: "53.00",
        status: "HLCH",
        statusType: "bullish",
        pointer: "Y3",
        pointerType: "orange",
    },
    {
        no: "09",
        date: "27-Aug-2024",
        open: "2,885.00",
        high: "2,918.00",
        low: "2,875.00",
        close: "2,912.40",
        avg: "2,896.50",
        range: "43.00",
        status: "HLCH",
        statusType: "bullish",
        pointer: "G-BUY",
        pointerType: "green",
    },
    {
        no: "10",
        date: "26-Aug-2024",
        open: "2,915.00",
        high: "2,924.00",
        low: "2,870.00",
        close: "2,880.00",
        avg: "2,897.00",
        range: "54.00",
        status: "HLCL",
        statusType: "bearish",
        pointer: "R1",
        pointerType: "red",
    },
];

const menuItems = [
    { label: "Dashboard", icon: "▦" },
    { label: "Stock", icon: "▥", active: true },
    { label: "Wallet", icon: "♧" },
    { label: "Profile", icon: "♙" },
    { label: "Contact", icon: "♧" },
];

function SummaryCard({ label, value, sub, extra, type }) {
    return (
        <div className="summary-card">
            <div className="summary-label">{label}</div>

            <div className={`summary-value ${type || ""}`}>
                {value}
                {extra && <span className="summary-extra">{extra}</span>}
            </div>

            {sub && <div className="summary-sub">{sub}</div>}
        </div>
    );
}

function ActionIcons() {
    return (
        <div className="row-actions">
            <button title="Chart">⌁</button>
            <button title="Download">⇩</button>
            <button title="View">♧</button>
        </div>
    );
}

function StockAnalytics() {
    const [market, setMarket] = useState("All Market");
    const [index, setIndex] = useState("NIFTY 50");
    const [ticker, setTicker] = useState("RELIANCE");
    const [timeframe, setTimeframe] = useState("Daily");

    return (
        <div className="terminal-shell">

            

            {/* MAIN AREA */}
            <main className="main-content">

               

                

                
                {/* TABLE SECTION */}
                <section className="matrix-section">

                    <div className="matrix-header">

                        <div className="matrix-title">
                            <h2>Institutional Analytical Matrix</h2>
                        </div>

                        <div className="sessions">
                            <strong>248</strong>
                            <span>SESSIONS</span>
                        </div>

                        <div className="algorithm">
                            <span>| Range Algorithm: HLCH/HLCL Matrix Engine</span>
                            <small>v1.8</small>
                        </div>

                        <div className="legend">
                            <span>
                                <i className="legend-dot green"></i>
                                HLCH (Higher<br />Bullish)
                            </span>

                            <span>
                                <i className="legend-dot red"></i>
                                HLCL (Lower<br />Bearish)
                            </span>

                            <span>
                                <i className="legend-dot orange"></i>
                                Y1-Y6<br />Breakout
                            </span>
                        </div>

                    </div>

                    <div className="table-wrapper">
                        <table className="matrix-table">

                            <thead>
                                <tr>
                                    <th>SR.<br />NO.</th>
                                    <th>DATE ↓</th>
                                    <th>OPEN</th>
                                    <th>HIGH</th>
                                    <th>LOW</th>
                                    <th>CLOSE</th>
                                    <th>AVG</th>
                                    <th>RANGE</th>
                                    <th>STATUS</th>
                                    <th>POINTER</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>

                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.no}>

                                        <td className="serial">{row.no}</td>

                                        <td className="date-value">
                                            {row.date}
                                        </td>

                                        <td>{row.open}</td>

                                        <td className="high-value">
                                            {row.high}
                                        </td>

                                        <td className={row.statusType === "bearish" ? "low-red" : ""}>
                                            {row.low}
                                        </td>

                                        <td className={row.statusType === "bearish" ? "close-red" : "close-value"}>
                                            {row.close}
                                        </td>

                                        <td>{row.avg}</td>

                                        <td className="range-value">
                                            {row.range}
                                        </td>

                                        <td>
                                            <span className={`status-badge ${row.statusType}`}>
                                                {row.statusType === "bullish" ? "• HLCH" : "• HLCL"}
                                            </span>
                                        </td>

                                        <td>
                                            <span className={`pointer-badge ${row.pointerType}`}>
                                                {row.pointer}
                                            </span>
                                        </td>

                                        <td>
                                            <ActionIcons />
                                        </td>

                                    </tr>
                                ))}
                            </tbody>

                        </table>
                    </div>

                </section>

            </main>
        </div>
    );
}

export default StockAnalytics;

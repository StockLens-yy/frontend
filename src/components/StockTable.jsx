import { useState, useEffect, useRef } from 'react';
import ChartModal from './ChartModal';
import api from '../api/axios';

const FLASH_MS = 400;

function StockTable({ stocks, user, watchlist, setWatchlist }) {
    const [selectedStock, setSelectedStock] = useState(null);
    const [flash, setFlash] = useState({});
    const prevPrices = useRef({});

    // 직전 목록보다 가격이 오르거나 내린 종목을 잠깐 강조한다
    useEffect(() => {
        const changed = {};
        for (const s of stocks) {
            const prev = prevPrices.current[s.symbol];
            if (prev != null && s.price != null && prev !== s.price) {
                changed[s.symbol] = s.price > prev ? 'up' : 'down';
            }
            prevPrices.current[s.symbol] = s.price;
        }
        if (Object.keys(changed).length === 0) return;

        const show = setTimeout(() => setFlash(changed), 0);
        const hide = setTimeout(() => setFlash({}), FLASH_MS);
        return () => { clearTimeout(show); clearTimeout(hide); };
    }, [stocks]);

    const toggleWatch = async (stock) => {
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }
        const isWatched = watchlist.some(w => w.symbol === stock.symbol);
        const params = new URLSearchParams();
        params.append('symbol', stock.symbol);
        if (!isWatched) params.append('name', stock.name);

        const url = isWatched ? '/api/stocks/watchlist/remove' : '/api/stocks/watchlist/add';
        await api.post(url, params);

        if (isWatched) {
            setWatchlist(watchlist.filter(w => w.symbol !== stock.symbol));
        } else {
            setWatchlist([...watchlist, { symbol: stock.symbol, name: stock.name }]);
        }
    };

    return (
        <>
            <div style={styles.tableWrap}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{...styles.th, textAlign: 'left'}}>#</th>
                            <th style={{...styles.th, textAlign: 'left'}}>종목명</th>
                            <th style={styles.th}>현재가</th>
                            <th style={styles.th}>전일대비</th>
                            <th style={styles.th}>등락률</th>
                            <th style={styles.th}>거래량</th>
                            <th style={styles.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {stocks.map((stock, i) => {
                            const isWatched = watchlist.some(w => w.symbol === stock.symbol);
                            const changeColor = stock.change > 0 ? '#dc2626' : stock.change < 0 ? '#2563eb' : '#6b7280';
                            return (
                                <tr key={stock.symbol} style={styles.tr}>
                                    <td style={{...styles.td, textAlign: 'left', color: '#9ca3af', fontSize: '12px'}}>{i + 1}</td>
                                    <td style={{...styles.td, textAlign: 'left', cursor: 'pointer'}}
                                        onClick={() => setSelectedStock(stock)}>
                                        <div style={styles.stockName}>{stock.name}</div>
                                        <div style={styles.stockCode}>{stock.symbol}</div>
                                    </td>
                                    <td style={{...styles.td, fontWeight: 600, ...styles.flash[flash[stock.symbol]]}}>{stock.price?.toLocaleString()}원</td>
                                    <td style={{...styles.td, color: changeColor}}>{stock.change > 0 ? '+' : ''}{stock.change?.toLocaleString()}</td>
                                    <td style={{...styles.td, color: changeColor}}>{stock.changePercent > 0 ? '+' : ''}{stock.changePercent}%</td>
                                    <td style={{...styles.td, color: '#6b7280', fontSize: '12px'}}>{stock.volume?.toLocaleString()}</td>
                                    <td style={styles.td}>
                                        <button
                                            onClick={() => toggleWatch(stock)}
                                            style={{...styles.watchBtn, color: isWatched ? '#f59e0b' : '#d1d5db'}}
                                        >★</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {selectedStock && (
                <ChartModal
                    stock={stocks.find(s => s.symbol === selectedStock.symbol) || selectedStock}
                    onClose={() => setSelectedStock(null)}
                />
            )}
        </>
    );
}

const styles = {
    tableWrap: { background: 'white', borderRadius: '10px', border: '1px solid #e8eaed', overflow: 'hidden', marginTop: '16px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '11px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e8eaed' },
    tr: { borderBottom: '1px solid #f3f4f6' },
    td: { padding: '13px 16px', textAlign: 'right', fontSize: '13px', color: '#374151' },
    flash: {
        up: { background: 'rgba(220, 38, 38, 0.12)', transition: 'background 0.2s' },
        down: { background: 'rgba(37, 99, 235, 0.12)', transition: 'background 0.2s' },
    },
    stockName: { fontWeight: 600, fontSize: '13px', color: '#111827' },
    stockCode: { fontSize: '11px', color: '#9ca3af', marginTop: '2px' },
    watchBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px' },
};

export default StockTable;
import { useState, useEffect, useRef } from 'react';
import ChartModal from './ChartModal';
import api from '../api/axios';

const TYPE_LABEL = { EF: 'ETF', FS: '외국주', DR: 'DR' };

// 코스피·코스닥 전 종목 검색. 선택한 종목만 실시간 시세를 조회해 차트로 보여준다.
function StockSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loadingSymbol, setLoadingSymbol] = useState(null);
    const [selectedStock, setSelectedStock] = useState(null);
    const boxRef = useRef(null);

    // 입력이 멈추고 250ms 뒤에 검색
    useEffect(() => {
        const q = query.trim();
        if (!q) return;
        const timer = setTimeout(async () => {
            try {
                const res = await api.get('/api/stocks/search', { params: { q } });
                setResults(res.data);
                setOpen(true);
            } catch (e) {
                console.error(e);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [query]);

    // 바깥을 클릭하면 결과 닫기
    useEffect(() => {
        const handleClick = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleChange = (e) => {
        setQuery(e.target.value);
        if (!e.target.value.trim()) {
            setResults([]);
            setOpen(false);
        }
    };

    const handleSelect = async (item) => {
        setLoadingSymbol(item.symbol);
        try {
            const res = await api.get(`/api/stocks/${item.symbol}/quote`);
            setSelectedStock(res.data);
            setOpen(false);
        } catch (e) {
            console.error(e);
            alert('시세 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        }
        setLoadingSymbol(null);
    };

    return (
        <div style={styles.wrap} ref={boxRef}>
            <input
                style={styles.input}
                value={query}
                onChange={handleChange}
                onFocus={() => results.length > 0 && setOpen(true)}
                placeholder="전체 종목 검색 (종목명 또는 종목코드)"
            />
            {open && (
                <div style={styles.dropdown}>
                    {results.length === 0 ? (
                        <div style={styles.empty}>검색 결과가 없습니다.</div>
                    ) : results.map(item => (
                        <div
                            key={item.symbol}
                            style={styles.item}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                            <div>
                                <span style={styles.name}>{item.name}</span>
                                {TYPE_LABEL[item.type] && <span style={styles.tag}>{TYPE_LABEL[item.type]}</span>}
                            </div>
                            <div style={styles.meta}>
                                {loadingSymbol === item.symbol ? '조회 중...' : `${item.symbol} · ${item.market}`}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedStock && (
                <ChartModal
                    stock={selectedStock}
                    onClose={() => setSelectedStock(null)}
                />
            )}
        </div>
    );
}

const styles = {
    wrap: { position: 'relative', marginBottom: '16px' },
    input: {
        width: '100%', boxSizing: 'border-box', padding: '12px 16px',
        fontSize: '14px', border: '1px solid #e2e8f0', borderRadius: '10px',
        background: 'white', outline: 'none', color: '#0f172a',
    },
    dropdown: {
        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
        background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: '360px', overflowY: 'auto',
    },
    item: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: 'white',
    },
    name: { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
    tag: {
        marginLeft: '8px', fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
        background: '#eef2ff', color: '#4f46e5', fontWeight: 600,
    },
    meta: { fontSize: '12px', color: '#94a3b8' },
    empty: { padding: '14px 16px', fontSize: '13px', color: '#94a3b8' },
};

export default StockSearch;

import { useState, useEffect } from 'react';
import StockTable from '../components/StockTable';
import WatchList from '../components/WatchList';
import api from '../api/axios';

const POLL_INTERVAL_MS = 10000;

// 종목들 중 가장 최근 시세 갱신 시각
const latestUpdate = (stocks) => {
    const times = stocks.map(s => s.updatedAt).filter(Boolean).sort();
    if (times.length === 0) return '서버 시작 시점';
    return new Date(times[times.length - 1]).toLocaleTimeString();
};

function HomePage({ user }) {
    const [stocks, setStocks] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [lastUpdate, setLastUpdate] = useState('서버 시작 시점');
    const [refreshing, setRefreshing] = useState(false);
    const [aiResult, setAiResult] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    const fetchStocks = async () => {
        try {
            const res = await api.get('/api/stocks');
            setStocks(res.data);
            setLastUpdate(latestUpdate(res.data));
        } catch (e) { console.error(e); }
    };

    const fetchWatchlist = async () => {
        try {
            const res = await api.get('/api/stocks/watchlist');
            setWatchlist(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchStocks();
        if (user) fetchWatchlist();
    }, [user]);

    // 실시간 체결가 스트림: 체결될 때마다(0.2초 단위로 묶여) 들어오는 가격을 바로 반영한다
    useEffect(() => {
        const source = new EventSource(`${api.defaults.baseURL}/api/stocks/stream`);
        source.addEventListener('quotes', (e) => {
            const quotes = JSON.parse(e.data);
            const bySymbol = Object.fromEntries(quotes.map(q => [q.symbol, q]));
            setStocks(prev => prev.map(s => bySymbol[s.symbol] ? { ...s, ...bySymbol[s.symbol] } : s));
            setLastUpdate(latestUpdate(quotes));
        });
        return () => source.close();
    }, []);

    // 실시간 등록 한도(40종목) 밖의 종목은 백엔드가 주기적으로 갱신하므로, 목록도 주기적으로 다시 받아온다
    useEffect(() => {
        const timer = setInterval(() => {
            if (!document.hidden) fetchStocks();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const res = await api.post('/api/stocks/refresh');
            // 갱신 결과가 비어 있으면 기존 목록을 유지한다
            if (res.data.length === 0) {
                setLastUpdate('갱신 실패 (이전 데이터)');
            } else {
                await fetchStocks(); // 자동 갱신과 같은 순서로 보여주기 위해 목록을 다시 받는다
            }
        } catch (e) {
            console.error(e);
            setLastUpdate('갱신 실패 (이전 데이터)');
        }
        setRefreshing(false);
    };

    const handleAiRecommend = async () => {
        setAiLoading(true);
        setAiResult('');
        try {
            const res = await api.get('/api/stocks/ai-recommend');
            setAiResult(res.data);
        } catch (e) {
            setAiResult('추천 실패: 로그인이 필요합니다.');
        }
        setAiLoading(false);
    };

    const upCount = stocks.filter(s => s.change > 0).length;
    const downCount = stocks.filter(s => s.change < 0).length;

    return (
        <div style={styles.container}>

            {/* 상단 요약 카드 */}
            <div style={styles.summaryRow}>
                <div style={styles.summaryCard}>
                    <div style={styles.summaryLabel}>전체 종목</div>
                    <div style={styles.summaryValue}>{stocks.length}</div>
                </div>
                <div style={styles.summaryCard}>
                    <div style={styles.summaryLabel}>상승</div>
                    <div style={{...styles.summaryValue, color: '#ef4444'}}>{upCount}</div>
                </div>
                <div style={styles.summaryCard}>
                    <div style={styles.summaryLabel}>하락</div>
                    <div style={{...styles.summaryValue, color: '#3b82f6'}}>{downCount}</div>
                </div>
                <div style={styles.summaryCard}>
                    <div style={styles.summaryLabel}>마지막 업데이트</div>
                    <div style={styles.summaryValueSm}>{lastUpdate}</div>
                </div>
            </div>

            {/* AI 추천 결과 */}
            {aiResult && (
                <div style={styles.aiResult}>
                    <div style={styles.aiHeader}>
                        <div style={styles.aiTitleWrap}>
                            <div style={styles.aiDot}></div>
                            <h3 style={styles.aiTitle}>AI 종목 추천</h3>
                        </div>
                        <button style={styles.aiClose} onClick={() => setAiResult('')}>✕</button>
                    </div>
                    <p style={styles.aiContent}>{aiResult}</p>
                </div>
            )}

            {/* 액션 바 */}
            <div style={styles.actionBar}>
                <div style={styles.tabs}>
                    <button
                        style={{...styles.tabBtn, ...(activeTab === 'all' ? styles.tabBtnActive : {})}}
                        onClick={() => setActiveTab('all')}>
                        전체 Top50
                    </button>
                    {user && (
                        <button
                            style={{...styles.tabBtn, ...(activeTab === 'watchlist' ? styles.tabBtnActive : {})}}
                            onClick={() => setActiveTab('watchlist')}>
                            관심종목
                            {watchlist.length > 0 && (
                                <span style={styles.badge}>{watchlist.length}</span>
                            )}
                        </button>
                    )}
                </div>
                <div style={styles.actionBtns}>
                    <button
                        style={styles.btnSecondary}
                        onClick={handleAiRecommend}
                        disabled={aiLoading}>
                        {aiLoading ? (
                            <span>분석 중...</span>
                        ) : (
                            <span>AI 추천</span>
                        )}
                    </button>
                    <button
                        style={{...styles.btnPrimary, opacity: refreshing ? 0.7 : 1}}
                        onClick={handleRefresh}
                        disabled={refreshing}>
                        {refreshing ? '업데이트 중...' : '실시간 업데이트'}
                    </button>
                </div>
            </div>

            {/* 탭 컨텐츠 */}
            {activeTab === 'all' ? (
                <StockTable
                    stocks={stocks}
                    user={user}
                    watchlist={watchlist}
                    setWatchlist={setWatchlist}
                />
            ) : (
                <WatchList
                    watchlist={watchlist}
                    setWatchlist={setWatchlist}
                    stocks={stocks}
                />
            )}
        </div>
    );
}

const styles = {
    container: { maxWidth: '1200px', margin: '0 auto', padding: '32px 48px' },
    summaryRow: { display: 'flex', gap: '16px', marginBottom: '24px' },
    summaryCard: {
        flex: 1, background: 'white', borderRadius: '12px',
        padding: '20px 24px', border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    },
    summaryLabel: { fontSize: '12px', color: '#94a3b8', fontWeight: 500, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' },
    summaryValue: { fontSize: '28px', fontWeight: 700, color: '#0f172a' },
    summaryValueSm: { fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '4px' },
    aiResult: {
        background: 'linear-gradient(135deg, #faf5ff, #f0f9ff)',
        border: '1px solid #e9d5ff',
        borderRadius: '12px', padding: '20px 24px', marginBottom: '24px',
    },
    aiHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    aiTitleWrap: { display: 'flex', alignItems: 'center', gap: '8px' },
    aiDot: { width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
    aiTitle: { fontSize: '14px', fontWeight: 600, color: '#4c1d95' },
    aiClose: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' },
    aiContent: { fontSize: '13px', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' },
    actionBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
    tabs: { display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' },
    tabBtn: {
        background: 'transparent', border: 'none', color: '#64748b',
        padding: '7px 16px', cursor: 'pointer', fontSize: '13px',
        fontWeight: 500, borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '6px',
    },
    tabBtnActive: { background: 'white', color: '#0f172a', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
    badge: {
        background: '#6366f1', color: 'white', borderRadius: '10px',
        padding: '1px 7px', fontSize: '11px', fontWeight: 600,
    },
    actionBtns: { display: 'flex', gap: '8px' },
    btnPrimary: {
        padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
        border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
    },
    btnSecondary: {
        padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
        background: 'white', color: '#475569', border: '1px solid #e2e8f0', cursor: 'pointer',
    },
};

export default HomePage;
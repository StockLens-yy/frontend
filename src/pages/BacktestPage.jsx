import { useState, useEffect } from 'react';
import EquityChart from '../components/EquityChart';
import api from '../api/axios';

const PRESETS = [
    { label: '단기 (3/10)', short: 3, long: 10 },
    { label: '기본 (5/20)', short: 5, long: 20 },
    { label: '중기 (10/60)', short: 10, long: 60 },
    { label: '장기 (20/60)', short: 20, long: 60 },
];

function BacktestPage() {
    const [stocks, setStocks] = useState([]);
    const [symbol, setSymbol] = useState('005930');
    const [shortPeriod, setShortPeriod] = useState(5);
    const [longPeriod, setLongPeriod] = useState(20);
    const [initialCapital, setInitialCapital] = useState(10000000);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [collecting, setCollecting] = useState(false);

    useEffect(() => {
        api.get('/api/stocks')
            .then(res => setStocks(res.data))
            .catch(() => setStocks([]));
    }, []);

    const runBacktest = async () => {
        if (shortPeriod >= longPeriod) {
            setError('단기 기간은 장기 기간보다 작아야 합니다.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const params = { shortPeriod, longPeriod, initialCapital };
            if (from) params.from = from;
            if (to) params.to = to;

            const res = await api.get(`/api/stocks/${symbol}/backtest`, { params });
            setResult(res.data);
        } catch (e) {
            setError(typeof e.response?.data === 'string'
                ? e.response.data
                : '백테스팅에 실패했습니다.');
            setResult(null);
        }
        setLoading(false);
    };

    const collectPrices = async () => {
        setCollecting(true);
        try {
            await api.post(`/api/stocks/${symbol}/prices/collect`, null, { params: { days: 100 } });
            await runBacktest();
        } catch {
            setError('일봉 수집에 실패했습니다.');
        }
        setCollecting(false);
    };

    const applyPreset = (preset) => {
        setShortPeriod(preset.short);
        setLongPeriod(preset.long);
    };

    const stockName = stocks.find(s => s.symbol === symbol)?.name ?? symbol;
    const excess = result ? result.totalReturnPct - result.buyAndHoldReturnPct : 0;
    const hasData = result && result.equityCurve.length > 0;

    return (
        <div style={styles.container}>
            <div style={styles.pageHead}>
                <h1 style={styles.pageTitle}>백테스팅</h1>
                <p style={styles.pageDesc}>
                    이동평균 교차 전략을 과거 데이터로 시뮬레이션합니다.
                    골든크로스에 매수, 데드크로스에 매도하며 체결은 신호 다음 거래일 종가로 처리합니다.
                </p>
            </div>

            {/* 설정 */}
            <div style={styles.panel}>
                <div style={styles.fieldRow}>
                    <div style={{ ...styles.field, flex: 2 }}>
                        <label style={styles.label}>종목</label>
                        <select style={styles.input} value={symbol} onChange={e => setSymbol(e.target.value)}>
                            {stocks.length === 0 && <option value="005930">005930</option>}
                            {stocks.map(s => (
                                <option key={s.symbol} value={s.symbol}>{s.name} ({s.symbol})</option>
                            ))}
                        </select>
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>단기 이동평균</label>
                        <input style={styles.input} type="number" min="1" value={shortPeriod}
                               onChange={e => setShortPeriod(Number(e.target.value))} />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>장기 이동평균</label>
                        <input style={styles.input} type="number" min="2" value={longPeriod}
                               onChange={e => setLongPeriod(Number(e.target.value))} />
                    </div>
                    <div style={{ ...styles.field, flex: 1.4 }}>
                        <label style={styles.label}>초기 자본</label>
                        <input style={styles.input} type="number" step="1000000" value={initialCapital}
                               onChange={e => setInitialCapital(Number(e.target.value))} />
                    </div>
                </div>

                <div style={styles.fieldRow}>
                    <div style={styles.field}>
                        <label style={styles.label}>시작일 (선택)</label>
                        <input style={styles.input} type="date" value={from}
                               onChange={e => setFrom(e.target.value)} />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>종료일 (선택)</label>
                        <input style={styles.input} type="date" value={to}
                               onChange={e => setTo(e.target.value)} />
                    </div>
                    <div style={{ ...styles.field, flex: 2.4 }}>
                        <label style={styles.label}>프리셋</label>
                        <div style={styles.presetRow}>
                            {PRESETS.map(p => (
                                <button
                                    key={p.label}
                                    style={{
                                        ...styles.presetBtn,
                                        ...(shortPeriod === p.short && longPeriod === p.long
                                            ? styles.presetBtnActive : {}),
                                    }}
                                    onClick={() => applyPreset(p)}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ ...styles.field, justifyContent: 'flex-end' }}>
                        <button style={{ ...styles.runBtn, opacity: loading ? 0.7 : 1 }}
                                onClick={runBacktest} disabled={loading}>
                            {loading ? '시뮬레이션 중...' : '백테스팅 실행'}
                        </button>
                    </div>
                </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {/* 데이터 없음 */}
            {result && !hasData && (
                <div style={styles.empty}>
                    <div style={styles.emptyTitle}>{stockName}의 일봉 데이터가 없습니다</div>
                    <p style={styles.emptyDesc}>
                        백테스팅에는 누적된 일봉 시계열이 필요합니다. 이 종목의 최근 100일치를 먼저 수집하세요.
                    </p>
                    <button style={{ ...styles.runBtn, opacity: collecting ? 0.7 : 1 }}
                            onClick={collectPrices} disabled={collecting}>
                        {collecting ? '수집 중...' : '일봉 수집하기'}
                    </button>
                </div>
            )}

            {/* 결과 */}
            {hasData && (
                <>
                    <div style={styles.summaryRow}>
                        <Metric label="전략 수익률" value={pct(result.totalReturnPct)}
                                color={signColor(result.totalReturnPct)} big />
                        <Metric label="단순 보유" value={pct(result.buyAndHoldReturnPct)}
                                color={signColor(result.buyAndHoldReturnPct)} big />
                        <Metric label="초과 성과" value={pct(excess)} color={signColor(excess)} big />
                        <Metric label="최대 낙폭 (MDD)" value={`${result.maxDrawdownPct.toFixed(2)}%`}
                                color="#0f172a" big />
                        <Metric label="승률" value={`${result.winRate.toFixed(0)}%`}
                                sub={`${result.tradeCount}건`} color="#0f172a" big />
                    </div>

                    <div style={styles.metaBar}>
                        <MetaItem label="구간" value={`${result.from} ~ ${result.to}`} />
                        <MetaItem label="초기 자본" value={`${result.initialCapital.toLocaleString()}원`} />
                        <MetaItem label="최종 자산" value={`${Math.round(result.finalEquity).toLocaleString()}원`} />
                        <MetaItem label="평균 보유일" value={`${result.avgHoldingDays.toFixed(1)}일`} />
                        <MetaItem label="종료 시점"
                                  value={result.openPosition ? '보유 중 (미청산)' : '전량 청산'} />
                    </div>

                    <div style={styles.card}>
                        <div style={styles.cardTitle}>
                            자산 곡선
                            <span style={styles.cardSub}>{stockName} · {result.shortPeriod}/{result.longPeriod}일선</span>
                        </div>
                        <EquityChart
                            equityCurve={result.equityCurve}
                            buyAndHoldCurve={result.buyAndHoldCurve}
                            trades={result.trades}
                        />
                    </div>

                    <div style={styles.card}>
                        <div style={styles.cardTitle}>
                            거래 내역
                            <span style={styles.cardSub}>{result.trades.length}건</span>
                        </div>
                        {result.trades.length === 0 ? (
                            <p style={styles.noTrade}>
                                이 구간에서는 완료된 거래가 없습니다.
                                {result.openPosition && ' 매수 후 아직 매도 신호가 나오지 않았습니다.'}
                            </p>
                        ) : (
                            <table style={styles.table}>
                                <thead>
                                <tr>
                                    <th style={styles.th}>매수일</th>
                                    <th style={styles.thRight}>매수가</th>
                                    <th style={styles.th}>매도일</th>
                                    <th style={styles.thRight}>매도가</th>
                                    <th style={styles.thRight}>수량</th>
                                    <th style={styles.thRight}>보유일</th>
                                    <th style={styles.thRight}>손익</th>
                                    <th style={styles.thRight}>수익률</th>
                                </tr>
                                </thead>
                                <tbody>
                                {result.trades.map((t, i) => (
                                    <tr key={i}>
                                        <td style={styles.td}>{t.buyDate}</td>
                                        <td style={styles.tdRight}>{t.buyPrice.toLocaleString()}</td>
                                        <td style={styles.td}>{t.sellDate}</td>
                                        <td style={styles.tdRight}>{t.sellPrice.toLocaleString()}</td>
                                        <td style={styles.tdRight}>{t.shares}주</td>
                                        <td style={styles.tdRight}>{t.holdingDays}일</td>
                                        <td style={{ ...styles.tdRight, color: signColor(t.profit), fontWeight: 600 }}>
                                            {t.profit > 0 ? '+' : ''}{Math.round(t.profit).toLocaleString()}
                                        </td>
                                        <td style={{ ...styles.tdRight, color: signColor(t.returnPct), fontWeight: 600 }}>
                                            {pct(t.returnPct)}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function Metric({ label, value, sub, color }) {
    return (
        <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>{label}</div>
            <div style={{ ...styles.summaryValue, color }}>{value}</div>
            {sub && <div style={styles.summarySub}>{sub}</div>}
        </div>
    );
}

function MetaItem({ label, value }) {
    return (
        <div style={styles.metaItem}>
            <span style={styles.metaLabel}>{label}</span>
            <span style={styles.metaValue}>{value}</span>
        </div>
    );
}

const pct = v => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const signColor = v => (v > 0 ? '#ef4444' : v < 0 ? '#3b82f6' : '#64748b');

const styles = {
    container: { maxWidth: '1200px', margin: '0 auto', padding: '32px 48px' },
    pageHead: { marginBottom: '20px' },
    pageTitle: { fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 },
    pageDesc: { fontSize: '13px', color: '#64748b', lineHeight: 1.7, marginTop: '6px', maxWidth: '760px' },

    panel: {
        background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
        padding: '20px 24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    },
    fieldRow: { display: 'flex', gap: '12px', marginBottom: '12px' },
    field: { flex: 1, display: 'flex', flexDirection: 'column' },
    label: { fontSize: '11px', color: '#94a3b8', fontWeight: 500, marginBottom: '6px' },
    input: {
        padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
        fontSize: '13px', color: '#0f172a', background: 'white', outline: 'none',
    },
    presetRow: { display: 'flex', gap: '4px' },
    presetBtn: {
        flex: 1, padding: '8px 6px', borderRadius: '8px', border: '1px solid #e2e8f0',
        background: 'white', color: '#64748b', fontSize: '12px', cursor: 'pointer',
    },
    presetBtnActive: { background: '#eef2ff', borderColor: '#c7d2fe', color: '#4f46e5', fontWeight: 600 },
    runBtn: {
        padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
        border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
    },

    error: {
        background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
        borderRadius: '10px', padding: '12px 16px', fontSize: '13px', marginBottom: '20px',
    },
    empty: {
        background: 'white', border: '1px dashed #cbd5e1', borderRadius: '12px',
        padding: '40px', textAlign: 'center',
    },
    emptyTitle: { fontSize: '15px', fontWeight: 600, color: '#0f172a' },
    emptyDesc: { fontSize: '13px', color: '#64748b', margin: '8px 0 18px', lineHeight: 1.7 },

    summaryRow: { display: 'flex', gap: '16px', marginBottom: '16px' },
    summaryCard: {
        flex: 1, background: 'white', borderRadius: '12px', padding: '18px 20px',
        border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    },
    summaryLabel: {
        fontSize: '11px', color: '#94a3b8', fontWeight: 500, marginBottom: '8px',
        textTransform: 'uppercase', letterSpacing: '0.5px',
    },
    summaryValue: { fontSize: '24px', fontWeight: 700, color: '#0f172a' },
    summarySub: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },

    metaBar: {
        display: 'flex', gap: '28px', background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: '10px', padding: '12px 20px', marginBottom: '20px', flexWrap: 'wrap',
    },
    metaItem: { display: 'flex', alignItems: 'baseline', gap: '8px' },
    metaLabel: { fontSize: '11px', color: '#94a3b8' },
    metaValue: { fontSize: '13px', color: '#0f172a', fontWeight: 600 },

    card: {
        background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
        padding: '20px 24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    },
    cardTitle: {
        fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '16px',
        display: 'flex', alignItems: 'baseline', gap: '10px',
    },
    cardSub: { fontSize: '12px', color: '#94a3b8', fontWeight: 400 },
    noTrade: { fontSize: '13px', color: '#64748b', margin: 0 },

    table: { width: '100%', borderCollapse: 'collapse' },
    th: {
        textAlign: 'left', fontSize: '11px', color: '#94a3b8', fontWeight: 500,
        padding: '8px 10px', borderBottom: '1px solid #e2e8f0',
    },
    thRight: {
        textAlign: 'right', fontSize: '11px', color: '#94a3b8', fontWeight: 500,
        padding: '8px 10px', borderBottom: '1px solid #e2e8f0',
    },
    td: { fontSize: '13px', color: '#334155', padding: '10px', borderBottom: '1px solid #f1f5f9' },
    tdRight: {
        fontSize: '13px', color: '#334155', padding: '10px', textAlign: 'right',
        borderBottom: '1px solid #f1f5f9',
    },
};

export default BacktestPage;

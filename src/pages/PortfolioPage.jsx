import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const FEE_RATE = 0.00015;   // 백엔드와 동일 (매수 가능 수량 미리보기용)

function PortfolioPage({ user }) {
    const [summary, setSummary] = useState(null);
    const [orders, setOrders] = useState([]);
    const [stocks, setStocks] = useState([]);

    const [noAccount, setNoAccount] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const [symbol, setSymbol] = useState('005930');
    const [quantity, setQuantity] = useState(1);
    const [initialCapital, setInitialCapital] = useState(10000000);
    const [trading, setTrading] = useState(false);

    // 상태 변경은 모두 프로미스 콜백 안에서 한다 (effect 안에서 동기적으로 setState 하지 않기 위함)
    const load = useCallback(() => (
        Promise.all([
            api.get('/api/portfolio'),
            api.get('/api/portfolio/orders'),
        ])
            .then(([pf, od]) => {
                setSummary(pf.data);
                setOrders(od.data);
                setNoAccount(false);
                setError('');
            })
            .catch(e => {
                if (e.response?.status === 400) {
                    setSummary(null);        // 계좌 미개설
                    setNoAccount(true);
                } else if (e.response?.status !== 401) {
                    setError('계좌 정보를 불러오지 못했습니다.');
                }
            })
            .finally(() => setLoading(false))
    ), []);

    useEffect(() => {
        api.get('/api/stocks').then(res => setStocks(res.data)).catch(() => setStocks([]));
    }, []);

    useEffect(() => {
        if (user) load();
    }, [user, load]);

    const openAccount = async () => {
        setTrading(true);
        setError('');
        try {
            await api.post('/api/portfolio', null, { params: { initialCapital } });
            setNotice(`${initialCapital.toLocaleString()}원으로 계좌를 개설했습니다.`);
            await load();
        } catch (e) {
            setError(messageOf(e, '계좌 개설에 실패했습니다.'));
        }
        setTrading(false);
    };

    const trade = async (side) => {
        setTrading(true);
        setError('');
        setNotice('');
        try {
            const res = await api.post(`/api/portfolio/orders/${side}`, null, {
                params: { symbol, quantity },
            });
            const o = res.data.order;
            setNotice(`${o.name} ${o.quantity}주 ${side === 'buy' ? '매수' : '매도'} 체결 · `
                + `${Math.round(o.price).toLocaleString()}원 · `
                + `${side === 'buy' ? '지출' : '수령'} ${Math.round(o.settlementAmount).toLocaleString()}원`
                + (o.realizedProfit != null ? ` · 실현손익 ${signed(o.realizedProfit)}원` : ''));
            await load();
        } catch (e) {
            setError(messageOf(e, '주문에 실패했습니다.'));
        }
        setTrading(false);
    };

    const selected = stocks.find(s => s.symbol === symbol);
    const price = selected?.price;
    const maxBuyable = price && summary
        ? Math.floor(summary.cash / (price * (1 + FEE_RATE)))
        : null;
    const held = summary?.holdings.find(h => h.symbol === symbol);

    if (!user) {
        return (
            <div style={styles.container}>
                <div style={styles.empty}>
                    <div style={styles.emptyTitle}>로그인이 필요합니다</div>
                    <p style={styles.emptyDesc}>모의투자 계좌는 사용자별로 관리됩니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.pageHead}>
                <h1 style={styles.pageTitle}>모의투자</h1>
                <p style={styles.pageDesc}>
                    가상 자금으로 실제 시세에 매매합니다. 주문은 현재가로 즉시 전량 체결되며,
                    수수료 0.015%와 증권거래세 0.18%가 정산에 반영됩니다.
                </p>
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {notice && <div style={styles.notice}>{notice}</div>}

            {loading && <div style={styles.muted}>불러오는 중...</div>}

            {/* 계좌 미개설 */}
            {!loading && noAccount && (
                <div style={styles.empty}>
                    <div style={styles.emptyTitle}>모의투자 계좌가 없습니다</div>
                    <p style={styles.emptyDesc}>초기 자본을 정해 계좌를 개설하세요.</p>
                    <div style={styles.openRow}>
                        <input
                            style={{ ...styles.input, width: '180px' }}
                            type="number" step="1000000" min="1"
                            value={initialCapital}
                            onChange={e => setInitialCapital(Number(e.target.value))} />
                        <button style={styles.btnPrimary} onClick={openAccount} disabled={trading}>
                            {trading ? '개설 중...' : '계좌 개설'}
                        </button>
                    </div>
                </div>
            )}

            {!loading && summary && (
                <>
                    <div style={styles.summaryRow}>
                        <Metric label="총 평가자산" value={`${round(summary.totalValue)}원`} color="#0f172a" />
                        <Metric label="수익률" value={pct(summary.totalReturnPct)}
                                color={signColor(summary.totalReturnPct)} />
                        <Metric label="예수금" value={`${round(summary.cash)}원`} color="#0f172a" />
                        <Metric label="평가손익" value={`${signed(summary.unrealizedProfit)}원`}
                                color={signColor(summary.unrealizedProfit)} />
                        <Metric label="실현손익" value={`${signed(summary.realizedProfit)}원`}
                                color={signColor(summary.realizedProfit)} />
                    </div>

                    {/* 주문 */}
                    <div style={styles.card}>
                        <div style={styles.cardTitle}>주문</div>
                        <div style={styles.orderRow}>
                            <div style={{ ...styles.field, flex: 2 }}>
                                <label style={styles.label}>종목</label>
                                <select style={styles.input} value={symbol}
                                        onChange={e => setSymbol(e.target.value)}>
                                    {stocks.length === 0 && <option value="005930">005930</option>}
                                    {stocks.map(s => (
                                        <option key={s.symbol} value={s.symbol}>
                                            {s.name} ({s.symbol})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={styles.field}>
                                <label style={styles.label}>수량 (주)</label>
                                <input style={styles.input} type="number" min="1" value={quantity}
                                       onChange={e => setQuantity(Number(e.target.value))} />
                            </div>
                            <div style={styles.field}>
                                <label style={styles.label}>현재가</label>
                                <div style={styles.readonly}>
                                    {price ? `${price.toLocaleString()}원` : '—'}
                                </div>
                            </div>
                            <div style={styles.field}>
                                <label style={styles.label}>예상 정산금액</label>
                                <div style={styles.readonly}>
                                    {price ? `${round(price * quantity * (1 + FEE_RATE))}원` : '—'}
                                </div>
                            </div>
                            <div style={styles.tradeBtns}>
                                <button style={{ ...styles.btnBuy, opacity: trading ? 0.6 : 1 }}
                                        onClick={() => trade('buy')} disabled={trading}>매수</button>
                                <button style={{ ...styles.btnSell, opacity: trading ? 0.6 : 1 }}
                                        onClick={() => trade('sell')} disabled={trading}>매도</button>
                            </div>
                        </div>
                        <div style={styles.hintRow}>
                            {maxBuyable != null && <span>최대 매수 {maxBuyable.toLocaleString()}주</span>}
                            {held && <span>보유 {held.quantity.toLocaleString()}주 · 평균 {round(held.avgBuyPrice)}원</span>}
                        </div>
                    </div>

                    {/* 보유 종목 */}
                    <div style={styles.card}>
                        <div style={styles.cardTitle}>
                            보유 종목
                            <span style={styles.cardSub}>{summary.holdings.length}개</span>
                        </div>
                        {summary.holdings.length === 0 ? (
                            <p style={styles.muted}>보유 중인 종목이 없습니다.</p>
                        ) : (
                            <table style={styles.table}>
                                <thead>
                                <tr>
                                    <th style={styles.th}>종목</th>
                                    <th style={styles.thRight}>수량</th>
                                    <th style={styles.thRight}>평균 매입가</th>
                                    <th style={styles.thRight}>현재가</th>
                                    <th style={styles.thRight}>평가금액</th>
                                    <th style={styles.thRight}>평가손익</th>
                                    <th style={styles.thRight}>수익률</th>
                                    <th style={styles.thRight}></th>
                                </tr>
                                </thead>
                                <tbody>
                                {summary.holdings.map(h => (
                                    <tr key={h.symbol}>
                                        <td style={styles.td}>
                                            {h.name}
                                            <span style={styles.symbolTag}>{h.symbol}</span>
                                        </td>
                                        <td style={styles.tdRight}>{h.quantity.toLocaleString()}</td>
                                        <td style={styles.tdRight}>{round(h.avgBuyPrice)}</td>
                                        <td style={styles.tdRight}>{round(h.currentPrice)}</td>
                                        <td style={styles.tdRight}>{round(h.evalAmount)}</td>
                                        <td style={{ ...styles.tdRight, color: signColor(h.unrealizedProfit), fontWeight: 600 }}>
                                            {signed(h.unrealizedProfit)}
                                        </td>
                                        <td style={{ ...styles.tdRight, color: signColor(h.returnPct), fontWeight: 600 }}>
                                            {pct(h.returnPct)}
                                        </td>
                                        <td style={styles.tdRight}>
                                            <button
                                                style={styles.btnSmall}
                                                onClick={() => { setSymbol(h.symbol); setQuantity(h.quantity); }}>
                                                주문에 담기
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* 체결 내역 */}
                    <div style={styles.card}>
                        <div style={styles.cardTitle}>
                            체결 내역
                            <span style={styles.cardSub}>{orders.length}건</span>
                        </div>
                        {orders.length === 0 ? (
                            <p style={styles.muted}>아직 체결된 주문이 없습니다.</p>
                        ) : (
                            <table style={styles.table}>
                                <thead>
                                <tr>
                                    <th style={styles.th}>체결시각</th>
                                    <th style={styles.th}>구분</th>
                                    <th style={styles.th}>종목</th>
                                    <th style={styles.thRight}>체결가</th>
                                    <th style={styles.thRight}>수량</th>
                                    <th style={styles.thRight}>수수료</th>
                                    <th style={styles.thRight}>거래세</th>
                                    <th style={styles.thRight}>정산금액</th>
                                    <th style={styles.thRight}>실현손익</th>
                                </tr>
                                </thead>
                                <tbody>
                                {orders.map(o => (
                                    <tr key={o.id}>
                                        <td style={styles.td}>{o.executedAt.slice(0, 16).replace('T', ' ')}</td>
                                        <td style={styles.td}>
                                            <span style={o.side === 'BUY' ? styles.badgeBuy : styles.badgeSell}>
                                                {o.side === 'BUY' ? '매수' : '매도'}
                                            </span>
                                        </td>
                                        <td style={styles.td}>{o.name}</td>
                                        <td style={styles.tdRight}>{round(o.price)}</td>
                                        <td style={styles.tdRight}>{o.quantity.toLocaleString()}</td>
                                        <td style={styles.tdRight}>{round(o.fee)}</td>
                                        <td style={styles.tdRight}>{o.tax > 0 ? round(o.tax) : '—'}</td>
                                        <td style={styles.tdRight}>{round(o.settlementAmount)}</td>
                                        <td style={{ ...styles.tdRight, color: signColor(o.realizedProfit ?? 0), fontWeight: 600 }}>
                                            {o.realizedProfit == null ? '—' : signed(o.realizedProfit)}
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

function Metric({ label, value, color }) {
    return (
        <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>{label}</div>
            <div style={{ ...styles.summaryValue, color }}>{value}</div>
        </div>
    );
}

const round = v => (v == null ? '—' : Math.round(v).toLocaleString());
const signed = v => (v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v).toLocaleString()}`);
const pct = v => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);
const signColor = v => (v > 0 ? '#ef4444' : v < 0 ? '#3b82f6' : '#64748b');
const messageOf = (e, fallback) =>
    typeof e.response?.data === 'string' ? e.response.data : fallback;

const styles = {
    container: { maxWidth: '1200px', margin: '0 auto', padding: '32px 48px' },
    pageHead: { marginBottom: '20px' },
    pageTitle: { fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 },
    pageDesc: { fontSize: '13px', color: '#64748b', lineHeight: 1.7, marginTop: '6px', maxWidth: '760px' },
    muted: { fontSize: '13px', color: '#64748b', margin: 0 },

    error: {
        background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
        borderRadius: '10px', padding: '12px 16px', fontSize: '13px', marginBottom: '16px',
    },
    notice: {
        background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8',
        borderRadius: '10px', padding: '12px 16px', fontSize: '13px', marginBottom: '16px',
    },
    empty: {
        background: 'white', border: '1px dashed #cbd5e1', borderRadius: '12px',
        padding: '40px', textAlign: 'center',
    },
    emptyTitle: { fontSize: '15px', fontWeight: 600, color: '#0f172a' },
    emptyDesc: { fontSize: '13px', color: '#64748b', margin: '8px 0 18px', lineHeight: 1.7 },
    openRow: { display: 'flex', gap: '8px', justifyContent: 'center' },

    summaryRow: { display: 'flex', gap: '16px', marginBottom: '20px' },
    summaryCard: {
        flex: 1, background: 'white', borderRadius: '12px', padding: '18px 20px',
        border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    },
    summaryLabel: {
        fontSize: '11px', color: '#94a3b8', fontWeight: 500, marginBottom: '8px',
        textTransform: 'uppercase', letterSpacing: '0.5px',
    },
    summaryValue: { fontSize: '20px', fontWeight: 700 },

    card: {
        background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
        padding: '20px 24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    },
    cardTitle: {
        fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '16px',
        display: 'flex', alignItems: 'baseline', gap: '10px',
    },
    cardSub: { fontSize: '12px', color: '#94a3b8', fontWeight: 400 },

    orderRow: { display: 'flex', gap: '12px', alignItems: 'flex-end' },
    field: { flex: 1, display: 'flex', flexDirection: 'column' },
    label: { fontSize: '11px', color: '#94a3b8', fontWeight: 500, marginBottom: '6px' },
    input: {
        padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
        fontSize: '13px', color: '#0f172a', background: 'white', outline: 'none',
    },
    readonly: {
        padding: '8px 10px', borderRadius: '8px', border: '1px solid #f1f5f9',
        fontSize: '13px', color: '#334155', background: '#f8fafc', fontWeight: 600,
    },
    tradeBtns: { display: 'flex', gap: '6px' },
    btnBuy: {
        padding: '9px 22px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
        background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer',
    },
    btnSell: {
        padding: '9px 22px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
        background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer',
    },
    btnPrimary: {
        padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
        border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
    },
    btnSmall: {
        padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
        background: 'white', color: '#475569', border: '1px solid #e2e8f0', cursor: 'pointer',
    },
    hintRow: { display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px', color: '#94a3b8' },

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
    symbolTag: { fontSize: '11px', color: '#94a3b8', marginLeft: '6px' },
    badgeBuy: {
        fontSize: '11px', fontWeight: 600, color: '#b91c1c',
        background: '#fef2f2', borderRadius: '5px', padding: '2px 7px',
    },
    badgeSell: {
        fontSize: '11px', fontWeight: 600, color: '#1d4ed8',
        background: '#eff6ff', borderRadius: '5px', padding: '2px 7px',
    },
};

export default PortfolioPage;

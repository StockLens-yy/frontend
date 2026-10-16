import { useState } from 'react';
import api from '../api/axios';

const DEFAULT_DISCLAIMER = '이 정리는 제공된 시세 데이터를 요약한 참고 정보이며, 투자 권유나 주가 예측이 아닙니다. 투자 판단과 그 결과에 대한 책임은 본인에게 있습니다.';

const CARDS = [
    { key: 'priceTrend', title: '가격 흐름' },
    { key: 'volume', title: '거래량' },
    { key: 'technical', title: '기술적 지표' },
];

// 종목의 현재 상황을 AI가 정리한 결과. 숫자는 백엔드가 계산하고 AI는 해석만 한다.
function BriefingPanel({ code }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/api/stocks/${code}/briefing`);
            setData(res.data);
        } catch (e) {
            setError(e.response?.status === 401
                ? '로그인 후 이용할 수 있습니다.'
                : '현재 상황을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
        setLoading(false);
    };

    const briefing = data?.briefing;
    const asOf = data?.indicators?.asOf?.replace('T', ' ').slice(0, 16);

    return (
        <div style={styles.wrap}>
            <div style={styles.header}>
                <div style={styles.titleWrap}>
                    <div style={styles.dot}></div>
                    <span style={styles.title}>AI 현재 상황 정리</span>
                    {asOf && <span style={styles.asOf}>{asOf} 기준</span>}
                    {data && !data.aiGenerated && <span style={styles.badge}>계산값만 표시</span>}
                </div>
                <button style={{ ...styles.button, opacity: loading ? 0.7 : 1 }} onClick={load} disabled={loading}>
                    {loading ? '정리하는 중...' : briefing ? '다시 정리' : '정리하기'}
                </button>
            </div>

            {loading && <div style={styles.hint}>시세 지표를 계산하고 AI가 정리하고 있습니다. 최대 1분 정도 걸릴 수 있습니다.</div>}
            {error && <div style={styles.error}>{error}</div>}

            {briefing && !loading && (
                <>
                    <div style={styles.summary}>{briefing.summary}</div>
                    <div style={styles.grid}>
                        {CARDS.map(card => (
                            <div key={card.key} style={styles.card}>
                                <div style={styles.cardTitle}>{card.title}</div>
                                <div style={styles.cardBody}>{briefing[card.key]}</div>
                            </div>
                        ))}
                        <div style={styles.card}>
                            <div style={styles.cardTitle}>체크 포인트</div>
                            {briefing.checkPoints?.length > 0 ? (
                                <ul style={styles.list}>
                                    {briefing.checkPoints.map((point, i) => <li key={i}>{point}</li>)}
                                </ul>
                            ) : (
                                <div style={styles.cardBody}>데이터 없음</div>
                            )}
                        </div>
                    </div>
                </>
            )}

            <div style={styles.disclaimer}>{briefing?.disclaimer || DEFAULT_DISCLAIMER}</div>
        </div>
    );
}

const styles = {
    wrap: { marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    titleWrap: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    dot: { width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #5b6cf9, #8b5cf6)' },
    title: { fontSize: '14px', fontWeight: 700, color: '#1c2436' },
    asOf: { fontSize: '12px', color: '#94a3b8' },
    badge: { fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 600 },
    button: {
        background: '#6f68fb', color: 'white', border: 'none', borderRadius: '6px',
        padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    },
    hint: { fontSize: '12px', color: '#64748b', padding: '12px 0' },
    error: { fontSize: '13px', color: '#b91c1c', background: '#fef2f2', borderRadius: '8px', padding: '10px 12px' },
    summary: {
        background: 'linear-gradient(135deg, #f5f3ff, #eef2ff)', borderRadius: '10px',
        padding: '14px 16px', fontSize: '14px', lineHeight: 1.7, color: '#1c2436', marginBottom: '12px',
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '10px' },
    card: { border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' },
    cardTitle: { fontSize: '12px', fontWeight: 700, color: '#6f68fb', marginBottom: '6px' },
    cardBody: { fontSize: '13px', lineHeight: 1.7, color: '#374151' },
    list: { margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: 1.7, color: '#374151' },
    disclaimer: {
        marginTop: '12px', fontSize: '11px', lineHeight: 1.6, color: '#94a3b8',
        background: '#f8fafc', borderRadius: '6px', padding: '8px 10px',
    },
};

export default BriefingPanel;

import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * 백테스팅 자산 곡선.
 * 전략 자산과 단순 보유 자산을 겹쳐 그리고, 매수·매도 시점을 점으로 표시한다.
 */
function EquityChart({ equityCurve, buyAndHoldCurve, trades }) {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (!equityCurve?.length) return;

        const labels = equityCurve.map(p => p.date.slice(5).replace('-', '.'));
        const strategy = equityCurve.map(p => p.equity);
        const hold = buyAndHoldCurve?.map(p => p.equity) ?? [];

        // 거래 시점을 자산 곡선 위의 점으로 올린다
        const buyDates = new Set(trades.map(t => t.buyDate));
        const sellDates = new Set(trades.map(t => t.sellDate));
        const buyPoints = equityCurve.map(p => (buyDates.has(p.date) ? p.equity : null));
        const sellPoints = equityCurve.map(p => (sellDates.has(p.date) ? p.equity : null));

        if (chartInstance.current) chartInstance.current.destroy();

        chartInstance.current = new Chart(chartRef.current, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: '전략',
                        data: strategy,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99,102,241,0.06)',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.1,
                        order: 3,
                    },
                    {
                        label: '단순 보유',
                        data: hold,
                        borderColor: '#cbd5e1',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false,
                        tension: 0.1,
                        order: 4,
                    },
                    {
                        label: '매수',
                        data: buyPoints,
                        borderColor: '#ef4444',
                        backgroundColor: '#ef4444',
                        showLine: false,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        order: 1,
                    },
                    {
                        label: '매도',
                        data: sellPoints,
                        borderColor: '#3b82f6',
                        backgroundColor: '#3b82f6',
                        showLine: false,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        order: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 6,
                            font: { size: 11 },
                            color: '#64748b',
                            filter: item => item.text !== undefined,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => ctx.parsed.y == null
                                ? null
                                : `${ctx.dataset.label}: ${Math.round(ctx.parsed.y).toLocaleString()}원`,
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8', maxTicksLimit: 10, font: { size: 11 } },
                        grid: { display: false },
                    },
                    y: {
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 11 },
                            callback: v => `${(v / 10000).toLocaleString()}만`,
                        },
                        grid: { color: '#f1f5f9' },
                    },
                },
            },
        });

        return () => {
            if (chartInstance.current) chartInstance.current.destroy();
        };
    }, [equityCurve, buyAndHoldCurve, trades]);

    return (
        <div style={{ position: 'relative', height: '320px' }}>
            <canvas ref={chartRef}></canvas>
        </div>
    );
}

export default EquityChart;

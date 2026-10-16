import logoIcon from '../assets/logo-icon.png';

// 로고 이미지에서 추출한 브랜드 색
const INK = '#1c2436';
const ACCENT = '#6f68fb';

// StockLens 로고. 헤더는 가로형, 로그인/회원가입 화면은 세로형(아이콘 아래 글자)으로 쓴다.
function Logo({ vertical = false, iconSize = 28, fontSize = 20 }) {
    return (
        <span style={{ ...styles.wrap, ...(vertical ? styles.vertical : {}) }}>
            <img
                src={logoIcon}
                alt=""
                width={iconSize}
                height={iconSize}
                style={{ borderRadius: iconSize * 0.24 }}
            />
            <span style={{ ...styles.text, fontSize }}>
                Stock<span style={{ color: ACCENT }}>Lens</span>
            </span>
        </span>
    );
}

const styles = {
    wrap: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
    vertical: { flexDirection: 'column', gap: '12px' },
    text: { fontWeight: 700, color: INK, letterSpacing: '-0.5px', lineHeight: 1 },
};

export default Logo;

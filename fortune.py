"""
운세/사주 계산 모듈
생년월일 기반 사주팔자 계산 및 운세 생성
"""
from datetime import datetime, timedelta
import hashlib
from typing import Dict, List, Tuple, Any

# 천간 (10개)
CHEONGAN = ['갑(甲)', '을(乙)', '병(丙)', '정(丁)', '무(戊)', '기(己)', '경(庚)', '신(辛)', '임(壬)', '계(癸)']
CHEONGAN_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

# 지지 (12개)
JIJI = ['자(子)', '축(丑)', '인(寅)', '묘(卯)', '진(辰)', '사(巳)', '오(午)', '미(未)', '신(申)', '유(酉)', '술(戌)', '해(亥)']
JIJI_HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

# 띠 동물
ZODIAC_ANIMALS = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지']

# 오행
OHANG = {
    '갑': '목(木)', '을': '목(木)',
    '병': '화(火)', '정': '화(火)',
    '무': '토(土)', '기': '토(土)',
    '경': '금(金)', '신': '금(金)',
    '임': '수(水)', '계': '수(水)'
}

OHANG_ELEMENTS = ['목(木)', '화(火)', '토(土)', '금(金)', '수(水)']

# 오행 성격
OHANG_TRAITS = {
    '목(木)': {
        'element': '나무',
        'trait': '창의적이고 진취적인 성향으로, 성장과 발전을 추구합니다.',
        'strength': '리더십, 추진력, 창의성',
        'color': '청색, 녹색'
    },
    '화(火)': {
        'element': '불',
        'trait': '열정적이고 활동적인 성향으로, 밝고 따뜻한 에너지를 가집니다.',
        'strength': '열정, 표현력, 사교성',
        'color': '적색, 주황색'
    },
    '토(土)': {
        'element': '흙',
        'trait': '안정적이고 신뢰할 수 있는 성향으로, 중재와 조화를 중시합니다.',
        'strength': '신뢰성, 안정감, 포용력',
        'color': '황색, 갈색'
    },
    '금(金)': {
        'element': '쇠',
        'trait': '결단력 있고 정의로운 성향으로, 원칙과 질서를 중시합니다.',
        'strength': '결단력, 정의감, 집중력',
        'color': '백색, 금색'
    },
    '수(水)': {
        'element': '물',
        'trait': '지혜롭고 유연한 성향으로, 깊은 통찰력과 적응력을 가집니다.',
        'strength': '지혜, 유연성, 통찰력',
        'color': '흑색, 남색'
    }
}

# 천간별 성격 및 특성
CHEONGAN_TRAITS = {
    '갑': {
        'name': '갑목(甲木)',
        'symbol': '큰 나무, 대들보',
        'personality': '곧고 정직하며 리더십이 강합니다. 자존심이 강하고 독립적이며 새로운 일을 시작하는 것을 좋아합니다.',
        'strength': '정직함, 리더십, 추진력, 독창성',
        'weakness': '고집, 융통성 부족',
        'compatible': '기토, 임수',
        'career': '경영자, 기획자, 창업가, 교육자'
    },
    '을': {
        'name': '을목(乙木)',
        'symbol': '풀, 덩굴, 꽃',
        'personality': '유연하고 적응력이 뛰어납니다. 부드러운 외모와 달리 내면은 강인하며 끈기가 있습니다.',
        'strength': '유연성, 적응력, 섬세함, 인내심',
        'weakness': '우유부단, 의존성',
        'compatible': '경금, 계수',
        'career': '예술가, 디자이너, 상담사, 서비스업'
    },
    '병': {
        'name': '병화(丙火)',
        'symbol': '태양, 큰 불',
        'personality': '밝고 활동적이며 열정적입니다. 따뜻한 성격으로 주변에 사람이 많이 모이며 낙천적입니다.',
        'strength': '열정, 사교성, 낙천적, 리더십',
        'weakness': '급한 성격, 지구력 부족',
        'compatible': '신금, 임수',
        'career': '연예인, 정치인, 영업직, 홍보'
    },
    '정': {
        'name': '정화(丁火)',
        'symbol': '촛불, 등불',
        'personality': '따뜻하고 섬세하며 배려심이 깊습니다. 내면의 열정을 가지고 있으며 집중력이 뛰어납니다.',
        'strength': '섬세함, 집중력, 배려심, 끈기',
        'weakness': '소심함, 걱정 많음',
        'compatible': '임수, 경금',
        'career': '연구원, 작가, 교사, 기술직'
    },
    '무': {
        'name': '무토(戊土)',
        'symbol': '산, 큰 언덕',
        'personality': '듬직하고 신뢰감을 줍니다. 포용력이 크고 안정적이며 책임감이 강합니다.',
        'strength': '신뢰성, 포용력, 안정감, 책임감',
        'weakness': '보수적, 변화에 느림',
        'compatible': '계수, 갑목',
        'career': '공무원, 금융업, 부동산, 관리직'
    },
    '기': {
        'name': '기토(己土)',
        'symbol': '논밭, 정원',
        'personality': '온화하고 겸손하며 실속을 중시합니다. 꼼꼼하고 성실하며 내실을 다지는 것을 좋아합니다.',
        'strength': '겸손, 성실함, 실용성, 꼼꼼함',
        'weakness': '소극적, 자기주장 약함',
        'compatible': '갑목, 병화',
        'career': '회계사, 농업, 요식업, 사무직'
    },
    '경': {
        'name': '경금(庚金)',
        'symbol': '바위, 철광석, 칼',
        'personality': '강직하고 의리가 있습니다. 결단력이 있고 정의로우며 승부욕이 강합니다.',
        'strength': '결단력, 의리, 정의감, 추진력',
        'weakness': '냉정함, 타협 어려움',
        'compatible': '을목, 정화',
        'career': '군인, 경찰, 법조인, 외과의사'
    },
    '신': {
        'name': '신금(辛金)',
        'symbol': '보석, 금은세공품',
        'personality': '섬세하고 예민하며 미적 감각이 뛰어납니다. 완벽주의 성향이 있고 자존심이 강합니다.',
        'strength': '섬세함, 미적감각, 완벽주의, 지성',
        'weakness': '예민함, 까다로움',
        'compatible': '병화, 임수',
        'career': '디자이너, 보석상, 금융분석, 품질관리'
    },
    '임': {
        'name': '임수(壬水)',
        'symbol': '바다, 큰 강',
        'personality': '지혜롭고 포용력이 큽니다. 유연한 사고와 넓은 시야를 가지며 적응력이 뛰어납니다.',
        'strength': '지혜, 포용력, 적응력, 추진력',
        'weakness': '변덕, 일관성 부족',
        'compatible': '정화, 무토',
        'career': '학자, 무역업, 여행업, 컨설턴트'
    },
    '계': {
        'name': '계수(癸水)',
        'symbol': '이슬, 빗물, 샘물',
        'personality': '영리하고 직관력이 뛰어납니다. 조용하지만 끈기가 있으며 깊은 내면을 가집니다.',
        'strength': '직관력, 끈기, 침착함, 영리함',
        'weakness': '소극적, 감정기복',
        'compatible': '무토, 을목',
        'career': '연구직, 상담사, 심리학자, IT'
    }
}

# 지지(띠)별 성격 및 특성
JIJI_TRAITS = {
    '자': {
        'name': '자(子)',
        'animal': '쥐',
        'personality': '영리하고 재치가 있습니다. 적응력이 뛰어나고 사교적이며 기회를 잘 포착합니다.',
        'strength': '영리함, 적응력, 사교성',
        'weakness': '의심 많음, 소심함',
        'compatible_zodiac': '소, 용, 원숭이',
        'incompatible_zodiac': '말, 양'
    },
    '축': {
        'name': '축(丑)',
        'animal': '소',
        'personality': '성실하고 인내심이 강합니다. 꾸준히 노력하며 신뢰할 수 있는 성격입니다.',
        'strength': '성실함, 인내심, 신뢰성',
        'weakness': '고집, 느린 결정',
        'compatible_zodiac': '쥐, 뱀, 닭',
        'incompatible_zodiac': '양, 말'
    },
    '인': {
        'name': '인(寅)',
        'animal': '호랑이',
        'personality': '용감하고 자신감이 넘칩니다. 리더십이 있고 정의감이 강하며 도전적입니다.',
        'strength': '용기, 리더십, 정의감',
        'weakness': '성급함, 독선적',
        'compatible_zodiac': '말, 개, 돼지',
        'incompatible_zodiac': '원숭이, 뱀'
    },
    '묘': {
        'name': '묘(卯)',
        'animal': '토끼',
        'personality': '온화하고 섬세합니다. 예술적 감각이 뛰어나고 평화를 사랑합니다.',
        'strength': '섬세함, 예술성, 평화로움',
        'weakness': '우유부단, 회피적',
        'compatible_zodiac': '양, 돼지, 개',
        'incompatible_zodiac': '닭, 용'
    },
    '진': {
        'name': '진(辰)',
        'animal': '용',
        'personality': '야망이 크고 카리스마가 있습니다. 자신감이 넘치며 성공을 향해 나아갑니다.',
        'strength': '야망, 카리스마, 자신감',
        'weakness': '오만함, 비현실적',
        'compatible_zodiac': '쥐, 원숭이, 닭',
        'incompatible_zodiac': '개, 토끼'
    },
    '사': {
        'name': '사(巳)',
        'animal': '뱀',
        'personality': '지혜롭고 신비로운 매력이 있습니다. 직관력이 뛰어나고 통찰력이 깊습니다.',
        'strength': '지혜, 직관력, 매력',
        'weakness': '의심 많음, 집착',
        'compatible_zodiac': '소, 닭',
        'incompatible_zodiac': '호랑이, 돼지'
    },
    '오': {
        'name': '오(午)',
        'animal': '말',
        'personality': '활동적이고 자유로운 영혼입니다. 열정적이며 독립심이 강합니다.',
        'strength': '활동성, 열정, 독립심',
        'weakness': '참을성 없음, 산만함',
        'compatible_zodiac': '호랑이, 양, 개',
        'incompatible_zodiac': '쥐, 소'
    },
    '미': {
        'name': '미(未)',
        'animal': '양',
        'personality': '온순하고 예술적입니다. 배려심이 깊고 창의적인 면이 있습니다.',
        'strength': '온순함, 예술성, 배려심',
        'weakness': '의존적, 걱정 많음',
        'compatible_zodiac': '토끼, 말, 돼지',
        'incompatible_zodiac': '소, 개'
    },
    '신': {
        'name': '신(申)',
        'animal': '원숭이',
        'personality': '재치있고 영리합니다. 문제 해결 능력이 뛰어나고 유머 감각이 있습니다.',
        'strength': '재치, 영리함, 적응력',
        'weakness': '교활함, 인내심 부족',
        'compatible_zodiac': '쥐, 용',
        'incompatible_zodiac': '호랑이, 돼지'
    },
    '유': {
        'name': '유(酉)',
        'animal': '닭',
        'personality': '부지런하고 정확합니다. 계획적이며 완벽을 추구합니다.',
        'strength': '부지런함, 정확성, 계획성',
        'weakness': '비판적, 완고함',
        'compatible_zodiac': '소, 뱀, 용',
        'incompatible_zodiac': '토끼, 개'
    },
    '술': {
        'name': '술(戌)',
        'animal': '개',
        'personality': '충직하고 의리가 있습니다. 정의감이 강하고 책임감이 있습니다.',
        'strength': '충성심, 의리, 정의감',
        'weakness': '걱정 많음, 비관적',
        'compatible_zodiac': '호랑이, 토끼, 말',
        'incompatible_zodiac': '용, 양, 닭'
    },
    '해': {
        'name': '해(亥)',
        'animal': '돼지',
        'personality': '너그럽고 순수합니다. 성실하며 물질적 풍요를 누리는 복이 있습니다.',
        'strength': '너그러움, 성실함, 복',
        'weakness': '순진함, 게으름',
        'compatible_zodiac': '호랑이, 토끼, 양',
        'incompatible_zodiac': '뱀, 원숭이'
    }
}

# 사주 궁합 및 상생상극
SAJU_ANALYSIS = {
    'year_meaning': '조상궁 - 조상의 음덕과 어린 시절(0~20세)의 운',
    'month_meaning': '부모궁 - 부모와의 관계 및 청년기(20~40세)의 운',
    'day_meaning': '본인궁 - 본인의 성격과 배우자운, 장년기(40~60세)의 운',
    'time_meaning': '자녀궁 - 자녀운과 노년기(60세 이후)의 운'
}

# ==================== 주(柱)별 풀이 ====================
# 년주(年柱) 해석 - 천간+지지 조합
YEAR_PILLAR_MEANINGS = {
    # 천간별 년주 의미
    'cheongan': {
        '갑': '시작과 개척의 기운으로 조상대에 새로운 일을 시작한 가문입니다. 독립심이 강하고 자수성가 기질이 있습니다.',
        '을': '유연하고 적응력 있는 기운으로, 조상대에 변화가 많았으나 꾸준히 성장한 가문입니다.',
        '병': '밝고 따뜻한 기운으로 사교적인 집안에서 태어났습니다. 어린 시절 활발하고 인기가 많았습니다.',
        '정': '섬세하고 따뜻한 기운으로, 가족 간의 정이 깊은 환경에서 자랐습니다. 배려심이 형성되는 시기입니다.',
        '무': '안정적이고 듬직한 기운으로 전통을 중시하는 집안입니다. 어린 시절 안정된 환경에서 성장했습니다.',
        '기': '실속 있고 겸손한 기운으로 내실을 다지는 가문입니다. 검소한 환경에서 성실함을 배웠습니다.',
        '경': '강직하고 의리 있는 기운으로 원칙을 중시하는 집안입니다. 규율 있는 환경에서 자랐습니다.',
        '신': '섬세하고 예리한 기운으로 예술적 감각이 있는 가문입니다. 미적 감각이 형성되는 시기입니다.',
        '임': '지혜롭고 포용력 있는 기운으로 넓은 시야를 가진 집안입니다. 다양한 경험을 쌓은 어린 시절입니다.',
        '계': '영리하고 직관적인 기운으로, 깊은 생각을 하는 환경에서 자랐습니다. 내면의 힘을 기르는 시기입니다.',
    },
    # 지지(띠)별 년주 의미는 JIJI_TRAITS에서 활용
}

# 월주(月柱) 해석
MONTH_PILLAR_MEANINGS = {
    'cheongan': {
        '갑': '청년기에 새로운 도전과 시작의 기회가 많습니다. 부모님이 진취적이거나 독립을 일찍 경험합니다.',
        '을': '청년기에 유연하게 환경에 적응하며 성장합니다. 부모님의 섬세한 보살핌을 받았습니다.',
        '병': '청년기에 활발하고 사교적인 활동이 많습니다. 부모님이 사회적으로 활동적인 분입니다.',
        '정': '청년기에 학업이나 기술 습득에 집중합니다. 부모님이 세심하게 교육에 신경 쓰셨습니다.',
        '무': '청년기에 안정적인 기반을 다집니다. 부모님이 든든한 지원자 역할을 합니다.',
        '기': '청년기에 실무 능력을 쌓으며 성장합니다. 부모님이 실속을 중시하는 분입니다.',
        '경': '청년기에 강한 의지로 목표를 추구합니다. 부모님이 원칙적이고 엄격한 편입니다.',
        '신': '청년기에 전문성이나 예술적 재능을 키웁니다. 부모님이 품위를 중시합니다.',
        '임': '청년기에 다양한 경험과 학습의 기회가 있습니다. 부모님이 넓은 시야를 가진 분입니다.',
        '계': '청년기에 내면의 성장과 지혜를 쌓습니다. 부모님이 지적인 환경을 제공합니다.',
    },
    # 월지별 계절 의미
    'season': {
        '인': '봄의 시작, 새로운 기운이 솟아나는 시기에 태어나 진취적 성향이 있습니다.',
        '묘': '봄의 한가운데, 생명력이 가득한 시기에 태어나 부드럽고 조화로운 성향입니다.',
        '진': '봄에서 여름으로, 변화의 시기에 태어나 적응력과 변화 대응력이 좋습니다.',
        '사': '여름의 시작, 열정이 피어나는 시기에 태어나 활동적이고 적극적입니다.',
        '오': '여름의 한가운데, 에너지가 최고조인 시기에 태어나 열정적이고 표현력이 강합니다.',
        '미': '여름에서 가을로, 결실을 준비하는 시기에 태어나 내실을 다지는 능력이 있습니다.',
        '신': '가을의 시작, 수확이 시작되는 시기에 태어나 성과 지향적입니다.',
        '유': '가을의 한가운데, 풍요로운 시기에 태어나 꼼꼼하고 완성도를 추구합니다.',
        '술': '가을에서 겨울로, 마무리의 시기에 태어나 책임감이 강합니다.',
        '해': '겨울의 시작, 저장의 시기에 태어나 미래를 준비하는 성향이 있습니다.',
        '자': '겨울의 한가운데, 내면을 성찰하는 시기에 태어나 깊이 있는 사고를 합니다.',
        '축': '겨울에서 봄으로, 새 출발을 준비하는 시기에 태어나 끈기와 인내력이 있습니다.',
    }
}

# 일주(日柱) 해석 - 본인의 핵심 성격과 배우자운
DAY_PILLAR_MEANINGS = {
    'cheongan': {
        '갑': '곧고 정직한 성품으로 리더십이 있습니다. 배우자는 자신을 잘 보좌해주는 사람이 좋습니다.',
        '을': '부드럽지만 내면은 강인합니다. 배우자는 든든하고 강한 사람이 잘 맞습니다.',
        '병': '밝고 따뜻한 성격으로 인기가 많습니다. 배우자는 차분하고 지적인 사람이 좋습니다.',
        '정': '섬세하고 집중력이 강합니다. 배우자는 활동적이고 사교적인 사람이 잘 맞습니다.',
        '무': '믿음직하고 포용력이 큽니다. 배우자는 지적이고 깔끔한 사람이 좋습니다.',
        '기': '겸손하고 실속 있습니다. 배우자는 진취적이고 리더십 있는 사람이 잘 맞습니다.',
        '경': '강직하고 의리가 있습니다. 배우자는 부드럽고 순응적인 사람이 좋습니다.',
        '신': '섬세하고 완벽주의 성향입니다. 배우자는 열정적이고 따뜻한 사람이 잘 맞습니다.',
        '임': '지혜롭고 포용력이 큽니다. 배우자는 현실적이고 안정적인 사람이 좋습니다.',
        '계': '영리하고 직관력이 뛰어납니다. 배우자는 듬직하고 신뢰감 있는 사람이 잘 맞습니다.',
    },
    'jiji': {
        '자': '밤의 기운으로 내면이 깊고 비밀이 많습니다. 장년기에 지혜로운 결정을 합니다.',
        '축': '저장의 기운으로 재물을 모으는 능력이 있습니다. 장년기에 안정을 이룹니다.',
        '인': '시작의 기운으로 새로운 도전을 즐깁니다. 장년기에 활발하게 활동합니다.',
        '묘': '성장의 기운으로 발전 가능성이 큽니다. 장년기에 꾸준히 성장합니다.',
        '진': '변화의 기운으로 큰 변화를 경험합니다. 장년기에 중요한 전환점이 있습니다.',
        '사': '은밀한 기운으로 깊은 통찰력이 있습니다. 장년기에 직관이 빛을 발합니다.',
        '오': '열정의 기운으로 활동적입니다. 장년기에 사회적 활동이 활발합니다.',
        '미': '저장의 기운으로 내실을 다집니다. 장년기에 축적의 시기를 보냅니다.',
        '신': '수확의 기운으로 성과를 거둡니다. 장년기에 노력의 결실을 봅니다.',
        '유': '완성의 기운으로 마무리를 잘합니다. 장년기에 완성도 높은 삶을 추구합니다.',
        '술': '마무리 기운으로 책임감이 강합니다. 장년기에 주변을 잘 돌봅니다.',
        '해': '시작 준비의 기운으로 미래를 준비합니다. 장년기에 다음 단계를 계획합니다.',
    }
}

# ==================== 삼재(三災) ====================
# 삼재는 띠별로 12년 주기로 3년간 찾아옴
# 들삼재(입삼재) -> 눌삼재(중삼재) -> 날삼재(출삼재)

# 삼재 띠 그룹 (같이 삼재가 드는 띠들)
SAMJAE_BUDDY_GROUPS = {
    '원숭이': ['원숭이', '쥐', '용'],      # 신자진
    '쥐': ['원숭이', '쥐', '용'],
    '용': ['원숭이', '쥐', '용'],
    '돼지': ['돼지', '토끼', '양'],        # 해묘미
    '토끼': ['돼지', '토끼', '양'],
    '양': ['돼지', '토끼', '양'],
    '호랑이': ['호랑이', '말', '개'],      # 인오술
    '말': ['호랑이', '말', '개'],
    '개': ['호랑이', '말', '개'],
    '뱀': ['뱀', '닭', '소'],              # 사유축
    '닭': ['뱀', '닭', '소'],
    '소': ['뱀', '닭', '소'],
}

# 삼재가 오는 해의 띠 (3년 연속)
SAMJAE_YEAR_ZODIACS = {
    # 신자진(원숭이, 쥐, 용) -> 인묘진년(호랑이, 토끼, 용)이 삼재
    '원숭이': ['호랑이', '토끼', '용'],
    '쥐': ['호랑이', '토끼', '용'],
    '용': ['호랑이', '토끼', '용'],
    # 해묘미(돼지, 토끼, 양) -> 사오미년(뱀, 말, 양)이 삼재
    '돼지': ['뱀', '말', '양'],
    '토끼': ['뱀', '말', '양'],
    '양': ['뱀', '말', '양'],
    # 인오술(호랑이, 말, 개) -> 신유술년(원숭이, 닭, 개)이 삼재
    '호랑이': ['원숭이', '닭', '개'],
    '말': ['원숭이', '닭', '개'],
    '개': ['원숭이', '닭', '개'],
    # 사유축(뱀, 닭, 소) -> 해자축년(돼지, 쥐, 소)이 삼재
    '뱀': ['돼지', '쥐', '소'],
    '닭': ['돼지', '쥐', '소'],
    '소': ['돼지', '쥐', '소'],
}

SAMJAE_TYPES = {
    0: {'name': '들삼재(入三災)', 'description': '삼재가 시작되는 해입니다. 새로운 일을 시작하기보다 현상 유지에 집중하세요.', 'level': 'caution', 'year': '1년차'},
    1: {'name': '눌삼재(留三災)', 'description': '삼재가 가장 강한 해입니다. 건강과 안전에 각별히 주의하고 큰 결정은 미루세요.', 'level': 'danger', 'year': '2년차'},
    2: {'name': '날삼재(出三災)', 'description': '삼재가 빠져나가는 해입니다. 조금씩 나아지지만 방심하지 마세요.', 'level': 'caution', 'year': '3년차'},
}

# ==================== 오행 상생상극 ====================
# 상생: 목생화, 화생토, 토생금, 금생수, 수생목
# 상극: 목극토, 토극수, 수극화, 화극금, 금극목
OHANG_RELATIONS = {
    '목': {'생': '화', '극': '토', '피생': '수', '피극': '금'},
    '화': {'생': '토', '극': '금', '피생': '목', '피극': '수'},
    '토': {'생': '금', '극': '수', '피생': '화', '피극': '목'},
    '금': {'생': '수', '극': '목', '피생': '토', '피극': '화'},
    '수': {'생': '목', '극': '화', '피생': '금', '피극': '토'},
}

OHANG_SIMPLE = {
    '목(木)': '목', '화(火)': '화', '토(土)': '토', '금(金)': '금', '수(水)': '수'
}

# ==================== 공망(空亡) ====================
# 60갑자 중 각 순(旬)마다 빠지는 두 지지
GONGMANG_TABLE = {
    # 갑자순(甲子旬): 술해공망
    0: ['술', '해'],  # 갑자~계유
    # 갑술순(甲戌旬): 신유공망
    1: ['신', '유'],  # 갑술~계미
    # 갑신순(甲申旬): 오미공망
    2: ['오', '미'],  # 갑신~계사
    # 갑오순(甲午旬): 진사공망
    3: ['진', '사'],  # 갑오~계묘
    # 갑진순(甲辰旬): 인묘공망
    4: ['인', '묘'],  # 갑진~계축
    # 갑인순(甲寅旬): 자축공망
    5: ['자', '축'],  # 갑인~계해
}

GONGMANG_MEANINGS = {
    '자': '새로운 시작에 있어 신중함이 필요합니다.',
    '축': '재물 관리에 주의가 필요합니다.',
    '인': '건강과 활력 관리에 신경 쓰세요.',
    '묘': '대인관계에서 오해가 생길 수 있습니다.',
    '진': '큰 변화나 결정에 신중하세요.',
    '사': '계획이 지연될 수 있으니 여유를 가지세요.',
    '오': '감정 조절에 신경 쓰세요.',
    '미': '건강과 식생활에 주의하세요.',
    '신': '금전 거래에 신중하세요.',
    '유': '언행에 주의가 필요합니다.',
    '술': '가까운 사람과의 관계에 신경 쓰세요.',
    '해': '새로운 일보다 마무리에 집중하세요.',
}

# 대운 관련 상수
DAEUN_CYCLE = 10  # 대운은 10년 단위

# 운세 텍스트 풀
FORTUNE_TEXTS = {
    'money': {
        'good': [
            '재물운이 상승하는 시기입니다. 예상치 못한 수입이 생길 수 있으니 기회를 놓치지 마세요.',
            '금전적으로 안정된 흐름이 이어집니다. 저축을 시작하기 좋은 때입니다.',
            '투자에 좋은 기운이 감돌고 있습니다. 단, 무리한 투자는 피하세요.',
            '노력한 만큼 보상받는 시기입니다. 꾸준히 노력하면 좋은 결과가 있을 것입니다.',
            '재물이 들어오는 기운이 강합니다. 감사하는 마음을 잊지 마세요.'
        ],
        'normal': [
            '큰 변동 없이 안정적인 재정 상태가 유지됩니다.',
            '수입과 지출의 균형을 맞추는 것이 중요한 시기입니다.',
            '계획적인 소비가 필요한 때입니다. 불필요한 지출을 줄여보세요.',
            '현재의 재정 상태를 점검하고 미래를 준비하세요.',
            '급하게 서두르지 말고 차분히 재정 계획을 세워보세요.'
        ],
        'caution': [
            '지출이 늘어날 수 있으니 계획적인 소비가 필요합니다.',
            '충동구매를 자제하고 꼭 필요한 것만 구입하세요.',
            '금전 거래 시 신중함이 필요한 시기입니다.',
            '보증이나 빚 관련 결정은 신중히 하세요.',
            '재정적 리스크를 최소화하는 것이 좋겠습니다.'
        ]
    },
    'love': {
        'good': [
            '연인과의 관계가 더욱 깊어지는 시기입니다. 소중한 시간을 함께 보내세요.',
            '새로운 인연을 만날 수 있는 기운이 있습니다. 열린 마음을 가지세요.',
            '사랑하는 사람에게 진심을 표현하기 좋은 때입니다.',
            '로맨틱한 기운이 감돌고 있습니다. 특별한 데이트를 계획해보세요.',
            '상대방과의 소통이 원활해지는 시기입니다.'
        ],
        'normal': [
            '평온한 관계가 유지되는 시기입니다. 일상의 소중함을 느껴보세요.',
            '서로에 대한 이해와 배려가 필요한 때입니다.',
            '관계에서 작은 변화를 시도해보는 것도 좋습니다.',
            '상대방의 입장에서 생각해보는 연습을 해보세요.',
            '함께하는 시간을 의미 있게 보내세요.'
        ],
        'caution': [
            '오해가 생길 수 있으니 대화를 통해 풀어가세요.',
            '감정적인 결정은 피하고 차분하게 대화하세요.',
            '상대방에게 너무 많은 것을 기대하지 마세요.',
            '혼자만의 시간도 필요합니다. 적절한 거리를 유지하세요.',
            '서운한 감정은 쌓아두지 말고 솔직하게 표현하세요.'
        ]
    },
    'work': {
        'good': [
            '업무에서 좋은 성과를 낼 수 있는 시기입니다. 자신감을 가지세요.',
            '새로운 프로젝트나 기회가 찾아올 수 있습니다.',
            '상사나 동료들에게 인정받을 수 있는 기운이 있습니다.',
            '창의적인 아이디어가 빛을 발하는 때입니다.',
            '노력의 결실을 맺을 수 있는 시기입니다. 끝까지 최선을 다하세요.'
        ],
        'normal': [
            '묵묵히 맡은 바 임무를 수행하는 것이 좋습니다.',
            '현재 하고 있는 일에 집중하세요. 기본에 충실할 때입니다.',
            '동료들과의 협력이 중요한 시기입니다.',
            '업무 스킬을 향상시키기 위한 학습을 고려해보세요.',
            '차분하게 업무를 정리하고 계획을 세워보세요.'
        ],
        'caution': [
            '업무상 실수가 없도록 꼼꼼히 확인하세요.',
            '동료와의 갈등을 피하고 원만한 관계를 유지하세요.',
            '무리한 업무량은 건강에 해로울 수 있습니다. 적절히 조절하세요.',
            '중요한 결정은 신중하게, 서두르지 마세요.',
            '비판에 열린 마음을 가지고 개선점을 찾아보세요.'
        ]
    },
    'health': {
        'good': [
            '건강 상태가 양호한 시기입니다. 꾸준한 운동으로 체력을 유지하세요.',
            '에너지가 넘치는 시기입니다. 새로운 운동을 시작해보세요.',
            '심신이 안정되어 있어 무엇이든 할 수 있는 컨디션입니다.',
            '규칙적인 생활 습관이 좋은 결과를 가져옵니다.',
            '건강관리를 위한 노력이 빛을 발하는 때입니다.'
        ],
        'normal': [
            '건강 유지를 위해 규칙적인 생활을 하세요.',
            '적당한 휴식과 운동의 균형이 필요합니다.',
            '식습관을 점검하고 건강한 식단을 유지하세요.',
            '스트레스 관리에 신경 쓰세요.',
            '충분한 수면을 취하는 것이 중요합니다.'
        ],
        'caution': [
            '과로를 피하고 충분한 휴식을 취하세요.',
            '건강 검진을 미루지 말고 정기적으로 받으세요.',
            '면역력이 약해질 수 있으니 건강관리에 신경 쓰세요.',
            '무리한 활동은 피하고 몸의 신호에 귀 기울이세요.',
            '스트레스가 건강에 영향을 줄 수 있습니다. 마음의 여유를 가지세요.'
        ]
    },
    'overall': {
        'daily': {
            'good': [
                '오늘은 행운이 따르는 하루입니다. 적극적으로 행동하세요.',
                '좋은 기운이 가득한 하루입니다. 새로운 시도를 해보세요.',
                '뜻밖의 좋은 소식이 있을 수 있습니다. 기대해도 좋아요.',
                '오늘 만나는 사람들과 좋은 인연이 될 수 있습니다.',
                '긍정적인 에너지가 가득한 하루입니다. 미소를 잃지 마세요.'
            ],
            'normal': [
                '평온한 하루가 예상됩니다. 일상의 소중함을 느껴보세요.',
                '무난하게 흘러가는 하루입니다. 차분하게 보내세요.',
                '특별한 일은 없지만 안정적인 하루가 될 것입니다.',
                '오늘은 자신을 돌아보는 시간을 가져보세요.',
                '조용히 자기계발에 시간을 투자해보세요.'
            ],
            'caution': [
                '오늘은 신중함이 필요한 하루입니다. 급한 결정은 피하세요.',
                '작은 실수가 생길 수 있으니 꼼꼼히 확인하세요.',
                '감정 조절이 필요한 하루입니다. 차분함을 유지하세요.',
                '오해가 생기기 쉬운 날이니 말과 행동에 주의하세요.',
                '무리하지 말고 여유를 가지세요.'
            ]
        },
        'weekly': {
            'good': [
                '이번 주는 전반적으로 좋은 기운이 흐릅니다. 계획했던 일을 추진하기 좋은 시기입니다.',
                '주중에 좋은 소식이 있을 수 있습니다. 기대해도 좋아요.',
                '이번 주는 목표를 향해 나아가기 좋은 때입니다.',
                '주변 사람들과의 관계가 좋아지는 한 주가 될 것입니다.',
                '노력한 만큼 보상받을 수 있는 한 주입니다.'
            ],
            'normal': [
                '평온하게 흘러가는 한 주가 예상됩니다.',
                '이번 주는 기본에 충실하며 보내는 것이 좋습니다.',
                '급하게 서두르기보다 차분히 준비하는 시간을 가지세요.',
                '일상을 정리하고 다음을 준비하는 한 주가 될 것입니다.',
                '작은 것에 감사하며 보내면 좋은 한 주가 될 것입니다.'
            ],
            'caution': [
                '이번 주는 신중한 판단이 필요합니다. 큰 결정은 미루세요.',
                '예상치 못한 변수가 생길 수 있으니 유연하게 대처하세요.',
                '건강관리에 특히 신경 쓰는 한 주가 되어야 합니다.',
                '대인관계에서 오해가 생기지 않도록 주의하세요.',
                '계획대로 되지 않더라도 조급해하지 마세요.'
            ]
        },
        'monthly': {
            'good': [
                '이번 달은 성장과 발전의 기운이 강합니다. 새로운 도전을 시작해보세요.',
                '목표를 이룰 수 있는 좋은 기운이 가득한 달입니다.',
                '인간관계가 확장되고 좋은 인연을 만날 수 있습니다.',
                '재정적으로도 안정되는 흐름이 이어집니다.',
                '이번 달은 여러 방면에서 좋은 결과를 기대할 수 있습니다.'
            ],
            'normal': [
                '큰 변동 없이 안정적으로 흘러가는 달입니다.',
                '현재 상태를 유지하며 내실을 다지기 좋은 시기입니다.',
                '급하게 변화를 추구하기보다 차분히 준비하세요.',
                '이번 달은 계획을 세우고 정리하는 시간으로 활용하세요.',
                '작은 성취들을 모아 큰 결과를 만들어가세요.'
            ],
            'caution': [
                '이번 달은 무리한 계획보다 실현 가능한 목표에 집중하세요.',
                '건강과 재정 관리에 특히 신경 써야 하는 달입니다.',
                '중요한 결정은 다음 달로 미루는 것이 좋겠습니다.',
                '주변 사람들과의 갈등을 피하고 조화를 추구하세요.',
                '예상치 못한 지출에 대비해 여유 자금을 마련해두세요.'
            ]
        },
        'yearly': {
            'good': [
                '올해는 전반적으로 상승세를 타는 해입니다. 적극적으로 기회를 잡으세요.',
                '노력의 결실을 맺을 수 있는 해입니다. 끝까지 포기하지 마세요.',
                '새로운 시작과 도전에 좋은 기운이 함께하는 해입니다.',
                '인복이 따르는 해입니다. 좋은 사람들과의 만남을 기대하세요.',
                '꿈을 향해 한 걸음 더 나아갈 수 있는 해입니다.'
            ],
            'normal': [
                '안정적으로 흘러가는 한 해가 예상됩니다.',
                '올해는 기반을 다지고 내실을 키우는 시기입니다.',
                '급격한 변화보다 꾸준한 노력이 빛을 발하는 해입니다.',
                '현재 위치에서 최선을 다하면 좋은 결과가 있을 것입니다.',
                '작은 목표들을 하나씩 이뤄가는 한 해로 만들어보세요.'
            ],
            'caution': [
                '올해는 신중한 판단이 필요한 해입니다. 큰 변화는 피하세요.',
                '건강관리에 특히 신경 써야 하는 한 해입니다.',
                '재정적으로 보수적인 접근이 필요합니다.',
                '인간관계에서 오해가 생기지 않도록 주의하세요.',
                '무리한 계획보다 실현 가능한 목표에 집중하세요.'
            ]
        }
    }
}

# 행운 요소
LUCKY_COLORS = ['빨강', '주황', '노랑', '초록', '파랑', '남색', '보라', '분홍', '하양', '검정', '금색', '은색']
LUCKY_DIRECTIONS = ['동쪽', '서쪽', '남쪽', '북쪽', '동북쪽', '동남쪽', '서북쪽', '서남쪽']
LUCKY_NUMBERS = list(range(1, 46))
LUCKY_ITEMS = ['열쇠', '책', '꽃', '거울', '펜', '시계', '반지', '동전', '나뭇잎', '돌멩이', '깃털', '리본']

# 음력 설날 날짜 (양력 기준) - 빠른 년생 판단용
# 해당 연도의 음력 1월 1일이 양력 몇 월 며칠인지
LUNAR_NEW_YEAR = {
    1960: (1, 28), 1961: (2, 15), 1962: (2, 5), 1963: (1, 25), 1964: (2, 13),
    1965: (2, 2), 1966: (1, 21), 1967: (2, 9), 1968: (1, 30), 1969: (2, 17),
    1970: (2, 6), 1971: (1, 27), 1972: (2, 15), 1973: (2, 3), 1974: (1, 23),
    1975: (2, 11), 1976: (1, 31), 1977: (2, 18), 1978: (2, 7), 1979: (1, 28),
    1980: (2, 16), 1981: (2, 5), 1982: (1, 25), 1983: (2, 13), 1984: (2, 2),
    1985: (2, 20), 1986: (2, 9), 1987: (1, 29), 1988: (2, 17), 1989: (2, 6),
    1990: (1, 27), 1991: (2, 15), 1992: (2, 4), 1993: (1, 23), 1994: (2, 10),
    1995: (1, 31), 1996: (2, 19), 1997: (2, 7), 1998: (1, 28), 1999: (2, 16),
    2000: (2, 5), 2001: (1, 24), 2002: (2, 12), 2003: (2, 1), 2004: (1, 22),
    2005: (2, 9), 2006: (1, 29), 2007: (2, 18), 2008: (2, 7), 2009: (1, 26),
    2010: (2, 14), 2011: (2, 3), 2012: (1, 23), 2013: (2, 10), 2014: (1, 31),
    2015: (2, 19), 2016: (2, 8), 2017: (1, 28), 2018: (2, 16), 2019: (2, 5),
    2020: (1, 25), 2021: (2, 12), 2022: (2, 1), 2023: (1, 22), 2024: (2, 10),
    2025: (1, 29), 2026: (2, 17), 2027: (2, 6), 2028: (1, 26), 2029: (2, 13),
    2030: (2, 3), 2031: (1, 23), 2032: (2, 11), 2033: (1, 31), 2034: (2, 19),
    2035: (2, 8), 2036: (1, 28), 2037: (2, 15), 2038: (2, 4), 2039: (1, 24),
    2040: (2, 12),
}


def get_saju_year(birth_year: int, birth_month: int, birth_day: int) -> int:
    """사주에서 사용할 연도 반환 (빠른 년생 고려)

    음력 설날 이전에 태어났으면 전년도를 사주 연도로 사용

    Args:
        birth_year: 양력 출생 연도
        birth_month: 양력 출생 월
        birth_day: 양력 출생 일

    Returns:
        사주 계산에 사용할 연도
    """
    # 해당 연도의 음력 설날 확인
    lunar_new_year = LUNAR_NEW_YEAR.get(birth_year)

    if lunar_new_year is None:
        # 데이터가 없는 연도는 대략 2월 4일(입춘) 기준으로 판단
        if birth_month < 2 or (birth_month == 2 and birth_day < 4):
            return birth_year - 1
        return birth_year

    lunar_month, lunar_day = lunar_new_year

    # 음력 설날 당일 또는 이전에 태어났으면 전년도 (설날 당일도 전년도 띠)
    if birth_month < lunar_month or (birth_month == lunar_month and birth_day <= lunar_day):
        return birth_year - 1

    return birth_year


def get_year_ganji(year: int) -> Tuple[int, int]:
    """연도의 천간지지 인덱스 반환"""
    base_year = 1984  # 갑자년
    diff = year - base_year
    cheongan_idx = diff % 10
    jiji_idx = diff % 12
    return cheongan_idx, jiji_idx


def get_month_ganji(year: int, month: int) -> Tuple[int, int]:
    """월의 천간지지 인덱스 반환 (간략화된 계산)"""
    # 연간에 따른 월간 기준
    year_cheongan, _ = get_year_ganji(year)
    month_cheongan_base = (year_cheongan % 5) * 2
    cheongan_idx = (month_cheongan_base + month - 1) % 10
    jiji_idx = (month + 1) % 12  # 인월(1월)부터 시작
    return cheongan_idx, jiji_idx


def get_day_ganji(year: int, month: int, day: int) -> Tuple[int, int]:
    """일의 천간지지 인덱스 반환"""
    # 기준일: 1900년 1월 1일 = 갑자일 (간략화)
    from datetime import date
    base_date = date(1900, 1, 1)
    target_date = date(year, month, day)
    diff = (target_date - base_date).days
    cheongan_idx = diff % 10
    jiji_idx = diff % 12
    return cheongan_idx, jiji_idx


def calculate_saju(birth_year: int, birth_month: int, birth_day: int) -> Dict[str, Any]:
    """사주팔자 계산 (빠른 년생 고려)"""
    # 빠른 년생 고려하여 사주 연도 계산
    saju_year = get_saju_year(birth_year, birth_month, birth_day)

    year_cheongan, year_jiji = get_year_ganji(saju_year)
    month_cheongan, month_jiji = get_month_ganji(saju_year, birth_month)
    day_cheongan, day_jiji = get_day_ganji(birth_year, birth_month, birth_day)

    # 한글 천간에서 첫글자 추출
    day_char = CHEONGAN[day_cheongan][0]  # '갑' 등
    year_char = CHEONGAN[year_cheongan][0]
    month_char = CHEONGAN[month_cheongan][0]

    # 지지 첫글자
    year_jiji_char = JIJI[year_jiji][0]  # '자' 등
    day_jiji_char = JIJI[day_jiji][0]

    # 오행 계산 (일간 기준)
    main_ohang = OHANG.get(day_char, '목(木)')

    # 띠
    zodiac = ZODIAC_ANIMALS[year_jiji]

    # 천간별 상세 특성
    day_cheongan_trait = CHEONGAN_TRAITS.get(day_char, CHEONGAN_TRAITS['갑'])
    year_cheongan_trait = CHEONGAN_TRAITS.get(year_char, CHEONGAN_TRAITS['갑'])

    # 지지(띠)별 상세 특성
    year_jiji_trait = JIJI_TRAITS.get(year_jiji_char, JIJI_TRAITS['자'])
    day_jiji_trait = JIJI_TRAITS.get(day_jiji_char, JIJI_TRAITS['자'])

    # 월지 첫글자
    month_jiji_char = JIJI[month_jiji][0]

    # 사주 풀이 생성
    analysis = generate_saju_analysis(
        day_char, year_char, month_char,
        year_jiji_char, day_jiji_char,
        day_cheongan_trait, year_jiji_trait, main_ohang
    )

    # 주(柱)별 풀이 생성
    pillar_readings = generate_pillar_readings(
        year_char, year_jiji_char,
        month_char, month_jiji_char,
        day_char, day_jiji_char,
        zodiac
    )

    return {
        'year': {
            'cheongan': CHEONGAN[year_cheongan],
            'jiji': JIJI[year_jiji],
            'hanja': f'{CHEONGAN_HANJA[year_cheongan]}{JIJI_HANJA[year_jiji]}',
            'reading': pillar_readings['year']
        },
        'month': {
            'cheongan': CHEONGAN[month_cheongan],
            'jiji': JIJI[month_jiji],
            'hanja': f'{CHEONGAN_HANJA[month_cheongan]}{JIJI_HANJA[month_jiji]}',
            'reading': pillar_readings['month']
        },
        'day': {
            'cheongan': CHEONGAN[day_cheongan],
            'jiji': JIJI[day_jiji],
            'hanja': f'{CHEONGAN_HANJA[day_cheongan]}{JIJI_HANJA[day_jiji]}',
            'reading': pillar_readings['day']
        },
        'main_ohang': main_ohang,
        'ohang_info': OHANG_TRAITS.get(main_ohang, OHANG_TRAITS['목(木)']),
        'zodiac': zodiac,
        'day_master': day_cheongan_trait,  # 일간(일주 천간) 상세
        'zodiac_trait': year_jiji_trait,   # 띠 상세
        'analysis': analysis,              # 사주 풀이
        'pillar_readings': pillar_readings,  # 주별 풀이
        # 길흉 계산용 인덱스
        '_indices': {
            'day_cheongan': day_cheongan,
            'day_jiji': day_jiji,
            'year_cheongan': year_cheongan,
            'year_jiji': year_jiji,
            'month_jiji': month_jiji
        }
    }


def generate_pillar_readings(year_char: str, year_jiji_char: str,
                              month_char: str, month_jiji_char: str,
                              day_char: str, day_jiji_char: str,
                              zodiac: str) -> Dict[str, Any]:
    """년주, 월주, 일주 각각에 대한 풀이 생성

    Args:
        year_char: 년간 천간 (예: '갑')
        year_jiji_char: 년지 지지 (예: '자')
        month_char: 월간 천간
        month_jiji_char: 월지 지지
        day_char: 일간 천간
        day_jiji_char: 일지 지지
        zodiac: 띠 (예: '쥐')

    Returns:
        주별 풀이 딕셔너리
    """
    # 년주 풀이
    year_cheongan_meaning = YEAR_PILLAR_MEANINGS['cheongan'].get(year_char, '')
    year_jiji_trait = JIJI_TRAITS.get(year_jiji_char, {})

    year_reading = {
        'title': '년주(年柱) - 조상궁',
        'period': '0~20세 초년운',
        'summary': f'{zodiac}띠로 태어나, 어린 시절과 가문의 기운을 나타냅니다.',
        'cheongan_reading': year_cheongan_meaning,
        'jiji_reading': f"{year_jiji_trait.get('animal', '')}띠의 특성: {year_jiji_trait.get('personality', '')}",
        'strength': year_jiji_trait.get('strength', ''),
        'advice': f"조상의 음덕과 가문의 기운이 어린 시절에 영향을 미칩니다. {year_jiji_trait.get('strength', '').split(',')[0] if year_jiji_trait.get('strength') else '안정감'}을 바탕으로 성장하세요."
    }

    # 월주 풀이
    month_cheongan_meaning = MONTH_PILLAR_MEANINGS['cheongan'].get(month_char, '')
    month_season_meaning = MONTH_PILLAR_MEANINGS['season'].get(month_jiji_char, '')

    month_reading = {
        'title': '월주(月柱) - 부모궁',
        'period': '20~40세 청년운',
        'summary': '부모님과의 관계, 청년기의 사회 활동을 나타냅니다.',
        'cheongan_reading': month_cheongan_meaning,
        'jiji_reading': month_season_meaning,
        'advice': '청년기는 사회에 나아가 기반을 다지는 중요한 시기입니다. 부모님의 조언을 새기되 자신만의 길을 개척하세요.'
    }

    # 일주 풀이
    day_cheongan_meaning = DAY_PILLAR_MEANINGS['cheongan'].get(day_char, '')
    day_jiji_meaning = DAY_PILLAR_MEANINGS['jiji'].get(day_jiji_char, '')
    day_trait = CHEONGAN_TRAITS.get(day_char, {})

    day_reading = {
        'title': '일주(日柱) - 본인궁',
        'period': '40~60세 장년운',
        'summary': '본인의 핵심 성격과 배우자운, 장년기의 운을 나타냅니다.',
        'cheongan_reading': day_cheongan_meaning,
        'jiji_reading': day_jiji_meaning,
        'core_trait': day_trait.get('personality', ''),
        'spouse_compatibility': f"배우자로는 {day_trait.get('compatible', '')} 천간을 가진 분이 잘 맞습니다.",
        'advice': '일주는 사주의 핵심입니다. 자신의 본성을 이해하고 장점을 살리면서 단점을 보완해 나가세요.'
    }

    return {
        'year': year_reading,
        'month': month_reading,
        'day': day_reading
    }


def generate_saju_analysis(day_char: str, year_char: str, month_char: str,
                           year_jiji: str, day_jiji: str,
                           day_trait: Dict, zodiac_trait: Dict, main_ohang: str) -> Dict[str, Any]:
    """사주 풀이 생성"""

    # 성격 분석
    personality = f"""당신의 일간은 {day_trait['name']}입니다.
{day_trait['symbol']}에 비유되는 성격으로, {day_trait['personality']}

주요 강점: {day_trait['strength']}
보완할 점: {day_trait['weakness']}"""

    # 적성 및 직업
    career = f"""적합한 직업 분야: {day_trait['career']}

{OHANG_TRAITS[main_ohang]['element']}의 기운을 가진 당신은 {OHANG_TRAITS[main_ohang]['strength']}이 뛰어나
이러한 특성을 살릴 수 있는 분야에서 두각을 나타낼 수 있습니다."""

    # 대인관계
    relationship = f"""{zodiac_trait['animal']}띠인 당신은 {zodiac_trait['personality']}

궁합이 좋은 띠: {zodiac_trait['compatible_zodiac']}
주의할 띠: {zodiac_trait['incompatible_zodiac']}

일간 기준 궁합이 좋은 천간: {day_trait['compatible']}"""

    # 인생 조언
    advice_templates = {
        '목(木)': "나무처럼 꾸준히 성장하되, 때로는 유연함도 필요합니다. 너무 곧기만 하면 부러질 수 있으니 상황에 맞게 적응하는 지혜를 기르세요.",
        '화(火)': "불처럼 열정적인 것은 좋지만, 타오르다 꺼지지 않도록 에너지 관리가 중요합니다. 꾸준함을 유지하는 것이 성공의 열쇠입니다.",
        '토(土)': "흙처럼 만물을 품는 포용력이 있으나, 때로는 자신의 의견을 명확히 표현하는 것도 필요합니다.",
        '금(金)': "쇠처럼 단단한 의지는 장점이지만, 부드러움과 타협도 인간관계에서 중요합니다. 유연성을 기르면 더 큰 성취를 이룰 수 있습니다.",
        '수(水)': "물처럼 유연한 것은 큰 장점이나, 때로는 한 곳에 집중하는 일관성도 필요합니다. 목표를 정하고 꾸준히 나아가세요."
    }
    advice = advice_templates.get(main_ohang, advice_templates['목(木)'])

    # 총평
    summary = f"""{day_trait['name']}을 일간으로 가진 {zodiac_trait['animal']}띠 사주입니다.

{main_ohang.replace('(', ' ').replace(')', '')} 오행의 기운이 주를 이루며,
{OHANG_TRAITS[main_ohang]['trait']}

{day_trait['symbol']}의 특성과 {zodiac_trait['animal']}의 기질이 어우러져
{day_trait['strength'].split(',')[0]}과 {zodiac_trait['strength'].split(',')[0]}이 조화를 이룹니다."""

    return {
        'personality': personality,
        'career': career,
        'relationship': relationship,
        'advice': advice,
        'summary': summary,
        'pillar_meanings': SAJU_ANALYSIS
    }


# ==================== 길흉화복 계산 함수들 ====================

def calculate_samjae(birth_zodiac: str, target_year: int) -> Dict[str, Any]:
    """삼재 계산

    Args:
        birth_zodiac: 본인의 띠 (예: '말', '호랑이')
        target_year: 운세를 볼 해 (예: 2026)

    Returns:
        삼재 정보 딕셔너리
    """
    # 해당 연도의 띠 계산
    year_jiji_idx = (target_year - 4) % 12
    year_zodiac = ZODIAC_ANIMALS[year_jiji_idx]

    # 본인 띠의 삼재가 오는 해 띠들 (3년)
    samjae_year_zodiacs = SAMJAE_YEAR_ZODIACS.get(birth_zodiac, [])
    # 같이 삼재 드는 띠 그룹
    samjae_buddy_group = SAMJAE_BUDDY_GROUPS.get(birth_zodiac, [])

    if year_zodiac in samjae_year_zodiacs:
        samjae_idx = samjae_year_zodiacs.index(year_zodiac)
        samjae_info = SAMJAE_TYPES[samjae_idx]
        return {
            'is_samjae': True,
            'type': samjae_info['name'],
            'description': samjae_info['description'],
            'level': samjae_info['level'],
            'year_num': samjae_info['year'],
            'year_zodiac': year_zodiac,
            'samjae_year_zodiacs': samjae_year_zodiacs,  # 삼재가 오는 해 띠들 (뱀, 말, 양)
            'samjae_buddy_group': samjae_buddy_group,    # 같이 삼재 드는 띠들 (돼지, 토끼, 양)
        }
    else:
        return {
            'is_samjae': False,
            'type': None,
            'description': '올해는 삼재가 아닙니다. 비교적 순탄한 한 해가 예상됩니다.',
            'level': 'good',
            'year_num': None,
            'year_zodiac': year_zodiac,
            'samjae_year_zodiacs': samjae_year_zodiacs,
            'samjae_buddy_group': samjae_buddy_group,
        }


def calculate_daeun(birth_year: int, birth_month: int, target_year: int,
                    day_cheongan_idx: int) -> Dict[str, Any]:
    """대운 계산 (간략화 버전)

    Args:
        birth_year: 출생 연도
        birth_month: 출생 월
        target_year: 운세를 볼 해
        day_cheongan_idx: 일간 천간 인덱스

    Returns:
        대운 정보 딕셔너리
    """
    age = target_year - birth_year

    # 대운 시작 나이 (간략화: 보통 8~10세부터 시작)
    daeun_start_age = 8

    if age < daeun_start_age:
        return {
            'current_daeun': '초년운',
            'daeun_number': 0,
            'description': '아직 대운이 시작되지 않았습니다. 부모의 운의 영향을 받는 시기입니다.',
            'period': f'0~{daeun_start_age}세',
            'fortune_level': 'normal'
        }

    # 대운 번호 계산 (10년 단위)
    daeun_number = (age - daeun_start_age) // DAEUN_CYCLE + 1
    daeun_start = daeun_start_age + (daeun_number - 1) * DAEUN_CYCLE
    daeun_end = daeun_start + DAEUN_CYCLE - 1

    # 대운 천간 계산 (간략화)
    daeun_cheongan_idx = (day_cheongan_idx + daeun_number) % 10
    daeun_cheongan = CHEONGAN[daeun_cheongan_idx]
    daeun_cheongan_char = daeun_cheongan[0]

    # 대운 오행
    daeun_ohang = OHANG.get(daeun_cheongan_char, '목(木)')

    # 대운 설명 생성
    daeun_descriptions = {
        '목(木)': '성장과 발전의 대운입니다. 새로운 시작과 도전이 유리한 시기입니다.',
        '화(火)': '활동과 열정의 대운입니다. 적극적인 행동이 좋은 결과를 가져옵니다.',
        '토(土)': '안정과 축적의 대운입니다. 기반을 다지고 내실을 기하기 좋은 시기입니다.',
        '금(金)': '결실과 수확의 대운입니다. 그동안의 노력이 결실을 맺는 시기입니다.',
        '수(水)': '지혜와 휴식의 대운입니다. 내면을 돌아보고 다음을 준비하는 시기입니다.'
    }

    return {
        'current_daeun': f'{daeun_number}운 ({daeun_cheongan})',
        'daeun_number': daeun_number,
        'daeun_cheongan': daeun_cheongan,
        'daeun_ohang': daeun_ohang,
        'description': daeun_descriptions.get(daeun_ohang, daeun_descriptions['목(木)']),
        'period': f'{daeun_start}~{daeun_end}세',
        'fortune_level': 'good' if daeun_number % 2 == 1 else 'normal'
    }


def calculate_ohang_gilhyung(day_ohang: str, year_ohang: str, target_year: int) -> Dict[str, Any]:
    """오행 상생상극에 따른 길흉 판단

    Args:
        day_ohang: 일간의 오행 (예: '목(木)')
        year_ohang: 년간의 오행
        target_year: 운세를 볼 해

    Returns:
        오행 길흉 정보 딕셔너리
    """
    # 해당 연도의 천간 오행 계산
    year_cheongan_idx = (target_year - 4) % 10
    year_cheongan = CHEONGAN[year_cheongan_idx]
    year_cheongan_char = year_cheongan[0]
    target_year_ohang = OHANG.get(year_cheongan_char, '목(木)')

    # 오행 간략화
    my_ohang = OHANG_SIMPLE.get(day_ohang, '목')
    target_ohang = OHANG_SIMPLE.get(target_year_ohang, '목')

    relations = OHANG_RELATIONS.get(my_ohang, OHANG_RELATIONS['목'])

    result = {
        'my_ohang': day_ohang,
        'year_ohang': target_year_ohang,
        'year_cheongan': year_cheongan,
    }

    if relations['생'] == target_ohang:
        # 내가 생해주는 관계 (설기)
        result.update({
            'relation': '설기(洩氣)',
            'description': f'나의 기운({my_ohang})이 올해({target_ohang})를 생해주어 에너지 소모가 있을 수 있습니다. 무리하지 말고 건강 관리에 신경 쓰세요.',
            'level': 'normal',
            'advice': '에너지 관리가 중요한 해입니다.'
        })
    elif relations['피생'] == target_ohang:
        # 올해가 나를 생해주는 관계 (인성)
        result.update({
            'relation': '인성(印星)',
            'description': f'올해({target_ohang})의 기운이 나({my_ohang})를 도와줍니다. 학업, 자격증, 문서운이 좋습니다.',
            'level': 'good',
            'advice': '배움과 성장에 좋은 해입니다.'
        })
    elif relations['극'] == target_ohang:
        # 내가 극하는 관계 (재성)
        result.update({
            'relation': '재성(財星)',
            'description': f'나의 기운({my_ohang})이 올해({target_ohang})를 극합니다. 재물운이 있지만 노력이 필요합니다.',
            'level': 'normal',
            'advice': '노력한 만큼 재물이 따르는 해입니다.'
        })
    elif relations['피극'] == target_ohang:
        # 올해가 나를 극하는 관계 (관성)
        result.update({
            'relation': '관성(官星)',
            'description': f'올해({target_ohang})의 기운이 나({my_ohang})를 극합니다. 직장, 명예에 변화가 있을 수 있으니 신중하게 행동하세요.',
            'level': 'caution',
            'advice': '언행을 조심하고 겸손한 자세가 필요한 해입니다.'
        })
    else:
        # 같은 오행 (비겁)
        result.update({
            'relation': '비겁(比劫)',
            'description': f'올해와 나의 기운({my_ohang})이 같습니다. 경쟁이 있을 수 있지만 동료의 도움도 기대할 수 있습니다.',
            'level': 'normal',
            'advice': '협력과 경쟁이 공존하는 해입니다.'
        })

    return result


def calculate_gongmang(day_cheongan_idx: int, day_jiji_idx: int) -> Dict[str, Any]:
    """공망 계산

    Args:
        day_cheongan_idx: 일간 천간 인덱스
        day_jiji_idx: 일지 지지 인덱스

    Returns:
        공망 정보 딕셔너리
    """
    # 60갑자에서 해당 일주가 속한 순(旬) 계산
    # 갑자=0, 을축=1, ... 순으로 60갑자 인덱스 계산
    ganji_idx = (day_cheongan_idx * 12 + day_jiji_idx) % 60

    # 어느 순에 속하는지 (10개씩 6개 순)
    sun_idx = ganji_idx // 10

    # 해당 순의 공망 지지
    gongmang_jiji = GONGMANG_TABLE.get(sun_idx, ['술', '해'])

    meanings = []
    for jiji in gongmang_jiji:
        meaning = GONGMANG_MEANINGS.get(jiji, '')
        jiji_name = JIJI_TRAITS.get(jiji, {}).get('name', jiji)
        meanings.append({
            'jiji': jiji,
            'name': jiji_name,
            'meaning': meaning
        })

    return {
        'gongmang': gongmang_jiji,
        'meanings': meanings,
        'description': f'공망은 {gongmang_jiji[0]}({JIJI_TRAITS.get(gongmang_jiji[0], {}).get("animal", "")})과 {gongmang_jiji[1]}({JIJI_TRAITS.get(gongmang_jiji[1], {}).get("animal", "")})입니다. 해당 띠의 해나 월에는 일이 허무하게 될 수 있으니 주의하세요.',
        'advice': '공망의 시기에는 새로운 시작보다 마무리에 집중하는 것이 좋습니다.'
    }


def calculate_gilhyung_summary(samjae: Dict, daeun: Dict, ohang_gilhyung: Dict) -> Dict[str, Any]:
    """길흉화복 종합 요약

    Args:
        samjae: 삼재 정보
        daeun: 대운 정보
        ohang_gilhyung: 오행 길흉 정보

    Returns:
        종합 요약 딕셔너리
    """
    # 점수 계산
    score = 70  # 기본 점수

    # 삼재 영향
    if samjae['is_samjae']:
        if samjae['level'] == 'danger':
            score -= 20
        else:
            score -= 10
    else:
        score += 5

    # 대운 영향
    if daeun['fortune_level'] == 'good':
        score += 10

    # 오행 길흉 영향
    if ohang_gilhyung['level'] == 'good':
        score += 10
    elif ohang_gilhyung['level'] == 'caution':
        score -= 10

    # 점수 범위 조정
    score = max(30, min(95, score))

    # 종합 레벨
    if score >= 80:
        level = 'good'
        summary = '전반적으로 길한 기운이 강한 해입니다.'
    elif score >= 60:
        level = 'normal'
        summary = '평범한 흐름이 예상되는 해입니다. 꾸준히 노력하세요.'
    else:
        level = 'caution'
        summary = '주의가 필요한 해입니다. 신중하게 행동하세요.'

    return {
        'score': score,
        'level': level,
        'summary': summary
    }


def generate_seed(name: str, birth_date: str, period: str, date_str: str) -> int:
    """운세 생성을 위한 시드 생성"""
    seed_str = f"{name}_{birth_date}_{period}_{date_str}"
    return int(hashlib.md5(seed_str.encode()).hexdigest(), 16)


def get_fortune_level(seed: int) -> str:
    """운세 레벨 결정 (good/normal/caution)"""
    val = seed % 100
    if val < 35:
        return 'good'
    elif val < 75:
        return 'normal'
    else:
        return 'caution'


def get_score(seed: int, base: int = 50) -> int:
    """운세 점수 생성 (1-5 별점 또는 0-100 점수)"""
    variation = (seed % 51)  # 0-50
    return min(100, max(1, base + variation - 25))


def get_star_rating(score: int) -> int:
    """점수를 별점(1-5)으로 변환"""
    if score >= 80:
        return 5
    elif score >= 65:
        return 4
    elif score >= 50:
        return 3
    elif score >= 35:
        return 2
    else:
        return 1


def select_text(texts: List[str], seed: int) -> str:
    """텍스트 목록에서 시드 기반으로 선택"""
    idx = seed % len(texts)
    return texts[idx]


def get_lucky_elements(seed: int) -> Dict[str, Any]:
    """행운 요소 생성"""
    color_seed = seed
    number_seed = seed >> 4
    direction_seed = seed >> 8
    item_seed = seed >> 12

    # 행운의 숫자 2개
    num1 = LUCKY_NUMBERS[number_seed % len(LUCKY_NUMBERS)]
    num2 = LUCKY_NUMBERS[(number_seed >> 3) % len(LUCKY_NUMBERS)]
    if num1 == num2:
        num2 = (num1 % 45) + 1

    return {
        'color': LUCKY_COLORS[color_seed % len(LUCKY_COLORS)],
        'numbers': sorted([num1, num2]),
        'direction': LUCKY_DIRECTIONS[direction_seed % len(LUCKY_DIRECTIONS)],
        'item': LUCKY_ITEMS[item_seed % len(LUCKY_ITEMS)]
    }


def get_fortune(name: str, birth_date: str, target_date: datetime = None) -> Dict[str, Any]:
    """
    운세 정보 생성

    Args:
        name: 이름
        birth_date: 생년월일 (YYYY-MM-DD)
        target_date: 운세 조회 날짜 (기본: 오늘)

    Returns:
        운세 정보 딕셔너리
    """
    if target_date is None:
        target_date = datetime.now()

    # 생년월일 파싱
    birth_parts = birth_date.split('-')
    birth_year = int(birth_parts[0])
    birth_month = int(birth_parts[1])
    birth_day = int(birth_parts[2])

    # 사주 계산
    saju = calculate_saju(birth_year, birth_month, birth_day)

    # 날짜 문자열 (기간별 시드용)
    today_str = target_date.strftime('%Y-%m-%d')
    week_str = f"{target_date.year}-W{target_date.isocalendar()[1]}"
    month_str = target_date.strftime('%Y-%m')
    year_str = str(target_date.year)

    # 카테고리별 운세
    categories = {}
    for cat in ['money', 'love', 'work', 'health']:
        seed = generate_seed(name, birth_date, cat, today_str)
        level = get_fortune_level(seed)
        score = get_score(seed)
        text = select_text(FORTUNE_TEXTS[cat][level], seed)

        categories[cat] = {
            'level': level,
            'score': score,
            'stars': get_star_rating(score),
            'text': text
        }

    # 총운 점수 (카테고리 평균)
    overall_score = sum(c['score'] for c in categories.values()) // 4

    # 기간별 운세
    periods = {}
    for period, date_key in [('daily', today_str), ('weekly', week_str), ('monthly', month_str), ('yearly', year_str)]:
        seed = generate_seed(name, birth_date, f'overall_{period}', date_key)
        level = get_fortune_level(seed)
        text = select_text(FORTUNE_TEXTS['overall'][period][level], seed)
        periods[period] = {
            'level': level,
            'text': text
        }

    # 행운 요소
    lucky_seed = generate_seed(name, birth_date, 'lucky', today_str)
    lucky = get_lucky_elements(lucky_seed)

    # ==================== 길흉화복 계산 ====================
    target_year = target_date.year

    # 삼재 계산
    samjae = calculate_samjae(saju['zodiac'], target_year)

    # 대운 계산
    indices = saju.get('_indices', {})
    daeun = calculate_daeun(
        birth_year, birth_month, target_year,
        indices.get('day_cheongan', 0)
    )

    # 오행 길흉 계산
    ohang_gilhyung = calculate_ohang_gilhyung(
        saju['main_ohang'],
        saju['main_ohang'],  # year_ohang은 main_ohang 사용
        target_year
    )

    # 공망 계산
    gongmang = calculate_gongmang(
        indices.get('day_cheongan', 0),
        indices.get('day_jiji', 0)
    )

    # 길흉 종합
    gilhyung_summary = calculate_gilhyung_summary(samjae, daeun, ohang_gilhyung)

    # saju에서 내부용 인덱스 제거
    saju_result = {k: v for k, v in saju.items() if not k.startswith('_')}

    return {
        'name': name,
        'birth_date': birth_date,
        'target_date': today_str,
        'saju': saju_result,
        'categories': {
            'money': {**categories['money'], 'name': '금전운', 'icon': '💰'},
            'love': {**categories['love'], 'name': '애정운', 'icon': '💕'},
            'work': {**categories['work'], 'name': '직장운', 'icon': '💼'},
            'health': {**categories['health'], 'name': '건강운', 'icon': '🏥'}
        },
        'overall': {
            'score': overall_score,
            'stars': get_star_rating(overall_score)
        },
        'periods': {
            'daily': {**periods['daily'], 'name': '오늘의 운세'},
            'weekly': {**periods['weekly'], 'name': '이번 주 운세'},
            'monthly': {**periods['monthly'], 'name': '이번 달 운세'},
            'yearly': {**periods['yearly'], 'name': '올해의 운세'}
        },
        'lucky': lucky,
        'gilhyung': {
            'samjae': samjae,
            'daeun': daeun,
            'ohang': ohang_gilhyung,
            'gongmang': gongmang,
            'summary': gilhyung_summary
        }
    }


# 테스트
if __name__ == '__main__':
    result = get_fortune('홍길동', '1990-05-15')
    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))

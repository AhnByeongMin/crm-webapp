from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    # 배경색 생성
    img = Image.new('RGB', (size, size), '#667eea')
    draw = ImageDraw.Draw(img)

    # 원 그리기 (테두리)
    margin = size // 10
    draw.ellipse([margin, margin, size - margin, size - margin],
                 fill='#667eea', outline='white', width=size//20)

    # 텍스트 추가
    try:
        # 기본 폰트 사용
        font_size = size // 3
        # Windows 기본 폰트 경로들
        font_paths = [
            'C:\\Windows\\Fonts\\malgun.ttf',  # 맑은 고딕
            'C:\\Windows\\Fonts\\gulim.ttc',   # 굴림
            'C:\\Windows\\Fonts\\arial.ttf',   # Arial
        ]

        font = None
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    font = ImageFont.truetype(font_path, font_size)
                    break
                except:
                    continue

        if font is None:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()

    # "업무" 텍스트
    text = "업무"

    # 텍스트 중앙 배치
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - size // 20

    draw.text((x, y), text, fill='white', font=font)

    # 저장
    img.save(filename, 'PNG')
    print(f'{filename} 생성 완료')

# 아이콘 생성
os.makedirs('static', exist_ok=True)
create_icon(192, 'static/icon-192.png')
create_icon(512, 'static/icon-512.png')

print('모든 아이콘 생성 완료!')

"""
테스트 데이터 100개를 엑셀 파일로 생성하는 스크립트
"""
import pandas as pd
import random
import sqlite3

# 테스트 데이터 생성
def create_test_data():
    # DB에서 사용자 목록 가져오기 (관리자 제외, CRM파트 및 온라인파트만)
    conn = sqlite3.connect('crm.db')
    cursor = conn.cursor()
    cursor.execute("SELECT username FROM users WHERE team IN ('CRM파트', '온라인파트') ORDER BY username")
    valid_users = [row[0] for row in cursor.fetchall()]
    conn.close()

    print(f"[OK] DB에서 {len(valid_users)}명의 배정 가능한 사용자를 가져왔습니다.")

    # 테스트용 잘못된 사용자 이름 (DB에 없는 이름)
    invalid_users = ["존재하지않음", "테스트유저", "없는사람"]

    # 샘플 제목 템플릿
    title_templates = [
        "고객 문의 응대 - {}",
        "보고서 작성 - {}",
        "데이터 분석 요청 - {}",
        "시스템 점검 - {}",
        "회의 준비 - {}",
        "프로젝트 기획 - {}",
        "고객 미팅 - {}",
        "제안서 작성 - {}",
        "계약서 검토 - {}",
        "견적서 발송 - {}",
        "마케팅 자료 제작 - {}",
        "SNS 콘텐츠 작성 - {}",
        "이메일 답변 - {}",
        "제품 상담 - {}",
        "클레임 처리 - {}",
        "정산 확인 - {}",
        "재고 관리 - {}",
        "배송 조회 - {}",
        "A/S 접수 - {}",
        "품질 검사 - {}"
    ]

    # 샘플 내용 템플릿
    content_templates = [
        "{}님 요청사항을 확인하고 처리해주세요.",
        "{}와 관련된 자료를 정리하여 제출 부탁드립니다.",
        "{}에 대한 검토 후 피드백 부탁드립니다.",
        "{}건에 대해 고객 응대 완료 필요합니다.",
        "{}관련 업무를 오늘까지 완료해주세요.",
        "{}에 대한 상세 분석 리포트 작성 요망.",
        "{}사항을 확인하고 즉시 보고 바랍니다.",
        "{}문제 해결을 위한 조치를 취해주세요.",
        "{}일정에 맞춰 진행 부탁드립니다.",
        "{}내용을 검토하고 승인 요청 바랍니다."
    ]

    # 샘플 키워드
    keywords = [
        "신규", "긴급", "우선", "일반", "재요청", "추가", "수정", "확인", "점검", "개선",
        "프로모션", "이벤트", "캠페인", "상담", "처리", "검토", "승인", "발송", "제작", "분석"
    ]

    # 100개 데이터 생성
    data = []
    assigned_count = 0
    unassigned_count = 0
    invalid_count = 0

    for i in range(1, 101):
        title_template = random.choice(title_templates)
        content_template = random.choice(content_templates)
        keyword = random.choice(keywords)

        title = title_template.format(keyword + f" {i}번")
        content = content_template.format(keyword)

        # 대상 결정 (50% 배정, 40% 미배정, 10% 잘못된 이름)
        rand = random.random()
        if rand < 0.5:  # 50% - 유효한 사용자에게 배정
            assigned_to = random.choice(valid_users)
            assigned_count += 1
        elif rand < 0.9:  # 40% - 미배정 (빈 값)
            assigned_to = ""
            unassigned_count += 1
        else:  # 10% - 잘못된 사용자 이름 (자동으로 미배정되어야 함)
            assigned_to = random.choice(invalid_users)
            invalid_count += 1

        data.append({
            '대상': assigned_to,
            '제목': title,
            '내용': content
        })

    # DataFrame 생성
    df = pd.DataFrame(data)

    # 엑셀 파일로 저장
    output_file = 'test_data_100.xlsx'
    df.to_excel(output_file, index=False, engine='openpyxl')

    print(f"[OK] 테스트 데이터 100개가 '{output_file}'로 저장되었습니다.")
    print(f"\n샘플 데이터 미리보기:")
    print("=" * 80)
    print(df.head(10).to_string(index=False))
    print("=" * 80)
    print(f"\n총 {len(df)}개의 테스트 데이터가 생성되었습니다.")

    print(f"\n데이터 통계:")
    print(f"- 유효한 사용자에게 자동 배정: {assigned_count}개")
    print(f"- 미배정 (빈 값): {unassigned_count}개")
    print(f"- 잘못된 사용자 이름 (자동 미배정 예정): {invalid_count}개")
    print(f"\n배정률: {assigned_count}%, 미배정률: {unassigned_count + invalid_count}%")

    print(f"\n사용 방법:")
    print(f"1. 관리자 페이지로 이동")
    print(f"2. '일괄 작업' 섹션에서 '{output_file}' 파일 선택")
    print(f"3. '업로드' 버튼 클릭")

if __name__ == '__main__':
    create_test_data()

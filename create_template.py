"""
일괄 업로드 양식 파일 생성 스크립트
"""
import pandas as pd

# 양식 데이터 생성 (예시 포함)
template_data = [
    {
        '대상': '김미정',
        '제목': '고객 A사 상담 진행',
        '내용': '고객 A사의 신규 계약 건에 대해 상담을 진행해주세요.'
    },
    {
        '대상': '',
        '제목': '월간 보고서 작성',
        '내용': '이번 달 실적에 대한 보고서를 작성해주세요. (미배정 상태로 등록)'
    },
    {
        '대상': '이연석',
        '제목': '프로모션 기획안 검토',
        '내용': '신규 프로모션에 대한 기획안을 검토하고 피드백 부탁드립니다.'
    },
    {
        '대상': '',
        '제목': '',
        '내용': ''
    }
]

# DataFrame 생성
df = pd.DataFrame(template_data)

# 엑셀 파일로 저장
output_file = 'bulk_upload_template.xlsx'
df.to_excel(output_file, index=False, engine='openpyxl')

print(f"[OK] 일괄 업로드 양식 파일이 '{output_file}'로 생성되었습니다.")
print(f"\n양식 설명:")
print("=" * 80)
print("컬럼 구조: 대상 | 제목 | 내용")
print()
print("- 대상: 담당자 이름 (비어있으면 미배정, DB에 없는 이름도 미배정)")
print("- 제목: 할일 제목 (필수)")
print("- 내용: 할일 내용 (필수)")
print()
print("예시:")
print("  대상='김미정', 제목='고객 상담', 내용='...' → 김미정에게 자동 배정")
print("  대상='', 제목='보고서 작성', 내용='...' → 미배정 상태로 등록")
print("  대상='존재안함', 제목='업무', 내용='...' → DB에 없는 이름이므로 미배정")
print("=" * 80)
print(f"\n파일 위치: {output_file}")

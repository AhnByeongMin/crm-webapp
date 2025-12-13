"""
Swagger/OpenAPI 설정
API 문서화를 위한 flasgger 설정
"""
from __future__ import annotations

# Swagger UI 설정
SWAGGER_CONFIG = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,  # 모든 라우트 포함
            "model_filter": lambda tag: True,  # 모든 모델 포함
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/api/docs/"
}

# OpenAPI 스펙 템플릿
SWAGGER_TEMPLATE = {
    "swagger": "2.0",
    "info": {
        "title": "하루CRM API",
        "description": """
## 개요
하루CRM 시스템의 REST API 문서입니다.

## 인증
- 대부분의 API는 로그인 세션이 필요합니다.
- localhost에서는 자동으로 관리자 권한이 부여됩니다.
- 외부 접속 시 `/login` 페이지에서 로그인 후 세션 쿠키로 인증합니다.

## 권한 레벨
- **관리자**: 모든 API 접근 가능
- **팀장**: 팀 관련 데이터 접근 가능
- **상담사**: 본인 할당 데이터만 접근 가능

## Rate Limiting
API 호출은 Rate Limiting이 적용됩니다:
- 일반 API: 분당 200회
- 로그인: 5분당 10회
- 파일 업로드: 분당 20회
        """,
        "version": "1.0.0",
        "contact": {
            "name": "하루CRM 개발팀",
            "email": "dev@harucrm.com"
        }
    },
    "host": "",  # 요청 Host 사용
    "basePath": "/",
    "schemes": ["https", "http"],
    "securityDefinitions": {
        "session": {
            "type": "apiKey",
            "name": "session",
            "in": "cookie",
            "description": "Flask 세션 쿠키"
        }
    },
    "security": [{"session": []}],
    "tags": [
        {
            "name": "인증",
            "description": "로그인/로그아웃 관련 API"
        },
        {
            "name": "할일(Task)",
            "description": "할일 목록 관리 API"
        },
        {
            "name": "채팅",
            "description": "채팅 및 메시지 관리 API"
        },
        {
            "name": "프로모션",
            "description": "프로모션 관리 API"
        },
        {
            "name": "리마인더",
            "description": "리마인더/알림 관리 API"
        },
        {
            "name": "사용자",
            "description": "사용자 관리 API (관리자 전용)"
        },
        {
            "name": "팀",
            "description": "팀 관리 API"
        },
        {
            "name": "푸시알림",
            "description": "웹 푸시 알림 API"
        },
        {
            "name": "시스템",
            "description": "시스템 정보 및 설정 API"
        },
        {
            "name": "파일",
            "description": "파일 업로드/다운로드 API"
        }
    ],
    "definitions": {
        "Error": {
            "type": "object",
            "properties": {
                "error": {"type": "string", "description": "에러 메시지"},
                "success": {"type": "boolean", "default": False}
            }
        },
        "Success": {
            "type": "object",
            "properties": {
                "success": {"type": "boolean", "default": True},
                "message": {"type": "string", "description": "성공 메시지"}
            }
        },
        "Task": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "할일 ID"},
                "title": {"type": "string", "description": "제목"},
                "content": {"type": "string", "description": "내용"},
                "status": {"type": "string", "enum": ["진행중", "완료", "보류"], "description": "상태"},
                "priority": {"type": "string", "enum": ["높음", "중간", "낮음"], "description": "우선순위"},
                "assigned_to": {"type": "string", "description": "담당자"},
                "due_date": {"type": "string", "format": "date", "description": "마감일"},
                "created_at": {"type": "string", "format": "date-time", "description": "생성일시"},
                "updated_at": {"type": "string", "format": "date-time", "description": "수정일시"}
            }
        },
        "User": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "사용자 ID"},
                "username": {"type": "string", "description": "사용자명"},
                "role": {"type": "string", "enum": ["관리자", "팀장", "상담사"], "description": "역할"},
                "team": {"type": "string", "description": "소속 팀"},
                "active": {"type": "boolean", "description": "활성 상태"}
            }
        },
        "Chat": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "채팅방 ID"},
                "name": {"type": "string", "description": "채팅방 이름"},
                "created_by": {"type": "string", "description": "생성자"},
                "created_at": {"type": "string", "format": "date-time", "description": "생성일시"},
                "message_count": {"type": "integer", "description": "메시지 수"},
                "last_message": {"type": "string", "description": "마지막 메시지"}
            }
        },
        "Message": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "메시지 ID"},
                "chat_id": {"type": "string", "description": "채팅방 ID"},
                "sender": {"type": "string", "description": "발신자"},
                "content": {"type": "string", "description": "메시지 내용"},
                "created_at": {"type": "string", "format": "date-time", "description": "전송일시"},
                "file_url": {"type": "string", "description": "첨부파일 URL"}
            }
        },
        "Promotion": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "프로모션 ID"},
                "title": {"type": "string", "description": "제목"},
                "description": {"type": "string", "description": "설명"},
                "start_date": {"type": "string", "format": "date", "description": "시작일"},
                "end_date": {"type": "string", "format": "date", "description": "종료일"},
                "status": {"type": "string", "description": "상태"}
            }
        },
        "Reminder": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "리마인더 ID"},
                "title": {"type": "string", "description": "제목"},
                "content": {"type": "string", "description": "내용"},
                "remind_at": {"type": "string", "format": "date-time", "description": "알림 시간"},
                "is_completed": {"type": "boolean", "description": "완료 여부"}
            }
        },
        "Team": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "팀 ID"},
                "name": {"type": "string", "description": "팀 이름"},
                "member_count": {"type": "integer", "description": "팀원 수"}
            }
        },
        "NavCounts": {
            "type": "object",
            "properties": {
                "pending_tasks": {"type": "integer", "description": "대기중인 할일 수"},
                "unread_chats": {"type": "integer", "description": "읽지 않은 채팅 수"}
            }
        },
        "NotificationSettings": {
            "type": "object",
            "properties": {
                "reminder_time": {"type": "integer", "description": "알림 사전 시간 (분)"},
                "repeat_enabled": {"type": "boolean", "description": "반복 알림 여부"},
                "repeat_interval": {"type": "integer", "description": "반복 간격 (분)"},
                "daily_summary_enabled": {"type": "boolean", "description": "일일 요약 활성화"},
                "daily_summary_time": {"type": "string", "description": "일일 요약 시간 (HH:MM)"}
            }
        }
    }
}

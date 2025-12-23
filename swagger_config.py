"""
Swagger/OpenAPI 설정
API 문서화를 위한 flasgger 설정
"""
from __future__ import annotations

# Swagger UI 설정
# 참고: Nginx 프록시 뒤에서 /crm-webapp/ 경로로 접근
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
    "swagger_ui": False,  # 기본 UI 비활성화 (커스텀 UI 사용)
    "specs_route": "/api/docs/",
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
- **상담사**: 본인 할당 데이터만 접근 가능

## Rate Limiting
API 호출은 Rate Limiting이 적용됩니다:
- 일반 API: 분당 200회
- 로그인 GET: 분당 30회
- 로그인 POST: 5분당 10회
- 파일 업로드: 분당 20회
- 검색 API: 분당 60회

## 최근 업데이트 (2025-12)
- **개인 메모 API 추가** (폴더, 메모 CRUD, 하위 폴더 지원)
- 사용자 설정 API 추가 (채팅 푸시 알림 내용 표시 설정)
- 채팅방 관리 API 추가 (제목 변경, 멤버 관리, 나가기)
- 알림 설정 API 추가 (예약 알림, 일일 요약)
- 푸시 알림 테스트 API 추가
- Service Worker 버전 조회 API 추가
        """,
        "version": "1.2.0",
        "contact": {
            "name": "하루CRM 개발팀",
            "email": "dev@harucrm.com"
        }
    },
    "host": "",  # 요청 Host 사용
    "basePath": "/crm-webapp",  # Nginx 프록시 경로
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
            "name": "채팅방 관리",
            "description": "채팅방 설정, 멤버 관리 API"
        },
        {
            "name": "프로모션",
            "description": "프로모션 관리 API"
        },
        {
            "name": "리마인더",
            "description": "예약/리마인더 관리 API"
        },
        {
            "name": "사용자",
            "description": "사용자 관리 API (관리자 전용)"
        },
        {
            "name": "사용자 설정",
            "description": "개인 설정 관리 API"
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
            "name": "알림 설정",
            "description": "알림 시간 및 반복 설정 API"
        },
        {
            "name": "시스템",
            "description": "시스템 정보 및 설정 API"
        },
        {
            "name": "파일",
            "description": "파일 업로드/다운로드 API"
        },
        {
            "name": "메모",
            "description": "개인 메모 관리 API"
        },
        {
            "name": "메모 폴더",
            "description": "메모 폴더 관리 API (하위 폴더 지원)"
        }
    ],
    "paths": {
        "/api/version": {
            "get": {
                "tags": ["시스템"],
                "summary": "API 버전 정보 조회",
                "responses": {
                    "200": {
                        "description": "버전 정보",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "version": {"type": "string"},
                                "name": {"type": "string"}
                            }
                        }
                    }
                }
            }
        },
        "/api/sw-version": {
            "get": {
                "tags": ["시스템"],
                "summary": "Service Worker 버전 정보 조회",
                "description": "클라이언트 자동 업데이트를 위한 SW 버전 정보",
                "responses": {
                    "200": {
                        "description": "SW 버전 정보",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "version": {"type": "string", "description": "주 버전"},
                                "timestamp": {"type": "integer", "description": "파일 수정 시간"},
                                "hash": {"type": "string", "description": "버전 해시"}
                            }
                        }
                    }
                }
            }
        },
        "/api/nav-counts": {
            "get": {
                "tags": ["시스템"],
                "summary": "네비게이션 카운트 조회",
                "description": "읽지 않은 채팅, 대기중인 할일 등의 개수",
                "responses": {
                    "200": {
                        "description": "카운트 정보",
                        "schema": {"$ref": "#/definitions/NavCounts"}
                    }
                }
            }
        },
        "/api/items": {
            "get": {
                "tags": ["할일(Task)"],
                "summary": "할일 목록 조회",
                "parameters": [
                    {"name": "status", "in": "query", "type": "string", "description": "상태 필터"},
                    {"name": "priority", "in": "query", "type": "string", "description": "우선순위 필터"},
                    {"name": "assigned_to", "in": "query", "type": "string", "description": "담당자 필터"}
                ],
                "responses": {
                    "200": {
                        "description": "할일 목록",
                        "schema": {
                            "type": "array",
                            "items": {"$ref": "#/definitions/Task"}
                        }
                    }
                }
            },
            "post": {
                "tags": ["할일(Task)"],
                "summary": "새 할일 생성",
                "parameters": [
                    {
                        "name": "body",
                        "in": "body",
                        "schema": {"$ref": "#/definitions/TaskInput"}
                    }
                ],
                "responses": {
                    "201": {"description": "생성된 할일", "schema": {"$ref": "#/definitions/Task"}},
                    "400": {"description": "잘못된 요청"}
                }
            }
        },
        "/api/items/{item_id}": {
            "put": {
                "tags": ["할일(Task)"],
                "summary": "할일 수정",
                "parameters": [
                    {"name": "item_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/TaskInput"}}
                ],
                "responses": {
                    "200": {"description": "수정된 할일"},
                    "404": {"description": "할일을 찾을 수 없음"}
                }
            },
            "delete": {
                "tags": ["할일(Task)"],
                "summary": "할일 삭제",
                "parameters": [
                    {"name": "item_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {
                    "200": {"description": "삭제 성공"},
                    "404": {"description": "할일을 찾을 수 없음"}
                }
            }
        },
        "/api/items/{item_id}/status": {
            "put": {
                "tags": ["할일(Task)"],
                "summary": "할일 상태 변경",
                "parameters": [
                    {"name": "item_id", "in": "path", "type": "integer", "required": True, "description": "할일 ID"},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"status": {"type": "string", "enum": ["진행중", "완료", "보류"]}}
                    }}
                ],
                "responses": {
                    "200": {"description": "상태 변경됨", "schema": {"$ref": "#/definitions/Success"}},
                    "404": {"description": "할일을 찾을 수 없음"}
                }
            }
        },
        "/api/items/{item_id}/unassign": {
            "post": {
                "tags": ["할일(Task)"],
                "summary": "할일 담당자 해제",
                "description": "할일의 담당자 지정을 해제합니다",
                "parameters": [
                    {"name": "item_id", "in": "path", "type": "integer", "required": True, "description": "할일 ID"}
                ],
                "responses": {
                    "200": {"description": "담당자 해제됨", "schema": {"$ref": "#/definitions/Success"}},
                    "404": {"description": "할일을 찾을 수 없음"}
                }
            }
        },
        "/api/items/{item_id}/assign": {
            "put": {
                "tags": ["할일(Task)"],
                "summary": "할일 담당자 지정",
                "parameters": [
                    {"name": "item_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"assigned_to": {"type": "string"}}
                    }}
                ],
                "responses": {"200": {"description": "담당자 지정됨"}}
            }
        },
        "/api/items/bulk-assign": {
            "post": {
                "tags": ["할일(Task)"],
                "summary": "할일 일괄 담당자 지정",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {
                            "item_ids": {"type": "array", "items": {"type": "integer"}},
                            "assigned_to": {"type": "string"}
                        }
                    }}
                ],
                "responses": {"200": {"description": "일괄 지정 완료"}}
            }
        },
        "/api/items/bulk-upload": {
            "post": {
                "tags": ["할일(Task)"],
                "summary": "할일 일괄 업로드 (Excel)",
                "consumes": ["multipart/form-data"],
                "parameters": [
                    {"name": "file", "in": "formData", "type": "file", "required": True}
                ],
                "responses": {
                    "200": {"description": "업로드 성공"},
                    "400": {"description": "잘못된 파일 형식"}
                }
            }
        },
        "/api/chats": {
            "get": {
                "tags": ["채팅"],
                "summary": "채팅방 목록 조회",
                "responses": {
                    "200": {
                        "description": "채팅방 목록",
                        "schema": {"type": "array", "items": {"$ref": "#/definitions/Chat"}}
                    }
                }
            },
            "post": {
                "tags": ["채팅"],
                "summary": "새 채팅방 생성",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "participants": {"type": "array", "items": {"type": "string"}},
                            "is_group": {"type": "boolean", "default": False}
                        }
                    }}
                ],
                "responses": {"201": {"description": "채팅방 생성됨"}}
            }
        },
        "/api/chats/all": {
            "get": {
                "tags": ["채팅"],
                "summary": "전체 채팅방 목록 조회 (관리자)",
                "description": "관리자 전용. 시스템의 모든 채팅방 목록을 조회합니다.",
                "responses": {
                    "200": {
                        "description": "전체 채팅방 목록",
                        "schema": {
                            "type": "array",
                            "items": {"$ref": "#/definitions/Chat"}
                        }
                    },
                    "403": {"description": "권한 없음 (관리자만 가능)"}
                }
            }
        },
        "/api/chats/{chat_id}": {
            "delete": {
                "tags": ["채팅"],
                "summary": "채팅방 삭제",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True}
                ],
                "responses": {"200": {"description": "삭제됨"}}
            }
        },
        "/api/chats/{chat_id}/messages": {
            "get": {
                "tags": ["채팅"],
                "summary": "채팅 메시지 조회",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True},
                    {"name": "before_id", "in": "query", "type": "integer", "description": "이 ID 이전 메시지"},
                    {"name": "limit", "in": "query", "type": "integer", "default": 50}
                ],
                "responses": {
                    "200": {"description": "메시지 목록", "schema": {"type": "array", "items": {"$ref": "#/definitions/Message"}}}
                }
            }
        },
        "/api/chats/{chat_id}/search": {
            "get": {
                "tags": ["채팅"],
                "summary": "채팅 메시지 검색",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True},
                    {"name": "q", "in": "query", "type": "string", "required": True, "description": "검색어"},
                    {"name": "date", "in": "query", "type": "string", "description": "날짜 필터 (YYYY-MM-DD)"}
                ],
                "responses": {"200": {"description": "검색 결과"}}
            }
        },
        "/api/chats/{chat_id}/dates": {
            "get": {
                "tags": ["채팅"],
                "summary": "메시지가 있는 날짜 목록 조회",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True}
                ],
                "responses": {"200": {"description": "날짜 목록"}}
            }
        },
        "/api/chats/{chat_id}/messages/context/{msg_id}": {
            "get": {
                "tags": ["채팅"],
                "summary": "특정 메시지 전후 컨텍스트 조회",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True},
                    {"name": "msg_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {"200": {"description": "메시지 컨텍스트"}}
            }
        },
        "/api/chats/{chat_id}/settings": {
            "get": {
                "tags": ["채팅방 관리"],
                "summary": "채팅방 설정 및 권한 정보 조회",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True}
                ],
                "responses": {
                    "200": {"description": "채팅방 설정", "schema": {"$ref": "#/definitions/ChatSettings"}},
                    "404": {"description": "채팅방을 찾을 수 없음"}
                }
            }
        },
        "/api/chats/{chat_id}/title": {
            "put": {
                "tags": ["채팅방 관리"],
                "summary": "채팅방 제목 변경",
                "description": "그룹채팅만 가능, owner/admin 권한 필요",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"title": {"type": "string", "maxLength": 100}}
                    }}
                ],
                "responses": {
                    "200": {"description": "제목 변경됨"},
                    "400": {"description": "잘못된 요청"},
                    "403": {"description": "권한 없음"}
                }
            }
        },
        "/api/chats/{chat_id}/mute": {
            "post": {
                "tags": ["채팅방 관리"],
                "summary": "채팅방 알림 토글",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True}
                ],
                "responses": {
                    "200": {
                        "description": "알림 상태 변경됨",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "success": {"type": "boolean"},
                                "muted": {"type": "boolean"}
                            }
                        }
                    }
                }
            }
        },
        "/api/chats/{chat_id}/participants": {
            "post": {
                "tags": ["채팅방 관리"],
                "summary": "채팅방에 멤버 추가",
                "description": "그룹채팅만, owner/admin 권한 필요",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"username": {"type": "string"}}
                    }}
                ],
                "responses": {
                    "200": {"description": "멤버 추가됨"},
                    "400": {"description": "잘못된 요청"},
                    "403": {"description": "권한 없음"}
                }
            }
        },
        "/api/chats/{chat_id}/participants/{target_username}": {
            "delete": {
                "tags": ["채팅방 관리"],
                "summary": "채팅방에서 멤버 내보내기",
                "description": "그룹채팅만, owner/admin 권한 필요",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True},
                    {"name": "target_username", "in": "path", "type": "string", "required": True}
                ],
                "responses": {
                    "200": {"description": "멤버 내보내기 완료"},
                    "403": {"description": "권한 없음"}
                }
            }
        },
        "/api/chats/{chat_id}/leave": {
            "post": {
                "tags": ["채팅방 관리"],
                "summary": "채팅방 나가기",
                "description": "그룹채팅, 1:1 채팅 모두 가능",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True}
                ],
                "responses": {
                    "200": {
                        "description": "채팅방 나가기 완료",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "success": {"type": "boolean"},
                                "message": {"type": "string"},
                                "deleted": {"type": "boolean", "description": "채팅방이 삭제되었는지"}
                            }
                        }
                    }
                }
            }
        },
        "/api/chats/{chat_id}/admin/{target_username}": {
            "put": {
                "tags": ["채팅방 관리"],
                "summary": "부방장 권한 설정/해제",
                "description": "owner만 가능",
                "parameters": [
                    {"name": "chat_id", "in": "path", "type": "string", "required": True},
                    {"name": "target_username", "in": "path", "type": "string", "required": True},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"is_admin": {"type": "boolean"}}
                    }}
                ],
                "responses": {"200": {"description": "권한 변경됨"}}
            }
        },
        "/api/search_users": {
            "get": {
                "tags": ["사용자"],
                "summary": "사용자 검색",
                "parameters": [
                    {"name": "q", "in": "query", "type": "string", "description": "검색어"}
                ],
                "responses": {
                    "200": {"description": "검색 결과", "schema": {"type": "array", "items": {"$ref": "#/definitions/User"}}}
                }
            }
        },
        "/api/promotions": {
            "get": {
                "tags": ["프로모션"],
                "summary": "프로모션 목록 조회",
                "parameters": [
                    {"name": "search", "in": "query", "type": "string"},
                    {"name": "category", "in": "query", "type": "string"},
                    {"name": "product_name", "in": "query", "type": "string"},
                    {"name": "channel", "in": "query", "type": "string"},
                    {"name": "promotion_name", "in": "query", "type": "string"}
                ],
                "responses": {
                    "200": {"description": "프로모션 목록", "schema": {"type": "array", "items": {"$ref": "#/definitions/Promotion"}}}
                }
            },
            "post": {
                "tags": ["프로모션"],
                "summary": "새 프로모션 생성 (관리자)",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/PromotionInput"}}
                ],
                "responses": {"201": {"description": "생성됨"}}
            }
        },
        "/api/promotions/{promo_id}": {
            "get": {
                "tags": ["프로모션"],
                "summary": "프로모션 상세 조회",
                "parameters": [
                    {"name": "promo_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {"200": {"description": "프로모션 상세"}}
            },
            "put": {
                "tags": ["프로모션"],
                "summary": "프로모션 수정 (관리자)",
                "parameters": [
                    {"name": "promo_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/PromotionInput"}}
                ],
                "responses": {"200": {"description": "수정됨"}}
            },
            "delete": {
                "tags": ["프로모션"],
                "summary": "프로모션 삭제 (관리자)",
                "parameters": [
                    {"name": "promo_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {"200": {"description": "삭제됨"}}
            }
        },
        "/api/promotions/filters": {
            "get": {
                "tags": ["프로모션"],
                "summary": "프로모션 필터 옵션 조회",
                "responses": {
                    "200": {
                        "description": "필터 옵션",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "categories": {"type": "array", "items": {"type": "string"}},
                                "products": {"type": "array", "items": {"type": "string"}},
                                "channels": {"type": "array", "items": {"type": "string"}},
                                "promotion_names": {"type": "array", "items": {"type": "string"}},
                                "category_products": {"type": "object"}
                            }
                        }
                    }
                }
            }
        },
        "/api/promotions/template": {
            "get": {
                "tags": ["프로모션"],
                "summary": "프로모션 업로드 템플릿 다운로드",
                "produces": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
                "responses": {"200": {"description": "Excel 템플릿 파일"}}
            }
        },
        "/api/promotions/bulk-upload": {
            "post": {
                "tags": ["프로모션"],
                "summary": "프로모션 일괄 업로드 (관리자)",
                "consumes": ["multipart/form-data"],
                "parameters": [
                    {"name": "file", "in": "formData", "type": "file", "required": True}
                ],
                "responses": {"200": {"description": "업로드 결과"}}
            }
        },
        "/api/promotions/bulk-save": {
            "post": {
                "tags": ["프로모션"],
                "summary": "일괄 업로드 데이터 저장 (관리자)",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {
                            "promotions": {"type": "array", "items": {"$ref": "#/definitions/PromotionInput"}}
                        }
                    }}
                ],
                "responses": {"200": {"description": "저장 완료"}}
            }
        },
        "/api/promotions/bulk-update": {
            "put": {
                "tags": ["프로모션"],
                "summary": "프로모션 일괄 수정 (관리자)",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {
                            "ids": {"type": "array", "items": {"type": "integer"}},
                            "updates": {"type": "object"}
                        }
                    }}
                ],
                "responses": {"200": {"description": "일괄 수정 완료"}}
            }
        },
        "/api/promotions/bulk-delete": {
            "delete": {
                "tags": ["프로모션"],
                "summary": "프로모션 일괄 삭제 (관리자)",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {
                            "ids": {"type": "array", "items": {"type": "integer"}}
                        }
                    }}
                ],
                "responses": {"200": {"description": "일괄 삭제 완료"}}
            }
        },
        "/api/reminders": {
            "get": {
                "tags": ["리마인더"],
                "summary": "예약 목록 조회",
                "parameters": [
                    {"name": "show_completed", "in": "query", "type": "boolean", "default": False}
                ],
                "responses": {
                    "200": {"description": "예약 목록", "schema": {"type": "array", "items": {"$ref": "#/definitions/Reminder"}}}
                }
            },
            "post": {
                "tags": ["리마인더"],
                "summary": "새 예약 생성",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/ReminderInput"}}
                ],
                "responses": {"201": {"description": "생성됨"}}
            }
        },
        "/api/reminders/{reminder_id}": {
            "put": {
                "tags": ["리마인더"],
                "summary": "예약 수정",
                "parameters": [
                    {"name": "reminder_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/ReminderInput"}}
                ],
                "responses": {"200": {"description": "수정됨"}}
            },
            "delete": {
                "tags": ["리마인더"],
                "summary": "예약 삭제",
                "parameters": [
                    {"name": "reminder_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {"200": {"description": "삭제됨"}}
            }
        },
        "/api/reminders/{reminder_id}/complete": {
            "patch": {
                "tags": ["리마인더"],
                "summary": "예약 완료 상태 토글",
                "description": "예약의 완료/미완료 상태를 토글합니다",
                "parameters": [
                    {"name": "reminder_id", "in": "path", "type": "integer", "required": True, "description": "예약 ID"}
                ],
                "responses": {
                    "200": {
                        "description": "상태 변경 성공",
                        "schema": {"$ref": "#/definitions/Success"}
                    },
                    "404": {"description": "예약을 찾을 수 없음"}
                }
            }
        },
        "/api/reminders/{reminder_id}/notify": {
            "post": {
                "tags": ["리마인더"],
                "summary": "예약 알림 발송 완료 표시",
                "description": "30분 전 알림이 발송되었음을 표시합니다",
                "parameters": [
                    {"name": "reminder_id", "in": "path", "type": "integer", "required": True, "description": "예약 ID"}
                ],
                "responses": {
                    "200": {"description": "알림 발송 완료 표시됨", "schema": {"$ref": "#/definitions/Success"}}
                }
            }
        },
        "/api/reminders/notifications": {
            "get": {
                "tags": ["리마인더"],
                "summary": "알림 대기 예약 목록 조회",
                "description": "30분 전 알림이 필요한 예약 목록을 조회합니다",
                "responses": {
                    "200": {
                        "description": "알림 대기 예약 목록",
                        "schema": {"type": "array", "items": {"$ref": "#/definitions/Reminder"}}
                    }
                }
            }
        },
        "/api/reminders/today": {
            "get": {
                "tags": ["리마인더"],
                "summary": "오늘 예약 목록 조회",
                "description": "오늘 날짜의 예약 목록을 조회합니다 (완료/미완료 모두 포함)",
                "responses": {
                    "200": {
                        "description": "오늘 예약 목록",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "reminders": {"type": "array", "items": {"$ref": "#/definitions/Reminder"}},
                                "count": {"type": "integer", "description": "예약 개수"}
                            }
                        }
                    }
                }
            }
        },
        "/api/reminders/banner-check": {
            "get": {
                "tags": ["리마인더"],
                "summary": "예약 배너 표시 여부 확인",
                "description": "다가오는 예약 또는 지난 미완료 예약이 있는지 확인합니다",
                "responses": {
                    "200": {
                        "description": "배너 정보",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "show_banner": {"type": "boolean", "description": "배너 표시 여부"},
                                "upcoming_reminder": {"$ref": "#/definitions/Reminder"},
                                "overdue_count": {"type": "integer", "description": "지난 미완료 예약 수"}
                            }
                        }
                    }
                }
            }
        },
        "/api/holidays": {
            "get": {
                "tags": ["시스템"],
                "summary": "공휴일 목록 조회",
                "parameters": [
                    {"name": "year", "in": "query", "type": "integer"},
                    {"name": "month", "in": "query", "type": "integer"}
                ],
                "responses": {"200": {"description": "공휴일 목록"}}
            }
        },
        "/api/user/settings": {
            "get": {
                "tags": ["사용자 설정"],
                "summary": "사용자 설정 조회",
                "description": "채팅 푸시 알림 내용 표시 등 개인 설정 조회",
                "responses": {
                    "200": {
                        "description": "사용자 설정",
                        "schema": {"$ref": "#/definitions/UserSettings"}
                    }
                }
            },
            "post": {
                "tags": ["사용자 설정"],
                "summary": "사용자 설정 저장",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/UserSettings"}}
                ],
                "responses": {"200": {"description": "설정 저장됨"}}
            }
        },
        "/api/change-password": {
            "post": {
                "tags": ["인증"],
                "summary": "비밀번호 변경",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {
                            "current_password": {"type": "string"},
                            "new_password": {"type": "string"}
                        }
                    }}
                ],
                "responses": {
                    "200": {"description": "비밀번호 변경됨"},
                    "400": {"description": "현재 비밀번호 불일치"}
                }
            }
        },
        "/api/users": {
            "get": {
                "tags": ["사용자"],
                "summary": "사용자 목록 조회 (관리자)",
                "responses": {
                    "200": {"description": "사용자 목록", "schema": {"type": "array", "items": {"$ref": "#/definitions/User"}}}
                }
            },
            "post": {
                "tags": ["사용자"],
                "summary": "새 사용자 생성 (관리자)",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/UserInput"}}
                ],
                "responses": {"201": {"description": "생성됨"}}
            }
        },
        "/api/users/{user_id}": {
            "delete": {
                "tags": ["사용자"],
                "summary": "사용자 삭제 (관리자)",
                "parameters": [
                    {"name": "user_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {"200": {"description": "삭제됨"}}
            }
        },
        "/api/users/{user_id}/status": {
            "patch": {
                "tags": ["사용자"],
                "summary": "사용자 활성 상태 변경 (관리자)",
                "parameters": [
                    {"name": "user_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"active": {"type": "boolean"}}
                    }}
                ],
                "responses": {"200": {"description": "상태 변경됨"}}
            }
        },
        "/api/users/{user_id}/team": {
            "patch": {
                "tags": ["사용자"],
                "summary": "사용자 팀 변경 (관리자)",
                "parameters": [
                    {"name": "user_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"team": {"type": "string"}}
                    }}
                ],
                "responses": {"200": {"description": "팀 변경됨"}}
            }
        },
        "/api/users/{user_id}/role": {
            "patch": {
                "tags": ["사용자"],
                "summary": "사용자 역할 변경 (관리자)",
                "parameters": [
                    {"name": "user_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"role": {"type": "string", "enum": ["관리자", "팀장", "상담사"]}}
                    }}
                ],
                "responses": {"200": {"description": "역할 변경됨"}}
            }
        },
        "/api/users/{user_id}/reset-password": {
            "post": {
                "tags": ["사용자"],
                "summary": "비밀번호 초기화 (관리자)",
                "parameters": [
                    {"name": "user_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {"200": {"description": "비밀번호 초기화됨"}}
            }
        },
        "/api/users/non-admin": {
            "get": {
                "tags": ["사용자"],
                "summary": "관리자가 아닌 사용자 목록",
                "responses": {"200": {"description": "사용자 목록"}}
            }
        },
        "/api/users/by-team": {
            "get": {
                "tags": ["사용자"],
                "summary": "팀별 사용자 목록",
                "parameters": [
                    {"name": "team", "in": "query", "type": "string"}
                ],
                "responses": {"200": {"description": "사용자 목록"}}
            }
        },
        "/api/users/with-team": {
            "get": {
                "tags": ["사용자"],
                "summary": "팀 정보 포함 사용자 목록",
                "responses": {"200": {"description": "사용자 목록"}}
            }
        },
        "/api/teams": {
            "get": {
                "tags": ["팀"],
                "summary": "팀 목록 조회",
                "responses": {
                    "200": {"description": "팀 목록", "schema": {"type": "array", "items": {"$ref": "#/definitions/Team"}}}
                }
            }
        },
        "/api/push/vapid-public-key": {
            "get": {
                "tags": ["푸시알림"],
                "summary": "VAPID 공개키 조회",
                "description": "웹 푸시 구독에 필요한 공개키",
                "responses": {
                    "200": {
                        "description": "공개키",
                        "schema": {
                            "type": "object",
                            "properties": {"publicKey": {"type": "string"}}
                        }
                    }
                }
            }
        },
        "/api/push/subscribe": {
            "post": {
                "tags": ["푸시알림"],
                "summary": "푸시 알림 구독",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/PushSubscription"}}
                ],
                "responses": {"200": {"description": "구독 완료"}}
            }
        },
        "/api/push/unsubscribe": {
            "post": {
                "tags": ["푸시알림"],
                "summary": "푸시 알림 구독 해제",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"endpoint": {"type": "string"}}
                    }}
                ],
                "responses": {"200": {"description": "구독 해제됨"}}
            }
        },
        "/api/push/test": {
            "post": {
                "tags": ["푸시알림"],
                "summary": "푸시 알림 테스트",
                "description": "현재 사용자에게 테스트 푸시 알림 발송",
                "responses": {
                    "200": {
                        "description": "발송 결과",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "success": {"type": "integer"},
                                "failed": {"type": "integer"},
                                "errors": {"type": "array", "items": {"type": "string"}}
                            }
                        }
                    }
                }
            }
        },
        "/api/notification-settings": {
            "get": {
                "tags": ["알림 설정"],
                "summary": "알림 설정 조회",
                "responses": {
                    "200": {"description": "알림 설정", "schema": {"$ref": "#/definitions/NotificationSettings"}}
                }
            },
            "post": {
                "tags": ["알림 설정"],
                "summary": "알림 설정 저장",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/NotificationSettings"}}
                ],
                "responses": {"200": {"description": "설정 저장됨"}}
            }
        },
        "/api/notification-settings/test-daily-summary": {
            "post": {
                "tags": ["알림 설정"],
                "summary": "일일 요약 알림 테스트",
                "description": "현재 사용자에게 일일 요약 테스트 알림 발송",
                "responses": {"200": {"description": "발송 결과"}}
            }
        },
        "/api/memos/folders": {
            "get": {
                "tags": ["메모 폴더"],
                "summary": "폴더 목록 조회",
                "description": "현재 사용자의 메모 폴더 목록 조회 (최상위 폴더만)",
                "responses": {
                    "200": {
                        "description": "폴더 목록",
                        "schema": {"type": "array", "items": {"$ref": "#/definitions/MemoFolder"}}
                    }
                }
            },
            "post": {
                "tags": ["메모 폴더"],
                "summary": "새 폴더 생성",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "required": ["name"],
                        "properties": {
                            "name": {"type": "string", "description": "폴더 이름"},
                            "parent_id": {"type": "integer", "description": "부모 폴더 ID (null이면 최상위)"}
                        }
                    }}
                ],
                "responses": {
                    "201": {"description": "폴더 생성됨"},
                    "400": {"description": "잘못된 요청"}
                }
            }
        },
        "/api/memos/folders/tree": {
            "get": {
                "tags": ["메모 폴더"],
                "summary": "전체 폴더 트리 조회",
                "description": "재귀적으로 모든 폴더를 트리 구조로 조회 (depth 포함)",
                "responses": {
                    "200": {
                        "description": "폴더 트리",
                        "schema": {"type": "array", "items": {"$ref": "#/definitions/MemoFolderTree"}}
                    }
                }
            }
        },
        "/api/memos/folders/{folder_id}": {
            "put": {
                "tags": ["메모 폴더"],
                "summary": "폴더 이름 수정",
                "parameters": [
                    {"name": "folder_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"name": {"type": "string"}}
                    }}
                ],
                "responses": {
                    "200": {"description": "수정됨"},
                    "404": {"description": "폴더를 찾을 수 없음"}
                }
            },
            "delete": {
                "tags": ["메모 폴더"],
                "summary": "폴더 삭제",
                "description": "폴더와 하위 폴더, 포함된 메모 모두 삭제",
                "parameters": [
                    {"name": "folder_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {
                    "200": {"description": "삭제됨"},
                    "404": {"description": "폴더를 찾을 수 없음"}
                }
            }
        },
        "/api/memos/folders/{folder_id}/move": {
            "put": {
                "tags": ["메모 폴더"],
                "summary": "폴더 이동",
                "description": "폴더를 다른 부모 폴더로 이동 (순환 참조 방지)",
                "parameters": [
                    {"name": "folder_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"parent_id": {"type": "integer", "description": "새 부모 폴더 ID (null이면 최상위로)"}}
                    }}
                ],
                "responses": {
                    "200": {"description": "이동됨"},
                    "400": {"description": "순환 참조 오류"}
                }
            }
        },
        "/api/memos": {
            "get": {
                "tags": ["메모"],
                "summary": "메모 목록 조회",
                "parameters": [
                    {"name": "folder_id", "in": "query", "type": "string", "description": "폴더 ID (null=전체, root=미분류, 숫자=특정 폴더)"}
                ],
                "responses": {
                    "200": {
                        "description": "메모 목록",
                        "schema": {"type": "array", "items": {"$ref": "#/definitions/Memo"}}
                    }
                }
            },
            "post": {
                "tags": ["메모"],
                "summary": "새 메모 생성",
                "parameters": [
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/MemoInput"}}
                ],
                "responses": {
                    "201": {"description": "메모 생성됨", "schema": {"$ref": "#/definitions/Memo"}}
                }
            }
        },
        "/api/memos/{memo_id}": {
            "get": {
                "tags": ["메모"],
                "summary": "메모 상세 조회",
                "parameters": [
                    {"name": "memo_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {
                    "200": {"description": "메모 상세", "schema": {"$ref": "#/definitions/Memo"}},
                    "404": {"description": "메모를 찾을 수 없음"}
                }
            },
            "put": {
                "tags": ["메모"],
                "summary": "메모 수정",
                "parameters": [
                    {"name": "memo_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {"$ref": "#/definitions/MemoInput"}}
                ],
                "responses": {
                    "200": {"description": "수정됨"},
                    "404": {"description": "메모를 찾을 수 없음"}
                }
            },
            "delete": {
                "tags": ["메모"],
                "summary": "메모 삭제",
                "parameters": [
                    {"name": "memo_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {
                    "200": {"description": "삭제됨"},
                    "404": {"description": "메모를 찾을 수 없음"}
                }
            }
        },
        "/api/memos/{memo_id}/move": {
            "put": {
                "tags": ["메모"],
                "summary": "메모 이동",
                "description": "메모를 다른 폴더로 이동",
                "parameters": [
                    {"name": "memo_id", "in": "path", "type": "integer", "required": True},
                    {"name": "body", "in": "body", "schema": {
                        "type": "object",
                        "properties": {"folder_id": {"type": "integer", "description": "대상 폴더 ID (null이면 미분류)"}}
                    }}
                ],
                "responses": {"200": {"description": "이동됨"}}
            }
        },
        "/api/memos/{memo_id}/pin": {
            "patch": {
                "tags": ["메모"],
                "summary": "메모 고정/해제",
                "description": "메모의 고정 상태를 토글합니다",
                "parameters": [
                    {"name": "memo_id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {
                    "200": {
                        "description": "고정 상태 변경됨",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "success": {"type": "boolean"},
                                "is_pinned": {"type": "boolean"}
                            }
                        }
                    }
                }
            }
        },
        "/api/memos/search": {
            "get": {
                "tags": ["메모"],
                "summary": "메모 검색",
                "parameters": [
                    {"name": "q", "in": "query", "type": "string", "required": True, "description": "검색어"}
                ],
                "responses": {
                    "200": {
                        "description": "검색 결과",
                        "schema": {"type": "array", "items": {"$ref": "#/definitions/Memo"}}
                    }
                }
            }
        },
        "/api/memos/stats": {
            "get": {
                "tags": ["메모"],
                "summary": "메모 통계 조회",
                "responses": {
                    "200": {
                        "description": "통계 정보",
                        "schema": {"$ref": "#/definitions/MemoStats"}
                    }
                }
            }
        }
    },
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
        "TaskInput": {
            "type": "object",
            "required": ["title"],
            "properties": {
                "title": {"type": "string", "description": "제목"},
                "content": {"type": "string", "description": "내용"},
                "status": {"type": "string", "enum": ["진행중", "완료", "보류"]},
                "priority": {"type": "string", "enum": ["높음", "중간", "낮음"]},
                "assigned_to": {"type": "string"},
                "due_date": {"type": "string", "format": "date"}
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
        "UserInput": {
            "type": "object",
            "required": ["username", "password"],
            "properties": {
                "username": {"type": "string"},
                "password": {"type": "string"},
                "role": {"type": "string", "enum": ["관리자", "팀장", "상담사"]},
                "team": {"type": "string"}
            }
        },
        "UserSettings": {
            "type": "object",
            "properties": {
                "chat_push_preview": {"type": "boolean", "description": "채팅 푸시 알림에 내용 표시 여부", "default": True}
            }
        },
        "Chat": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "채팅방 ID"},
                "name": {"type": "string", "description": "채팅방 이름"},
                "is_group": {"type": "boolean", "description": "그룹 채팅 여부"},
                "created_by": {"type": "string", "description": "생성자"},
                "created_at": {"type": "string", "format": "date-time", "description": "생성일시"},
                "message_count": {"type": "integer", "description": "메시지 수"},
                "last_message": {"type": "string", "description": "마지막 메시지"},
                "unread_count": {"type": "integer", "description": "읽지 않은 메시지 수"}
            }
        },
        "ChatSettings": {
            "type": "object",
            "properties": {
                "chat_id": {"type": "string"},
                "title": {"type": "string"},
                "is_group": {"type": "boolean"},
                "is_owner": {"type": "boolean", "description": "방장 여부"},
                "is_admin": {"type": "boolean", "description": "부방장 여부"},
                "muted": {"type": "boolean", "description": "알림 음소거"},
                "participants": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "username": {"type": "string"},
                            "role": {"type": "string", "enum": ["owner", "admin", "member"]}
                        }
                    }
                }
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
                "file_url": {"type": "string", "description": "첨부파일 URL"},
                "file_name": {"type": "string", "description": "첨부파일 이름"}
            }
        },
        "Promotion": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "프로모션 ID"},
                "category": {"type": "string", "description": "대분류"},
                "product_name": {"type": "string", "description": "상품명"},
                "channel": {"type": "string", "description": "채널"},
                "promotion_name": {"type": "string", "description": "프로모션명"},
                "discount_amount": {"type": "string", "description": "금액할인"},
                "session_exemption": {"type": "string", "description": "회차면제"},
                "subscription_types": {"type": "array", "items": {"type": "string"}, "description": "가입유형"},
                "promotion_code": {"type": "string", "description": "패키지 정책 번호"},
                "content": {"type": "string", "description": "내용"},
                "start_date": {"type": "string", "format": "date", "description": "시작일"},
                "end_date": {"type": "string", "description": "종료일 (무기한 가능)"}
            }
        },
        "PromotionInput": {
            "type": "object",
            "required": ["category", "product_name", "channel", "promotion_name", "content", "start_date"],
            "properties": {
                "category": {"type": "string"},
                "product_name": {"type": "string"},
                "channel": {"type": "string"},
                "promotion_name": {"type": "string"},
                "discount_amount": {"type": "string"},
                "session_exemption": {"type": "string"},
                "subscription_types": {"type": "array", "items": {"type": "string"}},
                "promotion_code": {"type": "string"},
                "content": {"type": "string"},
                "start_date": {"type": "string", "format": "date"},
                "end_date": {"type": "string"}
            }
        },
        "Reminder": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "예약 ID"},
                "title": {"type": "string", "description": "제목"},
                "content": {"type": "string", "description": "내용"},
                "scheduled_date": {"type": "string", "format": "date", "description": "예약 날짜"},
                "scheduled_time": {"type": "string", "description": "예약 시간 (HH:MM)"},
                "is_completed": {"type": "boolean", "description": "완료 여부"},
                "created_at": {"type": "string", "format": "date-time"}
            }
        },
        "ReminderInput": {
            "type": "object",
            "required": ["title", "scheduled_date", "scheduled_time"],
            "properties": {
                "title": {"type": "string"},
                "content": {"type": "string"},
                "scheduled_date": {"type": "string", "format": "date"},
                "scheduled_time": {"type": "string"}
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
                "unread_chats": {"type": "integer", "description": "읽지 않은 채팅 수"},
                "today_reminders": {"type": "integer", "description": "오늘 예약 수"}
            }
        },
        "PushSubscription": {
            "type": "object",
            "required": ["endpoint", "keys"],
            "properties": {
                "endpoint": {"type": "string", "description": "푸시 엔드포인트 URL"},
                "keys": {
                    "type": "object",
                    "properties": {
                        "p256dh": {"type": "string"},
                        "auth": {"type": "string"}
                    }
                }
            }
        },
        "NotificationSettings": {
            "type": "object",
            "properties": {
                "reminder_minutes": {"type": "integer", "description": "알림 사전 시간 (분)", "default": 30},
                "repeat_enabled": {"type": "boolean", "description": "반복 알림 여부", "default": False},
                "repeat_interval": {"type": "integer", "description": "반복 간격 (분)", "default": 5},
                "repeat_until_minutes": {"type": "integer", "description": "반복 종료 시간 (분)", "default": 0},
                "daily_summary_enabled": {"type": "boolean", "description": "일일 요약 활성화", "default": True},
                "daily_summary_time": {"type": "string", "description": "일일 요약 시간 (HH:MM)", "default": "09:00"}
            }
        },
        "MemoFolder": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "폴더 ID"},
                "name": {"type": "string", "description": "폴더 이름"},
                "parent_id": {"type": "integer", "description": "부모 폴더 ID (null이면 최상위)"},
                "sort_order": {"type": "integer", "description": "정렬 순서"},
                "created_at": {"type": "string", "format": "date-time"},
                "updated_at": {"type": "string", "format": "date-time"}
            }
        },
        "MemoFolderTree": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "폴더 ID"},
                "name": {"type": "string", "description": "폴더 이름"},
                "parent_id": {"type": "integer", "description": "부모 폴더 ID"},
                "depth": {"type": "integer", "description": "트리 깊이 (0=최상위)"},
                "sort_order": {"type": "integer", "description": "정렬 순서"}
            }
        },
        "Memo": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "메모 ID"},
                "title": {"type": "string", "description": "제목"},
                "content": {"type": "string", "description": "내용"},
                "folder_id": {"type": "integer", "description": "폴더 ID (null이면 미분류)"},
                "folder_name": {"type": "string", "description": "폴더 이름"},
                "is_pinned": {"type": "boolean", "description": "고정 여부"},
                "created_at": {"type": "string", "format": "date-time"},
                "updated_at": {"type": "string", "format": "date-time"}
            }
        },
        "MemoInput": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "제목"},
                "content": {"type": "string", "description": "내용"},
                "folder_id": {"type": "integer", "description": "폴더 ID (null이면 미분류)"}
            }
        },
        "MemoStats": {
            "type": "object",
            "properties": {
                "total_memos": {"type": "integer", "description": "총 메모 수"},
                "total_folders": {"type": "integer", "description": "총 폴더 수"},
                "pinned_memos": {"type": "integer", "description": "고정된 메모 수"},
                "recent_memo": {"$ref": "#/definitions/Memo"}
            }
        }
    }
}

# A2A Solution

Flask 기반 레지스트리 백엔드와 정적 프런트엔드로 구성된 에이전트 레지스트리입니다. JSON 파일을 간단한 “DB”로 사용하며, 에이전트 카드, 룰셋, 조회 로그를 모두 파일로 저장합니다.

## 디렉터리 구조

| 경로 | 설명 |
| --- | --- |
| `app/` | Flask 백엔드 (`solution/app/main.py` 진입점) |
| `frontend/` | 정적 프런트엔드 |
| `data/redisDB/` | JSON 저장소 (`agents.json`, `rulesets.json`, `logs.json`) |
| `tests/` | Pytest 백엔드 테스트 |
| `Dockerfile`, `docker-compose.yml` | 컨테이너 실행 스크립트 |

## 실행 방법

로컬(가상환경 권장):
```bash
python -m venv .venv
source .venv/bin/activate             # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt       # 또는 solution/requirements.txt

# 백엔드 실행 (기본: http://127.0.0.1:3000)
python -m solution.app.main
```
Docker Compose:
```bash
docker compose up -d --build
# 앱: http://localhost:3000
```

## 로그인 흐름
- `/login` 페이지에서 `jwt-server`에 등록된 자격 증명(기본적으로 `admin@example.com/admin123`, `user@example.com/password123`, `user2@example.com/password1234`)을 입력하면 토큰을 받아 대시보드로 이동합니다.
- 별도의 토큰을 갖고 있다면 해당 페이지에서 즉시 붙여넣어 저장해도 됩니다.
- 로그인에 성공하면 JWT가 로컬 스토리지에 보관되고 각 API 요청에 `Authorization: Bearer <token>` 헤더가 자동으로 추가됩니다.
- 인증 서버 주소(`JWT_TOKEN_URL`, `TENANT_API_URL` 등)를 환경 변수로 재정의하면 프록시가 연결을 시도하는 엔드포인트를 조정할 수 있습니다.
- 로그인 후에는 대시보드, 에이전트, 로그, 룰셋 페이지에서 JWT 세션이 유지되어야만 데이터가 보여집니다.

## 데이터 저장 위치
- 에이전트: `data/redisDB/agents.json`
- 룰셋: `data/redisDB/rulesets.json`
- 조회 로그: `data/redisDB/logs.json`

## 주요 API 엔드포인트

- 일반 UI(토큰 없어도 됨):  
  - `GET /api/agents`  
  - `GET /api/agents/<agent_id>`

- 에이전트 전용 조회 (JWT 필수, 조회 IP 로그 남김):  
  - `GET /api/agents/agent-view`  
  - `GET /api/agents/agent-view/<agent_id>`

기타:
- `GET /api/agents/search` : JWT 기반 검색 (Active 상태)
- `GET/POST /api/logs` : 로그 조회/추가

## cURL 예시 (조회 로그가 남는 에이전트 전용 엔드포인트)

`<JWT>`를 실제 토큰으로 교체:
```bash
# 목록
curl -H "Authorization: Bearer <JWT>" -H "Accept: application/json" \
  http://localhost:3000/api/agents/agent-view

# 단건
curl -H "Authorization: Bearer <JWT>" -H "Accept: application/json" \
  http://localhost:3000/api/agents/agent-view/<agent_id>
```

## 주요 환경 변수

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `ADMIN_EMAIL` | `admin@example.com` | 관리자 판단용 이메일 |
| `USERME_DIRECT_URL` | `http://127.0.0.1:8000/users/me` | JWT 검증용 USERME 엔드포인트 |
| `SOLUTION_DATA_ROOT` | (비어있음) | 설정 시 `<root>/data` 대신 이 경로 아래 `data/` 사용 |

## 참고
- JSON 파일이 비어 있으면 UI에 데이터가 보이지 않습니다. 필요한 경우 `data/redisDB/agents.json` 등에 직접 데이터를 채우거나 API로 추가하세요.
- 에이전트 전용 조회(`agent-view`)는 JWT가 있어야 하며, 토큰이 있으면 역할과 관계없이 IP 로그가 남습니다.

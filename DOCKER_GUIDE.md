# Docker Compose 가이드

## 빠른 시작
- 전체 빌드+기동: `docker compose up -d --build`
- 중지(볼륨 유지): `docker compose down`
- 단일 서비스 로그 팔로우: `docker compose logs -f <service>`
- 단일 서비스 재시작(의존성 건드리지 않음): `docker compose restart <service>` 또는 `docker compose up -d --no-deps <service>`

## 서비스 맵 (포트)
- Redis: `redis-agents` 6379, `redis-iam` 6382, `solution-redis` 6381, `jwt-redis` 6380 (db0: users, db1: tenants)
- 코어: `policy-server` 8005, `solution` 3000, `jwt-server` 8000
- 에이전트: `delivery-agent` 10001, `item-agent` 10002, `quality-agent` 10003, `vehicle-agent` 10004
- 오케스트레이션: `orchestrator` 10000, `orchestrator-client` 8010
- 시더: `agent-redis-seeder`

## 개발 단축 명령
- 특정 서비스만 빌드/재기동: `docker compose build <service>` → `docker compose up -d --no-deps <service>`
- 코드만 바뀐 경우(바인드 마운트): `docker compose restart <service>`
- 상태 확인: `docker ps` 후 `docker compose logs -f <service>`

## JWT Redis 리시드 (주의: 데이터 초기화)
- 테넌트/룰셋 초기화: `docker compose exec jwt-redis redis-cli -n 1 FLUSHDB`
- 사용자 초기화: `docker compose exec jwt-redis redis-cli -n 0 FLUSHDB`
- 재시작: `docker compose restart jwt-server`

## 정리 / 프룬
- 중지된 컨테이너 제거: `docker container prune`
- 덩글링 이미지 제거: `docker image prune`
- 모든 볼륨 제거(파괴적): `docker volume prune`

## 트러블슈팅
- 포트 충돌: 3000, 8000, 8005, 8010, 10000-10004, 6380-6382, 6379 사용 여부 확인.
- Redis URL 불일치: 컨테이너 내부 `redis://jwt-redis:6379/1`, 호스트에서 접근 시 `redis://localhost:6380/1` (사용자는 db0).
- 이미지 반영 안 될 때: `docker compose build --no-cache <service>` 후 `up -d --no-deps`.

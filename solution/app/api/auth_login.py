import os
from typing import Sequence

import requests
from flask import jsonify, request

from . import api_bp


def _normalize_token_url(raw: str | None) -> str | None:
    if not raw:
        return None
    cleaned = raw.strip()
    if not cleaned:
        return None
    cleaned = cleaned.rstrip('/')
    if not cleaned.endswith('/token'):
        cleaned = f"{cleaned}/token"
    return cleaned


def _token_urls() -> Sequence[str]:
    candidates = [
        os.getenv('JWT_TOKEN_URL'),
        os.getenv('TENANT_API_URL'),
        'http://jwt-server:8000',
        'http://host.docker.internal:8000',
        'http://localhost:8000',
    ]
    normalized = []
    for item in candidates:
        token_url = _normalize_token_url(item)
        if token_url and token_url not in normalized:
            normalized.append(token_url)
    return normalized


def _error(status: int, code: str, message: str):
    return jsonify({'error': code, 'message': message}), status


@api_bp.post('/auth/login')
def auth_login():
    payload = request.get_json(silent=True) or {}
    username = (payload.get('email') or payload.get('username') or '').strip()
    password = (payload.get('password') or '').strip()

    if not username or not password:
        return _error(400, 'INVALID_INPUT', '이메일과 비밀번호를 모두 입력하세요.')

    for token_url in _token_urls():
        try:
            response = requests.post(
                token_url,
                data={'username': username, 'password': password},
                timeout=5,
            )
        except requests.RequestException:
            continue

        if response.status_code == 200:
            try:
                data = response.json()
            except ValueError:
                return _error(502, 'INVALID_RESPONSE', '인증 서버에서 JWT를 수신하지 못했습니다.')
            if not data or not isinstance(data, dict):
                return _error(502, 'INVALID_RESPONSE', '인증 서버에서 JWT를 수신하지 못했습니다.')
            token = data.get('access_token')
            if not token:
                return _error(502, 'INVALID_RESPONSE', '인증 서버에서 access_token을 반환하지 않았습니다.')
            token_type = data.get('token_type') or 'bearer'
            return jsonify({'access_token': token, 'token_type': token_type})

        if response.status_code in {401, 403}:
            detail = None
            if response.headers.get('Content-Type', '').startswith('application/json'):
                try:
                    detail = response.json().get('detail')
                except ValueError:
                    detail = None
            message = detail or response.reason or '자격 증명을 확인하세요.'
            return _error(response.status_code, 'AUTH_FAILED', message)

        detail = None
        if response.headers.get('Content-Type', '').startswith('application/json'):
            try:
                detail = response.json().get('detail')
            except ValueError:
                detail = None

        message = detail or response.text or '인증 서버 응답에 문제가 있습니다.'
        return _error(response.status_code, 'AUTH_ERROR', message)

    return _error(502, 'AUTH_SERVICE_UNAVAILABLE', '인증 서버에 연결하지 못했습니다.')

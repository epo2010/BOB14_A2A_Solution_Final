const REDIRECT_TARGET = '/dashboard'

const showLoginStatus = (message, isError = false) => {
  const statusEl = document.getElementById('login-status')
  if (!statusEl) return
  statusEl.textContent = message
  statusEl.classList.toggle('status-error', isError)
  statusEl.classList.toggle('status-success', !isError)
}

const handleFormSubmit = async (event) => {
  event.preventDefault()
  if (!window.atsAuth) {
    showLoginStatus('인증 모듈을 준비하는 중입니다.', true)
    return
  }

  const form = event.target
  const formData = new FormData(form)
  const email = (formData.get('email') || '').trim()
  const password = (formData.get('password') || '').toString()

  if (!email || !password) {
    showLoginStatus('이메일과 비밀번호를 모두 입력해주세요.', true)
    return
  }

  showLoginStatus('로그인 중...')

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      const message = payload?.message || '로그인에 실패했습니다. 자격 증명을 확인하세요.'
      showLoginStatus(message, true)
      return
    }

    const data = await response.json()
    if (!data?.access_token) {
      showLoginStatus('서버에서 JWT를 반환하지 않았습니다.', true)
      return
    }

    window.atsAuth.setToken(data.access_token)
    showLoginStatus('로그인 성공! 대시보드로 이동합니다.')
    setTimeout(() => {
      window.location.href = REDIRECT_TARGET
    }, 800)
  } catch (error) {
    console.error('Auth login failed', error)
    showLoginStatus('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.', true)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form')
  if (loginForm) {
    loginForm.addEventListener('submit', handleFormSubmit)
  }
})

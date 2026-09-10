import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FinlyAPI } from '@/lib/api/finly-api'

describe('FinlyAPI Client', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('stores token and user in localStorage on successful login', async () => {
    const mockUser = {
      id: 'usr_test_123',
      email: 'admin@finly.local',
      full_name: 'Admin Finly',
      role: 'admin' as const,
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        access_token: 'fake_jwt_token',
        user: mockUser,
      }),
    })

    const res = await FinlyAPI.login({ email: 'admin@finly.local', password: 'password' })
    expect(res.access_token).toBe('fake_jwt_token')
    expect(res.user.email).toBe('admin@finly.local')
    expect(localStorage.getItem('finly_token')).toBe('fake_jwt_token')
    expect(JSON.parse(localStorage.getItem('finly_user') || '{}')).toEqual(mockUser)
  })

  it('throws descriptive error on failed login', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        detail: 'Identifiants invalides.',
      }),
    })

    await expect(FinlyAPI.login({ email: 'wrong@finly.local', password: 'bad' }))
      .rejects.toThrow('Identifiants invalides.')
  })
})

import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { User } from '@/lib/types/finance'

// Component simulating role-based dropdown navigation item visibility
function ProfileDropdownNav({ user }: { user: User | null }) {
  if (!user) return <div>Non connecte</div>

  const isAdmin = user.role === 'admin'

  return (
    <nav data-testid="profile-dropdown">
      <div data-testid="user-info">{user.full_name}</div>
      <a href="/patrimoine">Patrimoine</a>
      <a href="/compte">Banques & Comptes</a>
      {isAdmin && (
        <a href="/admin" data-testid="admin-link">Administration</a>
      )}
      <button>Deconnexion</button>
    </nav>
  )
}

describe('Role-based Admin visibility in navigation', () => {
  it('renders Administration link when user role is admin', () => {
    const adminUser: User = {
      id: 'usr_admin',
      email: 'admin@finly.local',
      full_name: 'Super Admin',
      role: 'admin',
    }

    render(<ProfileDropdownNav user={adminUser} />)
    expect(screen.getByTestId('admin-link')).toBeDefined()
    expect(screen.getByText('Administration')).toBeDefined()
  })

  it('does NOT render Administration link when user role is member', () => {
    const memberUser: User = {
      id: 'usr_member',
      email: 'member@finly.local',
      full_name: 'Standard Member',
      role: 'member',
    }

    render(<ProfileDropdownNav user={memberUser} />)
    expect(screen.queryByTestId('admin-link')).toBeNull()
    expect(screen.queryByText('Administration')).toBeNull()
  })
})

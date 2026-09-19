import { useAuthStore } from './auth.store';
import { User } from '@/types';

const mockUser: User = {
  id: 'user-1',
  email: 'admin@example.com',
  firstName: 'Test',
  lastName: 'Admin',
  role: 'ADMIN',
  tenantId: 'tenant-1',
} as User;

// Reset the store to its initial state before every test so tests don't
// leak state into each other (the store persists to localStorage).
function resetStore() {
  useAuthStore.getState().clearAuth();
}

describe('useAuthStore', () => {
  beforeEach(() => {
    resetStore();
    window.localStorage.clear();
  });

  it('starts unauthenticated with no user', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('setAuth logs the user in and derives tenantId from the user', () => {
    useAuthStore.getState().setAuth(mockUser, 'citihospital');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.tenantId).toBe('tenant-1');
    expect(state.tenantSlug).toBe('citihospital');
  });

  it('setAuth without a slug leaves tenantSlug null (platform admin login)', () => {
    useAuthStore.getState().setAuth(mockUser);
    expect(useAuthStore.getState().tenantSlug).toBeNull();
  });

  it('logout clears all auth state including tenantProfile', () => {
    useAuthStore.getState().setAuth(mockUser, 'citihospital');
    useAuthStore.getState().setTenantProfile({ name: 'City Hospital' } as never);

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.tenantId).toBeNull();
    expect(state.tenantSlug).toBeNull();
    expect(state.tenantProfile).toBeNull();
  });

  it('updateUser merges partial fields into the existing user', () => {
    useAuthStore.getState().setAuth(mockUser);
    useAuthStore.getState().updateUser({ firstName: 'Updated' });

    expect(useAuthStore.getState().user).toEqual({ ...mockUser, firstName: 'Updated' });
  });

  it('updateUser is a no-op when no user is logged in', () => {
    useAuthStore.getState().updateUser({ firstName: 'Nobody' });
    expect(useAuthStore.getState().user).toBeNull();
  });
});

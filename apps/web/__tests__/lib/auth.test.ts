// test the authorize logic in isolation using InsForge auth
const mockSignIn = jest.fn();

jest.mock('@/lib/insforge', () => ({
  insforge: {
    auth: {
      signInWithPassword: mockSignIn,
    },
  },
}));

async function authorize(
  credentials: { email: string; password: string } | undefined
): Promise<{ id: string; email: string; name: string | null; image: string | null } | null> {
  if (!credentials?.email || !credentials?.password) return null;
  const { insforge } = await import('@/lib/insforge');
  const { data, error } = await insforge.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error || !data?.user) return null;
  const u = data.user;
  return { id: u.id, email: u.email, name: u.name ?? null, image: u.image ?? null };
}

describe('authorize', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
  });

  it('returns null when credentials are missing', async () => {
    const result = await authorize(undefined);
    expect(result).toBeNull();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('returns null when InsForge auth returns an error', async () => {
    mockSignIn.mockResolvedValue({ data: null, error: new Error('Invalid credentials') });
    const result = await authorize({ email: 'test@example.com', password: 'wrongpassword' });
    expect(result).toBeNull();
  });

  it('returns null when user is not in the response', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: null });
    const result = await authorize({ email: 'missing@example.com', password: 'password123' });
    expect(result).toBeNull();
  });

  it('returns user object on valid credentials', async () => {
    mockSignIn.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com', name: 'Test', image: null },
      },
      error: null,
    });
    const result = await authorize({ email: 'test@example.com', password: 'password123' });
    expect(result).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      image: null,
    });
  });
});

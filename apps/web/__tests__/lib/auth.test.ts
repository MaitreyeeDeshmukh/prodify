import bcrypt from 'bcryptjs';

// test the authorize logic in isolation without importing Next.js/Prisma
async function authorize(
  credentials: { email: string; password: string } | undefined,
  findUser: (email: string) => Promise<{
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    password: string | null;
  } | null>
) {
  if (!credentials?.email || !credentials?.password) return null;
  const user = await findUser(credentials.email);
  if (!user || !user.password) return null;
  const valid = await bcrypt.compare(credentials.password, user.password);
  if (!valid) return null;
  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

describe('authorize', () => {
  const hashed = bcrypt.hashSync('password123', 10);
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test',
    image: null,
    password: hashed,
  };

  it('returns null when credentials are missing', async () => {
    const result = await authorize(undefined, async () => mockUser);
    expect(result).toBeNull();
  });

  it('returns null when user not found', async () => {
    const result = await authorize(
      { email: 'missing@example.com', password: 'password123' },
      async () => null
    );
    expect(result).toBeNull();
  });

  it('returns null when password is wrong', async () => {
    const result = await authorize(
      { email: 'test@example.com', password: 'wrongpassword' },
      async () => mockUser
    );
    expect(result).toBeNull();
  });

  it('returns user object on valid credentials', async () => {
    const result = await authorize(
      { email: 'test@example.com', password: 'password123' },
      async () => mockUser
    );
    expect(result).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      image: null,
    });
  });
});

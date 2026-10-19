import { db, isSqlHostConfigured } from './index.ts';
import { users } from './schema.ts';

const localUsers: Array<{ id: number; uid: string; email: string; createdAt: Date }> = [];

export async function getOrCreateUser(uid: string, email: string) {
  try {
    if (isSqlHostConfigured()) {
      const result = await db
        .insert(users)
        .values({
          uid,
          email,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email,
          },
        })
        .returning();

      return result[0];
    }
  } catch (error) {
    console.warn('Postgres getOrCreateUser notice, using local store:', (error as any)?.message || error);
  }

  let user = localUsers.find((u) => u.uid === uid);
  if (!user) {
    user = { id: localUsers.length + 1, uid, email, createdAt: new Date() };
    localUsers.push(user);
  } else {
    user.email = email;
  }
  return user;
}

export async function getUsers() {
  try {
    if (isSqlHostConfigured()) {
      return await db.select().from(users);
    }
  } catch (error) {
    console.warn('Postgres getUsers notice, using local store:', (error as any)?.message || error);
  }
  return localUsers;
}


import 'server-only';

import { cookies } from 'next/headers';
import { createGuestUser } from '@/lib/db/queries';
import { getUserFromHeaders } from '@/lib/utils';

export async function getOrCreateUserId(request: Request): Promise<string> {
  const userId = getUserFromHeaders(request);
  
  if (userId === 'anonymous') {
    const cookieStore = await cookies();
    const existingGuestId = cookieStore.get('guest-user-id')?.value;
    
    if (existingGuestId) {
      return existingGuestId;
    }
    
    const [guestUser] = await createGuestUser();
    cookieStore.set('guest-user-id', guestUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
    
    return guestUser.id;
  }
  
  return userId;
}
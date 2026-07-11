import { redirect } from 'next/navigation';

export default function ProfileRedirectPage(): never {
  redirect('/settings');
}

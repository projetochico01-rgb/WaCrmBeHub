import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PRIVATE_PREFIX = 'hermes-private://'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
    return NextResponse.json({ error: 'Invalid message.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!profile?.account_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: message } = await supabase
    .from('messages')
    .select('media_url, conversations!inner(account_id)')
    .eq('id', messageId)
    .eq('conversations.account_id', profile.account_id)
    .maybeSingle()

  const mediaUrl = message?.media_url
  if (typeof mediaUrl !== 'string' || !mediaUrl.startsWith(PRIVATE_PREFIX)) {
    return NextResponse.json({ error: 'Media not found.' }, { status: 404 })
  }

  const path = mediaUrl.slice(PRIVATE_PREFIX.length)
  const expectedPrefix = `account-${profile.account_id}/`
  if (!path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase.storage
    .from('hermes-private-media')
    .createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Media unavailable.' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl, 307)
}

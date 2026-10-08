import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { CLOUDINARY_FOLDER, signUpload, uploadsEnabled } from '@/lib/cloudinary';

/**
 * Hands a signed-in staff member a one-off signature so the browser can upload
 * a file directly to Cloudinary. Signatures are valid for about an hour and
 * are locked to our folder, so one cannot be reused to write elsewhere.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }
  if (!uploadsEnabled) {
    return NextResponse.json(
      { error: 'Uploads are not set up yet. Add the Cloudinary keys to .env and restart.' },
      { status: 503 },
    );
  }

  let kind = 'image';
  try {
    const body = (await request.json()) as { kind?: string };
    if (body.kind === 'video') kind = 'video';
  } catch {
    /* default to image */
  }

  const folder = `${CLOUDINARY_FOLDER}/${kind === 'video' ? 'videos' : 'images'}`;
  const signed = signUpload({ folder });

  return NextResponse.json({
    ...signed,
    resourceType: kind === 'video' ? 'video' : 'image',
    folder,
  });
}

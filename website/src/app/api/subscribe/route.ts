import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    try {
      const db = await getDatabase();
      const subscribers = db.collection('subscribers');

      // Ensure index exists for unique email
      await subscribers.createIndex({ email: 1 }, { unique: true }).catch(() => {});

      const existing = await subscribers.findOne({ email });
      if (existing) {
        return NextResponse.json({
          success: true,
          alreadySubscribed: true,
          message: "You're already on the priority update list! We'll notify you as new superpowers drop.",
        });
      }

      const userAgent = req.headers.get('user-agent') || 'unknown';
      const ip = req.headers.get('x-forwarded-for') || 'unknown';

      await subscribers.insertOne({
        email,
        createdAt: new Date(),
        source: 'change-firewall-trailer-site',
        userAgent,
        ip,
        status: 'active',
      });

      return NextResponse.json({
        success: true,
        alreadySubscribed: false,
        message: "🎉 You're in! You'll receive early access to new Change Firewall releases & MCP features.",
      });
    } catch (dbError: any) {
      console.error('MongoDB error in /api/subscribe:', dbError.message);

      const isIpBlocked =
        dbError?.message?.includes('SSL alert number 80') ||
        dbError?.message?.includes('tlsv1 alert internal error') ||
        dbError?.name === 'MongoServerSelectionError';

      if (isIpBlocked) {
        console.warn('⚠️ MongoDB Atlas connection rejected: Client IP address is likely not whitelisted in Atlas Network Access.');
      }

      // In development mode, provide a local fallback so waitlist testing works seamlessly
      if (process.env.NODE_ENV === 'development') {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const dataDir = path.join(process.cwd(), '.data');
          await fs.mkdir(dataDir, { recursive: true });
          const filePath = path.join(dataDir, 'subscribers.json');

          let localSubscribers: any[] = [];
          try {
            const raw = await fs.readFile(filePath, 'utf-8');
            localSubscribers = JSON.parse(raw);
          } catch {}

          if (localSubscribers.some((s: any) => s.email === email)) {
            return NextResponse.json({
              success: true,
              alreadySubscribed: true,
              message: "You're already on the priority update list! We'll notify you as new superpowers drop.",
            });
          }

          localSubscribers.push({
            email,
            createdAt: new Date().toISOString(),
            source: 'change-firewall-trailer-site (local-dev-fallback)',
            status: 'active',
          });
          await fs.writeFile(filePath, JSON.stringify(localSubscribers, null, 2));

          return NextResponse.json({
            success: true,
            alreadySubscribed: false,
            message: "🎉 You're in! (Stored locally in development - whitelist your IP in MongoDB Atlas for cloud sync).",
          });
        } catch (fallbackErr) {
          console.error('Local subscriber fallback error:', fallbackErr);
        }
      }

      return NextResponse.json(
        {
          error: isIpBlocked
            ? 'MongoDB Atlas rejected the connection. Please whitelist your IP address in MongoDB Atlas Network Access.'
            : 'Failed to join update list. Please try again in a few moments.',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Subscription unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

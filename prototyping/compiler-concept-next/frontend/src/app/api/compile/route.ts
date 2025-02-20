// // app/api/compile/route.ts
// import { NextResponse } from 'next/server';
// import { Redis } from '@upstash/redis';

// const redis = new Redis({
//   url: "rediss://default:AS2ZAAIjcDFjNTk3MzEwNjc3Zjk0OTA5OGQ3NjE0NDM1MDAyOWE2Y3AxMA@pure-oriole-11673.upstash.io:637",
//   token: "AS2ZAAIjcDFjNTk3MzEwNjc3Zjk0OTA5OGQ3NjE0NDM1MDAyOWE2Y3AxMA"
// });

// export async function POST(req: Request) {
//   try {
//     const { code, language } = await req.json();

//     // Check cache first
//     const cacheKey = `compile:${language}:${Buffer.from(code).toString('base64')}`;
//     const cachedResult = await redis.get(cacheKey);

//     if (cachedResult) {
//       return NextResponse.json(cachedResult);
//     }

//     // Forward to Rust service
//     const response = await fetch('http://localhost:8080/compile', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ code, language }),
//     });

//     const result = await response.json();

//     // Cache successful results
//     if (!result.error) {
//       await redis.set(cacheKey, result, {
//         ex: 3600 // 1 hour expiration
//       });
//     }

//     return NextResponse.json(result);
//   } catch (err: unknown) {
//     return NextResponse.json(
//       { error: 'Failed to compile code', err },
//       { status: 500 }
//     );
//   }
// }


import { NextResponse } from 'next/server';

const COMPILER_URL = process.env.NEXT_PUBLIC_COMPILER_URL || 'http://localhost:3001';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await fetch(`${COMPILER_URL}/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Compilation error:', error);
    return NextResponse.json(
      { error: 'Failed to compile code' },
      { status: 500 }
    );
  }
}

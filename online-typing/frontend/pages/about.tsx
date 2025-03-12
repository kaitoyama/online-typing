import Link from 'next/link';
import Head from 'next/head';
import Navigation from '../components/Navigation';

export default function About() {
  return (
    <div className="min-h-screen p-2 flex flex-col justify-center items-center">
      <Head>
        <title>About - Online Typing</title>
        <meta name="description" content="About Online Typing" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="py-20 flex-1 flex flex-col justify-center items-center w-full max-w-3xl">
        <Navigation />
        <h1 className="m-0 mb-8 leading-tight text-5xl text-center">About Online Typing</h1>
        
        <p className="my-4 leading-relaxed text-lg text-center">
          This is a simple online typing application that demonstrates real-time communication
          using WebSockets between a Next.js frontend and a Go backend.
        </p>
        
        <p className="my-4 leading-relaxed text-lg text-center">
          When you type in the input field on the home page, the text is sent to the server
          and broadcasted to all connected clients.
        </p>
        
        <Link href="/" className="mt-8 inline-block text-blue-600 no-underline hover:underline">
          ← Go back to Home
        </Link>
      </main>
    </div>
  );
}
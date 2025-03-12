import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Navigation() {
  const router = useRouter();
  
  return (
    <nav className="w-full mb-8">
      <ul className="flex list-none p-0 m-0 border-b border-gray-200">
        <li className={`mr-4 py-2 px-4 ${router.pathname === '/' ? 'bg-gray-100 rounded-t-md' : ''}`}>
          <Link href="/" className="text-blue-600 no-underline hover:underline">
            Home
          </Link>
        </li>
        <li className={`mr-4 py-2 px-4 ${router.pathname === '/viewer' ? 'bg-gray-100 rounded-t-md' : ''}`}>
          <Link href="/viewer" className="text-blue-600 no-underline hover:underline">
            Viewer
          </Link>
        </li>
        <li className={`mr-4 py-2 px-4 ${router.pathname === '/about' ? 'bg-gray-100 rounded-t-md' : ''}`}>
          <Link href="/about" className="text-blue-600 no-underline hover:underline">
            About
          </Link>
        </li>
      </ul>
    </nav>
  );
}
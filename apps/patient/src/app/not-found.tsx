export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="max-w-md text-sm text-gray-500">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <a
        href="/dashboard"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Go to dashboard
      </a>
    </div>
  );
}

// Tipos mínimos del entorno de Deno, solo para revisar las Edge Functions con `npm run typecheck:functions`
// (en Supabase corren en Deno de verdad).
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  const env: { get(name: string): string | undefined };
}

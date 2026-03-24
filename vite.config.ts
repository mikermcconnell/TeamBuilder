import path from "path"
import type { IncomingMessage, ServerResponse } from "node:http"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Connect, type Plugin, type ViteDevServer } from "vite"

const localApiModules: Record<string, string> = {
  '/api/ai/team-suggestions': '/api/ai/team-suggestions.ts',
  '/api/ai/name-match': '/api/ai/name-match.ts',
  '/api/ai/group-suggestions': '/api/ai/group-suggestions.ts',
  '/api/ai/team-draft': '/api/ai/team-draft.ts',
}

async function readRequestBody(req: IncomingMessage): Promise<string | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined
  }

  const chunks: Uint8Array[] = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  if (chunks.length === 0) {
    return undefined
  }

  return Buffer.concat(chunks).toString('utf8')
}

function createJsonResponseAdapter(res: ServerResponse) {
  let statusCode = 200

  const adapter = {
    status(code: number) {
      statusCode = code
      return adapter
    },
    json(body: unknown) {
      if (!res.headersSent) {
        res.statusCode = statusCode
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
      }

      res.end(JSON.stringify(body))
    },
    setHeader(name: string, value: string | string[]) {
      res.setHeader(name, value)
    },
  }

  return adapter
}

async function handleLocalApiRequest(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) {
  const pathname = req.url ? new URL(req.url, 'http://127.0.0.1').pathname : ''
  const moduleId = localApiModules[pathname]

  if (!moduleId) {
    next()
    return
  }

  try {
    const requestBody = await readRequestBody(req)
    const module = await server.ssrLoadModule(moduleId)
    const handler = module.default as ((request: { method?: string; body?: unknown; headers?: IncomingMessage['headers'] }, response: ReturnType<typeof createJsonResponseAdapter>) => Promise<void> | void) | undefined

    if (typeof handler !== 'function') {
      throw new Error(`Missing default export for ${moduleId}`)
    }

    const responseAdapter = createJsonResponseAdapter(res)
    await handler({ method: req.method, body: requestBody, headers: req.headers }, responseAdapter)

    if (!res.writableEnded) {
      res.statusCode = 204
      res.end()
    }
  } catch (error) {
    console.error(`Local AI API route failed for ${pathname}:`, error)

    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
    }

    res.end(JSON.stringify({
      ok: false,
      error: {
        code: 'MODEL_ERROR',
        message: error instanceof Error ? error.message : 'Local AI route failed.',
      },
    }))
  }
}

function localAiApiPlugin(): Plugin {
  return {
    name: 'local-ai-api-routes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleLocalApiRequest(server, req, res, next)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  const normalizeId = (id: string) => id.replace(/\\/g, '/')

  return {
    plugins: [react(), localAiApiPlugin()],
    base: '/',
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/tests/setup.ts',
      globals: true,
      css: false,
      clearMocks: true,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        'src/tests/execSkillRating.test.ts',
        'src/tests/firebase-integration.test.ts',
        'src/tests/firestoreRules.test.ts',
      ],
    },
    build: {
      minify: 'terser',
      cssMinify: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = normalizeId(id)

            if (normalizedId.includes('/node_modules/')) {
              if (normalizedId.includes('/react-dom/') || normalizedId.includes('/react/')) {
                return 'react-core'
              }
              if (normalizedId.includes('/firebase/')) {
                return 'firebase'
              }
              if (normalizedId.includes('/@radix-ui/')) {
                return 'ui'
              }
              if (normalizedId.includes('/@dnd-kit/')) {
                return 'dragdrop'
              }
              if (normalizedId.includes('/recharts/')) {
                return 'charts'
              }
              if (normalizedId.includes('/papaparse/') || normalizedId.includes('/read-excel-file/')) {
                return 'importers'
              }
              if (
                normalizedId.includes('/lucide-react/')
                || normalizedId.includes('/clsx/')
                || normalizedId.includes('/tailwind-merge/')
              ) {
                return 'utils'
              }
            }

            if (
              normalizedId.includes('/src/components/ai/')
              || normalizedId.includes('/src/services/ai')
              || normalizedId.includes('/src/shared/ai-')
            ) {
              return 'ai'
            }

            if (
              normalizedId.includes('/src/components/FullScreenTeamBuilder')
              || normalizedId.includes('/src/components/TeamDisplay')
              || normalizedId.includes('/src/components/TeamBoard')
              || normalizedId.includes('/src/hooks/useTeamBuilderActions')
            ) {
              return 'team-builder'
            }

            return undefined
          }
        }
      },
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    },
    server: {
      port: 5173,
      open: true
    },
    preview: {
      port: 4173,
      open: true
    }
  }
})


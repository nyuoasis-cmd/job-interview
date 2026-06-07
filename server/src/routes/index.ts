import { Router } from 'express'
import { configRouter } from './config.js'
import { industriesRouter } from './industries.js'
import { participantsRouter } from './participants.js'
import { sessionsRouter } from './sessions.js'

export function createApiRouter(): Router {
  const router = Router()

  router.use(configRouter)
  router.use(industriesRouter)
  router.use(participantsRouter)
  router.use(sessionsRouter)

  return router
}

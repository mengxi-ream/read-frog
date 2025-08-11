import { vocabularySchema } from '@repo/db'
import { langCodeISO6393Schema } from '@repo/definitions'
import { TRPCError } from '@trpc/server'
import z from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'

export const vocabularyRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      originalText: z.string().min(1),
      translation: z.string().min(1),
      sourceLanguageISO6393: langCodeISO6393Schema.default('eng'),
      targetLanguageISO6393: langCodeISO6393Schema.default('cmn'),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not authenticated' })
      }

      const MAX_ENTRIES_PER_USER = 100
      // Enforce per-user entry limit without importing drizzle helpers
      const existing = await ctx.db.query.vocabulary.findMany({
        where: (vocabulary, { eq }) => eq(vocabulary.userId, ctx.session.user.id),
        columns: { id: true },
        limit: MAX_ENTRIES_PER_USER,
      })

      if (existing.length >= MAX_ENTRIES_PER_USER) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Vocabulary limit reached (${MAX_ENTRIES_PER_USER}). We will remove this limitation in the future when vocabulary feature becomes more stable.`,
        })
      }

      const result = await ctx.db
        .insert(vocabularySchema.vocabulary)
        .values({
          id: crypto.randomUUID(),
          originalText: input.originalText,
          translation: input.translation,
          sourceLanguageISO6393: input.sourceLanguageISO6393,
          targetLanguageISO6393: input.targetLanguageISO6393,
          userId: ctx.session.user.id,
        })
        .returning()

      return result[0]
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not authenticated' })
      }

      const items = await ctx.db.query.vocabulary.findMany({
        where: (vocabulary, { eq }) => eq(vocabulary.userId, ctx.session.user.id),
        orderBy: (vocabulary, { desc }) => desc(vocabulary.createdAt),
      })

      return items
    }),
})

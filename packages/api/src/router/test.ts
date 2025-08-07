import { testSchema } from '@repo/db'
import z from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'

export const testRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return `Hello, ${input.text}!`
    }),
  get: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.query.test.findMany()
    return items
  }),
  create: protectedProcedure.input(z.object({ name: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.insert(testSchema.test).values({
      id: crypto.randomUUID(),
      name: input.name,
    })
  }),
})

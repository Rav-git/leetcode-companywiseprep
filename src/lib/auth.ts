import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import prisma from './prisma'

// Prisma client needs regeneration to include signInToken fields — cast until then
type UserWithToken = {
  id: string; email: string | null; name: string | null
  image: string | null; password: string | null
  signInToken: string | null; signInTokenExpiry: Date | null
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        signInToken: { label: 'Sign-in Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        }) as UserWithToken | null
        if (!user) return null

        // One-time token path (post-OTP verification — no password stored client-side)
        if (credentials.signInToken) {
          const token = credentials.signInToken as string
          if (
            !user.signInToken ||
            !user.signInTokenExpiry ||
            user.signInToken !== token ||
            new Date() > user.signInTokenExpiry
          ) {
            return null
          }
          // Consume token immediately — single use
          await prisma.user.update({
            where: { id: user.id },
            data: { signInToken: null, signInTokenExpiry: null },
          })
          return { id: user.id, email: user.email, name: user.name ?? null, image: user.image ?? null }
        }

        // Password path (normal sign-in)
        if (!credentials.password || !user.password) return null
        const valid = await compare(credentials.password as string, user.password)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name ?? null, image: user.image ?? null }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
})

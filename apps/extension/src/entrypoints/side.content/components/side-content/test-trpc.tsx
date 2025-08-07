import { useQuery } from '@tanstack/react-query'
import { trpc } from '@/utils/trpc'

export default function TestTRPC() {
  const helloQuery = useQuery(trpc.test.hello.queryOptions({ text: 'world' }))
  return (
    <div>
      <div>
        <div>
          {helloQuery.data}
        </div>
      </div>
    </div>
  )
}

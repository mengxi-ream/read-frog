import Aside from './aside'
import Chart from './chart'
import Metrics from './metrics'

export default function BatchRequestRecord() {
  return (
    <section className="flex flex-col gap-8">
      <Metrics />
      <div className="flex flex-wrap gap-4">
        <Aside />
        <Chart />
      </div>
    </section>
  )
}

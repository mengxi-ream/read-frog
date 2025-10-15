import {
  registerCartesianBandAxis,
  registerCartesianCrossHair,
  registerCartesianLinearAxis,
  registerDomTooltipHandler,
  registerLineChart,
  registerTooltip,
  VChart,
} from '@visactor/vchart'

export function VChartRegister() {
  VChart.useRegisters([
    registerLineChart,
    registerCartesianLinearAxis,
    registerCartesianBandAxis,
    registerTooltip,
    registerCartesianCrossHair,
    registerDomTooltipHandler,
  ])

  return null
}

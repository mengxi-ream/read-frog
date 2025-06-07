import { COLOR_OPTIONS } from '../../utils/highlight'

interface ColorPickerProps {
  selectedColor: string
  onColorChange: (color: string) => void
  className?: string
}

export function ColorPicker({ selectedColor, onColorChange, className = '' }: ColorPickerProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700">Highlight Color</h4>
      <div className="flex flex-wrap gap-2">
        {COLOR_OPTIONS.map(({ color, name }) => (
          <button
            type="button"
            key={color}
            onClick={() => onColorChange(color)}
            title={name}
            className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 ${
              selectedColor === color
                ? 'border-gray-600 ring-2 ring-gray-300'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
}

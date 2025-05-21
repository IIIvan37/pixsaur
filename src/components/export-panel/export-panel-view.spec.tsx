import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportPanelView from './export-panel-view'

vi.mock('@/components/ui/icon')

describe('ExportPanelView', () => {
  const onExport = vi.fn()

  beforeEach(() => {
    onExport.mockClear()
  })

  it('renders the export button', () => {
    render(<ExportPanelView onExport={onExport} />)
    expect(
      screen.getByRole('button', { name: /Exporter/i })
    ).toBeInTheDocument()
  })

  it('calls onExport when the button is clicked', async () => {
    render(<ExportPanelView onExport={onExport} />)
    await userEvent.click(screen.getByRole('button', { name: /Exporter/i }))
    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it('renders the DownloadIcon inside the button', () => {
    render(<ExportPanelView onExport={onExport} />)
    const icon = screen.getByTestId('DownloadIcon')
    expect(icon).toBeInTheDocument()
  })

  it('applies the correct class names to the button', () => {
    render(<ExportPanelView onExport={onExport} />)
    const button = screen.getByRole('button', { name: /Exporter/i })
    expect(button.className).toMatch(/exportButton/)
    expect(button.className).toMatch(/button/)
  })

  it('does not call onExport if the button is not clicked', () => {
    render(<ExportPanelView onExport={onExport} />)
    expect(onExport).not.toHaveBeenCalled()
  })

  it('renders with a different onExport function each render', async () => {
    const firstFn = vi.fn()
    const secondFn = vi.fn()
    const { rerender } = render(<ExportPanelView onExport={firstFn} />)
    await userEvent.click(screen.getByRole('button', { name: /Exporter/i }))
    expect(firstFn).toHaveBeenCalledTimes(1)
    rerender(<ExportPanelView onExport={secondFn} />)
    await userEvent.click(screen.getByRole('button', { name: /Exporter/i }))
    expect(secondFn).toHaveBeenCalledTimes(1)
  })

  it('renders without crashing if onExport is a no-op', () => {
    expect(() => {
      render(<ExportPanelView onExport={() => {}} />)
    }).not.toThrow()
  })

  it('button is focusable and can be triggered by keyboard', async () => {
    render(<ExportPanelView onExport={onExport} />)
    const button = screen.getByRole('button', { name: /Exporter/i })
    button.focus()
    expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it('does not render extra buttons', () => {
    render(<ExportPanelView onExport={onExport} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
  })

  it('calls onExport when the button is activated by spacebar', async () => {
    render(<ExportPanelView onExport={onExport} />)
    const button = screen.getByRole('button', { name: /Exporter/i })
    button.focus()
    expect(button).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(onExport).toHaveBeenCalledTimes(1)
  })
})

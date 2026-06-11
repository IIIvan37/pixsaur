import { render, screen } from '@testing-library/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

describe('Tabs', () => {
  it('renders triggers and shows the default tab content', () => {
    render(
      <Tabs defaultValue='one'>
        <TabsList aria-label='Example tabs'>
          <TabsTrigger value='one'>One</TabsTrigger>
          <TabsTrigger value='two'>Two</TabsTrigger>
        </TabsList>
        <TabsContent value='one'>First content</TabsContent>
        <TabsContent value='two'>Second content</TabsContent>
      </Tabs>
    )

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByText('First content')).toBeVisible()
    expect(screen.queryByText('Second content')).not.toBeInTheDocument()
  })
})

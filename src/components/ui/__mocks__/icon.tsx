import React from 'react'

const MockIcon = (
  props: React.ComponentPropsWithoutRef<'span'> & {
    name: string
    'data-testid'?: string
  }
) => <span data-testid={props['data-testid'] ?? props.name} {...props} />

export default MockIcon

import type { Handler, HandlerEvent } from '@netlify/functions'

/**
 * Test function to verify Netlify Functions setup
 */
export const handler: Handler = async (event: HandlerEvent) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify({
      message: 'Pixsaur API is running',
      timestamp: new Date().toISOString(),
      path: event.path
    })
  }
}
